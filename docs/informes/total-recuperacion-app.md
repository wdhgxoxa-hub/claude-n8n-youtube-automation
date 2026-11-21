# Recuperación scoped de aplicación después de PASS

Corte: 2026-11-21 17:22 Lima. Rama `total-recuperacion-app`, worktree propio `/home/david/.cache/cooper-recuperacion-app`, base `012322a`. Trabajo acotado coordinado con el integrador. Sin VPS, push, cambios de imagen ni despliegue declarado.

## Cambio

Se añade `deploy/recuperar-app.py` como extra separado. Resuelve la ausencia de una recuperación ejecutable después del PASS del actualizador limitado. Reutiliza Operator, las comprobaciones de SQLite del actualizador y los controles de rutas/imágenes/CAS del helper canónico de infraestructura. **Actualizador, Operator, aplicar/recuperar-infra, Compose, imagen b3 y bundle permanecen byte por byte idénticos a la base.**

La preparación previa fija código, configuración pública, imagen/release anterior, nueva imagen y fase n8n. El sello del resultado PASS liga esa preparación con el recibo scoped, su anterior específico y el manifiesto de todo el respaldo frío (SQLite, WAL, medios y modos; excluye solo SHM). Rechaza una fase distinta o un servicio ajeno recreado entre preparación y sello.

La recuperación valida de nuevo recibos, código, imágenes, configuración y CAS; prepara una restauración antes del corte. Bajo el mismo lock detiene solo Cooper/chat-cooper, archiva todas las escrituras posteriores, restaura respaldo/release e inicia los dos servicios. Verifica las identidades/horas de los cinco ajenos y conserva el puntero global ajeno. Un fallo bajo corte mantiene los dos estados y mantenimiento, sin anunciar PASS.

## Evidencia

- **20 pruebas focales y 241/241 regresiones de despliegue con `-W error`**, cero errores/advertencias. Incluyen transacción SQLite real confirmada solo en WAL y recuperada desde una copia, alteración de medios/recibos/código, etiquetas movidas, fase posterior, cambio durante corte, preservación de estado ante fallo y comandos limitados a dos servicios. [Focal](evidencias/total-recuperacion-app/focal.log), [regresiones](evidencias/total-recuperacion-app/regresiones.log).
- **Ciclo real local PASS:** siete servicios previos con Cooper cbf2068 → actualizador certificado a b3 → sello completo → nueva fila y medio ficticios → recuperación anterior. Migración11→14 y retorno11, siete saludables, fila/media anteriores recuperados; fila/media posteriores archivados y restaurados a otra carpeta con comparación de manifiesto. Los otros cinco mantuvieron ID, imagen y StartedAt exactos desde antes de actualizar hasta después de recuperar. Release previa restituida, anterior global ausente, limpieza propia PASS.
- Extra ejecutado SHA256 `32676c66f973f63eb8a6e0c8928847613283313a4a43744d79bf86f4f7c37f04`, idéntico antes/después. Imagen b3 completa y archivo SHA256 `9ea269e6746e197c5626ae04fa6835bbcf9eb18274d7d0192225582e8e493d20`. [Recibo público reducido](evidencias/total-recuperacion-app/real-7.json), [hashes de entrega y módulos](evidencias/total-recuperacion-app/entrega.json).
- Sello privado del ensayo SHA256 `5bf7402e856c4f264108d4f0c92a25fb8eb88933e44bbe27a2c06cc5b96552d8`; recuperación privada SHA256 `c4a51d2a11e169d666e54a430a8eb2fbce795118b77f965bdf51bc9851a8d383`. Los manifiestos completos no se publican; el resumen conserva huellas y recuentos.
- Dos intentos locales anteriores se rechazaron **antes de aplicar** por representación de identidad de Podman (`json .Id`, prefijo SHA). Se conservan con limpieza PASS. El extra usa ahora el ID completo de Compose, validado SHA64, y normaliza únicamente el prefijo del digest; no acepta una identidad distinta. [Intentos](evidencias/total-recuperacion-app/intentos.json).

El laboratorio usa Podman rootless, red interna, puertos loopback, claves/base/socket ficticios nuevos, CPU0–1 y medio CPU por servicio; Cooper1GiB/swap0 comprobado en las tres fases. El actualizador ejecuta su función `deploy` íntegra; el arnés adapta transporte Docker→Podman, nombres/rutas del proyecto, guarda de UID y verificación pública HTTPS a HTTP interno real. Conserva su copia, migración/arranque aislados, checks y rama de reversa. Para namespaces retira exclusivamente el relé scoped detenido al recrear su padre. No se manipulan otros proyectos. Esto **no es prueba Docker en VPS, TLS público ni reboot**.

No se repite la puerta web: no cambia `cooper/` ni el artefacto. El integrador mantiene esa puerta, rondas y aceptación final. La suite del extra y su ciclo real complementan, no sustituyen, esa aceptación.

## Integración y receta

[Procedimiento ejecutable](../cooper-recuperacion-app.md). Ubicar el extra fuera del bundle, seleccionar `operar`/actualizador/aplicador del bundle mediante `PYTHONPATH` y `--codigo`, helper infra mediante `--infra-helper`, y configuración viva mediante `--deploy`. Las huellas de todos los módulos quedan enlazadas al sello; no importar el Operator antiguo instalado ni sobrescribir el bundle.

Orden acordado: Marcas bloqueado → preparar app → actualizador limitado → sellar app PASS → infra → n8n. Reversa: primero el lote n8n posterior, después infraestructura y por último este extra app. No se toca configuración de Marcas ni se usa `revertir.sh` global. El integrador debe incorporar preparación y sello antes de su siguiente aplicación; no se afirma que ya los haya ejecutado.

El commit de esta entrega incorpora extra, arnés, pruebas, receta, recibos y ESTADO. No cambia los archivos certificados ni la estrategia de despliegue.

## Pendientes de Walter

Ninguno nuevo. Integración, preparación/sello y ejecución final corresponden al integrador. Se mantienen los pendientes humanos de la misión general y la necesidad de conciliar efectos externos antes de cualquier recuperación.
