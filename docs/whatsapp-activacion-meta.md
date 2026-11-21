# WhatsApp de Cooper: los tres pasos de Walter en Meta

21 de noviembre de 2026, Lima. Preparado por `total-whatsapp-listo`, sin pagos, envíos reales ni cambios en el VPS. La aceptación de mensajes reales sigue pendiente. El dominio procede del [informe de instalación del VPS](informes/cooper-vps-real.md); esta misión no ha comprobado su despliegue ni la configuración actual de Meta.

La app **Cooper**, el portfolio **Cooper Estudio** y el número empresarial ya constan registrados en el [alta anterior](informes/cooper-whatsapp-alta.md). Allí quedaron cuatro plantillas de utilidad `PENDING` con dominio provisional, la plantilla OTP sin crear por `10/2388185` y el bloqueo de pago `141006`. Son resultados históricos, no el estado actual de la cuenta. No repetir el registro ni crear otros activos por defecto.

## 1. Resolver el pago y revisar las plantillas de la cuenta correcta

Abrir [Meta Business Suite → Facturación y pagos → Métodos de pago](https://business.facebook.com/latest/billing_hub/payment_methods/), seleccionar **Cooper Estudio** y su cuenta de WhatsApp/mensajería, añadir o corregir el método que Meta solicita y resolver cualquier saldo o restricción que muestre esa cuenta. El recibo esperado es que Meta confirme el método de pago habilitado para la cuenta de WhatsApp; una tarjeta asociada únicamente a publicidad no acredita este paso. Walter hace esta operación personalmente; el repositorio no contiene datos de tarjeta. [Facturación oficial](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/).

En [WhatsApp Manager → Plantillas de mensajes](https://business.facebook.com/latest/whatsapp_manager/message_templates), revisar también los nombres de la tabla siguiente. Las cuatro plantillas de utilidad históricas usaban `cooper.example.org`: deben actualizarse con **`https://cooper.cooperestudio.com`**, volver a revisión y alcanzar `APPROVED`. Resolver con Meta el permiso de autenticación si sigue rechazado; conservar su categoría correcta. El alta de un medio de pago no garantiza por sí misma que desaparezca ese rechazo. La sexta plantilla, de Marcas, es un requisito adicional del código integrado y no consta presentada en el alta histórica. [Creación y estados de plantillas](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/).

| Nombre exacto | Idioma | Categoría requerida por Cooper |
| --- | --- | --- |
| `cooper_verificar_numero` | `es` | `AUTHENTICATION`, botón para copiar código |
| `cooper_aprobacion_guion` | `es` | `UTILITY` |
| `cooper_aprobacion_final` | `es` | `UTILITY` |
| `cooper_video_publicado` | `es` | `UTILITY` |
| `cooper_alerta_gasto_admin` | `es` | `UTILITY` |
| `cooper_aprobacion_marca` | `es` | `UTILITY`, adicional si Walter activa avisos de Marcas |

Los JSON fuente y su generador están en [la guía de WhatsApp](cooper-whatsapp.md#plantillas-en-español-para-revisión). El equipo puede preparar los cuerpos definitivos localmente; Walter revisa nombres, idioma, categoría, textos y enlaces en Meta. Meta puede pedir verificación empresarial u otra revisión. Un estado `PENDING`, `PAUSED`, `DISABLED` o un permiso pendiente no cuenta como aprobación.

Antes de activar, revisar las tarifas vigentes del mercado de los destinatarios y de cada categoría. La ventana de 24 horas permite responder con texto, pero no promete gratuidad. La página oficial vigente describe desde octubre de 2026 un tramo mensual de servicio gratuito y cobro después de agotarlo; los mensajes de utilidad también tienen su tarifa. No se fija una tarifa ni se infiere una factura desde un HTTP 200. [Precios actuales](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/).

## 2. Entregar el App Secret por el canal privado de operación

Abrir [Meta for Developers → Mis apps](https://developers.facebook.com/apps), seleccionar **Cooper** y entrar en **Configuración de la app → Básica → Clave secreta de la app / App Secret → Mostrar**. Copiarla únicamente al mecanismo privado acordado con el responsable del despliegue, para instalarla como **`WHATSAPP_APP_SECRET`** en el entorno del servidor. No pegarla en este documento, el chat, un ticket, Git ni capturas. [Configuración básica y App Secret, enlazada por Meta desde su contrato de firma](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/basic-settings#app-secret).

El responsable confirma solo «variable instalada» y valida localmente el receptor antes de continuar. El App Secret autentica los POST mediante HMAC-SHA256 de los bytes originales y `X-Hub-Signature-256`; es distinto del token de envío `WHATSAPP_TOKEN` y del token de verificación `WHATSAPP_VERIFY_TOKEN`. Sin App Secret el receptor rechaza la recepción con 503. [Firma oficial del webhook](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/).

## 3. Guardar la URL del webhook y suscribir `messages`

En la app **Cooper**, abrir **WhatsApp → Configuración**. Si la app muestra el diseño por casos de uso: **Casos de uso → Personalizar → Configuración**. En la edición del webhook introducir exactamente:

| Campo de Meta | Valor |
| --- | --- |
| Callback URL / URL de devolución de llamada | `https://cooper.cooperestudio.com/api/whatsapp/webhook` |
| Verify token / Token de verificación | Valor privado de `WHATSAPP_VERIFY_TOKEN` instalado en Cooper; solicitarlo por el canal privado de operación |
| Objeto, si el panel lo solicita | `whatsapp_business_account` |
| Campo que debe quedar suscrito | `messages` |

Pulsar **Verificar y guardar**, abrir **Administrar campos** y activar **messages**. Ese único campo transporta mensajes entrantes y estados de entrega; no crear un campo inventado `message_status`. El servidor debe estar publicado con certificado HTTPS válido y devolver el desafío GET tal cual. La configuración de la URL y la suscripción app/cuenta son distintas: el alta anterior confirmó la app suscrita a la WABA, y el responsable debe verificar que esa asociación se conserve. [Configuración oficial](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/), [campos y recepción](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/), [suscripción de app](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/subscribed-apps-api).

El recibo esperado es URL verificada y `messages` suscrito. El botón de prueba de Meta permite comprobar el POST firmado, pero su respuesta 200 no acredita chat ni entrega a un usuario: los datos de prueba del panel pueden no corresponder al número autorizado. Después de integrar y desplegar este frente, el responsable valida una entrada de una cuenta real verificada, su respuesta breve y los estados `sent`/`delivered`/`read`, con el ensayo real expresamente autorizado por Walter. No volver a usar `hello_world` con el número empresarial; el alta anterior ya documentó su rechazo. La app debe cumplir los requisitos de publicación de Meta para los eventos que correspondan. [Diagnóstico oficial de webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/).

La mensajería se mantiene pausada hasta cerrar los tres pasos, las aprobaciones de plantilla y la aceptación del despliegue. Cada integrante debe verificar su propio número en **Mi perfil** y consentir los avisos. La cuenta de sistema debe conservar `whatsapp_business_messaging` para mensajes y `whatsapp_business_management` para consultar plantillas. El texto libre funciona dentro de las 24 horas desde el último mensaje de ese usuario; fuera de la ventana solo se envían plantillas aprobadas. [Permisos](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/), [ventana de atención](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages/).
