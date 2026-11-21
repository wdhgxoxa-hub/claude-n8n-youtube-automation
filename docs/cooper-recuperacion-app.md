# Recuperación limitada de Cooper después de PASS

Este extra conserva el actualizador certificado, el bundle, Operator, infraestructura y la imagen. La secuencia prevista es: **Marcas bloqueado → preparación app → actualizador limitado → sello PASS app → infraestructura → lote n8n**. El extra no toca variables de Marcas. Se ejecuta como root, con los artefactos y hashes revisados por el integrador.

## Módulos y archivos

`recuperar-app.py` se entrega fuera del bundle cerrado. `PYTHONPATH` debe seleccionar **el deploy del bundle certificado**, y `--codigo` exige que ese sea el directorio del módulo `operar` realmente importado. Desde allí se carga `actualizar-solo-cooper.py`, sin modificarlo. `--infra-helper` señala el extra canónico `recuperar-infra.py`; este carga `aplicar-infra.py` junto al mismo Operator. `--deploy /opt/cooper/deploy` apunta solo a las configuraciones activas. No copiar el bundle encima del deploy del host ni usar por accidente su Operator antiguo.

Usar `python3 -B` en todas las invocaciones para impedir que las importaciones creen `__pycache__` dentro del bundle. Su verificador exige el inventario exacto de archivos; un directorio de bytecode adicional bloquearía infraestructura. No sustituir `-B` por `-I`, que omite el `PYTHONPATH` explícito requerido.

Verificar las huellas de [entrega](informes/evidencias/total-recuperacion-app/entrega.json), incluido el extra `32676c66f973f63eb8a6e0c8928847613283313a4a43744d79bf86f4f7c37f04`, antes de ejecutar. El helper no lee ni imprime el entorno directamente: el adaptador Operator existente lo consume en ejecución. No usar `cat`, `source`, inspecciones completas ni exportaciones de entorno.

Crear un directorio nuevo 0700 bajo `/var/lib/cooper-operacion` para los recibos del extra. Los nombres siguientes son ejemplos y sus SHA se sustituyen por los recibos concretos verificados, sin `latest`.

## Preparación y sello

Inmediatamente antes de actualizar Cooper:

```bash
PYTHONPATH=/RUTA/BUNDLE/deploy python3 -B /RUTA/EXTRA/recuperar-app.py \
  --codigo /RUTA/BUNDLE/deploy --deploy /opt/cooper/deploy \
  --infra-helper /RUTA/EXTRA/recuperar-infra.py preparar \
  --imagen localhost/cooper:b3e608eec138a03fce419a66954497b8fc2c50ea \
  --salida /var/lib/cooper-operacion/CIERRE/app-preparacion.json
```

La preparación exige siete servicios saludables, Cooper y su relé con la misma imagen anterior acreditada por la release, imagen nueva local, ausencia de mantenimiento y ejecuciones n8n ocupadas. Guarda configuración pública, identidades, código y CAS de workflows/esquema, sin valores de credenciales.

Ejecutar **el mismo actualizador certificado** con el ID anterior comprobado:

```bash
python3 -B /RUTA/BUNDLE/deploy/actualizar-solo-cooper.py \
  --imagen localhost/cooper:b3e608eec138a03fce419a66954497b8fc2c50ea \
  --anterior-id sha256:ID_ANTERIOR_VALIDADO
```

Solo si devuelve PASS, antes de infraestructura o cualquier otra fase:

```bash
PYTHONPATH=/RUTA/BUNDLE/deploy python3 -B /RUTA/EXTRA/recuperar-app.py \
  --codigo /RUTA/BUNDLE/deploy --deploy /opt/cooper/deploy \
  --infra-helper /RUTA/EXTRA/recuperar-infra.py sellar \
  --preparacion /var/lib/cooper-operacion/CIERRE/app-preparacion.json \
  --preparacion-sha256 SHA64_PREPARACION \
  --recibo /var/lib/cooper-operacion/solo-cooper-FECHA/resultado.json \
  --recibo-sha256 SHA64_PASS_SCOPED \
  --salida /var/lib/cooper-operacion/CIERRE/app-sello.json
```

El sello contrasta preparación, resultado, `anterior.json` específico, release, imágenes y cinco servicios ajenos. Rechaza cambios de código/configuración/fase entre preparación y sello. Verifica el respaldo frío completo y registra hashes, tamaños y modos de archivos/directorios, incluidos **WAL y medios**. Excluye únicamente `*-shm`, el índice recreable de SQLite. Los manifiestos completos y nombres de archivos quedan en recibos privados 0600. La salida de la CLI contiene solo estado y hash del recibo; publicar únicamente un resumen de estado, hashes y recuentos.

No se puede atribuir este sello retroactivamente a un despliegue sin preparación previa. Si una guarda falla después del PASS de aplicación, detener la secuencia y conservar los recibos; no inventar un sello ni avanzar a infraestructura.

## Recuperación posterior

Orden inverso: **conciliar/revertir lote n8n posterior → recuperar infraestructura → recuperar app**. Cada fase usa su contrato y recibo. El extra rechaza otra configuración, imagen, release o CAS n8n; no fuerza ni omite esos controles. Las imágenes de los otros cinco deben volver al corte app; sus IDs/horas pueden haber cambiado durante la reversa previa de infraestructura, pero deben permanecer idénticos durante esta recuperación limitada.

```bash
PYTHONPATH=/RUTA/BUNDLE/deploy python3 -B /RUTA/EXTRA/recuperar-app.py \
  --codigo /RUTA/BUNDLE/deploy --deploy /opt/cooper/deploy \
  --infra-helper /RUTA/EXTRA/recuperar-infra.py recuperar \
  --sello /var/lib/cooper-operacion/CIERRE/app-sello.json \
  --sello-sha256 SHA64_SELLO \
  --salida /var/lib/cooper-operacion/CIERRE/app-recuperacion-NUEVA.json
```

Bajo el lock compartido restaura y verifica primero una copia del respaldo. Después detiene solamente `chat-cooper`/`cooper`, repite las guardas y archiva todo el directorio de datos posterior con manifiesto completo. Restituye la copia íntegra, propiedad de datos y release previa; arranca solo esos dos servicios con `--no-deps --no-build --pull never`. Comprueba salud, imágenes anteriores, tablas/migraciones, configuración/CAS y los cinco IDs/imágenes/StartedAt intactos. No usa ni cambia `anterior.json` global y nunca llama a `revertir.sh`.

Si falla tras el corte, conserva mantenimiento, datos desplazados y copia previa; detiene únicamente Cooper y su relé. No borrar el marcador para reintentar. Conciliar escrituras posteriores antes de devolverlas al producto; recuperar archivos no deshace mensajes ni efectos externos.

La aceptación acredita el extra sobre siete contenedores Podman locales, con adaptación declarada de namespaces/transporte, b3/cbf, 1 GiB/swap0 y datos ficticios. No acredita ejecución remota ni reboot. [Informe, límites y recibos](informes/total-recuperacion-app.md).

Fuentes oficiales consultadas el 21-11-2026: [Compose up](https://docs.docker.com/reference/cli/docker/compose/up/) y [SQLite WAL](https://www.sqlite.org/wal.html).
