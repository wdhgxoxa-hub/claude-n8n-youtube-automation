# Cooper total — preparación de la revisión final

Fecha: 2026-11-21 12:40 (Lima). Worktree/rama propios `total-revision-final`, base `55bf5e9`.

## Cambios

Nuevo `cooper/scripts/verificar-rondas.py` y seis casos de regresión con informes ficticios
y videos sintéticos WebM/MP4. Prepara la revisión de `cierre-1` y `cierre-2` sin abrir
navegadores ni ejecutar puertas. El procedimiento está en [cooper-revision-rondas.md](../cooper-revision-rondas.md).

El índice existente solo descubre `ronda-N`; el nuevo revisor produce un índice separado
exclusivamente con las dos rondas elegidas y comprobadas. No altera índices anteriores.
Rechaza rondas fallidas/incompletas, baterías distintas, reintentos, métricas fuera de los
umbrales originales, Sentinel sin caos o con hallazgos. Decodifica todos los videos,
registra hashes y deja la revisión visual explícitamente pendiente.

## Evidencia y límites

Las seis pruebas focales pasan, incluida decodificación real de dos cuadros completos
por WebM/MP4 sintético, rechazo de truncamiento y preservación del índice anterior ante
una ronda fallida. No se ejecutó la puerta completa, navegador ni VPS por coordinación.
Las rondas finales todavía no existen/completaron en el momento de preparar este informe:
**no se declara ningún cierre técnico ni visual de la aplicación**. Sus resultados se
incorporarán cuando el orquestador confirme que terminaron.

Los intentos `total-1` y `final-1` conservan sus evidencias; sus informes tienen fallos u
omisiones y no cuentan como rondas limpias. No se cambiaron sus archivos.

## Pendientes de Walter

Ninguno para preparar o ejecutar esta revisión local. La aceptación visual en un teléfono
físico y Safari, si se utiliza, conserva el pendiente general existente.
