// Aceptación pública sin sesión: nunca inicia OAuth ni escribe en producción.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(new URL("../../cooper/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const { default: AxeBuilder } = require("@axe-core/playwright");
const origin = "https://cooper.cooperestudio.com";
const output = resolve(process.argv[2] ?? "cooper/.cache/total-despliegue-aceptacion/publico");
await mkdir(output, { recursive: true });
const routes = ["/", "/canales", "/canales/comprobacion-sin-sesion", "/videos", "/videos/comprobacion-sin-sesion", "/avatares", "/publicados", "/aprendizaje", "/marcas", "/perfil", "/admin", "/admin/fabrica", "/radar", "/rutina", "/redes", "/referencias", "/cuentas", "/programados", "/decisiones", "/incidencias", "/avisos"];
const result = { origen: origin, fecha: new Date().toISOString(), alcance: "Entrada y control de acceso anónimo; NO recorrido privado autenticado", pantallas: [], apis: [], formatos: [], oauth_iniciado: false };
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, recordVideo: { dir: output, size: { width, height: 900 } }, serviceWorkers: "block" });
    const unexpected = [];
    const errors = [];
    await context.route("**/*", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin !== origin || !["GET", "HEAD"].includes(req.method()) || /^\/api\/auth\/(signin|signout|callback)/.test(url.pathname)) {
        unexpected.push({ metodo: req.method(), ruta: url.pathname, mismo_origen: url.origin === origin });
        await route.abort();
      } else await route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.name));
    page.on("console", (m) => { if (["error", "warning"].includes(m.type())) errors.push(m.type()); });
    const login = await page.goto(origin + "/entrar", { waitUntil: "networkidle" });
    assert.equal(login.status(), 200);
    assert.ok(await page.getByRole("button", { name: /Google/ }).isVisible());
    const tls = await login.securityDetails();
    assert.ok(tls.protocol.startsWith("TLS"));
    const headers = await login.allHeaders();
    assert.ok(headers["strict-transport-security"]?.includes("max-age="));
    assert.equal(headers["x-content-type-options"], "nosniff");
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.equal(axe.violations.length, 0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false);
    await page.screenshot({ path: resolve(output, `entrada-${width}.png`), fullPage: true });
    // Se graban las redirecciones, sin presentarlas como vistas privadas recorridas.
    for (const path of routes) {
      const response = await page.goto(origin + path, { waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).pathname, "/entrar");
      assert.equal(response.status(), 200);
      if (width === 1440) result.pantallas.push({ ruta: path, destino: "/entrar", acceso_privado: false });
    }
    if (width === 1440) {
      for (const path of ["/api/estado", "/api/eventos", "/api/memoria", "/api/marcas", "/api/operacion", "/api/admin/fabrica"]) {
        const r = await context.request.get(origin + path, { maxRedirects: 0 });
        assert.equal(r.status(), 401);
        result.apis.push({ ruta: path, estado: r.status() });
      }
      const providers = await context.request.get(origin + "/api/auth/providers");
      assert.equal(providers.status(), 200);
      const provider = (await providers.json()).google;
      assert.equal(provider.type, "oidc");
      assert.equal(provider.callbackUrl, origin + "/api/auth/callback/google");
      result.google_configurado = true;
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    const video = page.video();
    await context.close();
    await video.saveAs(resolve(output, `entrada-y-acceso-${width}.webm`));
    await video.delete();
    result.formatos.push({ ancho: width, alto: 900, tls: tls.protocol, axe: 0, desbordamientos: 0, errores: errors, peticiones_bloqueadas: unexpected });
  }
  await writeFile(resolve(output, "resultado.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ resultado: "PASS", pantallas_protegidas: routes.length, formatos: result.formatos.length, recorrido_privado: "PENDIENTE_SESION", salida: output }));
} finally {
  await browser.close();
}
