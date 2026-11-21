# Chat del VPS mediante el plan de la PC

El VPS conserva sus propios tokens. Un relé autenticado en cada espacio de red (Cooper, n8n y runner) comunica con un socket Unix privado mediante SSH. El relé de la PC añade allí su token local y llama al puente de Codex existente. Ningún token cruza el túnel ni se copia entre entornos. La respuesta del modelo propone herramientas; Cooper conserva sus validaciones de usuario, canal y aprobación humana.

## Instalación aplicada y comprobación

- PC: `puente-codex.service`, `cooper-chat-rele.service` y `cooper-chat-tunel.service`, en el gestor de usuario. Código en `~/.local/lib/cooper/puente-codex/`; la unidad original del puente conserva su EnvironmentFile, con un drop-in que selecciona este código. `Linger=yes` permite arrancar el gestor después del reinicio.
- VPS: `deploy/compose.chat.yaml`, seleccionado por `/var/lib/cooper-operacion/chat-tunel.enabled`. El overlay fija el destino `http://127.0.0.1:8789`, `COOPER_CHAT=codex-local` y respaldo API deshabilitado. Es necesario recrear los servicios al cambiar ese destino; comprobar el despliegue final en el informe de misión.
- `/run/cooper-chat` pertenece a `operador`, modo 0700; socket modo 0600. En este VPS su UID/GID es 1001. `COOPER_RELE_UID`/`COOPER_RELE_GID` permiten instalar en otro servidor sin compartir permisos con los datos de Cooper.
- Configuración SSH: `deploy/cooper-chat.sshd.conf`, instalada en `sshd_config.d`. Validar con `sshd -t` antes de recargar. `AllowTcpForwarding yes` habilita el permiso base que OpenSSH también consulta al crear el socket; `PermitListen none` sigue denegando escuchas TCP remotas. Se probó una petición TCP y fue rechazada. No se publican puertos nuevos.

Las sondas se ejecutan con el entorno existente del contenedor; no necesitan leer archivos privados ni recuperar tokens:

```sh
cat deploy/verificar-chat.cjs | ssh -i ~/.ssh/cooper_vps operador@144.91.88.253 \
  'sudo docker exec -i cooper-cooper-1 node - chat'
```

Usar `salud` en los contenedores `cooper-n8n-1` y `cooper-runner-1`. La sonda publica únicamente estado HTTP, resultado y duración. La respuesta de prueba no contiene datos del negocio y no propone acciones.

## Caída y recuperación

La prueba real detuvo `cooper-chat-tunel.service`, observó HTTP 503 desde el VPS, lo inició y comprobó otra respuesta del plan. El relé permanece saludable aunque la PC no esté disponible; su salud local comprueba que rechaza peticiones anónimas. El chat de Cooper conserva su respaldo básico local, sin pagar otra API. Las investigaciones y lecciones que necesitan el plan deben mostrar indisponibilidad o reintentar; no inventan resultados.

El túnel reintenta cada diez segundos, con keepalive cada quince segundos y tres fallos antes de reconectar. El puente admite una tarea a la vez: una petición concurrente recibe 429. El chat dispone de cuarenta segundos; el radar con búsqueda, tres minutos. El relé y n8n disponen de márgenes acotados para completar esa tarea.

Para revertir solo este complemento: detener primero los tres servicios `chat-*` con el overlay activo; retirar su marcador; deshabilitar las dos unidades nuevas de PC; retirar el archivo SSH añadido, validar y recargar SSH. Conservar los entornos originales y el puente local. Para revertir toda la aplicación, usar `deploy/operar.py revertir` y su respaldo comprobado. No borrar datos ni editar valores de credenciales.

## Fuentes oficiales

- [OpenSSH: configuración del servidor](https://man.openbsd.org/sshd_config): StreamLocal, PermitListen y máscaras del socket.
- [OpenSSH: permisos de escucha](https://github.com/openssh/openssh-portable/blob/master/channels.c): comprobación compartida de los permisos de forwarding.
- [Docker Compose: network_mode](https://docs.docker.com/reference/compose-file/services/#network_mode): relés en el espacio de red de cada servicio.
- [Node HTTP](https://nodejs.org/api/http.html): transporte mediante `socketPath` y límites de petición.
