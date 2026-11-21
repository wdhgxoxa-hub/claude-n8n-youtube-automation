# Recuperación canónica: aceptación complementaria

Corte: 2026-11-21 17:03 Lima. Rama propia `total-recuperacion-cas`, base `23478e4`, worktree `/home/david/.cache/cooper-recuperacion-cas`. Se añadió solamente el arnés de laboratorio procedente de `a7f2b60`, documentación y recibos. No se cambió Cooper, Operator, aplicador, helper canónico, Compose ni el árbol del integrador. No hubo SSH ni acceso al VPS.

## Resultado

El ciclo real local aplicación de infraestructura → recuperación posterior a PASS → reinicio explícito con override terminó **PASS**, salida 0. Siete servicios saludables e identidades originales exactas después de recuperar y reiniciar. El helper es SHA256 `beaa5cabeb4f94fb99940922751818a8e771e54dd591e975795397308ca0a3ba`, idéntico antes/después y al de `f2537b3`.

La imagen fue `localhost/cooper:b3e608eec138a03fce419a66954497b8fc2c50ea`, archivo SHA256 `9ea269e6746e197c5626ae04fa6835bbcf9eb18274d7d0192225582e8e493d20`. El arnés verificó archivo y bundle contra el recibo de aceptación previo; no construyó ni modificó la imagen.

| Comprobación | Evidencia |
| --- | --- |
| Siete identidades mixtas restituidas | Cooper/chat-cooper b3; chat-n8n/chat-runner cbf2068; n8n/runner/Caddy anteriores. Coincidencia exacta antes, después de recuperar y después del reinicio explícito. |
| Relés y límites | Cada relé comparte namespace con su padre; los tres devuelven401 sin autorización y200 por socket ficticio autorizado. Cooper1GiB/swap0 en las cuatro fases. |
| CAS de workflows y esquema | Hash `6595a3897456966f01027259bc839ae8c55aebc192ef73b240fc157ead2e621e`; `workflows_ajenos_preservados:true`. Las guardas canónicas se ejecutaron completas. |
| Escritura posterior | Archivo ficticio escrito después del PASS de aplicación, conservado en datos desplazados y restaurado desde su snapshot restic; SHA exacto verificado. |
| Punteros y reinicio | `release.json` conservado y `anterior.json` global ausente durante todo el ensayo. Reinicio mediante `start_restored(op, imagenes_reversa)`; sin `revertir.sh`. |
| Cierre | Mantenimiento ausente al terminar, limpieza del proyecto PASS y archivos públicos restaurados byte por byte. |

[Recibo integral](evidencias/total-recuperacion-cas/real-7.json), [aplicación](evidencias/total-recuperacion-cas/aplicacion.json), [recuperación](evidencias/total-recuperacion-cas/recuperacion.json), [identidades antes/después](evidencias/total-recuperacion-cas/identidad.json).

Hashes de recibos: integral `7c5dbbc5ffdd35604cec39ecb3a8d2e69ee97074cdc6f4f1f69258957583a721`; aplicación `65b2b39f94727661768bb5f365e6158b8e21e288e50c25f357eca56e17dd3bdf`; recuperación `f39ff5e7abb991335034de3a99bd0f100364998a09d2adee3e6483edff724dca`.

## Alcance y relación con otros ensayos

Podman rootless real, fixture nuevo sintético, red interna, puertos loopback, CPU0–1, medio CPU por servicio y Cooper1GiB/swap0. El socket y todas las claves del fixture fueron generados para este laboratorio; no se recibió ni copió un entorno existente. Se usó un único workflow manual inactivo sin credenciales ni proveedores para que la exportación oficial de n8n tuviera contenido.

La adaptación exclusiva del arnés retira solo relés detenidos antes de recrear sus padres y monta `/sys` vacío de solo lectura en ellos. Conserva argumentos/overrides y todas las verificaciones productivas. No acredita Docker en VPS, transporte de la PC, reboot, autoarranque genérico ni recreación sin override.

El [ensayo independiente del integrador](total-integrador-recuperacion-b3.md), commit `f2537b3`, ya acredita el mismo helper, ocho bloques Compose, fallo inyectado con reversa y recuperación inmediata después de PASS. Este único ciclo adicional acredita el reinicio explícito, ausencia del puntero global y restauración de las escrituras desplazadas. No se repitieron ciclos por rutina ni se transfirieron resultados entre helpers.

El ensayo anterior `a7f2b60` sobre helper `c53b285f…` permanece histórico con sus dos intentos fallidos de fixture y sus recibos. El PASS antiguo de cuatro servicios/imagen22 tampoco se atribuye al helper actual. Los recibos no se sobrescriben.

## Pruebas y receta

`PYTHONDONTWRITEBYTECODE=1 python3 -W error -m unittest discover -s deploy/tests -p 'test_*.py'`: **221/221 PASS**, cero errores/advertencias. Incluye los rechazos CAS por edición posterior con la misma versión, cambio durante el corte y lote de solo columnas. Esas regresiones usan dobles y SQLite sintético; se distinguen del ciclo real positivo. [Salida](evidencias/total-recuperacion-cas/regresiones.log).

La puerta completa web y las rondas corresponden al integrador y a su mismo artefacto b3. No se repitieron aquí porque no hay cambios de producto. No se declara integración, activación remota ni aprobación de rondas fallidas.

La secuencia actual del integrador es actualización limitada de Cooper → infraestructura → lote n8n. Para volver, **primero conciliar o revertir el lote n8n posterior con su contrato propio**, después recuperar infraestructura y finalmente, si procede, Cooper mediante el recibo específico del actualizador limitado. El CAS debe rechazar un intento de retroceder infraestructura sobre workflows o esquema posteriores. No se elimina ni fuerza esa guarda.

Durante el estado mixto posterior a recuperar infraestructura, el arranque debe añadir el mismo `imagenes-reversa.json` certificado como último override. El ensayo ejecuta exactamente `start_restored(op, override)`, que delega en el arranque del aplicador con `image_overrides`, sin descargas y con Caddy al final. No instala una política persistente ni autoriza una recreación genérica sin ese archivo.

`actualizar-solo-cooper.py` no escribe el puntero global: **no usar `revertir.sh` para esa fase**. Su recuperación posterior a PASS se coordina con el integrador y su recibo específico. Este trabajo no implementa otro recuperador ni altera su estrategia. Las escrituras posteriores se conservan para conciliación; restaurar discos no revierte efectos externos.

## Commits

- Base canónica `23478e4`; helper idéntico al acreditado en `f2537b3`.
- El commit de este informe añade únicamente arnés, evidencia complementaria y documentación; ningún cambio productivo.

## Pendientes de Walter

Ninguno nuevo. La conciliación operativa pendiente es responsabilidad de Codex/integrador; se mantienen los pendientes humanos documentados por la misión general.
