# Total accesibilidad

Fecha: 21-11-2026 (Lima). Rama y worktree: `total-accesibilidad`, desde `version-chatgpt` en `de397f3`.

## Alcance y cambios

- Teclado: pestañas Chat/Fábrica con flechas, Inicio/Fin, un punto de tabulación y paneles relacionados; menú móvil modal, Escape y devolución del foco; foco al contenido después de navegar. Formularios de video, identidad, marcas, operación, WhatsApp y memoria conservan un destino de foco al cerrar o avanzar.
- Lectura: títulos descriptivos en las 23 páginas, regiones principales en errores/404, nombres de medios y controles, grupos de filtros, ayudas asociadas y código WhatsApp inválido identificado. Anuncios estables para conexión, trabajo pendiente, cargas y resultados; el chat espera el final del turno para anunciar el registro.
- Contraste: bordes propios para campos, ayudas legibles en tema claro, foco visible en contenido/compositor y fondo contrastado para acciones peligrosas. La biblioteca y la entrada respetan movimiento reducido.
- Recuperación: fallos de red, tiempo de espera, respuesta ilegible, micrófono y adjuntos en español; se conservan los campos y se indica revisar el resultado antes de repetir una operación incierta. El adaptador Zod aplica el idioma español sin cambiar mensajes propios, HTTP 400 ni la restricción de CSP sin `eval`.
- Se mantienen adaptadores, contratos de acceso y simuladores. No se añadieron dependencias. Se aplicó `ecosistema-constructor` con la instrucción expresa de actualizar ESTADO y producir este informe.

## Evidencia y reproducción

La matriz nueva usa `@axe-core/playwright` existente, todas sus reglas predeterminadas, sin exclusiones ni reglas desactivadas. Abre el contenido antes de escanearlo y falla ante cualquier violación, incluso menor, y ante desbordamiento horizontal. Repite temas oscuro/claro a 360/1440 px. Las pruebas anteriores mantienen sus seis anchuras.

Resultado final con axe-core **4.14.1**: **288 auditorías, 0 violaciones de cualquier impacto, 0 referencias ARIA ambiguas y 0 desbordamientos horizontales**.

| Grupo, sumando ambos temas y anchuras | Auditorías | Violaciones |
| --- | ---: | ---: |
| Rutas y variantes | 120 | 0 |
| Formularios, menús y confirmaciones | 86 | 0 |
| Vacíos, carga, error y recuperación | 82 | 0 |

La revisión de `incomplete` detectó además referencias ARIA duplicadas al coexistir HTML de dos estados del inicio. Las trazas posteriores confirmaron un compositor activo bajo `main` y una copia del HTML transmitido bajo `body > div#S:0[hidden]`; no eran dos controles visibles. Inicio, bienvenida y formularios ahora generan identificadores por instancia con `useId`. La matriz bloquea también `duplicate-id-aria` clasificado como `incomplete` y guarda un diagnóstico estructural sin valores de campos. Los selectores E2E usan controles accesibles visibles: seguirían fallando si hubiera dos controles activos con el mismo nombre.

Inventario: 23 `page.tsx` (21 privadas, entrada y revisión WhatsApp), detalles de canal/video, cuatro etapas de video, 404, entrada denegada y enlaces caducados/sin sesión. Incluye bienvenida en tres pasos, menú móvil, formularios, validación nativa, confirmaciones, marcas con calendario/estudio/publicaciones, vacíos, carga, errores recuperables y límite de error global inducido. Los estados ficticios se sirven por HTTP/SSE interceptados en el navegador; el fallo global y las marcas de ensayo se identifican en sus informes.

Regresiones dirigidas: pestañas y navegación por teclado, salto al contenido, memoria, chat, video, marcas, operación, WhatsApp, micrófono denegado, subida interrumpida, red y respuesta ilegible, foco y contraste calculado de los estilos reales. Las pruebas usan sesiones efímeras locales, bases separadas y proveedores simulados. No se realizó OAuth, SSH, envío externo, pago, push, merge ni despliegue.

Antes de corregir se reprodujeron los bordes de campo a 1,65:1 oscuro / 1,54:1 claro, ayuda clara a 3,687:1 y ausencia de anillo en contenido/compositor. La ampliación de axe detectó además el botón de borrado a 1,12:1 (seria) y el rol modal inválido sobre `aside` (menor). Se corrigieron los fallos y las regresiones encontradas; los selectores de perfil usan roles/nombres visibles para distinguir el contenido activo de las copias ocultas conservadas por Next. En la prueba de animación se selecciona la pieza propia por su identidad: el administrador ve varios dueños con títulos de demostración iguales. Se conservan las comprobaciones de movimiento y progreso.

Contraste medido después de corregir, sobre el campo WhatsApp con estilos calculados del navegador:

| Tema | Borde/fondo (mínimo 3:1) | Ayuda/fondo (mínimo 4,5:1) |
| --- | ---: | ---: |
| Oscuro | 4,96:1 | 8,25:1 |
| Claro | 3,88:1 | 5,66:1 |

Evidencia local fuera de Git:

- `cooper/.cache/accesibilidad-previa.log`: reproducción inicial de contraste, foco y formularios.
- `cooper/.cache/accesibilidad-corregida.log`: primera pasada ampliada y hallazgos adicionales.
- `cooper/.cache/accesibilidad-identidades.log`: cinco regresiones dirigidas aprobadas después de corregir los IDs.
- `cooper/.cache/accesibilidad-controles-visibles.log` y `accesibilidad-tarjetas-con-preparacion.log`: regresiones de selectores y repetición aprobada de tarjetas con el canal de ensayo preparado.
- `cooper/.cache/accesibilidad/`: JSON completos de axe, capturas e índices por grupo/tema/anchura.
- [Resumen final de la matriz](../../cooper/.cache/accesibilidad/resumen-final.json) e [índice de revisión manual](../../cooper/.cache/accesibilidad/revision-manual.json).
- `cooper/.cache/accesibilidad-contraste.json`: razones de contraste calculadas con los estilos reales del navegador.
- `cooper/.cache/puerta-total-accesibilidad-3.json` y `puerta-total-accesibilidad-3-*.log`: commit, horas, comandos, códigos de salida y registros de la puerta final.
- `cooper/playwright-report/`: informe de la ejecución final; los hallazgos previos quedan en los registros anteriores.

Preparación local: la primera pasada de Sentinel encontró ausente su ejecutable Chromium. Se instaló el navegador en `cooper/.cache/sentinel-browsers` con el entorno Python de Sentinel ya documentado en el proyecto; no se modificó Sentinel ni se utilizó ningún servicio real. Su prueba se repite dentro de la puerta completa.

Los casos heredados de chat comparten el canal creado por el recorrido anterior. Un filtro dirigido que omitía esa preparación dejó seis casos aprobados y uno sin canal; al incluir el recorrido preparatorio, la pareja aprobó 2/2. La puerta final se ejecuta completa, sin filtros.

## Commits propios

| Commit | Cambio |
| --- | --- |
| `eae9461` | Contraste, foco visible, títulos de pantalla y regiones de error/404. |
| `b8b5fc7` | Validación Zod en español con regresión de HTTP 400 y mensajes propios. |
| `54c2dc6` | Teclado, menú móvil, pestañas, memoria, anuncios y recuperación del chat. |
| `b2f6e72` | Formularios, adjuntos, micrófono, medios y recuperación de foco. |
| `51531ad` | Matriz axe integrada en la suite obligatoria. |
| `02babd8` | Selección inequívoca de la pieza propia en la prueba de animación. |
| `ee29759` | Respeto del foco elegido durante guardados asíncronos. |
| `302a274` | IDs únicos por instancia y bloqueo de referencias ARIA ambiguas, incluidas vistas ocultas. |
| `70c84d4` | Identificadores por instancia para formularios de perfil, WhatsApp, videos, identidad y marcas. |
| `4bf543c` | Selectores de controles visibles sin cambiar las expectativas funcionales. |

El commit de cierre añade este informe y actualiza ESTADO. Los dos archivos preexistentes de `docs/misiones/` se conservaron fuera de los commits de la misión.

## Puerta completa

**PASS**, ejecutada sin filtros el 21-11-2026 de **14:05:11 a 14:15:52 (Lima)** sobre `4bf543c0156d7abe718414ed4882c67339f16066`. Los siete comandos devolvieron 0; se revisaron sus registros completos: **0 errores y 0 advertencias**. El cierre posterior modifica únicamente este informe y ESTADO.

| Comando | Resultado | Salida |
| --- | --- | ---: |
| `npm ci` | Instalación completa; 0 vulnerabilidades | 0 |
| `npm run lint` | PASS, 0 advertencias | 0 |
| `npm run typecheck` | PASS | 0 |
| `npm test` | 286/286 pruebas, 30 archivos | 0 |
| `npm run test:e2e` | 67/67 pruebas, incluida la matriz axe; 10,1 minutos | 0 |
| `npm run build` | Compilación de producción completada | 0 |
| `node --test tests/flujos_v2.test.cjs` | 147/147 pruebas; 0 omitidas | 0 |

Trazabilidad de correcciones: la primera puerta pasó sus 67 E2E, pero la revisión posterior de `incomplete` descubrió IDs ambiguos y motivó las correcciones adicionales. La segunda puerta quedó en 60 aprobadas y 7 fallidas por selectores que incluían HTML oculto; no se presenta como aprobada. La tercera puerta, descrita arriba, repite todos los comandos con los IDs y selectores corregidos. Se conservan los registros de las tres ejecuciones en `.cache`.

Para reproducir la matriz específica:

```bash
cd cooper
npm run test:e2e -- 'e2e/accesibilidad.*spec.ts'
```

La puerta obligatoria incluye esa matriz por defecto:

```bash
cd cooper
npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
cd ..
node --test tests/flujos_v2.test.cjs
```

## Límites reales

Axe y las comprobaciones de DOM/teclado no certifican por sí solas WCAG ni la experiencia con una tecnología de asistencia. Las entradas `incomplete` de axe se conservan como revisión manual pendiente, no se cuentan como aprobadas. La matriz automatiza estados representativos de cada flujo, no todas las combinaciones posibles de datos, fallos o permisos.

Quedan **160 resultados `incomplete` de `color-contrast`**, con 764 apariciones de nodos entre las muestras repetidas: rodillos numéricos recortados, navegación parcialmente cubierta o desplazable, contadores muy cortos y texto sobre imágenes. No son 160 violaciones confirmadas. El índice manual conserva los selectores y motivos, y los informes completos conservan el contexto. Se inspeccionaron capturas de perfil claro, canales, calendario de marca, Publicados, menú móvil y error global a 360 px; no se declara aprobación manual exhaustiva de esos casos.

Chromium emulado no sustituye un teléfono físico, Safari/Firefox ni NVDA/VoiceOver. La visualización de ambos juegos de tokens en páginas públicas se fuerza solo en la prueba; no se inventó un selector público de tema. El contrato de medios actual no aporta pistas de subtítulos ni audiodescripción: hay guion y controles nombrados, pero no se declara accesibilidad audiovisual completa. Ninguna muestra real privada se abrió ni reprodujo.

## Pendientes de Walter

1. Revisar los commits con Claude e integrarlos por separado; esta rama no está integrada ni desplegada.
2. Hacer aceptación manual con NVDA/VoiceOver y un móvil físico a 360 px, incluidos formularios, avisos y reproductores; revisar los casos `incomplete` guardados por axe.
3. Definir y autorizar subtítulos, transcripción y audiodescripción de los medios finales según su contenido. No se activó generación ni publicación real.

## Fuentes oficiales consultadas

- [Playwright: pruebas de accesibilidad y estados](https://playwright.dev/docs/accessibility-testing), [WAI: pestañas](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) y [diálogos modales](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- [WAI: contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [contraste de controles](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) y [foco visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).
- [MDN: micrófono y errores](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [foco](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus), [WAI: avisos de formularios](https://www.w3.org/WAI/tutorials/forms/notifications/) y [formularios por pasos](https://www.w3.org/WAI/tutorials/forms/multi-page/).
- [Zod: localización de errores](https://zod.dev/error-customization#internationalization), contrastada con la versión instalada 4.6.7.
- [React: identificadores para relaciones de accesibilidad con `useId`](https://react.dev/reference/react/useId).
- Guías oficiales incluidas en Next instalado: `03-architecture/accessibility.md`, `01-app/01-getting-started/10-error-handling.md` y `01-app/03-api-reference/04-functions/generate-metadata.md`. El anunciador de rutas prioriza `document.title`, de ahí los títulos propios por pantalla.
