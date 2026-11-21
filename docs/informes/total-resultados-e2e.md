# Cooper total — pruebas de resultados integrados

21-11-2026, Lima. Rama y worktree `total-resultados-e2e`, base integrada `2d82c9e`. Solo se cambia `cooper/e2e/resultados.spec.ts`; sin cambios de producto, API, guardián ni fixtures compartidas.

## Cambio

M10 carga la proyección inicial en el servidor y la actualiza mediante GET `/api/resultados`. Las pruebas anteriores sustituían `/api/estado`, que ya no alimenta las tarjetas de estas dos pantallas. Los ensayos de curva y lección interceptan ahora la proyección tipada y pulsan **Actualizar resultados**, esperando la respuesta GET correcta y el fin de la actualización.

Se conservan el 125% de retención, el 40% al segundo 60, la advertencia de intervalos YouTube, origen y URL; la lección conserva causa, cambio propuesto, cifra/segundo/demora, vínculo al video y aplicación sin afirmar mejora. También siguen las comprobaciones Axe y de anchura a 390/1440 píxeles. El ensayo de montaje mantiene sus mocks de estado porque su pantalla sigue consumiendo ese contrato.

El conteo contrasta `/api/resultados` y selecciona Tipo=Videos. Comprueba todos los `.resultado-origen` y el contador de fuentes: una tarjeta agrupada puede contener más de un registro. No se elimina la prueba de agrupación: la suite M10 sigue exigiendo cuatro tarjetas y dos grupos de dos registros, dos dueños, homónimos, aislamiento y origen. Las fixtures de Marcas no se modifican ni se reducen; la focalizada incluye la suite unificada y su navegación.

## Verificación

- `npm ci`: código0, cero vulnerabilidades.
- `npm run typecheck` y ESLint del archivo con `--max-warnings 0`: código0, cero errores/advertencias.
- `npm run test:e2e -- e2e/resultados.spec.ts e2e/resultados-unificados.spec.ts e2e/navegacion-resultados.spec.ts`: **7/7 PASS**, 30,2s, sin reintentos ni omisiones; build incluido correcto y cero advertencias. [Log](evidencias/total-resultados-e2e/focalizada.log).
- `git diff --check`: correcto.

Se esperó a que finalizara la suite del orquestador antes de abrir navegadores. Los dos servidores usan puertos propios y datos efímeros. Esta prueba focalizada no se presenta como una puerta completa ni como dos rondas Sentinel; el orquestador ejecuta la aceptación integrada.

Documentación oficial consultada: [mock de API](https://playwright.dev/docs/mock) y [espera de respuesta](https://playwright.dev/docs/api/class-page#page-wait-for-response).

## Commits y pendientes

El commit atómico de esta entrega contiene la adaptación E2E, evidencia e informe; se comunica su SHA al orquestador. Pendiente operativo: integrar y repetir puerta completa. **Pendientes de Walter:** ninguno nuevo. No hubo accesos, cambios ni publicaciones en el VPS.
