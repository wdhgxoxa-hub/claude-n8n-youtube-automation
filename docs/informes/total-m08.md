# M08 — puerta reproducible desde cero

21-11-2026, Lima. Rama y worktree propios: `total-m08`,
`/home/david/Proyectos/cooper-wt/total-m08`. Base `de397f3` de `version-chatgpt`.
Código probado: `2f63527373667b4110e142f01444033bca1cc244`. El cierre posterior solo
añade este informe y actualiza `docs/ESTADO.md`. **Implementado y probado localmente;
pendiente de integración y despliegue.**

## Alcance y cambios

Se revisaron las ramas `total-*` y los cambios de preparación/uso de Sentinel antes de
implementar. Los frentes de despliegue tenían ensayos con Sentinel, pero conservaban
la dependencia de rutas personales y Chromium preparado manualmente. No se duplicó
su aceptación pública ni se incorporaron cambios de producto de otros frentes.

- `npm run ci:limpia` exporta el commit HEAD mediante `git archive` a un directorio
  nuevo y ejecuta la puerta en un contenedor local Debian 12. No monta el worktree,
  HOME, sockets ni `.env`; no publica puertos. Conserva el archivo fuente y su SHA-256.
- Node 24.22.3 y uv 0.12.24 proceden de imágenes con digest fijo. npm 12.2.2 y
  CPython 3.14.7 se instalan dentro de la imagen. SQLite usa las cabeceras del mismo
  Node. FFmpeg y las dependencias de Chromium quedan declarados en el Containerfile.
- Copia interna de los nueve archivos exactos de Sentinel `6764bbd`: contrato,
  guardián incluido `proteger.js`, recorridos, caos y estabilidad. Se conservaron
  todos sus bytes, reglas y umbrales. El manifiesto comprueba SHA-256 antes de usarlo.
  La copia no se reformatea con ESLint; ningún archivo preexistente deja de verificarse.
- Cinco dependencias Python con versiones y hashes del `uv.lock` de esa revisión:
  Playwright 1.63.0, greenlet 3.5.6, pyee 13.0.1, PyYAML 6.0.3 y
  typing-extensions 4.16.0. Solo se admiten wheels con hash válido. El caos usa además
  `gremlins.js` 2.2.0 fijado en npm y con SHA-256 del bundle verificado. Su dependencia
  `core-js` tiene el aviso de financiación posinstalación denegado explícitamente;
  se conservan las autorizaciones de compilación de SQLite y esbuild.
- Preparación explícita y automática del Python en `.cache/sentinel-venv`, Chromium
  153.0.8010.12/revisión 1243 para Sentinel y Chromium 159.0.8154.6/revisión 1255
  para Playwright JS 1.65.1. No hay enlaces a cachés personales ni variables que
  sustituyan el código/intérprete de Sentinel por otra instalación.
- Preflight de versiones, plataforma, integridad y lanzamiento real de ambos navegadores.
  Rechaza nombres de `.env` reales sin abrirlos. El arnés restringe las variables
  heredadas; no transmite claves, proveedores, destinos ni `NODE_OPTIONS`.
- Los siete comandos conservan su orden. La preparación entre instalación y lint
  también queda registrada. Logs con rc, duración, advertencias y SHA-256; reportes
  JSON de Vitest y Playwright. Un fallo, advertencia, suite vacía, omisión o reintento
  E2E impide declarar PASS. Se actualizan también las suites adicionales de Pulido,
  Cobertura y Movimiento para usar el mismo Python local. La E2E exige los tres
  módulos y al menos una medición de caos con acciones reales.
- Corrección descubierta en el entorno limpio: fechas de consentimiento y videos
  formateadas explícitamente en Lima, reutilizando la política visual de Operación y
  Publicados. El servidor de la puerta queda en UTC y el navegador de diseño en Lima:
  se conserva esa diferencia para detectar errores de hidratación. Los periodos de
  gastos y las reglas de programación no cambian.

Procedimiento y fuentes oficiales: [README](../../cooper/README.md#puerta-reproducible-desde-cero).
No se añadió un workflow remoto ni se publicó CI.

## Commits

| Commit | Contenido |
| --- | --- |
| `b806642` | Fijar Sentinel y preparar una puerta aislada desde cero. |
| `2f8047e` | Fijar npm de la imagen y registrar fallos del preflight. |
| `553afa3` | Reutilizar cabeceras de Node en el contenedor sin capacidades. |
| `683b3b1` | Incluir el motor de caos y exigir actividad real de Sentinel. |
| `2e74739` | Estabilizar fechas entre el servidor UTC y el navegador de Lima. |
| `3e028fa` | Declarar la denegación del aviso posinstalación de core-js. |
| `2f63527` | Reconocer el resumen spec de Node sin omitir controles. |
| Cierre documental posterior | Este informe y actualización de `docs/ESTADO.md`; identificar con `git log -1 -- docs/informes/total-m08.md`. |

## Evidencia de la puerta

**PASS**, 21-11-2026 de **12:11:28 a 12:19:46 Lima**, sobre el código indicado.
Los siete comandos, más la preparación, terminaron con **rc 0, cero errores y cero
advertencias**. **290/290 unitarias** (31 archivos), **43/43 E2E**, **147/147 flujos**;
cero omisiones, cancelaciones y reintentos. El comando exterior `ci-limpia.mjs` también
terminó en rc 0, incluido el agregado de resultados.

```bash
# Desde el worktree propio; exportación limpia del commit, contenedor local:
node cooper/scripts/ci-limpia.mjs
# Equivalente documentado desde cooper/: npm run ci:limpia
```

La exportación limpia no contiene node_modules, entornos Python, bases ni cachés de
navegadores previos. La imagen de herramientas se construye con la receta versionada;
no utiliza la instalación personal de Sentinel. Las imágenes base públicas pueden
estar en la caché del motor. Las dependencias y ambos navegadores del checkout se
prepararon automáticamente. Imagen local de herramientas, no publicada:
`7873255a460286e90a66111f3848f34ff50b6cb879be689859983e99a0bc1d5a`.

| Paso | Resultado | Tiempo | Registro / SHA-256 |
| --- | --- | --- | --- |
| `npm ci` | PASS, rc 0; 0 vulnerabilidades | 8.42 s | [ci.log](../../.cache/ci-limpia-2MvXLd/checkout/cooper/.cache/puerta/ci.log) · `27c8639be0bdc007da313b7ba5adce1a0ba22dba0db9bf997c238a3fa402b73c` |
| `/usr/local/bin/node scripts/preparar-pruebas.mjs` | PASS, rc 0; Python y ambos Chromium arrancaron | 50.90 s | [preparacion.log](../../.cache/ci-limpia-2MvXLd/checkout/cooper/.cache/puerta/preparacion.log) · `df18669afa45bc5df73f80f4c890bf5033a8265c9459d492a0099a99508a0441` |
| `npm run lint` | PASS, rc 0; 0 errores/advertencias | 3.29 s | [lint.log](../../.cache/ci-limpia-2MvXLd/checkout/cooper/.cache/puerta/lint.log) · `82ef02fe294108ee62820c4aac466a1c844a5d882fc917b8239cd96439fed007` |
| `npm run typecheck` | PASS, rc 0; 0 errores/advertencias | 3.81 s | [typecheck.log](../../.cache/ci-limpia-2MvXLd/checkout/cooper/.cache/puerta/typecheck.log) · `0781fae003f31f2e4c5d3eaff30c5369a49d8b236b5cfb6c916d9d89daef524f` |
| `npm test` | PASS, rc 0; 290/290 | 18.32 s | [unitarias.log](../../.cache/ci-limpia-2MvXLd/checkout/cooper/.cache/puerta/unitarias.log) · `f1136f856330f82be23873df72bb62d80058cf58f3a9896f42c4ed397c969be3` |
| `npm run test:e2e` | PASS, rc 0; 43/43, sin reintentos | 407.57 s | [e2e.log](../../.cache/ci-limpia-2MvXLd/checkout/cooper/.cache/puerta/e2e.log) · `3db3be3ec6cb99d6e548fbc268683a41a0170ee2e2d4e1733e6d5874bbd7f82f` |
| `npm run build` | PASS, rc 0; 0 errores/advertencias | 3.84 s | [build.log](../../.cache/ci-limpia-2MvXLd/checkout/cooper/.cache/puerta/build.log) · `854b736263760db4da6ff3b7ed325967d4e36618c9af2a40b023f6644bc0379a` |
| `/usr/local/bin/node --test tests/flujos_v2.test.cjs` | PASS, rc 0; 147/147 | 1.17 s | [flujos.log](../../.cache/ci-limpia-2MvXLd/checkout/cooper/.cache/puerta/flujos.log) · `727f9c01241e06281396f2d97c70f269655a08a4a0c2b55e0961fe29cb4f04a9` |

[Resultado completo](../../.cache/ci-limpia-2MvXLd/checkout/cooper/.cache/puerta/resultado.json), SHA-256
`4f7b8cda6fd1f20bcabf45298ebe3a1c2fb874873aa0ff810d237a949884e31e`. Se comprobaron las ocho huellas de registros y la del archivo fuente:
`7230a517dcb0162f7b75a78d3478713c142ef93666a6336e47ea05c73dd2ce2e`.
[Log exterior](../../.cache/m08-ci-limpia.log),
[Vitest JSON](../../.cache/ci-limpia-2MvXLd/checkout/cooper/.cache/puerta/vitest.json), [Playwright JSON](../../.cache/ci-limpia-2MvXLd/checkout/cooper/.cache/puerta/playwright.json).

[Sentinel](../../.cache/ci-limpia-2MvXLd/checkout/cooper/.cache/sentinel-marcas/informe.json):
recorridos, caos y estabilidad ejecutados; **1.000 acciones reales de caos**, sin
congelación ni caída y sin hallazgos de fallo. Conserva un hallazgo informativo de
cobertura sobre vistas sin URL propia, que solo recorre el módulo recorridos. La
sesión efímera de Sentinel fue eliminada. Las dos E2E que detectaron hidratación
inconsistente pasaron con servidor UTC y navegador Lima.

`git diff --check`: PASS. No se cambiaron pruebas ni código después de esta puerta;
el commit de cierre es documental. **H15 queda cerrado para la ejecución local
reproducible**; publicar CI remoto permanece fuera del alcance autorizado.


## Fallos reproducidos y corregidos

1. El preflight rechaza el host CachyOS como plataforma no soportada para esta puerta;
   el procedimiento reproducible usa Debian 12 dentro del contenedor, sin ocultar avisos.
2. Primera imagen: npm venía en **11.19.1**. El preflight rechazó la versión antes de
   instalar dependencias. Corrección: instalar explícitamente npm 12.2.2 en la imagen.
   [Registro](../../.cache/m08-ci-previa-npm.log).
3. Segundo ensayo: `npm ci` falló al extraer las cabeceras de Node porque `fchown`
   requiere una capacidad ausente. Corrección: reutilizar las cabeceras oficiales ya
   presentes con `npm_package_config_node_gyp_nodedir`; se conservan `--cap-drop=ALL`
   y `no-new-privileges`. [Registro](../../.cache/m08-ci-previa-cabeceras.log) y
   [resultado FAIL](../../.cache/ci-limpia-S0rr2D/checkout/cooper/.cache/puerta/resultado.json).

4. Primer recorrido completo de navegador: **40/43 PASS, tres fallos**, sin omisiones.
   Sentinel informó que faltaba `gremlins.js` y no se ejecutó caos. Se fijó la versión
   original, se comprobó su bundle y se añadió su rechazo temprano y la comprobación
   de acciones efectivas. Las otras dos pruebas detectaron el error React #418 en
   fechas de identidad: HTML UTC frente a navegador Lima. Se corrigió el formato de
   fechas en el producto, sin igualar artificialmente ambas zonas ni ignorar la consola.
   [Registro](../../.cache/m08-ci-previa-gremlins-fechas.log),
   [Sentinel previo](../../.cache/ci-limpia-DSnfQH/checkout/cooper/.cache/sentinel-marcas/informe.json).
5. Siguiente instalación: rc 0, pero cuatro avisos de npm por el `postinstall` no
   decidido de `core-js`. La puerta lo rechazó. Se revisó ese script (solo banner de
   financiación) y se declaró su denegación en `allowScripts`, sin ocultar advertencias
   ni autorizar scripts adicionales. [Registro](../../.cache/m08-ci-previa-postinstall.log).

6. Los siete comandos de `3e028fa` terminaron en rc 0, sin advertencias, con
   **290/43/147 PASS**. El agregado rechazó por error el resumen `spec` de Node al
   esperar TAP. Se añadió soporte explícito a ambos prefijos y una regresión que
   sigue rechazando fallos; se validó también contra los tres reportes reales ya
   producidos, sin modificarlos. [Registro previo](../../.cache/m08-ci-previa-reporte.log).
   La puerta final se repitió completa sobre el commit corregido y acreditó el cierre.

Las seis pruebas nuevas verifican saneamiento del entorno, rechazo de `.env` por
nombre sin lectura, alteración del guardián/bundle de caos, advertencias con rc 0 y rechazo de
omisiones/reintentos/suites vacías. Pasaron focalizadas antes del ensayo completo.
No se retiraron pruebas, no se relajaron umbrales ni se sustituyó Sentinel por un simulador.
Consulta técnica de la corrección: [React #418](https://react.dev/errors/418),
[formato con zona explícita](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat),
[política de scripts npm](https://docs.npmjs.com/cli/v12/commands/npm-install-scripts),
[reporteros oficiales de Node 24](https://nodejs.org/docs/latest-v24.x/api/test.html#test-reporters).

## Límites reales y Pendientes de Walter

- La aceptación corresponde a Linux x86_64, Debian 12 y Podman local. La alternativa
  Docker está documentada, pero no se ejecutó porque su daemon no estaba disponible.
  No se acredita Windows, macOS, ARM, Safari, un dispositivo físico ni proveedores reales.
- Se requiere acceso a registros públicos y espacio para imagen, Python, paquetes y
  navegadores. Los paquetes Debian usan su repositorio vigente; no se promete identidad
  binaria de la imagen ante futuras actualizaciones de seguridad del sistema.
- `ci:limpia` prueba **HEAD**, no cambios sin commit. Los logs y datos ficticios quedan
  ignorados en `.cache/`; publicar artefactos completos no forma parte de esta misión.
- Walter: elegir y autorizar repositorio/servicio si quiere publicar CI remoto. Sentinel
  no trae un archivo de licencia en su origen; la copia es para el ensayo interno
  solicitado y su redistribución pública requiere resolver ese permiso.
- Integrador `cooper-total`: revisar estos commits, conciliar cambios concurrentes en
  pruebas/documentación y repetir la puerta combinada. Esta misión no hace integración,
  push, despliegue, cambios en n8n/VPS/D&S Factory, OAuth, pagos ni publicaciones.

Los archivos de misión/auditoría recibidos sin seguimiento se conservan sin añadir al
commit: `docs/informes/faltantes-total.md`, `docs/misiones/_comun.md`,
`docs/misiones/total-m08.md` y `docs/misiones/AVISO-cooper-total.md`.
