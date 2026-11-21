# Faltantes de Cooper — auditoría total

Fecha de auditoría: **21-11-2026, Lima**. Rama y worktree propios: `total-auditoria`. Base examinada: `de397f3195856c10b6a9959171ff42da4328d9ec` (integración 3). Los frentes paralelos siguen cambiando sus ramas y el VPS; las observaciones remotas de este informe tienen hora de corte y no certifican un despliegue posterior.

**Resultado:** hay implementación y pruebas locales extensas, pero no una aceptación integral de la versión nueva en producción. En el corte remoto inicial, Cooper conserva ocho migraciones, los dos trabajadores de Marcas no están instalados y varias entradas de la fábrica siguen pausadas. Hay publicaciones históricas: sería incorrecto decir que la fábrica nunca produjo o publicó. Lo que falta demostrar es el recorrido completo de la versión integrada y de sus proveedores autorizados.

La instrucción específica «Solo lectura salvo ese informe» prevalece sobre el cierre documental común: este es el único archivo versionado modificado. Reúne la entrega de `total-auditoria`; no se crea otro informe ni se modifica `docs/ESTADO.md`. Al final se deja el texto de estado para el orquestador. No hubo push, merge, despliegue, reanudación, OAuth, pagos, mensajes ni publicaciones. Los archivos de misión ajenos sin seguimiento se preservan.

## Criterios y alcance

- **A:** Codex puede cerrar el trabajo técnico con código, configuración autorizada o ensayos sin comprar servicios, conceder permisos ni decidir por Walter. Esta auditoría solo lo documenta.
- **B:** falta decisión editorial, consentimiento, acceso de cuenta, aprobación de proveedor, presupuesto o aceptación humana. Se separa de la implementación que sí se puede preparar.
- **Cubierto** significa asignado a un frente; no significa terminado, integrado o desplegado. **Parcial** identifica un remanente que no aparece cerrado en su entrega.
- **P0:** impide la operación prevista o el corte fiable. **P1:** afecta una función o su recuperación. **P2:** calidad, mantenimiento o capacidad futura.
- Evidencia `archivo:línea` corresponde a esta base, salvo las referencias con prefijo `../total-…/` o `../cooper-total/`, relativas al worktree de esta auditoría. Esas referencias son evidencia concurrente, no archivos integrados en esta rama.

Se revisaron especificación, entrega, README, ESTADO y la guía disponible en `docs/diseno/`; los **23 informes Markdown principales** de `docs/informes/`; inventario de **32 workflows v2, 1.211 nodos**, cuatro legados, nueve Data Tables y 58 ajustes; generador y módulos auxiliares; contrato `skill/FABRICA.md`; servicios, pantallas, permisos, medios, memoria, Marcas, mensajería, pruebas y despliegue. El inventario describe cobertura funcional, no aceptación real (`docs/informes/cooper-cobertura.md:7`). La referencia `auditoria-aprendizaje.md`, ausente en esta base, se encontró y contrastó en `../cooper-total/docs/informes/auditoria-aprendizaje.md:1`.

SSH se usó exclusivamente para lectura: metadatos Docker/systemd, espacio, permisos SSH/firewall, respuestas HTTP públicas y consultas SQLite con URI `mode=ro` y `PRAGMA query_only=on`. No se leyeron archivos `.env`, archivos de autenticación, valores de credenciales, cuerpos de mensajes, guiones privados, tokens de YouTube ni payloads de ejecuciones. La consulta de credenciales se limitó a comparar referencias por ID y devolver nombres de nodos/tipos faltantes; nunca seleccionó su columna de datos. No se ejecutaron workflows de producción para probarlos.

## Evidencia remota directa

### VPS-01 — servicios y versión, 11:02–11:05 Lima

| Observación | Resultado leído |
| --- | --- |
| Host | `vmi3773910`, acceso `operador@144.91.88.253`; reloj del host CET, convertido a Lima en este informe. |
| Cooper | Imagen `localhost/cooper:05d833787525fa98b183b3934ef13bd5dff1ca76`, saludable, cero reinicios. |
| n8n / runner / proxy | n8n y runner `2.47.4`, Caddy `2.11.2-alpine`, saludables. |
| Relés nuevos | `cooper-chat-cooper-1`, `cooper-chat-n8n-1`, `cooper-chat-runner-1`, saludables. Su presencia no demuestra una conversación autenticada. |
| Reinicio de contenedores | `unless-stopped` en los servicios consultados. |
| Espacio / memoria | Raíz 96 GB, 9,2 GB usados, 87 GB disponibles; 6.805 MB de memoria disponible. Sin presión observada en ese instante; no es ensayo de carga. |
| Herramientas de medios | `command -v ffmpeg` y `command -v ffprobe` no encontraron ejecutables dentro de Cooper. |
| Temporizadores | `cooper-backup.timer` y `cooper-monitor.timer` activos. `cooper-stack.service` habilitado, `inactive/dead`, último resultado `success`: no prueba un reboot. |
| Puertos Docker | Públicos 80/443; editor 8443 solo en 127.0.0.1. Sin publicación Docker de 3000/5678/8789. |
| SSH / UFW | Root, contraseña e interacción por teclado deshabilitados; `GatewayPorts no`, `AllowTcpForwarding local`; UFW permite 22/80/443 en IPv4/IPv6. Esto no prueba conectividad IPv6 de extremo a extremo. |

Comprobaciones empleadas: `docker ps --format`, `docker inspect --format` limitado a imagen/reinicios/política/montajes, `systemctl show` limitado a estado/resultado, `df`, `free`, `sshd -T` filtrado y `ufw status`. No se volcó `Config.Env`, `docker compose config`, journal ni logs de producción.

Sondeo complementario de nombres durante la misma auditoría: `Object.keys(process.env)` dentro de Cooper, comparado solo con cinco nombres esperados, devolvió **ausente** para `COOPER_MARCAS`, `COOPER_META_GRAPH_VERSION`, `COOPER_META_SYSTEM_TOKEN`, `UPLOAD_POST_API_KEY` y `COOPER_MARCAS_WORKER_SECRET`. No se accedió a sus valores ni a ningún archivo de entorno. Confirma el remanente H09 de la imagen/configuración vigente, sin atribuirlo a una futura imagen.

### VPS-02 — datos y workflows, 11:03:44–11:04:51 Lima

| Observación | Resultado leído |
| --- | --- |
| Cooper SQLite | **8 migraciones**, 22 tablas; 1 usuario, 2 canales, 5 videos, 2 mensajes. Faltan las tablas nuevas de memoria/Marcas de integración 3. |
| Medios y avisos Cooper | 0 activos, 0 adjuntos, 0 contactos WhatsApp, 0 avisos en cola y 0 recibos de entrega. No hay evidencia en esta base de altas o avisos reales completados desde Cooper. |
| n8n | **36 workflows**, nueve Data Tables y 107 columnas declaradas. Incluye un monitor nuevo y una sonda vidIQ; 36 no implica que se hayan instalado los 32 v2 nuevos. |
| Ejecuciones | 454 `success`, 16 `error`, 2 `waiting`; ninguna `running` en el agrupamiento. Éxito histórico no demuestra aceptación del código nuevo. |
| Esperas | IDs 400 y 540, `waitTill=3000-01-01`; conservadas. No se abrieron sus enlaces ni se resolvieron. |
| Negocio | 2 canales (1 activo, 1 pausado), 5 videos (2 publicados, 2 en proceso, 1 descartado), 46 planos listos, 19 trabajos (18 listos, 1 error), 4 publicaciones registradas, 15 aprobaciones (1 pendiente). |
| Historial de operación | `fab_eventos` tiene 0 filas; faltan en `fab_videos` las columnas nuevas de observabilidad del lote. No fabricar retrospectivamente esa historia. |
| Noticias | `modo_noticia=0` en los dos canales n8n y `news_mode=0` en los dos canales Cooper. |
| YouTube | Una fila en estado `conectado`; no se consultaron tokens ni se verificaron vigencia, scopes o métricas. |
| Referencias de credenciales | La comparación de IDs presentes no encontró referencias rotas en los workflows de ese corte. No comprueba asociaciones omitidas, permisos, saldo ni capacidad de publicar una versión nueva. |

Estados `active=0` observados: los cuatro legados; Chat de la fábrica; Confirmar publicaciones; Radar; Retorno de Claude; Rutina; Vigilante; YouTube por canal; Aprendizaje; y la sonda vidIQ. `active=1` observado para el puente Cooper, Orquestador, Llamar a Claude, Texto GPT, Noticia, producción, sonido, presentación, avatar, derivados, publicación en redes y monitor, entre otros subflujos. **Un subflujo activo puede tener ramas apagadas o depender de otro pausado.** No se infieren los valores efectivos de `allow*`: no se leyeron valores del entorno real ni el contenido del nodo Ajustes vivo.

`CooperMarcasPub1` y `CooperMarcasMet1` no aparecen en el listado remoto. Para reproducir los conteos sin secretos: `SELECT COUNT(*) FROM __drizzle_migrations`, `SELECT name,active FROM workflow_entity`, `SELECT status,COUNT(*) FROM execution_entity GROUP BY status`; nombres/columnas de negocio mediante `data_table` y `PRAGMA table_info`. No usar `SELECT *` sobre tablas de autenticación o ejecuciones.

### VPS-03 — HTTPS y acceso público, 11:05 Lima

`https://cooper.cooperestudio.com/api/salud` y `/entrar`: **200**, TLS validado, HSTS y `nosniff`. `/api/estado`, `/api/eventos`, `/api/operacion`, `/api/marcas`: **401** sin sesión. En `https://flujos.cooperestudio.com`, `/`, `/rest/workflows`, `/api/v1/workflows` y `/webhook/cooper/v1`: **404** público. El último rechazo es coherente con el puente privado; no se declara una avería del puente interno. No se siguió OAuth ni se creó una sesión de producción.

Salud solo comprueba SQLite con `select 1` (`cooper/src/app/api/salud/route.ts:7`): 200 no demuestra chat, generación, mensajería ni publicación.

## Qué cubren los frentes activos

| Frente | Compromiso comprobado | Estado que se puede afirmar en este corte |
| --- | --- | --- |
| **despliegue** | Subir integración, migrar, respaldar/revertir y aceptar web; `../total-despliegue/docs/misiones/total-despliegue.md:7`. | Imagen final `169d0cd` y copia migrada 8→11 ensayadas; todavía sin despliegue final según `../total-despliegue/docs/informes/total-despliegue.md:40`. VPS-01/02 confirman la versión anterior. |
| **aprendizaje** | 24 h/72 h/7 días, métricas+guion+planos, patrón ≥3 y lección consumida por siguiente guion; `../total-aprendizaje/docs/misiones/total-aprendizaje.md:7`. | Cubre H04. No convertir su implementación concurrente en producción aceptada de esta rama. |
| **competencia** | 3–5 competidores, outliers, homónimos y diferenciación Perú; `../total-competencia/docs/misiones/total-competencia.md:7`. | Cubre H05, incluido recurso alternativo sin coste si vidIQ no está disponible. No duplicar su radar. |
| **chat-vps** | Túnel PC→VPS, relés, reconexión, respaldo básico, brevedad; `../total-chat-vps/docs/misiones/total-chat-vps.md:7`. | Transporte real 200/401/503 y recuperación, respuesta Codex en 5,9 s; sesión Google pendiente. `../total-chat-vps/docs/informes/total-chat-vps.md:7`. |
| **operacion** | Copia fuera del VPS, monitor/Telegram, arranque y recuperación; `../total-operacion/docs/misiones/total-operacion.md:7`. | Réplica restic en PC, restauración, timers y aviso real documentados; reboot físico pendiente. Continuación en `../total-despliegue/docs/informes/total-despliegue.md:16`. |
| **seguridad** | Auth, aislamiento, SSRF/CSRF, límites, dependencias y propuestas VPS; `../total-seguridad/docs/misiones/total-seguridad.md:7`. | Asignado; no se presume cerrado por estar el host saludable. Cubre revisión de archivos/secretos; no da por aprobada una política de retención. |
| **n8n-lote** | Aplicador, referencias, respaldo, publicación/reversa; commits `3515fc0`, `3a04dca`, `0601218` de la rama homónima. | El ensayo de importación no bastó: publicación secuencial encontró dependencias y credenciales ausentes y hubo reversa. `../total-despliegue/docs/informes/total-despliegue.md:48`. El orquestador conserva aplicación/integración final. |

## Inventario de faltantes A

| ID / impacto | Qué está incompleto o sin probar | Evidencia | Cobertura y criterio de cierre |
| --- | --- | --- | --- |
| **H01 · P0** | Web nueva ausente del VPS: memoria, Marcas y observabilidad no quedan operativas solo por publicar Git. | `docs/ESTADO.md:19`; `docs/informes/cooper-integracion3.md:102`; VPS-01/02. | **despliegue**, asignado. Cerrar con SHA real, migraciones/conteos, reversa y aceptación de la imagen final. OAuth humano en B01. |
| **H02 · P0** | Lote nuevo, columnas, dependencias y publicación n8n todavía sin cierre final. El puente antiguo puede rechazar Operación y no registrar historiales. | `docs/informes/cooper-integracion3.md:95`; `docs/informes/cooper-integracion3.md:103`; VPS-02; informe concurrente de despliegue:48. | **n8n-lote**, asignado. Importar no equivale a publicar; comprobar cierre transitivo, estados preservados, aislamiento y reversa del lote exacto. |
| **H03 · P0** | Modo completo del chat no aceptado desde una sesión Cooper en el VPS; transporte y aplicación son pruebas distintas. | `cooper/src/servicios/chat/seleccion.ts:7`; `docs/informes/cooper-vps-real.md:218`; informe concurrente chat-vps:9. | **chat-vps + despliegue**, parcial probado. Completar overlay y aceptación sin inventar sesión. Dependencia de PC/cuota en B10. |
| **H04 · P0** | Aprendizaje no cierra publicación→causa→lección→siguiente guion: guion solo toma temas recientes; payload no lleva guion/planos; ventanas 2/7 días y flag apagado por defecto. | `tools/generar_flujos_v2.py:597`, `:603`, `:1756`, `:1764`, `:1804`; `skill/FABRICA.md:157`; auditoría aprendizaje concurrente:14. | **aprendizaje**, asignado. No basta mostrar una lección; exigir evidencia de su uso y ≥3 videos. Permisos/métricas reales en B05. |
| **H05 · P1** | Competencia parcial: vidIQ opcional y apagado por defecto; 3–5 cuentas solo prescritas en adopción; sin chequeo específico de homónimos por video en esta base. | `tools/generar_flujos_v2.py:341`, `:610`, `:623`; `skill/FABRICA.md:59`; auditoría aprendizaje concurrente:9. | **competencia**, asignado. Probar fuente, fecha, diferenciación y consumo por guion; no inventar outliers ni seguidores. |
| **H06 · P1** | Recuperación operativa todavía depende de PC y del propio n8n para alertar; falta prueba de reboot final y cerrar instalación conjunta. | `docs/informes/cooper-vps-real.md:226`; informe concurrente despliegue:16, :24, :62. | **operacion + despliegue**, parcialmente cerrado: ya existe réplica externa y aviso real. No volver a pedir repositorio como si no hubiese PC. Canal independiente/custodia en B11. |
| **H07 · P1** | Revisión final de seguridad y revocación de clave administrativa antigua sin evidencia de cierre en esta base. Validar firmas de archivos no es antivirus; límites son por proceso. | `docs/informes/cooper-consolidar.md:122`; `cooper/src/lib/archivos.ts:2`; `cooper/src/lib/http.ts:62`; `cooper/src/servicios/chat/cola.ts:3`. | **seguridad**, asignado. Revisar metadatos y uso antes de revocar; no leer valores. Varias réplicas no son requisito actual (B12). |
| **H08 · P0** | Contrato de retorno Claude conserva ngrok y el sobre enviado no lleva `retornoUrl`; la fábrica usa routine externa aunque el chat use CLI. El retorno remoto está pausado. | `skill/FABRICA.md:23`, `:30`; `tools/generar_flujos_v2.py:322`, `:402`, `:412`, `:435`; VPS-02. | **Sin cobertura explícita del contrato/routine**. n8n-lote cubre instalación; chat-vps cubre chat/puente, no acredita actualizar la routine. M01; reapertura necesita B02. No se afirma que la variable alternativa esté ausente: no se leyó. |
| **H09 · P1** | Runtime de Marcas incompleto: FFmpeg/FFprobe ausentes y Compose de esta base no pasa las variables de Marcas ni las del worker. Cambiar solo la imagen no completa el circuito. | `deploy/Containerfile:13`; `deploy/compose.yaml:35`; `cooper/src/servicios/marcas/diseno.ts:115`, `:152`; `cooper/src/servicios/marcas/worker.ts:7`; `docs/cooper-marcas.md:45`, `:52`; VPS-01/02. | **despliegue + n8n-lote parcial**; remanente técnico sin cierre documentado: M02. Probar composición y HMAC con fixtures, manteniendo envíos reales apagados. |
| **H10 · P1** | Estados inciertos preservan seguridad pero carecen de un procedimiento común completo de conciliación: chat `ejecutando/revisar`, reservas, WhatsApp `incierto`, publicación `revision`, ingesta `descargando`. | `cooper/src/servicios/chat.ts:528`, `:558`; `cooper/src/servicios/mensajeria/cola.ts:290`; `cooper/src/servicios/marcas/servicio.ts:606`; `cooper/src/servicios/marcas/adjuntos-whatsapp.ts:21`; `docs/informes/fase2-puente-n8n.md:59`. | **Sin cobertura explícita**: M03. Hay consultas/reintentos seguros puntuales; falta cierre auditable tras caída, no un botón que reenvíe todo. |
| **H11 · P1** | Gastos por día/semana/mes y deduplicación de alerta cortan en UTC, sin aclararlo al administrador; difieren del día operativo Lima. Reproducción: a las 21:00 Lima, dos cargos del mismo día por 2 y 3 dan `dia=3`, no 5. | `tools/cooper/gastos.js:3`; `cooper/src/servicios/datos.ts:100`; `cooper/src/servicios/mensajeria/cola.ts:141`. | **Sin cobertura explícita**: M04. Alinear corte y etiqueta, con límites de día/semana/mes y misma regla en demo/n8n/avisos. No es una discrepancia de factura. |
| **H12 · P1** | Marcas exige adjuntar de nuevo el MP4 de un video propio aunque la integración ya expone montaje; 5 MB por adjunto limita esa vía. URLs caducadas solo muestran error/enlace. | `cooper/src/servicios/marcas/servicio.ts:290`; `docs/cooper-marcas.md:11`; `cooper/src/componentes/medios-video.tsx:18`, `:37`; `docs/informes/cooper-pulido.md:109`. | **Sin cobertura explícita**: M05. Reutilizar medio autorizado por referencia y revisión, sin duplicar producción; política de archivo en B08. |
| **H13 · P1** | No hay purga de originales/huérfanos ni borrado físico del historial al olvidar memoria; ingestas y medios derivados acumulan datos. | `cooper/MEDIOS.md:29`; `cooper/src/servicios/chat/memoria.ts:324`; `docs/cooper-marcas.md:58`. | **seguridad/operacion parcial**, sin implementación de retención asignada: M06 prepara inventario y simulación; activar borrado requiere B08. |
| **H14 · P1** | Entrenamientos solo se sondean con usuario conectado; cerrar el estudio detiene la actualización local y no existe trabajador durable para biblioteca. | `cooper/src/app/api/eventos/route.ts:83`; `cooper/src/servicios/biblioteca.ts:271`; `cooper/src/instrumentation.ts:1`; `docs/informes/cooper-fase3.md:63`. | **Sin cobertura explícita**: M07. Probar avance tras cerrar navegador/reiniciar, sin repetir creación o entrenamiento. |
| **H15 · P1** | Puerta no reproducible en un checkout limpio con solo npm: Sentinel y su Python viven en otro proyecto; Chromium de Sentinel requiere preparación distinta; no hay workflow CI versionado. | `cooper/e2e/marcas.spec.ts:203`; `cooper/scripts/sentinel-cooper.py:13`; `cooper/README.md:228`; `.github/ISSUE_TEMPLATE/bug_report.md:1` (único archivo de `.github`). | **Sin cobertura explícita**: M08. En esta auditoría se reutilizó caché compatible; no se deshabilitó Sentinel. La ausencia de CI no invalida las puertas manuales previas. |
| **H16 · P1** | Calidad semántica y latencia real de memoria/chat no medidas por los 30 casos deterministas; una síntesis adicional tiene límite de 12 s y puede degradar a apuntes. | `cooper/tests/chat-evaluacion.test.ts:63`; `cooper/src/servicios/chat/memoria.ts:259`; `docs/informes/cooper-memoria.md:65`; `cooper/README.md:211`. | **chat-vps parcial**: prueba transporte/respuesta corta, no esta evaluación. **Sin cobertura del evaluador real**: M09; cuentas/cuota y aceptación en B10. |
| **H17 · P2** | Publicados y Aprendizaje de Marcas permanecen separados de las pantallas globales; integración 3 conservó la separación. | `docs/informes/cooper-marcas.md:74`; `docs/informes/cooper-integracion3.md:104`; `docs/cooper-marcas.md:60`. | **aprendizaje parcial**, dedicado al ciclo de videos. Agregación de ambos productos sin cobertura explícita: M10. No mezclar métricas incompatibles ni duplicar lecciones. |
| **H18 · P2** | Pruebas automáticas limitadas a Chromium; no hay proyectos WebKit/Firefox ni evidencia de lector de pantalla o dispositivos físicos. | `cooper/playwright.config.ts:26`; `docs/informes/cooper-revision.md:121`; `docs/informes/cooper-integracion3.md:101`. | **despliegue parcial**, navegador en destino no amplía motores. Automatización multiengine sin cobertura: M11; aceptación física en B09. |
| **H19 · P2** | Consultas cargan conjuntos completos antes de proyectar/acotar, sin ensayo con historial grande; mensajería recorre todos los videos cada ciclo. | `tools/generar_flujos_v2.py:3055`; `cooper/src/servicios/mensajeria/trabajador.ts:8`; `docs/informes/cooper-cobertura.md:108`. | **Sin cobertura explícita**: M12. Medir antes de optimizar; no se ha observado saturación en los cinco videos actuales. |
| **H20 · P2** | Gasto/ahorro son estimaciones: no concilian facturas, cargos fallidos ni coste fijo de planes; el indicador de salud no revela esta diferencia. | `tools/generar_flujos_v2.py:350`; `cooper/src/servicios/datos.ts:147`; `docs/informes/fase2-puente-n8n.md:58`; `docs/informes/cooper-fase6.md:66`. | **Sin cobertura explícita de conciliación**: M13 prepara comparación administrativa con datos ficticios. Tarifas, presupuesto y documentos reales en B05. No prometer ahorro efectivo. |
| **H21 · P2** | Entrada documental desactualizada: README raíz describe cuatro drafts/Sheets; README Cooper aún dice «no se ha desplegado en vivo», pese al informe VPS. Migraciones experimentales requieren procedimiento propio. | `README.md:3`; `cooper/README.md:39`, `:157`; `docs/ESTADO.md:19`; `docs/informes/cooper-integracion3.md:9`. | **Sin cobertura explícita de saneamiento completo**: M14. Mantener informes históricos, añadir índice vigente y registrar qué base se puede migrar. No alterar diarios aplicados. |

H08–H21 son los remanentes A sin cierre explícito asignado, incluidos los marcados «parcial». La lista siguiente los ordena por impacto; no autoriza implementar estas misiones desde la auditoría.

### Inventario de simulación y activación por subsistema

Los valores siguientes son **predeterminados del código**, no una lectura del entorno privado del VPS. Las decisiones de activación son B; la instalación de contratos y sus frenos corresponde a los frentes A indicados.

| Subsistema | Qué existe y qué falta demostrar | Evidencia / clasificación |
| --- | --- | --- |
| Fábrica demo | Adaptador simulado por defecto en aplicación; demo fuerza simulación, avance ligado al estudio y gastos ficticios. No confundir esa experiencia con el adaptador n8n. | `cooper/src/servicios/fabrica.ts:647`; `cooper/README.md:53`; H01/H02. |
| Avatar/voz | Verificación simulada acepta consentimiento/formato; voz de muestra es un tono; catálogo Luz/Cooper es ilustración. Proveedores reales y rechazo 422 de selección simulada sí están implementados. | `cooper/src/servicios/proveedores/simulados.ts:11`, `:31`; `cooper/src/servicios/presentacion.ts:154`; B04. |
| Audio del chat | La transcripción simulada devuelve una frase fija editable; Gemini/OpenAI son adaptadores separados, no transcripción incluida en el plan CLI. | `cooper/src/servicios/proveedores/simulados.ts:62`; `cooper/src/servicios/proveedores/index.ts:61`; `cooper/README.md:185`; B04/B05. |
| Texto, crítica y exactitud | `allowClaude=true`; `allowCritico`, `allowVerificacion`, `allowTextoApi=false`. Una sesión del chat funcionando no enciende esos pasos ni acredita fuentes/veracidad. | `tools/generar_flujos_v2.py:324`, `:332`; H03/H08, B05/B06. |
| Producción audiovisual | `allowImagenes`, `allowRevisionVisual`, `allowClips`, `allowVoz`, `allowMusica`, `allowReferencias`, `allowAvatar`, `allowMontaje`, `allowDrive=false`. Render, fidelidad, sincronía y coste requieren ensayo autorizado. | `tools/generar_flujos_v2.py:325`; `tools/generar_flujos_v2.py:1165`; B04/B05. |
| Archivo y efectos | `allowArchivo=true`, `allowEfectos=true` solo permiten intentar Pexels/Pixabay/Epidemic; no prueban credencial, licencia de uso ni disponibilidad de un medio concreto. | `tools/generar_flujos_v2.py:330`; `skill/FABRICA.md:114`; B05. |
| Distribución | `allowYoutube`, `allowMiniaturas`, `allowCortes`, `allowRedes=false`; el parámetro de privacidad YouTube es `public` si se habilita esa ruta. No abrir interruptores como parte de una comprobación. | `tools/generar_flujos_v2.py:339`, `:343`, `:346`; B05. |
| Analítica y radar | `allowAnalytics`, `allowVidiq`, `allowRadar=false`; conexión registrada no demuestra permisos ni datos de retención. Nuevos ensayos deben conservar ausencia como ausencia. | `tools/generar_flujos_v2.py:340`; H04/H05, B05. |
| Marcas | Proveedor simulado por defecto. Estudio descriptivo de hasta 150 muestras: medias de texto, pilares por rubro, color/proporción y horario como hipótesis; no aprende semánticamente una identidad ni prueba doctrina. | `cooper/src/servicios/marcas/redes.ts:543`; `cooper/src/servicios/marcas/estudio.ts:29`, `:69`; `cooper/src/servicios/marcas/visual.ts:7`; H09/H17, B07/B12. |
| Mensajería | Cola y transportes existen; las cinco plantillas de avisos/OTP y la adicional de Marcas requieren aprobación/configuración real. Telegram operativo no certifica WhatsApp. | `docs/informes/cooper-whatsapp-alta.md:51`; `docs/cooper-marcas.md:39`; B03/B07. |

Los cuatro workflows legados apagados no son cuatro fallos nuevos: v2 aporta sus equivalentes, sin reactivar Sheets ni el callback anterior de HeyGen (`docs/informes/cooper-cobertura.md:111`). Tampoco se pide reconstruir a partir de cero voces históricas sin URL, revisiones o eventos nunca registrados (`docs/informes/cooper-pulido.md:105`).

## Misiones propuestas para A no cubiertos — cinco líneas cada una

### M01 — retorno de la fábrica y contrato del cerebro (H08)

1. Objetivo: cerrar el contrato routine→retorno en el dominio definitivo, independiente del chat CLI.
2. Alcance: parametrizar origen, transportar/configurar retorno y versionar contrato/skill desplegable.
3. Límites: sin OAuth, secretos en archivos, reactivación de entradas ni consumo audiovisual.
4. Prueba: routine ficticia→webhook autenticado→trabajo→Orquestador; duplicado, caída y URL antigua.
5. Entrega: lote inactivo, evidencia de reversa y paso de reapertura separado para Walter/orquestador.

### M02 — runtime completo de Marcas (H09)

1. Objetivo: que una imagen de producción pueda preparar reels y recibir sus trabajos firmados.
2. Alcance: FFmpeg/FFprobe, fuentes, variables de ejemplo/Compose/runner y comprobación de worker.
3. Límites: mantener Marcas y publicación real apagadas; reutilizar los adaptadores existentes.
4. Prueba: JPEG/MP4 sintéticos, audio/duración, HMAC válido/inválido y reinicio del worker en Compose.
5. Entrega: imagen reproducible, lote inactivo y evidencia del mismo artefacto que desplegará el orquestador.

### M03 — conciliación de operaciones interrumpidas (H10)

1. Objetivo: resolver estados inciertos sin repetir una operación potencialmente cobrada o publicada.
2. Alcance: consulta por recibo/ID, estados terminales, revisión administrativa y registro de decisiones.
3. Límites: nunca liberar reservas ni reenviar por timeout; acciones de cuenta solo con autorización propia.
4. Prueba: matar proceso antes/después de aceptación con transportes ficticios; demostrar cero duplicados.
5. Entrega: flujo de conciliación, guía por subsistema y casos de recuperación reproducibles.

### M04 — periodos de gasto coherentes con Lima (H11)

1. Objetivo: que «hoy», semana, mes y alerta diaria compartan el mismo corte operativo explícito.
2. Alcance: agregador n8n, simulador, interfaz administrativa y deduplicación de WhatsApp.
3. Límites: sin alterar importes históricos, tarifas, presupuestos ni enviar avisos reales.
4. Prueba: 18:59/19:00/23:59/00:00 Lima, lunes y cambio de mes con relojes y cargos ficticios.
5. Entrega: regla documentada, lote de agregación y regresión que hoy produce 3 en lugar de 5.

### M05 — reutilización de medios de fábrica en Marcas (H12)

1. Objetivo: usar un montaje propio aprobado sin descargarlo y volver a subirlo manualmente.
2. Alcance: referencia por recurso/revisión, vigencia de URL, lectura autorizada y límites de tamaño explícitos.
3. Límites: no regenerar medios ni copiar URLs privadas al contexto del modelo; almacenamiento según política.
4. Prueba: MP4 sintético, URL expirada, dueño ajeno, consentimiento revocado y cambio de revisión.
5. Entrega: flujo web integrado, recuperación de enlace documentada y ensayo sin proveedores externos.

### M06 — retención e inventario de datos (H13)

1. Objetivo: conocer originales, derivados, mensajes y huérfanos conservados antes de borrar nada.
2. Alcance: inventario por dueño, referencias activas, política configurable y modo de simulación obligatorio.
3. Límites: no purgar producción ni consentimientos hasta que Walter fije retención y excepciones.
4. Prueba: fixtures con referencias compartidas, revocación, operaciones en curso, borrado y recuperación.
5. Entrega: propuesta de política, herramienta auditable y ejecución real expresamente pendiente B08.

### M07 — seguimiento durable de biblioteca (H14)

1. Objetivo: actualizar estados de avatar/voz aunque ningún navegador mantenga SSE abierto.
2. Alcance: trabajador pequeño con reserva SQLite, sondeo acotado, backoff y pausa por revocación.
3. Límites: no reintentar creaciones inciertas ni entrenar activos no revisados; sin llamadas pagadas.
4. Prueba: proveedor falso, dos trabajadores, caída/reinicio, navegador cerrado y borrado concurrente.
5. Entrega: worker operable, pruebas de exclusión y documentación de conciliación cuando falte ID remoto.

### M08 — puerta reproducible desde cero (H15)

1. Objetivo: ejecutar la puerta completa sin depender de rutas personales ni preparación manual oculta.
2. Alcance: preflight, instalación/versionado compatible de Sentinel/Python/navegadores y arnés de CI local.
3. Límites: no quitar guardianes, reglas, pruebas ni umbrales; publicar CI requiere repositorio autorizado.
4. Prueba: checkout limpio en entorno soportado, siete comandos, cero omisiones y artefactos verificables.
5. Entrega: un procedimiento reproducible, dependencias fijadas y logs sin secretos.

### M09 — evaluación semántica de chat y memoria (H16)

1. Objetivo: medir selección, recuerdos/correcciones, aislamiento, brevedad y latencia con proveedor del plan.
2. Alcance: reutilizar 30 conversaciones, añadir retorno tras días y medir síntesis separada del transporte.
3. Límites: datos ficticios, sin herramientas mutadoras, sin OAuth ni respaldo API pago; cuota acotada.
4. Prueba: arnés determinista primero; ejecución real solo con sesión vigente y autorización aplicable.
5. Entrega: resultados por caso y errores reales; no sustituirlos por puntuaciones del simulador.

### M10 — resultados de videos y Marcas en una consulta (H17)

1. Objetivo: encontrar publicaciones y aprendizajes propios sin visitar dos historiales independientes.
2. Alcance: agregación por dueño/canal/marca, enlaces al origen y filtros de tipo/red/fecha.
3. Límites: conservar contratos distintos, valores ausentes y trazabilidad; sin publicar ni reentrenar.
4. Prueba: dos dueños, homónimos, publicaciones duplicadas y métricas no comparables o todavía ausentes.
5. Entrega: vistas coherentes y compatibilidad con el lote del frente aprendizaje.

### M11 — aceptación automatizada entre navegadores (H18)

1. Objetivo: ampliar los recorridos esenciales a WebKit y Firefox con accesibilidad de teclado.
2. Alcance: entrada, chat/SSE, aprobaciones, audio, medios y pausa de movimiento con fixtures.
3. Límites: no afirmar Safari/iPhone físico ni lector de pantalla real a partir de emulación.
4. Prueba: motores fijados, reconexión, formatos soportados, dos temas y tamaños móvil/escritorio.
5. Entrega: matriz de resultados y lista breve de aceptación física que conserva Walter.

### M12 — consulta de historiales con volumen (H19)

1. Objetivo: evitar que cada lectura o ciclo recorra todos los datos al crecer el historial.
2. Alcance: medir fixtures grandes, filtros/paginación de Data Tables y consultas incrementales de avisos.
3. Límites: preservar dueño, orden, idempotencia y datos; no migrar a múltiples réplicas por defecto.
4. Prueba: 10.000 registros ficticios, varias cuentas, límites de tiempo/memoria y regresión de SSE.
5. Entrega: mediciones antes/después, cambios justificados y límites operativos explícitos.

### M13 — conciliación administrativa de estimaciones (H20)

1. Objetivo: distinguir gasto estimado, confirmado y todavía sin conciliar por proveedor y operación.
2. Alcance: importación manual estructurada de recibos ficticios y comparación sin reescribir la evidencia original.
3. Límites: no entrar en facturación, extraer claves, cobrar ni decidir reparto de suscripciones.
4. Prueba: duplicados, cargos fallidos, desfases, moneda/periodo incompatible y acceso solo administrador.
5. Entrega: informe de diferencias y decisiones contables/tarifarias pendientes de Walter.

### M14 — documentación y estado verificables (H21)

1. Objetivo: que el punto de entrada describa Cooper/v2 y distinga código, ensayo, integración y despliegue.
2. Alcance: README, índice de informes, migraciones compatibles, comandos y enlaces de evidencia.
3. Límites: conservar los informes históricos y las ideas no aprobadas; no reescribir el diario SQLite.
4. Prueba: verificar enlaces/rutas, regeneración de inventario y correspondencia entre SHA y aceptación.
5. Entrega: estado en Lima actualizado por el integrador y un procedimiento único de arranque/reversa.

## Pendientes de Walter — faltantes B

| ID / impacto | Decisión o aceptación pendiente | Evidencia y cobertura |
| --- | --- | --- |
| **B01 · P0** | Completar Google real en dominio definitivo; comprobar aislamiento de dos personas, SSE y adjuntos con sesiones legítimas. Una redirección/401 no lo sustituye. | `docs/informes/cooper-vps-real.md:214`, `:237`; VPS-03. **despliegue** prepara el entorno; Walter hace OAuth/aceptación. |
| **B02 · P0** | Decidir qué entradas pausadas reabrir y qué hacer con esperas 400/540 y el guion histórico; aprobar con su contexto, nunca automáticamente. | `docs/ESTADO.md:35`; `docs/informes/cooper-vps-real.md:251`; VPS-02. **n8n-lote** aplica una decisión concreta, no la inventa. |
| **B03 · P1** | WhatsApp sigue sin aceptación integral: pago 141006, negocio, plantilla OTP 10/2388185, plantillas con origen definitivo, firma `WHATSAPP_APP_SECRET`, suscripción/recibos y verificación individual. El estado Meta actual no se reconsultó. | `docs/informes/cooper-whatsapp-alta.md:35`, `:53`, `:76`, `:126`; `docs/informes/cooper-vps-real.md:243`; VPS-02 sin contactos/entregas. **Ningún frente asignado al alta Meta**; no confundir monitor Telegram con WhatsApp. |
| **B04 · P1** | Elegir y consentir proveedores/avatar/voz reales, revisar identidad y calidad, asociar credenciales y autorizar ensayo pagado completo/partes. Luz y Cooper siguen ilustraciones sin recurso productivo aprobado. | `cooper/src/servicios/proveedores/index.ts:29`; `cooper/src/servicios/proveedores/simulados.ts:8`, `:62`; `cooper/src/servicios/medios.ts:21`; `cooper/MEDIOS.md:53`; `docs/informes/cooper-vivo.md:189`. **No cubierto** por instalar flujos. Revisión humana, no biometría certificada. |
| **B05 · P1** | Fijar modelos, tarifas, presupuestos, interruptores y permisos de cuentas/Analytics; autorizar primera producción y publicación de la versión nueva. Confirmar vigencia de conexión YouTube y perfiles Upload-Post. | `tools/generar_flujos_v2.py:324`; `docs/informes/cooper-cobertura.md:118`; `docs/informes/cooper-integracion3.md:111`; VPS-02 tiene histórico, no aceptación nueva. **aprendizaje/competencia/n8n-lote** preparan código; no conceden scopes ni gasto. |
| **B06 · P1** | Elegir canales de noticias y aceptar un ensayo con fuentes reales, caducidad, mapas/cifras, cuota/timeout y eventual respaldo API; sigue apagado en ambos canales. | `docs/informes/cooper-fase6.md:63`, `:74`; `docs/informes/cooper-vivo-final.md:159`; VPS-02. **chat-vps** cubre conectividad del texto, **competencia** radar; ninguno demuestra calidad editorial de una noticia. |
| **B07 · P1** | Activar Marcas: identidades/dueños, activos Meta y permisos/revisión, perfiles, corpus bíblico autorizado, criterio pastoral y plantilla `cooper_aprobacion_marca`; aceptar pieza real. | `docs/informes/cooper-marcas.md:78`; `docs/cooper-marcas.md:20`, `:33`, `:39`; `cooper/src/servicios/marcas/redes.ts:543`. **despliegue/n8n-lote** no resuelven las decisiones ni permisos. |
| **B08 · P1** | Fijar retención de fotos, grabaciones, consentimientos, mensajes, derivados y copias; decidir purga/eliminación remota y acceso en proveedores. Borrado lógico y «olvidar» no borran todo. | `cooper/MEDIOS.md:29`; `cooper/README.md:207`; `docs/informes/cooper-marcas.md:82`. **seguridad/operacion** consultivos; M06 puede preparar sin borrar. |
| **B09 · P2** | Aceptar dirección visual y usabilidad en teléfono físico, Safari si se usa, cámara/micrófono y tecnologías de asistencia. Lighthouse/axe/CPU 4× son pruebas de laboratorio. | `docs/informes/cooper-animacion-fuerte.md:87`, `:97`; `docs/informes/cooper-revision.md:129`; **despliegue** no sustituye esa revisión. |
| **B10 · P1** | Mantener PC y sesiones de planes disponibles; resolver expiración/cuota mediante el propietario; aceptar precisión/latencia de memoria. Si se exige independencia de PC, decidir alternativa y presupuesto. | `docs/informes/cooper-chat-planes.md:105`, `:109`; `docs/ESTADO.md:36`; informe concurrente chat-vps:25. **chat-vps** conserva fallback; no promete IA completa con PC apagada. Aislamiento de usuario dedicado requiere sesión autorizada. |
| **B11 · P1** | Custodiar material de recuperación fuera de ambos equipos y decidir aviso independiente si VPS+n8n caen juntos. La réplica cifrada no incluye secretos de host ni sesiones CLI y requiere PC encendida. | Informe concurrente despliegue:60; informe concurrente operación:63. **operacion** ya resolvió réplica/restore; queda esta decisión, no contratar almacenamiento por defecto. |
| **B12 · P2** | Decidir ampliaciones fuera del compromiso actual: varias réplicas/alta disponibilidad, análisis de PDF/fotos por CLI, historias de video/carruseles mixtos, transferencia de dueño de marcas o cifrado de disco. No son funcionalidades completas hoy. | `cooper/src/servicios/chat/locales.ts:42`; `cooper/README.md:193`; `docs/informes/cooper-marcas.md:69`; `docs/cooper-marcas.md:7`; `docs/informes/cooper-fase5.md:81`. **Sin frente aprobador**; no convertir límites explícitos en trabajo autorizado. |

## Conciliación de los 23 informes históricos

Esta tabla evita reabrir pendientes ya superados. Los documentos antiguos siguen siendo evidencia de su propia misión, no descripción exacta del corte actual.

| Informe / evidencia | Qué se conserva como pendiente y qué fue superado |
| --- | --- |
| `fase2-puente-n8n.md:57` | El puente ya tuvo aceptación real de lecturas posterior; permanecen estimaciones, incertidumbre y aprobación del lote nuevo (H02/H10/H20). |
| `cooper-fase3.md:60` | Consumo de presentación se implementó después; siguen calidad/identidad reales, purga y sondeo sin navegador (B04/H13/H14). |
| `cooper-fase4.md:63` | Número y WABA fueron dados de alta; envío integral, OTP, pago y recibos siguen pendientes (B03). |
| `cooper-fase5.md:77` | Ubuntu/SSH/DNS/HTTPS y restauración VPS fueron probados después. No repetir «falta VPS»; conservar aceptación/reboot y límites de recuperación (H06/B11). |
| `cooper-fase6.md:60` | Texto GPT tuvo una llamada real posterior; noticia completa, fuentes, respaldo y aceptación editorial continúan sin cerrar (B06). |
| `cooper-revision.md:115` | Defensas probadas localmente; antivirus/retención, dispositivos y coordinación por proceso siguen acotados (H07/H13/H18). |
| `cooper-ensayo.md:96` | Ensayo n8n aislado sí existe; no demuestra proveedores, OAuth ni publicaciones nuevas (B01/B04/B05). |
| `cooper-integracion.md:104` | Chat IA, WhatsApp y VPS fueron implementados después; persisten proveedores reales, retención y conciliación. La ampliación del propio informe supera «Avatar pendiente». |
| `cooper-final.md:109` | Muchos pasos de VPS ya cerrados por migración; el procedimiento de chat API fue ampliado por planes. No pedir otra vez IP/SSH/DNS o API como requisito único. |
| `cooper-vivo.md:185` | Puente/propiedad histórica aceptados; decisiones antiguas, medios seleccionados y costes siguen pendientes (B02/B04/H20). |
| `cooper-vivo-final.md:154` | Chat por planes y VPS posteriores superan su estado local; noticia y aceptación privada siguen pendientes. LCP histórico no invalida las mediciones posteriores. |
| `cooper-chat-ia.md:56` | Memoria de largo plazo posterior supera «solo 30 mensajes»; siguen evaluación semántica, PDF no analizado y acciones inciertas (H10/H16/B12). |
| `cooper-chat-planes.md:103` | CLI real probado en PC y relé posterior en VPS; persistencia de sesión/cuota, texto sin imágenes y falta de evaluación integral siguen vigentes. |
| `cooper-consolidar.md:120` | Revocación anterior sin cierre acreditado y calendario para lote; VPS ya existe. Seguridad y n8n-lote son sus frentes respectivos. |
| `cooper-whatsapp-alta.md:124` | Dominio ya existe; no atribuir por ello pago, OTP, firma, aprobación de plantillas o entrega exitosa (B03). |
| `cooper-vps-real.md:212` | Host operativo comprobado aquí. Copia externa y túnel ya avanzaron en frentes actuales; aceptación Google, Meta y entradas siguen separadas. |
| `cooper-pulido.md:103` | Código integrado; observabilidad/medios requieren lote y aceptación. No reconstruir historia inexistente ni afirmar que los medios siguen todos como maqueta. |
| `cooper-memoria.md:59` | Integración/migraciones locales ya cerradas por integración 3; calidad semántica real y retención no (H16/B08). |
| `cooper-cobertura.md:103` | Pantallas/contratos disponibles no equivalen a despliegue. Retienen límites de historial, volumen y cuentas (H02/H19/B05). |
| `cooper-marcas.md:66` | Migración integrada localmente; runtime, cuentas, conciliación, handoff de video y resultados globales siguen incompletos. |
| `cooper-animacion.md:108` | Pausa persistente y movimiento ampliados después; audio fonético no prometido. Dispositivos reales siguen pendientes. |
| `cooper-animacion-fuerte.md:85` | Integración posterior completada; celebraciones simuladas y revisión física/editorial no son aceptación de publicación real. |
| `cooper-integracion3.md:99` | Referencia vigente de código local: once migraciones y pruebas amplias. Su propio límite confirma que no actualizó VPS ni lote n8n. |

## Puerta de esta misión y evidencia local

La puerta de esta auditoría está en ejecución; este apartado se completa con el resultado final antes del commit. No se sustituye por los resultados históricos de integración 3.

Reproducción del hallazgo H11: se ejecutó **el archivo real** `tools/cooper/gastos.js` en `node:vm`, con reloj fijo `2026-11-21T02:00:00Z` y dos filas ficticias de `23:00Z` y `01:00Z`, importes 2 y 3. Resultado `dia=3`; ambos cargos pertenecen al 20 de noviembre de Lima, suma 5. No se consultaron gastos privados ni se modificó el código.

## Entrega, límites y estado para integración

Único cambio previsto: este informe. Commit documental identificable con `git log -1 -- docs/informes/faltantes-total.md`; no se atribuyen a esta rama commits de otros frentes. Se conservan `docs/misiones/AVISO-cooper-total.md`, `_comun.md` y `total-auditoria.md`, preexistentes sin seguimiento.

**Implementado:** el inventario, la clasificación A/B y las propuestas; **probado:** lectura remota y reproducción de H11, más la puerta que se registra arriba; **integrado:** no desde esta misión; **desplegado:** nada desde esta misión. Las propuestas no son trabajo aprobado. No se promete exhaustividad dinámica de cuotas/permisos/proveedores sin usarlos, ni que un estado transitorio del VPS persista después de su hora de corte. La revisión no es un pentest intrusivo ni una evaluación editorial real de modelos.

Texto propuesto para `docs/ESTADO.md`, que solo el integrador incorporará conservando todas sus secciones: «21-11-2026 Lima: auditoría `total-auditoria` documentada en `faltantes-total.md`; inventario de faltantes A/B, cobertura de siete frentes y misiones adicionales. Evidencia SSH de solo lectura fechada; producción final y decisiones humanas se conservan pendientes. Sin cambios de producto ni despliegue en esta misión». Mantener en **En curso** los cierres de despliegue/lote/chat/operación; en **Pendientes de Walter**, B01–B12; no mover la microserie ni otras **Ideas conversadas** a trabajo aprobado.

Fuentes oficiales consultadas para las operaciones efectivamente utilizadas: [OpenSSH](https://man.openbsd.org/ssh.1), [Docker inspect y formatos](https://docs.docker.com/reference/cli/docker/inspect/), [SQLite mediante Python y apertura URI de solo lectura](https://docs.python.org/3/library/sqlite3.html), [n8n Server CLI y distinción entre importar/publicar](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md). No se invocaron APIs de medios, Meta, YouTube, vidIQ o publicación para completar esta auditoría.
