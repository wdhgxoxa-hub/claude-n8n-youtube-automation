# Revisión visual móvil · diseno-medios

Fecha: 21 de noviembre de 2026, Lima. Revisión independiente de las **66 capturas completas: 33 a 360 px y 33 a 390 px**, obtenidas de `.cache/diseno-medios-ci/evidencias-diseno/`. No falta ninguna de esas capturas. Se revisaron once hojas de contacto con los dos anchos emparejados y los originales de Fábrica, detalle y Publicados. Las hojas de consulta están en `.cache/revision-visual-movil/pares-01.png` a `pares-11.png`; no sustituyen los originales.

La matriz muestra **datos de demostración sin MP4**. Es evidencia del estado sin medio y de la integración en el armazón existente; no demuestra por sí sola la presentación de los MP4 reales de B2 ni las miniaturas oficiales de YouTube. Las capturas `medios-detalle-*` y `medios-lista-*` del recorrido focal usan un MP4 sintético. La revisión adicional de contenido real figura más abajo, separada de esta matriz de demostración.

## Resultado y defecto de medios

Los títulos, controles y tarjetas conservan sus márgenes al pasar de 360 a 390 px. No se observan nuevos solapamientos entre tarjetas, campos cortados lateralmente ni imágenes estiradas. El estado sin medio utiliza cartelas tipográficas, sin miniaturas de montañas. En las filas de Videos y las tarjetas de Publicados, el título corto de la cartela se trunca con puntos suspensivos y el título completo permanece al lado.

**M1 · Corregible dentro de medios:** en `fabrica-360.png` y `fabrica-390.png`, sección «En la mesa de edición», las cartelas compactas recortan la última línea del título. El chip de etapa 04/10 pisa parte del texto de «¿A qué huele la lluvia?» y «La ciudad antes del ruido». No ocurre en el título exterior de la tarjeta. Comunicado a `interfaz_medios` para ajustar la reserva interior y el truncado de la cartela sin cambiar el armazón. Corregido por `interfaz_medios` en `4b862e8`: dos líneas de 12/18 px, relleno de 8 px y reserva lateral de 32 px para la insignia; dimensiones exteriores conservadas. Estado de esta primera revisión: corrección implementada, pendiente de verificar en captura posterior.

La elección de un fondo oscuro y una señal de tinte discreta es honesta cuando falta medio. Su presencia visual es contenida; estas cartelas no deben confundirse con la evidencia de un video terminado. El mensaje bajo la cartela del detalle explica esa ausencia.

## Defectos heredados, fuera del cambio de medios

- **Jerarquía:** Inicio sigue encabezado por conversación y Fábrica por el módulo anterior; no existe el héroe «Hoy en el estudio». Publicados muestra cinco campos de filtro y texto de procedencia antes de la primera tarjeta: el medio comienza aproximadamente después del primer viewport móvil. No cumple «La pared» de DIRECCION.
- **Armazón:** persisten menú lateral, «En vivo», «Pausar movimiento» y «Demostración» en cabecera. No hay barra inferior de cinco destinos ni Cooper flotante. El perfil conserva selector de tema claro. Se requiere la misión de armazón para resolverlo.
- **Tipografía y sistema:** cabecera, chips y textos auxiliares incluyen tamaños inferiores a 12 px; permanecen acento azul, colores, radios y botones anteriores. Los manifiestos registran 5.013 desviaciones de tokens a 360 y 5.014 a 390, sumadas por pantalla/selector/propiedad; no son números de defectos visuales independientes. No se concede conformidad con DIRECCION por haber pasado axe.
- **Ritmo:** la Biblia de canal mide 7.332/7.269 px y Ajustes de fábrica 5.458/5.393 px. Los formularios continuos y sus acciones repetidas dificultan orientarse; no hay un problema nuevo de recorte, pero tampoco alcanzan la jerarquía prevista. Aprendizaje sigue anteponiendo filtros a las lecciones.
- **Ilustración y copys:** se repite la escena decorativa de cabecera en numerosas rutas; en detalles se corta contra el borde derecho. Persisten expresiones como «registros de origen» e «identidad de publicación». Son restos del diseño anterior, no pósteres de los videos.

No se modificó producto ni CSS durante esta revisión. La aceptación de medios queda separada de estos incumplimientos globales, que no se ocultan ni se marcan como aprobados.

## Inventario revisado

Cada fila corresponde a los dos archivos `<nombre>-360.png` y `<nombre>-390.png`. Las alturas acreditan la inspección de página completa, incluidas las secciones posteriores al primer viewport.

| Captura | Alto 360 | Alto 390 | Observación de revisión |
|---|---:|---:|---|
| inicio | 1225 | 1165 | Chat y acciones alineados; jerarquía anterior. |
| fabrica | 1621 | 1590 | Cartelas sin montañas; defecto M1 en tira inferior. |
| videos | 950 | 900 | Lista estable; título completo al lado de la cartela. |
| detalle-video | 1909 | 1925 | Cartela, guion y etapas sin colisiones; ausencia de medio explicada. |
| aprobacion-guion | 1934 | 1927 | Dos acciones alineadas; guion legible. |
| aprobacion-final | 1964 | 1957 | Mismo contenedor de cartela; controles y etapas completos. |
| publicado | 2187 | 2179 | Estado demo sin enlaces ni render; no equivale a publicación real disponible. |
| pedir-video | 1584 | 1515 | Formulario abierto y lista posterior completos. |
| publicados | 3308 | 3330 | Tres tarjetas completas; filtro domina el inicio; cartelas sin medios reales. |
| aprendizaje | 2461 | 2388 | Lección y dos correcciones completas; demasiada antesala de filtros. |
| marcas | 900 | 900 | Vacío claro; acciones duplicadas arriba y en vacío, heredadas. |
| canales | 1837 | 1737 | Dos canales y creación alineados; variación de salto de línea normal. |
| canal | 7332 | 7269 | Todos los campos hasta publicaciones inspeccionados; ritmo excesivamente largo. |
| radar | 1573 | 1508 | Bloques de investigación, propuesta y sonidos completos. |
| rutina | 1625 | 1560 | Decisión y metas completas; campos sin recorte. |
| redes | 1992 | 1950 | Recomendación, conexión y plataformas completas. |
| referencias | 1101 | 1036 | Vacío y acción final visibles; alineación consistente. |
| cuentas | 1307 | 1264 | Identidad y formulario de estudio completos. |
| programados | 1130 | 1088 | Tres registros completos; sin nuevos medios en esta vista. |
| decisiones | 1616 | 1574 | Ambas decisiones y acciones completas. |
| incidencias | 900 | 900 | Vacío legible; misma cabecera anterior. |
| avisos | 900 | 900 | Historial vacío legible; no hay recorte. |
| avatares | 1270 | 1270 | Cuatro muestras de demostración completas, sin confundirlas con videos reales. |
| voces | 992 | 992 | Dos muestras y vacío de biblioteca completos. |
| crear-avatar | 2350 | 2302 | Formulario, consentimiento y cuatro muestras completos; foco visible. |
| crear-voz | 1979 | 1931 | Formulario, consentimiento y dos muestras completos; foco visible. |
| perfil | 1727 | 1727 | Identidad, preferencias y avisos completos; selector de tema anterior. |
| admin | 2357 | 2357 | Gastos, revisión e invitaciones completos; jerarquía densa heredada. |
| admin-fabrica | 5458 | 5393 | Todos los ajustes hasta registro de cambios inspeccionados; longitud excesiva. |
| entrada | 974 | 925 | Título y acceso completos; cambia el salto de línea entre anchos. |
| entrada-error | 1077 | 1028 | Mensaje de error visible antes del acceso; sin colisión. |
| no-encontrado | 900 | 900 | Estado y retorno completos; ilustración anterior. |
| enlace-vencido | 900 | 900 | Explicación y retorno completos; ilustración anterior. |

## Anexo: render existente, ensayo móvil de 390 px

Se inspeccionaron los cinco PNG `medios-reales-*-390.png` completos. Proceden de un **fixture local autenticado con derivados del MP4 existente en B2**, no de una publicación nueva. El reproductor del fixture recibe el extracto silencioso de cinco segundos: **no se reprodujo en este recorrido el MP4 original completo**. La publicación de prueba está rotulada «archivo local» y «Datos simulados».

| Captura adicional | Tamaño | Valoración |
|---|---:|---|
| medios-reales-lista-390 | 390 × 900 | El render ocupa la primera miniatura; encuadre vertical íntegro con bandas laterales dentro de la caja heredada. Título completo separado del medio, sin colisión. |
| medios-reales-detalle-390 | 390 × 1879 | Video vertical protagonista, alineado con el contenido; persona, rótulo y subtítulo visibles. Proporción conservada, sin estiramiento ni recorte introducido por la interfaz. Los controles muestran 0:05 y silencio. |
| medios-reales-publicados-390 | 390 × 1746 | Miniatura real junto al título; no montañas ni cartela sustitutiva. El formulario sigue relegando el medio a la parte inferior: límite del armazón, no resuelto por servir el archivo. |
| medios-reales-fabrica-390 | 390 × 900 | La pieza seleccionada muestra el render real, con título y estado fuera de la imagen. Es una captura de viewport; no representa toda la pista. |
| medios-reales-cola-390 | 320 × 1740 | Captura del elemento `.queue` dentro del viewport de 390 px. Primera pieza con render íntegro; veinte cartelas y último medio pendiente. El chip está separado del texto en las cartelas de esta revisión; M1 aún requiere la recaptura final de sus títulos originales. |

El póster examinado mide 900 × 1600 y pesa 36.778 bytes. La vista previa mide 360 × 640, dura 5 s, pesa 336.834 bytes y no contiene pista de audio. Son derivados del original 1080 × 1920 documentado en el diagnóstico. La oscuridad y el tinte neutro proceden del material; no se añadieron imágenes o colores de relleno. En las miniaturas pequeñas el detalle fino pierde legibilidad por su tamaño físico, pero se conserva la composición del render. Para darles el protagonismo de «La pared» es necesaria la nueva retícula de Publicados.

`medios-reales-recorrido-390.json` registra consola vacía, cero solicitudes externas, navegación interna sin recarga, carga del medio distante tras acercarlo mediante scroll y pausa al sacar el primero de vista. La pieza distante de la **cola** permanece pendiente en su PNG porque esa captura de elemento no equivale a recorrer cada celda; el ensayo de carga diferida se realiza en la lista. No se interpreta el recuadro pendiente como ausencia del MP4.

La prueba de pausa por cambio de pestaña tiene un límite explícito: Chromium headless conservó la página visible y el ensayo **simuló `document.hidden` y `visibilitychange`**. Acredita la respuesta a la señal, no la ocultación nativa del navegador. La captura incluye asimismo «Reconectando/Conectando» por el SSE del fixture y el enlace enfocado «Saltar al contenido» superpuesto al filtro y a una fila de la cola durante el recorrido. Son estados visibles de la evidencia, no se retiraron para disimularlos; no constituyen contenido del medio.

No se detectó un nuevo defecto de recorte, alineación o deformación del **render real** en estas cinco capturas. Esta valoración no acredita una publicación remota, las miniaturas oficiales de todas las redes ni la puerta global de diseño.

## Evidencia automática y límites

`matriz-360.json` y `matriz-390.json` contienen 33 entradas cada uno: **0 desbordamientos horizontales y 0 infracciones axe serias/críticas**. Cada manifiesto conserva un error de consola HTTP 404 al visitar deliberadamente `/inexistente`. Por tanto, la exigencia literal de consola 0 errores no pasa; no se filtró el error para declarar verde la matriz. La puerta de tokens también conserva las desviaciones del armazón.

Las capturas están tomadas con movimiento reducido. Esta revisión estática no acredita autoplay, transiciones, 60 fps, caché, tiempos de carga ni CLS: esos criterios necesitan los recorridos y trazas propios de la puerta. Tampoco representa todos los posibles contenidos, longitudes de título, errores de red o permisos de cada usuario. Se revisaron las 33 pantallas/estados inventariados, no estados inexistentes en la evidencia.

## Pendientes de Walter

No se necesita una decisión de Walter para corregir M1. La integración de la misión de armazón y la resolución de sus divergencias con DIRECCION deben coordinarse antes de aprobar la experiencia completa. Esta revisión no autoriza ningún despliegue ni cambio productivo.
