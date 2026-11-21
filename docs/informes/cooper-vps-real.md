# Cooper y n8n — VPS real

21 de noviembre de 2026, America/Lima. VPS previsto: Contabo Cloud VPS 4,
Ubuntu, 8 GB, UE; pedido 15717272. Dominio `cooperestudio.com`.
Worktree propio `/home/david/Proyectos/cooper-vps-real`, rama `cooper-vps-real`,
base `995d76e`. Administrador: `wdhg.xoxa@gmail.com`.

## Estado

**Fase A completada; fase B en espera de IP, SSH y DNS. No hay despliegue remoto.**
El sondeo empezó a las **02:29:07 Lima** y vence a las **10:29:07 Lima**,
con comprobaciones cada 120 segundos. Al preparar este informe falta
`~/.config/cooper/vps-ip` y ninguno de los dos subdominios resuelve por IPv4.
La falta de IP no se interpreta como permiso para adivinar un servidor.
El estado actualizado queda en `~/.cache/cooper-vps/espera.json`.

La PC sigue funcionando tras el respaldo inicial. Detenerla definitivamente
requiere completar el corte y la aceptación del VPS. No se publicaron ni editaron
workflows vivos, no hubo OAuth, pagos, mensajes a terceros ni cambios en
D&S Factory. La breve parada/reanudación de n8n, runner y Cooper fue únicamente
para la copia fría solicitada.

## Commits

| Commit | Cambio |
| --- | --- |
| `a51fb52` | Transmitir a Cooper el bloqueo de respaldo API y la configuración del puente; regresión roja/verde. |
| `05d8337` | Sondeo acotado de SSH/DNS, cinco pruebas sin red y guía operativa del dominio real. |
| `d10e3ab` | Informe de fase A y evidencia de puerta/restauración/Compose. |

La aplicación no cambió respecto de la base. La imagen preparada es
`localhost/cooper:05d833787525fa98b183b3934ef13bd5dff1ca76`, ID
`e8226b1db7f4f6f4a47526bf2fd4fc4597f8414bd37f47f17036f953cfbfe16e`.
Los commits del informe añaden únicamente evidencia y documentación.
La preparación y el informe se publicaron atómicamente en `main` y
`version-chatgpt` del remoto propio `mio`; no se modificó el upstream `origin`.

## Fase A ejecutada

- Llave ed25519 dedicada `~/.ssh/cooper_vps`, sin passphrase, privada 0600.
  No se sobrescriben llaves existentes. Comando exacto guardado en
  `~/.config/cooper/ssh-copy-id.txt` (0600):

  ```bash
  ssh-copy-id -i ~/.ssh/cooper_vps.pub -o StrictHostKeyChecking=ask root@"$(cat ~/.config/cooper/vps-ip)"
  ```

- `~/.config/cooper/vps.env` (0600): dominios y orígenes HTTPS, editor privado
  en 8443, administrador, variables existentes de Google/WhatsApp y cinco
  secretos nuevos independientes: `AUTH_SECRET`, `COOPER_N8N_TOKEN`,
  `COOPER_WEBHOOK_SECRET`, `N8N_RUNNERS_AUTH_TOKEN`, `PUENTE_CODEX_TOKEN`.
  `N8N_ENCRYPTION_KEY` conserva exactamente la clave del origen. La provisión
  procesa archivos privados sin devolver valores a terminal, conversación o Git.
- Contraseña restic nueva en `~/.config/cooper/restic-password` (0600), referida
  por `RESTIC_PASSWORD_FILE`. Destino VPS: `/var/backups/cooper-restic`, fuera
  de los datos. Repositorio local inicial cifrado: `~/.cache/cooper-vps/restic`.
  `~/.config/cooper/migracion-vps.env` (0600) permite usar el script existente.
- Captura fría en `~/.cache/cooper-vps/origen-20261121-023042/`: volumen n8n
  completo, SQLite Cooper y posibles WAL; no se copian sesiones CLI.
  **10 archivos, 209 tablas SQLite, 34 workflows y 9 Data Tables**.
  Los adjuntos de Cooper están en su SQLite. Se compararon hashes de origen y
  copia. Integridad y conteos PASS. Se excluye solamente SHM transitorio.
- Exportación mediante `deploy/migrar-desde-pc.sh exportar --origen …
  --origen-detenido`, restauración automática y `restic check --read-data`: rc 0.
  Snapshot `5c2083feecb568c5cf06056f87143088057efef6f0299c62476dc5fcc6bd4661`.
  Segunda restauración independiente con `restaurar-prueba`: rc 0. n8n 2.47.4
  abrió esa copia en un contenedor efímero **sin red** y exportó los 34 workflows;
  IDs, nodos y conexiones coincidieron. No se restauró sobre el volumen vivo.

La captura inicial es un respaldo de preparación. **Hay que repetir la captura
fría al cortar**, porque la PC volvió a prestar servicio durante la espera.
Se observaron cero ejecuciones `new/running`, dos `waiting` históricas y cuatro
workflows publicados con cron. Deben inventariarse/conciliarse antes del arranque
remoto; no reanudar automáticamente esperas, cron o publicaciones pagadas.

## Puerta obligatoria y comprobaciones

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | rc 0, cero vulnerabilidades |
| `npm run lint` | rc 0, cero errores/advertencias |
| `npm run typecheck` | rc 0 |
| `npm test` | rc 0, 227/227, 23 archivos |
| `npm run test:e2e` | rc 0, 33/33 |
| `npm run build` | rc 0 |
| Flujos v2 | rc 0, 130/130 |
| Python de despliegue, `-W error` | rc 0, 20/20 |
| Puente Codex | rc 0, 12/12, ejecutables ficticios |
| `shellcheck deploy/*.sh`, `git diff --check` | rc 0 |
| Imagen Podman, formato Docker | rc 0 |
| Ensayo Compose de la imagen final | rc 0, siete bloques PASS |

**Puerta: cero errores y cero advertencias.** Node 24.22.3, npm 12.2.2.
[Evidencia de la puerta](evidencias/cooper-vps-real/puerta.log),
[flujos](evidencias/cooper-vps-real/flujos.log),
[pruebas operativas](evidencias/cooper-vps-real/deploy-tests.log),
[restauración real](evidencias/cooper-vps-real/restauracion-verificada.json).
[Compose](evidencias/cooper-vps-real/compose.log) comprobó TLS con CA local,
login ficticio, runner 2.47.4, firma, SSE/reconexión, restic/restauración,
importación y reversión de imagen/datos. Usa datos ficticios, puertos propios y red interna;
no certifica HTTPS público, acceso a Google ni servicios del VPS.

La regresión de Compose reprodujo la falta de `COOPER_CHAT_API_RESPALDO`
([rojo](evidencias/cooper-vps-real/compose-rojo.log)); ahora se transmite con
valor predeterminado `0`, junto al puente para Cooper. Los secretos de chat y
Meta siguen fuera del runner. El generador de plantillas se invocó primero desde
la raíz y rechazó la ruta relativa; se repitió correctamente desde `cooper/`.
Las cinco plantillas del dominio definitivo están en
`~/.cache/cooper-vps/plantillas-whatsapp/`, sin enviarse a Meta.

## Chat y limitaciones reales

VPS preparado con `COOPER_CHAT=codex-local` y `COOPER_CHAT_API_RESPALDO=0`:
si no existe el puente privado, responde en **modo básico temporal con aviso**.
No se trasladaron credenciales de Claude/ChatGPT ni se instaló una sesión en el
VPS. El puente Codex existente permanece en la PC; Claude CLI se invoca localmente
por Cooper y no dispone de un puente HTTP independiente.

No se ha creado un túnel. El loopback del host y los de Cooper/n8n/runner son
espacios distintos; un simple `ssh -R` al host no los conecta. Además, el
instalador permite solo reenvío SSH local. Un futuro túnel requiere acceso
limitado, distribución dentro de esos espacios y ensayo; no abrir 8789 ni
permitir reenvío SSH global. El modo básico satisface la alternativa de respaldo
sin copiar sesiones ni consumir APIs, con menor capacidad que los modelos.

Pendientes por ausencia de VPS accesible: usuario operador y segunda sesión,
Ubuntu/firewall/fail2ban/actualizaciones, transferencia/importación final,
ACME público, firma y SSE remotos, copia/restauración remotas y timer diario.
No declarar ninguno como desplegado. El editor sigue diseñado para acceso
privado por túnel en `https://flujos.cooperestudio.com:8443`; el dominio público
443 solo sirve webhooks autorizados y rechaza el editor.

## Pendientes de Walter

1. Guardar la IPv4 del VPS dedicado en `~/.config/cooper/vps-ip`, comprobar la
   huella SSH desde la consola Contabo y ejecutar el comando de `ssh-copy-id.txt`
   con su contraseña root. No enviar la contraseña ni claves a la conversación.
2. En Cloudflare, A de `cooper` y `flujos` hacia esa IP, inicialmente DNS directo;
   sin AAAA mientras IPv6 no esté configurado. Permitir 22/80/443. Mantener 8443
   cerrado al público. El sondeo espera SSH con host conocido y DNS coincidente.
3. Elegir y custodiar copia remota fuera del VPS, contraseña offline y clave de
   cifrado n8n. La copia local cifrada no protege contra pérdida completa del VPS.
4. Conciliar las dos esperas históricas y acordar la reapertura de cron/entradas
   después de aceptar el VPS. La PC solo quedará detenida e intacta como reversa
   tras el corte efectivo, evitando dos escritores simultáneos.
5. **Claude, Google OAuth:** en el mismo cliente web existente añadir el origen
   JavaScript autorizado `https://cooper.cooperestudio.com` y el redirect URI
   exacto `https://cooper.cooperestudio.com/api/auth/callback/google`.
   Revisar dominio autorizado `cooperestudio.com` y cuenta permitida
   `wdhg.xoxa@gmail.com`. Conservar los callbacks anteriores durante la reversa.
   Verificar redirección antes de que Walter haga manualmente el login OAuth.
6. **Claude, Meta:** provisionar `WHATSAPP_APP_SECRET` por archivo privado (no
   estaba configurado), configurar callback
   `https://cooper.cooperestudio.com/api/whatsapp/webhook` y el verify token ya
   custodiado, suscribir `messages`, revisar el override WABA existente y comprobar
   desafío/firma. Usar las cinco plantillas regeneradas con dominio definitivo;
   sustituir el origen provisional y obtener sus aprobaciones. Se conserva
   `COOPER_MENSAJERIA_PAUSA=1` en el entorno VPS hasta completar esa aceptación.
   Los bloqueos previos de Meta sobre pago/autenticación no se resolvieron aquí;
   ver [alta de WhatsApp](cooper-whatsapp-alta.md). No se hicieron pagos ni envíos.
7. Si se necesita IA del plan desde el VPS, completar y probar la topología
   privada con la PC encendida. Hasta entonces conservar el modo básico y las
   APIs de respaldo apagadas.

## Fuentes oficiales consultadas

- [Runners externos n8n](https://docs.n8n.io/hosting/configuration/task-runners/) y
  [CLI n8n](https://docs.n8n.io/hosting/cli-commands/).
- [Docker en Ubuntu](https://docs.docker.com/engine/install/ubuntu/) y
  [HTTPS automático Caddy](https://caddyserver.com/docs/automatic-https).
- [Repositorios restic](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html)
  y [restauración](https://restic.readthedocs.io/en/stable/050_restore.html).
- [OpenSSH](https://man.openbsd.org/ssh.1),
  [OAuth web Google](https://developers.google.com/identity/protocols/oauth2/web-server)
  y [override de webhook Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/override).
