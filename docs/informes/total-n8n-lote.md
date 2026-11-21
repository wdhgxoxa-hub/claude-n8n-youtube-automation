# Cooper total — lote n8n real

21-11-2026, Lima. Orquestador `cooper-total`, VPS autorizado. No se usaron D&S Factory, OAuth, pagos ni publicación de videos. Los exports y copias de bases permanecen privados; no se leyó ningún valor de credencial ni archivo `.env`.

## Aplicado y comprobado

El lote FINAL3 importó **32 flujos**, añadió **cinco columnas** mediante el servicio oficial de Data Tables de n8n 2.47.4 y publicó **25 flujos en orden de dependencias**. La base pasó de 36 a 38 workflows: los ajenos al lote se conservaron. Las nueve tablas de negocio conservaron **118 filas y su hash**; las columnas fueron idempotentes. Los siete contenedores volvieron saludables. [Recibo real](evidencias/total-n8n-lote/aplicacion-final3.json).

Entrada exacta SHA-256 `955344e94ab52eb91eeb8d8281b7bdae53008d1687d1a8074b23263a1cad758c`. Snapshot previo `261abf14c0d9e0591836ef74bbf242a34f7c6e13aebdcfe783826db1a1763cb7`. El export previo, diff, plan y scripts usados están bajo `/var/lib/cooper-operacion/total-lote-final3*`, con permisos privados. Se preservaron IDs reales de workflows/nodos, referencias de credenciales y tablas, y ajustes efectivos; solo se sustituyó el origen ngrok por el dominio estable.

La importación y publicación exactas se ensayaron primero sobre copia aislada: 25/25 versiones publicadas, datos ajenos conservados y restauración exacta de las 187 tablas previas. El aplicador compara hashes del lote y manifiesto, y el orden de publicación, con ese [recibo de ensayo](evidencias/total-n8n-lote/ensayo-final3.json).

## Reversa real, no solo una receta

El intento anterior importó el lote pero n8n rechazó publicar Avatar porque faltaba su credencial. El aplicador detuvo escritores, conservó la base fallida, restauró el snapshot anterior y recuperó los servicios: [FALLO_REVERTIDO / PASS](evidencias/total-n8n-lote/reversa-real.json). No se ocultó ese intento ni se presentó la importación parcial como éxito.

Cuatro pasos de HeyGen/ElevenLabs sin credencial quedaron convertidos **solo en el lote de destino** en errores explícitos de configuración. No simulan un resultado correcto ni invocan otro proveedor. La fuente canónica conserva los nodos reales para preparar un lote posterior cuando se configure el acceso. Los 22 flujos previamente publicados se preservan; tres dependencias antes pausadas se publican solo como subflujos invocables.

## Entradas y límites de esta aplicación

- YouTube, Radar y Confirmar se publicaron como dependencias; callback/horarios continúan deshabilitados en FINAL3. No se inició OAuth ni se abrió una rutina con gasto.
- Aprendizaje y Vigilante siguen pendientes de aceptación/activación coordinada en este corte. Aprendizaje tendrá su evidencia propia; este recibo no prueba métricas ni lecciones.
- Rutina, Retorno de Claude, Chat de la fábrica y entradas heredadas no se reabrieron. Las dos esperas históricas se conservaron.
- El delta posterior de agregación por Lima y `retorno_url` explícita aún debe aplicarse; no afecta a la fuente de M7 ya instalada. El dominio efectivo sí quedó corregido en FINAL3.

## Commits y pruebas

`6059544` plan y guardas explícitas; `52884dc` publicación ordenada en ensayo; `6127ea1` Vigilante sin errores crudos ni URL no confiable; `90fd6a2` contexto publicado y retención; `6bdbc2a` horario Radar pausado; scripts y certificados integrados en `cooper-total`. La puerta integrada posterior pasó **322 unitarias, 49 E2E, 167 pruebas de flujos**, lint, tipos y build; **70 pruebas Python** del despliegue. [Logs y hashes de la puerta](evidencias/cooper-total/puerta/resumen.json).

## Pendientes de Walter

Configurar las credenciales faltantes solo si desea esos proveedores; no se compró acceso. Revisar trabajos históricos y producción con gasto antes de reanudar sus entradas. Aceptar las cuentas/OAuth y la configuración externa de la rutina cuando corresponda. Las lecturas/alertas seguras y la aceptación técnica continúan bajo el orquestador.
