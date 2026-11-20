# Cooper ↔ n8n · contrato y puesta en servicio de fase 2

Implementación integrada en `cooper-integracion`; **no desplegada ni probada contra n8n vivo**. Los JSON se generan exclusivamente con `python3 tools/generar_flujos_v2.py`. Los identificadores de nodos existentes se conservan; dos ejecuciones consecutivas no cambian los archivos.

## Componentes y autoridad

- `FX · API de Cooper` (`FabCooperAPI0001`): POST privado `/webhook/cooper/v1`, con respuesta explícita y autorización antes de leer tablas. Envía órdenes al Orquestador existente. Todos los workflows se exportan inactivos.
- `FX · Progreso de Cooper` (`FabCooperProgr01`): firma el cambio ya persistido de cada video y lo entrega a Cooper.
- `FX · Registrar costo por dueño` (`FabCooperCosto01`): atribuye el paso consultando video/canal y hace upsert por `paso_id`.
- [Catálogo compartido](../cooper/src/contratos/cooper-v1.json), [validación y tipos Zod](../cooper/src/contratos/puente.ts), [migración declarativa de n8n](../contratos/cooper-migracion-tablas.json). El generador incrusta el mismo catálogo que importa Cooper; las pruebas ejecutan los nodos Code exportados.

El navegador nunca recibe tokens, URLs de espera, proveedores ni columnas de costos. El servidor obtiene identidad y rol de la sesión. FX contrasta además el correo administrador con `COOPER_ADMIN_EMAIL`. Los IDs no son permisos: cada evento busca el recurso entre los canales/videos autorizados. Las filas sin dueño y las eliminadas no se devuelven, tampoco al administrador. Las herramientas legadas de Telegram/formulario siguen siendo herramientas del operador, no se exponen como API de usuarios.

## Solicitudes

Cabeceras: `Content-Type: application/json`, `Authorization: Bearer <COOPER_N8N_TOKEN>`; secreto aleatorio de al menos 32 caracteres, solo en entorno. No hay credenciales embebidas en el JSON. El primer nodo compara el token en tiempo constante antes de cualquier acceso a datos. No se habilita CORS público.

```json
{
  "version": "cooper-v1",
  "id_evento": "28525d02-f877-4dce-9a41-93d4c26c976e",
  "evento": "nuevo_video",
  "dueno_email": "persona@example.test",
  "admin": false,
  "datos": {
    "id": "571d569a-cba6-43bb-a9de-2dc848edc080",
    "recursoId": "canal-ejemplo",
    "texto": "Por qué el cielo es azul",
    "parametros": { "formato": "short" }
  }
}
```

`id_evento` identifica la entrega; `datos.id` identifica el recurso nuevo o la aprobación/eliminación. Para otros cambios `recursoId` identifica el recurso existente. Las identidades que vengan dentro de `datos` no se usan. La API de Cooper `/api/orden` admite `parametros` estructurados, validados por FX; no deduce perfiles de publicación de frases ambiguas.

| Evento | Datos y traducción al Orquestador |
| --- | --- |
| `nuevo_canal` | `id`, `texto`, `nombre` opcional → reserva con dueño, `criterios`. Conserva ese ID tras investigación y aprobación del canal. |
| `nuevo_video` | `id`, `recursoId` de canal, `texto`, `parametros.formato` opcional → `canal_id`, `video_id`, `tema`. Exige canal activo con biblia. Avatar/voz seleccionados devuelven 422 hasta implementar el consumo de `presentacion`. |
| `corregir` | `recursoId` de video, `texto` → instrucción y guion/storyboard según etapa actual. |
| `aprobar_guion` | `id` de video → `aprobado:guion`; exige etapa `aprobacion_guion` y decisión pendiente. |
| `aprobar_final` | `id` de video → `aprobado:final`; exige etapa `aprobacion_final` y decisión pendiente. |
| `ajustar_biblia` | `recursoId` de canal, `texto`; `parametros.campo` y `valor` opcionales. Sin campo usa `notas`. Rechaza prototipos y campos de identidad. |
| `programar` | `recursoId` de video, `texto` ISO con zona, entre una hora y seis meses en el futuro. |
| `referencias` | `recursoId` de video, `texto` → referencias del canal del video, según evento existente del Orquestador. El texto queda en Cooper; el generador de referencias usa la biblia. |
| `configurar_redes` | `recursoId` de canal, `texto`, `parametros.perfil`, `parametros.redes` (array), `zona` opcional. No realiza OAuth. |
| `metas` | `recursoId` de canal, `texto`; `parametros.videos_semana` (0–21), `formato`, `auto` opcionales. Sin número estructurado admite el primer número del texto. No modifica presupuestos internos. |
| `adoptar_cuenta` | `recursoId` de canal, `texto` con enlace/handle, `parametros.red` opcional. Conserva el ID/dueño durante la propuesta y aprobación. |
| `eliminar` | `id`, `tipo: canal|video`. Marca `eliminado`; canal marca también sus videos. Solo en reposo: guion/final esperando aprobación o publicado. Con producción en curso devuelve 409. |

La aceptación devuelve `200 {"aceptado":true}`: confirma **entrega al Orquestador**, no terminación del trabajo ni publicación. Los frenos y decisiones del Orquestador siguen vigentes. `400`: entrada inválida; `401`: token inválido; `403`: autoridad insuficiente; `404`: recurso ausente/ajeno; `409`: recurso no preparado, falta decisión, producción activa u orden con resultado incierto. `422`: presentación seleccionada no soportada por el montaje actual; no se despacha ni se ignora la selección. Los errores de transporte se traducen a mensajes genéricos en Cooper.

Las aprobaciones de guion y final con dueño quedan registradas sin formulario paralelo ni URL de reanudación. FX recupera el contexto de `fab_aprobaciones.pedido`, nunca del navegador, cierra la decisión y avanza. Las decisiones de **canal, storyboard y permiso de gasto** conservan el circuito del operador: no se convierten en aprobaciones automáticas.

## Consultas

Todas usan el mismo sobre, con `datos:{}` y un UUID nuevo. Las lecturas de canales/videos se filtran en Data Table por `dueno_email` (admin: filas con dueño), y se vuelve a autorizar antes de proyectar la respuesta.

| Consulta | Respuesta |
| --- | --- |
| `estado` | `{canales:[{id,dueno_email,nombre,nicho}],videos:[{id,dueno_email,canal_id,titulo,stage,script,actualizado_en}]}` |
| `reporte` | `{resumen}` con videos y etapas del ámbito autorizado. |
| `pendientes` | `{resumen}` con decisiones de guion/final del ámbito autorizado. Sin enlaces internos ni costo. |
| `tendencias` | `{resumen}` del radar guardado de los canales autorizados. No dispara una llamada paga. |
| `gastos` | Solo admin: `{gastos:[{dueno_email,dia,semana,mes}],estimados}`. |

Los períodos son de calendario UTC: hoy, lunes de esta semana y primer día del mes hasta ahora. Los montos se agregan con seis decimales; el panel muestra USD con dos. La alerta diaria es informativa. El panel en modo `n8n` consulta esta respuesta; no mezcla gastos simulados de SQLite ni sustituye un fallo por cero.

La fábrica registra los pasos de imágenes, clips, revisiones, voz, música/efectos, montaje, referencias, miniatura/cortes, radar y texto. La atribución procede de las tablas, no del proveedor. Las investigaciones antiguas del operador todavía sin canal se atribuyen al administrador configurado. Una fila huérfana de un recurso identificado se rechaza.

**Son registros de uso de la fábrica, no conciliación de facturas.** Las tarifas de Ajustes siguen siendo estimadas y `estimado:true` lo declara; los pasos incluidos en planes/suscripciones tienen importe incremental 0. No se consultó facturación externa. Una llamada fallida que el proveedor haya cobrado, o un reintento interno del proveedor/nodo HTTP, requiere conciliación: no se afirma conocer un cargo que la respuesta no acredita. Los costos se escriben después de cada llamada que devuelve salida, antes de pasos posteriores, y no se duplica el total del video como otro gasto.

## Entrega, firma e idempotencia

Antes de enviar una mutación, Cooper persiste el sobre exacto en `bridge_commands`. FX manda al receptor firmado una reserva `{version,tipo:"orden",id_evento,ejecucion,fase:"reservar",solicitud}`. La transacción SQLite solo permite una ejecución por ID. Otra ejecución obtiene `pendiente`; una confirmada obtiene `confirmada` sin volver a despachar. Tras la llamada asíncrona al Orquestador, FX manda `fase:"confirmar"`. Una orden desconocida o modificada se rechaza aunque su callback esté firmado.

El cliente hace tres intentos, espera 250/500 ms y tiene timeout de 10 s por intento. Solo reintenta transporte, 408, 429 y 500/502/503/504; conserva bytes e ID. Las aprobaciones usan un ID determinista por usuario/video/puerta/revisión para evitar doble clic. Los redirects HTTP se rechazan. Una reserva sin confirmación después de una caída **no se libera automáticamente**: no se puede distinguir despacho realizado de despacho perdido. Revisar esa ejecución antes de cualquier repetición manual. No se promete exactamente una ejecución del proveedor en presencia de fallos arbitrarios.

Callback POST a `/api/n8n/webhook`:

```json
{
  "version": "cooper-v1",
  "tipo": "progreso",
  "id_evento": "ejecucion:nodo:pasada:item",
  "video": {
    "id": "video-ejemplo",
    "dueno_email": "persona@example.test",
    "canal_id": "canal-ejemplo",
    "titulo": "Por qué el cielo es azul",
    "stage": 3,
    "script": "Guion para revisar",
    "actualizado_en": 1795200000000
  }
}
```

`x-cooper-timestamp`: Unix en milisegundos (13 dígitos). `x-cooper-signature`: `sha256=` + hex de `HMAC-SHA256(COOPER_WEBHOOK_SECRET, timestamp + "." + bytes_del_cuerpo)`. Se firma el cuerpo JSON serializado y el HTTP node lo envía **raw**, sin reserializar. El receptor compara en tiempo constante y acepta ±5 minutos; limita a 128 KiB incluso sin Content-Length, valida con Zod y comprueba dueño/canal del video existente.

`bridge_receipts` conserva ID y digest; repetir el mismo cuerpo confirma sin efecto adicional. Mismo ID con distinto cuerpo devuelve 409. Un evento viejo se registra pero no retrocede el estado. Una corrección nueva puede volver a una etapa anterior. La etapa y el recibo se actualizan en una transacción. El emisor reintenta cinco veces cada dos segundos con el mismo cuerpo y sello; si se agotan, queda la ejecución fallida para revisión y la fila del video conserva la última etapa para conciliación.

Etapas 0–11: Radar, Guion, Verificación, Aprobación de guion, Storyboard, Imágenes y clips, Voz y música, Montaje, Calidad, Aprobación final, Programado, Publicado. Se notifican las etapas que realmente se ejecutan; por ejemplo, verificación puede estar apagada. La aceptación inicial muestra Radar en Cooper. SSE consulta los eventos durables cada dos segundos y emite `id`, `event: progreso`, `{id,stage}`; también conserva `event: estado` para la interfaz existente. Revalida sesión/dueño en cada pulso. `Last-Event-ID` permite continuar; la conciliación HTTP corre al abrir y cada minuto. Su fallo no impide reemitir los callbacks ya recibidos. No es un broker instantáneo ni una cola distribuida.

## Migración en vivo — solo Claude/Walter

No ejecutar estos pasos desde la misión de construcción. Aplicar primero en una copia de ensayo con datos ficticios y servicios pagos apagados.

1. Detener nuevas órdenes del chat/Telegram, cron y web. Esperar o inventariar ejecuciones y formularios activos: las ejecuciones antiguas conservan su grafo anterior. Exportar workflows/tablas y respaldar SQLite de Cooper con el procedimiento operativo. No incluir credenciales en Git.
2. En **Data tables** del proyecto n8n, comprobar nombres e IDs contra `T` del generador. Si la instancia destino usa otros IDs, modificar esa configuración y regenerar antes de importar. No crear tablas paralelas silenciosamente.
3. Añadir las columnas de [cooper-migracion-tablas.json](../contratos/cooper-migracion-tablas.json), con los tipos exactos `string`, `boolean`, `number`. No son ALTER TABLE sobre SQLite interno de n8n; usar el editor oficial de Data Tables. No tocar el almacenamiento interno de n8n por SQL.
4. Preparar una correspondencia revisada `canal_id → dueno_email` con Walter, en minúsculas. Rellenar **cada** `fab_canales.dueno_email` y `eliminado=false`. No inferir dueño por nombre/tema ni asignar canales de otras personas al admin para silenciar fallos.
5. Rellenar `fab_videos.dueno_email` desde su canal; `eliminado=false`, `guion_cooper` con el último guion validado disponible (o cadena vacía), `cooper_actualizado_en` con la fecha de actualización en milisegundos y `cooper_evento_id` con un ID de migración único por fila. Revisar las etapas históricas: las decisiones abiertas de guion/final pasan a `aprobacion_guion`/`aprobacion_final` solo cuando exista su fila pendiente con `pedido` válido.
6. Rellenar `fab_trabajos.dueno_email` por video/canal; resolver explícitamente las investigaciones sin canal. Rellenar `fab_costos.dueno_email` por video o por el prefijo `canal:`; cada fila histórica recibe `paso_id` único y `estimado=true` salvo conciliación acreditada. Las filas sin correspondencia deben resolverse antes de habilitar producción. Verificar cero huérfanos y cero recursos con dueños contradictorios.
7. En Cooper, con su volumen persistente y entorno de ejecución correcto, aplicar `cd cooper && npm ci && npm run db:migrate`. Esto aplica `0002_puente` y `0003_medios_reales`: añade órdenes/recibos, marca remota de videos y campos/tablas de medios sin eliminar datos. Una base experimental de fase 3 con el antiguo `0002_medios_reales` necesita migración específica o base de ensayo nueva; no alterar manualmente su diario. Las migraciones se aplican también al abrir la base. Mantener **una instancia SQLite compartida por todos los procesos de Cooper**; no usar réplicas con discos independientes.
8. Configurar fuera de Git: en ambos servicios `COOPER_N8N_TOKEN` y `COOPER_WEBHOOK_SECRET` (distintos entre sí, mínimo 32 caracteres), y el mismo `COOPER_ADMIN_EMAIL`. En Cooper, `COOPER_N8N_URL=https://N8N/webhook/cooper/v1`, `COOPER_FABRICA=n8n`. En n8n, `COOPER_WEBHOOK_URL=https://COOPER/api/n8n/webhook`. No copiar valores a informes.
9. Permitir únicamente el módulo `crypto` en los Code nodes (`NODE_FUNCTION_ALLOW_BUILTIN=crypto` en el runner si lo hay). Asegurar acceso a estas variables mediante la configuración `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` y la configuración/allowlist del runner instalado. Esta configuración implica que editores de workflows son operadores de confianza; no darles acceso a usuarios de Cooper. Comprobar que el runner recibe las variables sin imprimir sus valores. Mantener relojes sincronizados.
10. Importar primero los tres FX nuevos y después los workflows regenerados que los llaman. Inspeccionar diferencias y asociaciones de credenciales existentes. Mantener las opciones de gasto apagadas. El FX de entrada no guarda datos de ejecuciones exitosas/fallidas; comprobar además que el proxy no registre Authorization/cuerpos.
11. Drenar/anular de manera controlada las decisiones antiguas de guion/final de los recursos migrados y recrear las pendientes con el nuevo flujo; comprobar que no siga vivo un formulario anterior capaz de aprobar el mismo video. Las aprobaciones nuevas de Cooper no tienen URL y el reenviador legado no las recoge. Conservar aprobación del operador para canal/storyboard/gasto.
12. Publicar el webhook FX y los flujos dependientes en la copia de ensayo. Con dos cuentas ficticias probar creación, consulta, callback firmado, duplicado, firma inválida, intento de recurso ajeno, aprobación, programación, eliminación en reposo y gasto solo admin. Confirmar que una consulta normal y SSE no contienen costos, proveedores ni enlaces internos. Revisar reserva/confirmación y recuperar un callback fallido sin duplicar eventos.
13. Para el paso en vivo, Claude revisa esos resultados, repite backup, importa/publica el lote aprobado y cambia el modo de Cooper. Validar primero estado de cada dueño y panel de admin; habilitar servicios de producción únicamente según decisión de Walter. TLS, proxy sin buffering SSE y respaldos operativos son parte del despliegue posterior; esta misión no los instala.

Reversión: cerrar entrada de órdenes, desactivar el FX y los cron nuevos, conservar recibos/órdenes para investigar operaciones ya despachadas, restaurar workflows respaldados y mantener las columnas aditivas. No borrar registros de idempotencia para forzar una repetición. Volver a modo simulado no repara ni cancela producción ya enviada.

## Fuentes oficiales consultadas

Verificación de documentación durante la misión (20-11-2026): [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/), [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/), [Data Table / filas](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.datatable/rows/), [Execute Sub-workflow](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflow/), [módulos en Code](https://docs.n8n.io/hosting/configuration/configuration-examples/modules-in-code-node/), [acceso a variables](https://docs.n8n.io/hosting/configuration/environment-variables/security/), [runners](https://docs.n8n.io/hosting/configuration/task-runners/), [Crypto de Node](https://nodejs.org/api/crypto.html), [Zod](https://zod.dev/api). Route Handlers se contrastaron con la documentación de Next instalada en `cooper/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`. No se inventaron endpoints de proveedores ni se invocaron APIs de pago.
