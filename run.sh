#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"

python_bin="${PYTHON:-python3}"
if ! command -v "$python_bin" >/dev/null 2>&1; then
  echo "Python 3 não encontrado. Instale Python 3.9 ou superior." >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  echo "FFmpeg não encontrado." >&2
  echo "Ubuntu/Debian: sudo apt install ffmpeg" >&2
  echo "Fedora: sudo dnf install ffmpeg | Arch: sudo pacman -S ffmpeg" >&2
  exit 1
fi

if [[ ! -x .venv/bin/python ]]; then
  "$python_bin" -m venv .venv
fi

.venv/bin/python -m pip install --disable-pip-version-check -r backend/requirements.txt
.venv/bin/python -m backend.prepare_runtime

echo "Content Lab disponível em http://127.0.0.1:5000"
if command -v xdg-open >/dev/null 2>&1 && [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
  (sleep 1; xdg-open http://127.0.0.1:5000 >/dev/null 2>&1 || true) &
fi

exec .venv/bin/python -m backend.app
