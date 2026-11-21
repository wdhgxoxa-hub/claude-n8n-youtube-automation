# Cooper: pulido, métricas y Sistema Sentinel

Misión del 21 de noviembre de 2026. Rama `cooper-pulido`, worktree `/home/david/Proyectos/cooper-wt/cooper-pulido`, base `16341ab09145d44b9e1f084f6142c707e422fac3` de `version-chatgpt`. Trabajo aislado; sin despliegues, OAuth, pagos ni cambios en D&S Factory. No se leyeron archivos de entorno reales.

## Cambios entregados

- Detalle con reproducción del montaje HTTPS guardado por la fábrica, galería ordenada de imágenes, clips y voces, y reproductores oficiales YouTube/TikTok. El montaje real sustituye la maqueta; sin montaje, n8n muestra la espera. Las URLs externas se validan y la CSP restringe los reproductores a esos dos dominios. Fallar al cargar muestra un aviso y permite abrir el enlace.
- Publicados: publicaciones confirmadas, incluidos éxitos parciales de un envío a varias redes; filtros, miniatura, fecha, enlace, vistas, me gusta, comentarios, retención disponible, gráfico y tabla accesible. Un valor ausente no se convierte en cero. TikTok puede aportar una curva de permanencia por segundo.
- Aprendizaje: lecciones reales de los trabajos `aprender`, ganchos/temas identificados en ellas, retención media de las últimas mediciones disponibles e incidencias de ejecución, crítico, verificador, calidad y cambios pedidos. Se muestra fecha y explicación de resolución; avanzar de etapa por sí solo no marca una incidencia como corregida.
- Contrato aditivo `cooper-v1`, con `lecciones` por canal y `observabilidad` por video, proyección por dueño y novena migración SQLite `0008_observabilidad`. Los costos conservan la ruta exclusiva del administrador. Los textos de especialistas se depuran de información administrativa; no se serializan filas completas de proveedores ni errores internos.
- Captura diaria en Aprendizaje desde las APIs existentes de Upload-Post y YouTube Analytics. Guarda un punto por día y hasta 90 puntos por publicación. Los días 2 y 7 conservan el análisis de IA anterior; medir cada día no añade llamadas diarias de IA. Máximo 100 candidatos por fuente y ejecución, ordenados por intento más antiguo; las peticiones nuevas se espacian 3,1 segundos. Se conserva el último historial ante error del proveedor.
- Chat con instrucción fija de una frase natural y cálida, máximo dos salvo petición de detalle. La evaluación conserva las 30 conversaciones y las comprobaciones de herramientas, confirmaciones y aislamiento, y añade longitud.
- Bloqueos síncronos contra doble envío, plazos de espera de peticiones/adjuntos y reconexión SSE al recuperar la red.

## Hallazgos y correcciones

| Gravedad | Hallazgo reproducido | Corrección y evidencia |
| --- | --- | --- |
| Alta | Cinco envíos inmediatos del formulario podían crear cinco canales. | Bloqueo con referencia síncrona, además del estado visual; regresión con cinco `requestSubmit` y un solo canal. El chat repite 60 intentos agrupados en 12 ráfagas y exige exactamente 12 mensajes. |
| Alta | La nueva extracción de piezas confundía el conteo de planos de la composición con sus archivos. | Usa los archivos finales de sonido/avatar y el orden del plan. Prueba del nodo exportado: `piezas-rojo.log` falla; `piezas-verde.log` pasa, incluyendo imagen, avatar y voz. |
| Media | «En vivo» permanecía visible al desconectar el navegador. | Cierre de SSE al evento `offline`, estado «Reconectando» y conexión al recibir `online`. Se comprueba envío fallido y posterior recuperación. |
| Media | El porcentaje medio visto de YouTube se recortaba a 100 %. | Se conserva el valor del proveedor, incluidos porcentajes superiores a 100; prueba con 125 % en el nodo y contrato. `retencion-rojo.log`, `retencion-verde.log` y `retencion-cooper.log`. |
| Media | El título SVG del gráfico se renderizaba vacío en servidor y causaba un error de hidratación. | Un único texto para `<title>`; comprobación de consola en todas las pantallas y recorridos de Sentinel. Fechas con zona explícita `America/Lima`. |
| Media | Formularios/adjuntos podían quedarse esperando una petición que no terminaba. | Timeout de 15 s en operaciones y carga; chat con cancelación y plazo de 90 s. Ensayo de cancelación, 503 y reintento posterior. |

Las primeras ejecuciones también corrigieron defectos del propio ensayo: selectores que incluían formularios ocultos conservados por Next, axe ejecutado durante el fundido, una descarga tratada como navegación vacía y una mutación que el guardián de Sentinel bloqueaba correctamente. No se desactivaron reglas axe ni el guardián. Las descargas y el cambio de modo noticia se comprueban con Playwright; Sentinel excluye esos controles, cerrar sesión e iframes.

## Sistema Sentinel y cobertura

Se localizó la instalación de Walter en `/home/david/Proyectos/Sistema-Sentinel/codigo`. Se invocan sus módulos reales `recorridos`, `caos` y `estabilidad` mediante su API Python. `cooper/scripts/sentinel-cooper.py` añade la sesión E2E y el viewport al contexto protegido; verifica el destino de ensayo antes de cada módulo. No modifica la instalación. Un observador conserva los contadores y FPS de caos sin cambiar su evaluador.

Playwright complementa las capacidades que esa CLI/API no cubre: diez pantallas/estados × 360/390/768/1024/1440/1920 px × claro/oscuro, filtros y controles, navegación móvil y Escape, ausencia de desbordamiento, axe WCAG A/AA, errores de consola/HTTP, FPS, long tasks, CLS y tiempo hasta pantalla lista. Incluye 6000 caracteres, fotos, tres audios con micrófono ficticio, descarga privada, ráfagas, cancelación, 503 y desconexión/recuperación. La suite unitaria comprueba aparte tres intentos de n8n caído, conservación de estado y recuperación. La E2E ordinaria reproduce video y voz sintéticos y valida URLs de ambos embeds sin acceder a esas redes.

Cada ronda final contiene 18 pruebas compuestas y 120 auditorías axe/capturas de la matriz. Los módulos de Sentinel exploran además enlaces encontrados desde esas pantallas. La ronda inicial `ronda-1` terminó con 15/16: todos los módulos de Sentinel y las 120 auditorías pasaron; falló el selector de formulario oculto del ensayo de audio. Se conserva su salida y no se cuenta como ronda aprobada. Las rondas definitivas incluyen también las dos E2E de resultados y medios, con 18 pruebas.

Las capturas siguen `<ancho>-<tema>-<pantalla>.png`: 0 Inicio, 1 Canales, 2 Videos, 3 detalle en montaje, 4 detalle publicado, 5 Publicados, 6 Aprendizaje, 7 Avatares, 8 Perfil y 9 Administración. `medios-reales-ensayo.png` documenta el reproductor y galería con archivos sintéticos; no es un render de producción. Los artefactos `.cache` permanecen locales, fuera de Git.

## Commits

| Commit | Contenido |
| --- | --- |
| `9d2d602` | Respuestas breves y medición de las 30 conversaciones. |
| `376eab5` | Contratos, migración, métricas, escenas e historial en fábrica. |
| `2634247` | Reproductor, Publicados, Aprendizaje y correcciones de interacción/red. |
| `2ae4a21` | Corregir extracción de piezas finales de sonido/avatar con regresión. |
| `8efe56a` | Suite de Sentinel/Playwright, medios y recuperación; README. |
| `4546fb4` | Conservar porcentaje medio visto superior a 100 % sin recortar datos. |
| `ddc7dc2` | Aislar las expectativas E2E del número de cuentas creadas por otras suites. |

La aplicación y los flujos quedaron en `4546fb4`, sobre el que pasaron las dos rondas masivas. `ddc7dc2` solo modifica una prueba E2E: compara publicaciones/incidencias con el estado de la sesión y usa elementos visibles, sin asumir que el administrador ve una única cuenta. La puerta completa se repitió sobre este commit. El último commit añade este informe sin cambiar el código probado.

## Mediciones antes/después y puerta

La evaluación de chat pasó de mediana **11,5 a 9,5 palabras** y máximo **25 a 18** en 42 respuestas de las mismas 30 conversaciones. Resultado de herramientas: 30/30 antes y después. Archivos: `cooper/.cache/evaluacion-chat-30-antes.json` y `evaluacion-chat-30.json`. Es evaluación determinista del simulador, no una estimación del acierto de los modelos remotos.

Las dos rondas consecutivas de cierre son **ronda-3 y ronda-4**, ambas sobre `4546fb4`, **18/18 PASS**, cero fallos, omisiones y reintentos inestables. `ronda-2` también pasó 18/18, pero precede al último ajuste de retención y no se usa para certificar el cierre.

| Medición local | Ronda 3 | Ronda 4 |
| --- | ---: | ---: |
| Pantallas auditadas con axe / capturas de matriz | 120 / 120 | 120 / 120 |
| FPS mínimo / mediana, muestra de 1 s por pantalla | 60,04 / 60,64 | 60,04 / 60,62 |
| CLS máximo | 0 | 0 |
| Long tasks en esas muestras | 0 | 0 |
| Pantalla lista: mediana / p95 / máximo | 110 / 158 / 181 ms | 112 / 160 / 184 ms |
| Acciones de caos de Sentinel | 2327 | 1970 |
| Pantallas recorridas por caos | 13 | 13 |
| FPS instantáneos durante caos | 30–61 | 30–60 |
| Muestras de estabilidad / caídas | 38 / 0 | 38 / 0 |
| Hallazgos de Sentinel, incluidos informativos | 0 | 0 |

Total de cierre: **4297 acciones de caos**, **240 auditorías axe**, **240 capturas de matriz**, dos ensayos de texto/fotos/audio, 120 intentos de envío agrupados en 24 ráfagas y dos repeticiones de recuperación de red/fábrica. Las lecturas de caos incluyen navegación y acciones; no se confunden con los FPS de la muestra de pantalla estable. Sentinel no detectó su umbral de FPS bajos sostenidos. No hay una línea base de latencias comparable para afirmar una mejora de velocidad; el antes/después comprobado corresponde a longitud de chat y defectos reproducidos.

Evidencias: `cooper/.cache/pulido-ronda-3.{log,json}`, `pulido-ronda-4.{log,json}`, `cooper/.cache/capturas-pulido/resumen-final.json`; cada carpeta de ronda contiene `metricas-*.json`, `rafagas.json`, `sentinel/informe.json`, su log y las series CSV/JSON de estabilidad. La sesión ficticia temporal se elimina al finalizar Sentinel. Capturas inspeccionadas: [Publicados móvil oscuro](../../cooper/.cache/capturas-pulido/ronda-4/360-oscuro-5.png), [Publicados escritorio claro](../../cooper/.cache/capturas-pulido/ronda-4/1440-claro-5.png), [Aprendizaje móvil](../../cooper/.cache/capturas-pulido/ronda-3/360-oscuro-6.png) y [medios sintéticos](../../cooper/.cache/capturas-pulido/medios-reales-ensayo.png).

La primera puerta detectó una dependencia del orden de las suites: Publicados esperaba tres filas, pero el administrador veía correctamente las seis publicaciones de dos cuentas. Pasaron 34/35 E2E; quedó registrada en `cooper/.cache/puerta-pulido-intento-1/`. Se corrigió exclusivamente la prueba en `ddc7dc2`, conservando la comprobación exacta de cantidades y filtros frente a la API. La aplicación y los flujos permanecen idénticos a los de las dos rondas aprobadas.

Puerta obligatoria completa **PASS**, ejecutada después de las dos rondas, sobre `ddc7dc28040eddd98ea308e16800c3d2bbca8c52`, el 21-11-2026 de 03:55:47 a 04:00:08 (Lima). **0 errores, 0 advertencias; todos los comandos rc=0.** `npm ci` auditó 364 paquetes y encontró 0 vulnerabilidades.

| Directorio | Comando | Evidencia | Resultado |
| --- | --- | --- | --- |
| `cooper/` | `npm ci` | `instalacion.log` | PASS, rc 0 |
| `cooper/` | `npm run lint` | `lint.log` | PASS, rc 0, sin advertencias |
| `cooper/` | `npm run typecheck` | `tipos.log` | PASS, rc 0 |
| `cooper/` | `npm test` | `unitarias.log` | PASS, 24 archivos / 231 pruebas |
| `cooper/` | `npm run test:e2e` | `e2e.log` | PASS, 35 pruebas, sin omisiones |
| `cooper/` | `npm run build` | `build.log` | PASS, compilación de producción |
| raíz | `node --test tests/flujos_v2.test.cjs` | `flujos.log` | PASS, 136 pruebas, sin omisiones |

Los siete logs y `resultado.json`, con commit, tiempos y códigos de salida, están en `cooper/.cache/puerta-pulido/`. Se revisaron sus salidas sin diagnósticos de advertencia. `git diff --check` también pasó. El último cambio posterior a esta puerta es únicamente este informe.

## Migración y despliegue preparados, no ejecutados

1. Cuando termine el VPS, revisar la rama y fusionarla según la condición de la misión. Respaldar SQLite con su diario y exportar los workflows/Data Tables del destino antes de actualizar.
2. Aplicar en Cooper `npm run db:migrate` con el binario nuevo. `0008_observabilidad` añade `channels.learning` y `videos.observability`, texto JSON con valores vacíos compatibles. No alterar hashes ni el diario. Para volver a un binario con ocho migraciones hace falta restaurar su copia compatible de SQLite: ese binario rechaza un diario posterior.
3. Aplicar las columnas aditivas del manifiesto `contratos/cooper-migracion-tablas.json`: `fab_videos.cooper_escenas`, `metricas_youtube`, `metricas_consultadas_en`; `fab_publicaciones.metricas_historial`, `metricas_consultadas_en`, todas de tipo string. No borrar filas/columnas existentes.
4. Regenerar offline con `PYTHONDONTWRITEBYTECODE=1 python3 tools/generar_flujos_v2.py`. Importar los diez workflows modificados preservando el mapa de IDs reales del destino: Cooper API, Aprendizaje, Confirmar, Errores, Orquestador, Producción, Publicación, Sonido, Redes y Noticia. Las exportaciones siguen inactivas; esta misión no las publicó.
5. Verificar las referencias existentes de credenciales de Upload-Post y conexión de YouTube Analytics sin copiar valores ni realizar un nuevo OAuth. Mantener los interruptores de Ajustes bajo control del operador. Con `allowAnalytics` apagado no se captura historial; habilitarlo solo al desplegar y verificar permisos/cupos.
6. Ensayar en un n8n aislado con Data Tables del esquema nuevo: lectura de estado por dueño, montaje/escenas, publicación parcial, un día de métricas, error de ejecución y una revisión corregida. Después, validar con una publicación real ya existente y acceso autorizado, sin producir ni publicar contenido nuevo para esta comprobación.
7. Para resolver un fallo operativo de ejecución, registrar tras la corrección un `fab_eventos` con el mismo `video_id`, `tipo=correccion_cooper` y `detalle={"tipos":["ejecucion"],"cambio":"Descripción concreta del arreglo verificado"}`. El historial toma la fecha del registro. Los revisores automáticos y la aprobación humana ya generan sus resoluciones correspondientes.

La sincronización habitual de Cooper consulta el estado cada minuto. Las métricas pueden tardar hasta el siguiente ciclo diario y hasta que la plataforma las publique. Si hay más de 100 candidatos, rota primero por los menos recientemente consultados; no promete actualizar todo el catálogo cada 24 h.

## Limitaciones reales

- Los historiales nuevos comienzan al instalar el flujo. No se inventan puntos anteriores ni correcciones históricas que no fueron registradas. Las voces anteriores sin URL persistida pueden no estar disponibles.
- El trigger de error de n8n solo permite atribuir fallos que tengan ejecución identificable y registro previo del video. Fallos de trigger, anteriores a la atribución o de trabajos sin video siguen requiriendo revisión operativa. Una ejecución interrumpida permanece pendiente hasta una resolución explícita.
- El aviso de corrección explica la revisión superada; no presenta un diff inexistente del guion. Los cambios humanos conservan el texto disponible. Ganchos/temas provienen de lecciones existentes, no de un nuevo clasificador ni de entrenamiento desde el chat.
- Las métricas dependen de permisos y disponibilidad por red. No se usan snapshots del perfil como métricas de un video; no se confunde tasa de finalización con retención media. No se inventó un endpoint de vidIQ: se reutilizan Aprendizaje/Upload-Post y YouTube Analytics.
- La reproducción de URLs firmadas/caducadas y las restricciones regionales o de inserción de YouTube/TikTok necesitan comprobación con medios reales. Las pruebas reproducen archivos válidos sintéticos, sin conectarse a cuentas reales. El navegador recibe la URL del medio autorizado para reproducirlo; no se sirve como proxy de descargas.
- FPS, latencias, CLS y memoria son muestras de Chromium local sin throttling; no garantizan rendimiento en teléfonos físicos ni carga concurrente de producción. El caos es acotado, no una prueba de resistencia de varias horas. La suite no demuestra todas las combinaciones posibles de controles o fallos.
- La ampliación de n8n está validada como JSON y ejecutando sus nodos Code con fixtures; no se ejecutó ni desplegó en el n8n vivo. La evaluación de modelos remotos y permisos reales queda pendiente.

## Pendientes de Walter

- Completar la misión del VPS y su infraestructura antes de la fusión condicionada. La última escritura del registro `.cache/orquesta/cooper-vps-real.log` del repo principal sigue siendo del 21-11-2026 a las 04:00 (hora Lima). Su línea 5357 dice «La preparación está terminada; mantengo la espera y la PC disponible». La línea 5367 confirma que, tras hora y media, sigue faltando `vps-ip`. No acredita migración terminada: no se fusionó ni se hizo push. `version-chatgpt` permanece en `16341ab`.
- Revisar y programar el despliegue de la migración aditiva y los diez flujos, con respaldo y ensayo aislado.
- Validar permisos/cupos de Analytics y retención disponibles en cada cuenta, URLs reales y acceso a reproductores.
- Autorizar, si lo desea, la evaluación de las mismas 30 conversaciones con los proveedores reales; no se efectuaron llamadas pagadas.

## Fuentes oficiales consultadas

- [Upload-Post: analytics por publicación](https://docs.upload-post.com/api/get-analytics/) y [referencia](https://docs.upload-post.com/api/reference/): `GET /api/uploadposts/post-analytics/{request_id}`, `platforms.<red>.post_metrics`, curva de retención y límites.
- [YouTube Analytics: reports.query](https://developers.google.com/youtube/analytics/reference/reports/query) y [informes de canal](https://developers.google.com/youtube/analytics/channel_reports): vistas, likes, comentarios y `averageViewPercentage`. El [material de Google para creadores](https://services.google.com/fh/files/misc/workshop4_how_youtube_recommends_es.pdf) incluye un ejemplo de porcentaje medio visto superior al 100 %.
- [YouTube: reproductor](https://developers.google.com/youtube/player_parameters) y [TikTok: Embed Player](https://developers.tiktok.com/docs/en/embed-player): rutas oficiales de inserción.
- [n8n Data Table](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.datatable/) y [Error Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.errortrigger/): persistencia y límites de atribución de errores.
- [React: error de hidratación 418](https://react.dev/errors/418) y [MDN: AbortSignal.timeout](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static). Se leyeron también las instrucciones de Next instaladas antes de editar componentes cliente.

Los archivos ajenos `docs/ESTADO.md`, `docs/cooper-memoria.md` y `docs/misiones/` encontrados sin seguimiento en el worktree se conservaron sin editar ni incorporar a los commits.
