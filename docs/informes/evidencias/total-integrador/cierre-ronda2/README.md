# Cierre de segunda ronda Sentinel + Playwright

Aceptación de laboratorio: **PASS**, 2026-11-21 18:19:09 Lima.

Se recuperó la ejecución original del contenedor `cooper-integrador-rondas-estres`, que continuó después del corte de sesión. No se repitieron rondas ni la puerta completa aprobada; no se modificó producto. El código de referencia es `5e8e26020d6fdf69538de91194860c006d5f6b29`, archivo fuente SHA-256 `a39f202e60692238aca610cc6f734e946f4da52193dcef17faa02f06c1379e3c`. La equivalencia de los ocho árboles/archivos de runtime con la imagen b3 y HEAD af2774c está en [procedencia.json](procedencia.json).

- Las dos rondas consecutivas terminaron **123/123**, sin reintentos, omisiones, inestables ni errores. El runner original registró `rc 0`, `advertencias 0` en ambas y terminó a las **18:10:49 Lima**. Las sugerencias informativas de archivo lento permanecen en el log original recuperado.
- Matriz controlada: 88 pantallas por ronda (22 rutas × 2 anchos × 2 temas), mínimo ~59.999 FPS, CLS 0, tareas largas 0.
- Sentinel amplio: 25 rutas por ancho y ronda. Acciones de caos: ronda 1, 6107 escritorio + 9562 móvil; ronda 2, 6020 + 9133. Sin congelaciones, caídas ni hallazgos no informativos. Hay un aviso informativo por ronda móvil sobre una subvista sin URL propia. El caos incluye mínimos puntuales de FPS de 20/60 en ronda 1 y 5/20 en ronda 2; esto no prueba 60 FPS uniformes durante caos.
- El verificador existente terminó `PASS_TECNICO`, `rc 0`: **3576 archivos de vídeo** decodificados completos, **301672 cuadros**, cero diagnósticos de FFmpeg/FFprobe. Incluyen copias y auxiliares; son 188 clips principales. También verificó 408 PNG y las huellas de los informes.
- Revisión visual efectuada: **48 capturas originales + 32 fotogramas** de los cuatro recorridos completos, mediante ocho planchas, sin nuevos defectos visibles. Los manifiestos registran cada archivo, instante y SHA-256. No es una revisión cuadro a cuadro de todos los vídeos.

El recibo final es [aceptacion.json](aceptacion.json). El informe automático [revision-tecnica/verificacion.json](revision-tecnica/verificacion.json) se conserva sin alterar: su campo visual queda «pendiente» por diseño del script, y la inspección posterior se acredita en [revision-visual-parcial.json](revision-visual-parcial.json) y [fotogramas/manifest.json](fotogramas/manifest.json). [revision-tecnica/index.html](revision-tecnica/index.html) enlaza a los clips originales locales; estos permanecen bajo `.cache/total-integrador/rondas-estres/checkout/cooper/.cache/videos-integracion7/cierre-{1,2}` y no se incorporan duplicados al repositorio.

## Órdenes y procedencia

El runner existente ejecutó dos veces consecutivas `npm run test:e2e -- --config=playwright.total-sentinel.config.ts`. Este frente solo recuperó su salida mediante `podman logs --follow cooper-integrador-rondas-estres` y ejecutó después:

```sh
python3 -B cooper/scripts/verificar-rondas.py .cache/total-integrador/rondas-estres/checkout/cooper/.cache/videos-integracion7 cierre-1 cierre-2 --salida docs/informes/evidencias/total-integrador/cierre-ronda2/revision-tecnica
```

Los fotogramas se extrajeron con FFmpeg en instantes referidos por el recorrido original, sin alterar los vídeos. Documentación oficial consultada: [Playwright CLI](https://playwright.dev/docs/test-cli), [vídeos de Playwright](https://playwright.dev/docs/videos), [FFmpeg](https://ffmpeg.org/ffmpeg.html). Sentinel fijado en `6764bbdcab91719947e93ba1cc476cbefafb58e8`.

## Límites y Pendientes de Walter

Estas pruebas usan datos y sesiones simulados; no verifican OAuth de producción ni teléfonos físicos. Marcas y Publicados móvil conservan elementos desplazables horizontalmente; la captura fija no muestra todos a la vez. No se tocaron secretos, n8n, OAuth ni producción. **No surgieron pendientes nuevos de Walter en esta segunda ronda**; no se eliminan pendientes de otros frentes. Este recibo autoriza la aceptación del laboratorio, no acredita por sí mismo despliegue o funcionamiento de conectores reales.
