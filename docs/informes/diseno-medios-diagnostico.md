# Diseño de medios — diagnóstico de origen y proyección

Fecha: 21-11-2026, 22:05 Lima. Rama/worktree `diseno-medios`. Complementa el [informe principal](diseno-medios.md), que acredita la puerta común y la revisión de diseño del conjunto. Este frente no desplegó ni modificó el VPS, n8n vivo, OAuth, pagos o redes.

## Resultado comprobado

**Los MP4 actuales están en Backblaze B2, referenciados por la tabla de publicaciones de n8n.** No estaban en `fab_videos.render_url`, en los adjuntos de Cooper ni en archivos del volumen. Hay cuatro referencias a dos MP4 únicos del bucket público `creatomate-c8xg3hsxdu` en `f002.backblazeb2.com`. Todos respondieron a HEAD con 200, `video/mp4` y rangos por bytes: dos referencias de 31.787.183 bytes y dos de 17.866.060 bytes. No se guardan aquí sus rutas ni identificadores de publicación.

Las dos publicaciones de YouTube identificadas en la fábrica ofrecen una miniatura pública oficial recuperable: oEmbed 200 y descarga del `thumbnail_url` devuelto 200 en ambos casos, JPEG de 480 × 360 y 11.191 / 7.820 bytes. Esas miniaturas todavía no estaban persistidas en los datos de producción. El backend nuevo incorpora esa lectura pública con validación del dominio y del ID de video; no requiere OAuth ni una clave.

Se descargó **solo el MP4 menor** a la caché local ignorada y se ejercitó la función real `derivarMp4`: fuente 1080 × 1920, póster WebP de 36.778 bytes y preview MP4 de **5,000 segundos, 360 × 640, 336.834 bytes, sin audio**. FFprobe confirma un único stream de video. La extracción tardó aproximadamente un segundo en esta PC; no acredita velocidad del VPS. [Metadatos y SHA-256 del original](evidencias/diseno-medios/medios-reales-origen.json), [resultado del procesamiento](evidencias/diseno-medios/derivados-reales.json).

Los archivos para la auditoría visual quedan en la raíz del worktree, ignorados por Git:

- `evidencias-diseno/youtube-oficial-1.jpg`, `youtube-oficial-2.jpg` y sus conversiones `.webp`.
- `evidencias-diseno/b2-real-poster.webp` y `b2-real-preview.mp4`.
- `evidencias-diseno/medios-reales-origen.json` y `derivados-reales.json`.
- Original privado de trabajo: `cooper/.cache/diseno-medios-real/original.mp4`; no se incluye en una imagen ni en el repositorio.

## Alcance seguro de la lectura

Se usó el acceso SSH de operador ya documentado, con `BatchMode`, `StrictHostKeyChecking` y `sudo -n` únicamente para lectura. No se leyó la llave SSH ni ningún `.env`. Las conexiones SQLite fueron `mode=ro` con `PRAGMA query_only=ON`. Solo se consultaron los IDs internos de las Data Tables necesarias, nombres de columnas, conteos agregados y referencias públicas de medios seleccionadas. No se consultaron tablas de credenciales, configuración sensible, ejecuciones completas ni volcados de filas.

La consulta inicial sin privilegios informó `PermissionError`; no se interpretó como ausencia. La lectura autorizada posterior pudo contar el volumen. Se hicieron GET públicos de oEmbed/miniaturas y un MP4, además de los HEAD; no se escribieron archivos ni datos en el servidor. No hubo scraping de páginas, descarga de videos desde YouTube/TikTok ni extracción de sesiones.

| Ubicación / fuente | Observado | Consecuencia |
| --- | --- | --- |
| PC: `cooper/public` del worktree | 8 archivos, 0 MP4/WebM/posters raster | Los activos existentes eran fuentes/movimiento; no un almacén de renders. |
| PC: volumen `videos_n8n_data/_data/binaryData` | Directorio ausente | No hay un almacén de binarios en esa ruta; no prueba ausencia en otros discos o copias. |
| PC: búsqueda por extensión fuera de cachés | MP4 de evaluaciones ajenas, descargas y grabaciones | No se asociaron a la fábrica ni se reutilizaron como medios del producto. D&S se excluyó. |
| VPS: `/var/lib/cooper/cooper` | 3 archivos; 0 MP4/WebM/posters físicos | Los medios podrían estar en SQLite; se comprobó por separado. |
| VPS: `/var/lib/cooper/n8n/binaryData` | Directorio ausente | El render actual no reside como archivo en ese volumen. |
| Cooper SQLite | 5 videos, 0 adjuntos, 0 copias `montajes_fabrica` | No hay original reutilizable en esos almacenes. |
| Cooper `observability` | 5 documentos; 0 montajes y 0 miniaturas; 3 publicaciones y 0 miniaturas publicadas | La interfaz dependía de enlaces de publicación y de la ilustración anterior. |
| n8n `fab_videos` | 5 filas; 0 `render_url`, 0 `miniatura_url`; 2 `youtube_id`, 2 `metricas_youtube` no vacíos | Los IDs permiten recuperar portada pública; los campos de render de esta tabla no permiten generar previews actuales. |
| n8n `publicaciones` | 4 filas, 4 `url_video`, 4 `resultado`, 4 `metricas_historial` no vacíos | Fuente correcta para conservar el archivo exacto enviado a cada red/corte. |
| JSON de métricas/resultados | 0 propiedades `thumbnail_url`, `cover_image_url` o `miniaturaPublicada` no vacías | No hay miniatura oficial almacenada que el adaptador pueda simplemente proyectar hoy. |
| B2 público | 4 referencias, 2 fuentes únicas; HEAD 200 en las cuatro | Se necesita permitir este host y bucket concretos en el transporte de medios. |
| YouTube público | 2 oEmbed 200 y 2 JPEG 200 | Recuperación oficial demostrada sin producir ni publicar contenido. |
| TikTok | Sin portada oficial persistida; sin inicio de sesión o Display API real en esta misión | oEmbed puede devolver portada, pero el contrato actual no la garantiza; no se fabrica una URL de CDN. |

Los conteos son una fotografía de esta sesión y de estos almacenes, no un inventario universal de la PC ni una promesa de disponibilidad futura de un CDN.

## Implementación aditiva de este frente

Commit `c484a21` — **Conservar el montaje y la miniatura oficial de cada publicación**:

- `publicacionSchema` acepta `montaje` opcional y dimensiones opcionales enteras positivas hasta 16.384 px; el estado anterior sigue siendo válido.
- `observabilidadCooper` proyecta `publicaciones.url_video` como el montaje de esa publicación. Un corte conserva su propio MP4; no se sustituye por el principal.
- Para YouTube, selecciona la última `miniaturaPublicada` válida del historial oficial existente, con CDN `ytimg.com` e ID coincidente. No reutiliza la portada de fábrica como si fuera la publicada. Para TikTok sin fuente oficial almacenada devuelve vacío y deja al backend resolver la fuente pública.
- La entrada histórica por `youtube_id` conserva el montaje del video si existe. No se inventan dimensiones: las columnas actuales de n8n no las guardan; FFprobe o el medio oficial decodificado son la autoridad.
- Se regeneraron offline los cinco workflows que incorporan este helper. **El delta del puente no está aplicado en producción.** No cambian tablas de n8n ni se llama a sus webhooks para publicar.

El equipo de backend añadió la caché y migración `0019_video_medios`, el procesamiento, API y allowlist de B2. Esos cambios y sus commits corresponden al informe principal, no a este commit del puente.

## Fuentes oficiales consultadas

- [YouTube: recursos de miniatura](https://developers.google.com/youtube/v3/docs/thumbnails): la respuesta distingue tamaños y puede omitir dimensiones. No deducimos dimensiones de video a partir del JPEG.
- [YouTube: videos.list](https://developers.google.com/youtube/v3/docs/videos/list): la lectura existente usa `snippet.thumbnails`; no se añadieron llamadas autenticadas a esa API.
- [Registro primario oEmbed de YouTube](https://github.com/iamcal/oembed/blob/master/providers/youtube.yml) y [especificación oEmbed](https://oembed.com/): endpoint público y miniatura opcional. La prueba comprobó la respuesta efectiva del dominio oficial, no el HTML embebido.
- [TikTok: Embed Videos](https://developers.tiktok.com/doc/embed-videos/), actualizado el 23-10-2026: mantiene `/oembed`, recomienda Embed Player y su ejemplo actual no incluye `thumbnail_url`.
- [TikTok: Video Object](https://developers.tiktok.com/doc/tiktok-api-v2-video-object/) y [Query Videos](https://developers.tiktok.com/doc/tiktok-api-v2-video-query/): `cover_image_url` dura seis horas; `/v2/video/query/` con permiso `video.list` permite renovarlo y obtener `width`/`height`. No se inició autorización ni se usó un token durante el diagnóstico.
- [Backblaze: descargar por nombre](https://www.backblaze.com/apidocs/b2-download-file-by-name): documenta `/file/{BUCKET_NAME}/{FILE_NAME}`, acceso sin autorización a buckets públicos y HEAD para comprobar cabeceras. El backend permite solo el host/bucket observados, no cualquier URL del navegador.

Skill `elite-web-architect` encontrada y leída completa en la instalación sincronizada de Claude; se aplicaron inspección previa, fuentes, evidencia y autocrítica. DIRECCION se leyó completa. Shadcn UI/Context7 no estaban disponibles en el inventario de herramientas de esta sesión; no se simuló su uso.

## Pruebas y autocrítica

- `node --test --test-name-pattern='medios:|pulido:' tests/flujos_v2.test.cjs`: **8/8 PASS**, sin omisiones ni advertencias. [Log](evidencias/diseno-medios/proyeccion-focal.log).
- `node node_modules/vitest/vitest.mjs run tests/observabilidad.test.ts`, desde `cooper/`: **5/5 PASS**. [Log](evidencias/diseno-medios/observabilidad-focal.log).
- `git diff --check`: PASS.
- Ensayo de la función FFmpeg con original real y miniaturas oficiales: PASS después de corregir capítulos heredados. La primera salida tenía aviso `Referenced QT chapter track not found`; backend añadió `-map_chapters -1` y el segundo derivado no produjo avisos. La evidencia JSON corresponde al segundo intento.
- Se inspeccionaron visualmente ambos JPEG oficiales y el fotograma del MP4. Son contenido real del canal, con sus textos, sin montañas de relleno. Los tres devuelven tinte gris porque predominan zonas oscuras/neutras; es el cálculo real y no una elección editorial de color.

La puerta común completa y la matriz visual son responsabilidad del cierre conjunto. Estas pruebas focales no las sustituyen. El ensayo FFmpeg usa bytes reales descargados del archivo existente; no acredita por sí solo una petición autenticada de extremo a extremo desde el navegador de producción. La revisión independiente detectó que el sondeo del cliente terminaba antes que un trabajo lento y se comunicó al frente de interfaz antes de la puerta.

## Pendientes de Walter

1. Revisar y, en una misión autorizada de integración, aplicar la migración/código de Cooper y el delta del puente; esta misión deja ambos preparados sin despliegue. Sin el delta, los `url_video` de B2 no llegarán todavía al contrato nuevo desde el n8n vivo.
2. Conservar los dos originales actuales y acordar almacenamiento/retención. `fab_videos.render_url` está vacío en los cinco registros actuales: las referencias sobreviven en `publicaciones.url_video`, y hay que preservarlas al migrar o depurar.
3. Para TikTok, comprobar si la respuesta pública entrega portada; si no, asociar el acceso Display API existente que corresponda o aportar una miniatura oficial vigente. La autorización y renovación del permiso `video.list` no forman parte de esta misión. No reconstruir enlaces de CDN ni descargar el MP4 de la red.
4. Revisar visualmente las portadas reales y su encuadre en el armazón final de Claude. El JPEG oficial de YouTube es 4:3 con el video vertical dentro; el render probado es 9:16. La interfaz debe conservar esa distinción.
