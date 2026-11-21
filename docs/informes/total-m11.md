# M11 — aceptación automatizada multiengine (H18)

Primer registro horario: 2026-11-21 12:22 Lima. Rama/worktree `total-m11`, base `66732be0ed95f5afa2289e3b8c0ef3d798290802`. **Automatización implementada y focal PASS; puerta global ENV_BLOCKED.** No se declara aceptación global en verde ni despliegue.

## Cambios y verificación focal

- Matriz añadida a la configuración normal: Firefox/WebKit × oscuro/claro × 390/1440 px, tres recorridos por combinación (24 pruebas). Un worker, sin reintentos ni cambios de umbrales.
- Reutiliza emisor Auth.js, fábrica demo, SSE, contratos de observabilidad y generación FFmpeg de los ensayos existentes. Producto modificado únicamente tras defecto observado (grabador; ver abajo).
- Entrada protegida y foco con Tab/Shift+Tab/Enter; chat con confirmación explícita; reconexión offline/online; dos puertas manuales comprobadas durante varios pulsos; pausa persistente, movimiento reducido, overflow y axe; grabación y reproducción según capacidades nativas.
- Focal 1: 6/6 FAIL, conservado en `.cache/m11/focal-1.log`. Se detectaron errores del arnés (menú atrapaba el foco y tarjetas compartidas), captura sintética pendiente en Firefox y ausencia de MediaRecorder en WebKit Linux. Se corrige el arnés sin omitir pruebas. Firefox usa micrófono ficticio nativo; WebKit comprueba mensaje de incompatibilidad y adjunto WAV. No se declara grabación nativa donde no existe.
- Focal 2: 4 PASS / 2 FAIL, `.cache/m11/focal-2.log`. Chat/teclado/SSE/ambas aprobaciones pasan en ambos motores. Firefox produjo un OGG válido de 13.156 bytes pero Cooper lo declaró `text/plain` porque `MediaRecorder.mimeType` se vació al detenerse: servidor rechazó 415 correctamente. Corrección mínima en `grabador.tsx`: conservar MIME del Blob y extensión OGG; no cambiar validación de contenido. WebKit reporta errores al cancelar precargas RSC durante recargas; el focal siguiente espera sus respuestas antes de navegar, sin filtrar errores. Focal 3: **6/6 PASS**, rc 0, 58,4 s; `.cache/m11/focal-3.log`. OGG nativo ya sube y transcribe. WebKit pasa pausa sin errores cuando no se abortan precargas RSC al recargar.
- Versiones fijadas: Node 24.22.3, npm 12.2.2, Playwright JS 1.65.1 del lockfile; Chromium 159, Firefox y WebKit descargados por esa misma distribución.

Código implementado: commit `24a2645` — «M11: cubrir Firefox y WebKit y conservar el formato del audio grabado». Lint focal y typecheck pasan (rc 0); matriz final **24/24 PASS**, rc 0, 226,8 s, cero errores, omisiones y reintentos. [Recibo estructurado](evidencias/total-m11/matriz.json), [log](evidencias/total-m11/matriz.log) y [reporte local con 24 capturas](../../.cache/m11/matriz-report/index.html). `.cache/LISTO-PUERTA` creado a las 12:31 Lima; turno recibido a las 12:37 Lima.

Regresión Chromium: **2/2 PASS**, rc 0, 19,6 s ([log](evidencias/total-m11/focal-chromium.log)). La selección inicial solo del caso de audio falló porque depende del canal creado por el recorrido anterior; ambos casos juntos pasan, sin alterar su prueba. Implementación y focales terminados a las 12:38 Lima, dentro del máximo de 20 minutos. La puerta completa comenzó después de recibir turno.

## Matriz observada

Cada fila ejecutó entrada/teclado/chat/SSE/dos aprobaciones, pausa/reducido/axe y medios. Firefox **159.0** y WebKit **27.2**, Linux Debian 12; viewport 900 px de alto.

| Motor | Tema | Ancho | Casos | Grabación | Reproducción |
| --- | --- | ---: | --- | --- | --- |
| Firefox | oscuro | 390 | 3/3 PASS | OGG nativo ficticio | WebM/VP8 y WAV PASS |
| Firefox | oscuro | 1440 | 3/3 PASS | OGG nativo ficticio | WebM/VP8 y WAV PASS |
| Firefox | claro | 390 | 3/3 PASS | OGG nativo ficticio | WebM/VP8 y WAV PASS |
| Firefox | claro | 1440 | 3/3 PASS | OGG nativo ficticio | WebM/VP8 y WAV PASS |
| WebKit | oscuro | 390 | 3/3 PASS | NOT_SUPPORTED; aviso + adjunto WAV PASS | WebM/VP8 y WAV PASS |
| WebKit | oscuro | 1440 | 3/3 PASS | NOT_SUPPORTED; aviso + adjunto WAV PASS | WebM/VP8 y WAV PASS |
| WebKit | claro | 390 | 3/3 PASS | NOT_SUPPORTED; aviso + adjunto WAV PASS | WebM/VP8 y WAV PASS |
| WebKit | claro | 1440 | 3/3 PASS | NOT_SUPPORTED; aviso + adjunto WAV PASS | WebM/VP8 y WAV PASS |

MP4/H.264 devolvió `probably` en `canPlayType` en ambos motores, pero el focal reproduce WebM y WAV: **no se acredita decodificación MP4 multiengine**. Los 24 PASS incluyen la alternativa esperada de WebKit; no convierten su ausencia de grabación en soporte nativo. Los focales usan la CLI de Playwright con servidores aislados y puertos internos fijados; no sustituyen la puerta ni acreditan Sentinel.

## Aislamiento y recursos

Contenedor propio Podman `cooper-total-m11`, ID `eb544e2c1603d2605d4e9d1b0315bb1e386442d62314eaaaf8b867929d99e3b0`, cuota `--cpus=1`, afinidad CPU 0, un worker Playwright. PIDs de cada arranque en `.cache/m11/contenedor.txt`. Checkout aislado bajo `.cache/m11/checkout`; sin HOME, sockets ni puertos publicados. Imagen local de herramientas `localhost/cooper-ci:2f6352737366`, sin construir/publicar imágenes con fuentes privadas. Bibliotecas de motores instaladas solo dentro del contenedor. Ninguna instalación de SO host. Playwright usó un worker; Next informó 23 procesos de recopilación/generación pese a la afinidad, todos bajo la cuota de una CPU del contenedor. No se afirma que el build tuviera un solo proceso.

Contenedor detenido y eliminado al terminar; `exited false 0`, sin procesos ni puertos publicados. [PIDs de los ocho arranques](evidencias/total-m11/pids.txt) y [recibo de cierre](evidencias/total-m11/cierre.txt). Los reinicios descartaron procesos de ensayo; PID 1 era `sleep` y se terminó explícitamente con SIGKILL. No se tocó el entorno de Sentinel ni se modificó su código versionado. Los artefactos locales permanecen bajo `.cache/m11/`; no contienen credenciales reales. No se creó ninguna imagen con código privado.

## Puerta autorizada y limitación real

Turno recibido por archivo a las **12:37 Lima**, después de crear `LISTO-PUERTA`. Se ejecutó la secuencia exigida, conservando la detención ante fallo y el control de advertencias existente. Resultado de la cadena: **rc 1 / ENV_BLOCKED**. [Recibo por paso con SHA-256](evidencias/total-m11/puerta.json). Los logs versionados eliminan ANSI, retornos de carro y espacios finales; el recibo distingue hash original y archivado. Los originales se conservan en `.cache/m11/checkout/puerta-m11/`.

| Comando | Resultado | rc | Advertencias |
| --- | --- | ---: | ---: |
| `npm ci` | PASS | 0 | 0 |
| `npm run lint` | PASS | 0 | 0 |
| `npm run typecheck` | PASS | 0 | 0 |
| `npm test` | PASS, 436 pruebas / 46 archivos | 0 | 0 |
| `npm run test:e2e` | ENV_BLOCKED en preflight; suite global no ejecutada | 1 | 0 |
| `npm run build` dentro de la cadena | NOT_RUN por la detención anterior | — | — |
| `npm run build` independiente posterior | PASS | 0 | 0 |
| `node --test tests/flujos_v2.test.cjs` desde raíz | PASS, 172 pruebas | 0 | 0 |

La guardia responde «Falta Python de ensayo. Ejecute npm run preparar:pruebas o npm run ci:limpia.» ([log exacto](evidencias/total-m11/puerta-e2e.log)). El checkout aislado no tiene `.cache/sentinel-venv/bin/python`; por el límite explícito de M11 no se preparó ni cambió ese entorno. **No se saltó ni debilitó la guardia, no se borraron pruebas ni se convirtió el focal en puerta global.** El build independiente satisface su comprobación, pero no repara la cadena fallida.

El archivo de turno informa que el orquestador ya recogió `24a2645` como `470786e` y repetirá la puerta integrada con caché privada de Sentinel después de su extracción (`892d665`). Es información recibida del orquestador, no verificación de su worktree por M11. Esta misión no hizo merge, push, acceso VPS, OAuth ni despliegue. La receta ampliada `ci/Containerfile` queda versionada; el ensayo usó una imagen local de herramientas y añadió las bibliotecas en su contenedor, no una nueva imagen construida/publicada.

## Commits y entrega

- `24a2645a47fdd945e9421ebf49c6047ca42f4888`: matriz y preparación Firefox/WebKit, regresión real y corrección mínima del MIME de audio. Es el código del recibo de 24 casos y de la puerta intentada.
- Commit de documentación posterior: este informe, evidencias, README y actualización de ESTADO; sin cambios de ejecución. Consultar `git log -2` en `total-m11`.

## Documentación oficial consultada

- [Proyectos y matriz Playwright](https://playwright.dev/docs/test-projects), [navegadores](https://playwright.dev/docs/browsers), [opciones](https://playwright.dev/docs/api/class-testoptions), [Docker](https://playwright.dev/docs/docker).
- [Contexto offline](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-offline), [MediaRecorder/isTypeSupported](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static), [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination), [Blob de dataavailable](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event) y [preferencias Firefox](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-firefox-user-prefs). Guía Next instalada leída antes del cambio: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`.

## Pendientes de Walter

Se conserva B09: aceptación con Safari/iPhone y teléfono físico de gama media, micrófono/permisos reales y lector de pantalla real. Emulación de viewport, axe y WebKit Linux no sustituyen esas pruebas. La repetición de la puerta privada corresponde al orquestador; no es una autorización adicional pendiente de Walter. No se afirma Safari/iPhone ni lector real. No hay nuevos gastos, permisos OAuth o decisiones de producto solicitadas.
