import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:net";
import lighthouse from "lighthouse";
const secret = randomBytes(32).toString("hex");
const marcasAudit = process.argv.includes("--marcas");
const animationAudit = process.argv.includes("--animacion");
const coverageAudit = process.argv.includes("--cobertura");
const outputDir = marcasAudit
  ? ".cache/auditoria-marcas"
  : coverageAudit
  ? ".cache/cobertura/lighthouse"
  : animationAudit
    ? ".cache/animacion/lighthouse"
    : ".cache/auditoria";
delete process.env.NO_COLOR;
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".cache/browsers");
const { chromium } = await import("@playwright/test");
async function available(port) {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", resolve);
  });
  const selected = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return selected;
}
const appPort = await available(0);
const fixturePort = await available(0);
const base = `http://127.0.0.1:${appPort}`;
const server = spawn(process.execPath, ["scripts/e2e-server.mjs"], {
  stdio: ["ignore", "ignore", "inherit"],
  env: {
    ...process.env,
    COOPER_E2E_SECRET: secret,
    COOPER_E2E_PORT: String(appPort),
    COOPER_E2E_FIXTURE_PORT: String(fixturePort),
    COOPER_DEMO: "1",
  },
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error("El servidor aislado terminó antes de arrancar.");
    try {
      ready = (await fetch(base + "/entrar")).ok;
    } catch {
      /* Esperar al servidor propio. */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error("El servidor de auditoría no arrancó.");
  const port = await available(0);
  browser = await chromium.launch({
    args: [`--remote-debugging-port=${port}`],
  });
  const context = await browser.newContext({ baseURL: base });
  const auth = await context.request.post(
    `http://127.0.0.1:${fixturePort}/sesion`,
    {
      data: { email: "admin@example.test", secret },
    },
  );
  if (!auth.ok()) throw new Error("No se pudo crear la sesión aislada.");
  const channel = await (
    await context.request.post("/api/orden", {
      data: { evento: "nuevo_canal", texto: "Ciencia cotidiana" },
    })
  ).json();
  const video = await (
    await context.request.post("/api/orden", {
      data: {
        evento: "nuevo_video",
        recursoId: channel.id,
        texto: "Por qué el cielo es azul",
      },
    })
  ).json();
  if (marcasAudit) {
    const response = await context.request.post("/api/marcas", {
      data: { nombre: "Congregación de ensayo", rubro: "iglesia-reformada" },
    });
    if (!response.ok()) throw new Error("No se pudo crear la marca ficticia.");
  }
  const cdp = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  await cdp.contexts()[0].addCookies(await context.cookies());
  const summaries = [];
  mkdirSync(outputDir, { recursive: true });
  for (const theme of ["oscuro", "claro"]) {
    const profile = await context.request.patch("/api/perfil", {
      data: {
        name: "Ensayo Lighthouse",
        image: "",
        theme,
        home: "chat",
        whatsapp: "",
      },
    });
    if (!profile.ok())
      throw new Error("No se pudo configurar el tema de ensayo.");
    for (const formFactor of ["mobile", "desktop"]) {
      const paths = marcasAudit
        ? ["/marcas"]
        : coverageAudit
        ? [
            `/canales/${channel.id}`,
            "/radar",
            "/rutina",
            "/redes",
            "/referencias",
            "/cuentas",
            "/programados",
            "/decisiones",
            "/incidencias",
            "/avisos",
            "/admin/fabrica",
          ]
        : process.argv.includes("--rapida")
          ? ["/"]
          : [
              "/",
              "/canales",
              "/videos",
              `/videos/${video.id}`,
              "/avatares",
              "/perfil",
              "/admin",
              "/entrar",
            ];
      for (const path of paths) {
        const mobile = formFactor === "mobile";
        const result = await lighthouse(base + path, {
          port,
          logLevel: "error",
          output: "html",
          onlyCategories: ["performance", "accessibility", "best-practices"],
          disableStorageReset: true,
          formFactor,
          screenEmulation: {
            mobile,
            width: mobile ? 390 : 1440,
            height: 900,
            deviceScaleFactor: 1,
            disabled: false,
          },
          ...(mobile
            ? {}
            : {
                throttling: {
                  rttMs: 40,
                  throughputKbps: 10240,
                  cpuSlowdownMultiplier: 1,
                  requestLatencyMs: 0,
                  downloadThroughputKbps: 0,
                  uploadThroughputKbps: 0,
                },
              }),
        });
        if (!result?.lhr || result.lhr.runtimeError)
          throw new Error("Lighthouse no completó la medición.");
        const name = `${path.replaceAll("/", "_") || "inicio"}-${theme}-${formFactor}`;
        writeFileSync(`${outputDir}/${name}.html`, result.report);
        const summary = {
          path,
          theme: path === "/entrar" ? "oscuro (entrada pública)" : theme,
          formFactor,
          fecha: result.lhr.fetchTime,
          scores: Object.fromEntries(
            Object.entries(result.lhr.categories).map(([key, value]) => [
              key,
              value.score,
            ]),
          ),
          metrics: Object.fromEntries(
            [
              "largest-contentful-paint",
              "total-blocking-time",
              "cumulative-layout-shift",
            ].map((key) => [key, result.lhr.audits[key].numericValue]),
          ),
          warnings: result.lhr.runWarnings,
          failedAudits: Object.values(result.lhr.audits)
            .filter(
              (a) =>
                a.score !== null &&
                a.score < 1 &&
                a.scoreDisplayMode === "binary",
            )
            .map((a) => ({ id: a.id, title: a.title })),
        };
        summaries.push(summary);
        writeFileSync(
          `${outputDir}/resumen.json`,
          JSON.stringify(
            {
              entorno: "Chromium local; laboratorio, sin métricas de campo",
              mediciones: summaries,
            },
            null,
            2,
          ) + "\n",
        );
        console.log(
          `${path} ${theme} ${formFactor}: ${JSON.stringify(summary.scores)}; advertencias=${summary.warnings.length}`,
        );
      }
    }
  }
  await cdp.close();
  if (
    summaries.some(
      (result) =>
        result.warnings.length ||
        result.failedAudits.length ||
        result.scores.performance < (animationAudit ? 1 : 0.9) ||
        result.scores.accessibility < 1 ||
        result.scores["best-practices"] < 1,
    )
  )
    throw new Error(
      `La auditoría requiere rendimiento >=${animationAudit ? 100 : 90}, accesibilidad/buenas prácticas 100, ninguna advertencia ni comprobación binaria fallida.`,
    );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  if (server.exitCode === null)
    await new Promise((resolve) => server.once("exit", resolve));
}
