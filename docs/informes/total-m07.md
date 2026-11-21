# M07 — seguimiento durable de biblioteca

Fecha de cierre: 2026-11-21 11:58, Lima. Rama/worktree `total-m07`; base de misión `de397f3`. Alcance: H14/M07 de la auditoría, sin APIs pagadas, despliegue, OAuth, publicaciones ni escrituras en n8n/VPS.

## Commits y coordinación

| Commit | Contenido |
| --- | --- |
| `e851a4c` | Copia mediante cherry-pick de `903ede2` del orquestador: trabajador inicial, configuración y pruebas. No es trabajo original de M07. |
| `a546464` | Refuerzo del mismo trabajador: reservas, recuperación, backoff, validación y pruebas. |
| Cierre documental | Este informe, MEDIOS, README y ESTADO; localizar con `git log -1 -- docs/informes/total-m07.md`. |

Se revisaron `git branch --list 'total-*'`, historiales de biblioteca/instrumentación y worktrees antes de implementar. El aviso concurrente `docs/misiones/AVISO-cooper-total.md` llevó a contrastar `903ede2`, existente en **cooper-total**, que no coincide con el patrón `total-*`. Se tomó ese cambio como base y se reforzó su único trabajador. No se integra una segunda implementación. Para el orquestador que ya contiene `903ede2`: aplicar **solo `a546464` y el cierre documental**, no `e851a4c`. No se hizo merge ni push; los borradores locales previos se reorganizaron en esta rama propia y no son entregables.

## Qué quedó cerrado

- Arranque desde `instrumentation.ts`, sin SSE ni sesión conectada, independiente de WhatsApp. Conserva `COOPER_BIBLIOTECA_PAUSA` y su paso existente por Compose. SSE sigue leyendo la proyección, sin provocar sondeos.
- El sondeo se limita a dos activos por ciclo/proceso; pausa de cinco segundos entre ciclos, intervalo mínimo de diez segundos por activo y cinco minutos cuando requiere verificación adicional del proveedor.
- Reserva SQLite `IMMEDIATE` de 60 segundos con token propio. Evita que otra instancia consulte el mismo activo mientras la primera espera; una reserva vencida permite recuperar tras caída. El estado, fallos y próxima consulta se conservan en SQLite.
- HTTP mantiene timeout de 30 segundos; límite exterior de 35 segundos. Errores temporales conservan el estado y generan backoff 30 s → 60 s → 120 s… hasta 30 minutos. Un resultado válido reinicia fallos; listo/error definitivo dejan de sondearse.
- Antes de consultar y al aplicar el resultado se verifican consentimiento, identidad, revisión humana en real, dueño activo/permitido, estado, ID/proveedor y token vigente. Respuestas tardías no restauran activos revocados/borrados ni sobreescriben otra reserva o un ID cambiado.
- No crea, clona, sintetiza ni borra recursos. Faltantes de ID remoto, identidades sin revisión y creaciones inciertas quedan fuera. Se documentó la conciliación humana sin inferir IDs ni repetir solicitudes.
- Migración aditiva `0017_biblioteca`: cuatro columnas e índice en assets; conserva datos anteriores. Diario de esta rama: índice 11 y fecha estable `1795176017000`. Al combinar migraciones de otras misiones, conservar SQL/hash/fecha, ordenar y ajustar índices del diario, y repetir la puerta integrada.

El trabajador del orquestador ya resolvía la dependencia del navegador; el refuerzo cierra los casos en que una reserva basada solo en `polled_at` podía permitir otra consulta tras diez segundos aunque la primera continuara pendiente, más respuestas tardías y referencias incompletas.

## Evidencia de pruebas

Pruebas dirigidas: **25/25 PASS** en `biblioteca-trabajador`, `biblioteca-arranque`, `biblioteca-seguimiento-base` e `integracion-medios`. Incluyen dos procesos independientes sobre el mismo SQLite; SIGKILL durante una consulta y arranque posterior; recuperación antes/después del vencimiento con reloj controlado; exclusión entre ciclos; límite de lote; timeout; backoff/cap; ID incompatible; aislamiento; suspensión; retirada de la lista; revocación y borrado concurrentes; no reenvío sin ID; arranque fuera del build/Edge.

Se conservaron los tres casos del trabajador original en `biblioteca-seguimiento-base.test.ts`. Su fixture ahora declara consentimiento y permiso. La regresión I04 de borrado remoto fallido añade revisión/consentimiento/permiso ficticios para seguir ejercitando el mismo escenario con las nuevas precondiciones; no se retiró ninguna prueba.

Playwright dirigido: **1/1 PASS**. Crea una voz sintética por las rutas autorizadas, cierra ventana/contexto y observa `entrenando → listo` con un cliente HTTP que solo lee estado. Demuestra el arranque real en Next de producción y avance sin SSE. No acredita un entrenamiento remoto real.

Puerta completa final sobre `a546464`, terminada el **2026-11-21 11:58 Lima**; cadena completa con `pipefail`, código **0**:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz; temporales aislados y sin bytecode Python:
TMPDIR="$PWD/cooper/.cache" PYTHONDONTWRITEBYTECODE=1 node --test tests/flujos_v2.test.cjs
```

| Comprobación | Resultado | Salida |
| --- | --- | --- |
| `npm ci` | 358 paquetes instalados, 0 vulnerabilidades | 0 |
| `npm run lint` | 0 errores, 0 advertencias | 0 |
| `npm run typecheck` | PASS | 0 |
| `npm test` | **306/306**, 33 archivos, sin omisiones | 0 |
| `npm run test:e2e` | **44/44**, incluido Sentinel, sin reintentos ni omisiones | 0 |
| `npm run build` | PASS, compilación de producción | 0 |
| `node --test tests/flujos_v2.test.cjs` | **147/147**, 0 fallos/omitidas/canceladas | 0 |

**Cero errores y cero advertencias** en la puerta final. Evidencia íntegra fuera de Git: [puerta.log](../../cooper/.cache/total-m07/puerta.log), [flujos.log](../../cooper/.cache/total-m07/flujos.log), [resumen verificable](../../cooper/.cache/total-m07/resumen.json). SHA-256:

- `puerta.log`: `49ef687b9a030b77376cff3a8c7ae0b1b6225d279cf95dcdf8b5c39d043c2201`.
- `flujos.log`: `3f6d6720894f4f2710bb650a10e0d7042ec49196e7d65d7b741b0d32794fb79a`.

`git diff --check` y rutas de enlaces añadidos: PASS. El índice histórico de videos de integración 3 continúa perteneciendo al worktree que produjo esos artefactos; no se fabrica una copia aquí.

Los navegadores compatibles de integración 3 se reutilizan mediante enlaces locales en `.cache/browsers` y `.cache/sentinel-browsers`; no se cambió Sentinel ni se desactivaron guardianes. Node 24.22.3, npm 12.2.2, Next 16.4.6, Playwright 1.65.1. Bases, sesiones y medios ficticios. La red de Vitest está bloqueada y los adaptadores del E2E fuerzan simulación.

Una comprobación inicial detectó la fixture I04 incompleta y se corrigió. La primera puerta se interrumpió expresamente para incorporar el aviso del orquestador; al detener sus servidores produjo errores de conexión esperados. Su log queda separado en `.cache/total-m07/puerta-interrumpida.log` y **no** cuenta como validación. La entrega se apoya exclusivamente en la cadena completa posterior.

## Operación, límites e integración

Guía vigente: [MEDIOS](../../cooper/MEDIOS.md#seguimiento-durable-de-biblioteca-m07). No se necesita lote n8n. El proceso Node debe seguir activo y compartir el mismo archivo SQLite local entre sus trabajadores; no es un servicio externo ni una solución para SQLite sobre NFS. Dos procesos no son una certificación de varias réplicas distribuidas. Los topes de lote son por proceso, sin presupuesto global de API.

Un GET ya enviado puede completarse tras revocación; se descarta el resultado local, sin prometer cancelación en proveedor. La caída y recuperación se ensayaron con un proceso real y tiempo adelantado de forma determinista; no se hizo un reinicio del VPS. Estado remoto y calidad facial/vocal requieren aceptación autorizada aparte. Las APIs existentes se reutilizan sin generar muestras ni entrenamientos reales.

Si falta ID remoto, el operador debe cotejar la operación con el proveedor mediante acceso autorizado y preparar una conciliación con evidencia y revalidación de consentimiento. No se añadió una ruta administrativa para asignar IDs ni se hicieron cambios manuales en producción. No marcar listo ni reenviar para resolver incertidumbre. La política de originales/retención pertenece a otro frente.

**Implementado:** refuerzo y documentación en rama propia. **Probado:** ensayos locales dirigidos y puerta según tabla final. **Integrado:** pendiente del orquestador. **Desplegado:** nada por M07.

Fuentes oficiales consultadas el 21-11-2026 antes de reutilizar los contratos: [HeyGen look](https://developers.heygen.com/reference/get-avatar-look), [HeyGen voz](https://developers.heygen.com/reference/get-an-audio-voice), [ElevenLabs consulta/verificación](https://elevenlabs.io/docs/api-reference/voices/get), [SQLite transacciones](https://www.sqlite.org/lang_transaction.html), [Node temporizadores](https://nodejs.org/api/timers.html). Next: guía de instrumentación incluida en la versión instalada 16.4.6. No se inventaron endpoints ni se contactó una API de producción.

## Pendientes de Walter

1. Autorizar por separado, si lo desea, un ensayo de avatar/voz propios con consentimiento y proveedor real; esta misión no consume APIs pagadas ni concede permisos.
2. Conciliar con el operador cualquier creación incierta sin ID remoto; conservarla sin reenvío hasta contar con evidencia. No consta que exista un caso real: no se consultó producción.
3. Aceptar el seguimiento en el destino que integre el orquestador, incluida pausa/reanudación y cierre del navegador. Integración, instalación de la migración y despliegue siguen a cargo de `cooper-total`.
