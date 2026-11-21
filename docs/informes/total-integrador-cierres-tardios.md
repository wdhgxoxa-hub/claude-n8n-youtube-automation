# Integración de cierres tardíos y defecto H19

21-11-2026, Lima. Auditoría de cinco refs fijadas contra `7837b84`, en rama/worktree propios `total-integrador-producto-h19`. La revisión detectó un defecto funcional real y lo comunicó antes de modificar la aplicación. El integrador autorizó incorporar la corrección y repetir imagen, puerta y rondas. No hubo consulta ni cambio del VPS, lectura de entornos reales ni acceso a worktrees ajenos.

## Selección y procedencia

| Ref y corte auditado | Resultado frente a `7837b84` | Tratamiento |
| --- | --- | --- |
| `total-competencia-revision`, `5ba27ce` | Corrección H19 `fd585f0` y regresión ausentes; herramientas HTTP y evidencia de diagnóstico/aceptación ausentes. Cierre de la corrección, pendiente de aceptación global. | `122f020` incorpora runtime/regresión exactos; `1c65535` incorpora herramientas y evidencia completa, incluidos fallos anteriores. Raíz incorporó el runtime como `dce1b03`. |
| `total-radar-contexto`, `14a09bf` | Helper WAL anterior ya integrado; falta `5a581e8`, que ajusta únicamente los ensayos de migración y Compose a 1 GiB sin swap. | `69ce3bb`, incorporado por raíz como `b3e608e`. Conservados el memo y recibos históricos sobre sustitución de imagen; configuración productiva intacta. |
| `total-final4-aceptacion-22ece8e`, `294e5e0` | Cierre documental de otra imagen corregida, con 13 migraciones y otro aplicador. Su runtime `22ece8e` equivale a `fd585f0`. | Conservar informe/recibos y manifiestos históricos por SHA; no sustituir el puntero `cooper-total/imagen-final.json` ni aceptar esa imagen como el integrado de 14 migraciones. |
| `total-matriz-cierre`, `63c412c` | Solo matriz de hallazgos del corte `c6fb927`, producto `22ece8e`; pruebas finales entonces pendientes. | Conservar el archivo exacto como `total-matriz-cierre-63c412c.md`, sin sobrescribir la matriz vigente ni convertir sus datos históricos en el estado actual de esta integración. |
| `total-revision-rondas-cierre`, `699a2fd` | Informe histórico de ronda de 92 pruebas, después invalidada como cierre por H19. Su antecedente `be2b242` excluye sincronización mutante en Sentinel, ya cubierta y ampliada por el Sentinel integrado. | Incorporar informes/recibos de cierre-3 y cierre-5. Conservar el observador y exclusiones modernos; no sustituirlos por la variante anterior ni atribuir sus rondas al nuevo producto. |

`git cherry` devuelve varios positivos por integración selectiva/cherry-picks con conflictos anteriores. Se comparó también el contenido: el puente de `7837b84` es exactamente el blob anterior a `fd585f0`, `a88e9a6948352fc00f37431cb3f0aa0c6002263c`. Su SHA-256 es `8a622eec6f8f45f2064fb7987f17985da5b12fadec9f51511c19b7adc3d1dbb4`. La corrección y el corte raíz `b3e608e` comparten blob `2f4f9f8cf1c49e1f4d38a0146c0c6ddbd86c7781` y SHA-256 `803317a7851aa4b31a2a6e5baa7588930d4e60d4dc7bd1299f805f5d6328bf1b`. Por tanto, el caso OOM no era un falso faltante causado por squash.

Equivalencias comprobadas con `git patch-id --stable`:

| Commits equivalentes | Patch ID |
| --- | --- |
| `fd585f0` / `22ece8e` | `c35e30209d6d8a4e0b9c476cbe97ddc43e37c397` |
| `5a581e8` / `92c8b7b` | `bff884b9ccbf323eb6a2dba2ebc78c9284dc7b67` |
| `762a1d9` / `251e61f` | `dc08ee6756e2696be195597b8ad65722d5f92f82` |
| `5ba27ce` / `04c128d` | `55ec0d959f45f90f5f67c26c493c6a8f8c98b519` |

No quedan otros cambios de aplicación sin clasificar en esas cinco refs fijadas. Las herramientas de ensayo se incorporan aparte del runtime y no cambian los archivos que componen la imagen b3e608e.

## Semántica, memoria y verificación

`aplicarEstado` prepara seis sentencias dentro de cada transacción y reutiliza parámetros. Mantiene la transacción `immediate`, las lecturas por fila que ven cambios anteriores del mismo lote, autorización por dueño, conflicto 409 y rollback de canales/videos/avisos. Los UPSERT actualizan solamente los campos anteriores mediante `excluded`; conservan dueño, canal, creación y estado de producción. Permanecen cancelación, orden de revisiones, observabilidad con revisión igual, valores omitidos y encolado real. No hay caché global, truncamiento ni aumento de memoria. Se contrastaron las referencias oficiales actuales de [consultas preparadas](https://orm.drizzle.team/docs/perf-queries), [UPSERT Drizzle](https://orm.drizzle.team/docs/guides/upsert) y [UPSERT SQLite](https://www.sqlite.org/lang_upsert.html).

Consulta oficial adicional realizada hoy, 21-11-2026: [README de better-sqlite3](https://github.com/WiseLibs/better-sqlite3/blob/master/README.md), [API de sentencias y parámetros](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) y [ciclo de sentencias preparadas de SQLite](https://www.sqlite.org/c3ref/stmt.html). Confirman preparación/reutilización y enlace de parámetros; Drizzle documenta `prepare()` y `sql.placeholder()`. Las pruebas locales contrastan esa semántica con las versiones del lockfile instalado, sin actualizar dependencias.

La evidencia original conserva el control que termina OOM/137 a 1 GiB sin swap, el diagnóstico de sentencias y la aceptación corregida: cuatro actores, cinco sincronizaciones y tres GET por actor, hashes íntegros, cero reintentos/OOM, pico administrativo 604,85 MiB y respuesta completa de 53.189.871 bytes. Es una medición de funciones de aplicación compiladas con HTTP real y fixture sintético de 10.000 videos; no ejecuta Next completo, su autenticación, navegador, SSE ni concurrencia. Esta auditoría no repitió ni se atribuye esa medición. Operación prepara el contraste adicional con la imagen standalone integrada exacta.

Validación local propia:

- Puente, capacidad, integración y WhatsApp: **59/59 PASS**. Las tres regresiones nuevas cubren preparación constante para 256 filas y tres ciclos, revisiones/duplicados/cancelación/observabilidad y autorización/rollback/avisos.
- `npm run lint` y `npm run typecheck`: RC 0, cero errores y advertencias.
- `python3 -B -W error -m unittest discover -s deploy/tests -p 'test_*.py'`: **190/190 PASS**, RC 0, sin advertencias; incluye memoria/swap de migración.
- `node --test tests/volumen_n8n.test.cjs tests/flujos_v2.test.cjs`: **239/239 PASS**, cero fallos/omisiones/advertencias.
- Sintaxis de Compose y los tres ejecutores Node, y extensión C con `-fsyntax-only -Wall -Wextra -Werror`: PASS.

Se preservaron los logs históricos byte por byte, incluidos sus saltos finales. Dos logs crudos de Vitest de la fuente muestran una línea vacía final ante `git diff --check`; no se editó la evidencia para eliminarla. Los archivos de código/documentación añadidos se comprobaron aparte. Esto no representa advertencias en las pruebas ejecutadas. La puerta previa de 464 unitarias/103 E2E/235 flujos conserva su alcance anterior a H19; el integrador repite la puerta completa, imagen y rondas sobre b3e608e. Este frente no declara haber aprobado esos pasos nuevos.

## Bundle y copia final regenerados

Fuente fijada: `b3e608eec138a03fce419a66954497b8fc2c50ea`. Los 25 nombres del bundle siguen cerrados. Único cambio de código respecto del paquete anterior: `deploy/ensayar-migracion.py`, SHA-256 `f22e612b90ca417335614d520bd3a2fed306d57b61dc3bf72247ac8591046527`. Operador, aplicadores, contratos, CAS y reversa mixta son idénticos. El wrapper únicamente actualiza ese pin; **12/12 regresiones** aprobadas. La copia final actualiza el SHA del wrapper y la release completa b3e608e; **14/14 regresiones** aprobadas. Todo con `-B -W error`, sin advertencias.

| Artefacto público local | SHA-256 |
| --- | --- |
| `~/.cache/total-integrador-producto-wrapper-b3e608e/aplicadores-certificados.tar.gz` | `7cb25bf563a5ca2333ff18f35cc116b946717fcb9281424a15b53339241c6b71` |
| `codigo.json` del mismo paquete | `9464aacfd474a73483f9823e72989b3e791f1930572501bc96d480db64bf54bf` |
| `ejecutar-bundle.py` del mismo paquete | `f3eaefa3b7f6ce663300fc387762732cedf3d63501831d31e712d2c44b537126` |
| `~/.cache/total-integrador-producto-copia-final-b3e608e/copia-final.tar.gz` | `bc4b9ee679f6a45144b870c36ee80f8cd19bb79683c91d44776fa6d8be98894b` |
| `copia-final.py` del mismo paquete | `142a92efc7b07322c9f0f329864a088b487db590f20fb1a8f9db50f7c178b58c` |
| `control-final.json` del mismo paquete | `1169ec74653085cab3854bb3538e8eab762ff102386f13dc0d697fc892274669` |

Ubicaciones remotas propuestas, todavía no instaladas por este frente: `aplicadores-certificados-b3e608e/` y `copia-final-b3e608e/` bajo el staging autorizado. El integrador actualiza el campo `bundle` y SHA revisado de sus controles privados; el control de infraestructura debe ligar el nuevo artefacto/recibo real, sin retocar evidencias anteriores. La copia final exige exactamente `localhost/cooper:b3e608eec138a03fce419a66954497b8fc2c50ea`. Los paquetes anteriores quedan conservados como historia; ninguno se ejecutó aquí en el VPS.

## Pendientes de Walter

Ninguno nuevo. La nueva puerta, imagen, dos rondas, aceptación operativa y despliegue son trabajo técnico autorizado del integrador. Los pendientes humanos/editoriales anteriores permanecen intactos.
