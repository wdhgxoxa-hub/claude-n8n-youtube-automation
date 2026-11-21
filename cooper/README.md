# Cooper — fases 1, 2 y 3

Estudio privado para pedir, seguir, revisar y aprobar videos. Implementación en español de `../docs/cooper-especificacion.md`. La integración de `cooper-revision`, `cooper-fase2` y `cooper-fase3` está en `cooper-integracion`. El puente está documentado en [cooper-puente-n8n.md](../docs/cooper-puente-n8n.md). Desde `cooper-ensayo` se activó contra n8n vivo el 20 de noviembre de 2026: [informe, validaciones y reversa](../docs/informes/cooper-vivo.md).

Avatares de foto, clonación de voz, catálogo y transcripción reales: [configuración, fuentes oficiales, privacidad y ensayo manual](MEDIOS.md). Los selectores siguen en modo simulado por defecto. La entrega de fase 1 se conserva como evidencia histórica. Estado integrado, puerta completa, capturas y pasos manuales de Walter: [informe final de integración](../docs/informes/cooper-integracion.md).

## Arranque

Requiere Node.js 24 y npm 12 (versiones usadas en la entrega). Ejecuta desde `cooper/`:

```bash
npm ci
cp .env.example .env.local
# Completa AUTH_SECRET, Google OAuth y COOPER_ADMIN_EMAIL.
npm run db:migrate
npm run dev
```

Abre `http://localhost:3000`. Configura en Google OAuth el callback `http://localhost:3000/api/auth/callback/google`; el origen debe coincidir con `AUTH_URL`. Google debe devolver un correo verificado. El primer administrador entra con `COOPER_ADMIN_EMAIL`; invita los demás correos desde Administración. Hasta diez cuentas. No hay credenciales ni sesiones de demostración públicas.

Para producción local: `npm run build && npm start`. Mantén el proceso en un servidor Node, con SQLite en un volumen persistente. No es una exportación estática ni una aplicación para edge. HTTPS, proxy y respaldos pertenecen a la fase 5.

Las migraciones SQL versionadas de `drizzle/` se leen con Drizzle y se aplican bajo una transacción `IMMEDIATE`, con diario compatible y comprobación de hashes, tanto con `db:migrate` como al abrir la conexión. WAL, claves foráneas e índices por dueño están activados. La base de ejecución se excluye deliberadamente del trazado de Turbopack; las migraciones sí se incluyen. Nunca empaquetes datos privados en la imagen de despliegue.

## Variables

| Variable                               | Uso                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                          | Secreto aleatorio para Auth.js. Genera uno con `openssl rand -base64 32`.                 |
| `AUTH_URL`                             | Origen público canónico; también se usa para validar el origen de las mutaciones.         |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Aplicación OAuth de Google.                                                               |
| `AUTH_TRUST_HOST`                      | `true` solo si controlas el proxy y las cabeceras de host.                                |
| `COOPER_ADMIN_EMAIL`                   | Correo del primer y único administrador. Cambiarlo no transfiere el rol.                  |
| `COOPER_DATABASE_PATH`                 | Archivo SQLite; por defecto `./data/cooper.sqlite`.                                       |
| `COOPER_FABRICA`                       | `simulada` o `n8n`. Otros valores se rechazan.                                            |
| `COOPER_SIMULACION_MS`                 | Intervalo de avance; 8000 ms por defecto. Las aprobaciones nunca avanzan solas.           |
| `COOPER_N8N_URL`, `COOPER_N8N_TOKEN`   | Endpoint HTTP y token privado del puente. Solo servidor; token de al menos 32 caracteres. |
| `COOPER_GASTO_ALERTA_USD`              | Umbral diario informativo; por defecto 25 USD. No bloquea producción.                     |
| `NEXT_TELEMETRY_DISABLED`              | `1` para desactivar la telemetría de Next.                                                |

El ejecutor E2E genera sus propios secretos aleatorios y una base aislada en `.cache/`. `COOPER_E2E_SECRET` es una variable interna entre el ejecutor y sus procesos. `PLAYWRIGHT_BROWSERS_PATH` se fija automáticamente a `.cache/browsers`. No copies estas variables a producción.

## Qué funciona

- Entrada Google con lista permitida, suspensión y revocación comprobadas en el servidor. Sesiones de 24 horas. Rol administrativo almacenado en la base, nunca aceptado desde el cliente.
- Inicio con chat y fábrica; pestañas en móvil y preferencia persistente. Navegación, canales, videos, detalle, biblioteca, perfil y administración.
- Texto, adjuntos privados de hasta 5 MB, grabación MediaRecorder de hasta 60 segundos, transcripción editable con proveedor simulado o Gemini. Mensajes persistentes y gestión de errores recuperables.
- Recorrido de doce etapas por SSE, parada en aprobación de guion y aprobación final, correcciones, referencias y programación. Los avisos de aprobación llevan al detalle. Simulación consistente entre pestañas, sin saltarse puertas al recargar.
- Galería de avatares y voces, vistas previas, foto propia, evidencia de identidad, consentimiento, selección de avatar y voz por video, presencia completa o por partes, creación privada, compartir y retirar acceso. Las evidencias nunca se comparten con el equipo; Walter tiene acceso acotado mientras revisa una solicitud de identidad real.
- Perfil con foto, nombre, apariencia, pantalla inicial y WhatsApp validado E.164.
- Administración con usuarios, correos permitidos, gasto diario/semanal/mensual por usuario y alerta sin bloqueo. Los periodos son de calendario UTC; la semana empieza el lunes. Los importes simulados no representan facturación real.

## Chat y contratos

`ProveedorChat` permite sustituir `ChatSimulado`. El chat interpreta expresiones de forma determinista y selecciona una herramienta por solicitud. En modo n8n ejecuta órdenes y consultas a través del puente; en modo simulado no usa servicios externos. La selección de canal en el chat permite dirigir nuevos videos; sin selección usa el último canal propio. Para acciones sobre videos usa el último propio o `videoId` explícito en el contrato. El detalle ofrece controles inequívocos por video.

| Evento             | Ejemplo                                               |
| ------------------ | ----------------------------------------------------- |
| `nuevo_canal`      | Crea un canal: Ciencia cotidiana                      |
| `nuevo_video`      | Quiero un video: Por qué el cielo es azul             |
| `corregir`         | Corrige: Añade un ejemplo al principio                |
| `ajustar_biblia`   | Ajusta la biblia: Explicaciones breves y verificables |
| `programar`        | Programa: 2030-06-01T18:00:00-05:00                   |
| `referencias`      | Referencias: https://ejemplo.org/fuente               |
| `configurar_redes` | Configura redes: YouTube e Instagram                  |
| `metas`            | Metas: Dos videos por semana                          |
| `adoptar_cuenta`   | Adopta cuenta: @ciencia                               |

Consultas: estado, reporte, pendientes y tendencias. El simulador reconoce expresiones concretas; no es un modelo de lenguaje general. En modo n8n consulta el radar guardado; en modo simulado ofrece ejemplos. Incluso el chat del administrador opera solo sobre sus recursos. En las pantallas de gestión, el administrador sí puede ver y actuar sobre los recursos del equipo.

`Fabrica` separa producción e interfaz. `FabricaSimulada` persiste operaciones y avanza con los pulsos SSE mientras hay un estudio abierto; no produce archivos audiovisuales reales. El detalle muestra una maqueta animada, no un video renderizado. Las fechas programadas se respetan después de las dos aprobaciones.

`FabricaN8n` usa el contrato `cooper-v1`: token de cabecera, tipos y Zod, timeout de 10 s y tres intentos con backoff. Las órdenes se registran en SQLite; n8n reserva y confirma el despacho mediante callback HMAC. La eliminación se propaga como marca lógica en n8n y exige recursos en reposo. Las aprobaciones llevan el contexto guardado de n8n y la etapa se confirma remotamente.

El receptor `/api/n8n/webhook` valida firma sobre bytes, tiempo, dueño, ID y digest persistidos. SSE reemite progreso del dueño y concilia el estado cada minuto. `COOPER_WEBHOOK_SECRET` debe coincidir con n8n y tener al menos 32 caracteres. En modo n8n, el panel administrativo usa los gastos registrados en `fab_costos`, indicando las estimaciones de las tarifas configuradas. No se mezcla el gasto simulado. El contrato completo, variables de n8n, migración de dueños y pasos para Claude/Walter están en [la guía del puente](../docs/cooper-puente-n8n.md).

El sobre añade `datos.presentacion` con avatar/voz autorizados en servidor; consulta el [contrato de presentación](../docs/cooper-especificacion.md). La fábrica persiste esa selección y la usa en storyboard, voz, avatar y montaje. FX mantiene 422 para recursos de demostración. Un video sin selección conserva la voz según guion. Revocar consentimiento cancela la cola antes del siguiente paso y avisa; los interruptores y el presupuesto pausan conservando la elección. El puente está publicado; la presentación continúa sin ensayo pago. Las ramas nuevas de HeyGen y ElevenLabs requieren asociar credenciales existentes cuando se autorice su uso; no se configuraron durante el paso a vivo.

`ProveedorAvatar`, `ProveedorVoz` y `ProveedorTranscripcion` tienen implementaciones reales y simuladas seleccionables por entorno. La identidad real pasa por revisión humana de Walter; no hay verificación biométrica automática. Las creaciones y simuladores heredados permanecen etiquetados como tales. Detalles de las APIs actuales, estados, consentimiento fechado, privacidad y límites en [MEDIOS.md](MEDIOS.md).

## Seguridad

Cada API obtiene la sesión y valida entradas con Zod. Las páginas privadas usan un layout autenticado; detalle y administración vuelven a verificar el recurso/rol en servidor. Los IDs ajenos responden 404. El gasto se consulta en una ruta administrativa separada y no forma parte del estado, chat ni SSE de usuarios normales.

Mutaciones con control de origen y límite de 90 solicitudes por minuto por usuario/proceso; lecturas API limitadas a 300. Hay un máximo de cuatro conexiones SSE por usuario/proceso, con cola acotada y liberación al cerrar. Archivo máximo 5 MB, cuerpo JSON máximo 8 MB, hasta cinco adjuntos por mensaje y lista cerrada de MIME. Descarga privada con `nosniff`, sin SVG/HTML de usuario. Cabeceras CSP, HSTS, frame denial y permisos de micrófono limitados al origen. La CSP genera un nonce por respuesta para los scripts y fuerza renderizado dinámico. Solo los estilos conservan `unsafe-inline` por las animaciones. Los adjuntos llevan una CSP `sandbox` propia y se verifica su firma de formato; esto no sustituye el análisis antivirus.

La aplicación solo acepta sesiones Auth.js. Se retiraron la ruta de autenticación de ensayo y las variables `COOPER_TEST_MODE`/`COOPER_TEST_SECRET`: configurarlas no permite entrar, tampoco con host loopback. El ejecutor E2E inicia un emisor separado en otro puerto libre de `127.0.0.1`, limitado a correos ficticios, base temporal y credencial efímera; emite cookies Auth.js cifradas sin OAuth. Nunca se importa desde `src/` ni se inicia con `npm start`. La revocación se revalida antes y después de cada sincronización SSE. La reconexión de navegador usa espera exponencial hasta 30 segundos y vuelve a entrada si la sesión expira. Los límites y la serialización de operaciones HTTP son locales al proceso; varias réplicas necesitan coordinación compartida.

Los adjuntos quedan en SQLite; no hay análisis antivirus ni limpieza automática de archivos huérfanos en esta fase. No introducir evidencias personales reales en el modo simulado. Los datos de pruebas son ficticios y quedan en `.cache/`, fuera de Git.

## Diseño y accesibilidad

Dirección: mesa de producción con conversación lateral y recorrido de trabajo. Tokens semánticos grafito `#191d20`, fondo `#101214`, marfil `#f0eee7`, celeste `#a6d7ed`, terminado `#c79b75`; equivalentes claros. Manrope variable alojada localmente, retícula de 4/8 px, formas y SVG propios. Cooper aparece en el chat y como opción explícita de presentador; la marca general usa la C con patita.

Referencias consultadas para contraste: [Linear](https://linear.app/) por organización de trabajo, [Frame.io](https://frame.io/) por revisión audiovisual y [Descript](https://www.descript.com/) por relación entre texto y video. La composición propia reúne conversación, doce pasos y dos decisiones humanas, sin reproducir sus plantillas.

Movimiento: entrada escalonada del catálogo a 60 ms por elemento, transición de ruta de 220 ms, progreso de etapa de 700 ms, estado de Cooper al grabar/responder y vistas previas activadas por el usuario. Los indicadores no dependen solo del color. Se respeta `prefers-reduced-motion`, hay foco visible, enlace de salto, etiquetas de formulario, estados vacíos, errores y esqueletos. Axe y pruebas de teclado complementan la revisión visual; no equivalen a una certificación universal de accesibilidad.

Se usaron filesystem/CLI, navegador Chromium local mediante Playwright y consulta de documentación oficial de Next/Auth.js. Los conectores disponibles de diseño no eran necesarios para este código ni se les enviaron datos del proyecto. No se usaron servicios de pago ni recursos externos de marca.

## Verificación

Para el puente real local: `npm run test:ensayo` (Node 24, Podman y la imagen `ghcr.io/n8n-io/n8n:2.47.4`). Crea Data Tables, migra datos ficticios, importa/publica workflows por REST y prueba Cooper en modo n8n con sesiones locales. Usa red interna sin Internet, puertos loopback libres, secretos nuevos y un volumen exclusivo en `~/.cache/cooper-ensayo/`. Al salir detiene `cooper-ensayo-n8n` y conserva su volumen. Cada repetición archiva el contenedor anterior detenido y crea una instancia nueva; rechaza reutilizar uno en ejecución o sin su etiqueta. No lee `.env` reales. Los resultados y capturas quedan en `.cache/e2e-ensayo-*`; [informe, límites y migración para Claude](../docs/informes/cooper-ensayo.md).

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

E2E construye y prueba la aplicación en modo producción en un puerto libre de `127.0.0.1` (o `COOPER_E2E_PORT` explícito), con base temporal y credenciales efímeras. Instala Chromium en `.cache/browsers` si falta; el primer ensayo necesita red y las bibliotecas de Chromium del sistema. Nunca usa la base de `.env.local`. No reutiliza un servidor que ya ocupe el puerto.

Vitest cubre identidad, permisos/rutas, aislamiento de chat, gasto, etapas, HTTP, programación, adjuntos, privacidad y consentimiento. Playwright cubre entrada, chat, creación, SSE, ambas aprobaciones, correcciones, audio, biblioteca, perfil, administración, revocación y auditoría axe en ambos temas. Capturas en `test-results/visual/`; reportes en `playwright-report/`. Anchuras: 360, 390, 768, 1024, 1440 y 1920. Son artefactos reproducibles, no se versionan.

Tras construir, `node scripts/auditoria.mjs` mide las siete pantallas privadas y la entrada en móvil y escritorio, repitiendo ambos temas privados (la entrada tiene tema oscuro fijo). `--rapida` limita las mediciones al inicio. Informes HTML por ruta en `.cache/auditoria/`; métricas resumidas en `.cache/auditoria/resumen.json`. El ejecutor falla si hay advertencias, rendimiento inferior a 90 o accesibilidad/buenas prácticas inferiores a 100. Son mediciones de laboratorio, no datos de usuarios reales.

## Fases siguientes

2. Puente activo en n8n vivo; migración sin pendientes, lecturas por dueño, tendencias, gastos administrativos y firma del receptor comprobadas. Falta la revisión visual del panel tras el primer ingreso Google de Walter; ver el informe de paso a vivo.
3. Adaptadores reales implementados en esta rama; pendientes de ensayo manual con credenciales, incluidos los flujos de presentación implementados.
4. Avisos por WhatsApp Business oficial. Hoy solo se guarda el número del usuario y se avisa dentro del estudio.
5. VPS, dominio, TLS, proxy SSE sin buffering, copias/restauración, política de retención y endurecimiento operativo.
6. Radar de noticias verificadas y rutas de modelos del ecosistema.

OAuth real requiere las credenciales del equipo; las pruebas automatizadas usan sesiones locales firmadas y no automatizan una cuenta Google. El paso a vivo conservó Ajustes y no creó videos ni invocó proveedores de pago. Las sesiones y el emisor E2E permanecen fuera de producción.

## Demostración de diseño

Arranca con `COOPER_DEMO=1 npm run dev` (o `COOPER_DEMO=1 npm start` tras compilar). Conserva la autenticación habitual y añade dos canales y cuatro videos de ejemplo a cada cuenta autorizada, una sola vez. Usa un archivo separado: añade `.demo` a `COOPER_DATABASE_PATH` (por defecto `data/cooper.sqlite.demo`). Apagar la variable recupera la base habitual. Las invitaciones del equipo se gestionan por separado en cada base.

La demostración fuerza fábrica, medios, transcripción, consultas de chat y gastos simulados aunque el entorno seleccione servicios reales. El ejemplo de montaje permanece en esa etapa para poder inspeccionar el diseño; las dos aprobaciones siguen siendo manuales y los videos nuevos conservan el recorrido habitual. Los ejemplos eliminados no reaparecen al volver a entrar. La etiqueta «Demostración» permanece visible también en móvil.


## Integración verificada

Informe y pasos manuales: [cooper-integracion.md](../docs/informes/cooper-integracion.md). La secuencia SQLite integrada es `0000_inicio`, `0001_presentadores`, `0002_puente`, `0003_medios_reales`, `0004_presentacion`. Es compatible con bases de fase 1 y fase 2; una base experimental de fase 3 con el antiguo `0002_medios_reales` no comparte el diario. No renombres ni borres filas del diario: respáldala y prepara una migración de datos específica, o usa una base nueva si solo contiene ensayos descartables.

`npm run test:e2e` genera 98 PNG finales en `.cache/capturas-final/`: 72 de las 18 pantallas/estados a 1440 y 390 px en dos temas, 24 de la barra en páginas largas/pantallas bajas y 2 de revocación. La entrada pública clara aplica tokens para inspección, sin selector público. El emisor de pruebas añade una revisión de voz ficticia para inspeccionar Administración; nunca se inicia desde la aplicación. Lighthouse usa demo, puertos libres y 32 mediciones con `node scripts/auditoria.mjs`.

## Movimiento del estudio

La partitura, las fuentes oficiales consultadas y la evidencia de esta misión están en [cooper-animacion](../docs/informes/cooper-animacion.md). Se mantiene Framer Motion, con revelados y bucles sencillos en CSS; no se añaden dependencias. La preferencia de movimiento reducido se escucha también al cambiarla con la página abierta. «Pausar movimiento» conserva su estado durante la navegación y detiene CSS, SVG, seguimiento del cursor y contadores; una pestaña del navegador oculta suspende los efectos del estudio.

```bash
# Recorrido grabado, capturas, pausa, avance de etapa y muestra local de fluidez
npm run test:e2e -- --project=demostracion animacion.spec.ts
# Después de npm run build: auditoría de 32 combinaciones con umbral estricto de 100
node scripts/auditoria.mjs --animacion
```

Los artefactos quedan en `.cache/animacion/`, incluidos `recorrido.webm`, capturas de seis anchuras, `fluidez.json` y `lighthouse/resumen.json`. El test usa audio, imágenes, usuarios y producción ficticios. La onda indica grabación activa; no representa el volumen del micrófono. Cooper articula por palabras y pausas del texto, sin generar audio. Los fps son una muestra local, no una garantía sobre equipos físicos.
