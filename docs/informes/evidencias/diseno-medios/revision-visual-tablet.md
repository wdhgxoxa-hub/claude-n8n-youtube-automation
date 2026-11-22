# Revisión visual independiente: tablet

Fecha: 21 de noviembre de 2026, Lima. Misión `diseno-medios`.

Se revisaron las 33 pantallas a **768 y 1024 px: 66 capturas, ninguna faltante**. La inspección inicial comprende las doce hojas de contacto y los originales pertinentes, incluidos los tramos completos de los formularios largos. Tras corregir las cartelas, se volvieron a inspeccionar los cuatro originales de Inicio/Fábrica de la tanda final de las 22:41, sobre `9f3a910` (producto `53b17df`, correcciones visuales `4b862e8` y `5fc8495`). No se modificó el producto durante esta revisión ni se ejecutaron pruebas, reproducción o FFmpeg en paralelo con la puerta de rendimiento.

**Esta tanda no acredita la puerta de diseño global.** El defecto de composición de las cartelas de medios de Fábrica quedó corregido y comprobado en los cuatro originales finales. Persisten desviaciones importantes del armazón heredado respecto a `docs/diseno/DIRECCION.md`. No basta con que el contenido quepa en la ventana: la jerarquía, el protagonismo del video y la legibilidad todavía requieren trabajo de las misiones de armazón correspondientes.

## Evidencia e identidad de la tanda

Origen de las capturas: `.cache/diseno-medios-ci/evidencias-diseno/{pantalla}-{ancho}.png`.

Manifiestos finales revisados, escritos el 21 de noviembre de 2026 a las 22:41:17 y 22:41:50 de Lima respectivamente:

| Archivo | SHA-256 |
|---|---|
| `matriz-768.json` | `2de0233be3a9d17008b1f45621b0a8d97a0762b2df0da72ae2f927b7a7d0fb1a` |
| `matriz-1024.json` | `3cbb8ca2a3093c69141c901e9ab3bfba762a0cda6bee2edc83a811c9bee03125` |

Hojas de contacto de la revisión inicial: `.cache/revision-tablet/contacto-{768,1024}-{1..6}.jpg`. Para leer los formularios de extremo a extremo se generaron recortes consecutivos, sin reescalar, de `canal`, `admin-fabrica` y `publicados`; el corte entre esos archivos es instrumental y no un recorte de la aplicación. Los cuatro originales finales de Inicio/Fábrica se inspeccionaron directamente, sin reutilizar sus miniaturas de contacto antiguas. Los hashes iniciales terminaban en `958b9f1` y `46fa7`; se conservan completos en el commit `ad92847` para distinguir ambas tandas.

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

Cada fila confirma revisión en ambos anchos. El nombre identifica directamente sus dos PNG en el directorio anterior. Inicio/Fábrica incluyen la revalidación final; las otras 31 pantallas conservan la revisión visual inicial. Los manifiestos finales confirman de nuevo que existen los 66 PNG y aportan las métricas de la tabla anterior. «Sin recorte» describe lo visible; no certifica foco, teclado o interacción.

| Pantalla | 768 | 1024 | Observación visual |
|---|:---:|:---:|---|
| `inicio` | Sí | Sí | Revalidación final: cartelas dentro del marco y chips separados del título; persiste división chat/fábrica. |
| `fabrica` | Sí | Sí | Revalidación final: cola corregida; miniatura principal estrecha pero limitada a dos líneas, sin fragmento suelto. |
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

1. **Cartelas de Fábrica: corregidas y revalidadas.** La primera tanda mostraba chips de etapa sobre los títulos y un inicio de título fuera del marco. En `inicio-768.png`, `fabrica-768.png`, `inicio-1024.png` y `fabrica-1024.png` finales, cada chip ocupa una franja lateral propia y los títulos caben en dos líneas, sin invasión del chip ni recorte superior. A 768 algunos títulos se abrevian con elipsis; el título exterior conserva la identificación completa. A 1024 los cuatro títulos de la cola se leen completos dentro de las cartelas. No se alteró el armazón para conseguirlo.
2. **Miniatura principal de 64 × 64 px:** la primera tanda partía «El mar también respira» como «tambié / n…». En ambos anchos finales el contenido se limita a dos líneas y termina en elipsis dentro del marco; desaparece el fragmento aislado. El título adyacente permanece completo. La miniatura sigue siendo estrecha por la estructura existente: no equivale a un protagonista de gran formato.
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

La revalidación de Inicio/Fábrica está completada en ambos anchos. Permanece pendiente atribuir el evento 404 antes de afirmar consola limpia. Las métricas de tokens, axe y desbordamiento finales coinciden con las iniciales; resolver el recorte de la cartela no modifica esas desviaciones de armazón. La comprobación final fue deliberadamente focal de los cuatro originales afectados, no una segunda inspección exhaustiva de las 66 pantallas. Los hallazgos de armazón se entregan a la dirección de diseño como pendientes existentes, sin introducir cambios de producto durante esta revisión ni presentarlos como aprobados.
