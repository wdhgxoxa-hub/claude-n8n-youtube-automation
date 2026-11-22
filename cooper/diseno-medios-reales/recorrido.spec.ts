import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { Estado } from "../src/servicios/datos";
import type { Resultados } from "../src/contratos/resultados";
import type { VideoMedios } from "../src/contratos/video-medios";

const salida = resolve("../evidencias-diseno");
const rutaPoster = resolve(salida, "b2-real-poster.webp");
const rutaPreview = resolve(salida, "b2-real-preview.mp4");
let poster: Buffer;
let preview: Buffer;
let archivos: Record<string, unknown>;

test.beforeAll(() => {
  // Los archivos tienen que existir: no se descargan, sustituyen ni omiten.
  poster = readFileSync(rutaPoster);
  preview = readFileSync(rutaPreview);
  expect(poster.byteLength).toBe(36778);
  expect(preview.byteLength).toBe(336834);
  const inspeccionar = (ruta: string) =>
    JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "stream=codec_type,width,height:format=duration",
          "-of",
          "json",
          ruta,
        ],
        { encoding: "utf8" },
      ),
    );
  const imagen = inspeccionar(rutaPoster);
  const clip = inspeccionar(rutaPreview);
  expect(imagen.streams[0]).toMatchObject({ width: 900, height: 1600 });
  expect(
    clip.streams.filter(
      (s: { codec_type: string }) => s.codec_type === "audio",
    ),
  ).toHaveLength(0);
  expect(clip.streams[0]).toMatchObject({ width: 360, height: 640 });
  expect(Number(clip.format.duration)).toBe(5);
  const hash = (data: Buffer) =>
    createHash("sha256").update(data).digest("hex");
  archivos = {
    poster: {
      archivo: "b2-real-poster.webp",
      bytes: poster.byteLength,
      sha256: hash(poster),
      ancho: 900,
      alto: 1600,
    },
    preview: {
      archivo: "b2-real-preview.mp4",
      bytes: preview.byteLength,
      sha256: hash(preview),
      ancho: 360,
      alto: 640,
      segundos: 5,
      audio: false,
    },
    original: { ancho: 1080, alto: 1920, disponibleEnEnsayo: false },
    datosInterfaz:
      "Fixture local autenticado; las imágenes y el extracto son derivados del render existente. No acredita publicación real ni reproducción del MP4 original completo.",
  };
  mkdirSync(salida, { recursive: true });
});

async function navegar(page: Page, ruta: string) {
  const enlace = page.locator(`.sidebar nav a[href="${ruta}"]`).first();
  if (!(await enlace.isVisible()))
    await page
      .getByRole("button", { name: "Abrir navegación", exact: true })
      .click();
  await enlace.click();
  await expect(page).toHaveURL(new RegExp(`${ruta === "/" ? "/" : ruta}$`));
}

test("render existente en lista, detalle, Publicados y fábrica", async ({
  page,
  context,
}, testInfo) => {
  const ancho = testInfo.project.use.viewport!.width;
  const errores: string[] = [];
  const externos: string[] = [];
  const peticiones = new Map<string, number>();
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) errores.push(m.text());
  });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost")
      return route.continue();
    externos.push(url.origin);
    return route.abort("blockedbyclient");
  });
  expect(
    (
      await page.request.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
        {
          data: {
            email: "admin@example.test",
            secret: process.env.COOPER_E2E_SECRET,
            montaje: "crear",
          },
        },
      )
    ).ok(),
  ).toBe(true);
  const estado: Estado = await (await page.request.get("/api/estado")).json();
  const original = estado.videos.find((v) => v.id.startsWith("montaje-e2e-"))!;
  expect(original).toBeDefined();
  const urlAsset = (id: string, tipo: "poster" | "preview") =>
    `/__ensayo-medios-reales/${tipo}${tipo === "poster" ? ".webp" : ".mp4"}?video=${encodeURIComponent(id)}`;
  const medio = (id: string): VideoMedios => ({
    version: 1,
    videoId: id,
    estado: "listo",
    poster: {
      url: urlAsset(id, "poster"),
      origen: "render",
      ancho: 900,
      alto: 1600,
    },
    preview: {
      url: urlAsset(id, "preview"),
      mime: "video/mp4",
      duracion: 5,
      bytes: preview.byteLength,
    },
    tinte: "hsl(0 0% 45%)",
    ancho: 1080,
    alto: 1920,
    relacionAspecto: 9 / 16,
    origenDimensiones: "video",
    actualizadoEn: Date.now(),
  });
  original.title = "Render existente · extracto de cinco segundos";
  original.stage = 9;
  original.productionState = "pausada";
  original.medios = medio(original.id);
  original.observabilidad = {
    montaje: urlAsset(original.id, "preview"),
    miniatura: "",
    escenas: [],
    publicaciones: [],
    incidencias: [],
  };
  const distanteId = "medio-real-distante";
  const relleno = Array.from({ length: 20 }, (_, i) => ({
    ...original,
    id: `espera-visual-${i}`,
    title: `Historia en preparación ${i + 1}`,
    stage: 1,
    observabilidad: {
      montaje: "",
      miniatura: "",
      escenas: [],
      publicaciones: [],
      incidencias: [],
    },
    medios: {
      ...medio(`espera-visual-${i}`),
      estado: "sin_medio" as const,
      poster: null,
      preview: null,
      origenDimensiones: "reserva" as const,
    },
  }));
  estado.videos = [
    original,
    ...relleno,
    {
      ...original,
      id: distanteId,
      title: "Extracto real al final de la lista (ensayo)",
      medios: {
        ...medio(distanteId),
        estado: "pendiente",
        poster: null,
        preview: null,
        origenDimensiones: "reserva",
      },
    },
  ];
  const resultados: Resultados = {
    ambitos: [
      {
        id: `video:${original.channelId}`,
        tipo: "video",
        nombre: "Revisión local del render",
        ownerId: estado.user.id,
        propietario: estado.user.name,
      },
    ],
    publicaciones: [
      {
        id: "publicacion-real-local",
        tipo: "video",
        videoId: original.id,
        medios: medio(original.id),
        ambitoId: `video:${original.channelId}`,
        titulo: original.title,
        href: `/videos/${original.id}`,
        fecha: null,
        redes: ["archivo local"],
        simulada: true,
        identidad: "extracto-local-sin-publicacion",
        publicacion: {
          id: "extracto-local",
          red: "archivo local",
          url: "",
          fecha: null,
          miniatura: "",
          historial: [],
        },
      },
    ],
    aprendizajes: [],
    incidencias: [],
  };
  await page.route("**/api/estado", (route) => route.fulfill({ json: estado }));
  await page.route("**/api/eventos", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `event: estado\ndata: ${JSON.stringify(estado)}\n\n`,
    }),
  );
  await page.route("**/api/resultados", (route) =>
    route.fulfill({ json: resultados }),
  );
  await page.route(/\/api\/videos\/[^/]+\/medios(?:\?|$)/, (route) => {
    const id = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/")[3],
    );
    peticiones.set(
      `metadata:${id}`,
      (peticiones.get(`metadata:${id}`) ?? 0) + 1,
    );
    return route.fulfill({ json: medio(id) });
  });
  await page.route("**/__ensayo-medios-reales/**", (route) => {
    const url = new URL(route.request().url());
    const tipo = url.pathname.endsWith(".webp") ? "poster" : "preview";
    const key = `${tipo}:${url.searchParams.get("video")}`;
    peticiones.set(key, (peticiones.get(key) ?? 0) + 1);
    return route.fulfill({
      contentType: tipo === "poster" ? "image/webp" : "video/mp4",
      body: tipo === "poster" ? poster : preview,
    });
  });
  await page.goto("/videos");
  await expect(page.locator(".video-list-row")).toHaveCount(22);
  const primero = page.locator(
    `.video-list [data-video-medio="${original.id}"]`,
  );
  const distante = page.locator(
    `.video-list [data-video-medio="${distanteId}"]`,
  );
  await expect(primero.locator("img")).toHaveJSProperty(
    "src",
    new URL(urlAsset(original.id, "poster"), page.url()).href,
  );
  expect((await distante.boundingBox())!.y).toBeGreaterThan(1140);
  expect(peticiones.get(`metadata:${distanteId}`) ?? 0).toBe(0);
  expect(peticiones.get(`poster:${distanteId}`) ?? 0).toBe(0);
  expect(peticiones.get(`preview:${distanteId}`) ?? 0).toBe(0);
  if (ancho === 1440) {
    expect(peticiones.get(`preview:${original.id}`) ?? 0).toBe(0);
    await primero.hover();
  }
  await expect(primero).toHaveAttribute("data-reproduciendo", "true");
  await page.screenshot({ path: `${salida}/medios-reales-lista-${ancho}.png` });
  await distante.scrollIntoViewIfNeeded();
  await expect(primero).toHaveAttribute("data-reproduciendo", "false");
  await expect
    .poll(() =>
      primero.locator("video").evaluate((v) => (v as HTMLVideoElement).paused),
    )
    .toBe(true);
  await expect(distante.locator("img")).toHaveJSProperty(
    "src",
    new URL(urlAsset(distanteId, "poster"), page.url()).href,
  );
  expect(peticiones.get(`metadata:${distanteId}`)).toBeGreaterThan(0);
  if (ancho === 390)
    await expect(distante).toHaveAttribute("data-reproduciendo", "true");
  await primero.scrollIntoViewIfNeeded();
  if (ancho === 1440) await primero.hover();
  await expect(primero).toHaveAttribute("data-reproduciendo", "true");

  // Chromium headless puede mantener ambas páginas visibles. Registrar esa
  // limitación y probar explícitamente la señal de visibilidad si ocurre.
  const otra = await context.newPage();
  await otra.bringToFront();
  const ocultaNativa = await page.evaluate(() => document.hidden);
  if (!ocultaNativa)
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
  await expect(primero).toHaveAttribute("data-reproduciendo", "false");
  await expect
    .poll(() =>
      primero.locator("video").evaluate((v) => (v as HTMLVideoElement).paused),
    )
    .toBe(true);
  await otra.close();
  await page.bringToFront();
  if (!ocultaNativa)
    await page.evaluate(() => {
      Reflect.deleteProperty(document, "hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
  if (ancho === 1440) await primero.hover();
  await expect(primero).toHaveAttribute("data-reproduciendo", "true");
  await page.evaluate(() => {
    (
      window as typeof window & { marcadorNavegacion: string }
    ).marcadorNavegacion = "sesion-sin-recarga";
  });
  await page.locator(`.video-list a[href="/videos/${original.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/videos/${original.id}$`));
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { marcadorNavegacion: string })
          .marcadorNavegacion,
    ),
  ).toBe("sesion-sin-recarga");
  const reproductor = page
    .getByRole("region", { name: "Video terminado", exact: true })
    .getByLabel(`Video terminado: ${original.title}`, { exact: true });
  await expect(reproductor).toHaveJSProperty(
    "poster",
    new URL(urlAsset(original.id, "poster"), page.url()).href,
  );
  await reproductor.evaluate(async (el) => {
    const v = el as HTMLVideoElement;
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() =>
      reproductor.evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0.1);
  await page.screenshot({
    path: `${salida}/medios-reales-detalle-${ancho}.png`,
    fullPage: true,
  });
  await navegar(page, "/publicados");
  const actualizado = page.waitForResponse("**/api/resultados");
  await page
    .getByRole("button", { name: "Actualizar resultados", exact: true })
    .click();
  await (await actualizado).finished();
  await expect(page.locator(".publication-thumb")).toHaveCount(1);
  const publicado = page.locator(
    `.publication-thumb [data-video-medio="${original.id}"][data-publicacion="extracto-local"]`,
  );
  await expect(publicado.locator("img")).toHaveJSProperty(
    "src",
    new URL(urlAsset(original.id, "poster"), page.url()).href,
  );
  await page.screenshot({
    path: `${salida}/medios-reales-publicados-${ancho}.png`,
    fullPage: true,
  });
  await navegar(page, "/");
  if (ancho === 390) await page.getByRole("tab", { name: /Fábrica/ }).click();
  const fabrica = page.locator(".factory-pane:visible");
  await expect(fabrica.locator(".factory-feature img")).toHaveJSProperty(
    "src",
    new URL(urlAsset(original.id, "poster"), page.url()).href,
  );
  await fabrica.locator(".factory-feature").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${salida}/medios-reales-fabrica-${ancho}.png`,
  });
  await fabrica
    .locator(".queue")
    .screenshot({ path: `${salida}/medios-reales-cola-${ancho}.png` });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(ancho);
  expect(externos).toEqual([]);
  expect(errores).toEqual([]);
  writeFileSync(
    `${salida}/medios-reales-recorrido-${ancho}.json`,
    JSON.stringify(
      {
        ...archivos,
        ancho,
        consola: errores,
        solicitudesExternas: externos,
        solicitudes: Object.fromEntries(peticiones),
        navegacionInternaSinRecarga: true,
        lazyDistanteAntesDeScroll: true,
        pausaFueraDeVista: true,
        visibilidad: ocultaNativa
          ? "Pestaña ocultada por el navegador"
          : "Motor headless mantuvo visible la pestaña; señal document.hidden + visibilitychange simulada explícitamente",
      },
      null,
      2,
    ),
  );
});

test.afterEach(async ({ page }, testInfo) => {
  const video = page.video();
  await page.close();
  await video?.saveAs(
    `${salida}/medios-reales-recorrido-${testInfo.project.use.viewport!.width}.webm`,
  );
});
