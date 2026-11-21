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
