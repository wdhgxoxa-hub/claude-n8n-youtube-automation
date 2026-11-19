# Flujos de la fábrica de videos

Los cuatro JSON se importan como borradores en n8n 2.47.4. Cada flujo tiene un nodo **Factory Settings** para los datos de la instalación. Las credenciales se guardan en n8n y se asignan al nodo que las usa.

| Flujo | Entrada | Resultado |
|---|---|---|
| 01 · Telegram | Mensaje del chat privado autorizado | Solicitud con modo topic o script para Claude |
| 02 · Revisión de guion | POST autenticado en /webhook/video-factory/script-approval | Aviso breve en Telegram y formulario con el guion completo. Respuesta aprobada, revisión o cancelación |
| 03 · Registro en Sheets | POST autenticado en /webhook/video-factory/log-video-row | Fila identificada por video_id y acuse HTTP |
| 04 · HeyGen y YouTube | POST firmado en /webhook/video-factory/heygen-callback | Registro del render y, si se autoriza, subida privada y aviso |

En el flujo 01, escribe **topic** o **idea** antes del tema y **script** antes de enviar un guion final. Usa [angle: ...] y [cta: ...] para las opciones de tema. La consulta de vidIQ se solicita con (use vidiq).

En el flujo 02, el formulario usa autenticación básica y vence después de 24 horas. Para pedir cambios, incluye comentarios. Cada decisión se envía a Claude como una nueva ejecución con el contexto del guion.

En el flujo 03, un nuevo registro obtiene HTTP 201 después de guardar la fila. Un reintento obtiene HTTP 200 y conserva la fila. Si hay filas duplicadas con el mismo ID, devuelve 409 para revisión.

En el flujo 04, se procesan eventos video_agent.success y video_agent.fail con firma válida. Los eventos que traen session_id se completan con consultas de lectura. El flujo devuelve HTTP 503 si el registro aún no existe, de modo que HeyGen puede reintentar. Con la subida deshabilitada, un render correcto se registra como ready. La ruta de subida utiliza uploading y uploaded con una URL privada de YouTube.

Los contratos de entrada, revisión, registro y entrega son independientes. Para integrar otro renderizador, conserva el registro por video_id y adapta la validación del evento y la obtención del archivo en el flujo 04.

La configuración y las pruebas están en [docs/03-n8n-setup.md](../docs/03-n8n-setup.md).
