# M12 — historiales con volumen (H19)

21-11-2026, Lima. Rama/worktree `total-m12`, base integrada `66732be`.
Implementado y probado localmente; no integrado ni desplegado. Sin push, merge,
VPS, servicios externos, OAuth, pagos ni acceso a credenciales. No se modificaron
flujos n8n, migraciones, vendor ni el entorno de Sentinel.

## Cambios y commits

- `8026806` — fixture determinista y benchmark repetible, con medición inicial.
- `49fd2ae` — consulta de avisos faltantes, proyección mínima y seis regresiones H19.
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

Puerta parcial sobre `49fd2ae`: `npm ci`, `npm run lint`, `npm run typecheck`,
`npm test` (**442/442**) y `node --test tests/flujos_v2.test.cjs` (**172/172**) pasan
con rc 0, cero advertencias y sin omisiones. [Recibo](evidencias/total-m12/puerta.json)
y registros `puerta-*.log` en la misma carpeta.

`.cache/LISTO-PUERTA` creada a las 12:28 Lima; E2E/build esperan el archivo
`.cache/TURNO-PUERTA` del orquestador. No se lanzarán antes. La implementación y
las pruebas focales concluyeron en menos de siete minutos, dentro del máximo de
veinte minutos; el resto corresponde a documentación y puerta.

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

- Ninguna decisión bloquea esta corrección local. La aceptación operativa con
  historia real y cualquier prueba en VPS/n8n corresponden a una misión autorizada.
- Si el volumen real supera estos presupuestos, acordar una lectura paginada
  entre puente, SSE y pantallas. No se truncó historia ni se aprobó esa ampliación.
