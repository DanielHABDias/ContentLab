#!/usr/bin/env bash
set -euo pipefail
dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
destination="$HOME/.local/share/applications/contentlab.desktop"
mkdir -p "$(dirname "$destination")"
cat > "$destination" <<EOF
[Desktop Entry]
Type=Application
Name=Content Lab
Comment=Editor de vídeo com Node.js e Remotion
Exec="$dir/run.sh"
Path=$dir
Terminal=false
Categories=AudioVideo;Video;
Icon=video-x-generic
StartupNotify=false
EOF
chmod +x "$destination"
echo "Atalho Content Lab instalado no menu de aplicativos."
