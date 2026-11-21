# cooper-total — operación instalada y ensayos de despliegue

Actualizado: 21-11-2026, 11:02 (Lima). Frente `total-despliegue`, continuación de `total-operacion`. La aplicación final todavía no se ha desplegado por este frente; el orquestador conserva el turno de escritura en el VPS.

## Commits

- `c8751ad`: ensayo de migración Cooper sobre copia SQLite, sin red, con reversa a la imagen anterior.
- `6aa98ff`: rechazo controlado de sobres del monitor fuera del esquema.
- `fd654c4`: ensayo n8n real de columnas/importación inactiva y recuperación exacta.
- `658385f`: réplica ejecutable desde systemd de usuario; aislamiento SSH y corrección de metadatos UID al restaurar.
- `723fa91`: Vigilante envía categorías cerradas, omite error crudo y construye enlaces con origen fijo e ID validado; secreto ficticio y URL de proveedor no se propagan.
- Base operativa: `2aaeb9a`, `033da1f`, `24ca1bb`; puerta y auditoría en [total-operacion](total-operacion.md).

## Cerrado y probado en infraestructura real

**Copia fuera del VPS sin coste.** El repositorio restic cifrado se replica a `~/.local/share/cooper-copias-vps/actual`. `cooper-replica-pc.timer` está habilitado y activo; su servicio terminó con `Result=success`, `ExecMainStatus=0` a las 10:44:56. Verificó todo el repositorio, restauró 25 archivos y dos bases y registró el recibo en el VPS. `Linger=yes` ya estaba configurado. La contraseña se consume por su ruta preexistente; no se leyó ni transportó su valor.

La primera ejecución por systemd falló al restaurar metadatos: `PrivateTmp` en el gestor de usuario producía un mapa UID limitado y `lchown: invalid argument` para los UID del VPS. Se retiró esa opción, manteniendo `NoNewPrivileges` y temporales privados 0700. La ejecución completa posterior pasó. Todos los fallos conservaron la generación anterior verificada.

**Monitor y Telegram.** Instalados `/opt/cooper/deploy/{monitor.py,monitor-validar.js,generar-monitor.py,registrar-replica.py,operar.py}`. El timer del VPS está habilitado y activo. El workflow `CooperMonitor01` reutiliza la referencia de credencial y destinatario del nodo `Avisar error`, en `F · Vigilante de errores`; no se extrajo el token.

Secuencia real probada: importación inactiva → publicación → sonda firmada aceptada → despublicación con HTTP 404 → republicación → firma inválida rechazada con HTTP 401 → sonda válida aceptada → aviso operativo aceptado por Telegram. El resultado final indica `salud=PASS`, `problemas=[]`, `entrega=true`. Los 34 workflows anteriores conservaron IDs, estado activo y versiones. Export previo y metadatos: `/var/lib/cooper-operacion/total-monitor/`; resultado seguro: `resultado.json`.

**Arranque.** `cooper-stack.service` está instalado y habilitado. Incorpora el overlay del chat y respeta mantenimiento. La comparación previa mostró que arrancarlo recrearía los tres relés, por lo que se cedió al orquestador esa prueba coordinada. No se ha probado un reinicio físico del VPS en este frente. No se reinició la PC, el túnel ni servicios ajenos.

## Respaldo y ensayos comprobados

Copia fría real del VPS, restaurada y verificada, snapshot:

`04cd7f6f06672e24e34d7c8baa64139a2870e61cf2504d6217f1f533a6d1112c`

Repositorio: `/var/backups/cooper-restic`. Recibo: `/var/lib/cooper-operacion/ultima-copia.json`. Manifiesto dentro del snapshot: `/datos/manifiesto.json`. Contiene 25 archivos y dos bases; Cooper tenía ocho migraciones, n8n 34 workflows. Esta copia precede a la instalación del monitor; el orquestador hará otro corte antes del lote final.

La imagen preliminar `localhost/cooper:9c6ff870794b8a6f31585e399fcf90ff966412e8` migró una copia real de Cooper de ocho a once entradas, conservó 21 tablas anteriores y pasó integridad/claves foráneas. La reversa a `05d833787525fa98b183b3934ef13bd5dff1ca76` recuperó el respaldo y arrancó correctamente. Todo ocurrió con `--network none`, sin puertos y con autenticación ficticia. No demuestra todavía la migración de la imagen final integrada.

El ensayo Compose preliminar pasó siete bloques: HTTPS/cabeceras/editor privado; sesión Auth.js ficticia; runner 2.47.4, firma real y SSE; cinco reconexiones; restic y restauración; importación en volúmenes vacíos; actualización y reversa conjunta de imagen/datos. No se inició OAuth real.

El lote n8n **preliminar** real pasó sobre una copia aislada: cinco columnas nuevas e idempotentes, 32 workflows importados inactivos, 34→36 workflows totales. Las nueve tablas de negocio conservaron las 118 filas y sus hashes; workflows ajenos intactos. La reversa recuperó las 187 tablas, conteos e IDs/active/version. SHA256 SQLite antes y después de restaurar: `6a2b6724f53939715478a2fa76a95145378b4632c23f8b6122b6e874a8017450`. Entrada: `b9e7723a92c829a5ac12384d32de88371f9f78348128ba3a7c2b541387b4bc6d`. El lote final cambia M7 y requiere otro ensayo.

## Imagen final y aceptación aislada

**Probada** la imagen del código integrado exacto `169d0cdf1e3e47bc27c7d8e1790a0764515d2431`, construida desde su árbol Git. Identificador de imagen: `sha256:bdc46f46c3863f0ad0377bb06f1c66abb090eaca343ff321540afab725565121`. Archivo de transporte local: `cooper/.cache/despliegue/cooper-169d0cdf1e3e47bc27c7d8e1790a0764515d2431.tar.gz`; SHA256 `129c8a551bda81ae8b3f84ebf0f272611de9059f8c9b8117f3ef338dd31ca73e`, 110.161.991 bytes. Todavía no desplegada por este frente.

La migración final sobre la copia real pasó de ocho a once migraciones, conservó las 21 tablas anteriores y pasó integridad/claves foráneas. La reversa restauró el respaldo `1e6ae884276b70a481a1a55cd2cfb1689209ed90c41e53700a205d3da14df817` y arrancó la imagen anterior. Sin red ni puertos.

**Compose final: siete bloques PASS.** HTTPS y TLS verificado, cabeceras/editor privado; login ficticio con cookie segura; runner externo 2.47.4 y firma n8n→Cooper; SSE y cinco reconexiones; restic cifrado/restauración; export e import en volumen vacío; actualización/reversa conjunta conservando estado. El ensayo usó un worktree separado del SHA exacto y los servicios quedaron retirados. Dos intentos previos detectaron condiciones del arnés, no del producto: ruta de socket Unix demasiado larga y archivo exportado sin metadatos Git; se corrigió el contexto y se repitió completo con salida cero. No se inició OAuth.

El **lote final ensayado inicialmente** (`581fedd8c786dbca4eae41fbe7bc19655ce52be372fde35dc379aac2ef513c85`) pasó importación y reversa: cinco columnas idempotentes, 32 workflows inactivos, nueve tablas/118 filas preservadas, 187 tablas restauradas, mismo SHA256 SQLite y mismos IDs/active/version. Este ensayo cubrió importación, no publicación: el orquestador encontró posteriormente una validación al republicar el cuarto flujo y restauró producción. La publicación secuencial de los 22 originales también se ensayó en un clon, un CLI por ID, sin red: 13 publicados y nueve rechazados. Siete rechazos corresponden a referencias a subflujos aún sin publicar; dos a credenciales ausentes (`8nqh0n7jewLQOikC` y `FabSonido0000001`). La salida privada se clasificó en memoria usando las plantillas del código fuente n8n 2.47.4; únicamente se conservaron ID/código/categoría/estado. No se leyó ni descifró el contenido de credenciales. No hay ciclos estáticos entre los 22, pero el orden original no respeta sus dependencias. Tres dependencias pertenecen a los pausados: `FabYouTube000001`, `FabRadar00000001` y `FabConfirmar0001`. El orquestador revisará sus guardias y la preparación de referencias antes de otro intento. El hotfix del Vigilante requiere otra entrada ensayada antes de aplicar.

Para desplegar la imagen, el orquestador debe conservar los scripts `deploy/` de la última integración: incluyen correcciones operativas posteriores al SHA de la imagen. No reemplazarlos por el archivo de fuentes usado en la compilación.

## Puerta y evidencia

La puerta completa de operación ya pasó: npm ci/lint/typecheck/build, 284 unitarias, 43 E2E con Sentinel y 147 pruebas de flujos, cero errores/advertencias. Véase [evidencia de operación](evidencias/total-operacion/). Los cambios posteriores de este frente solo afectan despliegue: 42 pruebas Python con `-W error` y `git diff --check` pasan. El hotfix del Vigilante añade una regresión: 148/148 pruebas de flujos pasan, incluida la no divulgación de una credencial ficticia en errores conocidos, desconocidos, del disparador y en URL recibidas. El orquestador está ejecutando la puerta integrada de la aplicación final; no se sustituye esa puerta con estos ensayos.

[Evidencia segura del frente](evidencias/total-despliegue/): logs de compilación preliminar/final, migración, Compose, lote n8n, regresiones y estado real de unidades/monitor/recibos. No incluye bases, exports privados, credenciales ni entornos.

## Límites reales y Pendientes de Walter

1. Custodiar fuera de PC y VPS la configuración privada, contraseña restic y material de recuperación. La réplica cifrada no contiene `/etc/cooper/.env`, claves del host ni sesiones CLI.
2. La PC debe estar encendida para replicar. La copia diaria del VPS determina el RPO; replicar cada hora no genera snapshots nuevos.
3. Telegram depende del n8n del VPS. Durante una caída total no puede avisar; conserva el estado y reintenta/informa recuperación. Un aviso durante esa caída necesita un canal independiente.
4. Google real, decisiones de Meta, pagos y publicaciones siguen bajo control humano. Este frente no hizo OAuth, pagos ni publicaciones sociales.

## Trabajo todavía en curso del orquestador

Publicación del lote n8n definitivo tras resolver la validación y ensayar el Vigilante seguro, prueba coordinada de stack, despliegue, puerta integrada y dos rondas Sentinel/Playwright con videos. La imagen final, su migración/reversa y los siete bloques Compose ya pasaron; estos otros pasos no se declaran terminados en este informe.

Fuente oficial cotejada para export/import/publish/unpublish: [Server CLI de n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md). Referencias de restic/systemd/Telegram en [operación](../cooper-operacion.md).

El campo `execution.id` y la ausencia de ID en fallos de disparador se cotejaron en [manejo oficial de errores n8n](https://docs.n8n.io/build/flow-logic/handle-errors-gracefully.md). El nodo seguro ignora siempre `execution.url`.
