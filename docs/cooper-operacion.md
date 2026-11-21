# Operación de Cooper: copias externas, salud y recuperación

Actualizado el 21-11-2026 (Lima). La instalación la coordina el orquestador de `cooper-total`; el frente Operación no cambia servicios del VPS por su cuenta.

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

La PC debe estar encendida y su gestor de usuario activo. No es un almacén remoto independiente de esa PC ni custodia offline. La copia diaria del VPS determina el RPO efectivo; la réplica horaria no inventa snapshots más recientes. Si la PC se apaga más de 36 horas, el monitor avisa al recuperar transporte. Una pérdida simultánea de ambos equipos requiere la custodia externa de Walter.

## Monitor y Telegram

`deploy/monitor.py` revisa cada cinco minutos los cuatro servicios (estado, healthcheck y política de reinicio), HTTPS con validación de certificado, espacio libre (mínimo 2 GiB y 10%), última copia local verificada (máximo 30 horas) y recibo de réplica externa (36 horas). Durante una operación con candado o marcador de mantenimiento no alerta por la parada deliberada.

Los mensajes contienen códigos cerrados traducidos al español. Repite una incidencia persistente como máximo cada seis horas, informa cambios y recuperación. Un fallo de entrega conserva el aviso pendiente y vuelve a intentarlo; si n8n se recupera antes del siguiente sondeo, se informa la recuperación aun cuando el aviso inicial no pudo salir. El monitor nunca muestra salida Docker, errores del proveedor ni valores de entorno.

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

## Recuperación

1. Poner el destino en mantenimiento y detener el Compose. Preservar cualquier escritura posterior al snapshot; restaurar un disco no revierte publicaciones ni decisiones externas.
2. Si el VPS se conserva, usar `deploy/revertir.sh` con `anterior.json`; comprueba/restaura primero en un directorio nuevo y archiva los datos desplazados. No iniciar simultáneamente n8n de PC y VPS.
3. Si se perdió el VPS, preparar Ubuntu y una instalación revisada de `deploy/`. Recuperar el repositorio **cifrado** desde `~/.local/share/cooper-copias-vps/actual` y provisionar la contraseña y configuración privada por el canal ya autorizado. La copia no contiene `/etc/cooper/.env`; no reconstruye OAuth, claves del host ni sesiones CLI.
4. En el destino nuevo: ejecutar `restic check --read-data`, elegir ID explícito y `operar.py restaurar-prueba ID DESTINO_NUEVO`; después `operar.py importar ID` solo con servicios detenidos y volúmenes vacíos. Conservar los workflows automáticos pausados hasta conciliar esperas/efectos externos y confirmar dos controles humanos de publicación.
5. Arrancar el Compose, comprobar salud, HTTPS, rechazo anónimo, puente y datos; reinstalar timers. Retirar mantenimiento únicamente tras verificación. Una sesión Google real sigue requiriendo al usuario.

Pruebas locales: `PYTHONDONTWRITEBYTECODE=1 python3 -W error -m unittest discover -s deploy/tests -p 'test_*.py'`. Ejercitan fallos de transporte/restauración, conservación de la copia previa, HMAC real cruzado Python→JavaScript, replay, mensajes inválidos, deduplicación, recuperación, mantenimiento y coordinación de relés. El informe distingue esas pruebas de la copia real y del despliegue remoto.

Fuentes oficiales consultadas el 21-11-2026: [repositorios restic](https://restic.readthedocs.io/en/stable/045_working_with_repos.html), [restauración restic](https://restic.readthedocs.io/en/stable/050_restore.html), [timers systemd](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html), [webhook n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/), [Code n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/) y [Telegram sendMessage](https://core.telegram.org/bots/api#sendmessage).
