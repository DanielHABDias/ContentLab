#!/bin/sh
# Instala o Content Lab para o usuário atual (sem sudo). Não precisa de npm.
set -eu
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
exec "$HERE/runtime/node" "$HERE/app/scripts/contentlab-installer.mjs" --install "$HERE" "$@"
