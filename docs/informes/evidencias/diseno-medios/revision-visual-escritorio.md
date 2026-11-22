# Revisión visual de escritorio — diseno-medios

Fecha: 21 de noviembre de 2026, Lima. Revisor: subagente de interfaz. Alcance: 33 pantallas/estados a 1440 y 1920 px, **66 capturas revisadas**. No se ejecutaron pruebas ni se modificó el armazón durante esta revisión.

## Dictamen

Las portadas tipográficas de lista, detalle y Publicados mantienen cajas estables y títulos visibles en escritorio. La cola tenía un defecto propio: su insignia de etapa pisaba la última línea de la cartela. Se corrigió en `4b862e8`. La inspección complementaria de los originales de 768 y 1024 px confirmó una palabra partida en la miniatura de 64 px; se corrigió en `5fc8495`. Ambas correcciones necesitan la recaptura posterior coordinada por la raíz; **las capturas que fundamentan este documento son anteriores a esas correcciones**.

La dirección visual global no está aprobada: las capturas conservan el armazón anterior, el acento azul, la jerarquía y los ornamentos anteriores. El contenido audiovisual sigue ocupando una fracción pequeña de Inicio y Publicados. Esta misión conserva ese armazón por alcance expreso; sus cambios de medios no constituyen una implementación completa de «Sala de proyección».

## Evidencia y método

Se revisaron los 33 pares completos de [hojas de contacto](../../../../evidencias-diseno/revision-escritorio/), con 1440 a la izquierda y 1920 a la derecha. Cada captura ocupa 1120 px de ancho dentro de la hoja. Para juzgar tipografía, recorte y bordes se ampliaron los originales de fábrica, Publicados y detalle, además del final de los formularios largos de Canal y Ajustes de la fábrica. Se conservaron las [66 capturas originales](../../../../evidencias-diseno/revision-escritorio/originales/) y un [manifiesto SHA-256](../../../../evidencias-diseno/revision-escritorio/manifiesto.json), para que la siguiente matriz no borre la evidencia del fallo.

Las matrices de origen están en `.cache/diseno-medios-ci/evidencias-diseno/matriz-1440.json` y `matriz-1920.json`. Cada una registra 33 pantallas, cero desbordamientos horizontales y cero violaciones axe en su campo `axe`. Cada una también registra 5099 entradas de desviaciones de tokens. Esas entradas repetidas **no son 5099 defectos independientes**; muestran que el sistema anterior sigue presente. El examen visual no sustituye los resultados automatizados ni acredita movimiento, red real o disponibilidad de un MP4.

Esta matriz usa el estado de demostración: las cartelas corresponden a videos sin archivos en ese conjunto. Las capturas `medios-*.png` del otro arnés usan un MP4 sintético. La validación visual del render existente se identifica por `medios-reales-*.png` y queda a cargo de la raíz; no se presenta esta matriz como evidencia de videos reales en producción.

## Hallazgos propios de medios

| Hallazgo | Evidencia | Acción y estado |
| --- | --- | --- |
| La insignia inferior izquierda de la cola pisa la segunda línea: «respira», «lluvia» o «ruido». Aparece tanto a 1440 como a 1920. | [Recorte 1440 al tamaño original](../../../../evidencias-diseno/revision-escritorio/cola-1440-previa.png), [1920](../../../../evidencias-diseno/revision-escritorio/cola-1920-previa.png); hojas 01 y 02. | `4b862e8`: contexto de cola, reserva lateral de 32 px para la insignia, padding de 8 px y máximo dos líneas de 12/18 px. No se cambian caja, chip ni estructura. Implementado; pendiente confirmar con recaptura. |
| En 64×64, el padding de 12 px deja 40 px útiles y parte «también» en «tambié / n…». | [Original 768](../../../../evidencias-diseno/revision-escritorio/fabrica-768-previa.png), [1024](../../../../evidencias-diseno/revision-escritorio/fabrica-1024-previa.png). Comprobación complementaria a escritorio. | `5fc8495`: padding base de 8 px y dos líneas; se mantiene fuente de 12 px. El contexto protagonista conserva tres líneas. Implementado; pendiente confirmar con recaptura. |
| La cartela protagonista cabe; el título largo del publicado utiliza dos líneas completas, sin tocar los límites de la imagen. | Hojas 04–07 y [detalle a escala original](../../../../evidencias-diseno/revision-escritorio/detalle-video-1920-original.png). | Sin corrección de geometría necesaria. El vacío deliberado identifica la ausencia de archivo; no simula una miniatura real. |
| Las miniaturas de Publicados encajan y el título exterior sigue alineado con la red; las métricas no las invaden. | Hoja 09 y [recorte original](../../../../evidencias-diseno/revision-escritorio/publicados-1440-detalle.png). | Sin solape observado. El tamaño pequeño de la miniatura y el predominio de métricas son límites del armazón, no falta de carga del nuevo componente. |
| El detalle de un video marcado publicado, sin archivo en la demostración, dice «cuando la fábrica complete el montaje». | Hoja 07. | Corregido después de esta captura: «El archivo del video todavía no está disponible aquí». La ausencia del archivo ya no se atribuye a una etapa pendiente. La raíz recapturará el estado final. |

## Registro de las 33 pantallas

Cada fila documenta el par 1440/1920, no solo una de las resoluciones. «Sin recorte» se refiere al contenido principal observado; no implica conformidad con los tokens globales.

| Hoja / pantalla | Observación comparada |
| --- | --- |
| 01 Inicio | Jerarquía dominada por chat y mascota; medio pequeño a la derecha. A 1920 aumenta la distancia visual entre bloques. Cola con solape ya identificado. |
| 02 Fábrica | Misma composición que Inicio en escritorio, por el panel compartido existente. Progreso y etapas alineados; la cola repite el defecto propio de la hoja 01. |
| 03 Videos | Filas regulares, títulos exteriores completos, cartelas sin recortes observados. Flecha, pista y fecha conservan su alineación a la derecha en ambas anchuras. |
| 04 Detalle de video | Portada protagonista proporcionada y separada de acciones; título sin recorte. El guion se dispone debajo, no en las pestañas de la dirección futura. |
| 05 Aprobación de guion | Cartela y título íntegros; acción principal clara en panel lateral. El espacio y la repetición del título derivan de la composición existente. |
| 06 Aprobación final | El título «La ciudad antes del ruido» cabe en ambas anchuras. Panel lateral sin invasión de la caja de medios. |
| 07 Publicado (detalle) | Título de cartela largo envuelto en dos líneas, sin recorte. Redes sin enlaces disponibles explícitas. Copy del archivo ausente señalado arriba. |
| 08 Pedir video | Formulario insertado antes de la lista, columnas alineadas y foco visible. Las miniaturas inferiores mantienen la geometría de Videos. |
| 09 Publicados | Tres tarjetas dispuestas en dos columnas; queda un hueco en la última fila. Póster pequeño, métricas dominantes y filtros extensos arriba; no es la pared audiovisual prescrita. Sin colisión de medios. |
| 10 Aprendizaje | Filtros y texto dominan; tarjetas de lecciones con ritmo regular. Falta la secuencia visual miniatura→métrica→causa→efecto de DIRECCION; es estructura previa. |
| 11 Marcas | Vacío centrado y sin recorte. Compiten la acción superior «Añadir marca o cuenta» y la invitación central «Crear mi primera marca». Sin medio de video afectado. |
| 12 Canales | Dos tarjetas grandes y formulario lateral; títulos y acciones caben. El espacio vacío interior de las tarjetas es amplio, especialmente en escritorio ancho. |
| 13 Canal / Biblia | Dos columnas estables en un formulario muy largo; no hay cierre ni campos cortados al final. La repetición de acciones por campo y la densidad son herencia del sistema anterior. |
| 14 Radar | Texto y acción de pedir video en extremos de la misma fila. Jerarquía de texto muy uniforme y amplias zonas vacías; sin solapes. |
| 15 Rutina y metas | Decisión del día a la izquierda, formulario a la derecha; separación clara. La escasez de contenido deja una gran zona vacía, sin un problema de medios. |
| 16 Especialistas y redes | Recomendación izquierda y configuración derecha con alineación estable. Sin cortes en controles; no contiene el nuevo componente de portada. |
| 17 Referencias | Estado pendiente y acción separados por líneas; composición abierta y legible. No se inventa una imagen para la referencia pendiente. |
| 18 Adoptar cuenta | Vacío explicativo a la izquierda y formulario a la derecha. Sin colisiones; grandes áreas libres por el conjunto de demostración. |
| 19 Programados | Tres registros con separadores y títulos alineados. El armazón no muestra miniaturas en esta vista; no es un fallo de carga de medios. |
| 20 Decisiones | Dos bloques de formulario con ancho contenido y ritmo repetido. Títulos completos, sin portada de video en esta estructura previa. |
| 21 Incidencias | Vacío breve debajo de la navegación. Jerarquía clara por título y párrafo; demasiado espacio sin contenido para la dirección futura, sin recorte. |
| 22 Avisos | Vacío similar a Incidencias; estado y enlace sin superposición. Conserva el ornamento de cabecera anterior. |
| 23 Avatares | Cuatro tarjetas alineadas; ilustraciones de demostración contenidas. Son recursos de avatares declarados ficticios, no miniaturas sustitutas de MP4 de fábrica. |
| 24 Voces | Dos tarjetas de ondas alineadas dentro de una retícula de cuatro; vacío lateral deliberado. Títulos y controles de audio no están cortados. |
| 25 Crear avatar | Formulario a dos columnas y catálogo debajo, sin colisión. Checkbox y texto secundario pequeños pertenecen al sistema anterior. |
| 26 Crear voz | Mismo ritmo del formulario de avatar, con menos campos; catálogo de ondas debajo sin recorte. |
| 27 Perfil | Bloque de identidad y formulario separados; controles de apariencia incluyen el tema claro que DIRECCION pide retirar. El control de movimiento sigue en cabecera. |
| 28 Administración | Resumen, tabla y formularios con alineación consistente; cierre visible. Densidad y texto secundario pequeño no se deben a medios. |
| 29 Ajustes de fábrica | Formulario técnico muy largo a dos columnas; comprobado el final original, botón y registro de cambios completos. Sin fallo de encaje. |
| 30 Entrada | Dos columnas equilibradas; título amplio a la izquierda y acceso a la derecha. El elemento decorativo sigue siendo el del armazón anterior. |
| 31 Entrada con error | Aviso insertado dentro de la columna de acceso, sin invadir botón o título; composición estable frente a Entrada. |
| 32 No encontrado | Mensaje y acción contenidos, sin truncar. La ilustración y el control de movimiento conservan el estilo previo. |
| 33 Enlace vencido | Mensaje y acción completos; a 1440 el bloque empieza mucho más a la izquierda que el de No encontrado. Inconsistencia de composición previa, sin medios afectados. |

## Límites del armazón que permanecen

- Navegación fija ancha, no el riel de 72 px expandible; etiquetas y metadatos pequeños del sistema anterior.
- Paleta azul/gris y botones rectangulares; no el acento Tally ni la escala de radios y tipografía de DIRECCION. El informe de tokens detecta estas desviaciones, no las oculta.
- Inicio dedicado al chat, ornamento de etapas y barra de recuerdos antes del contenido. La miniatura no puede convertirse en héroe sin cambiar la composición autorizada.
- Publicados organiza tarjetas de métricas con filtros de formulario. Para alcanzar «La pared» se necesita trabajo de armazón separado.
- Las capturas estáticas no acreditan View Transitions, contador, orbe, abrir/cerrar Cooper ni la barra móvil. Esta revisión tampoco sustituye el ensayo de movimiento de medios o la medición de Lighthouse.

## Pendientes de Walter

La entrega global de «Sala de proyección» requiere decidir la integración del trabajo de armazón correspondiente y su auditoría completa. Esta revisión no autoriza nuevas pantallas, despliegues ni una ampliación del alcance de diseno-medios. El acceso a los medios reales y sus limitaciones de producción se documentan en el informe principal de la misión.
