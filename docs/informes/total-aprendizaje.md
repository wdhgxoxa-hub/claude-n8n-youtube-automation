# Cooper total — aprendizaje

La entrega más reciente se detalla en «Cierre complementario del frente», al final. Se conserva el historial de implementación y aceptación anterior.

21-11-2026, Lima. Frente aislado en `total-aprendizaje`, base `de397f3`, worktree `/home/david/Proyectos/cooper-wt/total-aprendizaje`. La entrega inicial fue local; después el orquestador encargó a este frente la aceptación remota con publicaciones existentes. No se leyeron archivos de entorno reales, no se hicieron OAuth, pagos ni publicaciones.

## Auditoría inicial y clasificación

Referencias de la base, antes de los cambios:

| Clase | Faltante | Evidencia |
| --- | --- | --- |
| A | El retorno de aprender solo enviaba Telegram y no alimentaba el siguiente guion. | `tools/generar_flujos_v2.py:843`; contexto de nuevo guion `:597–607`. |
| A | Análisis días 2/7, sin hitos 24h/72h/7d ni recuperación explícita de captura tardía. | `tools/cooper/observabilidad_flujos.py:81–82`. |
| A | La consulta de métricas era una rama paralela al análisis; no garantizaba disponer del resultado antes de pedir lecciones. | `tools/cooper/observabilidad_flujos.py:79`; `tools/generar_flujos_v2.py:1836`. |
| A | Faltaban guion, planos, título, miniatura y seguidores ganados en el análisis. | `tools/generar_flujos_v2.py:1804`; `tools/cooper/observabilidad_flujos.py:64`. |
| A | Proyección exigía `estado=ok`, pero el retorno real guardaba `listo`. | `tools/cooper/observabilidad.js:20`; `tools/generar_flujos_v2.py:449`. |
| A | Aprendizaje solo mostraba resumen/ganchos/temas, sin origen, cifra, causa ni aplicación. | `cooper/src/contratos/observabilidad.ts:57`; `cooper/src/componentes/resultados.tsx:388`. |
| A/B | Activar captura con conexiones existentes es operativo; permisos nuevos o cuentas desconectadas requieren Walter. | `tools/generar_flujos_v2.py:340`, `:1770–1788`. El orquestador confirmó durante esta misión que `allowAnalytics` ya estaba activo en el VPS, con M7 pausado, un YouTube conectado y publicaciones existentes. Es evidencia remitida por el orquestador, no acceso remoto de este frente. |
| B | No se pueden inventar mediciones de 24h/72h ya pasadas, causalidad demostrada ni mejoras futuras. | Limitación de la evidencia y disponibilidad de cada plataforma. |

También se leyeron íntegros los informes Pulido, Memoria, Animación y Animación fuerte. Sus pendientes se remitieron al orquestador: despliegue del lote y validación real del chat siguen en los frentes existentes; teléfono físico/Safari, aceptación artística y publicación real dependen de Walter. La falta histórica de persistencia de pausa quedó resuelta en Animación fuerte y no se reabrió.

## Implementación

- M7 revisa cada hora, captura por publicación desde las 24h y conserva la consulta diaria posterior. Al cruzar 24h, 72h o 7 días, vuelve a intentar aunque haya medición del día anterior; espera mínima de una hora ante datos pendientes. Hasta 100 candidatos por fuente, ordenados por intento más antiguo. Una captura tardía conserva fecha y demora real: no se atribuye retrospectivamente a la hora exacta del hito.
- La captura precede al análisis. Se repone el pedido original por canal después de recibir la curva para que la consulta agregada conserve su autenticación y video correctos. Un error conserva historial previo, pero ese historial viejo no se presenta como observación nueva.
- YouTube añade `subscribersGained` con filtro por video; Upload-Post toma `new_followers` del post cuando existe. Nunca usa snapshots del perfil como seguidores causados por un video. Ausencias siguen siendo `null`; cero real se conserva.
- Contexto creativo del mismo video/canal: último guion y storyboard listos, planos, título y descripción de miniatura. Extractos explícitamente acotados, con un máximo de 160.000 caracteres y doce evidencias por pedido; se conserva contexto histórico del canal para contrastar patrones. No se afirma haber inspeccionado píxeles de la miniatura ni un guion inexistente.
- La evidencia se persiste antes de despachar en el trabajo existente, sin nuevas tablas o columnas. Cada lección se valida contra esa evidencia; su cifra proviene del registro observado y jamás de un valor inventado por el modelo. Referencias ajenas o métricas ausentes se descartan. Menos de tres videos independientes produce una hipótesis, incluso si un video tiene tres mediciones.
- Los hitos enviados/listos se deduplican por canal/video/red/ventana; trabajos fallidos o bloqueados pueden volver a intentarse. M7 conserva el interruptor Analytics y analiza por el plan de la PC, sin requerir la rutina Claude ni una API pagada. Las exportaciones siguen inactivas; la activación remota la coordina el orquestador.
- Todo guion y reescritura consulta obligatoriamente las lecciones por canal. Recibe una copia enriquecida de la biblia sin sobrescribir reglas humanas. El retorno exige una entrada por ID en `aprendizajes_aplicados`, explicando el cambio o su no aplicación; una omisión bloquea el avance. El resultado no puede cambiar el modo del trabajo.
- La web muestra origen enlazado, métrica, hito/demora, posible causa, corrección propuesta y guiones donde se aplicó. Aplicación y mejora demostrada se distinguen. Los registros históricos sin trazabilidad se identifican y no se aplican automáticamente. Publicados muestra seguidores ganados o «Sin dato». La proyección acepta el estado real `listo`, conserva aislamiento y límites del contrato.

Fuentes de implementación: `tools/cooper/aprendizaje.js`, `tools/cooper/aprendizaje_flujos.py`, `tools/cooper/observabilidad.js` y la carga de la extensión en el generador. Se regeneraron siete workflows y el inventario. No hay migración nueva: requiere las columnas de observabilidad de la integración 3 y conserva su plan de respaldo/reversa.

## Commits

- `5b8be02`: ciclo de métricas, evidencia persistida, validación, lectura obligatoria, regresiones y workflows.
- `d1659f4`: contrato y pantalla Aprendizaje/Publicados, prueba unitaria y E2E de trazabilidad.
- `71613de`: vista previa de Marcas con carga inmediata; corrección acotada de un `LazyLoadImageIssue` detectado por la puerta, coordinada con el frente competencia.
- `cc2cb4d`: ensayo manual aislado de métricas/lecciones, prevención de registros de tokens y dos regresiones adicionales.
- El commit documental posterior registra esta entrega y ESTADO.
- `815f487`: M7 síncrono por `/v1/chat` de la PC, estado persistido/reintentable, callback estable aprobado en FABRICA sin ngrok.
- `a4bef98`: aceptación real del plan y contrato del siguiente guion sin crear un video.
- `385f2ca`: regresión del nombre de los hitos reales de M7.
- `48a989c`: diagnóstico mínimo de Analytics e ID público confirmado, sin consultar `runData`.
- `ce0fae5`: reconciliación estricta `youtube_id` con diario, reversa y reaplicación; pruebas de rollback ante fallo.

## Verificación

Pruebas de flujo actuales: **154/154 PASS**. Incluyen el ciclo medición → evidencia → resultado validado → siguiente guion → aplicación visible; omisión bloqueada; reescritura; aislamiento por canal; cifras ausentes/inventadas; no confundir tres capturas de un video con tres videos; errores de proveedor y datos tardíos. Se ejecutan los nodos Code exportados con transportes ficticios, sin conectar redes reales.

La primera puerta detectó dos fallos y se conserva como evidencia: CDP informó la carga diferida de la vista previa de Marcas; Sentinel no encontraba su Chromium propio. Se añadió `loading="eager"` a esa vista previa y se enlazó en la caché local el navegador de Sentinel ya instalado. Los tres avisos de descarga del navegador de compatibilidad ocurrieron solo durante preparación; la puerta final se repite con navegadores instalados. No se relajaron tests, guardián ni umbrales.

Puerta final ejecutada completa: `cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`, **código 0**. Instalación sin vulnerabilidades; lint y tipos correctos; **285/285 unitarias**, **44/44 E2E** y build correcto; **0 errores y 0 advertencias**. Incluye el recorrido Sentinel de Marcas y la nueva evidencia de Aprendizaje a 390/1440 px. Tras el cambio adicional del helper se repitió `node --test tests/flujos_v2.test.cjs`: **154/154, código 0**. No cambió código web durante esa puerta.

Evidencia versionada: [puerta](evidencias/total-aprendizaje/puerta-final.log), [flujos](evidencias/total-aprendizaje/flujos-final.log), [índice y hashes](evidencias/total-aprendizaje/verificacion.json), [móvil](evidencias/total-aprendizaje/evidencia-390.png), [escritorio](evidencias/total-aprendizaje/evidencia-1440.png). Las dos rondas integradas con videos se ejecutan en el cierre del orquestador; esta entrega no las atribuye al frente.

## Ensayo seguro preparado

Se añadió [procedimiento concreto](../cooper-aprendizaje-ensayo.md), generador offline de workflows temporales y wrapper CLI. La captura exige IDs explícitos de publicaciones existentes, solo hace lecturas Analytics/Upload-Post y renueva permisos Google ya concedidos dentro de n8n. Persiste la evidencia como trabajo bloqueado sin llamar IA, producción ni Telegram. Un segundo paso, sin red, valida una propuesta revisada contra la evidencia y guarda la lección; el siguiente guion usa el mismo repositorio obligatorio. No se ejecutó todavía en el VPS.

La revisión detectó que el ajuste global del generador pisaba la prohibición de guardar ejecuciones de M7. Se corrigió para M7 y el subflujo YouTube, incluyendo ejecuciones manuales y progreso. El ensayo lleva la misma protección y su CLI descarta toda salida cruda; nunca se consulta `runData` con tokens. La regresión comprueba ausencia de caminos de publicación/IA, filtro de video, correspondencia de canal, valores numéricos reales y rechazo de doble aplicación.

## Límites y entrega al orquestador

### Continuación de aceptación real

La lectura remota autorizada confirmó 5 videos totales, 2 publicados, 4 publicaciones y 26 filas de costos, sin trabajos previos de aprendizaje. Las referencias Google y Upload-Post existen; solo se consultaron sus IDs, nombres y tipos. [Preflight saneado](evidencias/total-aprendizaje/preflight-vps.json).

La pollería `v-mwo7a9rm-31e2` ya superó 24 horas; su medición tendrá demora real. El grifo `v-mwocg00m-bo9w` cumplirá 24 horas el 21-11 a las 16:00 Lima en YouTube, y a las 19:00 en TikTok. Ambos videos tienen `youtube_id` vacío; la publicación confirmada del grifo contiene un enlace público válido que permite reconciliarlo. El helper exige mismo video, canal y request_id, ID nativo de 11 caracteres, diario previo y prueba escritura → reversa → reaplicación, modificando solamente `youtube_id`. Una confirmación ambigua o diferente detiene el cambio.

Los dos storyboard tienen doce planos y carecen de miniatura guardada. El análisis dispone de guion, título y planos; debe reconocer que falta evidencia de miniatura. No corresponde inventar un diagnóstico visual ni atribuir una causa demostrada.

Después de la entrega inicial, M7 se cambió al plan de la PC por loopback. Persiste evidencia antes de llamar, valida una respuesta sin herramientas, guarda listo/error y conserva contexto para reintentar si la PC está apagada. La fuente FABRICA usa el retorno estable aprobado de Cooper y rechaza cualquier `retorno_url` ajeno. No se ejecutó la API de rutinas Claude. Las pruebas locales añadidas cubren aceptación del plan, lectura obligatoria, reconciliación y runner aislado; **158/158 flujos**. El orquestador ejecutará la puerta web final integrada; no se atribuye una segunda puerta completa a estos cambios de helpers.

Implementado y probado localmente no significa integrado ni desplegado. Este frente no prueba las credenciales reales ni la calidad semántica de una lección producida por el plan. Para aceptación remota: importar el lote integrado con respaldo y rollback del orquestador, comprobar lectura de una publicación existente por canal conectado y verificar los campos guardados sin imprimir credenciales. Activar M7 solo tras confirmar esa lectura y el destino correcto del retorno; no reanudar producción ni publicar un video para obtener evidencia.

Las APIs pueden entregar datos con retraso y no todas las redes ofrecen retención o seguidores atribuibles. No se reconstruyen hitos perdidos; una lectura acumulada posterior se etiqueta con su retraso. El límite por lote puede añadir demora en catálogos grandes. Si la PC está apagada o el plan no entrega una respuesta válida, M7 conserva la evidencia, guarda un error resumido y puede reintentar al cabo de una hora sin exigir otra lectura de Analytics. Los ensayos manuales se excluyen de ese reintento automático.

Una causa observacional no demuestra causalidad, ni aplicar un cambio demuestra una mejora. Comprobar el efecto requiere otro video aprobado y sus métricas futuras. Las lecciones históricas sin evidencia no se convierten en reglas automáticas. El retorno de guion verifica que exista una explicación por ID; no certifica por sí solo la calidad semántica del texto.

## Pendientes de Walter

1. Reautorizar únicamente las cuentas cuya lectura de analytics falle por permisos; no repetir OAuth donde la conexión existente funcione.
2. Aprobar humanamente los siguientes videos y contrastar sus resultados cuando estén disponibles; no existe aún una prueba de mejora causal.
3. Revisar hipótesis y reglas del canal cuando una lección contradiga una decisión editorial humana. Las reglas humanas conservan precedencia.

## Documentación oficial consultada

- [YouTube Analytics: informes de canal](https://developers.google.com/youtube/analytics/channel_reports) y [métricas](https://developers.google.com/youtube/analytics/metrics): consulta existente por video y alcance real de `subscribersGained`.
- [Upload-Post: analytics](https://docs.upload-post.com/api/get-analytics/) y [referencia](https://docs.upload-post.com/api/reference/): métricas del post, `new_followers` y diferencia respecto de snapshots de perfil.
- [n8n: Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/): periodicidad horaria y necesidad de publicar la versión para activar el trigger.
- Guías de la versión instalada de Next: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` e `01-app/03-api-reference/02-components/image.md`. Se conservaron la tipografía, paleta y estructura existentes.

- [n8n CLI](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md): ejecución por ID de workflows guardados sin endpoint público.

## Cierre complementario del frente — 21-11-2026, Lima

Esta ejecución se mantuvo en el worktree y rama `total-aprendizaje`. Conservó los cambios e informes previos de la rama, incluido el registro de aceptación remota anterior. **Este cierre no accedió al VPS, no aplicó flujos, no hizo OAuth, pagos, publicaciones, push ni merges.** El lote que se entrega aquí está implementado y probado localmente; su integración y despliegue corresponden al orquestador.

Se cerraron cuatro huecos de la implementación previa:

1. La curva YouTube se guardaba únicamente como fracción del tiempo en la evidencia del análisis. Ahora una lectura de `videos.list`, con el permiso existente del canal, obtiene duración, título y miniatura publicados. Los 100 intervalos se convierten a segundos y se conservan en el historial que llega a Cooper. Se permiten repeticiones superiores al 100 %, sin recorte ni interpolación. Sin duración válida no se inventan segundos; los contadores disponibles siguen utilizándose.
2. Una lección puede señalar el segundo observado de la caída. Su valor se toma de la curva persistida y se rechazan segundos inexistentes. El siguiente guion recibe esa misma lección; Aprendizaje muestra origen, métrica, segundo, causa propuesta, corrección y aplicación. Tres mediciones de un video siguen siendo una hipótesis; el test positivo de patrón exige tres videos distintos.
3. Dos hitos capturados el mismo día podían sobrescribirse. Historial y proyección conservan ahora la ventana además del día. La unión de YouTube con Upload-Post también conserva la curva disponible.
4. Aprendizaje incorpora el interruptor administrativo «Medición y aprendizaje automático». Reutiliza `allowAnalytics`, los permisos, revisión de concurrencia y registro de cambios existentes. El estado cambia tras confirmación del servidor; un conflicto mantiene el valor anterior y ofrece revisar los ajustes. Los demás usuarios no ven el control.

Dirección visual: se conserva la sala de edición de Cooper, su tipografía, paleta y secciones de evidencia. El interruptor utiliza el control de formulario existente. La tabla accesible acompaña a la curva; su escala se adapta a las repeticiones. No se añadieron dependencias ni animaciones.

Commits de este cierre: `b569022` (retención en segundos, evidencia publicada, regresiones y exportaciones) y `c726b30` (interruptor, trazabilidad en pantalla, curva y E2E). El commit documental posterior incorpora el lote, esta actualización y su evidencia. Se preservaron los archivos de contexto y el preflight remoto ajenos sin incorporarlos a estos commits.

La primera puerta detectó un selector de prueba que consultaba el extremo incorrecto del historial. La repetición acotada detectó además que el anuncio de rutas de Next también tiene `role=alert`; la prueba ahora busca el aviso dentro del control de aprendizaje. Se conservaron las aserciones de persistencia y rechazo de conflictos. Los cinco recorridos de resultados pasaron después de esas correcciones; la puerta completa se repitió desde `npm ci` sobre el código final.

| Puerta final del cierre | Resultado |
| --- | --- |
| `npm ci` | 0 vulnerabilidades; código 0 |
| `npm run lint` | 0 errores y 0 advertencias; código 0 |
| `npm run typecheck` | Código 0 |
| `npm test` | 285/285; código 0 |
| `npm run test:e2e` | 46/46, sin omisiones ni reintentos; código 0 |
| `npm run build` | Código 0 |
| `node --test tests/flujos_v2.test.cjs` | 160/160; código 0 |

**Puerta final: cero errores y cero advertencias.** Node 24.22.3, npm 12.2.2. E2E sobre servidores efímeros y Chromium local, con datos ficticios. Incluye persistencia y conflicto del interruptor, ocultación a usuarios, curva con repeticiones, origen por segundo, axe en Aprendizaje a 390/1440 px y recorridos generales de privacidad, movimiento y seis anchuras. Los nodos Code de n8n se ejecutan con transportes ficticios; no se presenta como una ejecución del motor remoto. Capturas revisadas visualmente, sin desbordamiento ni colisión del control. No se certifica Safari ni un teléfono físico.

Evidencia de este cierre: [puerta completa](evidencias/total-aprendizaje/puerta-cierre.log), [flujos](evidencias/total-aprendizaje/flujos-cierre.log), [recorridos de resultados](evidencias/total-aprendizaje/resultados-cierre.log), [móvil](evidencias/total-aprendizaje/cierre-390.png), [escritorio](evidencias/total-aprendizaje/cierre-1440.png), [versiones y hashes](evidencias/total-aprendizaje/verificacion-cierre.json). Se conservan las pasadas previas fallidas: [puerta](evidencias/total-aprendizaje/puerta-cierre-previa.log) y [selector del aviso](evidencias/total-aprendizaje/resultados-cierre-previa.log).

**Lote:** [instrucciones](lotes/total-aprendizaje/README.md), [diff](lotes/total-aprendizaje/flujos.patch) y [manifiesto](lotes/total-aprendizaje/manifiesto.json). Siete exportaciones inactivas, diff respecto de `de397f3`, hashes verificados y aplicación comprobada contra un índice temporal de esa base. Las 32 exportaciones del repositorio coinciden con el generador. Integrar primero las fuentes de los frentes y regenerar evita sobrescribir cambios del orquestador. No hay nueva migración.

**Límites comprobados:** YouTube entrega intervalos, no una muestra exacta por segundo; Upload-Post entrega la granularidad que cada red ofrece. Las fechas son de captura, con demora explícita; no reconstruyen hitos pasados. La descripción y URL de miniatura no equivalen a inspección visual de sus píxeles. Las pruebas locales no acreditan permisos de las cuentas reales, causalidad ni una mejora del siguiente video. El interruptor gobierna M7 después de que el orquestador publique ese disparador; la PC del plan debe estar disponible para analizar.

**Pendientes de Walter:** se mantienen los tres pendientes editoriales y de permisos ya documentados arriba. Este cierre no añade una solicitud de OAuth ni un permiso de publicación. Activación del lote, respaldo y reversa quedan al orquestador, con aceptación de una publicación existente.

Fuentes oficiales consultadas en este cierre: [dimensión de retención de YouTube](https://developers.google.com/youtube/analytics/dimensions#elapsedVideoTimeRatio), [videos.list](https://developers.google.com/youtube/data/reference/rest/v3/videos/list), [duración publicada](https://developers.google.com/youtube/data/reference/rest/v3/videos#contentDetails.duration) y [analytics de Upload-Post](https://docs.upload-post.com/api/get-analytics/). Para la web se leyó la guía de componentes cliente/servidor de la versión de Next instalada. Herramientas utilizadas: Git/archivos, documentación web oficial y Playwright/axe locales; no se invocaron conectores de diseño ni cuentas reales.
