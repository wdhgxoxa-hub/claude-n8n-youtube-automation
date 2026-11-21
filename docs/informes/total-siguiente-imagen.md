# Preparación para sustituir la imagen después de H19

Fecha: 2026-11-21 (Lima). Revisión independiente del frente operación.

**El paquete permite sustituir la identidad de Cooper y conservar el certificado independiente del motor n8n de 146 filas.** Esto requiere generar una aceptación nueva del artefacto corregido. No se puede convertir el recibo anterior en prueba de otra imagen editando sus campos. `bfd5e79` queda descartada para activación final tras el OOM del ensayo compilado H19 a 1 GiB sin swap, comunicado por el orquestador.

## Contratos revisados

- `deploy/aplicar-infra.py:31` exige ocho bloques Compose, hashes exactos de cuatro archivos públicos, imágenes n8n/runner/Caddy del manifiesto y reversa del motor. Esos archivos y el aplicador siguen idénticos en el worktree y la integración raíz.
- `deploy/aplicar-infra.py:79` liga SHA del archivo, etiqueta exacta e identidad de configuración; si Docker identifica por manifiesto, comprueba el enlace manifiesto→configuración. No basta una etiqueta coincidente. Las 13 regresiones focales de identidad/reversa pasaron con `-W error`.
- `deploy/operar.py:237` solo acepta etiqueta local con **SHA completo de 40 caracteres** o digest. La nueva construcción, tar, `COOPER_VPS_TEST_IMAGE`, recibo y activación usarán la misma etiqueta `localhost/cooper:<SHA40>`. El alias corto no será el artefacto canónico.
- `deploy/ensayar-motor-n8n.py:58` opera exclusivamente la copia n8n con las imágenes fijadas de n8n. No utiliza Cooper; su certificado de 45 workflows/nueve tablas/146 filas y reversa exacta permanece válido para ese corte mientras no cambien motor, datos del corte ni configuración.
- `deploy/tests/infra-aplicador.py:23` exige fixture nuevo/aislado y la imagen exacta del recibo antes de provocar fallo, restaurar archivos/datos y aplicar nuevamente. Ese ensayo depende de la nueva imagen y se repetirá.

La [revisión de huellas](evidencias/total-radar-contexto/siguiente-imagen/revision.json) conserva los valores; todavía no contiene identidad ni aprobación de una imagen nueva.

## Ensayos a repetir y evidencia conservada

| Ensayo | Tratamiento |
|---|---|
| H19 compilado, cinco sincronizaciones y primer GET | Repetir con el artefacto corregido, 1 GiB RAM, swap cero; comprobar integridad y ausencia de OOM. Competencia es dueño del caso. |
| Cooper 11→13 y reversa | Repetir con nuevo tag completo y la copia íntegra; arranque de nueva/anterior, tablas, integridad y claves foráneas. |
| Ocho bloques Compose | Repetir todos con nueva imagen: TLS/acceso, medios Marcas sintéticos, callback firmado/runner/SSE, reconexiones, copia/restauración, importación y actualización/reversa. |
| Aplicador conjunto de infraestructura | Repetir fallo inyectado posterior al arranque nuevo, reversa de datos/configuración y aplicación posterior; ligar tar/tag/ID nuevos. |
| Puerta completa y dos rondas Sentinel+Playwright | Repetir sobre la fuente corregida; rondas secuenciales y revisión visual, coordinadas por raíz. |
| Motor n8n 2.47.6/reversa 2.47.4 del corte de 146 filas | Conservar recibo independiente: no depende del cambio de aplicación. No renombrar su corte ni atribuirle datos futuros. |
| Traslado del artefacto | Comprobar SHA antes/después; no implica autorización de activación. |
| Corte operativo al desplegar | Crear respaldo fresco, comprobar invariantes/esperas y Marcas vacío; consignar nuevos conteos reales. El snapshot de 146 filas no sustituye esa copia futura. |

## Laboratorio sin swap

La [lectura del VPS](total-memoria-vps.md) confirmó que el host carece de swap. El arnés anterior no lo deshabilitaba en la PC. `5a581e8` añade el override local `memswap_limit: 1g` de Cooper y exige `memory.max=1073741824`, `memory.swap.max=0` en el cgroup. El ensayo de migración también limita ambas imágenes a 1 GiB sin swap y comprueba los valores reales del kernel.

La configuración de producción, las imágenes de infraestructura y el aplicador no cambian. [137 pruebas Python sin advertencias](evidencias/total-radar-contexto/siguiente-imagen/python.log), [13 focales de identidad](evidencias/total-radar-contexto/siguiente-imagen/identidad.log) y sintaxis Node pasan. La ejecución del arnés modificado espera el nuevo artefacto; estas pruebas no sustituyen sus ocho bloques ni H19.

## Pendientes de Walter

Ninguno nuevo. La corrección H19 y la nueva aceptación son trabajo de Codex. No se aumentó memoria, no se instaló swap, no se modificó el VPS ni se inició construcción o despliegue de una imagen aún sin SHA definitivo.
