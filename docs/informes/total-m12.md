# M12 — historiales con volumen (H19)

21-11-2026, Lima. Rama/worktree `total-m12`, base integrada `66732be`.
Implementado y probado localmente; **puerta completa FAIL por fluidez preexistente**.
Este frente no integró ni desplegó. Sin push, merge,
VPS, servicios externos, OAuth, pagos ni acceso a credenciales. No se modificaron
flujos n8n, migraciones, vendor ni el entorno de Sentinel.

## Cambios y commits

- `8026806` — fixture determinista y benchmark repetible, con medición inicial.
- `49fd2ae` — consulta de avisos faltantes, proyección mínima y seis regresiones H19.
- `3c347b2` — informe, ESTADO y primera puerta local sin navegador.
- El commit de cierre registra este informe, ESTADO y la evidencia de la puerta.

`cicloMensajeria` cargaba los 10.000 videos completos cada 15 segundos, aun con
todos sus avisos ya persistidos. Ahora selecciona contactos verificados con
consentimiento, restringe dueño/etapas según sus preferencias, comprueba la clave
exacta en `whatsapp_outbox` y recupera solo seis campos de las revisiones sin aviso.
Conserva el orden de descubrimiento por `rowid`, también entre dueños.

Se mantienen la clave única durable, el control de acceso al despachar, las
reservas inciertas, los reintentos y los límites de envío. No hay cursor en memoria:
activar preferencias o reverificar un contacto también descubre videos antiguos.
Un reinicio no vuelve a encolar avisos aceptados, fallidos, inciertos o cancelados.
La fecha de verificación se parametriza como texto porque concatenar un número
en SQLite podía añadir `.0` y dejar de coincidir con la clave persistida; la prueba
focal detectó ese defecto y se corrigió antes de la medición final.

## Medición reproducible

Desde `cooper/`, con dependencias instaladas y sin archivos `.env` reales:

```bash
taskset -c 0 env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
  node --expose-gc --import tsx scripts/medir-volumen.ts .cache/volumen.json --exigir
```

El script crea una base SQLite nueva en `.cache/volumen-*`, aplica las migraciones
del repositorio, usa proveedores simulados y bloquea `fetch`. No carga dotenv ni
acepta una base existente. Fixture: **10.000 videos**, 10.000 mensajes, diez dueños,
100 canales y 7.524 avisos históricos. Guiones de 4 KiB, publicaciones con dos
mediciones inicialmente desordenadas, etapas activas/pausadas, ocho contactos
verificados y dos sin verificar. Las bases son desechables y no se versionan.

Un proceso, afinidad a CPU 0; un calentamiento y siete muestras por operación,
GC antes de cada muestra. Se miden las funciones reales `estado`, `leerResultados`
y `cicloMensajeria`. El tiempo excluye la serialización JSON, la creación del
fixture y la comprobación de huellas. El heap es el incremento observado al
retornar, **no el pico de memoria de cada operación**. Se conservan todas las
muestras y RSS; `maxRSS` corresponde al proceso entero, incluidas importaciones,
fixture y verificaciones (antes 1.829 MiB; después 692 MiB).

Presupuestos de laboratorio fijados antes de la primera ejecución y conservados:
lecturas ≤1.000 ms y ≤128 MiB de incremento de heap; ciclo estable ≤250 ms y
≤32 MiB, evaluados sobre el máximo de siete muestras. No son SLA ni límites
introducidos en el producto. `--exigir` devuelve rc 1 si no se cumplen.

| Operación | Mediana antes → después (ms) | Máximo delta heap antes → después (MiB) |
| --- | ---: | ---: |
| Datos, usuario | 19,72 → 19,23 | 17,47 → 17,46 |
| Datos, administrador | 137,10 → 130,71 | 97,45 → 96,89 |
| Resultados, usuario | 10,83 → 11,88 | 9,74 → 9,74 |
| Resultados, administrador | 96,88 → 97,19 | 38,15 → 39,14 |
| Ciclo estable de mensajería | **884,67 → 19,56** | **124,30 → 0,80** |

El máximo del ciclo pasa de 911,48 a 21,77 ms. La medición inicial incumple ambos
presupuestos del ciclo; la final pasa todos. Las fluctuaciones de las lecturas
no justifican cambios: se conservaron su contenido y límites. Las cuatro huellas
SHA-256 de lectura coinciden exactamente antes/después, incluido el orden.

Evidencia: [antes](evidencias/total-m12/antes.json) y
[después](evidencias/total-m12/despues.json). El campo `revision` es el HEAD al
medir: antes `66732be` con el harness aún sin commit; después `8026806` con el
parche que luego quedó en `49fd2ae`. Para reproducir la línea base, `8026806`
contiene el harness y conserva el código de producción de `66732be`.

## Pruebas y puerta

Rojo real: 10.000 llamadas a `encolarVideo` para un historial ya atendido
([extracto](evidencias/total-m12/rojo-fallo-extracto.log)). Verde: cero llamadas
en ese mismo caso. También se preserva la tabla completa de avisos al reabrir
SQLite, se detectan dos cambios con la misma fecha, se usa la revisión remota,
se mantiene el orden entre dueños y se prueban activación tardía/reverificación.
El fallo intermedio de formato numérico también está
[registrado](evidencias/total-m12/focal-fallo-extracto.log).

Tipos y [87 pruebas focales](evidencias/total-m12/focal.log) pasan: seis H19,
36 WhatsApp, 19 puente, 18 seguridad y ocho resultados. Incluyen SSE persistido,
aislamiento, revocación de sesión y liberación de conexiones. Un worker/CPU.

La implementación y las pruebas focales concluyeron en menos de siete minutos,
dentro del máximo de veinte; el resto corresponde a documentación y puerta.
La primera puerta local pasa instalación, lint, tipos, **442 unitarias** y
**172 flujos**, con rc 0 y cero advertencias. Se creó `.cache/LISTO-PUERTA` a las
12:28 Lima y se recibió el turno fechado 12:35 antes de iniciar navegador/build.

Se exportó `3c347b2` con `git archive` y se construyó la imagen del Containerfile
existente. Ensayo en Podman sin puertos publicados, sin montar HOME, sockets ni
archivos privados; una CPU y un worker. Se reprodujo la secuencia de `ci:limpia`
con afinidad explícita y `CIRCLE_NODE_TOTAL=1`, `RAYON_NUM_THREADS=1`,
`UV_THREADPOOL_SIZE=1`. [Origen y hash](evidencias/total-m12/contenedor-origen.json),
[secuencia ejecutable](evidencias/total-m12/puerta-contenedor.sh) y
[recibo final](evidencias/total-m12/puerta.json).

Reejecución del ensayo preparado en este worktree (el contenedor se elimina al salir):

```bash
podman run --rm --name cooper-m12-puerta --cpuset-cpus=10 --cpus=1 \
  --shm-size=1g --cap-drop=ALL --security-opt=no-new-privileges \
  --volume "$PWD/.cache/puerta-m12/checkout:/ensayo:rw" \
  localhost/cooper-ci:total-m12 bash /ensayo/m12-puerta.sh
```

El contraste de base usa `git archive 66732be`, la misma imagen y límites, y
`npm run test:e2e -- --grep "fluidez local"`; no representa otra puerta completa.

| Paso final en contenedor | Resultado | rc |
| --- | --- | ---: |
| `npm ci` y preparación existente | PASS; 0 vulnerabilidades | 0 |
| `npm run lint` | PASS; 0 errores/advertencias | 0 |
| `npm run typecheck` | PASS | 0 |
| `npm test` | PASS; 442/442 | 0 |
| `npm run test:e2e` | **FAIL; 52/53, sin omitidos ni reintentos Playwright** | 1 |
| `npm run build` | PASS, ejecutado también después del fallo E2E | 0 |
| `node --test tests/flujos_v2.test.cjs`, desde raíz | PASS; 172/172 | 0 |

Todos esos pasos tienen cero advertencias. El único escenario fallido es
`e2e/animacion.spec.ts:251`, fluidez local: exige **>55 fps**, obtuvo **44,80 fps**
en CPU 0. Se midió carga del host y se repitió la puerta en CPU 10, manteniendo
una CPU/worker y todos los umbrales: **41,72 fps**, de nuevo 52/53 aprobados.
Una muestra de carga no prueba causalidad; el cambio de CPU no resolvió el fallo.
Como contraste se exportó la base **66732be**, sin ningún cambio M12, con las mismas
dependencias/imagen y CPU 10: el caso aislado también falla, **32,58 fps**, rc 1.
[Primera E2E](evidencias/total-m12/e2e-cpu0.log),
[segunda E2E](evidencias/total-m12/contenedor-e2e.log) y
[contraste de base](evidencias/total-m12/base-fluidez.log).
Esto acredita que el fallo se reproduce sin M12; **no se declara la puerta verde**.
No se cambió animación ni se relajó el umbral para cerrar esta misión.

Dos fallos de preparación del ensayo también quedan registrados: el primer
`npm ci` intentó extraer cabeceras con `fchown` sin capacidades; se aplicó la
variable ya usada por `entornoLimpio` para reutilizar `/usr/local`. Al archivar
la primera E2E, el reporte renombrado quedó fuera de `.cache` y ESLint analizó su
JavaScript generado; se movió a `.cache`, sin cambiar reglas de lint. Tras ambas
correcciones de preparación se repitió la secuencia desde `npm ci`.

Los contenedores propios `cooper-m12-puerta` y `cooper-m12-base` terminaron y se
eliminaron con `--rm`; se comprobó que no quedan activos. Los artefactos completos
permanecen en `.cache/puerta-m12/` y `.cache/puerta-m12-base/`. El orquestador debe
repetir su puerta integrada después del retiro de Sentinel; aquí se ensayó solo
el código de esta rama, sin mezclar el frente concurrente.

## Límites reales

- La mejora elimina la materialización completa en JavaScript y los intentos de
  inserción duplicados. SQLite aún examina candidatos de los dueños habilitados
  y consulta el índice único de la cola: no se promete complejidad constante.
- El benchmark del ciclo representa historia ya atendida. No certifica el tiempo
  de un primer arranque con miles de avisos nuevos ni una entrega real por Meta.
- Datos/SSE siguen entregando el historial completo autorizado; sus costes
  crecen con él. La medición corresponde a funciones locales, no incluye HTTP,
  renderizado de navegador, latencia remota o serialización del snapshot.
- No se midió el motor Data Tables ni se alteró su paginación. El puente conserva
  filtros por dueño y `returnAll`; limitarlo sin un protocolo de continuación
  truncaría el estado. Este ensayo no acredita rendimiento de n8n/VPS en vivo.
- Las mediciones comparten una máquina con otras misiones. Se fijó una CPU;
  no son una predicción de producción ni una prueba de múltiples réplicas.

Documentación oficial consultada antes de usar las APIs locales:
[Drizzle SELECT](https://orm.drizzle.team/docs/select),
[filtros y NOT EXISTS](https://orm.drizzle.team/docs/operators),
[SQLite EXPLAIN QUERY PLAN](https://sqlite.org/eqp.html) y
[Node memoryUsage](https://nodejs.org/api/process.html#processmemoryusage).
También se leyó la guía instalada de Next sobre `serverExternalPackages`.

## Pendientes de Walter

- Encargar al frente de animación/orquestador resolver la fluidez bajo la
  restricción de una CPU. La puerta completa queda pendiente de ese cierre;
  no se amplió M12 a cambios de otra misión ni se rebajaron criterios.
- Ninguna decisión bloquea esta corrección local. La aceptación operativa con
  historia real y cualquier prueba en VPS/n8n corresponden a una misión autorizada.
- Si el volumen real supera estos presupuestos, acordar una lectura paginada
  entre puente, SSE y pantallas. No se truncó historia ni se aprobó esa ampliación.
