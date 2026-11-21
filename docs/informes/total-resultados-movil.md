# Cooper total — cifras legibles en tablas móviles

Fecha: 2026-11-21 14:14 (Lima). Rama/worktree propios `total-resultados-movil`, base `86a5727`.

## Hallazgo y corrección

La inspección de las 24 capturas de `cierre-1` encontró V01 en Publicados a 390 px,
en ambos temas: la tabla expandida partía `2860`, `4090` y `5320` entre dos líneas.
También dividía encabezados. Las otras 22 muestras inspeccionadas no mostraron
problemas funcionales de disposición. Se conserva el [recibo visual por archivo y
SHA-256](evidencias/total-resultados-movil/revision-cierre-1-con-hallazgo.json).

El contenedor ya permitía desplazamiento, pero la tabla de ancho 100 % heredaba
`overflow-wrap: anywhere`. El commit **75ccb4c** añade ancho mínimo por contenido y
mantiene las celdas completas; la tabla se desplaza dentro de la tarjeta sin ensanchar
la página. El orquestador lo integró como **bfd5e79**. No cambia los valores ni oculta
columnas o tablas.

La regresión amplía el caso existente de Publicados: mide los fragmentos reales del
texto de todas las celdas a 390/1440 px, comprueba que la página no desborda, desplaza
la región con una flecha del teclado y verifica que Retención es accesible al final.
Conserva las comprobaciones de filtros, datos ausentes y correcciones de Aprendizaje.
La batería sigue teniendo el mismo número de casos.

## Evidencia

- Rojo reproducido con el CSS anterior: falla por celdas partidas, incluida `5320`.
- Lint, tipos y build pasan sin errores ni advertencias.
- Focal corregido: 1/1 en Chromium. Comprobación adicional: 3/3 en Chromium,
  Firefox y WebKit; cada caso recorre 390 y 1440 px, sin retries ni omisiones.
- Inspección visual directa de cinco PNG corregidos: los cuatro valores conservan
  sus dígitos en una línea; escritorio muestra cinco columnas y móvil permite el
  desplazamiento comprobado por el test. [Móvil](evidencias/total-resultados-movil/tabla-evolucion-390.png),
  [escritorio](evidencias/total-resultados-movil/tabla-evolucion-1440.png),
  [Firefox](evidencias/total-resultados-movil/firefox-390.png),
  [WebKit](evidencias/total-resultados-movil/webkit-390.png).
- Ensayo en contenedor Debian aislado, herramientas `cooper-ci:9dbea5b8177a`,
  CPU 0–1, dos núcleos, puertos propios y datos ficticios. [Recibo y huellas](evidencias/total-resultados-movil/resultado.json).

La puerta completa integrada está a cargo del orquestador y se repite tras este cambio.
Estas pruebas focales no se presentan como sustituto de esa puerta ni del despliegue.

## Estado de las rondas y límites

`cierre-1` aprobó 92/92 pruebas automáticas, pero **no es una ronda visualmente limpia**.
El aviso informativo del reporter `Slow test file` conserva la duración de Sentinel;
no se filtró ni se cambió su umbral. Los archivos originales quedan intactos en
`cooper/.cache/videos-integracion3/cierre-1/` del worktree del orquestador.

Se priorizó corregir V01 antes de revisar los dos recorridos y decodificar todos los
videos. Por tanto, todavía no hay aprobación de esos recorridos, del verificador
completo ni de dos rondas finales. La segunda ronda de la versión anterior se detiene
y sus artefactos se conservan. Las nuevas rondas deben identificarse por separado y
volver a pasar inspección visual y decodificación completa.

No se accedió a VPS, proveedores ni credenciales; no hubo producción o publicación real.

## Pendientes de Walter

Ninguno para esta corrección. Se conserva la aceptación general en teléfono físico y
tecnologías de asistencia si se utilizan; emulación y motores de escritorio no la sustituyen.
