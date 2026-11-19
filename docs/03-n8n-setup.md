# Puesta en marcha en n8n 2.47.4

## Importación

En el editor de n8n, crea un workflow por archivo. Abre **More actions → Import → From file** y selecciona su JSON. Comprueba que los cuatro figuren sin publicar.

En el equipo que ejecuta Podman, también puedes importar los cuatro con el comando siguiente. Úsalo una vez en una instalación que todavía carece de estos borradores.

~~~bash
cd /home/david/Proyectos/claude-n8n-youtube-automation &&
  jq -s . workflows/*.json |
  podman exec -i videos-n8n n8n import:workflow --input=/dev/stdin --activeState=false
~~~

## Datos de configuración

En **Factory Settings**, indica el ID del chat privado en los flujos 01, 02 y 04, el ID y nombre de la hoja en 03 y 04, y la URL de la rutina en 01 y 02. La hoja propuesta se llama Videos y usa las columnas de [la plantilla](../templates/tracking-sheet.md).

| Credencial de n8n | Dónde se usa |
|---|---|
| Telegram API | Disparador y mensajes de los flujos 01, 02 y 04 |
| HTTP Header Auth con Authorization Bearer de la rutina | Fire Claude Routine en 01 y 02 |
| HTTP Header Auth con un valor aleatorio dedicado | Script Webhook en 02 y Log Row Webhook en 03 |
| HTTP Basic Auth del operador | Wait For My Decision en 02 |
| Google Sheets OAuth2 | Lectura y escritura en 03 y 04 |
| Crypto con HMAC Secret de HeyGen | Calculate HeyGen Signature en 04 |
| HTTP Header Auth con x-api-key de HeyGen | Consultas Get Video Agent Session y Get HeyGen Video en 04 |
| YouTube OAuth2 | Upload Privately To YouTube en 04 |

Guarda los tokens en el gestor de credenciales de n8n y el secreto de retorno en el entorno de la rutina. Puedes usar el encabezado X-Video-Factory-Key para el secreto de retorno. Limita la clave de HeyGen a los permisos de lectura disponibles para las consultas.

El editor puede seguir local. Para recibir eventos de servicios externos, hace falta acceso HTTPS a los webhooks y al formulario. Cuando se autorice el acceso, configura el proxy de esos endpoints y establece N8N_WEBHOOK_URL con la dirección pública y N8N_PROXY_HOPS con el número real de proxies. Telegram registra una URL HTTPS por bot. Para probar con un bot que ya usa otro flujo, usa un bot de pruebas separado. [Documentación del proxy de n8n](https://docs.n8n.io/hosting/configuration/configuration-examples/webhook-url/) · [Telegram Trigger](https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.telegramtrigger/common-issues/)

## Pruebas

~~~bash
node --test --test-isolation=none tests/workflows.test.cjs
~~~

La suite ejecuta el JavaScript de los JSON con datos ficticios. Si tienes disponible el paquete n8n 2.47.4 en disco, ejecuta también FACTORY_N8N_DIR=/ruta/al/paquete/n8n node tests/n8n-smoke.cjs. Este ensayo usa el motor de n8n con entradas y servicios simulados.

Para comprobar el transporte real, usa los webhooks de prueba con sus credenciales, una hoja de pruebas y un guion ficticio. Comprueba el acuse de registro, las tres decisiones y la firma de un evento de prueba. Conserva allowClaude y allowYoutubeUpload en false. n8n puede exigir credenciales asignadas a nodos de ramas que la prueba no recorrerá.

Para producción, habilita los controles después de la aprobación del operador y de verificar la cuenta, el canal y el presupuesto. YouTube usa visibilidad privada con notificaciones a suscriptores deshabilitadas.

## Concurrencia y recuperación

Sheets ejecuta la lectura y la actualización en operaciones independientes. Antes de habilitar la subida en esta instancia dedicada, serializa las ejecuciones de producción con N8N_CONCURRENCY_PRODUCTION_LIMIT=1. Esto evita que dos entregas simultáneas reserven la misma fila. Si una subida queda en uploading, verifica el canal y la ejecución antes de cambiar la fila y reintentar. Conserva el ID de YouTube si la subida llegó a completarse. [Concurrencia de n8n](https://docs.n8n.io/hosting/scaling/concurrency-control/)
