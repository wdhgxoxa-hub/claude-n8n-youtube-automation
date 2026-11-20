# Entrega — Cooper, fase 1

Fecha: 20 de noviembre de 2026. Rama: `cooper-fase1`. Base: `ed02763`.
Código y pruebas verificados: `620d1c6`. El commit posterior de entrega solo añade este archivo.
Todos los cambios versionados de la misión están dentro de `cooper/`. No se hizo push, integración ni despliegue.

## Commits

| Commit | Cambio |
| --- | --- |
| `c1a3fa3` | Conservar base e implementar persistencia, permisos y contratos de fábrica. |
| `2e664b4` | Construir estudio visual, chat, revisión y gestión del equipo. |
| `71aa6ba` | Afinar accesibilidad, aislamiento y revisión administrativa; dar formato legible al código. |
| `9b1a665` | Conectar presentadores por video y cubrir flujos con Vitest y Playwright. |
| `688e213` | Documentar arranque, contratos y límites de la fase uno. |
| `620d1c6` | Localizar los selectores de producción por su nombre accesible. |
| `HEAD` al entregar | Registrar esta entrega verificada, sin cambios de ejecución. |

## Puerta final

Se ejecutó la cadena solicitada, en este orden, con `pipefail` para conservar el código real de salida:

```bash
cd cooper
npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
```

| Comando | Resultado | Código |
| --- | --- | --- |
| `npm ci` | PASS; instalación limpia, 0 vulnerabilidades, sin advertencias. | 0 |
| `npm run lint` | PASS; 0 errores y 0 advertencias. | 0 |
| `npm run typecheck` | PASS; TypeScript estricto. | 0 |
| `npm test` | PASS; 37 pruebas, sin omisiones. | 0 |
| `npm run test:e2e` | PASS; 9 escenarios Chromium sobre build de producción, sin omisiones. | 0 |
| `npm run build` | PASS; Next.js 16.4.6/Turbopack, sin advertencias. | 0 |

Código de salida de toda la cadena: **0**. Evidencia íntegra: [verificacion-final.log](.cache/verificacion-final.log).
Entorno: Node.js 24.22.3, npm 12.2.2, Playwright 1.65.1, Chromium 159.0.8154.6. Los ensayos usaron bases y secretos aleatorios separados de cualquier instancia real.

Regresión adicional: `node --test tests/flujos_v2.test.cjs`, desde la raíz, **90/90 PASS**, código 0. Se redirigió el temporal a `cooper/.cache/` y se desactivó la escritura de bytecode de Python. Evidencia: [regresion-flujos.log](.cache/regresion-flujos.log).

## Evidencia funcional y visual

- Entrada local firmada, rechazo de invitados no permitidos y de credenciales incorrectas; aislamiento de lectura, escritura, chat, adjuntos, SSE y gastos.
- Creación por chat, recorrido de doce etapas, corrección, aprobación de guion y aprobación final; ninguna puerta se atraviesa automáticamente.
- Adjuntos, micrófono MediaRecorder y transcripción editable; biblioteca propia, consentimiento, compartir y volver a privado.
- Avatar, voz y presencia elegidos por video; perfil persistente, E.164, tema y primera pestaña móvil.
- Administración, periodos de gasto, alerta diaria, invitación, retirada y suspensión con efecto inmediato.
- Axe sin violaciones detectadas en las pantallas principales de ambos temas; revisión de desbordamientos a 360, 390, 768, 1024, 1440 y 1920 px; movimiento reducido y comprobación de los límites del compositor. Capturas reales en [test-results/visual](test-results/visual/), informe de Playwright en [playwright-report](playwright-report/).
- Lighthouse móvil del inicio autenticado, sobre el build final: **100 rendimiento / 100 accesibilidad / 100 buenas prácticas**; LCP 0,8 s, TBT 10 ms, CLS 0; sin advertencias. [Informe HTML](.cache/auditoria/lighthouse.html) y [resumen JSON](.cache/auditoria/resumen.json). Medición local de laboratorio, no Core Web Vitals de campo ni certificación universal de accesibilidad.

Los artefactos de prueba se excluyen de Git y pueden reproducirse con los comandos del [README](README.md). Se corrigieron los fallos encontrados durante el desarrollo y se volvió a ejecutar la puerta completa; los resultados anteriores no sustituyen a esta ejecución final.

## Limitaciones reales y siguiente revisión

1. Chat, transcripción, producción audiovisual, tendencias, avatares, voces e identidad usan simuladores explícitos. La transcripción devuelve una frase fija editable; las voces son tonos de muestra y los avatares ilustraciones. No hay clonación ni verificación biométrica. El detalle reproduce una maqueta, no un archivo de video generado.
2. Google OAuth está implementado; la autenticación contra Google requiere credenciales del equipo. E2E usa sesiones locales HMAC, no una cuenta Google real. El modo E2E debe permanecer apagado fuera del ensayo local.
3. El adaptador HTTP de n8n está implementado y probado con un transporte simulado. El puente real, gastos reales, idempotencia distribuida y propagación de eliminaciones corresponden a la fase 2. No se contactó un n8n real ni proveedores de pago.
4. El simulador avanza mientras haya una conexión SSE abierta. Los importes son de ejemplo. WhatsApp solo guarda el número: todavía no envía avisos externos.
5. SQLite y el limitador en memoria están planteados para una instancia pequeña. Adjuntos almacenados en SQLite sin antivirus ni limpieza automática de huérfanos. CSP mantiene `unsafe-inline` para hidratación; no se acepta HTML de usuario. TLS, proxy, copias, retención y endurecimiento operativo son trabajo de la fase 5.

Claude puede revisar estos commits directamente. Prioridades sugeridas: autorización por recurso, contrato HTTP de la fase 2 y separación de simuladores respecto de futuros servicios reales. Detalles de arquitectura, variables y arranque en [README.md](README.md).
