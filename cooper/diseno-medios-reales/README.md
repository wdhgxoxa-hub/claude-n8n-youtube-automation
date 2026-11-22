# Recorrido manual con derivados reales

Desde `cooper/`, después de la puerta común y sin otras mediciones concurrentes:

```bash
npm run test:e2e -- --config=playwright.medios-reales.config.ts
```

Requiere `../evidencias-diseno/b2-real-poster.webp` (36.778 bytes, 900×1600) y
`../evidencias-diseno/b2-real-preview.mp4` (336.834 bytes, 360×640, cinco segundos,
sin audio), además del entorno E2E/FFprobe preparado. La ausencia o un archivo
distinto hace fallar el ensayo: no descarga medios ni recurre a imágenes sintéticas.
Los archivos permanecen fuera de Git y deben copiarse al checkout aislado antes
de ejecutar. El origen conserva 1080×1920; el reproductor del ensayo muestra solo
el extracto de cinco segundos, no el MP4 original completo.

La configuración usa exclusivamente este directorio y dos proyectos Chromium
(390 y 1440 px), con sesiones y SQLite ficticias locales. No la importa la puerta
común ni la matriz global. Bloquea todo destino externo del navegador. Las rutas
interceptadas tipadas muestran los derivados reales dentro de fábrica/cola, lista,
detalle y Publicados; no acreditan una publicación ni sincronización productiva.

Guarda PNG, WebM, trazas e informe JSON bajo `evidencias-diseno/medios-reales-*`.
Comprueba carga diferida de la última tarjeta, parada al salir del viewport,
hover/reproducción móvil y navegación interna lista→detalle sin recarga. La
visibilidad de pestaña se intenta de forma nativa; si el Chromium headless conserva
ambas pestañas visibles, prueba la señal de la API y lo declara expresamente en el
JSON. No acredita el orbe, la barra móvil ni las transiciones compartidas ausentes
del armazón heredado.
