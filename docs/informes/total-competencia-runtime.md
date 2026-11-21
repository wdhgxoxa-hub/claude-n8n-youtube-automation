# Competencia: aceptación del runtime final

Fecha: 21 de noviembre de 2026, Lima. Complementa `total-competencia-aceptacion.md`; conserva los intentos fallidos y distingue la aceptación parcial de la del recorrido completo.

## Fuente y primeros intentos

Operación aplicó el lote canónico `fcfab3b`, entrada SHA256 `ca98d37aff4964d0cb6b8a5fbf53dfd50cb217ea795618fab58e65742431f849`. Radar publicado `c5eecaef-97f4-44db-9b41-c82d3eeb8a13`; hijo YouTube `cfdd769f-4069-4e63-8cbb-8c4bef4190af`. Los hashes de cada nodo Code publicado de ambos coinciden con la fuente canónica. Runtime efectivo n8n **2.47.4**. Horario Radar deshabilitado; `allowTextoApi=false` verificado por operación antes y después del lote.

La primera invocación no encontró la ruta interna recién publicada. No produjo ejecución. Tras un reinicio controlado de n8n y su relé, ambas rutas respondieron público 404 sin ejecución e interno 200. La publicación CLI por sí sola no acredita registro en el proceso vivo; este hecho corrige la generalización del procedimiento anterior sin reinicio.

El caller Radar 817 terminó success, pero su diagnóstico quedó bloqueado: el hijo Radar 820 falló, el getter YouTube 826 falló y Vigilante 827/828 también. La proyección autenticada HTTP 200 continuó mostrando el registro antiguo de las 17:13:01Z, cero competidores. **Un caller con continueRegularOutput no prueba éxito de negocio.** No se atribuyó a OAuth ni se ocultó con un estado listo.

## Deriva de esquema comprobada

El caller directo getter 831 guardó únicamente booleanos y categorías cerradas: token no recibido y error de tabla. Las referencias de tablas y sus propietarios coincidían; las clases reales de n8n validaron los nodos sin issues. La inspección se limitó a nombres y tipos de columnas: `fab_eventos` carecía de `canal_id` y `evento`.

Estas dos columnas son obligatorias: `tools/cooper/cobertura_flujos.py` inserta ambas en «Cooper · guardar auxiliar» antes de que el getter consulte Google; `tools/cooper/observabilidad_flujos.py` filtra `evento` desde Vigilante. No se corrigió el generador para descartar observabilidad. Se entregó a operación la migración aditiva, con ensayo y reversa antes de aplicar.

Se compararon las nueve tablas y las referencias de todos los flujos publicados. La unión ciega con `cooper-tablas-ensayo.json` habría añadido 28 columnas. Se separó la necesidad productiva:

| Clasificación | Campos ausentes | Evidencia y tratamiento |
| --- | --- | --- |
| Obligatorios | eventos: canal_id, evento | Escrituras y filtro canónicos; dos columnas string que deben existir. |
| Compatibilidad de lectura | canales: zona_horaria; videos: render_url, miniatura_url; planos: url, orden, duracion_s; publicaciones: plataforma, url | `cobertura.js`, `observabilidad.js` y `aprendizaje.js` admiten estas formas antiguas, con alternativas actuales. Ocho campos opcionales; no se migran para satisfacer fixtures. |
| Solo ensayo, sin escritura productiva acreditada | videos: storyboard, drive_url, publicacion_id, retencion; planos: prompt, archivo_id, error, version; publicaciones: error, publicar_en | Diez nombres del fixture no son requisito de los escritores actuales. Los datos actuales viven en trabajos, aprobaciones, archivo_url y resultado. |
| Solo ensayo YouTube | state, redirect_uri, access_token, token_type, scope, youtube_id, youtube_titulo, expires_at | El getter/callback usa nonce, refresh_token y canal_youtube_id existentes. No se crea un almacén de access_token ni se leen valores. |

El nuevo `contratos/cooper-tablas-produccion.json` define el contrato completo de nueve tablas, aliases youtube/publicaciones, las lecturas opcionales y las exclusiones de ensayo. Se preservan las columnas históricas adicionales. `tools/cooper/comparar_esquema_productivo.py` compara nombres/tipos y columnas de filtros/mapeos; resuelve las dos ramas del selector de Confirmar y rechaza selectores desconocidos. Una referencia a tabla ausente también bloquea aunque no tenga filtros. Cinco regresiones pasan; contra el VPS detectó exactamente dos columnas obligatorias, un filtro incompatible y cero tipos distintos.

Commits: `db07bb3`, `bb261a3`. Operación conecta la validación al preflight del lote y es responsable del recibo de respaldo, ensayo/reversa y aplicación.

## vidIQ: diagnóstico sin culpar a la cuenta

Las ejecuciones 824/834 confirmaron initialize 200 y tools/list 200 con 84 herramientas. Balance y canales devolvieron HTTP 0 por error del nodo; no se inventó saldo ni se atribuyó caducidad o falta de permiso. La cadena de error no se imprimió: solo tipo y categorías cerradas.

El frente aprendizaje reprodujo después el fallo con el evaluador real y HttpRequestV3 de n8n 2.47.4/2.47.6 sin red: los cierres `}}` contiguos dentro de la expresión compacta JSON.stringify producen `invalid syntax`; el mismo objeto espaciado pasa. No es una restricción de la clave `arguments`. Serializar el cuerpo en Code y usar únicamente `$json.cuerpo` en HTTP lo evita. Su commit `2ec8f9e` se incorporó localmente como `22d8bd6`; no debe integrarse dos veces. Diez pruebas del helper/caller pasan. La sonda corregida conserva un control del parser anterior que solo registra igualdad exacta con esa constante, nunca mensajes crudos. No llama investigaciones ni herramientas con créditos.

## Pendientes de Walter

Ningún fallo de esta sección se traslada a Walter: la deriva de esquema y el parser son defectos técnicos. La publicación social sigue necesitando aprobación humana. TikTok permanece como limitación de acceso externo acreditada; un bloqueo robots no demuestra ausencia de cuentas homónimas ni exige comprar otra herramienta.

## Migración aplicada

Operación confirmó la migración aditiva de dos columnas, contrato de nueve tablas compatible, 45 flujos y 130 filas preservados, cero ejecuciones nuevas/en curso y esperas 400/540 intactas. Snapshot previo SHA256 `4077d2b279cd9adc942cfd76585b7c3b8c011cf8797ec30e029127aed5d9ebc1`. Su commit `f7bf33f` conecta obligatoriamente la comparación al ensayo/aplicador, exige las huellas del contrato/comparador/helper y valida estado proyectado antes de escribir y estado final antes de importar. El helper solo consulta nombres/tipos/keyName. [Recibo de aplicación](evidencias/total-cierre-aceptacion/esquema-productivo/aplicacion-vps.json).

## Getter y Vigilante reales

| Sonda y ejecución | Resultado acreditado |
| --- | --- |
| `CoopSondaYtComp1`, padre **835** | Invocación única del ensayo autorizado; acaba en error sintético deliberado, claramente identificado. |
| Hijo productivo `FabYouTube000001`, **836** | Success; permiso disponible y canal YouTube válido. El diagnóstico solo conserva booleanos; no exporta el token. |
| Hijo productivo `FabErrores000001`, **838** | Success; un incidente identificado como ensayo y exactamente un aviso Telegram enviado. No se repitió el error sintético. |

[Getter](evidencias/total-competencia-runtime/getter-diagnostico-final.json), [Vigilante](evidencias/total-competencia-runtime/vigilante-final.json). El ensayo no borra ni sustituye los errores reales previos.

## Acceso real de vidIQ y cuota

La ejecución **839** comprobó initialize/list/balance/user_channels HTTP 200: 84 herramientas disponibles, balance y canales con cero créditos. El control de la expresión antigua produjo dos coincidencias exactas `invalid syntax`; las dos lecturas corregidas funcionaron. No se imprimieron mensajes crudos ni cabeceras. Los once nombres de herramientas canónicos existen y sus tipos/requisitos coinciden; los ocho cuerpos canónicos, que ya estaban espaciados, se conservaron.

Las consultas acotadas **859** y **864** usaron tres IDs públicos conocidos, máximo diez resultados y umbral 2×. La segunda agregó `contentType=short` y `publishedWithin=thisMonth` tras contrastarlos con el esquema real. Ambas devolvieron HTTP 200 y `_credits.used=0`; saldo renovable **5875** y adicional **525** idénticos antes/después. La segunda respuesta se redujo dentro de n8n a longitud 25 y categoría cerrada `sin_resultados`, sin enlaces ni JSON de videos. No se conserva el texto libre de la respuesta. El helper antiguo marcó `limite_verificado=false` porque exigía exactamente cinco créditos; esa condición no significa fallo de acceso ni consumo desconocido: los dos saldos y el consumo cero están acreditados. [Lectura de acceso](evidencias/total-competencia-runtime/vidiq-diagnostico-final.json), [consulta con filtros](evidencias/total-competencia-runtime/vidiq-investigacion2-diagnostico.json).

La [documentación oficial MCP](https://support.vidiq.com/en/articles/15082430-vidiq-mcp), la [cuota por plan](https://support.vidiq.com/en/articles/13928456-features-credits-by-plan) y el [repositorio oficial](https://github.com/vid-io/vidiq-mcp) se contrastaron con `tools/list`: las lecturas de cuenta son gratuitas y una investigación puede usar cinco créditos. El saldo renovable se consume antes del adicional. La autorización de esta misión permite hasta cinco créditos renovables incluidos; los ensayos anteriores han consumido **cero**, sin compra, recarga ni addOn. No se atribuye a vidIQ cobertura TikTok.

## Datos nativos y fallo del contexto completo

El padre **840** terminó success mientras el Radar productivo **841** falló. Su hijo nativo **845** sí terminó correctamente. No se aceptó ese resultado como éxito integral.

El replay **851** de las cuatro etapas finales sí persistió y la proyección autenticada HTTP 200 mostró fecha `2026-11-21T19:00:41.615Z`, tres competidores peruanos reales y treinta muestras: Diario Gestión, Daniel Bonifaz y Cristian Arens. Cinco videos de duración superior a 180 segundos se clasificaron largos; los otros 25 permanecen sin clasificar, porque duración corta no prueba Shorts. Cero outliers confirmados y dos homónimos YouTube; TikTok continúa inaccesible. Se conserva la diferenciación Margen Real = Perú, soles y casos peruanos. [Replay](evidencias/total-competencia-runtime/radar-tramo-diagnostico.json), [proyección](evidencias/total-competencia-runtime/radar-proyeccion-replay.json).

Parámetros y conexiones publicados coincidían con la fuente. Operación reprodujo después el recorrido íntegro con motores reales 2.47.4/2.47.6 y proveedores ficticios: Execute Workflow añade `metadata`; el Code «Competencia con YouTube» devolvía el item completo y n8n rechazaba esa clave superior. El replay aislado no reproducía ese contexto. Su fix `d1c6750` reconstruye exclusivamente `json` y `pairedItem`; conserva canal, datos y fallback. La regresión prueba primero el fallo anterior y después uno/tres canales con persistencia. No se corrigió por conjetura ni se modificó Google.

## Adaptador de cuota y pruebas locales

Commits **`62d128b`**, **`ca472c6`** (integrados por raíz como `bfa9659`, `758fbd9`). El hijo nativo conserva las ocho GET máximas. Si `allowVidiq` está activo, consulta catálogo y saldo, exige al menos 100 créditos renovables y esquema compatible, y permite una sola investigación acotada, sin reintento ni redirección. Comprueba saldo posterior y addOn intacto. No ejecuta herramientas de compra, recarga, escritura o publicación.

Una consulta explícitamente vacía es válida dentro de sus filtros; no exige inventar un outlier. Respuestas desconocidas o errores conservan la evidencia pública. Solo IDs del canal y publicaciones ya observadas pueden aportar clasificación de formato. Nunca se inventan vistas ni base comparable. Si la petición pudo ejecutarse pero no informó consumo, se conserva `creditos:null` y estado `desconocido`; cero se usa cuando no se autorizó petición o el proveedor lo informó. El texto usa las cuentas indicadas, sin imponer Perú a otras marcas.

Pruebas: **189/189** (173 flujos, siete YouTube, nueve vidIQ). [Salida](evidencias/total-competencia-runtime/regresiones-vidiq.log). Evaluador y HttpRequestV3 reales de ambos motores pasan seis solicitudes y una investigación con transporte/credencial ficticios y red deshabilitada. [Recibo](evidencias/total-competencia-runtime/runtime-vidiq-local.json). Inventario regenerado: 33 flujos, 1271 nodos, 131 decisiones/esperas, 58 ajustes y nueve tablas. README ya declara 33 flujos. Cooper y su imagen no cambian; la puerta web completa corresponde al cierre integrado de raíz, sin atribuir una repetición local inexistente.

Ese corte todavía tenía pendiente la aplicación reversible y la aceptación integral. Las pruebas siguientes lo actualizan; el replay no las sustituye.

## Radar productivo completo: aceptado

Operación aplicó con respaldo y reversa ensayada el delta de fuente **`758fbd9`**. Radar quedó publicado como `a054ba99-0ffc-472e-a4ed-a0758cca37c4`; el hijo nativo como `725330ee-47e3-49e8-83d2-1042262f5b57`. Los 17 y siete hashes Code respectivos coinciden con la fuente. Se conserva el horario Radar deshabilitado y el freno `allowTextoApi=false`. [Fuente publicada](evidencias/total-competencia-runtime/fuente-final3.json), [comparación](evidencias/total-competencia-runtime/fuente-final3-comparacion.json).

La única invocación integral nueva produjo **865 caller → 866 Radar → 868 Texto → 870 competencia nativa → 871 getter**, todos `success`; también pasaron Ajustes 867/869/872/873. El caller guardó su diagnóstico y el Radar persistió la investigación de `2026-11-21T19:42:15.480Z`. La lectura autenticada HTTP 200 de Cooper coincide exactamente con la proyección normalizada de ese registro: SHA256 **`60e60f10f15139c920ea35f1cff4e5aec3cc296bb72bf4d14741bc6e9a12cf05`**. [Ejecuciones](evidencias/total-competencia-runtime/radar-integral-ejecuciones.json), [diagnóstico](evidencias/total-competencia-runtime/radar-integral-diagnostico.json), [coincidencia](evidencias/total-competencia-runtime/radar-integral-coincidencia.json).

El proceso SSH del invocador terminó con código 143 sin conservar su recibo HTTP. Operación confirmó que no reinició, señaló ni mutó servicios durante la llamada; la causa de esa terminación no está demostrada. No se repitió la invocación ni se fabricó un recibo público/interno. La aceptación se apoya en las ejecuciones finales, la persistencia y la comparación HTTP posterior independientes. [Incidente de transporte](evidencias/total-competencia-runtime/radar-integral-transporte.json).

La web proyecta cuatro identidades públicas: Diario Gestión Perú, Daniel Bonifaz, Cristian Arens e Infomercado. Las tres primeras aportan diez publicaciones cada una; Infomercado tiene identidad contrastada y ninguna muestra. Hay cinco formatos largos acreditados por duración superior a 180 segundos y 25 sin clasificar; no se confunde duración corta con Shorts. Cero outliers confirmados no demuestra ausencia de outliers con una base incompleta. Se conservan dos homónimos YouTube y la regla **Margen Real = Perú, soles, cifras y casos peruanos**. TikTok sigue sin búsqueda acreditada, con bloqueo robots documentado en los intentos previos. El estado final sigue siendo **parcial**, visible con esas limitaciones; ninguna cifra ni cuenta se inventa. [Proyección pública saneada](evidencias/total-competencia-runtime/radar-integral-proyeccion.json).

## Diferencia entre acceso vidIQ y contenido aceptado

La sonda 864 acredita acceso, cuota antes/después intacta y una respuesta clasificada ampliamente como `sin_resultados`. El adaptador productivo 870 conservó la fuente gratuita y reportó cero consumo; **no acreditó contenido adicional de vidIQ**. El éxito de la sonda no se extiende a esa aceptación.

Se investigó la diferencia sin nuevas llamadas: `execution_data` de 870 existe, pero su `resultData.runData` está vacío por el ajuste de privacidad. La extracción recorrió solo referencias y rutas permitidas; no seleccionó cabeceras, credenciales ni el objeto completo. No hay respuesta productiva ni saldo posterior conservados para distinguir contenido no admitido de cuota posterior no acreditada. La sonda solo retuvo tipo, longitud 25 y categoría amplia del texto; esa reducción tampoco permite reconstruir una frase exacta. No es evidencia de rechazo de la cuenta ni de un defecto del parser.

Las nueve regresiones offline del adaptador pasan: JSON/SSE, respuesta vacía explícita, error/instrucciones rechazados, cuota exacta y addOn intacto, y conservación del respaldo. No se reprodujo un fallo técnico ni se cambió el parser para aceptar datos desconocidos. Quedan acreditados el circuito completo Radar → persistencia → Cooper y su respaldo gratuito; el contenido vidIQ productivo conserva esta limitación de aceptación. No se trasladó a Walter una causa técnica no demostrada. [Diagnóstico cerrado](evidencias/total-competencia-runtime/vidiq-produccion-limite-diagnostico.json).

## Sondas retiradas y cierre del frente

Se despublicaron secuencialmente `CoopSondaYtComp1`, `CoopSondaVidIQ01` y `CoopRadarReal001` mediante la CLI oficial, sin imprimir su salida. La recarga controlada se coordinó con operación después de las 15:02 Lima para conservar la observación programada M7; operación la agrupó con respaldo/restauración y conservó siete servicios saludables y las esperas 400/540.

A las **15:04:36 Lima**, la verificación comprobó primero las tres sondas inactivas, sin versión publicada y sin entradas `webhook_entity`. Después realizó un POST por cada ruta pública e interna: **seis respuestas 404 y cero ejecuciones nuevas**. El getter aislado `CoopEnsayoTok01` también permanece retirado. No se repitió el error de Vigilante ni ninguna consulta productiva. Se conservan los workflows inactivos y la historia de los intentos; no se afirma que hayan sido borrados. [Recibo final](evidencias/total-competencia-runtime/retiro-sondas-final.json).

El frente entrega implementación integrada/desplegada, aceptación completa del recorrido y datos parciales honestos. La puerta integrada y las rondas web finales corresponden al orquestador; este cierre documental no cambia Cooper ni su imagen. No agrega una decisión obligatoria de Walter: siguen vigentes la aprobación humana de publicaciones y los límites de fuentes/formato descritos, sin atribuir un bloqueo técnico a una cuenta sin prueba.
