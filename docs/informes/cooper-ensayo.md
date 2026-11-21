# Cooper ↔ n8n: ensayo aislado

20 de noviembre de 2026. Base `23394d9` de `cooper-integracion`; rama propia `cooper-ensayo`, worktree `/home/david/Proyectos/cooper-wt/cooper-ensayo`. Los cambios ajenos del directorio inicial se conservaron. Sin push, merge, OAuth, pagos ni interacción con el contenedor/volumen/URL del n8n vivo o D&S Factory.

## Resultado y commits

El ensayo usa n8n **2.47.4** real en Podman, su API REST, nueve Data Tables y el grafo regenerado. Cooper corre en producción local con `COOPER_FABRICA=n8n`; únicamente la emisión de sesiones, los datos, los medios seleccionados y los fallos inducidos son ficticios. Administrador confirmado para el paso a vivo: **wdhg.xoxa@gmail.com**, exactamente como lo devuelve Google. El ensayo original utilizó la variante sin punto; sus evidencias históricas se conservan sin editar. La CLI y el ejecutor de futuros ensayos ya usan el correo corregido. Segunda cuenta: `ana@example.test`. El propietario interno de n8n es `owner@example.test`, con contraseña aleatoria de ensayo; no es un login Google.

| Commit | Contenido |
| --- | --- |
| `f4b97b8` | Migración REST idempotente, simulación, preimagen protegida y reversa; siete pruebas de contrato. |
| `9d8ed9c` | Corregir reentregas de órdenes confirmadas y atribución de trabajos; regenerar FX API y Llamar a Claude. |
| `a0dd73d` | Ejecutor reproducible, infraestructura aislada, fixtures, escenarios HTTP/navegador y guías. |
| Commit de este informe | Evidencias finales y procedimiento operativo; sin cambios al código verificado. |

Dos fallos reales reproducidos y corregidos:

- **Reentrega confirmada:** FX resolvía nuevamente el recurso y devolvía 409 «Identificador existente» al repetir una creación aceptada. Ahora consulta el recibo firmado antes de resolver: una confirmada termina sin despacho; una pendiente conserva 409; una nueva sigue la validación y reserva habituales. También se prueban reentregas después de aprobar y eliminar. La consulta no escribe ni convierte una orden desconocida en autorizada. [Reproducción roja](evidencias/cooper-ensayo/duplicado-rojo.log).
- **Trabajo sin dueño:** el guion recibía video/canal correctos, pero el trabajo quedaba con dueño vacío. El subflujo consulta las tablas antes de guardar, rechaza huérfanos/contradicciones y atribuye las investigaciones sin recurso al administrador. No confía en un dueño enviado en el pedido. [Reproducción roja](evidencias/cooper-ensayo/dueno-trabajo-rojo.log).

## Reproducción y aislamiento

```bash
cd /home/david/Proyectos/cooper-wt/cooper-ensayo/cooper
npm ci
npm run test:ensayo
```

Requiere Node 24, Podman rootless y `ghcr.io/n8n-io/n8n:2.47.4`. El ejecutor verifica la versión dentro del contenedor. La primera instalación de Chromium puede necesitar red; la instancia n8n usa `cooper-ensayo-red`, una red interna sin salida a Internet, comprobada también con una solicitud inocua que debe fallar. No reutiliza puertos ocupados. Solo publica n8n en `127.0.0.1`; Cooper y el emisor de sesiones también escuchan en loopback.

Genera secretos distintos en cada ejecución, fuera de Git y con permisos 0600. Se niega a arrancar si encuentra archivos `.env` de ejecución en el worktree; los procesos reciben una lista limitada de variables. No copia credenciales del generador. Permite `crypto`, habilita acceso a variables en Code y usa runner interno, apropiado aquí exclusivamente por tratarse de una instancia aislada sin datos reales. Desactiva telemetría, plantillas, avisos de versión y el catálogo MCP externo.

El callback atraviesa un enlace por stdin/stdout de `podman exec`: únicamente admite POST al receptor HMAC de Cooper. No abre conectividad general hacia el host ni modifica las firmas emitidas por los workflows. El cuerpo y la firma permanecen en memoria, sin volcarlos a los informes.

Importa los **28 workflows regenerados** por REST. Como esa API asigna IDs nuevos, los reasigna en dos pasadas y publica en orden de dependencias, empezando por el gestor de errores. En la copia local apaga todos los `allow*`, retira credenciales y deshabilita Telegram, cron y webhooks legados. Publica FX y sus subflujos; los puntos de entrada ajenos al puente quedan inactivos. Un workflow adicional de fixtures llama únicamente a los subflujos reales de progreso, presentación y costo, autenticado con el token efímero.

Cada repetición conserva y renombra el contenedor anterior detenido, crea otro volumen en `~/.cache/cooper-ensayo/run-*` y termina deteniendo **cooper-ensayo-n8n**, sin borrarlo. También cierra Cooper, el emisor y el enlace de callbacks. Rechaza nombres ocupados por contenedores ajenos o en ejecución. El archivo `~/.cache/cooper-ensayo/actual.json` identifica el último volumen y puerto sin incluir secretos. Los artefactos locales están en `cooper/.cache/e2e-ensayo-*`.

## Evidencias de cierre

Código verificado: `a0dd73d79c67e38bd38278741ab217d454a9425d`. **PASS, códigos de salida 0; puerta completa sin errores ni advertencias, sin pruebas omitidas.** Node 24.22.3, npm 12.2.2, Podman 6.2.0, n8n 2.47.4, Next 16.4.6. Los rechazos y fallos de transporte provocados por los escenarios son resultados esperados de esas pruebas, no fallos de la puerta.

| Comprobación | Resultado |
| --- | --- |
| `npm run test:ensayo` | rc 0; **7 pruebas de migración y 17 verificaciones funcionales**. [Log](evidencias/cooper-ensayo/ensayo-final.log), [resultado](evidencias/cooper-ensayo/resultado.json). |
| `cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build` | rc 0; instalación con **0 vulnerabilidades**, lint/tipos/build correctos, **117 pruebas Vitest y 22 E2E**. [Log íntegro](evidencias/cooper-ensayo/puerta-final.log). |
| Desde raíz: `node --test tests/flujos_v2.test.cjs` | rc 0; **119 pruebas**, cero fallos/omisiones. `TMPDIR` se dirigió a `cooper/.cache` y `PYTHONDONTWRITEBYTECODE=1`. [Log](evidencias/cooper-ensayo/flujos-final.log). |
| Regeneración determinista, `git diff --check`, estado final del contenedor | rc 0; **28 JSON inactivos idénticos byte a byte** tras regenerar; contenedor `exited`. [Hashes](evidencias/cooper-ensayo/regeneracion.json), [instancia](evidencias/cooper-ensayo/instancia-final.json). |

Último ensayo: `cooper/.cache/e2e-ensayo-dIiHSx`. Volumen conservado: `/home/david/.cache/cooper-ensayo/run-ieqFKO/n8n`. Puerto reservado de esa instancia detenida: **36111**, publicado exclusivamente en loopback. Imagen: `sha256:f49b85f2bb0a492feeae78bedb406317c0b14a268076df11aee91878cac2faa6`. La huella del OpenAPI consultado está en el manifiesto de la instancia.

[Resumen de callbacks](evidencias/cooper-ensayo/escenarios.json): **62 entregas**, incluidos **7 fallos inducidos** — dos de progreso y cinco de confirmación. [Auditoría de ejecuciones persistidas](evidencias/cooper-ensayo/ejecuciones.json): 60 registros, 59 exitosos y una detención esperada en `Detener presentación`; ningún fallo inesperado. Capturas reales revisadas a 390 px: [presentación pausada](evidencias/cooper-ensayo/presentacion-pausada-390.png) y [videos de Ana](evidencias/cooper-ensayo/videos-ana-390.png). [SHA-256 de las evidencias](evidencias/cooper-ensayo/SHA256SUMS.txt).

El ensayo verifica migración sobre **111 filas históricas**, incluyendo 103 costos para atravesar varias páginas; `--simular` no escribe; la segunda pasada no propone cambios; la reversa se simula, aplica y repite. Después añade la cuenta ajena y comprueba que la migración ordinaria conserva su dueño. El esquema combina [columnas base del ensayo](../../contratos/cooper-tablas-ensayo.json) con [la migración declarativa](../../contratos/cooper-migracion-tablas.json).

Con dos cuentas se prueban creación sin presentador, consulta por dueño, trabajos atribuidos, token inválido, rol falsificado, recurso ajeno, callback HMAC válido/inválido/duplicado y mismo ID con cuerpo distinto. Dos fallos de callback se recuperan con los reintentos reales de n8n sin duplicar eventos. Se cierran las aprobaciones de guion y final con contexto guardado, se programa, se elimina video/canal en reposo y se rechaza eliminar durante producción. Los gastos solo llegan al administrador; el subflujo de costos conserva un solo paso y toma el dueño de las tablas.

Se interrumpe la **confirmación después del despacho real** de una programación: la orden queda reservada, la repetición devuelve 409 y no vuelve a programar. Tras comprobar la fila remota, se reenvía la confirmación firmada original y la reentrega termina sin efectos adicionales. Las reservas inciertas no se liberan automáticamente.

El recurso de demostración devuelve 422 recuperable. Un avatar con referencia ficticia de producción se persiste y el guardia real lo pausa porque Ajustes está apagado, conservando la elección y sin crear gasto. SSE excluye recursos ajenos, costos e IDs remotos. Chromium móvil comprueba la pausa visible y el aislamiento. Se revisan las ejecuciones persistidas: solo se aceptan los fallos inducidos de confirmación y la detención deliberada de presentación; cualquier otro fallo hace fallar el ensayo. FX conserva su política de no guardar datos de ejecución, por lo que el historial no representa todas las llamadas HTTP.

## Comando exacto de migración en vivo — solo Claude

No ejecutado en vivo por la misión de ensayo. Walter autorizó posteriormente el paso a vivo con el correo con punto; ver [estado de esa misión](cooper-vivo.md). Desde la raíz del worktree aprobado, con entradas/cron cerrados y respaldo previo. Claude prepara **fuera de Git** `N8N_URL` (origen base, sin `/api/v1`), `N8N_API_KEY` exportada y `RESPALDO_COOPER` (directorio privado existente). La clave requiere `dataTable:list`, `dataTableColumn:create`, `dataTableRow:read` y `dataTableRow:update`. No imprimirla ni pasarla como argumento.

```bash
node tools/migrar_dueno.mjs --url "$N8N_URL" --admin wdhg.xoxa@gmail.com --asignar-todo-al-admin --simular
node tools/migrar_dueno.mjs --url "$N8N_URL" --admin wdhg.xoxa@gmail.com --asignar-todo-al-admin --aplicar --respaldo "$RESPALDO_COOPER/duenos-antes.json"
node tools/migrar_dueno.mjs --url "$N8N_URL" --admin wdhg.xoxa@gmail.com --simular
```

La última orden debe mostrar cero columnas y cero filas pendientes. `--asignar-todo-al-admin` aplica **la decisión histórica expresa de Walter**, incluso ante un dueño previo distinto, dejando su preimagen en el diario. Usarla solo una vez sobre el histórico con entradas cerradas; después de incorporar cuentas ajenas, omitirla. Sin esa opción el script conserva dueños explícitos, deriva los demás por canal/video y rechaza contradicciones. Rechaza además tablas ausentes/duplicadas, tipos incompatibles, identificadores duplicados, fechas inválidas y huérfanos antes de escribir.

El diario se crea con `wx` y modo 0600 antes de la primera mutación. Si se interrumpe, conservarlo: no sobrescribirlo. Simular de nuevo permite preparar un segundo diario para los cambios restantes; revertir diarios en orden inverso si fuera necesario. Las escrituras son por API y por fila, sin transacción distribuida: es obligatorio mantener las entradas cerradas. El script detecta cambios en los campos afectados antes de cada escritura, pero eso no sustituye el cierre operativo.

## Pasos de Claude en vivo, con respaldo y reversa

1. Revisar los commits y las evidencias. Cerrar órdenes de Cooper/Telegram y cron; inventariar ejecuciones activas y formularios pendientes. No cambiar ejecuciones antiguas en marcha suponiendo que adoptarán el grafo nuevo.
2. Exportar workflows con IDs y versiones, esquemas y filas de Data Tables, y lista de activaciones. Respaldar el volumen n8n detenido y SQLite de Cooper mediante un procedimiento consistente, con permisos privados y sin credenciales en Git. Comprobar la restauración en otra copia aislada antes de continuar.
3. Verificar nombres/IDs de tablas contra `T` del generador. Si difieren, ajustar la configuración y regenerar el lote revisado. No crear tablas paralelas para ocultar discrepancias. Ejecutar los tres comandos anteriores; conservar el diario y revisar cero huérfanos/contradicciones.
4. Revisar guiones y decisiones históricas. El script deja guion vacío cuando no hay uno migrado y **no inventa** contexto de aprobación ni cambia etapas. Recuperar el último guion validado, resolver formularios antiguos y recrear decisiones de guion/final mediante el circuito nuevo. Conservar las decisiones del operador para canal/storyboard/gasto.
5. Aplicar las migraciones de Cooper (`cd cooper && npm ci && npm run db:migrate`) sobre su volumen correcto. Preparar primero esta versión de Cooper: acepta la fase aditiva `consultar`; el nuevo FX requiere ese receptor. Mantener sesiones E2E y emisor fuera de producción.
6. Configurar secretos del puente fuera de Git, el administrador confirmado, callback/origen correctos y relojes sincronizados. Configurar `crypto` y las variables del runner apropiado al entorno real; no trasladar la relajación de aislamiento del runner de ensayo a una instancia con datos sensibles sin revisión. Mantener proveedores apagados.
7. Importar con los IDs vivos existentes, usando actualización de workflows, sin sustituirlos por IDs del ensayo. Publicar primero errores, Ajustes, progreso/costos, validación de presentación y dependientes; respetar el orden de referencias estáticas que valida n8n. Revisar asociaciones de credenciales fuera de Git y publicar FX al final. No importar el workflow auxiliar de fixtures ni los JSON adaptados de `.cache`.
8. Con Cooper en modo n8n, validar primero estado por dueño y panel administrativo, luego el lote autorizado de operaciones. Comprobar recibos, decisiones, callbacks y gasto. No habilitar cron o proveedores hasta la decisión de Walter; la aceptación del puente no acredita un render ni una publicación externa.
9. Si falla: cerrar entradas, despublicar FX y cron nuevos, preservar órdenes/recibos y ejecuciones, conciliar operaciones ya despachadas y restaurar las versiones de workflows respaldadas. Mantener columnas aditivas. No borrar idempotencia para forzar reintentos ni restaurar a ciegas un SQLite anterior a órdenes ya aceptadas.
10. Si es necesario revertir los campos migrados, con entradas aún cerradas:

```bash
node tools/migrar_dueno.mjs --url "$N8N_URL" --simular --revertir "$RESPALDO_COOPER/duenos-antes.json"
node tools/migrar_dueno.mjs --url "$N8N_URL" --aplicar --revertir "$RESPALDO_COOPER/duenos-antes.json"
```

La reversa valida el origen, compara los valores posteriores con el diario y se niega a pisar cambios posteriores. Es idempotente y **no borra columnas**. Ante un conflicto, conservar evidencia y conciliar; restaurar el respaldo completo solo mediante el procedimiento operativo y después de resolver trabajo remoto ya enviado. Volver a simulación no cancela producción remota.

## Limitaciones reales y Pendientes de Walter

- No se probaron OAuth Google/YouTube, Telegram/WhatsApp, cron de producción, APIs de pago, calidad facial/vocal, render audiovisual ni publicación externa. El guion/final pendiente y la referencia HeyGen son fixtures; la vista previa de Cooper sigue siendo una maqueta.
- La migración es aditiva y por REST; no transforma biblias ni reconstruye decisiones históricas. Los importes de ensayo son ficticios. Las tarifas de producción siguen siendo estimaciones, no facturas conciliadas.
- La red, el volumen, los puertos y los procesos son exclusivos. El runner interno y el enlace por stdio son mecanismos de ensayo; no son un diseño de despliegue. HTTPS, proxy/SSE, respaldo operativo y runners de producción pertenecen al paso operativo posterior.
- **Decisiones ya resueltas:** administrador y pertenencia de todo el histórico a `wdhg.xoxa@gmail.com`. No se solicita de nuevo esa confirmación.
- **Pendientes de Walter:** autorizar el momento del paso a vivo tras la revisión de Claude; revisar decisiones históricas incompletas; decidir proveedores, recursos de producción, tarifas/presupuesto y política de retención. Hasta entonces, mantener los servicios de pago apagados.

## Fuentes oficiales

Consultadas antes de usar las APIs: [autenticación y scopes n8n](https://docs.n8n.io/api/authentication/), [módulos en Code](https://docs.n8n.io/hosting/configuration/configuration-examples/modules-in-code-node/), [variables de seguridad](https://docs.n8n.io/hosting/configuration/environment-variables/security/) y [task runners](https://docs.n8n.io/hosting/configuration/task-runners/). El contrato exacto de REST se verificó en el `public-api/v1/openapi.yml` y los controladores oficiales empaquetados en la imagen **2.47.4**, incluidas columnas/filas, importación y `/publish`. El alta del propietario y de la clave efímera usa los controladores internos del editor únicamente en la instancia nueva. Next se contrastó con la documentación de Route Handlers instalada en `node_modules/next/dist/docs/`. No se invocaron endpoints de proveedores de medios.
