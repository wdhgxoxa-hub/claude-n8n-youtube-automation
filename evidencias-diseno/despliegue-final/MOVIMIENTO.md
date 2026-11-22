# Movimiento en ejecución real — despliegue final (22-11-2026)

**Resumen.** Corrida final sobre `bc0693b4` (la versión desplegada), dentro de la cadena de rondas
(`cooper/.cache/calidad/rondas4/4-movimiento.log`): **17 de 17 pruebas pasan** en Chromium a 1440 (puntero)
y 390 (táctil, `isMobile`). Fotogramas: 60 fps medios y p95 de 16,7–16,8 ms en las tres fases medidas, también
a 390 con la CPU 4× más lenta. Ningún cuadro pasa de 50 ms y el CLS es 0. Consola: 0 errores y 0 avisos.

- Prueba: `cooper/despliegue-final/movimiento.spec.ts`; configuración `cooper/playwright.despliegue-final.config.ts`
  (mismos dos servidores aislados de la puerta y GPU por ANGLE/EGL).
- Orden: `cd cooper && npm run test:e2e -- -c playwright.despliegue-final.config.ts`.
- Navegador: Chromium 159.0.8154.6 sin ventana. GPU Intel (ARL), Mesa 26.2.6, composición por GPU activada.

## Resultado por punto

| # | Punto | 1440 | 390 | Cifras medidas |
|---|---|---|---|---|
| 1 | Transición miniatura → detalle (elemento compartido) | PASS | PASS | 1 llamada a `startViewTransition`; miniatura y reproductor comparten nombre. Empieza a animar a los 38 ms (1440) y 29 ms (390) del toque; dura 654 / 658 ms. Respaldo sin la API: fundido de 240 ms. |
| 2 | Entradas escalonadas | PASS | PASS | 10 tarjetas, retrasos 0, 40 … 280 ms (tope en la 8.ª), 420 ms `route-in`. Una sola entrada por visita, también tras re-render. **Nuevo:** ocultar y volver a la pestaña no relanza ninguna entrada (0 arranques, opacidad mínima 1). |
| 3 | Vista previa con MP4 real | PASS | PASS | MP4 360×640, 5 s, mudo. 1440: `play()` 180 ms después de `pointerenter`, fundido 240 ms. 390: arranca al entrar en vista y para al salir. |
| 4 | Cifras que suben al entrar en vista | PASS | PASS | Fuera de vista, valor fijo; al entrar, rodillo de ~640 ms; el valor final coincide con el texto accesible. |
| 5 | Carrusel: arrastre con inercia y `--tinte` | PASS | PASS | Tinte con transición de 640 ms; arrastre con ratón y con toque; inercia tras soltar; rebote en el borde. |
| 6 | Cooper: abrir, cerrar y contexto | PASS | PASS | Del clic a la proyección: 11 ms (1440) y 40 ms (390, CPU 4×). Hoja lateral sin tapar el contenido en escritorio; hoja inferior arrastrable en móvil; contexto distinto en video, marca e Inicio. |
| 7 | Barra inferior móvil | — | PASS | 5 pestañas de 54 px; el indicador se desliza de x=9 a x=63,3 en 199 ms con 13 cuadros intermedios. «Más» vive en la cabecera y abre la hoja. |
| 8 | prefers-reduced-motion | PASS | PASS | Sin desplazamientos ni autoplay; fundidos ≤120 ms; todo funcional. |
| 9 | Fotogramas (traza) | PASS | PASS | Tabla siguiente. |
| 10 | Consola | PASS | PASS | 0 errores y 0 avisos en las 17 pruebas. |

## Fotogramas (`fps-1440.json`, `fps-390.json`; trazas CDP `traza-1440.json`, `traza-390.json`)

Las trazas CDP (`traza-*.json`, 46 MB entre las dos) quedan en el disco de la worktree y no entran en git por su tamaño;
las cifras de esta tabla están en los `fps-*.json`, que sí entran.

Método: `requestAnimationFrame` en la página más la traza CDP guardada, sin grabar video.
Umbrales: ≥57 fps, p95 ≤25 ms, 0 cuadros de más de 50 ms y CLS 0.

| Ancho / CPU | Fase | fps medio | p95 | máx. cuadro | cuadros >50 ms | CLS | Otros |
|---|---|---|---|---|---|---|---|
| 1440 / 1× | carrusel | 60 | 16,7 ms | 16,8 ms | 0 | 0 | 41 cuadros |
| 1440 / 1× | cooper-abrir | 60 | 16,8 ms | 16,8 ms | 0 | 0 | 11 ms del clic a la proyección |
| 1440 / 1× | transición | 60 | 16,8 ms | 16,8 ms | 0 | 0 | 32 ms hasta animar |
| 390 / 4× | carrusel | 60 | 16,7 ms | 16,8 ms | 0 | 0 | 104 cuadros |
| 390 / 4× | cooper-abrir | 60 | 16,8 ms | 16,8 ms | 0 | 0 | 40 ms del clic; 1 tarea larga de 51 ms |
| 390 / 4× | transición | 60 | 16,8 ms | 16,8 ms | 0 | 0 | 116 ms hasta animar |

## Videos (en esta carpeta)

`transicion-*`, `entradas-*`, `vista-previa-*`, `cifras-*`, `carrusel-tinte-*`, `cooper-*`, `reducido-*` (1440 y 390)
y `barra-movil-390`. Cada punto deja su JSON con el mismo nombre; el informe de Playwright está en `playwright.json`.

## Defectos de la versión anterior de este documento

- D1 (el indicador de la barra móvil saltaba) y D2 (327–444 ms de pantalla quieta antes de la transición) ya no
  se reproducen: ahora 13 cuadros intermedios y 29–116 ms hasta animar. La View Transition se abre cuando la
  ruta ya está lista (commit `a434292c`).

## Límites

Laboratorio: Chromium sin ventana, GPU Intel y CPU frenada 4× por CDP. **No acredita un teléfono real.** El toque a
390 se simula con `Input.dispatchTouchEvent`. Esta prueba de movimiento es solo Chromium; Firefox y WebKit se cubren
en las rondas (seis anchos).
