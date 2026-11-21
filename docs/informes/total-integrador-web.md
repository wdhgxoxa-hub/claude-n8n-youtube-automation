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
