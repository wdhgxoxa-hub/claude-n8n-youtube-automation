# Cooper y n8n — migración al VPS real

21 de noviembre de 2026, America/Lima. Contabo Cloud VPS 4, pedido 15717272.
Ubuntu 24.04, x86_64, 4 CPU, 8 GB RAM, región UE indicada por Walter.
Administrador: `wdhg.xoxa@gmail.com`. Worktree propio
`/home/david/Proyectos/cooper-vps-real`, rama `cooper-vps-real`, base `995d76e`.

## Estado del cierre

**Datos migrados y servicios operativos en el VPS. La PC quedó detenida e intacta.**
La aceptación con la sesión real de Walter sigue pendiente, junto con Meta,
reapertura de entradas y destino automático de copias fuera del VPS.

- Web: <https://cooper.cooperestudio.com>, salud 200, entrada 200 y redirección
  a Google con el callback definitivo. No se completó un login OAuth.
- n8n y runner **2.47.4**, Cooper y Caddy **2.11.2**: los cuatro saludables.
  <https://flujos.cooperestudio.com> sirve los webhooks permitidos; `/` devuelve
  **404 intencionalmente**. El editor usa 8443, accesible solo mediante SSH.
- Importación comprobada: **34 workflows, 9 Data Tables, 10 archivos y 209 tablas**.
  Hashes, tamaños y conteos coinciden antes del primer arranque. Se conservó la
  clave original de cifrado n8n y los IDs reales de workflows/tablas.
- **10 entradas automáticas pausadas en destino**, 22 workflows publicados
  restantes, incluido el puente de Cooper. WhatsApp permanece pausado.
- Chat en **modo básico temporal**, con respaldo por API apagado. No se copiaron
  sesiones de Claude CLI ni Codex CLI al VPS.
- Restic cifrado local, restauraciones verificadas y timer diario habilitado.
  Puerta del proyecto: **cero errores y cero advertencias**.

No hubo pagos, logins OAuth, envíos a terceros ni cambios en D&S Factory. Se
migró la instancia existente; no se importaron workflows regenerados sobre ella.

## Commits y artefacto desplegado

| Commit | Cambio |
| --- | --- |
| `a51fb52` | Transmitir a Cooper el bloqueo de respaldo API y la configuración del puente; regresión roja/verde. |
| `05d8337` | Sondeo acotado de SSH/DNS, cinco pruebas sin red y guía del dominio real. |
| `d10e3ab` | Informe inicial y evidencia de puerta, restauración y Compose. |
| `16341ab` | Registrar publicación de la preparación y normalizar evidencia. |

El cierre documental añade este informe, evidencias reales y la actualización
de la guía. Su commit se identifica con
`git log -1 -- docs/informes/cooper-vps-real.md`. Publicación en `version-chatgpt`
y `main` del remoto propio `mio`; no se usa el upstream `origin`.

El VPS recibió fuentes de `16341ab` en `/opt/cooper`, sin `.git`, entornos
privados ni cachés. La aplicación no cambió respecto de la base; la imagen
probada es `localhost/cooper:05d833787525fa98b183b3934ef13bd5dff1ca76`.

- SHA-256 de configuración de imagen:
  `e8226b1db7f4f6f4a47526bf2fd4fc4597f8414bd37f47f17036f953cfbfe16e`.
- SHA-256 del manifiesto en Docker 29/containerd:
  `4c3c8c1f5560c371bf79ebd52a4cd83942468f4620dfe10eb38460505cc223a4`.
- SHA-256 del archivo transportado:
  `c3de10164018929c3283a140056413a8c832089a032027fcb161bd80578c72d7`.

Se comprobó el archivo en ambos extremos y la configuración extraída del Docker
remoto. Una comparación inicial entre manifiesto y configuración se corrigió
verificando el objeto adecuado: son identificadores distintos. No hubo cambio
ni corrupción de la imagen.

## Preparación y corte

1. Llave `~/.ssh/cooper_vps`, ed25519 dedicada sin passphrase, privada 0600.
   Comando en `~/.config/cooper/ssh-copy-id.txt`, también 0600:

   ```bash
   ssh-copy-id -i ~/.ssh/cooper_vps.pub -o StrictHostKeyChecking=ask root@"$(cat ~/.config/cooper/vps-ip)"
   ```

   Walter habilitó el acceso durante la espera. Ese comando corresponde al alta;
   **root por SSH ya está deshabilitado**. Ahora se usa `operador` con la misma llave.
2. `~/.config/cooper/vps.env` (0600): dominios, orígenes, administrador, variables
   existentes de Google/WhatsApp y secretos nuevos independientes: `AUTH_SECRET`,
   `COOPER_N8N_TOKEN`, `COOPER_WEBHOOK_SECRET`, `N8N_RUNNERS_AUTH_TOKEN`,
   `PUENTE_CODEX_TOKEN`. `N8N_ENCRYPTION_KEY` conserva exactamente la clave del
   origen. Contraseña restic nueva en `~/.config/cooper/restic-password` (0600).
   Los archivos privados se procesaron sin mostrar sus valores.
3. Respaldo frío inicial a las **02:30**, seguido de reanudación de la PC durante
   la espera. Volumen n8n completo, SQLite Cooper y WAL; solo SHM transitorio
   excluido. Los adjuntos están en SQLite. Exportación con el script de migración,
   restauración, integridad y `restic check --read-data`: PASS. Una copia
   independiente abrió n8n sin red y comprobó los 34 workflows.
4. Sondeo cada 120 segundos desde **02:29:07**, con límite de ocho horas. IP,
   llave SSH y DNS de Cooper disponibles a las **08:53**, intento 193. DNS de
   `flujos` confirmado a las **09:10**, antes del corte.
5. `instalar.sh --preparar`: usuario `operador`, segunda sesión comprobada,
   sudo, Docker oficial, UFW, cadena de firewall Docker, fail2ban y actualizaciones
   de seguridad. SSH solo con llave, sin root ni contraseñas. Solo 22/80/443
   accesibles desde la PC; 8443/3000/5678/5679/8789 no accesibles públicamente.
   No quedó reinicio pendiente ni unidad systemd fallida.
6. Se transfirieron imagen verificada y repositorio restic cifrado. Se ensayó el
   arranque de ambos servicios con una **copia de datos reales**, sin red ni
   puertos publicados, y con todos sus workflows despublicados únicamente en
   esa copia. Ambos healthchecks pasaron antes del corte.
7. **Corte definitivo a las 09:14**: cero ejecuciones activas y cero turnos de chat.
   Se detuvo primero n8n, después runner y Cooper. Captura nueva en
   `~/.cache/cooper-vps/origen-20261121-091436/`, exportada y restaurada mediante
   `deploy/migrar-desde-pc.sh`; traslado incremental del repositorio cifrado.
8. Importación en `/var/lib/cooper`, inicialmente vacío. Hashes/conteos/integridad
   aprobados **antes de cambiar estados de publicación**. Diez workflows con
   cron, Telegram, chat, webhooks u otras entradas autónomas quedaron pausados.
   Se conservó publicado el API interno, identificado por nombre y ruta
   `cooper/v1`. El diario privado
   `/var/lib/cooper-operacion/disparadores-pausados.json` conserva IDs y versiones
   para reapertura selectiva. Los conteos de datos de negocio y credenciales
   no cambiaron al pausar entradas.
9. `instalar.sh --iniciar`: Compose saludable, primera copia restaurada y timer
   habilitado. Validaciones reales a las **09:24–09:27**.

La PC conserva volumen, bases, imágenes, entorno y servicios. `videos-n8n` y
`videos-n8n-runner` están `exited`, con reinicio automático `no`; `cooper.service`
está inactivo y deshabilitado. El puente Codex sigue activo en la PC. Cooper
local devolvió 143 al recibir la parada; SQLite pasó integridad y se limpió
únicamente la marca `failed` de systemd, sin reanudarlo.

## Copias y restauración

| Momento | Snapshot restic verificado |
| --- | --- |
| Preparación inicial PC | `5c2083feecb568c5cf06056f87143088057efef6f0299c62476dc5fcc6bd4661` |
| Corte definitivo PC | `56efa1e40a93a2be2d5488888a645585a4479f11cb321f4efab29f58d196694b` |
| Primer arranque VPS | `a7a1ee642b140b179d182e48dfbc756f2d84c85f6680b3205d37ed6cdec97e43` |

Repositorio PC: `~/.cache/cooper-vps/restic`. Repositorio VPS:
`/var/backups/cooper-restic`, cifrado y fuera de los volúmenes. Entorno VPS
`/etc/cooper/.env` y contraseña `/etc/cooper/restic-password`, root/0600.
Los secretos externos al volumen requieren custodia separada; no están en Git.

Segunda restauración del snapshot VPS en destino nuevo:
`/var/lib/cooper-operacion/restauracion-final-vps/datos`.
Manifiesto y `restic check --read-data`: PASS. Los servicios continuaron saludables.
Timer: **08:00 UTC (03:00 Lima), con demora aleatoria de hasta 15 minutos**.
La copia detiene temporalmente los escritores y los vuelve a iniciar.
Retención: 7 diarias, 5 semanales, 12 mensuales; preserva etiquetas de migración.

**Reversa:** detener primero todo el Compose del VPS, preservar sus escrituras
nuevas y decidir cómo conciliarlas. Solo entonces restaurar la política de
reinicio de los contenedores PC, arrancarlos y habilitar Cooper local. Conservar
callbacks anteriores hasta aceptar el VPS. No iniciar ambos orígenes a la vez
ni asumir que la PC contiene cambios posteriores al corte.

## Validaciones del VPS real

| Comprobación | Resultado |
| --- | --- |
| DNS de ambos subdominios | IPv4 exacta del VPS |
| HTTPS público | TLS 1.3, CA pública y hostname verificados, sin omitir validación |
| Certificados | Vigentes hasta 19-feb-2027; renovación automática Caddy |
| Cooper `/api/salud`, `/entrar` | 200, 200; `/` redirige con 307 |
| Google | Redirección a `accounts.google.com`, callback exacto, sin seguirla |
| Cabeceras | HSTS y `nosniff` presentes |
| n8n público | Editor, REST, API administrativa y puente interno: 404 |
| Editor privado | HTTPS por loopback 8443, respuesta válida de n8n |
| Cooper → n8n | Consulta `estado` mediante workflow original y runner: PASS |
| Runner → Cooper | HMAC válida aceptada; inválida 401; consulta sin reservar/despachar |
| HMAC por HTTPS público | PASS; mismo contrato de consulta |
| WhatsApp HTTPS | Desafío con verify token válido: PASS; inválido: 403 |
| SSE sin sesión | 401; control de acceso conservado |
| Copia/restauración/temporizador | PASS, PASS, enabled/active |
| Datos tras arrancar | 34 workflows, 9 Data Tables, 22 publicados, cero ejecuciones activas |

Evidencia: [servicios](evidencias/cooper-vps-real/servicios-validados.json),
[HTTPS/login](evidencias/cooper-vps-real/publico-validado.json),
[puente](evidencias/cooper-vps-real/puente-validado.json),
[webhooks públicos](evidencias/cooper-vps-real/webhooks-publicos.json),
[restauración](evidencias/cooper-vps-real/restauracion-final-validada.json) y
[PC detenida](evidencias/cooper-vps-real/pc-final.json).

Acceso al editor, según [la guía](../cooper-vps.md#red-dns-y-https):

```bash
ssh -i ~/.ssh/cooper_vps -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -N -L 8443:127.0.0.1:8443 operador@"$(cat ~/.config/cooper/vps-ip)"
# Resolver flujos.cooperestudio.com a 127.0.0.1 solo en la PC del operador;
# abrir https://flujos.cooperestudio.com:8443 y retirar esa resolución al terminar.
```

## Puerta obligatoria del proyecto

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
| Python despliegue, `-W error` | rc 0, 20/20 |
| Puente Codex | rc 0, 12/12, ejecutables ficticios |
| Shellcheck y comprobación de whitespace | rc 0 |
| Imagen y ensayo Compose | rc 0, siete bloques PASS |

**Puerta: cero errores y cero advertencias**, Node 24.22.3, npm 12.2.2.
[Puerta completa](evidencias/cooper-vps-real/puerta.log),
[flujos](evidencias/cooper-vps-real/flujos.log),
[pruebas operativas](evidencias/cooper-vps-real/deploy-tests.log).
El [ensayo Compose](evidencias/cooper-vps-real/compose.log) usa datos y login
ficticios: probó SSE/reconexión, firma real en runner, restauración, importación
y reversión de imagen/datos. La regresión inicial está en
[rojo](evidencias/cooper-vps-real/compose-rojo.log), seguida de prueba verde.
El código y la imagen aprobados no cambiaron durante el despliegue; el cierre
solo añade documentos y evidencias con [sumas SHA-256](evidencias/cooper-vps-real/SHA256SUMS).

## Limitaciones reales

- **OAuth/SSE autenticado:** redirección y 401 sin sesión comprobados. La sesión
  Google real, SSE autenticado y descarga autorizada de adjuntos en producción
  necesitan aceptación manual. No se fabricó una sesión administrativa ni se
  presenta el ensayo aislado como esa aceptación.
- **Chat:** `COOPER_CHAT=codex-local`, `COOPER_CHAT_API_RESPALDO=0`; sin túnel,
  muestra modo básico temporal. No hay sesiones CLI en el VPS. El loopback de
  cada contenedor es distinto del host y SSH permite solo reenvío local; un
  `ssh -R` aislado no resuelve la topología. El puente de la PC permanece intacto.
- **WhatsApp:** falta `WHATSAPP_APP_SECRET`. Desafío HTTP comprobado; faltan
  firmas Meta y configuración de proveedor/plantillas. Mensajería pausada.
- **Esperas históricas:** se conservaron dos ejecuciones `waiting`, con fecha
  3000-01-01 y enlaces de aprobación antiguos. No se reanudaron ni reinterpretaron.
- **Copias:** destino automático en el mismo VPS; falta un repositorio remoto.
  Las copias PC preservan el corte, no los cambios futuros del VPS.
- **Diagnósticos operativos:** un aviso del runner durante la parada del broker
  para copiar; avisos de HTTP/parada de Caddy y solicitudes externas canceladas.
  Cooper registró una solicitud Server Action con ID malformado, de origen no
  atribuido. Salud posterior PASS. Los registros se conservan: la puerta sin
  advertencias se refiere a las pruebas, no a un log público vacío. Los logs del
  proxy pueden incluir metadatos y permanecen privados.

## Pendientes de Walter

1. **Claude, Google OAuth:** añadir al cliente web existente el origen JavaScript
   `https://cooper.cooperestudio.com` y redirect URI exacto
   `https://cooper.cooperestudio.com/api/auth/callback/google`. Revisar dominio
   autorizado `cooperestudio.com` y cuenta permitida `wdhg.xoxa@gmail.com`.
   Mantener callbacks anteriores durante la reversa. Walter debe completar login
   y comprobar datos, SSE y adjuntos; la redirección ya pasó.
2. **Claude, Meta:** incorporar `WHATSAPP_APP_SECRET` por archivo privado y
   configurar callback `https://cooper.cooperestudio.com/api/whatsapp/webhook`,
   verify token custodiado, suscripción `messages` y override WABA correspondiente.
   Comprobar firma y usar las cinco plantillas definitivas guardadas en
   `~/.cache/cooper-vps/plantillas-whatsapp/`; sustituir el origen provisional y
   obtener aprobaciones. Mantener `COOPER_MENSAJERIA_PAUSA=1` hasta aceptar.
   Bloqueos previos de pago/autenticación: [informe de alta](cooper-whatsapp-alta.md).
   Aquí no se hicieron pagos ni envíos.
3. Revisar las dos esperas antiguas y elegir cuáles de las diez entradas pausadas
   reabrir, usando IDs/versiones del diario privado. No publicar todas a ciegas
   ni generar de nuevo los IDs de la instancia migrada.
4. Elegir repositorio remoto, custodiar contraseña restic y clave n8n offline,
   probar recuperación fuera del VPS y revisar la ventana diaria de parada.
5. Si se necesita IA del plan en el VPS, completar un túnel restringido hasta
   los puentes de la PC, probar desde los contenedores y mantener la PC encendida.
   Hasta entonces el modo básico está disponible y las APIs apagadas.

## Fuentes oficiales consultadas

- [Runners externos](https://docs.n8n.io/hosting/configuration/task-runners/) y
  [CLI n8n](https://docs.n8n.io/hosting/cli-commands/).
- [Docker Ubuntu](https://docs.docker.com/engine/install/ubuntu/),
  [almacén containerd](https://docs.docker.com/engine/storage/containerd/) y
  [HTTPS automático Caddy](https://caddyserver.com/docs/automatic-https).
- [Repositorios restic](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html)
  y [restauración](https://restic.readthedocs.io/en/stable/050_restore.html).
- [OpenSSH](https://man.openbsd.org/ssh.1), [Auth.js](https://authjs.dev/reference/core),
  [OAuth Google](https://developers.google.com/identity/protocols/oauth2/web-server)
  y [webhook Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/override).
