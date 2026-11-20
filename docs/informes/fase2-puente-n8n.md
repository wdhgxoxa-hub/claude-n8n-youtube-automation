# Informe · fase 2, puente Cooper ↔ n8n

20-11-2026. Rama y worktree exclusivos: `cooper-fase2`, `/home/david/Proyectos/cooper-wt/cooper-fase2`. Base `e60ebf2`. Código verificado: **`b406688`**. El commit de este informe solo añade documentación. No hubo push, merge, despliegue, OAuth ni pagos; no se accedió a D&S Factory ni se leyeron valores de secretos o archivos `.env` reales. Los directorios preexistentes `docs/diseno/` y `docs/misiones/` se conservaron sin incorporar al commit.

## Commits

| Commit | Cambio |
| --- | --- |
| `8ebab14` | Contrato compartido, adaptador, receptor HMAC, aislamiento, gastos administrativos, migraciones, workflows y pruebas. |
| `b406688` | Atribución de duración por clip, ID estable por paso y puerto libre para E2E en worktrees concurrentes. |
| `HEAD` de esta entrega | Contrato, despliegue/migración manual, README e informe de evidencia. |

## Trabajo realizado

- FX autenticado por token de entorno para los doce eventos y cinco consultas; autorización por dueño, excepción administrativa contrastada por correo y respuestas con campos explícitos. JSON regenerados sin modificar ajustes de gasto; generación reproducible de 26 workflows.
- Conservación de IDs de canales/videos al cruzar el Orquestador y trabajos asíncronos. Guion/final usan las decisiones persistidas, sin formulario paralelo. Eliminación lógica de recursos en reposo y propagación desde Cooper.
- Atribución de costos por paso al dueño de las tablas, upsert por ID de paso, agregación UTC día/semana/mes y panel administrativo conectado a n8n. El panel distingue gastos registrados estimados de importes simulados.
- Callbacks HMAC sobre bytes exactos con ventana temporal, límite de tamaño, Zod, transacción, recibos durables, rechazo de contenido diferente bajo el mismo ID y protección contra eventos atrasados. SSE reemite progreso del dueño, conserva estado y concilia cada minuto.
- Registro durable de órdenes con reserva por ejecución/confirmación; tres intentos con backoff, timeout y errores públicos genéricos. Aprobaciones con ID determinista por revisión. Pruebas de firmas producidas por el JSON generado, timeout HTTP real local, concurrencia de reservas, privacidad, gastos, eliminación e idempotencia.

Contrato y procedimiento de migración/despliegue: [cooper-puente-n8n.md](../cooper-puente-n8n.md). Columnas y tipos: [cooper-migracion-tablas.json](../../contratos/cooper-migracion-tablas.json). Fuentes oficiales consultadas enlazadas en la guía.

## Puerta obligatoria

Sobre `b406688`, con `pipefail`, se ejecutó íntegramente:

```bash
cd cooper
npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz:
node --test tests/flujos_v2.test.cjs
```

| Comando | Estado / evidencia | RC |
| --- | --- | --- |
| `npm ci` | PASS: 357 paquetes instalados, 364 auditados, 0 vulnerabilidades. | 0 |
| `npm run lint` | PASS: 0 errores y 0 advertencias. | 0 |
| `npm run typecheck` | PASS: TypeScript estricto. | 0 |
| `npm test` | PASS: **54/54**, 37 originales y 17 del puente, sin omisiones. | 0 |
| `npm run test:e2e` | PASS: **9/9**, producción local, Chromium, axe, seis anchuras y ambos temas. | 0 |
| `npm run build` | PASS: incluye `/api/n8n/webhook`; sin advertencias. | 0 |
| `node --test tests/flujos_v2.test.cjs` | PASS: **105/105**, 90 originales y 15 nuevas, sin omisiones. | 0 |

Cadena completa de Cooper: **RC 0**, sin errores ni advertencias. Node `24.22.3`, npm `12.2.2`, Next `16.4.6`, Playwright `1.65.1`, Chromium `159.0.8154.6`. Bases, identidades y secretos de prueba aislados. La regresión de raíz usó `TMPDIR=cooper/.cache` y `PYTHONDONTWRITEBYTECODE=1`.

Evidencia local excluida de Git:

- [Puerta completa](../../cooper/.cache/puerta-fase2-final.log), SHA-256 `8b258e436cb48f129b708e26f1d707930d65cb8eda943f08e17d2c2b49df3302`.
- [Regresión de workflows](../../cooper/.cache/flujos-fase2-final.log), SHA-256 `6db8c944ba36f502385112c60a2ec5f389640b3985b8c5c77044431f3de12f8d`.
- [Informe Playwright](../../cooper/playwright-report/index.html) y [captura administrativa revisada](../../cooper/test-results/visual/_admin-oscuro.png). No se observaron recortes o desbordamientos en esa captura; axe/anchuras están cubiertos por E2E, no equivalen a certificación universal de accesibilidad.
- `git diff --check`: PASS. Regenerar los 26 workflows dos veces conserva sus hashes.

La primera puerta no se consideró aprobada: el instalador descargó Chromium con aviso de plataforma y Playwright encontró `3107` ocupado. No se detuvo ni reutilizó ese servidor. Se corrigió la selección de puerto, se conservaron las comprobaciones y se repitió **toda** la puerta, con resultado limpio. También se corrigieron durante el desarrollo una sintaxis de serialización y la atribución del clip de un lote; los registros finales corresponden al código corregido.

## Limitaciones reales

1. No se ejecutó el grafo dentro de un n8n real. Se probaron sus nodos exportados, contrato, topología, firma interoperable y Cooper; falta importación/ejecución en copia de ensayo antes de habilitar el puente vivo.
2. Los importes son registros de uso calculados con tarifas configuradas; no son facturas conciliadas. Planes/suscripciones registran 0 incremental. Cobros de peticiones fallidas o reintentos internos sin confirmación requieren conciliación externa. No se inventaron esos cargos.
3. Una aceptación confirma despacho, no éxito final. Una reserva sin confirmación después de una caída exige revisar la ejecución; no se libera para duplicar trabajo. El callback tiene reintentos acotados, y la conciliación recupera el estado más reciente; no es una cola infinita de todas las transiciones perdidas.
4. Canal, storyboard y permisos de gasto siguen en el circuito del operador. Las órdenes que requieren perfil/redes usan parámetros estructurados. La eliminación es lógica y exige videos en reposo; no cancela llamadas ya realizadas ni borra publicaciones externas.
5. SQLite requiere almacenamiento compartido por los procesos de la instancia. No se implementó despliegue distribuido, TLS/proxy, facturación de proveedores, ni cambios de las fases 3–6. El chat/transcripción/avatares conservan sus simuladores de fase 1.

## Pendientes de Walter

- Confirmar el mapa histórico `canal_id → dueno_email`, incluidas investigaciones/costos sin canal, y el correo único de administración.
- Aplicar con Claude las columnas y backfill documentados, revisar las ejecuciones/formularios antiguos y probar el lote en una copia de n8n con gasto apagado.
- Configurar URL privada, callback, secretos distintos, acceso de runner a las variables y relojes sincronizados; verificar aislamiento con dos cuentas antes de activar en vivo.
- Confirmar tarifas/conciliación de facturas y el tratamiento contable de suscripciones; decidir cuándo habilitar cada proveedor. Se conservan las aprobaciones del operador para canal/storyboard/gasto.

Propuesta de revisión para Claude: autorización de FX, transición de aprobaciones antiguas, asociación de dueños y costos, y recuperación de órdenes con despacho incierto. No se declara integrado ni verificado en vivo.
