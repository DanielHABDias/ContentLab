#!/usr/bin/env bash
# Content Lab: self-install only missing tools, inside .tools/ (no global changes).
# This script is sourced by run.sh.
set -euo pipefail
CL_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CL_TOOLS="$CL_ROOT/.tools"
CL_NODE_VERSION="22.16.0"

cl_log(){ printf '[Content Lab] %s\n' "$*"; }
cl_die(){ printf '[Content Lab] ERRO: %s\n' "$*" >&2; return 1; }
cl_download(){
  command -v curl >/dev/null 2>&1 || cl_die "curl é necessário para baixar dependências."
  curl --fail --location --silent --show-error --retry 3 --connect-timeout 20 "$1" -o "$2"
}
cl_arch(){
  case "$(uname -m)" in
    x86_64|amd64) printf 'x64';;
    aarch64|arm64) printf 'arm64';;
    *) cl_die "Arquitetura Linux não suportada automaticamente: $(uname -m)";;
  esac
}
cl_hash(){
  local expected="$1" file="$2"
  printf '%s  %s\n' "$expected" "$file" | sha256sum --check --status || cl_die "Checksum SHA256 inválido: $file"
}
cl_release_hash(){
  local sums="$1" name="$2" result
  result="$(awk -v n="$name" '$2==n || $2=="*"n {print $1; exit}' "$sums")"
  [[ "$result" =~ ^[a-fA-F0-9]{64}$ ]] || cl_die "Sem hash oficial para $name."
  printf '%s' "$result"
}
cl_has_node(){
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 &&
    [[ "$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)" -ge 22 ]]
}
cl_install_node(){
  if cl_has_node; then cl_log "Node.js $(node -v) e npm encontrados."; return; fi
  if [[ -x "$CL_TOOLS/node/bin/node" ]]; then export PATH="$CL_TOOLS/node/bin:$PATH"; fi
  if cl_has_node; then cl_log "Node.js local reutilizado."; return; fi
  local arch filename base dir
  arch="$(cl_arch)"
  filename="node-v${CL_NODE_VERSION}-linux-${arch}.tar.xz"
  base="https://nodejs.org/dist/v${CL_NODE_VERSION}"
  dir="$(mktemp -d)"
  cl_log "Instalando Node.js ${CL_NODE_VERSION} localmente..."
  cl_download "$base/SHASUMS256.txt" "$dir/SHASUMS256.txt"
  cl_download "$base/$filename" "$dir/$filename"
  cl_hash "$(cl_release_hash "$dir/SHASUMS256.txt" "$filename")" "$dir/$filename"
  mkdir -p "$CL_TOOLS"
  tar -xJf "$dir/$filename" -C "$dir"
  rm -rf "$CL_TOOLS/node"
  mv "$dir/node-v${CL_NODE_VERSION}-linux-${arch}" "$CL_TOOLS/node"
  rm -rf "$dir"
  export PATH="$CL_TOOLS/node/bin:$PATH"
  cl_has_node || cl_die "Node/npm não ficaram disponíveis após a instalação."
}
cl_has_ffmpeg(){ command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; }
cl_install_ffmpeg(){
  if cl_has_ffmpeg; then cl_log "FFmpeg/FFprobe encontrados."; return; fi
  export PATH="$CL_TOOLS/ffmpeg:$PATH"
  if cl_has_ffmpeg; then cl_log "FFmpeg/FFprobe locais reutilizados."; return; fi
  local arch filename dir base found
  arch="$(cl_arch)"
  [[ "$arch" == x64 ]] && arch="linux64" || arch="linuxarm64"
  filename="ffmpeg-master-latest-${arch}-gpl.tar.xz"
  base="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest"
  dir="$(mktemp -d)"
  cl_log "Baixando FFmpeg/FFprobe portáteis..."
  cl_download "$base/checksums.sha256" "$dir/checksums.sha256"
  cl_download "$base/$filename" "$dir/$filename"
  cl_hash "$(cl_release_hash "$dir/checksums.sha256" "$filename")" "$dir/$filename"
  mkdir -p "$CL_TOOLS/ffmpeg"
  tar -xJf "$dir/$filename" -C "$dir"
  found="$(find "$dir" -type f -name ffmpeg -print -quit)"
  [[ -n "$found" ]] || cl_die "Arquivo do FFmpeg não contém executáveis."
  cp "$(dirname "$found")/ffmpeg" "$(dirname "$found")/ffprobe" "$CL_TOOLS/ffmpeg/"
  chmod +x "$CL_TOOLS/ffmpeg/"{ffmpeg,ffprobe}
  rm -rf "$dir"
  cl_has_ffmpeg || cl_die "Falha ao instalar FFmpeg."
}
cl_has_whisper(){
  local target="${CONTENTLAB_WHISPER_CLI:-whisper-cli}"
  command -v "$target" >/dev/null 2>&1 || [[ -x "$target" ]]
}
cl_install_whisper(){
  if cl_has_whisper; then cl_log "whisper-cli encontrado."; return; fi
  export PATH="$CL_TOOLS/whisper:$PATH"
  if cl_has_whisper; then cl_log "whisper-cli local reutilizado."; return; fi
  cl_log "Preparando whisper.cpp (compilação local CPU)..."
  local missing=()
  for bin in cmake c++ make; do command -v "$bin" >/dev/null 2>&1 || missing+=("$bin"); done
  if (( ${#missing[@]} )); then
    if command -v apt-get >/dev/null 2>&1; then
      cl_log "Faltam ${missing[*]}. Instalando compilador e CMake com permissão do sistema..."
      if command -v sudo >/dev/null 2>&1; then
        sudo apt-get update
        sudo apt-get install -y build-essential cmake
      elif [[ "$EUID" -eq 0 ]]; then
        apt-get update
        apt-get install -y build-essential cmake
      else
        cl_die "Necessário instalar cmake e build-essential (não foi encontrado sudo)."
      fi
    else cl_die "Instale cmake, compilador C++ e make nesta distribuição Linux."; fi
  fi
  local dir
  dir="$(mktemp -d)"
  cl_download "https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.9.4.tar.gz" "$dir/whisper.tar.gz"
  tar -xzf "$dir/whisper.tar.gz" -C "$dir"
  cmake -S "$dir/whisper.cpp-1.9.4" -B "$dir/build" -DWHISPER_SDL2=OFF -DGGML_NATIVE=OFF -DCMAKE_BUILD_TYPE=Release
  cmake --build "$dir/build" --config Release -j 2
  local found
  found="$(find "$dir/build" -type f -name whisper-cli -print -quit)"
  [[ -n "$found" ]] || cl_die "Compilação do whisper.cpp não gerou whisper-cli."
  mkdir -p "$CL_TOOLS/whisper"
  cp "$found" "$CL_TOOLS/whisper/whisper-cli"
  # Some build configurations place shared libs beside whisper-cli.
  find "$(dirname "$found")" -maxdepth 1 -type f \( -name '*.so' -o -name '*.so.*' \) -exec cp -P {} "$CL_TOOLS/whisper/" \;
  chmod +x "$CL_TOOLS/whisper/whisper-cli"
  rm -rf "$dir"
  cl_has_whisper || cl_die "whisper-cli indisponível após compilação."
}
cl_install_model(){
  if [[ -n "${CONTENTLAB_WHISPER_MODEL:-}" ]]; then
    [[ -s "$CONTENTLAB_WHISPER_MODEL" ]] || cl_die "Modelo configurado em CONTENTLAB_WHISPER_MODEL não existe."
    cl_log "Modelo Whisper configurado pelo usuário encontrado."; return
  fi
  local existing="$HOME/.cache/whisper.cpp/ggml-base.bin"
  if [[ -s "$existing" ]]; then
    export CONTENTLAB_WHISPER_MODEL="$existing"
    cl_log "Modelo Whisper existente reutilizado."; return
  fi
  local target="$CL_TOOLS/models/ggml-base.bin" tmp
  mkdir -p "$CL_TOOLS/models"
  if [[ ! -s "$target" ]]; then
    cl_log "Baixando modelo de português Whisper base (~148 MB)..."
    tmp="$target.partial"
    cl_download "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" "$tmp"
    cl_hash "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe" "$tmp"
    mv "$tmp" "$target"
  fi
  export CONTENTLAB_WHISPER_MODEL="$target"
}
cl_install_npm(){
  local root="$CL_ROOT" fingerprint stamp
  fingerprint="$(sha256sum "$root/package.json" | awk '{print $1}')"
  stamp="$root/node_modules/.contentlab-package.sha256"
  if [[ ! -f "$stamp" || "$(cat "$stamp")" != "$fingerprint" || ! -f "$root/node_modules/express/package.json" ]]; then
    cl_log "Instalando/verificando dependências Node do servidor..."
    (cd "$root" && npm install --no-package-lock --no-audit --no-fund)
    mkdir -p "$root/node_modules"
    printf '%s' "$fingerprint" > "$stamp"
  else cl_log "Dependências Node do servidor atualizadas."; fi
  fingerprint="$(sha256sum "$root/backend/remotion/package-lock.json" | awk '{print $1}')"
  stamp="$root/backend/remotion/node_modules/.contentlab-package.sha256"
  if [[ ! -f "$stamp" || "$(cat "$stamp")" != "$fingerprint" || ! -f "$root/backend/remotion/node_modules/remotion/package.json" ]]; then
    cl_log "Instalando/verificando Remotion..."
    npm ci --prefix "$root/backend/remotion" --no-audit --no-fund
    printf '%s' "$fingerprint" > "$stamp"
  else cl_log "Dependências Remotion atualizadas."; fi
}
contentlab_bootstrap(){
  mkdir -p "$CL_TOOLS"
  cl_install_node
  cl_install_ffmpeg
  if [[ "${CONTENTLAB_BOOTSTRAP_SKIP_WHISPER:-0}" != 1 ]]; then
    cl_install_whisper
    cl_install_model
  else cl_log "Whisper ignorado por CONTENTLAB_BOOTSTRAP_SKIP_WHISPER=1."; fi
  cl_install_npm
  cl_log "Dependências prontas."
}
