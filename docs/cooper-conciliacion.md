# Conciliación de operaciones interrumpidas

21-11-2026, Lima. Procedimiento del orquestador (`cooper-total`, `546f351`), reutilizado y ampliado por M03. Describe recuperación administrativa; no autoriza repetir envíos, publicar ni modificar filas a mano. M03 se implementó sobre `de397f3`; el orquestador lo integró con los demás frentes.

1. Conservar el recibo/ID de operación, recurso, revisión, fecha y estado. No adjuntar credenciales, mensajes privados ni respuestas completas del proveedor a informes públicos.
2. Antes de intervenir, realizar una copia conforme a la [guía de recuperación](cooper-vps.md) y comprobar que se puede restaurar. El integrador conserva además `docs/cooper-operacion.md` en cooper-total. No revertir toda la base para corregir una sola operación si ya hay escrituras posteriores.
3. Consultar el estado del recurso mediante su adaptador existente o en la cuenta del proveedor con el acceso humano correspondiente. Un timeout no prueba que el proveedor rechazara el envío. Registrar qué ID se cotejó y la evidencia mínima.
4. Si se confirmó el resultado, conservar su ID y evitar un segundo envío. Si no se puede demostrar ni éxito ni rechazo, mantener el estado incierto. Si se demuestra rechazo definitivo, preparar una nueva solicitud revisable con la revisión vigente y la aprobación humana que corresponda.
5. Documentar responsable, fecha, evidencia, decisión y efecto. Una corrección puntual de datos requiere un plan delimitado y su reversa probada; esta guía no ofrece un comando de desbloqueo masivo.

| Subsistema | Estado conservado / recuperación segura |
| --- | --- |
| Chat | `ejecutando` o `revisar`: comprobar el recurso final y el recibo de fábrica antes de pedir otra tarjeta. La tarjeta anterior no se confirma otra vez. La memoria de una idea no es autorización. |
| WhatsApp | Una reserva vencida pasa a `incierto`. Con ID remoto, cotejar los recibos de entrega ya almacenados; sin ID, revisar en el proveedor. No convertir automáticamente la fila a `pendiente`. |
| Marcas | `revision`, `enviando` o `procesando`: conservar el checkpoint y el ID remoto; la aceptación de una carga no equivale a publicación. Cotejar el estado de la red. No borrar el checkpoint ni duplicar la pieza para eludir la revisión. |
| Ingesta de adjuntos | `descargando` tras caída: conservar el ID único del evento y verificar si se guardó el adjunto antes de admitir otro envío. No reenviar mensajes para forzar una descarga duplicada. |
| Avatar/voz | Si existe ID de proveedor, consultar ese ID. El trabajador durable integrado de M07 consulta solo estados existentes. Si se perdió la respuesta de creación y no hay ID, conciliar en proveedor antes de repetir. No crear otro entrenamiento para comprobar el anterior. |
| n8n | Las esperas históricas se conservan. Reabrir un callback o una rutina puede reanudar producción con gasto: cotejar el trabajo y su revisión, y obtener la aprobación editorial correspondiente. |

Los contratos y regresiones existentes comprueban reservas, idempotencia, caída y ausencia de reenvío automático (`cooper/tests/whatsapp.test.ts`, `marcas.test.ts`, `chat.test.ts`, `medios.test.ts`). M03 añade los contratos y caídas descritos abajo. Estos ensayos usan proveedores ficticios; no demuestran la conciliación de una operación real en una cuenta ajena.

## Flujo implementado por M03

En **Administración → Operaciones por conciliar**, consultar el inventario, elegir una operación o buscar por tipo/ID. La lista muestra hasta cien filas por subsistema; la búsqueda por ID sigue disponible para el resto y para estados terminales. Se comprueba el rol almacenado, acceso vigente, origen, límites HTTP y huella de la versión leída. Una respuesta tardía o decisión simultánea exige actualizar. No hay migración nueva: se reutilizan las tablas de operaciones y `events` para vínculos y decisiones.

1. **Consultar recibo o estado guardado:** usa el vínculo de orden del chat/acción WhatsApp, un recibo WhatsApp persistido o una consulta GET del adaptador de Marcas. Solo confirma cuando existe evidencia compatible. Sin evidencia deja el estado pendiente y registra la consulta; ausencia, timeout y HTTP 200 de una carga no equivalen a publicación.
2. **Confirmar resultado con evidencia revisada:** requiere referencia del informe/recibo, ID remoto y casilla de cotejo. Se registra como `revision_administrativa`, distinguida de un callback o consulta automática. No adjuntar cuerpos privados, teléfonos ni credenciales. En fábrica el ID debe ser exactamente la ejecución reservada; en WhatsApp debe existir un recibo almacenado del mismo destinatario, posterior a la operación y sin asociación a otro envío. No permite declarar una ingesta incompleta como completa.
3. **Cerrar sin reenvío:** archiva la revisión administrativa conservando desconocido el resultado remoto. No afirma rechazo ni cancelación externa. Conserva tarjetas consumidas, reservas, checkpoints, IDs y deduplicación. Una ingesta pasa a `cancelada`; su trabajador no puede insertar adjuntos ni volver a `pendiente` si llega tarde. Una pieza queda en `revision`, fuera de la cola de publicación. No crea otra solicitud.

Cada cierre es único y durable, con actor, fecha, tipo/ID, estado anterior/posterior, fuente, referencia, ID comprobado y huella. No se edita desde la interfaz. Las últimas cincuenta consultas/decisiones aparecen en el panel y el cierre puede consultarse por ID. Archivar no impide que un callback auténtico posterior registre el hecho remoto: la decisión anterior se conserva como evidencia histórica. Una corrección posterior de esa decisión requiere revisión específica del operador; no hay un botón para reabrirla o reenviar.

| Subsistema / tipo | Conciliación disponible y límite |
| --- | --- |
| Chat / `chat` | Nuevas confirmaciones vinculan su tarjeta con `bridge_commands.id` antes del primer envío. Un callback confirmado del mismo dueño cierra la tarjeta. Tarjetas anteriores sin vínculo requieren cotejo humano; no se deduce por título o cercanía temporal. |
| Reservas / `fabrica` | Consulta local del recibo y ejecución. Revisión humana puede confirmar la ejecución exacta. Nunca borra `execution`, libera por tiempo ni reenvía. El acceso humano a la ejecución n8n queda fuera de esta ruta; no se añade una API administrativa n8n ni se modifica un workflow. |
| Avisos / `whatsapp` | Con ID persistido se coteja el recibo firmado ya almacenado; si se perdió el ID de respuesta, Walter debe asociar el ID correcto con evidencia y recibo compatible. `aceptado` identifica la aceptación; `delivery` conserva `failed/sent/delivered/read`, sin convertir aceptación en entrega. No hay un GET inventado para consultar mensajes sin ID. |
| Decisiones WhatsApp / `accion_whatsapp` | Nuevas acciones hacia fábrica guardan el mismo vínculo. Conciliación del callback o revisión documentada; la clave original de decisión permanece ocupada. Las aprobaciones locales de Marcas se cotejan humanamente si quedó una respuesta incierta. |
| Marcas / `marca` | Upload-Post consulta historial por `checkpoint.id` o por `checkpoint.envio` persistido antes del POST, cuenta y plataforma exactas; Facebook reel consulta `status.publishing_phase.publish_status`. Solo `published`/historial exitoso con URL y sin borradores confirma. Instagram, historias y fotos sin ID final necesitan cotejo humano: un contenedor no se presenta como publicación. Nunca se llama `publicar` desde conciliación. |
| Adjuntos / `ingesta` | El guardado original de adjunto, mensaje y estado ya era transaccional. Tras caída, `completa` no se descarga otra vez; `descargando` permite cierre sin reenvío. Se conserva la ingesta y no se duplica el mensaje ni se descarga automáticamente por caducidad. Recuperar el medio faltante requiere una decisión posterior, sin cambiar a mano su reserva. |

Las consultas de cuenta requieren conexión vigente y dueño activo antes y después de la respuesta. El cierre documental no concede scopes ni reactiva cuentas, medios o consentimiento. Una confirmación administrativa de publicación no reconstruye hora real o métricas perdidas; conserva el ID para el adaptador existente.

API de Cooper: `GET /api/admin/conciliacion`, `GET /api/admin/conciliacion?tipo=chat&id=…` y `POST /api/admin/conciliacion`. El POST recibe `tipo`, `id`, `huella` y `accion` (`consultar`, `confirmar`, `archivar`); decisiones manuales añaden `referencia`, `remoto` cuando corresponde y `comprobado: true`. No recibe URLs de proveedores, tokens ni parámetros de publicación. Respuestas `no-store`; no hay exportación de cuerpos de órdenes ni teléfonos.

## Recuperación reproducible sin servicios reales

Desde `cooper/`:

```bash
npm test -- --run tests/conciliacion.test.ts tests/conciliacion-caidas.test.ts
npm run test:e2e -- --project=chromium conciliacion.spec.ts
```

Ocho escenarios arrancan procesos Node independientes con SQLite nuevo y transportes ficticios. El padre envía **SIGKILL** en un punto confirmado por IPC antes/después de aceptación, abre la misma base en otro proceso, concilia y reinicia otra vez. Incluyen reserva n8n/tarjeta, envío WhatsApp con recibo HMAC, publicación con checkpoint e ingesta antes de descarga/después del commit. Cada caso exige un intento original, cero reenvíos, cero duplicados y las reservas originales conservadas. No se sustituyen SIGKILL por excepciones capturables. Evidencia generada: `cooper/.cache/conciliacion-caidas.json`.

Regresión específica: sin los controles de respuesta tardía, una ingesta archivada terminaba `completa` o regresaba a `pendiente`. Dos pruebas reproducen ambos casos y pasan con la cerca de estado/intento. Marcas y mensajería cercan también respuestas por estado y reserva. E2E recorre consulta, decisión y cierre tras recargar, deniega otra cuenta y comprueba axe/desbordamientos a 390/1440 px, claro/oscuro. Son ensayos locales; no certifican proveedores ni cuentas reales.

Fuentes oficiales revisadas el 21-11-2026 antes de extender consultas: [historial de Upload-Post](https://docs.upload-post.com/api/upload-history/), [estado de reels de Facebook](https://developers.facebook.com/documentation/video-api/guides/reels-publishing), [recibos de WhatsApp](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages), [transacciones SQLite](https://www.sqlite.org/lang_transaction.html) y guía instalada de Next `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`. No se usaron APIs de producción durante M03.

## Retención y conciliación económica

Olvidar memoria borra `chat_memories` y marca el límite de contexto; no borra el historial de mensajes. Borrar un activo no purga sus originales ni consentimientos. Las copias restic conservan generaciones anteriores. Walter debe fijar plazos, excepciones y custodia antes de una purga: no se borró producción como parte de esta misión.

Los gastos son importes registrados o estimados por uso, según la etiqueta visible. No son facturas conciliadas ni incluyen necesariamente cuotas fijas y cargos rechazados. Desde cooper-total, web, agregador n8n y deduplicación de avisos comparten el día Lima (UTC−05). La auditoría inicial interpretó UTC como defecto y luego lo retiró porque estaba rotulado; el orquestador adoptó Lima como decisión explícita de coherencia operativa, sin cambiar tarifas ni presupuestos. La conciliación de facturas requiere los documentos y decisiones de Walter.
