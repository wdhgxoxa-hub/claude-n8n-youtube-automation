# Integración 3: instalación local y reversa

Alcance autorizado por Walter: integrar las cinco ramas, hacer fast-forward de `version-chatgpt` y `main`, push al remoto propio `mio`, y actualizar únicamente Cooper en la PC. `origin` es el repositorio original de terceros y no recibe cambios. No realizar OAuth, pagos, nuevas publicaciones ni escrituras en n8n o D&S Factory.

## PC

El cierre concurrente del VPS (`1883fb3`) dejó Cooper y n8n de la PC detenidos. Esta misión vuelve a iniciar únicamente la web local solicitada por Walter; conserva deshabilitado su arranque automático y no reactiva n8n. La base local conserva el corte de la PC y no incorpora escrituras posteriores del VPS. No usar esta instalación como reversa del VPS ni alternar producción sin conciliar los datos. La integración 3 no actualiza el servidor remoto.

1. Conservar el commit anterior de `~/.local/share/cooper/app`, comprobar su árbol limpio y verificar que la unidad instalada corresponde al modelo versionado. Mantener intacto el archivo de entorno; no leerlo, imprimirlo ni copiarlo.
2. Respaldar SQLite con la API de copia consistente. Guardar fuera de Git, con directorio 0700 y archivos 0600. Comprobar integridad, claves foráneas y número de migraciones. Ensayar primero las once migraciones y su repetición sobre una copia; comparar los conteos de todas las tablas anteriores.
3. Detener solo `cooper.service`, tomar un respaldo final y cambiar el checkout fijo al commit validado. Ejecutar `npm ci` y `npm run build`, sin cargar manualmente secretos. Instalar el modelo `deploy/systemd/cooper.service`, verificarlo y recargar el gestor del usuario.
4. La unidad aplica `db:migrate` en `ExecStartPre` con la ruta persistente explícita; después inicia el servidor loopback en 3000. Conserva el archivo de entorno existente, chat automático con API de respaldo apagada y Marcas en modo simulado.
5. Comprobar servicio activo, `/entrar` con HTTP 200, rutas privadas sin sesión protegidas y rechazo de APIs anónimas. Validar nuevamente integridad, claves foráneas y once entradas en el diario. El acceso real de Walter por Google queda como comprobación manual; no se crean sesiones de prueba en producción.

## Reversa local

Antes de revertir, preservar un nuevo respaldo de la base actual y cualquier actividad posterior. Detener solo Cooper, volver al commit y unidad anteriores y restaurar la copia consistente compatible con ese binario. Si hubo actividad legítima nueva, conciliarla antes de restaurar; no perder recibos, mensajes ni publicaciones aceptadas. No ejecutar un binario de ocho migraciones sobre el diario de once ni alterar sus hashes. Eliminar los archivos WAL/SHM únicamente como parte de una restauración offline controlada, después de archivar el estado actual. Reiniciar y repetir las comprobaciones de salud y permisos.

Si la reversa busca recuperar exactamente el estado previo a esta misión, Cooper local debe quedar detenido y deshabilitado, como lo dejó el corte al VPS; no arrancar los contenedores locales de n8n.

## Lote n8n para Claude

Generar con `python3 tools/cooper/preparar_lote_cobertura.py --salida <carpeta-nueva>` tras confirmar el código. Verificar todos los SHA-256 del manifiesto. Incluye 32 exportaciones inactivas, contratos, migraciones y reversa versionada; `respaldo_real: false` es deliberado. El respaldo real de n8n debe tomarlo Claude en el destino antes de instalar: esta misión no accede a su base ni modifica su servicio. Seguir [respaldo, instalación y reversa del lote integrado](cooper-cobertura-despliegue.md).

Mientras no se instale el lote, Operación puede mostrar indisponibilidad y los nuevos historiales no reciben datos del puente antiguo. La memoria y las funciones locales sí están instaladas; no se confunde disponibilidad de pantallas con activación de proveedores externos.

Fuentes oficiales consultadas: [SQLite Online Backup](https://www.sqlite.org/backup.html), [systemd.service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html), [grabaciones Playwright](https://playwright.dev/docs/videos). Las migraciones reutilizan el ejecutor existente de Cooper y su comprobación de hashes.
