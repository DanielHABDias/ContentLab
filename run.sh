#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Instale Node.js 22+ e npm antes de executar Content Lab." >&2
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  echo "Instale FFmpeg e FFprobe. Ubuntu/Zorin: sudo apt install ffmpeg." >&2
  exit 1
fi
if [[ ! -d node_modules ]]; then npm install --no-audit --no-fund; fi
if [[ ! -d backend/remotion/node_modules ]]; then npm ci --prefix backend/remotion --no-audit --no-fund; fi
echo "Content Lab Node/Remotion disponível em http://127.0.0.1:5000"
if command -v xdg-open >/dev/null 2>&1 && [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
  (sleep 1; xdg-open http://127.0.0.1:5000 >/dev/null 2>&1 || true) &
fi
exec node server/http.mjs
