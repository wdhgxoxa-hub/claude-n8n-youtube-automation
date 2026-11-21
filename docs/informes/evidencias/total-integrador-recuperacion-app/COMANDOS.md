# Extra de recuperación app b3

Solo el integrador ejecuta estos pasos en el VPS. Este paquete no contiene ni reemplaza el bundle de 25 archivos. El helper conserva el SHA probado por el frente. No se ha ejecutado ninguno de estos pasos remotos durante su preparación local.

## Preflight público antes de crear estado operativo

Extraer el tar bajo `/home/operador/total-integrador-20261121`. Este bloque lee exclusivamente código público y su manifiesto. No importa Operator, consume `.env` ni crea un directorio de estado.

```bash
set -eu
sha256sum -c <<'SHA'
32676c66f973f63eb8a6e0c8928847613283313a4a43744d79bf86f4f7c37f04  /home/operador/total-integrador-20261121/recuperacion-app-b3/recuperar-app.py
787c89cbd01b08ddd974e612f49016b5169b85b634f90339a41c7a4b26e69c06  /home/operador/total-integrador-20261121/recuperacion-app-b3/preflight.py
c2e09b6a3cfed67c3304ad615562ae6abca210902865d01cc2c66daed7d254f5  /home/operador/total-integrador-20261121/recuperacion-app-b3/codigo.json
SHA
python3 -B /home/operador/total-integrador-20261121/recuperacion-app-b3/preflight.py c2e09b6a3cfed67c3304ad615562ae6abca210902865d01cc2c66daed7d254f5
```

Resultado esperado: `PREFLIGHT_PASS`, 27 archivos públicos (25 del bundle + extra app + extra infra), `entorno_consumido=false`, `estado_operativo_creado=false`, `mutaciones=false`. Verifica también que el directorio importable del bundle no tenga archivos adicionales.

## Secuencia como root después de la aceptación y el push

Repetir el preflight público antes de cada fase. El integrador conserva sus controles de root, motor Docker/proyecto cooper, rutas fijas, imágenes/release, siete servicios saludables y ausencia de mantenimiento. Configurar primero Marcas en modo bloqueado. No mantener un `flock` exterior: cada CLI toma el mismo bloqueo operativo por sí misma. `python3 -B` es obligatorio para no crear bytecode en el bundle; no usar `-I`.

Crear una carpeta nueva (si existe, detener y revisar; no reutilizar recibos):

```bash
set -eu
umask 077
test "$(id -u)" = 0
mkdir -m 700 /var/lib/cooper-operacion/total-integrador-app-b3
```

Preparar, inmediatamente antes del actualizador:

```bash
PYTHONPATH=/home/operador/total-integrador-20261121/aplicadores-certificados-b3e608e/bundle/deploy python3 -B /home/operador/total-integrador-20261121/recuperacion-app-b3/recuperar-app.py \
  --codigo /home/operador/total-integrador-20261121/aplicadores-certificados-b3e608e/bundle/deploy \
  --deploy /opt/cooper/deploy --env /etc/cooper/.env \
  --infra-helper /home/operador/total-integrador-20261121/recuperacion-infra-b3/recuperar-infra.py \
  preparar --imagen localhost/cooper:b3e608eec138a03fce419a66954497b8fc2c50ea \
  --salida /var/lib/cooper-operacion/total-integrador-app-b3/preparacion.json
```

Leer solo la identidad pública ya acreditada en ese recibo y actualizar con el helper certificado. Su salida completa queda privada; no se imprime el recibo ni se selecciona `latest`.

```bash
app_previous_id=$(python3 -B -c 'import json,re,sys; d=json.load(open(sys.argv[1])); assert d["estado"]=="PREPARADO" and re.fullmatch("sha256:[a-f0-9]{64}",d["anterior_id"]); print(d["anterior_id"])' /var/lib/cooper-operacion/total-integrador-app-b3/preparacion.json)
python3 -B /home/operador/total-integrador-20261121/aplicadores-certificados-b3e608e/bundle/deploy/actualizar-solo-cooper.py \
  --imagen localhost/cooper:b3e608eec138a03fce419a66954497b8fc2c50ea \
  --anterior-id "$app_previous_id" \
  > /var/lib/cooper-operacion/total-integrador-app-b3/actualizador-salida.json
```

Solo después de su salida 0/PASS: obtener la ruta exacta del resultado de esa invocación y sus huellas. Estos comandos procesan recibos privados internamente y emiten únicamente ruta/hash; no leen valores del entorno.

```bash
app_scoped_receipt=$(python3 -B -c 'import json,re,sys; from pathlib import Path; d=json.load(open(sys.argv[1])); assert d["resultado"]=="PASS"; p=Path(d["respaldo"]).parent/"resultado.json"; assert p.parent.parent==Path("/var/lib/cooper-operacion") and re.fullmatch("solo-cooper-[0-9]{8}T[0-9]{6}Z",p.parent.name) and p.is_file() and not p.is_symlink(); print(p)' /var/lib/cooper-operacion/total-integrador-app-b3/actualizador-salida.json)
app_preparation_sha=$(sha256sum /var/lib/cooper-operacion/total-integrador-app-b3/preparacion.json | cut -d ' ' -f 1)
app_scoped_sha=$(sha256sum "$app_scoped_receipt" | cut -d ' ' -f 1)
PYTHONPATH=/home/operador/total-integrador-20261121/aplicadores-certificados-b3e608e/bundle/deploy python3 -B /home/operador/total-integrador-20261121/recuperacion-app-b3/recuperar-app.py \
  --codigo /home/operador/total-integrador-20261121/aplicadores-certificados-b3e608e/bundle/deploy \
  --deploy /opt/cooper/deploy --env /etc/cooper/.env \
  --infra-helper /home/operador/total-integrador-20261121/recuperacion-infra-b3/recuperar-infra.py \
  sellar --preparacion /var/lib/cooper-operacion/total-integrador-app-b3/preparacion.json \
  --preparacion-sha256 "$app_preparation_sha" --recibo "$app_scoped_receipt" \
  --recibo-sha256 "$app_scoped_sha" \
  --salida /var/lib/cooper-operacion/total-integrador-app-b3/sello.json
```

Exigir `SELLADO` antes de avanzar a infra → n8n → aceptación pública → copia final → réplica. Si falla el sello, detener esa secuencia y conservar los recibos. No sellar otra fase ni regenerar una preparación retroactiva.

## Recuperación posterior, únicamente si corresponde

Antes de app: conciliar/revertir el lote n8n y recuperar infraestructura con sus propios contratos. Solo entonces la configuración/CAS del sello de app vuelve a ser admisible. No se recupera n8n ni infraestructura desde este extra.

```bash
app_seal_sha=$(sha256sum /var/lib/cooper-operacion/total-integrador-app-b3/sello.json | cut -d ' ' -f 1)
PYTHONPATH=/home/operador/total-integrador-20261121/aplicadores-certificados-b3e608e/bundle/deploy python3 -B /home/operador/total-integrador-20261121/recuperacion-app-b3/recuperar-app.py \
  --codigo /home/operador/total-integrador-20261121/aplicadores-certificados-b3e608e/bundle/deploy \
  --deploy /opt/cooper/deploy --env /etc/cooper/.env \
  --infra-helper /home/operador/total-integrador-20261121/recuperacion-infra-b3/recuperar-infra.py \
  recuperar --sello /var/lib/cooper-operacion/total-integrador-app-b3/sello.json \
  --sello-sha256 "$app_seal_sha" \
  --salida /var/lib/cooper-operacion/total-integrador-app-b3/recuperacion.json
```

La salida exige un nombre nuevo. No eliminar mantenimiento para reintentar automáticamente un fallo. Archivar/restaurar datos no revierte efectos externos; conservar y conciliar las escrituras desplazadas.
