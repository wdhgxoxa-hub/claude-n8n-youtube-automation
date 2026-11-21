# Cooper ↔ n8n: puente activo en vivo

20 de noviembre de 2026, America/Lima. Worktree `/home/david/Proyectos/cooper-wt/cooper-ensayo`, rama `cooper-ensayo`. Base de esta reanudación: `d8d992f`. Administrador: **wdhg.xoxa@gmail.com**.

## Resultado

**Cooper está corriendo en http://localhost:3000, con build de producción, `COOPER_FABRICA=n8n` y `cooper.service` habilitado para iniciar con la sesión de David.** El endpoint vivo es `https://joining-jeeringly-primp.ngrok-free.dev/webhook/cooper/v1`. FX está publicado y las consultas de estado, tendencias y gastos administrativos pasaron. El receptor de Cooper aceptó una firma HMAC válida y rechazó una inválida.

La aceptación visual del panel administrativo queda **pendiente del primer ingreso Google de Walter**. Se comprobó su consulta de gastos contra el vivo y que `/admin` exige sesión; no se hizo OAuth, no se fabricaron cookies de acceso y no se ejecutó el emisor E2E en producción. La base local todavía tiene cero usuarios: el primer ingreso autorizado provisionará al administrador y permitirá sincronizar sus recursos.

Se conservaron los 27 IDs existentes: se actualizaron 23 workflows de la fábrica y se mantuvieron los cuatro legados. Se añadieron cinco workflows nuevos del puente, **una sola vez**, reutilizados durante el reintento. Resultado: **32 workflows, 30 activos, cero nombres duplicados**. Los dos legados que estaban inactivos siguen inactivos. FX se publicó al final del lote de dependencias; después se reactivaron los cron conforme a la instrucción específica de Walter.

Los cuatro cron tienen sus nodos originales completos, incluidos parámetros, horarios e indicadores de activación. Las ejecuciones **400 y 540** siguen en `waiting`, con sus versiones y datos persistidos intactos, comprobados mediante hash. No se visitaron ni resolvieron sus formularios. Las cuatro filas de `publicaciones` permanecen iguales; no se consultó ni alteró la programación remota de Upload-Post.

No se crearon videos, trabajos ni filas de costos. Las seis ejecuciones nuevas persistidas corresponden exclusivamente a consultas de FX y terminaron en `success`. No se invocaron proveedores de pago, no se hicieron pagos ni se modificó D&S Factory. Los interruptores y valores que ya existían en Ajustes se preservaron, incluidos los proveedores que Walter ya tenía encendidos.

## Respaldo verificado antes de escribir

Se verificó primero el respaldo anterior `respaldo-20261120-193926-0500`: lectura completa de las bases y **30 hashes correctos**. Workflows, filas y esperas relevantes seguían coincidiendo. Antes de las escrituras se tomó además una instantánea nueva:

```text
/home/david/.cache/cooper-vivo/respaldo-20261120-195140-0500/
```

Directorios **0700**, archivos **0600**. Contiene:

- `volumen/`: copia completa del volumen `videos_n8n_data`, configuración opaca y SQLite consistente mediante la API de respaldo en línea; no mezcla una base con un WAL de otro instante.
- `workflows.json` y `workflows-sqlite.json`: los 27 workflows originales, con IDs y grafos.
- `versiones-workflows.json`, `versiones-publicadas.json`, `activaciones.json`: historial y publicaciones originales, con 25 activos.
- `data-tables.json`: nueve tablas, esquemas, columnas y las 117 filas originales.
- `ejecuciones-pendientes.json`, `conteos-sqlite.json` y `cooper-sqlite.json`: inventarios; aún no existía la nueva base local de Cooper al tomar esta instantánea.
- `restauracion-aislada/`: copia independiente usada para comprobar lectura y exportación sin red.
- `SHA256SUMS`: 26 archivos del respaldo base, comprobados otra vez al cierre.

`integrity_check` y `foreign_key_check` pasaron. Se recorrieron todas las filas y columnas de las **187 tablas SQLite** sin mostrar datos. Un contenedor efímero con n8n 2.47.4, `--network none` y sin puertos exportó los 27 workflows desde la restauración; IDs, nodos y conexiones coincidieron. Nunca arrancó un servidor n8n sobre esa copia. Los logs del volumen se copiaron durante la operación: no se afirma atomicidad transaccional de los archivos de log.

Los diarios posteriores están también protegidos en ese directorio: `duenos-antes.json` corresponde al primer intento, **ya revertido**; **`duenos-antes-reintento.json` es el diario de la migración vigente**. Son archivos adicionales al manifiesto inicial, sin sobrescribirlo. Los scripts y registros privados de operación están en `~/.cache/cooper-vivo/reanudacion/`.

## Pasos 3–8 ejecutados

### Tablas y migración

Los nueve nombres e IDs coincidieron con `T` del generador. No se crearon tablas paralelas. La API key existente se leyó únicamente para exportar `N8N_API_KEY` en el proceso, desde `~/.config/cooper/n8n-api-key` (0600); no se imprimió, creó ni copió a la configuración de Cooper o n8n. El bloqueo anterior `FALTA_API_KEY` quedó resuelto.

Primera simulación: **15 columnas y 51 filas**, sin huérfanos ni contradicciones. Distribución: 2 canales, 5 videos, 25 costos y 19 trabajos. Se revisó el plan, se aplicó con diario y la simulación final quedó en cero. Tras la reversa del primer intento, el segundo propuso cero columnas —ya existían— y las mismas 51 filas.

Órdenes del intento vigente, desde la raíz, con la clave ya exportada y sin mostrarla:

```bash
export N8N_URL=https://joining-jeeringly-primp.ngrok-free.dev
export RESPALDO_COOPER=/home/david/.cache/cooper-vivo/respaldo-20261120-195140-0500
node tools/migrar_dueno.mjs --url "$N8N_URL" --admin wdhg.xoxa@gmail.com --asignar-todo-al-admin --simular
node tools/migrar_dueno.mjs --url "$N8N_URL" --admin wdhg.xoxa@gmail.com --asignar-todo-al-admin --aplicar --respaldo "$RESPALDO_COOPER/duenos-antes-reintento.json"
node tools/migrar_dueno.mjs --url "$N8N_URL" --admin wdhg.xoxa@gmail.com --simular
```

**Simulación final tras la publicación y reactivación: cero columnas y cero filas pendientes.** Los campos previos de negocio permanecen iguales; las escrituras REST cambian sus metadatos `updatedAt`. Las columnas añadidas no se borraron durante la reversa.

### Decisiones históricas

Se mantuvieron etapas, guiones y formularios históricos. La migración deja `guion_cooper` vacío donde no había guion migrado; no inventó contenido ni decisiones. Recuperar y validar ese contexto y decidir cómo cerrar los formularios antiguos queda en Pendientes de Walter. Las esperas conservan sus grafos históricos; no se reinterpretaron como ejecuciones del grafo nuevo.

### Cooper local y secretos

Se copió de forma opaca `cooper-integracion/cooper/.env.local` a `cooper-ensayo/cooper/.env.local`, sin imprimir valores. Se añadieron el administrador correcto, modo n8n, endpoint, ruta persistente y secretos distintos del puente, generados fuera de Git. El archivo está ignorado por Git y tiene modo 0600. `COOPER_TEST_MODE=0`, `COOPER_DEMO=0`; no hay emisor ni sesiones E2E en producción.

Se ejecutaron `npm ci`, `npm run db:migrate` y el build de producción. Las cinco migraciones locales usan:

```text
/home/david/.local/share/cooper/cooper.sqlite
/home/david/.config/systemd/user/cooper.service
```

La carpeta de datos es 0700; el servicio usa `UMask=0077`, Node de `/usr/bin/node`, escucha en `127.0.0.1:3000`, se reinicia ante fallo y está habilitado en `default.target`. La configuración se carga de `.env.local`. Comprobados `active`, `enabled`, HTTP 200 en `/entrar`, `/api/auth/session` y `/api/auth/providers`, y SQLite íntegra. No hay órdenes en `bridge_commands`. Se guardó una instantánea consistente de esta base inicial en `~/.cache/cooper-vivo/reanudacion/cooper-produccion-inicial.sqlite` (0600), con lectura e integridad verificadas.

Los secretos generados se conservan en `~/.config/cooper/puente.env`, `n8n.env` y `runner.env`, todos 0600 dentro de una carpeta 0700. **No contienen la API key de mantenimiento de n8n.** `task-runners.json` contiene únicamente configuración y nombres de variables.

### n8n y runner

El contenedor vivo conserva el nombre `videos-n8n`, la imagen **2.47.4**, el volumen original, el puerto `127.0.0.1:5678` y la URL pública. Se recreó de forma controlada después de comprobar que no había ejecuciones `new` o `running`; las dos esperas persistidas mantuvieron su hash.

Se usa `videos-n8n-runner`, imagen `ghcr.io/n8n-io/runners:2.47.4`, en modo **externo**, usuario 65532, sistema raíz de solo lectura, `/tmp` temporal, sin capacidades y con `no-new-privileges`. Solo se permite el módulo JavaScript `crypto`, sin módulos externos. El broker comparte la red del contenedor y no publica otro puerto en el host. Las variables necesarias están permitidas explícitamente; `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` habilita el contrato de `$env` para los workflows del operador. Los usuarios de Cooper no reciben acceso al editor de n8n.

El callback usa `http://127.0.0.1:3000/api/n8n/webhook` dentro de n8n mediante la opción documentada de Pasta `-T,3000`, que reenvía ese puerto hacia el loopback del host. Se comprobó conectividad real. No se usó el enlace de ensayo por stdin/stdout. Ambos procesos comparten el reloj del host; la firma con sello actual fue aceptada.

El contenedor original se conserva detenido como `videos-n8n-anterior-cooper-20261120`, con reinicio automático desactivado para evitar dos procesos sobre el mismo volumen. Su configuración anterior está en `reanudacion/contenedor-antes.json`, privada y fuera de Git.

### Workflows y asociaciones de credenciales

Se guardaron borradores sobre los IDs vivos existentes con `publishIfActive=false` y se publicaron por dependencias: errores, Ajustes y subflujos antes de FX. No se importaron fixtures ni JSON del ensayo. Las asociaciones existentes de credenciales se conservaron. Ajustes retiene todos sus valores previos; solo incorpora tres campos nuevos de tarifas, sin cambiar interruptores.

| Identificador declarativo | ID vivo — reutilizar en próximas actualizaciones |
| --- | --- |
| `FabCooperAPI0001` | `xorCR0lfNlil8Ovy` |
| `FabCooperCosto01` | `z74zUkz2BR8k0GLR` |
| `FabCooperProgr01` | `gNrGzmHBxJ3OIuQM` |
| `FabPresentacion1` | `MkC3QS6ogZZ8n24u` |
| `FabAvatar0000001` | `8nqh0n7jewLQOikC` |

El mapa completo está en la evidencia y en `reanudacion/mapa-workflows.json`. **No volver a crear estos cinco workflows.** Las referencias internas del lote publicado usan sus IDs vivos; los JSON declarativos del repositorio mantienen sus identificadores de origen.

### Aceptación de lectura y callback

| Comprobación en vivo | Resultado |
| --- | --- |
| Estado de Walter con ámbito de dueño | HTTP 200, 2 canales y 5 videos, todos con el correo correcto |
| Correo de prueba sin recursos, sin crear cuenta | HTTP 200, 0 canales y 0 videos |
| Estado administrativo | HTTP 200, 2 canales y 5 videos |
| Datos de gasto del panel | HTTP 200, un dueño, importes marcados como estimados |
| Rol administrativo falsificado | HTTP 403 |
| Tendencias | HTTP 200, resumen del radar guardado; no disparó investigación |
| Firma HMAC correcta desde el contenedor hacia Cooper | HTTP 200, consulta de recibo desconocido devuelve `nueva` |
| Firma incorrecta del mismo callback | HTTP 401 |
| Panel sin sesión | `/admin` redirige a entrada, HTTP 307 |
| Panel con sesión Google real | **PENDIENTE**: no se realizó OAuth |

La comprobación HMAC envió una consulta `fase: consultar` firmada desde un proceso Node en el contenedor, sin reservar ni confirmar una orden. Verifica secreto, firma, red y receptor reales; **no es un callback de progreso disparado por una producción**. No se emitieron eventos de progreso ficticios sobre los videos históricos. Las mutaciones, idempotencia y callbacks de producción conservan la evidencia del ensayo aislado; no se afirman validados de nuevo con encargos vivos.

## Incidencias y reversa ejecutada

1. Deshabilitar el único cron de Aprendizaje y republicar produjo HTTP 400: el workflow quedaba sin disparadores. n8n había guardado el borrador, manteniendo la publicación anterior. Se restauraron grafo y versión; luego se pausaron los flujos exclusivamente cron mediante `unpublish` y solo el nodo cron del Radar, conservando su entrada de subflujo.
2. El runner externo inicialmente rechazó una configuración sin la entrada Python que su launcher esperaba. Se restituyó esa entrada desde la configuración oficial, con sus listas de módulos vacías. El runner final está registrado y operativo. Durante la reversa intermedia, su parada de 30 segundos requirió SIGKILL; no había tareas en curso. Esta incidencia operativa está separada de la puerta de pruebas, que no tiene advertencias.
3. La primera publicación se detuvo en Sonido porque las referencias `FabCredHeyGen001` y `FabCredEleven001` no existían. Tampoco había otras credenciales de esos proveedores que pudieran reasociarse. **FX todavía no estaba publicado.** Se aplicó el paso 9: restaurar las versiones originales, despublicar los nuevos auxiliares, revertir las 51 filas con el diario y recuperar las activaciones y el contenedor originales. La simulación de reversa quedó en cero. Se conservaron las columnas aditivas y los cinco borradores; no se borraron recibos ni se restauró una SQLite anterior.
4. Se corrigió únicamente la preparación del payload de despliegue: retirar referencias inexistentes de las ramas nuevas de HeyGen/ElevenLabs y dejarlas sin credencial asociada. No se creó ninguna credencial ni se cambió Ajustes. Esas capacidades siguen sin configurar y requieren asociación antes de su uso. El segundo intento reutilizó los mismos cinco IDs, aplicó un diario nuevo y publicó todo el lote correctamente.

La restauración funcional comprobó grafos, conexiones, ajustes y versiones publicadas. n8n añadió automáticamente un `webhookId` al nodo emisor Telegram «Avisar error»; se registró esa normalización, sin cambio de parámetros ni credenciales. La evidencia intermedia de reversa se conserva separada del estado final activo.

## Puerta obligatoria y evidencias

Código de aplicación verificado: `d8d992f` — la reanudación no modifica su lógica. Los commits posteriores actualizan documentación y evidencias. Antes de repetir la puerta se detuvo Cooper y se apartó temporalmente su `.env.local` real; al terminar se restauró, con permisos privados, y se arrancó el servicio de producción. Los ensayos usaron bases, puertos y secretos propios.

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
node --test tests/migrar_dueno.test.mjs
```

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | PASS, rc 0, cero vulnerabilidades |
| `npm run lint` | PASS, rc 0, `--max-warnings 0` |
| `npm run typecheck` | PASS, rc 0 |
| `npm test` | PASS, rc 0, 117 pruebas |
| `npm run test:e2e` | PASS, rc 0, 22 escenarios |
| `npm run build` | PASS, rc 0, Next.js 16.4.6 |
| `node --test tests/flujos_v2.test.cjs` | PASS, rc 0, 119 pruebas |
| `node --test tests/migrar_dueno.test.mjs` | PASS, rc 0, 8 pruebas |
| Advertencias, errores y pruebas omitidas de la puerta | **0** |

Evidencia pública, sin secretos ni cuerpos de respuestas con datos históricos: [puerta íntegra](evidencias/cooper-vivo/reanudacion/puerta-final.log), [workflows](evidencias/cooper-vivo/reanudacion/flujos-final.log), [migración](evidencias/cooper-vivo/reanudacion/migracion-tests-final.log), [estado final](evidencias/cooper-vivo/reanudacion/estado-final.json), [consultas](evidencias/cooper-vivo/reanudacion/validacion-puente.json), [callback](evidencias/cooper-vivo/reanudacion/callback-final.json), [servicio local](evidencias/cooper-vivo/reanudacion/cooper-local.json) y [SHA256](evidencias/cooper-vivo/reanudacion/SHA256SUMS.txt). Los logs normalizan únicamente espacios finales; los originales permanecen privados en `reanudacion/`. La regresión de flujos usó `TMPDIR=cooper/.cache` y `PYTHONDONTWRITEBYTECODE=1`.

## Commits

| Commit | Contenido |
| --- | --- |
| `e4d8d69` | Corrección previa del administrador y regresión de la CLI; conservada |
| `d8d992f` | Informe y respaldo de la interrupción anterior; base de esta reanudación |
| `fdd1618` | Guías actualizadas con el puente activo y límites de producción |
| Commit de cierre de este informe | Evidencias de reanudación, reversa comprobada, aceptación y procedimiento de recuperación |

No hubo push ni merge a `main` o `version-chatgpt`. `docs/misiones/` era contenido ajeno no versionado y permanece intacto. No quedan referencias versionadas al correo administrativo sin punto. `docs/diseno/` no existe en este worktree; se leyeron sus dos documentos en `cooper-integracion`, sin modificarlos.

## Cómo revertir desde el estado final

No ejecutar estas órdenes como una simple comprobación: **retiran el puente vivo**. Usar la API key existente solo mediante entorno, con `N8N_URL` igual al origen de los diarios. Conservar antes las órdenes, recibos, ejecuciones y cualquier trabajo posterior; no borrar idempotencia. Comprobar que no hay ejecuciones `new`/`running` antes de detener contenedores, y conservar las esperas y sus enlaces.

1. Detener nuevas órdenes de Cooper con `systemctl --user stop cooper.service`. El script de reversa despublica FX al comenzar. Pausar únicamente los cron mediante `node ~/.cache/cooper-vivo/reanudacion/cron.mjs pausar`.
2. Restaurar los grafos originales y sus versiones publicadas, con IDs intactos, mediante `node ~/.cache/cooper-vivo/reanudacion/revertir-workflows.mjs`. Los cinco nuevos workflows quedan inactivos, conservados para diagnóstico. Los cron se dejan para el final. Las credenciales permanecen intactas.
3. Si también se necesita revertir la pertenencia y campos migrados, usar **solo el diario vigente**, que detecta conflictos y no pisa cambios posteriores:

```bash
node tools/migrar_dueno.mjs --url "$N8N_URL" --simular --revertir "$RESPALDO_COOPER/duenos-antes-reintento.json"
node tools/migrar_dueno.mjs --url "$N8N_URL" --aplicar --revertir "$RESPALDO_COOPER/duenos-antes-reintento.json"
node tools/migrar_dueno.mjs --url "$N8N_URL" --simular --revertir "$RESPALDO_COOPER/duenos-antes-reintento.json"
```

El resultado final debe ser `reversa: 0`. Ante un conflicto, conservar el diario y conciliar; no forzar la escritura. El diario del primer intento ya se revirtió y no debe repetirse después del vigente. Las 15 columnas aditivas permanecen.

4. Para restaurar también el entorno n8n anterior, sin tareas en curso: detener `videos-n8n-runner` y `videos-n8n` de forma controlada, desactivar su reinicio y conservarlos renombrados. Renombrar `videos-n8n-anterior-cooper-20261120` a `videos-n8n`, devolverle `--restart=unless-stopped` y arrancarlo sobre **el volumen actual**, no una SQLite antigua. El original ya conserva su configuración previa. No arrancar ambos contenedores contra el mismo volumen.
5. Reactivar exactamente los cron anteriores mediante `node ~/.cache/cooper-vivo/reanudacion/cron.mjs restaurar`, que publica las versiones identificadas en el respaldo. Verificar las 25 activaciones originales y las esperas. Si se retira Cooper definitivamente, usar `systemctl --user disable --now cooper.service`; conservar su SQLite y configuración para diagnóstico.

La recuperación total por desastre requiere conciliar actividad posterior, comprobar `SHA256SUMS` y restaurar `volumen/` en un volumen de recuperación con la misma imagen y mapeo de UID. Se comprobó la restauración aislada, pero **no se restauró el volumen vivo completo**: hacerlo ciegamente perdería actividad legítima posterior. Los scripts privados son específicos de esta migración y su respaldo; revisar su alcance antes de usarlos sobre cambios futuros.

## Limitaciones reales y Pendientes de Walter

- **Primer ingreso Google y revisión visual del panel admin.** La ruta exige sesión; las consultas administrativas del puente sí pasaron. No se probaron OAuth ni una segunda cuenta Google real. No hace falta reautorizar el paso a vivo ni corregir de nuevo el correo.
- Revisar el guion y decisiones históricos de las esperas 400/540. Permanecen en el circuito original, sin aprobaciones inventadas ni cancelación.
- Las ramas nuevas de avatar HeyGen y voces HeyGen/ElevenLabs no tienen credencial asociada. Configurarlas y hacer su ensayo requiere una misión posterior; no se habilitaron proveedores ni se probaron renders, voces, creación de videos o publicaciones externas.
- La firma se validó sobre una consulta de recibo sin despacho. Un callback de producción y sus reintentos en vivo no se provocaron durante esta aceptación de lectura.
- Los gastos son registros estimados de la fábrica, no facturación conciliada. Los cron se pausaron temporalmente; no se ejecutó una recuperación manual de ticks que pudieran coincidir con esa ventana.
- La clave REST existente tiene la caducidad de siete días indicada por Walter. El puente operativo usa sus propios secretos y no depende de esa API key para cada consulta; mantener disponible una clave válida para futuras tareas administrativas es una decisión posterior.
- Se mantiene infraestructura local y ngrok. VPS, dominio, copias periódicas y endurecimiento adicional siguen fuera de esta misión. La SQLite local de producción es nueva y requiere incorporarse a la política de respaldos.

## Documentación oficial consultada antes de usar APIs

- [Autenticación n8n y scopes](https://docs.n8n.io/api/authentication/).
- OpenAPI oficial de la imagen **2.47.4**, `public-api/v1/openapi.yml`: Data Tables, actualización con `publishIfActive=false`, publicación de una versión e inactivación. Copia privada y hash en el manifiesto de verificación.
- [Runner externo](https://docs.n8n.io/hosting/configuration/task-runners/), [aislamiento del runner](https://docs.n8n.io/deploy/host-n8n/configure-n8n/security/harden-task-runners.md) y [módulos de Code](https://docs.n8n.io/hosting/configuration/configuration-examples/modules-in-code-node/).
- [Persistencia del nodo Wait](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/).
- [Podman run: Pasta y reenvío de puertos](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
- Documentación de Next instalada en `cooper/node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`; opciones de Podman contrastadas con su documentación y ayuda local. El servicio systemd se verificó en ejecución. No se usaron endpoints de proveedores de medios.
