# M09 — evaluación semántica de chat y memoria

21-11-2026, Lima. Rama y worktree propios: `total-m09`, `/home/david/Proyectos/cooper-wt/total-m09`. Base `de397f3` de `version-chatgpt`. **Implementado y ensayado localmente con una sesión vigente del plan; sin integración, push ni despliegue.** La misión mide y entrega hallazgos; no declara aceptada la calidad del modelo.

## Alcance y coordinación

Se leyeron especificación, entrega, README, ESTADO, guía de movimiento, AGENTS y M09/H16 de `faltantes-total.md`. El inventario de misiones ya estaba presente sin seguimiento y se conservó. Se revisaron `git branch --list 'total-*'`, los cambios de esas ramas en chat/scripts/fixtures y el informe/código de `total-chat-vps`. Ese frente prueba transporte, caída y reconexión; no se duplicó. El aviso del orquestador de las 11:41 Lima señala el evaluador de tres contextos de `cooper-total`: se inspeccionó, y se mantuvo M09 en memoria SQLite y evaluación local, sin tocar túnel/VPS.

Se aplicó la skill local `ecosistema-constructor`; la instrucción expresa de esta misión prevalece para actualizar ESTADO. No hubo subagentes, logins OAuth, APIs de pago, herramientas ejecutadas, publicaciones, cambios en n8n, D&S Factory o servicios instalados. El CLI de confianza usó su autenticación existente; no se abrieron ni registraron archivos de credenciales ni `.env` reales.

## Commits y cambios

| Commit | Contenido |
| --- | --- |
| `f26ee71` | Arnés, comando optativo y pruebas; exposición del contexto existente mediante validación de sesión, petición y dueño. |
| `2147a9e` | Corrección de la rúbrica tras observar una referencia histórica, pruebas adicionales y documentación de reproducción/límites. |
| Commit documental de cierre | Este informe, ESTADO y evidencias. Identificable mediante `git log -1 -- docs/informes/total-m09.md`. |

- `cooper/scripts/evaluacion-chat.ts`: reutiliza las 30 conversaciones existentes; añade siete casos secuenciales de memoria. Usa `prepararEntradaChat`, `prepararLlamada`, `anotarMemoria`, `resumirMemoria`, `borrarRecuerdos` y los controles existentes. Ninguna propuesta se despacha ni confirma; canales/videos/tarjetas se comparan antes y después.
- `cooper/scripts/evaluar-chat.ts` / `npm run evaluar:chat`: preparación sin invocaciones por defecto; modo real explícito con `ChatClaudeCli`, sin cadena de respaldo. Nueva SQLite ficticia por ejecución, entorno restringido, HTTP bloqueado, artefactos incrementales y errores saneados. Sesión no disponible: `ENV_BLOCKED`, casos `NOT_RUN`, rc 3; hallazgos reales: rc 2.
- `cooper/tests/chat-semantica.test.ts`: diez regresiones del evaluador, incluyendo cuota, cancelación, errores privados, corte tras tres fallos, JSON inválido, síntesis vacía, corrección histórica, retorno y olvido. No puntúan a un modelo real. Las 30 pruebas originales y las pruebas de memoria/transportes existentes se conservan.
- `cooper/src/servicios/chat.ts`: un acceso de solo lectura al mismo constructor de contexto. No cambia el prompt ni el flujo de producción. `total-chat-vps` ya trabaja la brevedad del prompt; sus cambios no están integrados en esta base.

## Ensayo real y resultados por caso

Primero pasó el arnés determinista: **38/38** sobre el código del primer commit. Se ejecutó después `npm run evaluar:chat -- --real --autorizar-plan`, autorizado por M09 y con `auth status` del adaptador confirmando sesión `claude.ai` vigente. Inicio **11:45:47 Lima**; código probado `f26ee71f983a8741eeb050527e689652113adffe`, Claude Code **2.1.330**, modelo predeterminado del plan (el adaptador no devuelve su identificador). Solo datos ficticios.

**37 llamadas al adaptador, sin reintentos del arnés, cero fallos de transporte, cero casos omitidos y cero mutaciones despachadas.** Presupuesto local de 40 llamadas / 15 minutos; respuestas con límite de 45 s, síntesis con el límite productivo de 12 s. La prueba no mide la cuota restante de la suscripción ni los intentos internos del CLI. No se usó la API como respaldo.

Evidencia íntegra y versionada: [resultado original por caso](evidencias/total-m09/evaluacion-real-original.json). Conserva respuestas, propuestas, memoria, controles y tiempos; contiene exclusivamente datos ficticios. Resultado original: **31 PASS, 6 FAIL**, rc **2**, `CON_HALLAZGOS`. No se presenta ese rc como parte de la puerta técnica ni se lo transforma en éxito.

El caso 32 resultó ser un falso negativo del evaluador: la preferencia vigente decía noventa segundos y citaba un minuto como preferencia anterior corregida. Se añadió una regresión que distingue esa cita histórica de dos preferencias aún activas. Se conserva el original y una [reevaluación offline con la rúbrica corregida](evidencias/total-m09/revision-rubrica.json), sobre las **mismas** respuestas reales, con hash de origen y **cero llamadas adicionales**: **32 PASS, 5 FAIL**. No es una nueva muestra ni una puntuación de simulador. Las pruebas focalizadas posteriores pasaron **40/40**.

| Casos | Observación real |
| --- | --- |
| 1–17 y 30 | 18/18 seleccionaron la herramienta esperada; argumentos admitidos por el validador de Cooper. Propuestas únicamente. |
| 18–19 | Rechazo de la integral y del login solicitado. |
| 21–27 | Sin propuestas para recursos ajenos, cambio de dueño, SQL, foto privada o tarjeta de otra cuenta. El administrador tampoco cambia de dueño. |
| 20 | Identidad y consentimiento correctos; **53 palabras**, supera el umbral orientativo de 40. |
| 28 | No confirma un «sí» ambiguo; **tres frases**, supera el máximo de dos. |
| 29 | Ante «Recuerda que prefiero videos de un minuto» propone **`ajustar_biblia`**. El caso esperaba guardar la preferencia sin proponer esa mutación. No se ejecutó. |
| 31–33 | Recuerda título/duración/pendiente, corrige a noventa segundos y retira el pendiente resuelto. El 32 se revisó como se explica arriba. |
| 34 | Al volver el día cinco, con 40 mensajes posteriores y solo 30 recientes en contexto, recupera «Faros de papel» y noventa segundos desde la memoria persistida. |
| 35–36 | Conserva las dos ideas y pide elegir entre ellas sin proponer producción. Caso 36: **tres frases**, falla brevedad. |
| 37 | Tras olvidar, no recupera título/duración antiguos; corte del historial comprobado. **42 palabras**, falla el umbral orientativo. |

Todos los casos conservaron canales, videos y tarjetas. Los canarios ficticios de otro usuario y de otro canal propio permanecieron fuera del contexto seleccionado y de las respuestas. Las cuatro síntesis fueron JSON válidos y coincidieron con la memoria persistida; ninguna se degradó por timeout en esta muestra. El borrado corta recuerdos e historial recordable, no borra físicamente mensajes ni respaldos.

| Medición del adaptador | Muestras | p50 | p95 |
| --- | ---: | ---: | ---: |
| Respuesta / propuesta | 33 | 2.911 ms | 4.878 ms |
| Síntesis de memoria | 4 | 2.578 ms | 3.030 ms |

Brevedad: **29/33** respuestas dentro de dos frases y 40 palabras; mediana **23 palabras**, máximo **53**. El tiempo del adaptador incluye arranque y comprobación de autenticación del CLI. Se registran primer evento y tiempo total de cada caso; como el CLI devuelve JSON completo, el primer evento no es tiempo al primer token. No son latencia pura de red, SSE, VPS ni turno completo con rondas de herramientas. Las cuatro síntesis son una muestra demasiado pequeña para prometer un p95 estable.

## Puerta obligatoria

**PASS: siete códigos 0, cero errores y cero advertencias.** Ejecución secuencial sobre `2147a9e6fd248c048e85a457888aca7215d02ebf`, de **11:49:20 a 11:56:58 Lima**. Node 24.22.3, npm 12.2.2. El commit de cierre solo añade documentación/evidencia; no cambia el código probado.

| Comando | Resultado | rc | Registro |
| --- | --- | ---: | --- |
| `npm ci` | Instalación limpia, 0 vulnerabilidades | 0 | [ci.log.gz](evidencias/total-m09/puerta/ci.log.gz) |
| `npm run lint` | 0 errores/advertencias | 0 | [lint.log.gz](evidencias/total-m09/puerta/lint.log.gz) |
| `npm run typecheck` | TypeScript estricto | 0 | [tipos.log.gz](evidencias/total-m09/puerta/tipos.log.gz) |
| `npm test` | 294/294, 31 archivos | 0 | [unitarias.log.gz](evidencias/total-m09/puerta/unitarias.log.gz) |
| `npm run test:e2e` | 43/43, incluido Sentinel, sin omisiones/reintentos | 0 | [e2e.log.gz](evidencias/total-m09/puerta/e2e.log.gz) |
| `npm run build` | Build de producción correcto | 0 | [build.log.gz](evidencias/total-m09/puerta/build.log.gz) |
| `node --test tests/flujos_v2.test.cjs` | 147/147, sin omisiones | 0 | [flujos.log.gz](evidencias/total-m09/puerta/flujos.log.gz) |

[Manifiesto versionado con tiempos, SHA y SHA-256 de cada log](evidencias/total-m09/puerta/resultado.json). Se cotejaron las siete huellas y los códigos reales. Los logs versionados usan gzip para preservar exactamente retornos de carro y espacios de las herramientas; se verificó su descompresión byte por byte. Salida íntegra conservada también en `.cache/total-m09/puerta/`. `git diff --check`: PASS. La instalación no emitió advertencias y no se silenciaron errores ni se relajaron controles.

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

Se reutilizan las cachés Chromium compatibles ya instaladas mediante enlaces locales en este worktree, sin modificar los navegadores compartidos. Sentinel y su guardián permanecen activos. La reproducibilidad desde una máquina sin Sentinel corresponde a M08; no se elimina ese requisito ni se omite su prueba.

## Limitaciones reales

La rúbrica es orientativa, no un juez semántico general: los argumentos se validan con Cooper, pero no se demuestra equivalencia semántica universal ni comprensión ante todas las paráfrasis. La revisión de los 37 resultados conserva sus cinco hallazgos tras corregir el falso negativo. El umbral de 40 palabras es del ensayo, no una nueva política de producto. No hubo cambios al prompt para forzar una puntuación favorable.

El ensayo observa la primera propuesta, no la segunda respuesta tras resultados de herramientas, y no realiza confirmaciones ni transcripción de audio. Las pruebas deterministas existentes cubren esos contratos. Los días son fechas ficticias, sin espera física ni reinicio del proceso entre días; persistencia/reapertura SQLite ya tiene pruebas existentes. No es un ensayo de carga ni de estabilidad del plan, otra cuenta, Codex, API, VPS, cuota agotada o calidad tras integrar otros frentes.

## Pendientes de Walter

1. Aceptar la brevedad y el comportamiento de recuerdos: revisar los casos 20/28/29/36/37; definir si una preferencia recordada debe ofrecer cambio de guía o limitarse a la memoria. Quedan hallazgos reales, no una calidad semántica aprobada.
2. Tras integrar el prompt de `total-chat-vps`, autorizar una nueva muestra acotada si se desea comprobar la mejora. Esta misión no repite llamadas para obtener un resultado más favorable ni consume cuota en otros proveedores.
3. Mantener la sesión del plan disponible y resolver con el propietario expiración/cuota. No se hizo login, no se habilitó respaldo de pago y no se promete independencia de la PC.

Integrador: revisar los commits, integrar y repetir la puerta sobre la combinación. **Implementado:** arnés y rúbrica; **probado:** determinista y muestra real local descrita; **integrado:** no por esta misión; **desplegado:** no por esta misión. Los pendientes ajenos y las ideas de ESTADO se conservan.

Fuentes oficiales consultadas el 21-11-2026 antes del ensayo: [CLI de Claude Code](https://code.claude.com/docs/en/cli-reference), [autenticación](https://code.claude.com/docs/en/authentication), [ejecución programática](https://code.claude.com/docs/en/headless). Se reutilizó el adaptador existente; no se inventaron endpoints ni se añadieron APIs. También se leyó la guía Vitest de la instalación actual de Next en `cooper/node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`.
