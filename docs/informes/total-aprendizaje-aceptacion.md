# Cooper total — aprendizaje

21-11-2026, Lima. Frente aislado en `total-aprendizaje`, base `de397f3`, worktree `/home/david/Proyectos/cooper-wt/total-aprendizaje`. La entrega inicial fue local; después el orquestador encargó y autorizó la aceptación remota con publicaciones existentes. La continuación se aisló en `total-aprendizaje-aceptacion` para preservar los constructores externos concurrentes. No se leyeron archivos de entorno reales, no se hicieron OAuth, pagos ni publicaciones.

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
| A/B | Activar captura con conexiones existentes es operativo; permisos nuevos o cuentas desconectadas requieren Walter. | `tools/generar_flujos_v2.py:340`, `:1770–1788`. El orquestador confirmó durante esta misión que `allowAnalytics` ya estaba activo en el VPS, con M7 pausado, un YouTube conectado y publicaciones existentes. Fue evidencia inicial del orquestador; la aceptación remota posterior de este frente se detalla abajo. |
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

- `7a82ae7`, `733fd8b`, `9d45365`, `bd00e28`: aislamiento y cierre del runner CLI; camino diagnóstico conservado tras comprobar su límite DataTable.
- `0d77294`: integración de retención en segundos y contexto publicado del constructor externo (`b569022` en el orquestador).
- `98dd959`, `857acd3`, `9d2e7d4`: diagnóstico de permiso/publicación, documentación y variantes webhook internas.
- `75ff1d6`: invocador que exige bloqueo público sin ejecución y resultado terminal correcto; cierre explícito de SQLite y 13 pruebas de helpers.
- El commit documental de aceptación versiona los resultados reales, reversa, cierre y ESTADO sin secretos.

## Verificación

Pruebas de flujo en la entrega inicial: **154/154 PASS**. El cierre de aceptación alcanza **160/160 PASS** más **13 pruebas Python**, sin advertencias. Incluyen el ciclo medición → evidencia → resultado validado → siguiente guion → aplicación visible; omisión bloqueada; reescritura; aislamiento por canal; cifras ausentes/inventadas; no confundir tres capturas de un video con tres videos; errores de proveedor y datos tardíos. Se ejecutan los nodos Code exportados con transportes ficticios, sin conectar redes reales.

La primera puerta detectó dos fallos y se conserva como evidencia: CDP informó la carga diferida de la vista previa de Marcas; Sentinel no encontraba su Chromium propio. Se añadió `loading="eager"` a esa vista previa y se enlazó en la caché local el navegador de Sentinel ya instalado. Los tres avisos de descarga del navegador de compatibilidad ocurrieron solo durante preparación; la puerta final se repite con navegadores instalados. No se relajaron tests, guardián ni umbrales.

Puerta final ejecutada completa: `cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`, **código 0**. Instalación sin vulnerabilidades; lint y tipos correctos; **285/285 unitarias**, **44/44 E2E** y build correcto; **0 errores y 0 advertencias**. Incluye el recorrido Sentinel de Marcas y la nueva evidencia de Aprendizaje a 390/1440 px. Tras el cambio adicional del helper se repitió `node --test tests/flujos_v2.test.cjs`: **154/154, código 0**. No cambió código web durante esa puerta.

Evidencia versionada: [puerta](evidencias/total-aprendizaje/puerta-final.log), [flujos](evidencias/total-aprendizaje/flujos-final.log), [índice y hashes](evidencias/total-aprendizaje/verificacion.json), [móvil](evidencias/total-aprendizaje/evidencia-390.png), [escritorio](evidencias/total-aprendizaje/evidencia-1440.png). Las dos rondas integradas con videos se ejecutan en el cierre del orquestador; esta entrega no las atribuye al frente.

## Ensayo seguro preparado

Se añadió [procedimiento concreto](../cooper-aprendizaje-ensayo.md), generador offline de workflows temporales y wrapper CLI. La captura exige IDs explícitos de publicaciones existentes, solo hace lecturas Analytics/Upload-Post y renueva permisos Google ya concedidos dentro de n8n. Persiste la evidencia como trabajo bloqueado sin llamar IA, producción ni Telegram. Un segundo paso, sin red, valida una propuesta revisada contra la evidencia y guarda la lección; el siguiente guion usa el mismo repositorio obligatorio. No se ejecutó todavía en el VPS.

La revisión detectó que el ajuste global del generador pisaba la prohibición de guardar ejecuciones de M7. Se corrigió para M7 y el subflujo YouTube, incluyendo ejecuciones manuales y progreso. El ensayo lleva la misma protección y su CLI descarta toda salida cruda; nunca se consulta `runData` con tokens. La regresión comprueba ausencia de caminos de publicación/IA, filtro de video, correspondencia de canal, valores numéricos reales y rechazo de doble aplicación.

## Límites y entrega al orquestador

### Continuación de aceptación real

La lectura remota autorizada confirmó 5 videos totales, 2 publicados, 4 publicaciones y 26 filas de costos, sin trabajos previos de aprendizaje. Las referencias Google y Upload-Post existen; solo se consultaron sus IDs, nombres y tipos. [Preflight saneado](evidencias/total-aprendizaje/preflight-vps.json).

La pollería `v-mwo7a9rm-31e2` ya superó 24 horas; su medición tendrá demora real. El grifo `v-mwocg00m-bo9w` cumplirá 24 horas el 21-11 a las 16:00 Lima en YouTube, y a las 19:00 en TikTok. En el preflight ambos videos tenían `youtube_id` vacío; la publicación confirmada del grifo contiene un enlace público válido que permite reconciliarlo. El helper exige mismo video, canal y request_id, ID nativo de 11 caracteres, diario previo y prueba escritura → reversa → reaplicación, modificando solamente `youtube_id`. Una confirmación ambigua o diferente detiene el cambio.

Los dos storyboard tienen doce planos y carecen de miniatura guardada. El análisis dispone de guion, título y planos; debe reconocer que falta evidencia de miniatura. No corresponde inventar un diagnóstico visual ni atribuir una causa demostrada.

Después de la entrega inicial, M7 se cambió al plan de la PC por loopback. Persiste evidencia antes de llamar, valida una respuesta sin herramientas, guarda listo/error y conserva contexto para reintentar si la PC está apagada. La fuente FABRICA usa el retorno estable aprobado de Cooper y rechaza cualquier `retorno_url` ajeno. No se ejecutó la API de rutinas Claude. Las pruebas locales añadidas cubren aceptación del plan, lectura obligatoria, reconciliación y runner aislado; **158/158 flujos**. El orquestador ejecutará la puerta web final integrada; no se atribuye una segunda puerta completa a estos cambios de helpers.

Implementado y probado localmente no significa integrado ni desplegado. La aceptación remota siguiente prueba las conexiones existentes y una lección real del plan. Activar M7 sigue siendo una acción del orquestador con respaldo y reversa, separada del ensayo. No se reanudó producción ni se publicó un video para obtener evidencia.

Las APIs pueden entregar datos con retraso y no todas las redes ofrecen retención o seguidores atribuibles. No se reconstruyen hitos perdidos; una lectura acumulada posterior se etiqueta con su retraso. El límite por lote puede añadir demora en catálogos grandes. Si la PC está apagada o el plan no entrega una respuesta válida, M7 conserva la evidencia, guarda un error resumido y puede reintentar al cabo de una hora sin exigir otra lectura de Analytics. Los ensayos manuales se excluyen de ese reintento automático.

Una causa observacional no demuestra causalidad, ni aplicar un cambio demuestra una mejora. Comprobar el efecto requiere otro video aprobado y sus métricas futuras. Las lecciones históricas sin evidencia no se convierten en reglas automáticas. El retorno de guion verifica que exista una explicación por ID; no certifica por sí solo la calidad semántica del texto.

## Aceptación real en VPS, 21-11-2026

Tras la aplicación FINAL3 del orquestador, se ejecutaron sondas privadas sobre los dos videos ya publicados, con el runner normal de n8n. `n8n execute` 2.47.4 había fallado en DataTable: la sonda mínima sin HTTP llegó a «Guardar diagnóstico», con `NodeOperationError` y comprobación del módulo deshabilitado. No se interpretó ese fallo como rechazo de Google o Upload-Post. [Diagnóstico acotado](evidencias/total-aprendizaje/diagnostico-cli.json).

El orquestador bloqueó el prefijo interno de Caddy y probó reversa 401→404→401→404. Después de publicar cada sonda se comprobó 404 público sin ejecución y se llamó solo a `127.0.0.1:5678` desde n8n. Los registros de ejecución estaban deshabilitados y los resultados se verificaron mediante proyecciones de columnas permitidas, sin `runData`, tokens ni cuerpos crudos de error.

| Prueba real | Resultado observado |
| --- | --- |
| Captura 796, pollería `v-mwo7a9rm-31e2` | TikTok: 4.317 vistas, 13 me gusta, 0 comentarios y 10 seguidores ganados. YouTube vía Upload-Post: 301 vistas, 4 me gusta, 0 comentarios; retención media y seguidores ausentes conservados como `null`. |
| Ventana y curva | Hito 24h capturado el 21-11 a las 11:48 Lima, con 16h de demora. TikTok: 78% en segundo 1, 45% en segundo 2; curva real guardada. No representa una lectura puntual a las 24h. |
| Lección por plan de la PC, persistencia 797 | `aprender-ensayo-796-0:0`, hipótesis sobre probar una apertura más directa. Cruza título, guion y planos; reconoce miniatura ausente y duración de planos desconocida. Su cifra de 45% se toma del registro, no del modelo. Trabajo real `listo`. |
| Siguiente guion por plan de la PC | Leyó la fila persistida, devolvió su ID en `aprendizajes_aplicados` y abrió con la pregunta de cada diez soles. La prueba negativa rechazó omitir el ID. Es un borrador no persistido como video: la web debe seguir mostrando corrección propuesta, no mejora demostrada. |
| Reconciliación de YouTube | Se confirmaron `3sY1JsbPxMY` (pollería) y `XaNPu8nxWqM` (grifo) con mismo video/canal/request_id. Escritura→reversa→reaplicación probadas, exclusivamente en `youtube_id`, con diarios previos protegidos. |
| Consulta directa 799 | Renovación Google interna correcta, YouTube Data API confirmó el ID publicado. Analytics respondió sin error y con cero filas: no hay aún retención directa para afirmar. No se inició OAuth ni se requiere reautorizar por lo observado. |
| Reversa y limpieza | Snapshot de observaciones restaurado, comparado, reaplicado y comparado exactamente. Siguen cinco videos, cuatro publicaciones y 26 filas de costos. Se respaldó y retiró exclusivamente el diagnóstico sintético 795. La lección real y las métricas se conservan. |

Evidencia: [aceptación y métricas](evidencias/total-aprendizaje/aceptacion-real.json), [lección](evidencias/total-aprendizaje/leccion-plan-796.json), [siguiente guion](evidencias/total-aprendizaje/guion-plan-796.json), [reversa de observaciones](evidencias/total-aprendizaje/reversa-observaciones.json), [limpieza](evidencias/total-aprendizaje/limpieza-diagnostico.json), [cierre de rutas](evidencias/total-aprendizaje/cierre.json), [índice SHA256](evidencias/total-aprendizaje/indice-aceptacion.json).

Las sondas Apr01, Lec01 e IdYt01 quedaron despublicadas. Sus cuatro rutas, incluida la sonda de tablas anterior, responden 404 tanto públicas como internas. El getter Tok01 quedó publicado únicamente como subflujo interno para las sondas del frente competencia, que recibió el relevo y su cierre; M7 permaneció inactivo. La aceptación visual de la lección real en la versión final del VPS y las dos rondas integradas pertenecen al orquestador: no se atribuyen a este ensayo.

### Activación segura recomendada al orquestador

M7 consulta cada hora y usa directamente `/v1/chat` del plan de la PC por loopback; no recorre Texto ni Claude Routine y no tiene fallback a IA pagada. El interruptor global `allowTextoApi=false` debe conservarse para otros caminos, aunque M7 no lo consulta. M7 conserva `allowAnalytics`; solo hace lecturas Analytics/Data API/Upload-Post y renovación Google ya autorizada. No crea videos, no publica, no manda Telegram ni activa otros workflows de producción.

El estado enviado/listo se deduplica por canal/video/red/ventana. Si falta el hito, espera una hora entre consultas; después de capturarlo consulta diariamente. Los trabajos fallidos del plan conservan evidencia y pueden reintentarse tras una hora, con timeout de 45s y resultado validado. El ensayo manual queda fuera de esos reintentos, pero su lección lista participa de la deduplicación y de la lectura del siguiente guion. Una pieza permite hipótesis; un patrón exige tres videos independientes. Se recomienda publicar M7 con respaldo y reversa en el turno final del orquestador, sin reabrir Rutina ni producción.

### Límites que permanecen

Las ventanas 72h y 7d requieren tiempo real; el grifo aún no tenía 24h al aceptar. YouTube Analytics no entregó filas, aunque renovación y Data API sí funcionaron. La visualización real no demuestra haber inspeccionado píxeles de miniatura; esta lección reconoce la ausencia. Aplicar una hipótesis en un borrador no demuestra mejora ni causalidad. No se creó un video para simular ese resultado.

Los últimos helpers se verificaron con `python3 -W error -m unittest` (**13/13**) y regresiones de flujos (**160/160**, código 0). Se corrigió un aviso de cierre de conexiones SQLite detectado al convertir warnings en errores; la repetición final no contiene avisos. [Helpers](evidencias/total-aprendizaje/helpers-aceptacion.log) y [flujos](evidencias/total-aprendizaje/flujos-aceptacion.log). No hubo cambios web en este cierre; la puerta completa integrada corresponde al orquestador.

## Pendientes de Walter

1. Aprobar humanamente los siguientes videos y contrastar sus resultados cuando estén disponibles; no existe aún una prueba de mejora causal. Google existente renovó correctamente en la aceptación: no se solicita un login por ese canal.
2. Facilitar o aprobar contexto de miniatura y confirmar las decisiones editoriales que se quieran contrastar. La falta de ese contexto se conserva explícita.
3. Revisar hipótesis y reglas del canal cuando una lección contradiga una decisión editorial humana. Las reglas humanas conservan precedencia.

## Documentación oficial consultada

- [YouTube Analytics: informes de canal](https://developers.google.com/youtube/analytics/channel_reports) y [métricas](https://developers.google.com/youtube/analytics/metrics): consulta existente por video y alcance real de `subscribersGained`.
- [Upload-Post: analytics](https://docs.upload-post.com/api/get-analytics/) y [referencia](https://docs.upload-post.com/api/reference/): métricas del post, `new_followers` y diferencia respecto de snapshots de perfil.
- [n8n: Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/): periodicidad horaria y necesidad de publicar la versión para activar el trigger.
- Guías de la versión instalada de Next: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` e `01-app/03-api-reference/02-components/image.md`. Se conservaron la tipografía, paleta y estructura existentes.

- [n8n CLI](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md): ejecución por ID de workflows guardados sin endpoint público.

- [YouTube Data API: videos.list](https://developers.google.com/youtube/v3/docs/videos/list), [dimensión de retención](https://developers.google.com/youtube/analytics/dimensions#elapsedVideoTimeRatio) y [Upload-Post: estado de publicación](https://docs.upload-post.com/api/upload-status/), consultados antes de las lecturas directas de aceptación.
