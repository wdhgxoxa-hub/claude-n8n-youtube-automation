# Origen de las capturas

[Volver a la guía de uso](../README.md)

Capturas de la aplicación integrada local, **base `de397f3195856c10b6a9959171ff42da4328d9ec`**, generadas el 21 de noviembre de 2026 (Lima) con Playwright 1.65.1 y Chromium. Se reutilizaron el servidor y el emisor de sesiones E2E existentes. La versión exacta del navegador, hora UTC, rutas, tamaños y SHA-256 de los PNG están en [manifest.json](manifest.json).

Son capturas directas de Playwright, sin retoques del contenido ni sustitución del DOM. Se usó movimiento reducido para facilitar la lectura, tema oscuro, zona `America/Lima` y páginas completas, salvo dos recortes de elementos de Marcas. El tamaño de escritorio es 1440 × 1000; el de celular, 390 × 844. Las páginas completas pueden tener más altura.

La instancia se inició en puertos libres de `127.0.0.1`, con base temporal en `cooper/.cache/e2e-*`, credenciales efímeras generadas por el ejecutor y `COOPER_DEMO=1`. Fábrica, Marcas, chat, medios y mensajería usaron simuladores. El navegador bloqueó solicitudes fuera de los dos puertos del ensayo. No se abrió Google ni se usaron sesiones del equipo, archivos `.env`, servicios vivos o cuentas reales. El servidor de capturas se detuvo al terminar.

## Índice

| Captura | Qué muestra |
| --- | --- |
| [01-entrada.png](01-entrada.png) | Entrada pública; sin pulsar Google. |
| [02-inicio.png](02-inicio.png) | Chat y fábrica con cuatro videos ficticios. |
| [03-fabrica-movil.png](03-fabrica-movil.png) | Pestaña Fábrica en celular. |
| [04-chat-confirmacion.png](04-chat-confirmacion.png) | Tarjeta preparada, lista para confirmar; sin ejecutarla. |
| [05-aprobacion-guion.png](05-aprobacion-guion.png) | Video de demostración en la primera aprobación. |
| [06-aprobacion-final.png](06-aprobacion-final.png) | Otro video de demostración en la aprobación final. |
| [07-publicados.png](07-publicados.png) | Publicaciones y métricas ficticias; incluye «Sin dato». |
| [08-aprendizaje.png](08-aprendizaje.png) | Lección, incidencia pendiente e incidencia corregida. |
| [09-radar.png](09-radar.png) | Radar disponible en esta base; no representa Competencia. |
| [10-marca-alta.png](10-marca-alta.png) | Identidad y dueño de «Iglesia de ejemplo». |
| [11-marca-cuenta.png](11-marca-cuenta.png) | Recorte de Cuentas y conexión: identificadores ficticios y estado «Simulada». |
| [12-marca-revision.png](12-marca-revision.png) | Recorte de pieza pendiente y su vista previa; no aprobada. |
| [13-whatsapp.png](13-whatsapp.png) | Perfil sin número guardado ni código solicitado; mensajería simulada. El número tenue es el ejemplo del formulario. |

La revisión visual comprobó que títulos, avisos y acciones citados fueran legibles. El recorrido de capturas terminó sin errores de página. No sustituye una prueba en un teléfono físico, la aceptación de OAuth ni la entrega real de mensajes o publicaciones.

## Reproducir en un worktree local de ensayo

Estas instrucciones son para quien mantiene la documentación; Walter y el equipo no necesitan ejecutarlas para usar Cooper.

1. Usa un worktree propio con esta base y sin archivos de entorno reales en `cooper/`. No apuntes a la instalación de la PC ni del VPS. El script escribe los PNG de esta carpeta y crea datos ficticios en una base nueva.
2. Desde `cooper/`, instala las dependencias y compila con `npm ci && npm run build`. No ejecutes la captura al mismo tiempo que una compilación. `npm run test:e2e` prepara Chromium en `.cache/browsers`; si falta, usa `PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/browsers" node node_modules/@playwright/test/cli.js install chromium`.
3. Copia el bloque JavaScript de abajo a `cooper/.cache/total-guia/capturar.mjs` y ejecútalo desde `cooper/` con `node .cache/total-guia/capturar.mjs`. El directorio debe existir; no requiere ninguna clave real.
4. Revisa las 13 imágenes y el manifiesto. Los identificadores temporales y las fechas cambiarán entre ejecuciones. Actualiza la base documentada si se adapta el recorrido a otra integración.

La captura usa las APIs oficiales de [screenshots de Playwright](https://playwright.dev/docs/screenshots) y [contextos aislados de navegador](https://playwright.dev/docs/api/class-browsercontext), consultadas el 21-11-2026. Las rutas internas y acciones proceden de los componentes y pruebas E2E de esta base; no se llama a APIs externas de publicación.

<details>
<summary>Script utilizado para generar los PNG y el manifiesto</summary>

<!-- El bloque siguiente se conserva como documentación reproducible; no forma parte de la aplicación. -->

```javascript
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const output = resolve('../docs/guia/capturas');
mkdirSync(output, { recursive: true });
const port = async () => {
  const s = createServer();
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const p = s.address().port;
  await new Promise(r => s.close(r));
  return p;
};
const appPort = await port(), fixturePort = await port();
const base = `http://127.0.0.1:${appPort}`;
const secret = randomBytes(32).toString('hex');
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'es_PE.UTF-8',
  NEXT_TELEMETRY_DISABLED: '1', COOPER_DEMO: '1',
  COOPER_E2E_PORT: String(appPort), COOPER_E2E_FIXTURE_PORT: String(fixturePort),
  COOPER_E2E_SECRET: secret,
};
const log = createWriteStream('.cache/total-guia/servidor-capturas.log');
const server = spawn(process.execPath, ['scripts/e2e-server.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.pipe(log); server.stderr.pipe(log);
let browser;
const manifest = [];
const errors = [];
try {
  for (let n = 0; n < 120; n++) {
    if (server.exitCode !== null) throw new Error('Servidor de capturas detenido');
    if (await fetch(`${base}/entrar`).then(r => r.ok).catch(() => false)) break;
    await new Promise(r => setTimeout(r, 500));
  }
  process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.cache/browsers');
  browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Lima', locale: 'es-PE', reducedMotion: 'reduce' });
  await context.route('**/*', route => {
    const u = new URL(route.request().url());
    return u.hostname === '127.0.0.1' && [String(appPort), String(fixturePort)].includes(u.port)
      ? route.continue() : route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const ready = async path => {
    await page.goto(path);
    if (path !== '/entrar') await expect(page.locator('.connection')).toHaveText('En vivo');
    await page.evaluate(() => document.fonts.ready);
  };
  const shot = async (name, paso, element) => {
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
    if (!element) await page.evaluate(() => window.scrollTo(0, 0));
    const file = `${name}.png`;
    if (element) await element.screenshot({ path: resolve(output, file), animations: 'disabled' });
    else await page.screenshot({ path: resolve(output, file), fullPage: true, animations: 'disabled' });
    manifest.push({ archivo: file, ruta: new URL(page.url()).pathname, paso, viewport: page.viewportSize(), captura: element ? 'elemento de la página' : 'página completa', sha256: createHash('sha256').update(readFileSync(resolve(output, file))).digest('hex') });
    console.log(`Captura: ${file}`);
  };
  await ready('/entrar');
  await shot('01-entrada', 'Entrada pública; no pulsar Google.');
  const session = await context.request.post(`http://127.0.0.1:${fixturePort}/sesion`, { data: { email: 'admin@example.test', secret } });
  if (!session.ok()) throw new Error('No se pudo abrir la sesión ficticia');
  await ready('/');
  await shot('02-inicio', 'Inicio con demostración integrada, sin cambios.');
  const state = await (await context.request.get('/api/estado')).json();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: /Fábrica/ }).click();
  await shot('03-fabrica-movil', 'Inicio: pestaña Fábrica a 390 px.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready('/');
  await page.getByRole('textbox', { name: 'Mensaje para Cooper' }).fill('Crea un canal: Cuidado de la ropa');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar', exact: true })).toBeEnabled();
  await shot('04-chat-confirmacion', 'Propuesta de nuevo canal, sin confirmar.');
  for (const [stage, name] of [[3, '05-aprobacion-guion'], [9, '06-aprobacion-final']]) {
    const video = state.videos.find(v => v.stage === stage);
    await ready(`/videos/${video.id}`);
    await expect(page.getByRole('button', { name: 'Aprobar', exact: true })).toBeEnabled();
    await shot(name, `Detalle de video de demostración en etapa ${stage + 1}, sin aprobar.`);
  }
  for (const [name, path] of [['07-publicados', '/publicados'], ['08-aprendizaje', '/aprendizaje'], ['09-radar', '/radar']]) {
    await ready(path);
    if (path === '/radar') await expect(page.getByRole('button', { name: 'Solicitar nuevo radar' })).toBeVisible();
    await shot(name, 'Estado integrado de demostración.');
  }
  await ready('/marcas');
  await page.getByRole('button', { name: 'Añadir marca o cuenta' }).click();
  await page.getByRole('textbox', { name: 'Nombre de la marca' }).fill('Iglesia de ejemplo');
  await shot('10-marca-alta', 'Primer paso del alta, con nombre ficticio.');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar marca', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Iglesia de ejemplo', exact: true })).toBeVisible();
  await page.getByLabel('Nombre de la cuenta', { exact: true }).fill('@iglesia_ejemplo');
  await page.getByLabel('Identificador de cuenta o perfil', { exact: true }).fill('123456789');
  await page.getByLabel('Página vinculada (para Instagram)', { exact: true }).fill('987654321');
  await page.getByRole('button', { name: 'Añadir cuenta', exact: true }).click();
  await page.getByRole('button', { name: 'Verificar conexión', exact: true }).click();
  await expect(page.getByText('Conexión verificada.', { exact: true })).toBeVisible();
  await shot('11-marca-cuenta', 'Cuenta ficticia verificada por el simulador.', page.locator('.marca-conexion').first());
  await page.getByRole('button', { name: 'Estudio', exact: true }).click();
  await page.getByRole('button', { name: 'Estudiar la cuenta', exact: true }).click();
  await expect(page.getByText(/Muestra: 6 publicaciones/)).toBeVisible();
  await page.getByRole('button', { name: 'Calendario', exact: true }).click();
  await page.getByLabel('Título de la pieza', { exact: true }).fill('Nos reunimos el domingo');
  await page.getByLabel('Horario, lugar u otro detalle de la pieza').fill('Domingo · 10:00 · Auditorio de ejemplo');
  await page.getByLabel('Texto de la publicación', { exact: true }).fill('Te esperamos este domingo para compartir como comunidad. Confirma el lugar y el horario antes de publicar.');
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await page.getByRole('button', { name: 'Preparar vista previa y enviar a Walter', exact: true }).click();
  await expect(page.getByText('Pieza lista para la revisión de Walter.', { exact: true })).toBeVisible();
  await page.getByText('Vista previa de la pieza', { exact: true }).click();
  await expect(page.getByRole('img', { name: 'Nos reunimos el domingo, pieza 1', exact: true })).toBeVisible();
  await shot('12-marca-revision', 'Pieza ficticia pendiente; vista previa abierta; no aprobar.', page.locator('.marca-pieza'));
  await ready('/perfil');
  await expect(page.getByRole('heading', { name: 'Tus avisos por WhatsApp' })).toBeVisible();
  await shot('13-whatsapp', 'Perfil sin teléfono ni código: configuración simulada.');
  if (errors.length) throw new Error(`${errors.length} errores de página: ${errors.join('; ')}`);
  writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ base: 'de397f3195856c10b6a9959171ff42da4328d9ec', fecha: new Date().toISOString(), zona: 'America/Lima', modo: 'COOPER_DEMO=1; adaptadores simulados; sesión ficticia; red del navegador limitada al ensayo loopback', playwright: '1.65.1', chromium: browser.version(), erroresPagina: errors, capturas: manifest }, null, 2) + '\n');
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const stopped = new Promise(r => server.once('exit', r));
    server.kill('SIGTERM');
    await stopped;
  }
  log.end();
}
```

</details>
