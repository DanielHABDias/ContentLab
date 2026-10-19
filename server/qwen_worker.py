"""Optional Qwen inference subprocess. Content Lab's HTTP server remains Node-only.

Uses Qwen's public API directly; no Voicebox/Kdenlive source is copied.
Protocol: a JSON request file, JSON progress lines on stdout, WAV on disk.
"""
import json
import os
import sys
from pathlib import Path

MODELS = {size: f"Qwen/Qwen3-TTS-12Hz-{size}-Base" for size in ("0.6B", "1.7B")}


def event(message, **kwargs):
    print(json.dumps({"message": message, **kwargs}), flush=True)


def main(request):
    model_id = MODELS[request["model"]]
    from huggingface_hub import snapshot_download
    cache = request.get("cache")
    if request["action"] == "download":
        event("Baixando/verificando pesos Qwen. O primeiro download pode demorar.")
        snapshot_download(model_id, cache_dir=cache)
        snapshot_download("Qwen/Qwen3-TTS-Tokenizer-12Hz", cache_dir=cache)
        event("Modelo disponível localmente.", done=True)
        return
    import torch
    import soundfile as sf
    import numpy as np
    from qwen_tts import Qwen3TTSModel
    device = request.get("device", "cpu")
    if device == "cuda" and not torch.cuda.is_available():
        raise ValueError("GPU CUDA não disponível. Selecione CPU.")
    event("Carregando modelo na memória...")
    # Generation never silently downloads a model: the user installs it first.
    local = snapshot_download(model_id, cache_dir=cache, local_files_only=True)
    model = Qwen3TTSModel.from_pretrained(
        local, device_map=device,
        dtype=torch.float32 if device == "cpu" else torch.float16,
        attn_implementation="sdpa",
    )
    if request.get("seed") is not None:
        torch.manual_seed(request["seed"])
    event("Preparando referência da voz...")
    prompt = model.create_voice_clone_prompt(
        ref_audio=request["reference"], ref_text=request["referenceText"],
        x_vector_only_mode=False,
    )
    output, sample_rate = [], None
    texts = request["chunks"]
    for index, text in enumerate(texts):
        event(f"Gerando trecho {index + 1}/{len(texts)}...", current=index, total=len(texts))
        with torch.inference_mode():
            wavs, sample_rate = model.generate_voice_clone(
                text=text, language=request["language"], voice_clone_prompt=prompt,
                temperature=request["temperature"], top_p=request["topP"],
                repetition_penalty=request["repetitionPenalty"], max_new_tokens=2048,
            )
        audio = np.asarray(wavs[0]).reshape(-1)
        if not len(audio) or not np.isfinite(audio).all():
            raise ValueError("O modelo gerou áudio inválido.")
        if output:
            output.append(np.zeros(round(sample_rate * request["pauseSeconds"]), dtype=np.float32))
        output.append(audio)
    sf.write(request["output"], np.concatenate(output), sample_rate, subtype="PCM_16")
    event("Narração gerada.", done=True)


if __name__ == "__main__":
    try:
        # No user text or reference audio is sent to an external generation API.
        main(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
