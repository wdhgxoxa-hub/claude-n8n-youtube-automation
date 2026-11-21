# cooper-total — cierre operativo y aceptación final

Corte: **21-11-2026, 13:17 Lima**. Rama propia `total-cierre-aceptacion`; el orquestador integra los commits. Este frente no hizo push ni merge. La aceptación de imagen e infraestructura continúa; los cambios n8n descritos a continuación sí están desplegados.

## Resultado real en el VPS

Aplicados tres lotes acotados, cada uno con entrada y plan ligados por SHA-256 a un ensayo real aislado de importación, publicación y reversa. Cada aplicación tomó una copia fría nueva bajo el candado operativo y terminó con siete servicios saludables. No se ejecutó producción de medios ni se publicaron videos.

| Lote | Entrada SHA-256 | Snapshot previo | Resultado |
| --- | --- | --- | --- |
| Ajustes: `allowTextoApi=false` | `a9d048d80885f9c19979d85e909ed1276db0777a3c6b50f561614336157f3032` | `5103c42809ae241278ffaa5b4c80027337635037aef185a4712772b152cf3b55` | Un booleano de contenido alterado; 44→44 workflows. |
| Delta final, fuente `fcfab3b` | `ca98d37aff4964d0cb6b8a5fbf53dfd50cb217ea795618fab58e65742431f849` | `153ee6a0d35a8e542615c25e2f0e69f3aed3abbf3de06bf70198aaa391cabe80` | Seis importados, cinco publicados; 44→45 por el nuevo subflujo interno YouTube. |
| Tres entradas seguras | `d49f4dda3164496fbe7e05d129291e363cc630aee66a38864f69dcd603000a7f` | `90e7f08e200b6e2d68a0b9e0612642ff61add995c4bee41e90fde8a575181394` | M7, Vigilante y Confirmar publicados; 45→45. |

Los tres lotes conservaron las nueve tablas de negocio y sus **126 filas**, con hash común `712cd03ff0910c13b8c390d558df70f91a32b12d6b1378f600d4b402eeaee7b0`; cero columnas añadidas. Se compararon workflows ajenos y versiones activas, y se comprobó la integridad del clon restaurado. El aumento de 44 a 45 es un workflow de consulta interna, no una publicación social ni un nuevo video. [Ajuste real](evidencias/total-cierre-aceptacion/ajuste-vps.json), [delta real](evidencias/total-cierre-aceptacion/delta-vps.json), [activaciones reales](evidencias/total-cierre-aceptacion/activaciones-vps.json).

El permiso de texto de pago apareció activado en el export real. El preparador opaco cambia exclusivamente ese literal, prueba que el resto del contenido es idéntico y rechaza una anulación administrativa que vuelva a activarlo. Se verificó `false` antes y después de las activaciones. No se extrajo ningún otro valor de Ajustes.

El delta actualiza Llamar a Claude, Retorno, API de Cooper, Orquestador y Radar, y añade `FabCompYouTube01`. Retorno permanece inactivo. El hijo YouTube solo tiene disparador interno; Radar se publica con su horario deshabilitado. El relevo a competencia se hizo después de comprobar versiones y salud; sus sondas reales se documentan en su informe.

## Matriz de las diez entradas históricamente pausadas

Lista obtenida del diario real `disparadores-pausados.json`, no inferida de todos los workflows actuales. «Publicado» significa activo y versión publicada igual a la versión vigente. Un nodo habilitado dentro de un workflow inactivo no abre su entrada.

| ID / entrada histórica | Publicado | Disparador externo habilitado | Decisión y motivo |
| --- | --- | --- | --- |
| `jylyhP7MsjovYWUC` · Telegram antiguo | No | Sí, pero workflow inactivo | Sigue cerrado: entrada heredada de producción, fuera del circuito actual de aprobación. |
| `CmfUbbCPbVCfFzY3` · Revisión de guion antigua | No | Sí, pero workflow inactivo | Sigue cerrada: webhook heredado; no se reanudan revisiones históricas por inferencia. |
| `FabAprendizaje01` · M7 | **Sí** | **Sí**, cada hora | **Reabierta**: consulta métricas existentes y usa el plan PC; texto de pago bloqueado, deduplicación y ventanas 24h/72h/7d probadas. El nombre del nodo «Cada día» no describe su regla horaria actual. |
| `FabRetornoClaud1` · Retorno de Claude | No | Sí, pero workflow inactivo | Sigue cerrado: no se abre un retorno externo sin asociación validada con una rutina real. |
| `FabYouTube000001` · Vuelta de Google | Sí, como dependencia interna | **No**, callback deshabilitado | Uso interno conservado; el login OAuth requiere a Walter. |
| `FabErrores000001` · Vigilante | **Sí** | **Sí**, error trigger | **Reabierta**: mensaje saneado, sin error crudo ni URL privada; retención de ejecución desactivada. |
| `FabRutina0000001` · Rutina diaria | No | Sí, pero workflow inactivo | Sigue cerrada: puede iniciar nueva producción; requiere decidir rutina y aceptación humana. |
| `FabChatWeb000001` · Chat antiguo | No | Sí, pero workflow inactivo | Sigue cerrado: entrada antigua de n8n; el chat autorizado vive en Cooper y su túnel. |
| `FabConfirmar0001` · Confirmar | **Sí** | **Sí**, cada hora, minuto 7 | **Reabierta**: solo GET de estado de publicaciones existentes; no envía ni crea videos. Sanitización probada en n8n real. |
| `FabRadar00000001` · Horario del radar | Sí, como dependencia interna | **No**, horario deshabilitado | Sigue cerrado: radar bajo demanda antes de ideas; la cadencia autónoma no se abre durante la aceptación. |

[Proyección real de IDs, versiones, disparadores y hashes de código público](evidencias/total-cierre-aceptacion/estado-publicado.json). Las tres entradas reabiertas equivalen a dos workflows antes inactivos más un horario antes deshabilitado; no son tres workflows nuevos.

## Corrección de privacidad en Confirmar y Vigilante

Se detectó que Confirmar persistía `error_message` del proveedor y que Telegram podía incluir ese texto o una URL arbitraria. Ahora guarda categorías cerradas y plataformas conocidas; conserva únicamente URLs públicas reconstruidas a partir de host y ruta permitidos. Descarta queries, fragmentos, credenciales en URL y enlaces no reconocidos. En YouTube solo conserva un ID válido. Telegram contiene identificador propio, estado y plataforma, sin URL ni error original.

Confirmar y Vigilante tienen `saveDataSuccessExecution=none`, `saveDataErrorExecution=none`, `saveManualExecutions=false` y `saveExecutionProgress=false`. Así tampoco quedan respuestas intermedias privadas en la retención de ejecución. El resumen de estado conserva trazabilidad útil.

La regresión usa un secreto ficticio, respuesta 401 y URL con query sensible. Además del test de código, el arnés ejecutó los nodos canónicos de Confirmar en **n8n 2.47.4 y 2.47.6 reales**, con red deshabilitada, clave ficticia y sin llamadas al proveedor. Ambos devolvieron PASS, preservando los 44 workflows y nueve tablas originales de ese clon. [Motor anterior](evidencias/total-cierre-aceptacion/confirmacion-2474.json), [motor candidato](evidencias/total-cierre-aceptacion/confirmacion-2476.json).

## Copia externa y ensayos

Copia fría fresca `6ae420fdc5c7e3845d10bc6c516e15ae2d5e0546b8790b4bb5c79047ed1a50df`, restaurada en el VPS y en la PC: **25 archivos y dos bases**. Cooper tenía once migraciones; n8n, 44 workflows y 342 migraciones. [Corte real](evidencias/total-cierre-aceptacion/copia-fresca.json), [réplica](evidencias/total-cierre-aceptacion/replica-fresca.json). Este corte precede a los tres lotes; los snapshots por lote de la tabla anterior son posteriores.

- Motor candidato 2.47.6 → reversa 2.47.4: PASS, sin red ni disparadores arrancados; 342→342 migraciones, nueve tablas/126 filas y 44 workflows conservados. [Recibo](evidencias/total-cierre-aceptacion/motor-fresco.json).
- Ajuste: importación/publicación y reversa exacta en ambos motores. [2.47.4](evidencias/total-cierre-aceptacion/ajuste-2474.json), [2.47.6](evidencias/total-cierre-aceptacion/ajuste-2476.json).
- Delta definitivo: importación6/publicación5 y reversa exacta en 2.47.4; versión, orden y hash del plan certificados. [Recibo](evidencias/total-cierre-aceptacion/delta-2474.json).
- Activación: tres publicaciones y reversa exacta en 2.47.4 sobre el clon con 45 workflows; en 2.47.6 se probó sobre el corte previo de 44. [2.47.4](evidencias/total-cierre-aceptacion/activaciones-2474.json), [2.47.6](evidencias/total-cierre-aceptacion/activaciones-2476.json).
- **104 pruebas Python de despliegue**, `-W error`, pasan sin advertencias; se cerraron explícitamente las conexiones SQLite de los tests. **173 regresiones de flujos** pasan en la rama de esta corrección. No sustituye la puerta integrada del orquestador, que incluye los otros frentes.

Los recibos de publicación verifican restauración exacta de bytes, inventario y versiones; no se provocó una caída real del VPS en los tres lotes exitosos. La reversa automática real del aplicador se ensayó previamente mediante fallo inyectado y se conserva en los informes anteriores.

La imagen `fcfab3b` y el aplicador conjunto de infraestructura pasaron su aceptación aislada en CPUs 0–7 y con cuota de 0,5 CPU por contenedor. **Esta imagen queda intermedia:** una corrección posterior necesaria del simulador de voz exige otra imagen y su aceptación. No está desplegada por este frente. El Caddy real conserva el hash `17515ce1927fa921b8f3f7242c2e3cfe024b24b99b8b6e9874e9d1e1f442153c`.

## Aceptación intermedia `fcfab3b` — 13:17 Lima

- Migración real **11→13**, integridad/claves foráneas y conservación de las 27 tablas anteriores; restauración exacta y arranque con la imagen anterior descargada directamente del VPS. [Recibo](evidencias/total-cierre-aceptacion/imagen-intermedia-fcfab3b/migracion.json).
- **Ocho bloques Compose PASS**, incluyendo medios sintéticos Marcas, HTTPS, sesión ficticia, runner 2.47.6, firma/SSE, reconexiones, restic, importación y reversa conjunta. [Registro](evidencias/total-cierre-aceptacion/imagen-intermedia-fcfab3b/compose.log).
- Aplicador exacto SHA-256 `9273e7d6e60114948ec7413dfbe92bbf2311cbbe1ff0879fb5d4706e8c5738cd`: fallo deliberado después del arranque nuevo → **FALLO_REVERTIDO/PASS**, archivos públicos y datos restaurados, imágenes anteriores saludables y marcador retirado; segunda actualización → **PASS**. [Reversa](evidencias/total-cierre-aceptacion/imagen-intermedia-fcfab3b/infra-reversa.json), [actualización](evidencias/total-cierre-aceptacion/imagen-intermedia-fcfab3b/infra-actualizacion.json), [resumen](evidencias/total-cierre-aceptacion/imagen-intermedia-fcfab3b/infra-aplicador.json).
- Artefacto subido al área operativa del VPS, SHA-256 remoto igual al local. **No cargado ni activado**; se conserva como intermedio. [Transporte](evidencias/total-cierre-aceptacion/imagen-intermedia-fcfab3b/transporte.json).

Se corrigió una hipótesis inicial: los IDs distintos de la imagen anterior no correspondían a reconstrucciones diferentes. El archivo `docker save` verificado enlaza índice → manifiesto `84b577…` → configuración `f43ff6…`; Docker/containerd y Podman muestran identidades diferentes del mismo contenido. [Prueba del enlace](evidencias/total-cierre-aceptacion/imagen-intermedia-fcfab3b/identidad-retroceso.json).

El aplicador ahora verifica SHA del archivo, etiqueta exacta, configuración ensayada y correspondencia con el contenedor. Si el runtime identifica por manifiesto, verifica además el hash de ese manifiesto y su enlace a la configuración. Nunca acepta únicamente una etiqueta ni interpreta el entorno de la imagen. El primer intento rechazó correctamente un alias temporal del fixture antes del corte; se corrigió el arnés comprobando ambos IDs antes de fijar su etiqueta de ensayo. **111 pruebas Python PASS**, sin advertencias. [Registro](evidencias/total-cierre-aceptacion/imagen-intermedia-fcfab3b/python111.log).

Contrato contrastado con documentación oficial de [Docker/containerd](https://docs.docker.com/engine/storage/containerd/), [Docker inspect](https://docs.docker.com/reference/cli/docker/image/inspect/), [Podman inspect](https://docs.podman.io/en/latest/markdown/podman-image-inspect.1.html) y [manifiesto OCI](https://specs.opencontainers.org/image-spec/manifest/). La aceptación intermedia no acredita la futura imagen ni sustituye las rondas de interfaz del orquestador.

## Commits de esta continuación

- `0696e03`: delta acotado y conservación de entradas pausadas.
- `733e164`: cierre opaco del permiso de texto de pago y certificación de cambio único.
- `7301741`: Confirmar/Vigilante sin datos privados en mensajes ni retención.
- `b6d7a2d`: activación cerrada y certificada de las tres entradas seguras.
- `6290697`: cierre explícito de conexiones SQLite en pruebas.
- `127bd0f`: confirmación sintética ejecutada en n8n real sin red.
- `f3e6375`: trabajadores pausados durante el ensayo de migración.
- `d2d966a`, `5b8549f`: afinidad CPU separada de las rondas de interfaz, también en el ensayo de motor.
- `6e13ecd`: identidad criptográfica de imagen entre Docker y Podman.
- `466992d`: precondición de identidad del alias de laboratorio.

Son IDs de la rama propia. El orquestador recoge los cambios por cherry-pick; sus IDs integrados pueden diferir. No se copiaron entornos reales ni valores de credenciales.

## Documentación oficial consultada

Los ensayos reutilizan los adaptadores actuales. Se contrastaron las operaciones GET de [estado de Upload-Post](https://docs.upload-post.com/api/upload-status/), [analítica de Upload-Post](https://docs.upload-post.com/api/get-analytics/) y sus [referencias](https://docs.upload-post.com/api/reference/), además de [YouTube Analytics reports.query](https://developers.google.com/youtube/analytics/reference/reports/query) y [métricas disponibles](https://developers.google.com/youtube/analytics/metrics). No se inventaron endpoints ni se habilitó gasto.

## Limitaciones y Pendientes de Walter

1. **Clave API antigua (H07):** la metadata del VPS contiene una sola clave, ID `W5uCMG87IjiKagXg`, etiqueta `cooper-operacion`, último uso 21-11-2026 05:07:06 UTC. El informe histórico dice que se retuvo la anterior, pero no registra su ID de servidor. No puede asociarse inequívocamente con la única clave vigente. No se revocó por suposición; Walter debe identificar la anterior en la cuenta correspondiente. Solo se consultaron ID, etiqueta y fechas, nunca el valor.
2. Login Google real y recorrido privado del VPS pendientes; el navegador compartido no estaba disponible. No se inició OAuth ni se fabricó una sesión de producción.
3. Meta, plantillas, credenciales de medios, decisiones de rutina/publicación y esperas históricas continúan pendientes según el informe del orquestador. No se reanudaron las siete entradas restantes ni se aprobaron videos.
4. La réplica gratuita requiere PC disponible y custodia offline separada. Telegram depende del propio n8n; una caída total retrasa la alerta hasta recuperación. El monitor reintenta, pero no sustituye un canal independiente.

Una consulta real puede no devolver métricas, outliers o una comparación de homónimos accesible. Eso no autoriza a inventarlos ni demuestra una mejora causal del siguiente video. La aceptación real del radar pertenece a su frente y debe distinguir fuentes consultadas de inaccesibles.
