# Auditoría total de n8n — cuarta oleada

21-11-2026, Lima. Rama/worktree `total-n8n-auditoria`, base `de397f3195856c10b6a9959171ff42da4328d9ec` de `version-chatgpt`. **Implementado y probado localmente; no integrado ni desplegado.** Sin push, merges, importaciones, activaciones, OAuth, publicaciones, pagos ni intervención en D&S Factory. Los archivos de misión previamente sin seguimiento se preservaron.

## Resultado y alcance real

Se inventariaron **45 workflows vivos, 1.411 nodos, 31 workflows activos**, los 32 JSON v2 y cuatro legados versionados. Hay nueve workflows adicionales en el VPS. Se compararon borradores y versiones activas: las 31 parejas observadas no difieren en nodos/conexiones. La exportación estructural cubre todos los workflows del destino, sin leer valores de credenciales, `.env`, código libre, parámetros de cuerpos, URLs ni payloads de ejecución. **No es una exportación íntegra restaurable ni acredita igualdad del código vivo.** El respaldo real continúa siendo requisito previo del orquestador.

El generador incorpora correcciones de fiabilidad y produce **32 workflows inactivos, 1.318 nodos**, reproducidos por pruebas. El lote incluye entrada, diff semántico y reversa de código desde la base de esta misión. **No importar el lote completo directamente sobre el VPS:** existen cambios concurrentes ajenos y siete IDs distintos; preparar la aplicación selectiva desde un respaldo real.

### Commits

| Commit | Contenido |
| --- | --- |
| `be2a15c` | Exportador SQLite de solo lectura, comparación estructural, pruebas y evidencia del VPS. |
| `0e49e8f` | Correcciones del generador, regeneración de los 32 JSON y 20 regresiones nuevas. |
| `83e41e6` | Empaquetador de lote inactivo, diff/reversa, siete tests y procedimiento. |
| Cierre documental posterior | Este informe, ESTADO y evidencia final; no modifica código ejecutable. |

## VPS: no existen dos motores n8n en la captura

Se usó SSH como `operador`, llave indicada por la misión, host verificado y modo no interactivo. El socket Docker no es accesible directamente por ese usuario; las lecturas autorizadas se efectuaron con `sudo -n`, sin cambios de permisos ni servicios. Se seleccionaron campos concretos de Docker y columnas SQLite, nunca `docker inspect` completo, entornos, argumentos de proceso o credenciales cifradas.

| Contenedor | Función observada |
| --- | --- |
| `cooper-n8n-1` | Único proceso n8n, imagen 2.47.4, bind `/var/lib/cooper/n8n:/home/node/.n8n`. |
| `cooper-runner-1` | Runner n8n 2.47.4. |
| `cooper-cooper-1` | Aplicación Cooper, base propia `/var/lib/cooper/cooper`. |
| `cooper-chat-n8n-1`, `cooper-chat-runner-1`, `cooper-chat-cooper-1` | Relés de `tunel.mjs`, imagen de Cooper, montaje `/run/cooper-chat`, red `container:<destino>`. Sin volumen n8n, sin segundo motor ni cron propios. |
| `cooper-caddy-1` | Proxy. |

Los siete pertenecen al mismo proyecto Compose `cooper`. **No apagar los relés por confundir sus nombres con una segunda fábrica.** Esto no descarta cambios posteriores ni equivale a certificar la ausencia de productores externos a este VPS. [Metadatos de contenedores](evidencias/total-n8n-auditoria/vps-contenedores.json).

La base se abrió con URI `mode=ro`, `PRAGMA query_only=ON` y transacción de lectura. Las pruebas sintéticas comprueban hash intacto, archivo inexistente no creado, rechazo de lectura de columnas sensibles y exclusión de D&S también en ejecuciones y referencias. Los scripts no escriben ni instalan archivos en el servidor.

## Hallazgos y correcciones

| Área | Evidencia observada | Corrección y límite |
| --- | --- | --- |
| Error Workflow | Marcas carecía de manejador/plazo. Vigilante sin plazo, capaz de copiar mensajes privados. Hay fallos históricos del propio Vigilante. | Política final para los 32 flujos, manejador en los otros 31, sin autorrecursión. Diagnóstico durable con IDs, nodo y categoría antes de avisar; mensajes/cabeceras crudos excluidos. El aviso tolera fallo de su tabla o Telegram. Si cae todo n8n requiere monitor externo. |
| Reintentos | 40 nodos HTTP vivos con método mutante y `retryOnFail`, incluyendo publicación, generación y RPC. No todos son cobros; la clasificación no presupone que todo POST sea mutante. | Retirados reintentos automáticos no acreditados para POST/PUT/PATCH/DELETE y modelo de chat. Quedan reintentos explícitos para cinco callbacks idempotentes de Cooper. |
| Backoff y tasas | `waitBetweenTries` era pausa fija; no demuestra backoff. Hay 429 de voz conservados. | Callbacks: cuatro intentos, 2/8/32 s más jitter, respetan Retry-After numérico o fecha; valores inválidos o >60 s detienen. Reusan mismos bytes/ID/firma, sin regresar al despacho. HTTP por lotes de uno con pausa de 1.100 ms limita ráfagas por nodo. **No es limitador global por cuenta/proveedor**; GET heredados mantienen reintento fijo acotado. |
| Publicación repetida | M8 miraba calendario reciente, no historial completo; HTTP podía reintentarse tras aceptación incierta. YouTube directo tenía una ruta separada. | Clave durable compartida por video/tipo/red, historial completo, registro previo y lectura de reservas antes de enviar. Menor ID de fila gana en la SQLite única observada. Error o pérdida de recibo conserva reserva sin vencimiento. M8 no marca publicado con solo request_id. |
| Retorno Claude | Dos retornos podían leer `enviado` y avanzar dos veces. Timeout del despacho confundía fallo de transporte con rechazo. | Actualización condicionada por job_id y estado `enviado`; solo quien obtuvo fila actualizada despacha. Timeout conserva trabajo enviado/incierto para aceptar retorno tardío, sin volver a disparar routine. |
| Timeouts | Marcas y Vigilante carecían de plazo global. `Intentar Codex` tiene timeout por expresión, no debe clasificarse como ausencia cierta. | Todos los workflows tienen plazo; todo HTTP tiene timeout válido. Chat 45 s, sin retries internos. Plazos no prueban cancelación del trabajo remoto aceptado. |
| Crons | Marcas publicación cada minuto con HTTP de 300 s, inactivo. Aprendizaje activo cada hora, Confirmar al minuto 7; Radar diario 07:40, Rutina 08:10 inactiva. | Marcas pasa a cada cinco minutos, workflow 240 s y HTTP 210 s. Un worker remoto puede continuar después de cortar HTTP. Radar de hasta una hora puede coincidir con Rutina si se reactiva; cuotas comunes requieren control operativo. |
| Credenciales | Nueve tablas y 15 referencias de credenciales usadas resueltas; sin referencias literales a subflujos inexistentes en la captura. Dos HTTP del legado 04 tienen autenticación sin asociar. | Se preservan referencias existentes; no se exportan claves ni se prueba su vigencia/OAuth. Legados permanecen fuera del lote. Retención éxito/error/progreso/manual deshabilitada en los 32 para reducir almacenamiento de firmas/tokens. Wait puede persistir checkpoints temporales. |
| Huérfanos | Radar vivo contiene nueve nodos inalcanzables desde sus disparadores, sin enlaces a nodos inexistentes. | Los 32 generados pasan alcance/referencias. Los nueve vivos pertenecen a modificaciones concurrentes; se identifican en el inventario para revisar, sin borrarlos ni sobrescribir Radar. |
| Deriva | Siete IDs v2 remapeados; nueve flujos adicionales y cambios estructurales en Aprendizaje, Claude, Orquestador, Radar y Retorno. | Mapa y diff base/vivo y lote/vivo. Preservar Ajustes, Competencia y ampliaciones. Comparación parcial por estructura: no sustituye revisión semántica protegida del destino. |

Los añadidos activos `CoopRadarReal001`, `CoopSondaVidIQ01`, `FabCompYouTube01` y `CooperMonitor01` no tienen Error Workflow configurado; Monitor tampoco declara timeout de workflow. No están en el generador de esta base: el orquestador debe revisar esos controles con sus misiones propietarias. Los otros cinco añadidos están inactivos. Los cuatro legados también están inactivos; no se incorporan al lote ni se propone reactivarlos.

Los nueve nodos inalcanzables del Radar son `Analista de tendencias`, `Encargo del analista`, `Radar del canal`, `vidIQ: radar`, `Texto · Analista de tendencias` y los cuatro nodos de costo/identificación del analista. No se infiere que deban borrarse: podrían ser restos deliberadamente desconectados durante otra misión.

IDs a mapear: `FabAvatar0000001 → 8nqh0n7jewLQOikC`, `FabCooperAPI0001 → xorCR0lfNlil8Ovy`, `FabCooperCosto01 → z74zUkz2BR8k0GLR`, `FabCooperProgr01 → gNrGzmHBxJ3OIuQM`, `FabNoticia000001 → rvwLNNS309MEi8cL`, `FabPresentacion1 → MkC3QS6ogZZ8n24u`, `FabTextoGPT0001 → YgWu9aUDsB2VYaz3`. Son referencias, no secretos. Remapear también Error Workflow, llamadas y referencias internas.

Inventarios completos: [exportación final](evidencias/total-n8n-auditoria/vps-estructura.json), [base frente al VPS](evidencias/total-n8n-auditoria/comparacion-base-vps-final.json), [lote frente al VPS](evidencias/total-n8n-auditoria/comparacion-lote-vps.json).

## Ejecuciones fallidas y causa

Ventana: siete días respecto de cada captura del 21-11-2026. A las **13:19 Lima** había 24 errores, 465 éxitos y dos esperas. A las **13:22 Lima**, 16 errores, 454 éxitos y dos esperas. El servidor siguió cambiando durante la lectura; no se hizo ninguna eliminación y **no se conoce la causa de la variación de retención**. La primera comparación y la [cronología](evidencias/total-n8n-auditoria/cronologia.json) conservan ambos conteos.

| Ejecuciones | Causa demostrable por clasificación SQL sin devolver mensajes privados |
| --- | --- |
| 382, 374 | HTTP 429 en `Voz (Gemini TTS)` y propagación a Producción. |
| 792, 397, 326 | Error de esquema/columna/tabla en Guardar diagnóstico, Aprobación · registrar y Guardar biblia. No se atribuye una columna concreta sin evidencia exportable. |
| 573, 571 | HTTP 404 en Avisar a Cooper y propagación al callback de Confirmar. La causa operativa del endpoint ausente no se determinó. |
| 761, 518, 305, 99 | Validación de petición; HTTP 400 demostrado en 518 y 99. |
| 80 | Error de expresión/referencia en Preparar enlace. |
| 426, 308, 27, 25 | Error conservado pero no clasificado por la proyección permitida; no inventar causa. Nodos Agente v2, Agente, Despertar routine y Claude: guion. |
| 812, 814, 815, 816, 820, 826, 827, 828 | Observados en primera captura: Aprendizaje, YouTube, Radar y cuatro errores del Vigilante. Sin detalle guardado suficiente; ya no figuran en la captura final. |

Las ejecuciones **400 y 540** de Aprobación siguen `waiting`, originadas el 20-11 UTC. Su fecha de espera nativa no autoriza reanudarlas. No se accedió al contenido de sus aprobaciones ni se realizó ninguna decisión.

## Lote y reversa entregados

- [Guía del orquestador](../cooper-n8n-auditoria-lote.md).
- Archivo local: `cooper/.cache/lote-total-n8n-auditoria.tar.gz` (555.275 bytes), SHA-256 `4f7f1893f741bfdcc9ff3b5e7e355031ea32969c7e58a8365f73e87bb7e3bc12`.
- Origen `83e41e635f5f2b66dc2566c789adf7b64f119cca`, referencia `de397f3195856c10b6a9959171ff42da4328d9ec`.
- 32 entradas + 32 reversas inactivas, diff semántico sin ruido de UUID internos, mapa inicial, altas/bajas, guía y manifiesto; **71 archivos verificados**. [Manifiesto](evidencias/total-n8n-auditoria/lote-manifest.json), [resultado](evidencias/total-n8n-auditoria/lote-verificacion.log), [archivo y huella](evidencias/total-n8n-auditoria/lote-archivo.json).
- Ninguna alta ni baja respecto de la base v2. El lote no incluye ni elimina los nueve workflows adicionales del destino.

La reversa versionada permite revisar el código anterior; **no restaura los ajustes, filas, esperas ni versiones vivas**. El orquestador debe conservar respaldo consistente cifrado del destino, ambos estados borrador/publicado y recibos posteriores. No restaurar una base antigua sobre reservas nuevas ni usar reintentos del editor para comprobar una publicación/cobro inciertos. La CLI advierte que ciertos cron pueden seguir activos tras importar hasta reiniciar; verificar su cese en la ventana autorizada.

## Puerta de cierre

Código de entrega comprobado: `83e41e635f5f2b66dc2566c789adf7b64f119cca`. Node 24.22.3 y npm 12.2.2. Las actualizaciones posteriores son documentación y evidencia, sin cambios a las fuentes probadas.

Comandos obligatorios ejecutados desde `cooper/`, en orden: `npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`. Desde raíz: `node --test tests/flujos_v2.test.cjs`.

| Comprobación | Resultado |
| --- | --- |
| Instalación, lint, tipos | PASS, rc 0; cero vulnerabilidades, errores y advertencias. |
| Vitest | 284/284 PASS. |
| Playwright + Sentinel | 43/43 PASS, rc 0; sin omisiones ni reintentos. |
| Build final | PASS, rc 0; Next.js 16.4.6, sin advertencias. |
| Flujos | 167/167 PASS, rc 0, cero omisiones. |
| Auditor SQLite | 8/8 PASS, rc 0, Python `-B -W error`. |
| Empaquetador | 7/7 PASS, rc 0. |
| Integridad lote | 71/71 SHA-256 correctos, rc 0. |

**Puerta final completa: rc 0, cero errores y cero advertencias.** [Resumen verificable](evidencias/total-n8n-auditoria/puerta-resumen.json).

La primera puerta falló únicamente en Sentinel por faltar su Chromium aislado; también se registró aviso de plataforma al descargar Chromium. Se instaló el navegador en la caché **de este worktree**, sin desactivar pruebas ni guardianes, y se repitió la cadena completa. [Ejecución inicial](evidencias/total-n8n-auditoria/puerta-inicial.log), [preparación](evidencias/total-n8n-auditoria/preparacion-sentinel.log), [puerta final](evidencias/total-n8n-auditoria/puerta-cooper.log), [flujos](evidencias/total-n8n-auditoria/flujos.log), [auditor](evidencias/total-n8n-auditoria/auditor-tests.log), [lote](evidencias/total-n8n-auditoria/lote-tests.log).

La suite pasó de 147 a 167 pruebas. Hay reproducción roja→verde de ausencia de plazos/manejador, retry de efectos, retención, avisos privados y `Retry-After: -1`. Se simulan desconexión, 429/503, firmas idénticas entre intentos, respuesta duplicada, históricos fuera del calendario, reservas competitivas y cierre condicionado del retorno. Se comprueba que el generador reproduce semánticamente los 32 JSON, que cada nodo es alcanzable y que las rutas HTTP de publicación pasan obligatoriamente por la reserva. Estas pruebas de contratos **no son una ejecución de los nuevos nodos en n8n real**; la E2E ejecuta Cooper y proveedores ficticios.

## Limitaciones reales y Pendientes de Walter

1. Revisar y autorizar con el orquestador el parche **selectivo** sobre los cambios ya vivos. Confirmar siete IDs, mantener nueve flujos extra y cuatro legados inactivos. Completar ensayo en n8n aislado antes de publicar; esta misión no ejecuta importación ni pruebas pagadas.
2. Resolver las dos esperas históricas y la reapertura de entradas según su misión propietaria. No apagar los relés `cooper-chat-*` por su nombre. Revalidar topología y snapshot en el momento del cambio.
3. **No existe garantía general de cobro exactamente una vez.** Se retiraron reintentos ciegos; reejecutar producción completa o un HTTP desde el editor puede generar/cobrar nuevamente. Faltan checkpoints idempotentes semánticos por proveedor para esa recuperación. `paso_id` de costos usa ejecución y no deduplica otra ejecución del mismo encargo. Conservar generación incierta para conciliación y mantener interruptores pagos apagados hasta aceptación.
4. Las reservas de publicación arbitradas por menor ID se limitan a **una SQLite compartida** con commits visibles y sin borrar reservas. No certifican varias bases ni PostgreSQL, donde secuencias y orden de commit pueden diferir. Un fallo antes del envío puede dejar reserva bloqueada deliberadamente; sólo liberarla después de comprobar que no hubo efecto. Un reintento de editor desde el HTTP puede eludir guardias previas.
5. Definir cuotas globales por cuenta/API si se activan varios canales. Batching/backoff no coordina todas las ejecuciones, varios trabajadores ni límites negociados del proveedor. Timeouts no cancelan necesariamente jobs externos ni el trabajador remoto de Marcas.
6. Aceptar retención mínima y protección de checkpoints Wait. Los diagnósticos quedan reducidos a categoría; algunas causas necesitan revisión privada autorizada. No se verificaron vigencia de credenciales, OAuth, capacidad/saldo ni respuestas reales de proveedores. Resolver asociación de los dos HTTP del legado 04 sólo si se decide migrar esa función; no activarlo como segunda ruta.
7. Revisar el Radar vivo con su misión propietaria y conservar o retirar deliberadamente sus nueve nodos desconectados. Investigar la variación de retención observada y fallos del Vigilante con la evidencia operativa disponible, sin inferir causas por timestamps.

## Documentación oficial consultada

- [n8n CLI: exportar versiones e importar, advertencia sobre cron](https://docs.n8n.io/hosting/cli-commands/).
- [Error Workflow y payload de error del disparador](https://docs.n8n.io/flow-logic/error-handling/).
- [HTTP Request: timeout, batching y respuesta completa](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/).
- [Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/) y [Wait: persistencia](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/).
- [Modelo Chat OpenAI: timeout y retries](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenai/).
- Código oficial consultado para comportamiento, sin atribuirle ejecución en el VPS: [retry del motor](https://github.com/n8n-io/n8n/blob/master/packages/core/src/execution-engine/workflow-execute.ts), [insert Data Table](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/DataTable/actions/row/insert.operation.ts), [contrato Data Tables](https://github.com/n8n-io/skills/blob/main/skills/n8n-data-tables-official/SKILL.md). Las ramas `master/main` son documentación móvil; aceptación final exige contrastar el binario 2.47.4.

Se aplicó la skill `ecosistema-constructor` para aislamiento, correcciones con pruebas y entrega revisable. Las instrucciones expresas de esta misión prevalecen para actualizar ESTADO, producir informe/lote y auditar el VPS en solo lectura. Trabajo paralelo repartido por generador, pruebas y lote; revisión independiente del injerto de callbacks/reservas realizada sin cambios al servidor.
