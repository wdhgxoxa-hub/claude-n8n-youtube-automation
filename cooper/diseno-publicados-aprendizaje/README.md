# Puerta de Publicados y Aprendizaje

Ejecutar desde `cooper/`, después de compilar una vez:

```bash
PLAYWRIGHT_BROWSERS_PATH=.cache/browsers node node_modules/@playwright/test/cli.js test --config=playwright.diseno-publicados-aprendizaje.config.ts
```

En el entorno soportado también puede ejecutarse `npm run test:e2e -- --config=playwright.diseno-publicados-aprendizaje.config.ts`, que verifica herramientas y compila antes de iniciar el ensayo. La puerta común continúa siendo independiente y obligatoria. Los puertos por defecto son 33181 y 33182; pueden sustituirse con `COOPER_E2E_PORT` y `COOPER_E2E_FIXTURE_PORT`.

## Datos y medios

El ensayo usa `scripts/e2e-server.mjs` y su emisor de sesiones local existente. La siembra localiza exclusivamente la base `.cache/e2e-*/cooper.sqlite` de este worktree que contiene el ID recién autenticado. No lee bases reales ni secretos. No añade endpoints de prueba a Next. El camino feliz lee `/api/estado` y `/api/resultados` reales, persistencia real del interruptor y medios autenticados; comprueba también que un cliente anónimo recibe 401 al pedir un póster.

Requiere `evidencias-diseno/medios/original.mp4` en la raíz del worktree. Es una copia del render existente de `diseno-medios/cooper/.cache/diseno-medios-real/original.mp4`, SHA-256 `727421fdd1fbc2c705c6457a58496e90a84349b0ae7e27ee0cd20482b084f0a3`. El script falla si falta o no coincide; no descarga ni genera material nuevo. FFmpeg extrae doce clips de un segundo, con previews de cinco segundos en bucle, de sus escenas fotográficas. Los cuatro horizontales son recortes centrales declarados. No usa miniaturas de montañas, SVG ni patrones sintéticos.

Las doce publicaciones y tres lecciones son ficticias, marcadas por el adaptador simulado; no acreditan resultados ni publicaciones externas. Las portadas de YouTube/TikTok son fotogramas del mismo render procesados por el adaptador de medios y colocados explícitamente en su caché local de ensayo; no se presentan como miniaturas oficiales. `evidencias-diseno/medios/procedencia.json` conserva segundos, formatos, tamaños, hashes y tintes. Los títulos corresponden al contenido de gasolina, caja y margen de pequeños negocios en Perú.

Solo los escenarios nombrados **vacío, carga y recuperación explícitos** interceptan `/api/resultados`, después de comprobar la pantalla normal. Separan el diagnóstico HTTP 503 provocado de cualquier error inesperado y verifican recuperación contra el backend real.

## Evidencia

La matriz 360/390/768/1024/1440/1920 guarda PNG de página completa y primer viewport para ambas pantallas y sus estados. `fullPage` usa una sola captura nativa de Chromium: no cose viewports ni repite los elementos fijos. Los vídeos WebM documentan hover real, cifras al entrar, navegación, Cooper y barra móvil. Los informes JSON incluyen axe, consola, overflow y tokens; la prueba falla si encuentra texto inferior a 12 px, radios ajenos al sistema o colores ajenos a tokens y sus derivados documentados. Los estados vacíos conservan la explicación humana y el ejemplo de una lección.

La medición de hover se ejecuta sin grabación ni traza de Playwright para evitar su coste: CPU 4× a 390 y normal a 1440; registra FPS, p95, CLS y long tasks. Sus umbrales son ≥57 FPS, p95 ≤25 ms y CLS ≤0,01. Son muestras de Chromium en laboratorio, no una certificación de un teléfono físico. Lighthouse y la revisión visual humana del informe de misión complementan esta puerta.

Lighthouse móvil de Inicio y Publicados se ejecuta aparte con `node diseno-publicados-aprendizaje/lighthouse.mjs`, usando el fixture real local de doce publicaciones. No ejecutar mediciones de rendimiento al mismo tiempo que el build u otras suites.

Después de la puerta, `node diseno-publicados-aprendizaje/indice.mjs` genera `evidencias-diseno/index.html` y un manifiesto JSON. Agrupa todos los pares de capturas por ancho, sus auditorías y vídeos para la revisión visual completa.

Documentación oficial consultada: [capturas Playwright](https://playwright.dev/docs/screenshots), [videos](https://playwright.dev/docs/videos), [axe con Playwright](https://playwright.dev/docs/accessibility-testing) y [PerformanceObserver](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver).
