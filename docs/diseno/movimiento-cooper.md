# Dirección de movimiento de Cooper

21-11-2026. Misión `cooper-animacion2`, base `cooper-cobertura` (`d98d497`).

## Dirección propia: la sala de montaje

Una idea llega, se convierte en piezas y espera la mirada de su autor. Tres escalas: Cooper responde; las piezas se ensamblan; la luz señala el recorrido. Negro con fuego, ojo celeste y ojo verde-marrón. La C con patita sigue identificando el producto. Esta misión amplía explícitamente la especificación inicial que reservaba el perro al chat: Walter lo pide ahora en bienvenida, vacíos y celebración.

Se conservan grafito `#191d20`, fondo `#101214`, marfil `#f0eee7`, celeste `#a6d7ed`, fuego `#b17f5c`, arena `#cbbb9f` y los equivalentes claros. Manrope local; lectura izquierda; explicación de hasta 62ch. La cabecera reúne título, escena del oficio y acción. Inicio reúne conversación/Cooper y fábrica/doce etapas. En móvil la escena se comprime junto al título sin ocultar controles.

Revisión del concepto: cuatro monitores idénticos resultaban genéricos; se cambiaron por investigación, hoja de guion, imagen y onda de sonido. Cada cabecera usa el mismo material con un gesto distinto: barrido en Radar, fechas en Rutina, conexiones en Redes, hojas en Referencias, barras en Publicados. No se importaron plantillas, ilustraciones ni código visual de otros productos. La animación no se presenta como un video producido: el recorrido real de etapas sigue siendo la fuente de progreso.

## Referencias actuales y traducción

Consulta de páginas oficiales y observación de entrada/scroll con Chromium/Playwright; capturas y observaciones DOM en `cooper/.cache/referencias/`. El navegador integrado no estuvo disponible. No se hicieron logins ni se enviaron datos del proyecto. Estas son interpretaciones visuales, no mediciones de las curvas internas de terceros.

| Referencia | Principio observado | Traducción propia |
| --- | --- | --- |
| [Linear](https://linear.app/) | Jerarquía oscura y llegada escalonada de la demostración; el título temprano aún está en transición. | Título reconocible primero, escena después; sin desenfocar texto ni retener el contenido. |
| [Stripe](https://stripe.com/) y [artículo oficial de Connect](https://stripe.com/blog/connect-front-end-experience) | Producto y datos en capas; el artículo explica secuencias encadenadas con Web Animations. | Tres hojas, un haz de luz y un recorrido, con la paleta de Cooper y sin maquetas financieras. |
| [Raycast](https://www.raycast.com/) | Contraste y demostración de producto como foco; capturas públicas conservadas. | Cada escena explica el oficio de la pantalla y deja la acción en primer plano. |
| [Predis.ai](https://predis.ai/) | Galería de resultados audiovisuales en movimiento, con muchos estímulos simultáneos. | Dar vida al material de trabajo, con un foco por cabecera y sin autoplay de videos externos. |
| [Apple](https://www.apple.com/airpods-pro/), [Vercel](https://vercel.com/), [Framer](https://www.framer.com/) | Consulta oficial de narrativa por producto y estructura de secciones. | Identidad reconocible durante todo el recorrido. Esta consulta textual no se declara una medición de sus animaciones. |
| [Arc](https://arc.net/) | La página actual anuncia su cierre; no es la portada histórica de las recopilaciones de diseño. | No fundamentar decisiones actuales en una versión antigua no comprobada. |
| [197 Historias Ilustradas](https://www.197historiasilustradas.com/) | Introducción con pausas y opción de omitir, seguida de exploración. SOTD 20-11-2026 según el [índice oficial de Awwwards](https://www.awwwards.com/websites/sites_of_the_day/). | Bienvenida voluntaria de tres actos, cerrable con Escape y retorno del foco; sin introducción obligatoria. |
| [Carter Ogunsola](https://carterogunsola.com/) | Preloader numérico y planos canvas en la entrada inspeccionada. SOTD 19-11-2026 en el mismo índice. | Entrada con intención, pero poster desde SSR en Cooper; sin WebGL ni porcentaje de carga ficticio. |

Diferencia frente a Linear, Stripe y Predis: anfitrión de ojos distintos, materiales de edición, doce etapas y dos aprobaciones humanas. No se promete originalidad legal ni se atribuyen a terceros las curvas que elegimos.

## Partitura

| Momento | Gesto / ritmo | Coste y variante quieta |
| --- | --- | --- |
| Ruta | Contenedor 10px/560ms; título 12px/680ms. Contenido disponible desde el primer render. | Transform, sin cortina ni espera de salida. Pausa: posición final. |
| Cabeceras | Tres planos; luz 8s; respiración 4px/6s; barrido 5,8s. Radar 8s, órbita de redes 24s. | Transform/opacity, sombra y gradiente estáticos. Fuera del viewport se detienen. |
| Scroll | Desfase 0–20px en 700px de scroll. | CSS scroll timeline, sin listeners por fotograma. Fallback estático. |
| Cooper recibe/reacciona | Gesto, parpadeo y ojos de dos colores en 4s; inclinación al escuchar. La cara del chat conserva boca por palabras. | Lottie SVG ligero; formas estáticas y matrices transform. Poster equivalente si falla el motor. |
| Fábrica | Investigación, guion, imagen y sonido se elevan en secuencia; la luz avanza por el carril. | Lottie, solo posición/opacidad. Detenida en pausas, cancelación, aprobación y publicación. |
| Vacío | Cooper recibe junto a la acción concreta para empezar. | Carga diferida; copia y acción siempre presentes. |
| Bienvenida | Idea, producción, decisión. Entradas 420–550ms; avance manual. | Dialog nativo, teclado, Escape y devolución del foco. Pausa/reducido estáticos. |
| Publicación | Gesto de Cooper y seis brasas, una vez; aviso 9s con cierre manual. | Solo ante cambio de etapa anterior a Publicado recibido por estado/SSE; no al seleccionar un video ya publicado. Pausa: aviso estático. |
| Números y gráficos | Rodillos de tamaño fijo 700ms; despliegue horizontal del gráfico 600ms. | Sin setState por frame, ancho animado ni stroke-dashoffset. Valores y tabla accesibles. |
| Carga y feedback | Fotogramas que respiran, skeletons y confirmaciones breves. | Transform/opacity, texto de estado, ningún progreso inventado. |

Curva propia principal: `cubic-bezier(.22,1,.36,1)`, impulso breve y asentamiento largo. Bucles con ease-in-out; Radar lineal. Se conservan los resortes existentes y respuesta de 180ms. Las acciones nunca esperan el final de un adorno.

## Arquitectura, respeto y rendimiento

`cooper/scripts/generar-movimiento.mjs` es la fuente editable original de cuatro Lottie y sus posters SVG, sin activos externos. Lottie-web 5.13.0 (MIT), variante `lottie_light` sin expresiones, responde a la solicitud explícita de Rive/Lottie. Framer Motion y CSS siguen atendiendo gestos y escenas simples. Motor y JSON se cargan al entrar al viewport; se destruyen al desmontar; fallar la descarga conserva el poster. No hay filtros animados, WebGL ni videos decorativos.

`cooper-motion-paused` guarda la pausa, se propaga entre pestañas y tiene respaldo en memoria si se bloquea localStorage. `prefers-reduced-motion` se escucha en vivo. Ocultar la pestaña suspende los efectos; volver conserva la decisión del usuario. No se afirma que transform/opacity garantice composición GPU en todos los navegadores: Chromium decide la promoción de capas.

Objetivo de laboratorio: 60Hz nominales, muestra >=57fps (5% de tolerancia), p95 <=25ms, ningún frame/long task de 100ms durante movimiento activo, CLS <=0,01. CPU 4× a 390px y normal a 1440px. Lighthouse >=95 en rendimiento, accesibilidad/buenas prácticas 100, ninguna advertencia. No equivale a certificar un teléfono físico ni Core Web Vitals de campo.

Fuentes técnicas oficiales consultadas antes de implementar: [Lottie loadAnimation](https://github.com/airbnb/lottie-web/wiki/loadAnimation-options), [play/pause/destroy](https://github.com/airbnb/lottie-web), [Motion scroll](https://motion.dev/docs/react-use-scroll), [PerformanceObserver](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver), [videos Playwright](https://playwright.dev/docs/videos). Next: guía instalada `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`. No se añadió ninguna API de producción.

## Reproducción

`COOPER_MOVIMIENTO_RONDA=ronda-1 npm run test:e2e -- --config=playwright.movimiento.config.ts`, después `ronda-2`. Bases temporales, puertos libres y sesiones ficticias. Se reutiliza el adaptador de Sistema Sentinel, con guardián y umbrales conservados. Playwright añade FPS/p95, long tasks, CLS, pausas reales, axe y grabaciones. `node scripts/auditoria.mjs --movimiento` audita todas las rutas privadas y la entrada, ambos temas/tamaños. `node scripts/indice-movimiento.mjs` genera el índice de videos. Resultados medidos, correcciones y límites en [el informe de la misión](../informes/cooper-animacion-fuerte.md).
