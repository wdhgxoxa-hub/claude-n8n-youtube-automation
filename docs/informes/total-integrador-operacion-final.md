# Aceptación operativa de la imagen integrada final

21-11-2026, Lima. Encargo local del integrador sobre la fuente `e1244bd376f8546d3b439e32b77e8a187a062d3e`, que contiene el cierre de rendimiento `e32665d`. Rama propia `total-integrador-operacion-final`; no se modificaron los worktrees del integrador ni del orquestador. Las pruebas usaron CPU 16–23 y copias privadas independientes bajo `~/.cache`.

## Imagen y código exactos

- Imagen: `localhost/cooper:e1244bd376f8546d3b439e32b77e8a187a062d3e`.
- ID de configuración Podman: `ae1de678d22f476d56ddbfa50d07afd273edcb2b15a2996724500eee5d3a0d0e`.
- Archivo: `/home/david/.cache/cooper-ti-operacion-final/cooper-e1244bd.tar`.
- SHA256 del archivo: `8b52f0c6a9a18181235ce8b78531b85c50096bfc3b9306fafa31c142adc8d641`.
- Construcción `podman build --format docker --cpuset-cpus 16-23`: código 0, cero errores y advertencias, HEALTHCHECK conservado.
- Aplicador final de `e32747c6c52ee8fe73dfd46e1fba3e465fb6ce9a`: SHA256 `26d5a582b231e439d14eeda4385148ad2e3385d3e8280a4444f80fbd2a1b373e`. Este cambio operativo externo a la imagen acredita índices y manifiestos; se copiaron sus dos archivos públicos exactos al checkout del ensayo.

[Identidad y procedencia](evidencias/total-integrador-operacion-final/imagen.json), [código probado](evidencias/total-integrador-operacion-final/codigo-aplicador.json).

## Pruebas y reversas

| Prueba | Resultado |
| --- | --- |
| Migración de Cooper sobre copia inicial restaurada | **11→14 PASS**, integridad/FK PASS, 27 tablas anteriores conservadas; reversa de bytes y arranque con `cbf20685` PASS. |
| Compose con la imagen nueva | **8/8 PASS**, salida 0: TLS, autenticación ficticia, JPEG/reel y HMAC, runner n8n, SSE, restic/restauración, exportación/importación y actualización/reversa conjunta. |
| Motor n8n | Se conserva la aceptación previa 2.47.4→2.47.6: **45 workflows, nueve tablas/130 filas, 342→342 migraciones**, idempotencia y reversa PASS. Los siete archivos de motor/configuración comparados no cambiaron entre `a794037` y `e1244bd`; sus hashes quedan registrados. |
| Aplicador exacto de infraestructura | **PASS**, salida 0 y stderr vacío: fallo deliberado después del arranque nuevo → `FALLO_REVERTIDO` y reversa PASS de archivos/datos; segunda aplicación → salud y datos conservados PASS. |
| Regresiones operativas | **167/167 PASS** con `python3 -W error`; incluye las 22 pruebas focales del aplicador. |

Recibos: [migración](evidencias/total-integrador-operacion-final/migracion.json), [ocho bloques](evidencias/total-integrador-operacion-final/compose.log), [aceptación ligada a imagen y artefacto](evidencias/total-integrador-operacion-final/infra-aceptacion.json), [aplicador](evidencias/total-integrador-operacion-final/infra-aplicador.json), [regresiones](evidencias/total-integrador-operacion-final/operacion-tests.log), [índice y hashes de recibos detallados](evidencias/total-integrador-operacion-final/indice.json).

El primer Compose aprobó siete bloques y se detuvo porque la copia hecha con `git archive` no contenía metadatos Git requeridos por `git rev-parse HEAD` del bloque final. Se preparó un repositorio local independiente con HEAD exacto y se repitieron los ocho bloques desde un fixture nuevo, todos aprobados. El primer intento se conserva, identificado por hash en la procedencia; no se presenta como aceptación completa.

El fixture final es `/home/david/.cache/tiop-final/cooper/.cache/e2e-vps-gUXkUg`. Los recibos privados detallados permanecen en su directorio `aceptacion-infra-1795292048506421527`. La limpieza de contenedores terminó y los datos de prueba permanecen disponibles. No se imprimieron entornos, claves ni datos de negocio; los artefactos versionados contienen resultados, rutas y hashes.

## Alcance y limitaciones

Esta aceptación es **local y probada**. No ejecutó SSH, cambios remotos, OAuth, pagos ni publicaciones. La puerta completa de Cooper, Sentinel, videos y despliegue pertenecen al integrador y no se atribuyen a este subfrente. El aplicador corrió en Podman con identidades exactas; la acreditación de índices Docker se cubre aquí mediante regresiones, y su comprobación en el VPS corresponde a la operación del integrador. La aceptación previa del motor se reutiliza por igualdad de código/configuración; no se afirma haber repetido ese ensayo en este cierre.

El integrador consolida `docs/ESTADO.md` con la distinción entre probado, integrado y desplegado. Este cierre documental se identifica con `git log -1 -- docs/informes/total-integrador-operacion-final.md`.

## Pendientes de Walter

1. Ninguno nuevo en este alcance local. Permanecen los pendientes de aceptación y operación registrados por el integrador.
