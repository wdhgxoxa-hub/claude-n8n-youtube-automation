# Integración con HeyGen

La rutina usa el conector MCP oficial de HeyGen para generar con Video Agent. La generación usa los créditos premium de la cuenta web. Conecta la cuenta del proyecto desde Claude y completa el avatar y la voz en el kit de marca. [HeyGen MCP](https://developers.heygen.com/mcp/overview)

Antes del primer render real, confirma qué herramienta de Video Agent está disponible y qué identificador devuelve al enviar el trabajo. El flujo 03 registra el video_id. Si el conector devuelve solo un ID de sesión, la rutina debe resolver su video_id antes del registro.

## Webhook de entrega

Registra la URL HTTPS de producción del flujo 04 para video_agent.success y video_agent.fail. La API de registro requiere una clave y devuelve un secreto de firma. Guárdalo como HMAC Secret en la credencial Crypto usada por Calculate HeyGen Signature. El flujo verifica HMAC SHA-256 sobre el cuerpo original del evento con el encabezado signature. [Webhooks de HeyGen](https://developers.heygen.com/docs/webhooks)

Cuando el evento trae session_id o requiere resolver el enlace, el flujo usa consultas de lectura a la API v3 con el encabezado x-api-key. El archivo se descarga por HTTPS desde los hosts de archivos conocidos de HeyGen. La primera prueba real verifica el host utilizado por tu cuenta. [Eventos de HeyGen](https://developers.heygen.com/docs/webhook-events)

Usa el guion aprobado completo, el avatar y la voz de HeyGen en una sola solicitud. Los enlaces de descarga caducan. Para retomar una entrega, obtén un enlace vigente desde HeyGen. [Plantilla de Video Agent](../skill/reference/video-agent-prompt.md)
