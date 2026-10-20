"""Local Chatterbox 0.1.7 multilingual adapter; no external synthesis service.

Weights downloaded only through action=download. Inference is offline and keeps
the official Perth watermark. Selects the official V3 multilingual checkpoint.
"""
import json
import os
import sys
from pathlib import Path

REPO = "ResembleAI/chatterbox"
REVISION = "5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18"
FILES = ["ve.pt", "t3_mtl23ls_v3.safetensors", "s3gen.pt",
         "grapheme_mtl_merged_expanded_v1.json", "conds.pt", "Cangjie5_TC.json"]
LANGUAGES = {"Portuguese": "pt", "English": "en", "Spanish": "es"}


def event(message, **data):
    print(json.dumps({"message": message, **data}), flush=True)


def local_snapshot():
    from huggingface_hub import snapshot_download
    local = Path(snapshot_download(REPO, revision=REVISION, local_files_only=True, allow_patterns=FILES))
    if not all((local / name).is_file() and (local / name).stat().st_size for name in FILES):
        raise ValueError("Download Chatterbox incompleto. Baixe o modelo em Configurações.")
    return local


def load_multilingual_model(local, device, mtl):
    import inspect
    cls = mtl.ChatterboxMultilingualTTS
    if "t3_model" in inspect.signature(cls.from_local).parameters:
        return cls.from_local(local, device=device, t3_model="v3")
    original_loader = mtl.load_safetensors
    def selected_weights(file, *args, **kwargs):
        if Path(file).name == "t3_mtl23ls_v2.safetensors":
            file = local / "t3_mtl23ls_v3.safetensors"
        return original_loader(file, *args, **kwargs)
    mtl.load_safetensors = selected_weights
    try:
        return cls.from_local(local, device=device)
    finally:
        mtl.load_safetensors = original_loader


def sentence_audio(model, text, request, index, torch, np):
    for attempt in range(3):
        if request.get("seed") is not None:
            torch.manual_seed((request["seed"] + index * 31 + attempt) % 2147483648)
        with torch.inference_mode():
            wav = model.generate(
                text, language_id=LANGUAGES[request["language"]],
                audio_prompt_path=request["reference"],
                exaggeration=request["exaggeration"], cfg_weight=request["cfgWeight"],
                temperature=request["temperature"], top_p=request["topP"],
                repetition_penalty=request["repetitionPenalty"],
            )
        samples = wav.detach().cpu().numpy().reshape(-1).copy()
        # Occasionally the sampler emits EOS immediately. Do not silently
        # finalize an obviously empty/too-short sentence as a complete take.
        minimum = max(0.15, len(text.split()) * 0.12)
        if len(samples) / model.sr >= minimum and np.isfinite(samples).all():
            return samples
        event(f"Trecho {index + 1} curto/inválido; repetindo amostragem ({attempt + 1}/3)...")
    raise ValueError(f"Trecho {index + 1} ficou curto ou inválido após 3 tentativas. Ajuste o texto/referência ou use Qwen.")


def main(request):
    if request.get("model") != "chatterbox-multilingual":
        raise ValueError("Modelo Chatterbox inválido.")
    action = request["action"]
    if action == "state":
        try:
            local_snapshot()
            installed = True
        except Exception:
            installed = False
        event("Estado local.", done=True, installed=installed)
        return
    if action == "download":
        from huggingface_hub import snapshot_download
        event("Baixando Chatterbox Multilingual. Pesos de vários GB; nenhuma voz é enviada.")
        snapshot_download(REPO, revision=REVISION, allow_patterns=FILES)
        local_snapshot()
        event("Modelo Chatterbox disponível.", done=True)
        return
    if action != "generate":
        raise ValueError("Ação inválida.")
    if request.get("language") not in LANGUAGES:
        raise ValueError("Chatterbox integrado: português, inglês ou espanhol.")
    # Set before loading optional libraries; generation cannot fetch missing weights.
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    # Some optional upstream tokenizers ignore HF offline mode. Never let a
    # missing auxiliary resource initiate a network download during synthesis.
    import socket
    def offline(*args, **kwargs):
        raise RuntimeError("Recurso ausente: geração Chatterbox é offline. Reprepare o ambiente/modelo.")
    socket.socket.connect = offline
    socket.socket.connect_ex = offline
    socket.create_connection = offline
    local = local_snapshot()
    import torch
    import numpy as np
    import soundfile as sf
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    from chatterbox.models.tokenizers.tokenizer import ChineseCangjieConverter
    # Upstream eagerly initializes Chinese segmentation even for Portuguese,
    # causing an unrelated pkuseg GitHub download. These resources are never
    # used by our three supported language paths; keep the adapter offline.
    ChineseCangjieConverter._load_cangjie_mapping = lambda self, model_dir=None: None
    ChineseCangjieConverter._init_segmenter = lambda self: None
    device = request.get("device", "cpu")
    if device not in ("cpu", "cuda"):
        raise ValueError("Dispositivo inválido.")
    if device == "cuda" and not torch.cuda.is_available():
        raise ValueError("CUDA não disponível no ambiente Chatterbox. Use CPU.")
    if request.get("seed") is not None:
        import random
        random.seed(request["seed"])
        np.random.seed(request["seed"])
        torch.manual_seed(request["seed"])
    # Avoid oversubscription on desktop CPUs.
    torch.set_num_threads(min(8, os.cpu_count() or 1))
    event("Carregando Chatterbox na memória...")
    # The official wheel 0.1.7 hardcodes V2, while upstream's current loader
    # accepts t3_model='v3' with the same architecture/shared vocoder. Select
    # the V3 safetensors file at the loader boundary; never rename the weights
    # or fall back silently to V2. Newer compatible runtimes use native support.
    import chatterbox.mtl_tts as mtl
    model = load_multilingual_model(local, device, mtl)
    output = []
    for index, text in enumerate(request["chunks"]):
        event(f"Gerando trecho expressivo {index + 1}/{len(request['chunks'])}...")
        samples = sentence_audio(model, text, request, index, torch, np)
        if output:
            output.append(np.zeros(round(model.sr * request["pauseSeconds"]), dtype=np.float32))
        output.append(samples)
    sf.write(request["output"], np.concatenate(output), model.sr, subtype="PCM_16")
    event("Áudio expressivo gerado com marca d'água Perth preservada.", done=True)


if __name__ == "__main__":
    try:
        main(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
