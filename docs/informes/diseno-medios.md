# Misión diseno-medios

21-11-2026, cierre local 23:08 (Lima). Rama y worktree propios `diseno-medios`, base `53e001f`. Implementación local para revisión de Claude; no se hizo push, merge, despliegue ni escritura en el VPS/n8n. Los archivos de instrucciones que ya estaban sin registrar se preservaron.

## Resultado y alcance

Se implementó el soporte tipado de medios para los videos de fábrica y sus publicaciones. Cuando existe una fuente admitida y recuperable, sirve póster real, tinte calculado en servidor y dimensiones con procedencia explícita; si hay MP4, también genera la vista previa silenciosa. Esto no afirma disponibilidad universal: cinco piezas aún carecen de render/miniatura y TikTok depende de la respuesta oficial. La caché es privada, persistente y distinta por video/publicación. La interfaz consume esos datos en fábrica, listas, Publicados y detalle, conservando el armazón de la rama base.

Se aplicó la dirección «el contenido da la luz y el color»: imagen completa con `object-fit: contain`, sin montañas ni recorte del video vertical; el color procede del medio. Solo una pieza sin fuente real usa la cartela tipográfica del título y tinte estable del canal. Un medio en preparación o una descarga fallida muestran una caja neutra reservada, sin inventar contenido. La maqueta animada ya no suplanta el reproductor del detalle.

**La aceptación global de la sección 5 no se presupone.** Esta tarea prohíbe cambiar el armazón visual; la base aún conserva su navegación, tipografías, colores, radios y ambos temas anteriores. La prueba de tokens del sistema completo permanece estricta y registra esas diferencias. No se han corregido silenciosamente cambiando el alcance ni relajando sus umbrales.

## Implementación

- Migración aditiva `0019_video_medios`, de 14 a 15 entradas, sin descarga durante la migración. Conserva videos y observabilidad; reaplicación idempotente, restricciones de tamaño/duración y borrado de derivados en cascada al borrar el video.
- `GET /api/videos/:id/medios`, selector opcional `publicacion`, assets autenticados `/poster` y `/preview`. Valida sesión y propietario/administrador antes de bytes y antes de responder 304. JSON privado sin caché compartida; assets con ETag y revalidación privada.
- Fuentes: copia vigente de montaje en SQLite, render Creatomate y bucket B2 histórico comprobado; miniaturas oficiales del puente o de oEmbed público. YouTube valida ID y CDN. TikTok utiliza `thumbnail_url` solo cuando el servicio oficial lo devuelve. No se descarga el video de las plataformas.
- FFmpeg/FFprobe trabajan sobre un temporal privado, sin protocolos de red. MP4 original máximo 50 MiB; preview H.264 de cinco segundos, 12 fps, máximo 640 px y **≤600.000 bytes**, sin audio, capítulos, subtítulos ni metadatos. Las fuentes cortas se repiten. Una imagen/clip de escena permitido puede representar una pieza aún sin montaje y se declara como `escena`.
- Sharp normaliza el póster a WebP y calcula el dominante. Tinte persistido en HSL: saturación ≤45 %, luminosidad 45–60 %. Dimensiones separadas del póster; `origenDimensiones` distingue `video`, `poster` y `reserva`. Una miniatura YouTube 480×360 no demuestra el aspecto del video.
- Dos trabajos simultáneos y dieciséis en espera por proceso, deduplicación y reserva SQLite recuperable de cinco minutos. Se descarta el resultado si cambia la revisión. Refresco de 24 horas; backoff de fallos; una revisión vigente conserva sus bytes durante el refresco y si este falla.
- Proyecciones SSR/SSE por lote, sin blobs ni escrituras por tarjeta. Carga diferida al acercarse al viewport; la proporción inicial queda reservada durante la visita para impedir saltos. Preview tras 180 ms, fundido de 240 ms, silencioso; en móvil se activa al entrar suficientemente en vista. Se detiene al salir, ocultar pestaña, pausar o pedir movimiento reducido.
- Sondeo de trabajos pendientes con backoff, deadline de cinco minutos y suspensión fuera del viewport. Portadas tipográficas pequeñas con texto HTML de 12 px; el SVG de servidor se conserva para la presentación protagonista.

Contrato, límites, migración y precarga manual de una copia en `.cache`: [guía operativa](../cooper-video-medios.md). No se añadieron secretos, proveedores de pago ni variables de entorno. El transporte, autorización y almacenamiento existentes se reutilizan.

## Diagnóstico y prueba con medios existentes

El [diagnóstico detallado](diseno-medios-diagnostico.md) conserva consultas de solo lectura y evidencia saneada. Hallazgo: cinco videos de fábrica, sin `render_url` ni `miniatura_url`; cuatro referencias en la tabla de publicaciones a **dos MP4 únicos en Backblaze B2**, ambos accesibles. Cooper no guardaba copias de montaje ni miniaturas. Dos publicados de YouTube sí ofrecen miniatura oficial por oEmbed, verificada sin OAuth.

Se descargó únicamente el MP4 menor a una caché local ignorada. El código real produjo desde 1080×1920 un póster WebP 900×1600 de 36.778 bytes y una preview **360×640, 5,000 s, 336.834 bytes, sin audio**. FFprobe confirma un único stream de video y cero avisos después de retirar capítulos heredados. Esto prueba el procesamiento de un medio existente; no acredita todavía su ejecución en el VPS. El original no se versiona.

El puente offline ahora conserva `url_video` de cada publicación y la miniatura oficial histórica de YouTube, en lugar de reemplazarla por una miniatura de fábrica. Los cinco workflows afectados se regeneraron offline. **Ese delta no se aplicó en n8n vivo.** Su aplicación revisada es necesaria para que el nuevo backend reciba los MP4 históricos en producción.

## Herramientas y trabajo paralelo

Se leyó íntegramente `DIRECCION.md` y las guías obligatorias. La skill `elite-web-architect` se encontró en la instalación local de Claude y se aplicó: [SKILL.md](/home/david/.claude/skills/synced/309a9d77-c195-4391-95c2-4c9e753a4536_5dd4a605-aa66-4ec5-8099-35023117c538/elite-web-architect/SKILL.md). Tres subagentes ejecutaron backend, diagnóstico/adaptador e interfaz; la raíz revisó sus contratos y centralizó validación y cierre. La revisión cruzada detectó B2 ausente, capítulos heredados, vencimiento de caché, sondeo demasiado corto y texto ilegible de miniaturas; se corrigieron antes de la puerta.

Shadcn UI y Context7 no aparecieron en el inventario de herramientas. No se inventaron llamadas ni se instalaron servicios. Se usaron CLI/Git, Playwright/axe/Lighthouse, documentación oficial y SSH existente únicamente para diagnóstico de lectura. La instalación de prueba corre en Debian aislado, con versiones fijadas y sin `.env` reales; el anfitrión CachyOS no se presenta como plataforma certificada por la puerta.

## Validación

La puerta común se ejecuta desde un archivo limpio de `854a039`, en la imagen Debian local `f3f8a618672568027d79b05735c54fc9aebeffc5c97e1860b3a7389b9f1d5e03`. Node 24.22.3, npm 12.2.2, Python 3.14.7, uv 0.12.24 y Sentinel original `6764bbd…` verificados. `node scripts/puerta.mjs` ejecuta los comandos obligatorios y comprueba además advertencias, omisiones y reintentos. **PASS: 485 unitarias, 108 E2E y 237 flujos; instalación, preparación, lint, tipos y build también RC 0. Cero errores, advertencias, omisiones y reintentos.** Ejecución del 21-11-2026, 22:49:24–23:06:13 Lima. [Recibo completo por paso](evidencias/diseno-medios/puerta-comun.json), [estadísticas y hashes](evidencias/diseno-medios/puerta-reportes.json). La matriz y Lighthouse corresponden a `9f3a910`; el producto es idéntico en ambos cortes, con diferencia exclusiva de documentación y selector E2E ([equivalencia](evidencias/diseno-medios/equivalencia-cortes.json)).

| Verificación final de diseño/medios | Resultado y evidencia |
| --- | --- |
| Cinco E2E de medios, repetidos dentro de la puerta completa | 5/5 PASS: lazy, hover, mute, pausa, movimiento reducido, reserva, publicación específica y derivado lento. |
| Fluidez y reserva de espacio | **60,003 fps**, p95 16,7 ms, máximo 16,8 ms y **CLS 0** a [390 con CPU 4×](evidencias/diseno-medios/medios-fluidez-390.json) y [1440](evidencias/diseno-medios/medios-fluidez-1440.json), 181 muestras por ensayo. Archivo sintético, no teléfono físico. |
| Derivado real B2 en móvil/escritorio | 2/2 PASS; [390](evidencias/diseno-medios/medios-reales-recorrido-390.json) y [1440](evidencias/diseno-medios/medios-reales-recorrido-1440.json). Cero consola y solicitudes externas. |
| Seis anchuras × 33 pantallas/estados | 198 PNG, axe 0 serias/críticas y 0 desbordamientos. [Resumen verificable](evidencias/diseno-medios/matriz-final-resumen.json). |
| Matriz estricta de la sección 5 | **FAIL, siete pruebas**: seis por el 404 de consola durante el recorrido de errores y una por tokens del armazón. 30.369 detecciones repetidas, no defectos únicos; 1.592 de texto 9/10/11 px. |
| Lighthouse móvil, tema oscuro | Inicio **93**, Publicados **92**; accesibilidad y buenas prácticas **100**, CLS 0 y cero avisos. Cumple ≥90/100 de DIRECCION. El ejecutor `--rendimiento` exige ≥95 y devolvió **RC 1**, conservado sin modificarlo. [Mediciones](evidencias/diseno-medios/lighthouse-final.json), [criterios](evidencias/diseno-medios/lighthouse-criterios.json). |
| Revisión humana | 198/198 capturas iniciales revisadas y **198/198 PNG finales revisados otra vez**, repartidos en 66 móvil + 66 tablet + 66 escritorio. Los informes detallan originales, hojas de contacto, tramos de páginas largas y hashes. [Móvil](evidencias/diseno-medios/revision-visual-movil.md), [tablet](evidencias/diseno-medios/revision-visual-tablet.md), [escritorio](evidencias/diseno-medios/revision-visual-escritorio.md). |

Los siete fallos de la matriz permanecen visibles. El 404 es una respuesta HTTP del recorrido que incluye `/inexistente`, sin atribución de URL en la lista agregada; el trace local permite revisar la navegación. No se declara consola cero de toda la matriz. Los recorridos focales y reales sí la exigen y la cumplen.

El recorrido real usa el póster y extracto derivados del MP4 existente con datos de interfaz ficticios. Su detalle reproduce **el extracto de cinco segundos**, no el original completo. La pausa de pestaña se ensaya con `document.hidden`/`visibilitychange` simulados porque el motor headless conserva ambas pestañas visibles; esta limitación queda escrita en los recibos.

Se corrigieron fallos encontrados durante la primera puerta y revisiones: contraste de cartela, etiqueta mientras el medio estaba pendiente, primera reproducción antes de asignar `src`, aislamiento del fixture de Publicados, URLs absolutas resueltas por Next y selector del detalle visible. Una segunda puerta detectó la misma ambigüedad en el resumen de voz retenido tras navegar; se delimitó la aserción al detalle visible y se repitió el ciclo completo. La selección parcial adicional confirmó el caso de identidad reparado; el caso de avatar seleccionado junto a él falló antes de la aserción por depender de un canal creado previamente por la suite, por lo que ese focal parcial no se presenta como aprobado (`.cache/diseno-medios-focal-identidad-parcial/`). Después, la inspección visual descubrió colisión de insignias y títulos pequeños recortados; se corrigieron y recapturaron, junto con un aviso engañoso de disponibilidad. Los [intentos no aceptados](evidencias/diseno-medios/intentos-no-aceptados.json) se conservan en `.cache/diseno-medios-intento-1/`, `.cache/diseno-medios-intento-2/` y `.cache/diseno-medios-matriz-inicial/`, sin contarlos como aceptación.

Artefactos visuales y videos en [`evidencias-diseno/index.html`](../../evidencias-diseno/index.html), **230 imágenes/videos** originales y SHA-256 en `evidencias-diseno/indice.json`, con [copia versionada del manifiesto](evidencias/diseno-medios/indice-visual-final.json); carpeta local ignorada por Git para revisión de Claude. Los recibos compactos versionados enlazan esos artefactos. No se versionan el MP4 original, cookies ni traces de navegador.

## Commits locales

Corte visual de producto y arneses: `9f3a91050510f0c95c3d34e5ffc69b45aaf8c1d2` (último cambio funcional `53b17df`). La puerta común usa `854a039`, con un selector E2E corregido y producto idéntico. Los commits de cierre posteriores solo incorporan informes y recibos. No se publicó ninguna referencia.

| Commit | Cambio |
| --- | --- |
| `0b1be52` | Añadir auditoría visual de medios en seis anchuras sin ocultar desviaciones |
| `a5036f8` | Preparar índice verificable de capturas y videos para dirección |
| `2202370` | Resumir fallos de tokens conservando el detalle en evidencia |
| `1a712c6` | Mostrar medios reales con carga diferida y vistas previas respetuosas |
| `c484a21` | Conservar el montaje y la miniatura oficial de cada publicación |
| `a568f1b` | Esperar derivados lentos y mantener legibles las cartelas pequeñas |
| `1993569` | Distinguir dimensiones reales y de reserva en los ensayos visuales |
| `26dd2dc` | Documentar los medios reales disponibles y su verificación local |
| `2b1fc65` | Exigir fluidez y ausencia de saltos al cargar los medios |
| `02978cc` | Sirve pósteres reales y vistas previas privadas con caché y FFmpeg |
| `6cb424f` | Elimina microtexto de los pósteres tipográficos |
| `004037d` | Preparar recorrido visual aislado con derivados reales existentes |
| `3a4401f` | Reservar el tinte de las cartelas al borde ambiental |
| `65ec39d` | Iniciar vistas previas después de montar su fuente |
| `73b54e7` | Aislar las pruebas de medios en rutas y publicaciones locales |
| `ed5535f` | Comprobar las URLs resueltas exactas de los pósteres |
| `8c395ee` | Identificar el reproductor del detalle por su región visible |
| `304d3e3` | Incluir los pósteres reales en el índice de revisión |
| `4b862e8` | Reservar sitio a la etapa sin cortar las cartelas de la cola |
| `df80dcd` | Revisar las 66 capturas móviles y señalar los límites de diseño |
| `5fc8495` | Mantener legibles las cartelas en miniaturas de sesenta y cuatro píxeles |
| `ad92847` | Documenta la revisión visual de las 66 capturas de tablet |
| `59ffe55` | Evaluar el render real en las cinco vistas móviles del ensayo |
| `582312d` | Documentar la revisión visual de las sesenta y seis capturas de escritorio |
| `53b17df` | Explicar la ausencia del archivo sin atribuirla al estado de producción |
| `9f3a910` | Registrar la corrección del aviso de disponibilidad en la revisión visual |
| `093e4db` | Verificar la corrección final de las cartelas móviles |
| `5370fc6` | Revalida las cartelas finales de Fábrica en tablet |
| `652da19` | Verificar las cartelas y el aviso en la recaptura final de escritorio |
| `854a039` | Acotar las comprobaciones de identidad al detalle visible |
| `45591fe` | Registrar la matriz final y los límites medidos de diseño |
| `050b0a2` | Completar la inspección de las 66 capturas móviles finales |
| `0bfa582` | Documentar la inspección completa de las capturas finales de escritorio |
| `4d97471` | Completa la inspección de las 66 capturas finales de tablet |

## Autocrítica y límites reales

- No se acredita «cumplir al píxel» el sistema completo antes de integrar `diseno-base`: el armazón anterior sigue visible por el límite expreso de esta misión. La auditoría de tokens no lo oculta.
- Las cajas heredadas de listas son pequeñas. `contain` conserva todo el contenido vertical, pero reduce su presencia dentro de un marco horizontal; la retícula justificada y el héroe de «Sala de proyección» corresponden a la integración de diseño.
- Una miniatura oficial puede tener barras o un aspecto distinto del MP4. Se conserva la imagen oficial y se informa el origen de las dimensiones, sin inferir orientación que no fue medida.
- TikTok no garantiza una miniatura en su respuesta pública actual. Si falta, se necesita que la integración oficial con permisos existentes conserve/renueve `cover_image_url`; no se inició OAuth ni se extrajeron imágenes mediante scraping.
- Solo se aceptan orígenes revisados, sin redirecciones. Un enlace caducado, un archivo de más de 50 MiB o un nuevo proveedor quedan explícitamente no disponibles. La lista no se convierte en un proxy abierto.
- El tinte del canal sin medio es estable por ID; no existe aún un color editorial de canal definido por Walter. Los derivados ocupan SQLite y su retención necesita una política acordada. No se borraron originales ni cachés ajenas.
- El trabajo se recupera tras una caída cuando llega una nueva solicitud; no se añadió un servicio durable independiente. La reserva y caché son compartidas, pero el límite de concurrencia es por proceso.
- La matriz recorre 33 pantallas/estados por anchura, con aprobaciones, formularios, entrada rechazada, 404 y enlace vencido. No equivale a agotar todas las combinaciones de datos, carga y error. Los videos acreditan hover/autoplay de medios, navegación lista→detalle y pausas. Orbe, barra inferior nueva, contadores y transiciones compartidas globales de la dirección aún no existen en esta base y no se presentan como aceptados.
- Capturas, video y rendimiento son ensayos locales. No sustituyen aceptación privada con Google, un teléfono físico, Safari real ni mediciones de usuarios en producción.

## Pendientes de Walter

1. Revisar con Claude las capturas, los medios reales y los límites de la matriz; aceptar la integración con el armazón de `diseno-base` antes de declarar cerrada la puerta global.
2. Autorizar por separado la integración y el despliegue del código/migración y del delta offline del puente. Esta misión no los ejecuta.
3. Confirmar la conservación de originales en B2 y el mecanismo de renovación/entrega de sus referencias. Revisar cualquier nuevo origen o archivo mayor de 50 MiB antes de ampliarlo.
4. Confirmar la cuenta/publicación TikTok y los permisos de la integración oficial si se requiere obtener `cover_image_url`; no hace falta renovar permisos de YouTube para el oEmbed público probado.
5. Definir tinte editorial por canal y retención de derivados/copias. Las ideas no se convierten en implementación aprobada por este informe.

## Fuentes oficiales consultadas

[FFmpeg](https://ffmpeg.org/ffmpeg.html), [FFprobe](https://ffmpeg.org/ffprobe.html), [Sharp stats](https://sharp.pixelplumbing.com/api-input/#stats), [YouTube thumbnails](https://developers.google.com/youtube/v3/docs/videos#snippet.thumbnails), [registro oEmbed](https://oembed.com/providers.json), [TikTok Embed](https://developers.tiktok.com/doc/embed-videos/), [Backblaze descarga por nombre](https://www.backblaze.com/apidocs/b2-download-file-by-name), [Next after](https://nextjs.org/docs/app/api-reference/functions/after), [Next Image](https://nextjs.org/docs/app/api-reference/components/image), [HTMLMediaElement.play](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play), [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API), [Playwright accesibilidad](https://playwright.dev/docs/accessibility-testing), [Lighthouse](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring).
