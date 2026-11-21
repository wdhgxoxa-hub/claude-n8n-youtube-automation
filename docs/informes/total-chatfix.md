# total-chatfix — respuestas breves y recuerdos sin cambios de guía

> **Archivo histórico recuperado por `total-integrador-producto`, 21-11-2026 (Lima).** Los resultados y hashes siguientes corresponden exclusivamente a `total-chatfix` sobre su base original. La integración conserva la política posterior de 18 palabras y segunda frase solo para una decisión; recupera los complementos de memoria y destinos que faltaban, con pruebas deterministas nuevas. No se atribuyen el 37/37 real ni esta puerta antigua a la combinación actual. Véase [la revisión de integración](total-integrador-producto.md).

21-11-2026, Lima. Rama `total-chatfix`, worktree `/home/david/Proyectos/cooper-wt/total-chatfix`. Base original `de397f3` de `version-chatgpt`; `git merge total-m09` incorporó por avance rápido `e5cbc3a`, como pidió esta misión. **Implementado y probado localmente; sin integrar a main/version-chatgpt, push ni despliegue.**

## Resultado y commits

**Segunda muestra real: 37/37 PASS, cero hallazgos con la rúbrica de M09 sin modificar, rc 0.** Los cinco hallazgos originales pasan en ambas muestras nuevas. La primera encontró además un destino incorrecto para referencias; se corrigió antes de repetir todos los casos.

| Commit | Cambio |
| --- | --- |
| `fdc6ebb` | Una frase de hasta 18 palabras por defecto, hasta 30 en dos frases si hace falta; aclaración concreta, memoria automática sin tarjeta y ausencia de recuerdos sin sustituirlos por un video activo. |
| `6827959` | Catálogo de herramientas con destino explícito: canal o video. Comparte la clasificación con el validador existente. Regresión para referencias, incluido rechazo del ID de un canal propio. |
| Cierre documental | Este informe, ESTADO y evidencia; identificable con `git log -1 -- docs/informes/total-chatfix.md`. |

Se leyeron AGENTS, especificación, entrega, README, ESTADO, guía de diseño e informe M09. Se aplicó la skill `ecosistema-constructor`, con las autorizaciones expresas de la misión para incorporar la base y actualizar ESTADO. Se conservan los dos archivos de misión que estaban sin seguimiento. No hubo subagentes ni cambios en otras worktrees o servicios.

Se reutilizó la indicación de 18 palabras revisada en el diff de `total-chat-vps`, sin incorporar su rama. Las respuestas no se cortan ni se reescriben después de generadas; la síntesis de memoria mantiene su prompt separado y su JSON completo. No se cambiaron esquemas de argumentos, controles de acceso, confirmaciones ni persistencia.

## Ensayo real: evidencia y revisión

Se reutilizó `npm run evaluar:chat -- --real --autorizar-plan` desde `cooper/`, con `ChatClaudeCli`, sesión del plan ya vigente, SQLite ficticia nueva por muestra, HTTP del arnés bloqueado y respaldo API desactivado. El CLI de confianza administra su autenticación; no se abrieron archivos de sesión ni `.env` reales, no se imprimieron credenciales y no hubo login OAuth.

| Muestra | Código | Resultado | rc | Evidencia |
| --- | --- | --- | ---: | --- |
| M09 revisada, anterior | `2147a9e` (rúbrica sobre respuestas de `f26ee71`) | 32 PASS / 5 FAIL | 2 original; revisión offline | [Revisión histórica](evidencias/total-m09/revision-rubrica.json) |
| Ensayo 1 | `fdc6ebb` | 36 PASS / 1 FAIL | 2 | [Resultados íntegros](evidencias/total-chatfix/ensayo-1.json) |
| Ensayo 2 | `6827959` | 37 PASS / 0 FAIL | 0 | [Resultados íntegros](evidencias/total-chatfix/ensayo-2.json) |

Dos muestras nuevas, **74 invocaciones al adaptador en total**, sin reintentos del arnés, fallos de transporte ni casos omitidos. Cada muestra conserva los límites originales: 40 llamadas, 15 minutos, 45 segundos por respuesta y 12 por síntesis. No hubo herramientas despachadas; los controles de canales, videos, tarjetas y canarios de otros usuarios/canales permanecieron verdaderos. No se habilitaron APIs de pago, n8n, D&S Factory, redes ni VPS.

| Hallazgo M09 | Observación final | Palabras / frases |
| --- | --- | ---: |
| 20: avatar, 53 palabras | Dirige a Avatares y voces y conserva identidad y consentimiento. | 24 / 1 |
| 28: «sí» ambiguo, tres frases | Pide concretar qué se quiere; no propone ni confirma acciones. | 23 / 1 |
| 29: preferencia convertida en `ajustar_biblia` | «¡Anotado! Tendré presente que prefieres videos de un minuto.» Sin herramientas. | 9 / 2 |
| 36: elección entre dos ideas, tres frases | Nombra ambas ideas y pregunta cuál retomar; sin producción. | 18 / 2 |
| 37: olvido, 42 palabras | Reconoce que no tiene título/duración y los pide, sin recuperar lo olvidado. | 21 / 1 |

El ensayo 1 detectó en el caso 8 un ID de canal para `referencias`, que requiere un video. La descripción anterior solo decía «ID local del contexto»; ahora indica el tipo que ya exige el servidor. Se conservó el fallo, se reprodujo la carencia del catálogo en una regresión (rc 1) y se verificó su corrección (76/76, rc 0): [rojo](evidencias/total-chatfix/referencias-rojo.log.gz), [verde](evidencias/total-chatfix/focalizadas-verde.log.gz). La prueba roja se filtró por nombre; las 18 pruebas no seleccionadas no son omisiones de la puerta. El ensayo 2 propone la referencia para Luna y el validador acepta sus argumentos.

La revisión de las respuestas confirma selección y límites de dueño en los casos 1–30. Memoria 31–37: conserva título, duración y pendiente; sustituye un minuto por noventa segundos; retira la búsqueda resuelta; recupera desde el resumen tras 40 mensajes; conserva dos ideas; pide elegir y respeta el corte de olvido. Las cuatro síntesis finales son JSON válidos y coinciden con la memoria persistida. La referencia al minuto anterior queda explícitamente marcada como preferencia sustituida.

Brevedad final: **33/33** respuestas dentro de dos frases y 40 palabras, mediana **19**, máximo **26** (M09: mediana 23, máximo 53). No se relajó el umbral de la rúbrica para obtener el resultado. [Resumen con SHA-256, conteos y mediciones de ambas muestras](evidencias/total-chatfix/resumen.json).

| Fase final | n | p50 | p95 |
| --- | ---: | ---: | ---: |
| Respuesta/propuesta | 33 | 2.832 ms | 3.299 ms |
| Síntesis de memoria | 4 | 2.655 ms | 3.172 ms |

Son tiempos del adaptador, incluidos arranque y autenticación del CLI; no son latencia pura de red, primer token, SSE ni turno completo. Cuatro síntesis no bastan para prometer estabilidad del p95.

## Puerta obligatoria

**PASS: siete códigos 0, cero errores y cero advertencias**, sobre `6827959356982ff048c9e6f6b4d6b227fe2d53d9`, de **12:20:05 a 12:27:30 Lima**. Node 24.22.3, npm 12.2.2; CLI real 2.1.330. El commit de cierre solo añade documentación y evidencia.

| Comando | Resultado | rc | Registro |
| --- | --- | ---: | --- |
| `npm ci` | Instalación limpia; 0 vulnerabilidades | 0 | [ci](evidencias/total-chatfix/puerta/ci.log.gz) |
| `npm run lint` | 0 errores/advertencias | 0 | [lint](evidencias/total-chatfix/puerta/lint.log.gz) |
| `npm run typecheck` | Tipos correctos | 0 | [tipos](evidencias/total-chatfix/puerta/tipos.log.gz) |
| `npm test` | 295/295; 31 archivos | 0 | [unitarias](evidencias/total-chatfix/puerta/unitarias.log.gz) |
| `npm run test:e2e` | 43/43; Sentinel con guardián; sin omisiones/reintentos | 0 | [E2E](evidencias/total-chatfix/puerta/e2e.log.gz) |
| `npm run build` | Compilación de producción correcta | 0 | [build](evidencias/total-chatfix/puerta/build.log.gz) |
| `node --test tests/flujos_v2.test.cjs` | 147/147; cero fallos/omisiones | 0 | [flujos](evidencias/total-chatfix/puerta/flujos.log.gz) |

Se ejecutaron secuencialmente los seis primeros comandos desde `cooper/` y el último desde la raíz, con detención ante fallo y registro del código real. [Manifiesto con tiempos, SHA y SHA-256](evidencias/total-chatfix/puerta/resultado.json). Se verificaron las siete huellas y la descompresión idéntica de los logs, y se revisaron advertencias sin silenciarlas. `git diff --check`: PASS. Evidencia sin comprimir conservada en `cooper/.cache/total-chatfix/puerta/`.

Entorno de prueba restringido a variables necesarias y datos ficticios; sin `.env` reales. Se reutilizaron los navegadores compatibles mediante enlaces locales a las cachés ya instaladas, sin modificar Sentinel ni sus navegadores. Ningún control se omitió para obtener la puerta verde.

## Limitaciones reales

El cero corresponde a esta muestra y a la rúbrica orientativa existente, con revisión de las respuestas. No garantiza la conducta de todas las paráfrasis o futuras invocaciones del modelo. Se observan primeras respuestas/propuestas y síntesis; no se ejecutan confirmaciones ni la segunda ronda posterior a herramientas en el ensayo real. Esos contratos conservan su cobertura determinista y E2E.

Los días son fechas ficticias; no se esperaron cinco días físicos. La reapertura de SQLite y el aislamiento también se prueban de forma determinista. El caso 29 evalúa selección; la persistencia real de preferencias se observa en los casos 31–35. El respaldo extractivo y el límite de síntesis de 12 segundos se mantienen, con sus límites semánticos cuando el proveedor falla. El borrado corta el contexto recordable, no elimina físicamente historial ni copias.

No se midieron VPS, Codex, API, cuota restante, sesión expirada, carga ni estabilidad prolongada. El CLI utiliza el modelo predeterminado del plan y el adaptador no devuelve su identificador. No se presenta esta muestra como aceptación de Walter o calidad universal.

## Pendientes de Walter

1. Revisar y aceptar las respuestas finales y el criterio implementado: recordar una preferencia no propone cambiar la guía; cambiarla requiere petición expresa y confirmación posterior.
2. El integrador debe revisar ambos commits, combinar con los demás frentes y repetir la puerta sobre esa combinación; esta rama no se incorporó a main/version-chatgpt ni se instaló en PC o VPS.
3. Mantener disponible la sesión del plan y aceptar por separado el chat desde el VPS. Cualquier cambio de sesión, despliegue o ensayo con proveedores pagos queda fuera de esta misión.

Fuentes oficiales consultadas antes del ensayo, 21-11-2026: [CLI Claude Code](https://code.claude.com/docs/en/cli-reference), [autenticación](https://code.claude.com/docs/en/authentication), [ejecución programática](https://code.claude.com/docs/en/headless). Se reutiliza el adaptador, sin endpoints nuevos. También se leyó `cooper/node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`.
