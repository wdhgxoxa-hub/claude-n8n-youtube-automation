# Copia posterior al retiro de sondas y clones íntegros

Fecha: 2026-11-21 15:13 (Lima). Frente operación de `cooper-total`.

## Resultado

**Aplicado y probado:** un solo corte del stack después de las 15:02 reunió la copia fría, restauración y arranque necesarios para retirar las tres sondas. Siete servicios saludables antes y después, cero ejecuciones nuevas/en marcha al tomar el corte y esperas históricas 400/540 intactas. La réplica automática de la PC tomó ese mismo snapshot y restauró/verificó 25 archivos y dos bases.

**Probado localmente:** el clon íntegro preserva 45 workflows, nueve tablas y **146 filas**, con los mismos hashes de negocio y de IDs/estados/versiones que la restauración remota. n8n 2.47.6 inicializa dos veces sin cambios y la reversa 2.47.4 conserva el inventario; Cooper `bfd5e79` migra 11→13 y vuelve correctamente al corte anterior. No se activaron esas imágenes en el VPS.

## Corte y evidencia

- Snapshot: `38b362f015b86e819cdd6669681f5980f5c1f4ae74aa448805afa09da596aef1`. [Copia, estado y siete servicios](evidencias/total-radar-contexto/corte-final/copia-vps.json).
- Negocio: `dcf5e2174450101441e0627f9ae69a4526c66387489aef92db7e57af571fef18`; IDs/estados/versiones: `d14e7acefee211b645eba3938bff70f3c219444e1401704aa49adfd20bcbaae5`.
- [Réplica automática PC](evidencias/total-radar-contexto/corte-final/replica-pc.json) y [restauración íntegra](evidencias/total-radar-contexto/corte-final/restauracion-pc.json): mismo snapshot, WAL de ambas bases preservados. La réplica fue ejecutada por el timer, no presentada como un disparo manual.
- [Motor n8n](evidencias/total-radar-contexto/corte-final/motor.json): 342 migraciones antes/después; 45 workflows/146 filas conservados; respaldo y reversión exactos `44dd221a64c46ad741f37747427c7803f489d84d2c351bf880d53beb60028146`. Sin red, puertos ni triggers, 0,5 CPU.
- [Cooper](evidencias/total-radar-contexto/corte-final/cooper.json): 11→13 migraciones y 27 tablas anteriores conservadas; reversa exacta e integridad/claves foráneas. El respaldo normalizado `e855ef149d3a67f492a2b1a2a1863b0d780a3b3a054d4b76e5edfb7c424b7066` coincide con el ensayo anterior de la imagen `bfd5e79`.
- [Clon autónomo](evidencias/total-radar-contexto/corte-final/clon-autonomo.json) e [inventario comparado](evidencias/total-radar-contexto/corte-final/clon-inventario.json): incorpora ambos WAL y reproduce los hashes públicos del corte. Los archivos de datos siguen privados y fuera de Git.

Las tres sondas `CoopRadarReal001`, `CoopSondaVidIQ01` y `CoopSondaYtComp1` estaban inactivas, sin versión publicada al tomar la copia. Competencia comprobó después seis respuestas POST 404, cero webhooks y cero ejecuciones nuevas; el getter `CoopEnsayoTok01` también quedó retirado. La prueba automática M7 de las 15:00 se preservó sin reinicios durante 14:59–15:02 y tiene [recibo independiente](total-aprendizaje-horario.md).

## Omisión detectada y corregida

Un traslado manual inicial copió únicamente los dos `.sqlite`. Sus archivos eran íntegros, pero sin WAL el clon tenía 145 filas y ocho migraciones Cooper: **no representaba el snapshot completo**. El motor pasó técnicamente sobre esa copia equivocada; Cooper falló. Se conserva [el intento rechazado](evidencias/total-radar-contexto/corte-final/intento-incompleto.json), sin atribuirlo al producto ni ocultarlo. La copia restic del VPS y su réplica PC siempre incluyeron WAL y verificaron el corte correcto.

Se restauró el snapshot íntegro y se repitieron ambos ensayos sobre ese origen. La corrección permanente `e29bba5` añade `deploy/preparar-clon-restaurado.py`: exige manifiesto completo, usa la API backup de SQLite, produce clones autónomos, comprueba todas las tablas/conteos, integridad y claves foráneas, y verifica que el origen no cambió. WAL ausente del disco o del manifiesto bloquea antes de crear el destino. Las regresiones conservan filas, versión publicada y migraciones al mover solo el clon terminado. [136 pruebas Python con `-W error`, cero advertencias](evidencias/total-radar-contexto/corte-final/python.log).

El formato del archivo cambia al incorporar WAL y seleccionar journal DELETE; su hash autónomo se registra aparte. No se equipara el hash de un `.sqlite` original aislado con el contenido lógico de `.sqlite`+WAL. El procedimiento y las fuentes oficiales están en [operación](../cooper-operacion.md#clones-sqlite-para-ensayos).

## Integración y límites

El recibo candidato de infraestructura ahora enlaza [el motor del corte de 146 filas](evidencias/total-radar-contexto/corte-final/infra-ensayo-actualizado.json). Conserva exactamente las imágenes, Compose, Caddy y configuración del runner que ya pasaron [ocho bloques y avería/reversa del aplicador](total-imagen-bfd5e79.md). El aplicador no cambió. Los cortes de 130 y 144 filas son antecedentes distintos; no se sustituyen sus resultados ni se atribuyen sus conteos a este snapshot.

Commits de este tramo: `2aa3c98` acredita delta cerrado de Radar/hijo/API; `6f6af64` acredita el disparo automático M7; `e29bba5` agrega la guardia de clones completos. Este informe incorpora los recibos posteriores al retiro. La puerta de producto y las dos rondas limpias corresponden al orquestador y siguen pendientes: el fallo observado de Sentinel requiere corregir el arnés y repetir. No se declaró despliegue final ni se repitieron navegadores en este frente.

El VPS continúa con Cooper `cbf2068` y once migraciones, n8n/runner 2.47.4 y Caddy 2.11.2. Faltan activación coordinada, secreto opaco worker de Marcas, arranque final, nueva copia posterior al despliegue y aceptación pública. La réplica externa depende de que esta PC esté disponible.

## Pendientes de Walter

Ninguna decisión de Walter bloquea estas tareas técnicas ya autorizadas. Se conservan los pendientes de acceso legítimo Google, proveedores/pagos y resolución humana de las esperas históricas en sus informes respectivos. No hubo OAuth, pagos ni publicación de videos.
