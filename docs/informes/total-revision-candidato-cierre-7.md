# Revisión visual del candidato anterior: cierre-7

Fecha: 21 de noviembre de 2026, 16:38, Lima.

La ronda `cierre-7`, fuente **`22ece8e1f078b149944118feeabbb6c803992ff4`**, aprobó sus 92 pruebas. Se revisaron 24 capturas originales y 44 fotogramas de sus dos recorridos continuos, sin defectos visuales observados en esas muestras. Las capturas, matrices, recorridos y marcas de tiempo coinciden por SHA-256 entre el checkout original y la copia completa del orquestador.

**Es evidencia de un candidato anterior, no aceptación final de cooper-total.** Después de esta revisión, el orquestador comunicó que otro integrador preparó el superconjunto `b3e608e`, con cambios adicionales y sus propias rondas. No se inspeccionaron ese árbol ni sus procesos; sus resultados no se deducen de los de `22ece8e`. Se detuvo la revisión de `cierre-8` antes de inspeccionar una sola muestra.

## Evidencia y alcance

- [Resultado de la ronda](evidencias/total-revision-candidato-cierre-7/resultado.json): 92 aprobadas, cero inesperadas, inestables u omitidas; ningún error global. Inicio `2026-11-21T21:00:15.151Z`, duración 1 990 893 ms. El log conserva `92 passed (33.2m)` y el aviso informativo `Slow test file` de los dos casos Sentinel, 11,9 minutos acumulados.
- [Registro de 24 originales](evidencias/total-revision-candidato-cierre-7/revision-visual.json): Inicio, Marcas, Cuentas, Publicados, Aprendizaje y Ajustes de fábrica; 1440/390 px y ambos temas. Cada entrada contiene observación, fecha de revisión, SHA-256 y rutas de fuente/copia. Las huellas previas, posteriores y de la copia coinciden.
- [Cuatro matrices completas](evidencias/total-revision-candidato-cierre-7/matrices.json): 22 pantallas por matriz, con la línea del caso aprobado y huellas tomadas antes de la inspección visual. Las muestras se abrieron después de esas dos condiciones; un JSON parcial no se tomó como matriz terminada.
- [Registro de los recorridos](evidencias/total-revision-candidato-cierre-7/recorridos.json): 22 fotogramas nativos por recorrido, uno por ruta, todos efectivamente abiertos e inspeccionados. Cada entrada conserva instante, intervalo, SHA-256, observación y ruta local del PNG derivado. Los vídeos continuos duran 40,84 s en escritorio y 46,64 s en móvil.
- [Recortes y procedencia](evidencias/total-revision-candidato-cierre-7/recortes.json), [tabla móvil oscura](evidencias/total-revision-candidato-cierre-7/publicados-390-oscuro-tabla.png) y [clara](evidencias/total-revision-candidato-cierre-7/publicados-390-claro-tabla.png): derivados vistos a tamaño nativo después de inspeccionar los originales completos. No se alteraron los archivos fuente.

La copia completa está en `cooper/.cache/videos-integracion3/cierre-7` del worktree `cooper-total`; el original permanece en `.cache/ci-limpia-GjwbhS/checkout/cooper/.cache/videos-integracion3/cierre-7`. Los fotogramas derivados se conservan en `.cache/revision-rondas/recorridos/cierre-7` del worktree `total-revision-rondas-cierre`; sus ubicaciones absolutas quedan registradas. Se pueden reproducir desde el vídeo y los segundos exactos del recibo mediante FFmpeg, sin volver a ejecutar navegadores.

## Observaciones visuales

En las dos muestras móviles de Publicados se leen completos `1630`, `2860`, `4090` y `5320`, sin partir cifras entre líneas. Las fechas y encabezados permanecen enteros; la tabla conserva el área de desplazamiento horizontal y la retención queda fuera de la vista inicial. Las seis tarjetas muestran sus orígenes, métricas y ausencias de datos. Los formularios y controles de las demás muestras conservan etiquetas y separación; Aprendizaje muestra el origen y la limitación de las lecciones ficticias históricas, junto a las causas y acciones de las correcciones.

Los fotogramas de los recorridos permiten reconocer las 22 rutas en orden, desde Entrada hasta Ajustes de fábrica. En escritorio, la muestra de Inicio captura el tercer paso del modal de bienvenida; en móvil, captura la pestaña Fábrica después de cerrarlo. Marcas aparece desplazada al formulario de conexión y calendario. Esos estados corresponden a las acciones de los recorridos. No se observaron páginas de error, pantallas vacías ni superposiciones que impidieran leer los elementos visibles en estos fotogramas.

La revisión de recorridos es **muestreo visual por ruta**, no observación humana de todos los cuadros. No se ejecutó una decodificación integral de los vídeos de esta pareja: esa tarea se había delegado al supervisor para cuando ambas rondas fueran completas y dejó de ser aceptación final al cambiar el candidato. No se declara un índice final aprobado ni dos rondas finales limpias a partir de esta evidencia.

## Sentinel y puerta

Sentinel registró 36 pantallas y 6521 acciones de caos en escritorio, y 35 pantallas y 9170 acciones en móvil. Se ejecutaron recorridos, caos y estabilidad; los hallazgos finales son únicamente informativos sobre cobertura de vistas sin URL propia. Caos y estabilidad registran cero hallazgos. Los observadores conservaron 3633 y 3137 peticiones `net::ERR_ABORTED`, respectivamente, y ninguna `ERR_BLOCKED_BY_CLIENT`; no se ocultaron ni se les asignó una causa general no demostrada.

La [puerta7 del candidato](evidencias/cooper-total/puerta-cierre-7/resultado.json), conservada en la rama integrada, acredita 462 pruebas unitarias, 77 E2E y 173 de flujos; los ocho pasos terminaron con código 0 y cero advertencias. Esta revisión documental no repitió la puerta ni inició nuevas aplicaciones, navegadores, producción, OAuth o llamadas a proveedores. Extracción de fotogramas y comprobaciones locales se limitaron a CPU 0–1.

## Commits y límites

La fuente revisada es `22ece8e`. El informe y sus siete archivos de evidencia se entregan en el commit documental atómico «Documenta la revisión visual del candidato anterior de cierre siete». El antecedente de `cierre-5` se conserva por separado en [su informe histórico](total-revision-historica-cierre-5.md), commit `699a2fd`; ninguna muestra anterior se contó como muestra de esta ronda.

La evidencia usa datos ficticios de aceptación; no acredita publicaciones reales ni funcionamiento sobre dispositivos físicos. La revisión visual no sustituye mediciones de contraste WCAG. El estado de `cierre-8` y la aceptación del candidato posterior quedan bajo control del orquestador: **cero muestras de cierre-8 revisadas por este frente**. `docs/ESTADO.md` sigue reservado a su integración para preservar cambios de otros frentes.

## Pendientes de Walter

Ninguno para esta entrega documental. La aceptación del candidato posterior y la revisión de sus propias dos rondas corresponden a Codex; esta evidencia no las reemplaza.
