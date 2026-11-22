# Observabilidad de Cooper

21-11-2026, Lima. Implementación local; esta misión no modifica VPS, contenedores,
workflows vivos, credenciales ni servicios externos.

## Panel y controles administrativos

Administración enlaza **Salud de la operación** (`/admin/salud`). El servidor
revalida el administrador activo antes y después de consultar las fuentes. Los
usuarios normales no reciben métricas de infraestructura, ejecuciones ni costes.
`GET /api/admin/salud` es una lectura sin caché y no envía mensajes; la pestaña se
actualiza cada minuto, conserva los cambios del formulario y permite actualización
manual. Fechas y gasto diario se presentan en Lima.

- n8n: muestra ejecuciones, fallos de las últimas 24 horas observadas, causas
  clasificadas y workflows activos/inactivos. Consulta como máximo cuatro páginas
  de 50 registros por lista, con cursor; indica las muestras incompletas. Las causas
  de hasta diez fallos se clasifican en permisos, cuota, tiempo, memoria o conexión;
  no se muestran errores, nodos, entradas ni salidas crudos. Si una lectura falla,
  el dato queda desconocido, sin sustituirlo por cero.
- VPS: disco, memoria del host, certificados, copias, disponibilidad, fecha y
  mantenimiento desde la proyección descrita abajo. Una fuente ausente o vencida
  genera un aviso de falta de observación; nunca se interpreta como salud correcta.
- Fábrica: reutiliza el puente para estado, decisiones, incidencias y gastos. Separa
  producción sin avance de aprobaciones humanas, programaciones, pausas y
  cancelaciones. Los controles enlazan los videos, Incidencias, Decisiones,
  conciliación y Ajustes de fábrica existentes, conservando sus confirmaciones y
  permisos. No se reintenta una ejecución al consultar la salud. El gasto puede ser
  estimado y los avisos no bloquean producción.

El panel conserva la distinción entre simulación y actividad real. Los contadores
de producción se calculan sobre el estado disponible y la lista visible se limita
a 200 videos, priorizando los que no avanzan. Un fallo del puente deja contadores
desconocidos; no convierte la caché local en una lectura remota reciente.

## Umbrales y Telegram

`POST /api/admin/salud` exige sesión administrativa, origen válido, JSON,
`confirmado: true` y revisión vigente. Los umbrales y el interruptor de avisos se
guardan de forma atómica en SQLite, reutilizando `events`; no requieren una nueva
migración. Otro administrador/pestaña con una revisión antigua recibe 409 y debe
revisar los valores actuales. Cada cambio conserva actor, fecha y configuración.

Valores iniciales: disco libre 10 %, memoria usada 90 %, certificado 14 días,
copia local 30 h/remota 36 h, video sin avance 60 min, un fallo n8n en la muestra
de 24 h, gasto diario 25 USD, medición VPS 15 min. Recordatorio: 360 minutos.
Estos valores son propuestas editables; la activación y los márgenes definitivos
corresponden a Walter. El monitor histórico del host mantiene sus umbrales propios.

Telegram está **apagado por defecto**. Para habilitarlo, el operador configura
únicamente en servidor `COOPER_TELEGRAM_BOT_TOKEN` y `COOPER_TELEGRAM_CHAT_ID`, y
Walter activa el interruptor desde el formulario web. Nunca se introducen claves
en el navegador. El destino debe ser un chat numérico; no se admite una URL
arbitraria. El transporte usa `sendMessage` oficial, sin HTML, con vista previa
desactivada y `allow_paid_broadcast: false`. Esta misión solo prueba transportes
ficticios; no envía Telegram real.

Un trabajador del proceso Node evalúa cada minuto sin navegador abierto, solamente
en modo n8n, fuera de demostración y con avisos activados. El interruptor operativo
`COOPER_OBSERVABILIDAD_PAUSA=1` lo detiene. La reserva SQLite evita dos consumidores
simultáneos. Deduplica por condición y severidad, recuerda las incidencias enviadas,
avisa cambios/recuperación y reitera las activas al plazo configurado. Conserva
última evaluación, último recibo confirmado, incidencias activas y estado de entrega.
Un rechazo confirmado espera al menos cinco minutos y respeta `retry_after`; un
timeout, respuesta inválida o caída tras despachar queda **incierto** y espera el
plazo del recordatorio antes de repetir el mismo estado. Esa espera no detiene la
evaluación: una condición nueva, un cambio de severidad o la recuperación pueden
avisarse antes. Cambiar los umbrales no elimina la espera del transporte.
Telegram no ofrece idempotencia en `sendMessage`: no se
promete entrega exactamente una vez y un recordatorio posterior puede duplicar un
aviso cuyo recibo se perdió. Errores y respuestas privadas no se registran.

Este trabajador depende de Cooper funcionando y el monitor histórico depende de
n8n para su transporte. La caída total del VPS requiere un vigilante externo
independiente; no se crea ni se contrata uno en esta misión. Ambos canales pueden
avisar sobre un mismo incidente al activarlos; conservar el monitor histórico hasta
aceptar explícitamente la cobertura nueva.

## Conexión de lecturas n8n

Configurar `COOPER_N8N_API_URL` con la base HTTPS terminada en `/api/v1` y
`COOPER_N8N_API_KEY` como clave de lectura del servidor. En ensayo se admite HTTP
loopback literal; no se sigue ninguna redirección. La clave del webhook de fábrica
no sirve como clave de la API pública. El transporte es solo GET, con un plazo
global de ocho segundos y respuestas de hasta 2 MiB. No activa, detiene, borra ni
reintenta workflows. La lectura de fábrica sigue usando su adaptador y token
existentes. La disponibilidad, permisos y cobertura real de la clave se aceptan
en una misión de despliegue, no mediante pruebas con secretos reales aquí.

El overlay opcional pasa esas variables y las de Telegram al contenedor. Valores
vacíos mantienen las fuentes sin configurar. No cambiar el Compose ni los bundles
ya certificados de una release en curso; revisar este complemento para una nueva
release independiente.

## Recolección del VPS

`deploy/monitor.py` conserva el monitor y el envío firmado existentes. Durante su
sondeo habitual reúne además una proyección cerrada con
`deploy/observabilidad.py`, sin otro proceso periódico, servicio, puerto ni acceso
remoto desde la web. El timer existente consulta cada cinco minutos, con hasta
15 segundos de variación. La web debe mostrar la fecha de la medición y rechazar
información caducada; no representa telemetría continua.

El monitor escribe `STATE_ROOT/observabilidad/estado.json` mediante un temporal
exclusivo y sustitución atómica en el mismo directorio. Solo ese subdirectorio es
legible por el contenedor: directorio `0755`, fichero `0644`. `STATE_ROOT` y sus
otros recibos conservan sus permisos privados. Si la escritura falla, las alertas
anteriores siguen funcionando y el panel conserva la condición de fuente ausente
o desactualizada. Un fallo durante el sondeo conserva la evidencia parcial y los
campos no obtenidos permanecen desconocidos.

| Campo de contrato v1 | Fuente y significado |
| --- | --- |
| `schemaVersion`, `collectedAt` | Versión `1` e instante UTC ISO de la medición. |
| `maintenance` | `true` cuando existe el marcador de mantenimiento o una operación mantiene su bloqueo exclusivo; en ese caso no se sondea ni se alerta y las métricas se publican desconocidas. |
| `disk.totalBytes`, `disk.freeBytes` | `shutil.disk_usage(DATA_ROOT)` del host: capacidad y bytes libres del sistema de archivos donde están los datos. |
| `memory.totalBytes`, `memory.availableBytes` | `MemTotal` y `MemAvailable` de `/proc/meminfo` del host, convertidos de KiB a bytes. No se sustituye disponible por memoria libre ni por memoria del contenedor. |
| `certificates.cooper`, `certificates.n8n` | `{state, expiresAt}`; el mismo sondeo TLS con CA y SNI obtiene la fecha de expiración para `COOPER_DOMAIN`/`N8N_DOMAIN`. No exporta los dominios. Estados: `ok`, `expiring` (≤14 días), `expired`, `unknown`. Un handshake no verificable deja fecha desconocida; no se desactiva TLS para recuperarla. |
| `backups.copy`, `backups.replica` | `{state, completedAt, ageHours}` a partir de `ultima-copia.json`/`ultima-replica.json`, reutilizando `monitor.age`: solo recibos `restauracion: PASS`. Estados `ok`, `stale` (>30/36 horas respectivamente), `unknown`. No se exporta identidad de snapshot, rutas ni manifiestos. Una fecha futura nunca se afirma como copia disponible. |
| `services` | Solo `cooper`, `n8n`, `runner`, `caddy`, con valores `ok`, `down`, `unknown`. Reutiliza la comprobación de contenedor en ejecución, healthcheck saludable y política `unless-stopped`. No exporta salida Docker, IDs ni nombres de proyecto. |

Los números ausentes son `null`, nunca cero ficticio. Las fechas ausentes son
`null`. Los valores de servicio y certificado proceden de listas cerradas; errores,
URLs, cabeceras, dominios, claves, nombres privados, entornos y texto de proveedores
no forman parte de este contrato. El estado de servicios no sustituye el resultado
de la comprobación TLS ni la prueba HTTPS histórica del monitor.

Los estados del snapshot describen los márgenes históricos del monitor. Los
umbrales configurables de la web se calculan sobre bytes y fechas, sin asumir que
un `ok` del recolector satisface cualquier umbral del administrador. Esta ampliación
no cambia los códigos de problema, deduplicación, firma, recuperación ni transporte
de los avisos ya desplegados.

## Activación a cargo del operador

1. Revisar la nueva release con `monitor.py` y `observabilidad.py` juntos. El
   segundo archivo es una dependencia nueva del primero. Conservar los bundles,
   hashes y recibos certificados de releases anteriores; no sobrescribirlos ni
   afirmar que acreditan este código. Los bundles de 25 archivos ya certificados
   no incluyen esa dependencia: el futuro paquete, su lista permitida y manifiesto
   deben incluirla y superar su prueba de importación. El overlay se revisa aparte.
2. Incorporar ambos archivos al procedimiento autorizado de actualización del
   host. El timer existente publicará el snapshot en su siguiente sondeo; verificar
   existencia, fecha y permisos de **ese fichero saneado**. No es necesario ejecutar
   manualmente el monitor ni enviar una alerta de prueba para crear el contrato.
3. Añadir `deploy/compose.observabilidad.yaml` a la combinación de Compose de la
   nueva release, conservando sus demás overlays. Define
   `COOPER_OBSERVABILIDAD_VPS_PATH=/app/observabilidad/estado.json` y monta únicamente
   `${STATE_ROOT}/observabilidad` en `/app/observabilidad`, con `read_only: true` y
   `create_host_path: false`. La ausencia del directorio debe impedir ese montaje;
   no montar `STATE_ROOT` completo, el socket Docker, `/proc`, recibos privados ni
   archivos de entorno dentro de Cooper.
4. Aplicar la release bajo el procedimiento operativo autorizado, manteniendo el
   overlay en futuras recreaciones. Verificar en Administración la fuente real,
   fecha, capacidad del disco, memoria, fechas de copias y certificados. Comprobar
   que el usuario del contenedor no puede escribir el snapshot. Retirar el overlay
   y su variable revierte únicamente la lectura web de esta proyección.

La misión entrega el overlay y el código; no ejecuta ninguno de esos pasos en el
VPS. La aceptación de montaje, permisos efectivos bajo Docker y lectura desde la
release activa corresponde al operador. Sin activación, la web debe declarar el
VPS sin fuente disponible. Las métricas prueban capacidad/recibos recientes; no
certifican por sí solas restauración futura, accesibilidad pública desde todas las
redes ni ausencia de otros fallos del host.

## Pruebas locales y fuentes oficiales

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -W error -m unittest discover -s deploy/tests -p 'test_observabilidad.py' -v
PYTHONDONTWRITEBYTECODE=1 python3 -W error -m unittest discover -s deploy/tests -p 'test_monitor.py' -v
```

Las nuevas pruebas usan temporales y transportes/syscalls ficticios. Verifican
proyección sin canarios privados, valores ausentes, certificados, recibos PASS,
mantenimiento por marcador/bloqueo, escritura atómica, permisos, errores de disco,
fallo de publicación y una sola ejecución de cada sonda. La regresión existente
mantiene el contrato de alertas, firma, recuperación y certificados.

Documentación oficial consultada antes de implementar:
[reemplazo atómico y permisos de Python](https://docs.python.org/3/library/os.html#os.replace),
[temporales exclusivos](https://docs.python.org/3/library/tempfile.html#tempfile.mkstemp),
[capacidad del disco](https://docs.python.org/3/library/shutil.html#shutil.disk_usage),
[TLS y fechas de certificados](https://docs.python.org/3/library/ssl.html#ssl.cert_time_to_seconds),
[fechas UTC](https://docs.python.org/3/library/datetime.html#datetime.datetime.fromtimestamp),
[memoria de Linux](https://docs.kernel.org/filesystems/proc.html) y
[montajes de Compose](https://docs.docker.com/reference/compose-file/services/#volumes).

Transporte Telegram: [sendMessage](https://core.telegram.org/bots/api#sendmessage)
y [espera ante límites](https://core.telegram.org/bots/api#responseparameters).
API pública n8n: [ejecuciones y redacción de datos](https://docs.n8n.io/connect/n8n-api/build-and-run/executions),
[workflows y versión activa](https://docs.n8n.io/connect/n8n-api/build-and-run/workflows),
[autenticación y alcances](https://docs.n8n.io/connect/n8n-api/authentication.md),
[paginación](https://docs.n8n.io/connect/n8n-api/pagination.md).
La clave necesita `execution:list`, `execution:read` y `workflow:list` donde la
edición admita alcances. Si la versión o el permiso no permite consultar el detalle
redactado, el fallo conserva una causa genérica y no desaparece del panel.
Next.js: guías oficiales instaladas `node_modules/next/dist/docs/` para Route
Handlers, componentes de servidor/cliente e instrumentación de arranque.
