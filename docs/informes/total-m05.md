# M05 — montajes de fábrica en Marcas

21-11-2026, Lima. Rama y worktree exclusivos `total-m05`, base `de397f3195856c10b6a9959171ff42da4328d9ec` de `version-chatgpt`. Alcance M05/H12 de `faltantes-total.md`.

**Implementado:** selección web de un montaje propio aprobado, reutilización exacta sin adjuntarlo otra vez y recuperación desde el estado de fábrica. **Probado:** puerta completa con 306 unitarias, 44 E2E y 147 pruebas de flujos; siete códigos 0 y cero errores/advertencias. **Integrado/desplegado:** no desde esta misión.

## Commits y coordinación

| Commit | Cambio |
| --- | --- |
| `dea270c` | Referencia por revisión, copia privada, controles, migración y 22 pruebas de backend. |
| `c6cd1dd` | Selector web, recuperación, prueba E2E con MP4 sintético y guía de uso. |

Se revisaron `git branch --list 'total-*'`, el historial de Marcas de esas ramas y los cambios de `total-marcas-runtime`/`total-seguridad`. No había importador que cubriera M05. Se leyó también `docs/misiones/AVISO-cooper-total.md`. No se recreó el runtime ni se modificaron sus adaptadores de publicación. El lector de medios conserva las comprobaciones de dueño de marca/adjunto, cuenta y vencimiento entero de `fd73395`; el integrador debe conservar además el limitador público de ese commit y la protección de origen/JSON de `0231337`, que están fuera de la base de esta rama. No se tocó `http.ts` ni se relajó una guardia.

## Qué queda cerrado

- **Flujo web:** Marcas → crear pieza → Montaje aprobado de fábrica. La lista usa ID y huella, filtrada por dueño de marca. Solo videos en Programado/Publicado, activos y con presentadores disponibles; la etapa Aprobación final todavía no sirve. La pieza es un reel sin mezclar adjuntos; el texto acompaña la publicación y no se superpone al video. Walter conserva su aprobación independiente de la revisión de Marcas.
- **Recurso/revisión:** huella SHA-256 sobre video/dueño, guion, selección/presencia, URL y escenas. Métricas y pulsos SSE no cambian esta revisión. Otra URL o contenido exige seleccionar de nuevo y aprobar otra revisión. La copia guarda además SHA-256 de los bytes, tamaño y fecha; no usa la huella como sustituto de autenticación.
- **Descarga:** reutiliza el transporte de medios con timeout 30 s, sin redirecciones ni credenciales externas nuevas. Solo HTTPS de `cdn.creatomate.com/renders/*.mp4`; MIME y firma MP4, HTTP 200 completo y máximo **50 MiB** por cabecera y lectura acumulada. No normaliza, recorta ni regenera. El ensayo verifica bytes exactos, incluido MP4 mayor de 5 MiB.
- **Acceso y concurrencia:** revalida dueño, cuenta, aprobación de origen, revisión y consentimiento antes/después de descargar, al leer, al aprobar y antes de publicar. Editar la pieza durante la descarga revierte copia y transición en la misma transacción. Los medios se entregan por la ruta privada/firmada existente, con `no-store`, y no aparecen como adjuntos reutilizables ni se pueden descargar por `/api/archivos`.
- **Persistencia:** migración aditiva `0011_montajes_fabrica`; SQLite y una copia por dueño/video/revisión. La copia se puede reutilizar entre piezas del mismo dueño cuando el CDN haya caducado, conservando las validaciones. No se duplican medios en `attachments` ni se añaden URLs/bytes al contexto del especialista.
- **Recuperación:** HTTP 401/403/404/410 conserva borrador sin copia parcial. «Actualizar montajes desde fábrica» usa `Fabrica.sincronizar`, no una orden de producción. Una URL renovada exige una revisión nueva. Un archivo eliminado del proveedor y sin copia local requiere recuperar un original autorizado; no se promete renovarlo automáticamente.

## Pruebas y puerta

Ensayos específicos: `npm test -- tests/montajes-fabrica.test.ts`, **22/22**, rc 0; `npm run test:e2e -- montajes.spec.ts`, **1/1**, rc 0. MP4 generado con FFmpeg, tono sintético y color plano; transporte falso sin proveedores externos. El navegador reproduce el MP4 local con pista sintética, silenciado durante el ensayo y comprueba nueva revisión tras cambiar el origen. Axe y desbordamiento: 390/1440 px × claro/oscuro, limpios; capturas en `cooper/.cache/total-m05/`. Inspección visual móvil y escritorio realizada: [390 oscuro](../../cooper/.cache/total-m05/montaje-390-oscuro.png), [1440 claro](../../cooper/.cache/total-m05/montaje-1440-claro.png).

Casos: dueño ajeno incluso administrando otra marca, falta de aprobación final, consentimiento revocado después de Publicado, cambio de guion/enlace, edición concurrente, URL caducada y recuperación, reutilización de copia, firmas y caducidad, acceso genérico bloqueado, contexto del especialista sin URLs, rechazo de hosts/puertos/rutas, MIME/firma inválidos, respuesta parcial/redirección y exceso de tamaño con/sin Content-Length. La revocación impide llamar al publicador falso de esa pieza. Las pruebas generales verifican además las migraciones sobre bases previas.

Desarrollo rojo → verde: el primer contrato falló por ausencia del servicio de montajes; después pasó la reutilización exacta. Se corrigieron un tipo inferido de UUID y dos fixtures incompletos. El primer E2E falló por usar `getByLabel` exacto sobre un select; el selector por rol/nombre accesible pasa. La comparación profunda de un Buffer >5 MiB excedió el timeout de Vitest; se sustituyó por `Buffer.equals`, que comprueba todos los bytes sin relajar el timeout. Ningún test se omitió ni se redujo un umbral.

**Puerta final: PASS**, ejecutada del **21-11-2026 11:52:30 al 12:00:02 Lima** sobre `c6cd1ddb592080dd4d972d64220a7cbdee13899c`. Los cambios posteriores solo añaden este cierre documental. Todos los comandos terminaron con rc 0, sin errores ni advertencias.

| Paso | Resultado | Segundos | Evidencia |
| --- | --- | ---: | --- |
| `npm ci` | 0 vulnerabilidades | 6.75 | [ci.log.gz](evidencias/total-m05/ci.log.gz) |
| `npm run lint` | 0 errores / 0 advertencias | 3.7 | [lint.log.gz](evidencias/total-m05/lint.log.gz) |
| `npm run typecheck` | PASS | 1.18 | [tipos.log.gz](evidencias/total-m05/tipos.log.gz) |
| `npm test` | 306/306 · 31 archivos | 18.27 | [unitarias.log.gz](evidencias/total-m05/unitarias.log.gz) |
| `npm run test:e2e` | 44/44 · sin reintentos ni omisiones | 418.35 | [e2e.log.gz](evidencias/total-m05/e2e.log.gz) |
| `npm run build` | PASS · Next.js 16.4.6 | 3.56 | [build.log.gz](evidencias/total-m05/build.log.gz) |
| `node --test tests/flujos_v2.test.cjs` | 147/147 · sin omisiones | 1.07 | [flujos.log.gz](evidencias/total-m05/flujos.log.gz) |

[Resumen con SHA, fechas, códigos y huellas](evidencias/total-m05/resultado.json) · [SHA256SUMS](evidencias/total-m05/SHA256SUMS). Los siete logs se conservan íntegros en gzip (sin cambiar su contenido ni los retornos de terminal); se verificaron las huellas originales tras descomprimir y las de los archivos entregados. `git diff --check` y `git diff --cached --check`: PASS. Los logs se comprimen para conservar sus espacios/retornos originales sin convertirlos en advertencias de whitespace del diff. La mención `--max-warnings 0` es el argumento del comando de lint; no hubo diagnósticos de advertencia.


```bash
cd cooper && npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
# Desde la raíz
node --test tests/flujos_v2.test.cjs
```

## Limitaciones e integración

No se contactaron n8n vivo, Cooper del VPS, D&S Factory ni APIs de producción de proveedores; sin OAuth, pagos, publicaciones, push ni merges. No hay lote n8n que instalar para M05. Las llamadas de publicación son simuladas; no acreditan compatibilidad editorial/técnica de cada montaje real con cada red.

La copia retiene duración, audio y proporción del original: no adapta un video largo al formato de una red. El control de firma de contenedor no equivale a antivirus ni a una decodificación exhaustiva. Los enlaces firmados usan el contrato existente de hasta 24 h. No se pueden retirar bytes ya descargados o publicaciones externas.

Se aplica la conservación actual de medios en SQLite, sin purga, borrado remoto ni ampliación de infraestructura. Las copias históricas se conservan aunque se edite o elimine el origen; la lectura requiere referencia vigente. La revocación no borra evidencia. M06/B08 debe incluir `montajes_fabrica` al fijar la política; base64 añade espacio respecto al tamaño binario. El límite 50 MiB coincide con el techo existente de composición, no amplía los 5 MiB de subida manual.

El origen habilitado es el CDN de montaje actual. Otros proveedores o almacenamiento propio requieren revisión de origen. Los borradores históricos `videoId` + adjunto manual deben seleccionar una referencia aprobada y obtener otra revisión; no se conserva automáticamente una autorización antigua sin revisión vinculada. Al integrar, conciliar `0011_montajes_fabrica` con migraciones concurrentes, sin cambiar entradas ya aplicadas; resolver solapamientos de `servicio.ts` conservando M03 y seguridad y repetir la puerta integrada.

Herramientas y entorno: Node 24.22.3, npm 12.2.2, FFmpeg local; E2E y Sentinel usan bases/puertos efímeros y secretos ficticios. Se reutilizaron en solo lectura las cachés de navegadores de `cooper-integracion3` mediante enlaces locales en `.cache/`, sin instalar nada global ni cambiar Sentinel. La reproducibilidad autónoma de ese entorno corresponde a M08; no se oculta esta dependencia.

Fuentes oficiales consultadas antes de implementar: [respuesta de render y CDN Creatomate](https://creatomate.com/docs/api/reference/get-the-status-of-a-render), [retención Creatomate](https://creatomate.com/docs/api/reference/file-retention), [Route Handlers de Next](https://nextjs.org/docs/app/api-reference/file-conventions/route) y guías instaladas `node_modules/next/dist/docs/01-app/01-getting-started/{15-route-handlers,05-server-and-client-components}.md`. No se añadió un endpoint de API de proveedor ni se usa el endpoint de estado Creatomate desde esta implementación.

## Pendientes de Walter

1. Fijar conservación de montajes originales/copias, excepciones de consentimiento, cuota de almacenamiento y copias de seguridad junto con B08/M06. No se borró ningún dato.
2. Recuperar un original autorizado si venció el CDN antes de conservar una copia, o decidir almacenamiento alternativo/origen habilitado cuando el MP4 exceda 50 MiB. No se contrataron servicios ni se regeneraron videos.
3. Aceptar un montaje real y su adecuación a cada red, con cuentas/permisos ya autorizados; decidir por separado su publicación. La prueba sintética y Chromium no sustituyen aceptación física/editorial.

Integración y despliegue quedan a cargo de `cooper-total`. Se preservaron sin seguimiento `faltantes-total.md` y los archivos de misión/aviso preexistentes.
