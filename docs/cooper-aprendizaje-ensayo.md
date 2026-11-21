# Ensayo de aprendizaje con publicaciones existentes

Este procedimiento prepara flujos manuales independientes. No cambia interruptores ni publica el M7 original, no crea videos y no ejecuta Telegram, rutinas Claude ni APIs de IA. La renovación usa la conexión Google existente dentro de n8n; no inicia OAuth ni exporta credenciales. Las llamadas permitidas son GET a YouTube Analytics, Upload-Post y `videos.list` de YouTube Data API (título, miniaturas y duración de IDs ya publicados), y POST de renovación a Google. La consulta puede consumir cuota de lectura ya disponible, pero no contrata ni compra servicios.

La CLI oficial sirve para importar, publicar y despublicar las sondas: [documentación de n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md). En la versión 2.47.4 instalada, ejecutar tablas con `n8n execute` tiene la limitación descrita abajo. La aceptación real utilizó entradas temporales bloqueadas por Caddy, invocadas solo por loopback desde el contenedor.

## 1. Preparar y comprobar

Desde el checkout integrado, sustituir los IDs de ejemplo por videos ya publicados:

```sh
python3 tools/cooper/preparar_ensayo_aprendizaje.py \
  --salida .cache/ensayo-aprendizaje \
  --video-id ID_EXISTENTE_1 --video-id ID_EXISTENTE_2
```

Produce `CoopEnsayoTok01.json`, `CoopEnsayoApr01.json` y un manifest con hashes. No lee `.env`, no se conecta a ninguna API y solo usa referencias públicas del generador. Aplicar el mapa de IDs de tablas/credenciales del lote integrado antes de importar. Nunca sustituir referencias por valores de tokens. Las columnas de observabilidad de integración 3 deben existir.

En n8n 2.47, los subflujos deben tener una versión publicada. Publicar temporalmente `CoopEnsayoTok01` mediante la CLI oficial: contiene únicamente un trigger interno, sin webhook, calendario ni nodo de publicación. La captura y el guardado de lecciones se publican solo durante su ensayo interno y se despublican al terminar. No activar producción para satisfacer esta dependencia.

Usar el respaldo y rollback ya comprobados del despliegue. Además, registrar los valores previos de `retencion_media`, `metricas_youtube`, `metricas_consultadas_en` de los videos elegidos; `metricas_historial` y `metricas_consultadas_en` de sus publicaciones; y los IDs de trabajos existentes. Esos registros no contienen tokens. Asegurar que los tres IDs de ensayo no estén ocupados; no sobrescribir un flujo ajeno. Importar los dos JSON como inactivos en el mismo proyecto/propietario. Revisar que ningún nodo apunte a un flujo distinto de `CoopEnsayoTok01`.

## Limitación comprobada de la CLI y entrada interna

En el VPS con n8n 2.47.4, `n8n execute` inicia el runner pero no inicializa el módulo DataTable. La sonda mínima de código sin HTTP llegó a su nodo de guardado y falló por ese módulo deshabilitado; no es evidencia de una credencial rechazada. El wrapper CLI queda para diagnóstico del runtime y no acredita captura real.

Para sondas que necesitan tablas, usar `tools/cooper/preparar_webhook_ensayo.py --entrada SONDA.json --salida SONDA-INTERNA.json`. Solo acepta los IDs de ensayo autorizados, sustituye un trigger manual por un POST temporal bajo `/webhook/cooper/v1/ensayo-UUID` y deshabilita registros. Antes de publicarlo, comprobar que Caddy bloquea **ese prefijo** antes de cualquier `handle` general de webhooks. La respuesta pública 404 de una ruta todavía inexistente no prueba el bloqueo: verificar también la configuración efectiva y repetir la petición pública después de publicar sin que aparezca ejecución. Llamar únicamente a `http://127.0.0.1:5678` desde el contenedor n8n. La respuesta inmediata no contiene resultados; esperar metadata de ejecución y comprobar la tabla. Despublicar el temporal y verificar que la ruta interna deja de responder al terminar.

## 2. Capturar sin salir del circuito de lectura

Preparar la variante interna y, tras comprobar el bloqueo efectivo de Caddy y el respaldo, importarla y publicarla temporalmente. Copiar `invocar_webhook_ensayo.py` y `preparar_webhook_ensayo.py` al mismo directorio del host. Invocar:

```sh
sudo -n python3 /ruta/invocar_webhook_ensayo.py /ruta/CoopEnsayoApr01-interno.json
```

El helper exige POST temporal, comprueba 404 público **sin ejecución nueva**, llama a loopback y espera una única ejecución terminada correctamente. Devuelve solo códigos HTTP, ID y estado; no consulta cuerpos de respuesta ni `runData`. Una ejecución fallida o pendiente termina con código 1, aunque el webhook haya respondido 200. La captura debe verificarse también en las tablas.

Los workflows usan `saveDataSuccessExecution=none`, `saveDataErrorExecution=none`, `saveManualExecutions=false` y `saveExecutionProgress=false`, sin error workflow. No volcar la salida cruda de la CLI. El wrapper `ejecutar_cli_aislada.py` conserva utilidad diagnóstica para Code y runners externos, pero no resuelve la limitación de DataTable de `n8n execute` 2.47.4. No cambiar ni detener el runner del servicio por este ensayo.

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

Convertir el `CoopEnsayoLec01.json` generado a variante interna con `preparar_webhook_ensayo.py`; importar y publicar temporalmente. Ejecutar:

```sh
sudo -n python3 /ruta/invocar_webhook_ensayo.py /ruta/CoopEnsayoLec01-interno.json
```

Este flujo no tiene HTTP ni llamadas a otros flujos. Solo lee el trabajo exacto, exige que siga bloqueado y pertenezca al canal de la evidencia, valida cada lección y actualiza ese trabajo a `listo`. Rechaza una repetición ya aplicada. Comprobar en Aprendizaje origen, métrica, causa y corrección; comprobar con un encargo de guion controlado que sus IDs entren a la lectura obligatoria. No es necesario producir ni publicar el video para comprobar la lectura del contrato.

## 4. Reversa y cierre

Para probar rollback, restaurar solo las columnas observacionales de las filas elegidas a su snapshot y retirar solo los trabajos `aprender-ensayo-*` y `aprender-diag-*` creados por este ensayo; comparar los valores y conteos con el snapshot. Después, reaplicar el estado observado y comprobar igualdad exacta evita repetir lecturas externas. Despublicar cada temporal mediante `n8n unpublish:workflow --id=ID` con salida cruda descartada; confirmar `active=false` y 404 en su ruta tanto pública como interna. Despublicar también el getter cuando terminen las sondas que lo necesiten. Se pueden conservar los registros inactivos para auditoría. Conservar el manifest y un resumen de resultados sin tokens. No declarar rollback probado hasta comparar el estado restaurado.

Un resultado observado no reconstruye las métricas de 24h/72h que nunca se midieron: conserva la fecha y demora reales. Una hipótesis guardada y su lectura por el siguiente guion cierran el circuito técnico; demostrar mejora requiere métricas futuras de un video aprobado por una persona.

## Resultado real del 21-11-2026

El [informe del frente](informes/total-aprendizaje.md) y su evidencia registran captura 796, lección 797, lectura obligatoria por el siguiente guion y consulta Google 799, además de reversa/reaplicación exactas. Se mantuvieron cinco videos, cuatro publicaciones y 26 filas de costos. Se retiraron las entradas temporales; el getter quedó cedido al frente competencia hasta completar sus lecturas. M7 no se activó en este ensayo.
