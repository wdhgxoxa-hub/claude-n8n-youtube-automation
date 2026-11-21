# Sentinel privado para los ensayos locales

Cooper publica únicamente el adaptador, las pruebas y el manifiesto
[`sentinel-origen.json`](sentinel-origen.json). Las fuentes de Sistema Sentinel
pertenecen a un repositorio privado y no se distribuyen con Cooper.

Antes del primer ensayo, se necesita un checkout local autorizado que contenga
la revisión fijada `6764bbdcab91719947e93ba1cc476cbefafb58e8`:

```bash
cd cooper
npm run preparar:sentinel -- --repo /ruta/al/checkout/autorizado
```

Sin `--repo`, el preparador busca `~/Proyectos/Sistema-Sentinel/codigo`.
Lee únicamente los nueve objetos Git enumerados en el manifiesto mediante
`git show`, sin consultar las fuentes del working tree, instalar en ese checkout,
descargar repositorios ni pedir credenciales. Comprueba revisión y SHA-256 antes
de crear atómicamente `.cache/sentinel`, ignorada por Git. Nunca imprime las fuentes.
Si ya hay una caché, exige que sea íntegra; no repara silenciosamente alteraciones.

Los ejecutores Node y Python aceptan solo `.cache/sentinel` y el manifiesto público
de Cooper. Rechazan hashes distintos, faltantes, enlaces simbólicos, bytecode y
archivos adicionales antes de importar los módulos. No aceptan rutas personales
ni `SENTINEL_CODIGO`/`SENTINEL_PYTHON` durante la ejecución. Python no escribe bytecode.
El guardián, los evaluadores y los módulos originales se mantienen intactos.

`ci:limpia` archiva solo el commit público. Después incorpora únicamente la caché
verificada contra el manifiesto de ese commit en el checkout efímero del ensayo;
las fuentes privadas quedan fuera del tar y del contexto de construcción de la
imagen. No monta el repositorio privado, HOME, sockets ni credenciales. No publique
ese checkout ni su caché. El contenedor usa sus propias dependencias y navegadores.

Sin acceso local autorizado a la revisión, Sentinel no puede ejecutarse: la puerta
falla de forma explícita, sin omitir pruebas. Para CI remoto se requiere decidir
una provisión privada autorizada; este procedimiento no redistribuye el código.

Las cinco dependencias Python están fijadas por hash en
[`sentinel-requirements.txt`](sentinel-requirements.txt). `gremlins.js` proviene del
lockfile público de Cooper y también se valida por hash para mantener el caos activo.
