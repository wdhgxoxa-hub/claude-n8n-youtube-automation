# diseno-conexion — conexión silenciosa y SSE independiente

21-11-2026, Lima. Rama/worktree `diseno-conexion`, base `53e001f`.
**Implementado y probado localmente; sin integración, push, despliegue ni cambios en el VPS.** La desaparición del incidente dentro de la sesión productiva de Walter requiere verificación posterior por Claude. No se inició OAuth, no se leyeron secretos ni `.env` reales, no se contactaron proveedores de pago ni se tocó D&S Factory.

## Diagnóstico y reproducción

El SSE anterior no emitía su primer byte hasta terminar `fabrica().sincronizar()`. Next vacía sus cabeceras al escribir ese primer chunk; Caddy espera 35 segundos por ellas. El adaptador n8n puede acumular tres intentos de diez segundos, backoff y cola por dueño. El cliente, además, declaraba desconexión al recibir `fallo` de conciliación aunque el canal HTTP siguiera abierto y solo declaraba conexión al recibir `estado`.

La reproducción local combina **Caddy 2.11.8 real, su configuración versionada y el transporte/compresión real de Next 16.4.6**, con origen sintético y sin fábrica productiva: demora inicial de 37 segundos → **504 en 35.032 ms**; latido inmediato → **200, primer evento en 5 ms y estado en 37.012 ms**. Gzip original entregó el latido en 6 ms y seis cierres/reconexiones liberaron todos los cupos; no se atribuye el fallo a buffering ni a fugas de Caddy sin evidencia. [Recibo](evidencias/diseno-conexion/infraestructura/ensayo-proxy.json).

La sonda pública solo leyó salud, entrada, raíz y dos API sin sesión: 200/307/401 según el recurso. El navegador conectado no estaba disponible; no se pudo reproducir desde una sesión privada existente. Esto limita la atribución productiva: la causa anterior está demostrada en código/laboratorio, no se presenta como observación de la cuenta de Walter. [Sonda](evidencias/diseno-conexion/infraestructura/publico.json).

La lectura posterior del VPS mediante el acceso documentado confirmó **la imagen/digest de Caddy, el archivo montado y su SHA-256 exactos** respecto del ensayo. Se consultaron solo valores escalares de la ruta activa de Cooper: `flush_interval -1`, espera de cabeceras 35 s, conexión 5 s, demora de cierre 300 s y destino `cooper:3000`, todos coincidentes. Caddy estaba saludable. No hubo lectura de variables de entorno reales, logs crudos, configuración privada ni sesiones, y no se mutó ningún servicio. [Recibo de lectura](evidencias/diseno-conexion/infraestructura/vps-lectura.json).

Los relés del plan transportan chat/texto, no `/api/eventos`: Caddy sirve el SSE directamente desde Cooper y la conciliación consulta n8n por red interna. Los plazos del proxy y `flush_interval -1` permanecen iguales. Diagnóstico de sesión, relés, cabeceras, compresión y reversa en la [entrega de infraestructura](evidencias/diseno-conexion/infraestructura/README.md).

## Cambios

- Servidor: latido inmediato y cada 15 segundos, proyección local/progreso cada dos segundos y conciliación remota independiente. Revalida sesión durante la espera; `sesion-finalizada` cierra el canal. Un 401 del puente no se confunde con la sesión del navegador. Cola acotada, liberación al cancelar y cabeceras privadas `no-store, no-transform`.
- Cliente: sano/arranque normal sin indicador; píldora exacta **«Sin conexión, reintentando»** a partir de 5.001 ms de corte detectado. Backoff 1/2/4/8/16/30 segundos, reiniciado tras 15 segundos estables; una sola conexión, recuperación al volver la red, timeout de apertura de 15 segundos y watchdog de silencio de 45 segundos. Un corte silencioso se detecta por ese watchdog; el umbral de cinco segundos empieza entonces, no retroactivamente.
- Sesión: `HEAD /api/eventos` revalida permisos sin reservar cupo ni consultar fábrica; sonda abortable a los cinco segundos. Se conservan controles de acceso y aislamiento.
- Reanudación: guarda el último ID de progreso y lo transmite al recrear EventSource. El servidor valida UUID/longitud y alcance por dueño o administrador; mantiene precedencia del `Last-Event-ID` nativo. Nunca usa un cursor ajeno para ampliar acceso.
- Interfaz: retira «En vivo», «Conectando» y «Reconectando» permanentes y el rótulo incondicional «Modo de prueba». La demostración explícita sigue identificada. Píldora de vidrio, 13 px, radio 999, color de aviso de DIRECCION, región accesible persistente y fundido 240/120 ms con movimiento reducido; posición fija sin mover contenido.
- Infraestructura: parche/reversa de Caddy para `Accept-Encoding: identity` solo en `/api/eventos` y `/api/chat`, como defensa complementaria. Overlay Compose cambia únicamente el montaje del Caddyfile candidato; reversa exacta. Los archivos desplegables originales no se modificaron. **Estos archivos son una propuesta para Claude, no una aplicación ejecutada.**

La revisión final detectó y corrigió una regresión de la primera propuesta: el límite de cola de un chunk, combinado con un enqueue por progreso, postergaba `estado` hasta vaciar el historial. Un ensayo local de 1.000 eventos entregaba solo 10 progresos y cero estados en cinco ciclos. Ahora cada ciclo encola **un bloque con hasta 100 progresos y el estado**, conserva el cursor únicamente si se aceptó el bloque y aplica el filtro `(fecha, id)` en SQL antes del límite. Esto también evita atascarse con más de 100 eventos que comparten fecha. Tres regresiones fallaron antes y pasan después: historial de 1.000, 250 con igual fecha y lector detenido; 53/53 focales de servidor/seguridad/privacidad aprobadas. [Rojo](evidencias/diseno-conexion/sse-lotes-rojo.log), [verde](evidencias/diseno-conexion/sse-lotes-verde.log), [observación](evidencias/diseno-conexion/sse-lotes-observacion.json). No se dejó la primera propuesta como entrega final.

## Dirección y herramientas

Se leyó completa `docs/diseno/DIRECCION.md` y se aplicó la skill [elite-web-architect](/home/david/.claude/skills/synced/309a9d77-c195-4391-95c2-4c9e753a4536_5dd4a605-aa66-4ec5-8099-35023117c538/elite-web-architect/SKILL.md). La dirección de este componente es apartarse mientras todo funciona y aparecer como una capa discreta únicamente cuando ayuda. No requiere ilustraciones, dependencias ni referencias estéticas adicionales: sigue la dirección exacta de Claude.

Se usaron tres subagentes en paralelo con archivos asignados: SSE servidor/revisión independiente, infraestructura/reproducción y E2E/diseño. Shadcn UI y Context7 no estaban disponibles en el inventario de herramientas; se consultaron fuentes oficiales y documentación de Next instalada. CUA no tenía navegador disponible. Playwright, axe, Lighthouse y Caddy se ejecutan sobre ensayos locales aislados.

Fuentes consultadas antes de usar APIs: [EventSource/WHATWG](https://html.spec.whatwg.org/multipage/server-sent-events.html), [React useEffect](https://react.dev/reference/react/useEffect), [SSE/MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events), [Next Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route), [Playwright Clock](https://playwright.dev/docs/clock), [accesibilidad](https://playwright.dev/docs/accessibility-testing) y [videos](https://playwright.dev/docs/videos). También se consultaron [operadores Drizzle](https://orm.drizzle.team/docs/operators) y [consultas select](https://orm.drizzle.team/docs/select) para el cursor. Las fuentes Caddy/Compose y la contraprueba de compresión constan en la entrega de infraestructura.

## Commits

La serie parte de `53e001f`; el código final es `534ee7b9a72cb7480f133ddda9fbacc5ba092977`. `8fe926b` cierra la interfaz visual y `534ee7b` corrige la entrega de lotes del servidor. Commits atómicos, sin push ni merge:

| Commit | Cambio |
| --- | --- |
| `90a553b` | Cliente con reconexión y aviso tras corte sostenido. |
| `786b3d8` | SSE independiente de la conciliación, cabeceras y pruebas servidor. |
| `57a4a9e` | E2E y matriz de diseño reproducible. |
| `18a20a5` | Hojas de contacto. |
| `e937a3f` | Navegación filmada, estabilidad visual y verificador global estricto. |
| `84b6d0f` | E2E de conexiones inestables y cursor. |
| `3eb3e7a` | Recuperación del primer intento fallido. |
| `9a44147` | Cursor validado por dueño. |
| `4a0b781` | Backoff estable y conservación del cursor del cliente. |
| `80a0ea6` | Alcance administrativo al retomar eventos. |
| `caacadd` | Diagnóstico y propuesta de proxy reversible. |
| `0ad0401` | Exclusión de artefactos reproducibles de la raíz. |
| `6c0ed9e` | Estabilidad desde la apertura real y respeto del reintento pendiente. |
| `3f732c5` | Anclaje adaptativo y regresión contra solapamiento del encabezado. |
| `8fe926b` | Espacio tipográfico móvil y descarte de manifiestos visuales obsoletos. |
| `534ee7b` | Estado en el primer lote con historial grande; cursor SQL antes del límite. |

El cierre posterior solo incorpora este informe, el estado y recibos; no cambia aplicación ni pruebas.

## Puerta común

**PASS, 21-11-2026 de 22:32 a 22:50 Lima: 483 unitarias, 114 E2E y 235 flujos; cero errores, advertencias, omisiones y reintentos.** Los ocho pasos finalizaron con código 0. La cobertura E2E incluye Chromium, Firefox y WebKit, Sentinel, sesión/privacidad, cortes simulados y recuperación real offline/online del navegador. [Resultado y procedencia](evidencias/diseno-conexion/puerta/resultado.json), [conteos de los reporteros](evidencias/diseno-conexion/puerta/detalle-pruebas.json), [registros íntegros por paso](evidencias/diseno-conexion/puerta/).

Se ejecutó `npm run ci:limpia` desde `cooper/`, que archivó el commit final `534ee7b9a72cb7480f133ddda9fbacc5ba092977` en un checkout nuevo y ejecutó en orden la cadena obligatoria:

```sh
cd cooper
npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
cd ..
node --test tests/flujos_v2.test.cjs
```

El arnés añade la preparación de navegadores entre instalación y lint. El host no pertenece a las plataformas admitidas; se usó el contenedor Debian del repositorio, sin modificar ese control ni montar configuración real. Node 24.22.3, npm 12.2.2, Python 3.14.7, uv 0.12.24 y Sentinel fijado a `6764bbdcab91719947e93ba1cc476cbefafb58e8`. El recibo incluye SHA-256 del archivo limpio y de cada log; se verificaron al copiar la evidencia. Los logs con retornos de carro de progreso se conservan exactamente en `.log.gz`, junto a una copia `.log` normalizada para lectura; el [manifiesto de formato](evidencias/diseno-conexion/formato-registros.json) distingue ambas huellas. Las del recibo corresponden al original descomprimido.

Los [cuatro intentos anteriores](evidencias/diseno-conexion/intentos-puerta.json) fueron interrumpidos para incorporar correcciones posteriores y **no se contabilizan como aprobados**. La evidencia aceptada corresponde íntegramente al último commit de código; el commit posterior de documentación no modifica aplicación, pruebas ni configuración de ejecución.

## Puerta de diseño y autocrítica

La suite recorre 28 rutas/estados actuales y dos estados de conexión en 360, 390, 768, 1024, 1440 y 1920: 180 capturas finales en `evidencias-diseno/`, con 18 hojas de contacto. La ronda final pasó **7/7**, sin reintentos ni omisiones ([registro](evidencias/diseno-conexion/diseno-cierre.log)). La prueba de conexión exige tokens permitidos, axe sin infracciones, ausencia de desbordamiento, caja del contenido idéntica antes/durante el corte y separación de los textos del encabezado. No se sustituye la puerta global por estas comprobaciones del componente.

Resultados de la ronda final: [componente](evidencias/diseno-conexion/diseno-componente.json), [global](evidencias/diseno-conexion/diseno-global.json) y [procedencia](evidencias/diseno-conexion/procedencia-diseno.json). En 168 auditorías de pantalla hubo **0 axe serias/críticas, 0 desbordamientos y 0 excepciones JavaScript**. Cada ancho registra una respuesta 404 deliberada al visitar la página inexistente; las otras rutas no registran errores/avisos de consola. Las seis auditorías específicas de la píldora tienen cero infracciones axe y cero desviaciones de tokens. Las observaciones globales de tokens son 10.012/10.012/10.387/10.943/10.937/10.937 por ancho, respectivamente; son observaciones repetidas entre pantallas, no defectos únicos. El verificador de componente terminó con exit0; el global estricto con exit1, conservado como fallo real.

Lighthouse móvil: **Inicio 93/100 rendimiento, 100 accesibilidad, 100 buenas prácticas; Publicados 100/100/100**. CLS 0 en ambas, sin advertencias ni auditorías binarias fallidas. Se cumple el mínimo 90/100 de DIRECCION ([evaluación](evidencias/diseno-conexion/lighthouse-direccion.json), [mediciones](evidencias/diseno-conexion/lighthouse.json)). El arnés general existente exige rendimiento95 y devuelve exit1 por Inicio93; no se alteró ese umbral ni se presenta el comando como aprobado. Medición de laboratorio en host compartido durante otras pruebas, sin métricas de campo ni certificación 60fps de un teléfono físico.

**Autocrítica y correcciones:** se inspeccionaron las 180 capturas mediante hojas de contacto, además de ampliar los estados de conexión. El primer aviso tapaba los controles a 360/390 px y el contexto a 768 px: rechazado. Moverlo a 48 px aún rozaba la caja tipográfica del título móvil: rechazado por la aserción nueva. El ajuste final usa 4 px de relleno vertical en móvil/tableta, 13 px de texto y mantiene el título/encabezado legibles, sin desplazar contenido. El escritorio conserva el anclaje de 16 px.

**La puerta global de la sección 5 sigue NO APROBADA en esta rama.** La base conserva Manrope, la paleta azul/grafito, tamaños de 11 px y radios ajenos a DIRECCION. Inicio mantiene el chat dominante y no tiene el héroe de medios/orbe; a 768 px su columna estrecha alarga el panel. Publicados y Aprendizaje anteponen filtros al contenido. Canal y Ajustes conservan formularios muy largos. A 1920 px algunas pantallas dejan demasiado vacío lateral. Se repiten ilustraciones de cabecera y la navegación móvil sigue siendo lateral. No se considera esta composición al nivel de «Sala de proyección».

Estas desviaciones corresponden al armazón/pantallas compartidos con las misiones `diseno-base` y `diseno-medios`: se conserva su trabajo independiente y se registra la dependencia de integración, sin sustituirlo desde conexión. Los tokens locales de la píldora actúan como fallback hasta integrar los tokens compartidos. Esto también deja pendiente que herede Geist. La apariencia de demostración está identificada; las miniaturas del ensayo son ficticias y no se presentan como medios reales.

El video adicional acredita corte, recuperación, navegación y menú móvil existentes. Se repitió también a 390×844 sin reescalado: [video móvil](../../evidencias-diseno/videos/corte-recuperacion-movil-390.webm), [secuencia](../../evidencias-diseno/videos/secuencia-movil.png) y [prueba 1/1](evidencias/diseno-conexion/video-movil-final.log). Los siete videos de la matriz usan la resolución predeterminada 800×450 de Playwright; no se confunde su margen gris de grabación con la interfaz. No acredita las transiciones de medios, contadores, orbe abrir/cerrar ni barra inferior de DIRECCION, ausentes en esta base; esas grabaciones y la aceptación global requieren la combinación de las otras misiones. La auditoría registra por separado el 404 intencional de la pantalla inexistente: no se oculta para declarar consola global cero. El verificador estricto devuelve error ante cualquiera de estas desviaciones de tokens, accesibilidad, consola o desbordamiento.

Artefactos locales completos: [carpeta de capturas](../../evidencias-diseno/), [hojas de contacto](../../evidencias-diseno/contactos/) y [videos](../../evidencias-diseno/videos/). Se mantienen fuera de Git (48 MiB); el [manifiesto SHA-256](evidencias/diseno-conexion/artefactos.json), recibos y [cuatro muestras](evidencias/diseno-conexion/muestras/) sí se versionan. No representan capturas privadas de producción.

Reproducción en el entorno de pruebas admitido, desde `cooper/`:

```sh
npm run test:e2e -- --config=playwright.conexion-diseno.config.ts
node scripts/contactos-diseno-conexion.mjs
node scripts/verificar-diseno-conexion.mjs
node scripts/verificar-diseno-conexion.mjs --exigir-tokens-globales
COOPER_AUDITORIA_SALIDA=../evidencias-diseno/lighthouse node scripts/auditoria.mjs --rendimiento --rutas=/,/publicados --dispositivo=mobile
```

El último verificador de tokens debe fallar hasta que se corrija el sistema global; no hay excepción que convierta ese fallo en aprobación.

## Limitaciones reales

- Ningún despliegue ni aceptación privada productiva; la configuración efectiva de Caddy sí coincide con el ensayo en la lectura del 21-11-2026. Debe volver a compararse al aplicar el parche, únicamente cuando Claude lo ordene.
- Una llamada n8n ya iniciada conserva los timeout/reintentos del adaptador. Cerrar SSE detiene temporizadores, emisión y cupos; no cancela esa petición remota en curso.
- El estado local puede conservar datos anteriores mientras n8n tarda. Un canal HTTP sano no garantiza que todas las integraciones estén sanas. No se ocultan errores de acciones ni se reenvían mutaciones.
- Los límites de concurrencia/serialización permanecen por proceso. No se introduce coordinación distribuida.
- Los ensayos usan cuentas y recursos ficticios. No acreditan Safari/iPhone físico, redes móviles reales ni aceptación humana de diseño.

## Pendientes de Walter

1. Revisar con Claude los commits, capturas y autocrítica; integrar la conexión con `diseno-base`/`diseno-medios` y repetir la puerta global sobre la combinación.
2. Verificar el estado y los latidos desde su sesión legítima ya abierta en producción, incluida revocación y recuperación. No repetir OAuth para esta prueba si ya dispone de sesión válida.
3. Si Claude decide aplicar la propuesta de Caddy, comparar huellas/configuración efectiva, aceptar una ventana breve de recreación exclusiva del proxy y conservar el montaje anterior para reversa. La corrección de aplicación también debe integrarse y desplegarse por separado; el parche de compresión no sustituye el arreglo del primer byte.
