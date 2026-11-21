# Cooper: chat con los planes locales

20 de noviembre de 2026, America/Lima. Base `cooper-final` (`b06eb16`). Trabajo en rama y worktree propios: `cooper-chat-planes`, `/home/david/Proyectos/cooper-wt/cooper-chat-planes`. Código desplegado y verificado: `70d70e2`. El commit de cierre añade este informe y las evidencias; `cooper-final` incorpora la misión por avance directo, conservando sus cambios locales anteriores. Sin push ni integración a `main`/`version-chatgpt`.

## Resultado en vivo

**Cooper responde en http://localhost:3000 con `COOPER_CHAT=auto` y respaldo API desactivado.** `cooper.service` y `puente-codex.service` están activos, con resultado `success`, en `127.0.0.1:3000` y `127.0.0.1:8789`. No se modificó n8n, sus flujos, contenedores, cron ni D&S Factory. No hubo pagos, OAuth, creación de videos, aprobaciones ni publicación.

La detección previa encontró Claude Code **2.1.330**, autenticación `claude.ai`, y Codex CLI **0.163.0**, autenticación ChatGPT. Se consultaron comandos de estado y se conservaron solo indicadores de sesión; no se abrieron ni copiaron archivos de autenticación o `.env` reales. El titular y la cuota restante del plan no se deducen del estado: se utiliza la sesión existente del usuario de sistema David.

| Commit | Cambio |
| --- | --- |
| `f081adf` | Contrato de chat del puente Codex, aislamiento y pruebas con ejecutable ficticio |
| `e1cf95a` | Proveedores locales, validación, respaldo, límites, cancelación, boca y pruebas |
| `70d70e2` | Configuración de despliegue y documentación |
| Commit de cierre de este informe | Evidencias y estado final |

## Implementación

- Orden en `auto`/`claude-cli`: **Claude CLI → Codex local → Claude/OpenAI por API si hay clave y respaldo habilitado → simulado**. `codex-local` comienza en el puente. Se mantienen los modos API explícitos anteriores. El último respaldo avisa «modo básico temporal»; demo y pruebas siguen forzando simulación. No se respalda después de contenido parcial y, si se cambia de proveedor, se conserva ese respaldo durante las rondas restantes del turno.
- Claude usa `claude -p`, salida JSON estructurada y JSON Schema draft-7. `--tools ""`, modo seguro/restringido, MCP vacío estricto, hooks/conectores desactivados, sin persistencia ni herramientas para leer archivos, comandos o navegación. Cada proceso arranca en un temporal vacío 0700. El entorno heredado se limita a PATH, HOME, LANG y TMPDIR, más NODE_ENV fijo. No se heredan claves API ni tokens de Cooper. Se eliminan temporales y se mata el grupo de procesos ante cancelación, exceso de salida o timeout.
- Codex usa el nuevo `POST /v1/chat` privado del servicio existente, autenticado y limitado a loopback, sin redirecciones. El esquema fijo viaja por `--output-schema`; se deshabilitan comandos, imágenes locales, apps, plugins, memoria, hooks, búsqueda, delegación y lectura de instrucciones de proyecto. El chat y `/v1/texto` comparten una única plaza; la ruta anterior conserva su contrato y prompt.
- Los CLI solo proponen `{texto, llamadas}`. Zod valida el sobre y el JSON de argumentos; `prepararLlamada` vuelve a validar el esquema exacto, permisos, dueño y recurso activo. Todas las mutaciones conservan su tarjeta persistente de Confirmar/Cancelar y protección contra repetición. Una instrucción del modelo o un «sí» no confirma nada.
- Una petición por dueño; FIFO global con una ejecución, hasta diez en espera y **30 turnos/hora por proceso**. Espera de cola máxima 15 s, turno 120 s, Claude 45 s por ronda, Codex 40 s y cliente del puente 45 s. Hasta cuatro rondas. Las cuotas/concurrencia devuelven mensajes recuperables y los abortos liberan las plazas.
- Respuesta completa validada para los CLI, enviada por SSE. La boca continúa hasta seis segundos tras recibirla, respetando pausa/movimiento reducido. Aviso tras doce segundos y botón accesible «Cancelar espera» en el lugar de Enviar. Cancelar no deshace tarjetas ya preparadas.

Configuración y límites: [README](../../cooper/README.md#chat-con-ia-y-confirmación-de-acciones), [ejemplo de entorno](../../cooper/.env.example), [contrato del puente](../puente-codex.md). No se añadieron dependencias ni migraciones.

## Puerta obligatoria

Ejecutada completa sobre el código final, en el worktree propio, sin `.env` real en él:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz, con temporales propios y PYTHONDONTWRITEBYTECODE=1:
node --test tests/flujos_v2.test.cjs
# Adicional:
node --test tests/puente-codex.test.mjs
```

| Comprobación | Resultado | rc |
| --- | --- | --- |
| npm ci | Instalación limpia, cero vulnerabilidades | 0 |
| lint | Cero errores y advertencias, `--max-warnings 0` | 0 |
| typecheck | TypeScript estricto | 0 |
| npm test | **227 pruebas, 23 archivos** | 0 |
| test:e2e | **33 escenarios**, sin omisiones | 0 |
| build | Next.js 16.4.6, sin advertencias | 0 |
| flujos_v2 | **129 pruebas**, sin omisiones | 0 |
| Puente Codex | **12 pruebas**, sin omisiones | 0 |

**Puerta completa: cero errores, cero advertencias.** Node 24.22.3 y npm 12.2.2. [Log](evidencias/cooper-chat-planes/puerta.log), [resumen](evidencias/cooper-chat-planes/puerta-resumen.json), [flujos](evidencias/cooper-chat-planes/flujos.log), [puente](evidencias/cooper-chat-planes/puente.log).

La [evaluación de 30 conversaciones](evidencias/cooper-chat-planes/evaluacion-30.json) pasó **30/30 con el proveedor simulado**; no se presenta como evaluación estadística de los modelos reales. Los nuevos ejecutables ficticios comprueban sesión ausente, argumentos literales, directorio vacío/privado, entorno sin claves, limpieza, timeout, cancelación, sobre inválido, exceso de salida, orden de respaldo, ausencia de APIs cuando se desactivan, FIFO/cuota y aislamiento. La integración con el ejecutable ficticio verifica que no se crea un canal antes de confirmar, que no se repite una confirmación y que un recurso ajeno o argumentos administrativos no producen tarjeta.

E2E añade respuesta completa con boca tras el fin y cancelación de espera a 390 px. Conserva la auditoría de accesibilidad, aislamiento, animación, seis anchuras y ambos temas existentes. Sus capturas y trazas quedan en `cooper/.cache/` y `cooper/test-results/`, fuera de Git.

## Ensayos reales acotados

Se usó una pregunta de estado con **datos ficticios, cero canales y cero videos**, sin herramientas de acción:

| Ensayo | Resultado |
| --- | --- |
| Adaptador Claude CLI | JSON válido, texto en español, cero llamadas; **2.247 ms** |
| Ejecutor Codex del puente | JSON válido, cero llamadas; **4.100 ms** |
| Codex por HTTP del servicio ya desplegado | JSON válido, cero llamadas; **4.989 ms** |
| Autenticación del puente desplegado | Salud con token: 200; sin token: 401 |
| Sesión Claude desde proceso de systemd | Válida |

[Claude real](evidencias/cooper-chat-planes/claude-real.json), [Codex real](evidencias/cooper-chat-planes/codex-real.json), [servicios vivos](evidencias/cooper-chat-planes/servicios-vivos.json). El proceso de comprobación usó el `EnvironmentFile` existente mediante systemd; no leyó el archivo ni imprimió su token. Se hizo además un diagnóstico corto del esquema de Claude antes del ensayo final. Ninguna prueba invocó API de pago.

Entrada viva a **390/1440 px**: 200, sin desbordamiento ni errores/advertencias de consola. Salud de Cooper: 200; chat sin sesión: 401; `/admin` sin sesión: 307. [Navegador vivo](evidencias/cooper-chat-planes/navegador-vivo.json); capturas locales `cooper/.cache/chat-planes/entrada-viva-*.png`. No se emitieron cookies de producción ni se hizo OAuth para entrar al estudio privado.

## Respaldo y despliegue

Se siguió el procedimiento de servicio de usuario del [informe de vivo final](cooper-vivo-final.md), con una ampliación limitada al puente local necesaria para su nueva ruta. Antes de reiniciar se comprobó que no había un proceso hijo del puente ni un turno de chat reservado.

Respaldo previo privado:

```text
/home/david/.cache/cooper-chat-planes/respaldo-20261120-223305-0500/
```

SQLite se copió mediante respaldo en línea. Se verificó de nuevo después de cerrar las conexiones: integridad `ok`, cero errores de claves foráneas, **ocho migraciones**, hash conservado. Directorio 0700, base/código/manifiesto 0600. Incluye los archivos anteriores del puente. El manifiesto definitivo contiene los tres archivos persistentes; no depende de sidecars WAL/SHM temporales. [Registro de despliegue y hashes](evidencias/cooper-chat-planes/despliegue.json).

Se instaló el código del puente en `~/.local/lib/cooper/puente-codex`, incluyendo `chat.schema.json`. Cooper usa el build verificado `9dOj3Hh-SeslbBEtY2miS`, en el worktree de esta misión. El [complemento de systemd versionado](../../deploy/systemd/cooper-chat-planes.conf) conserva la unidad y el `EnvironmentFile` originales y referencia directamente `~/.config/cooper/codex.env`. No copia secretos. Los selectores explícitos de `ExecStart` prevalecen sobre archivos de entorno: `auto`, demo apagada, respaldo API apagado y la misma base `~/.local/share/cooper/cooper.sqlite`.

Se reiniciaron únicamente `puente-codex.service` y `cooper.service`; ambos terminaron en `active/running`, `Result=success`, sin errores de salida. La base conserva ocho migraciones e integridad correcta. El script operativo privado está en `~/.cache/cooper-chat-planes/desplegar.py`; no debe repetirse a ciegas porque rechaza un complemento ya existente.

### Reversa

La misión no cambia el esquema de SQLite: **no restaurar el respaldo antiguo sobre actividad nueva**. Conservar primero otro respaldo, esperar a que no haya conversaciones/procesos del puente activos y verificar que el build anterior de `cooper-final/cooper/.next` sigue disponible, sin recompilarlo. La unidad original permanece intacta y apunta a ese worktree; avanzar su rama no modifica ese build anterior.

Retirar solo `~/.config/systemd/user/cooper.service.d/chat-planes.conf` (conservar una copia en la carpeta privada), restaurar `server.mjs` y `contrato.cjs` del respaldo a `~/.local/lib/cooper/puente-codex`, ejecutar `systemctl --user daemon-reload` y reiniciar ambos servicios. La unidad original recupera el chat simulado y conserva la base actual. `chat.schema.json` puede quedarse sin uso. Si el build anterior cambió después de esta misión, preparar primero una versión compatible con las ocho migraciones. No se ejecutó una reversa viva completa.

## Incidencias corregidas

- Claude rechazó el JSON Schema draft-2020-12 generado por defecto. Se cambió a draft-7, se añadió una aserción al ejecutable ficticio y pasó la consulta real.
- Turbopack intentaba rastrear el ejecutable dinámico como archivo del proyecto. Se aplicó su anotación documentada al `spawn`: el CLI es una instalación externa, no un recurso que deba empaquetarse. La puerta final no tiene esa advertencia.
- Se corrigió una lectura de ref durante render detectada por lint y un selector de prueba que esperaba habilitado Enviar después de vaciar el texto. La prueba final comprueba el comportamiento real de boca/cancelación.
- La preparación inicial de Chromium advirtió que CachyOS usa el binario compatible con Ubuntu. El navegador quedó instalado antes de la puerta; la ejecución final completa no emitió advertencias. El primer script de inspección viva necesitó fijar la ruta de navegadores antes de importar Playwright; el ensayo repetido pasó.

## Limitaciones reales y Pendientes de Walter

- Las sesiones y cuotas de Claude/ChatGPT pueden expirar o agotarse; no se iniciaron logins ni se compraron créditos. Los fallos de cuota y timeout se ensayaron con ejecutables/transporte ficticios, sin provocar agotamiento real.
- Los CLI procesan **texto**, no imágenes ni archivos. Los bytes de fotos se omiten y el modelo recibe la limitación; para analizar una foto hay que describirla o habilitar más adelante un proveedor compatible. La transcripción de audio es independiente y sus opciones reales siguen siendo por API.
- El límite global es local a un proceso y reinicia con el servicio. Cuenta turnos, no tokens ni la cuota real; cuatro rondas y respaldos pueden consumir varias solicitudes. No limita el uso personal de los CLI ni otras tareas de la fábrica. Walter puede revisar el valor de 30 turnos/hora tras observar uso real.
- Contexto local limitado a 60.000 caracteres; no se recorta silenciosamente. Los CLI entregan respuesta completa, sin streaming de tokens. La disponibilidad depende de la sesión y de las versiones instaladas.
- El **modelo** no tiene herramientas para acceder a archivos/comandos; el proceso de confianza del CLI necesita acceder a su propia autenticación. No se creó una cuenta de sistema dedicada ni aislamiento de sistema operativo completo respecto del HOME de David. Una política administrada del equipo puede prevalecer sobre opciones del CLI.
- Walter debe revisar el chat del estudio con su sesión Google existente; la aceptación viva fue sobre entrada pública y proveedores/puente, y los flujos privados se comprobaron con cuentas ficticias. No se hizo una producción audiovisual real.
- API de respaldo apagada en vivo. Solo si Walter lo decide en otra misión: configurar la clave y habilitar su uso/ensayo. No se necesita una clave para el funcionamiento actual.

Los archivos `docs/diseno/*.md` no estaban en esta base; se leyeron los dos originales disponibles en `/home/david/Proyectos/claude-n8n-youtube-automation/docs/diseno/`. Se conservaron sus criterios y el diseño existente.

## Fuentes oficiales contrastadas

Consultadas el 20-11-2026 y contrastadas con las ayudas instaladas:

- [Claude Code CLI](https://code.claude.com/docs/en/cli-reference): estado de autenticación, herramientas vacías, modos seguro/restringido y opciones no interactivas.
- [Claude programático](https://code.claude.com/docs/en/headless): JSON estructurado y `structured_output`. No se usa `--bare` porque omite la autenticación de suscripción.
- [Configuración Claude](https://code.claude.com/docs/en/settings-reference): desactivar hooks, conectores y memoria.
- [Codex no interactivo](https://learn.chatgpt.com/docs/non-interactive-mode), [CLI](https://learn.chatgpt.com/docs/cli/reference) y [configuración](https://learn.chatgpt.com/docs/config-file/config-reference): JSON, esquema de salida, sesión efímera y restricciones de herramientas.
- Guías oficiales de Next instaladas: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` y `01-app/03-api-reference/08-turbopack.md`.

[Manifiesto de evidencias](evidencias/cooper-chat-planes/SHA256SUMS.txt).
