# Cierre operativo final — 21 de noviembre de 2026, Lima

Resultado: **PASS**. Se ejecutó una única copia final después del lote, Radar y Marcas; se replicó ese mismo snapshot al PC, se verificó su restauración, se registró la réplica y se reinició el VPS. No se repitieron app, infraestructura ni lotes n8n. Las siete unidades de servicio recuperaron salud sin arranques manuales.

## Identidades y recuperación

- Imagen Cooper: `localhost/cooper:b3e608eec138a03fce419a66954497b8fc2c50ea`, Docker ID `sha256:71f7a3894e4a7fd84b89fd228506ab8b4d9ac13bd0c5a872303a16abc0248508`.
- Snapshot final y réplica PC: `6f72cf7944cb785c75de8e56e2c82cb4cb9bc6436c8e4718dd12ef11495a17e1`.
- Restauración aislada: PASS, 25 archivos y 2 bases verificadas por el helper certificado; manifiesto íntegro. No se infieren cantidades de medios o WAL ausentes del recibo.
- Réplica local: `/home/david/.cache/cooper-total-integrador-replica`; registro certificado en VPS: PASS.
- Reinicio real: `09888ee0-8210-490d-9df5-c3895ef2f2ef` → `7cfbab2b-9e1e-4001-bfbe-20bf22163007`. `cooper-stack.service` activo/exited, resultado success, código 0; Docker y temporizadores de respaldo/monitor habilitados y activos.
- Estado preservado: 45 workflows, 31 activos, 0 ejecuciones new/running; SHA de identidad/actividad/versiones `07ac1018d124053840966f6a225124bc81c270c28609b81d79fada1cf59617ad`. Las imágenes de los siete servicios coinciden antes/después y todos están healthy.
- La copia certificada conservó huellas de servicios, configuración, release, túnel y workflows; las variables Google quedaron preservadas. Ninguna operación de orquestación leyó, imprimió o copió valores secretos.
- Monitor `--prueba`: PASS, problemas y notificados vacíos; sin envío Telegram.

## Comprobación final

- Sonda de publicación tras reinicio, 19:04:42 Lima: Radar 1, Aprendizaje 1 y Marcas 4, todos `activated`, sin error; versión del disparador = versión publicada = versión del workflow. Consulta SQLite solo lectura, sin disparar cron ni ejecutar workflows.
- Playwright público: 22 pantallas redirigidas a entrada, 6 API protegidas con 401; Google OIDC y callback canónico configurados. TLS 1.3, encabezados de protección y botón de Google comprobados.
- Formatos 1440×900 y 390×900: cero errores de consola/página, cero advertencias, cero incidencias axe, cero desbordamientos, cero solicitudes bloqueadas. No se inició OAuth.
- Cuatro capturas de página completa (entrada/rechazo, escritorio/móvil) revisadas visualmente: legibles, sin solapamientos ni recortes de contenido.
- Dos videos: 1440×900, 49,24 s; 390×900, 36,24 s. Decodificación completa con código 0 y stderr vacío. Cuatro muestras al 25 %/75 % revisadas visualmente; la animación de entrada progresa y la disposición permanece correcta.

## Recibos

| Evidencia | Archivo |
| --- | --- |
| Copia final certificada | `copia-final.json` |
| Réplica y restauración PC | `replica-pc.json`, `replica-comparacion.json`, `replica-registro.txt` |
| Reinicio antes/después | `reinicio-antes-salida.jsonl`, `reinicio-despues.json` |
| Monitor de prueba | `monitor-final.json` |
| Disparadores publicados | `triggers-post-reinicio.json` |
| QA pública | `qa-publica.json`, `qa-publica-salida.json` |
| Capturas y revisión | `entrada-1440.png`, `rechazo-1440.png`, `entrada-390.png`, `rechazo-390.png`, `revision-visual.json` |
| Videos y huellas | `videos-focal.json` |
| Rutas y SHA de recibos originales VPS | `recibos-vps.json` |
| Huellas de todos los archivos de esta carpeta | `indice-sha256.json` |

Los videos permanecen en `/home/david/Proyectos/cooper-wt/total-integrador/.cache/total-cierre-produccion-final/`; sus hashes constan en el recibo focal. Los recibos originales del VPS permanecen bajo `/var/lib/cooper-operacion/`.

## Limitaciones reales y pendientes de Walter

1. El recorrido privado autenticado con la sesión de Walter no se repitió: no había sesión autorizada disponible y está prohibido iniciar OAuth. La entrada pública y el rechazo de acceso sí quedaron probados, y las dos rondas completas de producto anteriores se reutilizan como evidencia ya aceptada.
2. La sonda final demuestra registro de disparadores tras reinicio, sin adelantar ventanas cron ni afirmar una nueva ejecución programada. Marcas conserva el modo simulado habilitado, sin publicaciones sociales.

No se modificaron los controles certificados, no se tocaron D&S Factory, pagos ni redes sociales. La escritura exclusiva del VPS quedó liberada al terminar.
