# Conciliación de operaciones interrumpidas

21-11-2026, Lima. Este procedimiento cierra la recuperación administrativa de los estados inciertos; no autoriza repetir envíos, publicar ni modificar filas a mano.

1. Conservar el recibo/ID de operación, recurso, revisión, fecha y estado. No adjuntar credenciales, mensajes privados ni respuestas completas del proveedor a informes públicos.
2. Antes de intervenir, realizar una copia conforme a [Operación](cooper-operacion.md) y comprobar que se puede restaurar. No revertir toda la base para corregir una sola operación si ya hay escrituras posteriores.
3. Consultar el estado del recurso mediante su adaptador existente o en la cuenta del proveedor con el acceso humano correspondiente. Un timeout no prueba que el proveedor rechazara el envío. Registrar qué ID se cotejó y la evidencia mínima.
4. Si se confirmó el resultado, conservar su ID y evitar un segundo envío. Si no se puede demostrar ni éxito ni rechazo, mantener el estado incierto. Si se demuestra rechazo definitivo, preparar una nueva solicitud revisable con la revisión vigente y la aprobación humana que corresponda.
5. Documentar responsable, fecha, evidencia, decisión y efecto. Una corrección puntual de datos requiere un plan delimitado y su reversa probada; esta guía no ofrece un comando de desbloqueo masivo.

| Subsistema | Estado conservado / recuperación segura |
| --- | --- |
| Chat | `ejecutando` o `revisar`: comprobar el recurso final y el recibo de fábrica antes de pedir otra tarjeta. La tarjeta anterior no se confirma otra vez. La memoria de una idea no es autorización. |
| WhatsApp | Una reserva vencida pasa a `incierto`. Con ID remoto, cotejar los recibos de entrega ya almacenados; sin ID, revisar en el proveedor. No convertir automáticamente la fila a `pendiente`. |
| Marcas | `revision`, `enviando` o `procesando`: conservar el checkpoint y el ID remoto; la aceptación de una carga no equivale a publicación. Cotejar el estado de la red. No borrar el checkpoint ni duplicar la pieza para eludir la revisión. |
| Ingesta de adjuntos | `descargando` tras caída: conservar el ID único del evento y verificar si se guardó el adjunto antes de admitir otro envío. No reenviar mensajes para forzar una descarga duplicada. |
| Avatar/voz | Si existe ID de proveedor, consultar ese ID; el trabajador durable hace solo consultas. Si se perdió la respuesta de creación y no hay ID, conciliar en proveedor antes de repetir. No crear otro entrenamiento para comprobar el anterior. |
| n8n | Las esperas históricas se conservan. Reabrir un callback o una rutina puede reanudar producción con gasto: cotejar el trabajo y su revisión, y obtener la aprobación editorial correspondiente. |

Los contratos y regresiones existentes comprueban reservas, idempotencia, caída y ausencia de reenvío automático (`cooper/tests/whatsapp.test.ts`, `marcas.test.ts`, `chat.test.ts`, `medios.test.ts`). El trabajador de biblioteca añade recuperación sin navegador y protección frente a respuestas posteriores a una revocación. Estos ensayos usan proveedores ficticios; no demuestran la conciliación de una operación real en una cuenta ajena.

## Retención y conciliación económica

Olvidar memoria borra `chat_memories` y marca el límite de contexto; no borra el historial de mensajes. Borrar un activo no purga sus originales ni consentimientos. Las copias restic conservan generaciones anteriores. Walter debe fijar plazos, excepciones y custodia antes de una purga: no se borró producción como parte de esta misión.

Los gastos son importes registrados o estimados por uso, según la etiqueta visible. No son facturas conciliadas ni incluyen necesariamente cuotas fijas y cargos rechazados. Desde cooper-total, web, agregador n8n y deduplicación de avisos comparten el día Lima (UTC−05). La auditoría inicial interpretó UTC como defecto y luego lo retiró porque estaba rotulado; el orquestador adoptó Lima como decisión explícita de coherencia operativa, sin cambiar tarifas ni presupuestos. La conciliación de facturas requiere los documentos y decisiones de Walter.
