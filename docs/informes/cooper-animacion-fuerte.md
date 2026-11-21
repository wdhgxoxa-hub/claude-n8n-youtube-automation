# Cooper: dirección de movimiento protagonista

Misión `cooper-animacion2`, worktree propio desde `cooper-cobertura` (`d98d497`). Cierre: 21 de noviembre de 2026, Lima. Implementado y probado; sin integración ni despliegue.

## Qué cambió

Cooper tiene una dirección de movimiento propia: una sala de montaje en la que las ideas llegan, las piezas se ensamblan y el autor decide. Las referencias, observaciones y traducción a una identidad propia están en [movimiento-cooper.md](../diseno/movimiento-cooper.md). Se inspeccionaron páginas públicas actuales, incluidos dos ganadores recientes de Awwwards; no se copiaron activos ni plantillas.

- Cuatro ilustraciones Lottie originales y reproducibles: Cooper recibe, reacciona y celebra, y la fábrica trabaja. Negro con fuego, un ojo celeste y otro verde-marrón. Posters SVG inmediatos; motor ligero y datos diferidos al entrar al viewport. Cada JSON ocupa menos de 32 KiB.
- Todas las cabeceras tienen una escena acorde al oficio de la pantalla, incluidas las once de Operación. Entrada de página, capas, luz, parallax de scroll, números en rodillos, gráfico desplegable, vacíos y carga mantienen la misma partitura.
- Bienvenida voluntaria de tres pasos, con teclado, Escape y devolución del foco. Celebración única al recibir una transición real de estado a Publicado; abrir un video ya publicado no la dispara. El ensayo usa una transición ficticia, no publica nada.
- «Pausar movimiento» persiste y sincroniza pestañas; la preferencia reducida se escucha en vivo. La pestaña oculta y los elementos fuera de vista dejan de animarse. Fallar el reproductor conserva la ilustración de reposo.
- Las propiedades animadas nuevas son transform/opacidad; sin filtros animados, WebGL ni videos decorativos. Los datos y controles nunca esperan el final de una animación.

## Hallazgos corregidos durante la validación

1. Una transición CSS que ya estaba en curso seguía brevemente después de pausar. La regla de pausa ahora cancela las transiciones además de las animaciones.
2. Dos formularios heredados tenían un guion literal sin escapar en `pattern`. Chromium interpreta el patrón con Unicode Sets (`v`); se corrigieron ambos y el recorrido compila cada patrón del DOM con esa bandera. Fuente: [documentación oficial de pattern](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/pattern).
3. La entrada de las tarjetas de la cola reducía momentáneamente el contraste de sus etiquetas en tema claro. La entrada conserva la transformación y mantiene la opacidad del texto.
4. La tabla de evolución expandida no admitía desplazamiento por teclado en móvil. Las dos regiones de datos de resultados ahora tienen foco y nombre accesible.

También se corrigió el propio ensayo: cuenta ficticia habilitada, expectativas adecuadas para un SSE finito, campos obligatorios antes de previsualizar cambios y conservación directa de los WebM de contextos independientes. Los intentos fallidos quedan en la caché y no cuentan como rondas limpias. Los umbrales de fluidez, axe y Lighthouse se conservan.

## Commits de implementación y ensayo

| Commit | Cambio |
| --- | --- |
| `2f1ff12` | Dirección visual, escenas y personajes Lottie originales; pausa completa. |
| `de12d35` | Matriz de videos, métricas y Sistema Sentinel; índice y auditoría. |
| `1b1184f` | Cuenta ficticia habilitada en el ensayo de estados. |
| `2a06988` | Comprobación de SSE finito e índice limitado a rondas limpias. |
| `bf9a830` | Completar los campos obligatorios antes de revisar cambios. |
| `a31e5d3` | Patrones de formularios compatibles con Unicode Sets. |
| `9dd03fe` | Contraste constante durante la entrada de las etapas. |
| `f852849` | Desplazamiento de tablas con teclado. |

El código medido corresponde a `f852849`; el commit de cierre añade documentación y evidencia, sin cambiar la aplicación.

## Evidencia final

### Dos rondas completas

`ronda-7` y `ronda-8`: 10/10 pruebas cada una; cero fallos, omitidas, reintentos o errores fuera de las pruebas. Cada ronda comprende 21 rutas × dos temas × dos tamaños, estados públicos/vacíos, bienvenida, audio ficticio, fábrica, celebración, pausa persistente y preferencia reducida en vivo. Ningún hallazgo axe, error de consola o desbordamiento en la matriz final.

| Medición | Ronda 7 | Ronda 8 |
| --- | --- | --- |
| Muestras de movimiento activo | 84 | 84 |
| FPS mínimo–máximo | 59,999–60,007 | 59,999–60,007 |
| p95 máximo / frame máximo | 16,8 / 16,8 ms | 16,8 / 16,8 ms |
| Long tasks / CLS máximo en las muestras | 0 / 0 | 0 / 0 |
| Sentinel: destinos por tamaño | 30 / 30 | 30 / 30 |
| Acciones de caos: escritorio / móvil | 6.304 / 9.462 | 7.752 / 9.421 |
| Errores o advertencias de Sentinel | 0 | 0 |

CPU 4× en la matriz de 390 px; CPU normal en 1440 px. Sentinel ejecuta sus módulos existentes sin modificar sus evaluadores ni el guardián: recorridos, caos y estabilidad. Acumuló 32.939 acciones de caos. Sus lecturas móviles fueron 60–61 fps; en escritorio hubo mínimos puntuales de 20 fps, sin caída sostenida, congelación ni cierre del navegador. Cada ronda tiene una nota informativa de cobertura sobre la pestaña móvil Fábrica, descrita en las limitaciones. El consejo informativo de Playwright de paralelizar el archivo largo de Sentinel no se aplica a esta medición secuencial de rendimiento.

Los resultados íntegros se conservan en `cooper/.cache/videos-movimiento/ronda-{7,8}/`. El [resumen verificable](evidencias/cooper-animacion-fuerte/rondas.json) y las matrices por pantalla se versionan. El índice de revisión está en [cooper/.cache/videos-movimiento/index.html](../../cooper/.cache/videos-movimiento/index.html).

**176 videos WebM VP9**, 88 por ronda: 84 recorridos de pantalla y cuatro clips de estados/interacciones. Resoluciones verificadas: 1440×900 y 390×900; duración de 4,96 a 16,52 segundos; 151.277.874 bytes en total. FFmpeg decodificó los 176 archivos completos sin errores. [Manifiesto con SHA-256, resolución y duración](evidencias/cooper-animacion-fuerte/videos.json), [verificación de decodificación](evidencias/cooper-animacion-fuerte/decodificacion.json). Se inspeccionaron capturas y fotogramas extraídos de las grabaciones, incluida la bienvenida móvil.

### Lighthouse y puerta obligatoria

Lighthouse terminó las **84 mediciones** (21 rutas × dos temas × móvil/escritorio): **96–100 en rendimiento, 100 en accesibilidad y 100 en buenas prácticas**. Cero advertencias y cero comprobaciones binarias fallidas. [Resumen íntegro](evidencias/cooper-animacion-fuerte/lighthouse.json); los HTML por ruta quedan en `cooper/.cache/videos-movimiento/lighthouse/`. Se usó compilación de producción, sesión ficticia autenticada y auditorías secuenciales en Chromium local.

Puerta completa ejecutada en orden el 21-11-2026, **07:21:39–07:26:47 Lima** sobre `f852849`:

| Comando | Resultado |
| --- | --- |
| `cd cooper && npm ci` | rc 0; sin advertencias |
| `npm run lint` | rc 0; cero errores y advertencias |
| `npm run typecheck` | rc 0 |
| `npm test` | 263/263, 29 archivos |
| `npm run test:e2e` | 40/40 |
| `npm run build` | rc 0 |
| Desde la raíz: `node --test tests/flujos_v2.test.cjs` | 146/146 |

**Todos los comandos terminaron con código 0 y sin advertencias.** [Evidencia con horarios y hashes de logs](evidencias/cooper-animacion-fuerte/puerta.json); logs locales en `cooper/.cache/puerta-movimiento/`. El recopilador inicialmente interpretó el argumento de ESLint `--max-warnings 0` como una advertencia; se corrigió la detección y se repitió la secuencia íntegra. ESLint no había emitido ninguna advertencia.

[Entorno y versiones](evidencias/cooper-animacion-fuerte/entorno.json): Node 24.22.3, Next 16.4.6, React 19.3.1, Playwright 1.65.1, Lighthouse 13.6.0 y Lottie-web 5.13.0. La configuración de ensayo, el generador de activos, la auditoría y el índice son reproducibles con los comandos del README de Cooper.

## Integración

No se fusionó ni se hizo push. Al cierre, `version-chatgpt` y `cooper-vps-real` siguen en `16341ab`; el informe de VPS declara fase A completada y fase B pendiente de IP, SSH y DNS, sin despliegue remoto. El log del orquestador tampoco acredita un cierre completo. Por tanto, aún no se cumple la condición de integración heredada de cobertura/pulido. La rama conserva la base de cobertura, incluidas memoria y pulido, y queda lista para revisión independiente de Claude.

## Alcance y limitaciones reales

Las pruebas usan compilación de producción, Chromium local, puertos loopback libres, base efímera, sesiones ficticias y proveedores simulados. CPU 4× a 390 px aproxima carga móvil; no certifica 60 fps en un teléfono físico ni en todos los navegadores. Los FPS se miden con requestAnimationFrame durante movimiento activo; Lighthouse cubre la carga inicial. La cadencia de codificación de los WebM es distinta de la cadencia de renderizado.

Sentinel informa que la pestaña móvil Fábrica no tiene URL propia: su módulo de recorridos la abre, pero caos/estabilidad por ruta no la seleccionan directamente. Playwright complementa esa cobertura con selección de etapas, estado de publicación, pausa y grabación de la fábrica. Esta nota de cobertura es informativa, no un fallo ocultado. Las lecturas puntuales del caos se conservan separadas de la muestra controlada de animación: no se promete 60 fps constantes bajo una ráfaga artificial de miles de acciones.

Transform/opacidad reduce el trabajo por fotograma; la promoción efectiva a GPU depende del navegador. El parallax tiene fallback estático si no hay scroll timeline. No se afirma que los resultados locales sean Core Web Vitals de producción.

La publicación y celebración se validan con eventos simulados. No hubo despliegue, acceso al n8n vivo, cambios a D&S Factory, login OAuth, pagos ni lectura de valores de credenciales. Las grabaciones muestran datos de ensayo. La caché de videos no se versiona; el informe conserva un manifiesto verificable para la revisión local.

## Pendientes de Walter

- Revisar con Claude los videos y la dirección visual; los requisitos estéticos finales requieren su criterio.
- Probar en un teléfono físico de gama media, incluido Safari si forma parte de los dispositivos de uso.
- Integrar en `version-chatgpt` cuando haya concluido la misión del VPS, conforme a las condiciones heredadas de cobertura/pulido. Conservar las migraciones y el lote revisable de cobertura.
- Después de la integración y autorización operativa correspondiente, comprobar la celebración con una publicación real y medir rendimiento en el destino. Esta misión no autoriza ese despliegue.
