# Cooper — integración final

20 de noviembre de 2026. Rama/worktree exclusivos: `cooper-final`, `/home/david/Proyectos/cooper-wt/cooper-final`. Base `72a78af` de `cooper-ensayo`, incluido el paso a vivo. Código verificado: `c05c8e3c552f870d8ccba119b94fca53ef40227b`. El commit posterior solo incorpora este informe y evidencia.

**Integración local completada; esta misión no desplegó nada.** No hubo push, merge a `main`/`version-chatgpt`, OAuth, pagos, envío real a Meta ni acceso a n8n vivo o D&S Factory. El estado vivo de la base es histórico y se conserva en [cooper-vivo.md](cooper-vivo.md); no significa que las cinco ramas nuevas estén activas allí.

## Commits y resolución de conflictos

| Orden | Commit local | Resultado |
| --- | --- | --- |
| 1 | `7a53a1f` | Fusionar `cooper-animacion` (`b784d98`): movimiento, fábrica, cara, tipografía y navegación. |
| 2 | `534fa78` | Fusionar `cooper-chat-ia` (`6b2fc55`): streaming y confirmaciones, conservando `LazyMotion`, previews privados y enlace de foto a avatar. La boca sigue los fragmentos y descansa al terminar. |
| 3 | `a112c13` | Fusionar `cooper-fase4` (`0ea769f`): verificación, avisos, cola y webhook; migración `0006_whatsapp`. |
| 4 | `0120842` | Fusionar `cooper-fase5` (`2179c6a`): contenedores, HTTPS, copias y reversión. |
| 5 | `d573dc9` | Fusionar `cooper-fase6` (`1d6ce51`): noticias, puente Codex, respaldo y migración `0007_noticias`; adaptar noticias a las herramientas/confirmaciones del chat nuevo. |
| 6 | `7389324` | Pasar a Compose las variables de chat, WhatsApp y texto privado; comprobar el entorno efectivo sin arrancar servicios. |
| 7 | `b4783fb` | Corregir `languages[]` en GPT Transcribe según el contrato oficial actual. |
| 8 | `be36acd` | Auditoría de nuevos estados, foco de historial, adjunto legible en móvil y captura final reproducible. |
| 9 | `c05c8e3` | Actualizar guías, compatibilidad de migraciones y selección explícita de imagen para ensayo VPS. |

Se leyeron los cinco informes antes de fusionar. Git confirma que base y cinco ramas son ancestros de HEAD. SQL final: `0000_inicio` → `0001_presentadores` → `0002_puente` → `0003_medios_reales` → `0004_presentacion` → `0005_chat_ia` → `0006_whatsapp` → `0007_noticias`. Se conservan SQL y huellas de la base vivo; no se reescribe su diario. Bases experimentales independientes con `0005_whatsapp` o `0005_noticias` se rechazan: requieren respaldo y migración específica de datos, no renombrar filas para forzar compatibilidad.

Los informes inicialmente sin seguimiento coincidían byte por byte con los de las ramas y ahora quedan versionados por las fusiones. Se conserva sin modificar el cambio preexistente en `docs/informes/cooper-ensayo.md` y el directorio no versionado `docs/misiones/`. Ese cambio local de ensayo contiene el correo histórico sin punto; la base viva y las instrucciones operativas finales usan el correo confirmado **`wdhg.xoxa@gmail.com`**. `docs/diseno/` no existía en este worktree: se leyeron sus dos documentos disponibles en el worktree de animación, sin escribir allí.

## Puerta obligatoria

Ejecución completa sobre el código indicado, con `pipefail`, sin omitir pruebas ni ocultar advertencias:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

| Comprobación | Resultado final |
| --- | --- |
| `npm ci` | rc 0; instalación limpia, 0 vulnerabilidades informadas. |
| `npm run lint` | rc 0; `--max-warnings 0`, 0 errores/advertencias. |
| `npm run typecheck` | rc 0. |
| `npm test` | rc 0; **216/216**, 22 archivos. |
| `npm run test:e2e` | rc 0; **32/32**, sin omitidos. |
| `npm run build` | rc 0; producción Next 16.4.6. |
| `node --test tests/flujos_v2.test.cjs` | rc 0; **129/129**, sin omitidos. |

La puerta final tiene **0 errores y 0 advertencias**. [Log íntegro de la puerta](evidencias/cooper-final/puerta-final.log) y [log de flujos](evidencias/cooper-final/flujos-final.log). En las copias versionadas solo se normalizan retornos de terminal y espacios finales; no se eliminan diagnósticos.

Verificaciones adicionales, todas rc 0:

- `node --test tests/puente-codex.test.mjs tests/migrar_dueno.test.mjs`: **18/18** ([log](evidencias/cooper-final/servicios-final.log)).
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s deploy/tests -p 'test_*.py'`: **15/15** ([log](evidencias/cooper-final/copias-final.log)).
- `shellcheck deploy/*.sh`; generación de los 30 workflows sin diferencia respecto a Git; `git diff --check`; ancestros de las seis ramas comprobados.
- Construcción Podman rootless de `localhost/cooper:final-c05c8e3`, ID `b5573131284f7c6128f7b9aaca59678ef5a296cf5fcd2e106c11518f36f5c0d2` ([log](evidencias/cooper-final/build-imagen-final.log)).
- `COOPER_VPS_TEST_IMAGE=localhost/cooper:final-c05c8e3 PYTHONDONTWRITEBYTECODE=1 node deploy/tests/compose.mjs`: **7 bloques PASS** ([log](evidencias/cooper-final/compose-final.log)). TLS con CA local, cookie Secure ficticia, editor privado, runner externo n8n 2.47.4 con HMAC real, progreso SSE/reconexiones, rechazo de firma inválida, restic cifrado/retención/restauración, exportación/importación y actualización/reversión de imagen y datos. Servicios efímeros propios y red interna, sin proveedores ni datos reales.


La primera puerta detectó un test visual heredado que buscaba una respuesta ya finalizada. Se preservó el contrato de streaming y se espaciaron los frames reales únicamente en ese ensayo; no se alargó artificialmente el estado del producto. La descarga inicial de Chromium informó del binario Ubuntu compatible con CachyOS. La puerta final reutiliza el navegador instalado y no emite ese aviso. Logs iniciales y reproducciones permanecen en `cooper/.cache/final/`.

## Auditoría cruzada de las funciones integradas

Las reproducciones fallidas y sus correcciones quedan en [evidencias](evidencias/cooper-final/): `noticias-*.log`, `compose-config-*.log`, `transcripcion-*.log`, `e2e-integracion.log` y `e2e-accesibilidad-verde.log`.

Se aplicaron los cinco criterios de [cooper-revision](../misiones/cooper-revision.md) al conjunto integrado. Es una revisión técnica en esta misión, no una aprobación independiente de otra persona.

| Gravedad | Hallazgo | Estado y evidencia |
| --- | --- | --- |
| Alta | Las acciones de noticias usaban la interfaz antigua del chat; podían perder la modalidad tras fusionar. | Corregido. Regresión roja/verde en `noticias.test.ts`: activar/desactivar sin ejecutar hasta confirmar, tarjeta ajena rechazada, modalidad congelada y noticia detenida sin fuentes. |
| Alta | Compose no transmitía las variables nuevas de chat, Meta y puente de texto; configurar el archivo del operador no activaría esas funciones. | Corregido. `test_integracion.py` falla antes y pasa después con la configuración JSON efectiva de Docker Compose y valores ficticios. Claves de chat/Meta excluidas del runner. |
| Media | GPT Transcribe enviaba el campo de idioma antiguo. | Corregido. Transporte simulado rojo/verde: `languages[]=es`, ausencia de `language`, archivo multipart y texto editable. |
| Media | Conversación larga sin enlaces no era accesible por teclado en todos los navegadores. | Corregido. Axe reprodujo `scrollable-region-focusable` a 360 px; foco explícito, tecla Inicio, axe y matriz nueva pasan. |
| Baja | Sondeo visual podía perder un estado «hablando» de pocos milisegundos al acabar una frase. | Corregido en el ensayo de animación mediante frames observables; se mantienen las pruebas de reposo al finalizar, pausa y movimiento reducido. |
| Baja | El enlace añadido para avatar comprimía el nombre de la foto en móvil. | Corregido con columnas para miniatura, nombre/acción y retirada; capturas y control de desbordamiento. |

No se detectaron hallazgos críticos abiertos en el alcance revisado. La evidencia no certifica ausencia universal de defectos.

- **Seguridad y privacidad:** sesiones Auth.js, revocación durante streaming, permisos por recurso en chat/confirmaciones/fotos/adjuntos/SSE, costos ausentes de HTML/JSON de usuarios normales, herramienta de gasto solo admin. Webhook Meta sobre bytes firmados, contexto/revisión y deduplicación; OTP y enlaces vencidos/ajenos, cambios de número y baja. Salud pública solo devuelve booleano. Límites de cuerpo, MIME, frecuencia y stream; salida de red unitaria bloqueada salvo mocks explícitos. El emisor de pruebas sigue fuera de `src` y de la imagen final.
- **Robustez:** reserva de chat en SQLite, consumo único de tarjetas y resultados inciertos sin reenvío automático; transacciones de cola, reintentos acotados y conciliación. Migraciones serializadas, preservación de datos y rechazo de diario alterado; SSE con reconexión y liberación de cupos. Noticias rechazan fuentes insuficientes, huellas cambiadas, medios ajenos y certificados caducados. Fallback de texto no convierte una búsqueda fallida en evidencia.
- **Operación:** imagen no root, salud SQLite, editor privado, TLS verificado con CA local, firma real en runner n8n aislado, copia/restauración, importación y reversión. El entorno era ficticio y sin salida a proveedores.
- **UX:** todas las pantallas principales y formularios, temas, teclado y anchuras 360/390/768/1440; retícula adicional 1024/1920. Casos nuevos de chat, noticias y WhatsApp pasan axe en cuatro anchuras y ambos temas. Lighthouse y revisión de capturas se detallan abajo.

## Capturas y rendimiento

Se generaron y revisaron visualmente **130 PNG** en [`cooper/.cache/capturas-final2/`](../../cooper/.cache/capturas-final2/). La matriz obligatoria contiene **104**: 26 pantallas/estados × 1440/390 px × claro/oscuro. Otras 26 capturas cubren barra lateral, páginas largas, poca altura y revocación de presentación. [Manifiesto completo con dimensiones y SHA-256](evidencias/cooper-final/capturas-manifest.json). Los PNG permanecen en la caché local solicitada; las huellas sí están versionadas.

Incluye inicio/chat, fábrica, canales, biblioteca y detalle de videos, ambas aprobaciones, publicado, pedir video, avatares/voces y sus formularios, perfil, administración, entrada/error, no encontrado; además confirmación de noticia en chat, noticia pausada, canal en modo noticia, foto adjunta, paso de foto a avatar, código/preferencias WhatsApp y enlace vencido. Las pruebas recorren también 360 y 768 px con axe, teclado y comprobación de desbordamiento. Los estados transitorios nuevos alternan los tokens de tema sin recargar para conservar foto/código; la matriz base comprueba temas persistidos. Las capturas solo contienen usuarios y material ficticios.

Lighthouse completó **32 mediciones de la matriz**: siete rutas privadas y entrada, móvil/escritorio, ambos temas (la entrada pública conserva oscuro y se repite). **Rendimiento 100, accesibilidad 100 y buenas prácticas 100 en todas**, cero advertencias y cero comprobaciones binarias fallidas. Máximos observados: LCP **645 ms**, bloqueo total **59 ms**, CLS **0**. Son mediciones de laboratorio local, no métricas de usuarios reales.

La ejecución `cd cooper && node scripts/auditoria.mjs` recibió SIGTERM después de 30 mediciones (rc 143). Se conserva ese hecho en [el resumen](evidencias/cooper-final/lighthouse-resumen.json) y [su log](evidencias/cooper-final/lighthouse-final.log). Las dos pendientes —administración/entrada, claro, escritorio— se completaron con rc 0 usando una copia del mismo medidor, cambiando únicamente selección de rutas/tema/dispositivo y salida: `node .cache/final/auditoria-complemento.mjs` ([copia](evidencias/cooper-final/auditoria-complemento.mjs), [log](evidencias/cooper-final/lighthouse-complemento.log)). La comprobación conjunta de cobertura y umbrales dio rc 0; no se presenta la ejecución interrumpida como exitosa.

Movimiento: **60,00 fps** locales con CPU normal y ralentización ×4, percentil 95 de **16,7/16,8 ms**, CLS **0**; animaciones medidas limitadas a `transform`/`opacity`. [Datos](evidencias/cooper-final/fluidez.json). Esto mide `requestAnimationFrame` de Chromium headless, sin certificar fluidez en teléfonos físicos. Pausa global y movimiento reducido pasan los E2E.

[Resumen de resultados](evidencias/cooper-final/resultados.json) y [huellas de los archivos de evidencia](evidencias/cooper-final/SHA256SUMS).

## Estado funcional y lo que sigue simulado

| Función | Estado real de esta entrega |
| --- | --- |
| Animación y UI | Funcionan localmente; preferencia de movimiento reducido y pausa. Boca basada en texto, sin fonemas/audio de respuesta. |
| Chat | Claude Messages y OpenAI Responses implementados; herramientas, memoria acotada, fotos y confirmaciones verificadas con transportes ficticios. Demo/E2E fuerzan simulación. No se midió calidad, cuota ni latencia de modelos reales. |
| Audio | Transcripción OpenAI/Gemini implementada; prueba de grabación con dispositivo ficticio y transcripción editable. No se envió audio real a proveedores. |
| Fábrica y medios | Puente de la base conserva su paso a vivo histórico. Nuevas funciones no desplegadas. Ensayo VPS verifica progreso firmado, no producción audiovisual. Presentadores, voces y vista previa siguen simulados en demo; adaptadores reales requieren credenciales y prueba pagada autorizada. Identidad real requiere revisión humana, no biometría automática. |
| WhatsApp | Cloud API, OTP, preferencias, cola, firmas y plantillas implementados. Transporte simulado por defecto; número, cuenta, dominio, plantillas y entregas reales pendientes. |
| VPS | Imagen y Compose ensayados localmente, con copia cifrada y reversión. Ubuntu real, firewall/SSH/timer, DNS público, ACME, OAuth y copia SFTP remota no ensayados aquí. |
| Noticias | Activación por canal/chat y barreras de fuentes/huellas implementadas. Simulador se detiene en Verificación. Sin noticia real, generación ni publicación ensayadas. |
| Codex | Servicio HTTP probado con ejecutable ficticio. No se usó la sesión ChatGPT de Walter. Compose pasa las variables pero no instala el servicio ni su sesión/túnel. Requiere loopback compartido con n8n o túnel privado en ese espacio de red. |

Persisten límites documentados: una instancia SQLite y límites por proceso; sin antivirus/purga automática de adjuntos; sin alta disponibilidad; memoria de chat de 30 mensajes y fotografías acotadas; reservas/acciones ambiguas requieren conciliación. El costo/ahorro de tareas es estimado y no incluye factura del plan ni intentos incompletos. Los avisos diarios de gasto usan UTC. Las noticias caducan al cambiar el día de Lima o superar 24 horas; no garantizan veracidad ni publicación «en horas». Los backups no revierten efectos externos.

## Pendientes de Walter — pasos manuales en orden

Ninguno de estos pasos se ejecutó contra producción durante esta misión. No copiar valores al repositorio, informe o conversación.

1. **Elegir destino y corte.** Confirmar VPS Ubuntu 24.04 dedicado, región, IP, dominio y operador con llave SSH/consola de rescate. La guía parte de 4 vCPU/8 GB/100 GB, pendiente de medir carga y espacio real. Elegir destino de copias fuera del VPS, custodia offline, retención, alerta de fallos y ventana de mantenimiento.
2. **DNS.** Crear A de `cooper.<dominio>` y `flujos.<dominio>` hacia la IP; AAAA solo con IPv6 probado. Abrir 80/443 y SSH del operador; 8443 permanece loopback. Preparar correo ACME y comprobar resolución pública. No activar origen y destino a la vez.
3. **Preparar host de ensayo primero.** Llevar el checkout revisado a `/opt/cooper`, sin datos/cachés/secretos. Como operador root del VPS ejecutar `COOPER_SSH_USER=operador COOPER_SSH_PORT=22 /opt/cooper/deploy/instalar.sh --preparar`. Comprobar acceso por una segunda sesión antes del corte. No ejecutar este instalador en la PC actual.
4. **Entorno privado del VPS.** Completar `/etc/cooper/.env` root/0600 desde `deploy/.env.example`: `COOPER_DOMAIN`, `N8N_DOMAIN`, `COOPER_ORIGIN=https://cooper.<dominio>`, `N8N_EDITOR_ORIGIN=https://flujos.<dominio>:8443`, `CADDY_TLS`, `COOPER_IMAGE`, `DATA_ROOT`, `STATE_ROOT`; `COOPER_ADMIN_EMAIL=wdhg.xoxa@gmail.com`. Custodiar `AUTH_SECRET`, `COOPER_N8N_TOKEN`, `COOPER_WEBHOOK_SECRET`, `N8N_RUNNERS_AUTH_TOKEN` distintos; **conservar la clave original `N8N_ENCRYPTION_KEY`** al migrar. Configurar `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` con callback `https://cooper.<dominio>/api/auth/callback/google`; el login Google lo hace Walter manualmente.
5. **Copias e imagen.** Configurar `RESTIC_REPOSITORY`, `RESTIC_PASSWORD_FILE`, llave SSH y `known_hosts`. Inicializar solo un repositorio nuevo con `python3 /opt/cooper/deploy/operar.py iniciar-repositorio`. Construir desde el commit revisado: `docker build -f deploy/Containerfile -t localhost/cooper:COMMIT_COMPLETO .`; fijar esa etiqueta/digest en `COOPER_IMAGE`.
6. **Migrar datos sin doble escritura.** Inventariar esperas/cron/webhooks, cerrar entradas, drenar y detener origen. Exportar los volúmenes offline con `deploy/migrar-desde-pc.sh exportar --origen RUTA_PRIVADA --origen-detenido` usando `COOPER_ENV_FILE` privado. En VPS vacío: `deploy/migrar-desde-pc.sh importar ID_DEL_SNAPSHOT`. Verificar hashes, tablas, adjuntos y la clave n8n conservada. Detalles de reversión en [cooper-vps.md](../cooper-vps.md).
7. **Columnas y workflows nuevos.** Con respaldo y entradas cerradas, provisionar `N8N_URL`, `N8N_API_KEY` y directorio de reversión por canal privado. Ejecutar `node tools/migrar_dueno.mjs --url "$N8N_URL" --admin wdhg.xoxa@gmail.com --simular`; revisar columnas/filas; aplicar con `node tools/migrar_dueno.mjs --url "$N8N_URL" --admin wdhg.xoxa@gmail.com --aplicar --respaldo RUTA_PRIVADA/diario.json` y repetir `--simular` hasta cero pendientes. **No repetir `--asignar-todo-al-admin`** sobre datos actuales. Importar/revisar los workflows generados por el procedimiento del puente, conservando Ajustes/credenciales y sin activar cron/pagos/publicación todavía. Revisar especialmente `FabTextoGPT0001` y `FabNoticia000001`. No renombrar diarios SQLite experimentales.
8. **Arranque y aceptación básica.** `python3 /opt/cooper/deploy/operar.py validar`, después `/opt/cooper/deploy/instalar.sh --iniciar`. Validar HTTPS, editor por túnel, login permitido, dos dueños aislados, SSE, firma de callback, descarga autorizada, ambas aprobaciones y copia/restauración. Medir RTO/RPO y comprobar `cooper-backup.timer`. Conservar PC detenida y snapshot para reversión.
9. **Anthropic y respaldo.** Crear/provisionar `ANTHROPIC_API_KEY` de la cuenta API autorizada, comprobar acceso a `COOPER_CHAT_MODELO_CLAUDE=claude-sonnet-5-5` y elegir `COOPER_CHAT=claude`. Configurar `OPENAI_API_KEY` y `COOPER_CHAT_MODELO_OPENAI=gpt-6.1-sol` si se autoriza el respaldo; elegir `COOPER_TRANSCRIPCION=openai` para `gpt-transcribe` o el proveedor acordado. No sustituir estas claves por cookies/sesiones de Claude. Acordar tratamiento/retención de historial y fotos; autorizar consumo y repetir las 30 conversaciones con modelos reales. Reiniciar Cooper para aplicar variables. Demo permanece simulada.
10. **Meta y número de Cooper.** Crear/seleccionar negocio, aplicación, WABA y número dedicado; completar verificación y registro Cloud API, custodiar PIN. Dar al usuario de sistema permisos de mensajería/gestión necesarios. Configurar solo en servidor `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`. En Compose, `AUTH_URL` se deriva de `COOPER_ORIGIN`.
11. **Plantillas y callback de Meta.** Desde `cooper/`: `node scripts/whatsapp-plantillas.mjs https://cooper.<dominio> RUTA_NUEVA_DE_SALIDA`. Subir y obtener aprobación en español de `cooper_verificar_numero`, `cooper_aprobacion_guion`, `cooper_aprobacion_final`, `cooper_video_publicado`, `cooper_alerta_gasto_admin`. Configurar `https://cooper.<dominio>/api/whatsapp/webhook`, verificar desafío con el valor privado y suscribir `messages`/la aplicación a WABA según [la guía](../cooper-whatsapp.md). Confirmar facturación y autorizar un ensayo real. Seleccionar `COOPER_MENSAJERIA=whatsapp`, `COOPER_MENSAJERIA_PAUSA=0`, reiniciar y **volver a verificar cada número**: la verificación simulada no vale para envío real. Probar aprobación, cambios, baja, recibos y enlace vencido con destinatarios consentidos.
12. **Codex y noticias.** Preparar usuario/perfil exclusivo con sesión ChatGPT de Walter, sin archivos privados ni conectores. Instalar/validar CLI y arrancar `node servicios/puente-codex/server.mjs` con `PUENTE_CODEX_TOKEN` privado. Resolver el loopback del contenedor n8n mediante espacio de red compartido o túnel dedicado; **esta topología sigue pendiente y no viene instalada en Compose**. Configurar URL/token iguales en n8n/runner y servicio, nunca publicar 8789. Probar éxito, búsqueda con URLs, timeout/cuota/fallo, y detención segura. Si se autoriza API, asociar credencial OpenAI de n8n, modelo/tarifas y `allowTextoApi`; elegir `allowRadar` y canales. Ensayar una noticia real con revisión editorial, mapas/cifras y ambos controles humanos antes de habilitar producción.
13. **Medios y publicación.** Elegir recursos reales HeyGen/Gemini/ElevenLabs, asociar credenciales del flujo, revisar identidad/consentimiento y autorizar ensayo audiovisual pagado por separado. Conciliar acciones `inciertas`/`revisar` antes de repetir. Reabrir entradas/cron/publicación solo tras la aceptación operativa de Walter.

## Fuentes oficiales y alcance de herramientas

Se contrastaron antes de las correcciones: [Messages de Claude y versión actual](https://platform.claude.com/docs/en/api/messages/create), [transcripción OpenAI y `languages[]`](https://developers.openai.com/api/docs/guides/speech-to-text), [Responses](https://developers.openai.com/api/reference/resources/responses/methods/create/), [CLI Codex](https://learn.chatgpt.com/docs/cli/reference), [Messages Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api), [entorno Compose](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/), [runners n8n](https://docs.n8n.io/hosting/configuration/task-runners/), [LazyMotion](https://motion.dev/docs/react-lazy-motion), [efectos React](https://react.dev/reference/react/useEffect), [aserciones Playwright](https://playwright.dev/docs/test-assertions) y [accesibilidad de regiones desplazables](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow#accessibility). También se leyó la guía local de Next 16.4.6 para componentes cliente.

Herramientas comprobadas: Git/CLI/filesystem del worktree, documentación pública, Playwright/Chromium, axe, Lighthouse, Docker Compose de configuración y Podman rootless de ensayo. Se aplicaron `ecosistema-constructor` (con la integración local explícitamente autorizada por esta misión) y OpenAI Docs. No se enviaron mensajes a terceros ni se usaron conectores de servicios vivos.
