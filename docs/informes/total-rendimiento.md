# Total rendimiento — cuarta oleada

21 de noviembre de 2026 (Lima). Rama y worktree propios: `total-rendimiento`, desde `de397f3` de `version-chatgpt`. Implementación local; **sin integración, push ni despliegue**. No se accedió al VPS ni se consultaron bases, medios, credenciales o archivos de entorno reales. Solo fixtures, proveedores simulados y documentación pública.

## Cambios y commits

| Commit | Cambio |
| --- | --- |
| `f72544b` | Índices SQLite, agregados de gastos acotados por fecha, orden de piezas en SQL, optimización del planificador, pruebas y benchmark. |
| `5ca7494` | Datos iniciales de Operación desde el servidor, mismo usuario/permisos/adaptadores/límite de lectura; catálogo sin validadores en el cliente; posters visibles prioritarios y decodificados antes de cargar Lottie. |
| `16488e9` | Galería de Marcas bajo demanda, videos con poster sin descarga anticipada; extracción del normalizador de enlaces sin llevar Zod al cliente. |
| `15d7e4f` | Lighthouse con caché fría y umbrales, inventario de bundles, ensayo de medios y trazas de movimiento/interacciones reproducibles. |
| `2376334` | Metadatos de umbrales en las trazas y CLS máximo 0,01 conforme a la guía de movimiento. |
| `161f4da` | Conteo de decisiones visibles en la E2E, sin contar buffers ocultos del renderizado progresivo. |
| `e8968d7` | Primera carga estable desde SSR; conserva coreografía al navegar, pausa y movimiento reducido, con regresión E2E. |
| `7aab905` | SVG prioritario de bienvenida incluido en el HTML, generado desde la misma geometría que el archivo público. |

Operación conserva actualización manual, recuperación de errores, revisión/confirmación de cambios y controles de acceso. La nueva prueba E2E verifica datos en el HTML, ausencia de la consulta inicial redundante y consulta explícita al actualizar. Se evita precargar los enlaces de Operación para no multiplicar consultas remotas al renderizar la navegación. La consulta del servidor sigue usando el mismo adaptador n8n; su latencia real no se ha medido. El estado de espera de Next sigue cubriendo esa consulta.

Las escenas, Lottie, pausa, movimiento reducido, bienvenida, microinteracciones y celebración se conservan. La primera carga presenta el contenido estable desde SSR: el desplazamiento de entrada del contenedor/título se reserva a la navegación interna, con los mismos 10 px/560 ms y 12 px/680 ms. Se actualizó la guía de movimiento y la E2E comprueba ambos casos. El poster prioritario de bienvenida se incluye como data URI en el HTML; usa exactamente los 2.629 bytes del SVG original, generados desde una única geometría. El URI codificado ocupa 4.460 bytes antes de compresión. Elimina una descarga crítica a cambio de un pequeño incremento de HTML/JS y pierde caché independiente en esa instancia. Las demás ilustraciones conservan archivos públicos y carga diferida; el reproductor sigue cargándose cuando entra en pantalla.

## Método y alcance

- Build de producción; Chromium de Playwright, datos ficticios, sesiones efímeras y puertos de loopback libres. Cada medición Lighthouse vacía la caché HTTP y conserva únicamente la sesión de ensayo. El modo anterior con `disableStorageReset` sin vaciado HTTP podía reutilizar recursos entre pantallas; no se usaron esas mediciones calientes para la comparación.
- Matriz de las 23 rutas de página: 21 privadas, entrada y revisión WhatsApp con enlace inválido. Móvil 390×900 con el perfil simulado estándar de Lighthouse; escritorio 1440×900, RTT 40 ms, 10.240 Kbps y CPU 1×. Tema oscuro, movimiento habilitado. Las rutas parametrizadas usan recursos ficticios propios. No equivale a todos los estados de cada formulario, a una campaña real ni a la revisión WhatsApp con una solicitud vigente.
- Lighthouse mide LCP/CLS y TBT; **TBT no es INP**. INP se ensaya aparte con Event Timing y clic/teclado durante las trazas. No se recogieron métricas de usuarios reales ni CrUX/RUM; por tanto no se afirma cumplir Core Web Vitals de campo al percentil 75.
- Las trazas abarcan también la página 404: 24 rutas × dos perfiles. CPU móvil 4×, escritorio 1×, sin limitación de red. Ventana de movimiento estable de 2,5 s tras 900 ms de estabilización y otra ventana durante acciones. rAF mide cadencia del navegador, no fotogramas presentados en un teléfono físico. Los eventos se exportan sin argumentos de recursos, formularios, cookies ni capturas.
- Se ejecutaron secuencialmente Lighthouse, trazas y ensayos propios. Tras detectar variación de CPU en las primeras rondas, la comparación principal de Lighthouse se repitió **en ambas revisiones** con `taskset -c 0-7`, los mismos núcleos de rendimiento del equipo. No se toma el mejor resultado por pantalla. Las trazas conservan el protocolo original sin afinidad fijada, idéntico antes/después. El equipo sigue compartido; fijar afinidad no reserva núcleos y las cifras no garantizan rendimiento en todos los dispositivos o redes.

La referencia principal de Lighthouse se recompiló desde `git archive de397f3`, build `5JgODHUK1A-uYXCnLKsPq`, con solo los scripts actuales de auditoría añadidos. No usa fuentes ni migraciones posteriores. El montaje aislado anidado produjo dos avisos de compilación documentados (raíz de workspace inferida, también al arrancar, y primera caché vacía con CI); no son parte de la puerta final de la rama. El manifiesto registra código, scripts y build. La auditoría de referencia termina con código 1 por pantallas bajo 95; es el resultado esperado del antes, separado de la puerta final verde. Bundles, medios y trazas conservan su referencia original del mismo código, build `vrGT5zosfpWOFRpn44276`. En esa primera ronda los índices se desarrollaban en paralelo; las mejoras frontend no se atribuyen a SQLite. Su antes/después se mide aparte con planes y datos idénticos.

Se conservaron los diagnósticos intermedios completos: retirar validadores del cliente redujo transferencia, pero Operación aún puntuaba 94; renderizar los datos iniciales eliminó la consulta posterior a la hidratación. La ronda fría inicial después de esos cambios dejó Canales en 94 y detalle de video en 93; estabilizar la carga inicial resolvió ambos. Inicio siguió en 94 con preload y con dos rAF antes de Lottie; esos ensayos se descartaron y no quedan temporizadores de espera en el código. Incluir su SVG pequeño en HTML dio 96 en el diagnóstico y 100 en Publicados/Aprendizaje. La matriz siguiente corresponde a una ejecución completa posterior de cada revisión, no a combinar esos diagnósticos.

## Lighthouse y Core Web Vitals de laboratorio

**46/46 mediciones finales con rendimiento ≥95, accesibilidad/buenas prácticas 100 y cero advertencias o comprobaciones binarias fallidas.** Lighthouse 13.6.0, Chromium 159.0.8154.6; build final `4Xi4psM4kl7xfruXnnLzq`, código `7aab905`. Comparación principal: una pasada fría completa por revisión con afinidad CPU 0–7; se conservaron las rondas diagnósticas anteriores, sin seleccionar el mejor resultado de cada pantalla.

| Ruta | Móvil antes → después | Escritorio antes → después | LCP móvil antes → después, ms |
| --- | ---: | ---: | ---: |
| `/` | 90 → 98 | 100 → 99 | 3.618 → 2.425 |
| `/marcas` | 92 → 100 | 100 → 100 | 3.314 → 641 |
| `/canales` | 100 → 100 | 100 → 100 | 616 → 616 |
| `/canales/:id` | 89 → 100 | 100 → 100 | 3.771 → 763 |
| `/videos` | 100 → 100 | 100 → 100 | 606 → 615 |
| `/videos/:id` | 100 → 100 | 100 → 100 | 607 → 614 |
| `/publicados` | 100 → 100 | 100 → 100 | 619 → 619 |
| `/aprendizaje` | 100 → 100 | 100 → 100 | 615 → 612 |
| `/avatares` | 100 → 100 | 100 → 100 | 617 → 613 |
| `/perfil` | 100 → 100 | 100 → 100 | 613 → 614 |
| `/admin` | 100 → 100 | 100 → 100 | 618 → 613 |
| `/radar` | 86 → 100 | 99 → 100 | 4.081 → 612 |
| `/rutina` | 89 → 100 | 100 → 100 | 3.657 → 612 |
| `/redes` | 90 → 95 | 99 → 100 | 3.630 → 2.979 |
| `/referencias` | 90 → 100 | 100 → 100 | 3.630 → 612 |
| `/cuentas` | 90 → 100 | 100 → 100 | 3.635 → 617 |
| `/programados` | 90 → 100 | 100 → 100 | 3.624 → 613 |
| `/decisiones` | 89 → 100 | 100 → 100 | 3.765 → 635 |
| `/incidencias` | 87 → 100 | 100 → 100 | 3.916 → 614 |
| `/avisos` | 88 → 100 | 99 → 100 | 3.912 → 613 |
| `/admin/fabrica` | 100 → 100 | 100 → 100 | 614 → 615 |
| `/entrar` | 100 → 100 | 100 → 100 | 611 → 611 |
| `/revisar/whatsapp/enlace-invalido` | 100 → 100 | 100 → 100 | 621 → 616 |

Máximos por perfil, no percentiles de una población de usuarios:

| Perfil | LCP antes → después, ms | TBT antes → después, ms | CLS antes → después |
| --- | ---: | ---: | ---: |
| mobile | 4.080,6 → 2.979,0 | 98,0 → 46,5 | 0,0073 → 0,0000 |
| desktop | 852,4 → 832,1 | 0,0 → 0,0 | 0,0000 → 0,0000 |

Aunque todas las puntuaciones cumplen ≥95, el LCP simulado supera 2,5 s en `/redes` (mobile: 2.979 ms). No se presenta la puntuación como cumplimiento universal de Core Web Vitals.

LCP/INP/CLS observados en trazas sin limitación de red (no comparables directamente con el LCP simulado de Lighthouse):

| Perfil | LCP máx. antes → después, ms | INP observado máx. antes → después, ms | CLS máx. antes → después |
| --- | ---: | ---: | ---: |
| mobile | 628,00 → 580,00 | 72,00 → 80,00 | 0,0000000 → 0,0000000 |
| desktop | 200,00 → 252,00 | 32,00 → 56,00 | 0,0000000 → 0,0001363 |

48/48 trazas finales completadas y dentro de los umbrales del ensayo: LCP ≤2.500 ms, CLS ≤0,01, INP observado ≤200 ms, al menos dos interacciones, FPS ≥57 y frame p95 ≤25 ms, sin frames ni tareas de ≥100 ms en las ventanas estable y de acciones. Son tolerancias de laboratorio; pasar FPS ≥57 no demuestra 60 FPS constantes. Event Timing redondea a 8 ms y puede omitir interacciones menores de 16 ms, excepto la primera; los valores censurados conservan ese límite en la evidencia. El desplazamiento no cuenta como interacción INP. El máximo de INP aumentó ligeramente en ambos perfiles, aunque permanece en 80 ms o menos; no se atribuye una mejora de INP a estos cambios.

| Perfil y ventana | FPS mínimo antes → después | Frame p95 máximo antes → después, ms | Frame máximo antes → después, ms | Long tasks antes → después |
| --- | ---: | ---: | ---: | ---: |
| mobile, estable | 60,00 → 60,00 | 16,80 → 16,80 | 16,80 → 16,80 | 0 → 0 |
| mobile, acciones | 57,79 → 58,48 | 16,80 → 16,80 | 50,00 → 50,00 | 1 → 1 |
| desktop, estable | 60,00 → 57,60 | 16,80 → 16,80 | 16,80 → 50,00 | 0 → 0 |
| desktop, acciones | 59,37 → 58,84 | 16,80 → 16,80 | 33,30 → 33,40 | 0 → 0 |

La ventana estable comprueba los efectos continuos; la ventana de acciones expone también pausas puntuales al abrir o cambiar controles. En la matriz final, Inicio escritorio tuvo 57,60 FPS y cinco intervalos de más de 25 ms, con máximo de 50 ms; Publicados escritorio tuvo 59,60 FPS y un intervalo de 33,3 ms. Por tanto, **no se alcanzó ausencia absoluta de jank en toda la ejecución**, aunque se cumplieron los umbrales del ensayo. Los long tasks de carga inicial quedan separados en cada resumen/traza. Las trazas conservan los contadores de Lottie/CSS activos para comprobar que el movimiento no se deshabilitó.

Se investigaron esas dos rutas en las trazas CDP. Durante la ventana estable de Inicio, la tarea principal más larga consumió 19,410 ms de tiempo transcurrido y solo 2,087 ms de CPU del hilo; la mayor tarea por CPU fue de 2,782 ms. Un `Paint` de 14,101 ms consumió 0,581 ms de CPU y una tarea del compositor de 41,081 ms consumió 1,693 ms. La diferencia es compatible con espera o desplanificación en el equipo compartido, pero no demuestra su causa: no se capturó el planificador del sistema operativo. Tampoco se puede asignar cada intervalo rAF a un evento CDP individual después de sanitizar los argumentos. [Chromium: duración y tiempo de CPU en trazas](https://new.chromium.org/developers/how-tos/trace-event-profiling-tool/trace-event-reading/).

Como diagnóstico adicional se repitieron ambas rutas, alternando revisiones, con afinidad CPU 0–7 y ventanas estables de 5 s. Son ocho mediciones adicionales, todas con salida 0; **no sustituyen la matriz principal** de 2,5 s sin afinidad. Resultados completos, en orden de ejecución:

| Ronda | Inicio FPS | Inicio frame máximo, ms | Publicados FPS | Publicados frame máximo, ms |
| --- | ---: | ---: | ---: | ---: |
| Antes 1 | 60,0 | 16,8 | 60,0 | 16,8 |
| Después 1 | 60,0 | 16,8 | 60,0 | 16,8 |
| Antes 2 | 59,8 | 33,4 | 60,0 | 16,8 |
| Después 2 | 59,8 | 33,3 | 60,0 | 16,8 |

Frame p95 ≤16,8 ms en las ocho; ventanas de acciones a 60 FPS, sin long tasks en ninguna ventana. El intervalo perdido de la segunda ronda aparece en ambas revisiones. No se reproduce la caída a 57,6 FPS ni se identifica una regresión de código que justifique retirar animaciones. Dos rondas no garantizan ausencia de pausas en otras condiciones. Evidencia detallada: `cooper/.cache/rendimiento/diagnostico-cadencia/resumen-diagnostico.json`, también incluida en el JSON versionado.

Long tasks de todo el documento, incluidas carga y acciones (se solapan con las ventanas anteriores; no se suman a ellas):

| Perfil | Cantidad antes → después | Duración máxima antes → después, ms | Tareas ≥100 ms antes → después |
| --- | ---: | ---: | ---: |
| mobile | 45 → 40 | 149,00 → 173,00 | 23 → 23 |
| desktop | 0 → 1 | 0,00 → 55,00 | 0 → 0 |

## Bundles y medios

| Tipo | Original antes → después, bytes | Gzip antes → después, bytes | Brotli antes → después, bytes |
| --- | ---: | ---: | ---: |
| build.js | 1.520.529 → 1.130.388 | 453.224 → 361.264 | 386.453 → 312.697 |
| build.css | 78.963 → 79.044 | 16.741 → 16.761 | 14.619 → 14.621 |
| build.woff2 | 24.836 → 24.836 | 24.864 → 24.864 | 24.833 → 24.833 |
| public.json | 63.515 → 63.515 | 5.286 → 5.286 | 4.505 → 4.505 |
| public.svg | 11.554 → 11.554 | 2.911 → 2.911 | 2.493 → 2.493 |

El inventario suma todos los chunks de la build, no una navegación; gzip/Brotli son compresiones offline, no cabeceras comprobadas del VPS.

El JavaScript total se reduce un **25,7 % sin comprimir y un 20,3 % gzip**. La transferencia JS de Inicio aumenta ligeramente por el dibujo incluido en HTML/JS; las pantallas de Operación y detalle de video reducen su carga inicial, como muestra la tabla siguiente.

| Navegación móvil | JS transferido antes → después, bytes | Total transferido antes → después, bytes |
| --- | ---: | ---: |
| `/` | 279.310 → 281.228 | 397.384 → 380.963 |
| `/radar` | 316.849 → 225.279 | 463.492 → 322.348 |
| `/programados` | 316.849 → 225.279 | 463.886 → 325.193 |
| `/videos/:id` | 319.595 → 228.711 | 434.344 → 325.942 |

Ensayo de medios ficticios (JPEG 39.889 bytes, MP4 18.666 bytes; bytes de red incluyen cabeceras):

| Momento | Solicitudes antes → después | Bytes antes → después |
| --- | ---: | ---: |
| Montaje, sin reproducir | 2 → 1 | 59.676 → 40.450 |
| Marcas, galerías cerradas | 1 → 0 | 19.226 → 0 |
| Marcas, galerías abiertas | 2 → 1 | 59.676 → 40.450 |
| Montaje, después de reproducir | 2 → 2 | 59.676 → 59.676 |
| Marcas, después de reproducir | 2 → 2 | 59.676 → 59.676 |

[Inventario de medios y propuesta de Caddy](../cooper-rendimiento-vps.md). Se mantienen SVG/JSON originales, medios privados autorizados y originales JPEG/MP4 para publicación. Las imágenes privadas conservan `unoptimized` porque el optimizador de Next no reenvía la autenticación. Marcas desmonta los reproductores al cerrar la vista previa. El montaje con poster usa `preload="none"`; sin poster conserva `metadata` para mostrar el primer fotograma. Las E2E verifican solicitudes de red y reproducción, no solo atributos.

## SQLite: consultas y coste de índices

Archivo WAL nuevo, únicamente datos ficticios: 10 dueños, 80.000 mensajes, 120.000 eventos, 120.000 gastos, 100 marcas, 500 cuentas y 24.000 piezas. Node 24.22.3, SQLite 3.54.1, Linux, Intel Core Ultra 9 275HX. Cinco calentamientos y 60 muestras secuenciales por consulta, caché caliente. SQL equivalente a los servicios; la referencia de gastos incluye su agregado JS y la de piezas su ordenamiento JS. No es telemetría de consultas lentas del VPS.

| Consulta | p50 antes → después, ms | p95 antes → después, ms |
| --- | ---: | ---: |
| Últimos mensajes | 10,289 → 0,081 | 19,529 → 0,099 |
| Cursor SSE por dueño | 5,026 → 0,018 | 7,082 → 0,024 |
| Cursor SSE administrativo | 6,722 → 0,016 | 10,404 → 0,018 |
| Historial de Operación por dueño | 5,864 → 0,204 | 7,348 → 0,561 |
| Cuentas de marca | 0,012 → 0,012 | 0,012 → 0,014 |
| Piezas de marca por fecha | 0,679 → 0,170 | 1,129 → 0,287 |
| Resumen de gastos | 87,252 → 0,972 | 110,003 → 1,533 |

Cada una de las siete consultas conserva el mismo SHA-256 antes/después; integridad `ok`, claves foráneas sin errores. Los planes evitan recorridos/ordenamientos completos para las lecturas seleccionadas. Gastos conserva un B-tree temporal para `GROUP BY` sobre el intervalo filtrado. **Cuentas de marca no muestra mejora temporal** con solo 500 filas, aunque su plan deja de recorrer la tabla. Gastos conserva permisos de administrador y las ventanas de semana/mes, incluida una semana que empieza en el mes anterior.

La migración `0011_rendimiento` crea seis índices y elimina el simple redundante de mensajes: incremento neto de cinco. La base de ensayo pasa de 70.258.688 a 88.080.384 bytes: **+17.821.696 bytes, +25,4 %**. Crearlos tomó 336,44 ms; primera optimización 170,04 ms, total 506,48 ms. Otra optimización tomó 0,099 ms; una apertura posterior con pragmas, 0,965 ms. Esta última no incluye verificación del diario de migración ni disco frío. No se midió el coste en escrituras ni bloqueo con varios procesos: revisar el tamaño real, respaldar y programar la migración antes de una integración/despliegue autorizado.

Evidencia: `cooper/.cache/rendimiento/sqlite/resultado.json`, `nota.md`, `pruebas-final.log`, `lint.log`. El benchmark y las dos regresiones de índices/cursor/permisos y períodos quedan versionados.

## Caddy: propuesta, sin aplicar

La referencia versionada no configura `encode`; eso no demuestra ausencia de compresión, porque Next comprime por defecto. Se propone negociar zstd/gzip solo en JS/CSS/JSON/SVG públicos, conservar cabeceras de Next, revalidar `/movimiento/*` sin hash, mantener privados HTML/APIs/medios y excluir SSE y archivos ya comprimidos. No se modifica `deploy/Caddyfile`.

El bloque propuesto se validó con Caddy 2.11.2 en un contenedor sin red, dominios ficticios y TLS interna: salida 0 y cero advertencias. No demuestra conectividad o rendimiento remoto. El intento HEAD público falló en DNS antes de conectar; no hay evidencia de cabeceras reales del VPS. La plantilla completa tiene una advertencia previa de HTTPS automático en el listener HTTP de redirección; no se atribuye al bloque propuesto ni se ha corregido fuera de alcance.

## Puerta y reproducción

Cadena completa terminada con código 0 sobre `7aab905`: `npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`. **0 errores y 0 advertencias; 286 pruebas unitarias en 31 archivos y 44 E2E**, incluidos Sentinel, accesibilidad, medios, permisos y movimiento. Instalación: cero vulnerabilidades. Desde la raíz, `node --test tests/flujos_v2.test.cjs`: **147/147**, cero fallos, canceladas, omitidas o pendientes. Evidencia: `cooper/.cache/rendimiento/puerta/cooper.log` y `flujos.log`.

La primera pasada terminó con 42/44 E2E: faltaba el navegador propio de Sentinel en este worktree y el conteo de decisiones incluía HTML oculto transitorio de Suspense. Se instaló Chromium en la caché local indicada por README, sin modificar Sentinel; se corrigió el selector de la prueba para contar decisiones visibles y se verificó Operación completa, 6/6. Se conservaron `puerta/cooper-intento1.log` y `cooper-intento2.log`; la última cadena completa vuelve a validar los cambios posteriores de pintura inicial y navegación. La instalación descargó la variante Linux compatible de Playwright; la compatibilidad de un teléfono físico sigue fuera de esta puerta.

Desde `cooper/`, con la build terminada y sin solapar ensayos de rendimiento:

```bash
node scripts/rendimiento-bundles.mjs .cache/rendimiento/despues/bundles.json
COOPER_AUDITORIA_SALIDA=.cache/rendimiento/despues/lighthouse taskset -c 0-7 node scripts/auditoria.mjs --rendimiento
node scripts/rendimiento-medios.mjs despues
node scripts/rendimiento-trazas.mjs --fase=despues --exigir-umbrales
node scripts/benchmark-sqlite.mjs
```

Los HTML de Lighthouse y trazas completas quedan en `.cache/rendimiento/`, fuera de Git. Las cifras comparadas y sus metadatos se conservan en este informe y su [evidencia compacta versionada](evidencia-total-rendimiento.json). Los scripts no necesitan OAuth, claves reales, acceso al VPS ni proveedores pagos. Los archivos preexistentes `docs/misiones/_comun.md` y `docs/misiones/total-rendimiento.md` se preservaron sin modificar ni incorporar a los commits.

## Pendientes de Walter

1. Revisar con Claude la rama y conciliar `0011_rendimiento` con las migraciones de otras misiones antes de integrar. Autorizar despliegue por separado; prever respaldo y ventana de migración.
2. Revisar la propuesta de Caddy y autorizar su aplicación en otra misión; comprobar cabeceras/caché, descargas privadas, rangos de video y reconexión SSE en el servidor real.
3. Aceptar animaciones y reproducción en un teléfono físico de gama media y Safari si se utiliza; comprobar las pausas puntuales descritas en las trazas. Las cifras de Chromium emulado no sustituyen esa comprobación ni garantizan 60 FPS constantes.
4. Decidir una medición autorizada de campo y de latencia del puente n8n. El simulador no estima carga real, red móvil, INP p75 ni consultas con el volumen real del VPS.
5. Si los originales reales resultan pesados, priorizar variantes privadas de vista previa WebP/AVIF y su retención. Es una propuesta futura; no se han cambiado contratos de medios ni calidad de los archivos de publicación.

## Documentación oficial consultada

- [Next: datos en componentes de servidor](https://nextjs.org/docs/app/getting-started/fetching-data), [carga diferida](https://nextjs.org/docs/app/guides/lazy-loading), [Image y autenticación](https://nextjs.org/docs/app/api-reference/components/image). También documentación incluida en Next 16.4.6 instalado.
- [web.dev: imágenes y SVG](https://web.dev/learn/performance/image-performance), [data URI para imágenes pequeñas](https://web.dev/articles/responsive-images).
- [MDN: decodificar imágenes](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode), [web.dev: rendimiento de video](https://web.dev/learn/performance/video-performance).
- [Lighthouse: puntuación y variabilidad](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring), [INP](https://web.dev/articles/inp), [Event Timing](https://www.w3.org/TR/event-timing/), [CDP Tracing](https://chromedevtools.github.io/devtools-protocol/tot/Tracing/), [Network.clearBrowserCache](https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-clearBrowserCache).
- [SQLite: planificador](https://www.sqlite.org/queryplanner.html), [EXPLAIN QUERY PLAN](https://www.sqlite.org/eqp.html), [ANALYZE/optimize](https://www.sqlite.org/lang_analyze.html), [Drizzle select](https://orm.drizzle.team/docs/select), [SQL](https://orm.drizzle.team/docs/sql).
- [Caddy encode](https://caddyserver.com/docs/caddyfile/directives/encode), [reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Next compress](https://nextjs.org/docs/app/api-reference/config/next-config-js/compress), [public](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder).
