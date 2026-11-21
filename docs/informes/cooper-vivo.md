# Cooper ↔ n8n: paso a vivo detenido tras el respaldo

20 de noviembre de 2026, America/Lima. Worktree `/home/david/Proyectos/cooper-wt/cooper-ensayo`, rama `cooper-ensayo`, base `96bc916`.

## Resultado: FALTA_API_KEY

Walter autorizó el paso a vivo y confirmó **wdhg.xoxa@gmail.com**, con punto. No se encontró una API key de n8n disponible en el entorno del proceso ni en los archivos `.env*` de los repositorios revisados. Los nombres de las variables del contenedor tampoco contienen una API key. No se creó ni se recuperó ninguna desde la base de n8n. Se cumplió la instrucción específica: **respaldar, verificar y detener el paso a vivo**.

La búsqueda revisó `/home/david/Proyectos/claude-n8n-youtube-automation` y los worktrees de `/home/david/Proyectos/cooper-wt`, incluyendo archivos ignorados de configuración. El único `.env*` real encontrado fue `cooper-integracion/cooper/.env.local`: contiene nombres de configuración de Google/Auth.js y del administrador, sin variable de API key n8n. No se imprimieron sus valores ni se copió ese archivo. Se excluyeron dependencias, Git y artefactos compilados de la búsqueda. El registro privado es `busqueda-api-key.json`, dentro del respaldo.

**No se ejecutaron** la migración REST, importación/publicación de workflows, configuración del puente, arranque de Cooper ni instalación de `cooper.service`. No se pausaron cron, no se reinició n8n ni se alteraron los formularios pendientes. No hubo solicitudes al puente vivo, OAuth, pagos, videos nuevos, publicaciones ni intervención en D&S Factory. Los proveedores conservan su configuración anterior.

## Respaldo y verificación

Ubicación definitiva, privada y fuera de Git:

```text
/home/david/.cache/cooper-vivo/respaldo-20261120-193926-0500/
```

Directorio y subdirectorios **0700**, archivos **0600**. Contenedor origen `videos-n8n`, imagen `ghcr.io/n8n-io/n8n:2.47.4`, volumen `videos_n8n_data`. URL prevista para una continuación: `https://joining-jeeringly-primp.ngrok-free.dev`.

| Contenido | Evidencia privada |
| --- | --- |
| Copia del volumen completo, configuración opaca y SQLite consistente | `volumen/` |
| 27 workflows con IDs y grafos, exportados por n8n 2.47.4 | `workflows.json` |
| 66 versiones históricas y versiones publicadas | `versiones-workflows.json`, `versiones-publicadas.json` |
| Estado de activación de los 27 workflows, 25 activos | `activaciones.json` |
| 9 Data Tables, columnas, esquema físico y 117 filas | `data-tables.json` |
| Inventario de ejecuciones pendientes | `ejecuciones-pendientes.json` |
| Conteos de las 187 tablas SQLite | `conteos-sqlite.json` |
| Copia independiente utilizada para restauración y exportación sin red | `restauracion-aislada/` |
| Lectura completa, hashes y resumen | `SHA256SUMS`, `resumen.json` |

Se usó la API de respaldo en línea de SQLite, con conexión origen de solo lectura, para consolidar el WAL en una instantánea consistente. No se copiaron `database.sqlite-wal`/`database.sqlite-shm` como si fueran una instantánea independiente. Los demás archivos del volumen se copiaron de forma opaca, sin descifrar credenciales. Los logs corresponden al intervalo de copia; no se afirma atomicidad transaccional de los archivos de log.

La copia y su restauración independiente pasaron `PRAGMA integrity_check`; el respaldo pasó además `PRAGMA foreign_key_check`, sin errores. Se recorrieron todas las filas y columnas de las 187 tablas restauradas sin mostrar contenido. Se leyeron por completo y comprobaron dos veces los hashes de **30 archivos**. Un contenedor efímero con `--network none`, sin puertos ni servidor n8n, ejecutó `export:workflow --all` sobre la restauración: **rc 0**, 27 IDs, grafos, versiones y activaciones coincidentes con la instantánea. No se ejecutaron workflows en la copia.

Se inventariaron dos ejecuciones en espera: **400 y 540**, ambas de `FabAprobacion001`. La comprobación posterior mantiene ambas en `waiting`, con los 27 IDs/versiones/activaciones sin cambios y `videos-n8n` en ejecución desde el 19 de noviembre. Las cuatro filas de `publicaciones` están respaldadas; no se consultó ni alteró la programación remota de Upload-Post. Ver [resumen sin secretos](evidencias/cooper-vivo/respaldo-resumen.json) y [estado posterior](evidencias/cooper-vivo/estado-vivo-final.json).

No se encontraron bases SQLite en `cooper-integracion/cooper/data` ni en `~/.local/share/cooper`; `cooper-sqlite.json` registra el inventario vacío. No se creó una base de producción por el bloqueo. La restauración se comprobó mediante SQLite y la CLI, **sin arrancar el servidor** ni validar acceso OAuth o descifrado de credenciales.

Incidencias corregidas durante el respaldo: la lectura inicial de `config` encontró permisos de UID rootless; se repitió con `podman unshare`, sin sudo ni cambios de permisos del origen. La primera exportación aislada apuntó al directorio predeterminado de root y no encontró workflows; se corrigió con `N8N_USER_FOLDER=/home/node`. Ambos intentos fallidos se limitaron a copias/contenedores efímeros. El directorio `respaldo-20261120-193918-0500` es **incompleto** y no debe usarse para restaurar. El script local reproducible queda en `~/.cache/cooper-vivo/respaldar.py`.

## Cambios y commits

| Commit | Cambio |
| --- | --- |
| `e4d8d69` | Corregir el administrador predeterminado de la CLI, el ejecutor de ensayo y las guías; añadir regresión HTTP local del correo exacto. |
| Commit de este informe | Registrar el bloqueo, respaldo, evidencias y procedimiento de continuación/reversa. |

La regresión ejecuta la CLI sin `--admin`, con API ficticia en loopback y credencial ficticia. Exige `wdhg.xoxa@gmail.com` en las tres filas planificadas y comprueba que la simulación solo hace GET. Antes del arreglo falló; después pasan **8/8** pruebas de migración. Se conservan [rojo](evidencias/cooper-vivo/correo-rojo.log) y [verde](evidencias/cooper-vivo/correo-verde.log). El informe de ensayo distingue el correo usado históricamente del correo corregido; sus evidencias anteriores permanecen intactas.

No hay referencias al correo administrativo incorrecto en archivos versionados. `docs/misiones/` era contenido ajeno no versionado al iniciar y se conserva sin editar ni añadir al commit. Se leyeron la especificación, ENTREGA y README; `docs/diseno/` no estaba en este worktree, por lo que se leyeron los dos documentos correspondientes de `cooper-integracion` sin modificarlos.

## Puerta obligatoria

Código verificado: `e4d8d69`. Entorno: Node 24.22.3, npm 12.2.2, Podman 6.2.0. Pruebas con datos ficticios y puertos/bases temporales, sin `.env.local` real en este worktree.

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
node --test tests/migrar_dueno.test.mjs
```

**PASS: todos los comandos con rc 0, cero errores y cero advertencias; sin pruebas omitidas.**

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | PASS; 0 vulnerabilidades |
| `npm run lint` | PASS; `--max-warnings 0` |
| `npm run typecheck` | PASS |
| `npm test` | PASS; 117 pruebas, 15 archivos |
| `npm run test:e2e` | PASS; 22 escenarios Chromium |
| `npm run build` | PASS; Next.js 16.4.6 |
| `node --test tests/flujos_v2.test.cjs` | PASS; 119 pruebas |
| `node --test tests/migrar_dueno.test.mjs` | PASS; 8 pruebas |
| `git diff --check` y hashes del respaldo | PASS |

Evidencia íntegra: [puerta completa](evidencias/cooper-vivo/puerta-final.log), [workflows](evidencias/cooper-vivo/flujos-final.log), [migración](evidencias/cooper-vivo/migracion-final.log) y [hashes de evidencias](evidencias/cooper-vivo/SHA256SUMS.txt). Los logs versionados normalizan únicamente espacios finales y líneas vacías al final; los originales quedan en `~/.cache/cooper-vivo/`. Los tests de workflows usaron `TMPDIR=cooper/.cache` y `PYTHONDONTWRITEBYTECODE=1`. No se volvió a ejecutar `test:ensayo`: este cierre comprende la puerta exigida y la regresión específica del correo, no una nueva aceptación del puente en vivo.

## Reversa y continuación

**Paso 9: no aplica una reversa de datos**, porque no hubo mutaciones del vivo. Restaurar ahora el respaldo completo perdería trabajo legítimo posterior; no se ejecutó. No existe `duenos-antes.json` porque no se aplicó la migración. Los cron y las aprobaciones siguen en su estado original.

Para una continuación autorizada con una API key disponible, tomar un respaldo nuevo: este representa el 20 de noviembre a las 19:39 y la fábrica siguió trabajando. Repetir el inventario de ejecuciones y formularios, conservar sus grafos y pausar únicamente los cron durante la migración, guardando sus activaciones. Seguir los pasos 1–8 del [procedimiento corregido](cooper-ensayo.md#pasos-de-claude-en-vivo-con-respaldo-y-reversa), con las precisiones de esta misión. Usar el correo con punto en las tres órdenes: simulación revisada, aplicación con diario nuevo y simulación final sin pendientes. Restaurar las activaciones de cron al finalizar, tal como estaban.

Si una futura aplicación falla, seguir el paso 9: detener nuevas entradas, despublicar FX/cron nuevos, preservar recibos y ejecuciones, conciliar operaciones ya despachadas y restaurar **las versiones de workflows identificadas en el respaldo**, conservando IDs y columnas aditivas. Revertir campos únicamente mediante el diario correspondiente, primero simulando y después aplicando, con control de conflictos. Nunca borrar idempotencia ni restaurar ciegamente una SQLite anterior a órdenes ya aceptadas.

Para recuperación total por desastre, primero conciliar la actividad posterior y verificar `SHA256SUMS` desde el directorio del respaldo; detener n8n solo en una ventana autorizada que preserve/resuelva trabajos pendientes. Conservar aparte el volumen actual y restaurar `volumen/` en un volumen de recuperación, incluidos `config` y `database.sqlite`, usando la misma imagen y UID/mapeo de Podman. Validar primero en una copia sin red, confirmar permisos para el usuario n8n y las activaciones esperadas antes de conectarla. No mezclar el WAL actual con la SQLite restaurada. Esta operación **no se realizó ni está indicada para el bloqueo actual**.

## Limitaciones reales y Pendientes de Walter

- **FALTA_API_KEY:** hacer disponible una API key existente mediante `N8N_API_KEY` fuera de Git; si no existe, decidir su provisión por separado. Esta misión no la crea. La ausencia es de una clave disponible en las ubicaciones autorizadas; no demuestra que n8n carezca de claves registradas.
- Quedan sin ejecutar las migraciones, publicación de FX, secretos del puente, copia del `.env.local`, servicio `cooper.service`, SQLite persistente y Cooper en `http://localhost:3000`. No se habilitó ningún modo de pruebas de autenticación en producción.
- Estado por dueño, panel administrativo, consultas de estado/tendencias y firma del callback **NOT_RUN en vivo**. Las pruebas locales no sustituyen esa aceptación.
- Conservar y revisar con Walter los formularios históricos pendientes al retomar; no se reconstruyeron decisiones ni se inventó contexto de guion.
- No se reabre la autorización del paso a vivo ni la decisión del correo: ambas ya están resueltas. Los proveedores de pago deben conservar lo configurado en Ajustes.

## Fuentes oficiales consultadas

- [Autenticación de la API de n8n](https://docs.n8n.io/api/authentication/): uso de API key; no se llamó a REST en el vivo.
- [CLI de n8n](https://docs.n8n.io/hosting/cli-commands/): exportación de workflows con IDs mediante la CLI de la imagen 2.47.4.
- [Respaldo y restauración de n8n](https://docs.n8n.io/deploy/host-n8n/keep-n8n-running/backup-and-restore): volumen completo y snapshot consistente cuando no puede detenerse SQLite.
- [SQLite Online Backup API](https://www.sqlite.org/backup.html): snapshot de una base activa mediante la API de respaldo.
- Documentación de variables de entorno de Next instalada en `cooper-integracion/cooper/node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`.
