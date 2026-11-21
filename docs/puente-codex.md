# Puente local de texto GPT — fase 6

Servicio Node.js sin dependencias adicionales: `servicios/puente-codex/server.mjs`. Escucha únicamente en `127.0.0.1`. No se ha instalado como servicio ni se ha usado la cuenta de Walter durante esta misión.

## Contrato y ejecución

`POST /v1/texto`, `Content-Type: application/json`, `Authorization: Bearer <token privado>`. Cuerpo:

```json
{"tarea":"radar","prompt":"... instrucciones y contrato JSON ...","buscar_web":false}
```

Tareas permitidas: `critico`, `critico_nicho`, `verificador`, `radar`, `radar_noticia`, `verificador_noticia`. El cliente no puede elegir ejecutable, argumentos, rutas, entorno ni modelo. Máximo 60.000 caracteres de prompt y 256 KiB de cuerpo. `GET /salud` requiere la misma autenticación y solo comprueba el proceso HTTP, no la sesión de ChatGPT.

El chat de Cooper añade `POST /v1/chat` con la misma autenticación y cuerpo cerrado `{"prompt":"contexto y pregunta"}`. Devuelve `{"texto":"respuesta","llamadas":[{"nombre":"estado","argumentos":"{}"}]}`; los argumentos son JSON textual que Cooper valida con Zod y su esquema de herramienta antes de comprobar dueño/confirmación. Usa `chat.schema.json` como salida estructurada fija, sin búsqueda ni herramientas del CLI. No admite argumentos, herramientas nativas o esquema suministrados por el cliente. Comparte la única plaza del servidor con `/v1/texto`; ocupado devuelve 429 y Cooper intenta su siguiente respaldo. Al instalar el servicio hay que incluir `chat.schema.json` junto a `server.mjs` y `contrato.cjs`. [Configuración, límites y prueba real del chat](informes/cooper-chat-planes.md).

Cada solicitud ejecuta `codex exec --json --ephemeral --ignore-user-config --skip-git-repo-check --sandbox read-only --color never`, con prompt por stdin, sin shell, aprobación `never`, autenticación forzada `chatgpt`, shell/apps/hooks desactivados y búsqueda `live` únicamente cuando corresponde. El directorio de trabajo es temporal y vacío. El entorno heredado se limita a `PATH`, `HOME`, `CODEX_HOME`, `TMPDIR`, `LANG`; no hereda claves API ni el token del puente. El proceso elimina el temporal al finalizar. No lee ni copia archivos de autenticación: Codex gestiona su sesión guardada.

Hay una ejecución simultánea, sin cola. A los 40 segundos se termina el grupo de procesos (180 segundos exclusivamente para `tarea: radar` con `buscar_web: true`; clientes acotados a 190 segundos); también al desconectarse el cliente o superar 2 MiB de salida. El servicio requiere salida JSONL completa, evento `turn.completed`, ausencia de error y JSON final compatible con la tarea. Las investigaciones requieren un evento de búsqueda. Devuelve un sobre compatible con `output` de Responses, `ruta: codex`, uso de tokens si está disponible, `busqueda_real` y `fuentes_consultadas` obtenidas de eventos de búsqueda, nunca del texto final.

Estados HTTP: 400 entrada inválida, 401 autenticación/Origin, 413 cuerpo excesivo, 415 tipo incorrecto, 429 ocupado, 502 error o respuesta inválida, 504 tiempo agotado. Los errores son códigos acotados; no incluyen stderr. El log contiene ID aleatorio, tarea, resultado, ruta y duración; no cabeceras, prompts, respuestas ni tokens. El token mínimo es de 32 caracteres. No hay CORS ni acceso desde navegador.

## Integración en n8n

`FX · Texto GPT con respaldo` (`FabTextoGPT0001`) recibe un pedido interno con `tarea`, `body` de Responses y `costo_estimado_usd`. Conserva las instrucciones de los roles existentes. Crítico de nichos, crítico del guion, verificador de cifras y analista de tendencias usan este subflujo, así como los verificadores de noticias. Las imágenes y la revisión visual mantienen sus rutas API.

1. Intenta el HTTP local, con timeout de 45 segundos.
2. Revisa contrato, tarea, búsqueda y evidencia. Para noticias exige URLs de los eventos. Si el CLI de Walter solo devuelve la consulta y omite URLs, selecciona el respaldo; no convierte URLs escritas por el modelo en evidencia.
3. Ante caída, saturación, timeout o salida inválida, llama a `POST https://api.openai.com/v1/responses`, con la credencial OpenAI de n8n, `store:false`, modelo `Ajustes.modeloCritico` y timeout de 180 segundos. Las búsquedas incluyen `web_search_call.action.sources`.
4. Si ambas rutas fallan, lanza error y detiene el paso. No se reutiliza una respuesta anterior ni se aprueba por ausencia de respuesta.

`allowTextoApi` empieza en `false`, como los demás interruptores de gasto. Walter debe activarlo expresamente para disponer del respaldo automático. No hace falta activarlo para usar Codex. Los interruptores heredados `allowCritico`, `allowVerificacion` y `allowRadar` conservan sus funciones; las verificaciones obligatorias de un pedido de noticia no se omiten al apagar el crítico.

El subflujo de texto no conserva datos de ejecución en éxito/error para evitar guardar cabeceras. Los flujos de negocio sí guardan resultados y evidencia; revisar su retención como parte de la operación privada de la fábrica.

## Uso y ahorro

Cada tarea completada registra en `fab_costos` dueño, paso, servicio efectivo, `ruta`, `usd`, `ahorro_estimado_usd` y `motivo_respaldo`. El registro por paso conserva el upsert existente. Codex: USD incremental estimado 0 y ahorro igual a la tarifa configurada de la tarea; API: tarifa estimada y ahorro 0. Son estimaciones por tarea de `Ajustes`, no precios oficiales por token ni una lectura de la factura. No incluyen el precio fijo del plan, infraestructura ni consumo de intentos fallidos/incompletos. No sumarlos como beneficio neto ni tratar una cuota ChatGPT como ilimitada. No se muestran proveedores o costos a usuarios normales.

## Estado local y preparación de otros entornos

El 20-11-2026 se instaló `puente-codex.service` de usuario, con autenticación y escucha exclusiva en `127.0.0.1:8789`. `videos-n8n` accede mediante Pasta. Una llamada real corta del crítico devolvió un resultado válido por Codex; el respaldo API está configurado con la credencial OpenAI existente, sin invocarlo durante la aceptación. [Evidencias, límites, identidad usada y reversa](informes/cooper-vivo-final.md). La [unidad versionada](../deploy/systemd/puente-codex.service) usa código instalado en `~/.local/lib/cooper/puente-codex` y configuración privada externa.

Para preparar un entorno adicional:

- Usuario de sistema dedicado y sin acceso a repositorios, claves de la fábrica o documentos privados. Su entorno de Codex debe tener una sesión ChatGPT ya preparada por Walter, sin conectores/MCP/plugins adicionales; una configuración administrada puede prevalecer sobre flags. No ejecutar el puente con el perfil personal de trabajo ni compartir archivos de autenticación.
- Verificar la versión instalada de Codex con los flags documentados. La ayuda local de esta misión los admite; no se ensayó la sesión ni la cuota reales. `forced_login_method=chatgpt` puede cerrar una sesión que use otra autenticación: usar el perfil dedicado.
- Configurar las variables del [ejemplo](../servicios/puente-codex/.env.example) mediante el gestor de secretos/servicios del entorno, sin imprimirlas. Arranque: `node servicios/puente-codex/server.mjs`. No carga `.env` automáticamente. El HTTP debe permanecer privado y fuera del proxy público.
- Compartir el espacio de red loopback entre n8n y el puente, o establecer un túnel local autenticado gestionado por el operador. El `127.0.0.1` de un contenedor aislado no alcanza el host. Se rechazan URLs distintas de loopback; esta fase no modifica contenedores ni abre puertos externos.
- Aplicar las columnas aditivas de [cooper-migracion-tablas.json](../contratos/cooper-migracion-tablas.json), importar los JSON regenerados mediante la revisión/integración habitual y permitir solo `crypto` en el runner. Configurar `PUENTE_CODEX_URL` y `PUENTE_CODEX_TOKEN` en el entorno de n8n y su runner. No trasladar la clave de OpenAI al puente.
- Confirmar credencial API, modelo disponible, tarifas estimadas y activar el respaldo. Ensayo manual acotado: éxito Codex, CLI ausente, cuota agotada, timeout y fallo API; comprobar registro de ruta y detención. Queda pendiente, sin gasto realizado en esta misión.

## Pruebas y documentación oficial

`node --test tests/puente-codex.test.mjs` lanza un ejecutable ficticio y HTTP en puertos libres loopback; cubre autenticación, límites, concurrencia, JSONL, búsqueda, errores, timeout, cancelación y entorno sin claves. `node --test tests/flujos_v2.test.cjs` ejecuta los nodos generados y comprueba ruta, respaldo, ahorro y puertas.

Consultado el 20-11-2026: [Codex no interactivo](https://learn.chatgpt.com/docs/non-interactive-mode), [autenticación](https://learn.chatgpt.com/docs/auth?surface=cli), [configuración](https://learn.chatgpt.com/docs/config-file/config-reference), [Responses](https://developers.openai.com/api/reference/resources/responses/methods/create), [búsqueda y fuentes](https://developers.openai.com/api/docs/guides/tools-web-search?api-mode=responses), [subflujos n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflow/), [módulos permitidos en Code](https://docs.n8n.io/hosting/configuration/configuration-examples/modules-in-code-node/). Se contrastó también `codex exec --help`; no se ejecutó Codex real ni se inició OAuth.
