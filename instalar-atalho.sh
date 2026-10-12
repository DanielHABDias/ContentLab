#!/usr/bin/env bash
set -euo pipefail
dir="$(cd "$(dirname "$0")" && pwd)"
bin="$HOME/.local/share/applications"
mkdir -p "$bin"
cat > "$bin/contentlab.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Content Lab
Comment=Editor de vídeo com Node.js e Remotion
Exec=sh -c 'cd "${dir}" && ./run.sh'
Terminal=false
Categories=AudioVideo;Video;
Icon=video-x-generic
StartupNotify=true
EOF
chmod +x "$bin/contentlab.desktop"
echo "Atalho Content Lab instalado no menu de aplicativos."
