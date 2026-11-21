# M7: evidencia del disparo automático

Fecha: 2026-11-21 15:03 (Lima). Frente operación de cooper-total. Consultas exclusivas de metadatos; no se disparó M7 ni se cambió su horario, retención o configuración.

## Evidencia ya observada

El horario no se acredita solo por `active=true`. La base conserva el trabajo del scheduler **2**, perteneciente a `FabAprendizaje01` y al nodo `6db48189-d01e-44f3-ad5a-bb5b99448091`. Su expresión es `21 0 */1 * * *`, zona `America/Lima`, habilitado y política de ejecuciones perdidas `skip`. El instante siguiente almacenado al consultar era **2026-11-21 15:00:21 Lima**.

La tarea **3** estaba programada para **14:00:21 Lima**, comenzó a las **14:00:21.030** y terminó a las **14:00:22.392**, estado `succeeded`. El trabajo registra despacho a las **14:00:22.166**. Esto acredita el disparo/despacho real del scheduler. La estadística de M7 muestra `production_success`, contador 3, último evento **14:00:33**; es evidencia adicional de finalización exitosa del workflow a continuación. [Metadatos exactos](evidencias/total-radar-contexto/m7/m7-scheduler.json).

El payload del scheduler conserva únicamente referencias de workflow y nodo, sin versión. La versión publicada observada es `f9e60b1a-c702-4569-aa2f-96a872cac035`, creada a las 12:56:01.495 Lima y con el mismo nodo. Esta unión contextual se distingue de una referencia directa a versión dentro de la tarea; no se inventa ese campo. [Vínculo y campos presentes](evidencias/total-radar-contexto/m7/m7-vinculo-version.json).

La tabla `execution_entity` no conserva una fila de las 14:00. M7 tiene retención de éxitos/errores `none`; la ausencia de esa fila no demuestra un fallo. Tampoco se atribuye el éxito al registro histórico 768 de las 08:00 Lima. Se conserva un contador `production_error=1` con último evento a las **13:00:44 Lima**: su causa no se recuperó ni se atribuye a permisos, proveedores o esquema sin evidencia.

## Ciclo de las 15:00: ejecución y versión directas

**PASS.** La observación de solo lectura capturó la ejecución **878** en modo **`trigger`**, workflow `FabAprendizaje01`, versión **`f9e60b1a-c702-4569-aa2f-96a872cac035`**. Comenzó a las **15:00:21.187 Lima** y terminó a las **15:00:22.314**, con `status=success` y `finished=1`. La versión publicada permaneció igual antes y después. Ahora el vínculo de versión sí consta directamente en `execution_entity.workflowVersionId`.

La tarea del scheduler **5**, trabajo **2**, quedó `succeeded`. `production_success` avanzó **3→4** con último evento a las **15:00:22**; `production_error` permaneció en **1**, con el mismo evento anterior de las 13:00:44. El siguiente instante almacenado pasó a **16:00:21 Lima**. No hubo errores de lectura y la fila 878 seguía presente al terminar la observación; no se afirma que la política de retención borre cada metadato inmediatamente.

[Recibo completo y saneado](evidencias/total-radar-contexto/m7/m7-observacion-1500.json) y [consulta ejecutada](evidencias/total-radar-contexto/m7/observar-m7.py). La consulta selecciona únicamente IDs, versión, modo, estado e instantes, más referencias y estadísticas del scheduler; no selecciona datos de ejecución, mensajes de error ni credenciales. Los servicios permanecieron sin cambios durante la ventana y el corte operativo comenzó después de las 15:02. No se hizo ninguna llamada manual al workflow.

## Fuentes y límites

La [documentación oficial del scheduler](https://docs.n8n.io/deploy/host-n8n/configure-n8n/durable-scheduler) explica que los trabajos y sus disparos se registran por separado en la base. La [configuración de datos de ejecución](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/manage-execution-data.md) permite no conservar los éxitos y errores. Se revisaron estas fuentes antes de interpretar los metadatos.

Este recibo prueba automatización del horario. No prueba que en cada hora haya una publicación elegible, nuevas métricas o una lección nueva; eso depende de los datos y ventanas de 24 h, 72 h y 7 días. El ciclo funcional real figura en el informe de aceptación de aprendizaje. No hubo nuevas publicaciones ni gasto para observarlo.

## Pendientes de Walter

Ninguno para observar este horario ya autorizado. Las decisiones de publicación y las esperas históricas permanecen en sus informes correspondientes.
