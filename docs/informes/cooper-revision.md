# Auditoría independiente de Cooper

Fecha: 20-11-2026. Rama y worktree: `cooper-revision`. Base auditada: `e60ebf2`.

Se revisaron `cooper/` y sus contratos, con datos ficticios y servicios simulados. Se confirmaron y corrigieron **16 hallazgos: 4 altos, 9 medios y 3 bajos**; no se confirmó ninguno crítico. No se leyeron archivos `.env` reales, no se usaron credenciales reales, no se realizaron logins OAuth, pagos, push, merge ni despliegues. No se contactaron n8n en vivo ni D&S Factory. Los directorios iniciales sin seguimiento `docs/diseno/` y `docs/misiones/` se conservaron sin cambios.

## Hallazgos ordenados por gravedad

No se confirmó un hallazgo crítico. La gravedad indicada corresponde al comportamiento anterior a la corrección y a sus condiciones de explotación; no presupone una intrusión ocurrida.

| Gravedad | ID | Fallo y condición de reproducción | Estado y corrección | Prueba |
| --- | --- | --- | --- | --- |
| Alto | R01 | Un usuario con sesión podía crear una voz con `photoId` ajeno, compartirla y habilitar la descarga del adjunto cuyo UUID conociera, incluso una evidencia. | Corregido. Las voces rechazan fotos; descargar una foto compartida exige avatar verificado, MIME de imagen y mismo dueño del archivo. Las referencias corruptas anteriores tampoco dan acceso. | `revision-seguridad.test.ts`, creación y registro heredado. |
| Alto | R02 | `COOPER_TEST_MODE=1`, secreto configurado y Host loopback permitían una sesión de ensayo en un servidor de producción; el Host no es una frontera de confianza. | Corregido. Eliminados autenticación HMAC de ensayo y su ruta. La aplicación solo acepta Auth.js. Las pruebas emiten sesiones cifradas mediante un proceso local separado, base temporal y cuentas ficticias. | `revision-sesion.test.ts`; E2E de entrada y cierre de sesión Auth.js. |
| Alto | R04a | Una sesión revocada mientras se esperaba la sincronización recibía todavía una instantánea SSE. | Corregido. Se vuelve a comprobar sesión, identidad y rol después de la espera y antes de construir el estado. | `revision-seguridad.test.ts`, revocación durante sincronización; E2E suspende una sesión con SSE abierto y observa salida a `/entrar`. |
| Alto | R10 | Dos aprobaciones HTTP simultáneas enviaban dos operaciones externas; una sincronización anterior podía sobrescribir el avance local. | Corregido para una instancia. Operaciones HTTP serializadas por usuario, incluso entre objetos del adaptador. El segundo intento revalida la etapa antes de enviar. No equivale a idempotencia distribuida. | `revision-fabrica.test.ts`, dos aprobaciones y estado demorado; transporte ficticio, ninguna llamada real. |
| Medio | R03 | Se aceptaba HTML declarado como imagen/audio/PDF y base64 no canónico; solo se confiaba en el MIME del cliente. | Corregido. Firmas de contenedores, base64 canónico, texto UTF-8 y límites por bytes; descarga con `nosniff`, disposición de adjunto y CSP sandbox. La comprobación de firma no es antivirus ni validación audiovisual profunda. | Nueve MIME falsos, base64, límite de 5 MB y cabeceras en `revision-seguridad.test.ts`. |
| Medio | R04b | SSE admitía conexiones ilimitadas y podía acumular instantáneas para lectores lentos. | Corregido. Cuatro conexiones por usuario/proceso; cola acotada, cancelación idempotente y devolución del cupo. | Cinco conexiones, rechazo 429 y reutilización del cupo tras cancelar. |
| Medio | R05 | La CSP autorizaba cualquier script inline. | Corregido. Nonce aleatorio por respuesta, `strict-dynamic`, renderizado dinámico y sin `unsafe-inline`/`unsafe-eval` en scripts de producción. `unsafe-inline` permanece solo en estilos por la UI y las animaciones. | E2E comprueba directivas, cambio de nonce y funcionamiento de la aplicación hidratada. |
| Medio | R06 | Una transacción SQLite diferida podía leer mientras otro escritor tenía el bloqueo y fallar al escribir, sin aprovechar `busy_timeout`. | Corregido. Transacciones de identidad y fábrica con comportamiento `immediate`. | `revision-db.test.ts`, escritor en otro hilo manteniendo un bloqueo real y ocho aprobaciones concurrentes con una sola aceptada. |
| Medio | R07 | El migrador leía el diario antes de iniciar la transacción; dos arranques podían aplicar el mismo SQL. | Corregido. Lectura y aplicación bajo `BEGIN IMMEDIATE`, conservando SQL y diario de Drizzle; verificación de hashes y rollback íntegro. | `revision-migraciones.test.ts`: intercalado determinista entre conexiones, actualización con datos, repetición, SQL fallido y diario alterado. |
| Medio | R08 | EventSource no reintentaba después de un HTTP 503 que cerraba definitivamente la conexión. | Corregido. Reconexión explícita con espera exponencial (1–30 s), recuperación al volver la red y salida si la sesión pierde autorización. | E2E inyecta 503 inicial y comprueba un segundo intento y estado «En vivo». |
| Medio | R09 | El menú móvil mantenía el foco fuera del panel y permitía tabular por contenido oculto detrás. | Corregido. Foco inicial, recorrido circular, Escape, retorno al botón, fondo inerte y cierre al pasar a escritorio. | E2E a 390 px, catorce pulsaciones Tab y Escape. |
| Medio | R11 | Las lecturas API autenticadas carecían de límite de frecuencia. | Corregido. 300 lecturas/minuto, separadas de 90 escrituras/minuto, por usuario/proceso; respuesta 429 con `Retry-After`. | Lectura 301 rechazada, recuperación tras la ventana; prueba adicional de escrituras. |
| Medio | R13 | El micrófono seguía activo cuando fallaba la construcción de MediaRecorder. También podía resolverse el permiso tras desmontar el componente. | Corregido. Se detienen pistas en error y se descarta una captura tardía tras desmontaje. | E2E provoca fallo del constructor y comprueba `readyState=ended` de todas las pistas. La rama de permiso tardío se revisó en código. |
| Bajo | R12 | Una invitación fallida borraba el correo introducido. | Corregido. El formulario solo se vacía tras una operación confirmada. | E2E inyecta 503 y comprueba que el correo sigue disponible para reintentar. |
| Bajo | R14 | Durante el cambio de tema, el fondo del botón se interpolaba mientras el texto cambiaba inmediatamente; axe midió contraste 2,05:1 en la página no encontrada. | Corregido. Texto y fondo cambian simultáneamente; se mantiene la transición de movimiento. | Matriz de temas sin movimiento reducido, entrada/no encontrado/formularios. |
| Bajo | R15 | La lista de videos saltaba del título `h1` directamente a `h3`. Lighthouse detectó la jerarquía y calificó accesibilidad en 98. | Corregido. Cada video de la lista usa `h2`; dentro de la fábrica conserva `h3` bajo su sección `h2`. | `revision-encabezados.test.tsx` reproduce nivel 3 frente a 2 antes del cambio; Lighthouse final comprueba la pantalla completa. |

Todos los fallos tienen reproducción anterior a su corrección. Los errores de tipado introducidos al escribir las pruebas y los selectores que incluían HTML oculto de streaming se resolvieron como problemas del ensayo; no se presentan como vulnerabilidades del producto.

## Cobertura de autorización y privacidad

| Superficie | Comprobación |
| --- | --- |
| `/api/estado`, HTML y RSC de las pantallas | Sesión vigente; recursos filtrados por dueño, ampliados para admin; chat siempre propio; costos ausentes en respuestas de usuario. |
| `/api/orden` | Recurso verificado antes de ejecutar; contexto del dueño al actuar como admin; avatar/voz accesible y verificado. |
| `/api/chat` | Canal/video y adjuntos propios, también para admin. Consultas limitadas al espacio propio. |
| `/api/videos/:id/aprobar`, `/cambios`, DELETE videos/canales | Dueño o admin; UUID ajeno responde 404; aprobaciones limitadas a sus dos etapas. |
| POST/GET `/api/archivos`, `/api/transcribir` | Sesión, dueño, excepción explícita de foto compartida validada; transcripción solo propia. Descargas no almacenables en caché. |
| POST/PATCH/DELETE `/api/activos` | Evidencia/foto propias; compartir y borrar solo por dueño; evidencia excluida del estado. |
| PATCH `/api/perfil` | Actualización exclusivamente del usuario actual; rol ignorado; foto privada propia o URL Google permitida; WhatsApp E.164. |
| `/api/admin`, permitidos y usuarios | Rol admin comprobado en servidor; no permite desactivar al administrador. |
| `/api/eventos` | Autorización por usuario y rol en cada pulso, incluida revalidación tras I/O; ningún gasto en el contrato SSE. |
| `/api/muestra-voz` | Requiere sesión; muestra sintética general, sin datos de una persona. |
| `/api/auth/*` | Auth.js: sesión JWT cifrada, expiración, cookies y CSRF de la librería; Google exige correo verificado y lista permitida. No se ejecutó OAuth real. |
| Antigua `/api/prueba` | Sin manejador de autenticación. No concede acceso en producción, incluso configurando las antiguas variables y falsificando Host local. |

Se comprobaron JSON malformado, cuerpo de más de 8 MB, MIME no permitido, CSRF, intento de elevar rol, error interno sanitizado, nombres y texto de inyección tratados como texto, sesión ausente y recursos ajenos. No se encontraron costos en JSON, HTML/RSC, chat ni SSE de un no administrador. El endpoint de sesión Auth.js tampoco los contiene.

## UX, accesibilidad y rendimiento

La dirección visual original se conserva: estudio de producción, grafito/marfil, celeste de actividad, tono tostado para etapas completadas y equivalentes claros. Las correcciones se centran en comportamiento, privacidad y accesibilidad.

- Pantallas privadas: inicio/chat, fábrica móvil, canales, videos, detalle, avatares/voces, perfil y administración; 360, 390, 768 y 1440 px, temas oscuro y claro. Comprobaciones adicionales del inicio a 1024 y 1920 px y texto al 200%.
- Entrada con error, página no encontrada y formularios de video/avatar/voz: las mismas cuatro anchuras y dos juegos de tokens. La entrada pública no dispone de selector: su variante clara se inspecciona aplicando los tokens desde Playwright, no se afirma que sea una preferencia pública funcional.
- Axe WCAG 2/2.1/2.2 A/AA, navegación por teclado, foco, formularios, estados vacíos, errores HTTP, reconexión, grabación, consentimiento, privacidad, ambas aprobaciones, revocación y cierre de sesión. Las capturas se inspeccionaron visualmente además de comprobar overflow.
- Lighthouse mide ocho rutas en móvil y escritorio, con ambos temas en las privadas; entrada fija oscura. Mediciones de laboratorio local, no Core Web Vitals de campo ni certificación general WCAG. Resultados definitivos y artefactos se consignan abajo.

## Puerta final y evidencia

La última cadena completa terminó con código **0** sobre el código corregido, incluida la jerarquía R15:

```bash
cd cooper
npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

| Comprobación | Resultado final |
| --- | --- |
| `npm ci` | 357 paquetes instalados, 364 auditados, 0 vulnerabilidades. |
| Lint | 0 errores y 0 advertencias (`--max-warnings 0`). |
| Typecheck | TypeScript estricto, código 0. |
| Vitest | 65/65 pruebas, 8 archivos, sin omisiones. |
| Playwright | 15/15 escenarios; 100 comprobaciones de axe en la matriz ampliada más la entrada inicial; 108 capturas. |
| Build | Next.js 16.4.6, código 0; sin ruta de autenticación de ensayo. |
| Flujos v2 | 90/90 pruebas, sin omisiones, código 0. |

No hubo advertencias en la puerta final. Entorno: Node 24.22.3, npm 12.2.2, Playwright 1.65.1, Chromium 159.0.8154.6, axe 4.14.0, Lighthouse 13.6.0, Vitest 4.1.12 y TypeScript 5.9.3. Los E2E utilizan build de producción y sesiones Auth.js cifradas emitidas localmente; no un bypass de autenticación de la aplicación.

Evidencia versionada: [puerta completa](evidencias/cooper-revision/puerta-final.log), [regresión de flujos](evidencias/cooper-revision/flujos-v2-final.log) y [reproducciones anteriores a los cambios](evidencias/cooper-revision/). Capturas seleccionadas: [inicio móvil oscuro](evidencias/cooper-revision/inicio-oscuro-360.png), [inicio escritorio claro](evidencias/cooper-revision/inicio-claro-1440.png), [administración móvil](evidencias/cooper-revision/admin-claro-360.png), [biblioteca a 768 px](evidencias/cooper-revision/avatares-oscuro-768.png) y [formulario de voz](evidencias/cooper-revision/crear-voz-claro-360.png). Los 108 originales se regeneran en `cooper/test-results/visual/`.

Lighthouse final: **32/32 mediciones con 100 rendimiento / 100 accesibilidad / 100 buenas prácticas; 0 advertencias**, código 0. El ejecutor comprueba sus umbrales y falla si no se cumplen. Máximos observados: TBT 14 ms y CLS 0.0099.

| Ruta | LCP móvil, peor de ambos temas | LCP escritorio, peor de ambos temas |
| --- | --- | --- |
| `/` | 0.62 s | 0.17 s |
| `/canales` | 0.66 s | 0.17 s |
| `/videos` | 0.62 s | 0.17 s |
| `/videos/:id` | 0.62 s | 0.17 s |
| `/avatares` | 0.62 s | 0.17 s |
| `/perfil` | 0.61 s | 0.17 s |
| `/admin` | 0.64 s | 0.17 s |
| `/entrar` | 0.63 s | 0.17 s |

[Resumen numérico completo](evidencias/cooper-revision/lighthouse-resumen.json) y [salida de Lighthouse](evidencias/cooper-revision/lighthouse-final.log). Los informes HTML completos quedan en `cooper/.cache/auditoria/` y se regeneran con `node scripts/auditoria.mjs`. La primera medición de Videos dio 98 en accesibilidad; R15 se corrigió, se repitió la puerta completa y se repitieron las 32 mediciones. No se mezclan métricas anteriores y finales.

[Manifiesto SHA-256 de evidencia](evidencias/cooper-revision/SHA256SUMS.txt). Las copias de logs versionadas normalizan únicamente espacios finales y líneas vacías al final; los originales completos quedan en `cooper/.cache/revision/`.

## Commits

| Commit | Cambio |
| --- | --- |
| `79f6d08` | Retirar la autenticación de ensayo de producción y aislar las sesiones E2E |
| `d8dd9d7` | Cerrar el acceso a adjuntos ajenos y limitar archivos, lecturas y SSE |
| `05ee8df` | Serializar escrituras, migraciones y operaciones de fábrica con pruebas de concurrencia |
| `ce43ba6` | Aplicar una CSP con nonce por respuesta y renderizado dinámico |
| `9a0afe3` | Corregir recuperación, foco y grabación y ampliar la auditoría visual accesible |
| `422c3e3` | Corregir la jerarquía de títulos detectada por Lighthouse |
| `257ebde` | Documentar las garantías revisadas y automatizar Lighthouse por ruta y tema |
| `HEAD` (este informe) | Registrar hallazgos, reproducciones, métricas finales y evidencia revisable. |

## Limitaciones reales

1. OAuth Google, n8n, generación audiovisual, identidad biométrica, WhatsApp y facturación reales no se ensayaron. Los simuladores siguen identificados como tales. El contrato del puente se probó con transporte ficticio; no se inventaron ni activaron endpoints externos.
2. El mutex HTTP y los límites de solicitudes/SSE son por proceso. No se garantiza idempotencia entre réplicas ni recuperación de una operación remota aceptada si el proceso muere antes de persistir. El puente durable pertenece a la fase 2.
3. SQLite mantiene WAL, claves foráneas y espera acotada de 5 s. Un escritor bloqueado durante más tiempo puede fallar; no se promete disponibilidad ilimitada ni se mantiene un bloqueo SQL durante HTTP.
4. Firmas de archivo y sandbox reducen la exposición, pero no detectan malware ni prueban la validez completa de imágenes/audio/PDF. Continúan pendientes análisis antivirus, retención y limpieza de huérfanos.
5. Navegación automatizada en Chromium local con dispositivos/medios simulados; no sustituye Safari/iOS, Firefox, lectores de pantalla reales, cámara/micrófono físicos ni red de usuarios reales.
6. Los artefactos de ensayo usan exclusivamente datos ficticios. Se conserva evidencia resumida versionada y capturas seleccionadas; informes completos, trazas y bases temporales quedan en las carpetas ignoradas de `cooper/`.

## Pendientes de Walter

- Validar en un entorno de ensayo autorizado las credenciales/configuración Google y el puente real de fase 2; decidir cuándo se autoriza esa prueba. No bloquea esta revisión local.
- Definir retención y eliminación de adjuntos/evidencias, análisis antivirus y política de copias/restauración.
- Antes de varias réplicas o exposición pública, acordar coordinación durable, límites compartidos, proxy HTTPS y comportamiento SSE sin buffering.
- Validar con dispositivos reales y usuarios de tecnologías de asistencia los recorridos de grabación, aprobación y biblioteca.

## Fuentes oficiales y herramientas

Se consultaron las guías incluidas en `node_modules/next/dist/docs/` y documentación oficial vigente antes de modificar las APIs: [Next.js CSP](https://nextjs.org/docs/app/guides/content-security-policy), [Auth.js JWT](https://authjs.dev/reference/core/jwt), [sesiones Auth.js](https://authjs.dev/concepts/session-strategies), [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [transacciones SQLite](https://www.sqlite.org/lang_transaction.html), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md), [Drizzle](https://orm.drizzle.team/docs/transactions), [Playwright/axe](https://playwright.dev/docs/accessibility-testing), [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview) y [webhooks n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook). Se contrastó además el comportamiento con [EventSource/WHATWG](https://html.spec.whatwg.org/multipage/server-sent-events.html) y [Media Capture/W3C](https://w3c.github.io/mediacapture-main/#dom-mediastreamtrack-stop). Se usó [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) como referencia de validación.

Herramientas efectivamente usadas: filesystem/CLI, Vitest, Chromium/Playwright/axe, Lighthouse y consulta web. Se inventariaron herramientas conectadas, pero no se enviaron datos del proyecto a conectores externos, herramientas visuales o servicios de producción. No se delegó trabajo a otros agentes.
