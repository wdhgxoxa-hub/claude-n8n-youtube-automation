# Cooper — memoria de largo plazo y ESTADO vivo

21 de noviembre de 2026, America/Lima. Worktree propio: `/home/david/Proyectos/cooper-wt/cooper-memoria`. Rama: `cooper-memoria`; base: `16341ab` (HEAD de cooper-pulido al iniciar).

## Resultado y commits

| Commit | Cambio |
| --- | --- |
| `fb1a25c` | Persistencia, síntesis validada, aislamiento por usuario/canal, consulta administrativa, olvido persistente y pruebas de memoria/migración/HTTP. |
| `612ea85` | Tarjeta «Donde lo dejamos», retomar, ver/borrar recuerdos, consulta en Administración y recorrido E2E con capturas/axe. |
| `3f31a5d` | Verificar la síntesis integrada del turno con proveedor ficticio y normalizar las capturas tras enfocar el compositor. |
| `56d864f` | Completar la jerarquía de encabezados para recuerdos solo de preferencias y cubrirla con axe. |
| Commit documental posterior a la puerta | Regla de cierre en AGENTS.md, README, ESTADO, misión y este informe. |

La memoria se actualiza con cada mensaje del usuario (N = 1). Primero guarda apuntes extractivos; después de una respuesta completa, el mismo proveedor del chat sintetiza pendientes, títulos provisionales, decisiones y preferencias en JSON validado. Cada categoría tiene como máximo ocho entradas y cada frase 240 caracteres. Una salida parcial, inválida, demasiado grande, con herramientas o datos administrativos conserva los apuntes anteriores. La síntesis mantiene la plaza y el bloqueo del turno, tiene un plazo adicional máximo de 12 segundos y respeta la configuración existente de respaldo API.

Al empezar un turno, Cooper recibe los últimos 30 mensajes del canal activo, su resumen y el resumen sin canal del mismo usuario. Ninguna lectura administrativa cambia el contexto del chat del administrador. Los recuerdos son datos no confiables, no autorizaciones ni IDs de videos. Una referencia ambigua pide elegir. Las tarjetas solo se registran como ejecutadas después de su confirmación atendida por el servidor; crear el video retira su título de las ideas pendientes. Las declaraciones recordadas del usuario siguen siendo datos, no prueba de ejecución ni autorización.

La tarjeta muestra el pendiente o idea más reciente del usuario y prepara un mensaje en su canal al pulsar «Retomar». El panel desplegable permite revisar y borrar lo recordado. El borrado exige confirmación en la interfaz, verifica origen/dueño, se rechaza durante un turno activo y aplica una transacción SQLite: elimina resúmenes y guarda un corte que excluye mensajes anteriores del contexto y de futuras síntesis. El historial visible y los recursos de fábrica se conservan. Walter puede consultar recuerdos por persona en Administración, sin mezclarlos con los suyos.

`docs/ESTADO.md` conserva sus secciones y pendientes previos. La regla permanente de actualizarlo en cada cierre queda en `AGENTS.md` y en el README.

## Puerta completa

Código y pruebas validados: `56d864f`, con implementación en `fb1a25c` y `612ea85`. La documentación posterior no modifica código ni pruebas.

```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

| Comando | Resultado | Código |
| --- | --- | --- |
| `npm ci` | PASS; 0 vulnerabilidades | 0 |
| `npm run lint` | PASS; 0 errores y 0 advertencias | 0 |
| `npm run typecheck` | PASS | 0 |
| `npm test` | PASS; 247 pruebas en 26 archivos | 0 |
| `npm run test:e2e` | PASS; 34 escenarios, ninguno omitido | 0 |
| `npm run build` | PASS | 0 |
| `node --test tests/flujos_v2.test.cjs` | PASS; 130 pruebas, ninguna omitida | 0 |

Cadena completa: **0**. Puerta final cerrada el 21-11-2026 a las 03:27 de Lima, **sin errores ni advertencias**. Evidencia íntegra: [puerta-memoria.log](../../cooper/.cache/puerta-memoria.log) y [flujos-memoria.log](../../cooper/.cache/flujos-memoria.log).

Entorno: Node 24.22.3, npm 12.2.2, Next.js 16.4.6, Playwright 1.65.1, Chromium 159.0.8154.6. Bases temporales, identidades y credenciales efímeras del ejecutor E2E; fábrica, medios, mensajería y chat simulados. Ningún OAuth, pago, despliegue, servicio vivo ni D&S Factory.

## Evaluación y revisión visual

- Días simulados 1, 2 y 5: una idea, un pendiente, una decisión y una preferencia sobreviven a 40 mensajes intermedios y a cerrar/reabrir SQLite. La referencia «el video que estábamos pensando» recupera el título fuera del historial reciente.
- Dos usuarios y dos marcas: sin mezcla entre marcas ni usuarios; lectura administrativa explícita; ninguna memoria ajena en el chat del admin.
- Borrado y nueva conversación, incluso con reloj fijo: no reaparecen los recuerdos anteriores; los de otra persona permanecen intactos. Cancelación, turno concurrente, suspensión, síntesis inválida y herramientas hostiles conservan los permisos.
- Corrección de preferencia y cierre de pendiente con respuesta semántica ficticia; confirmación real de tarjeta frente a cancelación. Migración desde la base anterior, reaplicación idempotente y restricciones SQL.
- Recorrido de navegador: tarjeta, retomar, panel, cancelar/confirmar borrado, recarga, lectura administrativa y rechazo al usuario normal. Axe y ausencia de desbordamiento en 360/390/768/1024/1440/1920 px, temas oscuro y claro. Capturas revisadas visualmente; no equivalen a certificación universal de accesibilidad.

Artefactos reproducibles fuera de Git: [evaluación](../../cooper/.cache/evaluacion-memoria.json), [capturas](../../cooper/.cache/capturas-memoria/), [informe Playwright](../../cooper/playwright-report/).

Correcciones durante la validación: el ensayo R11 usaba un ID de sesión inexistente en SQLite; se cambió por una cuenta ficticia persistida, conservando sus 300 lecturas permitidas, respuesta 429 y recuperación. El primer E2E encontró dos selectores de Administración por una vista oculta conservada por Next; el selector se acotó a la región visible. También se alineó la tarjeta con los márgenes del estudio y se evitó duplicar títulos en pendientes. Las dos primeras puertas completas pasaron (246/247 unitarias y 34 E2E). La puerta final se repitió tras completar la jerarquía h2/h3 del estado con solo preferencias y añadir su comprobación axe; también se normalizó el desplazamiento antes de las capturas de tarjeta y Administración. Los fallos previos están en [unitarias](../../cooper/.cache/memoria-unitarias-previa.log) y [E2E](../../cooper/.cache/memoria-e2e-previa.log); no sustituyen la puerta final. La primera instalación de Chromium informó que usaba el binario de compatibilidad Ubuntu 24.04; el navegador se ejecutó correctamente y no necesitó descargarse de nuevo en la puerta final.

## Integración y limitaciones reales

**Sin fusión ni push.** La misión cooper-pulido está trabajando activamente en su worktree (HEAD observado al cierre: `2634247`), con cambios de ejecución sin confirmar y sin informe de cierre. Se preservó íntegramente y se implementó la memoria en un worktree hermano desde su HEAD confirmado. Su misión, consultada en `docs/misiones/cooper-pulido.md` del repositorio principal, solo permite fusionar cuando termine el VPS. El registro indicado `.cache/orquesta/cooper-vps-real.log` sigue en espera de IP/SSH/DNS; la preparación publicada no es la migración terminada. No se cumple la condición para fusionar.

Antes de integrar, terminar cooper-pulido, incorporar ambas ramas y resolver los cambios compartidos en chat, simulador, esquema y estilos. Conservar `0008_observabilidad` de pulido y `0009_memoria` de esta misión, con entradas ordenadas y `idx` consecutivos en el diario; no cambiar hashes ni fechas de migraciones aplicadas. La migración de memoria está comprobada desde la base confirmada con ocho migraciones, no desde la combinación todavía no disponible. Repetir la puerta en esa combinación y fusionar únicamente cuando se cumpla la condición del VPS.

La síntesis semántica se validó con proveedores ficticios. No se midió el acierto de los modelos reales, ni se consumió cuota o API de pago. En modo simulado o ante fallo, el extractor reconoce expresiones explícitas y no interpreta todas las correcciones naturales. El resumen es acotado: no conserva indefinidamente cada detalle. La síntesis añade una llamada por turno al proveedor ya seleccionado.

Los mensajes antiguos sin canal verificable permanecen sin canal; no se atribuyen a una marca ni se resumió retrospectivamente todo el historial. El borrado excluye memoria y contexto antiguo, pero no borra físicamente mensajes, adjuntos, copias de seguridad ni datos ya recibidos por un proveedor. La retención operativa de esas copias sigue siendo una decisión aparte.

## Documentación consultada

Se leyeron especificación, entrega, README y ESTADO. Las guías `docs/diseno/frontend-design.md` y `elite-web-architect.md` no estaban en este checkout: se consultaron en el repositorio principal. Se mantuvieron Manrope, grafito/marfil/celeste y el equivalente claro, sin dependencias visuales nuevas.

APIs y contratos oficiales consultados el 21-11-2026: [transacciones Drizzle](https://orm.drizzle.team/docs/transactions), [SQLite CREATE TABLE](https://www.sqlite.org/lang_createtable.html), [Route Handlers de Next](https://nextjs.org/docs/app/getting-started/route-handlers), [Claude Messages](https://platform.claude.com/docs/en/api/messages/create) y [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create/). También se leyeron las guías incluidas en `node_modules/next/dist/docs/` para rutas y componentes cliente/servidor. Se reutilizó `ProveedorChat`, sin añadir endpoints externos ni servicios.

## Pendientes de Walter

1. Resolver el acceso al VPS ya registrado en ESTADO. Hasta que termine esa misión, la integración sigue bloqueada por su condición expresa; no se necesita una aprobación nueva para la implementación local.
2. Tras integrar, revisar con conversaciones ficticias la calidad de recuerdos y la latencia del proveedor del plan, incluida su llamada adicional por turno. No es una medición cubierta por los simuladores.
3. Mantener los pendientes previos de Meta, acceso Google, aprobación del guion y VPS. No se modificó ninguno de esos servicios.
