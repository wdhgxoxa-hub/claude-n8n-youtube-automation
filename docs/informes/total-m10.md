# M10 — resultados de videos y Marcas en una consulta

Cierre: 2026-11-21 12:10, Lima. Rama `total-m10`; worktree `/home/david/Proyectos/cooper-wt/total-m10`. Base `de397f3195856c10b6a9959171ff42da4328d9ec` (`version-chatgpt`). Implementación local; integración y despliegue reservados al orquestador. Sin push, merges, cambios en VPS/n8n, OAuth, pagos, publicaciones ni lectura de credenciales o `.env` reales.

## Cambios y reutilización

- `GET /api/resultados` y las páginas autenticadas consultan una proyección SQLite por dueño. Walter conserva acceso al equipo; el usuario normal solo recibe sus ámbitos y resultados. Se comprueban también las relaciones canal/video y marca/cuenta/pieza. No se exportan guiones, checkpoints, cuentas remotas ni importes en la proyección nueva; las identidades de agrupación son huellas.
- Publicados y Aprendizaje reúnen ambos productos con filtros por tipo, dueño administrativo, canal/marca por ID, red y fechas inclusivas del día de Lima. Los homónimos conservan tipo, dueño e identificador. La actualización vuelve a leer la proyección; ante un fallo conserva lo cargado y muestra el error.
- Las publicaciones se agrupan por identidad comprobable dentro del mismo dueño, fuente, modo y red. Se conservan los registros de origen y las mediciones separadas; no se suman contadores ni se promedia retención entre redes. Cero y ausencia permanecen distintos. Se ordena el historial por fecha antes de elegir la última captura.
- Aprendizaje conserva la versión más reciente de cada lección identificada por canal y muestra evidencia, causa, hipótesis/patrón y aplicaciones. Los estudios y observaciones de Marcas se presentan como registros descriptivos, sin convertirlos en lecciones validadas. Las referencias a videos de otro canal/dueño no se exponen como evidencia enlazada.
- Los enlaces llegan al video, canal o marca/pieza y sección correspondiente, incluso tras recargar. Las piezas y observaciones tienen anclas; una referencia ajena/inexistente de Marcas no selecciona silenciosamente otra marca.

Se revisaron `git branch --list 'total-*'`, sus worktrees y el historial de los archivos afectados antes de implementar. La rama `total-aprendizaje` ya contenía el contrato y la presentación ampliados (`d1659f4`, `c726b30`): se reutilizaron sus campos opcionales, curvas con repeticiones mayores al 100 %, evidencia y aplicaciones, extraídos en `metricas-resultados.tsx`. Se reutilizó el parche de navegación `d3f0168` de `cooper-total` (página/selección de Marcas y E2E); los enlaces solos no cubrían la agregación M10. El aviso concurrente `docs/misiones/AVISO-cooper-total.md` se leyó y preservó.

No cambia el lote n8n, sus tablas ni las migraciones. No hace falta un diff de workflows para esta misión. Al integrar, resolver los cambios concurrentes de `resultados.tsx` conservando la extracción del control administrativo `InterruptorAprendizaje` en `control-aprendizaje.tsx`: reutiliza sin cambios de comportamiento el del frente Aprendizaje, ausente de la base `de397f3`. La E2E comprueba que sigue disponible para Walter y ausente para el usuario; no lo activa. La nueva lectura no activa ni reentrena ese frente.

Fuentes oficiales consultadas antes de implementar: [joins y selección de Drizzle](https://orm.drizzle.team/docs/joins), [navegación de Next](https://nextjs.org/docs/app/api-reference/functions/use-router), y las guías instaladas de Next 16.4.6 `05-server-and-client-components.md`, `15-route-handlers.md` y `not-found.md`. No se añadió ninguna llamada a APIs de redes o proveedores.

## Commits

- `f4e7f25` — M10: reunir publicaciones y aprendizajes por dueño y origen.
- `675e5f8` — M10: conservar capturas distintas y la última versión de cada lección.
- `fc3be39` — M10: conservar el control administrativo del frente Aprendizaje.
- El commit de cierre incorpora este informe y `docs/ESTADO.md`; se identifica con `git log -1 -- docs/informes/total-m10.md`.

## Pruebas y evidencia

Puerta final completa sobre código **`fc3be39e5b8435d3fd71425846b5830f79c0128e`**, Node **24.22.3**, npm **12.2.2**, Next **16.4.6**. Se ejecutó desde `cooper/`, sin omisiones:

```bash
npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
```

| Comando | Resultado | Código |
| --- | --- | --- |
| `npm ci` | PASS; 358 paquetes, 0 vulnerabilidades | 0 |
| `npm run lint` | PASS; 0 errores y 0 advertencias | 0 |
| `npm run typecheck` | PASS | 0 |
| `npm test` | PASS; 293/293, 31 archivos | 0 |
| `npm run test:e2e` | PASS; 45/45, sin omisiones, incluido Sentinel; 6,8 min | 0 |
| `npm run build` | PASS; sin advertencias | 0 |
| Raíz: `node --test tests/flujos_v2.test.cjs` | PASS; 147/147, sin omisiones | 0 |

Cadena completa: **0**, cero errores y cero advertencias. La regresión de flujos usó `TMPDIR` dentro de `cooper/.cache` y `PYTHONDONTWRITEBYTECODE=1`. [Log de la puerta](evidencias/total-m10/puerta.log), [flujos](evidencias/total-m10/flujos.log), [resumen y huellas](evidencias/total-m10/verificacion.json), [regresión roja](evidencias/total-m10/duplicados-rojo.log) y [verde](evidencias/total-m10/duplicados-verde.log). Las copias versionadas normalizan únicamente espacios/retornos de terminal; los originales permanecen en `cooper/.cache/total-m10/` y ambas huellas constan en el resumen.

Capturas revisadas: [Publicados móvil oscuro](evidencias/total-m10/publicados-390-oscuro.png) y [Aprendizaje escritorio claro](evidencias/total-m10/aprendizaje-1440-claro.png). La matriz completa de ocho capturas está en `cooper/.cache/total-m10/`, regenerada por la E2E y fuera de Git; axe sin violaciones detectadas y sin desbordamiento horizontal en las ocho vistas. El log de Sentinel queda en `cooper/.cache/sentinel-marcas/ejecucion.log`. Esta evidencia de laboratorio no certifica accesibilidad universal ni un dispositivo físico.

La regresión nueva cubre dos dueños homónimos, administración, relaciones inconsistentes, publicaciones duplicadas, identificadores ausentes, retención 125 %, campos opcionales del lote Aprendizaje, ausencia frente a cero, corte de fecha Lima, lectura sin red/escrituras y HTTP sin sesión/suplantación. El recorrido Chromium añade filtros, enlaces y recarga, error de actualización, evidencia/aplicaciones, ocho capturas (dos pantallas × dos anchos × dos temas), axe y ausencia de desbordamiento. Datos ficticios en bases aisladas.

Preparación fuera de la puerta: se instalaron los Chromium locales requeridos por Playwright y Sentinel, manteniendo el guardián. El instalador avisó que el sistema utiliza el binario alternativo Ubuntu 24.04; no se silenció ese aviso. Fallos focalizados corregidos: la fixture inicial repetía una cuenta remota globalmente única; los selectores exactos de etiquetas incluían opciones del `select`, y la alerta se confundía con el anunciador de rutas de Next. Se corrigieron los datos de ensayo y los selectores por rol/ámbito; no se omitieron pruebas. La revisión posterior añadió un caso rojo real: dos capturas distintas con el mismo ID perdían una al agruparse. La corrección conserva ambas y selecciona la versión más reciente de las lecciones repetidas; regresión focalizada final: 8/8 PASS. La puerta se repitió después de esa corrección y de conservar el control del frente Aprendizaje.

## Límites reales

- Marcas no persiste una fecha explícita de publicación ni una URL pública en su contrato actual. Se muestra fecha ausente y enlace al origen local; el filtro temporal excluye esas publicaciones hasta quitar el intervalo. No se sustituye por fecha programada/actualizada. Las observaciones usan su fecha de registro o captura, y los estudios su fecha de actualización.
- No hay referencia común verificable entre un ID de solicitud de Marcas y una publicación de video. No se fusionan entre contratos por título, reutilización del video ni cifras parecidas. Tampoco se atribuye una red a un estudio de marca sin esa procedencia.
- La consulta utiliza datos ya recibidos por Cooper; no prueba permisos ni disponibilidad de métricas reales. Actualizar no consulta proveedores. La procedencia simulada se identifica según el contrato de cuenta o modo del adaptador disponible; no se inventa una certificación histórica del proveedor.
- No se hizo aceptación en producción, Firefox/WebKit, dispositivo físico ni ensayo de volumen. La integración concurrente debe repetir la puerta sobre la combinación definitiva y preservar los controles del frente Aprendizaje.
- Se preservan fuera del commit los archivos de encargo sin seguimiento: `faltantes-total.md`, `_comun.md`, `total-m10.md` y el aviso de coordinación en `docs/misiones/` (el primero está en `docs/informes/`).

## Pendientes de Walter

No hay decisión de Walter que bloquee la implementación local de M10. Quedan la aceptación visual/funcional sobre la versión que integre el orquestador y los permisos/activaciones de métricas reales ya pendientes del proyecto. Esta misión no los sustituye ni los declara aceptados.
