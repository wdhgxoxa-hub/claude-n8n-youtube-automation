# Cooper y n8n en un VPS

Guía de fase 5 para **Ubuntu 24.04 LTS dedicado**. La migración real del 21 de noviembre de 2026 y sus pendientes están en [el informe del VPS](informes/cooper-vps-real.md). La guía conserva n8n y su runner en **2.47.4**. Cooper usa una imagen de Node **24.22.3**, construida en varias etapas y ejecutada como UID 1000. No hay réplicas: SQLite, límites de sesión e idempotencia necesitan una sola instancia de Cooper.

## Elegir el servidor

Para 3–10 usuarios, partir de **4 vCPU, 8 GB RAM y 100 GB SSD**, Linux amd64 o arm64, IP pública estable, consola de rescate y snapshots del proveedor. Es un presupuesto de capacidad, no una medición de producción. La generación audiovisual permanece en proveedores externos: este Compose no incluye GPU, FFmpeg intensivo ni D&S Factory. La imagen se ensayó en amd64; arm64 requiere repetir el ensayo.

Los límites son 2 GB para n8n, 1 GB para el runner, 1 GB para Cooper y 256 MB para Caddy. Reservar memoria adicional al sistema y a la compilación. Medir la carga antes de reducir a 2 vCPU. Mantener espacio libre de al menos **tres veces el tamaño de los datos más 10 GB**: las copias y restauraciones temporales coexisten con los volúmenes. Las reversiones conservan además el directorio anterior y requieren capacidad extra.

Elegir un destino de copias **fuera de ese VPS**, con credencial dedicada, cuota suficiente y recuperación probada. Restic cifra el contenido antes de transferirlo; el proveedor del disco no necesita la clave. Los snapshots del proveedor complementan la copia remota, no la sustituyen. Walter decide proveedor, región, presupuesto y tratamiento de datos personales.

## Red, DNS y HTTPS

Crear registros A para `cooper.sudominio` y `flujos.sudominio` apuntando al VPS. Esta configuración publica IPv4; no añadir AAAA hasta configurar y ensayar IPv6. Configurar inicialmente DNS directo, sin otro proxy/CDN. Abrir TCP 80 y 443 para validación ACME y servicio HTTPS. Caddy obtiene y renueva certificados automáticamente; persisten en `caddy-data`. Mantener el puerto 80 disponible para renovación y redirección.

Solo Caddy publica puertos. Cooper 3000, n8n 5678 y broker 5679 permanecen en las redes de contenedores. La red `backend` es interna. Cooper y n8n tienen además `salida` para OAuth y proveedores; el runner no tiene salida a Internet. El ensayo convierte ambas redes en internas.

En `flujos.sudominio:443` solo se permiten webhooks/formularios de producción; `/webhook/cooper/v1` está cerrado. Los controles de firma/autorización de cada webhook siguen siendo necesarios. No se publican REST, API administrativa ni editor. Los formularios de aprobación legados mantienen su autorización basada en sus enlaces privados; conservarlos en inventario durante la migración.

El editor usa el listener **8443, publicado en 127.0.0.1 del VPS**. Acceso del operador:

```bash
ssh -N -L 8443:127.0.0.1:8443 operador@IP_DEL_VPS
```

En la PC del operador, resolver temporalmente `flujos.sudominio` a `127.0.0.1` y abrir `https://flujos.sudominio:8443`. El certificado válido es el del mismo dominio público; Caddy lo obtiene por 80/443. Retirar esa resolución al cerrar la operación. No exponer 8443 en firewall ni panel del proveedor. Usar la cuenta administrativa de n8n y MFA. Los miembros de Cooper no reciben cuentas de editor.

Caddy conserva SSE con `flush_interval -1`, sin compresión ni búfer de respuesta y sin límite de tiempo total de stream. Limita cuerpo a 9 MB en Cooper y 16 MB en webhooks, y espera de cabeceras. Cooper conserva CSP por nonce, autorización y límites por usuario: 4 SSE, 90 mutaciones/minuto y 300 lecturas/minuto. No se prometen límites globales de IP ni protección contra DDoS. No se habilita `access_log`; los diagnósticos operativos del proxy pueden incluir metadatos de solicitudes fallidas, por lo que deben mantenerse privados y no exportarse sin revisión.

## Primer despliegue — operador, después de revisión

Estos comandos modifican un VPS dedicado; **no ejecutarlos en la PC actual**. Preparar usuario no root en el grupo sudo, llave SSH, consola de rescate y una segunda sesión de prueba. El instalador desactiva login root y contraseñas SSH. El puerto indicado debe coincidir con el acceso que usará el operador y el firewall del proveedor.

1. Llevar el checkout revisado a `/opt/cooper` (sin `.env`, datos ni cachés), registrar su commit y verificar que no hay modificaciones pendientes. No copiar exports crudos dentro del checkout.
2. Como root, ejecutar:

   ```bash
   COOPER_SSH_USER=operador COOPER_SSH_PORT=22 /opt/cooper/deploy/instalar.sh --preparar
   ```

   Es repetible: instala Docker oficial y Compose, Python, restic, UFW, fail2ban y actualizaciones de seguridad; crea directorios sin borrar datos. No inicia la aplicación. No añade usuarios al grupo Docker. Los permisos de Docker equivalen a administración del host.
3. Editar **fuera de Git** `/etc/cooper/.env`, propietario root y `0600`, a partir de [deploy/.env.example](../deploy/.env.example). Formato estricto `NOMBRE=valor`, sin comillas, `export` ni expansión de shell. Los scripts no ejecutan ese archivo ni imprimen valores. Usar secretos aleatorios distintos de al menos 32 caracteres para `AUTH_SECRET`, `COOPER_N8N_TOKEN`, `COOPER_WEBHOOK_SECRET`, `N8N_ENCRYPTION_KEY` y `N8N_RUNNERS_AUTH_TOKEN`. Para una migración, **conservar la clave de cifrado original de n8n**, suministrada por Walter fuera del repositorio. Perderla impide descifrar credenciales; cambiarla por una nueva no migra las existentes.
4. Configurar dominios, `COOPER_ORIGIN=https://cooper.sudominio`, `N8N_EDITOR_ORIGIN=https://flujos.sudominio:8443`, correo ACME en `CADDY_TLS` y correo administrativo. Google necesita origen exacto y callback `https://cooper.sudominio/api/auth/callback/google`. No usar emisor E2E ni variables de ensayo en producción. Esta misión no realiza login OAuth.
5. Conservar las claves en un gestor de secretos o copia offline separada. El backup de datos no copia `/etc/cooper/.env`, claves SSH ni contraseña de restic. Algunos archivos de n8n y certificados de Caddy sí contienen secretos y están dentro de la copia **cifrada**. No imprimirlos ni adjuntarlos a informes.
6. Configurar el repositorio remoto restic y su contraseña en `/etc/cooper/restic-password`, root/0600. Para SFTP, provisionar clave SSH dedicada y `known_hosts` verificado; no desactivar comprobación del host. En una instalación nueva, inicializar una sola vez:

   ```bash
   python3 /opt/cooper/deploy/operar.py iniciar-repositorio
   ```

   Un repositorio migrado se reutiliza, no se reinicializa. Fallos de red o contraseña nunca disparan `restic init` automáticamente.
7. Construir Cooper desde el commit revisado, antes de la ventana de corte:

   ```bash
   cd /opt/cooper
   revision=$(git rev-parse HEAD)
   docker build -f deploy/Containerfile -t "localhost/cooper:$revision" .
   ```

   Guardar esa etiqueta completa en `COOPER_IMAGE`. El contexto excluye `.env*`, SQLite, cachés, datos y scripts de prueba. Se puede transportar una imagen OCI/Docker aprobada y usar un digest de registro en vez de compilar en el VPS. No usar `latest`.
8. Si se migra desde PC, importar los datos según la sección siguiente **antes de iniciar servicios**. Si es instalación vacía, completar después el alta local del dueño de n8n y la configuración de tablas/flujos, siguiendo [el puente](cooper-puente-n8n.md). Esta misión no publica workflows ni conecta proveedores.
9. Validar y arrancar:

   ```bash
   /opt/cooper/deploy/instalar.sh --iniciar
   ```

   Verifica configuración, espera salud, hace una copia con restauración comprobada y solo entonces habilita el timer diario. Repetir es seguro. Si falla la primera copia, la aplicación puede haber arrancado pero el timer no queda habilitado: resolver la causa y repetir, sin declarar el despliegue cerrado.

UFW protege el host; Docker puede eludir UFW en puertos publicados. Por eso se añade una cadena propia en `DOCKER-USER` que admite conexiones existentes y destinos originales 80/443, y rechaza otro ingreso reenviado por la interfaz externa. Se repone después de arrancar Docker. Requiere backend **iptables**, no el backend nftables experimental. La cadena no vacía reglas ajenas. Revisar nuevamente si cambia la interfaz de red. Fail2ban protege SSH mediante el journal; no se presenta como filtro HTTP de Cooper. Las actualizaciones automáticas se limitan a seguridad del sistema; no actualizan imágenes ni reinician el VPS automáticamente.

## Migración desde la PC

La migración es **offline y de instancia completa SQLite**. No convierte PostgreSQL a SQLite, no cambia IDs de Data Tables y no reemplaza la migración de dueños de fase 2. Preserva credenciales cifradas, usuarios, workflows, ejecuciones, datos binarios, tablas y SQLite/adjuntos de Cooper. No exportar credenciales descifradas. Requiere n8n 2.47.4 en origen; si difiere, ensayar previamente una actualización en copia.

1. Inventariar procesos que escriben, ejecuciones/esperas en curso, webhooks externos y URLs OAuth. Cerrar nuevas órdenes en web/chat/Telegram, detener cron y drenar tareas. Detener n8n, runner y Cooper de origen **por el operador**. No arrancar origen y destino a la vez. Una espera de n8n puede conservar URLs antiguas: conciliarla antes del corte; cambiar DNS no reescribe todos los estados externos.
2. Preparar un directorio privado fuera del repo con esta forma, copiando los volúmenes **ya detenidos**. En `cooper/`, el nombre de la base debe ser `cooper.sqlite` y conservar juntos sus posibles `-wal`/`-shm`. Los adjuntos actuales están dentro de esa base. Si aparecen archivos adicionales de adjuntos en esa carpeta, también se copian:

   ```text
   /ruta/exportacion-offline/
     n8n/                 # contenido completo del volumen /home/node/.n8n
       database.sqlite
       binaryData/        # cuando existe
     cooper/
       cooper.sqlite
     caddy-data/          # opcional al migrar desde PC
     caddy-config/        # opcional al migrar desde PC
   ```

3. En la PC, preparar un entorno de migración 0600 **fuera de Git**, con el mismo repositorio remoto restic y contraseña. El script no busca automáticamente instalaciones ni lee el `.env` de la PC. `DATA_ROOT`/`STATE_ROOT` deben ser rutas separadas, siendo estado un temporal privado. Exportar:

   ```bash
   COOPER_ENV_FILE=/ruta/privada/migracion.env deploy/migrar-desde-pc.sh exportar \
     --origen /ruta/exportacion-offline --origen-detenido
   ```

   Produce un ID de snapshot cifrado, protegido con etiqueta `migracion`, tras restaurarlo en un temporal. Verifica SHA-256 y tamaño de cada archivo, conteos de **todas** las tablas e `integrity_check` de cada SQLite. Excluye solo `-shm`, que es transitorio; incluye WAL. Comprueba que el origen no cambió durante la copia. La bandera confirma la parada del origen; no sustituye el drenaje operativo.
4. En el VPS, con Compose detenido y `DATA_ROOT` vacío (se admiten los cuatro directorios vacíos del instalador), ejecutar:

   ```bash
   /opt/cooper/deploy/migrar-desde-pc.sh importar ID_DEL_SNAPSHOT
   ```

   Descarga y restaura desde el mismo repositorio, valida antes de importar, no sobrescribe instalaciones existentes y ajusta propiedad a UID 1000 si opera como root. No arranca servicios. No copia el `.env` ni transporta valores de secretos. La clave n8n del destino debe ser la original.
5. Completar el destino y arrancar con `instalar.sh --iniciar`. Comparar salud, conteos del manifiesto, acceso por dueño, recepción firmada, SSE y descarga de un adjunto autorizado. Cambiar DNS/webhooks externos según el inventario. Confirmar HTTPS y OAuth Google manualmente. No habilitar medios de pago, publicaciones ni nuevos cron sin la decisión de Walter.
6. Conservar PC detenida y snapshot de migración durante el periodo acordado. Si hay que volver tras aceptar nuevas órdenes en VPS, cerrar entradas, respaldar ambos estados y conciliar efectos externos. Una restauración de disco no deshace publicaciones ni llamadas ya enviadas.

## Copias y recuperación

Timer diario a las **08:00 UTC (03:00 Lima)**, con hasta 15 minutos de variación y recuperación de ejecuciones perdidas. Retención: **7 diarias, 5 semanales y 12 mensuales**; las etiquetas `migracion` y `reversion` se conservan hasta decisión expresa del operador. No ejecutar limpieza general del repositorio ni podas de imágenes de reversión.

Cada copia cierra Caddy, permite el cierre ordenado de n8n con su runner y Cooper disponibles, y finalmente detiene runner y Cooper. Copia los datos a un directorio privado y reanuda los servicios que estaban en marcha. El envío remoto, la restauración temporal y `restic check --read-data` ocurren después de reanudar. El bloqueo operativo evita solapamiento con migración/actualización. Una copia fría implica interrupción; medir duración y drenar producción antes de la ventana. n8n dispone de 120 segundos de cierre ordenado, frente a 150 del contenedor; una ejecución más larga o un efecto externo incierto requiere conciliación. Ante fallo de copia se intenta reanudar; systemd marca la tarea fallida. No hay alerta remota configurada automáticamente.

La comparación de restauración incluye cada archivo y tabla, incluidos adjuntos de Cooper y binarios de n8n. Después de la retención se vuelve a comprobar la estructura del repositorio. El estado mínimo queda en `/var/lib/cooper-operacion/ultima-copia.json`; no contiene filas ni secretos. Los manifiestos completos permanecen privados, dentro del snapshot y el directorio de datos importado.

```bash
systemctl list-timers cooper-backup.timer
systemctl status cooper-backup.service
journalctl -u cooper-backup.service --since yesterday
/opt/cooper/deploy/copiar.sh
python3 /opt/cooper/deploy/operar.py restaurar-prueba ID_DEL_SNAPSHOT /ruta/nueva/restauracion
```

La restauración de prueba exige un destino nuevo, verifica antes de informar PASS y nunca escribe sobre datos vivos. Para pérdida total: preparar servidor limpio, recuperar secretos por canal separado, recuperar imagen del commit original e importar snapshot en datos vacíos. Ensayar además el arranque sobre la restauración. El ensayo automatizado local cubre ese recorrido con datos ficticios.

Objetivo inicial: RPO máximo 24 horas si el timer funciona; el RTO depende del volumen, red y reinstalación y aún debe medirse en el VPS. Una copia fallida invalida ese objetivo hasta recuperarla. Contraseña perdida = repositorio irrecuperable. Disponer de copia offline de contraseña y clave n8n con acceso de Walter.

## Actualizar y revertir

`actualizar.sh` actualiza **solo la imagen de Cooper**. No hace `git pull`, migraciones de dueño, publicación de workflows ni actualización implícita de n8n/runner. Preparar imagen probada en la misma arquitectura, identificada por digest `registro/cooper@sha256:…` o etiqueta local con commit completo. Descargar/construir antes de la parada. Para n8n, runner, Caddy o configuración, preparar una nueva revisión de infraestructura, ensayo y plan de reversión específico; los scripts no pretenden revertir archivos de Compose de otras revisiones.

```bash
/opt/cooper/deploy/actualizar.sh localhost/cooper:COMMIT_COMPLETO_DE_40_HEX
/opt/cooper/deploy/revertir.sh
```

Actualizar guarda la imagen anterior con etiqueta local, hace copia protegida `reversion`, valida restauración, cambia imagen y espera salud. Las migraciones de Cooper se ejecutan al abrir SQLite. Si falla el arranque, detiene el Compose y pide reversión explícita; nunca reabre silenciosamente con un esquema posiblemente incompatible. Revertir primero valida el snapshot anterior, conserva otra copia del estado actual y archiva el directorio actual junto al volumen, restaura datos e imagen anteriores y espera salud. Es una **reversión de imagen y datos**, no solo de binario: no ejecutarla con usuarios escribiendo ni sin conciliar órdenes posteriores al snapshot.

`release.json` en el directorio de operación conserva la imagen elegida; usar `operar.py compose …` para arranques posteriores para no volver por accidente a la etiqueta inicial del `.env`. No editar ni borrar diarios de Drizzle/recibos del puente. Los directorios `datos.antes-reversion-*` no se eliminan automáticamente: el operador decide tras verificar recuperación y retención.

## Operación diaria y ensayo reproducible

Comprobar salud HTTPS, servicios sanos, copia reciente con restauración PASS, espacio, memoria, reloj sincronizado y vencimiento de certificados. Revisar `systemctl --failed`, intentos SSH y reinicios pendientes. Aprobar manualmente renovación de imágenes tras pruebas. Mantener el directorio de datos y el operativo en discos locales fiables, no NFS. No habilitar logs de depuración con payloads/credenciales.

Ensayo en una PC Linux con Node 24, Podman rootless, runc, Docker Compose y dependencias de Cooper instaladas:

```bash
podman pull ghcr.io/n8n-io/n8n:2.47.4
podman pull ghcr.io/n8n-io/runners:2.47.4
podman pull docker.io/library/caddy:2.11.2-alpine
podman pull docker.io/restic/restic:0.20.0
podman build --format docker -f deploy/Containerfile -t localhost/cooper:fase5 .
PYTHONDONTWRITEBYTECODE=1 python3 -W error -m unittest discover -s deploy/tests -p 'test_*.py'
node deploy/tests/compose.mjs
```

Usar `--format docker` conserva HEALTHCHECK en Podman. El Compose también declara salud explícitamente. El ejecutor crea un socket Unix privado para Compose con runc, un nombre aleatorio, puertos loopback, dos redes internas y volúmenes nuevos en `cooper/.cache/e2e-vps-*`. runc evita un fallo de `exec`/`oom_score_adj` de crun observado en este host; no modifica el runtime global. En el ensayo acorta esperas de salud/cierre y desactiva OCSP para la CA local, que no tiene responder; producción conserva OCSP. Nunca monta sockets dentro de contenedores ni instala certificados en el host; comprueba TLS con la CA local suministrada al cliente. Mantiene artefactos privados de prueba, detiene y elimina únicamente sus contenedores/redes. No reutiliza entornos, secretos ni instancias existentes.

Prueba salud de los servicios, cabeceras, bloqueo del editor público, login ficticio con cookies Auth.js seguras, firma real en runner externo mediante nodos exportados de `FX · Progreso de Cooper`, propagación SSE, rechazo HMAC inválido, backup cifrado, exportación/importación, arranque restaurado y actualización/reversión. No es un login OAuth, prueba de pagos ni certificación de seguridad del VPS. La puerta completa del proyecto y sus resultados están en [el informe de misión](informes/cooper-fase5.md).

## Fuentes oficiales consultadas

Consultadas el 20-11-2026 y contrastadas con las imágenes y herramientas del ensayo:

- [n8n: runners externos y configuración](https://docs.n8n.io/hosting/configuration/task-runners/), [variables de runners](https://docs.n8n.io/hosting/configuration/environment-variables/task-runners/) y [configuración versionada 2.47.4](https://github.com/n8n-io/n8n/blob/n8n%402.47.4/docker/images/runners/n8n-task-runners.json). La lista permitida del runner incluye solo variables del puente y `crypto`; los editores siguen siendo operadores de confianza por el acceso `$env` que exige el contrato.
- [n8n detrás del proxy](https://docs.n8n.io/hosting/configuration/configuration-examples/webhook-url/): `N8N_WEBHOOK_URL`, `N8N_PROXY_HOPS=1`; no se usa la variable antigua `WEBHOOK_URL`. [CLI y exportación](https://docs.n8n.io/hosting/cli-commands/). El alta y API key del n8n **ficticio** se cotejaron con [OwnerController](https://github.com/n8n-io/n8n/blob/n8n%402.47.4/packages/cli/src/controllers/owner.controller.ts) y [ApiKeysController](https://github.com/n8n-io/n8n/blob/n8n%402.47.4/packages/cli/src/controllers/api-keys.controller.ts); son endpoints internos versionados, usados solo en el ensayo.
- [Caddy reverse_proxy y streaming](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [HTTPS automático](https://caddyserver.com/docs/automatic-https).
- [Restic: retención](https://restic.readthedocs.io/en/stable/060_forget.html), [restauración](https://restic.readthedocs.io/en/stable/050_restore.html).
- [Docker en Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [Compose](https://docs.docker.com/reference/compose-file/services/), [firewall y publicación de puertos](https://docs.docker.com/engine/network/packet-filtering-firewalls/), [socket Podman](https://docs.podman.io/en/latest/markdown/podman-system-service.1.html).
- [Ubuntu UFW](https://ubuntu.com/server/docs/how-to/security/firewalls/), [actualizaciones automáticas](https://ubuntu.com/server/docs/how-to/software/automatic-updates/), [configuración oficial fail2ban](https://github.com/fail2ban/fail2ban/blob/master/config/jail.conf).
- Next 16.4.6: guías locales `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md` y `03-file-conventions/route.md`, consultadas antes de cambiar empaquetado y salud.

## Configuración después de integrar las fases

`cooper-final` añade al entorno explícito de Compose las variables de chat y WhatsApp de `deploy/.env.example`. El chat del VPS permanece en `COOPER_CHAT=simulada` hasta que Walter configure `ANTHROPIC_API_KEY` (principal), `OPENAI_API_KEY` (respaldo/transcripción) y elija `claude` u `openai`. `COOPER_MENSAJERIA=simulada` mantiene Meta apagado. El consumidor puede pausarse con `COOPER_MENSAJERIA_PAUSA=1` antes de reiniciar. Las claves de chat/Meta solo entran a Cooper, nunca al runner de código de n8n.

`PUENTE_CODEX_URL` y `PUENTE_CODEX_TOKEN` llegan a n8n y a la lista permitida del runner. El Compose base **no instala Codex ni crea su sesión o túnel**. El operador debe preparar el servicio dedicado descrito en [puente Codex](puente-codex.md) y hacerlo accesible en el loopback del espacio de red de n8n; el loopback del host no sirve desde el contenedor. Hasta resolver y probar esa conexión, dejar `allowTextoApi=false` y no activar tareas que necesiten el puente. Un respaldo API autorizado permite operar sin Codex, pero ya consume API.

Las migraciones SQLite finales son `0005_chat_ia`, `0006_whatsapp`, `0007_noticias` sobre la base del ensayo/vivo. Los diarios experimentales con otro `0005` se rechazan de forma segura. Una actualización del checkout no importa workflows ni migra las Data Tables de n8n: ambas operaciones quedan separadas para Walter, con copia y reversión.

Ensayo de la imagen elegida, sin cambiar la etiqueta histórica de fase 5:

```bash
COOPER_VPS_TEST_IMAGE=localhost/cooper:COMMIT_REVISADO node deploy/tests/compose.mjs
```

El contrato del entorno efectivo se comprueba con `python3 -W error -m unittest discover -s deploy/tests -p 'test_integracion.py'`: Docker Compose resuelve solo el `.env.example` con valores ficticios y no arranca servicios. [Documentación oficial de variables en Compose](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/).

## Preparación de cooperestudio.com (VPS real)

La misión real se registra en [cooper-vps-real](informes/cooper-vps-real.md). Los
secretos y respaldos permanecen fuera del checkout. La llave dedicada es
`~/.ssh/cooper_vps`; Walter instala su parte pública con el comando guardado en
`~/.config/cooper/ssh-copy-id.txt`, después de escribir la IPv4 pública en
`~/.config/cooper/vps-ip`. Verificar la huella del servidor al primer acceso.

```bash
python3 deploy/esperar-vps.py
```

Sondea cada 120 segundos durante un máximo de ocho horas. Exige IPv4 pública,
SSH sin contraseña con la llave dedicada y host conocido, y que todos los A de
`cooper.cooperestudio.com` coincidan con esa IP. Rechaza direcciones locales,
texto de shell, DNS mezclado y cambios de clave del host. Solo comprueba acceso:
**no ejecuta el corte ni el instalador**. Estado mínimo en
`~/.cache/cooper-vps/espera.json`; salida 0 al estar listo, 2 al agotar la espera.
Antes de instalar, comprobar también el A de `flujos.cooperestudio.com`, ausencia
de AAAA sin configurar, Ubuntu 24.04 y acceso de `operador` en una segunda sesión.
Usar DNS directo de Cloudflare mientras se valida el HTTPS del origen.

El entorno preparado apunta a `/var/backups/cooper-restic`, repositorio local
cifrado **fuera de `/var/lib/cooper`**, con contraseña en
`/etc/cooper/restic-password`. Transferir el repositorio cifrado y la contraseña
por SSH como archivos separados; no incluirlos en la imagen ni en Git. La copia
local no cubre pérdida del VPS: el destino remoto y su ensayo siguen pendientes.

El contenedor no lleva sesiones Claude/ChatGPT. `COOPER_CHAT=codex-local` y
`COOPER_CHAT_API_RESPALDO=0` permiten el modo básico temporal con aviso visible
cuando el puente no está disponible. Compose transmite ambas variables y la
URL/token del puente a Cooper. No habilitar respaldo API por tener claves
presentes. La conexión futura exige un túnel dentro del espacio de red del
contenedor: `127.0.0.1` del VPS no es `127.0.0.1` de Cooper, n8n ni su runner.
El servidor actual de Claude CLI no es un puente HTTP independiente. El de Codex
sí escucha en la PC. Un túnel reverso necesitaría una excepción SSH limitada:
`instalar.sh` solo permite reenvío local. No cambiarlo a reenvío global ni abrir
8789 para resolverlo. Hasta desplegar y ensayar una topología privada completa,
se conserva el respaldo básico y no se trasladan credenciales de suscripción.
