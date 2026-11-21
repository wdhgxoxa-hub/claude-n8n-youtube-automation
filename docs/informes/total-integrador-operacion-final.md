# Aceptación operativa de la imagen integrada final

21-11-2026, Lima. La aceptación vigente corresponde a la fuente **`e942dc9eab05242f7967d1c7c8631a3e3171d6da`**, que incluye la corrección de IDs ARIA de Biblia. La imagen `e1244bd` queda como antecedente: su ensayo uniforme no cubría los relés con imágenes distintas y ya no representa el código final.

Este subfrente trabajó en ramas y checkouts propios, con CPU 16–23 y fixtures privados bajo `~/.cache`. No ejecutó SSH ni cambió el VPS. El integrador consolida `docs/ESTADO.md`, la puerta completa, Sentinel y el estado del despliegue.

## Imagen final y código exactos

- Etiqueta: `localhost/cooper:e942dc9eab05242f7967d1c7c8631a3e3171d6da`.
- ID de configuración Podman: `a8deb319d1c3913162719f0ed3af3152a249caf65feca185817e3d432ee70261`.
- Archivo: `/home/david/.cache/cooper-ti-operacion-e942/cooper-e942dc9.tar.gz`, **269 557 889 bytes**.
- SHA256 del archivo comprimido: **`b64e0934ef6038c5207e0574c8c30542ae3810051ca977a8f393dbfa4bd5bad2`**.
- Construcción `podman build --format docker --cpuset-cpus 16-23`: salida 0, cero errores y advertencias, HEALTHCHECK conservado. Guardado en formato Docker archive y compresión determinista `gzip -n -6`; se acreditó la identidad sobre ese mismo archivo comprimido.
- Aplicador de `f3750dcced95e202f9141d53b01cc5df6edd78fe`: `aplicar-infra.py` SHA256 `d9b8a8faec7ff1b4658dc25f941595778951338698e7d035d26dae96e85dab2c`; `operar.py` SHA256 `0a42c6f610ebca5afd2eaa93e5c695a0f9d5fbdaa55482a889543177ed447a56`.
- Arnés ensayado: SHA256 `62dd8acb8848cf74f51764ce1cc8c34b546ceef761967541665013c0af653de5`.

Docker documenta la carga de archivos gzip con `docker image load`: [referencia oficial consultada](https://docs.docker.com/reference/cli/docker/image/load/). El ID del motor Docker puede diferir del ID de configuración Podman; el aplicador acredita la cadena de identidad del archivo y la imagen en vez de equipararlos por suposición.

[Identidad y procedencia](evidencias/total-integrador-operacion-e942/imagen.json), [código probado](evidencias/total-integrador-operacion-e942/codigo-aplicador.json).

## Pruebas y reversa con imágenes distintas

| Prueba | Resultado |
| --- | --- |
| Migración de Cooper desde copia inicial `cbf20685` | **11→14 PASS**, integridad y claves foráneas PASS, 27 tablas anteriores conservadas; reversa de bytes y arranque anterior PASS. |
| Compose con la imagen e942 | **8/8 PASS**, salida 0: TLS, autenticación ficticia, JPEG/reel y HMAC, runner n8n, SSE, restic/restauración, exportación/importación y actualización/reversa conjunta. |
| Regresiones operativas | **185/185 PASS** con `python3 -W error`. |
| Estado inicial del ensayo mixto | Siete servicios saludables; Cooper y `chat-cooper` usan e942, `chat-n8n` y `chat-runner` usan `cbf20685`; n8n/runner 2.47.4 y Caddy 2.11.2. |
| Fallo inyectado después del arranque nuevo | **FALLO_REVERTIDO / PASS**; restauración de archivos y datos, marcador de mantenimiento retirado y **los siete IDs de imagen exactamente iguales a los iniciales**. |
| Segunda aplicación del mismo candidato | **PASS**, salud y datos conservados; n8n/runner 2.47.6 y Caddy 2.11.8; los tres relés adoptan e942. |
| Cierre del proceso mixto | **Salida 0, stderr vacío y limpieza de contenedores terminada**. |

El aplicador conserva una referencia pública de imagen por servicio, la acredita antes del corte y vuelve a comprobarla antes de la reversa. El override de reversa se añade al final y usa `--pull never`; así recupera también los relés que todavía utilizaban la imagen anterior. El arnés retira sus pins iniciales antes de aplicar para que no oculten el defecto original.

Recibos: [migración](evidencias/total-integrador-operacion-e942/migracion.json), [ocho bloques Compose](evidencias/total-integrador-operacion-e942/compose.log), [aceptación ligada al archivo exacto](evidencias/total-integrador-operacion-e942/infra-aceptacion.json), [ensayo mixto y siete identidades](evidencias/total-integrador-operacion-e942/infra-aplicador.json), [185 regresiones](evidencias/total-integrador-operacion-e942/operacion-tests.log), [índice y hashes](evidencias/total-integrador-operacion-e942/indice.json).

El recibo de aceptación tiene SHA256 `b3b2b7e63243a27be77db837c4961a69beff6873533a6d2cf39e8a1c7a5b8904`; el resultado mixto, `a35fa574b7efdc47cc384760b9de94f151e02e0b7b087357651f929cbaa2471f`. El fixture final es `/home/david/.cache/tiop-e942/cooper/.cache/e2e-vps-rFjwUS`; sus recibos detallados permanecen en `aceptacion-infra-1795293268098720119`.

## Adaptación exclusiva del laboratorio Podman

Los relés comparten el namespace de red de sus padres como en la configuración operativa. En rootless, runc no puede montar el sysfs de ese namespace: el arnés monta un `/sys` vacío de solo lectura, sin privilegios ni sysfs del host. Usa un directorio de socket ficticio vacío y una clave efímera solo en memoria del proceso; la salud se comprueba mediante el rechazo HTTP real del relé, sin conectar proveedores.

Podman también exige retirar dependientes de namespace antes de recrear sus padres. El arnés adapta ese orden **solo** en un proyecto aleatorio de laboratorio, ligado a loopback y validado con `COOPER_LAB=1`: antes de `up --force-recreate` de Cooper/n8n/runner comprueba que los tres relés estén detenidos y los retira; en `down` los detiene, comprueba y retira primero. Mantiene la red, todos los argumentos y `image_overrides`. No modifica los helpers de producción, las comprobaciones previas, `healthy`, los respaldos, la restauración ni las comparaciones de siete IDs.

Esto acredita el aplicador exacto y sus resultados con servicios reales en Podman. **No acredita el detalle de orden de eliminación del backend Docker remoto**. La comprobación del entorno Docker pertenece al integrador.

Los intentos anteriores con e124 se conservan y no se presentan como aprobados: uno falló antes de aplicar por sysfs; dos llegaron al respaldo pero el backend rechazó recrear los padres con dependientes existentes. Sus directorios y hashes constan en [intentos de laboratorio](evidencias/total-integrador-operacion-e942/intentos-laboratorio.json). El ensayo uniforme e124 y sus 167 pruebas siguen disponibles en [la evidencia histórica](evidencias/total-integrador-operacion-final/indice.json).

## Motor reutilizado y alcance

La aceptación previa del motor 2.47.4→2.47.6 conserva **45 workflows, nueve tablas/130 filas, 342→342 migraciones**, idempotencia y reversa PASS. Siete archivos de motor/configuración son idénticos entre `a794037` y e942, incluido el módulo transitivo `esquema-n8n.py`. Las funciones `require`, `digest` y `write_json` utilizadas de `operar.py` también son idénticas por AST. El cambio de `Operator.compose` añade el override de reversa por servicio y se ensayó aquí. Los hashes quedan registrados en la procedencia; no se afirma que todo `operar.py` sea idéntico ni que se haya repetido el ensayo anterior de motor.

Esta aceptación es **local y probada**. No publica datos de negocio, entornos ni claves. No ejecutó OAuth, pagos, publicaciones ni cambios remotos. La puerta completa de Cooper, Sentinel, videos y despliegue pertenecen al integrador y no se atribuyen a este subfrente.

## Commits

- `0fcd883`: evidencia histórica e124 y aplicador uniforme.
- `a871da8`, reproducido como `2d5ef00` sobre e942: ensayo con relés de imágenes distintas.
- `1b300f8`: adaptación del orden de dependencias de namespace únicamente en el arnés Podman.
- Este cierre documental se identifica con `git log -1 -- docs/informes/total-integrador-operacion-final.md`.

## Pendientes de Walter

1. Ninguno nuevo en este alcance local. Permanecen los pendientes de aceptación y operación del informe del integrador.
