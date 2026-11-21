# Ensayo de aprendizaje con publicaciones existentes

Este procedimiento prepara flujos manuales independientes. No cambia interruptores ni publica el M7 original, no crea videos y no ejecuta Telegram, rutinas Claude ni APIs de IA. La renovación usa la conexión Google existente dentro de n8n; no inicia OAuth ni exporta credenciales. Las llamadas permitidas son GET a YouTube Analytics y Upload-Post, y POST de renovación a Google. La consulta puede consumir cuota de lectura ya disponible, pero no contrata ni compra servicios.

La CLI oficial permite ejecutar un workflow guardado por ID: [documentación de n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md). No hace falta exponer otro webhook. La salida cruda de la CLI puede contener datos de nodos; debe descartarse íntegra mediante el wrapper incluido.

## 1. Preparar y comprobar

Desde el checkout integrado, sustituir los IDs de ejemplo por videos ya publicados:

```sh
python3 tools/cooper/preparar_ensayo_aprendizaje.py \
  --salida .cache/ensayo-aprendizaje \
  --video-id ID_EXISTENTE_1 --video-id ID_EXISTENTE_2
```

Produce `CoopEnsayoTok01.json`, `CoopEnsayoApr01.json` y un manifest con hashes. No lee `.env`, no se conecta a ninguna API y solo usa referencias públicas del generador. Aplicar el mapa de IDs de tablas/credenciales del lote integrado antes de importar. Nunca sustituir referencias por valores de tokens. Las columnas de observabilidad de integración 3 deben existir.

En n8n 2.47, el modo CLI exige una versión publicada de sus subflujos. Publicar temporalmente **solo** `CoopEnsayoTok01` mediante la CLI oficial: contiene únicamente un trigger interno, sin webhook, calendario ni nodo de publicación. La captura raíz y el guardado de lecciones siguen inactivos. Al terminar las sondas, despublicar y eliminar el getter temporal. No activar producción para satisfacer esta dependencia.

Usar el respaldo y rollback ya comprobados del despliegue. Además, registrar los valores previos de `retencion_media`, `metricas_youtube`, `metricas_consultadas_en` de los videos elegidos; `metricas_historial` y `metricas_consultadas_en` de sus publicaciones; y los IDs de trabajos existentes. Esos registros no contienen tokens. Asegurar que los tres IDs de ensayo no estén ocupados; no sobrescribir un flujo ajeno. Importar los dos JSON como inactivos en el mismo proyecto/propietario. Revisar que ningún nodo apunte a un flujo distinto de `CoopEnsayoTok01`.

## 2. Capturar sin salir del circuito de lectura

Ejecutar dentro del contenedor n8n, con su configuración existente:

```sh
sh /ruta/ejecutar_ensayo_aprendizaje.sh CoopEnsayoApr01
```

El wrapper devuelve únicamente el código de salida. Deshabilita conservación de ejecuciones y descarta stdout/stderr, incluidos errores. Ambos workflows también llevan `saveDataSuccessExecution=none`, `saveDataErrorExecution=none`, `saveManualExecutions=false` y `saveExecutionProgress=false`, sin error workflow. No consultar ni volcar `runData` para verificarlo.

Cuando la instancia usa runners externos, la CLI necesita su propio broker. No detener el runner del servicio ni cambiarlo a modo interno. En el host VPS se prepara `tools/cooper/ejecutar_cli_aislada.py` y se ejecuta como operador con `sudo -n python3 /ruta/ejecutar_cli_aislada.py CoopEnsayoApr01`. El helper reserva su ejecución con un lock, usa broker `5689`, launcher `5688` y health JS `5687`, y termina únicamente el launcher temporal. La autenticación del runner se hereda dentro del contenedor; no se extraen variables ni se pasan tokens a la línea de comandos. Los Code nodes temporales no reciben las variables privadas de Cooper. La salida conserva solo código CLI y metadata de ejecución; exige además observar datos nuevos en la tabla. No interpretar un código 0 sin evidencia como un ensayo correcto.

Referencias oficiales: [runners externos](https://docs.n8n.io/deploy/host-n8n/configure-n8n/set-up-task-runners.md), [variables de puertos](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/task-runners.md) y [configuración del launcher](https://github.com/n8n-io/task-runner-launcher/blob/main/docs/setup.md).

Comprobar mediante proyecciones de las tablas, sin columnas de credenciales:

- Historial y fecha nuevos por video/red. Un contador cero es válido; un dato ausente sigue siendo `null`. YouTube puede tardar en entregar informes.
- Trabajo `aprender-ensayo-*` con `modo=aprender`, `estado=bloqueado` y `_aprendizaje.evidencias`. Incluye solo métricas y contexto creativo del mismo canal. No se envió a ningún proveedor de IA.
- Trabajo `aprender-diag-*` con diagnóstico mínimo: respuesta presente, indicadores de error, métricas disponibles e ID YouTube nativo únicamente cuando la respuesta confirma el mismo `request_id`. No almacena tokens, errores crudos ni respuestas completas. Permite reconciliar `youtube_id` sin consultar `runData`; verificar primero el mismo video/canal y respaldar el valor anterior.
- Ningún video o publicación nuevo y ninguna fila nueva de costos. Los workflows originales siguen con su estado previo.

Se respetan las mismas ventanas, espera mínima y consulta diaria del M7. Si aún no toca medir, no hay conexión válida o la plataforma no entrega datos, puede no aparecer un trabajo. Eso se registra como límite real; no se fuerzan cifras ni se declara éxito por el código 0. La captura solo mide los IDs explícitos, aunque existan otros videos.

## 3. Revisar y persistir una lección real

Revisar únicamente la evidencia del trabajo observado y redactar una propuesta JSON con `resumen` y `lecciones`. Cada lección necesita `regla`, `causa`, `correccion` y `origenes`: cada origen contiene `video_id`, `red`, `ventana` y `metrica`. Describir la causa como hipótesis, citar contexto disponible y reconocer lo ausente. No afirmar que la propuesta ya se aplicó. El valor numérico se toma de la evidencia persistida, no del texto propuesto.

```sh
python3 tools/cooper/preparar_ensayo_aprendizaje.py \
  --salida .cache/ensayo-aprendizaje-leccion \
  --job-id aprender-ensayo-ID-0 --lecciones propuesta-revisada.json
```

Importar el `CoopEnsayoLec01.json` generado y ejecutar:

```sh
sh /ruta/ejecutar_ensayo_aprendizaje.sh CoopEnsayoLec01
```

Este flujo no tiene HTTP ni llamadas a otros flujos. Solo lee el trabajo exacto, exige que siga bloqueado y pertenezca al canal de la evidencia, valida cada lección y actualiza ese trabajo a `listo`. Rechaza una repetición ya aplicada. Comprobar en Aprendizaje origen, métrica, causa y corrección; comprobar con un encargo de guion controlado que sus IDs entren a la lectura obligatoria. No es necesario producir ni publicar el video para comprobar la lectura del contrato.

## 4. Reversa y cierre

Para probar rollback, restaurar solo las columnas observacionales de las filas elegidas a su snapshot y retirar solo los trabajos `aprender-ensayo-*` y `aprender-diag-*` creados por este ensayo; comparar los valores y conteos con el snapshot. Después se puede repetir la captura. Eliminar los tres workflows temporales por sus IDs comprobados; ninguno contiene triggers públicos o programados. Conservar el manifest y un resumen de resultados sin tokens. No declarar rollback probado hasta comparar el estado restaurado.

Un resultado observado no reconstruye las métricas de 24h/72h que nunca se midieron: conserva la fecha y demora reales. Una hipótesis guardada y su lectura por el siguiente guion cierran el circuito técnico; demostrar mejora requiere métricas futuras de un video aprobado por una persona.
