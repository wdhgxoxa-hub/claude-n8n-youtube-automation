# Cooper: consolidación, respaldo e instalación fija

21 de noviembre de 2026, America/Lima. Autorización excepcional de Walter para fusionar en `version-chatgpt` y subir al remoto `mio`, repositorio `wdhgxoxa-hub/claude-n8n-youtube-automation`.

## Resultado

`version-chatgpt` incorpora `cooper-final` sin conflictos y conserva como antecesor su base `ed02763965e1286630b0b4014ea18855824feccd`. El repositorio principal quedó en `version-chatgpt`. Se trabajó y se hicieron los commits propios en `/home/david/Proyectos/cooper-consolidar`, rama `cooper-consolidar`; la integración preparada se llevó al repositorio principal por avance directo. El commit de fusión conserva ambos padres, sin squash ni pérdida de historia.

El código validado se subió con ambos comandos autorizados, sin force push:

```bash
git push mio version-chatgpt:main
git push mio version-chatgpt
```

Este informe y sus evidencias se incorporan después mediante un commit documental y los mismos dos comandos. No se modificó la rama local `main`. Los archivos previos sin seguimiento en `docs/diseno/`, `docs/misiones/` y `tools/codex/` del repositorio principal se conservaron.

## Commits de la misión

| Commit | Contenido |
| --- | --- |
| `fbc3f96` | Fusión de las fases y mejoras finales de Cooper, con mensaje en español. |
| `f57a05f` | Rutas fijas de servicios y exclusión de datos y credenciales locales. |
| `be45cd3` | Selectores de controles visibles del chat y comentario de compatibilidad del servicio. |
| `60badad` | Comprobación de la cara del encabezado, diferenciada de la bienvenida. |
| `8c5fd56` | Separación horaria mínima entre largos, con regresión determinista y flujo regenerado. |
| Commit documental de este informe | Evidencias y resultado de la instalación y limpieza. |

`cooper-final` conserva `d994abf78c1980031780b6c9219781aad61e12f1`. La puerta final corresponde a `8c5fd561bed288f68944ceff4d1f70a40ee050b0`. Los cambios posteriores a ese SHA son documentación/evidencias; no cambian el código de aplicación ni las unidades verificadas.

## Seguridad antes de subir

Búsqueda propia sin revelar coincidencias: objetos de **todo el historial alcanzable** de `cooper-final` y `version-chatgpt`, incluidos blobs borrados o sustituidos, mensajes de commits y nombres de archivos de cada árbol. Base original `ed027639`; **91 commits nuevos** de `cooper-final`. Primera pasada: 1.247 blobs, cero hallazgos. Pasada previa a publicación: 1382 objetos de contenido, 1257 blobs, cero hallazgos.

Patrones: Anthropic `sk-ant-`, OpenAI `sk-`, Google OAuth `GOCSPX-`, Google API `AIza`, GitHub, Slack, JWT (incluidos n8n), claves privadas y AWS; además `.env` reales versionados. Se vuelve a escanear tras incorporar el informe. Es una búsqueda de patrones conocidos, no una garantía sobre secretos arbitrarios sin esos formatos.

`.gitignore` comprobado con 13 rutas de prueba: `.env*`, `data/`, `.cache/`, SQLite y sidecars, `credentials/`, `credenciales/`, claves privadas y nombres de archivos de credenciales locales. Los ejemplos versionados permanecen disponibles. Ningún valor de credencial se expuso en conversación, logs versionados ni Git. La consolidación y la rotación consumieron los valores solamente dentro de procesos locales. [Escaneo](evidencias/cooper-consolidar/scan.json) y [script reproducible](evidencias/cooper-consolidar/escanear-historial.py).

## Respaldo y conservación

Respaldo privado:

```text
/home/david/.cache/cooper-consolidar/respaldo-20261121-000538
```

Contiene un bundle de todas las ramas, configuración, unidades y complementos de systemd, SQLite consistente por respaldo en línea y un **archivo completo de los doce worktrees**, incluidos código, builds, dependencias, cachés, archivos ignorados y cambios sin commit. El tar contiene 500.637 entradas y 23.135.528.960 bytes. Se verificaron su lectura y SHA-256; antes de eliminar worktrees se compararon también los cambios locales y `.env` con lo archivado. Directorio 0700 y archivos sensibles 0600.

SHA-256 de `worktrees.tar`: `16abe68d04a8d924439a645b50c7dcbcf99c91bad2dbfd6f1330a11663396072`.

SQLite pasó integridad y comprobación de claves foráneas. Se hizo otra copia inmediatamente antes del reinicio. Se conserva el archivo vivo `~/.local/share/cooper/cooper.sqlite`, sin restaurar datos antiguos. No se tocaron los respaldos de `~/.cache/cooper-vivo`.

Los cambios locales de `cooper-final/docs/informes/cooper-ensayo.md`, los bytecodes modificados y las carpetas sin seguimiento quedaron íntegros en el archivo; no se añadieron silenciosamente a la fusión. Las ramas permanecen. La antigua recuperación `~/.local/lib/cooper/reversa-final-20261120` recibió una copia propia de sus dependencias para que no quedara dependiendo de `cooper-ensayo`.

## Puerta obligatoria

Ejecutada en el repositorio principal, secuencialmente, deteniéndose ante cualquier código distinto de cero:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
# Comprobación adicional del servicio trasladado:
node --test tests/puente-codex.test.mjs
```

| Comando | rc | Duración |
| --- | --- | --- |
| `npm ci` | 0 | 4.4 s |
| `npm run lint` | 0 | 1.9 s |
| `npm run typecheck` | 0 | 0.9 s |
| `npm test` | 0 | 11.4 s |
| `npm run test:e2e` | 0 | 217.8 s |
| `npm run build` | 0 | 2.2 s |
| `node --test tests/flujos_v2.test.cjs` | 0 | 0.9 s |
| `node --test tests/puente-codex.test.mjs` | 0 | 0.7 s |

**Cero errores y cero advertencias en la puerta final.** Instalación con cero vulnerabilidades; **227 pruebas unitarias**, **33 E2E**, **130 pruebas de flujos** y **12 del puente**, sin omisiones. Node 24.22.3, npm 12.2.2. Los ensayos usaron datos ficticios, puertos propios, secretos efímeros y fábrica simulada. [Resultados](evidencias/cooper-consolidar/puerta.json); logs individuales en la misma carpeta. Los logs versionados solo normalizan retornos de carro y espacios al final de línea; los originales permanecen en la caché local.

Incidencias corregidas antes de la ejecución final:

- Tipos de `.next` de la antigua rama `cooper-fase1` apuntaban a `/api/prueba`, ruta eliminada. Se archivó el build previo y se regeneraron los tipos con el comando oficial `next typegen`. No se restauró la ruta de pruebas en producción.
- El test del chat coincidía con un botón oculto y después con las dos caras legítimas de Cooper en una pantalla vacía. Se acotó por rol accesible y por encabezado. La prueba dirigida pasó y se repitió toda la puerta; no se quitaron escenarios ni aserciones. Los diagnósticos anteriores quedan en `cooper/.cache/consolidar/` del repositorio principal.

- La regresión de flujos falló después de medianoche en Lima: el planificador elegía el día mínimo y luego podía adelantar su hora, incumpliendo el intervalo de 48 horas. Se reprodujo con reloj fijo (rc 1), se conservó el instante mínimo al buscar huecos automáticos y se regeneró únicamente el flujo de redes (rc 0, 130 pruebas). Las fechas explícitas del usuario conservan su prioridad. **Esta corrección está en Git, no en el n8n vivo**, que esta misión no autoriza desplegar. Evidencias `calendario-rojo.log`, `calendario-rojo.json` y `calendario-verde.log`.

## Instalación fija y validación viva

Checkout limpio, con HEAD separado en el commit de `version-chatgpt`, en:

```text
/home/david/.local/share/cooper/app
```

Dependencias instaladas con `npm ci` y build generado en esa ruta. El checkout tiene su propio `node_modules` y `.next`; no depende de `cooper-wt`. Git lo administra desde el repositorio principal. El estado versionado del checkout quedó limpio.

`cooper.service` y `puente-codex.service` usan únicamente ese checkout y `~/.config/cooper/cooper.env` (**0600**). Se consolidaron veinte variables de las fuentes disponibles de integración/ensayo, el entorno efectivo del servicio y `codex.env`; no existía `.env.local` en `cooper-final`. No hubo valores en conflicto entre fuentes. Se preservaron Google, Auth.js, dueño, tokens de los puentes y HMAC. Los archivos anteriores externos a los worktrees se conservan porque n8n todavía puede usarlos.

Los selectores de ejecución fijan producción, demo/pruebas apagadas, base persistente y respaldo API del chat desactivado. El modo `auto` conserva Claude CLI como primera opción y Codex local como respaldo. Se validaron las unidades con `systemd-analyze --user verify`, se recargó systemd y se reiniciaron **solo los dos servicios de Cooper**. El proceso anterior de Cooper agotó su plazo de parada de 30 segundos y systemd lo terminó antes de arrancar el nuevo; la nueva instancia quedó activa sin reinicios y SQLite pasó las comprobaciones. No hubo despliegue, reinicio, edición de flujos, pagos ni producción de videos en n8n; D&S Factory quedó intacta.

| Comprobación viva | Evidencia |
| --- | --- |
| Salud de Cooper 200; inicio redirige a entrada | `validacion.json` |
| Continuar con Google redirige a `accounts.google.com` | `google.json`; navegación interceptada antes de cargar Google, sin login OAuth |
| ChatClaudeCli desde un proceso systemd con la configuración instalada | `claude.json`; respuesta estructurada real, datos ficticios, cero herramientas |
| Puente Codex: salud 200 con token y 401 sin token | `validacion.json` |
| Puente n8n: estado y tendencias 200, contratos válidos | `validacion.json`; consultas sin producción |
| HMAC válido 200/`nueva`, inválido 401 | `validacion.json` y `hmac-contenedor.json`, también desde `videos-n8n` por su URL configurada |
| SQLite y configuración preservadas | `preservacion.json` |
| Ambos servicios activos y rutas fijas | `servicios.json` |

La comprobación HMAC consulta un recibo inexistente: no reserva, confirma ni despacha órdenes. La prueba de Claude verifica el adaptador real bajo systemd; no equivale a una conversación en una sesión Google de producción. Los recorridos privados completos se verificaron mediante E2E con cuentas ficticias.

## Limpieza y clave n8n

Después de puerta, publicación y validación viva satisfactorias se retiraron **12 worktrees** de `~/Proyectos/cooper-wt` mediante `git worktree remove --force`. Se necesitó `--force` por los cambios locales ya respaldados y comprobados. Cada rama conservó exactamente su SHA. Se comprobó que los dos servicios ya no dependían de esas rutas. Algunas sesiones antiguas de herramientas y los monitores de contenedores conservaban un directorio de trabajo heredado; no se terminaron esos procesos ni se reinició n8n. Las sesiones futuras deben abrirse en el repositorio principal o en la instalación fija. [Detalle por rama](evidencias/cooper-consolidar/limpieza.json).

La clave `~/.config/cooper/n8n-api-key-nueva` existía, no incluía caducidad y autenticó una lectura `GET /api/v1/workflows?limit=1` con HTTP 200. La anterior pasó a `n8n-api-key.anterior`; la nueva ocupa `n8n-api-key`, ambas con 0600. No se devolvieron ni guardaron respuestas privadas de la API en el informe. [Rotación](evidencias/cooper-consolidar/clave.json).

## Limitaciones reales y Pendientes de Walter

- **Claude debe borrar/revocar la clave anterior en n8n** después de esta validación. El archivo `.anterior` se conserva como respaldo; renombrarlo no revoca la clave en el servidor.
- Autorizar en una misión posterior el despliegue de la corrección del calendario en n8n. Hasta entonces el n8n vivo conserva el comportamiento previo para publicaciones automáticas cercanas al límite horario.
- La entrada se comprobó hasta la redirección a Google; no se hizo login OAuth ni se fabricó una sesión de producción. Walter puede revisar el estudio con su sesión habitual.
- Las sesiones/cuotas de Claude y ChatGPT siguen dependiendo de las cuentas locales existentes. El ensayo real no garantiza disponibilidad futura. El respaldo API del chat permanece apagado.
- No se ensayó producción audiovisual, publicación, restauración completa de los servicios ni despliegue en VPS. El respaldo SQLite sí se verificó y el archivo completo se comprobó antes de limpiar.

## Documentación oficial consultada

- [n8n: autenticación y cabecera X-N8N-API-KEY](https://docs.n8n.io/connect/n8n-api/authentication.md), contrastada antes de la lectura de validación.
- [Claude Code programático](https://code.claude.com/docs/en/headless), para la comprobación del adaptador CLI existente.
- Guía oficial instalada de Next: `cooper/node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`, sección `next typegen`.

[Manifiesto de evidencias](evidencias/cooper-consolidar/SHA256SUMS).
