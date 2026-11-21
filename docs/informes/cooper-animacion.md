# Cooper — animación y dirección de movimiento

20 de noviembre de 2026. Rama `cooper-animacion`, worktree `/home/david/Proyectos/cooper-wt/cooper-animacion`. Base `96bc916`. Ensayo local con datos ficticios. Sin push, merge, despliegue, OAuth, pagos ni acceso a D&S Factory. Los directorios no versionados `docs/diseno/` y `docs/misiones/` ya existían y no se incorporaron a los commits.

## Dirección y alcance

Se conserva la sala de edición de la especificación: fondo `#101214`, grafito `#191d20`, marfil `#f0eee7`, celeste `#a6d7ed` y arena `#cbbb9f`, con equivalentes claros y Manrope local. La fábrica comunica avance; Cooper responde a la conversación; los controles confirman acciones. Se cargan las funciones de Framer Motion con `LazyMotion` después de hidratar la interfaz, y cada rodillo usa un único nodo de texto. No se introduce otra biblioteca ni se cambia el contrato del chat o la fábrica.

- Entrada: palabras con secuencia continua entre líneas; recorrido Idea–Creación–Publicación en escritorio y móvil; C vectorial revelada mediante una máscara transformada y huella escalonada. Se evita animar `stroke-dashoffset`, filtros o dimensiones.
- Navegación: `LayoutGroup`, titular compartido entre rutas e indicador lateral con `layoutId`. Indicadores compartidos también en las pestañas móviles, filtros de videos, biblioteca y periodos administrativos.
- Fábrica: doce etapas, pulso solo durante producción activa, conectores con relleno por `scaleY`, barra por `scaleX`, porcentaje con rodillos y destello único cuando una etapa pasa a completada. Cambiar de pieza no dispara destellos de progreso ficticio. Las tarjetas llegan escalonadas y se inclinan hasta 2,5° por eje con ratón; teclado y táctil conservan toda la funcionalidad.
- Cooper: parpadeos cada 3–7 segundos, mirada limitada a ±3/±2 unidades SVG, orejas al escuchar y estados de reposo/escucha/pensamiento/respuesta. Boca y énfasis de palabras comparten duración, puntuación y pausa; conservan espacios y saltos de línea. Se limpian timers, observadores y listeners al desmontar, pausar u ocultar la cara.
- Chat: mensajes nuevos con resorte, historial estable, indicador de escritura, onda al grabar y adjuntos con miniatura privada de imagen, enlace y retirada animada. Los errores siguen siendo legibles y recuperables.
- Microinteracciones: presión de botones, confirmación de selección, indicador de pausa, avisos/toasts en línea, shimmer de skeletons, contadores de producción y gasto, barras administrativas que se dibujan.
- Accesibilidad y carga: suscripción reactiva a `prefers-reduced-motion`; pausa durante navegación y suspensión cuando la pestaña del navegador está oculta. Precarga de Manrope mediante `next/font/local` y ancho reservado de ambos indicadores de conexión para evitar desplazamientos al pasar a «En vivo». El contenedor de la página se pinta sin desplazamiento inicial; las transiciones compartidas se concentran en el titular y los indicadores para no retrasar el LCP.

## Partitura de movimiento

| Efecto | Disparador y recorrido | Tiempo y curva | Coste / alternativa reducida |
| --- | --- | --- | --- |
| Titular | Montaje, ascenso de 0,14 em por palabra | 420 ms, separación 45 ms, `(0.22,1,0.36,1)` | Transform/opacity; texto completo y quieto |
| C y huella | Montaje, máscara vertical y huella | 700 ms; huella 260 ms desde 460 ms | Transform/opacity sobre SVG pequeño; marca completa |
| Idea → publicación | Dos segmentos desplazados | Ciclo de 6 s, segundo segmento a 1,2 s | Transform/opacity; línea estática |
| Rutas / selección | Cambio de ruta o pestaña | Titular 240 ms; resorte 360/32 | Transform/opacity; selección inmediata |
| Producción | Cambio de etapa recibido | Relleno 600–650 ms; destello 650 ms | Transform/opacity; datos finales inmediatos |
| Tarjetas | Montaje / posición del ratón | 460 ms + 60 ms por pieza; inclinación 160 ms | Transform/opacity; tarjeta quieta |
| Cara | Cursor / estado / parpadeo | Mirada 140 ms; estado 350–650 ms; parpadeo 180 ms | MotionValues sin renders por frame; cara quieta |
| Respuesta | Texto confirmado por el chat | 110–320 ms por palabra + 160 ms de puntuación; máximo total 8 s | Transform/opacity; texto completo, boca quieta |
| Mensajes / adjuntos / avisos | Enviar, adjuntar, confirmar | Resorte 360/32; 180 ms; 240 ms | Transform/opacity; aparición inmediata |
| Grabación / escritura | Trabajo activo | 650 ms / 1,2 s | Transform/opacity; estado textual conservado |
| Skeleton / cifras / gráficos | Carga / cambio de datos o periodo | 1,8 s / 700 ms / 700 ms | Transform/opacity; marcador o valor final |

No se anima `width`, `height`, `top`, `left`, color ni filtros. El revelado SVG puede requerir pintura local del vector aunque la propiedad animada sea transform; no se afirma que cada SVG sea una capa independiente del compositor. Se mantienen texto y cifras accesibles fuera de los rodillos decorativos.

## Commits

| Commit | Contenido |
| --- | --- |
| `a646a01` | Sistema de movimiento, fábrica, chat, cara, navegación, microinteracciones y precarga de fuente. |
| `4519f5c` | Cuatro E2E específicos, WebM/capturas, muestra de fluidez y auditoría con umbral 100. |
| `799c942` | Entrada y pestaña activa móviles. |
| `71b2980` | Secuencia tipográfica continua y capturas de entrada. |
| `4b48dc4` | Reserva de ancho de la etiqueta de conexión de la fábrica. |
| `62e9bd7` | LazyMotion asincrónico y rodillos con menos nodos para reducir trabajo inicial. |
| `95ee541` | Pintado inicial sin desplazamiento del contenedor global; se conservan transiciones compartidas. |
| `HEAD` de entrega | Informe final y comandos de reproducción en README; sin cambios de ejecución. |

El commit de entrega añade únicamente este informe y la guía de reproducción al README.

## Verificación

Código verificado: `95ee541`. Puerta completa ejecutada de nuevo después de los ajustes finales:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

| Comprobación | Resultado | rc |
| --- | --- | --- |
| `npm ci` | Instalación limpia, 0 vulnerabilidades | 0 |
| `npm run lint` | 0 errores y 0 advertencias | 0 |
| `npm run typecheck` | TypeScript estricto | 0 |
| `npm test` | 117/117, 15 archivos, sin omisiones | 0 |
| `npm run test:e2e` | 26/26 Chromium, sin omisiones | 0 |
| `npm run build` | Build de producción | 0 |
| `node --test tests/flujos_v2.test.cjs` | 119/119, sin omisiones | 0 |

Cadena completa **rc 0**, sin errores ni advertencias. Evidencia: [puerta-final.log](../../cooper/.cache/animacion/puerta-final.log) y [flujos-v2.log](../../cooper/.cache/animacion/flujos-v2.log). Node 24.22.3, npm 12.2.2, Next.js 16.4.6, React 19.3.1, Framer Motion 12.43.0, Playwright 1.65.1 y Chromium 159.0.8154.6. Servidores loopback, puertos libres, bases separadas, autenticación cifrada emitida por el fixture existente y credenciales efímeras no impresas. No se leyeron archivos `.env` reales.

Los E2E cubren las funciones existentes y cuatro casos de esta misión: recorrido grabado con estados/adjuntos; pausa y preferencia reducida sin recarga; muestra de fluidez; y un evento SSE ficticio de avance 7→8 para comprobar relleno, destello que se extingue y porcentaje final. Se conservan los ensayos funcionales del simulador de fábrica, ambas aprobaciones, permisos, errores de red, micrófono y privacidad. Axe sin violaciones en los escenarios de pantallas, formularios y ambos temas. Sin desbordamiento en 360/390/768/1024/1440/1920 px.

[fluidez.json](../../cooper/.cache/animacion/fluidez.json): muestra de `requestAnimationFrame` durante 2,5 s por condición, **60,00 fps** con CPU normal y **60,00 fps** con CPU 4×; percentil 95 de intervalo **16,8 / 16,7 ms**, CLS **0 / 0**. Las animaciones inspeccionadas exponen solo transform/opacity. Es evidencia de laboratorio, no medición de cada fotograma presentado por una GPU física.

### Lighthouse

**32/32 combinaciones en 100 rendimiento / 100 accesibilidad / 100 buenas prácticas**, sin advertencias ni auditorías binarias fallidas; **CLS 0 en todas**. Ocho rutas (inicio, canales, videos, detalle, biblioteca, perfil, administración y entrada), móvil/escritorio y ambos temas privados; la entrada conserva su tema público oscuro. Auditoría completa sobre el build de `95ee541`, con Lighthouse 13.6.0 y movimiento habilitado.

| Tema | Dispositivo | Mediciones | LCP máximo | TBT máximo | CLS máximo |
| --- | --- | --- | --- | --- | --- |
| oscuro | mobile | 8 | 634 ms | 59.5 ms | 0 |
| oscuro | desktop | 8 | 169 ms | 0.0 ms | 0 |
| claro | mobile | 8 | 635 ms | 39.5 ms | 0 |
| claro | desktop | 8 | 169 ms | 0.0 ms | 0 |

Informes HTML y [resumen JSON](../../cooper/.cache/animacion/lighthouse/resumen.json); [log completo, rc 0](../../cooper/.cache/animacion/lighthouse-final.log). La primera carga móvil del inicio registró LCP **634 ms**, TBT **59,5 ms** y CLS **0**. Se midió con el ejecutor de laboratorio existente, conservando autenticación entre mediciones; no son datos de campo ni una garantía de puntuación constante.

Se conservaron las auditorías previas en `.cache/animacion/lighthouse-previa/` y `.cache/animacion/lighthouse-carga-previa/`: mostraron el cambio de ancho de la conexión, bloqueo inicial y un LCP tardío antes de las correcciones. El resultado final no sustituye ni oculta esos hallazgos.

### Capturas y vídeo

[recorrido.webm](../../cooper/.cache/animacion/recorrido.webm) registra entrada, elección de pieza, mirada, pensamiento, respuesta, grabación, miniatura de adjunto y administración. 14 capturas de entrada en revelado/final, fábrica, respuesta, escucha, adjunto, administración y seis anchuras con movimiento reducido en [`.cache/animacion/`](../../cooper/.cache/animacion/). Se revisaron visualmente entrada, fábrica, adjunto y móvil; las capturas complementan las aserciones del navegador. La suite habitual regenera además sus capturas de todas las pantallas en `.cache/capturas-final/`.

Reproducción de la evidencia específica: `cd cooper && npm run test:e2e -- --project=demostracion animacion.spec.ts`. Auditoría: `node scripts/auditoria.mjs --animacion` después de compilar. El nuevo flag exige 100 en las tres categorías y rechaza advertencias o comprobaciones binarias fallidas.

## Fuentes y herramientas

Documentación oficial consultada antes de utilizar las APIs:

- [Motion: layout y elementos compartidos](https://motion.dev/docs/react-layout-animations), [MotionValues](https://motion.dev/docs/react-motion-value), [LazyMotion](https://motion.dev/docs/react-lazy-motion), [reducción del bundle](https://motion.dev/docs/react-reduce-bundle-size), [useAnimate](https://motion.dev/docs/react-use-animate), [useInView](https://motion.dev/docs/react-use-in-view) y [movimiento reducido](https://motion.dev/docs/react-use-reduced-motion).
- [React: useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore). La inspección de `framer-motion/dist/es/utils/reduced-motion/use-reduced-motion.mjs` mostró que la versión instalada conserva la preferencia inicial; el E2E reprodujo que la mirada seguía moviéndose al cambiarla en vivo. La suscripción propia corrige ese defecto y la prueba pasa con el cambio sin recargar.
- Guías locales de Next.js 16.4.6 en `node_modules/next/dist/docs/`: componentes cliente/servidor y API `next/font/local` con preload y ajuste de fallback.
- [Playwright: vídeo](https://playwright.dev/docs/videos) y [CDPSession](https://playwright.dev/docs/api/class-cdpsession); [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API), [Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) y [PerformanceObserver](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver/observe).

Herramientas utilizadas y comprobadas: filesystem/CLI/Git del worktree, consulta web, Chromium local mediante Playwright, axe y Lighthouse. Se inspeccionó el inventario de herramientas disponibles; los conectores de diseño/medios no eran necesarios y no se invocaron ni se comprobó su autenticación. No se enviaron archivos del proyecto a servicios creativos.

## Limitaciones reales

- Las mediciones son de Chromium local con simulación de CPU; no son métricas de campo ni garantizan 60 fps en cualquier teléfono. Axe tampoco certifica por sí solo conformidad WCAG completa.
- La boca sigue el texto y sus pausas, sin audio sintetizado ni alineación fonética. La onda indica grabación activa, no amplitud real del micrófono. El contrato de producción y los simuladores existentes se conservan.
- El logo se revela por máscara transformada sobre su path, sin modificar el trazado ni animar el guionado del contorno.
- «Pausar movimiento» permanece durante la navegación de la sesión montada; no se añade una preferencia persistida entre recargas.
- La evidencia audiovisual y los informes de laboratorio están excluidos de Git en `.cache/`; se reproducen con el ejecutor E2E y el comando de auditoría. No se ha contactado ninguna instancia real de n8n.

## Pendientes de Walter

- Revisar el ritmo del WebM y la cara de Cooper en un teléfono físico y confirmar la dirección artística.
- Revisar e integrar estos commits mediante el proceso habitual. No hay despliegue realizado ni autorización técnica pendiente que impida revisar la implementación local.
