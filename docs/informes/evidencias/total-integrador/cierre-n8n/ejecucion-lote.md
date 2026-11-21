# Lote n8n aplicado y verificado

21-11-2026, Lima. El coordinador autorizó la fase después del PASS de aplicación e infraestructura y liberó el escritor. Se ejecutó una sola vez el wrapper/control indicados en [la receta](receta.md), con SHA-256 `dee9193c6ea88bf2229eef7c57867ec83c5cc153a9aa89a3381b6495e99b5089`. La orden terminó con salida **0/PASS**; la sonda independiente terminó **0/VERIFICACION_PASS a las 18:39:03**.

- Recibo operativo privado: `/var/lib/cooper-operacion/total-integrador-n8n-resultado.json`.
- SHA-256 exacto del recibo: `65f6a9bda7c3061d2e90017aa945e33cc31c970972b99350f3baeb6e6ffc7c06`.
- Snapshot previo, restaurado y verificado antes del import: `abadc22875b989f1e8e7bcfdd89f54edb612fd1170c212275352c844e0d9257b`.
- Entrada y manifiesto coinciden con el paquete certificado; el CAS pasó antes del respaldo, con escritores detenidos y en la sonda final. Se conserva el [export oficial previo](../export-cli.json), el [diff agregado](../lote-resumen.json) y el [ensayo de aplicación/reversa](../lote-ensayo.json). No se exportaron credenciales ni se publicaron los JSON privados.
- **33 workflows importados, 28 publicaciones individuales**. Inventario final: 45 workflows, 29 activos, 15 credenciales inventariadas solo por conteo; cero ejecuciones ocupadas y cero divergencias de nodos/conexiones entre borrador y versión publicada al observar.
- **Nueve tablas y 151 filas de negocio preservadas** durante este corte. Las 146 filas de la evidencia anterior pertenecen al ensayo histórico y no se presentan como el conteo vivo actual.
- Se agregaron `fab_videos.render_url` y `miniatura_url`, ambas `string`; comprobación idempotente, integridad y claves foráneas PASS. Workflows ajenos y contenido certificado preservados.
- Siete servicios saludables y mantenimiento ausente. Aprendizaje activo con horario habilitado. Radar activo/publicado con horario aún deshabilitado en este corte; Marcas aún inactivo. Los extras se aplican después con CAS propios.

El progreso se observó solo mediante estados, recuentos, IDs y hashes; no se imprimieron entornos, valores de credenciales, cuerpos ni logs privados. Una sonda de progreso falló por buscar la clave `publicar` en vez del rol `plan`; se corrigió para seleccionar el insumo por su SHA-256. Ese fallo afectó únicamente al observador y no repitió ni alteró el aplicador.

La reversa automática del lote estaba ensayada; no fue necesaria en producción. El snapshot vivo también se restauró antes de aplicar. No se fuerza un ciclo de reversa productiva adicional ni se atribuye esa acción a este PASS.

[Recibo filtrado y sonda](aplicacion-lote.json). A las 18:39 se liberó el escritor al coordinador para Radar; este frente no volvió a mutar el VPS después de esa entrega. Marcas requiere otra señal posterior al PASS de Radar.
