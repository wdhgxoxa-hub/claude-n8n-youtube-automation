#!/bin/sh
# Ejecutar dentro del contenedor n8n, después de importar/remapear y respaldar.
# La CLI puede imprimir runData con tokens: se descarta stdout/stderr íntegro.
set -eu
case "${1:-}" in
  CoopEnsayoApr01|CoopEnsayoLec01) ensayo_id=$1 ;;
  *) printf '%s\n' 'ID de ensayo inválido' >&2; exit 2 ;;
esac
if EXECUTIONS_DATA_SAVE_ON_ERROR=none EXECUTIONS_DATA_SAVE_ON_SUCCESS=none \
   EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=false EXECUTIONS_DATA_SAVE_ON_PROGRESS=false \
   N8N_LOG_LEVEL=error n8n execute --id "$ensayo_id" >/dev/null 2>&1; then
  printf '%s\n' '{"comando": "n8n execute", "codigo": 0, "salida_cruda_descartada": true}'
else
  ensayo_codigo=$?
  printf '{"comando": "n8n execute", "codigo": %s, "salida_cruda_descartada": true}\n' "$ensayo_codigo"
  exit "$ensayo_codigo"
fi
