#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
source scripts/bootstrap-linux.sh
contentlab_bootstrap
exec node server/launcher.mjs
