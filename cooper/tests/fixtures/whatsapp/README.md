# Payloads oficiales simulados de WhatsApp

Consulta: 21-11-2026, Lima. Se conserva la estructura documentada por Meta; todos los identificadores, teléfonos, nombres, mensajes y fechas de estos archivos son sintéticos. Ninguno procede de un webhook real. No son evidencia de entrega ni de aprobación de una cuenta.

| Archivo | Estructura y propósito |
| --- | --- |
| `texto.json` | Entrada de texto individual, con teléfono y BSUID adicionales. |
| `texto-reenviado.json` | Texto reenviado: `context.forwarded` existe y `context.id` puede faltar. |
| `bsuid-sin-telefono.json` | Variante actual con username/BSUID y sin `from` ni `wa_id`; Cooper no debe atribuirla por nombre. |
| `estados.json` | Estados de un mismo envío, deliberadamente fuera de orden; `read` no debe retroceder. |
| `interactivo.json` | Botón de aprobación enlazado al ID del envío mediante `context.id`. |

Fuentes primarias: [texto y variantes](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/text), [estados](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status/), [botones de respuesta y webhook](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages), [sobre y reentregas](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/).

Los tests deben clonar los JSON, fijar el reloj o sustituir fechas, vincular el teléfono sintético a una cuenta de ensayo y firmar los **bytes serializados** con un App Secret generado exclusivamente para la prueba. Cambiar campos después de firmar debe producir rechazo. Los IDs de WABA y número son `100000000000002` y `100000000000001`; no deben enviarse a Graph API. La construcción sintética del lote de estados sirve para ensayar reordenación y duplicados, no afirma que Meta siempre agrupe esos tres estados en una petición.
