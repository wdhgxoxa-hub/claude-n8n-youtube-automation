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
  appendFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import type { Estado } from "../src/servicios/datos";
import type { VideoMedios } from "../src/contratos/video-medios";
import { abrirCooper, abrirMasDestinos, cerrarCooper } from "../e2e/ayudas-diseno";

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

function nombreMedio(id: string) {
  // Copia literal de src/componentes/transiciones.tsx (nombreMedio).
  return `video-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

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

// ---------- View Transitions (copiado de base-diseno y ampliado) ----------
type Observacion = {
  nombres: string[];
  inicio: number;
  domListo: number | null;
  listo: number | null;
  fin: number | null;
  error: string | null;
  pseudo: {
    pseudo: string;
    nombre: string;
    duracion: number;
    curva: string;
    propiedades: string[];
    primero: Record<string, unknown>;
    ultimo: Record<string, unknown>;
  }[];
};

async function instalarObservadorTransiciones(page: Page) {
  await page.evaluate(() => {
    const ventana = window as Window & {
      transicionesObservadas?: Observacion[];
      transicionTerminada?: Promise<void>;
      llamadasTransicion?: number;
    };
    ventana.transicionesObservadas = [];
    ventana.llamadasTransicion = 0;
    const original = document.startViewTransition?.bind(document);
    if (!original) return;
    document.startViewTransition = (
      ...args: Parameters<typeof original>
    ) => {
      ventana.llamadasTransicion = (ventana.llamadasTransicion ?? 0) + 1;
      const obs: Observacion = {
        nombres: [
          ...document.querySelectorAll<HTMLElement>("[data-video-transition]"),
        ]
          .map((e) => e.style.viewTransitionName)
          .filter(Boolean),
        inicio: performance.now(),
        domListo: null,
        listo: null,
        fin: null,
        error: null,
        pseudo: [],
      };
      ventana.transicionesObservadas!.push(obs);
      const transicion = original(...args);
      ventana.transicionTerminada = transicion.finished;
      void transicion.updateCallbackDone.then(
        () => {
          obs.domListo = performance.now();
        },
        (e: Error) => {
          obs.error = e.message;
        },
      );
      void transicion.ready.then(
        () => {
          obs.listo = performance.now();
          obs.pseudo = document.documentElement
            .getAnimations({ subtree: true })
            .filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement)
            .map((a) => {
              const efecto = a.effect as KeyframeEffect;
              const marcos = efecto.getKeyframes();
              const ignorar = new Set(["offset", "computedOffset", "easing", "composite"]);
              return {
                pseudo: efecto.pseudoElement ?? "",
                nombre: (a as CSSAnimation).animationName ?? a.constructor.name,
                duracion: Number(efecto.getComputedTiming().duration),
                curva: String(efecto.getTiming().easing),
                propiedades: [
                  ...new Set(marcos.flatMap((m) => Object.keys(m).filter((k) => !ignorar.has(k)))),
                ],
                primero: marcos[0] ?? {},
                ultimo: marcos.at(-1) ?? {},
              };
            });
        },
        (e: Error) => {
          obs.error = e.message;
        },
      );
      void transicion.finished.then(
        () => {
          obs.fin = performance.now();
        },
        (e: Error) => {
          obs.error = e.message;
        },
      );
      return transicion;
    };
  });
}

async function terminarTransicion(page: Page) {
  await page.evaluate(async () => {
    const terminada = (window as Window & { transicionTerminada?: Promise<void> })
      .transicionTerminada;
    if (!terminada) throw new Error("La navegación no inició View Transition.");
    let reloj: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        terminada,
        new Promise<never>((_, reject) => {
          reloj = setTimeout(
            () => reject(new Error("View Transition no terminó en 8 segundos.")),
            8000,
          );
        }),
      ]);
    } finally {
      clearTimeout(reloj);
    }
  });
}

async function leerTransiciones(page: Page) {
  return page.evaluate(() => {
    const v = window as Window & {
      transicionesObservadas?: Observacion[];
      llamadasTransicion?: number;
    };
    return {
      llamadas: v.llamadasTransicion ?? 0,
      observaciones: v.transicionesObservadas ?? [],
    };
  });
}

// ---------- Proyección del orbe de Cooper (copiado de base-diseno) ----------
type Proyeccion = {
  clic: number | null;
  inicio: number | null;
  finProyeccion: number | null;
  inicioFundido: number | null;
  finFundido: number | null;
  fundidos: number;
};

async function observarProyeccionCooper(page: Page) {
  await page.evaluate(() => {
    const obs: Proyeccion = {
      clic: null,
      inicio: null,
      finProyeccion: null,
      inicioFundido: null,
      finFundido: null,
      fundidos: 0,
    };
    const v = window as Window & {
      proyeccionCooper?: Proyeccion;
      proyeccionTerminada?: Promise<void>;
    };
    v.proyeccionCooper = obs;
    let terminar: () => void = () => {};
    v.proyeccionTerminada = new Promise<void>((r) => {
      terminar = r;
    });
    const pendientes = new Set<EventTarget>();
    const clic = (event: MouseEvent) => {
      if (
        obs.clic === null &&
        event.target instanceof Element &&
        event.target.closest(".cooper-orb")
      )
        obs.clic = performance.now();
    };
    const mutaciones = new MutationObserver(() => {
      if (obs.clic === null) return;
      const panel = document.querySelector(".cooper-panel");
      if (!panel) return;
      const proyectando = panel.getAttribute("data-projecting") === "true";
      if (proyectando && obs.inicio === null) obs.inicio = performance.now();
      else if (!proyectando && obs.inicio !== null && obs.finProyeccion === null)
        obs.finProyeccion = performance.now();
    });
    const transicion = (event: TransitionEvent) => {
      if (
        event.propertyName !== "opacity" ||
        !(event.target instanceof Element) ||
        !event.target.parentElement?.matches(".cooper-panel") ||
        obs.finProyeccion === null
      )
        return;
      if (event.type === "transitionrun") {
        pendientes.add(event.target);
        obs.fundidos += 1;
        if (obs.inicioFundido === null) obs.inicioFundido = performance.now();
      } else {
        pendientes.delete(event.target);
        if (!pendientes.size && obs.fundidos) {
          obs.finFundido = performance.now();
          mutaciones.disconnect();
          terminar();
        }
      }
    };
    document.addEventListener("click", clic, true);
    for (const nombre of ["transitionrun", "transitionend", "transitioncancel"])
      document.addEventListener(nombre, transicion as EventListener, true);
    mutaciones.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-projecting"],
    });
  });
}

async function terminarProyeccionCooper(page: Page) {
  return page.evaluate(async (): Promise<Proyeccion | null> => {
    const terminada = (window as Window & { proyeccionTerminada?: Promise<void> })
      .proyeccionTerminada;
    if (!terminada) throw new Error("No se observó la proyección de Cooper.");
    let reloj: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        terminada,
        new Promise<never>((_, reject) => {
          reloj = setTimeout(
            () => reject(new Error("El movimiento de Cooper no terminó en 8 segundos.")),
            8000,
          );
        }),
      ]);
    } finally {
      clearTimeout(reloj);
    }
    return (window as Window & { proyeccionCooper?: Proyeccion }).proyeccionCooper ?? null;
  });
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

// ---------- Arrastre: ratón a 1440, toque real (CDP) a 390 ----------
async function arrastrar(
  page: Page,
  cdp: CDPSession | null,
  desde: { x: number; y: number },
  hasta: { x: number; y: number },
  pasos = 12,
) {
  if (!cdp) {
    await page.mouse.move(desde.x, desde.y);
    await page.mouse.down();
    await page.mouse.move(hasta.x, hasta.y, { steps: pasos });
    await page.mouse.up();
    return "raton";
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: desde.x, y: desde.y }],
  });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: desde.x + ((hasta.x - desde.x) * i) / pasos,
          y: desde.y + ((hasta.y - desde.y) * i) / pasos,
        },
      ],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  return "toque-cdp";
}

/** Arrastra hacia el lado con recorrido libre: al tope izquierdo, a la derecha. */
async function puntosArrastre(page: Page, caja: { x: number; y: number; width: number; height: number }) {
  const { x, limite } = await page.locator("main .inicio-carrusel-pista").evaluate((p) => ({
    x: new DOMMatrixReadOnly(getComputedStyle(p).transform).m41,
    limite: p.scrollWidth - p.parentElement!.clientWidth,
  }));
  const y = caja.y + caja.height * 0.4;
  const izquierda = { x: caja.x + caja.width * 0.3, y };
  const derecha = { x: caja.x + caja.width * 0.85, y };
  return x <= -limite / 2
    ? { desde: izquierda, hasta: derecha, sentido: "derecha", xInicial: x, limite }
    : { desde: derecha, hasta: izquierda, sentido: "izquierda", xInicial: x, limite };
}

async function colorComputado(page: Page, color: string) {
  return page.evaluate((c) => {
    const sonda = document.createElement("span");
    sonda.style.color = c;
    document.body.append(sonda);
    const valor = getComputedStyle(sonda).color;
    sonda.remove();
    return valor;
  }, color);
}

test.beforeAll(() => {
  mkdirSync(salida, { recursive: true });
});

// 1 ─────────────────────────────────────────────────────────────────────────
test("1 Transición de ruta: miniatura → reproductor (elemento compartido) y fundido de respaldo", async ({
  browser,
}, testInfo) => {
  const ancho = anchoDe(testInfo);
  const s = await abrir(browser, testInfo);
  const { page } = s;
  const r: Record<string, unknown> = { ancho };
  try {
    const ensayo = await prepararEstado(s);
    await page.goto("/");
    await listoInicio(page, ensayo);
    r.apiDisponible = await page.evaluate(() => typeof document.startViewTransition === "function");
    expect(r.apiDisponible, "Chromium expone View Transitions").toBe(true);
    await instalarObservadorTransiciones(page);
    const enlace = page.locator("main .inicio-hero-enlace");
    const miniatura = enlace.locator("[data-video-transition]").first();
    const esperado = nombreMedio(ensayo.fuente.id);
    await expect(miniatura).toHaveAttribute("data-video-transition", esperado);
    const href = await enlace.getAttribute("href");
    await page.waitForTimeout(600);
    await enlace.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await terminarTransicion(page);
    const { llamadas, observaciones } = await leerTransiciones(page);
    const reproductor = page.locator("main .real-player").first();
    await expect(reproductor).toBeVisible();
    const nombreDetalle = await reproductor.evaluate(
      (e) => (e as HTMLElement).style.viewTransitionName,
    );
    const obs = observaciones[0];
    const grupo = obs?.pseudo.find((p) => p.pseudo === `::view-transition-group(${esperado})`);
    const nuevaRaiz = obs?.pseudo.find((p) => p.pseudo === "::view-transition-new(root)");
    const viejaRaiz = obs?.pseudo.find((p) => p.pseudo === "::view-transition-old(root)");
    Object.assign(r, {
      llamadasStartViewTransition: llamadas,
      nombreMiniatura: obs?.nombres,
      nombreReproductorDetalle: nombreDetalle,
      latenciaHastaAnimarMs: obs?.listo && Math.round(obs.listo - obs.inicio),
      duracionAnimacionMs: obs?.listo && obs?.fin && Math.round(obs.fin - obs.listo),
      error: obs?.error,
      pseudoElementos: obs?.pseudo,
    });
    expect(llamadas, "La navegación usa document.startViewTransition").toBe(1);
    expect(obs.error).toBeNull();
    expect(obs.nombres, "La miniatura toma view-transition-name").toContain(esperado);
    expect(nombreDetalle, "El reproductor del detalle comparte el nombre").toBe(esperado);
    expect(grupo, "Existe ::view-transition-group del medio").toBeDefined();
    expect(grupo!.duracion, "Elemento compartido en 640 ms").toBe(640);
    expect(grupo!.propiedades, "El grupo interpola caja y posición").toEqual(
      expect.arrayContaining(["transform", "width", "height"]),
    );
    expect(nuevaRaiz?.duracion, "Resto de la página: 420 ms").toBe(420);
    expect(viejaRaiz?.duracion).toBe(420);
    expect(nuevaRaiz?.propiedades).toEqual(expect.arrayContaining(["opacity", "transform"]));

    // Respaldo sin la API: fundido de 240 ms en .route-choreography.
    await page.goto("/");
    await listoInicio(page, ensayo);
    await page.evaluate(() => {
      Object.defineProperty(document, "startViewTransition", {
        value: undefined,
        configurable: true,
      });
      const v = window as Window & { inicioRespaldo?: unknown[] };
      v.inicioRespaldo = [];
      document.addEventListener(
        "animationstart",
        (event) => {
          const t = event.target as Element;
          if (!t.classList.contains("route-choreography")) return;
          const a = t.getAnimations().find((x) => (x as CSSAnimation).animationName === event.animationName);
          const efecto = a?.effect as KeyframeEffect | undefined;
          v.inicioRespaldo!.push({
            nombre: event.animationName,
            duracion: efecto ? Number(efecto.getComputedTiming().duration) : null,
            propiedades: efecto
              ? [...new Set(efecto.getKeyframes().flatMap((m) => Object.keys(m)))].filter(
                  (k) => !["offset", "computedOffset", "easing", "composite"].includes(k),
                )
              : [],
          });
        },
        true,
      );
    });
    await enlaceNav(page, s, "/publicados").click();
    await expect(page).toHaveURL(/\/publicados$/);
    await page.waitForTimeout(600);
    const respaldo = await page.evaluate(
      () => (window as Window & { inicioRespaldo?: unknown[] }).inicioRespaldo,
    );
    r.respaldoSinApi = respaldo;
    expect(respaldo, "Sin la API, la ruta funde").toEqual([
      { nombre: "ruta-fundido", duracion: 240, propiedades: ["opacity"] },
    ]);
    r.peticiones = ensayo.peticiones;
  } finally {
    r.consola = s.consola;
    guardar(`transicion-${ancho}.json`, r);
    await cerrar(s, `transicion-${ancho}.webm`);
  }
  expect(s.consola, "Consola sin errores ni avisos").toEqual([]);
});

// 2 ─────────────────────────────────────────────────────────────────────────
test("2 Entradas escalonadas: 40 ms, máximo 8, una vez por visita", async ({
  browser,
}, testInfo) => {
  const ancho = anchoDe(testInfo);
  const s = await abrir(browser, testInfo);
  const { page } = s;
  const r: Record<string, unknown> = { ancho };
  try {
    const ensayo = await prepararEstado(s);
    await page.goto("/");
    await listoInicio(page, ensayo);
    await instalarObservadorTransiciones(page);
    await enlaceNav(page, s, "/videos").click();
    await expect(page).toHaveURL(/\/videos$/);
    await terminarTransicion(page);
    await page.evaluate(() => {
      const v = window as Window & { entradas?: unknown[]; clicEntrada?: number };
      v.entradas = [];
      document.addEventListener(
        "click",
        () => {
          v.clicEntrada ??= performance.now();
        },
        true,
      );
      document.addEventListener(
        "animationstart",
        (event) => {
          const t = event.target as HTMLElement;
          if (!t.classList.contains("entrada-estudio")) return;
          v.entradas!.push({
            indice: [...document.querySelectorAll(".entrada-estudio")].indexOf(t),
            nombre: event.animationName,
            at: performance.now(),
          });
        },
        true,
      );
    });
    await enlaceNav(page, s, "/").click();
    await expect(page).toHaveURL(new RegExp(`${demoURL.replaceAll(".", "\\.")}/$`));
    await terminarTransicion(page);
    await page.waitForTimeout(1200);
    const leer = () =>
      page.evaluate(() => {
        const v = window as Window & { entradas?: { indice: number; nombre: string; at: number }[]; clicEntrada?: number };
        const elementos = [...document.querySelectorAll<HTMLElement>(".entrada-estudio")].map((e, indice) => {
          const estilo = getComputedStyle(e);
          return {
            indice,
            orden: estilo.getPropertyValue("--orden").trim(),
            retrasoCss: estilo.animationDelay,
            duracionCss: estilo.animationDuration,
            nombreCss: estilo.animationName,
          };
        });
        return { elementos, entradas: v.entradas ?? [], clic: v.clicEntrada ?? null };
      });
    const visita = await leer();
    const marcos = await page.evaluate(() => {
      // Fotogramas clave declarados (getKeyframes no sirve tras terminar).
      const hoja = [...document.styleSheets].flatMap((h) => {
        try {
          return [...h.cssRules];
        } catch {
          return [];
        }
      });
      const regla = hoja.find(
        (x) => x instanceof CSSKeyframesRule && x.name === "route-in",
      ) as CSSKeyframesRule | undefined;
      const desde = regla ? [...regla.cssRules][0] as CSSKeyframeRule : undefined;
      const desplazamiento = getComputedStyle(document.documentElement)
        .getPropertyValue("--desplazamiento-entrada")
        .trim();
      return {
        opacidad: desde?.style.opacity,
        transform: desde?.style.transform,
        desplazamiento,
      };
    });
    // Re-renders sin salir de la pantalla: selección del carrusel, desplazamiento
    // y una nueva entrega del estado en vivo (EventSource reconecta).
    const eventosAntes = ensayo.peticiones.eventos;
    await page.getByRole("button", { name: "Video siguiente", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => ensayo.peticiones.eventos, { timeout: 12000 }).toBeGreaterThan(eventosAntes);
    await page.waitForTimeout(600);
    const despues = await leer();
    // Pausa: posición final (movimiento-cooper.md). Ocultar la pestaña pausa el
    // movimiento; al volver, las entradas ya hechas no deben relanzarse desde
    // opacidad 0 (el estudio parpadeaba en cada cambio de pestaña).
    const pausaVisibilidad = await page.evaluate(async () => {
      const ws = document.querySelector(".workspace")!;
      const fijar = (oculto: boolean) => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => oculto });
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => (oculto ? "hidden" : "visible"),
        });
        document.dispatchEvent(new Event("visibilitychange"));
      };
      fijar(true);
      await new Promise((r) => setTimeout(r, 300));
      const enPausa = ws.getAttribute("data-motion");
      fijar(false);
      let opacidadMinima = 1;
      const fin = performance.now() + 700;
      while (performance.now() < fin) {
        await new Promise((r) => requestAnimationFrame(r));
        for (const e of document.querySelectorAll<HTMLElement>(".entrada-estudio"))
          opacidadMinima = Math.min(opacidadMinima, parseFloat(getComputedStyle(e).opacity));
      }
      // Devolver los getters reales del prototipo.
      Reflect.deleteProperty(document, "hidden");
      Reflect.deleteProperty(document, "visibilityState");
      return { enPausa, alVolver: ws.getAttribute("data-motion"), opacidadMinima };
    });
    const trasPausa = await leer();
    r.pausaPorVisibilidad = {
      ...pausaVisibilidad,
      arranquesTrasReanudar: trasPausa.entradas.length - despues.entradas.length,
    };
    expect(pausaVisibilidad.enPausa, "Pestaña oculta = movimiento en pausa").toBe("paused");
    expect(pausaVisibilidad.alVolver).toBe("playing");
    expect(trasPausa.entradas.length, "Reanudar no relanza las entradas").toBe(despues.entradas.length);
    expect(pausaVisibilidad.opacidadMinima, "Sin parpadeo al reanudar").toBeGreaterThan(0.99);
    const retrasos = visita.elementos.map((e) => {
      const v = e.retrasoCss;
      return Math.round(parseFloat(v) * (v.endsWith("ms") ? 1 : 1000));
    });
    const tiempos = visita.elementos.map((e) => visita.entradas.filter((x) => x.indice === e.indice).map((x) => Math.round(x.at - visita.entradas[0].at)));
    Object.assign(r, {
      elementos: visita.elementos.length,
      retrasosMs: retrasos,
      retrasosDistintos: new Set(retrasos).size,
      duracion: visita.elementos[0]?.duracionCss,
      nombre: visita.elementos[0]?.nombreCss,
      fotogramaInicial: marcos,
      arranquesPorElemento: tiempos,
      arranquesTrasRerender: despues.entradas.length - visita.entradas.length,
      entregasEnVivoDuranteLaPrueba: ensayo.peticiones.eventos - eventosAntes,
    });
    expect(visita.elementos.length, "10 tarjetas de «Te toca a ti»").toBe(10);
    expect(retrasos, "Escalón 40 ms con tope en el 8.º").toEqual(
      visita.elementos.map((_, i) => Math.min(i, 7) * 40),
    );
    expect(new Set(retrasos).size).toBeLessThanOrEqual(8);
    expect(visita.elementos.every((e) => e.duracionCss === "0.42s" && e.nombreCss === "route-in")).toBe(true);
    expect(marcos.opacidad, "Entra desde opacidad 0").toBe("0");
    expect(marcos.transform, "y 12→0 con el token de desplazamiento").toContain("--desplazamiento-entrada");
    expect(marcos.desplazamiento).toBe("12px");
    for (const t of tiempos) expect(t.length, "Cada tarjeta entra una sola vez").toBe(1);
    // Orden real de arranque: no decrece con el índice (tolerancia de un cuadro).
    const primeros = tiempos.map((t) => t[0]);
    for (let i = 1; i < primeros.length; i++)
      expect(primeros[i] + 17).toBeGreaterThanOrEqual(primeros[i - 1]);
    expect(despues.entradas.length, "Sin nuevas entradas tras re-render").toBe(visita.entradas.length);
  } finally {
    r.consola = s.consola;
    guardar(`entradas-${ancho}.json`, r);
    await cerrar(s, `entradas-${ancho}.webm`);
  }
  expect(s.consola, "Consola sin errores ni avisos").toEqual([]);
});

// 3 ─────────────────────────────────────────────────────────────────────────
test("3 Vista previa de medios con MP4 real", async ({ browser }, testInfo) => {
  const ancho = anchoDe(testInfo);
  const s = await abrir(browser, testInfo);
  const { page } = s;
  const r: Record<string, unknown> = { ancho };
  try {
    const ensayo = await prepararEstado(s);
    await page.goto("/");
    await listoInicio(page, ensayo);
    const medio = page.locator("main .inicio-hero .medio").first();
    await expect(medio.locator("video")).toHaveCount(1);
    const instalar = () =>
      medio.evaluate((raiz) => {
        const v = window as Window & { registroMedio?: { evento: string; at: number; valor?: string }[] };
        const registro: { evento: string; at: number; valor?: string }[] = [];
        v.registroMedio = registro;
        const video = raiz.querySelector("video")!;
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
          if (this === video) registro.push({ evento: "play()", at: performance.now() });
          return play.call(this);
        };
        raiz.addEventListener("pointerenter", () => registro.push({ evento: "pointerenter", at: performance.now() }));
        raiz.addEventListener("pointerleave", () => registro.push({ evento: "pointerleave", at: performance.now() }));
        for (const nombre of ["playing", "pause"])
          video.addEventListener(nombre, () => registro.push({ evento: nombre, at: performance.now() }));
        new MutationObserver(() =>
          registro.push({ evento: "data-preview", at: performance.now(), valor: (raiz as HTMLElement).dataset.preview }),
        ).observe(raiz, { attributes: true, attributeFilter: ["data-preview"] });
        let activo = true;
        const opacidad = () => {
          if (!activo) return;
          registro.push({ evento: "opacidad", at: performance.now(), valor: getComputedStyle(video).opacity });
          requestAnimationFrame(opacidad);
        };
        requestAnimationFrame(opacidad);
        setTimeout(() => {
          activo = false;
        }, 6000);
      });
    const leer = () =>
      page.evaluate(() => (window as Window & { registroMedio?: { evento: string; at: number; valor?: string }[] }).registroMedio ?? []);
    const propiedades = () =>
      medio.locator("video").evaluate((v) => {
        const video = v as HTMLVideoElement;
        return {
          src: new URL(video.currentSrc || video.src).pathname,
          ancho: video.videoWidth,
          alto: video.videoHeight,
          duracion: video.duration,
          silenciado: video.muted,
          pausado: video.paused,
          tiempo: video.currentTime,
          transicion: `${getComputedStyle(video).transitionProperty} ${getComputedStyle(video).transitionDuration}`,
        };
      });
    if (!s.movil) {
      await page.mouse.move(5, 5);
      await instalar();
      await medio.hover();
    } else {
      // Móvil: reproduce al entrar en vista (≥65 %) sin gesto; se para al salir.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(medio).toHaveAttribute("data-preview", "off");
      await instalar();
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await expect(medio).toHaveAttribute("data-preview", "on");
    await expect.poll(async () => (await propiedades()).tiempo).toBeGreaterThan(0.1);
    const reproduciendo = await propiedades();
    await page.waitForTimeout(500);
    if (!s.movil) await page.mouse.move(5, 5);
    else await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(medio).toHaveAttribute("data-preview", "off");
    await expect.poll(async () => (await propiedades()).pausado).toBe(true);
    await page.waitForTimeout(500);
    const registro = await leer();
    const t = (evento: string, valor?: string) =>
      registro.find((x) => x.evento === evento && (valor === undefined || x.valor === valor))?.at ?? null;
    const opacidades = registro.filter((x) => x.evento === "opacidad").map((x) => ({ at: x.at, v: Number(x.valor) }));
    const tPlaying = t("playing");
    const primeraSubida = opacidades.find((o) => tPlaying !== null && o.at >= tPlaying - 20 && o.v > 0.01);
    const plena = opacidades.find((o) => primeraSubida && o.at >= primeraSubida.at && o.v >= 0.99);
    const intermedias = opacidades.filter((o) => o.v > 0.01 && o.v < 0.99).length;
    const activo = ensayo.activos.find((a) => reproduciendo.src.endsWith(a.preview));
    Object.assign(r, {
      reproduccion: reproduciendo,
      mp4: activo
        ? { archivo: `diseno-fabrica-video/medios/${activo.preview}`, sha256: activo.sha256Preview, bytes: activo.previewBytes }
        : null,
      esperaHastaPlayMs: s.movil
        ? null
        : t("play()") !== null && t("pointerenter") !== null
          ? Math.round(t("play()")! - t("pointerenter")!)
          : null,
      fundidoEntradaMs: primeraSubida && plena ? Math.round(plena.at - primeraSubida.at) : null,
      cuadrosConOpacidadIntermedia: intermedias,
      secuenciaDataPreview: registro.filter((x) => x.evento === "data-preview").map((x) => x.valor),
      peticionesPreview: ensayo.peticiones.previews,
    });
    expect(activo, "El MP4 servido es un derivado real acreditado").toBeDefined();
    expect(reproduciendo).toMatchObject({ ancho: 360, alto: 640, silenciado: true });
    expect(reproduciendo.duracion).toBeCloseTo(5, 0);
    expect(reproduciendo.transicion).toBe("opacity 0.24s");
    expect((r.secuenciaDataPreview as string[]).slice(0, 2), "Prepara y luego reproduce").toEqual(["preparando", "on"]);
    if (!s.movil) {
      expect(r.esperaHastaPlayMs as number, "Espera de 180 ms tras el hover").toBeGreaterThanOrEqual(180);
      expect(r.esperaHastaPlayMs as number).toBeLessThan(400);
    }
    expect(intermedias, "La vista previa funde (no aparece de golpe)").toBeGreaterThanOrEqual(3);
  } finally {
    r.consola = s.consola;
    guardar(`vista-previa-${ancho}.json`, r);
    await cerrar(s, `vista-previa-${ancho}.webm`);
  }
  expect(s.consola, "Consola sin errores ni avisos").toEqual([]);
});

// 4 ─────────────────────────────────────────────────────────────────────────
test("4 Cifras que suben al entrar en vista", async ({ browser }, testInfo) => {
  const ancho = anchoDe(testInfo);
  const s = await abrir(browser, testInfo);
  const { page } = s;
  const r: Record<string, unknown> = { ancho };
  try {
    const ensayo = await prepararEstado(s);
    await page.goto("/");
    await listoInicio(page, ensayo);
    const metricas = page.locator("main .inicio-metricas");
    await expect(metricas.locator(".cifra-heroe")).toHaveCount(4);
    const antes = await metricas.locator(".cifra").evaluateAll((cs) =>
      cs.map((c) => ({ visible: c.getAttribute("data-visible"), rodillos: c.querySelectorAll(".number-reel").length })),
    );
    const medicion = await metricas.evaluate(async (zona) => {
      const muestras: { at: number; visible: string | null; posiciones: number[]; crudos: string[] }[] = [];
      let activo = true;
      const cuadro = () => {
        if (!activo) return;
        const cifra = zona.querySelector(".cifra-heroe")!;
        muestras.push({
          at: performance.now(),
          visible: cifra.getAttribute("data-visible"),
          posiciones: [...cifra.querySelectorAll<HTMLElement>(".number-reel")].map((rodillo) => {
            const ty = new DOMMatrixReadOnly(getComputedStyle(rodillo).transform).m42;
            // Cada rodillo apila 0–9: una cifra equivale al 10 % de su alto.
            return Number((-ty / (rodillo.getBoundingClientRect().height / 10)).toFixed(3));
          }),
          // Transform sin redondear: deja de cambiar solo cuando termina la animación.
          crudos: [...cifra.querySelectorAll<HTMLElement>(".number-reel")].map((rodillo) => getComputedStyle(rodillo).transform),
        });
        requestAnimationFrame(cuadro);
      };
      requestAnimationFrame(cuadro);
      // A 390 las cuatro cifras se apilan y la zona supera la pantalla: centrar
      // la zona dejaría fuera la cifra medida. Se centra esa cifra.
      zona.querySelector(".cifra-heroe")!.scrollIntoView({ block: "center" });
      await new Promise((r) => setTimeout(r, 1800));
      activo = false;
      const texto = zona.querySelector(".cifra-heroe .cifra-valor .sr-only")?.textContent ?? null;
      return { muestras, texto };
    });
    const conRodillos = medicion.muestras.filter((m) => m.posiciones.length);
    const finales = conRodillos.at(-1)?.posiciones ?? [];
    const indice = finales.indexOf(Math.max(...finales));
    const serie = conRodillos.map((m) => ({ at: m.at, p: m.posiciones[indice], crudo: m.crudos[indice] }));
    const objetivo = finales[indice];
    // Fin = primer cuadro en el dígito exacto (3 decimales): la curva de salida
    // queda a <0,01 de cifra antes de terminar, así que no vale como fin.
    const arranque = serie[0];
    const crudoFinal = serie.at(-1)?.crudo;
    const llegada = serie.find((x) => x.p === objetivo && x.crudo === crudoFinal);
    const intermedias = new Set(serie.filter((x) => x.p > 0.01 && Math.abs(x.p - objetivo) >= 0.01).map((x) => x.p)).size;
    Object.assign(r, {
      antesDeEntrarEnVista: antes,
      textoAccesible: medicion.texto,
      digitosFinales: finales,
      rodilloMedido: indice,
      posicionInicial: serie[0]?.p,
      posicionesIntermediasDistintas: intermedias,
      // Los rodillos se montan ya animando: la primera muestra llega un cuadro tarde.
      duracionSubidaMs: arranque && llegada ? Math.round(llegada.at - arranque.at) : null,
      serie: serie.map((x) => ({ ms: Math.round(x.at - serie[0].at), p: x.p })),
    });
    expect(antes.every((c) => c.visible === "false" && c.rodillos === 0), "Fuera de vista: cifra fija, sin animar").toBe(true);
    expect(conRodillos.length, "Al entrar en vista monta los rodillos").toBeGreaterThan(0);
    expect(objetivo, "Hay un dígito distinto de cero que debe subir").toBeGreaterThan(0);
    expect(serie[0].p, "Arranca desde 0 (≤1 cuadro de avance)").toBeLessThanOrEqual(objetivo * 0.15);
    expect(intermedias, "Sube cuadro a cuadro").toBeGreaterThanOrEqual(5);
    expect(r.duracionSubidaMs as number, "Sube en 640–900 ms").toBeGreaterThanOrEqual(600);
    expect(r.duracionSubidaMs as number, "Sube en 640–900 ms").toBeLessThanOrEqual(950);
    // Los rodillos terminan en los dígitos del texto accesible.
    expect(finales.map((d) => String(Math.round(d))).join("")).toBe((medicion.texto ?? "").replace(/\D/g, ""));
  } finally {
    r.consola = s.consola;
    guardar(`cifras-${ancho}.json`, r);
    await cerrar(s, `cifras-${ancho}.webm`);
  }
  expect(s.consola, "Consola sin errores ni avisos").toEqual([]);
});

// 5 ─────────────────────────────────────────────────────────────────────────
test("5 Carrusel del héroe: arrastre con inercia y cambio de tinte", async ({
  browser,
}, testInfo) => {
  const ancho = anchoDe(testInfo);
  const s = await abrir(browser, testInfo);
  const { page } = s;
  const r: Record<string, unknown> = { ancho };
  try {
    const ensayo = await prepararEstado(s);
    await page.goto("/");
    await listoInicio(page, ensayo);
    const escena = page.locator("main .inicio-escena");
    const siguiente = page.getByRole("button", { name: "Video siguiente", exact: true });
    // Los tintes reales extraídos son grises muy próximos (ver informe); se usa
    // el par con más distancia: pieza 3 (L 45 %) → pieza 4 (L 53 %).
    const tintesPiezas = ensayo.terminados.map((v) => v.medios.tinte);
    r.tintesPorPieza = tintesPiezas;
    await siguiente.click();
    await siguiente.click();
    await expect(page.locator("main .inicio-hero")).toContainText(ensayo.terminados[2].title);
    const colorA = await colorComputado(page, ensayo.terminados[2].medios.tinte);
    const colorB = await colorComputado(page, ensayo.terminados[3].medios.tinte);
    await expect
      .poll(() => escena.evaluate((e) => getComputedStyle(e).getPropertyValue("--tinte-halo").trim()))
      .toBe(colorA);
    await page.waitForTimeout(300);
    await escena.evaluate((e) => {
      const v = window as Window & {
        tintes?: { at: number; v: string }[];
        transicionTinte?: { propiedad: string; duracion: number; curva: string }[];
      };
      v.tintes = [];
      v.transicionTinte = [];
      let activo = true;
      const vistas = new WeakSet<Animation>();
      const cuadro = () => {
        if (!activo) return;
        v.tintes!.push({ at: performance.now(), v: getComputedStyle(e).getPropertyValue("--tinte-halo").trim() });
        for (const a of e.getAnimations()) {
          if (vistas.has(a) || !(a instanceof CSSTransition)) continue;
          vistas.add(a);
          const efecto = a.effect as KeyframeEffect;
          v.transicionTinte!.push({
            propiedad: a.transitionProperty,
            duracion: Number(efecto.getComputedTiming().duration),
            curva: String(efecto.getTiming().easing),
          });
        }
        requestAnimationFrame(cuadro);
      };
      requestAnimationFrame(cuadro);
      setTimeout(() => {
        activo = false;
      }, 2500);
    });
    await siguiente.click();
    await expect(page.locator("main .inicio-hero")).toContainText(ensayo.terminados[3].title);
    await page.waitForTimeout(1500);
    const { tintes, transicionTinte } = await page.evaluate(() => {
      const v = window as Window & {
        tintes?: { at: number; v: string }[];
        transicionTinte?: { propiedad: string; duracion: number; curva: string }[];
      };
      return { tintes: v.tintes ?? [], transicionTinte: v.transicionTinte ?? [] };
    });
    const cambio = tintes.findIndex((x) => x.v !== colorA);
    const llegada = tintes.findIndex((x, i) => i >= cambio && x.v === colorB);
    Object.assign(r, {
      tinteA: { pieza: 3, declarado: ensayo.terminados[2].medios.tinte, computado: colorA },
      tinteB: { pieza: 4, declarado: ensayo.terminados[3].medios.tinte, computado: colorB },
      transicionCss: transicionTinte,
      tintesIntermediosDistintos: new Set(tintes.slice(cambio, llegada).map((x) => x.v)).size,
      // Con 20 pasos de gris, el último paso visible llega antes del fin real.
      duracionHastaUltimoCambioMs:
        cambio > 0 && llegada > cambio ? Math.round(tintes[llegada].at - tintes[cambio - 1].at) : null,
    });
    const tinteCss = transicionTinte.find((t) => t.propiedad === "--tinte-halo");
    expect(cambio, "El halo cambia de tinte").toBeGreaterThan(0);
    expect(llegada, "El halo llega al tinte de la nueva pieza").toBeGreaterThan(cambio);
    expect(tinteCss, "Transición CSS de --tinte-halo en curso").toBeDefined();
    expect(tinteCss!.duracion, "Transición de tinte 640 ms").toBe(640);
    expect(r.tintesIntermediosDistintos as number, "El tinte interpola, no salta").toBeGreaterThanOrEqual(5);

    // Arrastre con inercia.
    const ventana = page.locator("main .inicio-carrusel-ventana");
    await ventana.scrollIntoViewIfNeeded();
    const caja = (await ventana.boundingBox())!;
    const limite = await page.locator("main .inicio-carrusel-pista").evaluate((p) => p.scrollWidth - p.parentElement!.clientWidth);
    const seleccionAntes = await page.locator('main .inicio-selector[aria-pressed="true"]').textContent();
    const cdp = s.movil ? await s.context.newCDPSession(page) : null;
    await page.evaluate(() => {
      const v = window as Window & { soltado?: number };
      v.soltado = undefined;
      window.addEventListener("pointerup", () => (v.soltado = performance.now()), { capture: true, once: true });
    });
    await iniciarMuestra(page, "main .inicio-carrusel-pista");
    const puntos = await puntosArrastre(page, caja);
    r.sentidoArrastre = puntos.sentido;
    const metodo = await arrastrar(page, cdp, puntos.desde, puntos.hasta);
    await page.waitForTimeout(1500);
    const muestra = await detenerMuestra(page);
    const soltado = await page.evaluate(() => (window as Window & { soltado?: number }).soltado ?? null);
    const xs = muestra.pista;
    const tras = soltado === null ? [] : xs.filter((p) => p.at > soltado);
    const cambiosTras = tras.filter((p, i) => i > 0 && Math.abs(p.x - tras[i - 1].x) > 0.5).length;
    const seleccionDespues = await page.locator('main .inicio-selector[aria-pressed="true"]').textContent();
    Object.assign(r, {
      metodoArrastre: metodo,
      limitePx: limite,
      xInicial: xs[0]?.x,
      xAlSoltar: tras[0]?.x,
      xFinal: xs.at(-1)?.x,
      cuadrosQueSiguenMoviendoTrasSoltar: cambiosTras,
      seleccionIntacta: seleccionAntes === seleccionDespues,
    });
    expect(limite, "Hay recorrido para arrastrar").toBeGreaterThan(0);
    expect(soltado, "Se soltó el puntero").not.toBeNull();
    expect(Math.abs((xs.at(-1)?.x ?? 0) - (xs[0]?.x ?? 0)), "La pista se desplaza").toBeGreaterThan(40);
    expect(cambiosTras, "Inercia tras soltar").toBeGreaterThanOrEqual(3);
    // Con inercia puede rebasar el borde (elástico 0,08) y volver: se espera reposo.
    const pista = page.locator("main .inicio-carrusel-pista");
    const xReposo = () => pista.evaluate((p) => new DOMMatrixReadOnly(getComputedStyle(p).transform).m41);
    await expect.poll(async () => { const a = await xReposo(); await page.waitForTimeout(200); return Math.abs((await xReposo()) - a); }, { timeout: 6000 }).toBeLessThan(0.1);
    const xFinalReposo = await xReposo();
    r.xEnReposo = xFinalReposo;
    expect(xFinalReposo, "Reposa dentro del recorrido").toBeGreaterThanOrEqual(-limite - 0.5);
    expect(xFinalReposo, "Reposa dentro del recorrido").toBeLessThanOrEqual(0.5);
    expect(seleccionDespues, "Arrastrar no elige pieza").toBe(seleccionAntes);
  } finally {
    r.consola = s.consola;
    guardar(`carrusel-${ancho}.json`, r);
    await cerrar(s, `carrusel-tinte-${ancho}.webm`);
  }
  expect(s.consola, "Consola sin errores ni avisos").toEqual([]);
});

// 6 ─────────────────────────────────────────────────────────────────────────
test("6 Cooper: abrir, cerrar y contexto de la pantalla", async ({ browser }, testInfo) => {
  const ancho = anchoDe(testInfo);
  const s = await abrir(browser, testInfo);
  const { page, context } = s;
  const r: Record<string, unknown> = { ancho };
  try {
    const estado: Estado = await (await context.request.get("/api/estado")).json();
    const video = estado.videos.find((v) => v.ownerId === estado.user.id && v.stage === 3)!;
    expect(video).toBeDefined();
    let marcas = (await (await context.request.get("/api/marcas")).json()) as { marcas: { id: string; nombre: string }[] };
    if (!marcas.marcas.length) {
      const creada = await context.request.post("/api/marcas/iglesia", { data: {} });
      expect(creada.ok(), await creada.text()).toBe(true);
      marcas = await (await context.request.get("/api/marcas")).json();
    }
    const marca = marcas.marcas[0];
    const panel = page.getByRole("dialog", { name: "Cooper, tu compañero", exact: true });
    const leerPanel = async () => ({
      contexto: (await panel.locator(".cooper-panel-heading small").textContent())?.trim(),
      chips: (await panel.locator('[aria-label="Sugerencias para esta pantalla"] button').allTextContents()).map((t) => t.trim()),
    });
    const casos: Record<string, unknown>[] = [];

    // Video abierto.
    await page.goto(`/videos/${video.id}`);
    await page.locator("main").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const mainAntes = (await page.locator("main").boundingBox())!;
    await observarProyeccionCooper(page);
    await abrirCooper(page);
    const proyeccion = await terminarProyeccionCooper(page);
    const cajaPanel = (await panel.boundingBox())!;
    const mainDespues = (await page.locator("main").boundingBox())!;
    const enVideo = await leerPanel();
    casos.push({ pantalla: "video", esperado: video.title, ...enVideo });
    expect(enVideo.contexto).toBe(video.title);
    expect(enVideo.chips).toEqual(["¿En qué etapa está este video?", "¿Qué falta por revisar?", "Quiero corregir este video"]);
    r.proyeccionOrbePanel = proyeccion;
    expect(proyeccion?.inicio, "El orbe se proyecta en el panel (layoutId)").not.toBeNull();
    r.panel = { x: cajaPanel.x, y: cajaPanel.y, ancho: cajaPanel.width, alto: cajaPanel.height };
    r.main = { antes: mainAntes, despues: mainDespues };
    if (!s.movil) {
      expect(cajaPanel.width, "Hoja derecha de 420 px").toBeCloseTo(420, 0);
      expect(mainDespues.x + mainDespues.width, "No tapa: el contenido acaba antes de la hoja").toBeLessThanOrEqual(cajaPanel.x + 0.5);
      expect(mainDespues.width, "El contenido se reajusta").toBeLessThan(mainAntes.width);
    } else {
      const alto = page.viewportSize()!.height;
      expect(cajaPanel.height, "Hoja inferior al 62 %").toBeCloseTo(alto * 0.62, 0);
      expect(cajaPanel.y + cajaPanel.height).toBeCloseTo(alto, 0);
      expect(cajaPanel.width).toBeCloseTo(ancho, 0);
      const asa = page.locator(".cooper-drag");
      const a = (await asa.boundingBox())!;
      const centro = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
      await page.mouse.move(centro.x, centro.y);
      await page.mouse.down();
      await page.mouse.move(centro.x, centro.y - 120, { steps: 8 });
      await page.mouse.up();
      await expect(panel).toHaveClass(/is-full/);
      await page.waitForTimeout(700);
      const completa = (await panel.boundingBox())!;
      r.hojaCompleta = completa;
      const a2 = (await asa.boundingBox())!;
      await page.mouse.move(a2.x + a2.width / 2, a2.y + a2.height / 2);
      await page.mouse.down();
      await page.mouse.move(a2.x + a2.width / 2, a2.y + a2.height / 2 + 120, { steps: 8 });
      await page.mouse.up();
      await expect(panel).not.toHaveClass(/is-full/);
      await page.waitForTimeout(700);
      const a3 = (await asa.boundingBox())!;
      await page.mouse.move(a3.x + a3.width / 2, a3.y + a3.height / 2);
      await page.mouse.down();
      await page.mouse.move(a3.x + a3.width / 2, a3.y + a3.height / 2 + 120, { steps: 8 });
      await page.mouse.up();
      await expect(panel, "Arrastrar hacia abajo cierra la hoja").toBeHidden();
      r.cerrarArrastrando = true;
      await abrirCooper(page);
    }
    await page.waitForTimeout(400);
    await cerrarCooper(page);
    await expect(page.getByRole("button", { name: "Abrir Cooper", exact: true })).toBeVisible();

    // Marca abierta.
    await page.goto(`/marcas?marca=${encodeURIComponent(marca.id)}`);
    await page.locator("main").waitFor();
    await abrirCooper(page);
    await page.waitForTimeout(400);
    const enMarca = await leerPanel();
    casos.push({ pantalla: "marca", esperado: marca.nombre, ...enMarca });
    expect(enMarca.contexto).toBe(marca.nombre);
    expect(enMarca.chips).toEqual(["¿Qué sigue para esta marca?", "Quiero preparar una publicación", "Revisar el calendario de mi marca"]);
    await cerrarCooper(page);

    // Inicio.
    await page.goto("/");
    await page.locator("main").waitFor();
    await abrirCooper(page);
    await page.waitForTimeout(400);
    const enInicio = await leerPanel();
    casos.push({ pantalla: "inicio", esperado: "Hoy en el estudio", ...enInicio });
    expect(enInicio.contexto).toBe("Hoy en el estudio");
    expect(enInicio.chips.length).toBeGreaterThanOrEqual(2);
    expect(enInicio.chips.length).toBeLessThanOrEqual(3);
    await cerrarCooper(page);
    r.contextos = casos;
  } finally {
    r.consola = s.consola;
    guardar(`cooper-${ancho}.json`, r);
    await cerrar(s, `cooper-${ancho}.webm`);
  }
  expect(s.consola, "Consola sin errores ni avisos").toEqual([]);
});

// 7 ─────────────────────────────────────────────────────────────────────────
test("7 Barra inferior móvil: 5 pestañas, indicador animado y «Más»", async ({
  browser,
}, testInfo) => {
  const ancho = anchoDe(testInfo);
  const s = await abrir(browser, testInfo);
  const { page } = s;
  const r: Record<string, unknown> = { ancho };
  try {
    await page.goto("/");
    await page.locator("main").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const barra = page.getByRole("navigation", { name: "Principal móvil", exact: true });
    await expect(barra).toBeVisible();
    await expect(barra.getByRole("link")).toHaveText(["Inicio", "Fábrica", "Publicados", "Aprendizaje", "Marcas"]);
    const cajas = await barra.getByRole("link").evaluateAll((ls) =>
      ls.map((l) => {
        const c = l.getBoundingClientRect();
        return { texto: l.textContent, x: c.x, ancho: c.width, alto: c.height, actual: l.getAttribute("aria-current") };
      }),
    );
    r.pestanas = cajas;
    for (const c of cajas) {
      expect(c.ancho, c.texto ?? "").toBeGreaterThanOrEqual(48);
      expect(c.alto, c.texto ?? "").toBeGreaterThanOrEqual(48);
    }
    expect(cajas[0].actual).toBe("page");
    await page.evaluate(() => {
      const v = window as Window & { indicador?: { at: number; x: number | null }[] };
      v.indicador = [];
      let activo = true;
      const cuadro = () => {
        if (!activo) return;
        const i = document.querySelector<HTMLElement>(".mobile-dock .nav-indicator");
        v.indicador!.push({
          at: performance.now(),
          x: i ? i.getBoundingClientRect().x : null,
          transform: i?.style.transform ?? null,
          enlace: i?.closest("a")?.textContent ?? null,
          vt: document.getAnimations().some((a) => (a.effect as KeyframeEffect | null)?.pseudoElement),
        } as { at: number; x: number | null });
        requestAnimationFrame(cuadro);
      };
      requestAnimationFrame(cuadro);
      setTimeout(() => {
        activo = false;
      }, 3000);
    });
    await barra.getByRole("link", { name: "Fábrica", exact: true }).click();
    await expect(page).toHaveURL(/\/videos$/);
    await expect(barra.getByRole("link", { name: "Fábrica", exact: true })).toHaveAttribute("aria-current", "page");
    await page.waitForTimeout(1500);
    const serie = await page.evaluate(() => (window as Window & { indicador?: { at: number; x: number | null }[] }).indicador ?? []);
    const indicadorInicio = await page.locator(".mobile-dock .nav-indicator").evaluate((e) => e.getBoundingClientRect().x);
    const origen = serie.find((p) => p.x !== null)?.x ?? null;
    const destino = indicadorInicio;
    const entre = serie.filter(
      (p) => p.x !== null && origen !== null && p.x > Math.min(origen, destino) + 1 && p.x < Math.max(origen, destino) - 1,
    );
    Object.assign(r, {
      indicadorOrigenX: origen,
      indicadorDestinoX: destino,
      cuadrosIntermedios: entre.length,
      duracionIndicadorMs: entre.length ? Math.round(entre.at(-1)!.at - entre[0].at) : null,
      serieIndicador: serie.map((p) => ({ ...p, at: Math.round(p.at - serie[0].at) })),
    });
    expect(origen).not.toBeNull();
    expect(Math.abs(destino - cajas[1].x), "Termina bajo Fábrica").toBeLessThan(cajas[1].ancho);
    expect.soft(entre.length, "El indicador se desliza (layout animation)").toBeGreaterThanOrEqual(3);

    // «Más» abre una hoja inferior.
    const hoja = await abrirMasDestinos(page);
    await page.waitForTimeout(400);
    const cajaHoja = (await hoja.boundingBox())!;
    const alto = page.viewportSize()!.height;
    const masEnBarra = await barra.getByRole("button", { name: "Más destinos" }).count();
    Object.assign(r, {
      hojaMas: cajaHoja,
      destinosEnHoja: (await hoja.getByRole("link").allTextContents()).map((t) => t.trim()),
      botonMasEnLaBarraInferior: masEnBarra > 0,
      botonMasEn: masEnBarra > 0 ? "barra inferior" : "cabecera (.topbar-mas)",
    });
    expect(cajaHoja.y + cajaHoja.height, "Hoja anclada abajo").toBeGreaterThan(alto - 48);
    await hoja.getByRole("button", { name: "Cerrar navegación", exact: true }).click();
    await expect(hoja).toBeHidden();
  } finally {
    r.consola = s.consola;
    guardar(`barra-movil-${ancho}.json`, r);
    await cerrar(s, `barra-movil-${ancho}.webm`);
  }
  expect(s.consola, "Consola sin errores ni avisos").toEqual([]);
});

// 8 ─────────────────────────────────────────────────────────────────────────
test("8 prefers-reduced-motion: sin desplazamientos ni autoplay, fundidos ≤120 ms, todo funcional", async ({
  browser,
}, testInfo) => {
  const ancho = anchoDe(testInfo);
  const s = await abrir(browser, testInfo, { reducido: true });
  const { page } = s;
  const r: Record<string, unknown> = { ancho };
  try {
    const ensayo = await prepararEstado(s);
    // Registra toda animación WAAPI/CSS que llegue a existir en la visita.
    await page.addInitScript(() => {
      const v = window as Window & { animacionesVistas?: unknown[] };
      v.animacionesVistas = [];
      const vistas = new WeakSet<Animation>();
      const ignorar = new Set(["offset", "computedOffset", "easing", "composite"]);
      const cuadro = () => {
        (v as Window & { cuadrosVistos?: number }).cuadrosVistos =
          ((v as Window & { cuadrosVistos?: number }).cuadrosVistos ?? 0) + 1;
        for (const a of document.getAnimations()) {
          if (vistas.has(a)) continue;
          vistas.add(a);
          const e = a.effect as KeyframeEffect | null;
          const marcos = e?.getKeyframes() ?? [];
          const props = [...new Set(marcos.flatMap((m) => Object.keys(m).filter((k) => !ignorar.has(k))))];
          const cambia = props.filter((p) => new Set(marcos.map((m) => String((m as Record<string, unknown>)[p] ?? ""))).size > 1);
          const t = e?.target as Element | null;
          v.animacionesVistas!.push({
            tipo: a.constructor.name,
            nombre: (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? null,
            objetivo: t ? `${t.tagName.toLowerCase()}.${[...t.classList].join(".")}` : null,
            pseudo: e?.pseudoElement ?? null,
            duracion: e ? Number(e.getComputedTiming().duration) : null,
            cambia,
            marcos: cambia.includes("transform") || cambia.includes("translate") ? marcos.map((m) => (m as Record<string, unknown>).transform ?? (m as Record<string, unknown>).translate) : undefined,
          });
        }
        requestAnimationFrame(cuadro);
      };
      requestAnimationFrame(cuadro);
    });
    await page.goto("/");
    await listoInicio(page, ensayo);
    await instalarObservadorTransiciones(page);
    const funcional: Record<string, boolean> = {};
    // Entradas: sin animación.
    funcional.entradasSinAnimacion = await page.locator(".entrada-estudio").evaluateAll((es) =>
      es.every((e) => getComputedStyle(e).animationName === "none"),
    );
    // Sin autoplay: hover (1440) o en vista (390).
    const medio = page.locator("main .inicio-hero .medio").first();
    if (!s.movil) await medio.hover();
    await page.waitForTimeout(900);
    const sinAutoplay = await medio.evaluate((m) => {
      const v = m.querySelector("video") as HTMLVideoElement | null;
      return {
        dataPreview: (m as HTMLElement).dataset.preview,
        quieto: (m as HTMLElement).dataset.quieto,
        pausado: v ? v.paused : null,
        tiempo: v ? v.currentTime : null,
        visible: v ? getComputedStyle(v).display : null,
      };
    });
    r.sinAutoplay = sinAutoplay;
    funcional.sinAutoplay = sinAutoplay.dataPreview === "off" && sinAutoplay.quieto === "true" && (sinAutoplay.pausado ?? true) && (sinAutoplay.tiempo ?? 0) === 0;
    // Carrusel: flechas y arrastre siguen funcionando, sin interpolar tinte.
    const escena = page.locator("main .inicio-escena");
    const colorB = await colorComputado(page, ensayo.terminados[1].medios.tinte);
    await page.getByRole("button", { name: "Video siguiente", exact: true }).click();
    await expect(page.locator("main .inicio-hero")).toContainText(ensayo.terminados[1].title);
    funcional.tinteSinInterpolar = (await escena.evaluate((e) => getComputedStyle(e).getPropertyValue("--tinte-halo").trim())) === colorB;
    const ventana = page.locator("main .inicio-carrusel-ventana");
    await ventana.scrollIntoViewIfNeeded();
    const caja = (await ventana.boundingBox())!;
    const pista = page.locator("main .inicio-carrusel-pista");
    const xAntes = await pista.evaluate((p) => new DOMMatrixReadOnly(getComputedStyle(p).transform).m41);
    const cdp = s.movil ? await s.context.newCDPSession(page) : null;
    const puntos = await puntosArrastre(page, caja);
    await arrastrar(page, cdp, puntos.desde, puntos.hasta);
    const xSoltar = await pista.evaluate((p) => new DOMMatrixReadOnly(getComputedStyle(p).transform).m41);
    await page.waitForTimeout(500);
    const xFinal = await pista.evaluate((p) => new DOMMatrixReadOnly(getComputedStyle(p).transform).m41);
    r.arrastreReducido = { xAntes, xSoltar, xFinal };
    funcional.arrastreFunciona = Math.abs(xFinal - xAntes) > 40;
    funcional.sinInercia = Math.abs(xFinal - xSoltar) < 1;
    // Cifras: valor final directo, sin rodillos.
    await page.locator("main .inicio-metricas").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    funcional.cifrasDirectas = await page.locator("main .inicio-metricas .cifra").evaluateAll((cs) =>
      cs.every((c) => c.querySelectorAll(".number-reel").length === 0 && /\d|—/.test(c.querySelector(".cifra-valor")?.textContent ?? "")),
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    // Cooper abre y cierra.
    await abrirCooper(page);
    await page.waitForTimeout(300);
    await cerrarCooper(page);
    funcional.cooper = true;
    // «Más» abre la hoja.
    const hoja = await abrirMasDestinos(page);
    await hoja.getByRole("button", { name: "Cerrar navegación", exact: true }).click();
    await expect(hoja).toBeHidden();
    funcional.mas = true;
    // Ruta: navega sin View Transition y sin coreografía.
    await enlaceNav(page, s, "/videos").click();
    await expect(page).toHaveURL(/\/videos$/);
    await page.waitForTimeout(500);
    const { llamadas } = await leerTransiciones(page);
    funcional.rutaSinTransicion = llamadas === 0;
    funcional.rutaSinCoreografia = await page.locator(".route-choreography").evaluate((e) => getComputedStyle(e).animationName === "none");
    // Detalle de video desde el héroe.
    await enlaceNav(page, s, "/").click();
    await expect(page).toHaveURL(new RegExp(`${demoURL.replaceAll(".", "\\.")}/$`));
    await expect(page.locator("main .inicio-hero")).toContainText(ensayo.terminados[0].title);
    await page.locator("main .inicio-hero-enlace").click();
    await expect(page).toHaveURL(new RegExp(`/videos/${ensayo.fuente.id}$`));
    await expect(page.locator("main .real-player").first()).toBeVisible();
    funcional.detalle = true;
    await page.waitForTimeout(400);
    const animaciones = (await page.evaluate(() => (window as Window & { animacionesVistas?: unknown[] }).animacionesVistas ?? [])) as {
      tipo: string;
      nombre: string | null;
      objetivo: string | null;
      duracion: number | null;
      cambia: string[];
      marcos?: unknown[];
    }[];
    const desplazan = animaciones.filter(
      (a) => (a.duracion ?? 0) > 0 && a.cambia.some((p) => ["transform", "translate", "top", "left", "right", "bottom"].includes(p)),
    );
    const fundidosLargos = animaciones.filter((a) => a.cambia.includes("opacity") && (a.duracion ?? 0) > 120);
    const largas = animaciones.filter((a) => (a.duracion ?? 0) > 120);
    // Control del propio registro: prueba que muestreó cuadros de verdad.
    const cuadrosVistos = await page.evaluate(() => (window as Window & { cuadrosVistos?: number }).cuadrosVistos ?? 0);
    Object.assign(r, { funcional, cuadrosRegistrados: cuadrosVistos, animaciones, desplazan, fundidosLargos, animacionesMayores120ms: largas });
    expect(cuadrosVistos, "El registro de animaciones estuvo activo").toBeGreaterThan(30);
    expect(funcional, "Todo funcional con movimiento reducido").toEqual(
      Object.fromEntries(Object.keys(funcional).map((k) => [k, true])),
    );
    expect(desplazan, "Sin desplazamientos animados").toEqual([]);
    expect(fundidosLargos, "Fundidos ≤120 ms").toEqual([]);
  } finally {
    r.consola = s.consola;
    guardar(`reducido-${ancho}.json`, r);
    await cerrar(s, `reducido-${ancho}.webm`);
  }
  expect(s.consola, "Consola sin errores ni avisos").toEqual([]);
});

// 9 ─────────────────────────────────────────────────────────────────────────
test("9 Fotogramas: transición, carrusel y apertura de Cooper (390 con CPU 4×)", async ({
  browser,
}, testInfo) => {
  const ancho = anchoDe(testInfo);
  // Sin video: la grabación resta fotogramas.
  const s = await abrir(browser, testInfo, { grabar: false });
  const { page, context } = s;
  const r: Record<string, unknown> = { ancho };
  const cpu = ancho < 768 ? 4 : 1;
  const trazaRuta = resolve(salida, `traza-${ancho}.json`);
  let cdp: CDPSession | null = null;
  let trazando = false;
  try {
    const navegador = await browser.newBrowserCDPSession();
    const info = await navegador.send("SystemInfo.getInfo");
    await navegador.detach();
    r.renderizador = {
      gl: info.gpu.auxAttributes?.glRenderer,
      proveedor: info.gpu.auxAttributes?.glVendor,
      composicionGpu: info.gpu.featureStatus?.gpu_compositing,
      navegador: browser.version(),
      argumentos: testInfo.project.use.launchOptions?.args,
    };
    const ensayo = await prepararEstado(s);
    await page.goto("/");
    await listoInicio(page, ensayo);
    await page.waitForTimeout(800);
    cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    await cdp.send("Tracing.start", {
      categories:
        "devtools.timeline,loading,blink.user_timing,disabled-by-default-devtools.timeline.frame,cc,viz,gpu",
      transferMode: "ReturnAsStream",
    });
    trazando = true;
    const fases: Record<string, unknown>[] = [];

    // Carrusel: del primer contacto al último cuadro con movimiento.
    const ventana = page.locator("main .inicio-carrusel-ventana");
    await ventana.scrollIntoViewIfNeeded();
    const caja = (await ventana.boundingBox())!;
    await page.evaluate(() => {
      const v = window as Window & { contacto?: number };
      v.contacto = undefined;
      window.addEventListener("pointerdown", () => (v.contacto = performance.now()), { capture: true, once: true });
    });
    await iniciarMuestra(page, "main .inicio-carrusel-pista");
    const puntos = await puntosArrastre(page, caja);
    await arrastrar(page, s.movil ? cdp : null, puntos.desde, puntos.hasta);
    await page.waitForTimeout(1500);
    const mCarrusel = await detenerMuestra(page);
    const contacto = await page.evaluate(() => (window as Window & { contacto?: number }).contacto ?? null);
    const pistaMov = mCarrusel.pista.filter((p, i) => i > 0 && Math.abs(p.x - mCarrusel.pista[i - 1].x) > 0.1);
    const finCarrusel = pistaMov.at(-1)?.at ?? mCarrusel.cuadros.at(-1)!.at;
    fases.push({ fase: "carrusel", ...cifras(mCarrusel, contacto ?? mCarrusel.inicio, finCarrusel) });

    // Apertura de Cooper: montaje con data-projecting → fin del fundido.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await observarProyeccionCooper(page);
    await iniciarMuestra(page);
    await page.getByRole("button", { name: "Abrir Cooper", exact: true }).click();
    const proy = await terminarProyeccionCooper(page);
    const mCooper = await detenerMuestra(page);
    fases.push({
      fase: "cooper-abrir",
      latenciaClicAProyeccionMs: proy?.clic && proy?.inicio ? Math.round(proy.inicio - proy.clic) : null,
      ...cifras(mCooper, proy!.inicio!, proy!.finFundido!),
    });
    await cerrarCooper(page);
    await page.waitForTimeout(600);

    // Transición de ruta con elemento compartido: ready → finished.
    await instalarObservadorTransiciones(page);
    await iniciarMuestra(page);
    await page.locator("main .inicio-hero-enlace").click();
    await expect(page).toHaveURL(new RegExp(`/videos/${ensayo.fuente.id}$`));
    await terminarTransicion(page);
    const mRuta = await detenerMuestra(page);
    const { observaciones } = await leerTransiciones(page);
    const o = observaciones[0];
    fases.push({
      fase: "transicion",
      latenciaHastaAnimarMs: o?.listo ? Math.round(o.listo - o.inicio) : null,
      ...cifras(mRuta, o.listo!, o.fin!),
    });

    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const terminado = new Promise<string>((resolver, rechazar) => {
      cdp!.once("Tracing.tracingComplete", ({ stream }) => (stream ? resolver(stream) : rechazar(new Error("Sin traza"))));
    });
    await cdp.send("Tracing.end");
    trazando = false;
    const flujo = await terminado;
    writeFileSync(trazaRuta, "");
    for (;;) {
      const trozo = await cdp.send("IO.read", { handle: flujo });
      appendFileSync(trazaRuta, trozo.base64Encoded ? Buffer.from(trozo.data, "base64") : trozo.data);
      if (trozo.eof) break;
    }
    await cdp.send("IO.close", { handle: flujo });
    Object.assign(r, {
      cpu: `${cpu}×`,
      metodo: "requestAnimationFrame en la página + traza CDP guardada; sin grabación de video",
      umbrales: { fpsMedio: ">= 57", p95Ms: "<= 25", cuadrosMayores50ms: 0, cls: 0 },
      fases,
      traza: `traza-${ancho}.json`,
    });
    for (const f of fases as { fase: string; fpsMedio: number; p95Ms: number; cuadrosMayores50ms: number; cls: number; cuadros: number }[]) {
      expect.soft(f.cuadros, `${f.fase}: cuadros medidos`).toBeGreaterThan(5);
      expect.soft(f.fpsMedio, `${f.fase}: fps medio`).toBeGreaterThanOrEqual(57);
      expect.soft(f.p95Ms, `${f.fase}: p95 de cuadro`).toBeLessThanOrEqual(25);
      expect.soft(f.cuadrosMayores50ms, `${f.fase}: cuadros >50 ms`).toBe(0);
      expect.soft(f.cls, `${f.fase}: CLS`).toBe(0);
    }
  } finally {
    if (cdp && trazando) await cdp.send("Tracing.end").catch(() => {});
    r.consola = s.consola;
    guardar(`fps-${ancho}.json`, r);
    await cerrar(s);
  }
  expect(s.consola, "Consola sin errores ni avisos").toEqual([]);
});
