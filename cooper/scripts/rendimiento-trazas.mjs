// Laboratorio aislado: no utiliza OAuth, datos reales ni servicios audiovisuales.
// node scripts/rendimiento-trazas.mjs --fase=antes [--rutas=/,/marcas]
// La build debe existir. Ejecutar sin Lighthouse ni otras pruebas en paralelo.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";

const options = Object.fromEntries(
  process.argv.slice(2).map((item) => {
    const [key, ...value] = item.replace(/^--/, "").split("=");
    return [key, value.join("=") || true];
  }),
);
const phase = options.fase || "diagnostico";
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error("Fase no válida.");
// --tema=feria|sala|dia: el vidrio esmerilado de «dia» tiene su propio coste.
const tema = options.tema || "feria";
if (!["feria", "sala", "dia"].includes(tema))
  throw new Error("Tema no válido.");
const duration = Number(options.duracion || 2500);
if (!Number.isFinite(duration) || duration < 2000)
  throw new Error("La ventana de movimiento requiere al menos 2000 ms.");
const output = resolve(options.salida || `.cache/rendimiento/${phase}/trazas`);
mkdirSync(output, { recursive: true });
delete process.env.NO_COLOR;
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".cache/browsers");
const { chromium, expect } = await import("@playwright/test");
const secret = randomBytes(32).toString("hex");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function freePort() {
  const server = createServer();
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

// Se instala antes de navegar. Nunca almacena target, texto, URL ni valores de formularios.
function installObservers() {
  const values = { events: [], shifts: [], tasks: [], lcp: null };
  const observers = [];
  function observe(type, callback, extra = {}) {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
    const observer = new PerformanceObserver((list) =>
      list.getEntries().forEach(callback),
    );
    observer.observe({ type, buffered: true, ...extra });
    observers.push(observer);
  }
  const recordEvent = (entry) => {
    if (!entry.interactionId) return;
    values.events.push({
      name: entry.name,
      interactionId: entry.interactionId,
      startTime: entry.startTime,
      duration: entry.duration,
      inputDelay: entry.processingStart - entry.startTime,
      processing: entry.processingEnd - entry.processingStart,
      presentation: Math.max(
        0,
        entry.startTime + entry.duration - entry.processingEnd,
      ),
    });
  };
  observe("event", recordEvent, { durationThreshold: 16 });
  // El primer input no está censurado por el umbral mínimo de 16 ms de Event Timing.
  observe("first-input", recordEvent);
  observe("largest-contentful-paint", (entry) => {
    values.lcp = entry.startTime;
  });
  observe("layout-shift", (entry) => {
    if (!entry.hadRecentInput)
      values.shifts.push({ startTime: entry.startTime, value: entry.value });
  });
  observe("longtask", (entry) =>
    values.tasks.push({ startTime: entry.startTime, duration: entry.duration }),
  );
  window.__cooperPerformance = {
    values,
    observers,
    supported: PerformanceObserver.supportedEntryTypes,
    startFrames() {
      const window = { start: performance.now(), samples: [], last: null };
      const frame = (timestamp) => {
        if (window.last !== null) window.samples.push(timestamp - window.last);
        window.last = timestamp;
        window.request = requestAnimationFrame(frame);
      };
      window.request = requestAnimationFrame(frame);
      this.activeWindow = window;
    },
    stopFrames() {
      const window = this.activeWindow;
      cancelAnimationFrame(window.request);
      return {
        start: window.start,
        end: performance.now(),
        samples: window.samples,
      };
    },
    async frames(milliseconds) {
      const samples = [];
      const start = performance.now();
      let last;
      await new Promise((done) => {
        function frame(timestamp) {
          if (last !== undefined) samples.push(timestamp - last);
          last = timestamp;
          if (timestamp - start < milliseconds) requestAnimationFrame(frame);
          else done();
        }
        requestAnimationFrame(frame);
      });
      return { start, end: performance.now(), samples };
    },
  };
}

const rounded = (value) => Math.round(value * 100) / 100;
function framesSummary(window, tasks) {
  const sorted = [...window.samples].sort((a, b) => a - b);
  const relevant = tasks.filter(
    (task) => task.startTime >= window.start && task.startTime < window.end,
  );
  return {
    inicioMs: rounded(window.start),
    finMs: rounded(window.end),
    frames: sorted.length,
    fps: rounded(
      (1000 * sorted.length) / sorted.reduce((sum, item) => sum + item, 0),
    ),
    frameP95Ms: rounded(sorted[Math.floor(sorted.length * 0.95)] || 0),
    frameMaxMs: rounded(Math.max(0, ...sorted)),
    framesSobre25Ms: sorted.filter((item) => item > 25).length,
    longTasks: relevant.map((item) => ({
      inicioMs: rounded(item.startTime),
      duracionMs: rounded(item.duration),
    })),
  };
}

function webVitalsSummary(values, count) {
  const interactions = new Map();
  for (const event of values.events) {
    if (
      !interactions.has(event.interactionId) ||
      event.duration > interactions.get(event.interactionId).duration
    )
      interactions.set(event.interactionId, event);
  }
  const sorted = [...interactions.values()].sort(
    (a, b) => b.duration - a.duration,
  );
  // La página se cierra después de esta muestra. Con <50 interacciones se usa el máximo.
  const worst = sorted[Math.floor(count / 50)];
  let cls = 0,
    sessionValue = 0,
    first = 0,
    last = -Infinity;
  for (const shift of values.shifts) {
    if (shift.startTime - last >= 1000 || shift.startTime - first >= 5000) {
      sessionValue = shift.value;
      first = shift.startTime;
    } else sessionValue += shift.value;
    last = shift.startTime;
    cls = Math.max(cls, sessionValue);
  }
  return {
    lcpMs: values.lcp === null ? null : rounded(values.lcp),
    cls: rounded(cls * 100000) / 100000,
    inpLaboratorio: {
      valorMs: worst ? rounded(worst.duration) : null,
      limiteSuperiorSiNoObservableMs: worst ? null : 16,
      interaccionesTotales: count,
      interaccionesObservadas: sorted.length,
      umbralEventTimingMs: 16,
      peorEvento: worst || null,
      aclaracion:
        "Muestra de laboratorio, no INP de campo. Las interacciones <16 ms, salvo first-input, pueden no generar entrada; duración redondeada por Chromium a 8 ms.",
    },
    longTasksDocumento: values.tasks,
  };
}

// Trace Events válido para DevTools/Perfetto. Conserva tiempos/hilos, descarta todos
// los argumentos de recursos, scripts y datos para no guardar cookies ni cuerpos.
function sanitizeTrace(event) {
  const keys = [
    "name",
    "cat",
    "ph",
    "ts",
    "dur",
    "pid",
    "tid",
    "tts",
    "tdur",
    "id",
    "s",
    "bind_id",
    "flow_in",
    "flow_out",
  ];
  const clean = Object.fromEntries(
    keys
      .filter((key) => event[key] !== undefined)
      .map((key) => [key, event[key]]),
  );
  clean.args =
    event.ph === "M" && ["thread_name", "process_name"].includes(event.name)
      ? { name: event.args?.name }
      : {};
  return clean;
}

async function interactions(page, path, mobile) {
  const actions = [];
  const click = async (
    name,
    locator = page.getByRole("button", { name, exact: true }),
  ) => {
    await locator.first().click();
    actions.push(name);
    await page.waitForTimeout(180);
  };
  // Clic real más activación por teclado en todas las pantallas, sin OAuth.
  await click("Pausar movimiento");
  await page
    .getByRole("button", { name: "Activar movimiento", exact: true })
    .press("Enter");
  actions.push("Reanudar con Enter");
  await page.waitForTimeout(180);
  if (path === "/") {
    await click("Conocer el estudio");
    await click(
      "Continuar",
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Continuar", exact: true }),
    );
    await page.keyboard.press("Escape");
    actions.push("Cerrar recorrido con Escape");
    await page
      .getByLabel("Mensaje para Cooper")
      .pressSequentially("Estado", { delay: 40 });
    actions.push("Escribir mensaje sin enviarlo");
    if (mobile) {
      await click("Fábrica", page.getByRole("tab", { name: /Fábrica/ }));
      await click("Chat", page.getByRole("tab", { name: "Chat", exact: true }));
    }
  } else if (path === "/marcas") {
    for (const tab of ["Estudio", "Publicados", "Aprendizaje", "Calendario"])
      await click(tab);
  } else if (path === "/avatares") {
    await click("Vista previa de Alma");
    await click("Pausar Alma");
    await click("Voces");
  } else if (path === "/publicados") {
    const metric = page.getByLabel("Métrica del gráfico").first();
    await metric.click();
    await metric.press("ArrowDown");
    await metric.press("Enter");
    await click(
      "Ver datos de evolución",
      page.getByText("Ver datos de evolución", { exact: true }),
    );
  } else if (path === "/aprendizaje") {
    await click("Corregidos");
  } else if (path === "/perfil") {
    await page
      .getByLabel("Tu nombre")
      .pressSequentially(" Ensayo", { delay: 40 });
    actions.push("Escribir nombre sin guardarlo");
  } else if (path === "/admin") {
    await click("Semana");
    await click("Mes");
  }
  const review = path.startsWith("/canales/")
    ? "Revisar tono"
    : {
        "/radar": "Solicitar nuevo radar",
        "/rutina": "Revisar metas",
        "/referencias": "Solicitar referencias pendientes",
        "/admin/fabrica": "Revisar ajustes",
      }[path];
  if (review) {
    if (path === "/admin/fabrica")
      await page.getByLabel("Voz", { exact: true }).click();
    await click(review);
    await expect(
      page.getByRole("region", { name: "Confirmar cambios" }),
    ).toBeVisible();
    await click("Cancelar");
  }
  await page.mouse.wheel(0, 380);
  await page.waitForTimeout(350);
  await page.mouse.wheel(0, -380);
  actions.push("Scroll ida/vuelta (excluido del INP)");
  await page.waitForTimeout(500);
  return actions;
}

const appPort = await freePort();
const fixturePort = await freePort();
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
const results = [];
// Cerrar el navegador interrumpe también una medición pendiente y permite que
// finally recoja el servidor y su emisor, incluso al cancelar desde la terminal.
const interrupt = () => {
  server.kill("SIGTERM");
  browser?.close().catch(() => {});
};
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw new Error("El servidor aislado terminó.");
    try {
      ready = (await fetch(`${base}/entrar`)).ok;
    } catch {
      /* Esperar exclusivamente al proceso propio. */
    }
    if (ready) break;
    await sleep(200);
  }
  if (!ready) throw new Error("El servidor aislado no arrancó.");
  browser = await chromium.launch();
  const setup = await browser.newContext({ baseURL: base });
  const auth = await setup.request.post(
    `http://127.0.0.1:${fixturePort}/sesion`,
    {
      data: { email: "admin@example.test", secret },
    },
  );
  if (!auth.ok()) throw new Error("No se pudo emitir la sesión ficticia.");
  const stateResponse = await setup.request.get("/api/estado");
  if (!stateResponse.ok())
    throw new Error("No se pudo leer el estado ficticio.");
  const state = await stateResponse.json();
  const brand = await setup.request.post("/api/marcas", {
    data: { nombre: "Marca de rendimiento", rubro: "iglesia-reformada" },
  });
  if (!brand.ok()) throw new Error("No se pudo preparar la marca ficticia.");
  const profile = await setup.request.patch("/api/perfil", {
    data: { ...state.user, theme: tema, home: "chat" },
  });
  if (!profile.ok()) throw new Error("No se pudo fijar el tema de ensayo.");
  const paths = options.rutas
    ? String(options.rutas).split(",")
    : [
        "/",
        "/marcas",
        "/canales",
        `/canales/${state.channels[0].id}`,
        "/videos",
        `/videos/${state.videos[0].id}`,
        "/publicados",
        "/aprendizaje",
        "/avatares",
        "/perfil",
        "/admin",
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
        "/entrar",
        "/revisar/whatsapp/enlace-invalido",
        "/no-existe",
      ];
  if (paths.some((path) => !path.startsWith("/") || path.startsWith("//")))
    throw new Error("Las rutas deben ser locales.");
  const storageState = await setup.storageState(); // Solo memoria; nunca se exporta.
  const profiles = options.perfiles
    ? String(options.perfiles).split(",")
    : ["mobile", "desktop"];
  if (profiles.some((profile) => !["mobile", "desktop"].includes(profile)))
    throw new Error("Perfil no válido.");
  const build = readFileSync(".next/BUILD_ID", "utf8").trim();
  for (const profile of profiles) {
    const mobile = profile === "mobile";
    for (const [index, path] of paths.entries()) {
      const name = `${String(index).padStart(2, "0")}-${path.split("/")[1] || "inicio"}-${profile}`;
      const context = await browser.newContext({
        baseURL: base,
        storageState,
        viewport: { width: mobile ? 390 : 1440, height: 900 },
        deviceScaleFactor: 1,
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: "no-preference",
      });
      await context.addInitScript(installObservers);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", {
        rate: mobile ? 4 : 1,
      });
      const trace = [];
      cdp.on("Tracing.dataCollected", ({ value }) =>
        trace.push(...value.map(sanitizeTrace)),
      );
      await cdp.send("Tracing.start", {
        transferMode: "ReportEvents",
        traceConfig: {
          recordMode: "recordAsMuchAsPossible",
          includedCategories: [
            "devtools.timeline",
            "toplevel",
            "v8",
            "blink.user_timing",
            "disabled-by-default-devtools.timeline.frame",
          ],
          enableArgumentFilter: true,
        },
      });
      await page.goto(path, { waitUntil: "load" });
      await expect(page.locator("h1:visible")).toHaveCount(1);
      if (
        path !== "/entrar" &&
        path !== "/no-existe" &&
        !path.startsWith("/revisar/")
      )
        await expect(page.locator(".workspace")).toHaveAttribute(
          "data-conexion",
          "activa",
        );
      await expect(
        page.getByText("Consultando la fábrica…", { exact: true }),
      ).toHaveCount(0);
      await page.waitForTimeout(900);
      const animations = await page.evaluate(() => ({
        cssActivas: document
          .getAnimations()
          .filter((item) => item.playState === "running").length,
        lottieListas: document.querySelectorAll(
          '.lottie-layer[data-ready="true"]',
        ).length,
        documentoVisible: document.visibilityState === "visible",
      }));
      await page.evaluate(() => performance.mark("cooper-movimiento-inicio"));
      const movement = await page.evaluate(
        (ms) => window.__cooperPerformance.frames(ms),
        duration,
      );
      await page.evaluate(() => performance.mark("cooper-movimiento-fin"));
      await page.evaluate(() =>
        performance.mark("cooper-interacciones-inicio"),
      );
      await page.evaluate(() => window.__cooperPerformance.startFrames());
      const actions = await interactions(page, path, mobile);
      const interactiveFrames = await page.evaluate(() =>
        window.__cooperPerformance.stopFrames(),
      );
      await page.evaluate(() => performance.mark("cooper-interacciones-fin"));
      const measured = await page.evaluate(() => ({
        values: window.__cooperPerformance.values,
        supported: window.__cooperPerformance.supported,
        interactionCount: performance.interactionCount,
      }));
      if (
        !measured.supported.includes("event") ||
        measured.interactionCount === undefined
      )
        throw new Error("Chromium no ofrece Event Timing/interactionCount.");
      const complete = new Promise((done) =>
        cdp.once("Tracing.tracingComplete", done),
      );
      await cdp.send("Tracing.end");
      await complete;
      writeFileSync(
        `${output}/${name}.trace.json`,
        JSON.stringify({ traceEvents: trace }),
      );
      const vitals = webVitalsSummary(
        measured.values,
        measured.interactionCount,
      );
      const frames = framesSummary(movement, measured.values.tasks);
      const rendererThreads = trace.filter(
        (event) =>
          event.name === "thread_name" && event.args.name === "CrRendererMain",
      );
      const tasks = trace.filter(
        (event) =>
          event.ph === "X" &&
          ["RunTask", "ThreadControllerImpl::RunTask"].includes(event.name) &&
          rendererThreads.some(
            (thread) => thread.pid === event.pid && thread.tid === event.tid,
          ),
      );
      const result = {
        path,
        profile,
        tema,
        cpu: mobile ? 4 : 1,
        viewport: { width: mobile ? 390 : 1440, height: 900 },
        fecha: new Date().toISOString(),
        build,
        navegador: browser.version(),
        ...vitals,
        movimiento: frames,
        interacciones: framesSummary(interactiveFrames, measured.values.tasks),
        animaciones: animations,
        acciones: actions,
        traza: {
          archivo: `${name}.trace.json`,
          eventos: trace.length,
          tareasRenderer: tasks.length,
          tareaRendererMaxMs: rounded(
            Math.max(0, ...tasks.map((event) => event.dur / 1000)),
          ),
        },
      };
      results.push(result);
      writeFileSync(
        `${output}/resumen.json`,
        JSON.stringify(
          {
            fase: phase,
            umbralesLaboratorio: {
              lcpMs: 2500,
              cls: 0.01,
              inpMs: 200,
              fpsMin: 57,
              frameP95Ms: 25,
              frameYLongTaskMaxExclusivoMs: 100,
              ventanasDeMovimiento: ["estable", "interacciones"],
              exigidos: Boolean(options["exigir-umbrales"]),
            },
            entorno:
              "Laboratorio Chromium local; build de producción, fixtures simuladas aisladas, CPU móvil 4×, sin limitación de red. No son Core Web Vitals de campo.",
            metodologia: `Contexto frío por ruta, tema ${tema}, movimiento habilitado. rAF de ${duration} ms tras 900 ms de estabilización y otra ventana durante interacciones; mide cadencia del navegador, no fotogramas presentados en un teléfono físico. LCP desde navegación, CLS por ventanas de sesión; Event Timing con clic/teclado. CDP conserva eventos/tiempos sin args de recursos/scripts ni screenshots. Abrir *.trace.json en DevTools Performance o Perfetto.`,
            fuentes: [
              "https://web.dev/articles/inp",
              "https://web.dev/articles/lcp",
              "https://web.dev/articles/cls",
              "https://www.w3.org/TR/event-timing/",
              "https://chromedevtools.github.io/devtools-protocol/tot/Tracing/",
              "https://chromedevtools.github.io/devtools-protocol/tot/Emulation/",
              "https://playwright.dev/docs/api/class-cdpsession",
            ],
            mediciones: results,
          },
          null,
          2,
        ) + "\n",
      );
      console.log(
        `${path} ${profile}: LCP=${vitals.lcpMs}ms CLS=${vitals.cls} INP-lab=${vitals.inpLaboratorio.valorMs ?? "<16"}ms FPS=${frames.fps} p95=${frames.frameP95Ms}ms longTasks-movimiento=${frames.longTasks.length}`,
      );
      await context.close();
    }
  }
  await setup.close();
  if (
    options["exigir-umbrales"] &&
    results.some(
      (result) =>
        result.lcpMs === null ||
        result.lcpMs > 2500 ||
        result.cls > 0.01 ||
        result.inpLaboratorio.interaccionesTotales < 2 ||
        result.inpLaboratorio.valorMs > 200 ||
        result.movimiento.fps < 57 ||
        result.movimiento.frameP95Ms > 25 ||
        result.movimiento.frameMaxMs >= 100 ||
        result.movimiento.longTasks.some((task) => task.duracionMs >= 100) ||
        result.interacciones.fps < 57 ||
        result.interacciones.frameP95Ms > 25 ||
        result.interacciones.frameMaxMs >= 100 ||
        result.interacciones.longTasks.some((task) => task.duracionMs >= 100),
    )
  )
    throw new Error(
      "Una medición supera los umbrales de laboratorio; revisar resumen.json.",
    );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  if (server.exitCode === null)
    await new Promise((done) => server.once("exit", done));
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
}
