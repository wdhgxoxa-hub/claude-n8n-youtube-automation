# Lote n8n certificado: aplicación y recuperación acotada

21-11-2026, Lima. Preparación inicial de solo lectura; el lote se aplicó y verificó a las 18:39, según [el cierre de ejecución](ejecucion-lote.md). Esta receta no acredita una recuperación remota posterior a PASS.

## Aplicación después de infraestructura PASS

El preflight y el CAS remoto del lote exacto pasan. Los 33 workflows y 28 publicaciones conservan los disparadores existentes. El export previo sigue vigente para contenido y versiones porque el CAS recién repetido coincide; las filas de negocio pueden crecer con la operación normal y se respaldan de nuevo bajo corte por el aplicador.

La secuencia final es **lote certificado → extra de horario Radar → extra de trabajadores Marcas simulados → copia final**. Cada extra conserva su ensayo y recibo separados; se prepara su CAS después de que la fase anterior termine. El estado histórico del lote —Radar con horario deshabilitado y Marcas inactivos— no describe el resultado tras los extras: Radar obtuvo PASS a las 18:45 y [Marcas a las 18:54](marcas/ejecucion.md). La copia final queda a cargo de la fase posterior.

```bash
ssh -i ~/.ssh/cooper_vps -o BatchMode=yes operador@144.91.88.253 \
  'sudo -n python3 -I -B /home/operador/total-integrador-20261121/aplicadores-certificados-b3e608e/ejecutar-bundle.py --control /home/operador/total-integrador-20261121/control-n8n-b3.json --sha256 dee9193c6ea88bf2229eef7c57867ec83c5cc153a9aa89a3381b6495e99b5089 --ejecutar'
```

Recibo seguro: `/var/lib/cooper-operacion/total-integrador-n8n-resultado.json`. El wrapper devuelve estado y SHA-256; no devuelve entorno ni el lote privado. El aplicador repite CAS antes del respaldo y con escritores detenidos; crea y restaura un snapshot restic antes de importar; verifica columnas, datos de negocio, workflows ajenos, nodos exactos y salud. Ante error posterior al respaldo, archiva el n8n fallido, restaura únicamente n8n desde `snapshot_previo` y vuelve a iniciar el stack. Mantiene el recibo `FALLO_REVERTIDO` si esa reversa pasa.

## Recuperación de n8n después de PASS

No usar `revertir.sh` ni `Operator.rollback()`: sus punteros globales pertenecen a otra fase. La reversa automática del lote ya está ensayada; no existe aquí un CLI separado certificado para su recuperación arbitraria posterior a PASS. Esta receta reutiliza las operaciones existentes y exige revisar el recibo exacto antes de ejecutarla. Orden inverso completo: **extra Marcas → extra Radar → lote n8n → infraestructura → Cooper**. Revertir únicamente las fases que se hayan aplicado, con sus recibos y CAS propios. El extra Marcas despublica sus dos IDs y conserva contenido/versión; los contadores oficiales pueden avanzar. La reversa del lote descrita a continuación exige que los extras posteriores ya estén conciliados.

1. Fijar el SHA-256 del recibo PASS y exigir que contiene la entrada `269d8f7c04981396d34ad266059da27f5e0ee34b8a4d2cf640040d3be7299588`, el manifiesto `805d80776fb32a9a09ca0cadec6bc2eb865b4ed892da9aee528ad194d3b49134` y un `snapshot_previo` hexadecimal. Acreditar que imagen/configuración siguen en la misma fase de infraestructura 2.47.6 y que no se aplicó un lote posterior.
2. Cargar `operar` y `aplicar-n8n-total` exclusivamente del bundle b3 por `ejecutar-bundle.py.bind(bundle, 'n8n')`; el wrapper fija solamente `operar.DEPLOY=/opt/cooper/deploy`. Verificar los hashes de sus 25 archivos, del control y sus cinco insumos antes de cargar. Consumir la configuración mediante `operar.config('/etc/cooper/.env')`, nunca abrir/imprimir el archivo desde la receta. Instanciar `Operator` con proyecto/rutas esperados y obtener **su** `op.lock()`; no anidar `flock` externo.
3. `restaurado = op.restore(recibo['snapshot_previo'], destino_nuevo)` restaura y valida el manifiesto completo antes de cortar. `aplicador.modulo_conservacion().validar_actual(restaurado / 'n8n/database.sqlite', diff)` debe acreditar el corte anterior; la variante `despues=True` sobre la base viva acredita que no hay otro lote. Registrar las huellas públicas del esquema, imágenes, release y versiones de todos los workflows, más el inventario de ejecuciones activas/esperas sin cuerpos.
4. Exigir ausencia de ejecuciones `new/running`. Revisar las ejecuciones y efectos ocurridos desde PASS; una copia no deshace envíos, publicaciones o cargos. Crear mantenimiento y llamar `desplazado = op.snapshot(resume=False, tag='reversion')`; este snapshot adicional preserva/restaura/verifica **todas** las escrituras actuales antes de retirarlas del árbol activo. Repetir CAS y comprobar escritores detenidos. Si cambiaron datos, esperas o efectos respecto al corte aceptado, conservar ambos estados y conciliar antes de reabrir.
5. Mover únicamente `op.data / 'n8n'` a un directorio privado nuevo en `op.state / ('n8n-desplazado-' + sello)`. Copiar `restaurado / 'n8n'` a `op.data / 'n8n'` con `shutil.copytree`, conservando SQLite y WAL completos; llamar `op.ownership()`. No mover ni restaurar Cooper, medios, Caddy, env, imágenes o punteros.
6. Antes de arrancar, verificar CAS anterior otra vez y comparar el inventario de n8n restaurado contra el del snapshot mediante `modulo_ensayo().inventory()`, incluidos todas las tablas/conteos y metadatos de workflows. Exigir los mismos archivos por huella del subárbol n8n. `op.compose('up', '-d', '--no-build', '--wait', '--wait-timeout', '180')` inicia la misma infraestructura sin forzar nuevas imágenes.
7. Verificar siete servicios saludables, referencia/ID de imagen, configuración y release sin cambios; workflows y horarios iguales al snapshot anterior; HTTPS y rechazo anónimo. Guardar recibo nuevo con snapshot anterior, snapshot de escritos desplazados, directorio archivado y resultado. Quitar mantenimiento solo al aprobar. Si falla después del corte, detener stack y conservar mantenimiento/ambos estados, sin borrar el archivo desplazado ni improvisar una reversa de infraestructura.

## Evidencia publicable sin datos privados

- `preparacion.json`: preflight/CAS nuevo, cantidades y estados de Radar, Aprendizaje y Marcas.
- `../export-cli.json`: hashes de exports oficiales previos, 45 workflows/29 publicados y cero divergencias borrador/publicación. Los JSON exportados continúan privados; no copiarlos a Git.
- `../lote-resumen.json`: cantidades y decisiones agregadas de conciliación; cero conflictos sin resolver.
- `../n8n-resoluciones.json`: identidades, tres hashes, elección y motivo de diez resoluciones explícitas; cuatro bloqueos de proveedor conservados y seis mejoras HTTP vidIQ. No contiene valores de credenciales.
- `../lote-ensayo.json`: 33 imports, 28 publicaciones, dos columnas aditivas, nueve tablas/146 filas históricas conservadas, reversa de 187 tablas y mismo SHA-256 del archivo anterior/restaurado, red `none`.
- `../final/preflight-n8n-b3.json`: 25 archivos certificados, hashes del control, entorno no consumido y sin mutaciones.
- Después de aplicar: copiar solo el recibo seguro filtrado a campos de estado, hashes, IDs, recuentos, columnas y garantías de preservación. No publicar entrada/diff privados ni salida cruda de n8n, configuración o bases.

Aprendizaje ya está activo y tiene horario habilitado. El extra Radar habilita exclusivamente su horario después de acreditar el permiso de texto API cerrado y las guardas vidIQ: solo saldo renovable incluido, sin compra, recarga ni consumo de addOn. Ese alcance permite cumplir el horario autorizado y no altera el lote certificado. El extra Marcas publica solo sus dos workers con proveedor simulado, interruptor habilitado y cola vacía, después de su ensayo local de reloj/HMAC y reversa. No se provoca una ejecución manual de negocio en el VPS para aceptar el despliegue; los horarios posteriores son parte del comportamiento autorizado.

Documentación oficial actual consultada: [CLI n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md), [API n8n](https://docs.n8n.io/connect/n8n-api.md). La publicación se hace individualmente por ID con la CLI; no se usan activaciones masivas.
