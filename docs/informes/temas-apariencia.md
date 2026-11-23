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
> Al 23-11-2026: los puntos 1 y 2 ya están hechos (aprobación del 22-11 a las 22:09 y despliegue en la PC); el 3
> se revisó en la PC. Los pendientes vigentes están en
> [Pendientes de Walter (de esta parte)](#pendientes-de-walter-de-esta-parte).

1. Ver las capturas y decir si aprueba los tres temas y que «Feria» sea el tema por defecto (hoy todos pasan a «Feria» al migrar; quien prefiera «Sala» la elige en su perfil).
2. Autorizar en su PC la puerta completa (Firefox, WebKit, Sentinel, Lighthouse) y el despliegue; aquí no hay acceso al VPS.
3. Siguen abiertos de antes: pósteres reales de los dos Shorts, métricas en 0 en Publicados y avisos de `Permissions-Policy` en consola de producción (no tocados en esta rama).

## Puerta y despliegue en la PC (22–23-11-2026)

Walter aprobó los tres temas y «Feria» por defecto el 22-11-2026 a las 22:09 (Lima). Esta parte se hizo en la PC
de Walter, sobre la rama `alegria` (`5471160` → `040407f`, 3 commits), en la worktree `temas-despliegue`.

### Resultado

- **Integrado y publicado** por avance rápido, sin forzar: `54711600..1868583b` en `mio/main` y `mio/version-chatgpt`.
- **Desplegado** en https://cooper.cooperestudio.com: commit `1868583b`, imagen
  `localhost/cooper:1868583b20a6c3552366958ab748d417dd8d37b6` (id `sha256:7ba79b5c…`).
- **Migración `0020_temas`** aplicada al arrancar: el único usuario pasó de `oscuro` a `feria`; migraciones 17 → 18;
  las 33 tablas conservan sus filas. [Antes y después](evidencias/temas-despliegue/base-antes-despues.json).

### Commits de esta parte (sobre `040407f`)

| Commit | Qué y por qué |
|---|---|
| `0698b900` | Publicados, Inicio y detalle dicen «Sin medir todavía» cuando no hay lectura, en vez de mostrar 0. Una suma parcial dice «1 de 3 medidas». Defecto 3 de correccion-produccion. |
| `000eebb3` | Atajos de Inicio de Feria: la regla mide Inicio (`@container`), no la ventana. Con Cooper abierto a 768 px se salían (4 E2E de desborde). |
| `c961c9a1` | Publicados sale en el primer HTML: se quitó su `loading.tsx`. Lighthouse de Publicados pasó de 0,83 a 1,00. |
| `67be7ffe`, `eda0e6bf`, `ef67fadb`, `1c277fbd` | Herramientas de medida: `--temas=` en la auditoría, `--tema=` en las trazas, tema y carpeta configurables en `despliegue-final/movimiento.spec.ts`, Referer en el ensayo de trazas. Ningún umbral cambió. |
| `aacba961` | Apariencia: dos cambios de tema seguidos ya no dejan una excepción sin atender («Transition was skipped», hallazgo de Sentinel) ni vuelven al tema anterior. Los guardados van en fila; manda el último toque. |
| `a259941c` | `pulido/` y `diseno-medios/` siguen a la interfaz actual: buscaban piezas que el rediseño anterior ya había quitado («En vivo», la pestaña «Fábrica», «Abrir navegación»). Se conservan todas las comprobaciones y umbrales. |
| `0cced50c` | Sentinel: el selector de temas escribe (PATCH del perfil), así que sale del caos como los demás controles que escriben. Contrato `tests/test_sentinel_exclusiones.py` ampliado: falla sin el cambio y pasa con él. |
| `5f11a820` | Tarjetas de Apariencia: la regla mide su columna (`@container`). A 768 px medían ~85 px y la muestra y el lema tocaban el borde (visto en la revisión visual). Prueba nueva en `e2e/temas.spec.ts`. |
| `1868583b` | Prueba de vista previa en móvil: lleva el medio a la vista. Con los atajos de Feria, un medio vertical solo asoma un 58 % arriba del todo y la prueba fallaba 3 de 3 a 390 px. La regla de la app (≥ 65 % visible) no cambió. |

Cada arreglo tiene su prueba, y se comprobó que la prueba falla sin el arreglo.

### Puerta completa (sobre `1868583b`, la versión desplegada)

`npm ci`, lint (`--max-warnings 0`), tipos y build sin errores ni avisos; **715/715 unitarias**; **127/127 E2E**;
**237/237 flujos**; 0 omitidas. `despliegue-final` **17/17**.

### Rondas y suites (sobre `5f11a820`; `1868583b` solo cambia una prueba de `despliegue-final/`)

| Qué | Resultado |
|---|---|
| Ronda 1 (Sentinel + Playwright; Chromium, y Firefox y WebKit en 360, 390, 768, 1024, 1440 y 1920) | **171/171** |
| Ronda 2 (igual) | **171/171** |
| Sentinel en las dos rondas, 1440 y 390 | 0 hallazgos que fallen (5 informativos en cada uno) |
| `base-diseno` | 15/15 |
| `pulido/` (matriz Feria y Sala × 6 anchos, estrés, resultados, Sentinel) | **23/23** |
| `integracion3/` | **167/167** |
| `movimiento/` | **10/10** |
| `e2e/temas.spec.ts` | 7/7 |
| `diseno-medios/` | **6/7**: las 6 anchuras sin desbordes, axe ni avisos. Falla «DIRECCION exige … colores» (ver abajo). |
| `scripts/auditoria.mjs` (todas las rutas) | rc=1: `/canales` 0,82 en móvil. **Ya fallaba igual en producción** (`5471160`: 0,82–0,83). |
| Contrato de exclusiones de Sentinel | 3/3 |
| Revisión visual propia: 3 temas × 6 anchos × 33 vistas (con Cooper abierto, «Más», detalle, formularios) | consola limpia, sin desbordes ni textos cortados; un defecto real encontrado y arreglado (`5f11a820`) |

### Lighthouse móvil y fluidez

| Página | Feria | Sala | Día |
|---|---|---|---|
| Inicio, serie 1 | 0,90 | 0,90 | 0,90 |
| Inicio, serie 2 | 0,90 | **0,89** | 0,90 |
| Publicados, series 1 y 2 | 1,00 | 1,00 | 1,00 |

Accesibilidad y buenas prácticas: 1,00 en todo. Inicio **no cumple con margen** el mínimo de 0,90: una de seis
medidas dio 0,89. Los temas no lo empeoraron: LCP 3,7–3,8 s frente a 3,7 s en producción (`5471160`, 0,90), con
+3 KB de CSS y +1 KB de JS. El LCP es el cartel del medio principal; la simulación cuenta 168 KB de fuentes y
232 KB de JS pedidos antes. [Cifras](evidencias/temas-despliegue/lighthouse.json).

Fluidez real (prueba 9 de `despliegue-final`): **60 fps** en los tres temas, a 390 px con CPU 4× y a 1440 px; p95 de
16,7–16,8 ms, 0 cuadros de más de 50 ms y CLS 0.

### Despliegue en el VPS

Mismo procedimiento de despliegue-final ([cooper-recuperacion-app](../cooper-recuperacion-app.md)), con los extras
verificados por sha256. Fuente: `git archive` de `1868583b` (sha256 `2c99f44a…`), imagen construida en el VPS (rc=0).

| Paso | Resultado |
|---|---|
| Preflight | `PREFLIGHT_PASS`, 27 archivos públicos, sin mutar |
| Preparar | `PREPARADO`, recibo `5c29b72f…`; imagen anterior `sha256:fa120a2d…` (`bc0693b4`) |
| actualizar-solo-cooper | `PASS`: reversa aislada PASS, migraciones 17 → 18, 30 tablas anteriores conservadas, servicios ajenos y Caddy sin cambios; recibo `/var/lib/cooper-operacion/solo-cooper-20261123T084056Z/resultado.json` (`a44bc2eb…`) |
| Sellar | `SELLADO`, sello `40afbcdf…` en `/var/lib/cooper-operacion/despliegue-final-app-1868583b20a6/sello.json` |

[Registro](evidencias/temas-despliegue/despliegue-vps.log). Reversa disponible: `recuperar-app.py … recuperar --sello
…/despliegue-final-app-1868583b20a6/sello.json`, que vuelve a `bc0693b4`. El env del VPS no se tocó.

### Producción (sin sesión)

Entrada 200 a 1440 y 390; 22 pantallas protegidas que llevan a `/entrar`; 6 API privadas en 401; TLS 1.3, HSTS y
nosniff; axe 0; sin desbordes ni errores de consola; OAuth no iniciado. Sin sesión, el HTML trae
`data-tema="feria"`. Los 7 servicios están `healthy` y el monitor del VPS dio `PASS` tras el despliegue.
[Resultado](evidencias/temas-despliegue/produccion-publica.json), capturas
[390](evidencias/temas-despliegue/entrada-390.png) y [1440](evidencias/temas-despliegue/entrada-1440.png).

### Lo que no se verificó, o quedó abierto

- **Pantallas con sesión en producción**: no verificadas. No hay sesión de prueba legítima y no se fabrican sesiones.
- **Firefox y WebKit** solo corren con «Feria»; «Sala» y «Día» solo se probaron en Chromium.
- **Teléfono físico, Safari y lector de pantalla**: no probados.
- **«DIRECCION exige … colores»** (`diseno-medios/`) sigue fallando. Compara cada color pintado con la paleta única
  anterior a los temas, y los tres temas mezclan sus tokens con `color-mix` a propósito (13 938 desviaciones,
  sobre todo el blanco y el lila del texto de Feria). No se tocó ni se apagó. La regla de «ningún color suelto» la
  vigila en el código `tests/tokens-diseno.test.ts`, para los tres temas, y pasa.
- **Toques muy seguidos**: durante el fundido de 240 ms, Chrome da el toque del ratón a la capa de la transición y
  ese segundo toque se pierde. `pointer-events` no lo cambia (medido). Con el teclado no se pierde nada.
- **Respaldo del despliegue**: el respaldo guarda la base completa (archivo principal + WAL), pero el sha256 del
  recibo solo cubre el archivo principal. Por eso coincide con el de ayer (`9b248110…`): los datos nuevos viven en
  el WAL. Es del guion certificado, que ya existía; no se cambió.
- **Defectos de correccion-produccion** (esa misión no había corrido):
  - 2, pósteres de los Shorts `XaNPu8nxWqM` y `3sY1JsbPxMY`: en producción `COOPER_FABRICA` no es `n8n`, así que la
    sincronización de medios está apagada a propósito (409) y los 5 medios quedan `no_disponible`. El contenedor sí
    llega a YouTube. Cambiar el env está prohibido aquí: va a Walter. Mientras tanto se ve la carátula tipográfica.
  - 3, cifras en 0: arreglado en la interfaz (`0698b900`). Los datos siguen igual: solo una publicación tiene una
    lectura (0 vistas y 0 me gusta, tomada al publicar), porque las mediciones también pasan por el puente n8n.
  - 4, avisos de `Permissions-Policy`: Cooper solo envía `camera=(), microphone=(self), geolocation=()` y Chromium
    no muestra avisos. Vienen de fuera (el navegador o la extensión del auditor, o los reproductores incrustados de
    terceros; el de TikTok llena la consola con sus propios errores). No se cambió la cabecera.

### Pendientes de Walter (de esta parte)

1. Decidir si se activa `COOPER_FABRICA=n8n` en el VPS para generar pósteres y lecturas reales (defectos 2 y 3).
2. Decidir si se recortan las fuentes (solo latín) para dar margen a Inicio en Lighthouse (0,89–0,90).
3. Decidir si la prueba «DIRECCION exige … colores» se rehace para tres temas o se retira.
4. Opcional: cargar los videos de YouTube y TikTok al tocar (sin el reproductor ajeno de entrada), para no traer su
   consola ni su peso.
5. Probar los tres temas con su sesión, en un teléfono físico y en Safari.
