# Total observabilidad

21-11-2026, Lima. Rama y worktree propios `total-observabilidad`, creados desde
`total-integrador` en `deb1f2a566d06d7f36fd540e6756863dd136cb89`.
Implementado localmente; integración, despliegue y aceptación viva no realizados.
No hubo push, merge a ramas protegidas, cambios del VPS/n8n vivo, OAuth, pagos,
publicaciones ni envíos Telegram. Los dos archivos de misión sin versionar que
existían al comenzar se conservaron fuera de los commits.

## Cambios

- Panel administrativo `/admin/salud`, enlazado desde Administración: ejecuciones,
  fallos con causa clasificada, workflows activos, disco, memoria, certificados,
  copias y servicios; producción, videos sin avance y costes. Lecturas parciales,
  fuentes ausentes/vencidas y simulación se muestran expresamente.
- Controles existentes enlazados para videos, decisiones, incidencias, conciliación
  y ajustes. Las aprobaciones y las pausas no se confunden con atascos; una fecha
  futura de publicación tampoco oculta un video atascado antes de estar listo.
- Umbrales editables con revisión/confirmación, CAS y auditoría SQLite. Telegram
  apagado por defecto; trabajador sin navegador, reserva durable, deduplicación
  por condición/severidad, recordatorios, recuperación y recibos inciertos.
  La espera del transporte no detiene nuevas evaluaciones ni se elimina al
  guardar configuración. La recuperación pendiente sobrevive a dos recibos perdidos.
- Proyección aditiva saneada del monitor del host, escrita atómicamente; overlay
  opcional monta solo esa proyección en lectura. Mantiene el monitor y sus avisos
  anteriores. No se montan secretos, recibos privados ni socket Docker en Cooper.
- Permisos revalidados en servidor, origen/JSON/límites de API, consultas n8n GET
  acotadas, redirecciones bloqueadas y errores privados excluidos. Sin dependencias
  de paquetes nuevas ni migración SQL; se reutilizan el puente, controles y `events`.

Tres subagentes trabajaron en fuentes, panel y recolector. La revisión cruzada
encontró y corrigió la recuperación falsa de una fuente parcial, la demora de
evaluación tras un timeout y la doble pérdida de recibos de Telegram.

## Commits

| Commit | Contenido |
| --- | --- |
| `c213079` | Fuentes administrativas de n8n, VPS y fábrica, contrato y pruebas. |
| `8f75aa2` | Umbrales, ruta administrativa y trabajador de alertas durable. |
| `24f0738` | Panel, navegación y pruebas de navegador. |
| `b406be2` | Recolector saneado, overlay y documentación operativa. |
| `e8eaba3` | Una fecha futura no oculta producción sin avance. |
| `e489a7c` | Conserva recuperación pendiente después de dos recibos inciertos. |
| `b24963b` | Aísla avisos del anunciador Next y restablece configuración/invitación de ensayo. |
| `05e3290` | Reutiliza la cuenta ficticia existente y acredita que Salud no consume cupos. |
| `a7dfb5d` | El ensayo de Montajes selecciona los campos accesibles de la marca actual. |

El commit de cierre documental contiene este informe, la actualización de
`docs/ESTADO.md`, la guía, el enlace del README y las evidencias; no modifica código
después del corte ensayado.

## Verificación

**Puerta final PASS**, corte `a7dfb5dfdaec967b2e4f5c0c3e19c1c1eb80dd58`,
checkout limpio. Inicio 21-11-2026 19:00:37 y fin 19:17:46, Lima.
Cero errores, advertencias, omisiones y reintentos de pruebas.
[Recibo completo del arnés](evidencias/total-observabilidad/puerta.json).

| Paso | Resultado | Advertencias |
| --- | --- | --- |
| `npm ci` | RC 0 | 0 |
| Preparación reproducible de Sentinel/navegadores | RC 0 | 0 |
| `npm run lint` | RC 0 | 0 |
| `npm run typecheck` | RC 0 | 0 |
| `npm test` | 506/506, 52 archivos, RC 0 | 0 |
| `npm run test:e2e` | 108/108, RC 0 | 0 |
| `npm run build` | RC 0 | 0 |
| `node --test tests/flujos_v2.test.cjs` (raíz) | 235/235, RC 0 | 0 |

La matriz incluye Sentinel, Chromium, Firefox y WebKit, además de los cinco
nuevos recorridos de Salud. El cierre documental posterior no modifica el código
ensayado. Checkout/log completos conservados localmente en
`.cache/ci-limpia-23Lm0E/checkout` y
`cooper/.cache/total-observabilidad-puerta-a7dfb5d.log`; el recibo versionado incluye
las huellas de cada paso, herramientas y procedencia del archivo limpio.

La puerta completa se ejecutó mediante `cd cooper && npm run ci:limpia`: el arnés
versionado crea un checkout del commit, prepara Sentinel privado verificado y usa
Debian 12 sin montar HOME, sockets, entornos reales ni publicar puertos. Ejecuta
`npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`,
`npm run build`, y desde la raíz `node --test tests/flujos_v2.test.cjs`.

La preparación inicial directa en el host rechazó su plataforma antes de iniciar
E2E. Se respetó esa guardia y se usó el contenedor prescrito. La primera puerta
sobre `e8eaba3` se interrumpió deliberadamente durante E2E para repetirla con la
corrección posterior de recibos; no cuenta como puerta aprobada. El cierre registra
por separado la puerta del código final.

La puerta sobre `e489a7c` encontró dos selectores que incluían el anunciador vacío
de Next y un usuario ficticio sin retirar que agotaba el cupo antes de WhatsApp.
Se interrumpió tras esos tres fallos para corregir el arnés; el cierre del navegador
durante el caso de capturas demo fue consecuencia de esa interrupción. Selectores
acotados a `main` y limpieza en `finally`, sin relajar aserciones ni límites de
producto. Repetición focal Salud + WhatsApp: 6/6 PASS, lint/tipos RC 0. Esta
repetición no reemplaza la puerta limpia completa.
[Diagnóstico y huellas](evidencias/total-observabilidad/diagnostico-e2e.json).

La repetición completa sobre `b24963b` pasó los cinco casos de Salud, pero mostró
que retirar la invitación conservaba la cuenta creada y agotaba el otro límite,
el de diez usuarios, al iniciar sesión en WhatsApp. Se interrumpió para corregir
esa contaminación de la suite. `05e3290` reutiliza a Ana, la cuenta normal existente,
y comprueba que no cambian los usuarios ni los accesos previos. Focal con cuenta
ya existente: 8/8 PASS; con datos iniciales vacíos: 6/6 PASS. No se cambiaron los
límites del producto ni se borraron cuentas reales.

La puerta de `05e3290` completó E2E con 107 aprobadas y un fallo en el ensayo
preexistente de Montajes: `getByLabel` encontraba también una copia oculta durante
la transición. `a7dfb5d` usa rol `textbox` y nombre accesible en sus tres campos,
según la [documentación oficial de Playwright](https://playwright.dev/docs/api/class-page#page-get-by-role-option-include-hidden).
No se añaden pausas ni se relajan comprobaciones. Tres rondas independientes de
Marcas + Montajes pasaron 2/2 cada una (6/6), con bases y servidores nuevos. El
diagnóstico previo con `--repeat-each` compartía la cuenta de identificador fijo,
se interrumpió y no se acepta como prueba. [Puerta anterior rechazada](evidencias/total-observabilidad/puerta-05e3290-fallida.json).

Pruebas adicionales del recolector: 17 nuevas y 18 regresiones del monitor, RC 0,
con `python3 -W error -m unittest discover`, sin advertencias. Ensayos con
temporales, TLS/Docker/HTTP ficticios y ningún servicio vivo.
[Recibo con comandos y huellas](evidencias/total-observabilidad/recolector.json).

La regresión de doble incertidumbre se reprodujo en rojo (esperaba tres despachos,
obtuvo dos) y se corrigió; la suite de avisos pasó 14/14, lint y tipos RC 0.
Logs locales: `cooper/.cache/alertas-recuperacion-rojo.log` y
`cooper/.cache/alertas-recuperacion-verde.log`. El rojo es una prueba focal de
diagnóstico, no una puerta aprobada.

Revisión visual de las ocho capturas finales: salud operativa/degradada, ambos
temas y 390/1440 px. Cero violaciones axe y desbordamientos horizontales; sin
cortes, solapamientos ni importes partidos en la inspección visual. Se versionan
dos muestras y las huellas/rutas de las ocho: [manifiesto](evidencias/total-observabilidad/capturas.json),
[móvil oscuro](evidencias/total-observabilidad/degradada-oscuro-390.png) y
[escritorio claro](evidencias/total-observabilidad/degradada-claro-1440.png).

## Limitaciones reales

1. No desplegado ni probado con credenciales reales. La web no acredita salud del
   VPS hasta conectar su recolector y la API n8n. [Guía de configuración, fuentes
   oficiales y activación](../cooper-observabilidad.md).
2. n8n devuelve una muestra de hasta 200 ejecuciones/200 workflows (cuatro páginas
   por lista), y hasta diez causas detalladas redactadas. Los fallos de 24 horas se
   calculan dentro de esa muestra; no es un total histórico completo. Si faltan
   permisos, versión compatible o datos, la causa permanece genérica. La cobertura
   de workflows depende también de los recursos visibles para la clave.
3. Los contadores de fábrica se calculan sobre el estado del puente; el panel
   muestra hasta 200 videos y señala truncamiento. Las cancelaciones conservan el
   freno local de Cooper porque el puente actual no exporta un estado independiente
   de cancelación remota. Los costes pueden ser estimaciones; no concilia facturas.
4. El recolector aprovecha el timer de cinco minutos y publica memoria del host,
   no del contenedor. Un recibo de copia PASS no garantiza una restauración futura.
   Mantenimiento suspende sondas; el panel muestra un aviso sin afirmar recuperación.
5. El nuevo `monitor.py` depende de `observabilidad.py`. Los bundles certificados
   anteriores de 25 archivos no incluyen el módulo. El operador debe preparar un
   paquete/manifiesto/lista permitida nuevos con ambos archivos y aceptar el montaje
   del overlay. No se alteraron ni reemplazaron paquetes o recibos históricos.
6. Telegram no ofrece idempotencia de `sendMessage`; un envío sin recibo queda
   incierto y un recordatorio puede duplicarlo. El trabajador depende de Cooper
   activo; la caída total del VPS necesita un vigilante externo. El monitor histórico
   conserva sus umbrales y puede duplicar avisos al activar el nuevo canal.
7. La verificación de navegador usa sesiones ficticias y emulación; no equivale
   a Google real, teléfono físico ni lector de pantalla.

## Pendientes de Walter

- Revisar los umbrales propuestos, el destino Telegram y activar los avisos cuando
  la configuración del servidor esté aceptada. No hay claves en el formulario.
- Coordinar con el operador una futura release, después del despliegue concurrente
  de `total-cierre`: nuevo paquete del monitor, overlay, clave n8n de lectura y
  aceptación del panel con fuentes reales. Esta rama no se integra ni despliega.
- Elegir la cobertura externa ante caída total del VPS y decidir la convivencia
  de avisos históricos y nuevos. No se contrató ningún servicio.

Estos pendientes no impidieron la implementación ni las pruebas independientes.
