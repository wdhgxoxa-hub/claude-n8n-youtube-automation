# Revisión de producto para total-integrador

21-11-2026, Lima. Rama/worktree `total-integrador-producto`, base `a69e374`. Subtarea del integrador: auditoría inicialmente de solo lectura; después autorización del integrador para recuperar faltantes de competencia y chatfix en un worktree propio. No se modificaron otros worktrees, VPS, n8n vivo, D&S Factory, secretos ni servicios externos. Sin push o merge.

## Decisiones de integración

- Aprendizaje, competencia, Marcas y M01/M03/M05–M12 ya tienen implementaciones absorbidas en la base. Se contrastaron `git cherry`, asuntos de commits, blobs y diferencias por archivo. Los `+` aislados no acreditan falta: los conflictos de integración y el saneamiento del historial cambian patch-id. `total-radar-contexto` y `total-competencia-cierre` son ancestros; aceptación/navegación de competencia son equivalentes. Runtime Marcas y sonda vidIQ conservan todos sus archivos propios idénticos; solo difiere ESTADO.
- Ejemplos comprobados: `b569022`/`0d77294` → `90fd6a2` en aprendizaje; M01 `b123c7d` → `83e21bb`; M05 `dea270c`/`c6cd1dd` → `6ecfa3d`/`7d45231`; M07 `a546464` → `77aeebd`; M09 `f26ee71` → `7972734`; M10 `f4e7f25`/`fc3be39` → `4f96b55`/`1aadd9a`. Las diferencias posteriores observadas conservan el recibo M01, aceleran únicamente la simulación de biblioteca y completan evidencia/nombres de Aprendizaje.
- `total-margen-estrategia`: `818f3e5` y `390d551` estaban realmente ausentes. Se entregaron al integrador principal, que los aplica por separado; no se duplican aquí. Se avisó de que su prueba de `Nuevo video` necesita proporcionar los métodos actuales de lectura de lecciones/temas en la fixture. La estrategia no autoimporta la biblia activa ni programa publicaciones.
- `ecc8a48` sí faltaba: el informe de competencia citaba un empaquetador inexistente. Recuperado y adaptado para archivos nuevos o retirados: las altas carecen de exportación anterior, las bajas solo describen Git y no ordenan borrar el destino. El manifiesto conserva hashes, origen y ausencia de respaldo/despliegue real. El lote integrado ya contiene `FabCompYouTube01`, ausente en la base histórica; el helper original fallaba al intentar leerla allí.
- `39537a7` está mayormente absorbido por `e10b730`, pero su control adicional de exactamente una respuesta actual del Radar no lo está: la base usa `find`. Se notificó al integrador para coordinarlo con el frente n8n; este trabajo no cambia generador ni workflows.
- Chatfix `fdc6ebb`: la base ya contenía brevedad de 18 palabras y rechazo de mutaciones por preferencias. Se conserva literalmente esa política posterior y se recuperan únicamente aclaración con opciones, reconocimiento breve sin tarjeta y ausencia de recuerdos sin sustituirlos por un video activo. No se incorpora la variante antigua de 30 palabras.
- Chatfix `6827959`: la clasificación de acciones por video ya estaba compartida con el validador. Se reutiliza ese Set y se completan las descripciones de canal, eliminación por tipo y creación de canal sin recursoId. Se recupera la prueba de referencia con rechazo de ID de canal propio, adaptada al contrato actual.
- Chatfix `5ed6135`: recuperada la comprobación de ausencia de tarjetas por memoria; las aserciones conservan el prompt vigente. `1002cc0`: recuperados informe y evidencias con sus bytes originales; se añade al informe una nota inicial que limita sus resultados al código histórico. El 37/37 de aquel ensayo real no se atribuye a esta combinación.

## Commits

| Commit | Cambio |
| --- | --- |
| `2d55178` | Recuperar el empaquetador de competencia con altas/bajas y pruebas offline. |
| `8d16ba8` | Completar memoria/destinos del chat conservando brevedad y controles vigentes. |
| Commit que contiene este informe | Recuperar evidencia histórica de chatfix, aclarar su alcance y actualizar ESTADO. |

## Verificación focal

El integrador pidió no duplicar la puerta pesada; la puerta obligatoria completa, Sentinel y Playwright corresponden al checkout final combinado del integrador. Estos resultados son focales, no una puerta completa ni evidencia de despliegue.

| Comando | Resultado |
| --- | --- |
| `cd cooper && npm ci` | RC 0; 361 paquetes, cero vulnerabilidades. Aviso informativo de nueva versión npm, sin actualización. |
| `npm run lint` | RC 0, cero errores y advertencias. |
| `npm run typecheck` | RC 0. |
| `npm test -- --run tests/chat-ia.test.ts tests/chat-evaluacion.test.ts tests/chat-semantica.test.ts tests/chat-memoria.test.ts` | RC 0, 76/76, cuatro archivos, sin omisiones. |
| `node --test tests/flujos_v2.test.cjs` | RC 0, 173/173, sin fallos u omisiones. |
| `PYTHONDONTWRITEBYTECODE=1 python3 -W error tests/preparar_lote_competencia_test.py` | RC 0, 2/2; altas, modificaciones, bajas, hashes, salida existente y rechazo de flujo nuevo activo. |
| `PYTHONDONTWRITEBYTECODE=1 python3 -W error tools/cooper/preparar_lote_competencia.py --salida cooper/.cache/lote-competencia-integrador` | RC 0, 12 flujos y 25 archivos, referencia Git `a69e374`, sin red. |
| `git diff --check` | RC 0. |

Un primer comando de pruebas npm se invocó por error desde la raíz sin `package.json` y salió 254, antes de iniciar pruebas. Se corrigió el directorio; la ejecución de 76 pruebas anterior es la válida. No se cambiaron umbrales ni controles para pasar.

Se consultó la guía instalada `next/dist/docs/01-app/02-guides/testing/vitest.md`. No se añadieron APIs, adaptadores, dependencias ni llamadas externas. Los ensayos de chat son deterministas, con base y datos ficticios y red bloqueada.

## Limitaciones y Pendientes de Walter

1. La aceptación humana del chat y sus respuestas sigue pendiente en el informe histórico; este trabajo no invoca nuevamente el plan ni promete el comportamiento de todas las respuestas futuras.
2. No hay nuevas decisiones de Walter para integrar estos parches. La puerta completa y el control adicional de Radar son trabajo técnico del integrador; el lote offline no sustituye export previo, revisión, reversa y aceptación del VPS.

## Segunda revisión: conservación operativa de n8n

21-11-2026, Lima. Encargo adicional del integrador para preparar un lote sobre una instalación que ya tiene Radar, Confirmar y Aprendizaje activados, sin retroceder a las pausas del primer despliegue. No se accedió por SSH ni a exports, bases, credenciales o entornos reales. `revision_operacion` revisó el contrato; el integrador confirmó únicamente los IDs/estados de las tres dependencias seguras.

Commit de implementación: `da10629`, «Conserva activaciones n8n y verifica contenido concurrente antes de aplicar».

`deploy/preparar-n8n-total.py` incorpora **`--conservar-disparadores`**, que exige también inventario de metadata y `--publicar-dependencias-seguras`. Sin esta opción permanecen los defaults y formatos certificados anteriores. El modo nuevo:

- Conserva `disabled` de entradas externas por nombre y tipo; un cambio de tipo o una entrada nueva queda bloqueada. Las entradas internas de subflujo y manuales mantienen la fuente.
- Mantiene IDs, referencias de credenciales y webhook IDs de los nodos coincidentes. Credenciales ausentes siguen convertidas en bloqueo explícito; no se inventan referencias. Ajustes se copia opacamente, incluso sus URLs, sin sustituir parámetros por defaults.
- Las tres dependencias seguras deben estar activas previamente y se resuelven con sus IDs reales. Solo se republican workflows antes activos; no reabre históricos ni publica nuevos subflujos por inferencia. Una dependencia estática nueva o inactiva exige revisión explícita. Se conserva el orden topológico, con detección de ciclos.
- El export debe contener `versionId` y `activeVersionId`. Se añade una huella CAS canónica de `nodes`, `connections`, `settings`, ambas versiones y `active` por workflow. El diff guarda únicamente hashes; el contenido privado se procesa en memoria sin imprimirlo. Las IDs nuevas deben seguir ausentes.
- `deploy/aplicar-n8n-total.py` valida el contrato y el plan exactamente ensayado, comprueba CAS antes de crear mantenimiento o respaldar, y repite la comprobación después de detener escritores. Si aparece un cambio en esa ventana, restaura el snapshot más reciente sin importar ni publicar. Al terminar compara los nodos almacenados con los del lote exacto.

**Límite material:** CAS detecta cambios posteriores al export; no combina código vivo anterior al export con una fuente Git antigua. Operación avisó de posibles cambios vidIQ ya vivos ausentes de la fuente. Antes de aplicar el lote completo, el integrador debe contrastar base, fuente integrada y destino, conservar cambios exclusivos del destino y resolver los conflictos explícitamente. Esta opción no acredita esa conciliación ni constituye permiso técnico para sobrescribir código vivo sin comparar. No se declara un lote VPS preparado, ensayado o aplicado por esta subtarea.

Verificación: `PYTHONDONTWRITEBYTECODE=1 python3 -W error -m unittest discover -s deploy/tests -p 'test_*.py'`: **134/134 PASS**, RC 0, cero advertencias. Nueve casos nuevos cubren conservación con IDs remapeados, Ajustes opaco, credenciales, triggers nuevos, cambios de tipo, duplicados, históricos inactivos, export sin versiones, contratos alterados, CAS de los cinco campos sin cambiar `active`, colisión de una ID nueva, nodos finales exactos y carrera durante el snapshot con reversa sin import. Los tests anteriores de defaults, deltas, activación, esquema, ensayo y reversa permanecen aprobados.

La primera pasada detectó ResourceWarnings por conexiones SQLite no cerradas en las fixtures nuevas; se cerraron explícitamente y se repitió la suite. No se silenciaron advertencias. `git diff --check`: PASS. La puerta de aplicación completa y el ensayo del lote VPS concreto siguen separados de esta verificación operativa local. Sin decisiones nuevas de Walter: conciliación de cambios vivos, export consistente, ensayo y despliegue son trabajo técnico autorizado del integrador.

## Tercera revisión: conciliación de base, integrado y vivo

21-11-2026, Lima. Commit `186a408`, «Concilia n8n en tres vías sin sobrescribir cambios vivos». El integrador autorizó añadir `--base DIRECTORIO_JSON`; `a69e374` se usó como candidato diagnóstico y base sintética. **Su condición de ancestro Git no acredita que todos sus workflows estuvieran desplegados en n8n.** El parámetro exige el modo conservador anterior y no cambia su comportamiento cuando se omite. La cuarta revisión detalla cómo acreditar las decisiones sobre el export real.

La conciliación trabaja por nodo identificado por nombre, conexiones por origen y settings por clave. Si integrado coincide con base, conserva vivo; si vivo coincide con base, incorpora integrado; si ambos coinciden, conserva vivo; si ambos difieren, bloquea. Ausencias cuentan como valores distintos: conserva nodos exclusivos del vivo y eliminaciones de un lado sin cambios del otro, pero no elimina un nodo modificado por ambos. Un workflow presente en base y ausente en destino se bloquea porque no puede inferirse si fue retirado o nunca instalado. No elimina workflows completos ausentes de la fuente.

Normaliza las referencias conocidas de workflows con los mappings existentes y excluye de comparación IDs de nodos, posición, webhookId y estado de disparadores externos. Conserva esos campos operativos del nodo vivo compatible. Los IDs de credenciales se comparan por nombre y tipo mediante metadata; cambiar de cuenta mientras cambia el negocio requiere revisión. Ajustes siempre conserva el nodo vivo opacamente. Los disparadores nuevos se bloquean después de conciliar, los estados existentes permanecen intactos y las credenciales ausentes mantienen el error explícito. Los guards presentes únicamente en vivo se conservan si la implementación integrada no cambió respecto de base.

Valida que todas las conexiones explícitas señalen nodos finales existentes, mantiene las comprobaciones de referencias estáticas `workflowId`/`dataTableId` y recalcula el orden topológico. El diff registra únicamente nombres, hashes y decisiones; ante conflicto, la CLI retorna 1 y escribe `conflictos.json` privado, sin producir `entrada.json`. La comprobación CAS original sigue antes del snapshot y después de detener escritores. En este modo, al finalizar también exige coincidencia exacta de `nodes`, `connections` y `settings` con el lote ensayado.

Verificación final: `PYTHONDONTWRITEBYTECODE=1 python3 -W error -m unittest discover -s deploy/tests -p 'test_*.py'`: **147/147 PASS**, RC 0, sin advertencias. Trece pruebas adicionales cubren cambios exclusivos simultáneos, nodos nuevos vivos/integrados, referencias e IDs remapeados, campos operativos, disparadores, conflictos en los tres componentes, eliminaciones, conexiones rotas, cambios iguales, cuentas distintas, guards, Ajustes, workflows ausentes y nuevos, CLI sin entrada importable, CAS original y verificación completa posterior. `git diff --check`: PASS.

Un ensayo separado con la base Git `a69e374`, la fuente local y un destino sintético construido exclusivamente de esos archivos aprobó **33 workflows, 2.637 decisiones y plan de 33 publicaciones**. Sus versiones y metadata son ficticias. No se usaron archivos, exports o bases del VPS ni de otro worktree. Se consultó la [referencia oficial actual de datos de otros nodos de n8n](https://docs.n8n.io/build/work-with-data/transform-data/expression-reference/nodeoutputdata.md); no se añadieron llamadas a APIs.

Limitaciones reales: este merge es de componentes, no interpreta JavaScript ni ejecuta los Code para resolver nombres de nodos calculados. Una edición simultánea dentro del mismo nodo requiere resolución explícita aunque ambas modificaciones pudieran combinarse manualmente. La coincidencia estructural tampoco demuestra equivalencia del comportamiento; el ensayo funcional y la reversa sobre el lote privado exacto siguen siendo obligatorios. El integrador prepara ese lote y resuelve sus conflictos; aquí no se declara conciliación, ensayo ni despliegue del VPS. **Pendientes de Walter:** ninguno nuevo en esta subtarea técnica.

## Cuarta revisión: sincronización de vidIQ ya publicado

21-11-2026, Lima. Commit `411574c`, «Sincroniza la cuota vidIQ ya publicada conservando fiabilidad integrada». Preparado sobre el corte integrado `f18e0e6` en este worktree propio, sin modificar otro worktree. Combina los cambios `bfa9659` y `758fbd9` cuya publicación de n8n ya estaba acreditada, sin declarar cerrado el frente de aceptación de competencia.

El recibo público incorporado en `816eddf`, `docs/informes/evidencias/total-radar-contexto/delta3/aplicacion-vps.json`, identifica fuente `758fbd9`, entrada `036631ccf577443d5592af9b7b97c6a165e288d240b053f8048f6129c3f8af80`, tres workflows y 36 hashes de código. Los 36 coinciden con esa fuente Git. Este recibo es posterior a la copia inicial del integrador y obliga a obtener una copia nueva antes de ensayar/aplicar.

| Workflow | Comparación `758fbd9` → corte integrado | Decisión de integración |
| --- | --- | --- |
| `FabCompYouTube01` | Once nodos vidIQ y sus conexiones ausentes; ningún nodo previo modificado. Dos Code nuevos y cinco Code previos, siete hashes coincidentes con el recibo. | Añadir la extensión después de YouTube, conservar guardas de cuota y consumo desconocido, timeout 330 y Vigilante integrado. |
| `FabRadar00000001` | El integrado contiene dos normalizaciones posteriores de ítems, pausas de nodos y retención cerrada; conexiones idénticas. | Conservar íntegro el workflow integrado. Copiar el archivo antiguo completo revertiría esas correcciones. |
| `FabCooperAPI0001` | El integrado añade 54 nodos de transporte, cambia Resolver y respuesta de decisión. | Conservar íntegros API, transportes y contrato actual. |

Los conflictos fueron exclusivamente la lista de extensiones del generador y el timeout del hijo. Se preservaron todas las extensiones integradas y se añadió `FabCompYouTube01: 330` a `TIEMPO`, pues la pasada final de fiabilidad habría sustituido el 330 por su default 300. La regeneración modifica solo ese workflow: Radar, API, guardia de duplicados de competencia y todo `cooper/` son idénticos a `f18e0e6`. Los seis HTTP nuevos reciben la configuración común vigente: sin reintentos automáticos, lotes de uno con intervalo 1.100 ms, sin redirecciones, timeout de 15 segundos y respuesta textual completa. Los siete Code del hijo siguen idénticos a `758fbd9`.

El inventario generado estaba atrasado respecto de los transportes integrados. Se regeneró sobre la combinación actual: 33 flujos, 1.413 nodos, 166 decisiones/esperas, 58 ajustes y nueve tablas. Su cambio documental amplio no representa cambios adicionales a workflows ni a la app.

Pruebas focales: `node --test tests/flujos_v2.test.cjs tests/vidiq_competencia.test.cjs tests/competencia_youtube.test.mjs`: **251/251 PASS**, RC 0, sin advertencias ni omisiones; incluye la comparación del generador con los JSON sin reescribirlos. Primera pasada: 250/251 porque la prueba histórica exigía `retryOnFail:false` literal y fiabilidad elimina el campo apagado. La aserción ahora acepta únicamente false o campo omitido, equivalente en n8n; sigue rechazando true y otros valores. Se repitieron las 251 pruebas. El arnés real aislado de HTTP/evaluador se entregó a `revision_operacion` para sus pruebas sin red. Se consultó la [documentación oficial actual de vidIQ MCP](https://support.vidiq.com/en/articles/15082430-vidiq-mcp), que confirma endpoint, saldo compartido y consulta de saldo sin créditos; no se hicieron llamadas al proveedor, logins, compras ni despliegues.

### Acreditación necesaria de la base

Un ancestro Git o una imagen de Cooper no prueban el estado n8n previamente aplicado. El recibo FINAL3 liga una entrada exacta de 32 workflows por SHA; los deltas posteriores ligan sus propias entradas y objetivos. Para reconstruir una base instalada completa, el integrador puede procesar opacamente esas entradas privadas, verificar sus hashes contra los recibos públicos y encadenar los deltas por workflow. Los hashes de Code del recibo `816eddf` acreditan esos componentes, no todos los parámetros, conexiones o settings de los 33 workflows.

No basta con escoger el último export como base: si la fuente Git todavía omite una mejora ya publicada, esa elección podría borrar la mejora por considerarla una retirada intencional. Primero se sincroniza la procedencia publicada, como se hizo con los once nodos vidIQ. Además, para cada decisión `conservar_vivo` del diagnóstico final, `base_sha256 == vivo_sha256` acredita que no hay una diferencia semántica oculta en ese componente. Si difieren, hace falta clasificar su procedencia o resolverla explícitamente; no basta la ausencia de conflicto algorítmico. Ajustes y campos operativos conservados tienen su contrato separado. Estos controles se complementan con CAS posterior, ensayo exacto y reversa; no sustituyen esas pruebas.

El integrador confirmó que refrescará su réplica/export tras el delta aplicado. Esta subtarea no inspeccionó esos archivos privados, no certifica todavía el lote final y no cambia las decisiones de aceptación humana existentes. **Pendientes de Walter:** ninguno nuevo para esta sincronización técnica.
