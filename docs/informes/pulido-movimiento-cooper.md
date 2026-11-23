# Informe — pulido de transiciones y de la conversación con Cooper

Fecha: 23-11-2026 (Lima). Rama `pulido` (parte de `temas-despliegue` `468018b`, lo desplegado). Autor: Claude (Fable), sin delegar.
Estado: **implementado y probado en la nube con Chromium. No integrado, no desplegado.**

## Origen
Auditoría en vivo de Claude en producción (tema «Día», sesión de Walter) tras su observación: el perrito desaparece al abrir la conversación, la conversación no se siente pulida y faltan transiciones cuidadas.

## Defectos vistos en producción y su arreglo
| # | Defecto | Arreglo |
|---|---|---|
| 1 | Al cambiar de sección las dos pantallas se fundían encima durante 0,42 s: dos títulos y dos contenidos legibles a la vez. | Relevo: la pantalla que sale se va en 0,12 s y la nueva entra cuando la otra va por la mitad. Nunca hay dos páginas legibles ni un cuadro en blanco. |
| 2 | La hoja de Cooper entraba en ese fundido y su texto se veía doble. | La hoja y el orbe tienen nombre propio de transición y quedan quietos, igual que el riel. |
| 3 | La hoja abría vacía y el contenido aparecía de golpe al terminar el resorte. | El contenido entra a los 0,22 s, cuando la hoja ya tiene su forma, en dos tiempos (cabecera, luego conversación). |
| 4 | El perrito desaparecía al abrir. | Sube a la cabecera de la hoja con un pequeño aterrizaje y vuelve al orbe al cerrar. Su aro dice si escucha, piensa o responde. No es un vuelo literal del botón a la cabecera: el contenido de la hoja se oculta durante el resorte y un vuelo real exigía una capa aparte que no sigue el arrastre de la hoja en el celular. |
| 5 | La página se encogía de golpe al abrir la hoja. | Se recoloca de una vez y reaparece con un fundido de 0,24 s. Probé antes a animar el ancho y lo descarté: recalcula toda la pantalla en cada cuadro (de ~48 a ~12 cuadros en 0,9 s en Inicio). |
| 6 | Tras elegir un destino, el riel seguía desplegado tapando el título de la pantalla nueva. | Se recoge al elegir y vuelve a desplegarse cuando el cursor sale y entra. Con teclado se despliega con el foco visible. |
| 7 | Las respuestas eran texto plano con guiones. | Párrafos, listas y **negritas** reales (`src/lib/formato-mensaje.ts`). No interpreta HTML ni enlaces: lo demás queda como texto. |
| 8 | Lo ya leído se cortaba en seco bajo la cabecera. | Se desvanece. El indicador «pensando» lleva la cara de Cooper. |

## Evidencia (nube, Chromium, sin GPU)
| Comprobación | Resultado |
|---|---|
| lint · typecheck · build | 0 errores, 0 advertencias |
| Unitarias | **718/719** (falla solo la caché privada de Sentinel, ausente aquí). 4 nuevas del formato de mensajes |
| E2E Chromium + demostración (119 pruebas) | **109 pasan / 10 fallan**: 9 por entorno (6 sin Sentinel, 3 por grabación de video; las mismas de siempre) y 1 intermitente ajena (`temas.spec` «cada tarjeta…», que también falla ~1 de 5 en lo desplegado). Corregida la intermitente (sondeo) y repetida 15/15 |
| `e2e/relevo-cooper.spec.ts` (nuevo, 4 pruebas) | 4/4: tiempos del relevo y Cooper fuera de él; riel que se recoge; hoja con contenido y compañero en cabecera; movimiento reducido sin animaciones |
| Fotogramas a 60–900 ms del cambio de sección y de la apertura, 1440 y 390 | Revisados uno a uno: sin páginas superpuestas, hoja estable |

## Errores propios encontrados y corregidos al probar
1. **Animar el ancho de la página** al abrir Cooper tiraba los cuadros de ~48 a ~12 en 0,9 s. Sustituido por un fundido de opacidad.
2. **Robo de foco:** al pasar a Cooper una función nueva en cada pintura, la hoja devolvía el foco al botón mientras se escribía. Lo delataron `accesibilidad-teclado.spec.ts` (2 pruebas). Corregido con identidad estable; 28/28 al repetir.
3. **Listas sin viñetas:** el reinicio global de estilos las ocultaba. Lo vi al revisar la captura; corregido.
4. **El riel se volvía a desplegar** tras el relevo porque el navegador dispara `mouseleave` con el cursor aún encima. Ahora se suelta solo cuando el cursor se mueve fuera.

Tras los puntos 2 y 3 no repetí la batería completa: repetí las pruebas afectadas (`accesibilidad-teclado`, `operacion`, `cooper`, `relevo-cooper`, `temas`), todas en verde.

## Límites reales
- **Fluidez:** este entorno dibuja por software. Abrir Cooper en Inicio da ~40 cuadros en 0,9 s frente a ~48 de la versión desplegada; la diferencia la pone el fundido de opacidad del contenido, barato con GPU y caro sin ella. **Hay que medirlo en la PC (60 fps) antes de desplegar**; si no llega, se retira el fundido (regla `ceder-sitio`) y el resto queda.
- Firefox, WebKit, Sentinel, Lighthouse, datos reales, teléfono físico y Safari: no ejecutados aquí.
- La conversación se reinicia al cambiar de sección (ya era así: cada sección tiene su contexto). No se cambió.
- Las listas se ven al terminar la respuesta; mientras llega palabra a palabra sigue siendo texto corrido.
- Para estados del perrito con expresiones distintas hacen falta las 5 imágenes en alta pendientes de Walter; hoy el estado se indica con el aro.

## Pendientes de Walter
1. Autorizar en la PC la puerta completa, la medición de fluidez y el despliegue de la rama `pulido`.
2. Entregar las 5 imágenes del perrito (reposo, escucha, piensa, responde, celebra) si quiere expresiones.
3. Decidir si la conversación debe conservarse al cambiar de sección.
