# Integración web y Sentinel

21-11-2026, Lima. Frente delegado de `total-integrador`, rama y worktree propios
`total-integrador-web`, base `a69e374`. Cambios implementados e integrados en esta
rama local; sin publicación, push ni despliegue desde este frente.

## Ramas y commits

Se incorporó el frente cerrado `total-accesibilidad` (`a64bd51`) y únicamente
los commits propios terminados de `total-sentinel` (`70f4983`). Se conservaron
sus informes y evidencias como antecedentes, sin atribuir sus resultados a esta
combinación. `total-rendimiento` no tenía informe de cierre en el corte revisado,
por lo que quedó para la segunda pasada del integrador.

| Origen | Commit integrado |
| --- | --- |
| `eae9461` | `68005bb` |
| `b8b5fc7` | `3511c0d` |
| `54c2dc6` | `76ac8db` |
| `b2f6e72` | `29df364` |
| `51531ad` | `c2e268f` |
| `02babd8` | `b2ee0c2` |
| `ee29759` | `f46cbe0` |
| `302a274` | `8a07ce4` |
| `70c84d4` | `a54f08a` |
| `4bf543c` | `65eb513` |
| `a64bd51` | `9021ff1` |
| `a2ab128` | `df54a13` |
| `3cec8c3` | `4b884b5` |
| `b45899d` | `7fe189e` |
| `0e15b2e` | `9a05565` |
| `f9dda3e` | `9ab01b2` |
| `ab0e804` | `cf6d898` |
| `def9ce2` | `f9090df` |
| `dbac915` | `d94a83c` |
| `99cd616` | `9c3c18c` |
| `70f4983` | `be02b51` |
| Compatibilidad de fixtures con la integración | `71db989` |

Los cambios de chatfix y la prueba dependiente `5ed6135` se cedieron al frente
delegado de producto. Las mejoras de parser/radar de Sentinel ya tenían
evoluciones posteriores; no se duplicaron sus parches en este frente.

## Conflictos y decisiones

- Aprendizaje/Publicados: se añadió metadata sin perder la consulta SSR
  autenticada ni la proyección unificada de Resultados.
- Marcas: se conservaron `PanelCompetencia`, el ámbito inicial y la recuperación
  de foco, añadiendo identificadores por instancia y navegación persistente.
- Resultados: se mantuvieron sus filtros compartidos y fuentes por dueño; se
  añadieron los roles de grupo a red/fallos. Se conservaron las correcciones
  anteriores de tablas móviles.
- Playwright: se conservó toda la matriz Firefox/WebKit y se añadió la suite axe
  al proyecto de demostración. La configuración Sentinel hereda esa matriz y
  añade estrés móvil y videos sin alterar umbrales, guardián ni evaluadores.
- ESTADO: se mantuvo el contenido integrado y se añadieron dos hechos acotados
  que distinguen la integración local de la puerta pendiente y el despliegue.
- Las fixtures antiguas de accesibilidad necesitaban el campo `competencia` y
  la proyección `/api/resultados`. Se añadió competencia vacía tipada y se usa
  el control público de actualización para probar los vacíos, sin cambiar la
  base compartida ni omitir aserciones.

No se hizo merge de la historia antigua de Sentinel: podría reintroducir blobs
privados. `git ls-files cooper/vendor/sentinel cooper/.cache/sentinel` no devuelve
archivos. El preparador fijado verificó la caché ignorada propia con la revisión
`6764bbdcab91719947e93ba1cc476cbefafb58e8` sin imprimir sus fuentes.

## Verificación

`npm ci` instaló las dependencias en este worktree. `npm run lint` y
`npm run typecheck`: PASS. Pruebas focales:

```bash
npm test -- --run tests/revision-http.test.ts tests/resultados.test.ts \
  tests/movimiento-assets.test.ts tests/puerta.test.ts tests/sentinel-cache.test.ts
```

Resultado: **30/30 PASS, cinco archivos**, 14:23 Lima. El primer intento tuvo
29 aprobadas y una fallida porque la caché privada aún no existía; se preparó
mediante `npm run preparar:sentinel` y se repitió la misma selección completa.
El primer typecheck detectó la fixture sin `competencia`; pasó después de su
corrección. `git diff --check`: PASS. Sin advertencias de lint ni tipos.

Por asignación del integrador, no se ejecutó otra puerta pesada concurrente:
la puerta completa, las dos rondas y los videos deben validarse sobre su árbol
final. Este resultado focal no sustituye esa aceptación.

## Reproducción de rondas finales

Desde el checkout aislado del código final y sus propias cachés, ejecutar
secuencialmente, sin detener procesos del orquestador:

```bash
COOPER_MOVIMIENTO_RONDA=cierre-1 \
COOPER_MOVIMIENTO_SALIDA=.cache/videos-integracion3 \
COOPER_PULIDO_RONDA=total-integrador-cierre-1 \
npm run test:e2e -- --config=playwright.total-sentinel.config.ts
# Repetir exactamente con cierre-2 y total-integrador-cierre-2.
python3 -B scripts/verificar-rondas.py .cache/videos-integracion3 cierre-1 cierre-2 \
  --salida .cache/videos-integracion3/revision-total-integrador
```

El ejecutor elige puertos libres y no reutiliza servidores ajenos. Reservar
afinidad de CPU disponible para el checkout/contenedor propio reduce contención
con las cargas concurrentes; no modifica los umbrales. El verificador crea la
revisión visual pendiente: hay que inspeccionar las capturas seleccionadas y
fotogramas de los recorridos, además de aprobar decodificación y hashes.

## Pendientes de Walter

1. Aceptación física de accesibilidad con móvil y tecnologías de asistencia, y
   revisión de los resultados `incomplete` ya documentados por accesibilidad.
2. Definición de subtítulos, transcripción y audiodescripción de medios finales.

Los fallos de integración y la puerta final continúan a cargo del integrador;
no se trasladan al usuario como decisiones.

## Anexo: matriz exhaustiva de ramas

Corte comprobado: `6b84bfb52462ce961c9311736b42ee306d53ff57`, 2026-11-21T14:39 Lima. Se revisaron **52 ramas del manifiesto inicial y una rama posterior**, excluyendo `total-integrador` y sus frentes delegados. La evidencia reproducible y las resoluciones por commit están en [ramas.json](evidencias/total-integrador-web/ramas.json).

Resultado del corte: **cero faltantes funcionales detectados en las ramas cerradas**. Se encontró una omisión real en el rechazo de respuestas duplicadas del Radar (`39537a7`/`5267610`); operación la recuperó en `3a3b41c` antes de cerrar esta matriz. Corrige la apreciación preliminar de este informe: el parser de Sentinel sí estaba absorbido, pero el guard de duplicados requería recuperación explícita.

| Rama | SHA inicial | Clasificación del corte | Seleccionada en esta misión |
| --- | --- | --- | --- |
| `total-accesibilidad` | `a64bd51f` | Parche/contenido | Sí |
| `total-aprendizaje` | `688a1579` | Parche/contenido | — |
| `total-aprendizaje-aceptacion` | `632bd1fe` | Parche/contenido | — |
| `total-auditoria` | `ad67618a` | Parche/contenido | — |
| `total-chat-vps` | `3ba2508e` | Parche/contenido | — |
| `total-chatfix` | `1002cc03` | Parche/contenido | Sí |
| `total-cierre-aceptacion` | `4f13622f` | Parche/contenido | — |
| `total-competencia` | `16e70d47` | Parche/contenido | Sí |
| `total-competencia-aceptacion` | `f5d12463` | Parche | — |
| `total-competencia-cierre` | `040ce668` | Ascendencia + actividad posterior | — |
| `total-competencia-navegacion` | `ba6769c6` | Parche | — |
| `total-competencia-orquestada` | `39537a7f` | Parche/contenido | Sí |
| `total-competencia-youtube` | `bb261a37` | Parche/contenido | — |
| `total-despliegue` | `f62e3cd3` | Parche/contenido | — |
| `total-despliegue-aceptacion` | `d26b6147` | Parche/contenido | — |
| `total-final-aceptacion-fcfab3b` | `5f23df85` | Parche | — |
| `total-final2-aceptacion-719409f` | `b5ff17d8` | Parche | — |
| `total-final3-aceptacion-bfd5e79` | `bfd5e792` | Ascendencia | — |
| `total-guia` | `ff0dd3eb` | Parche/contenido | Sí |
| `total-identidad-viva` | `fed13607` | Parche | — |
| `total-infra-segura` | `533703d1` | Parche/contenido | — |
| `total-m01` | `1b00e5f9` | Parche/contenido | — |
| `total-m03` | `f6fb304c` | Parche/contenido | — |
| `total-m05` | `c25546a3` | Parche/contenido | — |
| `total-m06` | `fc362c54` | Parche/contenido | — |
| `total-m07` | `79911773` | Parche/contenido | — |
| `total-m08` | `9a4f0920` | Parche/contenido | — |
| `total-m09` | `e5cbc3a3` | Parche/contenido | — |
| `total-m10` | `66b36672` | Parche/contenido | — |
| `total-m11` | `b96b7eb9` | Parche/contenido | — |
| `total-m12` | `ed73dcb4` | Parche/contenido | — |
| `total-marcas-runtime` | `2dac9d5d` | Parche/contenido | — |
| `total-margen-estrategia` | `390d5518` | Parche/contenido | Sí |
| `total-n8n-auditoria` | `ff3465f6` | Parche/contenido | Sí |
| `total-n8n-e2e` | `2dabc3a6` | Parche/contenido | Sí |
| `total-n8n-lote` | `e3394168` | Parche | — |
| `total-n8n-ramas` | `4629bdd7` | Parche/contenido | Sí |
| `total-operacion` | `a4960779` | Parche/contenido | — |
| `total-radar-contexto` | `bfd5e792` | Ascendencia + actividad posterior | — |
| `total-render-real` | `5f612967` | Parche/contenido | Sí |
| `total-rendimiento` | `7aab9056` | Activa; segunda pasada | — |
| `total-resultados-e2e` | `f0b21a87` | Parche/contenido | — |
| `total-resultados-movil` | `b2033945` | Parche/contenido | — |
| `total-retorno-2476` | `71be3c70` | Parche/contenido | — |
| `total-revision-cierre` | `f8aa9667` | Ascendencia | — |
| `total-revision-final` | `00168c10` | Parche/contenido | — |
| `total-revision-rondas-cierre` | `65a59968` | Posterior; en curso | — |
| `total-seguridad` | `cb9c478a` | Parche/contenido | — |
| `total-sentinel` | `70f4983f` | Parche/contenido | Sí |
| `total-sentinel-guardia` | `7592d70d` | Parche/contenido | — |
| `total-sentinel-privado` | `55bf5e96` | Parche/contenido | — |
| `total-vidiq-parser` | `a2ee9f05` | Parche/contenido | — |
| `total-volumen-n8n` | `38a1017c` | Parche/contenido | — |

El método combina ascendencia, `git cherry`, el mapa de saneamiento y `patch-id --stable` completo/por archivo. Las diferencias restantes se revisaron por contenido: código generado desde módulos integrados, documentación consolidada y conflictos que preservan contratos modernos. `docs/ESTADO.md`, las fuentes/cache privadas de Sentinel y las rutas de credenciales/entornos reales se excluyeron antes de leer parches. Su ausencia en el historial saliente es intencional.

`total-auditoria` tiene por alcance el informe `faltantes-total.md`: el objetivo conserva el cierre completo y añade 31 líneas, sin eliminaciones. `total-sentinel` hereda historia antigua saneada: sus 146 candidatos de `git cherry` no representan 146 faltantes. Se contrastaron sus commits propios: parser presente, chat adaptado en `c87c1d1`, Marcas en `437c7a5` y guard Radar recuperado en `3a3b41c`.

Decisiones de conciliación comprobadas: contrato moderno de chat de 18 palabras; memoria sin tarjeta cuando no hay cambio; CAS durable M01 y Vigilante sin mensajes remotos crudos; matriz completa de navegadores; filtros/foco accesibles sin perder Resultados ni PanelCompetencia. Los cierres históricos conservan su alcance y no acreditan esta combinación.

Actividad que queda para coordinación y segunda pasada:

1. `total-rendimiento` (`7aab9056`): ocho commits y ningún informe de cierre. Su migración `0011_rendimiento` necesita reconciliación de numeración con la integración. No se modificó su worktree.
2. `total-competencia-cierre` y `total-radar-contexto` avanzaron tras el corte; apareció `total-revision-rondas-cierre` (`65a59968`). La normalización de salidas ya está absorbida. Quedan cuotas/runtime vidIQ, evidencia parcial y el helper limitado Radar/Resolver. Su informe del orquestador declara corte provisional 14:27 y misión en curso; coordinar su cierre antes de tomar cambios, sin tocar su worktree.

Verificación de este anexo: JSON válido, todas las equivalencias citadas son ancestros del objetivo y `git diff --check` sin errores. No se ejecutó otra puerta pesada ni se alteró el árbol del integrador. La puerta final, rondas y aceptación del despliegue siguen pendientes de su ejecución sobre el código final. No se añaden decisiones nuevas para Walter.

## Corrección focal del ensayo de Resultados

Commit `3816a5d`: las dos aserciones del contador de Resultados se acotan al
landmark `main`. La mejora de accesibilidad añadió otro `status` legítimo en el
banner («En vivo»), por lo que el selector global era ambiguo. Se conservan la
unicidad del contador, sus textos exactos y todas las comprobaciones del recorrido.

El snapshot del fallo y la fuente integrada confirman que el contador pertenece
a `main` y el estado de conexión al banner. ESLint focal con `--max-warnings 0`
y `git diff --check`: PASS. No se ejecutó Playwright local por faltar la caché
de navegadores preparada; el integrador solicitó el commit inmediatamente para
repetir la puerta y las rondas en su imagen CI con bibliotecas completas. Esta
revisión estática no se presenta como aceptación E2E.

Commit `965682b`: se corrigió del mismo modo la tercera aserción global del
contador, en `resultados.spec.ts`. El barrido de toda la carpeta E2E confirmó
que los demás selectores de `status` ya distinguen el mensaje mediante nombre
accesible o texto, o están acotados a su recurso. Se conservaron sin cambios.
El error-context de la puerta confirma la misma ambigüedad entre banner y
contenido; ESLint focal con cero advertencias y `git diff --check`: PASS.

Commit `bb7fd05`: las dos búsquedas del compositor en `multiengine.spec.ts`
usan ahora el textbox accesible de nombre exacto dentro de `main`, y esperan
unicidad y visibilidad antes de interactuar. En el fallo WebKit móvil el árbol
accesible mostraba un solo textbox; `getByLabel` encontraba además otro nodo
SSR que no aparecía en dicho árbol. Se inspeccionó también la captura del fallo.
No se atribuye una causa concreta al DOM retenido sin una reproducción adicional.
El selector sigue fallando si existen dos compositores accesibles, no usa
`first()` y conserva el recorrido real por Tab y las dos aprobaciones manuales.
ESLint focal sin advertencias y `git diff --check`: PASS; ejecución en motores
delegada a la puerta/rondas del integrador sobre su snapshot final.

## Integración de rendimiento tras su cierre

21-11-2026, 15:03 Lima. La rama `total-rendimiento` cerró en `42c58819`
después del corte de la matriz. Se creó `total-integrador-web-rendimiento` en
este worktree propio desde `846402b`, preservando la rama anterior. Los ocho
commits tenían cambios funcionales faltantes; se avisó al integrador antes de
continuar para detener y reconstruir imagen/rondas. Código entregado:
`0dcc306`; cierre histórico incorporado en `9783430`.

La [evidencia de conciliación](evidencias/total-integrador-web/rendimiento-integracion.json)
relaciona cada commit de origen con su destino. La matriz conserva su corte
histórico y añade este seguimiento: rendimiento ya no queda excluido como activo.

Decisiones de conflictos:

- SQLite: nueva `0018_rendimiento`, índice 13 del diario, fecha mayor a todas las
  anteriores. Trece entradas y trece archivos SQL anteriores idénticos byte a
  byte. Se mantienen períodos de Lima y exclusión de gastos futuros; el agregado
  SQL y el benchmark usan ambos límites. No se restauró el comportamiento UTC.
- Operación: datos iniciales autorizados desde el servidor, conservando metadata,
  Competencia, catálogo sin validadores en cliente y límites/permisos existentes.
  Las fixtures que interceptan API usan el control público Actualizar. Durante
  esa consulta se conserva el estado accesible de carga y los datos previos.
- Marcas: galerías desmontadas mientras están cerradas; al abrirlas, las imágenes
  conservan carga inmediata y autenticación privada. Video mantiene reproducción
  y no solicita bytes antes de la acción correspondiente.
- Movimiento: primera pintura estable y coreografía en navegación, conservando
  el ref de foco accesible del contenido; poster de bienvenida de una sola fuente.
- Documentación: cierre original y propuesta Caddy conservados con su alcance.
  ESTADO retiene todos los hechos y pendientes actuales y añade solo la integración.

Se leyeron las guías oficiales incluidas en Next instalado sobre datos de servidor,
carga diferida e imágenes autenticadas. Lint y typecheck: PASS, cero advertencias.
Pruebas de SQLite, períodos, migraciones, Operación, Marcas, medios, retención y
Resultados: **91/91 PASS en ocho archivos**, 7,51 s. La primera pasada tuvo 90/91:
la expectativa de redondeo del fixture conservaba la suma histórica con un gasto
futuro; se verificó el agregado JS sin ese registro y se repitió toda la selección.
`git diff --check`: PASS. Esta verificación focal no acredita la puerta completa,
los E2E ni el rendimiento de la combinación; el integrador los ejecuta sobre su
nuevo snapshot. No se accedió al VPS ni se modificaron worktrees ajenos.

El cierre original acredita 286 unitarias, 44 E2E y 147 flujos sobre `7aab905`;
sus métricas y límites permanecen históricos. La nueva combinación tiene catorce
migraciones y exige renovar el ensayo de actualización/reversa de la imagen y base.
La decisión de integrar y desplegar ya está autorizada por esta misión; la propuesta
Caddy, medición de campo y aceptación física permanecen en sus pendientes originales.

Se leyó además el recibo público del orquestador `06705b0`: cierre-3 sobre `bfd5e79`
terminó FAIL, 85 aprobadas, una fallida y seis no ejecutadas; cierre-4 no iniciado.
Sentinel detectó en Publicados a 1440 px `ERR_BLOCKED_BY_CLIENT.Inspector` durante
caos (semillas 1528974480/1528974481). Causa aún en diagnóstico; se comunicó como
riesgo compartido sin atribuirla a rendimiento ni filtrar el guardián. Las 24
capturas que ese frente revisó sin hallazgos no sustituyen una ronda aprobada.

## Cierre documental y matriz actualizada de 54 ramas

21-11-2026, Lima. Código contrastado: `e1244bd3`; documentos contrastados: `adaf3cad`. Esta actualización sustituye las conclusiones de actividad pendiente del corte anterior: rendimiento ya cerró y está integrado. La [matriz completa](evidencias/total-integrador-web/ramas.json) conserva el corte anterior y clasifica 52 refs originales más dos posteriores sin cierre.

**Resultado: ningún cambio de aplicación pendiente de ramas cerradas.** Queda un helper operativo offline (`3596d5bd`/`c0772dc`) asignado a producto; afecta el lote limitado Radar/consulta/Resolver, no la aplicación. Su integración debe acreditarse aparte antes del push. No se incorporan refs de QA/rondas sin cierre ni se siguen sus avances concurrentes.

| Rama | Punta observada | Clasificación |
| --- | --- | --- |
| `total-accesibilidad` | `a64bd51f` | Parche/contenido |
| `total-aprendizaje` | `688a1579` | Parche/contenido |
| `total-aprendizaje-aceptacion` | `632bd1fe` | Parche/contenido |
| `total-auditoria` | `ad67618a` | Parche/contenido |
| `total-chat-vps` | `3ba2508e` | Parche/contenido |
| `total-chatfix` | `1002cc03` | Parche/contenido |
| `total-cierre-aceptacion` | `4f13622f` | Parche/contenido |
| `total-competencia` | `16e70d47` | Parche/contenido |
| `total-competencia-aceptacion` | `f5d12463` | Parche |
| `total-competencia-cierre` | `1cdd904e` | Ascendencia |
| `total-competencia-navegacion` | `ba6769c6` | Parche |
| `total-competencia-orquestada` | `39537a7f` | Parche/contenido |
| `total-competencia-youtube` | `bb261a37` | Parche/contenido |
| `total-despliegue` | `f62e3cd3` | Parche/contenido |
| `total-despliegue-aceptacion` | `d26b6147` | Parche/contenido |
| `total-final-aceptacion-fcfab3b` | `5f23df85` | Parche |
| `total-final2-aceptacion-719409f` | `b5ff17d8` | Parche |
| `total-final3-aceptacion-bfd5e79` | `bfd5e792` | Ascendencia |
| `total-guia` | `ff0dd3eb` | Parche/contenido |
| `total-identidad-viva` | `fed13607` | Parche |
| `total-infra-segura` | `533703d1` | Parche/contenido |
| `total-m01` | `1b00e5f9` | Parche/contenido |
| `total-m03` | `f6fb304c` | Parche/contenido |
| `total-m05` | `c25546a3` | Parche/contenido |
| `total-m06` | `fc362c54` | Parche/contenido |
| `total-m07` | `79911773` | Parche/contenido |
| `total-m08` | `9a4f0920` | Parche/contenido |
| `total-m09` | `e5cbc3a3` | Parche/contenido |
| `total-m10` | `66b36672` | Parche/contenido |
| `total-m11` | `b96b7eb9` | Parche/contenido |
| `total-m12` | `ed73dcb4` | Parche/contenido |
| `total-marcas-runtime` | `2dac9d5d` | Parche/contenido |
| `total-margen-estrategia` | `390d5518` | Parche/contenido |
| `total-n8n-auditoria` | `ff3465f6` | Parche/contenido |
| `total-n8n-e2e` | `2dabc3a6` | Parche/contenido |
| `total-n8n-lote` | `e3394168` | Parche |
| `total-n8n-ramas` | `4629bdd7` | Parche/contenido |
| `total-operacion` | `a4960779` | Parche/contenido |
| `total-qa-produccion` | `de397f31` | Sin cierre; no seleccionada |
| `total-radar-contexto` | `6f6af646` | Integrada; helper operativo pendiente |
| `total-render-real` | `5f612967` | Parche/contenido |
| `total-rendimiento` | `42c58819` | Parche/contenido |
| `total-resultados-e2e` | `f0b21a87` | Parche/contenido |
| `total-resultados-movil` | `b2033945` | Parche/contenido |
| `total-retorno-2476` | `71be3c70` | Parche/contenido |
| `total-revision-cierre` | `f8aa9667` | Ascendencia |
| `total-revision-final` | `00168c10` | Parche/contenido |
| `total-revision-rondas-cierre` | `65a59968` | Sin cierre; no seleccionada |
| `total-seguridad` | `cb9c478a` | Parche/contenido |
| `total-sentinel` | `70f4983f` | Parche/contenido |
| `total-sentinel-guardia` | `7592d70d` | Parche/contenido |
| `total-sentinel-privado` | `55bf5e96` | Parche/contenido |
| `total-vidiq-parser` | `a2ee9f05` | Parche/contenido |
| `total-volumen-n8n` | `38a1017c` | Parche/contenido |

Cierres documentales recuperados con `docs/ESTADO.md` preservado durante cada cherry-pick:

- `1cdd904 → d45782d`: cierre de Competencia y sus recibos públicos referenciados. El informe parcial queda sustituido por el cierre completo; se mantienen explícitos los límites de vidIQ y de contenido producido.
- `2aa3c98 → 097f32c`: evidencia histórica de delta Radar/Resolver, ensayo y reversa en ambos motores.
- `6f6af64 → adaf3ca`: evidencia histórica del disparador M7, versión e instantes reales.

Estos tres commits solo cambian `docs/informes/`; no ejecutan proveedores, n8n ni VPS. La conservación de sus recibos no acredita un despliegue de la integración actual. No se restauraron cierres antiguos de puerta ni fuentes privadas Sentinel. El enlace a la aceptación antigua de imagen `bfd5e79`, ausente en la integración, se conserva como referencia explícita al commit histórico en vez de reintroducir ese cierre. Los vínculos locales, JSON y `git diff --check` se comprobaron; la puerta y dos rondas del código congelado las ejecuta el integrador en su checkout aislado.

Diagnóstico de Sentinel anterior: el recibo público `06705b0` acredita un bloqueo de recurso en caos Publicados 1440 sobre `bfd5e79`, pero no conserva URL, método ni tipo suficientes para atribuir su causa. Publicados ya usaba datos SSR en ese corte; el cambio posterior no demuestra causalidad. Se mantienen guardián y umbrales. Si reaparece, registrar únicamente origen/ruta saneados, método, tipo y localización de consola, sin query, cookies ni cabeceras.

Revisión visual prevista: capturas originales de seis vistas en claro/oscuro y 1440/390, más estados e interacciones y recorrido continuo de cada ronda. La decodificación de videos y los índices técnicos no sustituyen la inspección visual; no se declara aceptada una ronda hasta revisar su salida cerrada. No se añaden decisiones nuevas para Walter.

## Corrección del contrato Sentinel tras el fallo de Marcas

21-11-2026, Lima. La primera ronda de `rondas-rendimiento` sobre `e1244bd`
terminó con 31 aprobadas, un fallo y 91 no ejecutadas. No acredita una ronda
limpia. El guardián registró `POST /api/marcas/montajes` bloqueado y caos reportó
`ERR_BLOCKED_BY_CLIENT.Inspector` en el mismo calendario, semilla 1479559273,
541 acciones. Las pruebas funcionales de la puerta paralela no reproducían
siempre ese clic aleatorio.

Commit `1c2f2b3`: se corrige el contrato de controles de solo lectura, sin
cambiar aplicación, fuentes privadas, guardián, evaluador, semilla ni umbrales.
El botón «Actualizar montajes desde fábrica» sincroniza revisiones mediante
POST y faltaba en las exclusiones. Se centralizan además los controles mutantes
que solo se excluían en el ensayo particular de Marcas y «Añadir cuenta».
La [comparación dirigida antes/después](evidencias/total-integrador-web/sentinel-montajes-reproduccion.json)
reproduce el clic real sobre un DOM/servidor sintéticos con la misma revisión
verificada de Sentinel: antes intentaba la escritura, el servidor recibía cero,
y `requestfailed`/consola coincidían en ruta y código; después no se intenta la
escritura. Una petición que eluda la interfaz sigue bloqueada y el evaluador
original la sigue marcando como error medio. No hay filtro genérico de consola.

Auditoría de controles y cobertura conservada:

| Control | Efecto que lo excluye de la lectura | Cobertura dirigida existente |
| --- | --- | --- |
| Actualizar montajes desde fábrica | POST que sincroniza revisiones | `e2e/montajes.spec.ts`: obtiene nueva revisión, exige selección y conserva reproducción MP4/lectura privada |
| Añadir cuenta | Alta de cuenta de una marca | `e2e/marcas.spec.ts` y `e2e/montajes.spec.ts`: alta y verificación posterior |
| Verificar conexión | Cambia el estado de cuenta | `e2e/marcas.spec.ts`: confirmación visible y posterior uso de la cuenta |
| Desconectar | Revoca cuenta y cancela cola | `tests/marcas.test.ts`: desconexión cancela la pieza programada |
| Estudiar la cuenta | Actualiza la muestra de estudio | `e2e/marcas.spec.ts`: muestra simulada de seis publicaciones |
| Proponer texto con el especialista | Genera propuesta de pieza | `e2e/marcas.spec.ts`: propuesta no vacía y guardado/revisión posterior |
| Pedir cambios | Registra decisión de revisión | Control ya excluido en Marcas; `e2e/cooper.spec.ts` conserva el recorrido dirigido del mismo control de revisión de video. No se atribuye ese recorrido a la revisión de una pieza de Marcas |

Los botones de guardar/enviar/aprobar ya los excluye el guardián original.
«Continuar», las cinco secciones de Marcas, filtros, selectores, evidencia,
«Editar pieza» y «Actualizar» de lectura permanecen disponibles. Se comprobó
sobre navegador real que «Abrir publicación» externo ya queda excluido por
el guardián original y el enlace interno permanece permitido. Esto no demuestra
que el bloqueo de Publicados del orquestador tuviera la misma causa: aquel
recibo carece de la trazabilidad necesaria y no se silenció su hallazgo.

El adaptador añade `red-observada.json`: módulo, instante relativo, origen/ruta,
método, tipo de recurso, código de red y localización de consola. Omite query,
fragmento, userinfo, cabeceras, cookies, cuerpos y texto libre. Observa errores
sin interceptar peticiones ni modificar los hallazgos. Se consultaron las APIs
oficiales de [BrowserContext](https://playwright.dev/python/docs/api/class-browsercontext),
[Request](https://playwright.dev/python/docs/api/class-request) y
[ConsoleMessage](https://playwright.dev/python/docs/api/class-consolemessage).

Verificación focal del contrato: **3/3 pruebas de navegador real y 5/5 de
saneamiento, con `-W error`**, más comparación determinista antes/después.
Los archivos privados siguen coincidiendo con las nueve huellas del manifiesto.
Pruebas de aplicación/navegadores y revisión visual se registran por separado
cuando terminan; estos resultados no sustituyen la puerta ni dos rondas completas.

La matriz conserva además un seguimiento sobre `e942dc9`: el helper Radar/Resolver
pendiente quedó integrado por producto en `af3a5ed`, ancestro del objetivo,
con CAS moderno, carrera y reversa acreditados. En ese corte quedan **cero
faltantes de aplicación y cero helpers operativos de ramas cerradas**. Las dos
refs sin cierre no se siguen ni se convierten en trabajo terminado.

Aceptación focal sobre `1c2f2b3`: **16/16 PASS en 8,3 minutos**, sin fallos,
omisiones, reintentos ni advertencias. [Recibo y hashes](evidencias/total-integrador-web/sentinel-focal.json).
El árbol `cooper/` es idéntico al integrado `e942dc9`. Checkout archivado propio,
imagen de herramientas CI y caché privada verificada; CPU 8–15 liberadas al
terminar, sin tocar los otros procesos. Se conservan videos en
`.cache/sentinel-focal/checkout/cooper/test-results/` del worktree delegado.

- Marcas funcional y Sentinel a 1440/390: cero hallazgos, 3.296/3.413 acciones.
- Montajes: MP4 por gesto Space, tiempo de reproducción, lectura privada y
  selección de la revisión actual tras sincronizar la fábrica.
- Axe: todas las rutas, claro/oscuro, 360/1440; sin `duplicate-id-aria`.
- Ocho entradas Firefox/WebKit, claro/oscuro y 390/1440: teclado, chat,
  reconexión SSE y las dos aprobaciones manuales.

Los fixes del integrador `bb74925`, `f1df4f7` y `a987b2f` están incluidos
(respectivamente `66f2f5f`, `e2e87ed`, `c62947c` en esta rama). Solo `f1df4f7`
cambia aplicación: IDs/labels de Biblia por instancia. Este frente no duplica
esos commits al entregar su corrección. Puerta y dos rondas completas continúan
en el checkout nuevo del integrador; aún no se aceptó visualmente ninguna.

### Barrido posterior al cierre focal

Se registraron 55 refs (52 originales y tres posteriores), por SHA fijo, contra
código `e942dc9` y el commit documental integrado `34d6c7a`. La matriz conserva
el corte histórico de 54 y añade `barrido_posterior` con las 55 puntas observadas.
No se modificaron worktrees concurrentes.

| Ref y punta | Delta | Tratamiento |
| --- | --- | --- |
| `total-radar-contexto`, `39ac406` | `e29bba5`: clon autónomo SQLite con WAL y cuatro regresiones; `9dc7ce0`: copia final de 146 filas/ensayos; `39ac406`: memoria VPS | Nuevo helper operativo cerrado, asignado expresamente a producto. No aplicado por este frente. No cambia la aplicación |
| `total-revision-rondas-cierre`, `ccd539d` | `be2b242`: exclusión del montaje; `ccd539d`: recibo causal y visual parcial | Código ya cubierto por `1c2f2b3`/`e942dc9`; evidencia histórica de ronda rechazada, sin declarar ronda limpia |
| `total-competencia-revision`, `d876b33` | Memo y conciliación de auditoría; ampliación H19 todavía pendiente | Documentación sin runtime nuevo. No se considera cerrado el ensayo aún pendiente |

Resultado de este nuevo barrido: ningún resto de aplicación; un helper operativo
posterior en integración por producto (`e29bba5`). No contradice el cierre anterior
del helper Radar/Resolver: son cambios distintos y cortes distintos. El integrador
recibió el aviso antes de iniciar su despliegue. No se agregan decisiones de Walter.
