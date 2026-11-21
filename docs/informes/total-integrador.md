# Total integrador — integración y publicación

**En curso.** Inicio: 21-11-2026, Lima. Rama/worktree `total-integrador`, base `a69e374` de `cooper-total`. Autorizados push fast-forward a `mio/version-chatgpt` y `mio/main`, despliegue Cooper y lotes n8n con respaldo y reversa. No se modifica el worktree del orquestador ni los frentes activos.

## Integración

Se compara ascendencia, `git cherry` y contenido. La historia de Sentinel fue saneada antes de esta misión; sus falsos positivos no se reaplican y sus fuentes permanecen privadas. Tres revisores trabajan en worktrees propios: web/UI y Sentinel; chat/memoria y producto; n8n/generador y guía.

- Margen Real: `818f3e5` → `6e1277c`, `390d551` → `9654aa0`. Conflicto de ESTADO resuelto preservando todos los pendientes actuales y sumando la estrategia sin activar el piloto. `5dde572` adapta el fixture editorial a los nodos de aprendizaje/competencia integrados; 6/6 pruebas pasan.
- Base/seguridad, operación/chat/memoria, aprendizaje/competencia/Radar/Margen, M01–M12, Marcas, n8n, guía, accesibilidad, Sentinel, render real y rendimiento conciliados. La [matriz de ramas](evidencias/total-integrador-web/ramas.json) conserva el corte histórico, las equivalencias semánticas y sus seguimientos; no se mezclaron las historias originales que contenían fuentes privadas de Sentinel.
- Rendimiento cerró durante la aceptación. Se incorporaron sus ocho cambios funcionales y dos ajustes de compatibilidad (`e27a9f1`…`e32665d`); las aceptaciones anteriores se descartaron como aceptación final. El primer intento sobre `e1244bd` encontró cuatro fallos: tres selectores/acciones de prueba y un defecto real de identificadores ARIA en Biblia. Corregidos en `bb74925`, `f1df4f7` y `a987b2f`; la nueva imagen y aceptación parten de `e942dc9eab05242f7967d1c7c8631a3e3171d6da`.
- [Commits de la misión](evidencias/total-integrador/commits.json): 87 cambios atómicos hasta ese corte, además del trabajo heredado de `a69e374`. El cierre actualizará este índice con los últimos cambios operativos y documentales.

## Conflictos y decisiones

1. Se preservaron los pendientes ajenos de ESTADO y se añadieron hechos de cada frente. No se convirtió ninguna idea en autorización.
2. La comparación por ascendencia y patch-id se complementó con revisión semántica: el saneamiento histórico cambiaba hashes de commits válidos. Se recuperó el guardián de duplicados de Radar que faltaba, con regresiones propias.
3. Chat conserva la política breve de dieciocho palabras, aislamiento por dueño, memoria y confirmación real; se incorporaron las ampliaciones de herramientas sin sustituir los controles existentes.
4. Rendimiento conserva períodos de Lima y excluye datos futuros, mantiene foco/metadata/accesibilidad y añade `0018_rendimiento` después de las trece migraciones existentes, verificadas byte a byte. Los mocks de Operación se adaptaron a la carga inicial desde servidor y a la actualización explícita.
5. Dos pruebas confundían varios elementos `status` después de la integración; se acotaron al contenido principal. WebKit confundía el compositor visible con el textarea SSR oculto; se exige un único textbox accesible y visible. Se mantienen las comprobaciones de teclado y aprobación.
6. El arnés de caída M01 exigía 409 para un callback idéntico que debe ser idempotente. Ahora exige 200 sin duplicados y mantiene 409 para contenido alterado. El ensayo completo de reinicios pasó posteriormente.
7. El VPS tenía cambios recientes de vidIQ: se conservaron cuota renovable, tiempos de espera, tratamiento de errores y guardias, incorporando únicamente el batching compatible de seis nodos HTTP. La conciliación n8n usa tres vías, resoluciones con tres hashes y CAS antes y después de detener escritores.
8. Cuatro rutas sin credenciales mantienen sus bloqueos explícitos: Crear/Consultar avatar y voces HeyGen/ElevenLabs. No se fabrican credenciales ni se habilitan proveedores.

## Verificación y despliegue

En ejecución: puerta completa y dos rondas limpias Sentinel + Playwright con videos sobre el corte `e942dc9`. Pendientes de sus resultados: revisión visual, publicación fast-forward y activación de la imagen, infraestructura y lote. Ninguna evidencia histórica se presenta como prueba nueva de esta combinación.

Aceptaciones independientes ya terminadas:

- n8n ramas: 48/48 casos (21 audiovisuales, 3 Marcas, 24 resiliencias), 2.988 ejecuciones exitosas y tres fallos de voz deliberados/esperados; cero errores inesperados ni ejecuciones al vuelo. Total: tres rondas limpias y otra después de integrar vidIQ. [Informe y recibos](total-integrador-n8n.md).
- Render real: 104 ejecuciones exitosas, MP4 vertical y horizontal, subtítulos y control de calidad sin fallos ni avisos. Proveedores simulados, 0 USD y ninguna publicación.
- [Lote n8n](evidencias/total-integrador/lote-ensayo.json): importación de 33 workflows, publicación ordenada de 28, dos columnas aditivas, nueve tablas de negocio preservadas y reversa byte a byte; red deshabilitada. Los once disparadores existentes se conservan; no se abren nuevas entradas externas.
- [Export previo](evidencias/total-integrador/export-cli.json): CLI oficial sobre copia SQLite consistente, 45 borradores y 29 versiones publicadas; ninguna divergencia de nodos/conexiones/settings entre borrador y publicación. Exportaciones privadas fuera de Git; solo hashes y recuentos en la evidencia.
- Imagen previa, sustituida tras corregir Biblia, `localhost/cooper:e1244bd376f8546d3b439e32b77e8a187a062d3e`: construcción sin avisos; migración 11→14 y arranque de la versión anterior restaurada satisfactorios, conservando las 27 tablas previas. Compose 8/8 y fallo inyectado/reversa/actualización de infraestructura pasaron. La revisión posterior amplía el ensayo a las imágenes mixtas de los relés que deja una actualización solo de Cooper; ese caso aún está en curso.

Intentos descartados, conservados para auditoría: archivo inicial con directorio incorrecto; preparación de navegador con symlinks incorrectos; puerta anterior con 99/102 E2E aprobadas y tres fallos de selección corregidos; aceptación interrumpida al cerrar Rendimiento. La ronda propia de rendimiento se detuvo con 31/123 aprobadas: el caos pulsó el control mutante «Actualizar montajes desde fábrica», no excluido del contrato de solo lectura; el guardián bloqueó el POST y el navegador emitió ERR_BLOCKED_BY_CLIENT. Se conserva [el recibo](evidencias/total-integrador/sentinel-marcas-diagnostico.json); `e942dc9` corrige la exclusión específica de controles mutantes y añade observación saneada de red sin filtrar resultados ni debilitar el guardián. El antes/después reprodujo un intento bloqueado/ninguna escritura y después ningún intento; las dos pruebas focales reales de Marcas pasaron. Las rondas completas nuevas siguen en curso. La puerta paralela detectó además un selector CSS que coincidía con una etapa SSR oculta en Firefox; `bb74925` exige la etapa accesible visible y única. El fallo de Sentinel del orquestador (`06705b0`, Publicados/ERR_BLOCKED_BY_CLIENT) pertenece a otro corte y tampoco cuenta como ronda limpia propia.

Inspección VPS de solo lectura (21-11-2026 14:21 Lima): siete servicios sanos; Cooper `cbf2068`, n8n/runner 2.47.4, Caddy 2.11.2. Hay **una sola instancia n8n**: `cooper-n8n-1`. Los tres servicios `cooper-chat-*` son relés Node con entrypoint `/rele/tunel.mjs` y comparten el namespace de red del servicio correspondiente; no son otra pila ni contienen workflows/cron independientes. No se apagan: son dependencias del chat autorizado. La copia posterior de las 14:51 Lima tiene 45 workflows, 29 activos; el orquestador había retirado tres sondas. El lote preserva esa retirada y el workflow activo ajeno al lote.

Validación focal nueva: 16/16 casos aprobados, incluidos Marcas/Sentinel en 1440 y 390 px, reproducción MP4 iniciada con teclado, cuatro auditorías axe de todas las rutas y ocho entradas Firefox/WebKit. En raíz, las 185 pruebas operativas pasaron con advertencias convertidas en errores. El [preflight n8n](evidencias/total-integrador/preflight-n8n.json) valida 25 archivos certificados y el lote ensayado sin consumir el entorno ni mutar el VPS; el CAS vivo previo pasó y se repetirá bajo bloqueo. Los archivos públicos del relé coinciden por SHA-256 con el checkout integrado.

Aceptación operativa final sobre la imagen `e942dc9`: migración 11→14, ocho bloques Compose, avería inyectada con relés mixtos, reversa exacta de siete IDs/datos/configuración y segunda actualización saludable. [Recibos](total-integrador-operacion-final.md). El arnés local adapta únicamente las dependencias de namespace de Podman; los helpers certificados de producción no cambian. La imagen precargada en Docker corresponde al mismo archivo gzip por SHA-256; aún no activada.

Últimos cierres integrados: helper WAL de Radar (`54b9ac7`) y cierres/documentación `d33b60c`, `2be2dc5`, `abb94c1`; las 189 pruebas operativas pasan. Los recibos históricos de esos cierres no sustituyen las aceptaciones nuevas de esta misión.

## Limitaciones reales

No se inicia OAuth ni se fabrica una sesión de producción. La aceptación pública y el control de acceso sin sesión son distintos del recorrido privado autenticado. Los proveedores pagos y la publicación permanecen fuera del alcance autorizado.

## Pendientes de Walter

1. Aceptación privada mediante sesión Google legítima y dispositivos reales; se conservarán los pendientes previos de ESTADO.

## Fuentes oficiales consultadas

- [n8n CLI](https://docs.n8n.io/hosting/cli-commands/) y [API](https://docs.n8n.io/api/).
- [Docker Compose up](https://docs.docker.com/reference/cli/docker/compose/up/).
- [Videos de Playwright](https://playwright.dev/docs/videos).
