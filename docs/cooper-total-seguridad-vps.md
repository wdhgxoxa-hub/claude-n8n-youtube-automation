# Seguridad del VPS: aplicación y reversa para el orquestador

Propuesta de `total-seguridad`, 21-11-2026 (Lima). **No ejecutada en el VPS.**
La inspección fue de solo lectura. Coordinar con `cooper-total` y los frentes
de despliegue/chat: no reemplazar sus configuraciones completas ni reiniciar
servicios durante otra operación. Evidencia y límites en el
[informe](informes/total-seguridad.md).

## 1. Cerrar el puente interno en Caddy

Prioridad alta de corrección del perímetro. El Caddyfile anterior mezclaba
`respond @puente 404` con `handle @webhooks`: Caddy ordena `handle` primero,
por lo que `/webhook/cooper/v1` alcanzaba n8n. Un GET 404 no probaba el bloqueo.
El token del puente sigue siendo obligatorio; no se demostró acceso autenticado
ni ejecución sin autorización. La [ordenación oficial](https://caddyserver.com/docs/caddyfile/directives#directive-order)
explica la causa. El parche de `deploy/Caddyfile` usa un `handle @puente`
anterior al de webhooks, sin cambiar sus destinos ni permitir métodos nuevos.

Regresión local, sin red y con Caddy 2.11.2:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -W error -m unittest deploy.tests.test_caddy_seguridad -v
```

Antes de aplicar, comprobar que `/opt/cooper/deploy/Caddyfile` es el montaje
activo y que no hay recarga concurrente. En el VPS, desde una sesión del
orquestador, este bloque respalda únicamente el Caddyfile, reemplaza una regla
exacta y conserva el inode del archivo montado. No accede al entorno privado.

```bash
set -euo pipefail
cooper_respaldo=$(sudo mktemp -d /var/backups/cooper-seguridad-proxy.XXXXXXXX)
sudo cp -a /opt/cooper/deploy/Caddyfile "$cooper_respaldo/Caddyfile"
cooper_revertir_proxy() {
  sudo sh -c 'cat "$1" > /opt/cooper/deploy/Caddyfile' sh "$cooper_respaldo/Caddyfile"
  sudo docker exec cooper-caddy-1 caddy validate --config /etc/caddy/Caddyfile
  sudo docker exec cooper-caddy-1 caddy reload --config /etc/caddy/Caddyfile
}
trap cooper_revertir_proxy ERR
sudo python3 - <<'PY'
from pathlib import Path
p = Path('/opt/cooper/deploy/Caddyfile')
s = p.read_text()
old = '\trespond @puente 404\n'
new = '\thandle @puente {\n\t\trespond 404\n\t}\n'
if s.count(old) != 1:
    raise SystemExit('Configuración distinta: reconciliar el parche, no sobrescribirla')
p.write_text(s.replace(old, new))
PY
sudo docker exec cooper-caddy-1 caddy validate --config /etc/caddy/Caddyfile
sudo docker exec cooper-caddy-1 caddy reload --config /etc/caddy/Caddyfile
curl --fail --silent --show-error --output /dev/null https://cooper.cooperestudio.com/entrar
trap - ERR
printf 'Respaldo del proxy: %s\n' "$cooper_respaldo"
```

Comprobar desde fuera **GET y POST** al puente: ambos deben ser 404 con cuerpo
vacío de Caddy, sin llegar al backend. Usar un POST vacío y sin credenciales;
no enviar una orden válida. Conservar webhooks autorizados, el editor por túnel
8443 y el SSE de Cooper. Si falla una comprobación, ejecutar
`cooper_revertir_proxy` en esa misma sesión; en otra, recuperar la ruta de
respaldo impresa y definirla antes de usar la función. El rollback vuelve al
perímetro anterior con su limitación conocida; no es el cierre del hallazgo.

## 2. Actualizar n8n y su runner en una ventana controlada

La inspección encontró n8n/runner **2.47.4**. Cuatro avisos del 13-11-2026
incluyen esa versión; la corrección en su rama es **2.47.6**:

| Aviso oficial | Impacto / condición |
| --- | --- |
| [GHSA-q8rc-7m84-mfvj](https://github.com/n8n-io/n8n/security/advisories/GHSA-q8rc-7m84-mfvj) | Alto: control de la cuenta propietaria mediante un rol personalizado con gestión de usuarios. No se verificó que esa función esté habilitada en este VPS. |
| [GHSA-c772-hjfp-gfc2](https://github.com/n8n-io/n8n/security/advisories/GHSA-c772-hjfp-gfc2) | Moderado: parámetros no confiables cambian rutas de peticiones autenticadas en nodos de integración. |
| [GHSA-g333-hr44-g82p](https://github.com/n8n-io/n8n/security/advisories/GHSA-g333-hr44-g82p) | Moderado: protección SSRF omitida en endpoints personalizados de Bedrock. |
| [GHSA-h59h-rf6m-7jp5](https://github.com/n8n-io/n8n/security/advisories/GHSA-h59h-rf6m-7jp5) | Moderado: activación de triggers con credenciales que el publicador no puede usar. |

La [versión 2.47.6](https://github.com/n8n-io/n8n/releases/tag/n8n%402.47.6)
está publicada. Se recomienda como mínimo de esta rama, no como certificación
de todas las dependencias. Resolver y registrar los digests de **ambas** imágenes
antes del corte; no usar `latest`. No se cambió la versión de Compose en esta
misión: el ensayo integrado de migraciones/runner corresponde al orquestador.

1. Ensayar primero la pareja nueva con datos ficticios, usando el banco existente
   `deploy/tests/compose.mjs`, las pruebas del puente y el lote del orquestador.
   Resolver cualquier cambio en los túneles, runner o migraciones antes del corte.
   No introducir datos de producción en una imagen no verificada.
2. Registrar las referencias/digests anteriores y respaldar `compose.yaml` y el
   Caddyfile. Conservar las imágenes anteriores. Evitar cambios simultáneos del
   lote de workflows y de la versión del motor: aceptar cada paso por separado.
3. Pausar las entradas automáticas según el diario del orquestador, drenar las
   ejecuciones y cerrar el ingreso. Desde `/opt/cooper`, en esta secuencia:

   ```bash
   sudo python3 deploy/operar.py compose stop caddy
   sudo python3 deploy/operar.py compose stop n8n
   sudo python3 deploy/operar.py compose stop runner cooper
   sudo deploy/copiar.sh
   ```

   El wrapper existente crea un snapshot frío, verifica restauración y no
   reanuda servicios que ya estaban detenidos. Guardar el ID explícito mostrado.
   Si el frente de despliegue cambió el wrapper, revisar su contrato antes.
4. Cambiar únicamente las imágenes n8n/runner en el Compose integrado por los
   digests comprobados de la pareja nueva. El comando `actualizar.sh` actualiza
   **Cooper**, no es una actualización del motor n8n. Validar sin mostrar entorno:

   ```bash
   sudo python3 deploy/operar.py validar
   sudo python3 deploy/operar.py compose up -d --no-build --wait --wait-timeout 180 cooper n8n runner
   ```

5. Con ingreso aún cerrado, comprobar salud, migraciones, conteos, runner y
   consulta de estado por el puente; sin órdenes de producción. Solo después
   arrancar Caddy con el wrapper y reabrir las entradas previamente autorizadas.
   No reactivar las pausadas históricas como efecto de actualizar.

**Rollback n8n:** detener Caddy, drenar/detener n8n y después runner/Cooper.
Preservar las bases posteriores y los recibos del lote. Restaurar el snapshot
previo en un directorio **nuevo** con `operar.py restaurar-prueba ID DESTINO`;
no imprimir filas ni secretos. Verificar conteos/integridad con el procedimiento
existente de [migración](cooper-vps.md). Si hubo migraciones, volver a la pareja
de imágenes anterior **y a los datos previos conciliados**, no arrancar una
imagen vieja sobre una base migrada. Conservar los directorios desplazados;
no usar `down -v`. Reabrir el ingreso únicamente tras comprobar el conjunto.
El `revertir.sh` actual gestiona la imagen de Cooper; no sustituye esta reversa
de n8n. `2.47.4` conserva los avisos descritos si se vuelve a ella.

## 3. Renovar la imagen de Caddy

La imagen observada 2.11.2 también es anterior a parches:
[cabeceras en upgrades 101](https://github.com/caddyserver/caddy/security/advisories/GHSA-8qx7-j2v2-x6q5)
y [forward_auth](https://github.com/caddyserver/caddy/security/advisories/GHSA-6365-7ppr-5r92)
se corrigen en 2.11.5; [handlers](https://github.com/caddyserver/caddy/security/advisories/GHSA-j8px-rmrx-76h9)
en 2.11.4 y [root por host](https://github.com/caddyserver/caddy/security/advisories/GHSA-r766-rf9f-588h)
en 2.11.8. El Caddyfile revisado no usa `file_server`, raíz por host,
`forward_auth`, rewrite con consulta vacía ni captura del cuerpo; no se declara
explotabilidad de esos casos. El de upgrades depende de las cabeceras del upstream.

Propuesta: resolver una imagen **2.11.8 o posterior compatible por digest** y
ensayar TLS, SSE, webhooks, editor por SSH y el bloqueo de S04. Conservar digest
anterior, copia de configuración y snapshot existente de los volúmenes Caddy.
Después del ensayo, cambiar solo la imagen de Caddy del Compose integrado y usar
`sudo python3 deploy/operar.py compose up -d --no-deps --no-build --wait caddy`.
No eliminar volúmenes ni emitir certificados manualmente.

Reversa: restaurar la referencia de imagen previa y recrear solo Caddy con ese
mismo comando, preservando volúmenes. Mantener el parche de S04, compatible con
2.11.2 y probado aquí. Si la imagen nueva modifica almacenamiento incompatible,
restaurar su snapshot en un destino nuevo y conciliar antes de cambiar el montaje;
no volver a una copia antigua sobre escrituras concurrentes. La reversa de imagen
recupera disponibilidad pero reabre los avisos de versión.

## 4. Ajustes SSH opcionales y firewall

La base observada ya es correcta: sin root/contraseñas, UFW activo, 22/80/443,
8443 solo loopback y cadena Docker IPv4/IPv6 con DROP final. No vaciar ni
recrear el firewall. La PC comprobó conectividad externa IPv4; falta una sonda
externa IPv6. `PermitOpen any` con reenvío local permite al operador usar varios
destinos; decidir la lista final **después** del frente chat/túneles.

Si se desea reducir la ventana de intentos SSH, mantener la sesión actual y
probar una segunda antes de confirmar. El siguiente ajuste es opcional y
no cambia los reenvíos. No ejecutarlo mientras otra misión ajusta SSH.

```bash
set -euo pipefail
sudo test ! -e /etc/ssh/sshd_config.d/00-00-cooper-seguridad.conf
sudo systemd-run --unit=cooper-seguridad-ssh-reversa --on-active=5m \
  /bin/sh -c 'rm -f /etc/ssh/sshd_config.d/00-00-cooper-seguridad.conf; /usr/sbin/sshd -t && systemctl reload ssh'
sudo tee /etc/ssh/sshd_config.d/00-00-cooper-seguridad.conf >/dev/null <<'SSH'
LoginGraceTime 30
MaxAuthTries 3
MaxSessions 5
AllowAgentForwarding no
SSH
sudo /usr/sbin/sshd -t
sudo systemctl reload ssh
```

Validar la configuración efectiva con `sshd -T`, abrir una segunda sesión
`operador` con la llave dedicada y comprobar el túnel del editor y los del chat.
Solo tras esas comprobaciones, cancelar el timer:
`sudo systemctl stop cooper-seguridad-ssh-reversa.timer`.
Si el ajuste impide entrar, el timer lo retira a los cinco minutos; también se
puede ejecutar manualmente su comando desde la sesión conservada. No cerrar
esa sesión antes de comprobar el resultado. [OpenSSH](https://man.openbsd.org/sshd_config)
y [temporizadores transitorios](https://www.freedesktop.org/software/systemd/man/latest/systemd-run.html).

## 5. Cobertura pendiente de operación

- Escanear las imágenes por digest con Trivy o equivalente en el entorno de
  revisión, sin montar datos privados; por ejemplo `trivy image --scanners vuln
  --format json --output reporte.json IMAGEN@sha256:DIGEST`. Usar solo el escáner
  de vulnerabilidades, no extracción de secretos. [Contrato oficial](https://trivy.dev/docs/latest/target/container_image/).
- Mantener vigilancia de avisos n8n, Caddy, Node, Auth.js y Ubuntu; `npm audit`
  de Cooper no analiza las capas del SO ni los otros contenedores.
- Revisar necesidad de límite por IP en el perímetro para OAuth/webhooks; no
  confiar en un `X-Forwarded-For` enviado directamente por Internet. Los límites
  actuales de Cooper son por proceso, adecuados solo a la instancia pequeña.
- Decisiones de Walter: ventana de actualización/aceptación, IP o VPN estable
  si se restringe SSH, política de destinos de túneles, copias fuera del VPS.
