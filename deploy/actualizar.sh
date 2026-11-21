#!/usr/bin/env bash
set -euo pipefail
exec python3 "$(dirname -- "${BASH_SOURCE[0]}")/operar.py" --env "${COOPER_ENV_FILE:-/etc/cooper/.env}" actualizar "$@"
