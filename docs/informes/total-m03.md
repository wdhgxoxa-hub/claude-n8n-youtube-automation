# M03 — conciliación de operaciones interrumpidas

Fecha de cierre: 21-11-2026, 12:02 Lima. Rama/worktree: `total-m03`, `/home/david/Proyectos/cooper-wt/total-m03`. Base: `de397f3`. **Implementado localmente; integración y despliegue reservados al orquestador.** No hubo push, merge, escrituras en VPS/n8n vivo, OAuth, pagos ni publicaciones. No se leyeron archivos de secretos ni valores de credenciales.

## Alcance y reutilización

Se ejecutó M03/H10 de `faltantes-total.md`: resolver o cerrar de forma auditable operaciones interrumpidas, sin repetir un envío potencialmente cobrado/publicado. Se leyeron especificación, ENTREGA, README, ESTADO, guía de movimiento e instrucciones de ambos AGENTS. Se revisaron ramas `total-*`, sus commits de seguridad/runtime y las funciones existentes de chat, puente, WhatsApp, Marcas e ingesta. No existía el flujo común en esta base. El aviso posterior del orquestador señaló `546f351:docs/cooper-conciliacion.md`; se reutilizó esa guía, ampliándola con el procedimiento implementado y precisando las diferencias de base.

Reutiliza `bridge_commands`, `chat_actions`, colas, checkpoints, recibos WhatsApp, validación de sesión/rol/origen y transacciones SQLite. El registro reside en `events`; no crea otra cola, base, dependencia, migración ni endpoint n8n. No hay lote de workflows que integrar: los cambios de esta misión son Cooper y documentación.

## Lo cerrado

- Administración: inventario de pendientes, dueño/cuenta, consulta por tipo/ID y cierre terminal consultable. API exclusiva de administrador, acceso revalidado, origen obligatorio en POST, límite HTTP, `no-store`, huella de versión y rechazo de doble decisión. Sin cuerpos de órdenes, teléfonos, tokens o archivos privados en la proyección.
- Chat y decisiones WhatsApp: vinculación persistente a la orden de fábrica **antes** del transporte. Se reconoce el callback confirmado del mismo dueño; una tarjeta consumida nunca vuelve a ejecutarse. Las tarjetas históricas sin vínculo mantienen la vía de revisión humana documentada.
- Fábrica: inspección de ID/ejecución; una confirmación humana exige la ejecución reservada exacta. El cierre sin evidencia conserva reserva e idempotencia. Ni tiempo vencido ni ausencia de resultado autorizan un nuevo despacho.
- Avisos WhatsApp: conciliación con recibo almacenado compatible por ID, destinatario y fecha; rechaza asociar el mismo remoto a dos avisos. Aceptación y entrega siguen separadas. Sin ID de respuesta se exige cotejo humano y recibo, sin inventar un endpoint de sondeo.
- Marcas: consulta separada de `publicar`, solo GET; historial Upload-Post por ID o envío persistido, cuenta y plataforma exactas; estado publicado de reel Facebook. Conserva checkpoints. Instagram, fotos e historias sin ID final tienen cierre administrativo con evidencia; no se deduce publicación por contenedor/carga.
- Ingestas: cierre local sin reenvío y control de estado/intento antes del commit y al manejar errores. Una respuesta tardía no puede guardar adjuntos o volver a pendiente tras el cierre. Marcas y mensajería también cercan resultados tardíos por estado/reserva.
- Registro: actor, instante, versión, estados anterior/posterior, fuente y referencia de evidencia. Las consultas sin evidencia permanecen abiertas; `cerrada_sin_reenvio` conserva desconocido el resultado remoto y no representa rechazo ni cancelación externa.

Guía funcional, matriz por subsistema, API y fuentes oficiales: [cooper-conciliacion.md](../cooper-conciliacion.md). Se consultaron documentación oficial de Upload-Post, Meta, SQLite y la guía de Route Handlers de Next instalada antes de extender las llamadas. Solo se invocaron transportes ficticios durante las pruebas.

## Commits

| Commit | Contenido |
| --- | --- |
| `e4862520596235a480836866e8497c18f93e1d16` | M03: conciliar operaciones interrumpidas sin repetir envíos. Servicios, revisión administrativa, interfaz, contratos y ensayos. |
| Commit documental posterior, identificable con `git log -1 -- docs/informes/total-m03.md` | Guía reutilizada/ampliada, enlace README, ESTADO y este informe con evidencia final. No cambia código probado. |

## Pruebas de recuperación

`conciliacion.test.ts`: quince casos de contrato, permisos, rol forjado/revocado, origen, aislamiento de proyección, callback de otro dueño, reservas, concurrencia, revisión obsoleta, recibos incompatibles/reutilizados, GET exacto y revocación durante consulta. `conciliacion-caidas.test.ts`: ocho escenarios con **SIGKILL real**, SQLite persistida y dos reinicios de procesos independientes. El transporte no sale a red; escribe un contador de aceptaciones ficticias fuera de la transacción de Cooper.

| Subsistema | Corte antes de aceptación | Corte después de aceptación | Intentos originales / duplicados |
| --- | --- | --- | --- |
| Chat + reserva n8n | Cierre sin resultado; tarjeta consumida y reserva conservada | Callback exacto cierra `confirmada` | 1 / 0 en cada caso |
| WhatsApp | `incierto`, cierre sin reenvío | Recibo HMAC ficticio + revisión cierra `aceptado`, entrega separada | 1 / 0 en cada caso |
| Marcas | `revision`, checkpoint conservado | Consulta ficticia cierra `publicada` | 1 / 0 en cada caso |
| Ingesta | `cancelada`, cero adjuntos | Corte tras commit: `completa`, un adjunto, sin nueva descarga | 1 / 0 en cada caso |

La reserva n8n sigue siendo `n8n-ficticia` tras ambos reinicios. Las aceptaciones son cero antes y una después, nunca dos. [Matriz generada](../../cooper/.cache/conciliacion-caidas.json), SHA-256 `e131f35e24266fbfb76c99df17742aa6618d3a905ba8452c6eb9ccee301f29f2`.

**Rojo → verde:** se ejecutaron los dos casos de respuesta tardía de ingesta con el archivo original de la base, preservando y restaurando el cambio. Ambos fallaron: `completa` y `pendiente` en lugar de `cancelada`; rc 1. Con la cerca aplicada pasaron los quince contratos, rc 0. [Registro rojo](../../.cache/total-m03/ingesta-rojo.log), [verde](../../.cache/total-m03/ingesta-verde.log). Las trece omisiones del rojo son el filtro dirigido de esa reproducción; la puerta final no usa filtros ni omite pruebas.

Durante desarrollo se corrigieron dos fixtures que intentaban cerrar de nuevo casos ya terminales en el segundo reinicio, un teléfono ficticio repetido y un selector E2E sin nombre inequívoco. No se relajaron las aserciones de ausencia de duplicados ni los guardianes.

E2E: consulta → evidencia → cierre → recarga → búsqueda por ID; segunda persona denegada. Axe y desbordamientos en claro/oscuro a 390/1440 px. Capturas revisadas en [conciliacion-visual](../../cooper/.cache/conciliacion-visual/). No equivale a aceptación física ni a conciliación con proveedores reales.

## Puerta completa

**PASS: siete códigos 0, cero errores y cero advertencias.** Ejecutada el **21-11-2026, 11:54:20–12:01:58 Lima**, sobre `e4862520596235a480836866e8497c18f93e1d16`. Node 24.22.3, npm 12.2.2. Orden secuencial, sin relajar guardianes ni omitir pruebas:

| Paso | Resultado / rc | Tiempo | Registro y SHA-256 |
| --- | --- | --- | --- |
| `npm ci` | Instalación limpia; 0 vulnerabilidades; **rc 0** | 6.91 s | [ci.log](../../.cache/total-m03/puerta-final/ci.log) · `cab445cb40e9bd91d2d0390446be5861f932624ba73d2c88d5bcdf1b31e805c9` |
| `npm run lint` | 0 errores / 0 advertencias; **rc 0** | 4.20 s | [lint.log](../../.cache/total-m03/puerta-final/lint.log) · `82ef02fe294108ee62820c4aac466a1c844a5d882fc917b8239cd96439fed007` |
| `npm run typecheck` | TypeScript estricto PASS; **rc 0** | 1.39 s | [tipos.log](../../.cache/total-m03/puerta-final/tipos.log) · `0781fae003f31f2e4c5d3eaff30c5369a49d8b236b5cfb6c916d9d89daef524f` |
| `npm test` | 307/307; 32 archivos; sin omisiones; **rc 0** | 28.29 s | [unitarias.log](../../.cache/total-m03/puerta-final/unitarias.log) · `f2a233167564fd3331212b70f312e8900f8d41d358d4c9b387eccce234130b31` |
| `npm run test:e2e` | 44/44; Sentinel incluido; sin reintentos ni omisiones; **rc 0** | 412.95 s | [e2e.log](../../.cache/total-m03/puerta-final/e2e.log) · `791e68eb20e3ca72d0a17cdc9fc96407b5abe4ac5f867fff9373d4a8c64a374f` |
| `npm run build` | Next 16.4.6 PASS; **rc 0** | 3.43 s | [build.log](../../.cache/total-m03/puerta-final/build.log) · `66275c5f918e03071120f977f66fcd6b94ba156dde4408be6a6a63bc95fca411` |
| `node --test tests/flujos_v2.test.cjs` | 147/147; 0 fallos/omisiones; **rc 0** | 1.02 s | [flujos.log](../../.cache/total-m03/puerta-final/flujos.log) · `ea66e5f86838d5bec0965da582b2f1b99d3866c81e70166d9b79aaa1b1207f16` |

[Resumen con tiempos y huellas](../../.cache/total-m03/puerta-final/resultado.json), SHA-256 `2178b2a1e51311a2e2d55e5e0c7ee043162ba4a11995382eb58a70a29fa5b657`. Las siete huellas se recomprobaron contra los logs completos. `git diff --check` y referencias locales del informe/guía: PASS.


```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

Los navegadores de ensayo reutilizan mediante enlaces en esta worktree la caché compatible de `total-auditoria`; no se modificó su código ni se descargó otra versión. Sentinel permanece activo. Bases, sesiones, medios y claves de pruebas son ficticios y nuevos. Los registros íntegros permanecen ignorados en `.cache/total-m03/puerta-final/`.

## Limitaciones reales

1. La consulta automática solo puede concluir lo que demuestra el recibo/ID conservado. Tarjetas antiguas sin vínculo, reservas sin confirmación y publicaciones sin ID final necesitan evidencia humana. Una confirmación administrativa queda etiquetada como tal, no como verificación automática del proveedor.
2. Cerrar sin reenvío no cancela una llamada externa ya enviada ni garantiza que el proveedor no termine después. Un callback auténtico posterior puede actualizar el hecho remoto y conserva el cierre histórico. No hay botón para editar/reabrir decisiones; una corrección posterior exige revisión delimitada.
3. Una ingesta incompleta se puede cerrar, pero M03 no reanuda su descarga ni crea un adjunto de reemplazo. Una pieza confirmada conserva el ID; no reconstruye automáticamente la hora real de publicación o métricas ausentes. No reautoriza cuentas ni consentimientos.
4. Inventario acotado a cien pendientes por tipo y cincuenta registros recientes; cierres y operaciones adicionales se consultan por ID. No es una misión de paginación/volumen M12, ni evaluación de latencia de proveedores reales.
5. No se incorpora automáticamente el código concurrente de seguridad, runtime, biblioteca o periodos Lima de `cooper-total`. El orquestador debe revisar la combinación, conservar sus cambios y repetir la puerta al integrar. La guía ya existe en su rama: conservar el contenido posterior y añadir el flujo M03; para ESTADO aplicar las adiciones de esta misión, sin reemplazar su estado más reciente por el archivo completo de esta base.

## Pendientes de Walter

- Cotejar los casos reales sin recibo suficiente y decidir su cierre o conservación; suministrar solo referencias mínimas de evidencia, nunca credenciales ni cuerpos privados. Confirmar la correspondencia entre operación, cuenta y resultado cuando se perdió el ID de respuesta.
- Decidir aparte cualquier nueva solicitud después de rechazo demostrado, reapertura histórica n8n, activación de proveedores, OAuth, gasto o publicación. M03 no los autoriza ni los ejecuta.
- Aceptar el flujo en las cuentas/dispositivos reales después de integración autorizada. La revisión/integración y despliegue quedan a cargo de `cooper-total`; no son acciones realizadas por esta misión.

Se preservaron sin seguimiento los documentos de entrada `faltantes-total.md`, `_comun.md`, `total-m03.md` de misiones y el aviso concurrente `AVISO-cooper-total.md`. Las secciones y pendientes ajenos de ESTADO se conservan; no se transforma ninguna idea en trabajo aprobado.
