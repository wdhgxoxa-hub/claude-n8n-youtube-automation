# Cooper total — aceptación de competencia y lecturas nativas

Fecha: 2026-11-21, 12:22 Lima. Frente `/root/competencia`. Complementa [el informe del frente](total-competencia.md), sin sustituir la auditoría histórica ni sus pruebas. Trabajo final de producto en `total-competencia-youtube`, base `3525e6a`, después de preservar los cambios de otros constructores en el worktree original. El orquestador integra, despliega y ejecuta la puerta final conjunta.

## Resultado y límites

**Se comprobaron tres competidores peruanos y doce publicaciones mediante YouTube Data API con el permiso existente.** El radar real guardó una investigación web parcial y la regla Perú; su proyección HTTP devolvió exactamente la misma revisión. Las lecturas nativas todavía no están en esa fila productiva: el adaptador `7edbb80` está implementado y probado localmente, pendiente de despliegue y aceptación por el orquestador. No se declara una investigación completa de competencia ni crecimiento demostrado.

La investigación permanece parcial cuando faltan formatos comparables, outliers o búsqueda de homónimos de TikTok. La duración de un video no se convirtió en una etiqueta Short. La corrección posterior solo clasifica como largos los videos nativos de más de tres minutos, excluyendo directos. No se atribuyeron retención ni seguidores ganados privados a competidores; tampoco se atribuyó país mexicano a homónimos cuya ubicación no se consultó.

## Evidencia remota real

Todas las sondas usaron entradas temporales que Caddy bloquea desde internet. Antes de cada POST interno se comprobó público 404 y ausencia de una ejecución nueva. La ejecución interna fue por loopback, con el runner normal y credenciales opacas nativas de n8n. No se inició OAuth, no se leyó un `.env`, no se exportaron secretos ni se publicó contenido social. Los cuerpos crudos de ejecución no se consultaron: se guardaron diagnósticos con campos permitidos en la tabla de trabajos.

| Ejecución | Resultado comprobado | Alcance |
| --- | --- | --- |
| 801 y 804, `CoopSondaVidIQ01` | Inicialización y listado MCP HTTP 200; 84 herramientas anunciadas. `vidiq_balance` y `vidiq_user_channels` terminaron como error de nodo sin respuesta HTTP disponible. | No demuestra acceso al saldo ni a la cuenta. Créditos reportados `null`, no cero inventado. No se llamó investigación de pago. `vidiq_list_competitors` requería `youtubeChannelId` y se omitió en esta sonda. |
| 802, `CoopSondaYtComp1` | Permiso existente disponible; ocho GET HTTP 200: tres identidades, tres playlists, un lote de videos y una búsqueda de nombre. Tres cuentas y doce publicaciones con vistas, likes, comentarios, fecha y duración. | Evidencia nativa real, sin formato ni outlier inferido. |
| 805, `CoopRadarReal001` | Flujo `success`, respuesta única, investigación `parcial`, revisión `2026-11-21T17:13:01.126Z`. | Acción `antes_idea`, sin crear idea/video ni avisos/noticias. La web recibió HTTP 200 y la misma fecha/diferenciación, con cero cuentas aceptadas por el camino web de esa ejecución. |

Identidades confirmadas por la API: [Diario Gestión Perú](https://www.youtube.com/channel/UCfLvLO4R9kKExnksWkZnfgw), [Daniel Bonifaz — Hablemos de Negocios](https://www.youtube.com/channel/UCDFQF7lV8CQBQbBaZfTt17w) y [Cristian Arens](https://www.youtube.com/channel/UCuInF2D7Z4rbZqMzkhSjXZQ), las tres con `country=PE`. Son candidatos editoriales iniciales para Margen Real; el adaptador consulta de nuevo su identidad y publicaciones en cada ejecución, sin guardar las cifras de la sonda como datos de producción.

La búsqueda devolvió dos canales distintos con el nombre exacto Margen Real, además del propio: [UCBPNMfrXGxT7dqGvor_UYAg](https://www.youtube.com/channel/UCBPNMfrXGxT7dqGvor_UYAg) y [UC44g8kzJpbY6kSgGsOg6SqA](https://www.youtube.com/channel/UC44g8kzJpbY6kSgGsOg6SqA). Se excluye el ID propio `UCjG7RP3o2RGGju9YnH6lnFg`; otros resultados de nombres diferentes no se consideran homónimos exactos. País de las dos cuentas ajenas: **sin comprobar**.

Las primeras ejecuciones por CLI no persistieron diagnóstico porque n8n 2.47.4 deshabilita DataTable en el comando `execute`. El frente aprendizaje identificó esa limitación y suministró el invocador privado. No se confundió ese fallo de infraestructura con rechazo de Google o vidIQ. En vidIQ, el fallo posterior de `tools/call` sigue sin causa demostrada; no se atribuye a una credencial caducada sin evidencia.

## Adaptador de producción

`7edbb80` añade `FabCompYouTube01` como subflujo por canal, entre la investigación web comprobada y la escritura de tendencias. Utiliza exclusivamente el getter existente `FabYouTube000001` con `accion:token`; no hay OAuth interactivo. El subflujo no conserva datos de ejecución exitosa, fallida, manual ni progreso, y devuelve únicamente el contrato público de competencia.

- Máximo ocho GET por canal: tres `channels.list`, tres `playlistItems.list` con diez publicaciones cada una, un `videos.list` con treinta IDs y un `search.list` del nombre. Timeout 20 segundos por petición, sin redirecciones ni reintentos; timeout total del subflujo 240 segundos. Consume cuota de YouTube, no créditos de investigación monetizada.
- Solo acepta HTTP 200, identidades pedidas, playlists pertenecientes a esas cuentas y videos cuyo ID y `channelId` coinciden con la lista consultada. Rechaza cifras negativas, no enteras o fuera de rango. Un contador no disponible sigue siendo `null`.
- La prueba de aperturas del puente continúa siendo obligatoria para la fuente web. Las respuestas nativas tienen procedencia `youtube_data_api` o `youtube_data_api_y_web`; no se falsifican eventos de Codex para hacerlas pasar por búsqueda web.
- Las muestras `sin_clasificar` se muestran con vistas/likes/comentarios, pero no intervienen en el cálculo de outliers. Una duración nativa superior a 180 segundos acredita video largo según la ayuda oficial de YouTube; los directos se excluyen de esa deducción. Para duraciones menores o iguales se exige otra fuente comprobada. Permanece la exigencia de tres anteriores comparables y al menos el doble de la mediana para etiquetar un destacado. Una investigación con muestra suficiente y ambas búsquedas de homónimos puede terminar lista sin ningún destacado: buscarlo no obliga a que exista.
- La pantalla compartida de competencia identifica la fuente. La ruta de canales del radar puede usar el getter YouTube; las marcas sin asociación con ese permiso conservan el camino web existente y sus límites. No se inventó una conexión marca→canal.
- El horario del Radar permanece deshabilitado. Publicar el nuevo hijo antes de Radar permite el uso interno seguro. Una sonda completa debe conceder hasta 480 segundos a la cadena web+nativa; el invocador antiguo de 210 segundos solo se usó para el camino web anterior.

## H16, H17 y alcance H12

H16: el puente del plan real respondió a tres contextos ficticios. Preferencia corregida: 14 palabras, 5.816 s; pendiente vigente: 8 palabras, 5.727 s; aprobación humana: 13 palabras, 5.457 s. Los tres cumplieron HTTP 200, contrato JSON, brevedad, criterio semántico y cero llamadas. No se ejecutó ninguna herramienta propuesta. **Esto verifica comprensión del contexto suministrado, no memoria persistente o recuperación histórica.**

H17: se añadieron enlaces contextuales entre Publicados/Aprendizaje globales y las secciones de Marcas (`ff25927`, integrado como `d3f0168`). Este cambio no fusionó ni duplicó métricas/lecciones; la posterior unificación de otro frente es independiente.

H12: se revisó el alcance aprobado en `docs/cooper-marcas.md` y su informe: adjuntar MP4/ID era el contrato explícito. La importación automática de MP4 de fábrica no se implementó como ampliación inferida por este frente. Se comunicó la distinción al orquestador.

## Retirada y procedimiento usado

Las tres sondas y el getter aislado `CoopEnsayoTok01` quedaron despublicados. Metadata `active=false` para los cuatro; las tres rutas temporales devuelven público 404 e interno 404, sin nuevas ejecuciones. Se conservaron únicamente los diagnósticos saneados como evidencia. VPS liberado al orquestador/operación antes de las pruebas locales finales.

Procedimiento sin reiniciar servicios: copiar el JSON público por stdin a `/tmp` del contenedor n8n; `n8n import:workflow --input=/tmp/ID.json`; `n8n publish:workflow --id=ID`; al terminar `n8n unpublish:workflow --id=ID`. stdout/stderr de estas órdenes se descartaron. La credencial permaneció como referencia de nodo HTTP; n8n la resuelve en runtime. El invocador formal está en `tools/cooper/invocar_webhook_ensayo.py`; la ruta operativa revisada utilizada fue `/tmp/cooper-aprendizaje-final3/invocar.py`. No se creó un nuevo export global en este frente: el respaldo y la copia fría pertenecen al orquestador/operación.

## Commits y validación

| Commit | Cambio |
| --- | --- |
| `7edbb80` | Adaptador nativo YouTube, contrato/proyección/panel y regresiones. |
| `f5d1246` | Diagnóstico vidIQ clasifica errores sin conservar mensajes crudos; cuatro pruebas pasan. Rama `total-competencia-aceptacion`. |
| `2007d61` → `ea92893` integrado | Rechazar contradicciones explícitas en los criterios H16; tres pruebas pasan. |
| `ff25927` → `d3f0168` integrado | Navegación contextual H17. |
| `ba6769c` → `970d102` integrado | Evaluación H16 con contexto ficticio y salida mínima. |

Para `7edbb80`: lint y typecheck, cero errores/advertencias; nueve unitarias de competencia; 172 regresiones de flujos más seis pruebas del adaptador = **178/178**. Se incorporó localmente `2d82c9e` como `d430100` para ejecutar la aceptación de aprendizaje corregida; esa corrección ya pertenece al orquestador y no debe integrarse otra vez. El fallo previo 171/172 se debía al helper antiguo sin origen estable, no se ocultó ni se relajó el contrato.

La puerta completa del frente anterior está documentada en [total-competencia](total-competencia.md): 292 unitarias, 44 E2E y 150 flujos, instalación/lint/tipos/build sin errores ni advertencias. **No acredita por sí sola este adaptador posterior.** Por coordinación de CPU con el orquestador, este delta ejecutó las regresiones pertinentes; la puerta completa y dos rondas Sentinel + Playwright del producto final quedan bajo el cierre integrado. No se afirma despliegue del adaptador hasta su recibo real.

Evidencias nuevas: [hashes](evidencias/total-competencia-aceptacion/sha256.json), [YouTube real](evidencias/total-competencia-aceptacion/competencia-youtube-diagnostico.json), [vidIQ](evidencias/total-competencia-aceptacion/competencia-vidiq-diagnostico2.json), [proyección real](evidencias/total-competencia-aceptacion/competencia-radar-proyeccion.json), [chat H16](evidencias/total-competencia-aceptacion/competencia-chat-contexto-real.json), [retirada](evidencias/total-competencia-aceptacion/competencia-limpieza.json), [178 pruebas](evidencias/total-competencia-aceptacion/flujos-youtube.log).

Documentación oficial consultada antes del adaptador: [channels.list](https://developers.google.com/youtube/v3/docs/channels/list), [playlistItems.list](https://developers.google.com/youtube/v3/docs/playlistItems/list), [videos.list](https://developers.google.com/youtube/v3/docs/videos/list), [search.list](https://developers.google.com/youtube/v3/docs/search/list). Referencias de MCP/vidIQ/n8n en el informe principal; no se inventaron endpoints.

## Pendientes de Walter

1. Revisar la selección editorial inicial de competidores por nicho/territorio y la diferenciación propia. Margen Real ya usa Perú y soles; no necesita volver a iniciar Google para las lecturas probadas.
2. Aprobar humanamente cualquier publicación real futura y evaluar resultados de la cuenta propia antes de afirmar mejora o causalidad.
3. Si desea una fuente de investigación adicional con créditos, decidir acceso y presupuesto aparte. No se compró ni consumió investigación vidIQ.

Trabajo **A** todavía abierto para el orquestador: desplegar/probar el adaptador y comprobar que las doce muestras lleguen a tendencias/proyección; obtener formatos comparables y la búsqueda TikTok que permita declarar radar listo; investigar el error de nodo en las lecturas gratuitas vidIQ si se mantiene esa fuente. No se traslada automáticamente a Walter un fallo técnico no diagnosticado. Las credenciales o cuentas nuevas solo serían **B** si una respuesta concreta demostrase que hacen falta.

## Corrección de cobertura — 21/11, 12:30 Lima

La muestra real de cuatro publicaciones de Gestión y Cristian mezcla duraciones: aun comprobando los Shorts, solo incluye dos anteriores breves por cuenta. Se amplió a diez publicaciones por cuenta/treinta IDs sin agregar peticiones (ocho GET como máximo). La [ayuda oficial de YouTube](https://support.google.com/youtube/answer/15424877?hl=es), consultada el 21/11, limita Shorts a tres minutos y exige orientación cuadrada o vertical. Por ello `>180` segundos acredita largo; `<=180` no acredita Short. La [referencia de videos](https://developers.google.com/youtube/v3/docs/videos) permite identificar emisiones mediante `liveStreamingDetails`; se solicitan esos campos y se excluyen de esta clasificación.

Se corrigió además la exigencia lógica de que exista un outlier: tres cuentas con muestra reciente y tres anteriores del mismo formato, fuentes y búsquedas YouTube/TikTok completas pueden producir un resultado listo sin videos que dupliquen su mediana. La ausencia de destacado ya no se confunde con ausencia de muestra. No se relajaron identidad, diferenciación, evidencia, ventana ni homónimos. Nuevas regresiones: **179/179** flujos+adaptador, diez unitarias de competencia, lint/tipos sin errores ni advertencias.

Lecturas web adicionales del 21/11: búsqueda exacta `site:tiktok.com "Margen Real"` devolvió bloqueo robots y resultados irrelevantes de ayuda Shop; apertura `https://www.tiktok.com/search?q=Margen%20Real` no accesible. Pestañas Shorts de Gestión (`UCfLvLO4R9kKExnksWkZnfgw`) y Cristian (`UCuInF2D7Z4rbZqMzkhSjXZQ`) devolvieron `Online fetch throttled`; la pestaña videos de Daniel solo expuso el pie de página, sin publicaciones. Las búsquedas exactas de los IDs `FrK9wsBcH70` y `35Nc_k7kpCk` bajo `/shorts` no aportaron resultados verificables. Estas lecturas externas no se incorporaron como aperturas ficticias del puente. No prueban que no existan homónimos ni que haga falta otra credencial de Walter.

## Homónimos: lectura acreditada — 21/11, 12:40 Lima

Se corrigió un defecto concreto: registrar una apertura podía dar por terminada la búsqueda aunque la página respondiese robots/error. Cada comprobación declara ahora `consultado` o `inaccesible`, su alcance y una URL de evidencia pública. Solo las lecturas acreditadas de ambas redes habilitan la vigencia. Un estado ausente, alcance vacío o fuente no registrada mantiene el resultado parcial. La API YouTube HTTP200 declara consultados sus primeros cinco resultados, sin afirmar exhaustividad ni países.

Una búsqueda alternativa realmente leída puede acreditar enlaces y fragmentos con alcance explícito; no se exige fingir acceso a un perfil bloqueado. Las filas antiguas se conservan y proyectan como parciales hasta volver a investigar. La web muestra el estado y alcance de cada consulta. La búsqueda TikTok real continúa sin acreditar: robots/resultados irrelevantes no se convirtieron en prueba negativa ni en una cuenta inventada.

Regresión: **179/179** flujos+adaptador y **13/13** unitarias de competencia; lint/tipos sin errores ni advertencias. Incluye estado ausente, bloqueo, alcance vacío, evidencia alternativa aceptada/rechazada, fila antigua y combinación API+TikTok inaccesible. [Salida de flujos](evidencias/total-competencia-aceptacion/flujos-homonimos.log). El primer ensayo detectó una fixture antigua y dos variables descartadas sin uso; se corrigieron y se repitieron las verificaciones. No hubo llamadas al VPS durante este cambio; la aceptación nativa espera el freno de gasto y relevo del orquestador.
