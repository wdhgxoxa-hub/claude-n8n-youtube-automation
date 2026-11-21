# Total cierre — horario Radar

21-11-2026, Lima. Rama/worktree `total-cierre-radar`, base `af2774c`. Extra entregado en `b761baf`, integrado por raíz como `6f8825c` y publicado dentro de `fc0e98a`. Tras la señal expresa del integrador y el PASS del lote principal, **horario desplegado y aceptado a las 18:45 Lima**. Este frente no realizó push.

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

Implementado, probado, integrado, publicado y desplegado. La preparación operativa final se hizo **después** del lote n8n certificado, con copia consistente nueva, export oficial privado y siete huellas de contenido idénticas. Sigue activación Marcas simulada y luego copia final, a cargo del integrador. Reversa inversa Marcas → Radar → lote → infraestructura → Cooper. [Receta](../cooper-horario-radar.md).

El laboratorio acredita importación/publicación/reversa; el VPS acredita además registro efectivo del disparador. No se ejecutó Radar manualmente ni se alteraron proveedores, compras, OAuth, medios o publicación. El próximo disparo natural de las 07:40 del 22-11-2026 se observará aparte; no se presenta como ya ejecutado.

## Aplicación VPS y aceptación final

El lote previo había terminado PASS: recibo SHA-256 `65f6a9bda7c3061d2e90017aa945e33cc31c970972b99350f3baeb6e6ffc7c06`. Se obtuvo copia consistente de 45 workflows bajo el bloqueo compartido; SHA-256 `b6b0b19e5c8d1d9f9cd8585c4523bc23b3fa31eb714bd40287b573b92bc395c3`. Se compararon las siete fuentes antes del export CLI offline. Un error de ruta del runner situaba la salida dentro del padre del SQLite: el ensayador lo rechazó antes de copiar o mutar servicios. Se corrigió solo esa ruta local y se repitió el ensayo afectado; helper, bundle e imagen permanecieron exactos. [Diagnóstico](evidencias/total-integrador/cierre-n8n/radar/diagnostico-ruta.json).

El ensayo posterior al lote aprobó un import/publicación, cero columnas, nueve tablas/151 filas y reversa byte a byte. Entrada nueva SHA-256 `68dc821e8c836d1752d1b0fc85319bdf48fa94ebf651f480cf9a82af8fd877d5`; helper exacto `df5621f98aec16a95622cc9f4b3f21c67ee9de037f418beb9cc5697ee8cbe21a`. [Ensayo](evidencias/total-integrador/cierre-n8n/radar/ensayo-poslote.json), [control](evidencias/total-integrador/cierre-n8n/radar/control-poslote.json).

Aplicación mediante el procedimiento certificado, con respaldo restaurado/verificado `d302a6cec835e4da1c99ef634e2f3f78e0dc7382241b44f65460157a8fa74bd1`, permiso de texto cerrado y CAS antes/bajo corte/después. Resultado **PASS**: 45 workflows, 29 activos, 15 credenciales; nueve tablas/151 filas y 44 workflows ajenos preservados; integridad y claves foráneas correctas; siete servicios saludables; mantenimiento retirado. No se modificó el entorno del VPS.

Recibo remoto `/var/lib/cooper-operacion/total-cierre-radar-20261121T2340Z-resultado.json`, SHA-256 **`6e747e3227f4d9a6f864d8516e5172e97ff60794a88025bb587e6e1d33372652`**. [Aplicación](evidencias/total-integrador/cierre-n8n/radar/aplicacion.json), [verificación final](evidencias/total-integrador/cierre-n8n/radar/verificacion-final.json).

El único horario queda `disabled=false`. `workflow_publication_trigger_status` acredita `activated`, error ausente y versión idéntica al borrador/publicación `b96dc611-006a-49b1-8f99-3d7ab7d55613`. [Registro del disparador](evidencias/total-integrador/cierre-n8n/radar/trigger.json). Se liberó la exclusividad de escritura al integrador para continuar Marcas; ninguna mutación remota posterior desde este frente.

## Pendientes de Walter

Ninguna decisión nueva para preparar este horario: la autorización está dada. Los pendientes generales de aceptación privada, dispositivos, proveedores y publicación real se conservan en el informe principal. La observación de la próxima ejecución natural es trabajo operativo; no requiere aprobación adicional de Walter.
