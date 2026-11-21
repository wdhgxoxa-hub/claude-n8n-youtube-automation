# cooper-total — Operación

21 de noviembre de 2026, Lima. Rama/worktree propios `total-operacion`, base `de397f3`. El orquestador coordina integración y despliegue; no hubo push ni fusión a ramas compartidas desde este frente.

## Resultado comprobado

Implementados réplica restic cifrada en la PC, verificación/restauración antes de promoverla, monitor con avisos Telegram firmados, timers y arranque protegido durante mantenimiento. Se ejecutó una copia/restauración **real** del VPS bajo turno exclusivo y se recuperó fuera del VPS. El orquestador instaló las unidades y el receptor. En el cierre de las 11:08 Lima se comprobaron activos, se desplegó la corrección del monitor y se ensayó un reinicio real, sin modificar workflows.

- Réplica gratuita: `~/.local/share/cooper-copias-vps/actual`, dos generaciones verificadas y temporales privados. La copia vigente solo cambia tras `restic check --read-data`, restauración, hashes, tamaños, conteos y `integrity_check`. La contraseña existente se pasa por ruta al binario; no se leyó ni mostró su valor.
- Primer snapshot recuperado fuera del VPS: `a7a1ee642b140b179d182e48dfbc756f2d84c85f6680b3205d37ed6cdec97e43`. Después del nuevo respaldo se volvió a replicar y verificar `04cd7f6f06672e24e34d7c8baa64139a2870e61cf2504d6217f1f533a6d1112c`.
- Respaldo previo a la intervención del orquestador: **25 archivos, dos bases, 209 tablas en total**. Cooper conserva ocho migraciones; n8n 34 workflows. Export JSON privado, 901.028 bytes, SHA-256 `9cad2297f872b4f0298867586dfdd1a3543e228f6b747f92c1e2ac0ceb64f5d3`. No se exportaron credenciales.
- Copia VPS y restauración finalizaron con los cuatro servicios saludables. El export inicial falló sin efectos; al repetir la CLI terminó en rc 0. `docker cp` no pudo ver el archivo generado en tmpfs aunque `docker exec stat` sí: se trasladó por stdout **directamente a un archivo privado**, sin mostrar contenido. No se modificó ningún workflow.
- Monitor: salud Docker/HTTPS/disco/copias, mensajes cerrados sin datos privados, deduplicación y recuperación, reintentos al fallar el transporte. `--prueba` valida firma y transporte sin Telegram. El workflow reutiliza la credencial Telegram por referencia y permanece inactivo al generarlo.
- Arranque: Compose usa el overlay del chat solo con su marcador habilitado. Copias paran los relés antes de los contenedores. Actualización/reversa dejan mantenimiento activo ante fallo; la unidad de arranque no reabre esa instalación durante un reinicio.

[Guía de instalación y recuperación](../cooper-operacion.md), [auditoría VPS](evidencias/total-operacion/vps-auditoria.json), [respaldo real](evidencias/total-operacion/vps-respaldo.json) y [réplica real](evidencias/total-operacion/replica-real.json).

## Auditoría A/B entregada al orquestador

| Hallazgo inicial | Evidencia | Clase y resultado |
| --- | --- | --- |
| Copia automática solo en el VPS; PC conserva el corte | `docs/informes/cooper-vps-real.md:226`, `deploy/operar.py:205` | A cerrada: réplica/restauración real y timer PC habilitado, activo y ejecutado tras el reinicio. |
| Sin alertas remotas de copias ni monitor host | `docs/informes/cooper-fase5.md:78` | A cerrada: receptor instalado por orquestador, monitor activo, prueba firmada y envío Telegram con respuesta satisfactoria. |
| Docker enabled y cuatro `unless-stopped`; una parada explícita no se recupera sola | Inspección VPS de 10:04 Lima | A cerrada: unidad habilitada y arranque automático real de siete contenedores comprobado. |
| Caída simultánea de n8n/VPS impide enviar Telegram por ese mismo n8n | Diseño existente; monitor usa webhook interno | B: canal de alerta independiente si se requiere aviso durante caída total. Se conserva/reintenta y avisa recuperación. |
| Clave API n8n anterior pendiente de revocación | `docs/informes/cooper-consolidar.md:122` | A si el responsable identifica por metadata y comprueba uso; en otro caso B. Comunicado al orquestador, fuera de operación de copia. |
| Corrección calendario 48h no aplicada en misión antigua | `docs/informes/cooper-consolidar.md:85` | A: incluir en lote n8n de este orquestador. |
| Sesión Google, Meta, dos esperas históricas, medios pagos | `docs/informes/cooper-vps-real.md:235`, `cooper-vivo-final.md` | B: no realizar logins, pagos ni reanudar aprobaciones por inferencia. |

También se revisaron especificación, entrega, README, ESTADO, guías de diseño y los informes `cooper-vps-real`, `cooper-fase5`, `cooper-integracion3`, `cooper-consolidar`, `cooper-final`, `cooper-integracion`, `cooper-vivo`, `cooper-vivo-final` y `fase2-puente-n8n`. Los pendientes históricos ya resueltos por informes posteriores no se volvieron a tratar como bloqueos nuevos.

## Commits

| Commit | Cambio |
| --- | --- |
| `2aaeb9a` | Mantenimiento seguro, overlay chat, parada de relés y unidad stack. |
| `033da1f` | Réplica verificada, monitor, workflow firmado, timers, pruebas y recuperación. |
| `24ca1bb` | Selección de snapshot por instante correcto con zonas horarias distintas. |
| `3a0bcd2` | Primer cierre documental, evidencias y ESTADO. |
| `c18106f` | Alertas TLS antes del vencimiento y reintentos persistentes de recuperación. |
| Cierre documental posterior | Instalación, reinicio real, nueva puerta y ESTADO; identificable en el historial. |

## Puerta inicial

Ejecutada completa sobre `24ca1bb`; esta es la puerta histórica del primer cierre:

| Paso | Resultado |
| --- | --- |
| `cd cooper && npm ci` | rc 0; cero vulnerabilidades |
| `npm run lint` | rc 0; cero errores/advertencias |
| `npm run typecheck` | rc 0 |
| `npm test` | 284/284, 30 archivos, rc 0 |
| `npm run test:e2e` | 43/43, incluido Sentinel, sin omisiones/reintentos, rc 0 |
| `npm run build` | rc 0 |
| Desde raíz: `node --test tests/flujos_v2.test.cjs` | 147/147, rc 0 |

**Cero errores y cero advertencias en los siete pasos.** [Tiempos y resultados](evidencias/total-operacion/puerta/resultado.json); logs completos normalizados únicamente en saltos de línea y espacios finales en esa carpeta. El ensayo usa usuarios, medios y credenciales ficticias, puertos aislados y Chromium local.

Pruebas de operación: **36/36**, Python con `-W error`, sin advertencias. Cubren corrupción, pérdidas de filas, permisos, WAL, fallos de copia, reversa, chat, HMAC Python→JavaScript real, replay, esquema, deduplicación, mantenimiento, aviso de recuperación y conservación de réplica anterior. ShellCheck y `git diff --check`: rc 0.

La primera puerta encontró únicamente la caché Chromium ausente de Sentinel Python (`chromium_headless_shell-1243`): 42/43 E2E pasaron; los tres módulos Sentinel no pudieron iniciar. Se reutilizó la caché compatible ya instalada de integración 3 y se repitió toda la puerta. No se desactivó ningún guardián ni se relajaron controles.

## Cierre operativo real — 21-11-2026, 11:08 Lima

- **Copia fuera del VPS sin coste:** timer de usuario `cooper-replica-pc.timer` habilitado/activo. Ejecución 11:07:16–11:07:35 Lima, `Result=success`, rc 0; gestor de usuario con `Linger=yes`. [Unidades PC](evidencias/total-operacion/cierre/timer-pc.json). Snapshot `3cb43d0799ef7a18f8c9f224462d39ab7788c21d1a210986f0c857eb13037ca5`, 25 archivos y dos bases restauradas/verificadas antes de promover la generación. [Recibo](evidencias/total-operacion/cierre/replica-restaurada.json). El snapshot conserva la fecha original; la réplica no se presenta como un nuevo respaldo del VPS.
- **Monitor instalado:** se comparó la huella del script remoto con la versión de esta rama antes de sustituirlo; copia anterior protegida conservada para reversa. `c18106f` añade vencimiento TLS ≤14 días para ambos dominios, con CA/hostname/SNI, y conserva el aviso de recuperación ante fallos consecutivos del transporte. Usa el código ya aceptado por el receptor (`servicio_caddy`), sin cambiar flujos. Prueba firmada y aviso operativo finalizaron en rc 0 y `entrega: true` antes del reboot; la prueba firmada volvió a pasar después.
- **Reinicio real:** log de coordinación sin operación n8n en curso, candado exclusivo obtenido, sin mantenimiento ni ejecuciones activas. Se registró el estado, se ejecutó `systemctl reboot` y se observó el cierre de SSH. El `boot_id` cambió de `63b51263-6972-4aac-a73b-265bc3d5e307` a `09888ee0-8210-490d-9df5-c3895ef2f2ef`. Docker inició a las 11:06:40 y `cooper-stack` terminó a las 11:07:25 Lima. No se arrancó manualmente ningún contenedor.
- **Arranque confirmado:** Cooper, n8n, runner, Caddy y tres relés saludables; `cooper-stack` `active/exited`, rc 0. Docker, stack, monitor y backup habilitados; timers activos. Metadatos `id/active/versionId` de los **36 workflows idénticos antes/después**. SQLite íntegro y dos esperas históricas conservadas. [Antes](evidencias/total-operacion/cierre/antes-reinicio.json), [coordinación](evidencias/total-operacion/cierre/coordinacion.json), [muestra durante arranque](evidencias/total-operacion/cierre/arranque-en-progreso.json) y [confirmación](evidencias/total-operacion/cierre/arranque-confirmado.json).
- **HTTPS y acceso:** salud/entrada 200, estado/operación anónimos 401. Certificados de Cooper y Flujos verificados, vencimiento 19-02-2027 y unos 89 días restantes. El monitor final devuelve `salud: PASS`, sin problemas, `entrega: true`. Su primera ejecución automática posterior al reboot, a las 11:09:30 Lima, también terminó rc 0/PASS. [Timer del VPS](evidencias/total-operacion/cierre/timer-vps.log).
- **Alcance e integración:** el código anterior ya fue recogido por `cooper-total`. La corrección `c18106f` está desplegada en el host y ya fue recogida por el orquestador en `cooper-total` como `cf0fe8c`; se comprobó que la fuente integrada y la desplegada tienen SHA-256 `83c9a61efb1e4954bfd7413a531cf4778d0697fbdf2e4c3ccd3c5c34895cdc06`. Esta rama no hizo push, merge, OAuth, pagos, publicaciones ni cambios de workflows.

## Puerta final repetida sobre `c18106f`

21-11-2026, cierre en Lima. Se ejecutaron de nuevo los siete pasos completos y en orden, deteniendo la cadena ante cualquier fallo. Resultado final: **cero errores y cero advertencias**.

| Paso | Resultado final |
| --- | --- |
| `cd cooper && npm ci` | rc 0, cero vulnerabilidades |
| `npm run lint` | rc 0, cero errores/advertencias |
| `npm run typecheck` | rc 0 |
| `npm test` | 284/284, rc 0 |
| `npm run test:e2e` | 43/43, sin omisiones ni reintentos, rc 0 |
| `npm run build` | rc 0 |
| Raíz: `node --test tests/flujos_v2.test.cjs` | 147/147, rc 0 |
| Operación Python con `-W error` | 39/39, rc 0 |
| ShellCheck y `git diff --check` | rc 0 |

[Tiempos, comandos y diagnóstico final](evidencias/total-operacion/cierre/puerta-final.json). Logs completos `01-ci.log` a `07-flujos.log` en la misma carpeta. [Pruebas operativas](evidencias/total-operacion/cierre/operacion.log), con regresión del aviso perdido y certificados inválidos, ausentes o próximos a vencer. El código de ejecución no cambió durante la puerta; el commit de cierre contiene únicamente documentos y evidencia.

La primera ejecución de esta ampliación dio **42/43 E2E**: la prueba de fluidez midió 53,46 FPS frente al mínimo de 55 durante carga concurrente de otras misiones. Se conservan [fallo](evidencias/total-operacion/cierre/e2e-previa.log) y [resultados previos](evidencias/total-operacion/cierre/puerta-previa.json). Tras bajar la carga se repitió toda la puerta, sin alterar código, umbrales ni exclusiones. La segunda medición dio **60 FPS en CPU 1× y 4×**, CLS 0, p95 16,7/16,8 ms; [medición](evidencias/total-operacion/cierre/fluidez-final.json). Es evidencia de laboratorio, no garantía de rendimiento en teléfonos. La presión compartida es la explicación compatible con la repetición, no una causa aislada experimentalmente.

## Limitaciones reales

- La réplica depende de la PC encendida y del gestor de usuario. No sustituye custodia offline ni un almacén ajeno a ambos equipos. La frecuencia del snapshot VPS determina el RPO, aunque la réplica corra cada hora.
- La copia no incluye `/etc/cooper/.env`, sesiones CLI, claves del host ni contraseña restic. El desastre requiere custodia separada de Walter. No se leyeron, imprimieron ni copiaron esos archivos.
- Telegram usa n8n: una caída total retrasa la entrega hasta su recuperación. El receptor ya está instalado y el envío operativo respondió satisfactoriamente; no se comprobó la lectura humana del mensaje en Telegram.
- El reinicio real se comprobó en la ventana sin lote n8n activo y bajo candado exclusivo. La primera muestra aún observó n8n iniciándose; la muestra final confirmó siete contenedores saludables sin arranque manual. No equivale a ensayar una pérdida completa del proveedor o de ambos discos.
- No hubo pagos, OAuth, videos publicados, cambios en D&S Factory ni reapertura de las diez entradas pausadas desde este frente.

## Pendientes de Walter

1. Mantener la PC disponible para la réplica y custodiar offline las claves necesarias para recuperar un VPS perdido.
2. Elegir un segundo canal independiente si necesita alertas instantáneas cuando estén caídos a la vez VPS y n8n; no se creó una cuenta ni se contrató un servicio.
3. Conservar la aceptación Google/Meta, decisiones de publicación y conciliación de esperas históricas en el informe del orquestador.
