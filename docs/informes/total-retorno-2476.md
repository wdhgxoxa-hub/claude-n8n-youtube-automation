# cooper-total — retorno compatible con n8n corregido

21-11-2026, 12:14 Lima. Rama `total-retorno-2476`, base `4cbe485`. Implementado y probado localmente; integración y aplicación VPS corresponden al orquestador. No hubo cambios en el servidor, cuentas reales, pagos ni publicaciones.

## Cambios y commits

- `67d3bd0`: el helper adopta la candidata de `deploy/infra-imagenes.json`. La comparación admite exclusivamente la referencia anterior del mismo manifiesto; ambas deben ser oficiales y llevar digest. Rechaza etiquetas mutables, imágenes ajenas y argumentos. Usa `--pull never`, red interna comprobada, puerto loopback y 0,5 CPU. El mensaje de ensayo informa la versión comprobada.
- `7b5b1ce`: corrige la composición de M01 con Aprendizaje. La extensión validaba en «Fila actualizada» y «Evento» leía ese nodo antes de su ejecución. Los retornos válidos devolvían HTTP 500; además se perdía el recibo requerido para deduplicar. Ahora valida al preparar «Reserva del retorno», conserva contexto, huella y entrega pendiente, y despacha el resultado ya verificado. Solo confirma entrega después del Orquestador. Regeneración limitada en resultado a `FabRetornoClaud1.json`.
- `941ff5b` es el cherry-pick del `2d82c9e` del orquestador; no hace falta integrarlo por duplicado. La aceptación de aprendizaje usa sus ajustes originales y ahora aporta el trabajo al preparar la reserva.

## Evidencia

El defecto anterior se reprodujo en ambas versiones: 5/13 pasaron y 8/13 fallaron. El error observado fue `Node 'Fila actualizada' hasn't been executed`. No era una regresión de n8n 2.47.6.

Tras corregirlo:

| Prueba | Resultado |
| --- | --- |
| Retorno real aislado n8n 2.47.6 | 15/15, código 0; [log](evidencias/total-retorno-2476/candidata-corregida.log) |
| Control real aislado n8n 2.47.4 | 15/15, código 0; [log](evidencias/total-retorno-2476/anterior-corregida.log) |
| `node --test tests/flujos_v2.test.cjs` | 172/172, código 0; [log](evidencias/total-retorno-2476/flujos.log) |
| Selector de imágenes | 3/3, código 0; [log](evidencias/total-retorno-2476/imagenes.log) |
| ESLint de ambos scripts modificados, `--max-warnings 0`; Prettier | Código 0, sin advertencias |

La prueba real conserva autenticación, dueño persistido, duplicados idénticos/reordenados, rechazo de contenido alterado, ocho callbacks concurrentes con un solo despacho, `claude_error`, timeout de envío, incertidumbre durable tras reinicio, fallo del despacho, tramo sin ítems, rechazo de URL antigua y reversa del workflow sin reentregar trabajos. Añade dos casos de integración: aprendizaje con contexto y métrica normalizada conservados, y guion con omisión o ID ajeno rechazado antes de reservar o ejecutar el Orquestador. Una corrección posterior válida sí se entrega; el recibo final sigue permitiendo deduplicación.

El [recibo](evidencias/total-retorno-2476/resultado.json) registra imágenes, conteos y hashes del workflow, extensión, aceptación y prueba. Los contenedores del ensayo quedaron detenidos. Se reutilizó el adaptador existente y se consultaron la [documentación oficial de la API](https://docs.n8n.io/connect/n8n-api.md) y su [referencia](https://docs.n8n.io/connect/n8n-api/api-reference.md).

## Puerta y limitaciones reales

Este frente modifica un helper de ensayo y el retorno de n8n; no modifica producto web ni compila una imagen. Por coordinación del orquestador no se lanzaron builds ni navegadores concurrentes. La puerta web completa y las dos rondas integradas deben corresponder a la próxima fuente congelada; los resultados anteriores de `970d102` no se presentan como puerta de esa futura fuente.

El ensayo usa el Inicio y la Ruta reales del Orquestador, con un sumidero ficticio que evita producción, Telegram y proveedores. Comprueba el contrato del retorno y la validación editorial, no toda la producción audiovisual. Los rechazos editoriales previos a la reserva conservan el estado `enviado` y no despachan; actualmente n8n responde HTTP 500 genérico ante esa validación, sin presentar entrega exitosa. Una entrega incierta exige revisión y no se reintenta automáticamente.

## Pendientes de Walter

No hay decisiones nuevas para este arreglo. Continúan las credenciales, permisos y aprobaciones humanas ya documentadas por la misión principal. Pendiente técnico: integrar el arreglo y ensayar/aplicar el lote actualizado durante el turno coordinado del VPS.
