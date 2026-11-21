# total-despliegue — aceptación de Cooper integrado

Actualizado: **2026-11-21 11:41 (Lima)**. Rama y worktree `total-despliegue`.

## Estado de esta continuación

**Cooper integrado desplegado a las 11:31 Lima; aceptación privada pendiente de sesión.** El primer intento fue rechazado por el bloqueo del orquestador. Tras su recuperación completa, el corte exclusivo terminó correctamente. Se actualizaron únicamente Cooper y su relé; n8n, runner, Caddy y los relés ajenos conservaron IDs, imágenes y fechas de arranque. No se hizo push ni merge. Las acciones históricas de otros trabajos se conservan al final de este documento.

La imagen procede de `cbf20685e07bf07566573825418d87799bed5ad9`, descendiente de `cooper-integracion3` (`de397f3`). Su árbol `cooper/` es idéntico al de la puerta final. Se construyó desde `git archive`, sin entornos, bases ni sesiones privadas. Podman usa formato Docker para conservar `HEALTHCHECK`; el primer intento OCI emitió un aviso y fue sustituido antes de desplegar. [Fuente, imagen y transporte](evidencias/total-despliegue/aceptacion/fuentes.json).

## Cambios y commits

- `8e20fec`: ajusta la evaluación de memoria/chat al contrato vigente de una frase de hasta 18 palabras y segunda frase solo para decidir; conserva las comprobaciones de aislamiento.
- `cbf2068`, `53f2839`, `a1232b3`, `03998e7`: corte exclusivo de Cooper y su relé; bloqueo compartido, rechazo de imagen cambiada o stack no saludable, respaldo frío, ensayo real sin red, reversa automática y conservación de datos del intento. Nunca opera n8n/runner/Caddy; verifica sus identidades antes/después.
- `403a9f0`, `72f0dfd`, `ca873fd`, `aa9a116`, `d261bbb`: aceptación pública con Playwright, videos a 1440/390 px, 22 rutas protegidas, revisión WhatsApp, acceso denegado y Google OIDC; sin OAuth ni cookies fabricadas.
- `948e103`, `25258dc`: Sentinel mide navegación repetida real y conserva resultados de ambos tamaños incluso si encuentra un problema. No se modificaron sus guardianes, evaluadores ni umbrales.
- `7ead008`: primera evidencia íntegra de puerta y preparación durante el mantenimiento concurrente.
- `b71bef6`: [procedimiento reproducible y alcance de la reversa](../cooper-despliegue-aislado.md).

## Puerta final

Ejecutada completa y secuencialmente: `cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`; después, desde la raíz, `node --test tests/flujos_v2.test.cjs`.

| Paso | Resultado |
| --- | --- |
| npm ci | rc 0; cero vulnerabilidades |
| lint | rc 0; cero errores/advertencias |
| typecheck | rc 0 |
| unitarias | 284/284, 30 archivos |
| Playwright | 43/43; sin omisiones ni reintentos |
| build | rc 0 |
| flujos v2 | 148/148 |
| despliegue Python, `-W error` | 48/48; incluye fallo con recuperación y rechazo de mantenimiento incompleto |

Los siete pasos de la puerta terminaron sin errores ni advertencias. [Resultados y tiempos](evidencias/total-despliegue/aceptacion/puerta.json), registros individuales y manifiesto SHA-256 en la misma carpeta. La primera ejecución encontró el texto antiguo del test; la segunda encontró Chromium de Sentinel ausente. Se corrigió el test y se instaló el navegador requerido, luego se repitió toda la puerta. No se desactivaron pruebas ni guardianes.

## Despliegue y reversa comprobados

Corte **11:30:31–11:31:09 Lima**. Imagen anterior `05d833787525fa98b183b3934ef13bd5dff1ca76` → imagen del commit `cbf20685e07bf07566573825418d87799bed5ad9`. Imagen Docker desplegada: `sha256:84b577955f6ba209e406916a5db61dbc7ea0088b88171380f401f094de59ff6e`.

- Copia fría de Cooper en `/var/lib/cooper-operacion/solo-cooper-20261121T163031Z/respaldo`, bajo directorio 0700; configuración de Caddy conservada. No se copió ningún `.env`, clave del host ni certificado privado.
- SQLite **8→11 migraciones**, integridad y claves foráneas correctas, conteos de las **21 tablas anteriores** preservados en el ensayo.
- La copia restaurada coincide byte a byte con el respaldo y arrancó con la imagen anterior, sin red ni puertos. **Reversa aislada real PASS**; no se provocó una reversión de tráfico después de abrir la nueva versión.
- HTTPS `/api/salud` respondió 200/ok. El diario vivo coincide con el ensayado. Caddy no necesitó recarga; se conservaron su archivo y servicio.
- El recibo registra las identidades completas antes/después de los cinco servicios ajenos y verifica igualdad exacta. [Recibo del VPS](evidencias/total-despliegue/aceptacion/despliegue.json).

La copia específica de este corte permanece en el VPS. Los respaldos restic y la réplica anteriores no se invocaron desde este frente porque administran el stack completo. Una reversa posterior exige preservar y conciliar actividad nueva antes de restaurar.

## Validación pública

TLS 1.3 con CA/hostname verificados, certificado hasta 19-feb-2027 y HTTP→HTTPS 301: [evidencia](evidencias/total-despliegue/aceptacion/tls.json). Google declara OIDC y el callback exacto `https://cooper.cooperestudio.com/api/auth/callback/google`; no se inició autenticación.

**Playwright final PASS en producción:** 22 rutas privadas redirigen a entrada (incluidos detalle de canal/video y revisión WhatsApp), seis APIs responden 401 sin sesión, Google OIDC/callback correctos. Entrada normal y aviso de acceso denegado a 1440×900 y 390×900: cero errores/advertencias de consola, cero desbordamientos y cero violaciones axe AA. [Resultados](evidencias/total-despliegue/aceptacion/publico.json), [escritorio](evidencias/total-despliegue/aceptacion/entrada-1440.png) y [móvil](evidencias/total-despliegue/aceptacion/entrada-390.png), inspeccionados visualmente.

Dos videos VP9/WebM de **45,20 s y 43,96 s**, decodificados íntegramente con FFmpeg sin errores. [Índice local](../../cooper/.cache/total-despliegue-aceptacion/publico/index.html), [escritorio](../../cooper/.cache/total-despliegue-aceptacion/publico/entrada-y-acceso-1440.webm), [móvil](../../cooper/.cache/total-despliegue-aceptacion/publico/entrada-y-acceso-390.webm) y [metadatos/SHA-256](evidencias/total-despliegue/aceptacion/videos.json). Las grabaciones muestran entrada y protecciones anónimas; **no son recorridos autenticados del interior privado**.

**Sentinel final PASS en producción:** recorridos y estabilidad de la entrada normal/acceso denegado, en ambos tamaños, sin hallazgos. Host exacto autorizado, TLS validado, guardianes activos, autenticación y mutaciones excluidas. [Resumen](evidencias/total-despliegue/aceptacion/sentinel-resumen.json); informes y series por tamaño en la misma carpeta.

Se conservan dos hallazgos previos de latencia, sin ocultarlos: 477→1023 ms en 14 descargas de la única carga inicial, y 890→1937 ms en 56 peticiones durante navegación con la grabación concurrente. El primer conjunto terminó en los primeros 2,3 s; el evaluador compara también archivos estáticos. Al ejecutar navegación repetida **sin la grabación en paralelo**, el hallazgo no se reprodujo en ninguno de los tamaños. Esto no demuestra latencia constante ni sustituye mediciones de campo. [Primera señal](evidencias/total-despliegue/aceptacion/sentinel-carga-inicial.json), [navegación concurrente](evidencias/total-despliegue/aceptacion/sentinel-concurrente.json) y sus series permanecen versionadas. No se cambió el producto ni se debilitaron umbrales para lograr el resultado.

La sonda previa contra la imagen antigua se detuvo en una ruta nueva inexistente; otro intento detectó un selector ambiguo entre el aviso y el anunciador de Next. Se corrigió únicamente el selector del arnés. La ronda final completa pasó. El navegador compartido no está disponible y no se encontró Chromium de usuario accesible por Playwright; no se leyeron cookies, sesiones ni archivos `.env` reales. **El login real y todas las vistas privadas siguen sin acreditar en producción.**

Comprobación final a las **11:39:55 Lima**: imagen exacta esperada, servicio saludable, once migraciones, integridad correcta y cero fallos de claves foráneas. [Evidencia](evidencias/total-despliegue/aceptacion/integridad-final.json). La rama conserva sus commits propios; el orquestador integra. El commit de cierre se identifica con `git log -1 -- docs/informes/total-despliegue.md`.

## Pendientes de Walter y coordinación

1. **Orquestador:** integrar los commits de esta rama y coordinar cualquier actualización posterior de los otros frentes. Este despliegue contiene integración 3 y el chat ya presentes en `total-despliegue`; no declara desplegada la imagen candidata `169d0cd` del registro histórico.
2. **Walter:** completar el login Google y facilitar una sesión existente autorizada para el recorrido privado de producción. La misión prohíbe iniciar OAuth; la entrada y los rechazos anónimos no acreditan ese login ni las pantallas privadas.
3. Revisión humana en teléfono/Safari y los pendientes anteriores de Meta, medios/publicación, presupuestos y aceptación de los otros frentes permanecen vigentes.

---

# Registro histórico previo (hasta 11:02 Lima)

Lo que sigue conserva el trabajo anterior. Sus referencias a imagen final no desplegada y operación n8n pertenecen a ese cierre histórico, no a esta continuación limitada a Cooper.

# cooper-total — operación instalada y ensayos de despliegue

Actualizado: 21-11-2026, 11:10 (Lima). Frente `total-despliegue`, continuación de `total-operacion`. La aplicación final todavía no se ha desplegado por este frente; el orquestador conserva el turno de escritura en el VPS.

## Commits

- `c8751ad`: ensayo de migración Cooper sobre copia SQLite, sin red, con reversa a la imagen anterior.
- `6aa98ff`: rechazo controlado de sobres del monitor fuera del esquema.
- `fd654c4`: ensayo n8n real de columnas/importación inactiva y recuperación exacta.
- `658385f`: réplica ejecutable desde systemd de usuario; aislamiento SSH y corrección de metadatos UID al restaurar.
- `331b925`: publicación aislada opcional por plan validado, comprobación de versiones/ajenos y reversa posterior; recibo ligado al hash del plan.
- `723fa91`: Vigilante envía categorías cerradas, omite error crudo y construye enlaces con origen fijo e ID validado; secreto ficticio y URL de proveedor no se propagan.
- Base operativa: `2aaeb9a`, `033da1f`, `24ca1bb`; puerta y auditoría en [total-operacion](total-operacion.md).

## Cerrado y probado en infraestructura real

**Copia fuera del VPS sin coste.** El repositorio restic cifrado se replica a `~/.local/share/cooper-copias-vps/actual`. `cooper-replica-pc.timer` está habilitado y activo; su servicio terminó con `Result=success`, `ExecMainStatus=0` a las 10:44:56. Verificó todo el repositorio, restauró 25 archivos y dos bases y registró el recibo en el VPS. `Linger=yes` ya estaba configurado. La contraseña se consume por su ruta preexistente; no se leyó ni transportó su valor.

La primera ejecución por systemd falló al restaurar metadatos: `PrivateTmp` en el gestor de usuario producía un mapa UID limitado y `lchown: invalid argument` para los UID del VPS. Se retiró esa opción, manteniendo `NoNewPrivileges` y temporales privados 0700. La ejecución completa posterior pasó. Todos los fallos conservaron la generación anterior verificada.

**Monitor y Telegram.** Instalados `/opt/cooper/deploy/{monitor.py,monitor-validar.js,generar-monitor.py,registrar-replica.py,operar.py}`. El timer del VPS está habilitado y activo. El workflow `CooperMonitor01` reutiliza la referencia de credencial y destinatario del nodo `Avisar error`, en `F · Vigilante de errores`; no se extrajo el token.

Secuencia real probada: importación inactiva → publicación → sonda firmada aceptada → despublicación con HTTP 404 → republicación → firma inválida rechazada con HTTP 401 → sonda válida aceptada → aviso operativo aceptado por Telegram. El resultado final indica `salud=PASS`, `problemas=[]`, `entrega=true`. Los 34 workflows anteriores conservaron IDs, estado activo y versiones. Export previo y metadatos: `/var/lib/cooper-operacion/total-monitor/`; resultado seguro: `resultado.json`.

**Arranque.** `cooper-stack.service` está instalado y habilitado. Incorpora el overlay del chat y respeta mantenimiento. La comparación previa mostró que arrancarlo recrearía los tres relés, por lo que se cedió al orquestador esa prueba coordinada. No se ha probado un reinicio físico del VPS en este frente. No se reinició la PC, el túnel ni servicios ajenos.

## Respaldo y ensayos comprobados

Copia fría real del VPS, restaurada y verificada, snapshot:

`04cd7f6f06672e24e34d7c8baa64139a2870e61cf2504d6217f1f533a6d1112c`

Repositorio: `/var/backups/cooper-restic`. Recibo: `/var/lib/cooper-operacion/ultima-copia.json`. Manifiesto dentro del snapshot: `/datos/manifiesto.json`. Contiene 25 archivos y dos bases; Cooper tenía ocho migraciones, n8n 34 workflows. Esta copia precede a la instalación del monitor; el orquestador hará otro corte antes del lote final.

La imagen preliminar `localhost/cooper:9c6ff870794b8a6f31585e399fcf90ff966412e8` migró una copia real de Cooper de ocho a once entradas, conservó 21 tablas anteriores y pasó integridad/claves foráneas. La reversa a `05d833787525fa98b183b3934ef13bd5dff1ca76` recuperó el respaldo y arrancó correctamente. Todo ocurrió con `--network none`, sin puertos y con autenticación ficticia. No demuestra todavía la migración de la imagen final integrada.

El ensayo Compose preliminar pasó siete bloques: HTTPS/cabeceras/editor privado; sesión Auth.js ficticia; runner 2.47.4, firma real y SSE; cinco reconexiones; restic y restauración; importación en volúmenes vacíos; actualización y reversa conjunta de imagen/datos. No se inició OAuth real.

El lote n8n **preliminar** real pasó sobre una copia aislada: cinco columnas nuevas e idempotentes, 32 workflows importados inactivos, 34→36 workflows totales. Las nueve tablas de negocio conservaron las 118 filas y sus hashes; workflows ajenos intactos. La reversa recuperó las 187 tablas, conteos e IDs/active/version. SHA256 SQLite antes y después de restaurar: `6a2b6724f53939715478a2fa76a95145378b4632c23f8b6122b6e874a8017450`. Entrada: `b9e7723a92c829a5ac12384d32de88371f9f78348128ba3a7c2b541387b4bc6d`. El lote final cambia M7 y requiere otro ensayo.

## Imagen final y aceptación aislada

**Probada** la imagen del código integrado exacto `169d0cdf1e3e47bc27c7d8e1790a0764515d2431`, construida desde su árbol Git. Identificador de imagen: `sha256:bdc46f46c3863f0ad0377bb06f1c66abb090eaca343ff321540afab725565121`. Archivo de transporte local: `cooper/.cache/despliegue/cooper-169d0cdf1e3e47bc27c7d8e1790a0764515d2431.tar.gz`; SHA256 `129c8a551bda81ae8b3f84ebf0f272611de9059f8c9b8117f3ef338dd31ca73e`, 110.161.991 bytes. Todavía no desplegada por este frente.

La migración final sobre la copia real pasó de ocho a once migraciones, conservó las 21 tablas anteriores y pasó integridad/claves foráneas. La reversa restauró el respaldo `1e6ae884276b70a481a1a55cd2cfb1689209ed90c41e53700a205d3da14df817` y arrancó la imagen anterior. Sin red ni puertos.

**Compose final: siete bloques PASS.** HTTPS y TLS verificado, cabeceras/editor privado; login ficticio con cookie segura; runner externo 2.47.4 y firma n8n→Cooper; SSE y cinco reconexiones; restic cifrado/restauración; export e import en volumen vacío; actualización/reversa conjunta conservando estado. El ensayo usó un worktree separado del SHA exacto y los servicios quedaron retirados. Dos intentos previos detectaron condiciones del arnés, no del producto: ruta de socket Unix demasiado larga y archivo exportado sin metadatos Git; se corrigió el contexto y se repitió completo con salida cero. No se inició OAuth.

El **lote final ensayado inicialmente** (`581fedd8c786dbca4eae41fbe7bc19655ce52be372fde35dc379aac2ef513c85`) pasó importación y reversa: cinco columnas idempotentes, 32 workflows inactivos, nueve tablas/118 filas preservadas, 187 tablas restauradas, mismo SHA256 SQLite y mismos IDs/active/version. Este ensayo cubrió importación, no publicación: el orquestador encontró posteriormente una validación al republicar el cuarto flujo y restauró producción. La publicación secuencial de los 22 originales también se ensayó en un clon, un CLI por ID, sin red: 13 publicados y nueve rechazados. Siete rechazos corresponden a referencias a subflujos aún sin publicar; dos a credenciales ausentes (`8nqh0n7jewLQOikC` y `FabSonido0000001`). La salida privada se clasificó en memoria usando las plantillas del código fuente n8n 2.47.4; únicamente se conservaron ID/código/categoría/estado. No se leyó ni descifró el contenido de credenciales. No hay ciclos estáticos entre los 22, pero el orden original no respeta sus dependencias. Tres dependencias pertenecen a los pausados: `FabYouTube000001`, `FabRadar00000001` y `FabConfirmar0001`. La sección siguiente documenta la solución ensayada antes de otro intento. El hotfix del Vigilante se incluyó en el lote FINAL3 ensayado.

Para desplegar la imagen, el orquestador debe conservar los scripts `deploy/` de la última integración: incluyen correcciones operativas posteriores al SHA de la imagen. No reemplazarlos por el archivo de fuentes usado en la compilación.

## Publicación segura tras identificar los bloqueos

Se ensayó una solución explícita sobre otro clon, sin alterar la fuente canónica: reemplazar exclusivamente los cuatro nodos sin credencial por nodos Code que lanzan `Falta configurar HeyGen/ElevenLabs; paso bloqueado.`. Se retiran credenciales, reintentos y continuación tras error de esos cuatro nodos. Sus cuerpos se ejecutaron como regresión: los cuatro lanzan error, sin resultado de éxito simulado. El preparador definitivo conserva esta transformación en un diff auditable y la implementación original en la fuente/respaldo.

Para satisfacer las dependencias se incluyeron tres subflujos antes pausados, conservando su entrada `executeWorkflowTrigger` y deshabilitando exclusivamente `Cada hora` (Confirmar), `Cada mañana (radar)` y `Vuelta de Google` (YouTube). Ninguna de esas tres entradas externas se abrió. Los 25 IDs se publicaron con el CLI oficial en orden topológico: **25/25 PASS**, sin red y sin ejecutar proveedores. El plan seguro y cada código de salida se adjuntan a la evidencia. Esto demuestra validación/publicación; no demuestra que una credencial real pueda producir contenido.

El arnés `ensayar-n8n.py --publicar <plan.json>` ya verifica ese orden, el estado activo y la versión de cada flujo, las filas y los workflows ajenos; posteriormente restaura la copia exacta. Su recibo incluye `publicacion`, `publicados` y `publicar_sha256`. El lote definitivo FINAL3 pasó ese arnés: entrada SHA256 `955344e94ab52eb91eeb8d8281b7bdae53008d1687d1a8074b23263a1cad758c`, plan `5bb99302ce5445ca98114ae5c50fb553d7b64285a5a87b201fcfe543a662f758`; importación de 32, publicación de 25, cinco columnas idempotentes, versiones y ajenos verificados. La reversa recuperó las 187 tablas y el SHA256 SQLite original; nueve tablas/118 filas preservadas. Recibo completo en la evidencia. La aplicación real permanece bajo el turno del orquestador.

## Puerta y evidencia

La puerta completa de operación ya pasó: npm ci/lint/typecheck/build, 284 unitarias, 43 E2E con Sentinel y 147 pruebas de flujos, cero errores/advertencias. Véase [evidencia de operación](evidencias/total-operacion/). Los cambios posteriores de este frente solo afectan despliegue: 46 pruebas Python con `-W error` y `git diff --check` pasan tras ampliar el arnés de publicación. El hotfix del Vigilante añade una regresión: 148/148 pruebas de flujos pasan, incluida la no divulgación de una credencial ficticia en errores conocidos, desconocidos, del disparador y en URL recibidas. El orquestador está ejecutando la puerta integrada de la aplicación final; no se sustituye esa puerta con estos ensayos.

[Evidencia segura del frente](evidencias/total-despliegue/): logs de compilación preliminar/final, migración, Compose, lote n8n, regresiones y estado real de unidades/monitor/recibos. No incluye bases, exports privados, credenciales ni entornos.

## Límites reales y Pendientes de Walter

1. Custodiar fuera de PC y VPS la configuración privada, contraseña restic y material de recuperación. La réplica cifrada no contiene `/etc/cooper/.env`, claves del host ni sesiones CLI.
2. La PC debe estar encendida para replicar. La copia diaria del VPS determina el RPO; replicar cada hora no genera snapshots nuevos.
3. Telegram depende del n8n del VPS. Durante una caída total no puede avisar; conserva el estado y reintenta/informa recuperación. Un aviso durante esa caída necesita un canal independiente.
4. Google real, decisiones de Meta, pagos y publicaciones siguen bajo control humano. Este frente no hizo OAuth, pagos ni publicaciones sociales.

## Trabajo todavía en curso del orquestador

Aplicación real del lote FINAL3, prueba coordinada de stack, despliegue, puerta integrada y dos rondas Sentinel/Playwright con videos. La candidata169, su migración/reversa y los siete bloques Compose pasaron; nuevas correcciones de la integración y H09 (runtime Marcas) requieren otra imagen antes de la aceptación definitiva. No se declaran terminados esos pasos.

Fuente oficial cotejada para export/import/publish/unpublish: [Server CLI de n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md). Referencias de restic/systemd/Telegram en [operación](../cooper-operacion.md).

El campo `execution.id` y la ausencia de ID en fallos de disparador se cotejaron en [manejo oficial de errores n8n](https://docs.n8n.io/build/flow-logic/handle-errors-gracefully.md). El nodo seguro ignora siempre `execution.url`.
