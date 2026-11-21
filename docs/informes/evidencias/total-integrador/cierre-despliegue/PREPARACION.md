# Preparación de despliegue — total-cierre

21-11-2026, 17:53 Lima. Este frente inspeccionó metadatos públicos del VPS y preparó un extra de código; no ejecutó configuración, actualización, respaldo nuevo ni reinicio. No leyó valores del entorno ni credenciales. El integrador conserva la ejecución después de aceptación y publicación Git.

## Corte acreditado

- Runtime: `localhost/cooper:b3e608eec138a03fce419a66954497b8fc2c50ea`; Docker ID `sha256:71f7a3894e4a7fd84b89fd228506ab8b4d9ac13bd0c5a872303a16abc0248508`; archivo SHA256 `9ea269e6746e197c5626ae04fa6835bbcf9eb18274d7d0192225582e8e493d20`.
- [Estado fresco](estado-previo.json): siete servicios saludables, Cooper/relé/release coherentes en cbf20685, b3 precargada, sin mantenimiento ni marcador Marcas. Entorno observado solo mediante `stat`: regular 0600, root, inode 262178. Ningún helper de actualización reemplaza ese archivo.
- [Arranque](arranque-preflight.json): Docker y Cooper stack habilitados; stack `active/exited`, timers monitor y backup `active/waiting`; boot actual `09888ee0-8210-490d-9df5-c3895ef2f2ef`. El operador instalado coincide con el SHA conocido `5331274f…`; su selección de imagen respeta `release.json`.
- Preflights nuevos: [app, 27 archivos](preflight-app.json), [infra, bundle de 25](preflight-infra.json), [copia, snapshot todavía null](preflight-copia.json). Todos PASS sin consumir entorno ni crear estado operativo.
- [Extra Marcas](stage-marcas.json): fuente e96eacf, SHA `e09f236662780c7b9d61951af4699f7ec5bd7dd180f72d5500786d020b2bffb0`, separado del bundle en `/home/operador/total-integrador-20261121/marcas-config-e96eacf/configurar-marcas-worker.py`. Sintaxis y SHA verificados; helper antiguo del bundle intacto.

## Orden posterior a aceptación y push

1. Revalidar condiciones frescas de Marcas: dos workers presentes/inactivos/sin versión publicada, cuentas/piezas/ingestas en cero, entorno propio 0600 y marcador ausente. Verificar el SHA del extra y ejecutar su CLI con `--habilitar-simuladas`. Solo anexa `COOPER_MARCAS_WORKER_SECRET`, `COOPER_MARCAS=simulada`, `COOPER_MARCAS_HABILITAR=1`; no publica workers ni redes. Su anexo **no tiene reversa automática**; puede conservarse tras revertir servicios. Los extras de activación de Radar y Marcas se ejecutarán por el frente n8n después del lote, según la coordinación posterior del integrador; no forman parte de esta fase app/infra.
2. Ejecutar precondición fresca `.cache/total-integrador/precondicion-app-b3.py`. Seguir exactamente [COMANDOS app](../../total-integrador-recuperacion-app/COMANDOS.md): crear estado nuevo; preparar; ejecutar actualizador certificado sobre el ID previo de la preparación; sellar ese resultado concreto. Exigir `SELLADO` antes de continuar. Siempre `python3 -B`; `PYTHONPATH` selecciona bundle, `--deploy` selecciona `/opt/cooper/deploy`.
3. Infra: wrapper `/home/operador/total-integrador-20261121/aplicadores-certificados-b3e608e/ejecutar-bundle.py`, control `/home/operador/total-integrador-20261121/control-infra-b3.json`, SHA literal `4fa6d2e28c448ab4eadde60405409c6a0a619447f71298efafe7f2337b5f7021`. Repetir preflight y luego añadir `--ejecutar`; exigir PASS y guardar el SHA del recibo `/var/lib/cooper-operacion/total-integrador-infra-resultado.json`. No agregar un flock exterior.
4. Aplicar lote n8n y luego los extras Radar y Marcas según los controles/CAS frescos revisados por ese frente. Ante divergencia detener esa fase y conciliar; nunca alterar los hashes para hacer pasar el lote.
5. Ejecutar `deploy/tests/produccion-publica.mjs` con artefactos nuevos. Cubre 22 rutas protegidas, seis APIs 401, entrada y rechazo a 1440/390 px, TLS/cabeceras, Google configurado, axe y video, sin OAuth ni mutaciones. No acredita una sesión Google privada. La sesión de Walter ya funcional no se fabrica ni exporta; solo puede revisarse si existe una superficie de navegador autorizada.
6. Copia final y réplica exacta, según receta siguiente; posteriormente reinicio coordinado y verificación del arranque automático.

## Copia final y réplica del mismo ID

Receta acreditada: `/home/david/.cache/total-integrador-producto-copia-final-b3e608e/REVISION.md`. El adaptador ya está preparado en VPS. Después de las fases aceptadas:

```sh
sudo -n python3 -I -B /home/operador/total-integrador-20261121/copia-final-b3e608e/copia-final.py \
  --control /home/operador/total-integrador-20261121/copia-final-b3e608e/control-final.json \
  --sha256 1169ec74653085cab3854bb3538e8eab762ff102386f13dc0d697fc892274669 --ejecutar
```

Exigir RC 0 y snapshot completo; guardar recibo público `/var/lib/cooper-operacion/total-integrador-copia-final.json`. El helper conserva contenedores/configuraciones/imágenes/versiones, hace snapshot sin poda, restaura y verifica todos los archivos y conteos, incluidos WAL/medios presentes, y comprueba el repositorio cifrado. Su salida pública contiene hashes y recuentos, nunca nombres de medios ni datos privados.

En PC, destino explícito acordado en continuidad:

```sh
python3 -B /home/david/.cache/total-integrador-producto-wrapper-b3e608e/bundle/deploy/replicar-pc.py \
  --destino /home/david/.cache/cooper-total-integrador-replica
```

Contraseña y binario preexistentes validados por metadatos, sin leer el secreto. La réplica restaura y compara el manifiesto completo antes de promover la generación. Comparar `snapshot` del recibo final contra `/home/david/.cache/cooper-total-integrador-replica/ultima-replica.json`; exigir igualdad y `restauracion:PASS` **antes** de registrar ese recibo por stdin en el helper remoto certificado `bundle/deploy/registrar-replica.py`. No usar `--confirmar-vps` automáticamente. El registro vence a los cinco minutos.

Si un timer crea otra copia más reciente, no declarar igualdad: restaurar explícitamente el ID final con restic y verificar con `operar.verify`, o repetir copia/réplica coordinadas con recibos nuevos. No reemplazar ni leer entornos. Las copias de datos no sustituyen los artefactos y la configuración pública conservados por separado.

## Reinicio final y recuperación

Receta operativa vigente: `docs/cooper-operacion.md`, apartado de reinicio real. Una vez cerradas las mutaciones n8n y con snapshot/réplica acreditados: tomar el lock compartido exclusivo sin espera, exigir ausencia de mantenimiento/ejecuciones activas y unidades habilitadas; registrar boot ID y huella de workflows (ID/versiones/activación, sin parámetros). Ejecutar `systemctl reboot` manteniendo el lock hasta el cierre SSH. No usar el helper antiguo `esperar-vps.py`, porque consulta root y otro flujo inicial de provisión.

Al volver, comprobar nuevo boot ID, siete servicios saludables, imagen b3 de Cooper y relés, infraestructura fijada por digest, stack `active/exited`, timers habilitados/activos y huella de workflows igual. No arrancar manualmente contenedores durante la comprobación. Repetir salud HTTPS/controles públicos y `python3 -B /opt/cooper/deploy/monitor.py --prueba`, que valida firma/transporte sin Telegram; conservar únicamente su resultado saneado. Los helpers, imagen y datos previos siguen disponibles.

Recuperación post-PASS: n8n con su recibo → extra infra con su recibo y CAS → extra app con el sello concreto. No usar `revertir.sh` global para deshacer `solo-cooper-*`. La reversa infra inmediata recupera la mezcla previa; una recreación posterior sin el override puede adoptar la imagen global en relés, por eso seguir la secuencia hasta recuperar app cuando corresponda. Conservar datos desplazados y cualquier mantenimiento si una recuperación falla.

## Fuentes oficiales consultadas en esta preparación

[Compose up](https://docs.docker.com/reference/cli/docker/compose/up/), [precedencia de interpolación](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/), [inspect por proyección](https://docs.docker.com/reference/cli/docker/inspect/), [restic restore por ID](https://restic.readthedocs.io/en/stable/050_restore.html), [SQLite WAL](https://www.sqlite.org/wal.html), [systemctl](https://www.freedesktop.org/software/systemd/man/latest/systemctl.html).
