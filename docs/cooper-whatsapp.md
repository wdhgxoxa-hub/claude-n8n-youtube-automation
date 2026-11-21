# Cooper: WhatsApp Business, fase 4

Consulta de fuentes oficiales: 20 de noviembre de 2026. Implementación para Graph API **v27.0**, versión que muestra la referencia actual de Meta. No se creó una cuenta, se registró un número, se enviaron plantillas a Meta ni se transmitieron mensajes reales durante esta misión.

## Qué recibe cada persona

En **Mi perfil**, guardar un teléfono E.164 no activa ningún envío. La persona acepta recibir un código, lo solicita por WhatsApp, lo introduce en Cooper y elige sus avisos: guion, aprobación final y publicación. Solo Walter puede activar el aviso de gasto diario. Por defecto todos están desactivados. Cambiar el teléfono elimina su verificación, preferencias y ventana de atención, cancela la cola pendiente e invalida los enlaces anteriores. Una nueva verificación también invalida enlaces antiguos.

El código tiene seis cifras, diez minutos de validez, cinco intentos de comprobación y un solo uso. Se deriva mediante HMAC de un identificador aleatorio con `AUTH_SECRET`; no se guarda en claro ni se incluye en registros. Hasta tres solicitudes por hora, con al menos un minuto entre ellas; se cuenta por cuenta **y** por teléfono para impedir rotar usuarios. Un teléfono verificado solo puede pertenecer a una cuenta. Las verificaciones simuladas no habilitan el transporte real.

Los enlaces duran 24 horas desde que se crea el aviso. Su HMAC vincula el ID opaco del aviso y su caducidad; el servidor comprueba además cuenta activa, lista permitida, teléfono verificado, preferencias, dueño y revisión concreta. Requieren la sesión habitual de Cooper, incluso para Walter: no permiten leer ni aprobar el video de otra persona. Abrir un enlace no aprueba nada. Si caducó, el usuario puede abrir el video desde su espacio.

Fuera de la ventana de atención se envía una plantilla con enlace. Si el usuario escribe al número de Cooper, puede recibir los botones **Aprobar** y **Cambios** de sus revisiones pendientes. El texto libre «aprobar» no decide nada. Dentro de la ventana, un nuevo aviso de revisión puede incluir directamente esos botones. Una pulsación debe coincidir con el ID de mensaje enviado, teléfono, dueño y revisión. «Cambios» transmite una solicitud genérica de corrección; la persona detalla su comentario en Cooper. «baja», «stop» o «cancelar» desactivan todos sus avisos y cancelan los pendientes.

Meta permite mensajes libres e interactivos durante las 24 horas posteriores al último mensaje del usuario; un mensaje nuevo reinicia esa ventana. Fuera de ella exige plantillas aprobadas. Se comprueba la ventana al **despachar**, no solo al encolar. [Mensajes de servicio](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages), [botones interactivos](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages).

## Alta manual del número de Cooper

1. Walter elige un número propio y dedicado a Cooper, capaz de recibir SMS o llamadas. No usar los teléfonos personales del equipo. Crear o seleccionar el portfolio empresarial y una aplicación Meta con el caso de uso de WhatsApp. Completar los datos y verificaciones empresariales que solicite Meta. La verificación de la empresa, la propiedad del teléfono y la aprobación del nombre son procesos distintos; la insignia de cuenta oficial no es un requisito implementado por Cooper.
2. En WhatsApp Manager, seleccionar la cuenta de mensajería y añadir el número a la cuenta de WhatsApp. Verificar su propiedad con SMS o llamada. Para un número que ya funciona en WhatsApp, revisar antes las reglas de migración/coexistencia; esta misión no borra ni migra cuentas. [Requisitos del número](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers).
3. Registrar el número verificado para Cloud API mediante `POST https://graph.facebook.com/v27.0/{PHONE_NUMBER_ID}/register`, con `messaging_product: "whatsapp"` y el PIN de seis cifras de verificación en dos pasos. Es una operación manual del propietario: añadir y verificar en el panel no sustituye este registro. Conservar el PIN de forma privada; Cooper no lo necesita. [Registro oficial](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration).
4. Crear un usuario de sistema para la integración directa del propio negocio. Asignarle la app y las cuentas necesarias según el panel actual. El envío necesita `whatsapp_business_messaging`; administrar plantillas requiere `whatsapp_business_management`. La guía actual también contempla `business_management` para las operaciones de administración. Evitar depender del token temporal del panel de pruebas. [Tokens y asignación de activos](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens).
5. Configurar las variables solo en el servidor, publicar las plantillas manualmente y habilitar el webhook. Probar primero con los recursos de prueba de Meta y destinatarios autorizados. La activación real, dominio, facturación y ensayo pago quedan en Pendientes de Walter.

## Variables y ejecución

El archivo [`.env.example`](../cooper/.env.example) contiene únicamente nombres y campos vacíos para los secretos nuevos.

| Variable | Uso |
| --- | --- |
| `COOPER_MENSAJERIA` | `simulada` por defecto; `whatsapp` selecciona Cloud API. Otros valores se rechazan. |
| `COOPER_MENSAJERIA_PAUSA` | `1` impide iniciar el consumidor al arrancar Node. Reiniciar para aplicar. No es un interruptor de emergencia sobre solicitudes ya en vuelo. |
| `WHATSAPP_TOKEN` | Token privado para enviar, solo servidor. |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número empresarial, no el teléfono ni el ID de WABA. |
| `WHATSAPP_APP_SECRET` | Secreto de la aplicación para verificar firmas entrantes. |
| `WHATSAPP_VERIFY_TOKEN` | Valor privado elegido para el desafío de alta del webhook; no es el token de envío. |
| `AUTH_SECRET` | Existente; mínimo 32 caracteres para HMAC de códigos y enlaces, con separación de propósitos. Rotarlo invalida códigos y enlaces pendientes. |
| `AUTH_URL` | Origen canónico; HTTPS en producción. Debe coincidir con el origen de las plantillas. |
| `COOPER_GASTO_ALERTA_USD` | Umbral informativo diario existente. La alerta usa el total del equipo y se limita a una al día UTC. No bloquea producción. |

`COOPER_DEMO=1` fuerza siempre transporte simulado. En ese modo el perfil muestra claramente un código de demostración y no contacta Meta. Al pasar a modo real hay que verificar otra vez los números.

`ProveedorMensajeria`, `WhatsAppCloudAPI` y `WhatsAppSimulada` están en [proveedor.ts](../cooper/src/servicios/mensajeria/proveedor.ts). Cloud API usa únicamente `POST https://graph.facebook.com/v27.0/{PHONE_NUMBER_ID}/messages`, Bearer en cabecera, timeout de diez segundos y redirecciones prohibidas. No hay SDK adicional. [Referencia oficial de Messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api).

La migración aditiva `0005_whatsapp` sigue a `0004_presentacion`. Se aplica con el mecanismo existente al abrir la base o con `npm run db:migrate`. No editar migraciones ya aplicadas. El consumidor arranca desde `src/instrumentation.ts` en un servidor Node persistente y revisa la cola cada quince segundos, aunque no haya navegadores abiertos. No corre durante `next build`. El avance de la fábrica simulada conserva su dependencia previa de SSE; el despacho de avisos no la tiene.

## Plantillas en español para revisión

Cinco JSON válidos y separados en [`cooper/whatsapp/plantillas/`](../cooper/whatsapp/plantillas/):

| Nombre | Categoría solicitada | Contenido |
| --- | --- | --- |
| `cooper_aprobacion_guion` | `UTILITY` | Título de video propio y enlace a la revisión. |
| `cooper_aprobacion_final` | `UTILITY` | Título y enlace a la aprobación final. |
| `cooper_video_publicado` | `UTILITY` | Confirmación de publicación y enlace al estado. |
| `cooper_alerta_gasto_admin` | `UTILITY` | Total diario y enlace privado de administración. Solo Walter. |
| `cooper_verificar_numero` | `AUTHENTICATION` | Código de un uso con botón para copiar, aviso de diez minutos y TTL de entrega de 600 segundos. |

Todas usan `language: "es"`. Las cuatro de utilidad incluyen ejemplos ficticios y botón URL dinámico. El cuerpo de autenticación lo localiza Meta; no se sustituye por texto libre. Las reglas de creación y envío del botón OTP son distintas: se crea como `OTP/COPY_CODE` y se envía como componente `button`, `sub_type: "url"`, índice `0`, con el mismo código que el cuerpo. [Plantillas de utilidad](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/utility-templates/utility-templates), [plantillas de autenticación con código](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/copy-code-button-authentication-templates).

**Único dato pendiente de los JSON:** el dominio real. Los originales usan `https://cooper.example.org`; no enviarlos a revisión con ese dominio. Preparar los cinco cuerpos definitivos, sin red ni secretos, desde `cooper/`:

```bash
node scripts/whatsapp-plantillas.mjs https://DOMINIO-DE-COOPER .cache/plantillas-meta
```

El generador exige HTTPS, reemplaza el origen en URL y ejemplos, y rechaza sobrescribir archivos. Cada JSON resultante es un cuerpo independiente para `POST https://graph.facebook.com/v27.0/{WABA_ID}/message_templates` con la autorización de administración correspondiente. **No** enviar los cinco como un array. También se pueden transcribir en WhatsApp Manager. [Endpoint oficial de creación](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/).

Walter revisa textos, dominio y categoría y espera `APPROVED` en los cinco nombres antes de activar. Meta puede rechazar o reclasificar las plantillas; el código no supone que estos borradores estén aprobados. Nombres, idioma y orden de parámetros deben conservarse o cambiarse también en el emisor. Esta integración no automatiza el envío a revisión ni consulta su aprobación.

## Webhook

Callback: `https://DOMINIO-DE-COOPER/api/whatsapp/webhook`. Necesita HTTPS público con certificado válido. Configurar el verify token en el panel sin publicarlo. Suscribir el campo **messages**, que transporta tanto mensajes entrantes como estados de entrega, y la app a la cuenta correspondiente. La referencia de suscripción es `POST /v27.0/{WABA_ID}/subscribed_apps`; comprobar mediante `GET` sobre esa misma ruta. [Configuración del endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint), [suscripción de aplicación](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/subscribed-apps-api).

- GET verifica `hub.mode=subscribe` y el verify token y devuelve `hub.challenge` como texto plano.
- POST calcula HMAC-SHA256 sobre los **bytes originales**, usando el app secret, y compara en tiempo constante `X-Hub-Signature-256`. El verify token no sustituye la firma.
- Rechaza firmas inválidas antes de procesar JSON. Acepta lotes hasta 1 MiB y filtra `metadata.phone_number_id`. No almacena cuerpos completos, textos entrantes, códigos ni enlaces en los registros.
- Deduplica mensajes por ID persistido. Conserva recibos de entrega, con ID, destinatario, estado, fecha y código numérico de error. Los estados fuera de orden no hacen retroceder `read` a `sent`. Los recibos que llegan antes del retorno HTTP se concilian al guardar el ID remoto.
- Solo mensajes recientes y de números verificados abren la ventana. Los eventos antiguos no la prolongan. Una revisión recibe como máximo una decisión por WhatsApp, incluso si se pulsan botones de dos avisos distintos o Meta repite el webhook.

Meta reintenta webhooks fallidos durante hasta siete días. El receptor admite números E.164; los mensajes que solo identifican al usuario por BSUID/username se ignoran sin impedir otros eventos del lote. Dar soporte a esas identidades requiere un vínculo explícito adicional; nunca se deduce la cuenta por nombre visible. [Formato y variantes actuales](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview).

## Cola, idempotencia y operación

SQLite guarda contactos, cola, intentos, decisiones, mensajes procesados y entregas. El progreso del puente y del simulador encola bajo la transacción existente; el consumidor también concilia revisiones pendientes. Antes de cada envío vuelve a comprobar acceso, consentimiento, teléfono, modalidad, recurso y revisión. El destinatario siempre sale del dueño persistido, nunca del cuerpo enviado por el navegador.

Las claves de deduplicación identifican dueño, video, revisión y verificación del número. La reserva usa una transacción `IMMEDIATE`, evitando que dos consumidores de la misma SQLite envíen la misma fila. No se ofrece coordinación entre bases distintas.

- Máximo cinco intentos por hora y veinte por día móvil por cuenta, con seis segundos mínimos entre intentos. OTP incluido. Son límites de **mensajería**, no de videos ni gasto. Un intento ocupa cuota aunque falle. Las filas aplazadas pueden caducar antes de disponer de cuota.
- Hasta cinco intentos por aviso si Meta devuelve 429 o un error explícitamente transitorio. Backoff 30/60/120/240 segundos, respetando `Retry-After` cuando es mayor. Los fallos permanentes terminan la fila.
- Una caída de red, éxito sin ID reconocible, respuesta 5xx ambigua o reserva abandonada pasa a `incierto`. No se inventa una cabecera de idempotencia remota: la referencia de Messages no garantiza envío exactamente una vez. Estas filas requieren revisión manual; no se reenvían automáticamente.
- Una decisión que pudo llegar a n8n se conserva como `incierta`; si el proceso muere queda `procesando`. Revisar en Cooper/n8n antes de repetir por la web. No reproducir automáticamente la corrección, que podría haberse ejecutado. Las aprobaciones n8n reutilizan además la idempotencia del puente existente.
- El retorno de `/messages` significa aceptación, no entrega. La entrega real procede del webhook. Solo el simulador produce una entrega ficticia inmediata.

`GET /api/whatsapp` devuelve el historial propio, sin cuerpos ni teléfonos. `GET /api/whatsapp/resumen` requiere administrador y devuelve conteos por estado de envíos y decisiones. Para investigar una excepción, revisar las tablas `whatsapp_outbox` y `whatsapp_actions` en el servidor con acceso administrativo; no exportar sus datos personales. La alerta de gasto consulta la fuente administrativa existente cada minuto solo si Walter la activó, mantiene la etiqueta de simulación/estimación y no añade una tarifa WhatsApp supuesta a los gastos audiovisuales.

Conservar la base en volumen persistente. No purgar la deduplicación antes del período de reentrega de Meta ni mientras existan acciones/enlaces vigentes. La política de retención y copias pertenece a la fase 5. No se eliminan automáticamente los registros en esta fase. Enlaces, teléfonos y SQLite son privados; evitar registrar URLs completas en el proxy. Una baja no puede retirar un mensaje ya transmitido ni impedir una solicitud que estaba en vuelo.

## Costos: ya no se factura por conversación

La página oficial vigente describe cobro **por mensaje entregado**, según mercado del destinatario y categoría. Los mensajes de servicio son gratuitos; Meta también contempla gratuidad para utilidad en respuesta al usuario dentro de la ventana de atención. Autenticación tiene su categoría y tarifas. Hay niveles de volumen y supuestos especiales de entrada gratuita. No usar una tabla histórica de precios por conversación para presupuestar Cooper. [Precios oficiales y selector por mercado](https://business.whatsapp.com/products/platform-pricing).

Walter debe seleccionar **Perú**, moneda y categoría en el tarifario vigente al activar y conservar esa fecha de referencia. Esta guía no fija una tarifa que pueda cambiar. Estimación operativa: sumar los mensajes de utilidad facturables y los OTP entregados, cada uno multiplicado por su tarifa vigente y tramo aplicable; añadir impuestos o cargos de intermediario solo si se contrata alguno. El transporte aquí es directo a Meta. Los recibos no se presentan como factura ni se deduce el costo de un HTTP 200.

La consulta pública del documento técnico de pricing solicitó login; se usó la página pública oficial, sin iniciar sesión. No se efectuaron pagos.

## Ensayo y límites

`npm test -- tests/whatsapp.test.ts` usa SQLite temporal y transportes simulados, con la red bloqueada salvo mocks explícitos. Incluye OTP, permisos, cambios de número, enlaces, ventana, firmas, respuestas, deduplicación, orden de entregas, fallos, límites y contratos HTTP. `npm run test:e2e -- whatsapp.spec.ts` comprueba el perfil, código simulado, preferencias, cambio de número y axe a 390/1440 px. La puerta final de misión ejecuta además todas las suites y la regresión de workflows.

No se validaron entrega real, aprobación de plantillas, calidad de número, facturación, OAuth, certificados, latencia pública ni cuotas de la cuenta de Meta. No se desplegó Cooper ni n8n. El consumidor requiere Node persistente; no está diseñado para funciones efímeras. La propuesta visual conserva Manrope, grafito, marfil, celeste y los controles existentes del perfil, sin introducir un sistema visual distinto.

## Pendientes de Walter

- Número dedicado, portfolio, aplicación y verificaciones de Meta; confirmar acceso a las cuentas y permisos aplicables.
- Dominio HTTPS y callback definitivo; coordinar servidor persistente, proxy sin registro de enlaces privados y copias con fase 5.
- Revisar los cinco JSON, generar con el dominio y obtener aprobación de Meta, incluida la plantilla OTP.
- Cargar las cuatro variables privadas, confirmar tarifas y medio de facturación, y autorizar un ensayo real con cada destinatario.
- Definir retención y revisión de estados inciertos; decidir si se necesitan identidades BSUID además de teléfonos.
