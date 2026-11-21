# Revisión de dos rondas finales

Ejecutar solo después de que terminen ambas rondas y se cierren sus navegadores.
La revisión no inicia Cooper, Playwright, Sentinel ni servicios; consume los artefactos existentes.

```bash
cd cooper
python3 -B scripts/verificar-rondas.py .cache/videos-integracion3 cierre-1 cierre-2 \
  --salida .cache/videos-integracion3/revision-cierre
```

La salida debe ser nueva. No se sobrescriben rondas ni índices previos; para repetir,
use otro directorio de salida y conserve el recibo fallido. Los nombres se eligen
explícitamente: rondas anteriores no se descubren ni mezclan automáticamente.

La revisión exige la misma batería integrada en ambas rondas, todos los tests aprobados
sin omisiones ni retries, matrices de al menos 22 pantallas en 1440/390 px y ambos temas,
los umbrales originales de rendimiento, recorridos completos y los tres módulos de
Sentinel sin hallazgos no informativos. El caos debe haber ejecutado acciones reales;
sus mínimos puntuales de FPS se conservan y no se confunden con el muestreo de la matriz.

Todos los `.webm` y `.mp4`, también en subdirectorios de temporales, pasan por `ffprobe`
y decodificación completa con FFmpeg hasta `progress=end`, sin recortar tiempo/cuadros,
sin copiar streams y sin salida de errores o advertencias. Se limitan los threads para
no cargar innecesariamente la máquina. Los clips principales deben tener las dimensiones
solicitadas, y los archivos no pueden cambiar durante la comprobación. Se calculan SHA-256
de videos, capturas y una lista cerrada de informes. No se abren archivos de sesión,
credenciales ni configuraciones de los navegadores.

Solo si todo pasa se crean `index.html` e `indice.json`, con los videos principales de
las dos rondas. `verificacion.json` incluye también todos los temporales, metadatos,
conteos, resultados y huellas del índice. `PASS_TECNICO` no aprueba la revisión visual.

`revision-visual.json` comienza como pendiente y selecciona 48 capturas: Inicio, Marcas,
Cuentas, Publicados, Aprendizaje y Ajustes de fábrica; dos anchos, dos temas y dos rondas.
Inspeccionar los originales y documentar el archivo y su hash junto con las observaciones
sobre legibilidad, recortes, solapamientos, contraste, gráficos y estados. Revisar además
fotogramas de los recorridos continuos. Conservar los hallazgos; no marcar aprobadas
muestras que no se hayan visto. Los PNG se comprueban por cabecera/dimensiones y hash;
la revisión visual no se sustituye por esas comprobaciones.

Documentación oficial: [FFprobe](https://ffmpeg.org/ffprobe.html) y
[FFmpeg](https://ffmpeg.org/ffmpeg.html). No se solicita ni se inicia producción real.
