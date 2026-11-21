# Fase 5 — preparación del VPS de Cooper

Fecha: 20-11-2026, America/Lima. Rama/worktree: `cooper-fase5`, `/home/david/Proyectos/cooper-wt/cooper-fase5`. Base: `96bc916`. Revisión de código verificada: **`88fbf0d8dd7b5c75a2be0ebdb332bdfd8c9c1966`**. El commit posterior añade este informe y sus evidencias.

**Preparado y ensayado localmente; no desplegado en vivo.** No se hizo push, merge, OAuth, pagos ni cambios en D&S Factory. No se leyeron ni transportaron `.env` reales. Los entornos del ensayo se generaron desde cero y permanecen privados en la caché ignorada. Los directorios no versionados `docs/diseno/` y `docs/misiones/` ya estaban presentes al comenzar y no se incorporaron a los commits.

## Commits

| Commit | Cambio |
| --- | --- |
| `f739f6e` | Imagen multi-stage Node 24, ejecución no root, contexto sin datos/secretos y salud de SQLite con pruebas. |
| `3579ad3` | Compose n8n/runner 2.47.4, Caddy, límites, instalación/endurecimiento y operación con copias cifradas, migración y reversión. |
| `88fbf0d` | Ensayo aislado completo, 14 pruebas de recuperación, cookies de ensayo HTTPS y guía operativa. |

## Qué se entregó

- [deploy/](../../deploy/): Cooper standalone, SQLite persistente; n8n y runner externo fijados a 2.47.4; Caddy 2.11.2 con certificados automáticos, cabeceras y SSE. Solo el proxy publica puertos; editor n8n por túnel SSH a loopback. Broker y backend privados. Healthchecks, límites CPU/RAM/PID, filesystem de solo lectura, cachés temporales, capacidades reducidas y rotación de logs.
- Copia fría coordinada de n8n, SQLite/adjuntos de Cooper y certificados/configuración Caddy. Restic cifra antes de guardar. Cada copia restaura a un temporal, compara archivos SHA-256/tamaño y conteos de todas las tablas y ejecuta `integrity_check` y `restic check --read-data`. Retención 7 diarias / 5 semanales / 12 mensuales; migraciones y reversiones protegidas.
- `instalar.sh`: preparación repetible de Ubuntu 24.04, Docker oficial, UFW más `DOCKER-USER`, SSH por llave, fail2ban, actualizaciones de seguridad y timer. No inicia aplicaciones en `--preparar`. `.env` externo, 0600, sin `source` ni evaluación de su contenido en los scripts operativos.
- `migrar-desde-pc.sh`: exportación offline cifrada e importación en volumen vacío; rechaza corrupción, enlaces y cambios durante copia. `actualizar.sh` guarda imagen y snapshot anteriores; un fallo deja los servicios detenidos. `revertir.sh` recupera imagen/datos y conserva el estado desplazado para conciliación.
- [Guía VPS](../cooper-vps.md): capacidad orientativa, DNS, HTTPS, instalación, inventario/corte de migración, backups, recuperación, operación diaria y fuentes oficiales actuales. No se modificó la interfaz visual ni el contrato del puente.

## Puerta obligatoria

Ejecutada sobre `88fbf0d`, en el orden solicitado:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
```

Desde la raíz:

```bash
node --test tests/flujos_v2.test.cjs
```

| Comprobación | Resultado final | Código |
| --- | --- | --- |
| `npm ci` | PASS, 0 vulnerabilidades | 0 |
| `npm run lint` | PASS, 0 errores y 0 advertencias | 0 |
| `npm run typecheck` | PASS | 0 |
| `npm test` | PASS, **119** pruebas, 16 archivos | 0 |
| `npm run test:e2e` | PASS, **22** escenarios Chromium, sin omisiones | 0 |
| `npm run build` | PASS, Next 16.4.6 | 0 |
| `node --test tests/flujos_v2.test.cjs` | PASS, **119/119**, sin omisiones | 0 |

Cadena completa: **0**, sin errores ni advertencias. [Puerta completa](evidencias/cooper-fase5/puerta-final.log) y [regresión de flujos](evidencias/cooper-fase5/flujos-final.log). El temporal de los tests raíz quedó en `cooper/.cache`, con bytecode Python desactivado. El primer aprovisionamiento de Chromium avisó que CachyOS usa el binario Ubuntu compatible; se completó la instalación y se repitió la puerta final íntegra, sin ese aviso. No se ocultaron mensajes ni se omitieron escenarios.

## Ensayo del despliegue

Comandos y resultados sobre la misma revisión:

| Comando | Evidencia | Resultado |
| --- | --- | --- |
| `podman build --format docker -f deploy/Containerfile -t localhost/cooper:fase5 .` | [Build de imagen](evidencias/cooper-fase5/build-imagen.log) | PASS, rc 0 |
| `node deploy/tests/compose.mjs` | [Compose completo](evidencias/cooper-fase5/compose-final.log) | PASS, rc 0 |
| `PYTHONDONTWRITEBYTECODE=1 python3 -W error -m unittest discover -s deploy/tests -p 'test_*.py'` | [Copias y fallos inducidos](evidencias/cooper-fase5/copias.log) | PASS, **14/14**, rc 0 |
| `shellcheck deploy/*.sh` y `git diff --check` | [Comprobaciones](evidencias/cooper-fase5/comprobaciones.log) | PASS, rc 0 |

El Compose completo arrancó en Podman rootless, con socket Unix exclusivo, runc, dos redes internas, puertos loopback y datos ficticios. Se comprobó:

1. Imagen sin `.env` ni scripts de prueba, usuario no root y salud de servicios. HTTPS verificó la cadena de la CA local; no se desactivó la validación TLS ni se instaló la CA en el host.
2. Editor/API administrativa/entrada privada del puente inaccesibles por el listener público; CSP y cabeceras presentes. Login ficticio mediante el emisor E2E existente, cookie Auth.js `Secure`; no ruta de login de prueba dentro de la aplicación.
3. Nodos reales de `FX · Progreso de Cooper` ejecutados en n8n con runner externo: firma HMAC, callback y progreso SSE recibido con el stream abierto y plazo de 10 segundos. Firma incorrecta rechazada. Cinco desconexiones/reconexiones no agotaron el límite SSE.
4. Backup restic y restauración completa, rechazo de contraseña incorrecta, conteos/hashes coincidentes, conservación del adjunto y etapa del video. Reinicio sano después de copiar.
5. Exportación offline, importación en otra raíz vacía y arranque de Cooper/n8n desde los datos recuperados, conservando acceso de la cuenta ficticia.
6. Actualización a una etiqueta local inmutable y reversión de imagen/datos. Se modificó la etapa después del snapshot y la reversión recuperó la etapa anterior, dejando archivado el estado desplazado.

Las 14 pruebas adicionales cubren corrupción de archivos, filas perdidas, SQLite WAL, cambios durante la copia, enlaces fuera del volumen, permisos de secretos, ausencia de evaluación de shell, destinos ocupados, volúmenes Caddy ausentes en PC, recuperación tras fallo y cierre seguro de una actualización fallida.

Se corrigieron los fallos encontrados: herramientas nativas de construcción para SQLite, carpeta `public` opcional, HEALTHCHECK preservado en formato Docker, caché escribible de n8n, configuración del launcher JavaScript, defaults de n8n explícitos y serialización del entorno de ensayo. El fallo de `exec`/`oom_score_adj` con crun se resolvió seleccionando runc **solo para el socket del ensayo**. No se cambiaron permisos ni runtime globales.

Versiones, IDs y digests de imágenes: [entorno.json](evidencias/cooper-fase5/entorno.json). Huellas de evidencias: [SHA256SUMS](evidencias/cooper-fase5/SHA256SUMS.txt). Los logs internos completos y datos/secretos ficticios de los contenedores permanecen fuera de Git.

## Limitaciones reales

- **NOT_RUN en Ubuntu/VPS real:** el host disponible es CachyOS amd64. No se ejecutaron instalador root, firewall, SSH, fail2ban, unattended-upgrades ni timer en ese host o en un VPS. ShellCheck pasó; la instalación debe ensayarse en un Ubuntu 24.04 limpio antes del corte. La repetibilidad del instalador está implementada, no certificada por dos instalaciones reales.
- HTTPS público/ACME, DNS, OAuth Google y destino SFTP remoto siguen sin ensayo con credenciales. El repositorio restic del ensayo es local y cifrado. No hay alerta remota de fallos de copia; se deja el fallo en systemd y estado operativo.
- El ensayo del puente usa los nodos reales de **progreso firmado**, con cuentas y datos ficticios. No prueba proveedores audiovisuales, WhatsApp, publicación ni toda la fábrica contra cuentas reales. La actualización ensayada usa la misma imagen con otra etiqueta para comprobar el ciclo; una nueva versión con cambios de esquema requiere su ensayo específico.
- Migración completa SQLite, misma versión n8n; no convierte PostgreSQL ni resuelve dueños/esperas antiguas. Exige origen detenido, clave original n8n y una única instancia activa. Una restauración de disco no revierte efectos externos ni impide por sí sola repetir una orden antigua.
- Copia fría con breve indisponibilidad y espacio temporal; hay que medir duración en VPS y conciliar ejecuciones que no terminen durante el cierre. RPO orientativo 24 horas solo con copias exitosas; RTO aún no medido allí. Una instancia Cooper, sin alta disponibilidad ni coordinación entre réplicas.
- Las imágenes se fijan por versión y se registraron sus digests. Futuras actualizaciones de n8n/runner/Caddy/configuración requieren revisión propia; `actualizar.sh` cambia solamente Cooper. arm64 y acceso IPv6 no se ensayaron.

## Pendientes de Walter

1. Elegir VPS/región y dominio; punto de partida: 4 vCPU, 8 GB RAM, 100 GB SSD. Aprobar ventana de mantenimiento y responsables de recuperación.
2. Provisionar usuario SSH, DNS, credenciales Google y valores de entorno por canal privado. Conservar la clave de cifrado original n8n; nunca enviarla a Git ni a este informe.
3. Elegir y provisionar copia remota separada del VPS, custodiar contraseña/llave SSH offline y definir aviso de fallos, retención legal y eliminación de copias protegidas.
4. Revisar e instalar primero en Ubuntu de ensayo. Inventariar origen, versiones, esperas/cron, URLs y operaciones externas; drenar antes de exportar y no arrancar ambas instancias simultáneamente.
5. Tras revisión independiente, realizar corte, validación por dueño, OAuth/ACME y recuperación en el VPS. Autorizar por separado los servicios pagos y publicaciones; quedan fuera de este ensayo.

Propuesta de revisión: límites de exposición de Caddy/Docker, orden de parada, preservación de claves n8n y retención de snapshots de reversión. Los commits quedan disponibles para revisión independiente, sin integración.
