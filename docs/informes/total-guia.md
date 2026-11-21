# total-guia — guía de uso de Cooper

Fecha de cierre: **2026-11-21 12:30 (Lima)**.

Rama/worktree: `total-guia`, `/home/david/Proyectos/cooper-wt/total-guia`. Base de `version-chatgpt`: `de397f3195856c10b6a9959171ff42da4328d9ec` (integración 3 local). No se incorporaron ramas concurrentes.

## Entrega y commits

| Commit | Contenido |
| --- | --- |
| `0bd15f8c3fd228d8a20d37050bfdd19a7e168e0a` | Guía en español, 13 capturas Playwright, manifiesto y reproducción documental. |
| Commit de cierre de esta misión | Este informe, evidencia de la puerta y actualización de ESTADO; identificar con `git log -1 -- docs/informes/total-guia.md`. |

Entrada de lectura: [docs/guia/README.md](../guia/README.md). Siete capítulos con pasos numerados: acceso y roles; secciones y chat; video con dos aprobaciones; marcas y cuentas con ejemplos de iglesia, tienda y trabajador; WhatsApp; problemas; glosario. Distingue canal, marca, cuenta, aprobaciones de videos y aprobación administrativa de piezas. Explica privacidad, datos ausentes, simulación, resultados inciertos y cómo informar a Walter sin repetir una orden.

Solo se modificaron documentación y capturas bajo `docs/`. Sin cambios de aplicación, pruebas, dependencias, workflows ni despliegue. Se conservaron sin seguimiento los archivos preexistentes `docs/misiones/_comun.md` y `docs/misiones/total-guia.md`.

## Capturas y fidelidad

- Trece PNG originales de Playwright sobre un build local del código integrado, con adaptadores simulados y base temporal propia. Escritorio 1440 × 1000, celular 390 × 844, tema oscuro y movimiento reducido. Dos imágenes de Marcas son capturas directas de elementos; las demás, páginas completas.
- Reutilizados `scripts/e2e-server.mjs` y `scripts/e2e-fixtures.ts`, puertos libres loopback y sesión ficticia. No se utilizó la instancia instalada ni se inició OAuth. El navegador de captura bloqueó destinos ajenos al ensayo. Se cerró el servidor al terminar.
- [Índice y script reproducible](../guia/capturas/README.md); [manifiesto con SHA-256, rutas, tamaños y versión de Chromium](../guia/capturas/manifest.json). Verificados 13/13 hashes, títulos/controles legibles y ausencia de errores de página en el recorrido. La tarjeta del chat se regeneró esperando a que terminara la respuesta y se habilitara Confirmar.
- **Competencia no existe en esta base integrada.** Se verificaron rutas, navegación y componentes: no hay pantalla ni control con ese nombre. La guía dedica una sección a ese límite y diferencia Radar, referencias por video, referencias de personajes/escenarios y Estudio de cuentas propias. No se inventó una captura ni se usó una rama pendiente como si estuviera integrada.

Fuentes revisadas: especificación, ENTREGA, README, ESTADO, guía de movimiento, documentación existente de Marcas/WhatsApp, componentes y E2E de esta base. Para la captura se consultaron las páginas oficiales de [screenshots](https://playwright.dev/docs/screenshots) y [BrowserContext](https://playwright.dev/docs/api/class-browsercontext). No se implementó ni llamó ninguna API externa de publicación.

## Puerta obligatoria

Código ejecutable: base `de397f3`, sin modificaciones en esta misión. La segunda ejecución comenzó con la guía ya preparada y terminó con su commit documental `0bd15f8`; no hubo cambios ejecutables durante ella. Node 24.22.3, npm 12.2.2, Next.js 16.4.6, Vitest 4.1.12, Playwright 1.65.1.

Desde `cooper/`, cadena exacta, registro conjunto de salida estándar/error y conservación del código de salida:

```bash
npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build
```

Desde la raíz:

```bash
node --test tests/flujos_v2.test.cjs
```

| Comando | Resultado final | Salida |
| --- | --- | --- |
| `npm ci` | PASS; 358 paquetes instalados, 365 auditados, 0 vulnerabilidades | 0 |
| `npm run lint` | PASS; 0 errores, 0 advertencias | 0 |
| `npm run typecheck` | PASS | 0 |
| `npm test` | PASS; 284 pruebas en 30 archivos | 0 |
| `npm run test:e2e` | PASS; 43/43, incluido Sentinel; sin omisiones ni reintentos | 0 |
| `npm run build` | PASS; compilación de producción final | 0 |
| `node --test tests/flujos_v2.test.cjs` | PASS; 147/147, sin omisiones | 0 |

**Puerta final: 0 errores y 0 advertencias; cadena Cooper y regresión de flujos con salida 0.** Evidencia versionada: [registro Cooper](evidencia/total-guia/puerta-cooper.txt), [registro de flujos](evidencia/total-guia/puerta-flujos.txt) y [resumen de verificación documental y hashes](evidencia/total-guia/verificacion.json). Los registros conservan stdout/stderr; únicamente se normalizaron los caracteres de control de presentación, espacios finales y líneas vacías de cierre. Enlaces, anclas, PNG y alcance documental se comprobaron además con salida 0; `git diff --check` limpio.

Primer intento: 42/43 E2E aprobadas; Sentinel falló porque no existía su Chromium en `.cache/sentinel-browsers`. Se preparó **solo la caché de este worktree** con el comando documentado:

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/sentinel-browsers" /home/david/Proyectos/Sistema-Sentinel/codigo/.venv/bin/python -m playwright install chromium
```

La instalación informó que utilizaba el paquete compatible de Ubuntu 24.04 por la distribución del entorno. No se modificó Sentinel ni se desactivó su guardián. Se repitió la cadena completa desde `npm ci`, sin omitir escenarios ni rebajar comprobaciones. El fallo inicial y su preparación quedan en `cooper/.cache/total-guia/`; no se presentan como una puerta aprobada.

## Limitaciones reales

1. Documentación redactada y capturas locales generadas; **esta misión no está integrada ni desplegada**. El producto fotografiado sí corresponde al código de la integración 3 ya existente. No se hizo merge, push ni modificación de servicios/VPS.
2. Las capturas usan datos ficticios y cuenta administrativa ficticia. No prueban acceso Google real, calidad del chat por los planes, producción audiovisual pagada, mensajes WhatsApp ni publicación en redes.
3. El perfil se capturó sin número ni código; explica el alta y las preferencias a partir de los controles existentes, sin afirmar que la mensajería real esté activada.
4. No se documentan pantallas futuras de Competencia ni otras misiones concurrentes como disponibles. Tampoco se da por aceptada la URL definitiva o el estado de la instalación VPS.
5. Solo Chromium local y emulación móvil para estas capturas. No se hizo una prueba nueva en teléfono físico ni Safari. El texto advierte sobre la zona local de programación de videos y la zona explícita de Marcas.

## Pendientes de Walter

1. Confirmar la dirección de uso que debe recibir el equipo y completar la aceptación de acceso Google en ese destino; no confundir `localhost` con acceso desde otro dispositivo.
2. Confirmar los tres o cuatro correos, dueños de marcas/cuentas, identidad de la iglesia y tienda, y el medio acordado para reportar problemas.
3. Coordinar con Claude la integración de Competencia y de los demás frentes; cuando estén disponibles, actualizar esta guía y regenerar capturas sobre esa combinación, sin reutilizar estas imágenes como prueba de funciones nuevas.
4. Aceptar por separado conexiones de cuentas, mensajería, revisión pastoral/citas y primer ensayo real de publicación. Las instrucciones de uso no activan ni autorizan esos servicios.
5. Hacer una lectura y un recorrido de uso con el equipo, incluyendo celular y las dos aprobaciones de video. La revisión de esta entrega corresponde a Claude antes de integrarla.
