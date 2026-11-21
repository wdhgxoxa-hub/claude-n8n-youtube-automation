# total-sentinel — integración local y prueba masiva

Cierre: 2026-11-21 13:55 Lima. Implementado, probado e integrado únicamente en la rama local de esta misión. Rama/worktree propios `total-sentinel`, base `de397f3` de `version-chatgpt`. Sin push, merges a ramas protegidas, despliegue, OAuth, pagos ni publicación social. Solo datos ficticios, SQLite temporales y servicios en loopback. Los hechos de producción heredados de informes ajenos no se revalidaron en esta misión.

## Integración y conflictos

El [manifiesto](evidencias/total-sentinel/integracion.json) fija los SHA iniciales de las 30 ramas `total-*` (incluidas esta rama y `total-guia`, inicialmente en la base). Todas esas referencias son antecesoras de la integración local. Se recogieron también los cierres concurrentes de chat `6827959`, competencia YouTube `6932db1`, M08 `9a4f092` y resultados `f0b21a8`; el manifiesto registra un segundo corte. Se incorporaron además los cierres `1002cc0` (chat), `1cc2a67` (competencia), `ff0dd3e` (guía) y `55bf5e9` (Sentinel privado). El corte final, fijado el 21-11-2026 a las 12:32:48 de Lima, contiene 34 referencias: 31 incorporadas, contando esta propia rama, y tres misiones todavía sin informe de cierre (`total-m11`, `total-m12`, `total-cierre-aceptacion`). Por tanto se integran las 30 ramas ajenas terminadas en el corte; no se presenta trabajo concurrente sin cierre como terminado. Primer merge: `total-retorno-2476` (`71be3c7`), que ya contiene gran parte del código de los otros frentes por cherry-picks; después, merges individuales de los demás SHA. Los archivos de misión que ya estaban sin seguimiento se preservan sin incorporarlos.

Hubo 30 merges con conflictos, 113 resoluciones de archivo. El manifiesto enumera rama, archivo y decisión. No se usó una estrategia global `ours` para marcar ramas sin incorporar su contenido: se hizo merge normal, se revisaron los conflictos, se conservaron los cambios posteriores y se añadieron las diferencias funcionales entrantes que faltaban.

| Grupo | Resolución |
| --- | --- |
| Aprendizaje / M10 / resultados | Conservar consulta conjunta, títulos de origen, avisos de simulación e interruptor administrativo separado. Mantener aceptación real y regresiones posteriores. |
| Retorno M01 / Orquestador | Conservar validación editorial antes de reservar/despachar, contexto, recibo y deduplicación, junto con ambas versiones de ensayo. |
| Competencia | Mantener horario detenido y vinculación idea/radar. Recuperar además el rechazo de respuestas duplicadas, con prueba roja→verde. |
| Migraciones / fixtures M03, M05, M07 | Conservar las 13 entradas del diario, incluidos montajes y biblioteca, y los tres escenarios de fixtures; no renumerar migraciones. |
| Scripts M08 / retención / chat M09 | Conservar todos los scripts y la política core-js; recuperar el parser Node spec con su prueba. |
| Despliegue, seguridad y operación | Conservar monitor TLS/reintentos, restricciones del túnel, publicación por dependencias y manifiesto de imágenes. Solo pruebas locales, sin ejecutar los aplicadores. |
| Estado e informes | Conservar el historial integrado posterior y los informes propios. Consolidar pendientes de las ramas sin dar por aceptadas decisiones editoriales ni operaciones reales. |

## Fallos y regresiones

| ID | Hallazgo | Corrección / evidencia |
| --- | --- | --- |
| S01 | La integración aceptaba dos respuestas del radar para un mismo canal. | `5267610`: exigir exactamente una respuesta, conservar contrato y regenerar el Orquestador. La misma regresión falla antes y pasa después. |
| S02 | La puerta descartaba un resumen válido del reportero spec de Node. | `be9117a`: normalizar su prefijo; conservar rechazo de fallos/omisiones. Se recupera la corrección entrante de M08. |
| S03 | La fixture del guardián perdía el contador de la horda al seguir un enlace mediante recarga HTML. | `3cec8c3`: navegación interna de la fixture con History API, como la navegación cliente de Cooper; comprobar destino y conservación del estado. Guardián/evaluador sin modificaciones; 3/3 pruebas con `-W error`, después 8/8 con la caché privada integrada. |
| S04 | Dos E2E de Resultados seguían simulando `/api/estado` tras la proyección unificada M10. | Puerta inicial: 51 PASS, 2 FAIL. Merge `e3e30c7` del frente `total-resultados-e2e/f0b21a8`: adaptar las fixtures a `/api/resultados`, conservando comprobación de curva y evidencia editorial. |
| S05 | La evaluación integrada del chat todavía exigía la frase anterior sobre brevedad tras integrar total-chatfix. | `5ed6135`: actualizar la comprobación al límite nuevo de 30 palabras y máximo dos frases; añadir comprobación de ausencia de tarjeta al recordar una preferencia. 49 pruebas focalizadas pasan. |
| S06 | Los contadores mostraban «1 publicaciones» y «1 lecciones». | `def9ce2`: regresión E2E roja con la primera cadena; singular/plural corregido en Resultados y comprobado también en Aprendizaje. |
| S07 | Las pestañas de Marcas cambiaban el contenido sin actualizar la URL; la recarga perdía sección y marca. Sentinel lo señaló como limitación de cobertura. | `dbac915`: URL mediante History API, preservación de marca y admisión de las cinco secciones en servidor; regresión roja, recarga y axe a 390/1440 px. Se añaden cinco rutas explícitas al caos de Marcas en ambos tamaños. |
| S08 | La nueva prueba de caída de Aprendizaje confundía dos elementos `role=alert`. | `ab0e804`: seleccionar el aviso por su texto, conservando doble clic, 503, una sola petición, estado durable y reintento. Primera ronda masiva: 13 pasan, una falla y seis quedan sin ejecutar; se conserva el registro y se repite la ronda completa. |

La segunda ronda se detuvo después de siete escenarios aprobados: `/programados` a 390 px, tema claro y CPU 4× midió **56,03 FPS**, frente al mínimo de 57. Se conservaron el fallo, las 76 muestras previas y los videos. No hubo cambio de umbrales ni de código para la repetición focalizada; no se encontraron contextos acumulados ni procesos huérfanos de esta misión. El host compartido tenía otras cargas activas, pero no se atribuye causalidad sin demostrarla. La causa de esa variación queda abierta como limitación de rendimiento del laboratorio, no como un defecto de producto ficticiamente corregido.

## Alcance del ensayo

Se reutilizan los adaptadores y suites existentes. `playwright.total-sentinel.config.ts` compone la suite integral con caos móvil adicional, videos por prueba, cero reintentos y parada ante el primer fallo. La matriz recorre 22 rutas a 1440/390 px, en claro/oscuro, con axe, scroll, pausa, reanudación y CPU 4× a 390 px. Cada muestra conserva inventario de controles visibles e interacciones dirigidas. Los inventarios identifican controles; por sí solos no prueban cada combinación de estados.

Los escenarios incluyen sesión/aislamiento, chat y confirmaciones, adjuntos/micrófono, dos aprobaciones, biblioteca con ventana cerrada, memoria, conciliación, montajes, Marcas, competencia, resultados, operación, noticias sin fuentes, WhatsApp simulado, revocación, desconexión/reconexión SSE, respuesta lenta, 503/409, cancelación, ráfagas, doble envío y texto de 6000 caracteres. Las mutaciones se prueban de forma dirigida en Playwright; Sentinel mantiene su guardián de solo lectura y caos real de gremlins.

Matriz final `ronda-3` sobre `99cd616`: **88/88 muestras**, 59,00–60,01 FPS, p95 máximo 16,8 ms, frame máximo 50 ms, tareas largas observadas 0 y CLS 0 dentro de las ventanas medidas. Se registraron **3.290 observaciones de controles** (incluyen repeticiones entre pantallas/temas; no son 3.290 controles únicos). El primer descenso móvil no se reprodujo ni en las 22 muestras focalizadas ni en esta matriz completa. No se relajaron umbrales.

Capturas finales inspeccionadas: [Aprendizaje móvil](evidencias/total-sentinel/aprendizaje-movil.png) y [Marcas escritorio](evidencias/total-sentinel/marcas-escritorio.png). También se revisaron capturas de conciliación y Estudio de Marcas durante el diagnóstico; esta inspección manual por muestra complementa la matriz automática.

Sentinel final: **25 rutas por tamaño**, 6.581 acciones de caos en escritorio y 9.512 en móvil; **cero hallazgos de fallo**, congelaciones y caídas del navegador. Hay una nota informativa en móvil: «Fábrica (4)» cambia vista sin URL propia, por lo que ese estado solo lo explora el módulo de recorridos. Lo cubren además las pruebas dirigidas de fábrica seleccionable/animación y los recorridos completos. La nota equivalente de Marcas desapareció después de la corrección. La puerta añadió para Marcas siete rutas por tamaño, 3.880/3.798 acciones y cero hallazgos. Durante el caos, el muestreo propio de Sentinel tuvo mínimo/mediana/máximo de **8/60/61 FPS en escritorio** (327 lecturas) y **60/60/61 en móvil** (468); el evaluador original no detectó FPS bajos sostenidos. Ese mínimo puntual se conserva y no se presenta el ensayo como 60 FPS constantes durante toda acción aleatoria.

### Recorridos y estados cubiertos

| Área | Comprobaciones dirigidas |
| --- | --- |
| Entrada y perfil | Ruta pública/protegida, sesión ficticia, revocación, tema, inicio, teclado, bienvenida y movimiento reducido. OAuth real queda fuera. |
| Chat e identidad | Stream/boca, cancelación, confirmaciones persistentes, aislamiento, preferencia recordada, foto, audio, transcripción editable, avatar/voz y entrenamiento simulado. |
| Videos y biblioteca | Dos puertas de aprobación, SSE, detalle, programación, medios privados, trabajo sin ventana abierta y reincorporación al volver. |
| Marcas | Alta, identidad, cuentas simuladas, estudio, competencia, calendario, piezas/revisiones, resultados y recarga de las cinco secciones; caos con guardián en ambas anchuras. |
| Resultados | Homónimos/dueños, filtros de fecha y red, registros duplicados, ausencia de métricas, origen, curva, evidencia de aprendizaje e interruptor con caída y reintento. |
| Operación | Ajustes, gastos, incidencias/avisos, conciliación, seguimiento durable, intentos duplicados, noticias sin verificación y WhatsApp ficticio. |
| Movimiento y fallos | 22 rutas × dos anchuras × dos temas, CPU 4× móvil, scroll/pausa/reanudación, Lottie/celebración, vacíos, 403/404/503, red desconectada, demora, ráfagas y texto extremo. |

El inventario de controles acompaña cada muestra; no es una afirmación de cobertura exhaustiva de todos los valores posibles de formularios. Las acciones de producción excluidas por el guardián se sustituyen por escenarios aislados dirigidos; no se activan proveedores reales para completar un clic.

## Evidencia de la puerta

Puerta final aprobada en `99cd61604d7ada76c6cbdd4a7f35eee9ff9cb59f`, 21-11-2026 de 13:03:27 a 13:15:55 Lima (12 min 27 s): **443 unitarias, 54 E2E, 172 flujos; cero errores, advertencias, omisiones y reintentos**. Instalación, lint (`--max-warnings 0`), tipos y build con rc 0; auditoría de instalación: cero vulnerabilidades. La repetición masiva se informa por separado. Comando obligatorio ejecutado en entorno saneado, sin cargar archivos `.env` reales:

```sh
cd cooper
npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
cd ..
node --test tests/flujos_v2.test.cjs
```

Preparación local: Node 24.22.3, npm 12.2.2, Python aislado 3.14.7, Playwright Python 1.63.0 y Sentinel `6764bbd` en caché privada verificada. `preparar:sentinel` extrae solo nueve objetos fijados del checkout local autorizado; ningún archivo de configuración personal. El host es CachyOS: el instalador de Chromium emitió avisos de distribución no soportada y descargó el binario alternativo Ubuntu. No se ocultan esos avisos ni se atribuye a este host el preflight Debian fijado por M08. La puerta se evalúa por su propio registro.

Fuentes oficiales consultadas: [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext), [videos](https://playwright.dev/docs/videos), [red y mocks](https://playwright.dev/docs/network). También se leyó la guía Playwright de Next 16.4.6 instalada y el contrato, módulos y procedencia local de Sistema Sentinel. Para la navegación se consultó [History API integrada en Next](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api) y [replaceState de MDN](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState). No se consumieron APIs de producción.

Repetición de la suite masiva (usa el mismo adaptador de sesión y los servicios locales aislados de `test:e2e`):

```sh
cd cooper
COOPER_MOVIMIENTO_RONDA=ronda-3 \
COOPER_MOVIMIENTO_SALIDA=.cache/videos-total-sentinel \
COOPER_PULIDO_RONDA=total-sentinel-ronda-3 \
npm run test:e2e -- --config=playwright.total-sentinel.config.ts \
  --project=movimiento-integrado --project=estres-integrado \
  --project=recorrido-integrado --project=estres-movil
```

### Resultado final y artefactos

Ronda final `ronda-3`, 21-11 de 13:29:05 a 13:53:05 Lima: **20/20 PASS**, sin errores, advertencias, omisiones ni reintentos. Se ejecutó después de la puerta completa sobre el mismo código `99cd616`. En cada tamaño, 60 intentos de envío simultáneo produjeron exactamente 12 mensajes, con texto de 6.000 caracteres, foto y recuperación de red; el reintento lento de Aprendizaje hizo una sola petición durante el doble clic y conservó/restauró el ajuste.

| Bloque final | Resultado | Evidencia |
| --- | --- | --- |
| Instalación, lint, tipos, unitarias, E2E, build y flujos | rc 0; 443 / 54 / 172; 0 errores y advertencias | [Resumen y casos](evidencias/total-sentinel/puerta-final.json), [log completo comprimido](evidencias/total-sentinel/puerta-final.log.gz) |
| Matriz, Sentinel, estrés y recorridos | 20 PASS; 0 omitidos/reintentos | [Resumen y casos](evidencias/total-sentinel/masiva-ronda-3.json), [log](evidencias/total-sentinel/masiva-ronda-3.log.gz) |
| Fluidez y controles | 88 muestras; inventario completo por muestra | [Datos](evidencias/total-sentinel/movimiento.json) |
| Sentinel amplio y específico de Marcas | Sin fallos; una nota informativa móvil | [Informes y lecturas de caos](evidencias/total-sentinel/sentinel.json) |
| Doble envío y recuperación | 60 intentos → 12 mensajes por tamaño | [Ráfagas](evidencias/total-sentinel/rafagas.json) |
| Variación de FPS y repetición | 56,03 en el intento fallido; 22 muestras focalizadas pasan | [Ronda detenida](evidencias/total-sentinel/masiva-ronda-2.json), [repetición](evidencias/total-sentinel/fps-repeticion.json) |

**480 archivos WebM verificados con ffprobe**, 39.8 minutos acumulados y 146.3 MiB, con duración positiva, resolución y SHA-256. [Reproductor local](../../cooper/.cache/videos-total-sentinel/index.html) y [manifiesto verificable](evidencias/total-sentinel/videos.json). El índice incluye la puerta y la ronda final aprobadas; los videos de intentos fallidos permanecen en sus carpetas locales, identificadas en sus registros. No se subieron videos. Los recorridos continuos están al principio del índice.

Los [SHA de archivos de evidencia](evidencias/total-sentinel/archivos.json) permiten cotejar los logs. El [manifiesto de integración](evidencias/total-sentinel/integracion.json) incluye todos los commits de esta misión hasta el código probado, referencias de ramas, archivos en conflicto y decisiones de resolución. Los commits posteriores solo cierran documentación y evidencia.

### Comprobaciones adicionales

- Ocho pruebas Python de caché privada/guardián con `-W error`; evaluador y guardián de Sentinel intactos.
- 88 pruebas locales de despliegue/operación; contenedores de ensayo aislados, sin aplicar cambios a ningún servidor.
- 185 pruebas Node en el bloque complementario (172 flujos más 13 de competencia YouTube/sonda); no son 185 pruebas adicionales a los 172 de la puerta.
- Pruebas focalizadas roja→verde del parser, radar, fixture del guardián y UI, más 49 evaluaciones de chat y dos ensayos de reintento lento de Aprendizaje. Logs conservados, incluidos los fallos iniciales.

## Limitaciones reales

Ensayo de laboratorio Chromium con datos ficticios; no acredita Google OAuth, calidad semántica de los planes, redes/proveedores reales, retención editorial ni comportamiento en Safari o teléfono físico. CPU 4× es una aproximación. Los FPS se muestrean durante dos segundos, tras esperar a que la pantalla esté lista y 900 ms adicionales; no miden la carga inicial. Se conservaron los límites originales: media ≥57 FPS, p95 ≤25 ms y ningún frame de 100 ms. Las muestras puntuales de FPS del caos se informan aparte; no equivalen a esa medición controlada. La cadencia de WebM no equivale a los FPS medidos por requestAnimationFrame. Los videos registran los contextos Playwright y los recorridos continuos; el navegador hijo de Sentinel conserva capturas y métricas, no una grabación de cada acción de gremlins. Los artefactos locales no se publican. No se confunde integración en esta rama con integración en `version-chatgpt` ni con despliegue.

## Pendientes de Walter

Se conservaron los pendientes anteriores de `docs/ESTADO.md` y se consolidaron los de las ramas integradas:

1. Revisar videos y aceptar en teléfono físico/Safari. Esta misión acredita Chromium local y emulación, no esos dispositivos.
2. Encargar al orquestador la revisión e integración del corte; incorporar por separado los frentes `total-m11`, `total-m12` y `total-cierre-aceptacion`, sin informe de cierre en el corte fijado. Resolver la provisión privada de Sentinel y los blobs históricos antes de un futuro push. No se publicaron fuentes ni artefactos desde esta misión.
3. Confirmar cuentas propias, territorio, fuentes y muestras de competencia; aceptar la calidad editorial de memoria/chat tras las correcciones ya implementadas.
4. Conciliar trabajos inciertos e históricos y aceptar el contrato externo del retorno M01. No reabrir ni reenviar por inferencia.
5. Fijar cuotas y retención; autorizar aparte cualquier borrado real y pruebas de avatar/voz con consentimiento.
6. Coordinar permisos, métricas reales, WhatsApp, ventana del VPS y cualquier activación de producción. Las decisiones pendientes no detuvieron las pruebas locales.
