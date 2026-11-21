# Actualizar únicamente Cooper en el VPS

Este procedimiento requiere una misión que autorice desplegar Cooper. No llama
a `operar.py actualizar`: esa operación administra todo el stack y detiene n8n
para obtener una copia conjunta. `deploy/actualizar-solo-cooper.py` limita el corte
a `cooper` y, cuando existe el túnel, `chat-cooper` (su relé en el mismo namespace
de red). Mantiene Caddy, n8n, runner y los otros dos relés en ejecución.

## Preparar y aplicar

1. Ejecutar la puerta completa, construir desde un archivo Git del commit exacto
   y etiquetar `localhost/cooper:<SHA completo>`. No empaquetar entornos, bases,
   sesiones ni cachés. Con Podman usar `build --format docker` para conservar
   `HEALTHCHECK`. Transportar el archivo de imagen y comparar SHA-256.
2. Cargar la imagen con `docker image load`. Consultar solo el ID de imagen de
   `cooper-cooper-1`, sin volcar `docker inspect` ni `docker compose config`.
3. Ejecutar en el VPS:

   ```bash
   sudo python3 /ruta/actualizar-solo-cooper.py \
     --imagen localhost/cooper:<SHA completo> \
     --anterior-id sha256:<ID observado de la imagen anterior>
   ```

   Docker consume `/etc/cooper/.env` mediante `--env-file`; el script no lee,
   imprime ni copia ese archivo. No se sustituyen los scripts de otros frentes
   en `/opt/cooper/deploy`.

4. El script toma `operacion.lock` sin esperar y rechaza mantenimiento ajeno o
   una imagen que haya cambiado desde la inspección. Conserva la configuración
   de Caddy y los metadatos de la versión anterior. Detiene solo Cooper y su
   relé, y copia su directorio de datos a un directorio 0700 del VPS.
5. Sobre copias separadas ensaya la imagen nueva y la restauración con la imagen
   anterior: red `none`, sin puertos, autenticación ficticia, salud SQLite,
   integridad, claves foráneas y conteos anteriores. No modifica la base viva
   durante el ensayo. Después inicia únicamente los servicios permitidos con
   `--no-deps --no-build --pull never` y comprueba HTTPS real.
6. Antes de registrar `release.json`, exige que IDs, imágenes y fechas de inicio
   de los servicios ajenos sigan idénticos y que Caddy conserve su hash.
   El recibo seguro queda en `solo-cooper-<fecha>/resultado.json`.

## Reversa

Si falla el corte, el script detiene únicamente Cooper y su relé, archiva todos
los datos del intento, restaura la copia fría, recupera la imagen anterior y
restablece `release.json`. Si no puede recuperar un Cooper saludable, conserva
la marca de mantenimiento. Nunca llama al rollback conjunto del stack.

El arranque de la imagen anterior sobre la copia restaurada se ensaya antes de
cada actualización. Esto acredita la reversa en un contenedor aislado; no se
presenta como una reversión deliberada de tráfico real.

Una reversa posterior a un despliegue exitoso exige otro corte exclusivo y
archivar primero la base actual. Conciliar los mensajes, recibos y actividad
posteriores antes de recuperar `respaldo/` y la imagen de `anterior.json`.
Conservar el directorio original del intento y no ejecutar la imagen vieja
contra un diario de migraciones nuevo.

## Aceptación pública sin OAuth

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/cooper/.cache/browsers" \
  node deploy/tests/produccion-publica.mjs
PLAYWRIGHT_BROWSERS_PATH="$PWD/cooper/.cache/sentinel-browsers" \
  ~/Proyectos/Sistema-Sentinel/codigo/.venv/bin/python \
  deploy/tests/sentinel-publico.py cooper/.cache/total-despliegue-aceptacion/sentinel
```

Playwright graba entrada y redirecciones de 21 rutas privadas a 1440 y 390 px,
verifica seis APIs anónimas, TLS, cabeceras, Google OIDC y accesibilidad.
Sentinel conserva su guardián y ejecuta recorridos/estabilidad de la entrada
pública con el host exacto permitido y acciones de autenticación excluidas.
No se crean sesiones administrativas ni se pulsa Google. Estos resultados no
acreditan el login real ni las pantallas privadas: requieren una sesión existente
autorizada o la aceptación manual de Walter.

Referencias consultadas: [Compose up](https://docs.docker.com/reference/cli/docker/compose/up/),
[carga de imágenes](https://docs.docker.com/reference/cli/docker/image/load/),
[SQLite Backup](https://www.sqlite.org/backup.html),
[Caddy](https://caddyserver.com/docs/command-line),
[Google Auth.js](https://authjs.dev/reference/core/providers/google) y
[videos Playwright](https://playwright.dev/docs/videos).
