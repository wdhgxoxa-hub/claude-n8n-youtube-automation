import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:net";
import lighthouse from "lighthouse";
const secret = randomBytes(32).toString("hex");
const base = "http://127.0.0.1:33171";
delete process.env.NO_COLOR;
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".cache/browsers");
const { chromium } = await import("@playwright/test");
const server = spawn(process.execPath, ["scripts/e2e-server.mjs"], {
  stdio: ["ignore", "ignore", "inherit"],
  env: { ...process.env, COOPER_E2E_SECRET: secret },
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      ready = (await fetch(base + "/entrar")).ok;
    } catch {
      /* Esperar al servidor aislado, sin usar una instancia existente. */
    }
    if (ready) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw new Error("El servidor de auditoría no arrancó.");
  const probe = createServer();
  await new Promise((r) => probe.listen(0, "127.0.0.1", r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  browser = await chromium.launch({
    args: [`--remote-debugging-port=${port}`],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const auth = await page.request.post("http://127.0.0.1:33172/sesion", {
    data: { email: "admin@example.test", secret },
  });
  if (!auth.ok()) throw new Error("No se pudo crear la sesión aislada.");
  // Lighthouse usa el contexto predeterminado. Se transfiere exclusivamente la cookie de ensayo.
  const cdp = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  await cdp.contexts()[0].addCookies(await context.cookies());
  const result = await lighthouse(base + "/", {
    port,
    logLevel: "error",
    output: "html",
    onlyCategories: ["performance", "accessibility", "best-practices"],
    disableStorageReset: true,
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      disabled: false,
    },
  });
  if (!result?.lhr) throw new Error("Lighthouse no devolvió resultados.");
  mkdirSync(".cache/auditoria", { recursive: true });
  writeFileSync(".cache/auditoria/lighthouse.html", result.report);
  const summary = {
    url: result.lhr.finalDisplayedUrl,
    fecha: result.lhr.fetchTime,
    entorno: "Chromium local; simulación móvil, sin datos de campo",
    scores: Object.fromEntries(
      Object.entries(result.lhr.categories).map(([key, value]) => [
        key,
        value.score,
      ]),
    ),
    metrics: Object.fromEntries(
      [
        "first-contentful-paint",
        "largest-contentful-paint",
        "total-blocking-time",
        "cumulative-layout-shift",
        "speed-index",
      ].map((key) => [key, result.lhr.audits[key].displayValue]),
    ),
    warnings: result.lhr.runWarnings,
  };
  writeFileSync(
    ".cache/auditoria/resumen.json",
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(JSON.stringify(summary, null, 2));
  await cdp.close();
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
