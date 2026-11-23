# Informe — temas de apariencia (Feria, Sala y Día)

Fecha: 22-11-2026, 22:10 (Lima). Rama `alegria` (parte de `diseno-final` `5471160`, lo desplegado). Autor: Claude (Fable), sin delegar.
Estado: **implementado y probado en la nube. No integrado en `main`, no publicado, no desplegado.**

## Qué pidió Walter
1. Rediseño alegre, de alto contraste y entendible por cualquiera («Feria»).
2. Conservar la interfaz anterior como opción («Sala») y añadir una tercera clara, en el lenguaje de la web de Apple y con vidrio esmerilado («Día»), elegibles desde la configuración.

## Qué se hizo
- **Tres temas por persona.** Selector «Apariencia» en «Tu perfil»: tres tarjetas con miniatura dibujada con los tokens reales de cada tema. Se aplica al tocar, se guarda solo en el perfil (`users.theme`) y acompaña a la persona en todos sus dispositivos; si otra pestaña o equipo lo cambia, el estado en vivo lo trae. Si el guardado falla, vuelve el tema anterior y lo dice.
- **Sin parpadeo.** El servidor pinta `<html data-tema>` según la sesión (sin script en línea). Sin sesión: «Feria».
- **Una sola fuente.** Los tres temas son bloques de `src/app/tokens.css`; ninguna hoja se bifurca por tema. El carácter de cada uno (cuánto color de sección entra en iconos, cifras, atajos, ambiente) se expresa con porcentajes.
- **Cine.** En «Día» los medios y lo que flota sobre ellos (`data-cine`) conservan tokens oscuros.
- **Migración `0020_temas`:** los valores históricos (`oscuro`, `claro`, `sistema`), que nunca tuvieron selector, pasan a `feria`. La API de perfil solo acepta `feria`, `sala`, `dia`.
- **Feria (commits anteriores de la rama):** paleta por sección, tres atajos grandes en Inicio, carátula tipográfica en estados definitivos sin póster, respuesta elástica en controles.

## Defectos propios encontrados y corregidos durante la verificación
1. **Desplazamiento de contenido (CLS) en Fábrica.** Mi primer arreglo de «caja vacía» mostraba la carátula también mientras el medio venía en camino; varias pantallas se componen distinto con carátula y, al llegar el póster, el título saltaba (CLS 0,012 a 390 y 0,001 a 1440). Lo delató `videos-medios-fluidez.spec.ts`. Corrección: en camino = caja reservada con brillo; carátula solo en estados definitivos (sin medio, no disponible, carga fallida). CLS de nuevo 0.
2. **Color derivado resuelto en `:root`.** `--acento-suave` y la luz de ambiente quedaban siempre en coral porque el `var(--acento)` se resolvía en `:root`. Corrección: porcentajes por tema y mezcla en el punto de uso.
3. **Texto ilegible en «Día».** La nota bajo el reproductor heredaba tokens de cine sobre fondo blanco; axe no lo marcó. Corrección: `.real-player` sale del ámbito de cine. Para que no se repita, `e2e/temas.spec.ts` mide el contraste real de cada texto contra su fondo compuesto.
4. **Selector desincronizado.** Con estado local, un remontaje podía dejar el radio marcando un tema distinto al pintado. Corrección: la verdad es el perfil guardado; el estado local solo cubre el instante del guardado.

## Evidencia (ejecutada en la nube, Chromium)
| Comprobación | Resultado |
|---|---|
| `npm run lint` · `npm run typecheck` · `npm run build` | 0 errores, 0 advertencias |
| Unitarias (`npm test`) | **711/712**. Falla solo la caché privada de Sentinel, ausente en este entorno |
| Flujos (`node --test tests/flujos_v2.test.cjs`) | **237/237** |
| E2E Playwright, batería completa | **104 pasan / 21 fallan**, los 21 por entorno: 12 sin Firefox/WebKit instalados, 6 sin Sentinel, 3 por grabación de video (ffmpeg del entorno; los mismos 3 fallan en `5471160`) |
| `e2e/temas.spec.ts` (nuevo, 5 pruebas) | 5/5: selector por toque y teclado, persistencia tras recargar, fallo de guardado, y por tema: 6 rutas × 2 anchos sin desbordes, sin avisos de consola, axe WCAG 2.2 AA y contraste real |
| Barrido propio: 3 temas × 18 rutas × 2 anchos = 108 páginas | 0 violaciones axe, 0 textos bajo AA, 0 desbordes, 0 avisos de consola |
| Interacciones en «Día» (Cooper abierto, «Más», detalle de video, pedir video) a 1440 y 390 | axe 0 en las 10 |
| Contraste mínimo medido en pantalla | Feria 5,14 · Sala 5,36 · Día 4,82 (mínimo exigido 4,5) |
| Guardián de tokens | 3 paletas fijadas + contraste AA de texto, acentos y tinta sobre color en cada tema; comprobado que falla si se degrada un color |
| CLS en Fábrica (`videos-medios-fluidez`) | 0 a 390 y 1440; ≥57 fps, p95 ≤25 ms |

Capturas: `evidencias-diseno/temas/` (36 de pantallas por tema, 10 de interacciones, y `barrido-108-paginas.json`).

## Cambios en pruebas existentes
- Las pruebas que guardaban `theme: "oscuro"`/`"claro"` usan ahora `feria`/`sala`/`dia` (unitarias, `e2e/`, `pulido/`, `movimiento/`, `integracion3/`, `diseno-medios/`, `scripts/auditoria.mjs`, `scripts/rendimiento-trazas.mjs`). Las de `pulido/`, `movimiento/`, `integracion3/`, `diseno-medios/` y los dos scripts **no se ejecutaron aquí**.
- `e2e/accesibilidad.spec.ts` y `e2e/diseno.spec.ts` esperan a que el recorrido de etapas termine su entrada (opacidad 0,45 → 1) antes de medir contraste. Era una carrera previa: en este entorno fallaba 1 de cada 4 veces, también en `5471160`. Tras el cambio: 12/12 en dos repeticiones.

## Límites reales (no verificado)
- **Firefox y WebKit**: no instalados aquí. `e2e/multiengine.spec.ts` (12 pruebas) no corrió.
- **Sentinel** (6 E2E + 1 unitaria) y las dos rondas Sentinel: no ejecutables aquí.
- **Lighthouse** y fluidez a 60 fps de los temas nuevos: no medidos. El vidrio de «Día» usa el mismo `backdrop-filter` que ya tenían riel y barra, pero no hay cifra.
- **Datos reales**: todo se probó con datos de demostración; no con la sesión de Walter ni con pósteres reales de YouTube.
- **Teléfono físico, Safari y lector de pantalla**: no probados.
- Contraste de bordes de campos (3:1) no se elevó: es el mismo criterio que ya tenía «Sala».
- Durante el fundido de cambio de tema (0,24 s) la página no recibe toques.

## Pendientes de Walter
1. Ver las capturas y decir si aprueba los tres temas y que «Feria» sea el tema por defecto (hoy todos pasan a «Feria» al migrar; quien prefiera «Sala» la elige en su perfil).
2. Autorizar en su PC la puerta completa (Firefox, WebKit, Sentinel, Lighthouse) y el despliegue; aquí no hay acceso al VPS.
3. Siguen abiertos de antes: pósteres reales de los dos Shorts, métricas en 0 en Publicados y avisos de `Permissions-Policy` en consola de producción (no tocados en esta rama).
