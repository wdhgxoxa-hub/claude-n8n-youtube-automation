# Cooper — Marcas y redes

Fecha: 2026-11-21. Rama `cooper-marcas`, worktree `/home/david/Proyectos/cooper-marcas`, desde `version-chatgpt` en `16341ab`. Entrega para revisión e integración por Claude, sin push, merge ni despliegue. No se accedió a credenciales reales ni a D&S Factory; tampoco se hizo OAuth, pagos o publicaciones reales.

## Commits

| Commit | Cambio |
| --- | --- |
| `c4ab060` | Marcas privadas, cuentas, estudio, diseños, especialistas, corpus cotejado, revisiones, aprobaciones web/WhatsApp, publicación y métricas. |
| `afb7d45` | Playwright, matriz accesible, auditoría Lighthouse y adaptador del Sentinel instalado con guardián activo. |
| `c67c589` | Dos flujos n8n inactivos y prueba de firma/interruptor. |
| `da59e46` | Reparto de consultas de métricas, reintentos espaciados y conservación de la última medida. |
| `95cdd6c` | Alcance de Marcas y exclusiones de escritura para el guardián de Sentinel. |
| `9e27756` | Escenario de estabilidad con tres videos activos; el ajuste inicial del hook se revisó después del diagnóstico. |
| `fab1ab8` | Descartar estados SSE idénticos y separar opciones del cliente de los esquemas Zod del servidor; regresión de CSP. |

El código de la puerta final corresponde a `fab1ab8`. El commit posterior de entrega solo añade documentación y enlaces.

## Qué se construyó

- `/marcas`: alta guiada, dueño privado/Walter, guía visual, rubro, versión bíblica, cuentas, calendario, estudio, publicados y aprendizaje. Vista previa de la revisión que Walter aprueba; editar invalida aprobación y medios anteriores.
- Graph oficial para Instagram/Facebook, con usuario de sistema y validación de página/Instagram vinculados. YouTube/TikTok mediante Upload-Post. Solo Walter verifica la asignación. Conexiones simuladas por defecto.
- Estudio de texto, fechas, rendimiento y muestras visuales: frecuencia, pilares y horas de prueba sustentadas cuando hay datos suficientes. Sin inventar métricas ni presentar causalidad o garantía de rendimiento.
- Plantillas propias para domingo, grupos, eventos, colección y composición libre, coloreadas por marca; texto SVG compuesto a JPEG. Reels con fotos/clips, audio de clips y compositor FFmpeg. Adjuntos privados del chat, carga web e ingesta durable del WhatsApp firmado.
- Especialistas reformado y moda; reglas pastorales, versión RVR1960 predeterminada y corpus cotejado por Walter. Verificación de referencia/texto/versión al enviar, aprobar y publicar. Ninguna Biblia completa empaquetada.
- Trabajador HMAC con reservas SQLite, checkpoints y conciliación ante resultados inciertos. Medios derivados con URLs firmadas, caducidad y revisión exacta. Las claves no se exponen al navegador.
- `CooperMarcasPub1` y `CooperMarcasMet1` en el generador y en `workflows/v2/`: despiertan el trabajador para publicación/adjuntos y métricas; inactivos y bloqueados por configuración.

[Guía de uso, capacidades, límites y fuentes oficiales actuales](../cooper-marcas.md). [Estado de la rama](../ESTADO.md).

## Evidencia de la puerta

Puerta final completa: **PASS**, rc 0 en todos los pasos; cero errores, advertencias y pruebas omitidas. Ejecutada sobre `fab1ab8`.

| Comando | Resultado |
| --- | --- |
| `cd cooper && npm ci` | rc 0, 357 paquetes instalados, cero vulnerabilidades |
| `npm run lint` | rc 0, `--max-warnings 0` |
| `npm run typecheck` | rc 0 |
| `npm test` | rc 0, 248/248, 24 archivos |
| `npm run test:e2e` | rc 0, 35/35, incluido Sentinel, 5,2 min |
| `npm run build` | rc 0, compilación y rutas correctas |
| Raíz: `node --test tests/flujos_v2.test.cjs` | rc 0, 131/131 |

Se ejecutó en ese orden la cadena obligatoria de Cooper con `&&` y `pipefail`; las pruebas de flujos se ejecutaron desde la raíz en el mismo código. Los avisos `npm notice` identifican los comandos, no son advertencias.

Logs locales en `cooper/.cache/puerta-marcas.log` y `cooper/.cache/flujos-marcas.log`; `.cache` está excluida de Git. Los casos usan bases y sesiones efímeras, correos ficticios y transportes simulados. El render JPEG/MP4 y el navegador sí se ejecutan realmente.

Evidencia de regresión: `metricas-rojo.log` reproduce una publicación sin medir detrás de diez antiguas (rc 1); `metricas-verde.log` conserva la última medida tras fallos y prioriza las pendientes (21/21, rc 0). Se corrigieron durante el desarrollo el cierre anticipado del panel de cuentas, la expectativa antigua de cinco plantillas WhatsApp y la solicitud del campo IG `account_type`, ausente en la referencia vigente. La primera puerta falló en Sentinel: el recorrido salió a Avatares y su guardián bloqueó POST /api/identidad; el módulo de caos lo calificó como error de consola. Se acotó la navegación al módulo Marcas y se declararon las acciones de escritura (por ejemplo, Desconectar) como exclusiones del contrato oficial de Sentinel. El ensayo de caos es de solo lectura; las mutaciones se cubren con Playwright y pruebas de servicio. No se modificó el evaluador ni se desactivó el guardián. La suite general de Playwright sigue cubriendo el resto de Cooper. Se conservan los informes previos `informe-inicial.json`, `informe-navegacion.json` e `informe-guardia.json` en `cooper/.cache/sentinel-marcas/`. El segundo registra avisos de oyentes durante navegación general. La ejecución completa posterior los reprodujo dentro de Marcas con SSE y videos activos (`informe-oyentes.json`, `oyentes-rojo.csv`): el diagnóstico identificó asignaciones repetidas de `onclick` al renderizar estados SSE idénticos. Se descartaron esos estados sin modificar cambios reales; el ensayo prepara tres videos activos. Se retiró el ajuste inicial de MediaQueryList, que no resolvía la causa. La prueba breve pasó de 405→980 oyentes a 404→427 en diez segundos. La revisión general entre módulos sigue correspondiendo a la misión de pulido. Los ensayos iniciales fallidos no se presentan como evidencia de la puerta final.

Evidencia visual: `cooper/.cache/capturas-marcas/`, doce capturas en 360/390/768/1024/1440/1920 px, temas claro/oscuro, sin desbordamiento horizontal ni infracciones Axe. Inspección visual manual de móvil y escritorio.

Lighthouse (`node scripts/auditoria.mjs --marcas`, rc 0):

| Tema / dispositivo | Rendimiento | Accesibilidad | Buenas prácticas | Advertencias |
| --- | ---: | ---: | ---: | ---: |
| Oscuro / móvil | 95 | 100 | 100 | 0 |
| Oscuro / escritorio | 100 | 100 | 100 | 0 |
| Claro / móvil | 100 | 100 | 100 | 0 |
| Claro / escritorio | 100 | 100 | 100 | 0 |

HTML y resumen en `cooper/.cache/auditoria-marcas/`, log `lighthouse-marcas.log`. La medición inicial encontró una violación de `script-src` por el JIT de Zod: se separaron las opciones usadas por el navegador de los esquemas del servidor, conservando la CSP. La regresión E2E comprueba que DevTools no reciba incidencias. Son mediciones locales de laboratorio, no de campo.

Sentinel (`recorridos`, `caos`, `estabilidad`, guardián activo): rc 0 en la suite completa. En Marcas ejecutó 1.000 acciones de caos, mínimo observado 60 FPS, sin congelación ni caída. En la sesión de estabilidad de 55 s, los oyentes tras calentamiento no superaron 420 y finalizaron en 381. Cero hallazgos de gravedad baja/media/alta; queda una observación **informativa de cobertura**: Aprendizaje cambia la vista sin URL propia y solo lo recorre el módulo de recorridos. No se afirma cobertura de caos de cada pestaña. Informe, series y capturas en `cooper/.cache/sentinel-marcas/`.

## Limitaciones reales

- No hubo ensayo con Meta/Upload-Post ni importación en un n8n vivo. La verificación de scopes, activos, planes y medios remotos queda para una activación autorizada. Los contratos se ensayaron con respuestas ficticias, no con un sandbox oficial de esos servicios.
- Se admiten imagen/carrusel de imágenes/reel/historia de imagen según red. No hay historia de video ni carrusel mixto en esta interfaz. YouTube admite video; TikTok imagen/carrusel/video. Tipografía: familias locales serif/sans. Las plantillas son variantes propias con identidad por marca, no un editor visual general. Los fondos/ilustraciones de IA se aportan como adjuntos; este módulo no añade una llamada a otro generador de imágenes.
- El estudio es descriptivo y acotado a tres páginas por cuenta/seis imágenes Meta. Upload-Post solo aporta el historial que conoce. Facebook no aporta interacciones en este adaptador; sin muestras comparables no se atribuye un mejor horario. Métricas de cada red tienen disponibilidad y demora diferentes.
- El cotejo bíblico compara contra el corpus registrado por Walter; no verifica automáticamente una edición externa ni garantiza corrección doctrinal. La detección de referencias no cubre todas las abreviaturas o alusiones; requiere revisión pastoral humana.
- Avatar: reutiliza la fábrica existente, pero esta base no expone un archivo renderizado en el contrato web. Se adjunta el MP4 final y se comprueba el ID de video y su dueño/estado. Archivos de hasta 5 MB; reels normalizados de hasta 60 s, sin montaje semántico ni música automática.
- SQLite de una instancia; cuatro publicaciones y diez consultas por pasada. Errores inciertos exigen conciliación; no existe un botón de reenvío ciego. Ingestas interrumpidas y adjuntos huérfanos requieren revisión/retención operativa.
- Publicados/Aprendizaje están dentro de Marcas. La agregación con las pantallas globales de `cooper-pulido` corresponde a la integración.

## Pendientes de Walter

1. Definir marcas, dueños, guías/logos, horarios reales y formulación pastoral; cotejar el corpus y la edición bíblica autorizada.
2. Asignar páginas e Instagram a la app **Cooper** del portafolio **Cooper Estudio** y a su usuario de sistema; verificar permisos/revisión de app/PPA. Confirmar condición Business para historias y perfiles YouTube/TikTok existentes en Upload-Post.
3. Aprobar la nueva plantilla `cooper_aprobacion_marca`, activar su preferencia y mantener número verificado y consentimiento de Walter.
4. En la integración autorizada: configurar variables mediante el mecanismo seguro existente, HTTPS para medios y FFmpeg/FFprobe; elegir una cuenta y pieza para el primer ensayo real revisado.
5. Establecer conservación de medios y procedimiento de conciliación de publicaciones/ingestas inciertas.

## Lote para Claude

Revisar esta rama y conciliar `0008_marcas`, diario de migraciones, esquema, navegación, WhatsApp y scripts compartidos con las misiones paralelas. `docs/ESTADO.md` es un estado de esta rama y debe incorporarse al estado general sin reemplazar novedades ajenas. La rama no integra commits de otras misiones. No se fusionó: hay trabajo paralelo y no se presume que la cola de integración esté libre. Desplegar/activar los dos flujos y ensayar cuentas reales corresponde a un lote posterior autorizado.

SHA-256 de evidencia local `puerta-marcas.log`: `f65dc40b460cc26e692dc7d6eba6f8e7450c978a688a83f841369ec8b8023e56`.

SHA-256 de evidencia local `flujos-marcas.log`: `1115c4660d456a7408041fe38344fe8690db12b021355299a742a85e155e0f52`.
