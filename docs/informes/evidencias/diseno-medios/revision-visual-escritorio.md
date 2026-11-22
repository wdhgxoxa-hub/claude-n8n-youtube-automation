# Revisión visual de escritorio — diseno-medios

Fecha: 21 de noviembre de 2026, Lima. Revisor: subagente de interfaz. Alcance: 33 pantallas/estados a 1440 y 1920 px, **66 capturas iniciales y las 66 capturas finales revisadas visualmente**. No se ejecutaron pruebas ni se modificó el armazón durante esta revisión.

## Dictamen

Las portadas tipográficas de lista, detalle y Publicados mantienen cajas estables y títulos visibles en escritorio. La cola tenía un defecto propio: su insignia de etapa pisaba la última línea de la cartela. Se corrigió en `4b862e8`. La inspección complementaria de los originales de 768 y 1024 px confirmó una palabra partida en la miniatura de 64 px; se corrigió en `5fc8495`. **Ambas correcciones se confirmaron visualmente en la recaptura final de las 22:40–22:42 Lima**, junto con el aviso neutral de disponibilidad de `53b17df`. Las hojas de contacto y los 66 originales de la primera pasada se conservan como evidencia anterior; el anexo final identifica las capturas posteriores y sus hashes.

La dirección visual global no está aprobada: las capturas conservan el armazón anterior, el acento azul, la jerarquía y los ornamentos anteriores. El contenido audiovisual sigue ocupando una fracción pequeña de Inicio y Publicados. Esta misión conserva ese armazón por alcance expreso; sus cambios de medios no constituyen una implementación completa de «Sala de proyección».

## Evidencia y método

Se revisaron los 33 pares completos de [hojas de contacto](../../../../evidencias-diseno/revision-escritorio/), con 1440 a la izquierda y 1920 a la derecha. Cada captura ocupa 1120 px de ancho dentro de la hoja. Para juzgar tipografía, recorte y bordes se ampliaron los originales de fábrica, Publicados y detalle, además del final de los formularios largos de Canal y Ajustes de la fábrica. Se conservaron las [66 capturas originales](../../../../evidencias-diseno/revision-escritorio/originales/) y un [manifiesto SHA-256](../../../../evidencias-diseno/revision-escritorio/manifiesto.json), para que la siguiente matriz no borre la evidencia del fallo.

Las matrices de origen están en `.cache/diseno-medios-ci/evidencias-diseno/matriz-1440.json` y `matriz-1920.json`. Cada una registra 33 pantallas, cero desbordamientos horizontales y cero violaciones axe en su campo `axe`. Cada una también registra 5099 entradas de desviaciones de tokens. Esas entradas repetidas **no son 5099 defectos independientes**; muestran que el sistema anterior sigue presente. El examen visual no sustituye los resultados automatizados ni acredita movimiento, red real o disponibilidad de un MP4.

Esta matriz usa el estado de demostración: las cartelas corresponden a videos sin archivos en ese conjunto. Las capturas `medios-*.png` del otro arnés usan un MP4 sintético. La validación visual del render existente se identifica por `medios-reales-*.png` y queda a cargo de la raíz; no se presenta esta matriz como evidencia de videos reales en producción.

## Hallazgos propios de medios

| Hallazgo | Evidencia | Acción y estado |
| --- | --- | --- |
| La insignia inferior izquierda de la cola pisa la segunda línea: «respira», «lluvia» o «ruido». Aparece tanto a 1440 como a 1920. | [Recorte 1440 al tamaño original](../../../../evidencias-diseno/revision-escritorio/cola-1440-previa.png), [1920](../../../../evidencias-diseno/revision-escritorio/cola-1920-previa.png); hojas 01 y 02. | `4b862e8`: contexto de cola, reserva lateral de 32 px para la insignia, padding de 8 px y máximo dos líneas de 12/18 px. No se cambian caja, chip ni estructura. Confirmado visualmente en Inicio y Fábrica finales a 1440/1920: chip separado y texto dentro de la caja. |
| En 64×64, el padding de 12 px deja 40 px útiles y parte «también» en «tambié / n…». | [Original 768](../../../../evidencias-diseno/revision-escritorio/fabrica-768-previa.png), [1024](../../../../evidencias-diseno/revision-escritorio/fabrica-1024-previa.png). Comprobación complementaria a escritorio. | `5fc8495`: padding base de 8 px y dos líneas; se mantiene fuente de 12 px. El contexto protagonista conserva tres líneas. Confirmado a 768/1024: dos líneas con elipsis; desaparece la tercera línea con una letra suelta. El título completo sigue visible junto a la miniatura. |
| La cartela protagonista cabe; el título largo del publicado utiliza dos líneas completas, sin tocar los límites de la imagen. | Hojas 04–07 y [detalle a escala original](../../../../evidencias-diseno/revision-escritorio/detalle-video-1920-original.png). | Sin corrección de geometría necesaria. El vacío deliberado identifica la ausencia de archivo; no simula una miniatura real. |
| Las miniaturas de Publicados encajan y el título exterior sigue alineado con la red; las métricas no las invaden. | Hoja 09 y [recorte original](../../../../evidencias-diseno/revision-escritorio/publicados-1440-detalle.png). | Sin solape observado. El tamaño pequeño de la miniatura y el predominio de métricas son límites del armazón, no falta de carga del nuevo componente. |
| El detalle de un video marcado publicado, sin archivo en la demostración, dice «cuando la fábrica complete el montaje». | Hoja 07. | `53b17df`, confirmado en las capturas finales a 1440/1920: «El archivo del video todavía no está disponible aquí». Texto completo y sin recorte; la ausencia del archivo ya no se atribuye a una etapa pendiente. |

## Registro de las 33 pantallas

Cada fila documenta el par 1440/1920 de la primera pasada, no solo una de las resoluciones. Los defectos corregidos posteriormente se cierran en el anexo final. «Sin recorte» se refiere al contenido principal observado; no implica conformidad con los tokens globales.

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

## Cierre de la recaptura final

Snapshot de la ejecución centralizada: `9f3a910`; último commit de producto: `53b17df`. Las matrices de 1440 y 1920 se completaron el 21 de noviembre a las **22:42:25 y 22:42:59 Lima**, respectivamente. Ambas superan el umbral de las 22:40 solicitado para distinguir esta ejecución. Cada matriz final conserva 33 pantallas, cero desbordamientos, cero entradas axe y 5099 entradas de desviación de tokens; las correcciones focales no eliminan el incumplimiento del sistema visual global.

Se volvieron a inspeccionar los seis originales de Inicio, Fábrica y Publicado a 1440/1920, más Fábrica a 768/1024 para comprobar la miniatura de 64 px. Las ocho capturas finales y las dos matrices se conservan en [revision-escritorio/final](../../../../evidencias-diseno/revision-escritorio/final/). El [manifiesto final versionado](revision-visual-escritorio-final.json) incluye cada archivo, SHA-256 completo, hora exacta y snapshot. Inicio y Fábrica tienen el mismo hash en cada ancho porque muestran el mismo panel compartido de escritorio; no se ha contado una imagen distinta donde no la hay.

| Captura final | SHA-256 | Resultado visual |
| --- | --- | --- |
| Inicio y Fábrica 1440 | `8270db2ec3b0da85e4d9555d6f09e50d439adededf1d10bf2d87d6cdf190122d` | Dos líneas de cola completas; insignias a la izquierda sin invadir el texto. |
| Inicio y Fábrica 1920 | `65dbab27b47e90eca2b0834b7d5fdf417986e7cd8192386c9f34201927fcebb2` | Títulos y chips separados; caja protagonista y título exterior conservan alineación. |
| Publicado 1440 | `f175776a2723275b3f0fb4783ec47e703f9d6bc4017e05586e166db283491af7` | Aviso neutral completo debajo de la portada, sin afirmar un montaje pendiente. |
| Publicado 1920 | `750fee81c16e9df2fa7c61f7e7a2fda50eb43112648105df869efe015ecaee9d` | Mismo aviso confirmado, sin recorte ni desplazamiento del panel lateral. |
| Fábrica 768 | `4becb96e8df45c0acf87b7246db12ec0efe1949690822dd6435a31345fedc129` | Miniatura de 64 px limitada a dos líneas con elipsis, sin tercera línea huérfana. Cola sin colisión. |
| Fábrica 1024 | `5389767362f9e6caa2474b0d071cdbb1f09b6a27463b658509d6958ce0bcdc8a` | Mismo truncado correcto; títulos completos disponibles fuera de la miniatura. Cola sin colisión. |

**Resultado del cierre focal: los tres hallazgos propios están corregidos y verificados visualmente.** No se cambió producto ni se ejecutaron pruebas pesadas durante esta recaptura documental. La revisión global permanece condicionada por los límites del armazón y por la puerta completa coordinada por la raíz.

## Inspección completa de los 66 PNG finales

Tras el cierre focal se inspeccionaron visualmente **los 33 pares finales completos, 66 de 66 PNG**, del mismo snapshot `9f3a910` y producto `53b17df`. Esta tanda incluye las vistas ajenas a medios y los estados vacíos; no se limita a las ocho capturas ampliadas del anexo anterior. Se usaron las [33 hojas finales y sus 66 originales](../../../../evidencias-diseno/revision-escritorio/final-completa/), preservando toda la altura de cada página. Además se examinaron los últimos 1100 px de Canal y Ajustes de fábrica en ambas anchuras, a escala original, para comprobar sus cierres y controles.

El inventario final coincide exactamente con el inicial: 33 nombres por cada ancho, sin faltantes ni sustituciones. **32 archivos son idénticos byte por byte y 34 son distintos**; todos se abrieron visualmente, incluidos los idénticos. El [manifiesto de la tanda completa](revision-visual-escritorio-completa-final.json) registra los 66 SHA-256, las horas de los PNG finales y su igualdad o diferencia frente al manifiesto inicial. La diferencia de hash no se atribuye automáticamente al producto: las capturas también contienen horas y frases de ensayo variables.

Cada fila siguiente confirma la observación de **ambas anchuras finales**, comparada con el registro inicial. «Distinto» e «idéntico» describen los dos PNG del par frente a sus originales iniciales, no una comparación entre 1440 y 1920.

| Pantalla final, 1440 y 1920 | Comparación de archivos | Comprobación visual de esta tanda |
| --- | --- | --- |
| 01 Inicio | Distinto | Cola con dos líneas dentro de cada caja y chip en su reserva lateral; título exterior completo. Chat y mascota siguen dominando la jerarquía previa. |
| 02 Fábrica | Distinto | Panel compartido completo; mismo resultado de las cartelas y chips que Inicio. Progreso, acciones y miniatura principal conservan alineación. |
| 03 Videos | Distinto | Las cuatro filas mantienen alturas y separadores regulares. Cartelas con dos líneas, sin letras aisladas debajo; títulos exteriores y pistas sin invasión. |
| 04 Detalle de video | Distinto | Título de portada completo, aviso neutral debajo y panel lateral separado. El final del guion queda visible. |
| 05 Aprobación de guion | Distinto | «¿A qué huele la lluvia?» cabe en portada y cabecera. Aviso de archivo ausente completo; botones y etapas no pisan el medio. |
| 06 Aprobación final | Distinto | «La ciudad antes del ruido» ocupa una línea dentro de la portada. Caja, aviso neutral, guion y acción lateral sin recortes. |
| 07 Publicado | Distinto | El título largo se distribuye en dos líneas. Confirmado el aviso «El archivo del video todavía no está disponible aquí», separado de la sección de redes. |
| 08 Pedir video | Distinto | Formulario y foco visibles; lista inferior completa. Títulos de las cartelas contenidos y títulos exteriores sin truncado inesperado. |
| 09 Publicados | Distinto | Tres miniaturas tipográficas encajan en sus tarjetas sin tocar métricas ni gráficos. Se conserva el hueco de la cuarta tarjeta y la jerarquía dominada por métricas. |
| 10 Aprendizaje | Distinto | Filtros, lección y dos correcciones completos, con bordes y separaciones regulares. Continúa sin la secuencia audiovisual de DIRECCION. |
| 11 Marcas | Idéntico | Estado vacío y sus dos puntos de entrada permanecen íntegros. Sin nueva caja de medios ni colisión. |
| 12 Canales | Idéntico | Dos tarjetas y formulario lateral completos. Alineación y espacios interiores amplios iguales a la primera pasada. |
| 13 Canal / Biblia | Idéntico | Revisadas todas las filas y el cierre ampliado en ambos anchos. Último campo, botón y enlace de configuración enteros. |
| 14 Radar | Distinto | Idea, recomendación y botón de pedir video separados; hora de ensayo visible. No se altera la composición abierta anterior. |
| 15 Rutina y metas | Distinto | Decisión y formulario conservan columnas sin solape. Acción final visible; queda el espacio vacío previo a la izquierda. |
| 16 Especialistas y redes | Idéntico | Recomendación, conexión, selección de plataformas y botón final completos. Sin portadas afectadas en esta estructura. |
| 17 Referencias | Idéntico | Referencia pendiente, desplegable y acción final separados por líneas. No aparece una imagen inventada para un recurso pendiente. |
| 18 Adoptar cuenta | Idéntico | Texto de identidad y formulario lateral alineados. Todos los controles caben en su tarjeta. |
| 19 Programados | Distinto | Tres registros completos con título, fecha y enlace, separados regularmente. La ausencia de miniaturas corresponde al armazón de esta vista. |
| 20 Decisiones | Distinto | Dos decisiones con sus controles y botones completos. No hay cruces entre el segundo formulario y el cierre de página. |
| 21 Incidencias | Idéntico | Mensaje vacío y enlace de aprendizaje enteros; amplitud de espacio y ornamento previos sin cambios. |
| 22 Avisos | Idéntico | Explicación de estados y enlace completos. No hay aviso oculto por la cabecera ni una caja de medios añadida. |
| 23 Avatares | Idéntico | Cuatro tarjetas con ilustraciones declaradas ficticias, títulos y controles contenidos. No se confunden con miniaturas de videos de fábrica. |
| 24 Voces | Idéntico | Dos tarjetas de ondas completas y alineadas; controles de reproducción dentro de sus cajas. Vacío lateral previo conservado. |
| 25 Crear avatar | Distinto | Frase de ensayo, controles de archivo y consentimiento caben en las columnas. Catálogo inferior completo, sin contacto con el formulario. |
| 26 Crear voz | Distinto | Frase variable y controles completos; botón de creación separado del catálogo de voces. Sin recorte en el cierre. |
| 27 Perfil | Idéntico | Identidad, apariencia y avisos conservan sus cajas. Sigue visible el selector de tema claro, desviación global anterior. |
| 28 Administración | Distinto | Tabla, recuerdos, revisión de identidad e invitaciones completos. Columnas de gasto y acceso alineadas; no hay medio nuevo aquí. |
| 29 Ajustes de fábrica | Idéntico | Formulario completo y cierre ampliado en ambas anchuras: último campo, botón y registro de cambios sin cortes. |
| 30 Entrada | Idéntico | Título principal, acceso y pie dentro de las dos columnas. Continúa la decoración y el espacio negativo del armazón previo. |
| 31 Entrada con error | Idéntico | Aviso íntegro entre el texto y el botón de acceso; no desplaza contenido fuera de su columna. |
| 32 No encontrado | Idéntico | Título, explicación y acción completos, sin choque con la ilustración superior. |
| 33 Enlace vencido | Idéntico | Título y acción sin recortes. Persiste la diferencia de alineación a 1440 respecto a No encontrado, ya registrada como composición previa. |

**Resultado de la tanda completa: no se observaron nuevos defectos propios de medios en los 66 PNG finales.** Se mantienen cerrados el solape de cola, la letra huérfana de miniaturas compactas y el aviso inexacto del detalle publicado. Se mantienen también las reservas sobre jerarquía, tokens y armazón global: esta inspección completa no convierte esas desviaciones en conformidad ni acredita movimiento o medios reales. No se ejecutaron pruebas, no se modificó producto y no se integró ni desplegó durante esta tanda documental.

## Pendientes de Walter

La entrega global de «Sala de proyección» requiere decidir la integración del trabajo de armazón correspondiente y su auditoría completa. Esta revisión no autoriza nuevas pantallas, despliegues ni una ampliación del alcance de diseno-medios. El acceso a los medios reales y sus limitaciones de producción se documentan en el informe principal de la misión.
