#!/bin/bash
set -euo pipefail
cd /ensayo/cooper
export NEXT_TELEMETRY_DISABLED=1 COOPER_CI_REPORTES=1 CIRCLE_NODE_TOTAL=1 RAYON_NUM_THREADS=1 UV_THREADPOOL_SIZE=1
export npm_config_update_notifier=false npm_config_fund=false npm_config_userconfig=/ensayo/cooper/ci/npmrc npm_config_globalconfig=/dev/null
# Mismo ajuste de entornoLimpio: cabeceras ya incluidas en la imagen Node.
export npm_package_config_node_gyp_nodedir=/usr/local
mkdir -p .cache/puerta
paso() {
  local nombre="$1"
  shift
  printf 'M12 inicio %s\n' "$nombre"
  local rc=0
  "$@" > ".cache/puerta/$nombre.log" 2>&1 || rc=$?
  printf '%s %s\n' "$nombre" "$rc" >> .cache/puerta/rc.txt
  tail -8 ".cache/puerta/$nombre.log"
  if [ "$rc" != 0 ]; then exit "$rc"; fi
  node --input-type=module -e 'import {avisos} from "./scripts/puerta.mjs"; import {readFileSync} from "node:fs"; const a=avisos(readFileSync(process.argv[1],"utf8")); if(a.length){console.error(a.join("\n"));process.exit(1);}' ".cache/puerta/$nombre.log"
}
paso ci npm ci
paso preparacion node scripts/preparar-pruebas.mjs
paso lint npm run lint
paso typecheck npm run typecheck
paso unitarias npm test
paso e2e npm run test:e2e
paso build npm run build
paso flujos node --test ../tests/flujos_v2.test.cjs
node --input-type=module -e 'import {comprobarResultados} from "./scripts/puerta.mjs"; import {readFileSync,writeFileSync} from "node:fs"; const d=".cache/puerta/"; const r=comprobarResultados(JSON.parse(readFileSync(d+"vitest.json")),JSON.parse(readFileSync(d+"playwright.json")),readFileSync(d+"flujos.log","utf8")); writeFileSync(d+"resultado.json",JSON.stringify({resultado:"PASS",pruebas:r,advertencias:0,workers:1},null,2)+"\n"); console.log(r);'
