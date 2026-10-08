"""Decode audio for Whisper without relying on PyAV's changing av.open API."""

import os
import subprocess
from pathlib import Path

import numpy as np

try:
    from . import ffmpeg_helper
except ImportError:  # PyInstaller entry points also import backend modules directly.
    import ffmpeg_helper


def decode_for_whisper(source):
    ffmpeg_dir = ffmpeg_helper.ensure_ffmpeg()
    ffmpeg = Path(ffmpeg_dir) / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg")
    command = [str(ffmpeg), "-hide_banner", "-loglevel", "error", "-nostdin", "-i", str(source),
               "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"]
    try:
        result = subprocess.run(command, capture_output=True, timeout=1800,
                                creationflags=0x08000000 if os.name == "nt" else 0)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("A leitura do áudio demorou demais. Confira o arquivo e tente novamente.") from exc
    if result.returncode or not result.stdout:
        detail = result.stderr.decode("utf-8", errors="replace").strip().splitlines()
        raise RuntimeError("Não foi possível ler o áudio da narração. " + (detail[-1] if detail else "Confira se ele contém uma faixa de áudio válida."))
    if len(result.stdout) % 4:
        raise RuntimeError("O decodificador retornou áudio incompleto.")
    return np.frombuffer(result.stdout, dtype=np.float32)
