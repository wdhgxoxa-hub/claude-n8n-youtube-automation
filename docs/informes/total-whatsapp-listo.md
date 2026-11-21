# total-whatsapp-listo — WhatsApp Cloud API y chat de Cooper

21-11-2026, Lima. Rama/worktree propios: `total-whatsapp-listo`, `/home/david/Proyectos/cooper-wt/total-whatsapp-listo`. Base integrada: `deb1f2a` (`total-integrador`). Implementación local; sin integración en otras ramas, push ni despliegue. No se accedió al VPS, n8n vivo, D&S Factory, credenciales reales, OAuth, pagos ni publicaciones.

## Commits y alcance

| Commit | Cambio |
| --- | --- |
| `3ae1c59cee2512743a0b6c069f9c95261f922cb1` | Completar WhatsApp con chat durable y controles de envío; migración, regresiones, fixtures y guía de Meta. |
| Cierre documental posterior | Este informe, recibo de la puerta y actualización de `docs/ESTADO.md`; sin cambios de ejecución. |

Se trabajó con tres subagentes en paralelo: recepción/chat, envío/controles y revisión independiente/documentación oficial. La integración de archivos y los commits se hicieron en esta rama. Los dos documentos de misión ya presentes como archivos no versionados se conservaron intactos.

## Implementado

- `/api/whatsapp/webhook` conserva GET de verificación y HMAC-SHA256 sobre los bytes originales del POST, comparación constante y fallo cerrado sin `WHATSAPP_APP_SECRET`. Admite hasta 3 MiB, filtra número empresarial, producto y WABA configurada; admite texto reenviado sin `context.id` y estados fuera de orden.
- El ID entrante se persiste junto al turno en una transacción. La respuesta HTTP no espera al modelo para los mensajes de texto. El trabajador reutiliza `responderChat`, su memoria, cola y permisos; el historial web queda en la cuenta asociada al teléfono verificado. Las respuestas de chat al teléfono tienen como máximo 18 palabras y 240 caracteres; la salida del modelo se reduce a una frase. Las propuestas de mutación siguen necesitando Confirmar en Cooper; un «sí» escrito no confirma tarjetas.
- Migración aditiva `0019_whatsapp_chat`, decimoquinta del diario. Conserva contactos/envíos anteriores y añade `whatsapp_chat_jobs`, con índice de pendientes, reserva y respuesta durable. La respuesta y el outbox se confirman atómicamente, con comparación de estado y reserva antes de encolar. Dos consumidores no procesan la misma fila. El inventario de retención incluye solo sus metadatos; no exporta cuerpos ni purga datos.
- El transporte real consulta `/{WHATSAPP_WABA_ID}/message_templates` antes de cada plantilla y exige nombre, idioma `es` y estado `APPROVED`. No toma el JSON local como aprobación. Se conserva `/{WHATSAPP_PHONE_NUMBER_ID}/messages`, Bearer, timeout y rechazo de redirecciones. Después de la consulta asíncrona revalida consentimiento, acceso y revisión antes del POST.
- Texto y botones requieren la ventana de 24 horas al despachar. Fuera de ventana los avisos usan sus plantillas; una respuesta de chat vencida se cancela, sin convertirla en una plantilla genérica. El reloj avanza entre envíos, reservas y reintentos.
- Rechazos transitorios explícitos de Meta: hasta cinco intentos, backoff 30/60/120/240 segundos y `Retry-After`. Un POST ambiguo o una reserva abandonada queda `incierto`, sin reenvío automático. En chat, 409 previo al modelo aplaza hasta 60 segundos; 429 previo al modelo espera 15 minutos y admite hasta cinco intentos. Una caída después de iniciar el modelo nunca repite tarjetas a ciegas.
- `COOPER_MENSAJERIA_PAUSA=1` frena chat, decisiones y envíos; se revalida también después de consultar una plantilla. Los textos y recibos entrantes permanecen durables y STOP/baja sigue revocando consentimiento. El resumen administrativo añade conteos de conversaciones sin teléfonos ni cuerpos.
- [Guía con exactamente tres pasos de Walter](../whatsapp-activacion-meta.md): pago/plantillas, App Secret privado y URL/suscripción del webhook. Actualizada la [guía general](../cooper-whatsapp.md) con fuentes actuales y límites.

## Pruebas y puerta

Focal previo al commit: `npm run lint && npm run typecheck && npm test -- tests/whatsapp.test.ts tests/whatsapp-chat.test.ts tests/whatsapp-envios.test.ts tests/whatsapp-migracion.test.ts tests/retencion.test.ts`, **119/119 PASS**, rc 0 y cero advertencias. El primer intento de preparar navegadores en el host fue rechazado por plataforma no soportada; se usó el contenedor Debian 12 previsto por `ci:limpia`, sin modificar ni eludir el preflight.

**Puerta completa PASS**, ejecutada con `cd cooper && npm run ci:limpia` en el contenedor Debian 12 fijado por el repositorio, sobre un archivo Git limpio de `3ae1c59`. Inicio: 21-11-2026 18:02:12 Lima; fin: 18:20:36. El arnés ejecutó secuencialmente la cadena obligatoria, con preparación aislada de navegadores entre instalación y lint:

| Paso | Resultado | rc | Advertencias |
| --- | --- | --- | --- |
| `npm ci` | PASS, 0 vulnerabilidades | 0 | 0 |
| Preparación de navegadores/Sentinel | PASS | 0 | 0 |
| `npm run lint` | PASS | 0 | 0 |
| `npm run typecheck` | PASS | 0 | 0 |
| `npm test` | **524/524 PASS** | 0 | 0 |
| `npm run test:e2e` | **103/103 PASS**, Chromium, Firefox y WebKit; sin reintentos ni omisiones | 0 | 0 |
| `npm run build` | PASS | 0 | 0 |
| Raíz: `node --test tests/flujos_v2.test.cjs` | **235/235 PASS** | 0 | 0 |

Código de salida del ejecutor completo: **0**. [Recibo versionado](evidencias/total-whatsapp-listo/puerta.json) con SHA de fuente, archivo Git, versiones, códigos, conteos y SHA-256 de los ocho logs; sus huellas se recalcularon y coinciden. [Recibo y logs locales completos](../../.cache/ci-limpia-C3KfHq/checkout/cooper/.cache/puerta/resultado.json), [salida del ejecutor](../../cooper/.cache/total-whatsapp-puerta.log). Node 24.22.3, npm 12.2.2, Python 3.14.7; Sentinel conserva el guardián y la revisión fijada. El cierre posterior solo cambia documentación y este recibo: código, pruebas, migraciones y configuración de ejemplo siguen idénticos al commit probado.

Cobertura específica: firma/challenge/cuerpo alterado y sobredimensionado, payloads oficiales simulados, cuenta ajena/revocada, WABA/número ajenos, STOP y pausa, tarjetas sin ejecución, memoria JSON sin instrucción de brevedad, duplicados, dos consumidores, pérdida de reserva, reinicio SQLite, plantilla pendiente/pausada/idioma distinto, 24 h exactas y vencimiento durante espera, rechazos temporales, POST ambiguo, recibos adelantados/fuera de orden y migración de catorce a quince entradas. Los cinco [fixtures](../../cooper/tests/fixtures/whatsapp/README.md) son sintéticos y están usados por las pruebas; no proceden de datos privados de Meta.

La revisión reprodujo dos fallos del reloj de la cola (reserva envejecida durante un lote lento y backoff calculado desde el comienzo del lote) y los corrigió con pruebas de regresión. También detectó la instrucción de brevedad aplicada al resumen JSON y el rechazo 429 previo al modelo, corregidos antes del commit verificado.

## Límites reales

- Meta no se contactó para enviar ni para consultar una cuenta real. La aprobación, entrega, facturación, permisos vigentes y funcionamiento público necesitan aceptación posterior; los mocks no acreditan esos hechos. Un HTTP exitoso de `/messages` es aceptación, no entrega; esta última se confirma con recibos.
- Conversación por texto y teléfono E.164 previamente verificado/consentido. BSUID/username sin teléfono se ignora sin atribuir por nombre. Texto de más de 6.000 caracteres recibe una petición de acortarlo. Audio y archivos no se convierten en conversaciones nuevas; imagen/video conservan su ruta de ingesta de Marcas.
- Se conservan los límites existentes: cinco intentos por hora, veinte por día móvil y seis segundos entre intentos por cuenta; incluyen OTP y respuestas de chat. Una fila puede caducar antes de tener cupo. El trabajador programa un ciclo cada 15 segundos sin solaparlos; un ciclo lento retrasa el siguiente. Necesita un proceso Node persistente y SQLite compartida entre sus consumidores; no coordina bases independientes.
- La pausa no retira solicitudes ya transmitidas. Los botones y medios recibidos durante la pausa se deduplican y no se ejecutan: el usuario debe reenviarlos tras reanudar. Los textos sí quedan pendientes. Cambiar variables del servicio exige su reinicio operativo normal.
- Un turno de chat incierto puede haber guardado historial o una tarjeta antes de la caída. Se revisa antes de repetir; el resumen administrativo permite detectar sus conteos, pero no se añade una nueva interfaz de conciliación de conversaciones. Los avisos de espera 429 pueden dejar mensajes informativos en el historial. No se ofrece entrega remota exactamente una vez ni purga automática.
- Integración, migración productiva y despliegue pertenecen al responsable del cierre. Esta rama conserva los catorce SQL previos sin cambios; la puerta local no acredita una base productiva migrada.

## Pendientes de Walter

1. **Pago y plantillas:** en Meta Business Suite → Facturación y pagos → Métodos de pago, resolver la cuenta de WhatsApp de Cooper Estudio. Revisar las cinco plantillas base y `cooper_aprobacion_marca` si usa esos avisos; OTP debe estar habilitada, todas en `es` y `APPROVED`, con el dominio definitivo en las de enlace. El pago no garantiza por sí mismo permisos/aprobaciones. Revisar el tarifario vigente.
2. **App Secret:** en la app Cooper → Configuración de la app → Básica → App Secret, entregarlo por el canal privado de operación para `WHATSAPP_APP_SECRET`. Nunca pegarlo en informes, Git ni chat. El operador verifica también las demás variables y los permisos de mensajería/administración de plantillas, sin publicar valores.
3. **Webhook:** después del despliegue aceptado, guardar **`https://cooper.cooperestudio.com/api/whatsapp/webhook`**, usar el `WHATSAPP_VERIFY_TOKEN` privado y suscribir el campo **`messages`**, conservando la asociación app/WABA. La [guía exacta](../whatsapp-activacion-meta.md) incluye las dos variantes actuales del panel y los recibos esperados.

Mantener la mensajería real pausada hasta completar lo anterior y autorizar un ensayo real con un integrante que haya verificado su número. La decisión sobre retención y futura vinculación BSUID queda documentada, sin convertirla en ampliación aprobada. No es necesario repetir el alta de número/app/portfolio ya registrada.

## Fuentes oficiales consultadas

[Webhook, challenge y firma](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/), [sobre, campos y reentregas](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/), [mensajes y ventana](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages/), [plantillas](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/), [precios y pago](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/). Consultadas el 21-11-2026 antes de implementar los cambios. Las guías Next instaladas se revisaron; no se añadió una API de Next ni un proveedor de chat nuevo.
