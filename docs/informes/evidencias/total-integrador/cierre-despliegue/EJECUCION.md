# Cooper e infraestructura desplegados

21-11-2026, Lima. Ejecución exclusiva coordinada después de las dos rondas 123/123 y la publicación FF atómica comunicada por el integrador a las 18:19:59 (`fc0e98a3bdc00b4b8665a7252556ec58ed54ada8`). El runtime desplegado es el artefacto b3 previamente aceptado; no se construyó otra imagen.

## Resultado de esta fase

- [Precondición fresca](precondicion-fresca.json), 18:20:27: siete servicios saludables, imágenes anteriores coherentes con release, b3 precargada, 45 workflows/29 activos, cero ejecuciones ocupadas y sin mantenimiento.
- Marcas: extra independiente e96eacf/SHA `e09f2366…` configurado con proveedor `simulada` e interruptor `1`; tres conteos previos en cero, ningún worker publicado por el instalador. Anexo por escritura exclusiva al final del archivo, sin lectura ni sustitución del entorno.
- Aplicación: migración **11→14**, tablas previas preservadas, arranque de la reversa aislada PASS, los cinco servicios ajenos intactos durante el corte limitado. Recibo `/var/lib/cooper-operacion/solo-cooper-20261121T232058Z/resultado.json`, SHA `27f72ca1e7618acee8246659cb6cdaa8f6d4dd15a8fdf9498c8dc8ff9b104dea`.
- Respaldo completo de aplicación **SELLADO antes de infraestructura**. Sello privado `/var/lib/cooper-operacion/total-integrador-app-b3/sello.json`, SHA `13f565da3ab1ff22570fa0f744f895ecf4cdad5e36b3745d2f49bff39a05bbf3`. No se publicó su manifiesto con nombres de archivos privados.
- Infraestructura: PASS a las **18:27:18**. Snapshot previo `3eb172db32c477bdbed7d0ca1de004037c6daabb7911370fcec93ff9d4514210`; migraciones n8n **342→342**, datos preservados. Recibo `/var/lib/cooper-operacion/total-integrador-infra-resultado.json`, SHA `e17f0e1349eb786047ef7b2552f65517d1edb7134097b3e9b3a72bffca5fff28`.
- Los siete servicios terminaron saludables y sin mantenimiento. Cooper y los tres relés usan b3; n8n y runner **2.47.6**, Caddy **2.11.8**, todos los servicios de infraestructura fijados por digest. [Identidades y recibo saneado](infra-recibo-publico.json).
- El entorno conservó inode durante el anexo y exactamente sus metadatos de tamaño/mtime/inode después de él, a través de aplicación e infraestructura. No se leyó, imprimió ni copió su contenido; los adaptadores certificados consumieron la configuración existente internamente.
- [Sonda HTTPS](sonda-publica-post-infra.json), 18:28: salud/entrada 200, estado/operación anónimos 401, proveedor Google OIDC y callback canónico presentes. No se inició OAuth ni se creó una sesión.

[Resumen público de ejecución](app-infra-ejecucion.json). El orquestador local, que solo encadena los helpers revisados, permanece en el worktree propio `total-cierre-despliegue`, `.cache/total-cierre/ejecutar-app-infra.py`, SHA `1a7bef7306b92ea5dbd287beaaaf45f77fa06696d41e64d802f46521f893176d`. Sus stdout/stderr completos son privados en el directorio operativo de aplicación; no se copiaron al repositorio.

## Límites y continuidad

El integrador liberó esta fase para lote n8n → Radar → Marcas. Copia final, réplica del mismo snapshot, restauración completa, reinicio y Playwright público final esperan esa fase y una nueva señal de coordinación. No se presenta la sonda pública como recorrido privado de Google.

Los límites observados son los del Compose certificado: Cooper tiene 1 GiB de RAM y Docker declara 2 GiB para RAM+swap. El endurecimiento swap0 de b3 corresponde al laboratorio; no se afirma que el cgroup productivo tenga `memory.swap.max=0`. La ausencia de swap del host ya fue documentada en la misión de memoria.

El instalador Marcas no dispone de reversa automática del anexo; los nombres simulados se conservan si se revierten servicios. Los extras posteriores de activación poseen su propia aceptación y reversa. La recuperación global usa esos recibos en orden inverso, luego n8n → infraestructura → aplicación sellada; nunca el rollback global antiguo para la fase `solo-cooper`.
