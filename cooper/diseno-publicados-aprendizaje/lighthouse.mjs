// Puerta móvil de la misión con las 12 publicaciones del fixture fotográfico.
// Reutiliza el arnés de base; solo añade datos ficticios en su SQLite temporal.
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import lighthouse from "lighthouse";
import {
  comprobarArchivosEntorno,
  entornoLimpio,
} from "../scripts/entorno-pruebas.mjs";
import Database from "better-sqlite3";

comprobarArchivosEntorno();
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".cache/browsers");
const { chromium } = await import("@playwright/test");
const output = resolve("../evidencias-diseno/lighthouse");
mkdirSync(output, { recursive: true });
const secret = randomBytes(32).toString("hex");
async function freePort() {
  const reservation = createServer();
  await new Promise((accept, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", accept);
  });
  const port = reservation.address().port;
  await new Promise((accept) => reservation.close(accept));
  return port;
}
const appPort = await freePort(),
  fixturePort = await freePort(),
  debugPort = await freePort();
const base = `http://127.0.0.1:${appPort}`;
const server = spawn(process.execPath, ["scripts/e2e-server.mjs"], {
  stdio: ["ignore", "ignore", "inherit"],
  env: {
    ...entornoLimpio(),
    COOPER_E2E_SECRET: secret,
    COOPER_E2E_PORT: String(appPort),
    COOPER_E2E_FIXTURE_PORT: String(fixturePort),
    COOPER_DEMO: "0",
  },
});
let browser, cdp;
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null)
      throw new Error("El servidor aislado terminó antes de iniciar.");
    try {
      ready = (await fetch(`${base}/entrar`)).ok;
    } catch {
      /* Espera del servidor propio. */
    }
    if (ready) break;
    await new Promise((accept) => setTimeout(accept, 200));
  }
  if (!ready) throw new Error("El servidor de auditoría no inició.");
  browser = await chromium.launch({
    args: [`--remote-debugging-port=${debugPort}`],
  });
  const context = await browser.newContext({
    baseURL: base,
    extraHTTPHeaders: { Referer: base },
  });
  const response = await context.request.post(
    `http://127.0.0.1:${fixturePort}/sesion`,
    { data: { email: "admin@example.test", secret } },
  );
  if (!response.ok()) throw new Error("No se pudo iniciar la sesión ficticia.");
  const state = await (await context.request.get(`${base}/api/estado`)).json();
  const matches = [];
  for (const directory of readdirSync(".cache", { withFileTypes: true })) {
    if (!directory.isDirectory() || !directory.name.startsWith("e2e-"))
      continue;
    const path = resolve(".cache", directory.name, "cooper.sqlite");
    if (!existsSync(path)) continue;
    const db = new Database(path, { readonly: true });
    try {
      if (db.prepare("SELECT id FROM users WHERE id = ?").get(state.user.id))
        matches.push(path);
    } finally {
      db.close();
    }
  }
  if (matches.length !== 1)
    throw new Error("La base de ensayo no es inequívoca.");
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "diseno-publicados-aprendizaje/preparar-fixture.mts",
      matches[0],
      state.user.id,
    ],
    { stdio: "pipe", timeout: 120000 },
  );

  cdp = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
  await cdp.contexts()[0].addCookies(await context.cookies());
  const page = await cdp.contexts()[0].newPage();
  const session = await cdp.contexts()[0].newCDPSession(page);
  const measurements = [];
  for (const [name, path] of [
    ["inicio", "/"],
    ["publicados", "/publicados"],
  ]) {
    await session.send("Network.clearBrowserCache");
    const result = await lighthouse(base + path, {
      port: debugPort,
      logLevel: "error",
      output: ["html", "json"],
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
    if (!result?.lhr || result.lhr.runtimeError)
      throw new Error(`Lighthouse no completó ${name}.`);
    writeFileSync(`${output}/${name}.html`, result.report[0]);
    writeFileSync(`${output}/${name}.json`, result.report[1]);
    const measured = {
      screen: name,
      path,
      date: result.lhr.fetchTime,
      scores: Object.fromEntries(
        Object.entries(result.lhr.categories).map(([key, value]) => [
          key,
          value.score * 100,
        ]),
      ),
      warnings: result.lhr.runWarnings,
      metrics: Object.fromEntries(
        [
          "largest-contentful-paint",
          "total-blocking-time",
          "cumulative-layout-shift",
        ].map((key) => [key, result.lhr.audits[key].numericValue]),
      ),
      failedAudits: Object.values(result.lhr.audits)
        .filter(
          (audit) =>
            audit.score !== null &&
            audit.score < 1 &&
            audit.scoreDisplayMode === "binary",
        )
        .map(({ id, title }) => ({ id, title })),
    };
    measurements.push(measured);
    console.log(
      `${name}: ${JSON.stringify(measured.scores)}; advertencias=${measured.warnings.length}`,
    );
  }
  const passed = measurements.every(
    (m) =>
      m.scores.performance >= 90 &&
      m.scores.accessibility === 100 &&
      m.scores["best-practices"] === 100 &&
      !m.warnings.length &&
      !m.failedAudits.length,
  );
  writeFileSync(
    `${output}/resumen.json`,
    JSON.stringify(
      {
        passed,
        buildId: readFileSync(".next/BUILD_ID", "utf8").trim(),
        environment:
          "Chromium local, móvil 390px; caché HTTP vacía por ruta, sesión ficticia; sin datos de campo.",
        thresholds: {
          performance: 90,
          accessibility: 100,
          bestPractices: 100,
          warnings: 0,
        },
        measurements,
      },
      null,
      2,
    ) + "\n",
  );
  if (!passed)
    throw new Error(
      "Lighthouse exige rendimiento ≥90, accesibilidad y buenas prácticas 100, cero advertencias.",
    );
} finally {
  await cdp?.close();
  await browser?.close();
  server.kill("SIGTERM");
  if (server.exitCode === null)
    await new Promise((accept) => server.once("exit", accept));
}
