#!/usr/bin/env python3
"""Adaptador do Content Lab para o Chatterbox Multilingual (PT-BR).

Instalado pelo assistente de dependências num ambiente isolado em `.tools/`.
Usa pesos baixados numa revisão fixada (`--model`), nunca a revisão `main`.

Uso:
  contentlab-chatterbox --version
  contentlab-chatterbox --check [--model DIR]
  contentlab-chatterbox --model DIR --language pt-br --reference amostra.wav --text "..." --output saida.wav
  contentlab-chatterbox --fetch-weights --model DIR --revision SHA
"""
import argparse
import json
import os
import sys

ADAPTER_VERSION = "1"
PACKAGE_VERSION = "0.1.7"
REPOSITORY = "ResembleAI/chatterbox"
WEIGHT_FILES = ["ve.pt", "t3_mtl23ls_v2.safetensors", "s3gen.pt", "grapheme_mtl_merged_expanded_v1.json", "conds.pt", "Cangjie5_TC.json"]
LANGUAGES = {"pt-br": "pt", "pt": "pt"}


def fail(message, code=1):
    print(json.dumps({"ok": False, "error": message}), file=sys.stderr)
    sys.exit(code)


def device():
    import torch
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def fetch_weights(model_dir, revision):
    from huggingface_hub import snapshot_download
    path = snapshot_download(repo_id=REPOSITORY, repo_type="model", revision=revision, allow_patterns=WEIGHT_FILES, local_dir=model_dir)
    missing = [name for name in WEIGHT_FILES if not os.path.isfile(os.path.join(path, name))]
    if missing:
        fail("Pesos incompletos: " + ", ".join(missing))
    with open(os.path.join(model_dir, "contentlab-revision.txt"), "w", encoding="utf-8") as handle:
        handle.write(revision + "\n")
    print(json.dumps({"ok": True, "model": model_dir, "revision": revision}))


def check(model_dir):
    import chatterbox  # noqa: F401  (confirma que o pacote importa)
    from chatterbox.mtl_tts import SUPPORTED_LANGUAGES
    if "pt" not in SUPPORTED_LANGUAGES:
        fail("Esta versão do Chatterbox não suporta português")
    if model_dir:
        missing = [name for name in WEIGHT_FILES if not os.path.isfile(os.path.join(model_dir, name))]
        if missing:
            fail("Pesos ausentes: " + ", ".join(missing))
    print(json.dumps({"ok": True, "package": PACKAGE_VERSION, "device": device()}))


def generate(args):
    if args.language.lower() not in LANGUAGES:
        fail("Idioma não suportado pelo Content Lab: " + args.language)
    if not os.path.isfile(args.reference):
        fail("Amostra de referência não encontrada")
    if not args.text.strip():
        fail("Texto vazio")
    import torchaudio
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    model = ChatterboxMultilingualTTS.from_local(args.model, device())
    wav = model.generate(args.text, language_id=LANGUAGES[args.language.lower()], audio_prompt_path=args.reference)
    partial = args.output + ".partial.wav"
    torchaudio.save(partial, wav, model.sr)
    os.replace(partial, args.output)
    print(json.dumps({"ok": True, "output": args.output, "sampleRate": model.sr, "watermark": "perth"}))


def main():
    parser = argparse.ArgumentParser(prog="contentlab-chatterbox")
    parser.add_argument("--version", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--fetch-weights", action="store_true")
    parser.add_argument("--revision")
    parser.add_argument("--model", default=os.environ.get("CONTENTLAB_CHATTERBOX_MODEL"))
    parser.add_argument("--language", default="pt-br")
    parser.add_argument("--reference")
    parser.add_argument("--text")
    parser.add_argument("--output")
    args = parser.parse_args()
    if args.version:
        print(f"contentlab-chatterbox {ADAPTER_VERSION} (chatterbox-tts {PACKAGE_VERSION})")
        return
    if args.fetch_weights:
        if not (args.model and args.revision):
            fail("--fetch-weights exige --model e --revision", 2)
        return fetch_weights(args.model, args.revision)
    if args.check:
        return check(args.model)
    if not (args.model and args.reference and args.text and args.output):
        fail("Informe --model, --reference, --text e --output", 2)
    generate(args)


if __name__ == "__main__":
    main()
