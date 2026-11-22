# Conexión SSE: diagnóstico y cambio revisable de infraestructura

21-11-2026, Lima. Misión `diseno-conexion`. **Preparado y probado localmente; no aplicado al VPS.** Los archivos `deploy/Caddyfile`, `deploy/compose.yaml` y `deploy/compose.chat.yaml` siguen intactos. No se abrió una sesión OAuth, no se leyó ningún `.env` real y no se consultaron claves, cookies ni tokens de producción.

## Qué se comprobó

La [sonda pública](publico.json) hizo únicamente cinco GET sin autenticación, conservó una lista cerrada de cabeceras y descartó los cuerpos. Salud y entrada responden 200; `/` redirige a `/entrar`; `/api/eventos` y `/api/estado` responden 401 en aproximadamente 0,6 segundos. El salto público declara Caddy. No apareció compresión en estas solicitudes con `Accept-Encoding: identity`.

Esto prueba disponibilidad pública y protección de la sesión, **no reproduce el incidente de una sesión privada**. El navegador conectado no estaba disponible y no se inició OAuth. No se atribuyen a producción los tiempos ni las condiciones del laboratorio. La [lectura posterior por SSH](vps-lectura.json), mediante el acceso ya documentado y sin interacción, sí confirmó la imagen/digest, el montaje y la huella exacta del Caddyfile. También comprobó únicamente los valores escalares de la ruta activa de Cooper: `flush_interval -1`, cierre 300 s, conexión 5 s, cabeceras 35 s y destino `cooper:3000`. Coinciden con el ensayo y Caddy estaba saludable. No se leyeron variables de entorno reales, secretos ni logs; no se recargó, reinició ni modificó ningún servicio.

La causa de código que sí se reproduce es la espera de la primera sincronización de fábrica antes del primer byte SSE. El transporte de Next instalado solo vacía las cabeceras al escribir el primer chunk. El proxy espera 35 segundos por esas cabeceras. El adaptador n8n tiene tres intentos de hasta diez segundos, backoff y serialización por dueño; varias pestañas pueden añadir espera en cola. Un backend lento puede mantener «Conectando» y llegar a vencer el plazo del proxy aunque el servidor web esté sano.

El [ensayo ejecutable](../../../../../deploy/tests/sse-conexion.mjs) usa la imagen Caddy fijada por digest en el repositorio y el transporte/compresión de la versión Next instalada. Adapta el Caddyfile original y su candidato, toma de cada uno la ruta real de Cooper y cambia exclusivamente el destino a un origen sintético loopback y el listener a un puerto libre HTTP. No usa Google, n8n, bases de datos ni relés reales. El JSON de configuración conserva `flush_interval -1`, `response_header_timeout 35s` y los handlers del proxy.

Resultados y tiempos exactos: [ensayo-proxy.json](ensayo-proxy.json).

- Antes: primer estado retenido 37 segundos, sin latido inicial; Caddy devuelve **504 alrededor de 35 segundos**, sin evento recibido.
- Después: latido inmediato y cada 15 segundos mientras el estado demora 37 segundos; **200**, primer evento en menos de un segundo y estado recibido después de superar el timeout de cabeceras. No se aumentó ese timeout.
- Contraprueba: el Caddyfile original y gzip entregan un latido inmediato. Next hace `flush()` por chunk; **no se reprodujo buffering por gzip como causa aislada**.
- Seis conexiones/cierres sucesivos reciben 200 y dejan cero cupos abiertos en el origen sintético. No se reprodujo fuga por `flush_interval -1`; se conserva.
- El parche impide compresión en las dos rutas SSE; una respuesta común continúa usando gzip. Parche y reversa restauran el Caddyfile byte a byte; la combinación Compose solo cambia un montaje y su reversa lo restituye.

## Separación de componentes

| Componente | Evidencia y decisión |
| --- | --- |
| Primer byte SSE | La ruta anterior esperó a la fábrica. El cambio de aplicación separa latidos/lectura local de la conciliación remota y añade `no-transform`. Es la corrección funcional. |
| Buffering de Caddy | Ya tiene `flush_interval -1`; no contiene `encode` ni `response_buffers`. Se conserva. `X-Accel-Buffering` es una indicación de otros proxies, no el control de Caddy. |
| Tiempo de espera | `response_header_timeout 35s` limita cabeceras iniciales, no toda la respuesta. `idle 2m` limita la espera de otra petición keepalive. No se aumentan. |
| Sesión | `/api/eventos` y `/api/estado` sin sesión dan 401. La aplicación revalida usuario, rol y suspensión; las sesiones Auth.js duran 24 horas. No se reutilizaron ni fabricaron sesiones productivas. |
| Relés del plan | `compose.chat.yaml` y `servicios/puente-codex/tunel.mjs` restringen el relé a salud y POST de chat/texto. `/api/eventos` llega de Caddy directamente a Cooper; el adaptador de fábrica llama a n8n por red interna. La caída del relé puede afectar al chat, pero no transporta el SSE de fábrica. No se cambian relés. |
| Compose | No hay un timeout SSE de Compose que corregir. El overlay permite revisar/aplicar únicamente el Caddyfile candidato, sin cambiar imágenes, puertos, redes, salud, memoria ni otros servicios. |

## Parche y reversa para Claude

Archivos públicos:

- [caddy.patch](caddy.patch): añade un matcher para `/api/eventos` y `/api/chat` y fuerza `Accept-Encoding: identity` hacia Cooper. Defensa específica complementaria a `no-transform`, no sustituto de la corrección del servidor ni causa productiva confirmada. También afecta las respuestas JSON de `/api/chat`; las demás rutas conservan compresión.
- [caddy-reversa.patch](caddy-reversa.patch): deshace exactamente ese cambio.
- [compose.sse.yaml](compose.sse.yaml): sustituye solo el bind mount `/etc/caddy/Caddyfile` por la ruta absoluta pública `COOPER_CADDY_SSE_CANDIDATO`.
- [compose.sse-reversa.yaml](compose.sse-reversa.yaml): restituye el montaje público anterior mediante `COOPER_CADDY_SSE_ANTERIOR`. Se coloca después del overlay candidato, conservando los demás overlays vigentes.
- [huellas-base.json](huellas-base.json): identidades SHA-256 de los tres archivos base y del Caddyfile candidato. Son huellas del repositorio; `vps-lectura.json` acredita su igualdad con el archivo efectivo y montado el 21-11-2026 a las 22:24–22:25 Lima. Deben volver a cotejarse al aplicar el cambio.

Preparación local sin leer configuración privada:

```bash
node deploy/tests/sse-conexion.mjs
```

Requiere Node y dependencias de `cooper/`, Podman, Docker Compose y la imagen Caddy fijada ya disponible. Usa `--pull=never`, puertos loopback, directorio exclusivo en `cooper/.cache/diseno-conexion-infra/`, variables ficticias y `--env-file /dev/null`; no descarga imágenes. Los contenedores propios se eliminan al finalizar. El ensayo tarda aproximadamente 40 segundos. No ejecuta `compose up` ni toca el proyecto Compose instalado.

Secuencia propuesta al operador, **solo cuando Claude ordene aplicarla**:

1. Identificar la release y la invocación Compose vigentes, incluidos todos sus overlays. Comparar el Caddyfile efectivo con la huella base; si difiere, revisar un nuevo diff sin sobrescribir modificaciones ajenas. Conservar una copia pública exacta de la configuración previa. No exportar el modelo Compose interpolado, `.env`, cookies ni logs privados.
2. Preparar una copia candidata de `deploy/Caddyfile` aplicando `caddy.patch` en un árbol aislado. Validarla con `caddy adapt`/`caddy validate` usando la versión fijada y comprobar los bloqueos de n8n. No instalar una nueva versión de Caddy.
3. Elegir **una** modalidad: actualizar el Caddyfile canónico mediante el parche, o añadir el overlay candidato a la invocación operativa existente. Si se elige el overlay, registrarlo en el mecanismo de arranque/actualización existente; un cambio temporal de comando no garantiza persistencia. No reemplazar overlays previos ni usar `compose down`.
4. Usar la invocación Compose aprobada para recrear **solo `caddy`**, con `up -d --no-deps --no-build --force-recreate caddy`. El nuevo montaje requiere recreación; una recarga de configuración no cambia un bind mount. Esa acción corta brevemente las conexiones del proxy, incluidas las ajenas a Cooper; coordinar la ventana y observar la reconexión automática. No recrear n8n, runner o relés.
5. Comprobar salud, entrada y 401 sin sesión. Con una sesión legítima ya abierta, observar `/api/eventos`: 200, `text/event-stream`, `private, no-store, no-transform`, sin `Content-Encoding`, primer latido inmediato, nuevos latidos cada 15 segundos, estado que continúa durante una consulta lenta y recuperación tras una interrupción local del navegador. La interfaz debe permanecer silenciosa estando sana y mostrar «Sin conexión, reintentando» únicamente tras más de cinco segundos de corte.

Reversa: para la modalidad canónica, aplicar `caddy-reversa.patch` solo sobre el candidato exacto y recrear únicamente Caddy. Para la modalidad overlay, retirar solo el overlay de esta misión o añadir `compose.sse-reversa.yaml` al final apuntando al archivo previo exacto, registrar la misma elección en el arranque operativo y recrear únicamente Caddy. Comprobar salud/protecciones de nuevo. No restaurar bases, cambiar imágenes, reiniciar la fábrica ni alterar secretos. La reversa de infraestructura no deshace los cambios de aplicación y no exige revertir datos.

## Fuentes oficiales consultadas el 21-11-2026

- [Caddy reverse_proxy: streaming y transporte](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy): flush inmediato para SSE, significado de espera de cabeceras y opciones de stream.
- [Caddy API](https://caddyserver.com/docs/api): lectura GET de valores específicos de la configuración activa, sin exportar el documento completo.
- [Caddy timeouts globales](https://caddyserver.com/docs/caddyfile/options#timeouts): diferencia entre duración de respuesta y espera keepalive.
- [HTML Standard: Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html#authoring-notes): eventos, reconexión y latidos para intermediarios.
- [Next compress](https://nextjs.org/docs/app/api-reference/config/next-config-js/compress) y código instalado `next/dist/server/pipe-readable.js`: compresión predeterminada, cabeceras al primer chunk y vaciado posterior.
- [compression: SSE y no-transform](https://github.com/expressjs/compression#server-sent-events): el middleware respetado por Next evita transformar respuestas marcadas y necesita vaciado explícito para SSE.
- [Compose: combinación de archivos](https://docs.docker.com/reference/compose-file/merge/#unique-resources) y [config](https://docs.docker.com/reference/cli/docker/compose/config/): los volúmenes se combinan por destino; validación local sin invocar el motor de producción.

## Pendientes de Walter

Completar con Claude la observación desde la sesión productiva legítima y aceptar la ventana del proxy si decide aplicar el parche. La misión entrega código y evidencia local; no certifica todavía la desaparición del incidente desde una sesión Google privada de producción. La configuración efectiva de Caddy sí se cotejó en lectura, según el recibo citado.
