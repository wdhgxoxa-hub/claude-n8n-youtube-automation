# Lote de cobertura para Claude — sin despliegue ejecutado

Este lote contiene exportaciones inactivas, migraciones y huellas SHA-256. `entrada/` procede del commit indicado en `manifest.json`; `reversa-versionada/` procede de `16341ab`. **La reversa versionada es una referencia de código, no un respaldo del destino.** No contiene secretos, archivos de entorno ni datos reales.

Preparación local, desde la raíz y después de los commits:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 tools/cooper/preparar_lote_cobertura.py
```

El destino predeterminado es `cooper/.cache/lote-cobertura`. Se rechaza sobrescribir una carpeta existente. El script no usa red, n8n ni variables de credenciales. El lote se debe verificar contra `manifest.json` antes de importarlo.

## Respaldo exigido antes de instalar

1. Revisar el destino y la autorización del lote. La excepción de `cooper-integracion3` autoriza integrar y desplegar Cooper en la PC; los cambios de n8n siguen reservados a Claude, sin ejecución en vivo durante esa misión. No activar servicios con gasto ni intervenir D&S Factory.
2. En una ventana sin trabajos en vuelo, detener nuevas órdenes y disparadores programados. Registrar IDs, versiones publicadas y estado activo de los flujos v2 del destino. La entrada integrada contiene **32 flujos**: los 30 de cobertura y dos trabajadores de Marcas. Exportar los workflows y las nueve Data Tables con las herramientas existentes de copia. No imprimir credenciales, tokens ni archivos de entorno. Conservar las copias protegidas fuera de Git y del directorio público.
3. Respaldar la base SQLite de Cooper mediante su mecanismo de copia consistente; conservar los binarios y el diario de migraciones del mismo instante. Registrar huellas de los respaldos. La copia debe permitir restaurar la base anterior, incluidos los recibos de órdenes. No sustituir una base activa por una copia tomada a mitad de una transacción.
4. Preservar el nodo base **Ajustes** del destino y todas las referencias existentes de credenciales, tablas y subflujos. Las exportaciones tienen valores de instalación de referencia e interruptores apagados; **no deben reemplazar la configuración efectiva del operador**. Los cambios nuevos de la web se guardan como eventos `ajustes_cooper` y se superponen solo a los campos permitidos.

## Instalación revisable

1. Aplicar primero `contratos/cooper-migracion-tablas.json` mediante `tools/migrar_dueno.mjs`, empezando por `--simular` y conservando su diario para reversa. No borrar columnas ni filas. Cobertura usa las tablas existentes; incorpora las columnas aditivas de pulido cuando aún falten.
2. Importar las exportaciones v2 con el mapa de IDs del destino. No importar los cuatro borradores de `workflows/` como una segunda fábrica. Revisar las conexiones del grafo y comparar hashes antes de publicar.
3. Publicar primero Ajustes y subflujos auxiliares, luego el puente y el Orquestador. Los disparadores Radar/Rutina/Aprendizaje/Confirmar se reactivan al final, conservando sus horarios anteriores. Los nodos Code nuevos requieren el mismo permiso `crypto` que el puente existente. Las esperas nativas deben pertenecer al origen `baseUrl` de esa instalación.
4. Actualizar Cooper y ejecutar sus migraciones. La combinación conserva `0008_observabilidad`, `0009_memoria` y `0010_marcas`; no renumerar ni reescribir un diario aplicado. Una base experimental de Marcas con `0008_marcas` no es compatible con esta secuencia: requiere migración específica, no manipular hashes. Cambiar de binario solo cuando la base esté compatible y la salud sea correcta.
5. Comprobar con cuentas ficticias: lectura por dueño, rechazo de un canal ajeno, revisión obsoleta de ajustes, edición de biblia/listas/referencias, decisiones web y nativas, formulario consumido una sola vez, estados de publicación sin subir otra vez, incidente global exclusivo de admin y recibos de avisos. El ensayo reproducible es `cd cooper && npm run test:ensayo`, que levanta **otra instancia aislada** y no valida por sí solo el destino instalado.
6. Verificar en el destino únicamente lecturas autorizadas y conexión del puente. Una autorización OAuth, pago, nuevo render o nueva publicación real requiere la intervención correspondiente de Walter; no forman parte de este lote. Reactivar entrada y cron tras comprobar resultados.
7. `CooperMarcasPub1` y `CooperMarcasMet1` son nuevos respecto de la referencia. Mantenerlos inactivos y `COOPER_MARCAS_HABILITAR` apagado hasta contar con la configuración y autorización de Walter descritas en [Marcas](cooper-marcas.md). El servicio local de esta integración fija `COOPER_MARCAS=simulada`; no conectar trabajadores reales a ese modo. La configuración de secretos se realiza por el mecanismo seguro existente, sin trasladar valores al lote.

## Reversa

1. Detener nuevas órdenes y cron. Esperar o registrar trabajos en vuelo; no volver a ejecutar subidas ni decisiones cuya recepción sea incierta. Una publicación ya aceptada por una red no se deshace restaurando código.
2. Restaurar **las versiones exportadas del destino** y sus estados activos, no los JSON de referencia si el destino tenía cambios propios. Restablecer el nodo Ajustes y las mismas referencias sin copiar valores a informes.
3. Restaurar el binario y la copia consistente de SQLite del mismo instante. El binario antiguo puede rechazar un diario que ya incluya memoria/observabilidad. Aplicar la reversa de la migración de tablas solo con su diario y tras contrastar que las filas no cambiaron; si hay cambios posteriores, conservarlos y reconciliarlos antes de restaurar.
4. Conservar los eventos nuevos para conciliación. Los parches `ajustes_cooper` dejan de tener efecto cuando vuelve el flujo Ajustes anterior; no borrar ese historial para ocultar lo ocurrido. Comprobar salud, aislamiento y recibos antes de reabrir entrada y cron.
5. Desactivar los dos trabajadores de Marcas si se instalaron con este lote. No tienen equivalente en la reversa versionada. Conservar ejecuciones y recibos para conciliación; no borrar flujos preexistentes del destino que casualmente compartan esos IDs.

## Documentación contrastada

- [Data Table de n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.datatable/rows/).
- [Wait y formularios de n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/); contrato multipart contrastado además con el código oficial y ejecutado en n8n 2.47.4 aislado.
- [Estado asíncrono de Upload-Post](https://docs.upload-post.com/api/upload-status/).
- [Bot API de Telegram](https://core.telegram.org/bots/api): un mensaje aceptado no demuestra lectura.
- [OAuth de Google para aplicaciones web](https://developers.google.com/identity/protocols/oauth2/web-server): Cooper prepara el enlace; el propietario decide en Google. No se hicieron logins durante esta misión.
