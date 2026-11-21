# Lote de auditoría n8n para el orquestador

Misión `total-n8n-auditoria`, 21-11-2026 (Lima). Preparación local; no autoriza importar, publicar, reanudar ejecuciones ni gastar. El informe de la misión documenta los hallazgos del VPS por separado.

**Este lote no debe instalarse completo sobre el n8n vivo.** La auditoría encontró 45 workflows frente a los 32 de la base: cuatro legados y nueve añadidos, además de siete IDs que requieren remapeo (Avatar, API, Costo, Progreso, Noticia, Presentación y TextoGPT). Hay cambios concurrentes que este lote no contiene. El orquestador debe aplicar únicamente el diff revisado sobre un respaldo actualizado del destino, conservar los workflows adicionales y reconciliar los cambios propios de Radar, Competencia y Ajustes antes de preparar cualquier importación.

## Contenido y verificación

Después de guardar en commits el generador, los 32 JSON y esta guía:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 tools/cooper/preparar_lote_auditoria.py
cd cooper/.cache/lote-total-n8n-auditoria
sha256sum --check SHA256SUMS
```

El programa sigue el formato de `preparar_lote_cobertura.py`, pero este lote solo lleva workflows. Lee `HEAD` y la base `de397f3` por Git, exige 32 exportaciones actuales y rechaza cambios pendientes dentro de `workflows/v2/`, incluidos archivos nuevos. No lee archivos de entorno, credenciales, datos de ejecución ni la red. Rechaza una carpeta de salida existente; `--salida` permite crear otra. `--base` permite seleccionar expresamente otra referencia ancestral, que queda registrada con su SHA completo.

- `entrada/workflows/v2/`: 32 workflows de HEAD, todos con `active=false`.
- `reversa-versionada/workflows/v2/`: workflows de la base, también inactivos. **Es referencia de código; no es un respaldo real del VPS.**
- `diff-semantico.patch` y `cambios.json`: comparación de fuentes versionadas, sin IDs regenerables de nodos/condiciones. Conserva parámetros, conexiones, IDs de workflows, referencias, estado activo y configuración; un cambio en ellos sigue siendo visible. No compara contra la instalación real.
- `altas.txt` y `bajas.txt`: diferencias de archivos entre commits, incluso si no hay ninguna. Una baja no ordena borrar un workflow del destino.
- `mapa-ids.json`: IDs de ambas referencias y rutas; destino, pila y revisión quedan pendientes. No presupone que el mismo ID represente el mismo flujo en el VPS.
- `manifest.json`: commits, cantidades, SHA-256 del contenido empaquetado y del JSON fuente. `SHA256SUMS` cubre los artefactos y el propio manifiesto. Los hashes acreditan integridad frente al manifiesto conservado; no son una firma de autoría.

La transformación de seguridad fuerza `active=false`, vacía `activeVersionId` si existe y retira `activeVersion`. No modifica los archivos de Git. Ni el archivo inactivo ni el resultado de importación prueban que un cron anterior haya dejado de ejecutarse.

## Destino observado y controles antes de importar

La inspección del VPS confirmó siete contenedores del mismo proyecto Compose `cooper`. Solo `cooper-n8n-1` ejecuta la imagen n8n 2.47.4 y usa `/var/lib/cooper/n8n`. Los contenedores `cooper-chat-*` asociados a n8n, runner y Cooper usan la imagen de la aplicación, ejecutan `tunel.mjs`, montan `/run/cooper-chat` y comparten la red de su destino mediante `network_mode: container:<destino>`. Son relés; no constituyen una segunda base n8n ni otro planificador de cron. No cerrar ni desactivar esos relés por la hipótesis inicial de dos pilas.

El orquestador debe completar estos controles en la ventana y destino autorizados; esta misión no los ejecuta:

1. Revalidar el inventario por posibles cambios concurrentes: proyecto Compose, imagen, comando, red y montajes de cada contenedor; para el n8n efectivo, versión, base/volumen, hostname, IDs, borrador/publicado, webhook y horarios. Usar campos permitidos, nunca un `docker inspect` completo que pueda mostrar valores de entorno. No tocar D&S Factory. Comprobar que Cooper y sus callbacks siguen apuntando al destino documentado. Solo si aparece otra instancia n8n real, analizar sus productores y datos antes de decidir su tratamiento.
2. En la ventana autorizada, cerrar las entradas productoras del n8n efectivo mientras se concilian trabajos; mantener la infraestructura de relés. Documentar qué queda pausado y comprobar los cron, webhooks y reanudaciones pendientes del destino. No borrar workflows, datos o esperas para resolver un posible duplicado.
3. Conservar respaldo protegido del destino seleccionado: borrador y versión publicada de cada workflow, estado publicado, mapa de IDs, configuración efectiva de Ajustes, referencias de tablas/subflujos/credenciales, Data Tables, ejecuciones en espera, recibos de idempotencia, binarios y base consistente de Cooper del mismo corte. Usar el mecanismo de copias existente y verificar recuperación aislada. Un export de workflows no contiene todo ese respaldo. No exportar credenciales descifradas, leer sus valores ni meter material real en este lote/Git; el custodio mantiene los respaldos cifrados fuera del informe y del directorio público.
4. Revisar diferencias contra ese respaldo, además del diff de Git. Completar una copia de `mapa-ids.json` con el destino y los siete remapeos de IDs confirmados en el inventario; revalidar su identidad, sin deducir equivalencia solo por el nombre. Mantener el mapa original y registrar SHA-256 del adaptado. Preservar los cuatro workflows legados y nueve añadidos, y los cambios concurrentes de **Radar, Competencia y Ajustes**. Conservar Ajustes efectivos, referencias y permisos; no reemplazarlos por valores de instalación ni encender interruptores de gasto. Actualizar conjuntamente `executeWorkflow`, Error Workflow y referencias internas cuando el destino tenga otros IDs.

La CLI documenta exportar borradores con `export:workflow`, y versiones publicadas añadiendo `--published`; admite exportar una versión concreta con `--version`. Validar los flags con la versión instalada y escribir a un archivo protegido, nunca al terminal. La importación puede sobrescribir IDs existentes y desactiva los flujos por defecto. Hay un fallo documentado: en ciertas instancias los cron previos siguen vivos hasta reiniciar n8n. El orquestador debe comprobar su cese y realizar el reinicio autorizado cuando corresponda. [CLI oficial de n8n](https://docs.n8n.io/hosting/cli-commands/).

## Revisión e instalación reservadas al orquestador

1. Probar el lote en n8n aislado, con tablas ficticias, proveedores simulados, sin llaves reales y sin salida a servicios pagos. Verificar la versión instalada y compatibilidad de nodos. Esta preparación no incluye ni sustituye ese ensayo de importación.
2. Construir un lote adaptado **desde el respaldo real actualizado**, aplicando solo los cambios del diff que superen revisión y preservando referencias y cambios concurrentes. No importar en bloque `entrada/workflows/v2/` sobre el vivo: esos JSON son fuentes de revisión, no sustitutos completos de sus 45 workflows. Ensayar la propuesta con los siete remapeos y comprobar que los trece workflows adicionales y las ampliaciones de Radar, Competencia y Ajustes se conservan. Tampoco importar los borradores históricos de `workflows/` como otra fábrica. Registrar IDs y versiones resultantes, conservando inactividad durante la revisión. Ningún script de este lote importa o activa automáticamente.
3. Revisar Error Workflow y su persistencia con errores sintéticos en el entorno aislado, incluido fallo de activación. n8n permite compartir un manejador iniciado por Error Trigger; los fallos del disparador tienen un payload distinto y pueden carecer de ID/URL de ejecución. El manejador no debe asumir esos campos ni repetir el efecto que falló. [Errores de n8n](https://docs.n8n.io/flow-logic/error-handling/).
4. Revisar horarios en `America/Lima`, duración máxima y posibles solapamientos; un timeout largo puede abarcar varias pulsaciones. Confirmar política de ejecuciones perdidas y no liberar de golpe trabajos vencidos. Schedule Trigger requiere publicación y usa la zona del workflow o de la instancia. Las expresiones dependientes de variables se evalúan al publicar; cambiar Ajustes no garantiza reprogramar el cron. [Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/).
5. Comprobar de forma aislada timeout, 429, 5xx, desconexión después de enviar, respuesta duplicada y reinicio. Un timeout no demuestra que el proveedor rechazó el trabajo: consultar primero su estado/recibo. Sin clave idempotente admitida por el proveedor y registro durable no se garantiza exactamente una ejecución ante concurrencia o tras reinicio. Mantener pendientes de conciliación las operaciones inciertas; no reintentar cargas, publicaciones o cobros para comprobar si funcionan.
6. Publicar únicamente los workflows y entradas autorizados, en orden de dependencias. Comprobar el manejador de errores, auxiliares, puente y Orquestador antes de los disparadores. La autorización de este lote no existe aún: el informe deja la decisión en Pendientes de Walter. Reactivar cada entrada solo tras contrastar su estado y las ejecuciones pendientes en el destino actualizado; los productores pagos requieren su autorización específica.

## Reversa y conciliación

Detener nuevas entradas en la pila productora y conservar el listado de ejecuciones y efectos desde el corte. Restituir los borradores, versiones publicadas y datos **del respaldo real del destino**, respetando Ajustes y el mapa de referencias. Una reversa de código no cancela una publicación o cargo aceptado, ni prueba que una ejecución en espera sea segura de reanudar.

Usar `reversa-versionada/` solamente para revisar el cambio y preparar una recuperación compatible si el respaldo lo permite. Las altas introducidas por el lote adaptado se desactivan y concilian; los trece workflows adicionales ya existentes no son altas de esta misión. No borrar por ID sin comprobar su identidad. Las bajas se recuperan desde el respaldo real si procede. No restaurar una base antigua sobre recibos o datos nuevos sin conservarlos y reconciliarlos primero. Comprobar resultados, referencias e inventario actualizado antes de reabrir entradas, preservando los relés de chat. Documentar quién autorizó la reapertura, qué workflows y cuáles permanecen pausados.
