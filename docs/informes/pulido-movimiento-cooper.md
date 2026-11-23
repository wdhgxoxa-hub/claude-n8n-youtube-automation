# Informe — pulido de transiciones y de la conversación con Cooper

Fecha: 23-11-2026 (Lima). Rama `pulido` (parte de `temas-despliegue` `468018b`, lo desplegado). Autor: Claude (Fable), sin delegar.
Estado: **implementado, probado en la PC, integrado, publicado y desplegado el 23-11-2026 (commit `942f3c0c`).** Ver «Puerta y despliegue en la PC».

## Origen
Auditoría en vivo de Claude en producción (tema «Día», sesión de Walter) tras su observación: el perrito desaparece al abrir la conversación, la conversación no se siente pulida y faltan transiciones cuidadas.

## Defectos vistos en producción y su arreglo
| # | Defecto | Arreglo |
|---|---|---|
| 1 | Al cambiar de sección las dos pantallas se fundían encima durante 0,42 s: dos títulos y dos contenidos legibles a la vez. | Relevo: la pantalla que sale se va en 0,12 s y la nueva entra cuando la otra va por la mitad. Nunca hay dos páginas legibles ni un cuadro en blanco. |
| 2 | La hoja de Cooper entraba en ese fundido y su texto se veía doble. | La hoja y el orbe tienen nombre propio de transición y quedan quietos, igual que el riel. |
| 3 | La hoja abría vacía y el contenido aparecía de golpe al terminar el resorte. | El contenido entra a los 0,22 s, cuando la hoja ya tiene su forma, en dos tiempos (cabecera, luego conversación). |
| 4 | El perrito desaparecía al abrir. | Sube a la cabecera de la hoja con un pequeño aterrizaje y vuelve al orbe al cerrar. Su aro dice si escucha, piensa o responde. No es un vuelo literal del botón a la cabecera: el contenido de la hoja se oculta durante el resorte y un vuelo real exigía una capa aparte que no sigue el arrastre de la hoja en el celular. |
| 5 | La página se encogía de golpe al abrir la hoja. | Se recoloca de una vez y reaparece con un fundido de 0,24 s. Probé antes a animar el ancho y lo descarté: recalcula toda la pantalla en cada cuadro (de ~48 a ~12 cuadros en 0,9 s en Inicio). |
| 6 | Tras elegir un destino, el riel seguía desplegado tapando el título de la pantalla nueva. | Se recoge al elegir y vuelve a desplegarse cuando el cursor sale y entra. Con teclado se despliega con el foco visible. |
| 7 | Las respuestas eran texto plano con guiones. | Párrafos, listas y **negritas** reales (`src/lib/formato-mensaje.ts`). No interpreta HTML ni enlaces: lo demás queda como texto. |
| 8 | Lo ya leído se cortaba en seco bajo la cabecera. | Se desvanece. El indicador «pensando» lleva la cara de Cooper. |
| 9 | En el riel recogido, «Aprendizaje» tocaba los bordes de su caja activa y pisaba la marca lateral (captura de Walter, 23-11 05:54). Lo había visto el día anterior y lo dejé pasar. | El relleno activo es una píldora detrás del icono y la etiqueta queda libre debajo, con 4 px de aire a cada lado del riel. Desplegado, vuelve a cubrir la fila. Medido en los tres temas. |

## Evidencia (nube, Chromium, sin GPU)
| Comprobación | Resultado |
|---|---|
| lint · typecheck · build | 0 errores, 0 advertencias |
| Unitarias | **718/719** (falla solo la caché privada de Sentinel, ausente aquí). 4 nuevas del formato de mensajes |
| E2E Chromium + demostración (119 pruebas) | **109 pasan / 10 fallan**: 9 por entorno (6 sin Sentinel, 3 por grabación de video; las mismas de siempre) y 1 intermitente ajena (`temas.spec` «cada tarjeta…», que también falla ~1 de 5 en lo desplegado). Corregida la intermitente (sondeo) y repetida 15/15 |
| `e2e/relevo-cooper.spec.ts` (nuevo, 4 pruebas) | 4/4: tiempos del relevo y Cooper fuera de él; riel que se recoge; hoja con contenido y compañero en cabecera; movimiento reducido sin animaciones |
| Fotogramas a 60–900 ms del cambio de sección y de la apertura, 1440 y 390 | Revisados uno a uno: sin páginas superpuestas, hoja estable |

## Errores propios encontrados y corregidos al probar
1. **Animar el ancho de la página** al abrir Cooper tiraba los cuadros de ~48 a ~12 en 0,9 s. Sustituido por un fundido de opacidad.
2. **Robo de foco:** al pasar a Cooper una función nueva en cada pintura, la hoja devolvía el foco al botón mientras se escribía. Lo delataron `accesibilidad-teclado.spec.ts` (2 pruebas). Corregido con identidad estable; 28/28 al repetir.
3. **Listas sin viñetas:** el reinicio global de estilos las ocultaba. Lo vi al revisar la captura; corregido.
4. **El riel se volvía a desplegar** tras el relevo porque el navegador dispara `mouseleave` con el cursor aún encima. Ahora se suelta solo cuando el cursor se mueve fuera.

Tras los puntos 2 y 3 no repetí la batería completa: repetí las pruebas afectadas (`accesibilidad-teclado`, `operacion`, `cooper`, `relevo-cooper`, `temas`), todas en verde.

## Límites reales
- **Fluidez:** este entorno dibuja por software. Abrir Cooper en Inicio da ~40 cuadros en 0,9 s frente a ~48 de la versión desplegada; la diferencia la pone el fundido de opacidad del contenido, barato con GPU y caro sin ella. **Hay que medirlo en la PC (60 fps) antes de desplegar**; si no llega, se retira el fundido (regla `ceder-sitio`) y el resto queda.
- Firefox, WebKit, Sentinel, Lighthouse, datos reales, teléfono físico y Safari: no ejecutados aquí.
- La conversación se reinicia al cambiar de sección (ya era así: cada sección tiene su contexto). No se cambió.
- Las listas se ven al terminar la respuesta; mientras llega palabra a palabra sigue siendo texto corrido.
- Para estados del perrito con expresiones distintas hacen falta las 5 imágenes en alta pendientes de Walter; hoy el estado se indica con el aro.

## Pendientes de Walter
1. Autorizar en la PC la puerta completa, la medición de fluidez y el despliegue de la rama `pulido`.
2. Entregar las 5 imágenes del perrito (reposo, escucha, piensa, responde, celebra) si quiere expresiones.
3. Decidir si la conversación debe conservarse al cambiar de sección.

## Puerta y despliegue en la PC (23-11-2026)

Misión `pulido-despliegue`, ejecutada en la PC de Walter con su aprobación del 23-11-2026 04:20 (Lima), en la worktree
`pulido-despliegue`. Rama `pulido`: `468018b` (lo desplegado) → `942f3c0c` (2 commits: `02c55d9b` pulido de Cooper y
`942f3c0c` arreglo del riel). La puerta se corrió sobre `942f3c0c`; el único commit posterior añade el guion de
medición de fluidez, la evidencia y la documentación (no toca la aplicación).

### Resultado
- **Integrado y publicado** por avance rápido, sin forzar: `468018b0..942f3c0c` en `mio/main` y `mio/version-chatgpt`.
- **Desplegado** en https://cooper.cooperestudio.com: imagen `localhost/cooper:942f3c0c2ba2cb92460f2e472194995c93fa0cff`
  (id `sha256:d9cc437d…`). Imagen anterior: `sha256:7ba79b5c…` (`1868583b`).
- Sin migraciones nuevas (18 → 18). Las 33 tablas conservan exactamente sus filas y el único usuario sigue en `feria`
  ([antes](evidencias/pulido-despliegue/huella-antes.json), [después](evidencias/pulido-despliegue/huella-despues.json)).

### Puerta completa (sobre `942f3c0c`, Chromium, en la PC)
`npm ci`, lint (`--max-warnings 0`), tipos y build: rc=0, 0 avisos. **719/719 unitarias** (76 archivos), **131/131 E2E**
(13,7 min), **237/237 flujos**, 0 omitidas, 0 intermitentes.
La puerta empaquetada (`npm run ci:local`) exige el contenedor Debian de Podman, que un agente no puede usar; se
corrieron uno por uno los mismos pasos de `AGENTS.md`.

### Ronda Sentinel + Playwright (una, como pidió la misión)
`playwright.total-sentinel.config.ts` con `COOPER_ANCHOS_MOTORES=360,390,768,1024,1440,1920` (Chromium; Firefox y WebKit
en los seis anchos; Sistema Sentinel; axe; estrés móvil; recorrido): **175 pasadas en 43,3 min**, 0 fallidas, 0
intermitentes, 0 omitidas.

### Fluidez con GPU real
GPU: Intel (Mesa, ANGLE) con composición por GPU activada (`gpu_compositing: enabled`), Chromium 159. Método de la prueba 9
de `despliegue-final`: `requestAnimationFrame` en la página, sin grabación de video, ventana fija de 900 ms desde el clic,
3 repeticiones; 1440 sin limitar y 390 con CPU 4×. Mismo guion (`despliegue-final/fluidez-pulido.spec.ts`) contra
`468018b` y contra `942f3c0c`, en «Feria» y «Día». Fotogramas por segundo medios por repetición:

| Acción | Ancho | Versión | Feria | Día |
|---|---|---|---|---|
| Abrir Cooper en Inicio | 1440 | `468018b` / `pulido` | 60, 60, 60 / 60, 60, 60 | 60, 60, 60 / 60, 60, 60 |
| Abrir Cooper en Inicio | 390 (CPU 4×) | `468018b` / `pulido` | 57,7, 60, 60 / 57,7, 60, 60 | 57,7, 60, 60 / 57,7, 60, 60 |
| Cerrar Cooper | 1440 y 390 | ambas | 60, 60, 60 | 60, 60, 60 |
| Cambiar de sección, Cooper cerrado | 1440 | `468018b` | 58,9, 58,9, 58,9, 58,9, 60, 58,9 | 58,9 en las 6 |
| | | `pulido` | 58,9, 58,9, 60, 60, 58,9, 58,9 | 58,9, 58,9, 60, 60, 60, 60 |
| Cambiar de sección, Cooper cerrado | 390 (CPU 4×) | `468018b` | 54,3, 56,6, 56,6, 56,6, 56,6, 55,5 | 54,3, 55,5, 56,6, 56,6, 56,6, 56,6 |
| | | `pulido` | 54,3, 55,5, 56,6, 56,6, 56,6, 55,5 | 54,3, 55,5, 56,6, 56,6, 56,6, 55,5 |
| Cambiar de sección con Cooper abierto | 1440 | `468018b` | 60, 58,9 ×4, 60 | 58,9 ×5, 60 |
| | | `pulido` | 58,9 ×6 | 58,9 ×6 |

- **Abrir Cooper**: el peor caso es 57,7 fps (≥ 57) y es idéntico en lo desplegado; p95 de cuadro 16,7–16,8 ms; CLS 0.
  Con el fundido del contenido no hay empeoramiento, así que **no se retiró** (`ceder-sitio` / `recobrar-sitio` siguen).
- **Cambio de sección a 390 con CPU 4×** queda en 54–57 fps con un cuadro largo de 67–100 ms al empezar, **igual en
  ambas versiones** (lo pone la carga de la ruta, no el relevo). No llega a 57 fps, ni antes ni ahora.
- A 1440, `pulido` mide CLS 0 en el cambio de sección; lo desplegado tenía 0,0004 en la mitad de las repeticiones.
- Con Cooper abierto a 390 **no existe** cambio de sección: la hoja es modal y deja la barra inferior `inert`
  (comprobado). Solo se midió en escritorio.
- Consola sin errores ni avisos en todas las corridas. [Datos](evidencias/pulido-despliegue/fluidez-pulido/) y
  [de `468018b`](evidencias/pulido-despliegue/fluidez-468018b/).

### Lighthouse móvil (solo «Feria», una serie)
Inicio: rendimiento **0,90**, accesibilidad 1,00, buenas prácticas 1,00. Publicados: 1,00 / 1,00 / 1,00. 0 advertencias.
Inicio cumple el mínimo de 0,90 sin margen (igual que antes). [Cifras](evidencias/pulido-despliegue/lighthouse.json).

### Revisión visual propia (3 temas × 390 y 1440)
Ráfagas de cuadros tras el clic, hoja de Cooper abierta, cabecera, riel recogido y barra inferior. Consola limpia.
- **Hoja de Cooper**: quieta, con el perrito en la cabecera y la sección actual bajo su nombre, en los tres temas a 390 y
  a 1440. [Hojas](evidencias/pulido-despliegue/revision/hojas-390.png), [cabeceras](evidencias/pulido-despliegue/revision/cabeceras.png).
- **Riel recogido con «Aprendizaje»**: la píldora queda tras el icono y la etiqueta debajo, sin tocar los bordes, en los
  tres temas. [Rieles](evidencias/pulido-despliegue/revision/rieles-1440.png).
- **Cambio de sección: hallazgo que corrige lo dicho antes.** El informe original dice «nunca hay dos páginas legibles».
  En las ráfagas hay **un cuadro con las dos pantallas a la vez, cada una a ~30–40 % de opacidad**, visto a 390 en los
  tres temas (a ~150 ms del clic), y a 1440 un cuadro con la página saliente ya ida y la nueva aún sin entrar (solo el
  riel visible). Es el cruce previsto del relevo (la nueva entra cuando la otra va por la mitad) y dura 1–2 cuadros, pero
  no es «nunca». No se tocó el diseño: queda en «Pendientes de Walter». [Cuadros](evidencias/pulido-despliegue/revision/).
  Con Cooper abierto a 1440 la hoja no se mueve durante el cambio en ninguno de los tres temas.

### Despliegue en el VPS
Mismo procedimiento de despliegue-final ([cooper-recuperacion-app](../cooper-recuperacion-app.md)). Fuente: `git archive`
de `942f3c0c` (sha256 `1b14fb4d…`), imagen construida en el VPS (rc=0).

| Paso | Resultado |
|---|---|
| Preflight | `PREFLIGHT_PASS`, 27 archivos públicos, sin mutar |
| Preparar | `PREPARADO`, recibo `1f1e21e5…` |
| actualizar-solo-cooper | `PASS`: reversa aislada PASS, migraciones 18 → 18, 30 tablas anteriores conservadas, servicios ajenos y Caddy sin cambios; recibo `/var/lib/cooper-operacion/solo-cooper-20261123T123242Z/resultado.json` (`9ffafdf3…`) |
| Sellar | `SELLADO`, sello `c4f374cb…` en `/var/lib/cooper-operacion/despliegue-final-app-942f3c0c2ba2/sello.json` |

[Registro](evidencias/pulido-despliegue/despliegue-vps.log). **Reversa disponible:** `recuperar-app.py … recuperar --sello
…/despliegue-final-app-942f3c0c2ba2/sello.json`, que vuelve a `1868583b`. El env del VPS no se tocó. La reversa aislada
del actualizador pasó; la reversa sellada **no se ejecutó** (solo está disponible).

### Producción (sin sesión)
22 pantallas protegidas llevan a `/entrar`; 6 API privadas en 401; TLS 1.3, HSTS y nosniff; axe 0 y sin desbordes ni
errores de consola a 1440 y 390; OAuth no iniciado. Sin sesión el HTML trae `data-tema="feria"`. Los 7 servicios están
`healthy` (Cooper y su relé con la imagen nueva, 0 reinicios). El CSS nuevo (`ceder-sitio`) está dentro de la imagen
desplegada. [Resultado](evidencias/pulido-despliegue/produccion-publica.json), capturas
[390](evidencias/pulido-despliegue/entrada-390.png) y [1440](evidencias/pulido-despliegue/entrada-1440.png).

### Lo que no se verificó
- **Pantallas con sesión en producción** (el relevo, la hoja y el riel en vivo): no hay sesión de prueba legítima; no se
  fabricaron. Lo visto es en la PC con datos de demostración.
- **Una sola ronda** Sentinel + Playwright (lo pedido), no dos. Lighthouse: una serie y solo «Feria».
- Suites `pulido/`, `integracion3/`, `movimiento/`, `diseno-medios/` y la auditoría completa: no se repitieron (la
  misión pedía solo lo listado).
- Firefox y WebKit solo dentro de la ronda (3 pruebas por ancho); la fluidez solo en Chromium.
- Teléfono físico, Safari y lector de pantalla.
- La puerta no se corrió en el contenedor Debian de `ci:limpia` (prohibido a un agente).

### Pendientes de Walter (de esta parte)
1. Decidir si se afina el relevo para que las dos pantallas nunca se vean a la vez (hoy hay 1–2 cuadros de cruce a ~30–40 %,
   y un cuadro vacío a 1440). Tocaría `::view-transition-new(root)` y la aserción de `e2e/relevo-cooper.spec.ts`.
2. Ver en producción, con su sesión, el cambio de sección, la hoja de Cooper y el riel, en los tres temas.
3. Entregar las 5 imágenes del perrito (reposo, escucha, piensa, responde, celebra) si quiere expresiones.
4. Decidir si la conversación debe conservarse al cambiar de sección.
5. Probar en un teléfono físico y en Safari. Inicio (Lighthouse 0,90) sigue sin margen.
