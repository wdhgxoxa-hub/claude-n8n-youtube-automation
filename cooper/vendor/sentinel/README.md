# Sentinel conservado para Cooper

Copia interna de Sistema Sentinel 0.1.0, revisión `6764bbdcab91719947e93ba1cc476cbefafb58e8`.
`origen.json` identifica los nueve archivos y sus SHA-256. Se copiaron mediante `git show`
desde esa revisión, sin cambios: contrato, guardián completo (incluido `proteger.js`),
recorridos, caos y estabilidad. Son exactamente los módulos usados por el adaptador de
Cooper; no se sustituyen reglas, umbrales ni evaluadores. No se incluyen MCP, objetivos,
credenciales, informes ni otros módulos que Cooper no invoca.

Las cinco dependencias transitivas de esos módulos se fijan con los hashes del `uv.lock`
de la misma revisión en `../../ci/sentinel-requirements.txt`. El preflight verifica
estas fuentes antes de importar Sentinel. Actualizar exige revisar diferencias, renovar
huellas y volver a ejecutar la puerta; nunca editar esta copia para hacer pasar un ensayo.

El proyecto de origen no contiene un archivo de licencia. Esta copia sirve al ensayo
interno autorizado de Cooper; no se le atribuye una licencia de terceros ni autorización
para redistribución pública. Publicar el repositorio o CI queda pendiente de Walter.
