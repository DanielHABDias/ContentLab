#!/usr/bin/env python3
"""Adaptador do Content Lab para o VoxCPM2 (voz clonada em PT-BR).

Instalado pelo assistente de dependências num ambiente isolado em `.tools/`,
com o PyTorch escolhido pelo hardware. Os pesos ficam numa revisão fixada e a
geração roda offline. Limites de memória e núcleos vêm do Content Lab.

Uso:
  contentlab-voice --version
  contentlab-voice --check [--model DIR]
  contentlab-voice --fetch-weights --model DIR --revision SHA
  contentlab-voice --model DIR --device cpu --threads 8 --reference amostra.wav \
      --reference-text "texto lido" --text "texto novo" --output saida.wav
"""
import argparse
import json
import os
import sys
import time

ADAPTER_VERSION = "1"
PACKAGE_VERSION = "2.0.3"
REPOSITORY = "openbmb/VoxCPM2"
WEIGHT_FILES = ["config.json", "model.safetensors", "audiovae.pth", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "tokenization_voxcpm2.py"]


def fail(message, code=1):
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False), file=sys.stderr)
    sys.exit(code)


def missing_weights(model_dir):
    return [name for name in WEIGHT_FILES if not os.path.isfile(os.path.join(model_dir, name))]


def fetch_weights(model_dir, revision):
    from huggingface_hub import snapshot_download
    snapshot_download(repo_id=REPOSITORY, revision=revision, local_dir=model_dir)
    missing = missing_weights(model_dir)
    if missing:
        fail("Pesos incompletos: " + ", ".join(missing))
    with open(os.path.join(model_dir, "contentlab-revision.txt"), "w", encoding="utf-8") as handle:
        handle.write(revision + "\n")
    print(json.dumps({"ok": True, "model": model_dir, "revision": revision}))


def check(model_dir):
    import torch
    import voxcpm  # noqa: F401  (confirma que o pacote importa sem carregar o modelo)
    if model_dir and missing_weights(model_dir):
        fail("Pesos ausentes: " + ", ".join(missing_weights(model_dir)))
    devices = ["cpu"] + (["cuda"] if torch.cuda.is_available() else []) + (["mps"] if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available() else [])
    print(json.dumps({"ok": True, "package": PACKAGE_VERSION, "torch": torch.__version__, "devices": devices}))


def generate(args):
    for name in ("model", "reference", "reference_text", "text", "output"):
        if not getattr(args, name):
            fail(f"Informe --{name.replace('_', '-')}", 2)
    if not os.path.isfile(args.reference):
        fail("Amostra de referência não encontrada")
    if missing_weights(args.model):
        fail("Pesos ausentes: " + ", ".join(missing_weights(args.model)))
    import soundfile
    import torch
    torch.set_num_threads(max(1, args.threads))
    from voxcpm import VoxCPM
    started = time.time()
    model = VoxCPM.from_pretrained(args.model, load_denoiser=False, optimize=False, device=args.device, local_files_only=True)
    loaded = time.time()
    wav = model.generate(text=args.text, prompt_wav_path=args.reference, prompt_text=args.reference_text, reference_wav_path=args.reference)
    elapsed = time.time() - loaded
    rate = model.tts_model.sample_rate
    partial = args.output + ".partial.wav"
    soundfile.write(partial, wav, rate)
    os.replace(partial, args.output)
    duration = len(wav) / rate
    print(json.dumps({"ok": True, "output": args.output, "sampleRate": rate, "audioSeconds": round(duration, 2), "loadSeconds": round(loaded - started, 1), "generationSeconds": round(elapsed, 1), "realtimeFactor": round(elapsed / max(duration, 0.01), 2), "device": args.device}))


def main():
    parser = argparse.ArgumentParser(prog="contentlab-voice")
    parser.add_argument("--version", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--fetch-weights", action="store_true")
    parser.add_argument("--revision")
    parser.add_argument("--model", default=os.environ.get("CONTENTLAB_VOICE_MODEL"))
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda", "mps"])
    parser.add_argument("--threads", type=int, default=max(1, (os.cpu_count() or 4) - 2))
    parser.add_argument("--reference")
    parser.add_argument("--reference-text")
    parser.add_argument("--text")
    parser.add_argument("--output")
    args = parser.parse_args()
    if args.version:
        print(f"contentlab-voice {ADAPTER_VERSION} (voxcpm {PACKAGE_VERSION})")
        return
    if args.fetch_weights:
        if not (args.model and args.revision):
            fail("--fetch-weights exige --model e --revision", 2)
        return fetch_weights(args.model, args.revision)
    if args.check:
        return check(args.model)
    generate(args)


if __name__ == "__main__":
    main()
