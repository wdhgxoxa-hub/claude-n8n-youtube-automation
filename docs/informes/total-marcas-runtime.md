# cooper-total — runtime de Marcas (H09)

Frente `total-marcas-runtime`, base `b03291a`. Actualizado el 21-11-2026, 11:38 Lima. El runtime está implementado, integrado y probado en la imagen definitiva `970d1025ccdc6ac4b9898a4baa8608ad732dcdf2`; el despliegue VPS queda a cargo del orquestador tras las dos rondas finales. No se activaron proveedores, relojes ni publicaciones reales.

## Commits y cambios

- `20f65eb`, integrado como `85a4f3c`: la etapa de ejecución instala FFmpeg/FFprobe, Fontconfig y DejaVu Sans/Serif. Compose pasa modo Marcas, versión Meta y referencias de configuración únicamente a Cooper; n8n/runner reciben el secreto dedicado, origen e interruptor del worker. La lista permitida del runner contiene esos tres nombres.
- Los valores iniciales mantienen `COOPER_MARCAS=simulada` y `COOPER_MARCAS_HABILITAR=0`. Los tokens de Meta/Upload-Post no entran al runner. Sin secreto dedicado el receptor devuelve 503; poner el secreto no publica los flujos ni cambia el modo.
- La aceptación Compose utiliza la misma imagen candidata, redes sin salida, cuentas/sesión y medios ficticios. Prepara JPEG y reel mezclando una foto y un clip de tono sintético; valida resolución, duración, audio audible, HMAC válido/inválido/caducado y reinicio de Cooper conservando la revisión. Ninguna pieza recibe aprobación.
- `2fd1ae0`: instalador de secreto dedicado con anexo de escritura exclusiva, candado de operación, comprobación de trabajadores inactivos y conteos Marcas vacíos, marcador idempotente y detención tras cortes. No abre el entorno para lectura. Nueve pruebas cubren estas condiciones; **no se ejecutó en VPS**. [Procedimiento](../cooper-marcas-worker-configuracion.md).
- `25be660`: la restauración compara el total real de adjuntos previo a la copia. El primer ensayo pasó Marcas pero detectó que el test histórico esperaba un único adjunto; ahora hay cuatro por los medios sintéticos. Se corrigió el arnés y se repitió completo; no hubo cambio de producto ni de imagen.

## Pruebas

- 78 pruebas Python del frente pasan con `-W error`; Compose se resuelve exclusivamente con `.env.example` y valores ficticios, sin advertencias. Incluyen propagación/aislamiento de variables, valores iniciales bloqueados e instalador write-only. [Log](evidencias/total-marcas-runtime/python-worker.log).
- `node --check` pasa para el arnés Compose y `marcas-runtime.mjs`; `git diff --check` pasa.
- El orquestador confirmó la puerta integral del SHA congelado: `npm ci`, lint, typecheck, 322 unitarias, 49 E2E, build, 167 pruebas de flujos y 70 Python de despliegue; cero errores/advertencias. Este frente no repitió navegadores: compiló la imagen exacta y ejecutó aceptación aislada adicional.
- Ocho bloques Compose pasan: TLS y editor privado; login ficticio; Marcas; runner/firma/SSE; reconexiones; restic cifrado/restauración; importación en volumen vacío; actualización y reversa conjunta. [Log final](evidencias/total-marcas-runtime/compose-final.log). La configuración del arnés añade únicamente la corrección `25be660` al SHA congelado.
- JPEG real, reel MP4 720×1280 de 4,024 segundos, audio estéreo a 48 kHz y pico audible, HMAC válido/inválido/caducado y reinicio con las mismas piezas pendientes pasan sobre la imagen final. Cero publicaciones. [Recibo](evidencias/total-marcas-runtime/marcas-runtime.json). Medios sintéticos conservados en `/home/david/.cache/cooper-970d102/cooper/.cache/e2e-vps-CWkLZn/`.
- Copia SQLite real restaurada: migración 8→11, conservación de las 21 tablas previas, integridad/claves foráneas y arranque de reversa con la imagen anterior `05d8337`: PASS, sin red ni puertos. [Recibo](evidencias/total-marcas-runtime/migracion.json).

## Artefacto final

- Imagen: `localhost/cooper:970d1025ccdc6ac4b9898a4baa8608ad732dcdf2`; ID `e4ee909a0458156bc1c421482fb0c9f898ebeb1a8d72f0eff94263a5ddd01379`. Build sin errores ni advertencias. [Log](evidencias/total-marcas-runtime/build.log).
- Archivo local: `/home/david/Proyectos/cooper-wt/total-marcas-runtime/cooper/.cache/aceptacion-final/cooper-970d1025ccdc6ac4b9898a4baa8608ad732dcdf2.tar.gz`, 296.860.164 bytes. SHA256 `25b6ec2a4f06b91eb7b12bb1439aa8775019041eb4390394d5b6ddd79bf25752`. [Metadatos](evidencias/total-marcas-runtime/artefacto.json).
- No sobrescribir los scripts de despliegue actuales del VPS con versiones antiguas: la aplicación está congelada, mientras los instaladores y evidencias pueden avanzar de forma independiente.

## Límites y Pendientes de Walter

1. El runtime permite preparar vistas previas; no proporciona activos, permisos de Meta, perfiles Upload-Post, tokens ni aprobación humana. Esas decisiones siguen bajo control de Walter.
2. Los dos relojes Marcas permanecen inactivos y bloqueados por el interruptor 0. La configuración privada del secreto mediante `2fd1ae0` queda pendiente del turno operativo del orquestador; es una tarea técnica autorizada, no una decisión pendiente de Walter.
3. El ensayo sintético no comprueba publicación ni métricas de cuentas reales. Las piezas del ensayo quedan pendientes y se eliminan con su proyecto aislado.

Documentación oficial consultada: [FFmpeg](https://ffmpeg.org/ffmpeg.html), [variables de entorno Compose](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/) y [runners externos n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/set-up-task-runners.md).
