# Total cierre — horario Radar

21-11-2026, Lima. Rama/worktree `total-cierre-radar`, base `af2774c`. Preparación local solicitada por el integrador; sin acceso ni mutaciones al VPS, push o despliegue. El commit de entrega se identifica con `git log -1 --format=%H -- deploy/horario-radar.py`.

## Implementado y probado

Extra separado `deploy/horario-radar.py`: solo `disabled=false` del único horario `Cada mañana (radar)` en `FabRadar00000001`; mantiene 07:40 America/Lima. Reutiliza `Operator`, CAS, ensayador y aplicador certificados mediante un adaptador explícito de política. Todos los archivos del bundle de 25, la fuente/generador n8n y el runtime b3 permanecen intactos.

Exige export oficial consistente, igualdad borrador/publicación, permiso de texto cerrado sin override, seis dependencias publicadas y cuatro referencias de credencial existentes; nunca consulta valores de credenciales. Conserva exactamente el resto del workflow por hash, incluidas referencias, staticData y pinData. El CAS fija contenido/versiones de los siete workflows antes del respaldo y bajo corte. El paquete debe coincidir con el ensayo por hash, incluidos el extra y los helpers certificados.

El respaldo/reversa del aplicador permanece sin cambios. Añade preparación de reversa posterior a PASS ligada al recibo: nuevo export/CAS, cambio inverso único y preservación de negocio. No reabre otros disparadores ni altera la política de API de texto o vidIQ.

## Evidencia

- **254/254 regresiones operativas PASS**, con `python3 -B -W error -m unittest discover -s deploy/tests -p 'test_*.py'`; diez nuevas cubren cambio mínimo, CAS, credencial ausente, dependencia ausente/dinámica, publicación divergente, permiso cerrado, horario/estado exactos y recibo de reversa. [Log](evidencias/total-cierre-radar/regresiones.log).
- **Ensayo CLI real n8n 2.47.6 PASS**: un import, una publicación, cero columnas, nueve tablas de negocio y 44 workflows ajenos preservados; reversa byte a byte, red `none`, sin puertos ni ejecución de workflows. [Recibo](evidencias/total-cierre-radar/ensayo-importacion.json).
- **Ciclo del aplicador certificado PASS**, con Operator de laboratorio y CLI real sin red: activación → reversa posterior a PASS → nueva activación con fallo de publicación inyectado → restauración byte a byte. Nueve tablas de negocio y 44 workflows ajenos preservados. El adaptador offline no inicia servicios ni scheduler; respalda por copia fría en lugar del restic ya certificado. [Recibo](evidencias/total-cierre-radar/ciclo-real.json), arnés `deploy/tests/horario-radar-offline.py`.
- [Huellas de las siete fuentes](evidencias/total-cierre-radar/fuentes.json), derivadas opacamente de la copia posterior al ensayo del lote integrado `entrada_sha256=269d8f7c…9588`. La copia no se modifica; el laboratorio trabaja sobre SQLite backup consistente.
- Se reutiliza la puerta completa ya aprobada de `5e8e260`: instalación/lint/tipos/build, 467 unitarias, 103 E2E y 235 flujos, cero errores/advertencias/omisiones. La misión ordena no repetir lo aprobado. Este extra no cambia producto, workflows ni imagen; [recibo heredado](evidencias/total-integrador/puerta-final.json).

## Limitaciones reales y secuencia

Implementado y probado localmente; aún no integrado ni desplegado desde este frente. La preparación operativa final se hace **después** del lote n8n certificado, pues cambian versiones; los hashes de contenido deben seguir coincidiendo. Sigue activación Marcas simulada y luego copia final. Reversa inversa Marcas → Radar → lote → infraestructura → Cooper. [Receta](../cooper-horario-radar.md).

El laboratorio acredita importación/publicación/reversa, no un disparo natural del scheduler ni respuestas de proveedores. No hubo llamadas externas, compras, OAuth, medios o publicación. La activación se realizará únicamente al recibir la señal del integrador. Si una referencia/permiso falta en el corte final, el helper detiene ese extra y conserva el hecho como pendiente, sin sustituir credenciales.

## Pendientes de Walter

Ninguna decisión nueva para preparar este horario: la autorización está dada. Los pendientes generales de aceptación privada, dispositivos, proveedores y publicación real se conservan en el informe principal. La observación de la próxima ejecución natural es trabajo operativo; no requiere aprobación adicional de Walter.
