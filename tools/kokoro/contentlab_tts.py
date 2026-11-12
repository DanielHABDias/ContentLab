#!/usr/bin/env python3
"""Adaptador do Content Lab para a narração padrão (Kokoro-82M via kokoro-onnx).

Voz sintética local em PT-BR, sem clonagem: kokoro-onnx (MIT) e pesos Kokoro-82M
(Apache-2.0, treinados só com áudio de licença permissiva). Roda em CPU, offline.
Os arquivos do modelo são baixados com SHA-256 fixado.

Uso:
  contentlab-tts --version
  contentlab-tts --check --model DIR
  contentlab-tts --fetch-weights --model DIR
  contentlab-tts --voices --model DIR
  contentlab-tts --model DIR --voice pm_alex --speed 1.0 --lang pt-br --text-file texto.txt --output saida.wav [--threads 4]
"""
import argparse
import hashlib
import json
import os
import sys
import time
import urllib.request

ADAPTER_VERSION = "1"
PACKAGE_VERSION = "0.6.1"
RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/"
FILES = {
    "kokoro-v1.0.onnx": ("beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a", 325505369),
    "voices-v1.0.bin": ("bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d", 28214398),
}
PT_VOICES = ["pf_dora", "pm_alex", "pm_santa"]


def fail(message, code=1):
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False), file=sys.stderr)
    sys.exit(code)


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verified(model_dir):
    problems = []
    for name, (expected, size) in FILES.items():
        path = os.path.join(model_dir, name)
        if not os.path.isfile(path):
            problems.append(f"{name} ausente")
        elif os.path.getsize(path) != size:
            problems.append(f"{name} com tamanho inesperado")
    return problems


def fetch_weights(model_dir):
    os.makedirs(model_dir, exist_ok=True)
    for name, (expected, size) in FILES.items():
        target = os.path.join(model_dir, name)
        if os.path.isfile(target) and os.path.getsize(target) == size and sha256(target) == expected:
            continue
        partial = target + ".partial"
        with urllib.request.urlopen(RELEASE + name, timeout=60) as response, open(partial, "wb") as output:
            while True:
                chunk = response.read(1 << 20)
                if not chunk:
                    break
                output.write(chunk)
        if os.path.getsize(partial) != size or sha256(partial) != expected:
            os.remove(partial)
            fail(f"{name} não confere com o SHA-256 fixado")
        os.replace(partial, target)
    print(json.dumps({"ok": True, "model": model_dir}))


def load(model_dir, threads):
    problems = verified(model_dir)
    if problems:
        fail("Modelo incompleto: " + ", ".join(problems) + ". Reinstale em Dependências.")
    if threads:
        os.environ["OMP_NUM_THREADS"] = str(threads)
    import onnxruntime  # noqa: F401  (falha cedo e clara se faltar)
    from kokoro_onnx import Kokoro
    return Kokoro(os.path.join(model_dir, "kokoro-v1.0.onnx"), os.path.join(model_dir, "voices-v1.0.bin"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--fetch-weights", action="store_true")
    parser.add_argument("--voices", action="store_true")
    parser.add_argument("--model", default=os.environ.get("CONTENTLAB_TTS_MODEL") or os.environ.get("CONTENTLAB_VOICE_MODEL"))
    parser.add_argument("--revision")  # compatível com o instalador; os arquivos são fixados por SHA-256
    parser.add_argument("--voice", default="pm_alex")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--lang", default="pt-br")
    parser.add_argument("--text-file")
    parser.add_argument("--output")
    parser.add_argument("--threads", type=int, default=0)
    args = parser.parse_args()

    if args.version:
        print(f"contentlab-tts {ADAPTER_VERSION} (kokoro-onnx {PACKAGE_VERSION}, Kokoro-82M v1.0)")
        return
    if not args.model:
        fail("Informe --model")
    if args.fetch_weights:
        fetch_weights(args.model)
        return
    if args.check:
        kokoro = load(args.model, args.threads)
        voices = [voice for voice in kokoro.get_voices() if voice in PT_VOICES]
        samples, rate = kokoro.create("Teste.", voice=voices[0], lang="pt-br")
        print(json.dumps({"ok": True, "voices": voices, "sampleRate": rate, "seconds": round(len(samples) / rate, 2)}))
        return
    if args.voices:
        print(json.dumps({"ok": True, "voices": PT_VOICES}))
        return
    if not (args.text_file and args.output):
        fail("Informe --text-file e --output")
    if args.voice not in PT_VOICES:
        fail(f"Voz desconhecida: {args.voice}. Use {', '.join(PT_VOICES)}")
    if not 0.5 <= args.speed <= 2.0:
        fail("Velocidade deve ficar entre 0.5 e 2.0")
    with open(args.text_file, encoding="utf-8") as handle:
        text = handle.read().strip()
    if not text:
        fail("Texto vazio")
    import wave
    import numpy as np
    kokoro = load(args.model, args.threads)
    started = time.time()
    # Frases longas são geradas por parágrafo para manter a prosódia e a memória estáveis.
    parts = [part.strip() for part in text.split("\n") if part.strip()]
    audio = []
    rate = 24000
    for part in parts:
        samples, rate = kokoro.create(part, voice=args.voice, speed=args.speed, lang=args.lang)
        audio.append(samples)
        audio.append(np.zeros(int(rate * 0.35), dtype=samples.dtype))
    joined = np.concatenate(audio[:-1]) if audio else np.zeros(1)
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    pcm = (np.clip(joined, -1.0, 1.0) * 32767).astype("<i2").tobytes()
    with wave.open(args.output, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(rate)
        output.writeframes(pcm)
    print(json.dumps({"ok": True, "seconds": round(len(joined) / rate, 2), "elapsed": round(time.time() - started, 2), "voice": args.voice}))


if __name__ == "__main__":
    main()
