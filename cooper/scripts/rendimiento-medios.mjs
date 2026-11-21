import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

// Ejecutar contra el build que se quiere medir; no compila ni usa datos reales.
const fase = process.argv[2] ?? "despues";
if (!["antes", "despues"].includes(fase))
  throw new Error("Usa antes o despues como argumento.");
const salida = `.cache/rendimiento/medios/${fase}`;
mkdirSync(salida, { recursive: true });
delete process.env.NO_COLOR;
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".cache/browsers");
const { chromium } = await import("@playwright/test");
async function puertoLibre() {
  const probe = createServer();
  await new Promise((done, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", done);
  });
  const port = probe.address().port;
  await new Promise((done) => probe.close(done));
  return port;
}
const appPort = await puertoLibre();
const fixturePort = await puertoLibre();
const base = `http://127.0.0.1:${appPort}`;
const secret = randomBytes(32).toString("hex");
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
let closing;
function close() {
  return (closing ??= (async () => {
    await browser?.close();
    if (server.exitCode === null) {
      const stopped = new Promise((done) => server.once("exit", done));
      server.kill("SIGTERM");
      await stopped;
    }
  })());
}
for (const [signal, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
])
  process.once(signal, () => {
    void close().finally(() => process.exit(code));
  });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error("El servidor aislado terminó.");
    try {
      ready = (await fetch(`${base}/entrar`)).ok;
    } catch {
      // Solo se espera la instancia efímera de este ensayo.
    }
    if (ready) break;
    await new Promise((done) => setTimeout(done, 200));
  }
  if (!ready) throw new Error("La instancia efímera no arrancó.");
  browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: base });
  const session = await context.request.post(
    `http://127.0.0.1:${fixturePort}/sesion`,
    {
      data: { email: "admin@example.test", secret },
    },
  );
  if (!session.ok()) throw new Error("No se creó la sesión ficticia.");
  async function post(path, data) {
    const response = await context.request.post(path, { data });
    if (!response.ok())
      throw new Error(`Falló el fixture ${path}: ${response.status()}`);
    return response.json();
  }
  const marca = await post("/api/marcas", {
    nombre: "Rendimiento de medios",
    rubro: "general",
  });
  const cuenta = await post(`/api/marcas/${marca.id}/cuentas`, {
    red: "instagram",
    alias: "@ensayo",
    remoto: "123456789",
    pagina: "987654321",
  });
  await post(`/api/marcas/cuenta/${cuenta.id}`, { accion: "conectar" });
  const piezas = [];
  for (const formato of ["imagen", "reel"]) {
    const pieza = await post(`/api/marcas/${marca.id}/piezas`, {
      cuentaId: cuenta.id,
      formato,
      plantilla: "libre",
      titulo: `Ensayo ${formato}`,
      texto: "Contenido ficticio para medir descargas.",
      detalle: "Vista previa de laboratorio",
      programada: "2030-12-01T12:00:00-05:00",
    });
    await post(`/api/marcas/pieza/${pieza.id}`, {
      accion: "enviar",
      revision: 1,
    });
    piezas.push(pieza);
  }
  const medios = piezas.map(
    (pieza) => `${base}/api/marcas/medio/${pieza.id}?i=0`,
  );
  const tamanos = await Promise.all(
    medios.map(async (url) => {
      const response = await context.request.get(url);
      if (!response.ok()) throw new Error("No se generó el medio ficticio.");
      return {
        bytes: (await response.body()).length,
        tipo: response.headers()["content-type"],
      };
    }),
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const requests = new Set();
  let solicitudes = 0;
  let bytesRed = 0;
  cdp.on("Network.requestWillBeSent", ({ requestId, request }) => {
    if (request.url.includes("/api/marcas/medio/")) {
      requests.add(requestId);
      solicitudes++;
    }
  });
  cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
    if (requests.has(requestId)) bytesRed += encodedDataLength;
  });
  const medir = () => ({ solicitudes, bytesRed });
  const estabilizar = () => page.waitForTimeout(1200);
  const estado = await (await context.request.get("/api/estado")).json();
  const video = estado.videos[0];
  video.observabilidad = {
    ...video.observabilidad,
    montaje: medios[1],
    miniatura: medios[0],
    escenas: [],
    publicaciones: [],
  };
  await page.route("**/api/estado", (route) => route.fulfill({ json: estado }));
  await page.route("**/api/eventos", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `event: estado\ndata: ${JSON.stringify(estado)}\n\n`,
    }),
  );
  await page.goto(`/videos/${video.id}`);
  const montaje = page.locator(".real-player video");
  await montaje.waitFor({ state: "visible" });
  await estabilizar();
  const montajeReposo = {
    ...medir(),
    readyState: await montaje.evaluate((el) => el.readyState),
    preload: await montaje.getAttribute("preload"),
  };
  await montaje.evaluate(async (el) => {
    el.muted = true;
    await el.play();
  });
  await page.waitForFunction(
    () => document.querySelector(".real-player video")?.currentTime > 0.1,
  );
  await estabilizar();
  const montajeReproduciendo = medir();
  await page.goto("/marcas");
  await page
    .getByText("Vista previa de la pieza", { exact: true })
    .first()
    .waitFor();
  await estabilizar();
  // Excluir el montaje de la muestra de Marcas.
  solicitudes = 0;
  bytesRed = 0;
  requests.clear();
  await page.reload();
  await estabilizar();
  const marcasCerradas = {
    ...medir(),
    elementos: await page
      .locator(".marca-galeria img, .marca-galeria video")
      .count(),
  };
  for (const summary of await page
    .getByText("Vista previa de la pieza", { exact: true })
    .all())
    await summary.click();
  await estabilizar();
  const marcasAbiertas = medir();
  const reel = page.locator(".marca-galeria video");
  await reel.evaluate(async (el) => {
    el.muted = true;
    await el.play();
  });
  await page.waitForFunction(
    () => document.querySelector(".marca-galeria video")?.currentTime > 0.1,
  );
  await estabilizar();
  const marcasReproduciendo = medir();
  const activos = readdirSync("public/movimiento").map((archivo) => {
    const data = readFileSync(`public/movimiento/${archivo}`);
    return { archivo, bytes: data.length, gzip: gzipSync(data).length };
  });
  const resumen = {
    fase,
    fecha: new Date().toISOString(),
    build: readFileSync(".next/BUILD_ID", "utf8").trim(),
    navegador: browser.version(),
    cacheNavegador: false,
    baseFicticia: true,
    nota: "bytesRed de CDP incluye cabeceras; solicitudes de imagen poster incluidas; espera fija 1,2 s sin reproducir.",
    mediosSinteticos: tamanos,
    montajeReposo,
    montajeReproduciendo,
    marcasCerradas,
    marcasAbiertas,
    marcasReproduciendo,
    activos,
  };
  writeFileSync(`${salida}/resumen.json`, JSON.stringify(resumen, null, 2));
  console.log(JSON.stringify(resumen, null, 2));
  if (
    fase === "despues" &&
    (montajeReposo.readyState !== 0 ||
      montajeReposo.solicitudes !== 1 ||
      marcasCerradas.solicitudes !== 0 ||
      marcasCerradas.elementos !== 0 ||
      marcasAbiertas.solicitudes !== 1 ||
      marcasReproduciendo.solicitudes <= marcasAbiertas.solicitudes)
  )
    throw new Error("La descarga diferida no cumple los umbrales.");
} finally {
  await close();
}
