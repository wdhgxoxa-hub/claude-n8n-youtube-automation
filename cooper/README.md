# Cooper — fases 1, 2, 3 y 4

Estudio privado para pedir, seguir, revisar y aprobar videos. Implementación en español de `../docs/cooper-especificacion.md`. El puente está documentado en [cooper-puente-n8n.md](../docs/cooper-puente-n8n.md). La puesta en vivo inicial se conserva en [cooper-vivo](../docs/informes/cooper-vivo.md). El servicio local usa ahora `cooper-final`: [estado final, evidencias y reversa compatible con las ocho migraciones](../docs/informes/cooper-vivo-final.md).

Avatares de foto, clonación de voz, catálogo y transcripción reales: [configuración, fuentes oficiales, privacidad y ensayo manual](MEDIOS.md). Los selectores siguen en modo simulado por defecto. La entrega de fase 1 se conserva como evidencia histórica. Estado de esta integración, puerta completa, capturas y pasos manuales de Walter: [cooper-final.md](../docs/informes/cooper-final.md).

WhatsApp Business: verificación de número, preferencias, enlaces firmados, botones, cola durable y transporte real/simulado en [cooper-whatsapp.md](../docs/cooper-whatsapp.md). Desactivado para envíos reales por defecto; requiere alta y plantillas aprobadas por Meta.

Fase 6: [modo noticia por canal y desde el chat](../docs/cooper-modo-noticia.md), con verificaciones obligatorias y medios propios; [puente local Codex y respaldo API](../docs/puente-codex.md). El puente está activo y una llamada real corta del crítico pasó desde el contenedor. El modo noticia permanece apagado en todos los canales. En el simulador las noticias se detienen en Verificación; necesitan fuentes reales para avanzar. El ensayo completo de noticias y del respaldo pago queda pendiente.

Marcas y redes: [guía de uso, fuentes oficiales y lote n8n](../docs/cooper-marcas.md). Marcas privadas, estudio de cuentas, plantillas propias, especialistas, calendario, aprobación de Walter y métricas; modo simulado por defecto. [Informe de la misión](../docs/informes/cooper-marcas.md).

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

Para producción local: `npm run build && npm start`. Mantén el proceso en un servidor Node, con SQLite en un volumen persistente. No es una exportación estática ni una aplicación para edge. La [guía VPS](../docs/cooper-vps.md) prepara la imagen Node 24, n8n/runner 2.47.4, Caddy HTTPS/SSE, copias cifradas y migración offline; no se ha desplegado en vivo.

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
- Texto, adjuntos privados de hasta 5 MB, grabación MediaRecorder de hasta 60 segundos, transcripción editable con proveedor simulado, Gemini u OpenAI. Mensajes persistentes y gestión de errores recuperables.
- Recorrido de doce etapas por SSE, parada en aprobación de guion y aprobación final, correcciones, referencias y programación. Los avisos de aprobación llevan al detalle. Simulación consistente entre pestañas, sin saltarse puertas al recargar.
- Galería de avatares y voces, vistas previas, foto propia, evidencia de identidad, consentimiento, selección de avatar y voz por video, presencia completa o por partes, creación privada, compartir y retirar acceso. Las evidencias nunca se comparten con el equipo; Walter tiene acceso acotado mientras revisa una solicitud de identidad real.
- Perfil con foto, nombre, apariencia, pantalla inicial y WhatsApp validado E.164.
- Administración con usuarios, correos permitidos, gasto diario/semanal/mensual por usuario y alerta sin bloqueo. Los periodos son de calendario UTC; la semana empieza el lunes. Los importes simulados no representan facturación real.

## Chat y contratos

`ProveedorChat` tiene adaptadores Claude Code, puente Codex local, Claude/OpenAI por API y simulado. El agente usa herramientas del puente y confirmaciones persistentes para todas las mutaciones. Consulta [configuración, seguridad y límites del chat con IA](#chat-con-ia-y-confirmación-de-acciones). El canal activo pertenece al dueño; cuando hay varios videos se exige elegir uno. El detalle conserva sus controles por video.

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

Consultas: estado, reporte, pendientes y tendencias. Solo el proveedor simulado reconoce expresiones fijas; los proveedores reales usan tool use. En modo n8n consulta el radar guardado; en modo simulado ofrece ejemplos. Incluso el chat del administrador opera solo sobre sus recursos. En las pantallas de gestión, el administrador sí puede ver y actuar sobre los recursos del equipo.

`Fabrica` separa producción e interfaz. `FabricaSimulada` persiste operaciones y avanza con los pulsos SSE mientras hay un estudio abierto; no produce archivos audiovisuales reales. Cuando la fábrica entrega `render_url`, el detalle reproduce ese montaje y muestra las imágenes, clips y voces por escena. La maqueta animada queda reservada para la demostración sin archivo real; el modo n8n muestra la espera del montaje. Las publicaciones confirmadas de YouTube/TikTok tienen un reproductor incrustado oficial. Las fechas programadas se respetan después de las dos aprobaciones.

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
4. WhatsApp implementado con transporte simulado por defecto; alta, revisión de plantillas y ensayo real pendientes de Walter.
5. VPS preparado en `deploy/`: TLS, proxy SSE, copias/restauración, retención y endurecimiento operativo. Requiere revisión y aplicación en Ubuntu por el operador; [guía](../docs/cooper-vps.md) e [informe](../docs/informes/cooper-fase5.md).
6. Noticias verificadas, puente Codex y respaldo API implementados. Falta preparar el servicio privado, aplicar columnas/importar workflows y ensayar con cuentas reales; [guía](../docs/cooper-modo-noticia.md).

OAuth real requiere las credenciales del equipo; las pruebas automatizadas usan sesiones locales firmadas y no automatizan una cuenta Google. El paso a vivo conservó Ajustes y no creó videos ni invocó proveedores de pago. Las sesiones y el emisor E2E permanecen fuera de producción.

## Demostración de diseño

Arranca con `COOPER_DEMO=1 npm run dev` (o `COOPER_DEMO=1 npm start` tras compilar). Conserva la autenticación habitual y añade dos canales y cuatro videos de ejemplo a cada cuenta autorizada, una sola vez. Usa un archivo separado: añade `.demo` a `COOPER_DATABASE_PATH` (por defecto `data/cooper.sqlite.demo`). Apagar la variable recupera la base habitual. Las invitaciones del equipo se gestionan por separado en cada base.

La demostración fuerza fábrica, medios, transcripción, consultas de chat y gastos simulados aunque el entorno seleccione servicios reales. El ejemplo de montaje permanece en esa etapa para poder inspeccionar el diseño; las dos aprobaciones siguen siendo manuales y los videos nuevos conservan el recorrido habitual. Los ejemplos eliminados no reaparecen al volver a entrar. La etiqueta «Demostración» permanece visible también en móvil.


## Integración verificada

Informe y pasos manuales: [cooper-integracion.md](../docs/informes/cooper-integracion.md). La secuencia SQLite integrada es `0000_inicio`, `0001_presentadores`, `0002_puente`, `0003_medios_reales`, `0004_presentacion`, `0005_chat_ia`, `0006_whatsapp`, `0007_noticias`, `0008_observabilidad`. Es compatible con bases del ensayo/vivo hasta `0004_presentacion` y con `0005_chat_ia`. Las bases experimentales de ramas independientes con `0005_whatsapp` o `0005_noticias` se rechazan por diario incompatible: respaldar y preparar una migración de datos específica; nunca renombrar el diario para forzarlas. También admite bases de fase 1 y fase 2; una base experimental de fase 3 con el antiguo `0002_medios_reales` no comparte el diario. No renombres ni borres filas del diario: respáldala y prepara una migración de datos específica, o usa una base nueva si solo contiene ensayos descartables.

`npm run test:e2e` genera 130 PNG en `.cache/capturas-final2/`: 72 de las 18 pantallas/estados anteriores, 32 de los ocho estados nuevos de chat, fotos, noticias y WhatsApp a 1440 y 390 px en dos temas, 24 de la barra en páginas largas/pantallas bajas y 2 de revocación. Los estados nuevos también pasan axe a 360 y 768 px. `manifest.json` y `manifest-nuevas.json` describen las dos matrices. La entrada pública clara aplica tokens para inspección, sin selector público. El emisor de pruebas añade una revisión de voz ficticia para inspeccionar Administración; nunca se inicia desde la aplicación. Lighthouse usa demo, puertos libres y 32 mediciones con `node scripts/auditoria.mjs`.

## Movimiento del estudio

La partitura, las fuentes oficiales consultadas y la evidencia de esta misión están en [cooper-animacion](../docs/informes/cooper-animacion.md). Se mantiene Framer Motion, con revelados y bucles sencillos en CSS; no se añaden dependencias. La preferencia de movimiento reducido se escucha también al cambiarla con la página abierta. «Pausar movimiento» conserva su estado durante la navegación y detiene CSS, SVG, seguimiento del cursor y contadores; una pestaña del navegador oculta suspende los efectos del estudio.

```bash
# Recorrido grabado, capturas, pausa, avance de etapa y muestra local de fluidez
npm run test:e2e -- --project=demostracion animacion.spec.ts
# Después de npm run build: auditoría de 32 combinaciones con umbral estricto de 100
node scripts/auditoria.mjs --animacion
```

Los artefactos quedan en `.cache/animacion/`, incluidos `recorrido.webm`, capturas de seis anchuras, `fluidez.json` y `lighthouse/resumen.json`. El test usa audio, imágenes, usuarios y producción ficticios. La onda indica grabación activa; no representa el volumen del micrófono. Cooper articula por palabras y pausas del texto, sin generar audio. Los fps son una muestra local, no una garantía sobre equipos físicos.
## Chat con IA y confirmación de acciones

`COOPER_CHAT=auto` (valor predeterminado) sigue **claude-cli → codex-local → API con clave → simulado**. `claude-cli` usa ese mismo orden; `codex-local` comienza en el puente. `COOPER_CHAT_API_RESPALDO=0` impide las APIs en esa cadena: es el valor del ejemplo y del despliegue de esta misión. Con `1`, solo se intentan APIs cuyas claves estén configuradas (Claude y después OpenAI). `claude` y `openai` conservan la selección API explícita anterior; `simulada` fija el simulador. Demo, Vitest y E2E fuerzan el simulador. El respaldo solo ocurre **antes de emitir contenido** y se conserva durante las rondas restantes del turno. El último respaldo avisa «modo básico temporal»; no oculta una caída como si fuera IA real. Nunca se repiten automáticamente acciones de fábrica.

Claude Code requiere `claude` en PATH (o `COOPER_CLAUDE_BIN`) y una sesión `claude.ai` ya iniciada. Comprueba `auth status` sin registrar datos de cuenta. Invoca `claude -p --output-format json --json-schema` con JSON Schema draft-7 (el validador del CLI no admite el draft-2020-12 predeterminado de Zod), `--tools ""`, modo seguro/restringido, hooks/skills/MCP/conectores desactivados, sin historial persistente y desde un temporal vacío 0700. Solo hereda PATH, HOME, LANG y TMPDIR, más NODE_ENV fijo; ninguna clave API ni token de Cooper. La autenticación queda a cargo del CLI, sin copiar archivos ni realizar OAuth. El modelo no dispone de herramientas para comandos, archivos o navegación. El proceso de confianza del CLI sí accede a su autenticación local; no se promete un aislamiento del sistema operativo respecto del usuario que lo ejecuta.

Codex usa `POST /v1/chat` de `puente-codex.service` mediante `PUENTE_CODEX_URL` (solo HTTP loopback literal) y `PUENTE_CODEX_TOKEN` del gestor de servicios. El puente conserva `/v1/texto` para la fábrica y comparte una sola plaza entre ambos. Chat usa esquema fijo, sesión ChatGPT, contexto efímero y búsqueda, comandos, imágenes locales, plugins, apps, memoria, hooks y delegación desactivados. Ninguno de los CLI recibe imágenes/base64: este modo requiere describir las fotos y no analiza adjuntos. Las herramientas se proponen en JSON y Zod valida su sobre; Cooper valida argumentos, dueño y confirmación en el servidor.

Una petición por usuario, cola global FIFO de hasta diez turnos, una ejecución global y **30 turnos por hora por proceso**. Espera máxima en cola: 15 s; turno completo: 120 s; Claude: 45 s por ronda; puente: 40 s (cliente: 45 s). Máximo cuatro rondas por turno. El rechazo por concurrencia/cuota devuelve un mensaje recuperable. Cancelar espera aborta el proceso o HTTP y libera las plazas; no cancela tarjetas ya preparadas. Los procesos CLI se matan por grupo y sus temporales se eliminan incluso ante error. Los límites reinician al reiniciar Cooper y no miden la cuota restante de las suscripciones; varias réplicas necesitan coordinación compartida.

Los CLI entregan respuesta completa tras validar JSON, transportada por SSE; la boca continúa unos segundos al recibirla. La espera larga muestra aviso y botón de cancelación. El esquema limita respuesta, número de propuestas y argumentos; stdout/stderr tienen límites y nunca se registran errores privados del proveedor. [Informe, prueba real y despliegue](../docs/informes/cooper-chat-planes.md).

Las claves `ANTHROPIC_API_KEY` y `OPENAI_API_KEY` son opcionales y solo del servidor. Modelos API documentados el 20-11-2026: `COOPER_CHAT_MODELO_CLAUDE=claude-sonnet-5-5`, `COOPER_CHAT_MODELO_OPENAI=gpt-6.1-sol`. Los CLI usan el modelo de suscripción predeterminado; no extraen sesiones del navegador. `COOPER_TRANSCRIPCION=openai` habilita `gpt-transcribe`; se conserva la alternativa Gemini y el simulador. La transcripción real es una integración separada por API, no se incluye en los proveedores de chat por plan. El audio se transcribe, se permite editar y luego se envía como texto al chat.

El catálogo usa exactamente los nombres del contrato `cooper-v1`, incluidas `aprobar_guion`, `aprobar_final` y `eliminar`. Todas las mutaciones generan una tarjeta con **Confirmar / Cancelar**, también en modo simulado. Confirmar hace una petición separada con el ID de la tarjeta y la decisión; ni el modelo ni un «sí» escrito pueden confirmarla. La tarjeta conserva parámetros y huella del recurso, caduca a los 15 minutos y se consume una sola vez. Un recurso modificado exige una nueva tarjeta. Si el resultado remoto es incierto, queda en «revisar»; no se vuelve a enviar esa tarjeta. El bloqueo por dueño en SQLite evita turnos simultáneos y se libera al finalizar; ante caída del proceso caduca a los tres minutos.

Las consultas y las acciones operan sobre el dueño autenticado, incluido el administrador. El estado remoto se consulta con `admin: false`; los informes usan una proyección local por dueño y canal tras sincronizar. `gastos` solo se ofrece al administrador: devuelve gasto propio simulado o dirige a Administración para el gasto real; no incorpora gastos del equipo al contexto. El chat no factura ni estima consumos de los modelos. El rechazo de pedidos fuera del estudio forma parte de las instrucciones del modelo; los permisos y las confirmaciones se imponen en el servidor. Un filtro adicional de frases evita mostrar importes e información interna a no administradores; no sustituye la separación de datos.

`/api/chat` admite SSE con `Accept: text/event-stream` y conserva JSON para clientes anteriores. Las frases se filtran antes de enviarse; la boca se mueve mientras llegan y descansa al finalizar. No se transmite razonamiento, uso de tokens, errores remotos ni parámetros internos. Se revalida la sesión durante el stream y antes de herramientas. Se limita cada turno a 4 rondas, 8 llamadas, una propuesta de mutación y 120 segundos. Cada petición al modelo tiene 45 segundos de timeout y no sigue redirecciones.

El contexto reciente reutiliza `messages`: últimos 30 mensajes recordables del canal activo, además del [resumen de largo plazo](#memoria-de-largo-plazo), hasta 30 canales/videos del contexto y 12.000 caracteres de guion por video. El canal activo y las tarjetas persisten en `0005_chat_ia`; con varios videos se debe elegir el correcto, sin asumir el último global. Se conservan hasta cinco fotos recientes como referencias visuales, revalidando dueño. Límite de 5 MB por archivo y 15 MB por mensaje/conjunto de fotos. Los PDF/archivos siguen descargables, pero no se analizan por el modelo. «Usar para mi avatar» lleva la foto al formulario privado existente; conserva reto de identidad y consentimiento. No hay entrenamiento automático desde el chat.

Fuentes oficiales consultadas: [Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Messages](https://platform.claude.com/docs/en/api/messages/create), [versión de API 2026-10-21](https://platform.claude.com/docs/en/api/migration-2026-10-21), [streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [resultados de herramientas](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls), [visión](https://platform.claude.com/docs/en/build-with-claude/vision). OpenAI Docs: [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Responses](https://developers.openai.com/api/reference/resources/responses/methods/create/), [function calling](https://developers.openai.com/api/docs/guides/function-calling), [streaming](https://developers.openai.com/api/docs/guides/streaming-responses), [transcripción](https://developers.openai.com/api/docs/guides/speech-to-text). Los adaptadores conservan bloques de pensamiento/firmas de Claude y razonamiento cifrado de Responses únicamente para continuar herramientas en servidor; OpenAI usa `store: false`.

La evaluación versionada está en `tests/fixtures/chat-30.json`; `npm test` produce `.cache/evaluacion-chat-30.json`. Sus 30 conversaciones verifican selección determinista, confirmaciones, memoria, audio y aislamiento (incluidas llamadas hostiles inyectadas). **No es una medición del acierto de Claude/OpenAI**: requiere ensayo posterior autorizado con APIs reales y datos ficticios. Los transportes HTTP, el fallback y el parsing incremental se comprueban por separado con respuestas ficticias. No se han realizado llamadas pagadas ni despliegues.

## Memoria de largo plazo

Cooper conserva pendientes, títulos provisionales, decisiones y preferencias por usuario y canal/marca en SQLite (`chat_memories`). No requiere otra base ni servicios nuevos. El inicio muestra «Donde lo dejamos» cuando hay una idea o tema pendiente; «Retomar» selecciona su canal y prepara el mensaje para enviarlo. «Ver lo recordado» permite revisar todos los ámbitos propios y borrar la memoria con confirmación. Walter puede consultarla por persona en Administración; los recuerdos del equipo nunca se incorporan a su chat.

Actualización **cada mensaje del usuario (N = 1)**: primero persiste apuntes extractivos, incluso si se interrumpe la respuesta; tras un turno completo, el proveedor de chat configurado sintetiza un JSON validado. Usa la misma plaza, límite de turno, proveedor y política de respaldo, sin herramientas y con un máximo adicional de 12 segundos. No hay tareas posteriores al cierre de la petición. Demo y simulación usan solo apuntes locales; una caída, salida inválida o cancelación de síntesis conserva esos apuntes. La síntesis puede consumir otra llamada del plan o API seleccionada; esta misión no realiza llamadas reales.

Cada ámbito conserva hasta ocho pendientes, ocho ideas con título/detalle, ocho decisiones y ocho preferencias, con frases de hasta 240 caracteres. La síntesis combina el resumen anterior con el turno nuevo y retira pendientes resueltos o preferencias corregidas. El respaldo extractivo solo reconoce expresiones explícitas y conserva fragmentos literales; no ofrece la misma comprensión semántica. El contexto inicial reúne la memoria sin canal y la del canal activo, junto con los últimos 30 mensajes de ese canal. Las ideas recordadas no son órdenes ejecutadas ni autorizaciones: siguen vigentes las tarjetas Confirmar/Cancelar y la validación de dueño.

`GET /api/memoria` consulta al dueño autenticado; `GET /api/admin/memoria/:usuarioId` exige administrador. `DELETE /api/memoria` solo borra lo propio, verifica origen y rechaza un turno activo. El borrado elimina todos los resúmenes y guarda un corte persistente que impide reutilizar mensajes anteriores en el contexto y en futuras síntesis; no borra el historial visible, adjuntos ni recursos de fábrica. No equivale al borrado físico de copias de seguridad o de conversaciones ya enviadas al proveedor. La memoria permanece privada y con respuestas sin caché; no se exporta a n8n.

Migración aditiva `0009_memoria`: añade ámbito a los mensajes y corte de olvido a `chat_sessions`. Los mensajes antiguos sin canal comprobable quedan en el ámbito sin canal, sin atribuirlos a una marca ni resumir automáticamente todo el historial. Los recuerdos de un canal se eliminan en cascada al borrarlo. El número 0008 está reservado por la misión cooper-pulido; al integrar ambas ramas hay que conservar sus dos entradas, ordenar el diario y repetir la puerta sobre la combinación.

Evaluación: `tests/chat-memoria*.test.ts` simula días 1, 2 y 5, más de 30 mensajes, reapertura SQLite, dos marcas, usuarios diferentes, ambigüedad, correcciones, borrado y fallos del sintetizador. Produce `.cache/evaluacion-memoria.json`. Playwright añade el recorrido de recuerdos y Administración, capturas y axe en seis anchuras y ambos temas (`.cache/capturas-memoria/`). Los proveedores de evaluación son ficticios: no miden la precisión de Claude/Codex/OpenAI reales.

Cada misión actualiza [ESTADO](../docs/ESTADO.md) al cerrar y registra su evidencia en `docs/informes/`; regla permanente en [AGENTS.md](../AGENTS.md).

## Publicados, aprendizaje y ensayo masivo

Publicados reúne las publicaciones confirmadas por red, con miniatura, fecha, enlace y evolución diaria de vistas, me gusta, comentarios y retención disponible. Los valores ausentes se muestran como «Sin dato», sin convertirlos en cero. La tabla accesible acompaña al gráfico y TikTok puede aportar una curva de permanencia por segundo. Aprendizaje muestra las lecciones del canal y las incidencias con fecha, estado y cambio que permitió resolverlas. Los costos siguen en Administración.

El puente añade `lecciones` y `observabilidad` al estado `cooper-v1`; los productores anteriores siguen siendo compatibles. La novena migración SQLite guarda las dos proyecciones. El generador offline prepara las nuevas columnas y nodos de n8n para conservar piezas, registrar revisiones y medir diariamente las publicaciones. No se ha desplegado esta ampliación. El [informe de pulido](../docs/informes/cooper-pulido.md) contiene el procedimiento de migración, límites, fuentes y evidencia.

El chat pide una frase breve y cálida, como máximo dos salvo solicitud de detalle. La evaluación de 30 conversaciones comprueba la mediana de palabras y las mismas decisiones de herramientas, con proveedor simulado.

```bash
# Matriz de seis anchos × dos temas, estrés y API local de Sistema Sentinel
COOPER_PULIDO_RONDA=ronda-1 npm run test:e2e -- --config playwright.pulido.config.ts
```

Requiere Sistema Sentinel instalado en `~/Proyectos/Sistema-Sentinel/codigo` y su entorno Python, o las rutas `SENTINEL_CODIGO` y `SENTINEL_PYTHON`; el ensayo multimedia usa FFmpeg. El adaptador conserva el guardián de Sentinel y añade únicamente una sesión ficticia y viewport al navegador. Las pruebas usan loopback, base efímera y servicios simulados; no requieren Google ni credenciales de producción. Los artefactos quedan en `.cache/capturas-pulido/<ronda>/`, junto con métricas, informe de Sentinel y capturas. Las cookies de ensayo se eliminan al terminar. Playwright complementa los módulos de recorridos, caos y estabilidad con axe, la matriz de pantallas, formularios, micrófono ficticio, fotos, ráfagas, red desconectada y recuperación. La reproducción de video y voz se comprueba con archivos sintéticos servidos localmente.


## Operación completa de la fábrica

La navegación Operación reúne Biblia del canal, Radar, Rutina y metas, Especialistas y redes, Referencias, Adoptar cuenta, Programados, Decisiones, Incidencias y Avisos. Administración incluye Ajustes de fábrica: interruptores, presupuestos, modelos y calendario, con revisión del cambio y registro. Cada acción exige confirmación explícita y el servidor comprueba el dueño; los ajustes requieren administrador. El modo simulado conserva sus cambios y se identifica en pantalla.

`GET /api/operacion`, `POST /api/operacion` y `GET /api/admin/fabrica` usan el puente firmado existente. Las consultas `operacion`/`ajustes` y el control estructurado `control_fabrica` están reservados a la web; no amplían las herramientas del chat. La fábrica debe instalar los flujos del [lote revisable con reversa](../docs/cooper-cobertura-despliegue.md) para ofrecer los nuevos datos y controles. No se desplegó esta misión en vivo.

```bash
# Once pantallas, seis anchuras y dos temas; acciones y Sentinel real aislado.
COOPER_COBERTURA_RONDA=ronda-1 npm run test:e2e -- --config playwright.cobertura.config.ts
# Tras compilar, Lighthouse sobre las once pantallas, dos temas y dos tamaños.
node scripts/auditoria.mjs --cobertura
```

El adaptador conserva el guardián y los evaluadores de Sentinel. Excluye controles que escriben datos del caos de solo lectura; Playwright verifica las mutaciones de forma dirigida. Para estabilidad espera que la pantalla termine de consultar antes de medir la memoria inicial. Capturas e informes quedan en `.cache/capturas-cobertura/<ronda>/` y `.cache/cobertura/lighthouse/`. El [informe de cobertura](../docs/informes/cooper-cobertura.md) enumera cada flujo, decisión, ajuste y tabla, junto con pruebas y límites reales.
