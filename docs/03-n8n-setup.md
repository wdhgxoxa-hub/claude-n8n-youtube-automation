# Puesta en marcha en n8n 2.47.4

## Importación

En el editor de n8n, crea un workflow por archivo. Abre **More actions → Import → From file** y selecciona su JSON. Comprueba que los cuatro figuren sin publicar.

En el equipo que ejecuta Podman, también puedes importar los cuatro con el comando siguiente. Úsalo una vez en una instalación que todavía carece de estos borradores.

~~~bash
cd /home/david/Proyectos/claude-n8n-youtube-automation &&
  jq -s . workflows/*.json |
  podman exec -i videos-n8n n8n import:workflow --input=/dev/stdin --activeState=false
~~~

## Datos de configuración

En **Factory Settings**, indica el ID del chat privado en los flujos 01, 02 y 04, el ID y nombre de la hoja en 03 y 04, y la URL de la rutina en 01 y 02. La hoja propuesta se llama Videos y usa las columnas de [la plantilla](../templates/tracking-sheet.md).

| Credencial de n8n | Dónde se usa |
|---|---|
| Telegram API | Disparador y mensajes de los flujos 01, 02 y 04 |
| HTTP Header Auth con Authorization Bearer de la rutina | Fire Claude Routine en 01 y 02 |
| HTTP Header Auth con un valor aleatorio dedicado | Script Webhook en 02 y Log Row Webhook en 03 |
| HTTP Basic Auth del operador | Wait For My Decision en 02 |
| Google Sheets OAuth2 | Lectura y escritura en 03 y 04 |
| Crypto con HMAC Secret de HeyGen | Calculate HeyGen Signature en 04 |
| HTTP Header Auth con x-api-key de HeyGen | Consultas Get Video Agent Session y Get HeyGen Video en 04 |
| YouTube OAuth2 | Upload Privately To YouTube en 04 |

Guarda los tokens en el gestor de credenciales de n8n y el secreto de retorno en el entorno de la rutina. Puedes usar el encabezado X-Video-Factory-Key para el secreto de retorno. Limita la clave de HeyGen a los permisos de lectura disponibles para las consultas.

El editor puede seguir local. Para recibir eventos de servicios externos, hace falta acceso HTTPS a los webhooks y al formulario. Cuando se autorice el acceso, configura el proxy de esos endpoints y establece N8N_WEBHOOK_URL con la dirección pública y N8N_PROXY_HOPS con el número real de proxies. Telegram registra una URL HTTPS por bot. Para probar con un bot que ya usa otro flujo, usa un bot de pruebas separado. [Documentación del proxy de n8n](https://docs.n8n.io/hosting/configuration/configuration-examples/webhook-url/) · [Telegram Trigger](https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.telegramtrigger/common-issues/)

## Pruebas

~~~bash
node --test --test-isolation=none tests/workflows.test.cjs
~~~

La suite ejecuta el JavaScript de los JSON con datos ficticios. Si tienes disponible el paquete n8n 2.47.4 en disco, ejecuta también FACTORY_N8N_DIR=/ruta/al/paquete/n8n node tests/n8n-smoke.cjs. Este ensayo usa el motor de n8n con entradas y servicios simulados.

Para comprobar el transporte real, usa los webhooks de prueba con sus credenciales, una hoja de pruebas y un guion ficticio. Comprueba el acuse de registro, las tres decisiones y la firma de un evento de prueba. Conserva allowClaude y allowYoutubeUpload en false. n8n puede exigir credenciales asignadas a nodos de ramas que la prueba no recorrerá.

Para producción, habilita los controles después de la aprobación del operador y de verificar la cuenta, el canal y el presupuesto. YouTube usa visibilidad privada con notificaciones a suscriptores deshabilitadas.

## Concurrencia y recuperación

**Fábrica v2 (tablas de n8n): sube el límite a 10.** El límite de 1 venía de la versión con Google Sheets. Medido el 19-11-2026: con `N8N_CONCURRENCY_PRODUCTION_LIMIT=1`, 4 esperas de 5 s tardaron 21 s, porque corren en fila; un video en producción frena Telegram, aprobaciones y publicaciones de todos los canales. Con 10, los flujos largos (producción, cortes, publicación) avanzan en paralelo y los topes de Ajustes (`maxVideosDiaPorCanal`, `maxVideosDiaTotal`) y el ritmo por lotes de cada API evitan los excesos. Ver «Cambiar la concurrencia» abajo. [Concurrencia de n8n](https://docs.n8n.io/hosting/scaling/concurrency-control/)

### Cambiar la concurrencia (Podman)

1. Ver con qué comando se creó el contenedor: `podman inspect videos-n8n --format '{{.Config.CreateCommand}}'`
2. Detenerlo y renombrarlo (queda como respaldo): `podman stop videos-n8n && podman rename videos-n8n videos-n8n-respaldo`
3. Volver a crearlo con el **mismo** comando del paso 1, añadiendo `-e N8N_CONCURRENCY_PRODUCTION_LIMIT=10` antes del nombre de la imagen.
4. Comprobar que n8n abre y los flujos están activos; luego borrar el respaldo: `podman rm videos-n8n-respaldo`.

Los datos viven en el volumen del contenedor (mismo `-v` del comando original), así que no se pierden flujos, credenciales ni tablas.

### Escala medida (19-11-2026, n8n 2.47.4 en un solo equipo)

| Prueba | Resultado |
| --- | --- |
| 60 llamadas simultáneas a «FX · YouTube por canal» | 60/60 correctas, 11 s de mediana, 20 s el máximo (en fila por el límite de 1) |
| Tabla de 5000 filas (100 canales × 50 envíos) | Lectura filtrada por canal 23 ms; completa 144 ms |
| Calendario: 60 canales × 3 largos (2520 envíos) | Sin choques ni topes excedidos; < 5 s |

Para más de ~20 canales activos conviene un servidor (VPS) con n8n en modo cola (Postgres + Redis + varios workers).

## Pruebas en un n8n real (antes de importar)

`tools/motor/` ejecuta los nodos Code de la fábrica dentro de un n8n de **prueba** (nunca el de producción), con datos simulados:

- `casos.py`: 10 casos clave (ajustes, calendario, cortes, montaje, zona horaria, enlace de YouTube, topes, atascados, vigilante y el envío multipart a Upload-Post contra un receptor local).
- `barrido.py`: ejecuta los 134 nodos Code para detectar errores de sintaxis o funciones que el entorno de n8n no tiene.

```bash
MOTOR_URL=http://127.0.0.1:5680 MOTOR_USUARIO=<correo de prueba> MOTOR_CLAVE=<clave de prueba> python3 tools/motor/casos.py
```

Hallazgo que motivó esto: un cuerpo `multipart/form-data` armado a mano (modo *raw* o binario) n8n lo reempaqueta letra por letra. «Subir a redes» usa el multipart nativo con 24 casillas `[nombre, valor]`.
