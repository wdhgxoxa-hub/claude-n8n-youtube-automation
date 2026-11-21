# Diagnóstico del parser de la sonda vidIQ

2026-11-21 13:37, Lima. Worktree/rama `total-vidiq-parser`, base integrada `7d4f9c4`. Commit funcional `2ec8f9e`; este cierre precisa la causa y añade controles del evaluador real. Sin acceso al VPS, cuentas, credenciales reales ni llamadas a proveedores.

## Causa y alcance

La expresión compacta de `Leer cuenta sin créditos` fallaba antes del transporte en los evaluadores **reales de n8n 2.47.4 y 2.47.6**: `invalid syntax`. El control `JSON.stringify({outer:{inner:1}})` también falla; `JSON.stringify({ outer: { inner:1 } })` pasa. Los cierres contiguos `}}` chocan con el delimitador de la expresión. **La clave `arguments` es válida**: el control con espacios lo demuestra. No se atribuye el fallo a la cuenta, permisos, cuota ni conexión vidIQ.

La sonda ahora serializa el cuerpo en su nodo Code `Pedidos gratuitos`; HTTP solo evalúa `={{ $json.cuerpo }}`. Conserva las herramientas gratuitas permitidas, IDs, argumentos, endpoint, referencia de credencial, ausencia de reintentos y diagnóstico saneado. El lector clasifica `invalid syntax` como error de expresión, sin conservar mensajes privados. Las pruebas también cubren `data`, que es el campo de salida real de HTTP Request con formato texto y respuesta completa.

Se comprobaron los **ocho cuerpos canónicos originales** de música y vidIQ. Todos pasan en ambas versiones, porque ya contienen espacios entre los cierres. El generador y esos JSON se conservan exactamente: no hay delta canónico, activaciones, permisos ni presupuestos modificados.

## Prueba y evidencia

| Ensayo | 2.47.4 | 2.47.6 |
| --- | --- | --- |
| Expresión anterior de la sonda | `invalid syntax`, esperado | `invalid syntax`, esperado |
| Objeto anidado compacto / espaciado | Rechaza / acepta | Rechaza / acepta |
| Clave `arguments` con espacios | Acepta | Acepta |
| Sonda corregida, evaluador y HTTP Request reales | 2/2 PASS | 2/2 PASS |
| Ocho expresiones canónicas y HTTP Request reales | 8/8 PASS | 8/8 PASS |

El nodo HTTP real usa un transporte sustituido por respuestas SSE ficticias; las imágenes se ejecutan con `--network=none`, sin volumen de configuración ni credenciales. Es una prueba del parser/nodo, **no una aceptación real de vidIQ**. Se comunicó la corrección al frente de competencia para su ensayo autorizado en el VPS.

Desde la raíz, `node --test tests/flujos_v2.test.cjs tests/sonda_vidiq.test.cjs`: **181/181 PASS** (173 flujos + 8 sonda), sin omisiones, errores ni advertencias. `git diff --check`: PASS. No se repitió la puerta de la aplicación, que corre en el orquestador; este cambio solo afecta a una sonda auxiliar y sus pruebas.

Regresiones reproducibles: `tests/fixtures/sonda_vidiq_runtime.cjs` recibe el JSON público generado por `tools/cooper/preparar_sonda_vidiq.py`; `tests/fixtures/mcp_runtime.cjs` recibe los dos JSON canónicos. Ejecutar con Node como entrypoint dentro de las imágenes n8n correspondientes, red deshabilitada y solo esos archivos públicos montados. [Recibos y huellas](evidencias/total-vidiq-parser/resultado.json).

## Protocolo contrastado

La secuencia de la sonda ya es `initialize → notifications/initialized → tools/list → tools/call`. Tras inicializar reenvía `mcp-session-id` cuando está presente y el protocolo negociado. Incluye ambos tipos aceptados, JSON y SSE, y distingue el ID JSON-RPC al leer resultados. No faltaba la notificación de inicio. Referencias oficiales consultadas el día del ensayo: [ciclo MCP](https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle), [transporte MCP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports), [HTTP Request de n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/), [fuente HTTP Request 2.47.6](https://github.com/n8n-io/n8n/blob/n8n%402.47.6/packages/nodes-base/nodes/HttpRequest/V3/HttpRequestV3.node.ts), [MCP de vidIQ](https://support.vidiq.com/en/articles/15082430-vidiq-mcp) y [herramientas oficiales](https://github.com/vid-io/vidiq-mcp).

## Pendientes de Walter

Ninguno para corregir el parser. El acceso real y saldo de vidIQ deben acreditarse con el ensayo del frente de competencia; este informe no presume crédito disponible, consumo cero real ni necesidad de comprar o reconectar una cuenta.
