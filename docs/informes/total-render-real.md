# total-render-real — MP4 real local

Misión de quinta oleada. Fecha: 2026-11-21 (Lima). Rama/worktree propios `total-render-real`, iniciados en `de397f3` de `version-chatgpt`; `git merge total-n8n-e2e` avanzó esta rama a `2dabc3a`. **Implementado y probado localmente; no integrado en main/version-chatgpt ni desplegado.** No hubo push, acceso al VPS, D&S Factory, OAuth, pagos ni publicación en redes.

## Resultado entregado

**Dos MP4 reales de 22,300167 s**, producidos con componentes ya instalados, gasto de API **US$0**. Voz española Piper 1.8.0; gráficos originales SVG rasterizados con ImageMagick; dos clips con zoom codificado y una imagen; montaje FFmpeg n9.0.2. No se descargaron activos ni modelos. Electricidad, CPU y almacenamiento local no se han valorado como coste monetario.

| Entrega local | Formato | Tamaño | SHA-256 |
| --- | --- | ---: | --- |
| [vertical.mp4](../../cooper/.cache/total-render-real/entrega/vertical.mp4) | 1080×1920, 9:16 | 2.194.048 bytes | `a403f89a7cf34d85e564178cdeb0b26548e21f804d372cf83643f0fe5ed21cbf` |
| [horizontal.mp4](../../cooper/.cache/total-render-real/entrega/horizontal.mp4) | 1920×1080, 16:9 | 3.563.845 bytes | `d951778596c7fa8b29a8e6445156e9cbe8095c8872c969f41377a01a0ba3c216` |

Ambos: H.264, yuv420p, 30 fps, 667 fotogramas, AAC 48 kHz/2 canales (narración originalmente mono), `faststart`, subtítulos quemados y pista española `mov_text` desactivada por defecto para evitar duplicación. SRT separado y extracción cotejada de sus 18 frases. [Manifiesto y versiones](evidencias/total-render-real/manifiesto.json).

## Cadena real y aislamiento

Se amplió el runner existente `ensayo-total.mjs` con `--render-local`; no se creó otra fábrica ni se alteraron los JSON de producción. Recorrido: idea/canal → guion → aprobación de guion → storyboard → aprobación del storyboard → clips/imagen y voz → composición real de n8n → MP4 FFmpeg → consulta del resultado real → control de calidad real → **aprobación final pendiente**. Nicho, biblia, guion y storyboard son entradas de prueba escritas; las revisiones de IA y los avisos conservan transportes ficticios. Las aprobaciones previas las conduce el aprobador del ensayo.

La corrida final sobre `5342602` duró **72,312 s**, entre 14:08:46 y 14:09:58 de Lima: **99 ejecuciones exitosas**, cuatro encargos terminados, 12 solicitudes al relay, cero fallos del relay y cero ejecuciones colgadas. Ninguna publicación propia; el contenedor terminó `exited`. La fila de video conserva `estado: en_proceso`, `etapa: aprobacion_final`: se detuvo deliberadamente antes de la decisión humana. [Resultado](evidencias/total-render-real/resultado.json), [traza de nodos](evidencias/total-render-real/pasos-motor.json) y [log](evidencias/total-render-real/ensayo-final.log).

Instancia nueva `cooper-total-render-real`, n8n 2.47.4, red interna de Podman sin salida externa comprobada, volumen exclusivo y puertos loopback. Se usó solo el fixture versionado de tres filas; no se copió la base real. El relay recibe operaciones cerradas por stdin/stdout, sin proxy ni socket del host. n8n conserva sus helpers de binarios y emparejamiento. Las URLs de Drive y `render-local.invalid` son identificadores resueltos contra un registro local de archivos; nunca se descargan. Publicar/OAuth falla explícitamente aunque se alcanzase por error una de esas ramas.

Piper se carga desde la instalación existente con CPU, entorno limpio, caché temporal, telemetría desactivada y `unshare --user --map-root-user --net`. Genera PCM16 mono a 22050 Hz; FFmpeg lo pasa a PCM24k y el nodo WAV real de n8n recorta silencios, mide duración y crea los WAV que consume el montaje. [Metadatos de las tres síntesis](evidencias/total-render-real/voz-1.json), [segunda](evidencias/total-render-real/voz-2.json), [tercera](evidencias/total-render-real/voz-3.json). No se usó un tono como sustituto de voz.

## Verificación audiovisual

| Comprobación | Resultado observado |
| --- | --- |
| Contenedor y pistas | ffprobe confirma MP4, H.264/yuv420p/30 fps, AAC estéreo/48 kHz y `mov_text` español en ambos formatos. |
| Duración | Composición 22,21 s; video 22,233333 s; audio/contenedor 22,300167 s. Diferencia audio/video 66,834 ms; diferencia montaje/contenedor 90,167 ms, bajo el umbral de 150 ms. |
| Audio | −16,81 LUFS integrados; pico real −4,42 dBTP. Dentro del objetivo −16±2 LUFS y sin clipping; no hay música. |
| Subtítulos | 18 frases idénticas al montaje, tiempos válidos sin solapamiento; SRT extraído de la pista coincide en texto. |
| Calidad técnica | Decodificación completa con `-xerror` y registro a nivel warning: 0 errores/0 advertencias; `blackdetect`: ningún tramo negro ≥0,1 s. |
| Imágenes y movimiento | 12 capturas revisadas (dos por escena/formato), sin texto cortado. Los fotogramas de los clips a 1/10 s difieren también al excluir títulos/subtítulos: movimiento codificado real. |
| QC n8n | `aprobado_qc:true`, `fallas:[]`, `avisos:[]`; movimiento 0,67; voces a 169/187/183 palabras por minuto. |

Evidencia: [ffprobe vertical](evidencias/total-render-real/vertical-ffprobe.json), [horizontal](evidencias/total-render-real/horizontal-ffprobe.json), [audio y cuadros negros](evidencias/total-render-real/vertical-audio-y-negros.json), [capturas verticales](evidencias/total-render-real/vertical-contacto.png), [horizontales](evidencias/total-render-real/horizontal-contacto.png), [revisión visual y movimiento](evidencias/total-render-real/revision-visual.json). Los originales PNG/WAV/SVG/ASS están junto al montaje en `.cache/total-render-real/2026-11-21T19-08-46.211Z/medios/`.

## Puerta obligatoria

**Cero errores y cero advertencias**. Los siete comandos se ejecutaron secuencialmente sobre `5342602`, sin omisiones ni reintentos de pruebas. Se reutilizaron copias de los Chromium ya instalados en cachés propias del worktree.

| Comando | Resultado | Código | Tiempo |
| --- | --- | ---: | ---: |
| `npm ci` | PASS; 0 vulnerabilidades | 0 | 5.28 s |
| `npm run lint` | PASS | 0 | 3.09 s |
| `npm run typecheck` | PASS | 0 | 3.76 s |
| `npm test` | 284/284 PASS | 0 | 22.40 s |
| `npm run test:e2e` | 43/43 PASS | 0 | 423.37 s |
| `npm run build` | PASS | 0 | 4.42 s |
| `node --test tests/flujos_v2.test.cjs` | 176/176 PASS | 0 | 1.31 s |

[Registro completo de puerta](evidencias/total-render-real/puerta.json), [unitarias](evidencias/total-render-real/unitarias.log), [E2E](evidencias/total-render-real/e2e.log), [flujos](evidencias/total-render-real/flujos.log) y [validación final](evidencias/total-render-real/validacion-final.json). Las copias versionadas de logs eliminan únicamente ANSI, retornos de carro y espacios finales; originales en `cooper/.cache/total-render-real/puerta-original/`. Las copias SRT extraídas solo normalizan el salto final; los originales permanecen con los medios. Las seis nuevas regresiones comprueban tiempos/subtítulos, rechazo de medios externos e IDs inexistentes, emparejamiento, bloqueo de publicación/OAuth y reintento exclusivo del registro de webhook.


## Cambios y commits

- `5342602` — **Genera MP4 locales con voz Piper y montaje FFmpeg desde n8n**. Modo del runner, relay/transportes locales, medios y verificaciones, helper de voz offline, seis regresiones de contratos y reproducción en README. Conserva acceso/aprobaciones y lógica del motor.
- Commit posterior **Documenta render real, evidencias y estado de la misión**: este informe, evidencia y actualización de `docs/ESTADO.md`; identificable por su mensaje en el historial. No cambia ejecución respecto del commit verificado.

Durante el desarrollo se corrigieron tres problemas comprobados: carrera de registro del webhook (reintento solo del 404 específico de n8n, nunca una mutación incierta), expresión inválida del transporte de clips que activaba su fallback y voz demasiado rápida. Se eliminó el fallback silencioso de medios locales, se ajustó la duración de Piper a 1,25 y se vinculó cada gráfico al ID de plano, independiente del orden de llegada. La aceptación final corresponde a una corrida nueva después de esas correcciones; los primeros intentos no se presentan como aprobados.

## Reproducción

Desde `cooper/`, tras `npm ci`:

```bash
npm run test:render:local
```

Requiere `podman`, la imagen n8n 2.47.4 existente, FFmpeg/ffprobe con libx264/libass/AAC, ImageMagick, Python, `unshare` y la fuente DejaVu Sans. Piper y modelo ya instalados en `~/.local/share/directora/herramientas/medios/venv/bin/python` y `voces/es_ES-davefx-medium.onnx` con su JSON. No instala ni descarga dependencias de medios. El helper independiente acepta `--python-piper`, `--modelo` y `--escala-duracion`; el runner utiliza las rutas locales predeterminadas. Si faltan, falla sin respaldo remoto.

Cada corrida crea otra carpeta de evidencia. La síntesis puede variar ligeramente en duración/bytes; los hashes anteriores identifican esta entrega concreta. Los MP4 grandes se conservan fuera de Git, con hashes versionados. No se incluyen modelos, bases, credenciales ni entornos del contenedor en la entrega.

## Producción pendiente y coste de proveedores

Para **este tipo de video gráfico** no falta un proveedor de pago: el montaje y la voz ya funcionan offline. Para operación continua falta integrar estos adaptadores locales como una opción de producción con cola, almacenamiento privado, retención y entrega autenticada a Cooper. Este relay está acotado al ensayo y no se desplegó.

Si Walter conserva la ruta cloud de los flujos actuales, faltan su habilitación y ensayo autorizado. Precios oficiales consultados el **21-11-2026**, en USD, sin impuestos ni llamadas de pago:

| Pieza | Alternativa real y tarifa | Aplicación a este video |
| --- | --- | --- |
| Voz | Gemini 3.8 Flash TTS: US$0,50/1M tokens de texto + US$9/1M tokens de audio hasta 31-12-2026; desde 01-01-2027, US$1 y US$18. Equivale a US$0,0135/min de audio ahora y US$0,027/min después. Hay nivel gratuito sujeto a sus condiciones/cuotas. [Precio oficial](https://aistudio.google.com/docs/pricing#gemini-3.8-flash-tts). | Para ~22,3 s: ~US$0,0050 de salida ahora, más texto; ~US$0,0100 desde enero. Estimación, no factura ni promesa de duración idéntica. |
| Montaje | Creatomate Essential mensual **US$54/mes**, 2000 créditos; anual US$540 (US$45/mes equivalente). [Plan](https://creatomate.com/docs/account/how-does-the-pricing-work), [créditos y conservación](https://creatomate.com/pricing). | 1080×1920×30×22,3 / 100M ≈13,87 créditos por versión, antes de redondeo. Unos US$0,375 de cuota proporcional por versión si se consume todo el plan; el desembolso sigue siendo la suscripción, no pago unitario. [Fórmula oficial](https://creatomate.com/docs/account/how-are-credits-calculated). |
| Gráficos/clip y almacenamiento | SVG/ImageMagick/FFmpeg y disco existentes: US$0 de API para este estilo. | No hace falta generar imágenes cloud ni comprar stock. Para otros estilos, avatares, clonación o alojamiento cloud hay que elegir proveedor y presupuestarlo aparte; no están probados ni incluidos en esta estimación. |

Creatomate conserva renders 30 días según su página de precios; no sustituye almacenamiento permanente. Ni el plan de ChatGPT/Claude ni este ensayo acreditan saldo/API de medios. Los importes de `costo_usd` en las filas n8n son estimaciones de sus ajustes de prueba —aparece US$0,07—, **no gasto real** de esta corrida.

## Limitaciones reales

- Es punta a punta de **producción audiovisual local** desde entradas escritas del ensayo, no generación autónoma completa del guion ni aceptación semántica de IA. No se ejercitaron proveedores cloud, la web Cooper con estas URLs, almacenamiento remoto, OAuth o redes.
- El horizontal es una adaptación del mismo Short por recorte central y recolocación de títulos/subtítulos. No se declara un video `largo` de n8n: ese formato exige ≥180 s y no se falseó ese control.
- El renderer admite este storyboard de tres escenas, una imagen/clip y una voz por escena, cortes y texto sin superposición. No interpreta toda la especificación Creatomate: no música, efectos adicionales, avatares, transiciones ni animaciones genéricas. La tercera imagen permanece fija; los dos clips sí contienen movimiento.
- Los subtítulos conservan la distribución por longitud de frase del compositor existente; no hay alineación fonética por palabra. Las medidas verifican estructura/duración/texto, no sincronía de cada sílaba ni naturalidad certificada. No hubo escucha humana ni ensayo en un teléfono físico.
- Gráficos propios esquemáticos, sin escala física ni material fotográfico. La etiqueta de banco `Pexels` aparece en los créditos de prueba porque se reutilizó su parser; el autor y los artefactos declaran origen local, no una descarga ni licencia de Pexels. No se publica ese crédito de ensayo.
- Piper es [GPL-3.0-or-later](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/LICENSING.md). La [ficha actual de davefx](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/davefx/medium/MODEL_CARD) declara dataset CC0, pero el hash del modelo instalado difiere de la revisión actual. No se redistribuyen pesos ni se certifica la procedencia de esa revisión local; hay que cotejarla antes de producción.

## Pendientes de Walter

1. Revisar ambos MP4, especialmente voz, ritmo y subtítulos; la aprobación final permanece pendiente. Esta misión no autoriza publicarlos.
2. Elegir con Claude si integrar una ruta local o continuar con Gemini/Creatomate, y fijar presupuesto, cuotas y almacenamiento. Revisar la licencia/procedencia de la voz local si se conserva.
3. Revisar los commits y decidir integración/despliegue por separado. Completar aceptación en dispositivo físico y entrega privada desde Cooper si se aprueba una ampliación; no se ha convertido en trabajo aprobado.

## Documentación técnica consultada

- [API de n8n](https://docs.n8n.io/api/authentication/) y [helper oficial de binarios](https://docs.n8n.io/code/cookbook/code-node/get-binary-data-buffer/); se reutilizan el cliente y runner existentes.
- [FFmpeg: filtros, subtítulos, zoompan, loudnorm y blackdetect](https://ffmpeg.org/ffmpeg-filters.html), [ffprobe](https://ffmpeg.org/ffprobe.html), ayuda de los binarios instalados e [ImageMagick CLI](https://imagemagick.org/command-line-processing/).
- [API Python oficial de Piper](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md). La investigación y revisión del runner se hicieron con dos subagentes en paralelo, dentro del alcance autorizado.
