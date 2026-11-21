# Cooper total — Sentinel privado

Fecha: 2026-11-21 12:30 (Lima). Rama y worktree propios: `total-sentinel-privado`, base `d05d5bb`.

## Cambios y commits

- `892d665` — Mantener Sentinel privado en caché verificada sin redistribuir fuentes.
- Este informe y sus recibos acompañan la entrega en un commit documental separado.

Se retiraron del árbol público los nueve archivos de Sentinel incorporados por M08.
El manifiesto público pasó a `cooper/ci/sentinel-origen.json`; las fuentes existen solo
bajo `.cache/sentinel`, ignorada por Git. El historial anterior de M08 y su prueba de
contenedor se conservan como evidencia histórica: no prueban todavía esta adaptación.

`preparar:sentinel` permite indicar un checkout privado autorizado. Extrae únicamente
los objetos de la revisión `6764bbdcab91719947e93ba1cc476cbefafb58e8` mediante `git show`,
sin leer las fuentes del working tree ni descargar repositorios. Verifica los nueve
SHA-256 y crea la caché atómicamente. Un checkout con HEAD posterior o con cambios de
trabajo no altera el resultado; una caché modificada provoca error explícito.

Node y Python usan siempre la caché fija y el manifiesto público. Rechazan archivos
faltantes, hashes distintos, enlaces, bytecode y cualquier archivo adicional antes de
importar Sentinel. El guardián, evaluadores, módulos y gremlins conservan sus hashes;
no se ocultaron hallazgos ni se deshabilitó el caos.

`ci:limpia` sigue archivando solo HEAD. Después copia únicamente la caché verificada
contra el manifiesto del commit archivado, fuera del tar y del contexto de imagen.
No monta el repositorio privado ni configuración personal. El checkout efímero contiene
fuentes privadas y no debe redistribuirse. El árbol de Cooper rechaza las rutas antiguas
de fuentes privadas y una caché incorporada accidentalmente antes de preparar el ensayo.

La documentación oficial de [git show](https://git-scm.com/docs/git-show) y
[git archive](https://git-scm.com/docs/git-archive) respalda la lectura de objetos y el
archivo del árbol fijado. No se usaron APIs de proveedores ni se hicieron cambios VPS.

## Evidencia de verificación

[Resumen con códigos, duraciones y SHA-256 de logs](evidencias/total-sentinel-privado/resumen.json).

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | 361 paquetes; 0 vulnerabilidades; sin advertencias |
| `npm run lint` y `npm run typecheck` | rc 0; 0 advertencias |
| Unitarias de puerta y caché | 13/13; sin omisiones |
| Python: caché y guardián real | 8/8; sin omisiones |
| `node --test tests/flujos_v2.test.cjs` | 172/172; sin omisiones |
| `git archive` del commit funcional | 0 entradas privadas; SHA-256 registrado |
| Runtime Node y Python sobre el archivo más caché | ambos PASS; 9 archivos verificados |

Las pruebas de caché usan fuentes ficticias, incluida la extracción con HEAD cambiado,
rechazos por falta de repositorio, hash alterado, ruta ajena, enlace y bytecode. Las tres
pruebas de navegador usan los módulos originales desde la caché: el caos efectúa acciones,
los controles mutantes quedan excluidos y un POST deliberado continúa bloqueado por el
guardián y señalado como error de consola por el evaluador original. Se usó venv propio
con Playwright Python 1.63.0 y Chromium ya preparado, sin abrir Cooper ni producción.

El [recibo de archivo público](evidencias/total-sentinel-privado/archivo-publico.json)
valida `892d665` sin fuentes privadas en el tar; después comprueba las importaciones
Node/Python desde el checkout efímero con caché verificada. No equivale a una ejecución
del contenedor ni de la puerta completa.

## Límites y estado de integración

Implementado y probado focalmente. Pendiente de integrar por el orquestador, que ejecutará
la puerta completa y las dos rondas finales sobre el conjunto integrado. Por coordinación
no se repitieron aquí `npm test` completo, `test:e2e`, `build` ni el contenedor completo.
El resultado histórico M08 de Debian no se atribuye a este nuevo código.

Eliminar archivos del árbol no elimina sus blobs del historial. Antes de cualquier push,
el orquestador debe retirar las fuentes privadas de todos los commits salientes; ya tiene
esa operación coordinada. Este frente no hizo push, merge ni reescritura de ramas ajenas.

## Pendientes de Walter

Ninguno para continuar la validación local autorizada. Si se solicita CI remoto, definir
una provisión privada autorizada de la revisión fijada; sin ella la puerta falla, sin omitir
Sentinel. No se publica ni se presupone permiso para redistribuir su código.
