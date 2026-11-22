# Fuentes autoalojadas

Descargadas el 21-11-2026 del distribuidor oficial; archivos WOFF2 originales,
sin conversión ni subconjuntos. El navegador nunca consulta servicios de fuentes.

- Clash Display variable: [Fontshare](https://www.fontshare.com/fonts/clash-display),
  paquete oficial `https://api.fontshare.com/v2/fonts/download/clash-display`.
  Se conserva `ClashDisplay-FFL.txt` (ITF FFL 2.0).
- Geist y Geist Mono variables: paquete oficial `geist@1.9.2` de
  [Vercel](https://github.com/vercel/geist-font), licencia SIL OFL 1.1 conservada.

Clash Display es gratuita para autoalojamiento en esta aplicación propia, pero su
FFL restringe modificaciones y redistribución independiente: **no equivale a una
licencia libre OFL**. Se respeta el nombre exacto solicitado por Dirección;
si «licencia libre» exige OFL, Claude/Walter deben aprobar otra tipografía display.
No se ofrece como fuente seleccionable para generar contenido de terceros.

Next/font/local declara `font-display: swap` y precarga exclusivamente Clash y
Geist; Mono se descarga cuando un dato la utiliza.
