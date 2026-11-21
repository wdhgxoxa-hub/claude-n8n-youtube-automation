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

## Pasada de diseño

20 de noviembre de 2026. Rama `cooper-fase1`, base `e60ebf2`, código verificado `19b849b`. El commit posterior solo actualiza esta entrega. Cambios limitados a `cooper/`, sin push.

**Dirección:** sala de edición, con la fábrica como pieza central. Se aplicaron `docs/diseno/elite-web-architect.md` y `docs/diseno/frontend-design.md`: grafito `#101214`, superficies `#191d20`, texto `#f0eee7`, secundario `#a5adb3`, azul `#a6d7ed` y arena `#cbbb9f`. Manrope local, títulos de hasta 44 px, lectura alineada a la izquierda y ritmo de 8/16/24/32 px. El recorrido y las miniaturas aportan identidad; las demás pantallas conservan una jerarquía tranquila.

Como referencias funcionales se consultaron [Frame.io](https://frame.io/) para revisión audiovisual, [Linear](https://linear.app/) para seguimiento de trabajo y [Descript](https://www.descript.com/) para creación asistida. Cooper articula su propio recorrido de doce etapas, con dos aprobaciones humanas, portadas vectoriales originales y su compañero de ojos distintos. No se importaron plantillas ni imágenes de esos productos. Herramientas: archivos/Git, Playwright local, axe, Lighthouse y búsqueda web utilizados; Figma e ImageGen disponibles, no utilizados ni autenticación comprobada. No se contactó n8n ni proveedores audiovisuales.

**Cambios entregados:**

- `COOPER_DEMO=1`: dos canales y cuatro videos verosímiles, en montaje, aprobación de guion, aprobación final y publicado. Base separada con sufijo `.demo`, autenticación conservada, inicialización idempotente y fábrica siempre simulada. El ejemplo original de montaje permanece estable; las aprobaciones y los videos nuevos siguen funcionando. Arranque y límites en [README.md](README.md#demostración-de-diseño).
- Fábrica seleccionable por miniatura, doce etapas conectadas, terminadas en arena, etapa activa con pulso, progreso accesible y acceso a las revisiones. Portadas coherentes en inicio, lista y detalle.
- Bienvenida y estados vacíos con recorrido visual y acciones concretas. Se eliminó la altura fija que comprimía las sugerencias contra el compositor; la página crece cuando falta altura. La barra lateral muestra producción y aprobaciones en lugar de la elipse.
- Cooper parpadea, dirige la mirada según su estado y articula la boca al hablar. Se conservaron el ojo azul y el verde-marrón.
- Framer Motion: entrada del recorrido escalonada (25 ms entre etapas), cambio de ruta por opacidad (200 ms), hover/press en selección de piezas y sugerencias, progreso de 650 ms. Skeletons con respiración CSS. `prefers-reduced-motion` elimina movimiento no esencial; el control «Pausar movimiento» detiene también los bucles SVG ya iniciados. La información permanece visible.

| Commit | Contenido |
| --- | --- |
| `1e6b9c1` | Demostración aislada, ejemplos y pruebas del contrato. |
| `4233a49` | Fábrica, portadas, cara, estados vacíos, tipografía y compositor. |
| `19b849b` | Regresión visual/funcional, movimiento y capturas reproducibles. |

**Puerta final:** ejecutada sobre `19b849b`, exactamente en el orden solicitado:

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
```

| Comprobación | Resultado | Código |
| --- | --- | --- |
| Instalación limpia | PASS, 0 vulnerabilidades | 0 |
| Lint | PASS, 0 errores/advertencias | 0 |
| Typecheck | PASS | 0 |
| Vitest | PASS, 41 pruebas | 0 |
| Playwright | PASS, 12 escenarios Chromium, sin omisiones | 0 |
| Build | PASS, Next.js 16.4.6 | 0 |

Cadena completa: **0**. [Log final](.cache/verificacion-diseno.log). Node 24.22.3, npm 12.2.2. E2E compila una vez y arranca dos servidores de producción con bases temporales y credenciales aleatorias: modo habitual y demostración. Se corrigieron el contraste del pie de la vista previa en tema claro y dos selectores de prueba afectados por el nuevo texto y las rutas ocultas conservadas por Next; [log previo](.cache/verificacion-diseno-previa.log).

**Capturas y auditoría:** [capturas-diseno](.cache/capturas-diseno/) contiene 16 PNG: inicio, canales, videos, detalle de video, avatares, perfil y admin a **1440 y 390 px**, más fábrica a ambos tamaños, todos con `COOPER_DEMO=1`. Capturas de página completa revisadas visualmente, regenerables con `npm run test:e2e`. Permanecen fuera de Git, como los demás artefactos de la fase 1.

Axe: sin violaciones detectadas en las siete pantallas de ambos temas y en las siete pantallas demo a ambos tamaños. Sin desbordamiento horizontal en la matriz 360/390/768/1024/1440/1920; pruebas de teclado, selección de pieza, porcentaje, movimiento reducido y pausa de SVG. La regresión del compositor comprueba separación geométrica y clic real en «Crear mi primer canal» a 390/768/1440 con 700 px de alto. Esto no constituye una certificación universal WCAG.

Lighthouse móvil autenticado con demo: **97 rendimiento / 100 accesibilidad / 100 buenas prácticas**, LCP 2,7 s, TBT 20 ms, CLS 0,002, sin advertencias. [HTML](.cache/auditoria-diseno/lighthouse.html) y [JSON](.cache/auditoria-diseno/resumen.json). Medición local de laboratorio; el LCP queda por encima del objetivo orientativo de 2,5 s y es una mejora de rendimiento pendiente, sin datos de campo. Se mantienen los límites funcionales de la fase 1: las portadas y la vista previa son ilustraciones de trabajo, no videos producidos.
