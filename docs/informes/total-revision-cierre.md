# Revisión documental del cierre de cooper-total

21-11-2026, 15:12 Lima. Base revisada **`9640b13`**, rama/worktree propios `total-competencia-revision`. Alcance inicial: leer documentos/código públicos y editar únicamente este memo y `faltantes-total.md`; sin VPS, APIs externas, producto, ESTADO ni informe del orquestador. La revisión conserva los cortes históricos y separa implementación, prueba local, despliegue y aceptación.

## Resultado

El inventario original sigue siendo útil como auditoría de `de397f3`, pero sus veinte A y trece B no son un conteo vigente. Se añadió una matriz individual H01–H21 y se rotularon explícitamente los cuadros anteriores como históricos. No aparece un defecto nuevo del Radar que justifique otra llamada o un cambio del parser. Su recorrido completo y respaldo gratuito están aceptados; formatos, TikTok y contenido vidIQ productivo conservan límites concretos.

Los pendientes técnicos conocidos siguen bajo responsabilidad de Codex: dos rondas limpias, activación/aceptación de la imagen e infraestructura finales, instalación opaca de Marcas, copia/restauración/arranque posteriores y publicación de las dos ramas. Ninguno se convirtió en B. H19 quedó ampliado con una validación aislada: integridad y transporte pasan con swap, pero el límite de 1 GiB sin swap revela un OOM administrativo reproducible, incluso con funciones compiladas. Es un pendiente técnico A; no se presenta el presupuesto experimental anterior como SLA.

## Afirmaciones caducadas detectadas

Referencias de esta tabla a las líneas de **`9640b13`**; el orquestador conserva la edición de ESTADO y `cooper-total.md`.

| Lugar | Texto o implicación anterior | Conciliación que corresponde |
| --- | --- | --- |
| `cooper-total.md:17` y seguimiento H05 de `faltantes-total.md` | Tres cuentas/replay; no recorrido íntegro; retiro en cierre. | Usar 865–873 success, cuatro identidades/30 muestras, persistencia/proyección idénticas y seis 404 sin nuevas ejecuciones. `total-competencia-runtime.md:86`, `:90`, `:104`. |
| `cooper-total.md:55` | Falta aplicar lote y aceptar Radar íntegro. | El lote ya aplicado y aceptación íntegra están acreditados; conservar la historia del fallo `metadata`, sin dejarlo abierto como estado actual. |
| `cooper-total.md:17` | Acceso y consultas vidIQ descritos junto a aceptación productiva. | Separar sondeo 864 (acceso/cuota) de 870 (contenido no acreditado, respaldo conservado). Causa no recuperable porque `runData` quedó vacío; no es fallo de cuenta demostrado. `total-competencia-runtime.md:94`, `:96`. |
| `faltantes-total.md`, B13/H11 | UTC todavía vigente y decisión de cambiarlo pendiente. | Código y UI usan Lima: `periodos.ts:2`, `datos.ts:102`, `mensajeria/cola.ts:149`, `admin.tsx:101`, regresión `tests/flujos_v2.test.cjs:2141`. Retirar B13 actual; conservar la decisión histórica original. |
| `faltantes-total.md`, B05 | Confirmar vigencia de conexión YouTube como pendiente general. | Google renovó el permiso existente y Data API confirmó el video; Analytics respondió vacío. No pedir reautorizar sin fallo. `total-aprendizaje-aceptacion.md:101`. |
| `total-radar-contexto.md:21`, `:41`, `:49` | Fuentes reales y aceptación todavía pendientes. | Corte operativo 14:44 correcto en su hora; añadir referencia al runtime posterior si se actualiza su encabezado. No atribuir a operación pruebas que hizo competencia. |
| `total-aprendizaje-aceptacion.md:106`, `:112` | Getter Tok01 publicado y M7 inactivo/activación recomendada. | Getter retirado después por competencia; M7 activo, ejecución automática 878 y versión directa comprobadas. `total-competencia-runtime.md:104`; `total-aprendizaje-horario.md:17`. |
| `total-volumen-n8n.md:5`, `:13` | No integrado/desplegado; delta en preparación. | Describe el corte de medición. Resolver ya entró en el delta de tres flujos: `total-radar-contexto.md:25`, `:29`. El límite de la medición sigue vigente. |
| `total-marcas-runtime.md:3`, `:24` | Imagen `970d102` llamada definitiva. | Es definitiva para aquel frente, no para el cierre actual: la candidata actual es `bfd5e79`, ensayada pero todavía sin activar en este corte. `total-imagen-bfd5e79.md:7`, `:9`. |
| `cooper-total.md:15` | 44→45 workflows y 126 filas próximos a “delta final”. | Distinguir cortes: delta inicial, migración de dos columnas con 130 filas y lote posterior con 144 filas. Las diferencias no significan pérdida ni creación por la migración. `total-cierre-aceptacion.md:87`, `:91`; `total-radar-contexto.md:29`. |

El orquestador comunicó que corrigió competencia/M7 en `bfd5946` durante esta revisión. Este memo conserva la base examinada; no sobrescribe esa consolidación posterior.

## H19: análisis previo y propuesta mínima, 15:12 Lima

El máximo **1.070 ms** incumple el presupuesto comparativo elegido de 1.000 ms; **no** demuestra un SLA incumplido ni una exigencia temporal formulada por Walter. La corrección eliminó el recorrido cuadrático y conservó los hashes. No convertir un FAIL experimental en PASS, ni elevarlo por sí solo a una avería de producción.

Los **48,99 MiB** provienen del fixture de 10.000 videos: el arnés ejecuta el Resolver canónico y serializa `result.respuesta` para medir bytes/hash fuera del tiempo (`tools/cooper/medir-volumen-n8n.cjs:71`, `:86`). **No son bytes observados en una transferencia HTTP real** ni tamaño de la base actual del VPS. El fixture tiene guiones de 4 KiB y unas 40.000 filas auxiliares; no ensaya lecciones/conexiones voluminosas, múltiples escenas por video ni concurrencia.

El riesgo tiene un camino concreto en el producto:

1. `tools/cooper/resolver.js:25` proyecta todos los videos autorizados, con guion limitado por video a 30.000 caracteres; `:29` devuelve el array completo, sin límite agregado.
2. `workflows/v2/FabCooperAPI0001.json:534`, nodo `Responder`, envía `$json.respuesta` como JSON. Es la respuesta al evento interno **`estado`** del puente, no un benchmark del `GET /api/estado` de Cooper.
3. `cooper/src/servicios/fabrica.ts:499`, `:524`, `:580` hacen POST al puente, leen `response.json()`, validan y aplican el snapshot. `cooper/src/servicios/puente.ts:70` aplica sus videos dentro de la transacción existente.
4. SSE `cooper/src/app/api/eventos/route.ts:58`–70 sincroniza como máximo cada 60 segundos en modo n8n; para administrador recorre los usuarios. La solicitud conserva `admin:true` cuando corresponde (`fabrica.ts:447`). Esto identifica el camino potencial, sin cuantificar aquí un fallo bajo concurrencia.
5. El `GET /api/estado` de Cooper es otra etapa: `cooper/src/app/api/[...ruta]/route.ts:123` serializa `datos.estado(user)`; `cooper/src/servicios/datos.ts:41`–50 lee todos sus videos locales. No se midió HTTP ni renderizado de esa etapa.

**Propuesta mínima A de validación, antes de modificar producto:** reutilizar el fixture y las huellas por dueño/administrador en un ensayo aislado de HTTP real → validación/aplicación del snapshot → lectura local. Medir tamaños, tiempo total y memoria con límites reales del cliente; comprobar ausencia de truncamiento, duplicados y mezcla de dueños. La medición decidirá si existe un defecto material y dónde. No recortar historia, cambiar `returnAll`, introducir paginación unilateral ni pedir a Walter una decisión para explicar un resultado todavía no medido.

El orquestador autorizó esta ampliación de ensayo durante la revisión: solo pruebas/artefactos/documentación, CPU 2–3 coordinada con operación, sin producto ni VPS. En este commit documental la ampliación está **pendiente de ejecución**; sus resultados se añadirán por separado.

## H19: ensayo HTTP y límite de memoria, 15:35 Lima

**Resultado: A de capacidad confirmada, todavía sin corrección de producto.** Se completó la ampliación autorizada y se encontró un fallo material del escenario grande bajo la condición de memoria del host. El éxito con swap no sustituye ese fallo. No se cambió Cooper, su contrato, el generador, las credenciales, los servicios ni el VPS.

El arnés nuevo es `tools/cooper/ejecutar-volumen-http.mjs` + `medir-volumen-http.mjs`. El arnés Data Tables anterior incorpora únicamente exportación opcional de los cuatro snapshots y tiempo de serialización, sin cambiar su proyección. Fixture idéntico de 10.000 videos; **los cuatro hashes completos coinciden con la medición previa**. Se ejecutan los nodos/repositorio SQLite n8n reales para producir los snapshots; después se sirven esos bytes por HTTP. El tiempo de consulta/Resolver se informa aparte: no se afirma haber ejecutado el servidor/grafo completo de n8n durante el HTTP.

Dos contenedores rootless comparten solamente el namespace loopback sin red externa, sin puertos publicados, HOME, sockets, entornos reales ni bases existentes. Aplicación a **1 CPU, afinidad 2–3, 1 GiB RAM**; proveedor/verificador a 1 CPU/2 GiB. Cooper usa SQLite nueva y usuarios ficticios, `FabricaN8n` real con timeout predeterminado de 10 s y validación/aplicación real. El GET usa el mismo `estado(user)` → `json(...)` de la ruta; el usuario ficticio está autenticado previamente. No se ejecutan Next, su sesión, el navegador, SSE ni renderizado. El verificador hace conexiones HTTP nuevas y comprueba contenido fuera del cgroup de aplicación; el transporte interno de FabricaN8n conserva su `fetch`, timeout y reintentos productivos. Ambos servidores conservan **keepalive 5 s por defecto**.

Por caso se ejecutan sincronización inicial, calentamiento y tres sincronizaciones repetidas; luego tres GET completos. Se comparan IDs, dueño/canal, títulos, etapas, guiones completos, observabilidad/historia y canales contra el contrato normalizado. Los bytes de los tres GET coinciden entre sí. Cada sincronización correcta requirió una petición, sin reintentos ocultos, publicaciones ni avisos. La preparación y las huellas no se incluyen en el tiempo del proceso de aplicación.

### Resultado con swap permitido: funcional, condicionado

[Resumen](evidencias/total-revision-cierre/h19-http/resumen.json), [origen](evidencias/total-revision-cierre/h19-http/origen-http.json) y [administrador completo](evidencias/total-revision-cierre/h19-http/administrador-http.json).

| Caso | Videos | Entrada / salida HTTP MiB | Primera sincronización ms | Máximo estable ms | Máximo GET + parse ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Usuario 0 | 999 | 4,945 / 5,121 | 543,83 | 300,65 | 97,95 |
| Usuario 9 | 900 | 4,456 / 4,615 | 470,37 | 275,54 | 81,16 |
| Administrador | 9.896 | 48,993 / 50,726 | 4.120,52 | 1.943,22 | 1.040,40 |
| Sin recursos | 0 | 0,000025 / 0,001223 | 12,64 | 4,37 | 44,05 |

Los **51.372.372 bytes** de entrada administrativa y **53.189.871 bytes** de salida ya son transporte HTTP real del fixture, no solo `JSON.stringify`. Ese tamaño no describe los datos actuales del VPS. En administración, `estado` tardó como máximo 266,01 ms y su serialización 264,06 ms; el resto del GET incluye transferencia/parse. Se preserva por separado el FAIL comparativo histórico 1.070/1.000 ms, sin convertirlo en SLA ni reemplazarlo por resultados de otra CPU/topología.

La aplicación alcanzó `memory.peak=1.073.741.824`, `memory.events max=77`, OOM/kill=0 y **swap pico 414.932.992 bytes (395,71 MiB)**. El RSS máximo del proceso fue 1.036,26 MiB. El pico cgroup incluye page cache y recursos del contenedor; RSS/maxRSS y heap son medidas distintas y no se deben equiparar. Ese resultado no prueba margen de RAM ni capacidad sin swap.

### Contraste con la condición real: sin swap

Operación comunicó metadatos de solo lectura del VPS a las 15:30: Cooper tiene límite RAM 1 GiB y swap permitido 1 GiB, pero el host registra **SwapTotal=0 / SwapFree=0**. Por eso se repitió con `--memory=1g --memory-swap=1g`, verificando dentro `memory.swap.max=0`. No se cambió el VPS para favorecer el ensayo.

- **tsx:** usuarios 999/900 PASS; administrador completa las cinco sincronizaciones, entra al primer GET y termina **exit 137 / OOMKilled=true**, antes de registrar la serialización. Antes del GET: RSS 934,02 MiB, heap 120,84 MiB y cgroup 989.990.912 bytes. [Log de etapas](evidencias/total-revision-cierre/h19-http/sin-swap-tsx/administrador-aplicacion.log), [estado del contenedor](evidencias/total-revision-cierre/h19-http/sin-swap-tsx/administrador-contenedor.txt), [origen](evidencias/total-revision-cierre/h19-http/sin-swap-tsx/origen-http.json).
- **Compilado fuera del proceso:** las mismas funciones se agrupan con esbuild del lockfile existente, sin instalar paquetes ni cargar tsx/compilador en la aplicación. Usuarios 999/900 PASS; administrador completa las cinco sincronizaciones, alcanza la serialización del primer GET y termina **exit 137 / OOMKilled=true** durante la respuesta. Antes del GET: heap 103,99 MiB, external 102,33 MiB (arrayBuffers 98,30), RSS 960,31 MiB; tras serializar, RSS 1.063,18 MiB y cgroup 1.073.561.600 bytes. [Log de etapas](evidencias/total-revision-cierre/h19-http/sin-swap-compilado/administrador-aplicacion.log), [estado del contenedor](evidencias/total-revision-cierre/h19-http/sin-swap-compilado/administrador-contenedor.txt), [origen y hash del bundle](evidencias/total-revision-cierre/h19-http/sin-swap-compilado/origen-http.json).

En el compilado, tras GC y antes de la última sincronización, heap ≈14,55 MiB y external ≈4,35 MiB, pero RSS ≈910,51 MiB. Esto descarta atribuir el OOM solamente al loader o a snapshots/buffers del verificador: la aplicación no los monta. **No identifica todavía qué asignaciones nativas, SQLite o allocator explican la residencia.** La compilación de ensayo ejecuta las funciones reales, pero no es el bundle Next de producción; se declara esa diferencia. El caso sin recursos quedó NOT_RUN en ambas pasadas sin swap porque el lanzador se detiene al fallo; no se reutiliza su PASS con swap como si fuera otra prueba.

### Causa delimitada y siguiente trabajo A

Está probado que el proceso que sincroniza el snapshot grande queda cerca del techo y falla al construir/enviar el estado completo con 1 GiB sin swap. No se ha demostrado un problema de credencial, cuenta, retención funcional o timeout. Tampoco puede asegurarse que una única operación concreta sea la causa del consumo nativo.

Propuesta mínima al orquestador: aislar la aplicación del snapshot de la lectura/serialización y contrastar la reutilización de consultas preparadas dentro de `aplicarEstado`, sin modificar el contrato ni truncar historia. La fuente de Drizzle instalada prepara de nuevo cada consulta; el bucle actual repite búsqueda de dueño/canal/video y actualización por video. Es una **hipótesis de optimización a medir**, no una causa probada ni un cambio aplicado. Cualquier corrección debe conservar las huellas completas y pasar esta carga sin swap. No se propone aumentar límites, instalar swap ni introducir paginación unilateral. Navegador/renderizado, SSE y concurrencia siguen fuera de este ensayo.

### Reproducción, intentos y comprobaciones

```bash
node tools/cooper/ejecutar-volumen-http.mjs /ruta/cache-publica/node_modules
node tools/cooper/ejecutar-volumen-http.mjs /ruta/cache-publica/node_modules --compilado
node --test tests/volumen_n8n.test.cjs
node --test tests/flujos_v2.test.cjs
```

El lanzador exige lockfile idéntico para reutilizar dependencias, comprueba nombres privados antes de archivar y monta solo fuentes públicas/caché de dependencias. La imagen n8n se fija por digest; la imagen CI local se registra por ID. Los snapshots voluminosos y el bundle quedan en caché local: los recibos versionados conservan hashes, cantidades, métricas y logs de datos ficticios.

Las [pasadas iniciales](evidencias/total-revision-cierre/h19-http/pasadas-previas.json) se conservan separadas: un proceso mezclaba aplicación y verificador, por lo que sus picos no se atribuyen a Cooper. Una de ellas tuvo `ECONNRESET`: **fallo de transporte en esa ejecución del ensayo, causa exacta no demostrada**. Tenía keepalive predeterminado; otras dos pasadas mixtas usaron 60 s. La topología final volvió a 5 s predeterminado, separó procesos y conexiones del verificador. No se afirma causalidad por keepalive ni se ocultó un fallo con un cambio de servidor. Los `ECONNRESET` sin swap sí se acompañan de OOMKilled/137 del contenedor. También hubo una [preparación fallida del compilador](evidencias/total-revision-cierre/h19-http/compilacion-previa.json) al buscar esbuild como paquete raíz; se corrigió usando la dependencia ya instalada de tsx.

Pruebas focales **4/4**, flujos **173/173**, sintaxis de los tres ejecutores y `git diff --check` PASS, sin advertencias en esas comprobaciones. [Focal](evidencias/total-revision-cierre/h19-http/focal.log), [flujos](evidencias/total-revision-cierre/h19-http/flujos.log). El benchmark sin swap queda **FAIL**, sin renombrarlo como puerta verde. No se repitió la puerta web por instrucción del orquestador; este frente no se atribuye sus rondas. Ningún contenedor de ensayo sigue activo.

## Lecturas, comprobaciones y límites

Se contrastaron `faltantes-total.md`, `cooper-total.md`, ESTADO, los informes actuales de competencia/runtime, contexto Radar, aprendizaje/horario, chat, imagen exacta, cierre operativo, Marcas runtime, M01/M03/M05/M07/M10/M11/M12, retención integrada y volumen n8n. También los caminos de Resolver, cliente del puente, aplicación/lectura de estado y SSE, y las funciones/pruebas de periodos Lima. La revisión no consultó archivos de entorno, valores de claves, payloads privados ni logs de producción.

`git diff --check` y verificación de rutas/referencias añadidas pasan. No se ejecutó otra puerta web en esta revisión documental: se conserva la puerta 5 de raíz y sus rondas todavía pendientes; no se atribuye a este memo una prueba de aplicación inexistente. La ampliación H19 tampoco contará como puerta ni como aceptación del VPS.

## Pendientes de Walter

No se agregan. Se conservan los accesos/consentimientos, aprobación editorial y de publicación, custodia y política de retención ya separados en la matriz. Un error anterior M7 de causa desconocida no se convierte en una petición de reautorizar Google: existe éxito automático posterior y no se recuperó una causa concreta.


## H19: corrección de sentencias y aceptación sin swap, 15:50 Lima

**La causa de la presión nativa está demostrada y el arreglo `fd585f0` supera el caso que antes terminaba OOM.** El orquestador autorizó corregir este faltante A después del fallo documentado arriba. El producto cambia únicamente `cooper/src/servicios/puente.ts`; la nueva regresión está en `cooper/tests/puente-capacidad.test.ts`. La puerta completa, integración, nueva imagen y rondas corresponden al cierre de raíz y no se atribuyen a este ensayo. No se tocó el VPS.

### Diagnóstico reproducible

Una extensión SQLite **exclusiva del laboratorio**, compilada con los headers instalados, devuelve contadores numéricos `SQLITE_DBSTATUS_STMT_USED`, caché y esquema. El observador de `prepare` conserva únicamente SHA256 y conteos de formas SQL; no retiene sentencias, SQL crudo ni valores. Según la [documentación oficial de SQLite](https://www.sqlite.org/c3ref/c_dbstatus_options.html), STMT_USED aproxima la memoria nativa de las sentencias preparadas de esa conexión; no es RSS ni todo el heap. La lectura usa `resetFlg=0`, conforme al [contrato de db_status](https://www.sqlite.org/c3ref/db_status.html). `sqlite3_memory_used()` devuelve cero en esta compilación: se conserva en los recibos, **no se interpreta como memoria nula ni se utiliza para cuantificar la causa**.

| Administrador / misma entrada | Antes | Después, con perfilador |
|---|---:|---:|
| Preparaciones de la primera sincronización | 59.674 | 9.903 |
| Formas SQL de la primera sincronización anterior | 7 | — |
| Preparaciones nuevas por sincronización estable | 39.882 | 7 |
| STMT_USED al terminar la primera sync | 551.252.437 bytes | 71.141.375 bytes |
| STMT_USED al terminar sync estable | 293.362.677 bytes | 58.407 bytes |
| Caché SQLite anterior | 16.847.293 bytes | — |
| Resultado de las cinco sync y primer GET | OOMKilled / 137 | PASS, incluidos tres GET |

Las 9.896 consultas restantes de la primera carga corregida corresponden al encolado existente, que no se cambió. No son duplicados ocultos ni se deshabilitaron avisos para ganar memoria. La causa acreditada es crear miles de sentencias equivalentes durante cada lote síncrono; su liberación posterior no evitaba que el proceso quedase cerca del techo antes del GET. No se atribuye al contador global, a una fuga indefinida del driver ni a un fallo de la cuenta.

Recibos separados: [antes](evidencias/total-revision-cierre/h19-http/diagnostico-antes/administrador-aplicacion.log), [OOM anterior](evidencias/total-revision-cierre/h19-http/diagnostico-antes/administrador-contenedor.txt), [después perfilado](evidencias/total-revision-cierre/h19-http/diagnostico-despues/administrador-http.json). En ambas comparaciones no se invocó GC artificial en el proceso de aplicación; la aceptación siguiente ni siquiera lo expone.

### Corrección y semántica preservada

`aplicarEstado` prepara seis consultas una vez dentro de cada transacción y las reutiliza con parámetros. Las lecturas permanecen por fila y ven los cambios previos del lote, incluidos IDs repetidos. El UPSERT solo actualiza los campos anteriores mediante los valores `excluded` del registro propuesto; no cambia dueño, canal, fecha de creación ni estado de producción. Se conservan transacción inmediata, rollback, conflictos 409, cancelación, orden de revisiones, observabilidad con revisión igual, valores omitidos y encolado real. No hay caché global, recolección forzada, límite aumentado, paginación ni truncamiento. Se contrastaron las APIs oficiales de [consultas preparadas Drizzle](https://orm.drizzle.team/docs/perf-queries), [UPSERT Drizzle](https://orm.drizzle.team/docs/guides/upsert) y [UPSERT SQLite](https://www.sqlite.org/lang_upsert.html).

Tres regresiones nuevas verifican: preparación constante en 256 filas durante tres ciclos; duplicados/revisiones/cancelación/observabilidad; y aislamiento más reversa de canales, videos y avisos ante conflicto posterior. El **control negativo** ejecuta esas pruebas contra el archivo anterior en una copia: la primera falla por **1.283 > 8** preparaciones y las otras dos conservan su resultado correcto. El producto corregido pasa las tres más las 55 existentes de puente/WhatsApp: **58/58**, typecheck y lint a cero errores/advertencias. [Control anterior](evidencias/total-revision-cierre/h19-http/regresion-memoria/control-anterior.log), [pruebas corregidas](evidencias/total-revision-cierre/h19-http/regresion-memoria/pruebas.log), [typecheck](evidencias/total-revision-cierre/h19-http/regresion-memoria/typecheck.log), [lint](evidencias/total-revision-cierre/h19-http/regresion-memoria/lint.log). El primer arranque de Vitest con caché de dependencias solo lectura no pudo crear `.vite-temp`; se usó su cargador nativo de configuración sin modificar producto/dependencias.

### Aceptación sin instrumentos que alteren SQLite

Se repitió la topología de dos cgroups descrita arriba con **aplicación compilada, sin extensión, sin observador de sentencias, sin tsx/compilador y sin `--expose-gc`**. El ejecutor exige que `globalThis.gc` sea inexistente en aplicación. El generador/verificador conserva su propio GC fuera de ese proceso/cgroup. Límite RAM **1 GiB**, swap máximo/pico **0**, 1 CPU/afinidad 2–3, keepalive predeterminado 5 s y timeout FabricaN8n 10 s. Cinco sincronizaciones consecutivas y tres GET por actor; una petición por sync y cero reintentos. Compilar ocurre antes y fuera del límite de aplicación. No hubo tráfico externo, servicios reales ni credenciales.

| Actor | Videos | Sync inicial ms | Sync estable máx. ms | GET + parse máx. ms | Pico cgroup MiB | Resultado |
|---|---:|---:|---:|---:|---:|---|
| Usuario 0 | 999 | 198,28 | 61,99 | 45,03 | 197,56 | PASS |
| Usuario 9 | 900 | 154,30 | 69,54 | 52,86 | 176,41 | PASS |
| Administrador | 9.896 | 1.101,62 | 428,68 | 590,29 | 604,85 | PASS |
| Sin recursos | 0 | 13,61 | 4,35 | 7,02 | 153,73 | PASS |

El administrador mantiene **51.372.372 bytes entrantes y 53.189.871 bytes de estado saliente**: no se recortaron guiones, observabilidad ni historia. La comparación normalizada exige hashes completos de todos los videos/canales, IDs, dueños y campos remotos; los tres GET tienen además el mismo hash de respuesta completa dentro de la ejecución. El fixture y los cuatro snapshots coinciden exactamente con el ensayo n8n original. El archivo de producto sobrepuesto al archivo Git tiene SHA registrado y coincide con `fd585f0`; así no se confunde la base archivada `762a1d9` con el producto medido. [Resumen verificable](evidencias/total-revision-cierre/h19-http/correccion-resumen.json), [procedencia y comandos](evidencias/total-revision-cierre/h19-http/aceptacion-sin-swap/origen-http.json), [administrador completo](evidencias/total-revision-cierre/h19-http/aceptacion-sin-swap/administrador-http.json).

Memoria administrativa: pico cgroup **634.228.736 bytes**, RSS máximo del proceso **571,26 MiB**, heap muestreado máximo **138,81 MiB**, external máximo **105,83 MiB**, arrayBuffers máximo **101,77 MiB**. No son picos simultáneos ni magnitudes sumables; cgroup incluye page cache, external incluye arrayBuffers. Eventos cgroup `max=0`, `oom=0`, `oom_kill=0`; todos los contenedores terminan `exited 0 false`. SQLite/lectura de estado alcanza 251,57 ms y serialización 117,17 ms, separadas de transporte/parse. El PASS acredita este escenario, no una promesa general de margen de memoria.

H19 queda **corregido y probado localmente**, pendiente de la puerta/imagen/despliegue que coordina raíz. Conservamos el FAIL anterior y el presupuesto comparativo histórico de 1 s incumplido; este último nunca fue SLA de Walter. La aceptación no ejecuta el servidor Next completo ni su autenticación real, navegador, renderizado, SSE o concurrencia; tampoco acredita tamaños superiores ni reduce la respuesta grande. Esos límites no se convierten automáticamente en trabajo nuevo aprobado. No se añaden pendientes de Walter.
