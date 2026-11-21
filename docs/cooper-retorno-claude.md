# Retorno de la fábrica — M01

Contrato de transporte versión 1, 21-11-2026 (Lima). Implementación local; la
routine externa y la reapertura del webhook requieren aceptación separada.
El chat CLI no configura ni sustituye esta conexión.

## Configuración y entrega

`FABRICA_ORIGEN_PUBLICO` parametriza el origen al ejecutar el generador offline.
Por defecto es `https://flujos.cooperestudio.com`. Solo acepta un origen HTTPS
estable sin ruta, credenciales, consulta ni fragmento; rechaza ngrok. El nodo
Ajustes conserva `baseUrl` y `retornoUrl`. `Preparar trabajo` exige que coincidan
y transporta `retorno_version: 1` y `retorno_url` fuera de `datos`.

El paquete de la routine debe incluir [FABRICA.md](../skill/FABRICA.md) y sus
roles/biblioteca existentes. Si se usa otro origen, el operador configura
`N8N_WEBHOOK_RESULTADO` en la routine con la misma URL exacta. No se transportan
claves en el sobre. El webhook conserva Header Auth y la referencia existente
`Clave Fábrica`; asociar su cabecera en la configuración de red externa queda a
cargo del operador. La skill no prueba ni configura esa asociación.

El lote revisable consta de los deltas de `FabAjustes000001`, `FabLlamarClaude1`
y `FabRetornoClaud1`, más el contrato. Las tres exportaciones tienen
`active: false`. Aplicar al lote combinado del orquestador preservando sus IDs,
ajustes, referencias de credenciales y el resto de las misiones. No reemplazar
los Ajustes vivos con sus valores de ejemplo. No hay migración de columnas:
se reutilizan `estado` y `resultado` de `fab_trabajos`.

## Entrega y recuperación

El receptor valida modo, prefijo de `job_id`, estructura y tamaño del resultado,
y lo compara con un único trabajo persistido. Dueño, canal y video proceden de
ese trabajo. Un modo diferente, un trabajo inexistente, bloqueado o duplicado
en la tabla recibe `409` sin despacho. Una credencial incorrecta se rechaza
antes de consultar la tabla.

La reserva cambia condicionalmente el estado observado a `retorno_en_curso` y
guarda el resultado, su huella canónica y la ejecución receptora. Solo la
ejecución que obtiene esa reserva llama al Orquestador. Espera a que termine su
tramo antes de guardar `listo`/`error` y responder `200`. Se conserva una salida
incluso si el Orquestador termina sin ítems. El ensayo n8n 2.47.4 reprodujo que
cerrar el HTTP mientras el hijo está desacoplado puede dejarlo sin ejecutar
nodos: no basta con comprobar que existe una ejecución marcada `success`.

- Duplicado idéntico confirmado: `200`, sin repetir el Orquestador. Cambiar el
  orden de las claves JSON conserva la huella; cambiar contenido recibe `409`.
- Reserva todavía en curso o entrega incierta: `202 revision_requerida`.
  Nunca se libera ni redespacha automáticamente, tampoco tras reiniciar n8n.
- Timeout al despertar la routine: `envio_incierto`, sin guardar errores crudos
  del proveedor. La actualización solo afecta un trabajo aún `enviado`; no
  sobrescribe un callback que haya llegado antes. Un callback tardío válido
  puede resolver ese mismo trabajo.
- Caída antes de reservar: el mismo cuerpo puede reintentarse una vez según la
  skill. Caída después de reservar o entre el Orquestador y la confirmación:
  revisar la ejecución y el trabajo. No se promete entrega exactamente una vez
  entre transacciones de dos workflows.

Para conciliar una reserva, el operador examina la ejecución indicada en
`resultado.retorno.ejecucion`, el hijo y los efectos que ya produjo. No debe
reenviar el callback ni cambiarlo a `enviado` a ciegas. Si la tarea llegó a una
aprobación o inició otra producción, se conserva esa continuación. Cualquier
reanudación de trabajo de negocio exige la autorización correspondiente.

La respuesta puede tardar lo que tarde el tramo síncrono del Orquestador,
dentro del timeout del flujo. Una desconexión del cliente no autoriza repetir
el trabajo creativo. Un `200` no acredita aprobaciones, publicación ni que
todos los subflujos posteriores hayan terminado. Los resultados históricos sin
recibo de esta versión no se reclasifican retrospectivamente como confirmados.

## Pruebas y reversa

```bash
node --test tests/flujos_v2.test.cjs
cd cooper
node --test ../tests/retorno_n8n.test.mjs
```

El segundo comando reutiliza `ensayo-infra.mjs`: Podman, n8n 2.47.4, red interna
sin salida, puerto loopback, volumen exclusivo y credencial ficticia generada
en memoria. No lee `.env` reales. Se rechaza un contenedor existente en marcha
o ajeno. Usa el receptor exportado completo, los nodos originales Inicio/Ruta
del Orquestador y un sumidero de eventos sin efectos de producción. La
preparación del sobre ejecuta el Code original; no dispara una routine real.
Solo se sustituye el destino del HTTP por loopback dentro del ensayo.

El ensayo cubre autenticación, propietario persistido, duplicados, ocho
callbacks simultáneos, error de routine, envío incierto, caída del despacho,
reserva conservada tras reinicio, salida vacía, URL antigua y reversa. Para
inyectar la caída antes del despacho se corta temporalmente esa conexión en
la copia del contenedor. Para simular un fallo de invocación se usa una
referencia dinámica inexistente. Las exportaciones entregadas no contienen
esas inyecciones. La reversa restaura la versión del receptor de `de397f3`,
comprueba que los trabajos siguen intactos y deja el webhook despublicado.

La reversa probada es de referencia, no un respaldo del VPS. Antes de aplicar
el delta, el orquestador debe respaldar las versiones, configuración y estados
reales. Ante reversa, mantener el retorno cerrado, restaurar esas versiones y
conciliar los trabajos `retorno_en_curso`/`envio_incierto`; el receptor anterior
no los reconoce. No convertirlos automáticamente ni reactivar otras entradas.

## Reapertura separada

Walter/orquestador deben instalar esta versión del contrato en la routine,
cotejar el destino canónico y su cabecera sin exponerla, integrar el delta con
los cambios concurrentes y ejecutar una aceptación ficticia autorizada en el
destino final. Solo entonces decidir si reabren el retorno y qué trabajos
históricos continúan. M01 no cambia el VPS, no publica workflows vivos, no hace
OAuth ni consume medios.

Fuentes oficiales consultadas: [Webhook y Header Auth](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/),
[respuestas HTTP](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/),
[filas de Data Tables](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.datatable/rows/),
[ejecución de subflujos](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflow/)
y [autenticación/scopes de la API](https://docs.n8n.io/api/authentication/).
Se contrastó también el código distribuido en la imagen oficial 2.47.4 para
`DataTable/actions/row/update.operation.js`, `ExecuteWorkflow` y
`workflow-execute-additional-data.js`. La API de ensayo usa el adaptador
`tools/cooper/n8n-api.mjs` ya existente.
