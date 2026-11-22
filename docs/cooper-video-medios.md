# Medios protagonistas: contrato y operación local

Misión `diseno-medios`, 21-11-2026 (Lima). Implementación local; no integrada ni desplegada por esta misión.

## Qué guarda y qué entrega

La migración aditiva `0019_video_medios` añade `video_medios` con clave por video/publicación, revisión de origen, póster, preview MP4, tinte, dimensiones, reservas y reintentos. No descarga nada durante la migración. Borrar un video elimina sus derivados en cascada; no altera ni elimina originales. Los binarios se guardan en SQLite, siguiendo el almacenamiento existente, y no aparecen en las proyecciones del navegador.

`GET /api/videos/:id/medios?publicacion=<id>` obtiene `VideoMedios` (versión 1), con los mismos permisos de dueño/administrador que el video. Sin selector, usa render/miniatura de fábrica; si ambos faltan, la publicación disponible más reciente. Cada publicación tiene caché independiente, portada oficial y su propio MP4 cuando el puente lo entrega. Un corte sin MP4 asociado no toma automáticamente el montaje completo como si fuera su fuente exacta.

```ts
type VideoMedios = {
  version: 1;
  videoId: string;
  estado: "listo" | "sin_medio" | "pendiente" | "no_disponible";
  poster: { url: string; origen: "render" | "miniatura" | "escena" | "youtube" | "tiktok" | "tipografico"; ancho: number; alto: number } | null;
  preview: { url: string; mime: "video/mp4"; duracion: number; bytes: number } | null;
  tinte: string;
  ancho: number;
  alto: number;
  relacionAspecto: number;
  origenDimensiones: "video" | "poster" | "reserva";
  actualizadoEn: number;
};
```

`origenDimensiones: video` acredita dimensiones del MP4 por FFprobe o del video aportadas expresamente por el puente. `poster` solo acredita las dimensiones de la imagen: una miniatura YouTube 480×360 **no demuestra** que el video sea 4:3. `reserva` es el espacio provisional 1600×900; nunca se presenta como medición. El póster tiene sus dimensiones propias aunque el video sea vertical.

Los assets se entregan en `/api/videos/:id/medios/poster` y `/preview`, con el mismo selector `publicacion`, revisión en `v`, sesión, permiso de recurso y MIME comprobados. Tienen `Cache-Control: private, max-age=0, must-revalidate`, `ETag`, `Vary: Cookie`, `nosniff` y CSP restrictiva. Incluso una respuesta 304 vuelve a comprobar la sesión y el dueño; no hay enlace público firmado ni contenido cacheable por un CDN compartido. JSON usa `private, no-store`.

## Fuentes y límites

- MP4 de fábrica: copia vigente de `montajes_fabrica` cuando existe; en otro caso, URL recibida por el puente. Solo `https://cdn.creatomate.com/renders/...mp4` y el almacenamiento histórico comprobado `https://f002.backblazeb2.com/file/creatomate-c8xg3hsxdu/<archivo>.mp4`. B2 admite exclusivamente ese host/bucket y sin query. Máximo 50 MiB, reutilizando el límite de montajes. No se aceptan URLs del formulario ni rutas locales del cliente.
- Póster de render: fotograma del MP4 real, normalizado a WebP; si el montaje falla, puede servir una miniatura real independiente. Sin montaje/miniatura de fábrica se acepta una imagen o un clip MP4 de escena real recibido por el puente dentro de los orígenes habilitados; `poster.origen: escena` identifica ese avance de la pieza, sin presentarlo como montaje terminado. El reproductor completo continúa usando exclusivamente el montaje de fábrica.
- Publicado YouTube/TikTok: miniatura pública oficial recibida del puente o `thumbnail_url` de oEmbed oficial. Solo se guarda esa imagen; se descarta el HTML. YouTube comprueba además que el ID de la imagen coincide con el enlace de la publicación. Se admiten hosts `i*.ytimg.com` concretos y los CDN TikTok enumerados en código. Si TikTok no devuelve `thumbnail_url`, el resultado queda explícitamente sin póster: su API oEmbed actual no garantiza ese campo. Obtener/renovar `cover_image_url` mediante Display API requiere los permisos existentes de esa integración; esta misión no inicia OAuth ni llama esa API autenticada.
- No se extrae ni descarga el MP4 de YouTube/TikTok. Un preview se genera solo si la fábrica conserva el MP4 original de ese video/publicación.
- Descargas mediante el transporte de medios existente, HTTPS, host/ruta cerrados, sin credenciales en URL, puertos personalizados, IPs ni redirecciones, con timeout y tamaño limitado también al leer el stream. Una fuente nueva requiere revisar y ampliar la lista explícita; no existe proxy abierto configurable.
- La lista de hosts queda fijada en código; se confía en DNS/TLS de los proveedores oficiales. No se afirma fijación de IP ni protección frente a compromiso del DNS del proveedor. FFmpeg nunca recibe una URL de red: solo un archivo temporal privado, protocolos `file,pipe`, demuxer MOV/MP4 y referencias de datos externas desactivadas. Los temporales se eliminan incluso si falla el proceso.

FFmpeg produce cinco segundos a 12 fps, sin audio, subtítulos, capítulos ni metadatos del original; escala máxima 640 px sin deformar el contenido y MP4 H.264 con `faststart`. Comprueba tamaño real ≤600.000 bytes y reduce bitrate si es necesario. Fuentes de menos de cinco segundos se repiten para completar el tramo; no se inventan fotogramas. Sharp decodifica/recomprime los pósteres, descarta metadatos y limita píxeles de entrada. FFprobe conserva orientación y relación de píxel al informar dimensiones.

El tinte dominante sale del póster decodificado (`sharp.stats().dominant`), convertido a HSL con saturación máxima 45 % y luminosidad 45–60 %. Se persiste en servidor. Sin medio real, el servidor genera un SVG tipográfico escapado con el título y un tinte estable del canal (hash del ID, S 30 %, L 52 %); todavía no existe un color editorial explícito de canal en el esquema. Un fallo de descarga de una fuente real devuelve `no_disponible`, nunca una ilustración de montañas ni un póster tipográfico que suplante ese medio.

El póster tipográfico contiene solo el título y el acento de tinte; se retiraron canal y pie para evitar microtexto al reducirlo. A 340 px de ancho, el título equivale a 15,3 px. Por debajo de 267 px el texto dentro de la imagen queda por debajo de 12 px: las miniaturas pequeñas conservan su título HTML adyacente como lectura principal; no se certifica legibilidad del texto incrustado en todos los tamaños de miniatura. La revisión de caché distingue esta versión del póster.

## Caché y ejecución

Las proyecciones SSR/SSE leen metadatos por lote sin blobs ni escrituras por tarjeta. El fallback tipográfico se materializa al pedir su asset. El endpoint JSON responde antes del trabajo pesado y agenda la preparación con `after` de Next.js. Hay dos trabajos simultáneos y dieciséis en espera por proceso; las peticiones idénticas comparten trabajo. Una reserva SQLite de cinco minutos evita repetir la misma revisión en procesos/reinicios. Tras interrumpirse el proceso, una futura solicitud recupera la reserva caducada.

La revisión depende de fuente, publicación, propietario, montaje, título y canal; cambios de métricas/SSE no fuerzan derivados nuevos. Se vuelve a comprobar antes de guardar para descartar resultados de revisiones ya sustituidas. Una actualización de la misma revisión conserva el póster y preview vigentes durante la descarga y si falla. Cadencia: 24 horas después de un resultado completo, cinco minutos entre fallos y 24 horas tras tres intentos fallidos. El refresco se activa al consultar, no mediante un cron nuevo. El origen puede renovar un enlace caducado a través del puente habitual.

En demo o fábrica simulada no hay descargas remotas automáticas; se permiten los MP4 ya guardados localmente y transportes ficticios explícitos de prueba. El modo n8n habilita únicamente lecturas públicas de los orígenes anteriores. No se añaden variables ni secretos. FFmpeg/FFprobe y las dependencias de Sharp ya existen en `deploy/Containerfile`.

## Precarga reproducible

El script manual exige una **copia existente** dentro de `cooper/.cache`, resuelve symlinks y rechaza cualquier base fuera. No carga `.env`, no imprime usuarios, URLs ni rutas privadas y no cambia proveedores ni flujos. Recorre cada video y publicación de usuarios activos, usa la misma revisión/caché y resume conteos.

```bash
cd cooper
# Copia de ensayo ya preparada; sin descargas remotas.
node_modules/.bin/tsx scripts/preparar-video-medios.ts --base .cache/copia.sqlite
# Lecturas públicas de los medios de esa copia, si la misión las autoriza.
node_modules/.bin/tsx scripts/preparar-video-medios.ts --base .cache/copia.sqlite --permitir-red
```

La migración productiva y la precarga productiva quedan para el integrador autorizado: respaldo SQLite, aplicar diario aditivo y probar los endpoints con una sesión legítima; no copiar cookies ni secretos a scripts. Se puede recorrer cada video/publicación por la API autenticada, con dos tareas como máximo. Los resultados `no_disponible` requieren recuperar el original o actualizar su referencia, no volver a producir contenido pago automáticamente.

## Fuentes consultadas antes de implementar

- [FFmpeg: selección, duración, metadatos y codificación](https://ffmpeg.org/ffmpeg.html), [filtro scale](https://ffmpeg.org/ffmpeg-filters.html#scale).
- [Sharp: metadata y color dominante](https://sharp.pixelplumbing.com/api-input/).
- [Next.js after](https://nextjs.org/docs/app/api-reference/functions/after) y guías equivalentes instaladas en `node_modules/next/dist/docs/`.
- [YouTube: thumbnails oficiales](https://developers.google.com/youtube/data/reference/rest/v3/videos), [registro primario de proveedores oEmbed](https://oembed.com/providers.json).
- [TikTok: oEmbed vigente](https://developers.tiktok.com/docs/en/embed-videos), [objeto de video y cover_image_url](https://developers.tiktok.com/doc/tiktok-api-v2-video-object/).
- [Backblaze: descarga pública por nombre y HEAD](https://www.backblaze.com/apidocs/b2-download-file-by-name).

Los endpoints externos se probaron con transportes ficticios en tests. Las lecturas públicas reales, sus conteos y derivados se registran por separado en el informe `diseno-medios`; no confundir una muestra real con toda la fábrica ya migrada.
