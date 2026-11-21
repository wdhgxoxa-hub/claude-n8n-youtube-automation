# total-n8n-ramas — ramas opcionales y recuperación local

Fecha de cierre: 2026-11-21 14:18 (Lima). Rama/worktree propios `total-n8n-ramas`, creada desde `version-chatgpt` (`de397f3`) e iniciada con `git merge total-n8n-e2e`, avance rápido a `2dabc3a`. Implementado y probado exclusivamente en copias locales; pendiente revisión e integración fuera de esta rama. Sin push, merge a `main`/`version-chatgpt`, VPS, D&S Factory, OAuth, pagos ni publicaciones externas.

## Resultado

**48/48 recorridos PASS**: 21 audiovisuales, tres de Marcas y 24 de errores/recuperación. Cada variante o caso tiene tres corridas. La instancia registró **2.832 ejecuciones exitosas y tres errores de voz inducidos y esperados**, cero errores inesperados y cero ejecuciones colgadas. Las tres filas históricas del fixture quedaron intactas y el contenedor terminó `exited`. Tanda completa: 2026-11-21 14:06:53–14:16:13 (Lima), 560,10 s.

| Rama / caso | Corridas aprobadas |
| --- | ---: |
| Avatar completo + voz Gemini | 3/3 |
| Avatar parcial + voz HeyGen | 3/3 |
| Avatar parcial + voz ElevenLabs | 3/3 |
| Clips inline y URI, con PROCESSING → ACTIVE | 3/3 |
| YouTube directo, subida binaria simulada | 3/3 |
| Música y dos efectos por video | 3/3 |
| Noticia: dossier, hashes de guion/storyboard, visuales propios | 3/3 |
| Marcas reels: Instagram, Facebook y TikTok simulados | 3/3 en total, uno por red |
| Voz inválida, callback inválido/desconocido, render fallido | 3/3 por cada uno de los tres casos |
| Files: 40 consultas agotadas, FAILED, URI ajeno | 3/3 por cada uno de los tres casos |
| Caída en Wait y caída con callback pendiente | 3/3 por cada punto durable |

[Resumen verificable y hashes](evidencias/total-n8n-ramas/resumen.json), [log del ensayo](evidencias/total-n8n-ramas/ensayo.log), [resultado completo comprimido](evidencias/total-n8n-ramas/resultado.json.gz) y [552 pasos con tiempos/entradas/salidas](evidencias/total-n8n-ramas/pasos-motor.json.gz). Los JSON sin comprimir quedan en `cooper/.cache/total-n8n-ramas/2026-11-21T19-06-53.585Z/`. El cierre vuelve a comprobar la matriz guardada: tres por caso, estados finales, errores esperados exactos, doce caídas entre n8n y worker, cero ejecuciones activas y preservación del histórico.

Reels sintéticos reales de Marcas: [reel 1](evidencias/total-n8n-ramas/reel-1.mp4), [reel 2](evidencias/total-n8n-ramas/reel-2.mp4), [reel 3](evidencias/total-n8n-ramas/reel-3.mp4). H.264/AAC, 720×1280, duraciones 3,02/4,02/4,02 s. Son fixtures de integración, no contenido editorial terminado. Sus firmas inválidas respondieron 401 y sus repeticiones no produjeron reenvíos.

## Alcance y aislamiento

Se reutiliza `ensayo-total.mjs`: n8n 2.47.4 real en Podman, Data Tables, subflujos, aprobaciones, HMAC y persistencia. Contenedor exclusivo `cooper-total-n8n-ramas`, red interna comprobada, puerto loopback libre y volumen nuevo. No se leen `.env` reales, credenciales ni datos de producción; la copia inicial procede del fixture saneado versionado y se comprueba intacta al cerrar.

Cada recorrido audiovisual parte de un canal/biblia ficticios activos y atraviesa nuevo video → guion → aprobación → storyboard → aprobación → medios → montaje/calidad → aprobación final → publicación simulada. Las tres rondas comparten una instancia fresca para comprobar acumulación y aislamiento por canal. El recorrido anterior de nicho/radar/aprendizaje sigue disponible en `test:ensayo:total`; esta ampliación se centra en las ramas solicitadas.

Los transportes se sustituyen únicamente en la copia importada: las APIs pagas y redes no reciben llamadas. El lote conserva nodos reales, credenciales por referencia e interruptores originales. Las respuestas no soportadas fallan explícitamente. El receptor ficticio de progreso/presentación verifica HMAC; `permitido:true` prueba cableado, no una nueva verificación de identidad. La autorización real de Cooper se cubre por separado en la puerta web.

Marcas ejecuta el POST firmado y el worker de Cooper reales con SQLite exclusiva, FFmpeg/FFprobe locales y `RedSimulada`. El relay stdin/stdout solo admite `/api/marcas/operar`; no abre salida de red del contenedor al host. Su origen HTTPS se adapta a loopback únicamente en la copia y utiliza el secreto efímero del ensayo sin registrarlo.

## Cortes corregidos

- **Avatar terminado ausente en Cooper.** La composición recibía `Presentación lista`, pero `Cooper · piezas terminadas` leía el resultado anterior de Sonido y marcadores sin URL. Ahora usa la misma salida final del montaje. Regresión roja→verde para presentación completa y mezcla por partes; se mantienen orden, voz y medio sin filtrar referencias privadas. La prueba anterior simulaba erróneamente `son.planos`; se corrigió para representar el contrato real.
- **Clips por URI descargados antes de estar disponibles.** Se valida y reconstruye la referencia oficial de Google Files, se consulta su estado y solo `ACTIVE` permite descargar. `PROCESSING` espera cinco segundos y vuelve a consultar, con máximo 40 consultas por ítem. `FAILED`, URI ajeno, respuesta incoherente, error HTTP y agotamiento conservan `con_fallas`, con sello de progreso. No regeneran el clip. Un plano sano junto a uno fallido no alcanza sonido, montaje ni aprobación final.
- **Evidencia de ejecución prematura.** La API puede indicar ejecución terminada antes de guardar su traza. El ensayo espera `runData` cuando el workflow guarda ejecuciones; no interpreta un resultado todavía vacío como ausencia de una rama.

Los ajustes de fixtures se distinguen de defectos de fábrica: canales con `eliminado:false` y `biblia_ruta`, dueño en la recuperación de canal, narración de noticia con duración suficiente y presupuestos/topes locales para el lote. No se rebajaron controles de calidad ni permisos del producto.

## Recuperación y errores

Se prueban contrato de voz inválido con Vigilante, callbacks inválidos/desconocidos, render terminal fallido y tres errores de Google Files. Los errores inducidos se identifican por execution ID; cualquier otro error hace fallar el ensayo. Cero publicaciones ni aprobaciones finales en videos fallidos.

Se provoca SIGKILL de n8n en dos puntos durables: aprobación en Wait y trabajo `crear_biblia` enviado, pendiente de callback. Se verifica exit 137, mismo volumen/ejecución/trabajo, reanudación y rechazo de duplicados sin encargos nuevos. No se afirma recuperación automática de una petición remota en vuelo.

Marcas también sufre SIGKILL antes de enviar (reanuda una pieza aprobada) y después de reservar el envío (conserva resultado incierto para revisión). Se adelanta solo el lease del fixture para ensayar conciliación sin esperar cinco minutos. Repetir el despertar no vuelve a publicar la pieza incierta. Firma inválida responde 401.

## Puerta y evidencia

**Puerta completa: cero errores y cero advertencias**, sin omisiones ni reintentos E2E. Los siete comandos terminaron con rc 0 sobre el código `f283319`; el cierre posterior solo incorpora documentación y evidencia.

| Comando | Resultado | Tiempo |
| --- | --- | ---: |
| `npm ci` | PASS | 9.50 s |
| `npm run lint` | PASS | 4.40 s |
| `npm run typecheck` | PASS | 1.28 s |
| `npm test` | 284/284 PASS | 20.81 s |
| `npm run test:e2e` | 43/43 PASS | 417.03 s |
| `npm run build` | PASS | 3.91 s |
| `node --test tests/flujos_v2.test.cjs` | 182/182 PASS | 1.18 s |

[Registro de puerta](evidencias/total-n8n-ramas/puerta.json), [unitarias](evidencias/total-n8n-ramas/unitarias.log), [E2E](evidencias/total-n8n-ramas/e2e.log), [flujos](evidencias/total-n8n-ramas/flujos.log) y [entorno/regeneración idéntica](evidencias/total-n8n-ramas/entorno.json). Node 24.22.3, npm 12.2.2, Podman 6.2.0, n8n 2.47.4 y FFmpeg/FFprobe 9.0.2. Se reutilizaron los binarios de Chromium de la caché del ensayo base mediante enlaces locales; las bases, servidores y resultados de E2E permanecieron exclusivos de este worktree.


## Lote, diff y reversa

[Lote entregado en Git](evidencias/total-n8n-ramas/lote-total-n8n-ramas.tar.gz), [manifiesto](evidencias/total-n8n-ramas/lote-manifest.json) y [prueba de diff/reversa](evidencias/total-n8n-ramas/lote-verificacion.json). Origen `f283319`; **94 archivos verificados, 32 workflows inactivos**. Se aplicó el diff sobre una copia de `2dabc3a`, se comparó toda la entrada y se aplicó la reversa, recuperando todos los hashes originales. SHA-256 del tar.gz: `346422176909e50810e6705eba4c4b4ade0aa851e14997b5faf98a552a1ed1d2`.

El empaquetador existente incorpora ahora `cambios.diff` y `reversa.diff` con SHA-256. La entrada contiene 32 workflows inactivos, contratos de tablas y migraciones; la reversa de código usa `2dabc3a`. No es un respaldo del destino. Antes de instalar se requiere respaldo real, mapa de IDs, preservación de ajustes/credenciales y revisión del procedimiento existente de despliegue. Esta misión no instala el lote.

## Commits

- `6b54f54` — Ensayar fallos y recuperación durable de n8n local
- `40601e2` — Extender transportes ficticios de ramas audiovisuales
- `11bace4` — Informar de inmediato fallos inesperados del ensayo de resiliencia
- `a19fea7` — Conservar canales de resiliencia visibles en la copia local
- `a2c1f92` — Esperar archivos de clips activos antes de descargarlos
- `1ecc6c6` — Conservar los avatares terminados en las escenas de Cooper
- `e752d53` — Recorrer ramas opcionales y reels de Marcas en n8n aislado
- `404742e` — Incluir diff aplicable y reversa verificable en el lote n8n
- `f283319` — Cubrir fallos de archivos de clips y documentar el ensayo de ramas

El commit de cierre incorpora informe, evidencia, aclaración del diagnóstico parcial y actualización de `docs/ESTADO.md`.

## Reproducción

Desde `cooper/`, con Node 24/npm 12, Podman, imagen n8n 2.47.4 y FFmpeg/FFprobe:

```bash
npm run test:ensayo:ramas
```

Tres rondas por defecto. `COOPER_TOTAL_RONDAS=1` y `COOPER_RAMAS_CASOS=clips,noticia` son diagnósticos parciales; el ejecutor no los presenta como aceptación completa. Desde la raíz, regeneración y lote offline:

```bash
python3 tools/generar_flujos_v2.py
python3 tools/cooper/preparar_lote_cobertura.py --base 2dabc3a --salida cooper/.cache/lote-total-n8n-ramas
```

## Limitaciones reales

- Proveedores y publicación son ficticios. Los clips y descargas de YouTube usan un MP4 sintético H.264 de 16×16 y ocho segundos, no una producción de IA. El render de la fábrica devuelve metadatos derivados de la composición; no descarga/monta todos los medios externos. Los reels de Marcas sí son archivos MP4 generados localmente.
- Noticias usan hechos y fuentes `.invalid` de ensayo y un verificador determinista. Se prueban hashes, vigencia, fuentes y restricciones de visuales, no veracidad periodística ni calidad del proveedor.
- HeyGen/ElevenLabs/Gemini usan contratos ficticios. No se validan identidad biométrica, disponibilidad, cuotas, calidad ni consentimiento contra cuentas reales.
- YouTube directo prueba renovación ficticia, apertura de sesión y subida binaria. No se ensaya OAuth ni recuperación remota `308/Range` de una subida incierta. La ruta conserva la privacidad configurada por el flujo; `publicado` no demuestra visibilidad pública.
- La recuperación cubre Wait y encargos persistidos. No garantiza exactamente una vez en servicios externos ni exclusión entre dos producciones concurrentes del mismo video. El fallo de Files bloquea la continuación de su ejecución.
- Los límites previos de aprendizaje por días exactos 2/7 y vínculo de métricas con versión/tiempos publicados siguen pendientes; esta misión no los amplía.

## Pendientes de Walter

1. Revisar con Claude el lote y decidir integración/destino; mantener separado cualquier permiso de despliegue.
2. Autorizar, si corresponde, ensayos de proveedores, medios y publicación reales, con presupuesto, modelos, identidades, permisos y OAuth explícitos.
3. Decidir la conciliación de subidas remotas inciertas de YouTube y de ejecuciones concurrentes; no activar reintentos ciegos que puedan duplicar publicaciones.
4. Mantener los pendientes anteriores de Marcas, VPS, Meta y aprendizaje; no reactivar esperas históricas como parte de este lote.

## Documentación oficial consultada

- [n8n API: autenticación](https://docs.n8n.io/connect/n8n-api/authentication.md), [ejecuciones](https://docs.n8n.io/connect/n8n-api/build-and-run/executions), [workflows](https://docs.n8n.io/connect/n8n-api/build-and-run/workflows), [Data Table](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.datatable/rows).
- [Wait y persistencia](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait), [tratamiento de errores](https://docs.n8n.io/build/flow-logic/handle-errors-gracefully.md), [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/).
- [Omni: videos por URI](https://aistudio.google.com/docs/omni#retrieving-videos-with-an-uri), [Google Files](https://aistudio.google.com/api-reference/files), [HeyGen: crear video](https://developers.heygen.com/reference/create-video), [YouTube: protocolo de subida reanudable](https://developers.google.com/youtube/data/guides/using_resumable_upload_protocol).
