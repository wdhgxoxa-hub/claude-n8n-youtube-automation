# Informe — diseno-integracion (Sala de proyección)

Fecha: 2026-11-22, Lima. Rama `diseno-integracion`. Estado: **implementado e integrado en la rama; probado con la puerta local descrita abajo; NO desplegado; sin push** (este entorno no tiene acceso de escritura al remoto).

## Commits de esta pasada

Integración previa en la rama (otras pasadas): `e962172` diseno-inicio, `3685b41` diseno-fabrica-video, `ed58d13` diseno-publicados-aprendizaje, fix-inicio (`4f775e5`…`ff52485`), `62a70ab` merge de fix-fabrica.

| Commit | Contenido |
|---|---|
| `13baf9e` | Merge de `fix-publicados`. Conflicto único en `metricas-resultados.tsx` (importaciones): se conserva la composición de fix-publicados (`lib/redes`) y el formateador único de fix-inicio (`lib/cifras`). |
| `24ca02d` | Cifras y redes con una sola fuente: mensajes de salud, gasto del chat y aviso de WhatsApp pasan a `formatoPorcentaje`/`formatoMoneda`; se eliminan los `nombreRed` duplicados de `inicio-datos.ts` y `linea-produccion.tsx`; `marcas-resto.spec.ts` deja de ocultar `.mobile-more`. |
| `a9709fd` | Póster tipográfico: primitiva única `Cartel`. |
| `3ded3b5` | Armazón: todas las pantallas arrancan su título a 96 px. |
| `fbd555d` | Fábrica: bahías libres y pista colocada con contexto. |
| `9781aa4` | Pulido del recorrido (coma decimal en Geist Mono, títulos repetidos en «Te toca a ti», aire de la pared, título de La pared en móvil). |
| `3e9ad8d` | La pared: firma del póster reducida al número; héroe de Inicio conserva su título display. |
| `9f890f2` | Evidencias finales (`evidencias-diseno/final/`, 50 capturas). |
| (este) | Informe y `docs/ESTADO.md`. |

## Decisiones de integración

- **Conflicto de fix-publicados:** solo chocaban las dos importaciones; se conservaron ambas. Ninguna pantalla vuelve a llamar a `Intl.NumberFormat`/`toLocaleString` para cifras; las fechas siguen con `Intl.DateTimeFormat` (no son cifras).
- **«19,600»:** en el código integrado ya no aparece. Comprobado leyendo el texto visible de Inicio, Publicados, Aprendizaje y Fábrica con una expresión que detecta miles o decimales en formato inglés y «k»: 0 coincidencias. Publicados muestra «19 600» (espacio fino, es-PE). Además se corrigieron las tres cadenas de servidor que aún usaban `toFixed` (salud de la operación, gasto en chat y WhatsApp).
- **Botón flotante «…»:** no quedaba ningún resto en el código; solo la referencia muerta del spec. Verificación automática a 390 en Inicio, Fábrica, Publicados y Aprendizaje: al final del desplazamiento, ningún elemento fijo (barra y orbe) tapa texto ni controles. En la parte de arriba el contenido pasa por debajo de la barra mientras se desplaza, como corresponde a una barra fija.

## Póster tipográfico (prioridad de diseño)

`cooper/src/componentes/cartel.tsx` + `cartel.css`, una sola primitiva para el héroe de Inicio, «Te toca a ti», el carrusel, las miniaturas de «En producción», las cápsulas de Fábrica, la pared de Publicados, la línea de tiempo de Aprendizaje, Canales y el reproductor del detalle.
- Título en Clash Display 600 con `text-wrap: balance`, máximo 4 líneas (3 en miniaturas). El tamaño sale de container queries sobre el propio cartel: token `--titulo-cartel = clamp(12px, min(11cqi, 15cqh), 72px)`, y en formatos verticales 14cqi. Medido: unos 72 px en el héroe de 960 px, entre 20 y 28 en tarjetas y 12 en miniaturas de 60 px.
- Fondo: foco radial y haces cónicos del `--tinte` sobre negro, más una viñeta que cae a negro en la zona del título. Grano de película con ruido fractal en SVG de datos (token `--grano`), sin imágenes externas. Borde de 1 px del tinte al 20 %.
- Firma en Geist Mono de 12 px: canal y número o etapa («ETAPA 04», «N.º 01»). Por debajo de 240 px de ancho queda solo el número; en miniaturas (menos de 160 × 112 px) desaparece.
- Los contextos solo reservan franjas para lo que superponen (`--cartel-reserva-arriba/abajo`). Sin CLS: el cartel es absoluto sobre la caja ya reservada.
- El SVG tipográfico que genera el servidor ya no se pinta como `<img>`: tenía fuente Arial y una rayita. El cliente compone el cartel en su lugar. En el detalle con MP4 pero sin miniatura real, el cartel es el botón «Ver video».
- Para no repetir el título, se oculta a la vista (queda para lectores de pantalla) en las cápsulas de Fábrica y en «Te toca a ti». El héroe conserva su título display como pie (DIRECCION §4).
- **Contraste AA (calculado, no medido con píxeles):** el tinte del servidor es `hsl(h 30% 52%)`. Barrido de 360 tonos en la zona del título (foco ≤45 % + haz 12 % + grano medio): ≥5,32:1 contra #F5F5F7. Peor caso teórico, en la esquina del foco con todas las capas al máximo: 3,08:1. Esa esquina no lleva título, y aun así cumpliría AA para texto grande.
- Guardián de tokens: se añadieron `--titulo-cartel`, `--cartel-aire`, `--interlinea-cartel`, `--grano` y `--grano-opacidad` a `tokens.css`, y `titulo-cartel` a la lista blanca del test. El test pasa.

## Cabeceras (tarea 3)

`main#contenido` fija el arranque: cabecera de 80 px + relleno de 16 px. Anula el relleno superior propio de cada `.page` y de su primera `.page-heading`. Fábrica deja su margen negativo. Inicio retira la antetitular «COOPER / ESTUDIO», redundante con la cabecera de contexto. En La pared, el título se fija arriba de su fila para no bajar por el enlace táctil. **Medido (posición del h1):** 96 px a 1440 en Inicio, Fábrica, Publicados, Aprendizaje, Marcas, Canales, Avatares, Operación, Administración y Perfil, y 88 px a 390 en todas. Antes: Inicio 171, Publicados 120, Marcas y resto 160. Excepciones intencionales: Entrar (sin armazón) y el detalle de video, cuyo h1 es el título bajo el reproductor.

## Fábrica con pocos videos (tarea 4)

Cada estación vacía muestra una «bahía libre» con «LIBRE», su número en display y una frase de oficio («La historia se dibuja plano a plano.»). Solo aparece en la pista horizontal; en móvil la lista sigue compacta. Al cargar, la pista deja una estación de contexto a la izquierda de la primera ocupada.

## Correcciones A–F (misión) — estado verificado en capturas finales

- **A Cifras:** formateador único es-PE (fix-inicio) más esta pasada. La coma decimal ya no se separa en Geist Mono («56,4»). Columnas sin invadir a 1440 y 390 (`inicio-1440-completa.png`).
- **B Inicio:** halo visible (fix-inicio), sin «…» flotante, zona segura del orbe verificada a 390.
- **C Publicados:** retícula justificada y grafías de redes (fix-publicados). Toda pieza sin medio lleva ahora el póster tipográfico nuevo (`publicados-*-completa.png`).
- **D Fábrica:** título a 96 px ya sin margen negativo, estaciones vacías con presencia, pista con contexto (`fabrica-1440-viewport.png`).
- **E Consistencia:** arranque de cabecera unificado y medido en las 10 rutas con armazón. Recorrido de las 12 rutas sin texto menor de 12 px y sin desbordamiento horizontal: medido por script en las 26 capturas.
- **F Ejemplos:** «Ejemplo» condicionado a `data.demo && p.simulada` (fix-publicados, pruebas `demo-publicados` y `origen-demo` en verde). No verificado en producción real.

## Puerta (ejecutada en este entorno, números reales)

- `npm ci`: OK.
- `npm run lint`: 0 errores, 0 advertencias (`--max-warnings 0`).
- `npm run typecheck`: 0 errores.
- `npm test`: **702/703**. Único fallo: `tests/puerta.test.ts › conserva las huellas de la caché privada fijada de Sentinel`, porque la caché privada de Sentinel no existe en este entorno (fallo aceptado por la misión). 0 advertencias en la salida.
- `npm run build`: OK, 0 advertencias.
- Raíz, `node --test tests/flujos_v2.test.cjs`: **237/237**.
- Consola del navegador en las 26 capturas finales: 0 errores y 0 avisos (registrados por el script de captura).
- **No ejecutado:** `npm run test:e2e` (no hay navegadores compatibles con Playwright; las capturas usan el Chromium de `/opt/pw-browsers` con `executablePath`), Sistema Sentinel, axe, Lighthouse, trazas de fps y videos de transición. Los specs se revisaron contra los cambios: el selector `[data-poster=tipografico]` conserva exactamente el texto del título y no hay `svg` dentro del medio; el h2 del héroe sigue visible; se retiró `.mobile-more`.

## Evidencia

`evidencias-diseno/final/<ruta>-<390|1440>-<viewport|completa>.png` (en las de página completa los fijos están ocultos) y `cooper-<ancho>-viewport.png` con Cooper abierto. Rutas clave: `inicio-*`, `fabrica-*`, `detalle-*`, `publicados-*`, `aprendizaje-*`, `cooper-*`.

## Lo que aún no está a nivel (autocrítica)

- Sin medios reales en demo: el aspecto con miniaturas y MP4 reales no se volvió a revisar en esta pasada.
- El tinte de demo (`hsl(h 30% 52%)`) es apagado y el cartel se ve casi monocromo violeta, azul o verde según el hash del canal. Si se quiere más color, hay que decidir con Claude un tinte editorial por canal.
- La pared: la última fila queda corta y alineada a la izquierda (decisión de C). Bajo cada tarjeta se repite el título como pie.
- Administración: la columna Acceso usa Geist Mono para «Administrador» y «Desactivar», y el importe «US$ 0,00» queda levemente desalineado respecto de su prefijo.
- Operación (Radar): el bloque «Competencia e identidad» conserva un copy instructivo largo.
- Cooper: las sugerencias se desplazan en horizontal y la tercera queda cortada en el borde (diseño heredado con desvanecido). El panel tiene mucho vacío arriba cuando no hay conversación.
- No hubo revisión a 360, 768, 1024 ni 1920 en esta pasada (solo 390 y 1440).

## Pendientes de Walter

1. Ejecutar en su PC la puerta E2E completa (`npm run test:e2e`), axe y Lighthouse, y las dos rondas de Sistema Sentinel. Aquí no se pudieron ejecutar.
2. Revisar con Claude las capturas de `evidencias-diseno/final/` y autorizar el push y el despliegue. Nada de esta rama está desplegado.
3. Aplicar el lote n8n que guarda `miniatura` y `url_video`, para que las piezas reales muestren su medio en lugar del póster.
4. Reconectar GitHub para poder publicar la rama.
