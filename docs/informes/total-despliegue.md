# cooper-total — operación instalada y ensayos de despliegue

Actualizado: 21-11-2026, 10:48 (Lima). Frente `total-despliegue`, continuación de `total-operacion`. La aplicación final todavía no se ha desplegado por este frente; el orquestador conserva el turno de escritura en el VPS.

## Commits

- `c8751ad`: ensayo de migración Cooper sobre copia SQLite, sin red, con reversa a la imagen anterior.
- `6aa98ff`: rechazo controlado de sobres del monitor fuera del esquema.
- `fd654c4`: ensayo n8n real de columnas/importación inactiva y recuperación exacta.
- `658385f`: réplica ejecutable desde systemd de usuario; aislamiento SSH y corrección de metadatos UID al restaurar.
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

## Puerta y evidencia

La puerta completa de operación ya pasó: npm ci/lint/typecheck/build, 284 unitarias, 43 E2E con Sentinel y 147 pruebas de flujos, cero errores/advertencias. Véase [evidencia de operación](evidencias/total-operacion/). Los cambios posteriores de este frente solo afectan despliegue: 42 pruebas Python con `-W error` y `git diff --check` pasan. El orquestador está ejecutando la puerta integrada de la aplicación final; no se sustituye esa puerta con estos ensayos.

[Evidencia segura del frente](evidencias/total-despliegue/): logs de compilación preliminar, migración, Compose, lote n8n, regresiones y estado real de unidades/monitor/recibos. No incluye bases, exports privados, credenciales ni entornos.

## Límites reales y Pendientes de Walter

1. Custodiar fuera de PC y VPS la configuración privada, contraseña restic y material de recuperación. La réplica cifrada no contiene `/etc/cooper/.env`, claves del host ni sesiones CLI.
2. La PC debe estar encendida para replicar. La copia diaria del VPS determina el RPO; replicar cada hora no genera snapshots nuevos.
3. Telegram depende del n8n del VPS. Durante una caída total no puede avisar; conserva el estado y reintenta/informa recuperación. Un aviso durante esa caída necesita un canal independiente.
4. Google real, decisiones de Meta, pagos y publicaciones siguen bajo control humano. Este frente no hizo OAuth, pagos ni publicaciones sociales.

## Trabajo todavía en curso del orquestador

Imagen final del SHA integrado `169d0cdf1e3e47bc27c7d8e1790a0764515d2431`, ensayo de sus migraciones/reversa, lote n8n definitivo, prueba coordinada de stack, despliegue, puerta integrada y dos rondas Sentinel/Playwright con videos. No se declaran terminados en este informe.

Fuente oficial cotejada para export/import/publish/unpublish: [Server CLI de n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md). Referencias de restic/systemd/Telegram en [operación](../cooper-operacion.md).
