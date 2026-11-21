# Cooper total — corrección del ensayo Sentinel

21-11-2026, Lima. Rama/worktree `total-sentinel-guardia`, base integrada `80bb7cb` (M08/M10). No hubo acceso ni mutación del VPS. El orquestador encargó corregir cuatro fallos `ERR_BLOCKED_BY_CLIENT.Inspector` de su ronda final-1, conservando el guardián, evaluador y caos.

## Causa y corrección

El informe `cooper/.cache/videos-integracion3/final-1/sentinel-1440/informe.json` registra cuatro errores de consola durante caos y un intento `POST /api/operacion` bloqueado por el guardián. `InterruptorAprendizaje` (`cooper/src/componentes/resultados.tsx:332`) realiza esa escritura desde `onChange`. El input tiene `role=switch`, pero el texto está en su label; el guardián compara texto propio del elemento clicable y no lo hereda. `formFiller` podía seleccionarlo.

El adaptador ahora excluye exactamente `section[aria-label="Control del aprendizaje"] input[role="switch"]` y el texto de su etiqueta. La exclusión de «Investigar competencia», que ya existía en el ensayo aislado de Marcas, también se aplica a la matriz general. Los filtros, selección de red, botón Actualizar, detalles y enlace de ajustes siguen disponibles. Las listas se extraen a `cooper/scripts/sentinel_exclusiones.py` para que el adaptador y la regresión usen el mismo contrato.

No se modificaron archivos vendorizados, evaluador, gravedad, reglas de red ni mensajes de consola. No se ignora `ERR_BLOCKED_BY_CLIENT`: una escritura que eluda los controles sigue bloqueada y produce un hallazgo visible de gravedad media. Las mutaciones funcionales siguen cubiertas por Playwright en `cooper/e2e/resultados.spec.ts:21` y `cooper/e2e/marcas.spec.ts:64`.

## Prueba significativa

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/cooper/.cache/sentinel-browsers" \
  cooper/.cache/sentinel-venv/bin/python -W error -m unittest discover \
  -s tests -p 'test_sentinel_exclusiones.py' -v
```

Resultado: **3/3 PASS**, código 0, 6,494 segundos, cero errores y advertencias. Navegador real con guardián vendorizado, fixture HTTP efímera de loopback y gremlins local fijado por M08:

- El input, label e investigación quedan excluidos; click y teclado no disparan escrituras. Los filtros y GET siguen funcionando. La horda ejecuta 350 acciones solicitadas, con contador realizado mayor que cero, sin mutaciones ni errores de consola.
- Un POST deliberado que evita la interfaz queda bloqueado antes de alcanzar la fixture; el evaluador original conserva su error de consola. No hay supresión general.
- Todos los hashes del vendor Sentinel coinciden con `origen.json`.

`git diff --check` correcto. La preparación usa venv propia con las dependencias fijadas por M08. Para esta corrección del harness se ejecutó la regresión dirigida; la puerta completa y las dos rondas Sentinel + Playwright del código integrado siguen a cargo del orquestador. No se atribuye una ronda integral limpia a estas tres pruebas.

## Commits y cierre

El commit de esta entrega contiene adaptador, exclusiones, regresión y este informe. No hay cambios de producto, despliegue ni push. Su SHA se comunica al orquestador para integración atómica.

## Pendientes de Walter

Ninguno nuevo. La corrección del harness es operativa; no cambia aprobaciones humanas de producción.
