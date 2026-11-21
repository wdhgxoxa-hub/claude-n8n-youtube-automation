# Cooper: alta de WhatsApp Business

21 de noviembre de 2026, America/Lima. Trabajo en `/home/david/Proyectos/cooper-whatsapp-alta`, rama propia `cooper-whatsapp-alta`, base `a6df1890ad8fbd736f61c3a41dc8856d07459ccb`. Autorización expresa de Walter para configurar el servicio, un único intento de mensaje a su teléfono personal y push a `version-chatgpt` y `main` del remoto `mio`.

## Resultado y límites reales

El número de Cooper está registrado en Cloud API, la app está suscrita a la WABA, el nombre cambió a **Cooper** y el servicio local utiliza el proveedor real. **WhatsApp todavía no está operativo de extremo a extremo**: Meta bloquea los mensajes iniciados por el negocio por el método de pago, no permitió crear la plantilla de autenticación y falta el webhook público con el secreto de app. No se realizaron pagos, OAuth, cambios en n8n ni acciones sobre D&S Factory.

La versión usada fue **v27.0**. El [changelog vigente de Graph API](https://developers.facebook.com/documentation/development/graph-api/changelog) la identifica como la última, publicada el 4 de noviembre de 2026; las respuestas reales también indican `facebook-api-version: v27.0`. La antigua tabla `/docs/graph-api/changelog/versions/` estaba desactualizada y aún mostraba v26.0.

## Registro, nombre y suscripción

| Dato | Resultado observado |
| --- | --- |
| Número empresarial | +51 939 484 675 |
| `phone_number_id` | `1560268253828249` |
| WABA | `1538699574836542`, Cooper Estudio |
| Portfolio empresarial | `1174776201788789` |
| App | `2333736354090891`, Cooper |
| Registro | `POST /1560268253828249/register`, HTTP 200, `success: true` |
| Plataforma / conexión / verificación SMS | `CLOUD_API` / `CONNECTED` / `VERIFIED` |
| Calidad | `UNKNOWN`: aún sin calificación; no se declara calidad verde |
| Capacidad | `throughput.level: STANDARD` |
| Límite | `whatsapp_business_manager_messaging_limit: TIER_250` |
| WABA / revisión de cuenta | `ACTIVE` / `APPROVED` |
| Verificación del negocio | `not_verified` |
| App suscrita a WABA | POST 200 y GET posterior devuelve exactamente la app indicada |

El límite corresponde al portfolio: hasta 250 destinatarios únicos fuera de la ventana de atención durante 24 horas móviles, compartidos entre sus números. Se consultó el campo actual, no el obsoleto `messaging_limit_tier`. [Límites oficiales](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits).

El PIN aleatorio de seis dígitos se generó directamente en `~/.config/cooper/whatsapp-pin` con permisos **0600**. No se versionó, imprimió ni incorporó a Cooper; solo se usó para registrar el número. La clave del usuario de sistema se consumió desde `~/.config/cooper/whatsapp-token` (**0600**) exclusivamente como Bearer en las solicitudes a Graph.

El nombre inicial era `Cooper Estudio`. Se solicitó `new_display_name: Cooper` mediante el [endpoint oficial del número](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names), HTTP 200. Meta devolvió `new_name_status: AVAILABLE_WITHOUT_REVIEW`; se aplicó mediante un segundo registro con el mismo PIN. Resultado: **`verified_name: Cooper`, `name_status: AVAILABLE_WITHOUT_REVIEW`, `new_name_status: NONE`**. No equivale a `APPROVED` ni garantiza cómo lo mostrará cada cliente de WhatsApp.

`health_status` informó bloqueo **141006** por el método de pago, limitación **141010** por negocio no verificado y ausencia de suscripción al campo `messages` del webhook de la app. Los avisos SIP 138024/138025 corresponden a llamadas, fuera del alcance; no se habilitó SIP. La suscripción WABA/app sí quedó confirmada: es distinta de configurar el callback y sus campos.

Evidencia sanitizada de solicitudes y respuestas: [meta.json](evidencias/cooper-whatsapp-alta/meta.json). No contiene cabeceras de autorización, cuerpos con PIN, tokens ni URLs de paginación.

## Cinco plantillas

Se usó el generador existente, desde `cooper/`:

```bash
node scripts/whatsapp-plantillas.mjs https://cooper.example.org .cache/whatsapp-alta/plantillas
```

El script acepta ese origen HTTPS. Se eligió el dominio reservado **`https://cooper.example.org`** como provisional parametrizable, expresamente permitido para esta misión; no es un dominio público operativo de Walter. Meta aceptó las cuatro solicitudes de utilidad con ese origen, pero esto no prueba aprobación ni funcionamiento de enlaces. Reemplazarlo y volver a revisar las plantillas antes de enviar avisos con enlaces. `AUTH_URL` se conservó para no alterar el acceso actual a Cooper.

Cada JSON se envió individualmente a `POST /1538699574836542/message_templates`. Las cinco usan idioma `es` y conservan nombres y parámetros compatibles con el emisor existente.

| Plantilla | Categoría solicitada | ID | Resultado al cierre (01:46 Lima) |
| --- | --- | --- | --- |
| `cooper_verificar_numero` | `AUTHENTICATION` | No creado | HTTP 400, código 10, subcódigo 2388185: cuenta sin permiso para crear esta plantilla |
| `cooper_aprobacion_guion` | `UTILITY` | `992053490151404` | `PENDING` |
| `cooper_aprobacion_final` | `UTILITY` | `1612777856765377` | `PENDING` |
| `cooper_video_publicado` | `UTILITY` | `1146417314918775` | `PENDING` |
| `cooper_alerta_gasto_admin` | `UTILITY` | `917118451487707` | `PENDING` |

La verificación por código conserva la categoría correcta, [AUTHENTICATION con botón COPY_CODE](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/copy-code-button-authentication-templates). No se reclasificó como utilidad para eludir el rechazo. La misma credencial creó las cuatro plantillas de utilidad; no se atribuye el rechazo de autenticación a una causa única que Meta no confirmó. La falta de verificación empresarial se constató por separado. [Creación y consulta de plantillas](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/).

## Configuración local y prueba única

Se actualizó atómicamente `~/.config/cooper/cooper.env`, manteniendo **0600** y preservando literalmente todas las líneas ajenas al alcance. Variables añadidas: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_VERIFY_TOKEN`, `COOPER_MENSAJERIA=whatsapp` y `COOPER_MENSAJERIA_PAUSA=0`. El verify token se generó con 32 bytes aleatorios. `WHATSAPP_APP_SECRET` queda sin configurar para Claude, según encargo.

Se reinició únicamente `cooper.service`. Comprobaciones del proceso vivo, sin volcar su entorno:

- Servicio `active/running`, cero reinicios automáticos.
- Variables del proveedor y los IDs coinciden; el token coincide con su archivo; verify token presente.
- `GET /api/salud`: **200**.
- Desafío GET del webhook con el verify token privado: **200** y texto idéntico al desafío.
- POST entrante sin configuración de firma: **503**, rechazo previsto mientras falte `WHATSAPP_APP_SECRET`.
- Cero contactos y cero filas de cola al activar y comprobar. No se activaron preferencias ni se fabricaron verificaciones personales.

[Evidencia del servicio](evidencias/cooper-whatsapp-alta/servicio.json). El checkout instalado conserva `a6df189`; el código de mensajería de esta misión es idéntico al instalado. Los cambios de Git son documentación y el ejemplo de variable administrativa.

**Único intento real**, a las **01:40:31 de Lima**, dirigido exclusivamente al número personal de Walter terminado en **0085**. Se usó `hello_world/en_US`, que figuraba `APPROVED`, porque la plantilla de verificación no se pudo crear. Resultado de `POST /1560268253828249/messages`: **HTTP 400, código 131058**, Meta restringe `hello_world` a sus números públicos de prueba. No hubo `wamid`, aceptación ni evidencia de entrega. No se hizo un segundo intento, ni a Walter ni a otros destinatarios. Una reserva local exclusiva previa al POST impide repetir por accidente ese ensayo. El bloqueo de pago es un diagnóstico adicional de `health_status`, no la causa devuelta por esta solicitud concreta.

## Webhook preparado

El [comando de suscripción con callback parametrizable](../cooper-whatsapp.md#comando-preparado-para-el-dominio-público) está listo para cuando exista dominio. Usa `POST /{WABA_ID}/subscribed_apps` con `override_callback_uri` y el verify token; requiere completar antes el secreto de app, publicar HTTPS y configurar `messages` en el panel. Se comprobó la sintaxis y el rechazo del dominio de ejemplo sin red. [Contrato oficial](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/override).

No se creó un túnel temporal: sin secreto de app el receptor POST no puede verificar firmas y responde 503; exponerlo ahora no completaría la recepción. La URL pública, mensajes entrantes y recibos de entrega siguen sin validación real.

## Puerta obligatoria

Ejecutada secuencialmente sobre **`938eb30e9a0109a1e0a35f6db8ec0c61a906a8d5`**, en el worktree propio:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

| Comando | rc | Duración |
| --- | --- | --- |
| `npm ci` | 0 | 4.5 s |
| `npm run lint` | 0 | 2.2 s |
| `npm run typecheck` | 0 | 3.0 s |
| `npm test` | 0 | 13.2 s |
| `npm run test:e2e` | 0 | 252.3 s |
| `npm run build` | 0 | 3.4 s |
| `node --test tests/flujos_v2.test.cjs` | 0 | 0.9 s |

**Cero errores y cero advertencias.** Instalación: cero vulnerabilidades. **227 pruebas unitarias, 33 E2E y 130 pruebas de flujos**, todas aprobadas, sin omisiones. Entorno: Node v24.22.3, npm 12.2.2. El ejecutor conservó el código real de cada comando y se habría detenido ante fallo o advertencia. [Resumen de la puerta](evidencias/cooper-whatsapp-alta/puerta.json); logs individuales en esa carpeta.

Preparación del worktree limpio: instalación y `next typegen` para generar los tipos ausentes antes de iniciar la cadena completa; se siguió la guía instalada `next/dist/docs/01-app/03-api-reference/06-cli/next.md`. No fue necesario corregir ni omitir pruebas. E2E usó datos ficticios, credenciales efímeras y servidores separados de producción. Los logs versionados solo normalizan saltos de línea, color y espacios finales; los originales permanecen en `cooper/.cache/whatsapp-alta/puerta/`.

El commit posterior solo incorpora informe y evidencias, sin modificar el código verificado. Escaneo de archivos nuevos/modificados y logs: cero patrones conocidos de secretos; no se leyeron claves reales para compararlas. Esto no constituye una garantía sobre formatos arbitrarios de secretos.

## Commits y publicación

- `938eb30`: **Cooper: preparar la suscripción segura del webhook de WhatsApp**. Añade `WHATSAPP_WABA_ID` al ejemplo y documenta el comando seguro y sus precondiciones.
- Commit documental que contiene este informe: resultado real y evidencia de la puerta, sin secretos ni cambios de ejecución.

Después de la puerta, integración por avance directo en `version-chatgpt` del repositorio principal y publicación atómica de ambas ramas en `mio` (`wdhgxoxa-hub/claude-n8n-youtube-automation`), sin force push:

```bash
git merge --ff-only cooper-whatsapp-alta
git push --atomic mio version-chatgpt:version-chatgpt version-chatgpt:main
```

El cierre comprueba que las dos referencias remotas coinciden con el commit documental de entrega. Se conservan los archivos previos sin seguimiento en `docs/diseno/`, `docs/misiones/` y `tools/codex/`. No se mueve la rama local `main` ni el checkout instalado del servicio.

## Pendientes de Walter

1. Resolver en Meta el método de pago que causa **141006**. Esta misión no añadió medios de pago ni hizo pagos.
2. Completar la verificación empresarial (`not_verified`) y resolver con Meta el permiso de la plantilla de autenticación (**10/2388185**). Volver a presentar el JSON de verificación como `AUTHENTICATION` cuando esté habilitado; no usar una categoría incorrecta.
3. Elegir y publicar el dominio HTTPS de Cooper. Regenerar las cuatro plantillas con enlaces a ese origen, gestionar su edición/revisión en Meta y alinear `AUTH_URL` cuando se migre el acceso. Esperar aprobación real y comprobar que Meta no las reclasifica.
4. **Claude:** completar `WHATSAPP_APP_SECRET`, reiniciar Cooper, configurar el callback y el campo `messages`, ejecutar el comando preparado y validar HMAC y recepción real.
5. Cuando se resuelvan los bloqueos, autorizar otro ensayo con una plantilla propia aprobada. El único intento autorizado en esta misión ya se consumió y no se programó ningún reintento.
6. Walter y cada integrante deben verificar su propio número y activar sus preferencias en Cooper. No hay contactos habilitados ni prueba de avisos reales de aprobación, publicación o gasto.
