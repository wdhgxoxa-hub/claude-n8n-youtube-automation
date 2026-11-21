# Corrección del entrenamiento simulado en vivo

Fecha: 2026-11-21, Lima. Rama/worktree propio `total-identidad-viva`, base integrada `f3887fe`. Commit funcional: `7f8cbbd`.

## Causa comprobada

La tercera puerta integrada falló en `cooper/e2e/cooper.spec.ts:714`: la voz seguía mostrando «Entrenamiento en curso» al agotarse los 15 segundos de la aserción. La traza y la base efímera del mismo ensayo permiten contrastar:

| Evidencia | Valor |
| --- | --- |
| Creación de la voz simulada | 2026-11-21 13:06:39.531, Lima |
| Consulta que persistió `listo` | 2026-11-21 13:06:54.402, Lima |
| Tiempo hasta la consulta | 14.871 segundos |
| Estado posterior | `listo`, cero fallos, reserva liberada |
| Cadencia SSE de ese ensayo | 400 ms |
| Espera de la aserción | 15.005 segundos |

El trabajador durable esperaba diez segundos desde la creación y ejecutaba ciclos cada cinco segundos. La consulta podía llegar casi a los quince segundos; el siguiente evento SSE y el renderizado quedaban fuera del margen de la aserción. El proveedor simulado devuelve `listo` de inmediato al consultarlo. No hubo error remoto, reserva atascada ni falta de consentimiento. Solo se leyeron campos de estado/tiempo de la base ficticia y metadatos selectivos de la traza; no cabeceras, cookies, credenciales, originales ni cuerpos completos.

El fallo original queda en el checkout del orquestador `.cache/ci-limpia-FK1nyH/checkout/cooper/test-results/cooper-identidad-con-frase-7ed89-ble-y-entrenamiento-en-vivo-chromium/`. No se sobrescribe ni se cuenta como ronda limpia.

## Cambio

`biblioteca-trabajador.ts` admite consultar desde el primer segundo solo cuando coinciden `simulated=true` y `provider=simulada`. El intervalo de los adaptadores remotos permanece en diez segundos, incluso si una fila tiene incorrectamente la bandera de simulación. Se conserva el ciclo de cinco segundos, el lote de dos, la reserva SQLite de 60 segundos, la pausa, las guardas de identidad/consentimiento/dueño y el backoff. No se añade ninguna llamada a crear, clonar ni sintetizar.

No se modificó el E2E, su timeout de quince segundos ni sus aserciones de entrenamiento, disponibilidad, muestra, persistencia o revocación. La prueba de biblioteca con ventana cerrada también se conserva.

## Validación

- Regresión antes/después: los tres casos nuevos de simulación fallan contra el trabajador anterior; pasan con la corrección. El fallo deliberado está separado en `.cache/identidad-viva/regresion-antes.log`.
- Cuatro suites de biblioteca: **30/30 PASS**, incluidas frontera 999/1000 ms, adaptador remoto a 9999/10000 ms, reserva concurrente y creación justo antes del siguiente ciclo. `unitarias.log` conserva la salida.
- ESLint de los archivos modificados con `--max-warnings 0`, TypeScript, Prettier y `git diff --check`: PASS.
- Playwright focal en checkout archivado desde el commit funcional, contenedor Debian de CI, dependencias aisladas y caché privada de Sentinel verificada: **2/2 PASS**, 17.1 segundos, sin reintentos. Identidad completa: 10.3 s; progreso con ventana cerrada: 4.5 s. El build de producción también pasó. Salida: `.cache/identidad-viva/focal.log`.

El orquestador repetirá la puerta completa sobre la integración y reconstruirá la imagen de producto. Esta comprobación focal no sustituye esa puerta ni las dos rondas finales de videos. [Recibo saneado](evidencias/total-identidad-viva/resultado.json) con huellas de los logs.

## Limitaciones y Pendientes de Walter

No acredita entrenamiento remoto real ni incorpora credenciales nuevas. No requiere decisión de Walter para corregir la simulación; las aprobaciones y pruebas de proveedores reales conservan sus pendientes previos. No se desplegó, integró ni publicó desde esta rama.
