# Cooper — integración 3 y despliegue en la PC

Rama/worktree propios `cooper-integracion3`, base `16341ab`. Walter autorizó expresamente integrar a `version-chatgpt` y `main`, hacer push y actualizar Cooper local. Los cambios de n8n se entregan a Claude como lote; no se aplicaron en vivo. No se realizaron logins OAuth, pagos ni cambios en D&S Factory, ni se leyeron/copiaron archivos de entorno reales.

## Integración y correcciones

Se ejecutaron las fusiones en el orden solicitado: Pulido (`88e8d2c`), Memoria (`a2ae99d`), Cobertura (`d98d497`), Marcas (`57a1a28`) y Animación (`da4d2eb`). Todos son ancestros del resultado. Las resoluciones de Pulido/Memoria reutilizan la combinación ya comprobada por Cobertura; Marcas y Animación conservan sus pantallas, pruebas, contratos y controles.

- Diario SQLite: las ocho migraciones originales permanecen intactas; siguen `0008_observabilidad`, `0009_memoria` y `0010_marcas`. La migración de Marcas se renumeró antes de aplicarla en el destino, que tenía ocho entradas. Las bases experimentales con `0008_marcas` requieren una migración específica.
- Estado SSE: se conserva la celebración ante una publicación nueva y la deduplicación de estados idénticos que evita repintados y acumulación de oyentes.
- Galería: la decoración animada usaba la misma clase que las piezas del video y las sacaba de su sección. La regresión geométrica falló y pasó al separar las clases. Evidencia: `galeria-rojo.log` / `galeria-verde.log`.
- Accesibilidad: canales homónimos producían menús con la misma etiqueta. Cada menú ahora distingue su posición. La regresión falló y pasó, y la matriz conserva todas las reglas de axe. Evidencia: `canales-rojo.log` / `canales-verde.log`.
- Inventario regenerado: 32 flujos, 1.211 nodos, 121 decisiones/esperas, 58 ajustes y nueve Data Tables; incluye los dos trabajadores inactivos de Marcas. Regenerar los workflows no produjo diferencias.
- Unidad local con migraciones previas al arranque y Marcas explícitamente simulada, incluido el complemento de systemd que reemplaza ExecStart.

## Commits propios

| Commit | Contenido |
| --- | --- |
| `2fc24f5`, `43f8dd5`, `a5d75c5`, `79c84a9`, `9120fa8` | Cinco fusiones en orden, con conflictos resueltos. |
| `a34e52c` | Galería de medios sin solapamiento con la decoración. |
| `72e8113`, `63871ae` | Suite conjunta, recorridos continuos y caché compatible de Sentinel. |
| `8235ca4`, `23243cd` | Procedimiento de despliegue/reversa y modo simulado de Marcas en systemd. |
| `3fe9ca2`, `fb60821` | Lighthouse completo con Marcas y reproducción documentada. |
| `32d3d84`, `93fc516` | Selectores accesibles y ensayo de publicación con varias cuentas demo. |
| `0577c44` | Menús únicos para canales homónimos y regresión. |
| `5df225f` | Índice que prioriza los recorridos completos. |
| `6ac683f` | Conserva el cierre concurrente del VPS (`1883fb3`), solo documental. |

## Puerta obligatoria

Ejecutada secuencialmente sobre `5df225f`, con código de aplicación `0577c44`. Las fusiones y el cierre posteriores solo añaden documentación/evidencias; [las huellas de los árboles](evidencias/cooper-integracion3/fuentes.json) conservan la correspondencia. No se volvió a cambiar el producto después de las dos rondas limpias.

| Comando | Resultado |
| --- | --- |
| `cd cooper && npm ci` | rc 0; cero vulnerabilidades |
| `npm run lint` | rc 0; cero errores/advertencias |
| `npm run typecheck` | rc 0 |
| `npm test` | 284/284, 30 archivos |
| `npm run test:e2e` | 43/43; sin omisiones ni reintentos |
| `npm run build` | rc 0 |
| Desde raíz: `node --test tests/flujos_v2.test.cjs` | 147/147 |

Los siete pasos registraron **cero errores y cero advertencias**. [Resultado, tiempos y hashes](evidencias/cooper-integracion3/puerta/resultado.json); registros individuales en la misma carpeta. Los hashes de los siete registros se comprobaron antes de incorporarlos. Las copias versionadas normalizan únicamente saltos de línea y espacios finales para pasar `git diff --check`; conservan el contenido diagnóstico. `sha256_original` identifica cada registro crudo de la caché y `sha256` su copia versionada; [mapa de normalización](evidencias/cooper-integracion3/normalizacion-registros.json).

## Dos rondas, videos y auditoría

Se ejecutó `playwright.integracion3.config.ts`, que reúne las E2E habituales, memoria, Marcas, movimiento, estrés, Sistema Sentinel y los recorridos continuos. Dos rondas finales consecutivas limpias, sin desactivar guardianes ni usar retries:

| Medida | Ronda 4 | Ronda 5 |
| --- | --- | --- |
| Playwright | 58/58 | 58/58 |
| Fallos / omitidas / inestables | 0 / 0 / 0 | 0 / 0 / 0 |
| Matriz visual | 22 rutas × 2 temas × 2 anchos | 22 rutas × 2 temas × 2 anchos |
| FPS mínimo de la matriz | 60,00 | 59,51 |
| Frame máximo | 16,8 ms | 33,4 ms |
| Tareas largas / CLS | 0 / 0 | 0 / 0 |
| Acciones Sentinel (1440 + 390) | 6.185 + 9.591 | 6.258 + 8.895 |
| Rutas Sentinel (1440 / 390) | 37 / 36 | 37 / 36 |
| Congelamientos / caídas / hallazgos no informativos | 0 / 0 / 0 | 0 / 0 / 0 |
| Videos | 94 | 94 |

La matriz móvil usa CPU 4×. Sentinel acumuló 30.929 acciones y 386 muestras de estabilidad. Sus muestras breves durante caos **no son la medición continua de la matriz**: escritorio tuvo 35 de 562 muestras por debajo de 45 FPS, con mínimos puntuales de 20; móvil estuvo entre 60 y 61. No se observó congelamiento ni caída y no hubo hallazgos de gravedad superior a `info`. Se conservan esos mínimos sin presentarlos como 60 FPS constantes.

Los avisos `info` de Sentinel describen pestañas sin URL propia (Fábrica móvil y Aprendizaje de Marcas); recorridos las abre y Playwright comprueba sus controles explícitamente. Playwright también emite la sugerencia informativa de paralelizar el archivo lento de Sentinel; se mantiene secuencial para medir sin competencia entre navegadores. No son advertencias de la puerta.

Los **188 WebM** se verificaron con `ffprobe` y se decodificaron íntegramente con `ffmpeg`, código 0 y salida de errores vacía. Resoluciones exactas 1440×900 y 390×900; cuatro recorridos completos de 40–46 segundos y 184 clips de pantallas/estados. La cadencia del archivo grabado no equivale al muestreo RAF de rendimiento.

[Índice reproducible local](../../cooper/.cache/videos-integracion3/index.html), [recorrido final escritorio](../../cooper/.cache/videos-integracion3/ronda-5/recorrido-completo-1440.webm), [recorrido final móvil](../../cooper/.cache/videos-integracion3/ronda-5/recorrido-completo-390.webm) y [metadatos/hashes verificados](evidencias/cooper-integracion3/videos.json). Los archivos de video permanecen en `cooper/.cache/videos-integracion3/`; el índice incorpora exclusivamente rondas limpias. También se inspeccionaron capturas de escritorio y móvil, ambos temas, Marcas, galería y Operación.

Lighthouse completó **88 mediciones** (22 rutas × 2 temas × 2 formatos): rendimiento **97–100**, accesibilidad **100**, buenas prácticas **100**, cero advertencias y cero auditorías binarias fallidas. [Resumen íntegro](evidencias/cooper-integracion3/lighthouse.json). Las mediciones son de laboratorio Chromium local, sin tráfico ni métricas de campo.

[Resumen de las rondas](evidencias/cooper-integracion3/rondas-resumen.json), matrices por pantalla y reportes de Sentinel en las subcarpetas `ronda-4` y `ronda-5`. Las cuentas, videos, publicaciones y sesiones de esas pruebas son ficticios; no se incluyen cookies ni archivos de sesión en Git.

Los intentos anteriores se conservan y no cuentan como rondas limpias: ronda 1 encontró la caché incompatible de Chromium de Sentinel; ronda 2, un selector que asumía un solo ejemplo demo; ronda 3 detectó las etiquetas repetidas de canales. No se desactivaron evaluadores, guardias ni reglas de accesibilidad, ni se añadieron reintentos para ocultar fallos.

## Publicación de Git, respaldo e instalación

Se preservó el avance concurrente del VPS `1883fb3` mediante la fusión documental `6ac683f`. A las 09:54 Lima se hizo fast-forward de las dos ramas locales y **push atómico a `mio/version-chatgpt` y `mio/main`**, verificando ambos refs remotos. [Registro de publicación](evidencias/cooper-integracion3/publicacion-6ac683f.json). El remoto `origin` no se modificó. El cierre documental se publica después por el mismo procedimiento; su commit se identifica con `git log -1 -- docs/informes/cooper-integracion3.md`.

Los archivos previos sin seguimiento `docs/ESTADO.md` y `docs/misiones/cooper-memoria.md` del checkout original se conservaron, con hashes comprobados, en `.cache/integracion3-preservados/`. Los demás archivos ajenos permanecieron intactos.

La instalación fija `~/.local/share/cooper/app` pasó de `a6df189` a `6ac683f` (mismo producto probado que `5df225f`). `npm ci`, build y verificación de systemd finalizaron sin advertencias. Se actualizaron la unidad y su complemento `chat-planes.conf`; las migraciones se aplicaron en `ExecStartPre`. Después del commit de cierre se puede avanzar el checkout a ese commit documental sin cambiar el build aprobado.

- Respaldo final: `~/.cache/cooper-integracion3/respaldo-20261121-095409/cooper.sqlite`, directorio 0700 y archivos 0600; SHA-256 verificado en [despliegue.json](evidencias/cooper-integracion3/despliegue.json).
- SQLite: **8 → 11 migraciones**, integridad `ok`, cero fallos de claves foráneas y conteos de las **21 tablas anteriores conservados**. [Conteos antes/después](evidencias/cooper-integracion3/conteos-despliegue.json).
- `cooper.service`: `active/running`, cero reinicios y `ExecMainStatus=0`. Se inició únicamente la web local; su arranque automático continúa `disabled`, como lo dejó el corte al VPS. No se reactivó n8n ni se modificó el VPS.
- `http://localhost:3000/api/salud`: **200 / ok**; `/entrar`: **200**; `/`, `/marcas` y `/radar` redirigen a entrada sin sesión. `/api/estado`, `/api/marcas` y `/api/operacion`: **401** sin autenticación.
- Navegador sobre la instalación real a **1440 y 390 px**: cero errores de consola/página, cero desbordamientos y cero violaciones axe AA. [Resultados](evidencias/cooper-integracion3/local-navegador.json), [captura escritorio](evidencias/cooper-integracion3/local-1440.png), [captura móvil](evidencias/cooper-integracion3/local-390.png). No se pulsó Google ni se fabricó una sesión de producción.

La copia de ensayo pasó de ocho a once migraciones, conservó los conteos de las 21 tablas anteriores y se pudo migrar de nuevo sin cambios. Integridad SQLite correcta y cero fallos de claves foráneas. El respaldo final previo a la instalación es distinto de esa copia de ensayo y queda protegido fuera de Git. No se copió el archivo de entorno; se conservó la configuración existente de systemd.

## Lote n8n para Claude

Lote generado desde `6ac683f` en `cooper/.cache/lote-integracion3-final/`: **87 archivos verificados por SHA-256, 32 workflows de entrada inactivos**. [Manifiesto](evidencias/cooper-integracion3/lote-manifest.json) y [comprobación](evidencias/cooper-integracion3/lote.json). Fuentes disponibles en Git; el comando de preparación permite reconstruirlo sin acceder al destino.

El lote contiene exportaciones inactivas, contratos, migraciones, huellas y versiones de referencia para reversa. Su `respaldo_real: false` es deliberado: Claude debe respaldar el destino antes de aplicar nada. Los dos trabajadores nuevos de Marcas no tienen versión anterior; su reversa exige desactivarlos y conservar recibos. Procedimientos: [despliegue local](../cooper-integracion3-despliegue.md) y [lote n8n](../cooper-cobertura-despliegue.md).

## Limitaciones reales

- La puerta, los recorridos y las mediciones usan Chromium local, cuentas ficticias, servicios simulados y puertos aislados. CPU 4× aproxima carga móvil; no certifica un teléfono físico, Safari, rendimiento de campo ni calidad editorial de modelos reales.
- El VPS fue migrado por otra misión durante estas pruebas (`1883fb3`). Integración 3 solo actualiza la PC; su base local corresponde al corte y no incorpora actividad posterior del VPS. Cooper local queda iniciado manualmente, con arranque automático deshabilitado; n8n local no se reactiva. Cualquier producción o reversa requiere elegir un destino y conciliar escrituras.
- No se instalaron los nuevos flujos en n8n. Operación puede indicar indisponibilidad con el puente anterior; los nuevos historiales comienzan tras instalar su lote. Marcas se mantiene simulada, sin conectar cuentas ni publicar contenido real.
- Publicados y Aprendizaje de marcas siguen dentro de Marcas; las pantallas globales conservan los resultados de videos. No se mezclaron estructuras ni se inventaron métricas ausentes.
- La validación de la instalación real es pública y sin sesión de prueba: arranque, entrada, redirecciones y rechazo de APIs anónimas. El recorrido privado completo se validó en las instancias aisladas. No se hizo OAuth real.
- La reversa local exige conservar cualquier actividad posterior y conciliarla antes de restaurar una base antigua. Se ensayó la migración en una copia; no se restauró sobre el servicio vivo.

## Pendientes de Walter

1. Probar la sesión Google existente en Chrome y un teléfono físico; revisar los videos y, si se utiliza, Safari.
2. Coordinar con Claude la instalación del lote n8n con respaldo real y reversa, presupuestos, modelos, interruptores y permisos de cuentas. Autorizar por separado el primer ensayo real de publicación/medios y la evaluación semántica de memoria.
3. Mantener los pendientes de aceptación del VPS descritos en su [informe](cooper-vps-real.md): Google real, configuración Meta/plantillas, reapertura selectiva de entradas, copias fuera del VPS e IA del plan. IP/SSH/DNS ya figuran resueltos por esa misión concurrente; integración 3 no los revalidó. Revisar también el pago de Meta y el guion histórico pendiente.
4. Marcas: definir identidad y dueños, asignar activos y permisos, cotejar el corpus bíblico y la guía pastoral, aprobar su plantilla WhatsApp y decidir retención/conciliación de medios.

Se consultaron las guías de diseño y de Next instaladas, además de [SQLite Backup](https://www.sqlite.org/backup.html), [systemd.service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html) y [videos Playwright](https://playwright.dev/docs/videos). No se añadieron endpoints externos ni se invocaron APIs de pago.

La evidencia versionada tiene un [manifiesto SHA-256](evidencias/cooper-integracion3/SHA256SUMS). No se versionaron bases, respaldos privados, entornos, cookies ni almacenamiento de sesiones.
