# Despliegue final — rediseño «Sala de proyección»

22-11-2026, Lima. Misión `despliegue-final`, worktree `cooper-wt/diseno-final`, rama `diseno-final`.

## Resumen

- **Desplegado** en https://cooper.cooperestudio.com el commit `bc0693b4`, imagen `localhost/cooper:bc0693b4f091dad646eaecd4a462564b95cba32f`
  (id `sha256:fa120a2db5cab531d69263cf065b9843a55b6b5665a476b94effc66fdbae36ad`), con el procedimiento documentado
  (preparar → actualizar-solo-cooper → sellar). Reversa aislada PASS, respaldo sellado. Los 7 servicios quedaron sanos.
- **Puerta completa en verde** sobre `bc0693b4`: lint, tipos, 708/708 unitarias, 120/120 E2E, build y 237/237 flujos.
  **Dos rondas limpias** de Sistema Sentinel + Playwright (Chromium, Firefox y WebKit en 360, 390, 768, 1024, 1440 y
  1920): 164/164 y 164/164, sin fallos, reintentos ni omisiones. Movimiento real 17/17. Lighthouse móvil: Inicio 0,90 y
  Publicados 1,00 en rendimiento, 1,00 en accesibilidad.
- **Caddy**: parche de diseno-conexion aplicado (sin compresión en `/api/eventos` y `/api/chat`), con reversa preparada.
- **n8n**: delta de diseno-medios aplicado (PASS): conserva `url_video` y la miniatura oficial. Una sola pila n8n,
  0 entradas pausadas reabiertas, 0 disparadores nuevos, sin publicación real.
- **Producción sin sesión**: entrada, 22 pantallas protegidas, 6 APIs privadas en 401, TLS 1.3, cabeceras, axe 0 y
  Sentinel público con 0 hallazgos, a 1440 y 390.
- **No verificado**: las pantallas privadas con sesión (no hay sesión de prueba legítima en producción y no se inicia
  OAuth) y la generación de medios reales, que ocurre en la primera visita con sesión. Quedan como pendientes de Walter.

## Qué se cambió en esta misión

46 commits de `7e68eade` a `bc0693b4`. Los de producto y pruebas más importantes:

| Commit | Qué y por qué |
|---|---|
| `78fb216c`, `797e6a00`, `ea115e29`, `f0b8c7dc`, `f203536c` | Integración de las ramas df-medios, df-specs, df-movimiento, df-marcas-rendimiento y df-webkit. |
| `a434292c` | La View Transition se abre cuando la ruta ya está lista: el indicador de la barra móvil se desliza y la pantalla ya no queda quieta 327–444 ms. |
| `8cb3650c` | La imagen deja fuera las carpetas de pruebas (la compilación en el VPS fallaba con TS2307). |
| `e693c0a2` | Publicados: la fila de reserva no ensancha la página (CLS 0,338 → 0). |
| `0afb8c72` | Orbe de Cooper: póster WebP (8,6 KB) y su video se crea después de la carga. |
| `dd913c0d` | **Pausa: posición final.** Pausar (o volver a la pestaña) relanzaba las entradas desde opacidad 0; medido 10 de 10 tarjetas relanzadas. Ahora 0. |
| `2001f736`, `94ab8f33` | **Inicio sale en el primer HTML.** El `loading.tsx` del grupo envolvía también la portada y React la enviaba en un bloque oculto (`S:0`) que se revela un cuadro después; Lighthouse daba 0,84–0,90. Ahora cada sección declara su esqueleto e Inicio no. |
| `bc0693b4` | **Canales:** un `close` atrasado del `<dialog>` cerraba la hoja recién reabierta (Escape y Enter seguidos). Encontrado por la ronda 2. |
| `44a934bf` | `deploy/Caddyfile` con el parche SSE, idéntico byte a byte al aplicado en producción. |
| `5f14b855`, `9e79c7b2`, `7d64f062`, `aac16dff`, `7872aaf4`, `ac28a3db`, `ccf451f1`, `f7d6b601`, `ddf06fa3` | Pruebas de las rondas adaptadas a la interfaz nueva (estados, interacciones, pantallas, estrés, recorrido, base-diseno, movimiento y Marcas) y Firefox/WebKit en los seis anchos. Sin `skip`, `fixme` ni aserciones rebajadas: cada cambio comprueba el comportamiento equivalente y lo explica en un comentario. |

## Puerta y rondas (números reales)

| Corte | Qué | Resultado | Log |
|---|---|---|---|
| `bc0693b4` | `npm ci`, lint (`--max-warnings 0`), typecheck, `npm test`, `npm run test:e2e`, build, `node --test tests/flujos_v2.test.cjs` | todo rc=0; **708/708** unitarias en 73 archivos, **120/120** E2E (12,4 min), **237/237** flujos; 0 avisos | `cooper/.cache/calidad/puerta6/` |
| `bc0693b4` | Ronda 1 (`playwright.total-sentinel.config.ts`, `COOPER_ANCHOS_MOTORES=360,390,768,1024,1440,1920`) | **164 passed** (40,9 min), 0 inesperadas, 0 intermitentes, 0 omitidas | `rondas4/1-ronda-1.log` |
| `bc0693b4` | Ronda 2 | **164 passed** (41,2 min), igual | `rondas4/2-ronda-2.log` |
| `bc0693b4` | Matriz de diseño en seis anchos (`playwright.base-diseno.config.ts`) | **15 passed** | `rondas4/3-base-diseno.log` |
| `bc0693b4` | Movimiento real (`playwright.despliegue-final.config.ts`) | **17 passed** | `rondas4/4-movimiento.log` |
| `bc0693b4` | Lighthouse móvil | Inicio 0,90 / 1,00 / 1,00; Publicados 1,00 / 1,00 / 1,00 (rendimiento / accesibilidad / buenas prácticas), 0 advertencias | `rondas4/5-lighthouse.log` |

Cada ronda reúne: suite e2e principal (Chromium 79, demostración 29, Firefox y WebKit 3 pruebas × 6 anchos cada uno),
axe en todas las rutas (las pruebas exigen 0 violaciones), Sistema Sentinel a 1440 y 390 (recorrido, caos y
estabilidad), pantallas con CPU 1×/4×, estrés de escritorio y móvil y el recorrido completo. Todas exigen consola sin
errores ni avisos.

Historia honesta de los cortes intermedios: en `dd913c0d` las dos rondas pasaron, pero base-diseno falló (prueba con
la minigráfica vieja) y Lighthouse de Inicio dio 0,84. En `44a934bf` la ronda 1 pasó y la ronda 2 falló en Canales
(la carrera del `<dialog>`). Se corrigió la causa en cada caso y se repitió la cadena entera sobre `bc0693b4`. Los
resultados intermedios se conservan en `cooper/.cache/despliegue-final/rondas-dd913c0d/` y `rondas-44a934bf/`.

## Movimiento

Evidencia en `evidencias-diseno/despliegue-final/` ([resumen](../../evidencias-diseno/despliegue-final/MOVIMIENTO.md)):
15 videos y un JSON por punto. Transición con elemento compartido, entradas escalonadas, vista previa con MP4 real,
cifras, carrusel con inercia y tinte, Cooper abrir/cerrar/contexto, barra móvil y movimiento reducido: todo PASS a 1440
y 390. Fotogramas por traza: 60 fps medios, p95 16,7–16,8 ms, 0 cuadros de más de 50 ms y CLS 0, también a 390 con
CPU 4×. Consola: 0 errores y 0 avisos.

## Lighthouse de Inicio: causa y límite

El elemento mayor (LCP) es el texto del póster del héroe. En el navegador se pinta a unos 150 ms (primer byte 58 ms y
retraso de pintado 89 ms), pero la simulación de Lighthouse le suma las tres fuentes (Clash Display, Geist y Geist
Mono: 172 KB) y el JavaScript pedido antes (237 KB), y lo lleva a 3,7 s. Con el arreglo de `2001f736` el resultado
quedó estable en **0,90 en 10 de 10 pasadas** (`cooper/.cache/despliegue-final/lighthouse-carga-{1..5,b1..b3}`,
`lighthouse-44a934bf` y `lighthouse`); antes del arreglo, 17 pasadas de diagnóstico daban 0,84–0,90. Cumple «≥ 90» de DIRECCION §5, **sin margen**. Para
subirlo habría que recortar las fuentes (`PROCEDENCIA.md` dice que se usan enteras) o adelgazar el JavaScript inicial;
queda como mejora posible. El script `scripts/auditoria.mjs` sigue exigiendo su propio umbral de 0,95 y por eso
termina con rc=1 aunque se cumpla el de la misión.

## Push

Avance rápido (fast-forward) de `diseno-final` a `mio/version-chatgpt` y `mio/main`, sin forzar: rc=0,
`53e001f2..bc0693b4` en las dos ramas, comprobado después con `git ls-remote mio` (log en
`cooper/.cache/calidad/push.log`). Este informe, ESTADO y las evidencias van en un commit de documentación posterior,
publicado de la misma forma.

## Despliegue de la app en el VPS

Procedimiento de [docs/cooper-recuperacion-app.md](../cooper-recuperacion-app.md) sin cambiar sus órdenes, con los
extras verificados por sha256 (`recuperar-app.py` 32676c66…, `preflight.py` 787c89cb…, `codigo.json` c2e09b6a…,
`actualizar-solo-cooper.py` 74726191…). Imagen construida en el VPS desde `git archive` de `bc0693b4`
(tar sha256 `90af966e…`, compilación rc=0).

| Paso | Resultado |
|---|---|
| Preflight | `PREFLIGHT_PASS`, 27 archivos públicos, sin consumir entorno ni mutar |
| Preparar | `PREPARADO`, recibo `ca7f4c89…`; imagen anterior `sha256:71f7a389…` (b3e608e) |
| actualizar-solo-cooper | `PASS`: reversa aislada PASS, migraciones 14 → 17, 28 tablas anteriores conservadas, servicios ajenos y Caddy sin cambios, respaldo sha256 `9b248110…`; recibo `/var/lib/cooper-operacion/solo-cooper-20261122T232058Z/resultado.json` (`270bb65e…`) |
| Sellar | `SELLADO`, sello `873c4ca3…` en `/var/lib/cooper-operacion/despliegue-final-app-bc0693b4f091/sello.json` |

[Recibo público](evidencias/despliegue-final/despliegue-app.json). No se cambió el env del VPS (se conservan
`AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`).

**Reversa disponible**, en el orden inverso documentado: n8n (restaurar `snapshot_previo` `2e3f7042…` según la
[receta](evidencias/total-integrador/cierre-n8n/receta.md)) → Caddy (`caddy-reversa.patch` o
`Caddyfile.anterior` + recrear solo caddy) → app (`recuperar-app.py … recuperar --sello …/sello.json --sello-sha256
873c4ca3…`). Ojo: al reiniciar la pila, el paso de n8n recreó también los relés `chat-n8n` y `chat-runner` con la
imagen nueva; la recuperación de la app exige que vuelvan antes al corte app.

## Caddy

Modalidad canónica de [diseno-conexion](evidencias/diseno-conexion/infraestructura/README.md): huellas comprobadas
(vivo = anterior `17515ce1…`, candidato `5c62b169…`, validado antes con `caddy validate` en el VPS), instalación del
candidato y recreación **solo de caddy** con `operar.py compose up -d --no-deps --no-build --force-recreate caddy`.
Sano en 17 s; el archivo montado en el contenedor es el candidato. Por fuera: `/api/eventos` y `/api/chat` responden sin
`content-encoding` y `/entrar` sigue con gzip. [Recibo](evidencias/despliegue-final/caddy.json).

«Reconectando» ya no existe en la interfaz nueva: con la conexión sana no se muestra nada, y tras 5 s de corte real
aparece «Sin conexión, reintentando» (lo cubren `pulido/estres.spec.ts` y `e2e/conexion*.spec.ts`). Comprobarlo dentro
de una sesión privada de producción requiere la sesión de Walter.

## n8n

Delta de diseno-medios con el ensayo adaptado y declarado: export y snapshot restaurados en un clon (`36149362`, PASS
con WAL), ensayo con Docker en red aislada (aplicación, reversión y publicación PASS; respaldo = restauración sha
`3e508ff7…`). La comprobación de estado vivo (5 workflows, 0 ejecuciones nuevas o en curso) pasó justo antes. El
ejecutor certificado (`ejecutar-bundle.py`, control `7fd0d4d9…`) repitió esa comprobación con los escritores parados,
hizo y restauró su snapshot restic y aplicó.

| Campo | Valor |
|---|---|
| Estado | `PASS`, recibo `e191c026…` |
| Flujos importados / antes / después | 5 / 45 / 45 |
| Flujos ajenos, tablas de negocio | conservados; 9 tablas, 185 filas |
| Entradas pausadas reabiertas · disparadores habilitados | 0 · 0 |
| Verificación posterior (`verificar_despues.py`) | `DESPUES PASS`: los 7 jsCode nuevos, el resto idéntico, activos y publicados = borrador |
| Pila | una sola pila n8n (`cooper-n8n-1` + `cooper-runner-1`), sin marca de mantenimiento, 7 servicios sanos |

[Recibo público](evidencias/despliegue-final/n8n-delta.json). Las 2 ejecuciones en espera que ya existían siguen
cerradas.

## Producción

- Sin sesión ([resultado](evidencias/despliegue-final/produccion-publica.json)): entrada a 1440 y 390, 22 pantallas
  protegidas que redirigen a `/entrar`, 6 APIs privadas en 401, TLS 1.3, HSTS/CSP/nosniff, axe 0, sin desbordes ni
  errores, Google configurado y **OAuth no iniciado**. Capturas:
  [390](evidencias/despliegue-final/produccion-entrada-390.png) y
  [1440](evidencias/despliegue-final/produccion-entrada-1440.png).
- Sistema Sentinel público: 0 hallazgos a 1440 y 390 (recorridos y estabilidad).
  [Resumen](evidencias/despliegue-final/sentinel-publico.json).
- Servicios: los 7 `healthy` tras app, Caddy y n8n.
- Con sesión: **no verificado**. No existe una sesión de prueba legítima en producción y no se fabrican sesiones.

## Medios reales

Recuento de solo lectura en producción, solo con agregados ([detalle](evidencias/despliegue-final/medios-recuento.json)):

- Cooper tiene 5 videos y 3 publicaciones (2 de YouTube y 1 de TikTok). Las publicaciones solo traen todavía su enlace
  público, y la tabla `video_medios` existe pero está vacía.
- n8n tiene 4 publicaciones con `url_video`, que apuntan a 2 MP4 únicos en `f002.backblazeb2.com`. Con el delta, el
  puente las entrega a Cooper como montaje de cada publicación en la próxima sincronización.
- El mecanismo de diseno-medios genera póster, vista previa y tinte al primer pedido autenticado. La precarga manual
  se niega a trabajar contra la base de producción (`scripts/preparar-video-medios.ts`), y no se rodeó esa barrera.
  Por eso **no se generó ningún medio en producción**.

Esperado, no medido: los 2 videos con publicación y sus 3 publicaciones tendrán póster y vista previa reales a partir
de los MP4 de B2. Las de YouTube tienen además la miniatura oficial por oEmbed como respaldo. **Los 3 videos sin
publicación quedarán con carátula tipográfica**, porque no tienen render, miniatura ni escena: nunca se montaron.

## Defectos y límites abiertos

- Lighthouse de Inicio en 0,90 justo; la causa y las opciones están arriba.
- Una vez (ronda 1 sobre `ddf06fa3`) la auditoría axe a 360 encontró un bloque oculto de streaming (`S:`) sin revelar en
  la página ausente. No se reprodujo en 40 intentos dirigidos ni en las 6 rondas siguientes. La causa no se confirmó;
  Inicio ya no usa ese bloque.
- El agente de pantallas observó que, sin el arreglo `dd913c0d`, las entradas parpadeaban al reanudar; ya corregido.
  El riel de escritorio no se midió por separado.
- `BienvenidaAnimada` (el tour «Conocer el estudio») sigue en `src/componentes/escena-estudio.tsx` sin montarse en
  ninguna pantalla desde el rediseño. Decidir si se retira o vuelve es una decisión de diseño.
- Las pruebas de movimiento son de laboratorio (Chromium sin ventana, CPU frenada por CDP); no sustituyen un teléfono
  real, Safari real ni tecnologías de asistencia.

## Pendientes de Walter

1. Entrar con su sesión Google en producción y recorrer las pantallas; confirmar que no aparece ningún aviso de
   conexión con la conexión sana.
2. Abrir Publicados e Inicio una vez con sesión para que se generen los medios reales; después, Claude repite el
   recuento (`recuento-medios.py`) y confirma cuántas piezas quedaron con carátula.
3. Decidir si el tour «Conocer el estudio» se retira del código o vuelve al Inicio.
4. Decidir si se aceptan las fuentes enteras (Inicio en 0,90 justo) o se recortan para ganar margen.
5. Probar en un teléfono físico y en Safari.
