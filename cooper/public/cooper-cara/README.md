# Cara local de Cooper

Recurso derivado del archivo entregado por Walter `Gemini_Generated_Gif_dnwgtddnwgtddnwg.gif.mp4`, localizado en `~/Descargas` el 21-11-2026 (Lima). Búsqueda por nombre en Descargas, Imágenes, Videos y el directorio personal hasta profundidad 3. No se usaron servicios remotos ni generación pagada.

- `cooper.webm`: VP9 con alfa real, 180×180 px nativos, 30 fotogramas, 3 segundos, 10 fps; 383.274 bytes al exportar. Recorte de cada fotograma, no máscara visual ni modo de mezcla CSS.
- `cooper.png`: respaldo RGBA, primer fotograma, 180×180 px. Respaldo para movimiento reducido, pausa o error del video.
- `calidad-56-112.png`: contacto de cuatro fotogramas a 56/112 px sobre negro, vidrio y fondo claro.
- `calidad-navegador.png` y `calidad-parpadeo.png`: capturas Chromium a tamaño real, WebM y PNG sobre los mismos tres fondos.
- `verificacion.json`: huella de la fuente y derivados, dimensiones, método y validación del canal alfa.

## Reproducción

Desde `cooper/`, con ffmpeg (libvpx-vp9), ffprobe, Python, numpy y Pillow locales:

```sh
python scripts/preparar-cara.py "$HOME/Descargas/Gemini_Generated_Gif_dnwgtddnwgtddnwg.gif.mp4"
```

El original tiene fondo de tablero ya incrustado y compresión H.264. El script detecta el fondo gris conectado a los bordes, conserva los blancos internos, forma un trimap y calcula alfa/descontaminación en cada fotograma. Exporta sin ampliar ni inventar detalle. El umbral y el recorte se ajustaron a este original: otra imagen requiere una revisión distinta.

La decodificación completa mediante libvpx-vp9 confirma 30/30 fotogramas RGBA, bordes transparentes y alfa de 0 a 255. Máxima diferencia de alfa entre PNG original y WebM decodificado: 1/255 por conversión; no se declara identidad matemática. FFprobe registra `alpha_mode=1`. En Chromium, el primer fotograma contiene 14.839 píxeles transparentes, 15.903 opacos y 1.658 intermedios; ninguna excepción JavaScript en la captura. Se revisaron visualmente las dos escalas y el parpadeo, sin tablero residual, rectángulo ni borde blanco duro.

## Calidad y límites

Aceptable para el orbe de 56 px y presentación de hasta 112 CSS px. La fuente es pequeña: no equivale a alta resolución a DPR 2/3, conserva cierta suavidad y avanza a 10 fps. Es un único gesto con parpadeo y boca sutil; no representa cinco estados del asistente y no debe sincronizarse falsamente con la voz. No sustituye la revisión de Claude de la composición final.

Pendiente de Walter: generar cinco estados en alta resolución con fondo liso (reposo, escuchando, pensando, hablando, celebrando). Esto mejorará detalle y control; el recurso actual sirve como cara tranquila, con PNG para la variante quieta.

Fuentes técnicas consultadas el 21-11-2026: [FFmpeg/libvpx](https://ffmpeg.org/ffmpeg-codecs.html#libvpx), [Pillow ImageFilter](https://pillow.readthedocs.io/en/stable/reference/ImageFilter.html). Las herramientas se ejecutaron localmente; no se añadió ninguna API a Cooper.
