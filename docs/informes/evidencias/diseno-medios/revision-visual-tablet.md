# Revisión visual independiente: tablet

Fecha: 21 de noviembre de 2026, Lima. Misión `diseno-medios`.

Se revisaron las 33 pantallas a **768 y 1024 px: 66 capturas, ninguna faltante**. La inspección comprende las doce hojas de contacto y los originales pertinentes, incluidos los tramos completos de los formularios largos. No se modificó el producto durante esta revisión ni se ejecutaron pruebas, reproducción o FFmpeg en paralelo con la puerta de rendimiento.

**Esta tanda no acredita la puerta de diseño.** Hay un defecto de composición en las cartelas de medios de Fábrica, comunicado al responsable de interfaz para su corrección, y desviaciones importantes del armazón heredado respecto a `docs/diseno/DIRECCION.md`. No basta con que el contenido quepa en la ventana: la jerarquía, el protagonismo del video y la legibilidad todavía requieren trabajo de las misiones de armazón correspondientes.

## Evidencia e identidad de la tanda

Origen de las capturas: `.cache/diseno-medios-ci/evidencias-diseno/{pantalla}-{ancho}.png`.

Manifiestos revisados:

| Archivo | SHA-256 |
|---|---|
| `matriz-768.json` | `a563fc75fe7e7eeb2977d11f24badaf5029c248b60f1f7ba2c1482cd8958b9f1` |
| `matriz-1024.json` | `641ec815f05052e7276374056a6b0b147a818806f3b2531827a3397d5d046fa7` |

Hojas de contacto: `.cache/revision-tablet/contacto-{768,1024}-{1..6}.jpg`. Para leer los formularios de extremo a extremo se generaron recortes consecutivos, sin reescalar, de `canal`, `admin-fabrica` y `publicados`; el corte entre esos archivos es instrumental y no un recorte de la aplicación.

| Medición del manifiesto | 768 px | 1024 px |
|---|---:|---:|
| Pantallas y PNG existentes | 33 | 33 |
| Desbordamientos horizontales registrados | 0 | 0 |
| Hallazgos axe registrados | 0 | 0 |
| Eventos de consola | 1 | 1 |
| Registros de tokens fuera de la lista auditada | 5.045 | 5.099 |
| Registros de tamaño de fuente inferior al mínimo | 256 | 256 |

Los recuentos de tokens corresponden a propiedades de elementos, no a problemas únicos: incluyen repeticiones del armazón y algunos nodos ocultos. El reparto es `color` 2.468/2.484, `backgroundColor` 565/579 y cada una de las cuatro esquinas de radio 439/445, además de los 256 registros tipográficos por ancho. Entre los textos visibles pequeños están el control de movimiento de 10 px, el nombre del espacio de 11 px, la etiqueta de demostración de 10 px y los números de etapas de 9 px.

La consola de cada manifiesto contiene exactamente `Failed to load resource: the server responded with a status of 404 (Not Found)`. No incluye la URL: **no se atribuye aquí a un medio ni se da por inocuo**. La matriz contiene una visita deliberada a `/inexistente`, pero esa coincidencia no demuestra por sí sola el origen del evento.

## Inventario de las 66 capturas

Cada fila confirma revisión en ambos anchos. El nombre identifica directamente sus dos PNG en el directorio anterior. «Sin recorte» describe lo visible; no certifica foco, teclado o interacción.

| Pantalla | 768 | 1024 | Observación visual |
|---|:---:|:---:|---|
| `inicio` | Sí | Sí | Composición dividida chat/fábrica; cartelas de cola con recorte y chip sobre texto. |
| `fabrica` | Sí | Sí | Mismo estado que Inicio; miniatura principal muy estrecha, etapas dominantes y cola afectada. |
| `videos` | Sí | Sí | Filas y miniaturas alineadas, títulos completos al lado, estados separados; sin solapamiento observado. |
| `detalle-video` | Sí | Sí | Póster tipográfico protagonista contenido; a 1024 las etapas ocupan una columna lateral. |
| `aprobacion-guion` | Sí | Sí | Guion y decisiones dentro de sus bloques; predominio del texto sobre la pieza. |
| `aprobacion-final` | Sí | Sí | Marco reservado y acciones delimitadas; no imagen genérica suplantando un render. |
| `publicado` | Sí | Sí | Póster y estado reconocibles; sección de publicación extensa y separada del medio. |
| `pedir-video` | Sí | Sí | A 768 se truncan etiquetas seleccionadas de controles nativos estrechos; resto del formulario cabe. |
| `publicados` | Sí | Sí | Tres tarjetas métricas altas; póster pequeño y legible junto al título, muy por debajo de filtros. |
| `aprendizaje` | Sí | Sí | Filtros y tarjetas legibles; jerarquía de formulario heredada, sin composición de línea de tiempo. |
| `marcas` | Sí | Sí | Estado vacío y acción reconocibles, con espacio amplio y decoración de cabecera repetida. |
| `canales` | Sí | Sí | A 768 formulario apilado; a 1024 columna de formulario lateral. No recortes observados. |
| `canal` | Sí | Sí | Biblia de 7.141/4.088 px de alto; campos y botones completos, ritmo repetitivo sin agrupación suficiente. |
| `radar` | Sí | Sí | Cabecera, pestañas y contenido dentro del ancho; saltos de pestañas añaden altura. |
| `rutina` | Sí | Sí | Formularios ordenados; dos columnas a 1024 y apilado a 768. |
| `redes` | Sí | Sí | Redes y formularios delimitados; la columna lateral a 1024 resulta estrecha. |
| `referencias` | Sí | Sí | Bloques y acciones dentro del ancho, con cabecera decorativa dominante. |
| `cuentas` | Sí | Sí | Estados y formularios claros; cambio de columnas consistente entre ambos anchos. |
| `programados` | Sí | Sí | Mensaje de estado y acciones visibles; espacio vacío amplio. |
| `decisiones` | Sí | Sí | Listado y bloques textuales legibles, sin medios protagonizando la pantalla. |
| `incidencias` | Sí | Sí | Estado y acciones acotados; no solapamientos observados. |
| `avisos` | Sí | Sí | Lista legible, alineación coherente con el resto de Operación. |
| `avatares` | Sí | Sí | Catálogo ilustrativo identificado como simulado; tarjetas y acciones dentro de sus límites. |
| `voces` | Sí | Sí | Muestras y controles visibles; no confundir catálogo simulado con medios reales de videos. |
| `crear-avatar` | Sí | Sí | Formulario largo con campos alineados; títulos envuelven sin invadir acciones. |
| `crear-voz` | Sí | Sí | Flujo vertical claro, campos y controles completos. |
| `perfil` | Sí | Sí | Formulario legible; persiste selector Noche/Día/Sistema del armazón anterior. |
| `admin` | Sí | Sí | Contenido administrativo completo, densidad y tarjetas heredadas. |
| `admin-fabrica` | Sí | Sí | Formulario de 5.393/3.058 px; todos sus tramos inspeccionados, controles y botón final completos. |
| `entrada` | Sí | Sí | Composición de acceso encajada en ambos anchos, con ilustración y paleta heredadas. |
| `entrada-error` | Sí | Sí | Error y acción distinguibles, sin recorte del texto observado. |
| `no-encontrado` | Sí | Sí | Estado 404 y acción legibles, amplio espacio negativo. |
| `enlace-vencido` | Sí | Sí | Estado de enlace y salida visibles, sin medios ni controles superpuestos. |

## Hallazgos propios de medios

1. **Cartelas de Fábrica: defecto visible que requiere revalidación.** En `fabrica-768.png`, cola «En la mesa de edición», el chip de etapa invade el título de las miniaturas y el inicio del título de la cuarta cartela queda fuera del marco. A 1024 los primeros títulos quedan demasiado bajos y los chips se interponen en el texto. También se observa en `inicio`. Es un problema de espacio del componente; el arreglo debe conservar el mínimo de 12 px, separar chip/título y limitar líneas dentro del marco. Se comunicó al responsable de interfaz; la matriz posterior a su corrección determinará el estado final.
2. **Miniatura principal de 64 × 64 px:** el título «El mar también respira» se parte como «tambié / n…» en ambos anchos. El título adyacente sí está completo. No hay pérdida de identificación del video, pero la cartela estrecha resulta poco cuidada y debe revalidarse junto a la cola.
3. **Póster grande tipográfico:** el estado sin fuente utiliza título y acento del canal. Ya no contiene etiquetas pequeñas de canal o pie. No se observa recorte en el protagonista del detalle. Las miniaturas pequeñas usan título HTML y mantienen otra versión legible fuera del marco; la duplicación es repetitiva, aunque hace posible identificar la pieza sin depender del póster.
4. **Fuentes demostradas:** esta matriz usa cuatro videos de demostración. Las cartelas tipográficas son coherentes con la ausencia de originales en esa simulación; las 66 imágenes no prueban la descarga de las redes ni la presencia de medios de producción. No aparece la ilustración de montañas como sustituto de un póster de video en estas pantallas. La ilustración decorativa de etapas/cabecera es parte del armazón y no acredita contenido real.
5. **Comprobación auxiliar del medio vertical:** se inspeccionaron `medios-detalle-768.png` y `medios-detalle-1024.png` del mismo directorio. El video de patrón sintético se presenta entero, centrado y con bandas laterales, sin estiramiento ni corte vertical; a 768 las etapas quedan debajo y a 1024 al lado. No es un original de la fábrica. Esas dos capturas muestran «Reconectando» en la cabecera; una imagen fija no determina si el estado es transitorio.

## Hallazgos del armazón heredado

- **Protagonismo insuficiente del video.** Inicio/Fábrica sigue dividido entre un chat alto con mucho vacío y una columna de etapas; el medio ocupa una miniatura. Publicados dedica primero la pantalla a filtros y después a tres tarjetas de métricas de más de 3.000 px de altura total, con póster pequeño. La misión aporta medios, pero esa estructura no satisface por sí sola la composición protagonista dirigida por Claude.
- **Lenguaje visual anterior.** Persisten paleta celeste/grafito, cabeceras ilustradas genéricas, radios y tipografía anteriores. Los miles de registros de tokens reflejan esa diferencia. No se convierte esta evidencia en una aprobación estética porque los tests funcionales pasen.
- **Texto inferior a 12 px.** La navegación, el control de movimiento, las etapas y metadatos tienen ejemplos visibles de 9–11 px. Los nuevos pósteres no justifican conservar esos tamaños en el armazón. El SVG de título de 72 px en un lienzo de 1.600 px proporciona aproximadamente 15,3 px en un marco de 340 px; por debajo de 267 px de ancho esa equivalencia cae de 12 px, limitación ya documentada en la guía de medios. Las miniaturas compactas requieren el título HTML del componente, no reducir el SVG y considerarlo texto legible.
- **Formulario de petición a 768 px.** Las selecciones «Selecciona un canal» y «Solo en algunas partes» no se leen completas en sus controles estrechos. Se conserva el ancho global, pero eso no equivale a una etiqueta usable. La misma composición a 1024 respira mejor.
- **Rail lateral a 768 px.** En las capturas completas se ve «Cerrar sesión» parcialmente cortado cerca del borde inferior del rail fijo. Esta inspección no verificó desplazamiento interno ni acceso por teclado; se registra únicamente el recorte visible.
- **Ritmo de formularios y navegación.** Biblia y Ajustes de fábrica alargan la página por repetición de campos/botones, aunque los campos caben. Las pestañas de Operación envuelven a dos líneas. Hay consistencia de márgenes y alineación, pero la jerarquía no ayuda lo suficiente a recorrer esos formularios.
- **Tema.** Perfil conserva Noche/Día/Sistema, divergencia del mandato de tema oscuro de la dirección. La revisión no amplía el alcance de esta misión para cambiarlo.

## Límites y seguimiento

La inspección es estática: no mide CLS, foco, reproducción, latencia, fallos intermitentes ni interacción de teclado. Los manifiestos aportan sus propios resultados de axe/desbordamiento; no sustituyen la revisión visual. La evidencia de derivados de originales reales está documentada por separado en `derivados-reales.json` y el diagnóstico de fuentes.

Queda pendiente revalidar Inicio/Fábrica con las capturas posteriores a la corrección de las cartelas y atribuir el evento 404 antes de afirmar consola limpia. Los hallazgos de armazón se entregan a la dirección de diseño como pendientes existentes, sin introducir cambios de producto durante esta revisión ni presentarlos como aprobados.
