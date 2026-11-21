# Sentinel: sincronización de montajes y rastro de fallos

2026-11-21 15:07, Lima. Commit de código: `be2b242`.

## Qué se demostró

La ronda `cierre-3` queda rechazada: 85 pruebas aprobadas, una fallida y seis no ejecutadas. Sentinel registró un bloqueo `POST /api/marcas/montajes` y un error de consola `net::ERR_BLOCKED_BY_CLIENT.Inspector` durante caos en `/publicados`. Las semillas registradas fueron `1528974480`/338 y `1528974481`/74, con 209 acciones realizadas. El orquestador conserva los artefactos completos de esa ronda y su recibo en `06705b0`.

En la aplicación de la imagen `bfd5e79`, pulsar «Actualizar montajes desde fábrica» produce ese POST: `cooper/src/componentes/marcas.tsx`, función `actualizarMontajes` y botón del compositor. El control faltaba en `cooper/scripts/sentinel_exclusiones.py`. Con el guardián real, el clic reprodujo el bloqueo y exactamente el error de consola. Después de agregar únicamente ese texto a las exclusiones, el mismo clic no realiza la petición y no produce errores ni hallazgos.

**Límite causal:** tres repeticiones aisladas de las dos semillas, sobre cuentas ficticias nuevas, no reprodujeron el error de `/publicados`. El estado y los tiempos de navegación difieren de la batería completa. No se afirma que el clic de montajes haya causado aquel error concreto; sí está probada la exclusión ausente y su efecto. No hay evidencia que permita atribuir el incidente original a una salida externa. El rastro original no identificaba la petición fallida por acción.

## Cambios

- Exclusión exacta del control mutante; filtros, enlaces y lecturas siguen disponibles.
- Observador en el adaptador público: conserva método, URL sin consulta/fragmento/usuario, tipo de recurso, fallo y doce controles previos. Registra etiquetas y rutas; los nombres solo proceden de la lista fija de exclusiones. No almacena texto libre, valores de campos, cabeceras, cuerpos ni cookies. Escribe `peticiones-fallidas.json` para diagnosticar futuras rondas. No modifica rutas ni respuestas.
- Regresión con navegador y guardián real: el control queda excluido; un POST directo sigue bloqueado y el evaluador sigue clasificando la consola como error de gravedad media. Verifica además que consultas, fragmentos y texto libre no aparezcan en el rastro, y que los archivos privados de Sentinel conserven sus hashes.

`src`, `drizzle` y `public` no cambian respecto de `06705b0`; comprobación `git diff --quiet` con salida 0. No se modifica Sentinel privado, su guardián, el evaluador, los umbrales ni la imagen de producto. No se copian fuentes privadas al repositorio.

## Pruebas y evidencia

Entorno aislado Podman `localhost/cooper-ci:bfd5e79283bd`, red deshabilitada y CPU 12–23; solo aplicación, sesión y datos ficticios de ensayo. Navegador Chromium instalado en la caché verificada, sin proveedores ni VPS.

- [Regresión roja](evidencias/total-sentinel-montajes/regresion-rojo.log): una comprobación falla al faltar la exclusión.
- [Regresión verde](evidencias/total-sentinel-montajes/regresion-verde-final.log): 3/3 aprobadas, sin advertencias; incluye observador saneado y control del evaluador.
- [Recibo antes/después](evidencias/total-sentinel-montajes/rojo-verde.json): semillas, acciones efectivas, control causal y hash del informe original.
- [Revisión visual parcial de cierre-3](evidencias/total-sentinel-montajes/revision-visual-parcial-cierre-3.json): 24 PNG vistos en resolución original, huellas contrastadas con la copia completa conservada por el orquestador. No se observaron defectos visuales; las cifras móviles se conservan enteras. Esto **no aprueba la ronda** ni acredita la decodificación completa de sus vídeos.

La puerta completa se repetirá en la raíz integrada por el orquestador, seguida de las dos rondas nuevas `cierre-5` y `cierre-6`. Este ensayo focal no sustituye esa puerta ni sus 48 muestras visuales y cuatro recorridos. Las rondas anteriores permanecen conservadas y no se mezclarán con las nuevas.

API de observación contrastada con documentación oficial de [Request.failure](https://playwright.dev/python/docs/api/class-request#request-failure) y [BrowserContext.requestfailed](https://playwright.dev/python/docs/api/class-browsercontext#browser-context-event-request-failed). Los errores HTTP y los fallos de transporte son eventos diferentes; el observador no reclasifica ninguno ni altera la evaluación de Sentinel.

## Pendientes de Walter

Ninguno para esta corrección. La integración, la puerta y la revisión de las dos rondas siguen a cargo de Codex.
