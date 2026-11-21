# Configurar el worker de Marcas sin leer secretos

El operador puede ejecutar `sudo python3 /opt/cooper/deploy/configurar-marcas-worker.py` durante una ventana exclusiva de mantenimiento. El script solo anexa configuración; no abre el archivo de entorno para lectura, no copia su contenido ni imprime valores. Las rutas predeterminadas corresponden al VPS Cooper.

Antes de generar nada, toma el mismo `operacion.lock` que las copias y el despliegue, exige un entorno regular propio con permisos 0600, comprueba que `CooperMarcasPub1` y `CooperMarcasMet1` existan sin publicación activa y consulta únicamente los conteos de cuentas, piezas e ingestas de Marcas. Si hay alguna fila, se detiene para no cambiar un worker que ya tenga trabajo. No consulta credenciales n8n.

Anexa un secreto nuevo mediante `secrets.token_hex(32)` y fija `COOPER_MARCAS=simulada` y `COOPER_MARCAS_HABILITAR=0`. Deja los dos workflows sin publicar. El despliegue coordinado debe recrear Cooper, n8n y runner para cargar la configuración; este instalador no reinicia servicios.

El recibo `/var/lib/cooper-operacion/marcas-worker-configurado.json` contiene solo nombres, metadatos del archivo y estado. Una segunda ejecución no genera ni anexa nada. El recibo se escribe primero como `preparado`: si ocurre un corte entre la escritura y su confirmación, el script se detiene sin regenerar. No borrar ese marcador para forzar un reintento. El operador debe resolver la interrupción usando metadatos y una ventana exclusiva; la recuperación automática no puede determinar si la escritura alcanzó el disco sin leer el entorno. Un cambio de inode o truncado también bloquea el reintento.

La configuración técnica no activa publicación real ni resuelve los activos y permisos de los proveedores. La aceptación usa datos ficticios, HMAC y medios sintéticos. Sus pruebas incluyen escritura sin lectura, idempotencia, bloqueo por trabajos, lock ocupado, permisos/enlace y corte después de `fsync`.

Documentación oficial: [generación criptográfica en Python](https://docs.python.org/3/library/secrets.html) y [candado flock](https://docs.python.org/3/library/fcntl.html#fcntl.flock).
