# cooper-total — Operación

21 de noviembre de 2026, Lima. Rama/worktree propios `total-operacion`, base `de397f3`. El orquestador coordina integración y despliegue; no hubo push ni fusión a ramas compartidas desde este frente.

## Resultado comprobado

Implementados réplica restic cifrada en la PC, verificación/restauración antes de promoverla, monitor con avisos Telegram firmados, timers y arranque protegido durante mantenimiento. Se ejecutó una copia/restauración **real** del VPS bajo turno exclusivo y se recuperó fuera del VPS. Los scripts de monitor y unidades se entregan al orquestador para instalación; este informe no los presenta como activados todavía.

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
| Copia automática solo en el VPS; PC conserva el corte | `docs/informes/cooper-vps-real.md:226`, `deploy/operar.py:205` | A: réplica y recuperación PC implementadas y probadas; activar timer en turno de instalación. |
| Sin alertas remotas de copias ni monitor host | `docs/informes/cooper-fase5.md:78` | A: monitor HMAC/Telegram y pruebas listos; publicar workflow e instalar unidades. |
| Docker enabled y cuatro `unless-stopped`; una parada explícita no se recupera sola | Inspección VPS de 10:04 Lima | A: unidad stack y protección mantenimiento implementadas; ensayar arranque en coordinación. |
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
| Cierre documental posterior | Evidencias y ESTADO; identificable con el historial de este informe. |

## Puerta obligatoria

Ejecutada completa sobre `24ca1bb`, sin cambiar aplicación después del ensayo:

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

## Limitaciones reales

- La réplica depende de la PC encendida y del gestor de usuario. No sustituye custodia offline ni un almacén ajeno a ambos equipos. La frecuencia del snapshot VPS determina el RPO, aunque la réplica corra cada hora.
- La copia no incluye `/etc/cooper/.env`, sesiones CLI, claves del host ni contraseña restic. El desastre requiere custodia separada de Walter. No se leyeron, imprimieron ni copiaron esos archivos.
- Telegram usa n8n: una caída total retrasa la entrega hasta su recuperación. El receptor se prueba sin envío y requiere la instalación del flujo por el orquestador; las pruebas locales no equivalen a recepción real en Telegram.
- No se reinició el VPS para demostrar un reboot físico; la unidad y las políticas quedan listas para comprobación coordinada. La copia sí paró/reinició el Compose real y terminó saludable.
- No hubo pagos, OAuth, videos publicados, cambios en D&S Factory ni reapertura de las diez entradas pausadas desde este frente.

## Pendientes de Walter

1. Mantener la PC disponible para la réplica y custodiar offline las claves necesarias para recuperar un VPS perdido.
2. Elegir un segundo canal independiente si necesita alertas instantáneas cuando estén caídos a la vez VPS y n8n; no se creó una cuenta ni se contrató un servicio.
3. Conservar la aceptación Google/Meta, decisiones de publicación y conciliación de esperas históricas en el informe del orquestador.
