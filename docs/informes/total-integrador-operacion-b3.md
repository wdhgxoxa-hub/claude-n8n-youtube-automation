# Aceptación operativa b3 con corrección H19

21-11-2026, Lima. Fuente integrada `b3e608eec138a03fce419a66954497b8fc2c50ea`, con reutilización de sentencias SQLite en el puente y ensayos de Cooper limitados a **1 GiB sin swap**. Rama propia `total-integrador-operacion-b3`, checkout `/home/david/.cache/tiop-b3`; CPU 16–23. Este cierre sustituye la aceptación e942, que no cubría el defecto de memoria H19.

## Artefacto exacto

- Imagen: `localhost/cooper:b3e608eec138a03fce419a66954497b8fc2c50ea`.
- ID de configuración Podman: `c5f653a5c70e15fcbe02fa1123fefaf1fed52590a9f455f2e311e50d60923129`.
- Archivo: `/home/david/.cache/cooper-ti-operacion-b3/cooper-b3e608e.tar.gz`, **269 559 055 bytes**.
- SHA256 comprimido: **`9ea269e6746e197c5626ae04fa6835bbcf9eb18274d7d0192225582e8e493d20`**.
- Construcción en formato Docker y compresión `gzip -n -6`: salida 0, cero errores/advertencias. `archive_identity` acreditó configuración y etiqueta sobre ese mismo archivo, sin interpretar `Config.Env`.

[Identidad y procedencia](evidencias/total-integrador-operacion-b3/imagen.json). La imagen conserva HEALTHCHECK. Docker admite estos archivos gzip en [su cargador oficial](https://docs.docker.com/reference/cli/docker/image/load/); el ID de runtime Docker puede diferir del ID de configuración Podman y se acredita mediante la cadena del archivo.

## Operación y reversa

| Comprobación | Resultado |
| --- | --- |
| Migración sobre copia inicial restaurada `cbf20685` | **11→14 PASS**, 27 tablas anteriores conservadas, integridad/FK y reversa PASS; cgroup real `memory.max=1073741824`, `memory.swap.max=0`. |
| Compose nuevo | **8/8 PASS**, incluido límite real de memoria, TLS, login ficticio, Marcas, runner n8n, SSE, respaldo/restauración y actualización/reversa conjunta. |
| Regresiones operativas | **190/190 PASS**, `python3 -W error`. |
| Aplicador con imágenes previas mezcladas | **PASS**: Cooper y chat-cooper b3; chat-n8n y chat-runner cbf20685. Fallo inyectado después del arranque nuevo → reversa de datos/archivos y **siete IDs exactos recuperados**. |
| Segunda aplicación del candidato | **PASS**, servicios saludables y todos los relés en b3; n8n/runner 2.47.6 y Caddy 2.11.8. |
| Cierre del ensayo mixto | Salida 0, stderr vacío, contenedores retirados y sin marcador de mantenimiento. |

Los helpers de producción permanecen exactos respecto a f375: `aplicar-infra.py` SHA256 `d9b8a8faec7ff1b4658dc25f941595778951338698e7d035d26dae96e85dab2c`; `operar.py` SHA256 `0a42c6f610ebca5afd2eaa93e5c695a0f9d5fbdaa55482a889543177ed447a56`. La adaptación de dependencias de namespace pertenece exclusivamente al arnés Podman ya documentado en el cierre histórico e942. El fixture Compose aporta el override `memswap_limit=1g`, conservado durante aplicación y reversa.

Recibos: [migración](evidencias/total-integrador-operacion-b3/migracion.json), [Compose](evidencias/total-integrador-operacion-b3/compose.log), [aceptación](evidencias/total-integrador-operacion-b3/infra-aceptacion.json), [reversa mixta](evidencias/total-integrador-operacion-b3/infra-aplicador.json), [190 pruebas](evidencias/total-integrador-operacion-b3/operacion-tests.log), [código probado](evidencias/total-integrador-operacion-b3/codigo-probado.json).

El recibo de aceptación tiene SHA256 `da9eba06a191b25010727a229b7a56af28811c87f0679b39c02db6f2b7ba69f6`; el resultado mixto, `5f2b2a8e4cba0ff2ec40cd595f1d3cf74062c7eaaa4484c5174177bc7ee1e2e4`. Fixture: `/home/david/.cache/tiop-b3/cooper/.cache/e2e-vps-nUwTZv`.

## H19 contra Next standalone real

El arnés nuevo `deploy/tests/h19-imagen.mjs` ejecuta **la imagen b3 concreta**, con su servidor Next y sus rutas existentes `/api/eventos` y `/api/estado`. No añade rutas ni modifica el runtime. El proveedor y verificador ocupan otro cgroup; comparten únicamente el namespace de red loopback, sin salida externa ni puertos publicados. Las sesiones Auth.js se firman con valores efímeros sintéticos y los usuarios se crean en bases nuevas de laboratorio. No se serializan claves ni cookies.

La entrada procede del fixture público de **10 000 filas** y su proyección n8n 2.47.6. Se contrastan los SHA con los recibos originales y se exigen **9 896/999/900/0 videos** para administrador, usuario-0, usuario-9 y sin-recursos. Cada actor debe completar cinco conexiones SSE y tres lecturas HTTP: se espera el evento estado completo, se rechaza cualquier evento fallo y se comprueban IDs, dueños, canales, guiones, observabilidad e historial íntegros. Las tres respuestas GET deben conservar el mismo SHA.

El administrador SSE sincroniza los once usuarios sintéticos del fixture: **55 solicitudes en cinco conexiones**; cada otro actor efectúa cinco. Esto difiere del arnés H19 original, que llamaba directamente a una sincronización por actor. El recibo separa este alcance más amplio de la medición anterior de módulos compilados.

La repetición final terminó **PASS, salida 0**, con cero errores y avisos en los cuatro logs de aplicación. Picos de memoria: administrador **740,09 MiB**, usuario-0 **243,68 MiB**, usuario-9 **228,96 MiB** y sin-recursos **127,48 MiB**. En todos los casos hubo cinco SSE, tres GET, cero reintentos, cero eventos OOM y swap cero. [Resumen y picos](evidencias/total-integrador-operacion-b3/h19-resumen.json).

El recibo H19 final tiene SHA256 `9a6ce9f077b3ab4caaa0193870ab0a053974adf4a882b57120bd5c5ddfacba25` y el arnés probado `cbfa0f426e6c027758aa62ad5a59d58300a5010ce31a5c972802134a302597a8`. Los recibos se conservan en `/home/david/.cache/cooper-ti-operacion-b3/h19-final`. La primera pasada también aprobó; se repitió después de convertir la comprobación independiente de entradas y eventos OOM en guardas automáticas del arnés.

El arnés exige cgroup de aplicación de **1 GiB, swap máximo/actual cero, eventos oom/oom_kill cero**, proceso vivo con la imagen exacta y salud real al terminar cada actor. El resultado técnico, los picos y las huellas de entrada constan en [H19 de imagen](evidencias/total-integrador-operacion-b3/h19-imagen.json) y [entrada acreditada](evidencias/total-integrador-operacion-b3/h19-entrada.json). Los recibos completos de cuatro actores se conservan junto a ese índice.

Las herramientas públicas H19 proceden de `1c65535`, integradas por el coordinador después del corte de imagen sin cambiar Cooper. Para repetir, preparar `DIRECTORIO/salida` con los snapshots públicos exportados por `tools/cooper/medir-volumen-n8n.cjs --exportar-snapshots` en n8n 2.47.6 y crear `DIRECTORIO/resultados`; ejecutar desde el checkout con dependencias de lockfile idéntico:

```sh
node deploy/tests/h19-imagen.mjs localhost/cooper:COMMIT_COMPLETO DIRECTORIO
```

El directorio debe ser nuevo bajo `/home/david/.cache/cooper-ti-operacion-`. El arnés usa CPU 16–23 y la imagen CI pública local `localhost/cooper-ci:bfd5e79283bd` para el proveedor/verificador; el servidor bajo prueba utiliza exclusivamente la etiqueta recibida. La preparación y sus huellas están registradas en la evidencia, sin datos de producción.

## Alcance, historia y pendientes

La aceptación previa del motor n8n sigue siendo reutilizable: siete archivos de motor/configuración permanecen idénticos desde a794037 y también las tres funciones de `operar.py` usadas por ese ensayo. Conserva 45 workflows, nueve tablas/130 filas, 342→342 migraciones, idempotencia y reversa PASS. No se atribuye una nueva ejecución de ese ensayo anterior.

Las rondas `videos-integracion5` se detuvieron por la incorporación de H19. No se ejecutó el verificador final ni se produjo aceptación técnica o visual de esas rondas. Los ensayos e124/e942 y los intentos fallidos de laboratorio se conservan como antecedentes. La puerta completa, las nuevas rondas Sentinel/videos, la revisión visual y el despliegue corresponden al integrador y sus otros subfrentes; este informe acredita operación local.

No hubo SSH, mutación del VPS, OAuth, pagos ni publicación desde este subfrente. El integrador actualiza `docs/ESTADO.md` distinguiendo probado, integrado y desplegado. Los commits de arnés y cierre se identifican con `git log -- deploy/tests/h19-imagen.mjs docs/informes/total-integrador-operacion-b3.md`.

## Pendientes de Walter

1. Ninguno nuevo en este alcance local. Se conservan los pendientes de aceptación y operación del informe del integrador.
