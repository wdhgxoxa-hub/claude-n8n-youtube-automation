# Horario Radar: extra separado del lote certificado

21-11-2026, Lima. Este procedimiento corresponde a la autorización de `total-cierre`: activar Radar donde existen credenciales. Cambia exclusivamente `disabled: true → false` de `Cada mañana (radar)` en `FabRadar00000001`. Conserva las 07:40 y `America/Lima`, el resto del contenido, credenciales, entradas y dependencias. La importación pasa temporalmente por inactivo y republica solo Radar mediante la CLI oficial; las versiones administrativas avanzan.

El extra `deploy/horario-radar.py` se instala fuera del bundle de 25 archivos. Recibe `--codigo` con el directorio `deploy` certificado y `--deploy` con la configuración Compose viva. No modifica el bundle, el generador, workflows versionados, la imagen b3 ni el entorno del VPS. Usa `Operator` y `aplicar-n8n-total.py` sin cambios, con un adaptador explícito que sustituye únicamente la política de conservación por la comprobación del cambio mínimo autorizado. El aplicador conserva respaldo restaurado, bloqueo, doble CAS, importación/publicación, inventario y reversa automática.

## Orden y preparación

1. Terminar el lote n8n certificado. Preparar este extra sobre una copia SQLite consistente posterior; nunca reutilizar versiones anteriores al lote. Marcas se activa después de Radar, con otro CAS. Un solo operador controla la secuencia.
2. En la copia privada, exportar todos los workflows con la CLI oficial `n8n export:workflow --all --output=...`; usar la imagen fijada en `infra-imagenes.json`, red `none`, una clave ficticia de laboratorio y salida privada. Nunca exportar credenciales ni abrir el entorno real. El arnés `deploy/tests/horario-radar-offline.py` contiene la invocación reproducible usando `ensayar-n8n.py.run_container`.
3. Comparar los siete hashes de contenido de [fuentes.json](informes/evidencias/total-cierre-radar/fuentes.json) con el corte posterior al lote. Las versiones CAS nuevas son esperables; cambios de nodos/conexiones/settings requieren revisión concreta. El permiso `allowTextoApi=false`, cero overrides administrativos true, seis dependencias publicadas, referencias de credencial y correspondencia borrador/publicación se verifican sin mostrar valores.
4. Preparar y ensayar el paquete nuevo en la PC. Las rutas siguientes son variables locales de operación, sin secretos:

```bash
python3 -B /ruta/extra/horario-radar.py --codigo /ruta/bundle/deploy preparar \
  --base /ruta/privada/database.sqlite --export /ruta/privada/export.json \
  --salida /ruta/privada/radar-activar
COOPER_ENSAYO_CPUSET=8-15 python3 -B /ruta/extra/horario-radar.py --codigo /ruta/bundle/deploy ensayar \
  --base /ruta/privada/database.sqlite --lote /ruta/privada/radar-activar \
  --salida /ruta/privada/radar-ensayo
```

El ensayo hace importación/publicación reales en n8n sin red, ninguna ejecución de workflows y reversa byte a byte. El recibo fija hashes de entrada, diff, helper extra, diez helpers certificados, migrador y contrato de esquema. Trasladar opacamente el paquete y el recibo ensayados a directorios privados nuevos del VPS y cotejar los hashes. No publicar sus exports.

## Aplicación y control

Después de la señal del integrador, ejecutar como operador autorizado mediante su mecanismo habitual de privilegios:

```bash
python3 -B /ruta/extra/horario-radar.py --codigo /ruta/bundle/deploy aplicar \
  --deploy /ruta/deploy-vivo --lote /ruta/privada/radar-activar \
  --ensayo /ruta/privada/radar-ensayo/resultado.json \
  --salida /ruta/privada/radar-aplicado.json
```

`Operator` consume el entorno existente de forma opaca. No se imprime ni reemplaza; se conservan las credenciales Google corregidas. El CAS de los siete workflows y el permiso de texto se comprueban antes del respaldo y después de detener escritores. Si cambió algo, se rechaza antes del import. Se acredita que ningún workflow ajeno ni tabla de negocio cambia, y se levanta la pila con el procedimiento certificado. El recibo debe terminar `PASS`, `disabled_despues=false` y `salud_stack=PASS`.

No ejecutar Radar manualmente como parte de esta activación. La publicación demuestra la configuración del scheduler; el primer disparo natural de las 07:40 se observa por separado. El grafo certificado conserva el freno de API de texto, no crea videos ni publica contenido. La integración de vidIQ conserva sus guardas de cuota renovable y no compra créditos. Este extra no modifica ninguna de esas políticas.

Como aceptación inmediata de solo lectura, comprobar en n8n 2.47.6 que `workflow_publication_trigger_status` registra el ID de Radar y el ID del horario con `status=activated`, versión igual a la publicada y `errorMessage` vacío. Consultar únicamente ID, versión, estado y el booleano de error; no imprimir mensajes. Esta observación del servicio vivo complementa el ensayo CLI, que no inicia un scheduler.

## Reversa

Orden inverso: Marcas → Radar → lote n8n → infraestructura → Cooper. Para revertir Radar después de PASS, obtener nueva copia consistente y nuevo export oficial, y preparar con `--reversa-de /ruta/privada/radar-aplicado.json`. El recibo exige el mismo resto de contenido y cambia solo `disabled: false → true`. Ensayar y aplicar ese paquete nuevo mediante los mismos comandos. Conserva escrituras de negocio posteriores y obtiene versiones administrativas nuevas. Si el contenido o staticData cambió, se detiene para revisar; no sobrescribirlo ni reutilizar el CAS anterior.

Si falla la aplicación durante el corte, el aplicador certificado restaura el respaldo opaco, conserva la base fallida fuera del árbol activo y escribe `FALLO_REVERTIDO`. El arnés local prueba tanto esta restauración byte a byte como la reversa lógica después de un PASS.

La documentación oficial consultada el 21-11-2026 confirma export por archivo, import, publicación individual por ID y necesidad de que la instancia aplique la publicación al arrancar: [Server CLI de n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md). No se emplea `update:workflow` obsoleto, `--all` para activar, endpoints inventados ni exportación de credenciales.
