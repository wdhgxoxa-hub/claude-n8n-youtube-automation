import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import type { Estado } from "../src/servicios/datos";
import type { VideoMedios } from "../src/contratos/video-medios";

/*
 * Movimiento en ejecución real (misión despliegue-final).
 * Partitura: docs/diseno/DIRECCION.md §2 (movimiento), §3 (armazón), §4 (Inicio).
 * Medios: derivados reales del render del proyecto en
 * diseno-fabrica-video/medios (procedencia.json con sha256). Los derivados
 * b2-real-* de medio-real.ts no están en este worktree; no se sustituyen.
 * La medición de fotogramas copia el método de e2e/base-diseno.spec.ts
 * (requestAnimationFrame + View Transition ready → finished + proyección de
 * Cooper) y graba además la traza CDP. Las fases medidas van sin video: la
 * grabación de pantalla resta fotogramas y falsearía la cifra.
 */

// COOPER_MOVIMIENTO_SALIDA_DIR evita pisar la evidencia ya guardada en git;
// COOPER_MOVIMIENTO_TEMA (feria|sala|dia) mide un tema concreto.
const salida = resolve(
  process.env.COOPER_MOVIMIENTO_SALIDA_DIR ?? "../evidencias-diseno/despliegue-final",
);
const temaMovimiento = process.env.COOPER_MOVIMIENTO_TEMA;
if (temaMovimiento && !["feria", "sala", "dia"].includes(temaMovimiento))
  throw new Error("COOPER_MOVIMIENTO_TEMA no válido.");
const crudos = resolve(salida, "videos-crudos");
const carpetaMedios = resolve("diseno-fabrica-video/medios");
const prefijoMedios = "/__despliegue-medios";
const demoURL = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`;
const emisorURL = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT ?? "33173"}`;

type Video = Estado["videos"][number];
type Activo = {
  numero: number;
  poster: string;
  preview: string;
  posterBytes: number;
  previewBytes: number;
  ancho: number;
  alto: number;
  duracion: number;
  tinte: string;
  sha256Poster: string;
  sha256Preview: string;
};
type Sesion = {
  context: BrowserContext;
  page: Page;
  consola: string[];
  ancho: number;
  movil: boolean;
};

function anchoDe(testInfo: TestInfo) {
  return testInfo.project.use.viewport!.width;
}

function guardar(nombre: string, datos: unknown) {
  mkdirSync(salida, { recursive: true });
  writeFileSync(resolve(salida, nombre), JSON.stringify(datos, null, 2) + "\n");
}

const sha256 = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");

// Misma fórmula que src/servicios/tinte-video.ts (extraerTinte): color
// dominante de la miniatura, saturación ≤60 %, luminosidad 45–60 %.
async function tinteDe(buffer: Buffer) {
  const reducido = await sharp(buffer, { limitInputPixels: 20000000 })
    .resize(64, 64, { fit: "inside" })
    .toBuffer();
  const { dominant } = await sharp(reducido).stats();
  const [r, g, b] = [dominant.r, dominant.g, dominant.b].map((n) => n / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const luz = (max + min) / 2;
  let tono = 0;
  if (delta) {
    tono =
      max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
    tono = (tono * 60 + 360) % 360;
  }
  const saturacion = delta ? delta / (1 - Math.abs(2 * luz - 1)) : 0;
  return `hsl(${Math.round(tono) % 360} ${Math.round(Math.min(60, saturacion * 100))}% ${Math.round(Math.max(45, Math.min(60, luz * 100)))}%)`;
}

let activosCache: Activo[] | null = null;
async function activos(): Promise<Activo[]> {
  if (activosCache) return activosCache;
  const procedencia = JSON.parse(
    readFileSync(resolve(carpetaMedios, "procedencia.json"), "utf8"),
  ) as {
    derivados: {
      numero: number;
      poster: { archivo: string; sha256: string; bytes: number };
      preview: {
        archivo: string;
        sha256: string;
        bytes: number;
        ancho: number;
        alto: number;
        duracion: number;
      };
    }[];
  };
  const lista: Activo[] = [];
  for (const d of procedencia.derivados) {
    const poster = readFileSync(resolve(carpetaMedios, d.poster.archivo));
    const preview = readFileSync(resolve(carpetaMedios, d.preview.archivo));
    // Un archivo distinto del acreditado hace fallar el ensayo: no se sustituye.
    expect(sha256(poster), d.poster.archivo).toBe(d.poster.sha256);
    expect(sha256(preview), d.preview.archivo).toBe(d.preview.sha256);
    lista.push({
      numero: d.numero,
      poster: d.poster.archivo,
      preview: d.preview.archivo,
      posterBytes: poster.byteLength,
      previewBytes: preview.byteLength,
      ancho: d.preview.ancho,
      alto: d.preview.alto,
      duracion: d.preview.duracion,
      tinte: await tinteDe(poster),
      sha256Poster: d.poster.sha256,
      sha256Preview: d.preview.sha256,
    });
  }
  expect(lista.length).toBeGreaterThanOrEqual(4);
  activosCache = lista;
  return lista;
}

async function abrir(
  browser: Browser,
  testInfo: TestInfo,
  { grabar = true, reducido = false } = {},
): Promise<Sesion> {
  const use = testInfo.project.use;
  const viewport = use.viewport!;
  mkdirSync(crudos, { recursive: true });
  const context = await browser.newContext({
    baseURL: demoURL,
    extraHTTPHeaders: { Referer: demoURL },
    viewport,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    deviceScaleFactor: use.deviceScaleFactor,
    timezoneId: "America/Lima",
    reducedMotion: reducido ? "reduce" : "no-preference",
    serviceWorkers: "block",
    recordVideo: grabar ? { dir: crudos, size: viewport } : undefined,
  });
  context.setDefaultTimeout(15000);
  const page = await context.newPage();
  const consola: string[] = [];
  page.on("pageerror", (error) => consola.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      consola.push(`${message.type()}: ${message.text()}`);
  });
  const sesion = await context.request.post(`${emisorURL}/sesion`, {
    data: {
      email: "admin@example.test",
      secret: process.env.COOPER_E2E_SECRET,
    },
  });
  expect(sesion.ok()).toBe(true);
  if (temaMovimiento) {
    const { user } = await (await context.request.get("/api/estado")).json();
    const perfil = await context.request.patch("/api/perfil", {
      data: {
        name: user.name,
        image: user.image,
        theme: temaMovimiento,
        home: user.home,
        whatsapp: user.whatsapp ?? "",
      },
    });
    expect(perfil.ok()).toBe(true);
  }
  return {
    context,
    page,
    consola,
    ancho: viewport.width,
    movil: viewport.width < 1024,
  };
}

async function cerrar(sesion: Sesion, nombreVideo?: string) {
  const video = sesion.page.video();
  await sesion.context.close();
  if (video && nombreVideo) {
    // Se mueve (no se copia ni se borra) para dejar un nombre claro.
    renameSync(await video.path(), resolve(salida, nombreVideo));
  }
}

/**
 * Estado de ensayo inyectado por /api/estado y /api/eventos (mismo método que
 * e2e/inicio-diseno.spec.ts): 5 terminados para el carrusel, 10 pendientes
 * para comprobar el tope de 8 escalones, medios reales del proyecto. El primer
 * terminado y un pendiente conservan su ID real: el detalle es SSR y autoriza.
 */
async function prepararEstado(sesion: Sesion) {
  const { page, context } = sesion;
  const lista = await activos();
  const estado: Estado = await (await context.request.get("/api/estado")).json();
  expect(estado.demo, "El ensayo corre sobre la web demo local").toBe(true);
  const propios = estado.videos.filter((v) => v.ownerId === estado.user.id);
  const fuente = propios.find((v) => v.stage === 11);
  const guion = propios.find((v) => v.stage === 3);
  const enCurso = propios.filter((v) => v.stage > 3 && v.stage < 9);
  expect(fuente, "La semilla demo aporta un publicado con ID real").toBeDefined();
  expect(guion, "La semilla demo aporta un guion por aprobar").toBeDefined();
  const ahora = Date.now() - 60_000;
  const dia = 86_400_000;
  const medio = (id: string, indice: number): VideoMedios => {
    const a = lista[indice % lista.length];
    return {
      version: 1,
      videoId: id,
      estado: "listo",
      poster: {
        url: `${prefijoMedios}/${a.poster}`,
        origen: "render",
        ancho: 720,
        alto: 1280,
      },
      preview: {
        url: `${prefijoMedios}/${a.preview}`,
        mime: "video/mp4",
        duracion: a.duracion,
        bytes: a.previewBytes,
      },
      tinte: a.tinte,
      ancho: a.ancho,
      alto: a.alto,
      relacionAspecto: a.ancho / a.alto,
      origenDimensiones: "video",
      actualizadoEn: ahora,
    };
  };
  const terminados: Video[] = Array.from({ length: 5 }, (_, indice) => {
    const id = indice === 0 ? fuente!.id : `despliegue-final-terminado-${indice}`;
    const m = medio(id, indice);
    return {
      ...structuredClone(fuente!),
      id,
      title: `Ensayo de movimiento · pieza ${indice + 1}`,
      stage: 11,
      productionState: "activa",
      createdAt: ahora - indice * dia,
      updatedAt: ahora - indice * dia,
      medios: m,
      observabilidad: {
        ...fuente!.observabilidad,
        montaje: m.preview!.url,
        miniatura: m.poster!.url,
        publicaciones: fuente!.observabilidad.publicaciones.map(
          (publicacion, red) => ({
            ...publicacion,
            id: `${id}-${red}`,
            fecha: new Date(ahora - (indice === 0 ? 0 : 15 + indice) * dia).toISOString(),
            miniatura: m.poster!.url,
            // Serie de ensayo copiada de inicio-diseno: solo alimenta cifras.
            historial: Array.from({ length: 15 }, (_, paso) => ({
              fecha: new Date(ahora - (14 - paso) * dia).toISOString(),
              vistas: (paso + 1) * (2840 - indice * 240) + red * 320,
              meGusta: (paso + 1) * (122 - indice * 12),
              comentarios: (paso + 1) * (16 - indice),
              retencion: 0.72 - indice * 0.04,
              seguidoresGanados: (paso + 1) * (38 - indice * 4),
            })).filter(
              (muestra) =>
                Date.parse(muestra.fecha) >=
                ahora - (indice === 0 ? 0 : 15 + indice) * dia,
            ),
          }),
        ),
      },
    };
  });
  const pendientes: Video[] = Array.from({ length: 10 }, (_, indice) => {
    const id = indice === 0 ? guion!.id : `despliegue-final-pendiente-${indice}`;
    const m = medio(id, indice + 1);
    return {
      ...structuredClone(guion!),
      id,
      title: `Guion por aprobar · ensayo ${indice + 1}`,
      stage: 3,
      productionState: "activa",
      updatedAt: ahora - (30 + indice) * dia,
      medios: m,
      observabilidad: {
        ...guion!.observabilidad,
        montaje: "",
        miniatura: m.poster!.url,
      },
    };
  });
  const produccion = enCurso.map((v, indice) => ({
    ...v,
    updatedAt: ahora - 40 * dia,
    medios: medio(v.id, indice + 2),
  }));
  estado.videos = [...terminados, ...pendientes, ...produccion];
  const peticiones = { eventos: 0, previews: 0, posters: 0, externas: [] as string[] };
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.fallback();
    peticiones.externas.push(url.origin);
    return route.abort("blockedbyclient");
  });
  await page.route(`**${prefijoMedios}/*`, (route) => {
    const nombre = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const activo = lista.find((a) => a.poster === nombre || a.preview === nombre);
    if (!activo) return route.fulfill({ status: 404, body: "" });
    const esVideo = nombre.endsWith(".mp4");
    if (esVideo) peticiones.previews++;
    else peticiones.posters++;
    return route.fulfill({
      body: readFileSync(resolve(carpetaMedios, nombre)),
      contentType: esVideo ? "video/mp4" : "image/webp",
    });
  });
  await page.route(/\/api\/estado(?:\?|$)/, (route) => route.fulfill({ json: estado }));
  await page.route(/\/api\/eventos(?:\?|$)/, (route) => {
    peticiones.eventos++;
    return route.fulfill({
      contentType: "text/event-stream",
      headers: { "Cache-Control": "no-cache" },
      body: `event: estado\ndata: ${JSON.stringify(estado)}\n\n`,
    });
  });
  await page.route(/\/api\/videos\/[^/]+\/medios(?:\?|$)/, (route) => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/")[3]);
    const video = estado.videos.find((v) => v.id === id);
    return video ? route.fulfill({ json: video.medios }) : route.fallback();
  });
  await page.route(/\/api\/videos\/[^/]+\/tinte(?:\?|$)/, (route) => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/")[3]);
    const video = estado.videos.find((v) => v.id === id);
    return video
      ? route.fulfill({ json: { color: video.medios.tinte } })
      : route.fallback();
  });
  return { estado, terminados, pendientes, fuente: fuente!, peticiones, activos: lista };
}
type Ensayo = Awaited<ReturnType<typeof prepararEstado>>;

async function listoInicio(page: Page, ensayo: Ensayo) {
  await expect(page.locator("main .inicio-estudio")).toBeVisible();
  // El SSR trae la semilla demo; el evento en vivo trae el estado de ensayo.
  await expect(page.locator("main .inicio-hero")).toContainText(
    ensayo.terminados[0].title,
  );
  await expect(page.locator("main .inicio-selector")).toHaveCount(5);
  await expect(page.locator("main .inicio-pendiente")).toHaveCount(
    ensayo.pendientes.length,
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
}

function enlaceNav(page: Page, sesion: Sesion, ruta: string) {
  return page.locator(
    `nav[aria-label="${sesion.movil ? "Principal móvil" : "Principal"}"] a[href="${ruta}"]`,
  );
}



// ---------- Muestreo de fotogramas (método de base-diseno) ----------
type Muestra = {
  cuadros: { at: number; delta: number }[];
  desplazamientos: { at: number; valor: number; conEntrada: boolean }[];
  tareasLargas: { at: number; duracion: number }[];
  pista: { at: number; x: number }[];
  inicio: number;
};

async function iniciarMuestra(page: Page, pista?: string) {
  await page.evaluate((selectorPista) => {
    const m: Muestra & { activa: boolean; previo: number; obs: PerformanceObserver } = {
      cuadros: [],
      desplazamientos: [],
      tareasLargas: [],
      pista: [],
      inicio: performance.now(),
      activa: true,
      previo: 0,
      obs: new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) {
          if (e.entryType === "longtask")
            m.tareasLargas.push({ at: e.startTime, duracion: e.duration });
          else {
            const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
            m.desplazamientos.push({ at: s.startTime, valor: s.value, conEntrada: s.hadRecentInput });
          }
        }
      }),
    };
    m.obs.observe({ type: "longtask" });
    m.obs.observe({ type: "layout-shift" });
    (window as Window & { muestraMovimiento?: typeof m }).muestraMovimiento = m;
    const pistaEl = selectorPista ? document.querySelector(selectorPista) : null;
    const cuadro = (t: number) => {
      if (!m.activa) return;
      if (m.previo) m.cuadros.push({ at: t, delta: t - m.previo });
      m.previo = t;
      if (pistaEl)
        m.pista.push({ at: t, x: new DOMMatrixReadOnly(getComputedStyle(pistaEl).transform).m41 });
      requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  }, pista ?? "");
}

async function detenerMuestra(page: Page): Promise<Muestra> {
  return page.evaluate(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const v = window as Window & {
      muestraMovimiento?: Muestra & { activa: boolean; obs: PerformanceObserver };
    };
    const m = v.muestraMovimiento!;
    m.activa = false;
    m.obs.disconnect();
    return {
      cuadros: m.cuadros,
      desplazamientos: m.desplazamientos,
      tareasLargas: m.tareasLargas,
      pista: m.pista,
      inicio: m.inicio,
    };
  });
}

function cifras(muestra: Muestra, desde: number, hasta: number) {
  const deltas = muestra.cuadros
    .filter(({ at, delta }) => at - delta >= desde && at <= hasta)
    .map(({ delta }) => delta);
  const orden = [...deltas].sort((a, b) => a - b);
  const media = deltas.reduce((a, b) => a + b, 0) / (deltas.length || 1);
  const cls = muestra.desplazamientos
    .filter((s) => !s.conEntrada)
    .reduce((a, s) => a + s.valor, 0);
  const clsTotal = muestra.desplazamientos.reduce((a, s) => a + s.valor, 0);
  return {
    ventanaMs: Math.round(hasta - desde),
    cuadros: deltas.length,
    fpsMedio: deltas.length ? Number((1000 / media).toFixed(1)) : 0,
    p95Ms: deltas.length ? Number(orden[Math.floor(orden.length * 0.95)].toFixed(1)) : null,
    maxCuadroMs: deltas.length ? Number(orden.at(-1)!.toFixed(1)) : null,
    cuadrosMayores50ms: deltas.filter((d) => d > 50).length,
    cls: Number(cls.toFixed(4)),
    clsIncluyendoEntrada: Number(clsTotal.toFixed(4)),
    tareasLargasMs: muestra.tareasLargas.map((t) => Math.round(t.duracion)),
  };
}


/** Arrastra hacia el lado con recorrido libre: al tope izquierdo, a la derecha. */

test.beforeAll(() => {
  mkdirSync(salida, { recursive: true });
});

// 1 ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// Fluidez de Cooper (misión pulido-despliegue). Mismo método que la prueba 9:
// requestAnimationFrame dentro de la página, sin grabación de video. Ventana
// fija de 900 ms desde el clic, para comparar versiones sin depender de cómo
// detecta cada una el «fin» del movimiento. 390 px con CPU 4×, 1440 px sin
// limitar. Cada acción se repite COOPER_FLUIDEZ_REPETICIONES veces (3).
const repeticiones = Number(process.env.COOPER_FLUIDEZ_REPETICIONES ?? 3);
const VENTANA_MS = 900;

async function armarClic(page: Page) {
  await page.evaluate(() => {
    const v = window as Window & { clicFluidez?: number | null };
    v.clicFluidez = null;
    window.addEventListener(
      "click",
      () => {
        if (v.clicFluidez === null) v.clicFluidez = performance.now();
      },
      { capture: true, once: true },
    );
  });
}

async function medirAccion(page: Page, accion: () => Promise<void>) {
  await armarClic(page);
  await iniciarMuestra(page);
  await accion();
  await page.waitForTimeout(VENTANA_MS + 500);
  const m = await detenerMuestra(page);
  const clic = await page.evaluate(
    () => (window as Window & { clicFluidez?: number | null }).clicFluidez,
  );
  return cifras(m, clic ?? m.inicio, (clic ?? m.inicio) + VENTANA_MS);
}

test("Fluidez de Cooper: abrir, cerrar y cambiar de sección con Cooper abierto", async ({
  browser,
}, testInfo) => {
  const ancho = anchoDe(testInfo);
  const s = await abrir(browser, testInfo, { grabar: false });
  const { page, context } = s;
  const cpu = ancho < 768 ? 4 : 1;
  const r: Record<string, unknown> = { ancho, tema: temaMovimiento ?? "perfil", cpu: `${cpu}×` };
  let cdp: CDPSession | null = null;
  try {
    const navegador = await browser.newBrowserCDPSession();
    const info = await navegador.send("SystemInfo.getInfo");
    await navegador.detach();
    r.renderizador = {
      gl: info.gpu.auxAttributes?.glRenderer,
      composicionGpu: info.gpu.featureStatus?.gpu_compositing,
      navegador: browser.version(),
    };
    const ensayo = await prepararEstado(s);
    await page.goto("/");
    await listoInicio(page, ensayo);
    await page.waitForTimeout(800);
    cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });

    const abrirOrbe = page.getByRole("button", { name: "Abrir Cooper", exact: true });
    const cerrarHoja = page
      .getByRole("dialog", { name: "Cooper, tu compañero", exact: true })
      .getByRole("button", { name: "Cerrar Cooper", exact: true });
    const hoja = page.getByRole("dialog", { name: "Cooper, tu compañero", exact: true });

    const abrirMedidas: unknown[] = [];
    const cerrarMedidas: unknown[] = [];
    for (let i = 0; i < repeticiones; i += 1) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      abrirMedidas.push(await medirAccion(page, () => abrirOrbe.click()));
      await expect(hoja).toBeVisible();
      await page.waitForTimeout(600);
      cerrarMedidas.push(await medirAccion(page, () => cerrarHoja.click()));
      await expect(hoja).toBeHidden();
      await page.waitForTimeout(600);
    }
    r.abrirCooperEnInicio = abrirMedidas;
    r.cerrarCooperEnInicio = cerrarMedidas;

    // Cambio de sección: primero con Cooper cerrado (control, en todos los
    // anchos) y luego con Cooper abierto. En móvil la hoja es modal y deja el
    // resto inerte: no hay cambio de sección posible con ella abierta.
    const cambiar = async (etiqueta: string) => {
      const filas: unknown[] = [];
      for (let i = 0; i < repeticiones * 2; i += 1) {
        const destino = i % 2 === 0 ? "/videos" : "/";
        await page.waitForTimeout(500);
        filas.push({
          destino,
          ...(await medirAccion(page, () => enlaceNav(page, s, destino).click())),
        });
        await expect(page).toHaveURL(new RegExp(`${destino === "/" ? "/$" : destino + "$"}`));
      }
      r[etiqueta] = filas;
    };
    await cambiar("cambioDeSeccionConCooperCerrado");
    await abrirOrbe.click();
    await expect(hoja).toBeVisible();
    await page.waitForTimeout(900);
    if (s.movil) {
      r.cambioDeSeccionConCooperAbierto = {
        aplicable: false,
        motivo: "la hoja es modal: la barra inferior queda inert",
        barraInerte: await enlaceNav(page, s, "/videos").evaluate(
          (e) => e.closest("[inert]") !== null,
        ),
      };
    } else {
      await cambiar("cambioDeSeccionConCooperAbierto");
      await expect(hoja).toBeVisible();
    }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    guardar(`fluidez-${ancho}.json`, r);
  } finally {
    if (cdp) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
    r.consola = s.consola;
    guardar(`fluidez-${ancho}.json`, r);
    await cerrar(s);
  }
  expect(s.consola, "Consola sin errores ni avisos").toEqual([]);
});
