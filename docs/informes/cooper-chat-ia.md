# Cooper: chat con IA real

20 de noviembre de 2026. Worktree `/home/david/Proyectos/cooper-wt/cooper-chat-ia`, rama `cooper-chat-ia`. Base `96bc916`. Código de la puerta: `445848d`; el commit posterior solo registra este informe. No hubo push, merge, despliegue, OAuth, pagos ni acceso al n8n vivo o D&S Factory. Los directorios preexistentes sin seguimiento `docs/diseno/` y `docs/misiones/` se conservaron.

## Commits

| SHA | Contenido |
| --- | --- |
| `5cd0672` | Proveedores Claude/OpenAI/simulado, SSE incremental, continuidad de herramientas y transcripción OpenAI; pruebas de transporte. |
| `445848d` | Agente y herramientas del puente, memoria, permisos, confirmaciones, interfaz, fotos/audio, migración y evaluación de 30 conversaciones. |
| `HEAD` al entregar | Registrar este informe y la evidencia final, sin cambios de ejecución. |

## Implementación

- `ProveedorChat.generar`: Claude Messages con `claude-sonnet-5-5` y versión `2026-10-21`; OpenAI Responses con `gpt-6.1-sol`, `store: false`; proveedor simulado. Solo nombres `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` y valores vacíos en `.env.example`. El respaldo ocurre antes de emitir contenido; una respuesta parcial no se repite. HTTP sin redirecciones, tiempo máximo, lectura SSE fragmentada y reconocimiento de fin completo. Pensamiento y firmas se conservan únicamente en servidor para continuar herramientas.
- Los 12 eventos y las cinco consultas del contrato tienen herramientas con validación estricta. `aprobar_guion` y `aprobar_final` mantienen sus nombres exactos; `gastos` solo se ofrece a admin. El servidor determina dueño y privilegios. Incluso Walter usa sus recursos en el chat; no se aceptan identidad, rol ni parámetros arbitrarios del modelo.
- Todas las mutaciones requieren tarjeta y botón explícito. Parámetros persistidos, huella de recurso/medios y de videos dependientes al borrar canal; vencimiento de 15 minutos y consumo único. Doble clic, replay, otra cuenta y revisión modificada se rechazan. Un resultado remoto incierto queda para revisar sin reenvío de esa tarjeta. Un «sí» escrito no confirma.
- Memoria en `messages`, canal activo y bloqueo temporal por dueño en SQLite. Migración aditiva `0005_chat_ia`. Contexto limitado al dueño/canal; varios videos exigen seleccionar uno. No se incorpora gasto del equipo ni secretos al modelo. Revalidación de sesión durante streaming, en herramientas y al confirmar.
- Respuestas progresivas por frases filtradas; boca sincronizada con llegada y pausas, reposo al terminar. Se mantienen movimiento reducido, tema y diseño existente. Tarjetas persistentes, estado de error recuperable y selectores de canal/video.
- Audio grabado → transcripción editable → mensaje. OpenAI `gpt-transcribe` es seleccionable junto a Gemini y simulación. Fotos actuales y hasta cinco recientes llegan como referencias visuales, comprobando dueño. El enlace a avatar reutiliza la foto propia en el formulario existente, conservando reto, evidencia y consentimiento.

Configuración, protocolos y fuentes oficiales consultadas antes de implementar: [README: chat con IA](../../cooper/README.md#chat-con-ia-y-confirmación-de-acciones). Destacan [Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Messages y su versión vigente](https://platform.claude.com/docs/en/api/migration-2026-10-21), [herramientas de Claude](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls), [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create/) y [transcripción de archivos](https://developers.openai.com/api/docs/guides/speech-to-text). También se consultaron las guías locales de Next 16.4.6. Sin dependencias nuevas.

## Puerta y evidencia

Cadena ejecutada con `pipefail`, sobre `445848d`:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

| Comprobación | Resultado | Código |
| --- | --- | --- |
| `npm ci` | PASS; 357 paquetes, 0 vulnerabilidades | 0 |
| `npm run lint` | PASS; 0 errores, 0 advertencias | 0 |
| `npm run typecheck` | PASS; TypeScript estricto | 0 |
| `npm test` | PASS; 175 pruebas en 19 archivos | 0 |
| `npm run test:e2e` | PASS; 25 escenarios, sin omisiones | 0 |
| `npm run build` | PASS; build de producción | 0 |
| `node --test tests/flujos_v2.test.cjs` | PASS; 119 pruebas, sin omisiones | 0 |

Cadena completa y regresión: **código 0, sin errores ni advertencias**. Se inspeccionaron los logs completos. Las pruebas no contactan servicios de producción.

Logs: [puerta completa](../../cooper/.cache/chat-ia-puerta.log), [flujos](../../cooper/.cache/chat-ia-flujos.log), [SHA ensayado](../../cooper/.cache/chat-ia-sha.txt). Node 24.22.3, npm 12.2.2, Next 16.4.6. Bases temporales y sesiones Auth.js ficticias en ejecutores locales; red de Vitest bloqueada salvo transportes reemplazados expresamente.

La evaluación versionada [chat-30.json](../../cooper/tests/fixtures/chat-30.json) obtuvo **30/30**: 17 selecciones de herramientas y 13 conversaciones de alcance, avatar, memoria, audio y seguridad entre dueños. [Resultado reproducible](../../cooper/.cache/evaluacion-chat-30.json). Las llamadas hostiles se inyectan deliberadamente para evaluar defensas del servidor. Esto no mide la precisión de Claude/OpenAI en lenguaje natural.

Pruebas adicionales: streaming antes del fin, UTF-8 partido, errores y truncamiento de proveedores, continuidad de tool results, respaldo sin duplicación, bloqueo de conversaciones concurrentes, suspensión, confirmaciones vencidas/manipuladas, huella de revisión, aislamiento de fotos y acceso a avatar. E2E comprueba producción después del botón, persistencia tras recarga, confirmación ajena, boca durante pausas, audio editado y foto reutilizada sin omitir identidad.

Capturas reales: [tarjeta a 390 px](../../cooper/test-results/visual/chat-confirmacion-390.png), [1440 px](../../cooper/test-results/visual/chat-confirmacion-1440.png); demás pantallas y matriz de anchuras en el reporte Playwright. La conversación conserva su desplazamiento interno. Se corrigió la bienvenida duplicada durante el primer stream; el simulador ahora entrega fragmentos observables en demo/E2E. El primer instalador de Chromium avisó que usaba el binario compatible con Ubuntu; la puerta final reutiliza la instalación local.

Auditoría adicional: `node scripts/auditoria.mjs --rapida`, código **0**. Inicio autenticado en ambos temas, móvil y escritorio: rendimiento **97–100**, accesibilidad **100**, buenas prácticas **100**, cero advertencias. [Log](../../cooper/.cache/chat-ia-auditoria.log), [resumen Lighthouse](../../cooper/.cache/auditoria/resumen.json). Mediciones locales de laboratorio, no datos de campo. Axe no detectó violaciones en las comprobaciones E2E, incluidas las tarjetas a 390/1440 px y la matriz general de 360/390/768/1024/1440/1920 px.

## Limitaciones reales

1. Adaptadores reales implementados y contratos HTTP comprobados con respuestas ficticias. No se enviaron datos ni peticiones pagadas a proveedores; no se verificaron credenciales, cuotas, latencia o calidad real de los modelos. El rechazo conversacional de asuntos fuera de alcance depende del modelo; la autorización de herramientas no depende de él.
2. Memoria de contexto acotada a 30 mensajes, 30 canales/videos y 12.000 caracteres de guion por video; fotos hasta cinco y 15 MB agregados, archivo individual hasta 5 MB. No hay resumen semántico del historial antiguo ni política nueva de retención. PDF y otros archivos permanecen descargables, sin interpretación multimodal de su contenido.
3. En n8n, reportes/pendientes se consultan y luego se proyectan desde el estado propio sincronizado. Tendencias usan el radar guardado. El gasto real se consulta en Administración; el chat administrativo solo devuelve importes propios simulados o remite allí. Esta misión no añade contabilidad monetaria del consumo de los modelos.
4. Una caída después de enviar una acción a la fábrica puede dejarla en «ejecutando»/«revisar»; exige conciliación, nunca repetición automática de la misma tarjeta. SQLite y los límites HTTP existentes están orientados a la instancia pequeña actual. La evaluación simulada no certifica comportamiento universal de un modelo ni WCAG completo.
5. El flujo de avatar conserva revisión de identidad y consentimiento existentes. No se crea ni entrena un avatar automáticamente por adjuntar una foto. Los transportes audiovisuales y la fábrica mantienen sus límites previos.

## Pendientes de Walter

- Configurar en servidor las claves indicadas y comprobar acceso a los modelos; decidir `COOPER_CHAT` y `COOPER_TRANSCRIPCION` para el entorno de ensayo. Demo y pruebas seguirán simulados.
- Autorizar y ejecutar un ensayo real acotado con datos ficticios: herramientas, fotos, audio, pérdida de conexión y respaldo. Repetir las 30 conversaciones con modelos reales para medir su acierto y registrar fallos; esta ejecución no consumió presupuesto externo.
- Revisar el envío de historial/fotos al proveedor principal y al respaldo, y fijar la retención antes de usar fotos personales reales.
- Revisión independiente de los commits y de `0005_chat_ia` al integrar otras misiones. La migración y la configuración del proxy SSE en el entorno de destino corresponden a esa revisión; no se integró ni desplegó desde este worktree.
