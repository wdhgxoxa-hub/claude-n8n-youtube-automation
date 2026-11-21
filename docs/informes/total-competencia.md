# cooper-total — frente competencia

Fecha: 2026-11-21, Lima. Rama `total-competencia`, worktree `~/Proyectos/cooper-wt/total-competencia`, base `de397f3`.

Implementación en rama propia. El orquestador integra e instala los cambios; autorizó después sondas de lectura desde el VPS y una sonda manual de vidIQ mediante su credencial existente. Este frente no publicó contenidos ni hizo OAuth, pagos o lecturas de archivos `.env` reales. No extrajo valores de la credencial vidIQ: se referencia en el nodo HTTP y n8n la utiliza durante la ejecución.

**Cierre local sobre `30cb276`:** se conserva abajo el registro previo de sondas y pruebas encontrado en la rama. No se reejecutaron esas sondas ni se accedió al VPS durante este cierre; no hubo despliegue, push ni merge. La aceptación real de 3–5 cuentas con muestras/outliers y homónimos sigue pendiente. Los fixtures no sustituyen esa evidencia ni prueban crecimiento de vistas, retención o seguidores.

## Auditoría A/B

Evidencia inicial sobre `de397f3`, antes de esta implementación:

| Clase | Faltante | Evidencia | Tratamiento |
| --- | --- | --- | --- |
| A | Radar dependía a la vez de `allowRadar` y `allowVidiq`; no tenía alternativa pública sin gasto. | `tools/generar_flujos_v2.py:2750`, interruptores por defecto en `:341` | Nuevo camino Codex público; el pedido fuerza `sin_api:true` aunque exista permiso global de respaldo. |
| A | La orden de observar 3–5 competidores aparecía en adopción, pero cada guion podía arrancar sin investigación. | `skill/FABRICA.md:59`; `tools/generar_flujos_v2.py:604`, `:654` | Investigación nueva y validación obligatoria antes de `Nuevo video`; también antes de proponer textos de marca. |
| A | Radar web mostraba ideas y sonidos, sin cuentas, muestras comparables ni homónimos. | `cooper/src/componentes/operacion.tsx:415` | Panel compartido en Radar por canal y Competencia por marca; persistencia privada. |
| A | No había regla verificable de diferenciación para Margen Real. | `skill/FABRICA.md:81` | Regla Perú/soles/cifras/casos/fuentes peruanos, sin atribuir cuentas mexicanas a la propia. |
| A/B | Acceso y cuota actuales de vidIQ sin prueba; una credencial con ese nombre no los demuestra. | `docs/informes/cooper-cobertura.md:377`; auditoría remota comunicada por el orquestador | Sonda gratuita preparada y probada localmente. Comprobar la conexión es A; cambiar acceso o cuenta, si fuese necesario, es B. La ruta nueva no depende de él. |

También se leyeron completos `cooper-fase3`, `cooper-fase4`, `cooper-whatsapp-alta` y `cooper-ensayo`; sus hechos históricos no se tomaron por vigentes. Se comunicaron al orquestador: aceptación real de avatar/voz y ensayos de producción pendientes; retención de originales por decidir; Meta con pago/verificación/plantillas/App Secret pendientes (`cooper-whatsapp-alta.md:34`, `:49`, `:60`, `:73`); ensayo aislado sin OAuth ni publicación real. Su cierre pertenece a otros frentes o a Walter.

## Qué cambió

- Contrato compartido en `cooper/src/contratos/competencia.mjs`, esquema cerrado en `competencia-schema.ts`. Guarda estado, fecha, cuentas, publicaciones, vistas, muestra, mediana, multiplicador, homónimos, consultas, diferenciación y limitaciones. Nunca transforma una métrica ausente en cero.
- Exige respuesta del puente con `ruta:codex`, `busqueda_real:true` y URLs en `fuentes_consultadas`. Acepta perfiles sociales HTTPS únicos, entre tres y cinco cuentas para declarar listo. La identidad requiere el perfil abierto o una página primaria abierta que lo enlace, visible como «Fuente de identidad». Las muestras siguen exigiendo publicaciones sociales abiertas, fecha no futura de los últimos 90 días y vistas explícitas; un destacado de los últimos 30 días debe duplicar la mediana de al menos tres publicaciones anteriores del mismo formato. El código calcula la mediana y el multiplicador.
- Las búsquedas de nombre exacto en YouTube y TikTok son obligatorias. «No hay homónimos confirmados» nunca afirma que no existan. No se cargaron cuentas ni cifras reales sin investigación.
- `tools/cooper/competencia_flujos.py` compone el radar sin modificar contratos de otros frentes. `antes_idea` ejecuta investigación, vuelve a leer la fila y bloquea el guion si el resultado no está listo/vigente. Conserva el aviso breve del radar manual/programado, pero no envía uno por cada chequeo previo. El chequeo previo tampoco abre la rama diaria de noticias.
- La respuesta parcial o fallida se persiste con limitaciones y sin ideas inventadas. Las ideas que se admiten deben apuntar a un destacado comprobado. El siguiente guion recibe `datos.competencia`; `skill/FABRICA.md` obliga a leerlo y aplicar su diferenciación.
- Marcas usa el transporte existente `/v1/texto` restringido a loopback, sin redirecciones, respuesta acotada y sin respaldo API. Persiste por dueño/marca en la tabla de eventos existente, revalida cuenta activa y evita pedidos simultáneos de la misma marca. Proponer texto en modo real exige investigación lista; editar un borrador manual conserva el comportamiento existente.
- El puente concede 180 segundos únicamente a `radar` con búsqueda, con cancelación y una sola plaza compartida. Sus clientes permiten 190 segundos. Chat, críticos y verificadores conservan sus plazos anteriores.
- La pestaña Competencia y Radar muestran origen, muestra y límites junto a las hipótesis de crecimiento en vistas, retención y seguidores. No atribuyen retención o seguidores ganados privados a competidores.
- El cierre exige una publicación de los últimos 30 días y al menos tres anteriores comparables **por cada competidor**. Se requiere al menos un destacado en el conjunto; las demás cuentas pueden no tenerlo, pero deben tener muestra suficiente. Una cuenta sin muestra deja el radar parcial. La web permite desplegar las publicaciones con enlaces, fecha, formato y vistas.
- La puerta comprueba que la fila releída coincida con el resultado de la investigación de ese pedido: una fila anterior vigente no permite saltar un fallo. El especialista de Marcas recibe además la diferenciación como instrucción explícita, incluida la identidad peruana de Margen Real.
- `tools/cooper/preparar_sonda_vidiq.py` prepara un flujo manual inactivo: `initialize`, `tools/list` y solo `vidiq_balance`, `vidiq_user_channels`, `vidiq_list_competitors` si están anunciadas y no necesitan argumentos desconocidos. Prohíbe redirecciones, no reintenta ni invoca investigación. Guarda únicamente códigos/estado, campos numéricos de saldo, IDs públicos de canal y créditos reportados (ausencia = `null`). Ejecuciones y salida CLI cruda se descartan.
- `tools/cooper/preparar_sonda_youtube_competencia.py` prepara una sonda manual de tres canales, cuatro videos por canal y búsqueda de nombre. Requiere el getter aislado existente `CoopEnsayoTok01`; no inicia OAuth. Conserva formato sin clasificar, vistas ausentes como `null` y candidatos homónimos sin darlos por confirmados. Es diagnóstico auxiliar: no alimenta ni desbloquea automáticamente el radar productivo.

## Sondas reales desde el VPS

Registro previo conservado; el cierre local no revalidó esos ensayos ni obtuvo acceso actual a las redes o a vidIQ.

El orquestador autorizó llamadas a `/v1/texto` a través del túnel de la PC, usando la credencial de entorno dentro del proceso, sin mostrarla. Los intentos se hicieron con `sin_api:true`, sin disparar n8n, ideas ni publicaciones. La primera configuración de URL de entorno no era válida para el transporte; se comunicó al orquestador y las sondas siguientes usaron el loopback explícito que él había comprobado.

| Intento | Resultado observado | Conclusión |
| --- | --- | --- |
| 1 | HTTP 200, 23,9 s; búsqueda real, 0 URLs de apertura | `sin_datos`. Los eventos eran búsquedas con consultas, no aperturas; el contrato no estaba perdiendo URLs. |
| 2 | HTTP 200, 31,7 s; 2 fuentes abiertas, 0 cuentas aceptadas | `parcial`; los perfiles y búsquedas propuestos no tenían evidencia suficiente. |
| 3 | HTTP 200, 27,1 s; 0 fuentes abiertas, incluso con candidatos explícitos en la sonda | `sin_datos`; no se conservaron candidatos sin prueba. |
| 4 | HTTP 200, 33,2 s; 1 fuente primaria, 1 cuenta aceptada, 0 muestras/outliers/homónimos | `parcial`. Diario Gestión Perú y su perfil `https://www.youtube.com/@diariogestionTV` quedaron acreditados por una página propia de Gestión. |

La fuente de identidad del cuarto intento se revisó además directamente: el [anuncio oficial de Diario Gestión](https://gestion.pe/peru/diario-gestion-lanza-su-segundo-canal-en-youtube-con-programacion-propia-diariogestiontv-diario-gestion-peru-noticia/) identifica y enlaza el canal peruano de economía, negocios y finanzas. No aporta una muestra de vistas; por eso no se inventó ningún destacado. El prompt genérico no contiene cuentas sembradas.

La evidencia segura está en `cooper/.cache/competencia-vps-radar-intento{1,2,3}.json` y `competencia-vps-radar.json`. Las respuestas crudas permanecen en archivos privados 0600 dentro del contenedor remoto; no se copiaron ni imprimieron. El cuarto resultado queda asociado a `/tmp/cooper-competencia-radar-real-1795275849638.json`.

**No está demostrada una investigación completa real de 3–5 cuentas con outliers y homónimos.** El mecanismo y su bloqueo están implementados/probados; este resultado parcial no cierra esa aceptación. La sonda inicial de vidIQ se importó inactiva como `CoopSondaVidIQ01`; ejecución CLI 785 terminó con error en cinco segundos, sin diagnóstico persistido. No demuestra rechazo del proveedor: se investiga el ejecutor aislado antes de repetir.

## Documentación consultada

- Contrato local `docs/puente-codex.md` y servidor existente; guía CLI instalada al revisar el puente.
- [OpenAI: búsqueda web y fuentes](https://developers.openai.com/api/docs/guides/tools-web-search). Se reutilizó el puente existente; no se incorporó un endpoint público inventado.
- [vidIQ: servidor MCP](https://support.vidiq.com/en/articles/15082430-vidiq-mcp) y [referencia oficial de herramientas](https://github.com/vid-io/vidiq-mcp#tools-the-workflows-use): saldo, canales conectados y lista guardada de competidores cuestan cero créditos; las herramientas de investigación suelen costar cinco y quedan fuera de la sonda.
- [MCP: transporte HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports), [HTTP Request de n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) y [variables del ejecutor de tareas](https://docs.n8n.io/hosting/configuration/environment-variables/task-runners/).
- Documentación de Next instalada en `cooper/node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`. La corrección de carga de imagen procede del frente aprendizaje.
- [YouTube Data API: videos.list](https://developers.google.com/youtube/v3/docs/videos/list). Durante el cierre se volvió a consultar esta referencia, HTTP Request de n8n y la guía oficial del MCP de vidIQ; no se invocaron esos proveedores.

## Puerta final del cierre — 2026-11-21, 11:23 Lima

Ejecutada sobre `30cb276`, en el orden obligatorio y con salida conjunta **0**:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Después, desde la raíz:
node --test tests/flujos_v2.test.cjs
```

| Comprobación | Resultado |
| --- | --- |
| Instalación | rc 0, cero vulnerabilidades |
| Lint y tipos | rc 0, cero errores/advertencias |
| Unitarias | 292/292, 31 archivos |
| E2E | 44/44, sin omisiones ni reintentos |
| Build | rc 0, Next.js 16.4.6 |
| Flujos | 150/150 |
| Auxiliares: puente / sondas vidIQ y YouTube | 13/13 y 6/6 |

**Cero errores y cero advertencias.** Node 24.22.3, npm 12.2.2. Evidencia versionada: [resultado y hashes](evidencias/total-competencia/resultado.json), [puerta completa](evidencias/total-competencia/puerta.log), [flujos](evidencias/total-competencia/flujos.log), [auxiliares](evidencias/total-competencia/auxiliares.log). Las copias de logs solo normalizan saltos de línea y espacios finales; el resultado conserva también sus hashes originales.

Se comprobó la muestra desplegable, fuentes y diferenciación con fixtures explícitos: [captura](evidencias/total-competencia/radar-1440.png), seis anchuras 360/390/768/1024/1440/1920 y Axe sin violaciones. La captura se revisó visualmente; Sentinel pasó con su guardián activo. La prueba dirigida del radar está en [radar-selector.log](evidencias/total-competencia/radar-selector.log).

Se conservan dos intentos de cierre fuera de Git: uno interrumpido voluntariamente para exigir muestra por cada competidor (`competencia-puerta-cierre-interrumpida.log`) y otro con 43/44 E2E (`competencia-puerta-cierre-selector-fallido.log`). Este último encontró que el selector «600 vistas» coincidía tanto con el destacado como con la muestra nueva. Se acotaron los selectores a su publicación y elemento de lista, sin ocultar contenido ni relajar aserciones; la prueba dirigida y la puerta completa posterior pasaron. Las evidencias crudas finales son `cooper/.cache/competencia-puerta-cierre-final.log` y `competencia-flujos-cierre-final.log`.

Las 32 exportaciones se regeneraron sin diferencias; los 14 hashes del lote y sus seis flujos inactivos se verificaron en [lote-verificado.json](evidencias/total-competencia/lote-verificado.json). El lote procede de `1b29e47`; el único cambio posterior de código en `30cb276` es el selector E2E. No hay despliegue ni aceptación remota implícita en estos resultados.

## Evidencia de la puerta anterior al cierre

Puerta completa final aprobada con código de salida **0**: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` (**291/291**), `npm run test:e2e` (**44/44**) y `npm run build`. Cero errores y cero advertencias. SHA-256 de `cooper/.cache/competencia-puerta-final.log`: `66de56960599c5a5321b8a18751a43121028a0e50c949153e3b9513eeb126202`.

Desde raíz: `node --test tests/flujos_v2.test.cjs` **149/149**; `node --test tests/puente-codex.test.mjs` **13/13**; sondas vidIQ y YouTube **6/6**. La ejecución conjunta final de flujos y sondas dejó **155/155** (`competencia-flujos-sondas-final.log`). Las 32 exportaciones regeneradas son idénticas por SHA-256.

Sentinel incluido en E2E recorrió Marcas con 1.000 acciones de caos, sin congelamiento ni caída; su único hallazgo es informativo de cobertura de una pestaña sin URL propia. La matriz del radar pasó 360/390/768/1024/1440/1920 px y Axe; se inspeccionó su captura final con la fuente de identidad visible.

La primera puerta tuvo instalación/lint/tipos y `290` unitarias verdes, pero `43/44` E2E: el caos de Sentinel pulsó la mutación nueva y su guardián de solo lectura la bloqueó. Se añadió ese botón a la misma lista explícita de exclusión de mutaciones, y Playwright prueba investigar, mostrar el estado y conservarlo tras recargar. No se relajaron guardián, umbrales ni evaluación de errores. Tras añadir fuente de identidad, otra ronda detectó un selector ambiguo: el nombre del perfil coincidía también con su enlace de fuente. Se corrigió con coincidencia exacta y se repitió toda la puerta hasta los resultados anteriores. Los fallos se conservaron en los logs de rondas 1 y 4.

Evidencia local, fuera de Git:

- `cooper/.cache/competencia-puerta1.log` y `competencia-sentinel-puerta1.json`: fallo inicial conservado.
- `cooper/.cache/competencia-puerta-final.log`: repetición completa.
- `cooper/.cache/competencia-flujos.log`, `competencia-puente.log`: regresiones de flujo y plazo/cancelación.
- `cooper/.cache/competencia-radar-1440.png`: interfaz con datos explícitamente ficticios; matriz 360/390/768/1024/1440/1920 y Axe.
- `cooper/.cache/sentinel-marcas/informe.json`: recorridos, caos y estabilidad con guardián activo.

## Commits

1. `178a9b4` — Dar al radar público un plazo acotado de tres minutos.
2. `e1ec5cf` — Exigir competencia pública comprobada antes de cada idea.
3. `78e4e27` — Cargar la vista previa de Marcas sin retrasar su imagen visible. Cherry-pick de `71613de`, del frente aprendizaje.
4. `3f61b20` — Verificar el radar obligatorio al componer otras puertas. La regresión comprueba que ningún camino puede saltar investigación/relectura/validación, sin impedir la puerta adicional de aprendizaje.
5. `2031471` — Exigir abrir fuentes públicas y explicar la falta de evidencia.
6. `3cf055c` — Documentar identidades con fuentes primarias sin inventar métricas.
7. `eb240d1` — Distinguir perfil y fuente de identidad en la prueba visual.
8. `271c2d6` — Preparar una sonda gratuita de acceso a vidIQ sin extraer credenciales.
9. `9e32361` — Preparar lectura pública acotada de competencia en YouTube.
10. `7008b2a` — Vincular cada idea a su radar y mostrar la muestra comprobada.
11. `ecc8a48` — Preparar el lote revisable de competencia para el orquestador.
12. `1b29e47` — Exigir una muestra comparable por cada competidor.
13. `30cb276` — Distinguir el destacado de su muestra en la prueba del radar.
14. El commit documental de cierre se obtiene con `git log -1 -- docs/informes/total-competencia.md`.

## Lote n8n para el orquestador

Preparado desde `1b29e47` contra la base `de397f3`, sin red: [manifiesto versionado](evidencias/total-competencia/lote-manifest.json). Contiene **6 exportaciones inactivas**, sus seis referencias anteriores, un patch de flujos/fuentes y las instrucciones: **14 archivos con SHA-256**. IDs modificados: `FabAjustes000001`, `FabCooperAPI0001`, `FabErrores000001`, `FabOrquestador01`, `FabRadar00000001` y `FabTextoGPT0001`. El manifiesto enumera nodos y cambios de conexiones.

Lote local: `cooper/.cache/lote-total-competencia-final/`, con `flujos-y-fuentes.patch` y `LEER-ANTES.md`. Reproducir en un destino nuevo:

```bash
python3 -W error tools/cooper/preparar_lote_competencia.py --salida cooper/.cache/lote-competencia-revision
```

Integrar los commits de la rama con aprendizaje y demás frentes, regenerar los JSON y repetir la puerta integrada. El patch es material de revisión y no contiene toda la web. Preservar las puertas de ambos frentes y actualizar web, `skill/FABRICA.md` y puente Codex. No sobrescribir ajustes vivos con los defaults exportados ni activar vidIQ. Las sondas auxiliares quedan fuera del lote productivo. `respaldo_real:false` y `desplegado:false`: la referencia anterior de Git no sustituye el respaldo del destino ni autoriza despliegue desde este frente.

## Limitaciones reales

- Las pruebas de contrato, transporte y UI usan fixtures explícitos; no prueban que hoy existan tres cuentas con datos públicos suficientes. Las cuatro sondas sí prueban transporte real y un resultado parcial con identidad comprobable. La investigación depende del puente de la PC y de la accesibilidad de las redes. Un intento incompleto sigue bloqueando la idea; no se debilitó el validador para convertir falta de datos en éxito.
- La lista de URLs acredita consultas del puente y el cálculo es reproducible; no demuestra por sí sola que cada cifra leída por el modelo sea correcta ni que una publicación pertenezca al perfil indicado. Se requiere revisar las fuentes cuando se acepte un radar real. Los patrones son hipótesis, no causalidad ni garantía de crecimiento.
- Una búsqueda pública exploratoria del nombre Margen Real no confirmó un homónimo mexicano verificable; eso no demuestra su ausencia. No se persistieron resultados inventados para completar la pantalla.
- No se activó `allowVidiq` ni se invocaron herramientas con coste. Los nodos históricos de vidIQ/analista se conservan desconectados del camino nuevo para revisar el lote.
- Este frente no despliega Cooper ni publica flujos de producción. La sonda manual inactiva está aislada. La composición con aprendizaje requiere regenerar los JSON y repetir la puerta integrada. Las dos rondas finales con videos pertenecen al cierre del orquestador.

## Pendientes de Walter

1. Confirmar identidad, país, público y cuentas propias por marca para no confundirlas con homónimos; Margen Real mantiene Perú como regla explícita.
2. Revisar el primer radar real y sus fuentes. Si las redes impiden obtener muestras públicas, aportar/enlazar cuentas verificables o decidir un acceso ya autorizado; no se solicita ni se presume una compra de vidIQ.

Los problemas de conexión del puente y despliegue siguen siendo trabajo A del orquestador; no se convierten en una aprobación pendiente de Walter.
