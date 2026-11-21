# total-n8n-e2e — ensayo local de la fábrica

Fecha de cierre: 2026-11-21 13:49 (Lima). Rama y worktree propios: `total-n8n-e2e`, base `de397f3` de `version-chatgpt`. **Implementado y probado localmente; no integrado, no desplegado.** No se hizo push, merge, acceso al VPS, OAuth, pagos, mensajes reales ni publicaciones reales. D&S Factory no se utilizó.

## Resultado y alcance comprobado

**3/3 corridas finales PASS**, 447 ejecuciones n8n exitosas, 117 pasos de motor trazados, cero errores de ejecución y cero ejecuciones en espera/al vuelo al cerrar. Duración total: 75,11 s, incluido arranque, importación, traza y apagado. Las tres corridas se ejecutaron sobre la misma instancia fresca para detectar interferencias entre canales. Hubo otras dos tandas previas de tres corridas exitosas; la evidencia de aceptación corresponde al ejecutor final con auditoría de estados.

Se ejecutan los JSON generados de la fábrica sobre n8n **2.47.4 real en Podman**, con Data Tables, Code, Execute Workflow, Wait, decisiones, persistencia y retornos reales del motor. Se importan los 32 workflows; solo se publican los necesarios en la instancia de prueba. Las llamadas a proveedores externos se reemplazan exclusivamente en una copia en memoria por respuestas deterministas. El lote entregado conserva los nodos originales y sus interruptores; no contiene esos reemplazos.

La ruta ejercitada es: nicho/idea → aprobación de canal → biblia → radar → guion → aprobación de guion → storyboard de tres planos → aprobación del storyboard → archivo/imágenes y voz → composición/render y calidad → aprobación final → publicación simulada → confirmación de publicación → métricas del día 2 → aprendizaje → siguiente guion con ese aprendizaje. Cada ronda termina deliberadamente en la aprobación humana del siguiente guion.

## Copia de datos y aislamiento

Se copió una proyección de **113 filas** del SQLite del n8n local `videos-n8n`, previamente detenido: 2 canales, 5 videos, 46 planos, 26 costos, 19 trabajos y 15 aprobaciones. No se clonó el volumen completo. El exportador `tools/cooper/copiar_datos_ensayo.py` abre `mode=ro` y aplica además un autorizador SQLite por tabla/columna, rechaza vistas y consultas ajenas, sustituye identificadores por seudónimos y textos por contenido ficticio. No consulta credenciales, configuración, ejecuciones, resultados libres, pedidos, URLs ni columnas OAuth. Los canales/videos copiados se marcan eliminados en el destino del ensayo para no procesarlos. Se comparan todas las filas importadas antes/después: deben quedar idénticas.

La copia queda fuera de Git y con permisos 0600. Su manifiesto permite revisar columnas y cantidades sin exponer valores originales. El fixture versionado de tres filas permite repetir el ensayo sin disponer de la base fuente. La misión no leyó archivos `.env` reales ni valores de credenciales.

Instancia exclusiva: `cooper-total-n8n-e2e`, red interna `cooper-total-n8n-e2e-red`, puertos loopback libres y volumen nuevo bajo `~/.cache/cooper-total-n8n-e2e/`. Se rechaza reutilizar un contenedor activo o ajeno, se verifica que no haya salida a Internet y se detiene el contenedor al terminar. La infraestructura crea credenciales efímeras de prueba y no las imprime. [Entorno y regeneración verificados](evidencias/total-n8n-e2e/entorno-verificado.json); ID de la imagen `f57fc062750b990970708fc7bdd6826892bf1d07a664ec4b62dd825ebc199f7c`. No se modifica el contenedor fuente ni sus datos.

## Cortes corregidos

| Corte | Cambio | Evidencia |
| --- | --- | --- |
| El radar falla en n8n real con `Invalid output format [item 0]` después de Execute Workflow. | Proyección común de `json`, `binary` y `pairedItem`; no devuelve `metadata` interna como clave superior desde Code. Se aplica a 124 nodos, conservando emparejamiento y binarios. | Corrida roja `2026-11-21T18-20-46.471Z`; regresiones de radar múltiple, noticias, respaldo sin gasto y scan de todos los flujos. |
| Se alcanza aprobación final pero el video persistido pierde `render_url`. | Montaje y miniatura se guardan junto con la etapa antes del sello y aprobación; se valida HTTPS. Migración aditiva para ambas columnas. | Corrida roja `2026-11-21T18-25-08.632Z`; regresión hasta la proyección pública y comprobación real en cada ronda. |
| Retorno guarda aprendizaje como `listo` pero la proyección solo aceptaba `ok`; el nuevo guion no lo recibía. | Se aceptan ambos estados terminados, se ordenan fechas y se pasan hasta 12 lecciones del mismo canal al pedido real de guion. La biblia no cambia automáticamente. | 8 regresiones de aprendizaje/contexto y aserciones del payload de siguiente guion dentro de n8n. |
| El analista recibe métricas sin guion ni planos. | Se adjunta el último guion/corrección y storyboard terminados del mismo video y canal; se marca contexto incompleto y ausencia de tiempos reales. | Se coteja el pedido real de aprendizaje con guion y tres planos en cada ronda. |
| Listas de lecciones o planos con elementos nulos bloquean los consumidores. | Se descartan elementos inválidos y se conservan los válidos; contexto incompleto si no quedan planos. | Dos regresiones con listas mixtas y todos los planos nulos. |
| Callback válido de un modo distinto podía completar un trabajo pendiente. | Se exige igualdad de `job_id`, modo y estado `enviado`. | Regresión de callback cruzado, finalizado y válido. |
| Render pendiente sin límite; fallo de render, presupuesto/interruptores o error del especialista dejan el video en curso. | Máximo 40 consultas de render; estados terminales/desconocidos/sin URL se cierran. Fallos → `con_fallas`; frenos de producción → `detenido`, persistidos y sellados, respetando cancelados/eliminados. | 14 regresiones de estados, metadata y medios. El loop infinito se prueba sin esperar 30 minutos. |

El ensayo también corrigió problemas de su propio ejecutor: publicar el workflow de errores antes de importar dependencias (n8n devuelve HTTP 400 si falta esa versión), esperar persistencia de la ejecución antes de leer su pedido, usar la acción explícita del radar y comprobar `waiting` antes de enviar un formulario. Un POST de aprobación agotó 30 segundos en una repetición: la fila precedía al Wait en 35–38 ms y la ejecución seguía esperando, sin error n8n. La carrera es compatible con la evidencia, pero no hay timestamp del POST original para probar causalidad. El ejecutor ahora registra envío, respuesta y estado previo sin conservar la query firmada. No se amplió ese timeout.

## Tiempos, entradas, salidas y estabilidad

| Paso | Ronda 1 (ms) | Ronda 2 (ms) | Ronda 3 (ms) |
| --- | ---: | ---: | ---: |
| nicho e idea | 929 | 466 | 519 |
| aprobar canal y crear biblia | 1742 | 1702 | 1873 |
| radar | 677 | 690 | 740 |
| guion | 1105 | 1256 | 908 |
| aprobar guion y storyboard | 1673 | 1807 | 1601 |
| imágenes voz render y calidad | 5579 | 5921 | 5798 |
| aprobación final y publicación simulada | 1431 | 1479 | 1587 |
| métricas y aprendizaje | 829 | 949 | 1335 |
| siguiente guion recibe aprendizaje | 1855 | 1635 | 2580 |
| **Total de pasos** | 15820 | 15905 | 16941 |

Corrida final: `2026-11-21T18-37-25.645Z` (13:37:25–13:38:40 en Lima). [Resultado completo](evidencias/total-n8n-e2e/resultado.json), [traza por nodo](evidencias/total-n8n-e2e/pasos-motor.json), [cortes observados](evidencias/total-n8n-e2e/cortes-observados.json) y [manifiesto de copia](evidencias/total-n8n-e2e/copia-manifest.json).

El registro `resultado.json` contiene los nueve pasos de cada ronda con hora, duración, entrada y salida. `pasos-motor.json` añade tiempos e I/O de nodos significativos del motor, incluidos WAV, composición, render, calidad, publicaciones y aprendizaje. Los bytes de medios, cabeceras, firmas y secretos se excluyen; los textos muy grandes se resumen mediante tamaño y SHA-256. El inventario de sustituciones declara qué transportes están soportados; una ruta no soportada falla explícitamente.

Estado final comprobado en las tablas: **18/18 trabajos `listo`, 3 videos `publicado`, 3 siguientes videos en `aprobacion_guion`**, 12 aprobaciones consumidas y solo las 3 aprobaciones humanas esperadas pendientes. Los seis formularios nativos devolvieron HTTP 200 después de comprobar `waiting`. Las 113 filas copiadas permanecieron idénticas. El contenedor terminó `exited`.

## Puerta obligatoria

**Cero errores y cero advertencias** en los siete comandos, ejecutados secuencialmente sobre el código final.

| Comando | Resultado | Tiempo |
| --- | --- | ---: |
| `npm ci` | PASS | 5.97 s |
| `npm run lint` | PASS | 3.88 s |
| `npm run typecheck` | PASS | 4.89 s |
| `npm test` | 284/284 PASS | 19.07 s |
| `npm run test:e2e` | 43/43 PASS | 397.33 s |
| `npm run build` | PASS | 3.38 s |
| `node --test tests/flujos_v2.test.cjs` | 170/170 PASS (incluye wrapper de 6 pruebas Python) | 1.22 s |

[Registro de puerta](evidencias/total-n8n-e2e/puerta.json), [unitarias](evidencias/total-n8n-e2e/unitarias.log), [E2E](evidencias/total-n8n-e2e/e2e.log), [flujos](evidencias/total-n8n-e2e/flujos.log) y [resumen verificable](evidencias/total-n8n-e2e/validacion-final.json). Los demás logs están en la misma carpeta. Sentinel pasó sin hallazgos de fallo; conserva una nota informativa sobre una vista sin URL propia, cubierta por Recorridos. [Detalle](evidencias/total-n8n-e2e/sentinel-marcas.json).

La primera puerta terminó con 42/43 E2E: Sentinel no tenía su Chromium 1243 en la caché propia del worktree. Se preparó con el comando documentado del README, sin cambiar el test, el guardián ni el código de Sentinel. La primera instalación de Chromium emitió el aviso de Playwright sobre el binario alternativo para Ubuntu. Se completó la instalación en la caché y se repitió la puerta; la evidencia final corresponde a la repetición sin ese aviso. No se deshabilitaron reglas de lint ni se silenciaron advertencias.

## Commits y lote

- `257fa7c` — Corrige continuidad, medios y estados terminales de la fábrica n8n.
- `a7a2422` — Añade ensayo integral local con copia saneada y trazas de tres corridas.
- El commit de cierre incorpora este informe, evidencia y `docs/ESTADO.md` (identificable en el historial por su mensaje).

[Lote local comprimido](../../cooper/.cache/lote-total-n8n-e2e.tar.gz): **32 workflows inactivos**, esquemas/migraciones y reversa de referencia `de397f3`; 92 archivos con hashes verificados. Origen del lote: `a7a2422`. [Manifiesto](evidencias/total-n8n-e2e/lote-manifest.json) y [verificación](evidencias/total-n8n-e2e/lote-verificacion.json). SHA-256 del tar.gz: `f384490376eb11c75f956455e09595fd90550fa810697664bec3dcc51cc3a880`. La copia de datos no está incluida en el lote.

Antes de una instalación futura hay que revisar autorización/destino, obtener respaldo real y mapear IDs. Aplicar primero la migración aditiva de tablas; publicar `FabErrores000001` antes de importar sus dependencias. Conservar los ajustes y referencias de credenciales del destino. La reversa versionada es referencia de código, **no respaldo del destino**. [Procedimiento actualizado](../cooper-cobertura-despliegue.md).

## Reproducción

Desde la raíz, regenerar con `python3 tools/generar_flujos_v2.py`; los JSON deben quedar idénticos. Desde `cooper/`:

```bash
npm run test:ensayo:total
# Para usar una copia saneada previamente generada:
COOPER_TOTAL_COPIA=.cache/total-n8n-e2e/datos-copiados.json npm run test:ensayo:total
```

`COOPER_TOTAL_RONDAS` admite 1–10, con 3 por defecto. El exportador se utiliza únicamente sobre una base local detenida; instrucciones en [README](../../cooper/README.md#verificación). El lote se genera después de los commits, sin red:

```bash
python3 tools/cooper/preparar_lote_cobertura.py --base de397f3 --salida cooper/.cache/lote-total-n8n-e2e
```

## Límites reales

- Se demuestra la orquestación y sus contratos en n8n, no la calidad semántica de IA ni la disponibilidad de proveedores. Nicho, guion y aprendizaje son respuestas ficticias inyectadas a través del retorno real. El radar, verificadores y críticos usan transportes ficticios con parsers reales.
- La voz es un tono PCM sintético, la imagen un PNG válido y los planos de archivo son metadatos ficticios. Render devuelve metadatos derivados de la composición; **no se produjo ni descargó un MP4 real**. Validar HTTPS no demuestra que el medio exista o siga disponible.
- Publicación programada, confirmación y métricas son simuladas en la ruta YouTube mediante Upload-Post. La fecha de publicación se desplaza dos días solo en la instancia de ensayo. No se validaron OAuth ni cuentas/plataformas reales.
- El receptor local verifica la firma real de progreso, pero responde como fixture; este ensayo no sustituye la aceptación del puente web completo. Las aprobaciones de canal/storyboard usan formularios Wait reales; las de guion/final se conducen mediante eventos de prueba con el ID persistido. La puerta E2E web cubre por separado acceso, aislamiento y decisiones.
- No se recorrieron todas las ramas opcionales: presentador/avatar, animación de clips, YouTube directo, música, noticia y Marcas. Los transportes no soportados fallan; no se llama silenciosamente a servicios reales.
- Aprendizaje sigue disparándose en días exactos 2/7: una interrupción de todo ese día puede omitirlo. No hay tiempos reales por plano persistidos; se declara `tiempos_planos_disponibles:false`. El contexto usa el último trabajo terminado, sin una relación certificada con la versión exacta publicada si hubo revisiones posteriores.
- El límite de render no cancela el trabajo remoto ni reintenta producción. Errores de especialista sin video (nicho, biblia o aprendizaje) conservan el aviso general. La cola histórica copiada queda intacta; sus estados antiguos no se interpretan como encargos de esta prueba.

## Pendientes de Walter

1. Revisar el lote con Claude y decidir integración y destino. Esta misión no autoriza merge, push ni despliegue.
2. Autorizar separadamente un ensayo con proveedores, voz, MP4, almacenamiento y publicación reales; fijar presupuesto, modelos, perfiles, permisos y OAuth antes de activarlo.
3. Definir recuperación de mediciones perdidas de los días 2/7 y vínculo entre métricas, versión publicada y tiempos de planos. Queda documentado como ampliación pendiente, no como trabajo aprobado.
4. Aceptar las ramas opcionales y el recorrido completo Cooper→n8n→Cooper en el destino elegido, además de la aceptación del VPS ya pendiente. No reactivar esperas históricas automáticamente.

## Fuentes oficiales consultadas

- [Autenticación API de n8n](https://docs.n8n.io/api/authentication/), contrato OpenAPI empaquetado en la imagen 2.47.4 y validación oficial de salidas de Code. SHA-256 del OpenAPI: `f3d7fe99eef5890d3769e40c57697f2db0da69b134803bd65d2d04604bfc0b97`.
- [Data Table](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.datatable/rows/), [estructura de datos](https://docs.n8n.io/data/data-structure/), [metadata y $runIndex](https://docs.n8n.io/code/builtin/n8n-metadata/), [Wait](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/) y [seguridad de n8n](https://docs.n8n.io/hosting/configuration/environment-variables/security/).
- [Estados del render de Creatomate](https://creatomate.com/docs/api/reference/what-is-a-render).
- [Red interna de Podman](https://docs.podman.io/en/latest/markdown/podman-network-create.1.html).
- [SQLite URI mode=ro](https://www.sqlite.org/uri.html#uri_read_only) y [autorizador SQLite de Python](https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.set_authorizer).
