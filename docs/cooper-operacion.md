# Operación de Cooper: copias externas, salud y recuperación

Actualizado el 21-11-2026 (Lima). El orquestador de `cooper-total` integra el código y modifica los flujos n8n. Operación puede instalar sus scripts y probar el reinicio del VPS fuera del lote, según la autorización expresa de esta misión.

## Copia externa gratuita en la PC

`deploy/replicar-pc.py` obtiene **el repositorio restic cifrado** mediante SSH estricto y rsync. El proceso remoto mantiene el mismo candado `operacion.lock` que las copias, migraciones y actualizaciones. No transporta `.env` ni la contraseña restic: utiliza la contraseña ya custodiada en la PC mediante su ruta; el script no lee su contenido.

Cada ejecución crea una generación candidata, verifica todo el repositorio con `restic check --read-data`, restaura el snapshot más reciente de Cooper a un temporal privado y reutiliza `operar.verify`: hashes, tamaños, conteos e integridad SQLite. Solo entonces promueve atómicamente el enlace `actual`. Conserva dos generaciones verificadas. Un corte de red, clave incorrecta o datos corruptos conserva la generación anterior. Los temporales restaurados se eliminan al terminar. El repositorio del corte anterior en `~/.cache/cooper-vps/restic` permanece intacto.

Destino predeterminado: `~/.local/share/cooper-copias-vps/actual`. Contraseña preexistente: `~/.config/cooper/restic-password` (0600). Binario preexistente: `~/.cache/cooper-vps/bin/restic`. Se puede cambiar cada ruta con argumentos; no se instala software global ni se contrata almacenamiento.

Instalación en la PC, desde el checkout aprobado:

```bash
install -d -m 0700 ~/.local/lib/cooper/operacion ~/.config/systemd/user
install -m 0755 deploy/replicar-pc.py deploy/operar.py ~/.local/lib/cooper/operacion/
install -m 0644 deploy/systemd/cooper-replica-pc.service deploy/systemd/cooper-replica-pc.timer ~/.config/systemd/user/
systemctl --user daemon-reload
# Primero sin recibo remoto si registrar-replica.py aún no está instalado:
python3 ~/.local/lib/cooper/operacion/replicar-pc.py
# Después del despliegue del receptor del VPS:
systemctl --user enable --now cooper-replica-pc.timer
systemctl --user start cooper-replica-pc.service
```

El timer corre cada hora, es persistente y recupera una ejecución pendiente al volver la sesión. El recibo `ultima-replica.json` registra solo snapshot, fecha e integridad, nunca filas ni claves. `--confirmar-vps` lo envía por SSH a `deploy/registrar-replica.py`; ese receptor admite solo campos conocidos, snapshot hexadecimal y fecha de los últimos cinco minutos. El usuario SSH ya tiene el acceso operativo aprobado; no se amplían sus permisos.

La PC debe estar encendida y su gestor de usuario activo. En esta instalación se comprobó `Linger=yes`, por lo que el gestor puede arrancar sin una sesión interactiva. No es un almacén remoto independiente de esa PC ni custodia offline. La copia diaria del VPS determina el RPO efectivo; la réplica horaria no inventa snapshots más recientes. Si la PC se apaga más de 36 horas, el monitor avisa al recuperar transporte. Una pérdida simultánea de ambos equipos requiere la custodia externa de Walter.

## Monitor y Telegram

`deploy/monitor.py` revisa cada cinco minutos los cuatro servicios (estado, healthcheck y política de reinicio), HTTPS con validación de certificado, espacio libre (mínimo 2 GiB y 10%), última copia local verificada (máximo 30 horas) y recibo de réplica externa (36 horas). Comprueba los certificados públicos de `COOPER_DOMAIN` y `N8N_DOMAIN` en 443 con CA, hostname y SNI; alerta al quedar **14 días o menos**, ante rechazo TLS o fecha ausente. Usa el código existente `servicio_caddy` («HTTPS no está saludable»), compatible con el receptor ya publicado. No necesita cambiar flujos. Durante una operación con candado o marcador de mantenimiento no alerta por la parada deliberada.

Los mensajes contienen códigos cerrados traducidos al español. Repite una incidencia persistente como máximo cada seis horas, informa cambios y recuperación. Un fallo de entrega conserva el aviso pendiente y vuelve a intentarlo; si n8n se recupera antes del siguiente sondeo, se informa la recuperación aun cuando el aviso inicial no pudo salir. También reintenta la recuperación si falla varias veces su entrega. El monitor nunca muestra salida Docker, errores del proveedor ni valores de entorno.

El envío usa el webhook **interno** `POST /webhook/cooper/v1/monitor`, bloqueado en el listener público por la regla ya existente de Caddy. El sobre lleva JSON canónico, HMAC-SHA256 con prefijo de dominio y `COOPER_WEBHOOK_SECRET` consumido por el adaptador de configuración existente en tiempo de ejecución. El flujo exige firma constante, timestamp ±5 minutos, esquema cerrado y deduplicación. Un mensaje inválido responde 401 y no llega a Telegram. El destinatario y la credencial se fijan en el workflow, nunca se aceptan desde el cuerpo.

Generar el flujo inactivo reutilizando **referencias**, sin exportar la credencial:

```bash
python3 deploy/generar-monitor.py --credencial-id ID_EXISTENTE --credencial-nombre 'Telegram account' --chat-id DESTINATARIO_EXISTENTE --salida RUTA_PRIVADA/monitor.json
```

El orquestador respalda n8n, registra el ID real, aplica y publica únicamente ese workflow y prueba su reversa desactivándolo/restaurando el respaldo. No hace falta iniciar OAuth ni crear un bot. Los datos de ejecución no se guardan en este flujo. Después instala las unidades y comprueba firma sin enviar:

```bash
install -m 0644 /opt/cooper/deploy/systemd/cooper-monitor.service /opt/cooper/deploy/systemd/cooper-monitor.timer /opt/cooper/deploy/systemd/cooper-stack.service /etc/systemd/system/
systemctl daemon-reload
python3 /opt/cooper/deploy/monitor.py --prueba
systemctl enable cooper-stack.service
systemctl enable --now cooper-monitor.timer
# Envío operativo explícito autorizado por la misión, para comprobar Telegram:
python3 /opt/cooper/deploy/monitor.py --avisar
```

`--prueba` comprueba autenticación y transporte sin enviar Telegram ni marcar incidencias como notificadas. Si hay problemas de salud devuelve rc 1 aunque el transporte haya pasado. Consultar `entrega` y `problemas` por separado. La alerta usa n8n: mientras n8n o todo el VPS estén caídos no puede salir; se conserva y reintenta. Un aviso instantáneo durante la caída total necesita un canal independiente, pendiente de Walter, sin crear cuentas ni extraer tokens.

## Arranque y mantenimiento

Docker ya está habilitado y los cuatro contenedores tienen `restart: unless-stopped`. `cooper-stack.service` agrega el arranque del Compose con espera de healthchecks después del arranque del host; incorpora el overlay del chat solo cuando existe `chat-tunel.enabled`. No publica puertos nuevos.

**Crear `/var/lib/cooper-operacion/mantenimiento` antes de una parada que deba persistir tras reinicio.** Las operaciones `actualizar` y `revertir` lo crean antes de detener escritores y solo lo retiran al finalizar con salud correcta; una actualización fallida queda cerrada aun si el VPS reinicia. El monitor también respeta ese marcador. Durante las copias se paran los relés del chat antes de los procesos cuyas redes comparten, y se reanudan únicamente los servicios que estaban activos.

Para ensayar un reinicio real: revisar primero el log `.cache/orquesta/cooper-total.log` del repositorio principal y aplazar si hay cambios n8n en curso. Obtener después `operacion.lock` exclusivo y sin espera, comprobar ausencia de mantenimiento/ejecuciones activas y unidades habilitadas. Registrar el `boot_id` y metadatos de workflows antes de `systemctl reboot`; mantener el candado hasta el cierre de SSH. Al volver, exigir un `boot_id` distinto, salud de los siete contenedores cuando el chat está habilitado, `cooper-stack.service` en `active/exited` y timers activos. Verificar HTTPS, rutas protegidas, transporte firmado y réplica restaurada. No arrancar servicios manualmente durante esta comprobación: ocultaría un fallo del arranque automático.

Si el monitor recién instalado falla, reponer únicamente su archivo anterior conservado en `/var/lib/cooper-operacion/monitor-anterior-c18106f.py`, ejecutar `--prueba` y comprobar el próximo disparo del timer. No restaurar bases ni workflows para revertir una sonda del host.

## Recuperación

La receta depende del aplicador que hizo el cambio. Preservar las escrituras posteriores al snapshot: restaurar discos no revierte publicaciones ni decisiones externas. Conciliar las esperas y los efectos externos antes de reabrir la operación; no iniciar simultáneamente n8n de PC y VPS.

**VPS conservado, actualización de Cooper con `operar.py actualizar`:** `deploy/revertir.sh` usa el `STATE_ROOT/anterior.json` que guardó esa actualización. Restaura primero en un directorio nuevo y archiva los datos desplazados. Solo procede directamente si la infraestructura sigue siendo la correspondiente a ese snapshot.

**VPS conservado, secuencia `Operator.actualizar → Marcas opaco → aplicar-infra.py` terminada PASS:** recuperar primero la infraestructura con su recibo exacto. Después, si también se quiere volver a la versión anterior de Cooper, ejecutar `deploy/revertir.sh`. Invertir el orden puede arrancar un motor nuevo con una base del motor anterior. El paso Marcas conserva su configuración opaca; estos helpers no extraen, copian ni revierten su secreto. Consumen la configuración privada únicamente mediante el adaptador operativo existente.

```bash
# SHA64 es la huella verificada del recibo PASS de ESA aplicación, no «latest».
python3 /opt/cooper/deploy/recuperar-infra.py \
  --recibo /var/lib/cooper-operacion/cierre-22ece8e/infra-resultado.json \
  --recibo-sha256 SHA64 \
  --salida /var/lib/cooper-operacion/cierre-22ece8e/recuperacion-infra.json
# Solo después de PASS y de comprobar que anterior.json corresponde al paso Cooper:
/opt/cooper/deploy/revertir.sh
```

`recuperar-infra.py` exige un recibo PASS con su SHA explícito, los mismos códigos de Operator/aplicador, archivos públicos actuales idénticos al ensayo, respaldo público íntegro e identidades locales de las imágenes actuales/anteriores. Rechaza ejecuciones `new/running`, otro mantenimiento, un destino de recibo ya existente y rutas con enlaces. Puede comprobar identidades de contenedores detenidos o no saludables; no exige un falso PASS de salud antes de recuperar.

Antes del corte restaura y verifica el snapshot indicado en un directorio nuevo. Bajo `operacion.lock` cierra escritores, obtiene otro snapshot de las escrituras desplazadas y conserva además los datos completos en `recuperacion-infra-*/datos-desplazados`. Recupera configuración y datos juntos, comprueba sus manifiestos y arranca las imágenes anteriores sin descargas/construcciones, con Caddy al final. Exige salud e identidades anteriores y conserva sin cambios `release.json`, `anterior.json` y la imagen nueva de Cooper. Solo entonces retira mantenimiento. Si falla después del corte, detiene el Compose y conserva ambos estados, el recibo `FALLO_MANTENIMIENTO` y el marcador; no reintentar borrando el marcador ni forzar una configuración mezclada. Si hay deriva de configuración, recibos incompletos o corrupción que impide conservar datos, detenerse y preparar una recuperación específica a partir de los estados conservados.

La reversa automática ante un fallo **dentro de** `aplicar-infra.py` sigue siendo una prueba distinta de esta recuperación **después de PASS**. El recibo del nuevo helper debe acompañar al ensayo de esa segunda ruta; no sustituirlo por el recibo automático.

El actualizador histórico `actualizar-solo-cooper.py` guarda `solo-cooper-*/anterior.json` y su respaldo local, **no** el puntero global de `revertir.sh`. Su reversa automática está probada; no usar la receta genérica para una recuperación posterior ni reutilizar un puntero antiguo. La secuencia final de `cooper-total` usa `Operator.actualizar`, y no ese camino histórico.

**VPS perdido:**

1. Preparar Ubuntu y una instalación revisada de `deploy/`; poner el destino en mantenimiento y detener el Compose. Recuperar el repositorio **cifrado** desde `~/.local/share/cooper-copias-vps/actual` y provisionar la contraseña y configuración privada por el canal ya autorizado. La copia no contiene `/etc/cooper/.env`; no reconstruye OAuth, claves del host ni sesiones CLI.
2. Ejecutar `restic check --read-data`, elegir ID explícito y `operar.py restaurar-prueba ID DESTINO_NUEVO`; después `operar.py importar ID` solo con servicios detenidos y volúmenes vacíos. Conservar los workflows automáticos pausados hasta conciliar esperas/efectos externos y confirmar dos controles humanos de publicación.
3. Arrancar el Compose, comprobar salud, HTTPS, rechazo anónimo, puente y datos; reinstalar timers. Retirar mantenimiento únicamente tras verificación. Una sesión Google real sigue requiriendo al usuario.

Pruebas locales: `PYTHONDONTWRITEBYTECODE=1 python3 -W error -m unittest discover -s deploy/tests -p 'test_*.py'`. Ejercitan fallos de transporte/restauración, conservación de la copia previa, HMAC real cruzado Python→JavaScript, replay, mensajes inválidos, deduplicación, recuperación, mantenimiento y coordinación de relés. El informe distingue esas pruebas de la copia real y del despliegue remoto.

## Clones SQLite para ensayos

Restaurar siempre el snapshot completo antes de trasladar las bases a un laboratorio. Un archivo `.sqlite` puede ser íntegro y, aun así, omitir filas, versiones publicadas o migraciones confirmadas que todavía están en su `-wal`. El manifiesto de restic/Operator incluye ambos; copiar únicamente `.sqlite` invalida la identidad del corte.

```bash
python3 deploy/preparar-clon-restaurado.py --restauracion RESTAURADA/datos --salida CLON_NUEVO
```

El helper exige el manifiesto completo antes de crear el destino; usa SQLite backup para incorporar WAL y cambia únicamente el clon a journal DELETE. Verifica integridad, claves foráneas, todas las tablas/conteos y que la restauración original permanezca intacta. Produce `CLON_NUEVO/datos/{cooper/cooper.sqlite,n8n/database.sqlite}` autónomas, un nuevo manifiesto y un recibo con hashes. No consulta ni muestra filas. El ensayo posterior recibe esos archivos mediante `--base`; nunca debe recibir una base viva ni un traslado manual incompleto.

Regresión: con dos transacciones confirmadas y la última en WAL, el clon conserva filas, versión publicada y migraciones incluso al trasladar solo su `.sqlite`. Un WAL omitido del disco o del manifiesto se rechaza antes de crear el destino. Contratos oficiales consultados el 21-11-2026: [SQLite backup API](https://www.sqlite.org/backup.html) y [WAL](https://www.sqlite.org/wal.html).

Fuentes oficiales consultadas el 21-11-2026: [repositorios restic](https://restic.readthedocs.io/en/stable/045_working_with_repos.html), [restauración restic](https://restic.readthedocs.io/en/stable/050_restore.html), [timers systemd](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html), [TLS y certificados en Python](https://docs.python.org/3/library/ssl.html), [webhook n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/), [Code n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/) y [Telegram sendMessage](https://core.telegram.org/bots/api#sendmessage).

Para la recuperación posterior a PASS se contrastaron también los contratos actuales de [Compose ps](https://docs.docker.com/reference/cli/docker/compose/ps/) (`--all` para identidades detenidas) y [Compose up](https://docs.docker.com/reference/cli/docker/compose/up/) (`--pull never`, recreación y espera de salud).
