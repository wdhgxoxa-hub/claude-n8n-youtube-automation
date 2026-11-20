# Cooper — fase 1

Estudio privado para pedir, seguir, revisar y aprobar videos. Implementación en español de `../docs/cooper-especificacion.md`. Rama `cooper-fase1`; no incluye despliegue ni cambios en n8n.

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

Las migraciones SQL versionadas de `drizzle/` se aplican con el migrador de Drizzle, tanto con `db:migrate` como al abrir la conexión. WAL, claves foráneas e índices por dueño están activados. La base de ejecución se excluye deliberadamente del trazado de Turbopack; las migraciones sí se incluyen. Nunca empaquetes datos privados en la imagen de despliegue.

## Variables

| Variable                                 | Uso                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                            | Secreto aleatorio para Auth.js. Genera uno con `openssl rand -base64 32`.                                                                 |
| `AUTH_URL`                               | Origen público canónico; también se usa para validar el origen de las mutaciones.                                                         |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`   | Aplicación OAuth de Google.                                                                                                               |
| `AUTH_TRUST_HOST`                        | `true` solo si controlas el proxy y las cabeceras de host.                                                                                |
| `COOPER_ADMIN_EMAIL`                     | Correo del primer y único administrador. Cambiarlo no transfiere el rol.                                                                  |
| `COOPER_DATABASE_PATH`                   | Archivo SQLite; por defecto `./data/cooper.sqlite`.                                                                                       |
| `COOPER_FABRICA`                         | `simulada` o `n8n`. Otros valores se rechazan.                                                                                            |
| `COOPER_SIMULACION_MS`                   | Intervalo de avance; 8000 ms por defecto. Las aprobaciones nunca avanzan solas.                                                           |
| `COOPER_N8N_URL`, `COOPER_N8N_TOKEN`     | Endpoint HTTP y token privado del futuro puente. Solo servidor.                                                                           |
| `COOPER_GASTO_ALERTA_USD`                | Umbral diario informativo; por defecto 25 USD. No bloquea producción.                                                                     |
| `COOPER_TEST_MODE`, `COOPER_TEST_SECRET` | Sesión exclusiva de pruebas: bandera `1`, host loopback y secreto de al menos 32 caracteres. Mantener desactivada fuera del ensayo local. |
| `NEXT_TELEMETRY_DISABLED`                | `1` para desactivar la telemetría de Next.                                                                                                |

El ejecutor E2E genera sus propios secretos aleatorios y una base aislada en `.cache/`. `COOPER_E2E_SECRET` es una variable interna entre el ejecutor y sus procesos. `PLAYWRIGHT_BROWSERS_PATH` se fija automáticamente a `.cache/browsers`. No copies estas variables a producción.

## Qué funciona

- Entrada Google con lista permitida, suspensión y revocación comprobadas en el servidor. Sesiones de 24 horas. Rol administrativo almacenado en la base, nunca aceptado desde el cliente.
- Inicio con chat y fábrica; pestañas en móvil y preferencia persistente. Navegación, canales, videos, detalle, biblioteca, perfil y administración.
- Texto, adjuntos privados de hasta 5 MB, grabación MediaRecorder de hasta 60 segundos, transcripción simulada editable. Mensajes persistentes y gestión de errores recuperables.
- Recorrido de doce etapas por SSE, parada en aprobación de guion y aprobación final, correcciones, referencias y programación. Los avisos de aprobación llevan al detalle. Simulación consistente entre pestañas, sin saltarse puertas al recargar.
- Galería de avatares y voces, vistas previas, foto propia, evidencia de identidad, consentimiento, selección de avatar y voz por video, presencia completa o por partes, creación privada, compartir y retirar acceso. Las evidencias nunca se comparten.
- Perfil con foto, nombre, apariencia, pantalla inicial y WhatsApp validado E.164.
- Administración con usuarios, correos permitidos, gasto diario/semanal/mensual por usuario y alerta sin bloqueo. Los periodos son de calendario UTC; la semana empieza el lunes. Los importes simulados no representan facturación real.

## Chat y contratos

`ProveedorChat` permite sustituir `ChatSimulado`. El simulador es determinista, no envía datos a servicios externos y selecciona una herramienta por solicitud. La selección de canal en el chat permite dirigir nuevos videos; sin selección usa el último canal propio. Para acciones sobre videos usa el último propio o `videoId` explícito en el contrato. El detalle ofrece controles inequívocos por video.

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

Consultas: estado, reporte, pendientes y tendencias. El simulador reconoce expresiones concretas; no es un modelo de lenguaje general ni consulta tendencias reales. Incluso el chat del administrador opera solo sobre sus recursos. En las pantallas de gestión, el administrador sí puede ver y actuar sobre los recursos del equipo.

`Fabrica` separa producción e interfaz. `FabricaSimulada` persiste operaciones y avanza con los pulsos SSE mientras hay un estudio abierto; no produce archivos audiovisuales reales. El detalle muestra una maqueta animada, no un video renderizado. Las fechas programadas se respetan después de las dos aprobaciones.

`FabricaN8n` hace POST con token Bearer, timeout de 10 s y este sobre:

```json
{
  "evento": "nuevo_video",
  "dueno_email": "persona@equipo.com",
  "usuario_id": "uuid",
  "datos": {
    "id": "uuid-generado-por-cooper",
    "evento": "nuevo_video",
    "recursoId": "uuid-del-canal",
    "texto": "Título"
  }
}
```

Las mutaciones requieren `{ "aceptado": true }` antes de persistir el reflejo local. El ID generado para canales/videos es el mismo en ambos lados. La consulta `estado` recibe `{ "videos": [{ "id": "uuid", "stage": 3, "script": "..." }] }`; solo se actualizan videos del dueño autenticado. `aprobar` envía ID y etapa. Los detalles de transporte y respuestas desconocidas nunca se devuelven al usuario. Las eliminaciones de videos/canales son locales en esta fase; su propagación real requiere el puente. No hay reintentos automáticos de mutaciones; la idempotencia distribuida, entrega durable, ingestión de gastos y contrato definitivo del puente corresponden a la fase 2. El contrato HTTP se prueba con respuestas simuladas; no se contactó un n8n real.

`ProveedorAvatar`, `ProveedorVoz` y `ProveedorTranscripcion` son interfaces reemplazables. En esta fase la identidad comprueba evidencia y consentimiento, pero **no comprueba biométricamente a la persona**. Las voces de catálogo reproducen tonos de demostración y la transcripción devuelve una frase fija editable. Nunca se presenta esto como clonación o verificación real.

## Seguridad

Cada API obtiene la sesión y valida entradas con Zod. Las páginas privadas usan un layout autenticado; detalle y administración vuelven a verificar el recurso/rol en servidor. Los IDs ajenos responden 404. El gasto se consulta en una ruta administrativa separada y no forma parte del estado, chat ni SSE de usuarios normales.

Mutaciones con control de origen y límite de 90 solicitudes por minuto por usuario/proceso. Archivo máximo 5 MB, cuerpo JSON máximo 8 MB, hasta cinco adjuntos por mensaje y lista cerrada de MIME. Descarga privada con `nosniff`, sin SVG/HTML de usuario. Cabeceras CSP, HSTS, frame denial y permisos de micrófono limitados al origen. La CSP conserva `unsafe-inline` para la hidratación de Next; no se renderiza HTML de usuario. La evolución a nonces por solicitud puede acompañar el proxy de producción.

La sesión E2E exige un secreto aleatorio, firma HMAC con expiración, cookie HttpOnly/SameSite y host local. No habilitar esa ruta en un servidor expuesto. El modo de pruebas no permite saltarse la lista permitida ni la suspensión. La revocación se revalida en cada petición y pulso SSE. El rate limiter es local al proceso, adecuado a esta instancia SQLite de hasta diez personas; una expansión requiere almacenamiento compartido.

Los adjuntos quedan en SQLite; no hay análisis antivirus ni limpieza automática de archivos huérfanos en esta fase. No introducir evidencias personales reales en el modo simulado. Los datos de pruebas son ficticios y quedan en `.cache/`, fuera de Git.

## Diseño y accesibilidad

Dirección: mesa de producción con conversación lateral y recorrido de trabajo. Tokens semánticos grafito `#191d20`, fondo `#101214`, marfil `#f0eee7`, celeste `#a6d7ed`, terminado `#c79b75`; equivalentes claros. Manrope variable alojada localmente, retícula de 4/8 px, formas y SVG propios. Cooper aparece en el chat y como opción explícita de presentador; la marca general usa la C con patita.

Referencias consultadas para contraste: [Linear](https://linear.app/) por organización de trabajo, [Frame.io](https://frame.io/) por revisión audiovisual y [Descript](https://www.descript.com/) por relación entre texto y video. La composición propia reúne conversación, doce pasos y dos decisiones humanas, sin reproducir sus plantillas.

Movimiento: entrada escalonada del catálogo a 60 ms por elemento, transición de ruta de 220 ms, progreso de etapa de 700 ms, estado de Cooper al grabar/responder y vistas previas activadas por el usuario. Los indicadores no dependen solo del color. Se respeta `prefers-reduced-motion`, hay foco visible, enlace de salto, etiquetas de formulario, estados vacíos, errores y esqueletos. Axe y pruebas de teclado complementan la revisión visual; no equivalen a una certificación universal de accesibilidad.

Se usaron filesystem/CLI, navegador Chromium local mediante Playwright y consulta de documentación oficial de Next/Auth.js. Los conectores disponibles de diseño no eran necesarios para este código ni se les enviaron datos del proyecto. No se usaron servicios de pago ni recursos externos de marca.

## Verificación

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

E2E construye y prueba la aplicación en modo producción en `127.0.0.1:3107`, con base temporal y credenciales efímeras. Instala Chromium en `.cache/browsers` si falta; el primer ensayo necesita red y las bibliotecas de Chromium del sistema. Nunca usa la base de `.env.local`. No reutiliza un servidor que ya ocupe el puerto.

Vitest cubre identidad, permisos/rutas, aislamiento de chat, gasto, etapas, HTTP, programación, adjuntos, privacidad y consentimiento. Playwright cubre entrada, chat, creación, SSE, ambas aprobaciones, correcciones, audio, biblioteca, perfil, administración, revocación y auditoría axe en ambos temas. Capturas en `test-results/visual/`; reportes en `playwright-report/`. Anchuras: 360, 390, 768, 1024, 1440 y 1920. Son artefactos reproducibles, no se versionan.

Tras construir, `node scripts/auditoria.mjs` mide el inicio autenticado en una instancia aislada con Lighthouse móvil. Informe en `.cache/auditoria/lighthouse.html`; métricas resumidas en `.cache/auditoria/resumen.json`. Son mediciones de laboratorio, no datos de usuarios reales.

## Fases siguientes

2. Puente real de n8n, propietario por canal, gastos reales, conciliación, cola durable e idempotencia distribuida.
3. Generación real de avatares/voces, verificación de identidad real y transcripción real; sustituir adaptadores conservando permisos.
4. Avisos por WhatsApp Business oficial. Hoy solo se guarda el número del usuario y se avisa dentro del estudio.
5. VPS, dominio, TLS, proxy SSE sin buffering, copias/restauración, política de retención y endurecimiento operativo.
6. Radar de noticias verificadas y rutas de modelos del ecosistema.

OAuth real requiere las credenciales del equipo; las pruebas automatizadas usan sesiones locales firmadas y no automatizan una cuenta Google. No se ha desplegado, conectado a proveedores de producción ni publicado videos reales.

## Demostración de diseño

Arranca con `COOPER_DEMO=1 npm run dev` (o `COOPER_DEMO=1 npm start` tras compilar). Conserva la autenticación habitual y añade dos canales y cuatro videos de ejemplo a cada cuenta autorizada, una sola vez. Usa un archivo separado: añade `.demo` a `COOPER_DATABASE_PATH` (por defecto `data/cooper.sqlite.demo`). Apagar la variable recupera la base habitual. Las invitaciones del equipo se gestionan por separado en cada base.

La demostración fuerza la fábrica simulada aunque esté configurado n8n. El ejemplo de montaje permanece en esa etapa para poder inspeccionar el diseño; las dos aprobaciones siguen siendo manuales y los videos nuevos conservan el recorrido habitual. Los ejemplos eliminados no reaparecen al volver a entrar. La etiqueta «Demostración» permanece visible también en móvil.
