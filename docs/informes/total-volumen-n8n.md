# H19 — Data Tables y proyección del puente con volumen

21-11-2026, Lima. Frente `total-volumen-n8n`, base `309651432e7ae40780e6da032463e7028e5b8171`.
**Medición implementada y probada; presupuesto temporal FAIL, corrección PASS.**
No integrado ni desplegado. Sin push, merge, cambios en Cooper, generador, deploy o flujos canónicos.

## Corrección del orquestador, 21-11-2026 Lima

El commit `48d3e19` agrupa planos, publicaciones, eventos y decisiones una vez por video autorizado, y trabajos por canal. Mantiene el orden y las comprobaciones de dueño/canal; usa `Map` para admitir IDs como `__proto__` sin tratarlos como propiedades. No cambia el contrato, la paginación ni los filtros Data Tables. Solo cambia el nodo `Resolver` del puente; no cambia Cooper ni su imagen.

La misma medición, imagen, fixture, CPU y siete muestras contrasta las cuatro respuestas: **sus hashes completos son idénticos antes/después**, incluidos orden, escenas, métricas y aislamiento. La proyección administrativa baja de **9.136 a 197 ms** de mediana; el tiempo total, incluida lectura, baja de **9.978 a 1.030 ms**. Para los dos usuarios, el total queda en **470 y 467 ms**. El máximo administrativo es **1.070 ms** y el incremento de heap, **113,49 MiB**. El presupuesto temporal comparativo de 1.000 ms sigue incumplido por 69,91 ms: se conserva ese resultado y no se presenta como PASS ni como SLA. La serialización HTTP/renderizado y un protocolo de continuación no están medidos por este ensayo.

Se eliminó el recorrido cuadrático detectado; el coste restante incluye leer y proyectar casi 10.000 guiones, unos 49 MiB serializados. No se truncó historia para mejorar el número. Una regresión adicional exige preservar los IDs y el orden de escenas sin volver a recorrer 1.200 planos por cada uno de cien videos. **177 pruebas correctas** (173 flujos y cuatro del harness), sin errores/advertencias. La actualización reversible del nodo real está en preparación con Operación.

[Contraste y huellas](evidencias/total-volumen-n8n/comparacion.json), [medición posterior](evidencias/total-volumen-n8n/despues/medicion.json), [origen posterior](evidencias/total-volumen-n8n/despues/origen.json). El resto del informe conserva la medición inicial del frente.

## Commits y evidencia

- `1942868c8ca70a7b4ddb031c9f9224f0a0450e65`: harness aislado, fixture y tres pruebas focales.
- El commit de documentación que contiene este informe añade evidencia y un hallazgo a ESTADO.

[Muestras completas](evidencias/total-volumen-n8n/medicion.json),
[origen/argumentos](evidencias/total-volumen-n8n/origen.json),
[log resumido](evidencias/total-volumen-n8n/ejecucion.log) y
[verificación de hashes y resultados](evidencias/total-volumen-n8n/verificacion.json).
La ejecución empezó sobre HEAD `3096514` con el harness sin commit. Se cotejaron
los bytes de ambos módulos medidos, el flujo y el esquema contra `1942868`: sus
cuatro hashes coinciden. El lanzador recibió después únicamente limpieza del
contenedor propio en caso de timeout; no cambió el código medido.
SHA-256 de `medicion.json`: `78d386f5330dad87412e4c6c9cdfcd14056e1b991d5a927256ab647b7c218136`.

## Qué se ejecutó

Se revisaron los documentos exigidos, M12/H19, los helpers de ensayo y las fuentes
oficiales antes de usar interfaces. Se reutilizan `podman`, `assertNoEnvFiles`
y la imagen fijada del helper `cooper/scripts/ensayo-infra.mjs`; **no se llama a
`startN8n`**. Los helpers de webhook remoto no corresponden al aislamiento exigido.

Imagen local `ghcr.io/n8n-io/n8n:2.47.6@sha256:d26c451fcb258abfe3a3561b13c5421cbc9bc8e7a738afb06c7a464fa31f821b`,
Node **26.13.0** dentro de ella. Podman rootless, `--pull=never`, `--network=none`,
`--cpuset-cpus=8-9 --cpus=1 --memory=2g`, sin capacidades, sin puertos publicados.
`cpu.max=100000 100000` y afinidad efectiva `8-9` comprobados dentro del contenedor.
Solo se montaron cuatro archivos públicos copiados a un temporal exclusivo y una
carpeta nueva de resultados. Ningún HOME, SSH, entorno real, credencial ni base
existente. Sin servicios externos, D&S Factory, OAuth, pagos o navegadores/build.
El contenedor se retiró con `--rm`; se comprobó que no queda ninguno de este frente.

**Motor real, no sustituto en arrays:** se importan de esa imagen
`get.operation.execute`, `executeSelectMany`, `DataTableRowsRepository`,
`DataTableDDLService` y `normalizeRows`. El DDL real crea las tablas en un SQLite
nuevo del filesystem desechable del contenedor; el repositorio real inserta y
consulta con el driver **sqlite-pooled**, WAL y pool de una conexión. El nodo
aplica sus filtros, consulta SQL, cuenta, pagina y normaliza fechas. Los parámetros
se extraen del flujo canónico, incluidas sus expresiones; el código íntegro de
`Resolver` se ejecuta sin editar. Los hashes de los módulos n8n están en la evidencia.

El harness proporciona el contexto del nodo y conecta su proxy al repositorio:
no ejecuta el servidor, el grafo completo, el runner de Code ni los servicios de
metadatos/permisos/transacciones por página de `DataTableService`. La normalización
es la misma función de ese servicio. No certifica autenticación HTTP, permisos de
proyecto, límite de almacenamiento de la instancia ni el coste total del workflow.
El aislamiento observado corresponde a filtros y proyección por dueño del puente,
con un contexto autenticado ficticio ya establecido.

## Fixture y método

Fixture determinista: **10.000 videos, diez dueños, 100 canales**, guion de 4 KiB
por video, 10.000 piezas, 10.000 publicaciones, 10.000 eventos y 10.000 aprobaciones.
Trabajos/lecciones y conexiones están vacíos. Se usa el esquema productivo
versionado, sin datos productivos. Fechas fijas, IDs intercalados entre dueños y
dos métricas por publicación inicialmente desordenadas. Hay un video sin dueño,
otro con dueño nulo, uno eliminado, uno huérfano y un canal eliminado con 100 videos.
Hash del fixture: `51fca8c9bfcf878c7ec9fe3f6f0a2537a36d86ef5c1ddd95534956a370fc11c3`.

Una muestra de calentamiento y **siete medidas por caso**, GC antes de cada medida.
Se mide lectura completa de nueve nodos y proyección `estado`, excluyendo la
preparación, GC, serialización y verificaciones. Cada muestra comprueba la lista
exacta y ordenada de IDs contra un oráculo independiente, dueño, escena/publicación
propia, métricas ordenadas, incidencia y guion. Los cuatro hashes de respuesta
son estables entre calentamiento y las siete repeticiones. No se observó
truncamiento, duplicación ni contaminación entre dueños.

Las fuentes de la imagen confirman páginas de **1.000 filas** y orden SQL por ID
ascendente cuando no se solicita otro. No se cambió `returnAll` ni el orden.
El código del repositorio ejecuta selección y `COUNT(*)` en cada página.

## Resultados y comparación con M12

Se reutiliza el presupuesto de lecturas de M12: **máximo de siete muestras
≤1.000 ms y delta de heap ≤128 MiB**. No es un SLA. El presupuesto de ciclo de
mensajería (250 ms/32 MiB) no aplica a esta ruta ni se volvió a medir.

| Caso | Videos recuperados → proyectados | Lectura mediana ms | Proyección mediana ms | Total mediana / máximo ms | Máximo delta heap MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Usuario 0 | 999 → 999 | 561,61 | 1.131,01 | 1.711,41 / 3.071,12 | 37,08 |
| Usuario 9 | 1.000 → 900 | 537,59 | 1.139,81 | 1.677,40 / 2.001,56 | 36,06 |
| Administrador | 9.998 → 9.896 | 896,77 | 9.135,96 | 9.977,67 / 16.064,54 | 92,18 |
| Usuario sin recursos | 0 → 0 | 373,44 | 0,67 | 374,16 / 405,00 | 27,58 |

Las medianas de componentes no tienen por qué sumar la mediana del total.
**Tres casos exceden tiempo; los cuatro cumplen el delta de heap observado.**
Las lecturas SQL/nodo por sí solas quedan bajo 1.000 ms en todas las muestras
(máximo administrativo 937,84 ms). La proyección explica el exceso principal.
No es una regresión cuantificada contra M12: cambian motor, versión Node, CPU y
población auxiliar. Se compara contra su presupuesto declarado, no contra su
mediana como si se tratara de un experimento antes/después controlado.

Cada caso recupera las **40.000 filas auxiliares** de piezas, publicaciones,
historial y decisiones: diez páginas por nodo, incluso sin recursos propios.
Canales y videos sí filtran dueño en SQL. Aprobaciones puntuales devuelve cero;
lecciones y conexiones también. En administración los canales recuperados son
100 y los proyectados 99; el filtrado lógico explica los 9.896 videos finales.
El JSON proyectado administrativo tiene **48,99 MiB**; no se incluyó su
serialización ni transporte en los tiempos anteriores.

El heap es la diferencia observada al retornar, **no un pico ni memoria retenida**;
puede incluir basura aún no recolectada o reducirse por GC durante la operación.
RSS máximo del proceso completo: **340,42 MiB**. `memory.peak` del cgroup:
**362,07 MiB**, con techo de 2 GiB; ambos incluyen importaciones, fixture,
verificaciones/serialización y cachés, no solo la consulta. No se debe comparar
esos picos con el presupuesto de **delta heap** de 128 MiB. Es un proceso aislado
en una máquina compartida; hay dispersión y no se infiere rendimiento del VPS.

## Hallazgo y propuesta al orquestador

`observabilidadCooper` vuelve a filtrar las colecciones completas de publicaciones,
eventos, aprobaciones y planos por cada video. Con esta población, esos recorridos
crecen como videos × filas auxiliares. El coste se observa aunque la consulta
Data Tables de 10.000 videos permanezca bajo el presupuesto.

Propuesta concreta para un frente autorizado: construir una vez mapas de arrays
por `video_id`, conservando el orden original, y pasar a `observabilidadCooper`
solo las cuatro colecciones del video. Mantener el filtrado de dueño, exclusión
lógica, fechas, contenido y orden del snapshot; reutilizar los cuatro hashes como
regresión y repetir el mismo benchmark. Agrupar trabajos por canal será necesario
para medir después lecciones voluminosas, que este fixture no cubre. Reducir las
lecturas auxiliares en SQL requiere revisar los selectores de n8n; no se propone
cortar `returnAll` ni introducir paginación unilateral. **No se implementó ningún
cambio de contrato, selector ni proyección.**

## Reproducción y pruebas

Desde la raíz, con Podman rootless y la imagen ya disponible:

```bash
node tools/cooper/ejecutar-volumen-n8n.mjs
node --test tests/volumen_n8n.test.cjs
taskset -c 8 env PYTHONDONTWRITEBYTECODE=1 node --test tests/flujos_v2.test.cjs
```

El lanzador crea `.cache/volumen-n8n-*/salida/`. Su rc 0 indica ejecución y
aserciones correctas; los presupuestos se informan aparte en `presupuestoM12`
y en el resumen, sin convertirlos en SLA ni ocultar el FAIL.

- Medición: **rc 0**, 32 muestras con aserciones (cuatro calentamientos + 28 medidas).
- [Focal](evidencias/total-volumen-n8n/focal.log): **3/3 PASS**, rc 0, sin omitidos.
- [Flujos](evidencias/total-volumen-n8n/flujos.log): **173/173 PASS**, rc 0, sin omitidos.
- Sintaxis de ambos ejecutores y `git diff --check`: PASS. Sin advertencias en estos logs.
- **Puerta Cooper NOT_RUN** por instrucción expresa: no npm ci, lint/tipos/unitarias
  Cooper, E2E, navegadores ni build. No se atribuyen a este frente los recibos del orquestador.

## Limitaciones y Pendientes de Walter

- No se ensayaron escrituras concurrentes, múltiples clientes, PostgreSQL, red,
  renderizado ni historia real. La documentación oficial advierte que cambios
  durante las páginas pueden omitir/duplicar filas; las lecturas aquí son estáticas.
- No se estresaron lecciones, conexiones ni múltiples escenas/publicaciones por
  video. El fixture representa una carga concreta, no el máximo posible.
- Ninguna decisión de Walter bloqueó la medición. Corresponde al orquestador
  coordinar la optimización propuesta y su revisión. Un ensayo en VPS o el cambio
  futuro de paginación/contrato necesita su alcance autorizado; no está aprobado aquí.

Fuentes oficiales consultadas el 21-11-2026:
[nodo Data Table](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.datatable/),
[Get/Return All y concurrencia](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.datatable/rows.md),
[Data Tables y límites](https://docs.n8n.io/build/work-with-data/data-tables.md),
[Node memoryUsage](https://nodejs.org/api/process.html#processmemoryusage),
y código distribuido dentro de la imagen local fijada, con hashes en la evidencia.
