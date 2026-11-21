# Radar — aplicación aceptada

21-11-2026, 18:45 Lima. Después del lote n8n principal PASS se aplicó exclusivamente `Cada mañana (radar).disabled=false` en `FabRadar00000001`; mantiene las 07:40 America/Lima. Se conservaron entorno, bundle de 25 archivos, imagen, credenciales y restantes workflows. No se ejecutó Radar manualmente.

**Resultado:** disparador registrado `activated`, versión publicada coincidente `b96dc611-006a-49b1-8f99-3d7ab7d55613`, sin error. 45 workflows/29 activos/15 credenciales; nueve tablas y 151 filas preservadas, 44 workflows ajenos intactos; integridad y claves foráneas correctas, siete servicios saludables, sin mantenimiento. La próxima ejecución natural todavía no se ha observado.

Recibo VPS: `/var/lib/cooper-operacion/total-cierre-radar-20261121T2340Z-resultado.json`. SHA-256: `6e747e3227f4d9a6f864d8516e5172e97ff60794a88025bb587e6e1d33372652`. Respaldo restaurado/verificado: `d302a6cec835e4da1c99ef634e2f3f78e0dc7382241b44f65460157a8fa74bd1`.

| Evidencia | Qué acredita |
| --- | --- |
| [copia-poslote.json](copia-poslote.json) | Copia SQLite consistente, ligada al recibo principal `65f6a9bd…7c06`; no contiene filas. |
| [control-poslote.json](control-poslote.json) | Siete fuentes comparadas y hashes del paquete nuevo, helper exacto y rutas operativas. |
| [ensayo-poslote.json](ensayo-poslote.json) | CLI oficial offline, un import/publicación, cero columnas, nueve tablas/151 filas y reversa exacta. |
| [aplicacion.json](aplicacion.json) | Respaldo, doble CAS, permiso cerrado, aplicación y conservación de datos/workflows. |
| [trigger.json](trigger.json) | Registro efectivo del scheduler, versión y ausencia de error. |
| [verificacion-final.json](verificacion-final.json) | SHA del recibo remoto, integridad/FK, conteos, siete servicios y mantenimiento retirado. |
| [diagnostico-ruta.json](diagnostico-ruta.json) | Primer intento local rechazado por directorios anidados; se corrigió solo el runner y se repitió el ensayo afectado. |

El helper ensayado/aplicado conserva SHA-256 `df5621f98aec16a95622cc9f4b3f21c67ee9de037f418beb9cc5697ee8cbe21a`. La corrección del runner no cambió ese helper, el bundle, producto o imagen. No se abrieron ni imprimieron valores de credenciales y no se exportaron credenciales.

La escritura del VPS quedó liberada al integrador para Marcas. La reversa se realiza en orden Marcas → Radar → lote n8n → infraestructura → Cooper; para Radar se usa copia/export/CAS nuevos y el recibo anterior, según [la receta](../../../../../cooper-horario-radar.md).
