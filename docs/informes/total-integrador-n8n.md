# Integración n8n, generador y guía

Fecha: 2026-11-21 (Lima). Subfrente de `total-integrador`, worktree propio `total-integrador-n8n`, base `a69e374`. Implementado y probado localmente; el integrador principal consolida la puerta completa, `docs/ESTADO.md`, la publicación y el despliegue. Este subfrente no accedió por SSH al VPS ni leyó `.env` reales o valores de credenciales. No modificó los worktrees de los frentes, ni D&S Factory, ni efectuó OAuth, pagos o publicaciones externas.

## Integración y decisiones

Se incorporaron los cierres de `total-n8n-auditoria`, `total-n8n-e2e`, `total-n8n-ramas`, `total-render-real` y `total-guia`; posteriormente el cierre de normalización de Radar `44122e9`/`7bb8ee9` y el rechazo de resultados duplicados de Sentinel `5267610`. Los commits de operación/seguridad con patch-id diferente ya tenían contenido equivalente en la base: no se duplicaron. Los cambios vidIQ concurrentes sin cierre no se importaron por inferencia.

- `9d39ad6..5c0c263`: auditoría estructural, fiabilidad y lote con reversa.
- `6f0197d..ff58b8c`: continuidad, observabilidad y ensayo integral.
- `2ae625b..f253ada`: ramas audiovisuales, fallos y recuperación; Google Files se consulta hasta ACTIVE con límite y se rechaza FAILED/URI ajeno.
- `d07bb05..e557f5c`: render local con Piper/FFmpeg.
- `54f9c83..536eabf`: guía y evidencias históricas de su cierre.
- `cc847c6`: reconciliación transversal descrita abajo.
- `799eaba`, `28ce169`: proyección del resultado de subflujo Radar sin metadata interna superior.
- `6ed12b0`: el preparador de auditoría reconoce 33 workflows y permite cantidad explícita.
- `107ae08`: conserva transportes internos firmados también en nodos de reintento y espera registro de webhook en ensayo Radar.
- `ab4bd2f`: rechaza dos respuestas del mismo canal, incluso si una es válida; conserva la regresión de homónimos inaccesibles.
- `a2a2315` (equivalente a `411574c` del subfrente producto): cuota vidIQ ya publicada, conservando toda la fiabilidad integrada.
- `04d746b`: recuperación M01 exige 200 para retorno idéntico y 409 para alterado; conserva comparación exacta del trabajo sin duplicados.
- `fcfd787`: cierre del relay sin EPIPE no manejado, preservando limpieza y evidencia.
- `91c2afd`: arnés adaptado a competencia comprobada y aprendizaje síncrono, con pruebas sobre validadores reales.

La integración conservó el retorno durable M01: `enviado`/`envio_incierto` → `retorno_en_curso` → `listo`/`error`, reserva condicional y recibo de entrega. No se sustituyó por la guarda antigua que solo aceptaba `enviado`. Se mantuvo la URL fija validada de Vigilante, sin mensajes crudos, URLs arbitrarias ni datos privados; los cambios de auditoría solo añaden categorías cerradas e identificadores saneados.

Se conservó el aprendizaje ampliado de la base: evidencia por canal, 30 lecciones verificadas, plan síncrono de la PC y justificación obligatoria de cada lección en el siguiente guion. No se cargó la extensión histórica que lo habría reducido a un callback y arrays de lecciones anteriores. Se reconciliaron el orden por fecha y el descarte de elementos nulos, preservando contexto creativo y validación de origen. Los nueve nodos históricos desconectados del Radar están explícitamente deshabilitados.

Los JSON fueron regenerados desde Python conservando IDs. Se mantuvieron columnas actuales, cobertura de vidIQ, ajustes de privacidad de Sentinel y variantes independientes `total`, `ramas` y `render-local`. Los contenedores, redes y raíces de cada arnés son distintos.

## Evidencia nueva

**Total integrado: 3/3 PASS**, 447 ejecuciones exitosas, 27 pasos funcionales y 111 pasos de motor trazados; cero errores o ejecuciones pendientes y copia histórica intacta. Contenedor final `exited`. [Resumen y hashes](evidencias/total-integrador-n8n/total-resumen.json), [resultado](evidencias/total-integrador-n8n/total-resultado.json.gz) y [traza](evidencias/total-integrador-n8n/total-pasos-motor.json.gz).

**Ramas definitivas con el delta vidIQ: 48/48 PASS** (21 audiovisuales, 3 Marcas y 24 resiliencias; tres rondas por caso). 2988 ejecuciones exitosas y 3 fallos de voz inducidos y esperados; cero errores inesperados o ejecuciones colgadas. 552 pasos de motor, copia histórica intacta y contenedor detenido. Incluye SIGKILL, reanudación del mismo Wait/trabajo, retorno idéntico idempotente y retorno alterado rechazado. [Resumen y hashes](evidencias/total-integrador-n8n/ramas-resumen.json), [registro](evidencias/total-integrador-n8n/ramas.log), [resultado](evidencias/total-integrador-n8n/ramas-resultado.json.gz) y [traza](evidencias/total-integrador-n8n/ramas-pasos-motor.json.gz).

**Compatibilidad integral después del delta vidIQ: 1/1 PASS**, los nueve pasos hasta el siguiente guion, 152 ejecuciones exitosas, copia intacta y contenedor detenido. [Resumen](evidencias/total-integrador-n8n/total-vidiq-resumen.json) y [resultado](evidencias/total-integrador-n8n/total-vidiq-resultado.json.gz).

**Render integrado: PASS**, 104 ejecuciones exitosas, 27 pasos de motor, 12 llamadas al relay y cero errores. Dos MP4 reales de 22,20 s (1080×1920 y 1920×1080), voz Piper y 18 subtítulos; control de calidad sin fallas ni avisos. Queda aprobación final humana pendiente, sin publicaciones. [Resumen y hashes](evidencias/total-integrador-n8n/render-resumen.json), [resultado](evidencias/total-integrador-n8n/render-resultado.json.gz), [traza](evidencias/total-integrador-n8n/render-pasos-motor.json.gz) y [6 focales aprobadas](evidencias/total-integrador-n8n/render-focal.log). Una tentativa anterior sufrió `fetch failed` de causa no atribuida; al cerrar apareció EPIPE en una respuesta tardía del relay. Se corrigió ese cierre y se repitió la ejecución completa con resultado limpio; no se añadieron reintentos ciegos.

- [Focales actuales](evidencias/total-integrador-n8n/focales.log): 237/237 (235 flujos y 2 contratos de transportes integrados), cero fallos. Incluye regeneración idéntica, M01, seguridad de Vigilante, rechazo de Radar duplicado y fixtures que pasan los validadores reales de competencia y aprendizaje.
- [Contratos con motor real](evidencias/total-integrador-n8n/motor-contratos.log): 263/263, ejecución secuencial de flujos, lote, infraestructura, Radar y retorno M01. El conjunto previo contiene 234 pruebas de flujos; la nueva prueba de callbacks firmados elevó esa suite a 235. Incluye retornos simultáneos, reinicio y reversa.
- [Compatibilidad de cuota vidIQ](evidencias/total-integrador-n8n/vidiq-focales.log): 253/253, incluidos 9 contratos vidIQ y 7 YouTube. [Runtime real de vidIQ](evidencias/total-integrador-n8n/vidiq-runtime.log): 6 nodos HTTP y expresiones reales en n8n 2.47.6, una investigación, respuesta SSE y red completamente deshabilitada. La cuota suficiente se prueba con datos ficticios; no se consulta el saldo de ninguna cuenta real.
- [Ensayos Python](evidencias/total-integrador-n8n/python.log): 14/14, advertencias convertidas en error.

Para completar las ramas, la cuota del contenedor ficticio se elevó a 2 CPU dentro de `16-23`; total y render usaron 0,5 CPU. Estos tiempos no representan rendimiento productivo.

Los ejecutores usan n8n 2.47.6 oficial fijado por digest en `deploy/infra-imagenes.json`, una base sintética nueva, puertos loopback y red Podman interna sin salida. Los contratos externos son respuestas ficticias declaradas; no comprueban credenciales ni disponibilidad/calidad de proveedores. La copia ficticia conserva sus ejecuciones para comprobar pedidos y errores, sin cambiar las políticas de privacidad de los JSON productivos. Las URLs de los ajustes ficticios conservan la ruta canónica HTTPS exigida por M01.

El ensayo antiguo rotulaba su imagen como 2.47.4 aunque la infraestructura ya elegía la candidata del manifiesto; ahora registra la referencia efectiva. La importación espera a que Vigilante tenga versión publicada antes de importar dependientes. El ensayo de aprendizaje espera el trabajo síncrono `listo` y verifica la evidencia persistida, sin enviar un callback obsoleto. El siguiente guion debe explicar los IDs de lecciones requeridos.

La puerta web completa y las dos rondas Sentinel corresponden al integrador principal para evitar puertas pesadas concurrentes; estos resultados no las sustituyen.

## Operación y limitaciones reales

La primera tanda amplia terminó 21 variantes audiovisuales, 3 recorridos Marcas y 19 casos de resiliencia antes de encontrar una aserción histórica: esperaba 409 al repetir un callback idéntico, pero M01 devuelve correctamente 200 sin segundo despacho. Se actualizó el arnés al contrato durable, se añadió el caso alterado que debe devolver 409 y se repitió la tanda completa.

El inventario remoto comunicado por el integrador contiene una sola pila n8n oficial y tres relés Node `cooper-chat-*`; los relés no constituyen una segunda instalación n8n y deben conservarse. Este subfrente no detuvo contenedores remotos. Los paquetes históricos de ramas contienen versiones anteriores de contratos y no deben importarse directamente sobre producción.

Para el lote de producción se indicó export nuevo, comparación semántica de tres vías (base `a69e374`, integrado y vivo), preservación opaca de Ajustes, de credenciales y de estados actuales de disparadores, y CAS antes de importar. Una diferencia concurrente del mismo componente debe bloquear el lote. Los nombres/topología del inventario saneado no bastan para comparar el código Code: hacen falta hashes normalizados calculados sobre el export privado, sin imprimir su contenido. El subfrente producto implementa esta protección; la aplicación y su reversa quedan a cargo del integrador.

Referencias oficiales consultadas: [CLI n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md), [Compose ps](https://docs.docker.com/reference/cli/docker/compose/ps/), [Docker inspect](https://docs.docker.com/reference/cli/docker/inspect/) y [servicios Compose](https://docs.docker.com/reference/compose-file/services/). Las operaciones del arnés reutilizan el adaptador y contrato OpenAPI empaquetado con n8n.

## Pendientes de Walter

1. Ninguna decisión nueva imprescindible para esta integración local. Los pendientes de proveedores, OAuth, calidad editorial y autorizaciones de gasto de los frentes originales permanecen vigentes; el ensayo sintético no los da por resueltos.
