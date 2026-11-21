# Cooper: cobertura de la fábrica y controles web

Misión `cooper-cobertura`, 21 de noviembre de 2026 (Lima). Worktree propio: `/home/david/Proyectos/cooper-wt/cooper-cobertura`. Base `cooper-memoria` (`a2ae99d`), con `cooper-pulido` (`88e8d2c`) reunido en `d782670`. Se conserva el orden de migraciones: observabilidad 0008, memoria 0009.

## Qué significa la cobertura

«Completo» describe la función disponible en el código de Cooper y su conexión con el generador v2. **No significa desplegado, proveedor habilitado, cuenta conectada ni publicación real comprobada.** Los nodos automáticos se gobiernan mediante la solicitud de producto, las decisiones y los ajustes administrativos; la web no ofrece ejecución arbitraria de nodos.

Se auditan los 30 flujos v2, todos sus nodos, salidas de decisiones/esperas, las 24 rutas del Orquestador, los 58 ajustes operativos, las nueve Data Tables y el contrato de eventos/consultas. También se recorren los cuatro JSON antiguos: su funcionalidad tiene equivalente en v2; no se activa un segundo circuito ni el antiguo registro en Sheets. El inventario incluye sus 66 nodos y conexiones.

El [inventario reproducible](cooper-cobertura-inventario.json) conserva cada nodo, destinos, tabla/operación, pantalla responsable y SHA-256 del workflow. Se obtiene con `PYTHONDONTWRITEBYTECODE=1 python3 tools/cooper/auditar_cobertura.py`; falla si aparece un workflow v2 sin correspondencia revisada.

## Auditoría funcional: antes y después

| Función del flujo | Pantalla / acción en Cooper | Antes | Estado final |
| --- | --- | --- | --- |
| Crear canal, investigar propuesta y activar su biblia | Canales, Decisiones, biblia del canal | Parcial: la propuesta no tenía una puerta web propia | 🟢 Completo |
| Biblia: voz, tono, ritmo, estilo, colores, prohibiciones, música, montaje y publicación por red | `/canales/[id]`: 31 campos con revisión y persistencia | Parcial: instrucciones genéricas | 🟢 Completo |
| Radar y noticia verificada del día | `/radar`: fecha, fuente de cada idea, sonidos, solicitar lectura y usar idea → pedir video | Parcial: resumen de chat | 🟢 Completo |
| Rutina y metas semanales | `/rutina`: automatización, metas, decisiones, motivo, frenos y video encargado | Falta: sin registro diario explicable | 🟢 Completo |
| Especialistas y plataformas | `/redes`: hora, formato, sonido, recomendación por video/red, perfil y zona | Parcial: sin consulta estructurada | 🟢 Completo |
| Ajustes efectivos y presupuestos/modelos | `/admin/fabrica`: 22 interruptores y 36 parámetros; confirmación, revisión vigente y registro | Falta | 🟢 Completo |
| Referencias de personajes y escenarios | `/referencias`: descripción, enlaces, añadir/actualizar y solicitar generación | Parcial: acción vinculada incorrectamente a un video | 🟢 Completo |
| Adoptar cuenta existente | `/cuentas`: red, usuario, diagnóstico y propuesta posterior en Decisiones | Parcial: texto libre | 🟢 Completo |
| Preparar conexión directa a YouTube | `/redes`: estado y enlace de consentimiento del propietario | Falta en la web | 🟢 Completo en código; OAuth real no ejecutado |
| Guion, storyboard, propuesta, final y permiso de gasto | `/decisiones`: detalle, aprobar/cambios/detener según etapa; renovar esperas | Parcial: guion/final desde el video | 🟢 Completo |
| Producción, archivo, imágenes, clips, avatar, sonido, montaje y derivados | Detalle de video, Avatares, biblia y ajustes; medios/aprendizaje heredados de pulido | Completo en pulido, faltaban controles operativos | 🟢 Completo |
| Errores, bloqueos y recuperación | `/incidencias`: explicación sencilla, siguiente acción y reintento con revisión; fallos globales solo admin | Parcial | 🟢 Completo |
| Publicaciones programadas y recibos de Upload-Post | `/programados`: por red, fecha, borrador, omisión, error, publicación y enlace | Parcial: faltaban estados por red | 🟢 Completo |
| Métricas y aprendizaje | `/publicados`, `/aprendizaje`, detalle de video | Completo en pulido | 🟢 Completo |
| Telegram y WhatsApp | `/avisos`: categoría, recurso, fecha y estado recibido; preferencias de WhatsApp en Perfil | Parcial: WhatsApp tenía historial, Telegram no | 🟢 Completo |
| Chat breve y memoria privada | Inicio/chat, «Donde lo dejamos», Perfil y consulta administrativa | Completo en las misiones previas | 🟢 Completo, conservado y probado |

## Implementación y defectos corregidos

- Consulta `operacion` con proyección cerrada por dueño. `ajustes` requiere rol administrativo. `control_fabrica` valida acciones estructuradas, confirmación y pertenencia; esos tres comandos quedan fuera de las herramientas del modelo. Se conserva el contrato de chat breve y las confirmaciones anteriores.
- Se reemplazó el formulario genérico de redes/metas por accesos a formularios específicos. La biblia conserva tipos: listas por líneas, duración numérica y textos, sin introducir JSON técnico en los formularios. Las referencias conservan los datos previos que no se modifican.
- Ajustes mantiene el nodo base de la instalación y aplica un historial de parches permitidos. No se pueden cambiar destinos, credenciales, cliente OAuth ni chat administrativo desde esta API. La revisión detecta un formulario administrativo obsoleto. No se habilitó ningún proveedor real.
- Rutina registra decisiones incluso si la automatización está apagada, y vincula el encargo automático con su video. El radar conserva la fuente de cada idea; no atribuye a una idea el enlace de otra. Los especialistas leen trabajos terminados con estado `listo` además del formato anterior `ok`.
- La web distingue sus puertas de guion/final, que no tienen formulario, de las esperas nativas de n8n. Estas últimas usan multipart con `field-0`/`field-1`, sin reintento HTTP ciego. El destino se limita al origen configurado y a una ruta de formulario. Se eliminó el uso de `URL` del Code runner, donde esa clase no está disponible; la comprobación de funciones incompatibles ahora incluye el puente FX.
- Una segunda respuesta distinta a la misma decisión devuelve conflicto, en vez de aparentar que el recibo anterior corresponde a la nueva respuesta. Los cuatro cierres web actualizan únicamente una fila aún `pendiente`; si web/chat compiten, no avanzan dos veces.
- Los errores se atribuyen a video, canal o administración. Se registra la aceptación de Telegram después del envío, sin confundirla con lectura; el vigilante no referencia un nodo Inicio inexistente. Los fallos de publicación se consultan de nuevo sin repetir la subida. `fallback_to_inbox` y `skipped` no se presentan como publicados.
- El simulador persiste cambios por dueño y mantiene visibles sus límites. Una acción administrativa sobre un canal ajeno conserva al propietario original. No inventa imágenes, publicaciones, una conexión OAuth ni una ejecución diaria real.

- Lighthouse detectó un enlace de decisiones con área táctil insuficiente; ahora usa el botón secundario de Cooper. Los contratos compartidos desactivan la sonda JIT de Zod en el navegador, siguiendo [su documentación oficial de CSP](https://zod.dev/compile); se conserva la política que prohíbe `eval`.

## Verificación

Revisión validada: `e7c160ea4001a7dde911e9b4824d3d3211ddbc56` (aplicación/flujos de `5381a01`, ajuste del ensayo en `e7c160e`). Puerta ejecutada secuencialmente en el worktree propio, desde `2026-11-21T05:46:54.654650-05:00` hasta `2026-11-21T05:51:15.347212-05:00`.

| Comando obligatorio | Resultado final |
| --- | --- |
| `npm ci` | rc 0, cero errores/advertencias |
| `npm run lint` | rc 0, cero errores/advertencias |
| `npm run typecheck` | rc 0, cero errores/advertencias |
| `npm test` | 259 pruebas aprobadas; rc 0, cero errores/advertencias |
| `npm run test:e2e` | 40 pruebas aprobadas; rc 0, cero errores/advertencias |
| `npm run build` | rc 0, cero errores/advertencias |
| `node --test tests/flujos_v2.test.cjs` | 146 pruebas aprobadas; rc 0, cero errores/advertencias |

[Evidencia de la puerta](evidencias/cooper-cobertura/puerta.json): comandos, tiempos, resultados y SHA-256 de cada registro. Registros íntegros locales: `cooper/.cache/puerta-cobertura/`.

**Dos rondas consecutivas limpias, sin reintentos ni casos omitidos:**

| Ronda final | Playwright / axe | Sentinel |
| --- | --- | --- |
| [Ronda 5](evidencias/cooper-cobertura/ronda-5.json) | 17/17 casos; 132 capturas y barridos axe; consola/desbordamientos sin fallos | 30 pantallas; 7215 acciones; 107 muestras de estabilidad; cero hallazgos |
| [Ronda 6](evidencias/cooper-cobertura/ronda-6.json) | 17/17 casos; 132 capturas y barridos axe; consola/desbordamientos sin fallos | 30 pantallas; 5886 acciones; 107 muestras de estabilidad; cero hallazgos |

Cada ronda recorre las once pantallas a 360, 390, 768, 1024, 1440 y 1920 px, en claro y oscuro, con movimiento reducido en la matriz; Sentinel conserva las animaciones activadas. Incluye confirmación/cancelación, persistencia, radar → video, ajustes, referencias, decisiones, aislamiento y recuperación de una lectura 503. Se revisaron capturas móviles y de escritorio; las capturas completas están en `cooper/.cache/capturas-cobertura/ronda-5/` y `ronda-6/`.

[Ensayo adicional con n8n real aislado](evidencias/cooper-cobertura/ensayo-n8n.json): **20 bloques PASS**, migración de 111 filas con simulación/idempotencia/reversa, importación de los 30 workflows, HMAC, dueños, cierres web, formulario nativo consumido una sola vez y controles de fábrica. Resultado 0, instancia detenida, proveedores apagados. Se ejecutó en `5069e54`; los ajustes posteriores de listas/vigencia se cubren en las pruebas de flujos de la puerta, y la corrección CSP en Lighthouse/Playwright. No se realizaron llamadas a proveedores reales.

El generador y el inventario se regeneraron sin diferencias. Las [huellas de los árboles de código](evidencias/cooper-cobertura/fuentes.json) acreditan que los ajustes finales del ensayo no alteraron la aplicación ni los flujos. El lote contiene 84 archivos y sus 84 hashes coinciden con el manifiesto.

Las rondas preliminares que fallaron no cuentan como rondas limpias. Se corrigieron dos problemas del ensayo: el plazo inicial no alcanzaba para las 30 pantallas descubiertas, y la medida inicial de memoria se tomaba antes de cargar React y los datos. Ahora se espera la pantalla lista y se concede tiempo suficiente, sin cambiar los evaluadores ni sus umbrales. En otra ronda el caos pulsó controles de escritura en Avatares/Administración: el guardián bloqueó las solicitudes y Chromium registró errores de consola. Esos controles se excluyeron del recorrido de solo lectura; las mutaciones se comprueban mediante Playwright dirigido. El guardián permanece activo. Una ronda posterior encontró transitoriamente dos encabezados durante la hidratación de Next (uno estaba oculto); el ensayo ahora espera una única pantalla visible y se detiene al primer fallo. No se añadió reintento automático para ocultar fallos.

Lighthouse detectó los problemas de CSP y área táctil descritos en la implementación; sus 44 mediciones finales tienen rendimiento **92–100**, accesibilidad **100**, buenas prácticas **100**, cero advertencias y cero comprobaciones binarias fallidas. [Resultados de Lighthouse](evidencias/cooper-cobertura/lighthouse.json).

## Commits

| Commit | Cambio |
| --- | --- |
| `d782670` | Reunir pulido y memoria; conservar ambas migraciones. |
| `ebf0a2a` | Contratos, controles por dueño, generador y pruebas de flujos. |
| `5b47e74` | Once pantallas, acciones y ensayos de cobertura. |
| `5069e54` | Conflicto ante respuestas contradictorias y cierre único de decisiones. |
| `7f6dd4e` | Inventario exhaustivo y lote reversible. |
| `a1d6308` | Conservar listas y seleccionar recomendaciones/ideas vigentes. |
| `50122eb` | Auditoría Lighthouse de las pantallas nuevas. |
| `df37286` | Separar escrituras dirigidas del recorrido Sentinel de solo lectura. |
| `5381a01` | Compatibilidad CSP de Zod y área táctil del enlace en Decisiones. |
| `e7c160e` | Esperar la pantalla visible durante transiciones y cortar la ronda al primer fallo. |

El commit de cierre añade este informe, evidencia y la actualización de ESTADO/README; no cambia el código validado.

## Despliegue y reversa preparados

El [procedimiento para Claude](../cooper-cobertura-despliegue.md) y `tools/cooper/preparar_lote_cobertura.py` generan un lote local con exportaciones inactivas, migraciones, manifiesto SHA-256 y versiones de referencia para reversa. No se ejecutó contra un destino real. El respaldo real debe tomarse en el destino antes de instalar: el lote **no** contiene datos ni credenciales reales y su reversa versionada no sustituye ese respaldo.

Lote local final: `cooper/.cache/lote-cobertura-5381a01`, generado desde `5381a01fc4d959f117c3e539f02e6825a2848367`. Contiene **84 archivos versionados** (incluidas 30 exportaciones de entrada y 30 de referencia); las 84 huellas SHA-256 se verificaron. Su manifiesto declara `respaldo_real: false`. El script permite regenerarlo en cualquier carpeta nueva después de revisar la rama.

## Límites reales

- No hay despliegue de esta misión. Los avisos Telegram y decisiones diarias nuevos comienzan después de instalar los flujos; no se reconstruye historia inexistente. WhatsApp muestra el historial de la cuenta conectada a Cooper. La aceptación de un mensaje no demuestra entrega o lectura.
- Las fuentes y recomendaciones se muestran cuando existen en los resultados guardados. La fábrica conserva su investigación, controles de noticia y puertas de aprobación. El ensayo no mide calidad editorial ni autenticidad de una cuenta externa con datos reales.
- Los interruptores gobiernan los pasos que leen Ajustes; no cancelan llamadas ya enviadas. La instalación prevista ejecuta un proceso de Cooper; antes de añadir varios escritores se debe revisar la coordinación de cambios administrativos. Los recibos y cierres de aprobación sí se verifican contra repetición.
- La consulta de operación carga las Data Tables en n8n y devuelve listas acotadas mediante una proyección por dueño. No se ha medido su rendimiento con un historial masivo; una instalación con mucho volumen necesitará paginación/archivo en el servidor.
- Un fallo de publicación se consulta; no se resube automáticamente. Los videos cancelados y bloqueos que requieren consentimiento no se reaniman. Un error global sin recurso tiene una acción de revisión administrativa, sin un botón que repita una ejecución de origen desconocido.
- La conexión directa de YouTube requiere configuración previa y consentimiento interactivo del propietario; los perfiles de Upload-Post se conectan en ese servicio. No se hicieron logins OAuth, pagos ni consultas a cuentas reales. Los enlaces de autorización expuestos al dueño no incluyen tokens de acceso o renovación.
- Los cuatro archivos antiguos quedan auditados como antecedentes/equivalentes. No se conecta Cooper a una segunda tabla de Sheets ni se activa el callback legado de HeyGen. La fábrica gobernada por Cooper es v2 y conserva su registro por video y dueño.
- Las pruebas visuales, de accesibilidad y Sentinel usan Chromium local y datos ficticios. Sus medidas no garantizan teléfonos físicos, todas las regiones/plataformas ni carga sostenida de producción. La puerta completa comprueba código y simulación; el ensayo adicional comprueba n8n 2.47.4 aislado, con proveedores apagados.
- Configuración de instalación reservada: `chatId`, `routineUrl`, `retornoUrl`, `driveCarpetaRaizId`, `baseUrl`, `googleClientId`. Se auditan sus usos, pero no se muestran ni editan desde el navegador. Las credenciales permanecen en el sistema existente.

## Pendientes de Walter

1. Terminar la puesta en servicio del VPS (IP, SSH y DNS) y la revisión/integración correspondiente. Después, Claude puede instalar el lote con respaldo real y comprobación del destino.
2. Fijar presupuestos, modelos e interruptores que se habilitarán en producción. La misión entrega controles; no decide ni paga servicios por Walter.
3. Revisar sus perfiles/cuentas de publicación y conceder los permisos OAuth cuando corresponda. Confirmar proveedores y permisos de métricas; una interfaz disponible no crea esas autorizaciones.
4. Validar una producción real autorizada y las recomendaciones editoriales por red. Completar las decisiones pendientes de Meta/WhatsApp que ya figuran en ESTADO.

No se solicitó confirmación durante el trabajo. La rama queda lista para revisión; la condición de VPS de esta misión impide fusionarla o hacer push mientras siga pendiente.

## Correspondencia exhaustiva por flujo

| Flujo | Pantalla / acción | Estado |
| --- | --- | --- |
| F · Agente de Telegram (`FabAgenteTelegr1`, 20 nodos) | `/` — Chat breve con herramientas; avisos en /avisos | 🟢 Completo |
| F · Ajustes de la fábrica (`FabAjustes000001`, 4 nodos) | `/admin/fabrica` — Editar ajustes con revisión, confirmación y registro | 🟢 Completo |
| M7 · Aprendizaje (2 y 7 días) (`FabAprendizaje01`, 24 nodos) | `/aprendizaje` — Retención, lecciones e incidencias; /publicados para métricas | 🟢 Completo |
| F · Aprobación (Telegram y computadora) (`FabAprobacion001`, 17 nodos) | `/decisiones` — Aprobar o pedir cambios; reanudar la espera nativa o cerrar la puerta web | 🟢 Completo |
| FX · Renderizar avatar (`FabAvatar0000001`, 33 nodos) | `/avatares` — Elegir avatar y voz; consentimiento, revocación y progreso en detalle de video | 🟢 Completo |
| F · Chat de la fábrica (computadora) (`FabChatWeb000001`, 4 nodos) | `/` — Chat de Cooper; el chat legado de n8n no se incrusta | 🟢 Completo |
| F · Confirmar publicaciones (`FabConfirmar0001`, 20 nodos) | `/programados` — Estado por red, borrador/omisión y consulta sin volver a subir | 🟢 Completo |
| FX · API de Cooper (`FabCooperAPI0001`, 42 nodos) | `/radar` — Puente firmado de todas las pantallas; autorización y recibos idempotentes | 🟢 Completo |
| FX · Registrar costo por dueño (`FabCooperCosto01`, 5 nodos) | `/admin` — Costos por dueño; /admin/fabrica fija presupuestos y límites | 🟢 Completo |
| FX · Progreso de Cooper (`FabCooperProgr01`, 6 nodos) | `/videos/[id]` — Etapa persistida, reconexión y progreso por SSE | 🟢 Completo |
| M6 · Derivados (cortes y miniatura) (`FabDerivados0001`, 50 nodos) | `/videos/[id]` — Cortes y miniatura en galería; interruptores y costes en /admin/fabrica | 🟢 Completo |
| F · Vigilante de errores (`FabErrores000001`, 10 nodos) | `/incidencias` — Causa sencilla, siguiente acción y reintento seguro; fallos globales solo admin | 🟢 Completo |
| F · Estado y reportes (`FabEstado0000001`, 9 nodos) | `/videos` — Estado por canal/video; métricas en /publicados y gasto solo admin | 🟢 Completo |
| FX · Llamar a Claude (`FabLlamarClaude1`, 24 nodos) | `/videos/[id]` — Investigación/guion/storyboard y errores; modelo e interruptor administrativos | 🟢 Completo |
| F · Noticia del día verificada (`FabNoticia000001`, 18 nodos) | `/radar` — Noticia verificada, fuente y encargo; interruptor por canal | 🟢 Completo |
| F · Orquestador (`FabOrquestador01`, 386 nodos) | `/videos/[id]` — Canales, creación, corrección, decisiones, programación y eliminación en reposo | 🟢 Completo |
| FX · Pendientes (`FabPendientes001`, 3 nodos) | `/decisiones` — Todas las decisiones autorizadas, con detalle y acciones | 🟢 Completo |
| FX · Validar presentación (`FabPresentacion1`, 14 nodos) | `/avatares` — Consentimiento y elección; explicación de bloqueos en /incidencias | 🟢 Completo |
| M4–M6 · Producción (`FabProduccion001`, 174 nodos) | `/videos/[id]` — Planos, render y sonido; decisión de gasto solo admin, controles en /admin/fabrica | 🟢 Completo |
| M7 · Calidad y publicación (`FabPublicacion01`, 31 nodos) | `/videos/[id]` — Calidad y revisión final; errores y correcciones en /aprendizaje | 🟢 Completo |
| F · Radar de tendencias (`FabRadar00000001`, 31 nodos) | `/radar` — Ideas, fuente, sonidos, solicitar lectura y usar idea para pedir video | 🟢 Completo |
| M8 · Publicación en redes (`FabRedes00000001`, 37 nodos) | `/redes` — Especialistas, plataformas y perfil; agenda y resultados en /programados | 🟢 Completo |
| FX · Reenviar pendientes (`FabReenviar00001`, 16 nodos) | `/decisiones` — Renovar/reenviar una decisión propia; no rehacer un permiso de gasto muerto | 🟢 Completo |
| M1 · Referencias del canal (`FabReferencias01`, 43 nodos) | `/referencias` — Personajes/escenarios, descripción, enlaces y generación de referencias | 🟢 Completo |
| F · Retorno de Claude (`FabRetornoClaud1`, 11 nodos) | `/videos/[id]` — Resultado validado avanza la etapa; fallos en /incidencias | 🟢 Completo |
| F · Rutina diaria y reporte semanal (`FabRutina0000001`, 26 nodos) | `/rutina` — Metas, automatización, decisiones diarias, motivos, frenos y video encargado | 🟢 Completo |
| M5 · Sonido y emoción (`FabSonido0000001`, 72 nodos) | `/videos/[id]` — Reproductores y piezas de voz; estilo en biblia y servicios en /admin/fabrica | 🟢 Completo |
| FX · Texto GPT con respaldo (`FabTextoGPT0001`, 9 nodos) | `/admin/fabrica` — Modelo y respaldo API; resultado dentro del paso que lo solicitó | 🟢 Completo |
| FX · vidIQ (`FabVidiq00000001`, 18 nodos) | `/radar` — Ideas y fuentes; adopción en /cuentas, título elegido en el video | 🟢 Completo |
| FX · YouTube por canal (`FabYouTube000001`, 46 nodos) | `/redes` — Estado y preparación de enlace; autorización interactiva del propietario en Google | 🟢 Completo |

### Flujos anteriores y su equivalente

| Archivo | Cobertura de su función | Estado |
| --- | --- | --- |
| `01-telegram-idea-intake.json` (16 nodos) | Entrada de Telegram; chat en / y creación en /canales o /videos | 🟢 Completo por equivalente v2 |
| `02-script-review-approval.json` (12 nodos) | Decisiones, corrección y cancelación en /decisiones y /videos/[id] | 🟢 Completo por equivalente v2 |
| `03-log-to-spreadsheet.json` (10 nodos) | Registro de videos en Data Tables y Cooper; /videos y /publicados | 🟢 Completo por equivalente v2 |
| `04-heygen-webhook-youtube-upload.json` (28 nodos) | Avatar, render, estado y publicación en /avatares, /videos/[id] y /programados | 🟢 Completo por equivalente v2 |

### Rutas del Orquestador

| Salida / evento | Pantalla / acción | Estado |
| --- | --- | --- |
| 0: `nuevo_canal` | `/canales`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 1: `claude_ok:investigar_nichos` | `/decisiones`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 2: `aprobado:canal` | `/decisiones`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 3: `cambios:canal` | `/decisiones`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 4: `claude_ok:crear_biblia` | `/canales/[id]`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 5: `nuevo_video` | `/videos`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 6: `claude_ok:guion` | `/videos/[id]`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 7: `aprobado:guion` | `/decisiones`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 8: `cambios:guion` | `/decisiones`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 9: `claude_ok:storyboard` | `/decisiones`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 10: `aprobado:storyboard` | `/decisiones`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 11: `cambios:storyboard` | `/decisiones`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 12: `claude_ok:aprender` | `/aprendizaje`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 13: `aprobado:final` | `/decisiones`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 14: `cambios:final` | `/decisiones`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 15: `corregir` | `/videos/[id]`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 16: `ajustar_biblia` | `/canales/[id]`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 17: `programar` | `/videos/[id]`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 18: `referencias` | `/referencias`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 19: `configurar_redes` | `/redes`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 20: `metas` | `/rutina`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 21: `adoptar_cuenta` | `/cuentas`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 22: `eliminar` | `/canales y /videos`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |
| 23: `otro` | `/incidencias`; resultados asíncronos conservan la solicitud y dueño | 🟢 Completo |

### Nodos de decisión y espera

Las salidas numeradas conservan el orden del workflow. Una espera automática se observa en el detalle; una puerta humana se resuelve en Decisiones. Las condiciones de permisos, firmas y pertenencia se mantienen en el servidor. El JSON del inventario permite recorrer además todos los nodos que no bifurcan.

| Flujo / decisión | Salidas → destinos | Pantalla responsable | Estado |
| --- | --- | --- | --- |
| `FabAprendizaje01` / ¿Analytics activo? | 0 → Publicaciones | `/aprendizaje` | 🟢 Completo |
| `FabAprendizaje01` / ¿Hay que medir? | 0 → Pedir tokens; 1 → Pedir lecciones | `/aprendizaje` | 🟢 Completo |
| `FabAprendizaje01` / ¿Algún canal conectado? | 0 → Retención, Cooper · métricas YouTube; 1 → Pedir lecciones | `/aprendizaje` | 🟢 Completo |
| `FabAprendizaje01` / ¿Hay en redes? | 0 → Métricas en redes; 1 → Videos publicados | `/aprendizaje` | 🟢 Completo |
| `FabAprobacion001` / Aprobación · esperar | 0 → Aprobación · decisión | `/decisiones` | 🟢 Completo |
| `FabAprobacion001` / ¿Aprobado? | 0 → Evento aprobado; 1 → Evento cambios | `/decisiones` | 🟢 Completo |
| `FabAprobacion001` / ¿Decide Cooper? | 0 → ; 1 → Aprobación · avisar | `/decisiones` | 🟢 Completo |
| `FabAvatar0000001` / Esperar avatar | 0 → Presentación · Consultar avatar entrada | `/avatares` | 🟢 Completo |
| `FabAvatar0000001` / ¿Avatar listo? | 0 → Presentación · Avatar listo entrada; 1 → Esperar avatar | `/avatares` | 🟢 Completo |
| `FabConfirmar0001` / ¿Hay por confirmar? | 0 → Consultar Upload-Post | `/programados` | 🟢 Completo |
| `FabConfirmar0001` / ¿Hubo cambios? | 0 → Fila de publicación, Videos a cerrar, Aviso corto | `/programados` | 🟢 Completo |
| `FabConfirmar0001` / ¿Cerrar video? | 0 → Cooper · sello Actualizar video | `/programados` | 🟢 Completo |
| `FabCooperAPI0001` / ¿Autorizado? | 0 → ¿Consultar recibo?; 1 → Responder | `/radar` | 🟢 Completo |
| `FabCooperAPI0001` / ¿Consultar recibo? | 0 → Firmar consulta de orden; 1 → Canales autorizados | `/radar` | 🟢 Completo |
| `FabCooperAPI0001` / Recibo anterior | 0 → Canales autorizados; 1 → Aceptado; 2 → En proceso | `/radar` | 🟢 Completo |
| `FabCooperAPI0001` / Tipo de petición | 0 → Responder; 1 → Costos administrativos; 2 → Firmar reserva | `/radar` | 🟢 Completo |
| `FabCooperAPI0001` / Estado de reserva | 0 → Evento del Orquestador; 1 → Aceptado; 2 → En proceso | `/radar` | 🟢 Completo |
| `FabCooperAPI0001` / ¿Consultar resultados de Cooper? | 0 → Piezas de Cooper; 1 → Ajustes de Cooper | `/radar` | 🟢 Completo |
| `FabCooperAPI0001` / Destino de control | 0 → Entregar al Orquestador; 1 → Fila de ajustes administrativos; 2 → Responder decisión de Cooper; 3 → Consultar publicaciones de Cooper; 4 → Pedido de radar de Cooper; 5 → Renovar decisión de Cooper; 6 → Preparar conexión de Cooper | `/radar` | 🟢 Completo |
| `FabCooperProgr01` / ¿Tiene dueño? | 0 → Progreso público; 1 → Conservar fila | `/videos/[id]` | 🟢 Completo |
| `FabDerivados0001` / ¿Hace cortes? | 0 → Composiciones de cortes; 1 → Sin cortes | `/videos/[id]` | 🟢 Completo |
| `FabDerivados0001` / ¿Hay cortes válidos? | 0 → Presentación · Renderizar corte entrada; 1 → Sin cortes | `/videos/[id]` | 🟢 Completo |
| `FabDerivados0001` / Esperar cortes | 0 → Consultar cortes | `/videos/[id]` | 🟢 Completo |
| `FabDerivados0001` / ¿Faltan cortes? | 0 → Esperar más; 1 → Cortes listos | `/videos/[id]` | 🟢 Completo |
| `FabDerivados0001` / Esperar más | 0 → Consultar otra vez | `/videos/[id]` | 🟢 Completo |
| `FabDerivados0001` / ¿Hace miniatura? | 0 → Pedido de miniatura; 1 → Resultado | `/videos/[id]` | 🟢 Completo |
| `FabDerivados0001` / ¿Hay imagen? | 0 → Subir base; 1 → Resultado | `/videos/[id]` | 🟢 Completo |
| `FabDerivados0001` / Esperar miniatura | 0 → Consultar miniatura | `/videos/[id]` | 🟢 Completo |
| `FabEstado0000001` / ¿Es reporte? | 0 → Conexiones; 1 → Resumen | `/videos` | 🟢 Completo |
| `FabEstado0000001` / ¿Hay canales conectados? | 0 → Estadísticas de YouTube; 1 → Resumen | `/videos` | 🟢 Completo |
| `FabLlamarClaude1` / ¿Claude permitido? | 0 → Despertar routine; 1 → Bloqueado | `/videos/[id]` | 🟢 Completo |
| `FabNoticia000001` / ¿Atribuir ejecución a video? | 0 → Cooper · atribuir ejecución; 1 → Cooper · continuar ejecución | `/radar` | 🟢 Completo |
| `FabOrquestador01` / Según evento | 0 → ¿Canal de Cooper?; 1 → ¿Criticar nichos?; 2 → Nuevo canal; 3 → Reinvestigar; 4 → Canal activo; 5 → Buscar canal; 6 → Video (crítico); 7 → Cooper · Canal del video entrada; 8 → Cooper · cerrar cambios Canal (corrección) si; 9 → Video de storyboard noticia; 10 → Canal (producción); 11 → Canal (rehacer); 12 → Resumen de aprendizaje; 13 → Cooper · Video (publicar) entrada; 14 → Cooper · cerrar cambios Cambio final a corrección si; 15 → Trabajos del video; 16 → Canal (ajuste); 17 → Validar fecha; 18 → Pedir referencias; 19 → Validar redes; 20 → Validar metas; 21 → Leer enlace; 22 → Cooper · eliminar; 23 → Aviso: evento | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Criticar nichos? | 0 → Texto · Crítico de nichos; 1 → Mensaje de canal | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Canal activo? | 0 → Videos de las últimas 24 h; 1 → Aviso: canal no listo | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Investigar con vidIQ? | 0 → Pedido a vidIQ; 1 → Pedir guion | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Dentro de los topes? | 0 → Buscar biblia; 1 → Aviso: tope diario | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Criticar guion? | 0 → Temas del canal; 1 → Mensaje de guion | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Verificar cifras? | 0 → Cooper · Verificar cifras entrada; 1 → Cifras verificadas | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Pasa el crítico? | 0 → Mensaje de guion; 1 → Contar revisión | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿YouTube encendido? | 0 → Pedir token del canal; 1 → Aviso: YouTube apagado | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Publicar con Upload-Post? | 0 → Encargo de redes; 1 → ¿YouTube encendido? | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Canal conectado? | 0 → Abrir subida YouTube; 1 → Aviso: canal sin YouTube | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Hay versión? | 0 → Volver a orquestar; 1 → Aviso: sin versión | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Ajuste válido? | 0 → Fila de biblia; 1 → Aviso: ajuste inválido | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Fecha válida? | 0 → Fila de fecha; 1 → Aviso: fecha inválida | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Metas válidas? | 0 → Canal (metas); 1 → Aviso: metas inválidas | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Existe el canal (metas)? | 0 → Fila de metas; 1 → Aviso: metas inválidas | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Cuenta reconocida? | 0 → vidIQ: cuenta; 1 → Aviso: cuenta no reconocida | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Redes válidas? | 0 → Canal (redes); 1 → Aviso: redes inválidas | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Existe el canal? | 0 → Fila de redes; 1 → Aviso: redes inválidas | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Canal de Cooper? | 0 → Cooper · reservar canal; 1 → Cooper · pedido original | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / Cooper · cerrar Canal del video si | 0 → Cooper · cerrar Canal del video fila; 1 → Cooper · cerrar Canal del video seguir | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / Cooper · cerrar Video (publicar) si | 0 → Cooper · cerrar Video (publicar) fila; 1 → Cooper · cerrar Video (publicar) seguir | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Eliminar canal? | 0 → Cooper · eliminar canal; 1 → Cooper · sello Cooper · eliminar video | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Configurar noticia? | 0 → Modo noticia del canal; 1 → Biblia (ajuste) | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Video noticia? | 0 → Pedido de noticia; 1 → ¿Investigar con vidIQ? | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Verificar guion noticia? | 0 → Invalidar · Encargo de guion noticia entrada; 1 → ¿Criticar guion? | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Verificar storyboard noticia? | 0 → Invalidar · Encargo de storyboard noticia entrada; 1 → Restaurar storyboard noticia | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / ¿Atribuir ejecución a video? | 0 → Cooper · atribuir ejecución; 1 → Cooper · continuar ejecución | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / Cooper · cerrar cambios Canal (corrección) si | 0 → Cooper · cerrar cambios Canal (corrección) fila; 1 → Cooper · cerrar cambios Canal (corrección) seguir | `/videos/[id]` | 🟢 Completo |
| `FabOrquestador01` / Cooper · cerrar cambios Cambio final a corrección si | 0 → Cooper · cerrar cambios Cambio final a corrección fila; 1 → Cooper · cerrar cambios Cambio final a corrección seguir | `/videos/[id]` | 🟢 Completo |
| `FabPresentacion1` / ¿Consultar consentimiento? | 0 → Firmar consulta; 1 → Conservar entrada | `/avatares` | 🟢 Completo |
| `FabPresentacion1` / ¿Presentación permitida? | 0 → Conservar entrada; 1 → Estado detenido | `/avatares` | 🟢 Completo |
| `FabProduccion001` / ¿Todo encendido? | 0 → ¿Dentro del presupuesto?; 1 → Aviso: falta encender | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Dentro del presupuesto? | 0 → Carpeta del canal: buscar; 1 → Aviso: sobre presupuesto | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Existe la carpeta del canal? | 0 → Carpeta del video; 1 → Carpeta del canal: crear | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / Según tipo de plano | 0 → Pedido de imagen; 1 → Plano para avatar; 2 → Buscar en Pexels | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Hay en Pexels? | 0 → Pedido de revisión de archivo; 1 → Buscar en Pixabay | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Hay en Pixabay? | 0 → Pedido de revisión de archivo; 1 → Sin archivo: generar | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Revisar archivo? | 0 → Revisar archivo; 1 → Archivo elegido | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Sirve el archivo? | 0 → Archivo aprobado; 1 → Sin archivo: generar | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Es clip? | 0 → Presentación · Animar (Gemini Omni) entrada; 1 → Subir a Drive | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Clip por URI? | 0 → Descargar clip; 1 → Subir a Drive | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Revisión visual activa? | 0 → Revisar plano; 1 → Plano aprobado | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Repetir plano? | 0 → Pedido de imagen; 1 → Plano aprobado | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Pasa el aviso de gasto? | 0 → Permiso de gasto · preparar; 1 → Encargo de sonido | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / Permiso de gasto · esperar | 0 → Permiso de gasto · decisión | `/decisiones` | 🟢 Completo |
| `FabProduccion001` / ¿Sigo? | 0 → Encargo de sonido; 1 → Producción detenida | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / Esperar render | 0 → Consultar render | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Render listo? | 0 → Costos del video; 1 → ¿Render fallido? | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Render fallido? | 0 → Aviso: render fallido; 1 → Esperar render | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Anotar derivados? | 0 → Guardar costo de derivados; 1 → Presentación · Encargo de calidad entrada | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Hay avatares? | 0 → Pedidos de avatar; 1 → Presentación lista | `/videos/[id]` | 🟢 Completo |
| `FabProduccion001` / ¿Atribuir ejecución a video? | 0 → Cooper · atribuir ejecución; 1 → Cooper · continuar ejecución | `/videos/[id]` | 🟢 Completo |
| `FabPublicacion01` / ¿Pasa calidad? | 0 → Mensaje final, Cooper · calidad superada; 1 → Video rechazado por calidad | `/videos/[id]` | 🟢 Completo |
| `FabPublicacion01` / ¿Atribuir ejecución a video? | 0 → Cooper · atribuir ejecución; 1 → Cooper · continuar ejecución | `/videos/[id]` | 🟢 Completo |
| `FabRadar00000001` / ¿Radar encendido? | 0 → Canales (radar) | `/radar` | 🟢 Completo |
| `FabRadar00000001` / ¿Hay canales? | 0 → vidIQ: radar | `/radar` | 🟢 Completo |
| `FabRadar00000001` / ¿Solo ver? | 0 → Canales (ver radar); 1 → Leer ajustes | `/radar` | 🟢 Completo |
| `FabRadar00000001` / ¿Radar de noticias activo? | 0 → Canales de noticias | `/radar` | 🟢 Completo |
| `FabRedes00000001` / ¿Puntuar títulos? | 0 → Pedido de títulos; 1 → Agenda del canal | `/redes` | 🟢 Completo |
| `FabRedes00000001` / ¿Hay envíos? | 0 → Presentación · Subir a redes entrada; 1 → Aviso: nada que publicar | `/redes` | 🟢 Completo |
| `FabRedes00000001` / Esperar a las redes | 0 → Pedidos de estado | `/redes` | 🟢 Completo |
| `FabRedes00000001` / ¿Hay que consultar? | 0 → Estado en redes; 1 → Resumen de publicación | `/redes` | 🟢 Completo |
| `FabRedes00000001` / ¿Atribuir ejecución a video? | 0 → Cooper · atribuir ejecución; 1 → Cooper · continuar ejecución | `/redes` | 🟢 Completo |
| `FabReenviar00001` / ¿Hay pendientes? | 0 → Probar enlace; 1 → Resultado | `/decisiones` | 🟢 Completo |
| `FabReenviar00001` / Según diagnóstico | 0 → Reenviar tarjeta; 1 → Anular, Pedido original; 2 → Resultado | `/decisiones` | 🟢 Completo |
| `FabReferencias01` / ¿Generar referencias? | 0 → Generar principal; 1 → Aviso: referencias pendientes | `/referencias` | 🟢 Completo |
| `FabReferencias01` / ¿Hay vistas? | 0 → Generar vista; 1 → Biblia con referencias | `/referencias` | 🟢 Completo |
| `FabRetornoClaud1` / ¿Válido? | 0 → Buscar trabajo; 1 → Responder rechazo | `/videos/[id]` | 🟢 Completo |
| `FabRetornoClaud1` / ¿Trabajo pendiente? | 0 → Fila actualizada; 1 → Responder rechazo | `/videos/[id]` | 🟢 Completo |
| `FabRutina0000001` / ¿Hay atascados? | 0 → Aviso: atascados | `/rutina` | 🟢 Completo |
| `FabRutina0000001` / ¿Es lunes? | 0 → Pedido de reporte | `/rutina` | 🟢 Completo |
| `FabRutina0000001` / ¿Hay plan? | 0 → Aviso: plan del día, Un pedido por canal | `/rutina` | 🟢 Completo |
| `FabRutina0000001` / ¿Pide video? | 0 → Pedir video automático | `/rutina` | 🟢 Completo |
| `FabSonido0000001` / ¿Usa Epidemic? | 0 → Iniciar Epidemic; 1 → Resultado sonido | `/videos/[id]` | 🟢 Completo |
| `FabSonido0000001` / ¿Música activa? | 0 → Búsqueda de música; 1 → Efectos pedidos | `/videos/[id]` | 🟢 Completo |
| `FabSonido0000001` / ¿Hay efectos? | 0 → Buscar efecto; 1 → Resultado sonido | `/videos/[id]` | 🟢 Completo |
| `FabSonido0000001` / Proveedor de voz | 0 → Presentación · Voz (Gemini TTS) entrada; 1 → Presentación · Voz (HeyGen) entrada; 2 → Presentación · Voz (ElevenLabs) entrada | `/videos/[id]` | 🟢 Completo |
| `FabSonido0000001` / ¿Atribuir ejecución a video? | 0 → Cooper · atribuir ejecución; 1 → Cooper · continuar ejecución | `/videos/[id]` | 🟢 Completo |
| `FabTextoGPT0001` / ¿Codex respondió? | 0 → Resultado de texto; 1 → Permitir respaldo | `/admin/fabrica` | 🟢 Completo |
| `FabVidiq00000001` / Según acción | 0 → Palabras clave; 1 → Un ítem por título; 2 → Llamadas de cuenta | `/radar` | 🟢 Completo |
| `FabVidiq00000001` / ¿Hay títulos? | 0 → Puntuar título; 1 → Sin títulos | `/radar` | 🟢 Completo |
| `FabYouTube000001` / Según acción | 0 → Conexión (enlace); 1 → Conexión | `/redes` | 🟢 Completo |
| `FabYouTube000001` / ¿Canal válido? | 0 → ¿Ya existe?; 1 → Respuesta inválida | `/redes` | 🟢 Completo |
| `FabYouTube000001` / ¿Ya existe? | 0 → Fila pendiente; 1 → Fila nueva | `/redes` | 🟢 Completo |
| `FabYouTube000001` / ¿Conectado? | 0 → Renovar token; 1 → Sin conexión | `/redes` | 🟢 Completo |
| `FabYouTube000001` / ¿Pide estadísticas? | 0 → Canal en YouTube; 1 → Devolver token | `/redes` | 🟢 Completo |
| `FabYouTube000001` / ¿Vuelta válida? | 0 → Canjear código; 1 → Motivo del fallo | `/redes` | 🟢 Completo |
| `FabYouTube000001` / ¿Conexión lista? | 0 → Datos de conexión; 1 → Motivo del fallo | `/redes` | 🟢 Completo |

### Ajustes operativos

Todos se leen y editan en `/admin/fabrica`; el servidor valida tipo/rango, revisión y rol. Los seis ajustes de instalación reservados se enumeran en los límites y no se exponen al navegador.

| Ajuste | Control visible | Estado |
| --- | --- | --- |
| `allowClaude` | Investigación y guiones | 🟢 Completo |
| `allowImagenes` | Imágenes | 🟢 Completo |
| `allowRevisionVisual` | Revisión visual | 🟢 Completo |
| `allowClips` | Clips animados | 🟢 Completo |
| `allowVoz` | Voz | 🟢 Completo |
| `allowMusica` | Música | 🟢 Completo |
| `allowArchivo` | Video de archivo | 🟢 Completo |
| `allowEfectos` | Efectos de sonido | 🟢 Completo |
| `allowCritico` | Crítico de guion | 🟢 Completo |
| `allowTextoApi` | Respaldo de texto por API | 🟢 Completo |
| `allowVerificacion` | Verificación de cifras | 🟢 Completo |
| `allowReferencias` | Referencias visuales | 🟢 Completo |
| `allowAvatar` | Presentadores | 🟢 Completo |
| `allowMontaje` | Montaje | 🟢 Completo |
| `allowDrive` | Archivo en Drive | 🟢 Completo |
| `allowYoutube` | Publicación directa en YouTube | 🟢 Completo |
| `allowAnalytics` | Medición y aprendizaje | 🟢 Completo |
| `allowVidiq` | Investigación de audiencias | 🟢 Completo |
| `allowRadar` | Radar diario | 🟢 Completo |
| `allowMiniaturas` | Miniaturas | 🟢 Completo |
| `allowCortes` | Cortes verticales | 🟢 Completo |
| `allowRedes` | Publicación en redes | 🟢 Completo |
| `privacidadYoutube` | Privacidad de YouTube | 🟢 Completo |
| `modeloTexto` | Modelo de texto | 🟢 Completo |
| `modeloImagen` | Modelo de imágenes | 🟢 Completo |
| `modeloClip` | Modelo de clips | 🟢 Completo |
| `costoAvatarSegUsd` | Avatar: USD por segundo | 🟢 Completo |
| `costoVozHeygenCaracterUsd` | Voz HeyGen: USD por carácter | 🟢 Completo |
| `costoVozElevenCaracterUsd` | Voz ElevenLabs: USD por carácter | 🟢 Completo |
| `modeloVoz` | Modelo de voz | 🟢 Completo |
| `modeloCritico` | Modelo del crítico | 🟢 Completo |
| `vozGemini` | Voz predeterminada | 🟢 Completo |
| `costoImagenUsd` | Imagen: USD por unidad | 🟢 Completo |
| `costoClipSegUsd` | Clip: USD por segundo | 🟢 Completo |
| `costoRevisionUsd` | Revisión visual: USD por revisión | 🟢 Completo |
| `costoCriticoUsd` | Crítico: USD por revisión | 🟢 Completo |
| `costoRadarUsd` | Radar: USD por análisis | 🟢 Completo |
| `costoVerificacionUsd` | Verificación: USD por revisión | 🟢 Completo |
| `costoVozUsdPorPlano` | Voz: USD por plano | 🟢 Completo |
| `avisoGastoPct` | Umbral para pedir permiso de gasto (0 a 1) | 🟢 Completo |
| `presupuestoLargoUsd` | Presupuesto por video largo (USD) | 🟢 Completo |
| `maxVideosDiaPorCanal` | Máximo de videos diarios por canal | 🟢 Completo |
| `maxVideosDiaTotal` | Máximo de videos diarios de la fábrica | 🟢 Completo |
| `presupuestoShortUsd` | Presupuesto por video corto (USD) | 🟢 Completo |
| `movimientoMinShort` | Proporción mínima con movimiento (0 a 1) | 🟢 Completo |
| `clipsMaxShort` | Máximo de clips por corto | 🟢 Completo |
| `maxIntentosPlano` | Máximo de intentos por plano | 🟢 Completo |
| `costoMiniaturaUsd` | Miniatura: USD por unidad | 🟢 Completo |
| `idioma` | Idioma | 🟢 Completo |
| `calendario.zona` | Zona horaria de publicación | 🟢 Completo |
| `calendario.horas.youtube` | Hora de publicación: youtube | 🟢 Completo |
| `calendario.horas.youtube_shorts` | Hora de publicación: youtube shorts | 🟢 Completo |
| `calendario.horas.tiktok` | Hora de publicación: tiktok | 🟢 Completo |
| `calendario.horas.instagram` | Hora de publicación: instagram | 🟢 Completo |
| `calendario.horas.facebook` | Hora de publicación: facebook | 🟢 Completo |
| `calendario.diasEntreLargos` | Días mínimos entre videos largos | 🟢 Completo |
| `calendario.maxPorRedDia` | Máximo de publicaciones por red y día | 🟢 Completo |
| `calendario.cortesDias` | Días de salida de cortes (separados por comas) | 🟢 Completo |

### Tablas y eventos

| Tabla | Lectura / control en Cooper | Estado |
| --- | --- | --- |
| `fab_aprobaciones` | Decisiones y detalle de video; cierre de una puerta vigente | 🟢 Completo |
| `fab_canales` | Canales, biblia, Radar, Rutina, Redes y Cuentas | 🟢 Completo |
| `fab_costos` | Administración, exclusivamente para admin | 🟢 Completo |
| `fab_eventos` | Rutina, Avisos, Incidencias, Aprendizaje y registro administrativo | 🟢 Completo |
| `fab_planos` | Galería y reproductores del video | 🟢 Completo |
| `fab_publicaciones` | Programados y Publicados, por red y recibo | 🟢 Completo |
| `fab_trabajos` | Guiones, biblias, especialistas, propuestas y aprendizaje | 🟢 Completo |
| `fab_videos` | Listado/detalle, Incidencias, Decisiones y Programados | 🟢 Completo |
| `fab_youtube` | Estado y enlace preparado en Redes; credenciales solo servidor | 🟢 Completo |

| Evento / registro | Función visible | Estado |
| --- | --- | --- |
| `ajustes_cooper` | Ajustes: valores efectivos y registro de quién cambió qué | 🟢 Completo |
| `rutina_cooper` | Rutina: decisión, motivo, frenos y vínculo al video | 🟢 Completo |
| `aviso_cooper` | Avisos: aceptación/fallo/incertidumbre de Telegram | 🟢 Completo |
| `ejecucion_cooper` | Atribución interna de una ejecución a su recurso; alimenta Incidencias | 🟢 Completo |
| `incidencia_cooper` | Aprendizaje/Incidencias: verificador, crítico, calidad, error o cambio solicitado | 🟢 Completo |
| `correccion_cooper` | Aprendizaje: resolución explícita, sin inventarla por avanzar de etapa | 🟢 Completo |
| `orden (HMAC)` | Reserva, recibo, confirmación y recuperación del puente; nunca duplica por un timeout | 🟢 Completo |
| `progreso (HMAC)` | Etapa, medios y estado autorizado por SSE | 🟢 Completo |
| `WhatsApp (SQLite)` | Avisos y Perfil: salida/estado confirmado por webhook, por usuario | 🟢 Completo |

| Entrada del contrato Cooper | Pantalla / tratamiento | Estado |
| --- | --- | --- |
| `nuevo_canal` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| `nuevo_video` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| `corregir` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| `aprobar_guion` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| `aprobar_final` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| `ajustar_biblia` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| `programar` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| `referencias` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| `configurar_redes` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| `metas` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| `adoptar_cuenta` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| `eliminar` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| `control_fabrica` | Formularios de la función correspondiente; `control_fabrica` agrupa las acciones estructuradas de Operación | 🟢 Completo |
| Consulta `estado` | Estado/resumen del dueño; `gastos` y `ajustes` solo admin; `operacion` alimenta las pantallas nuevas | 🟢 Completo |
| Consulta `reporte` | Estado/resumen del dueño; `gastos` y `ajustes` solo admin; `operacion` alimenta las pantallas nuevas | 🟢 Completo |
| Consulta `pendientes` | Estado/resumen del dueño; `gastos` y `ajustes` solo admin; `operacion` alimenta las pantallas nuevas | 🟢 Completo |
| Consulta `tendencias` | Estado/resumen del dueño; `gastos` y `ajustes` solo admin; `operacion` alimenta las pantallas nuevas | 🟢 Completo |
| Consulta `gastos` | Estado/resumen del dueño; `gastos` y `ajustes` solo admin; `operacion` alimenta las pantallas nuevas | 🟢 Completo |
| Consulta `operacion` | Estado/resumen del dueño; `gastos` y `ajustes` solo admin; `operacion` alimenta las pantallas nuevas | 🟢 Completo |
| Consulta `ajustes` | Estado/resumen del dueño; `gastos` y `ajustes` solo admin; `operacion` alimenta las pantallas nuevas | 🟢 Completo |
