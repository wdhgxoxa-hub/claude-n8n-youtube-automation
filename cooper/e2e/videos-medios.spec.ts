import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Estado } from "../src/servicios/datos";
import type { VideoMedios } from "../src/contratos/video-medios";
import type { Resultados } from "../src/contratos/resultados";

const salida = "../evidencias-diseno";
const origen = "/__ensayo-medios";
const poster = `${origen}/medios-poster.jpg`;
const preview = `${origen}/medios-preview.mp4`;
let mp4: Buffer;
let jpg: Buffer;

test.use({ viewport: { width: 1440, height: 900 }, video: "on" });
test.beforeAll(() => {
  mkdirSync(salida, { recursive: true });
  mkdirSync(".cache/diseno-medios", { recursive: true });
  const archivo = ".cache/diseno-medios/preview-sintetica.mp4";
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=s=320x480:r=15:d=5",
    "-an",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    "-b:v",
    "400k",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    archivo,
  ]);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    archivo,
    "-frames:v",
    "1",
    ".cache/diseno-medios/poster-sintetico.jpg",
  ]);
  mp4 = readFileSync(archivo);
  jpg = readFileSync(".cache/diseno-medios/poster-sintetico.jpg");
  expect(mp4.byteLength).toBeLessThanOrEqual(600000);
});

async function preparar(page: Page, retenerMedios = false) {
  const r = await page.request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
    {
      data: {
        email: "admin@example.test",
        secret: process.env.COOPER_E2E_SECRET,
        montaje: "crear",
        resultados: true,
      },
    },
  );
  expect(r.ok()).toBe(true);
  const estado: Estado = await (await page.request.get("/api/estado")).json();
  const video = estado.videos.find((v) => v.id.startsWith("montaje-e2e-"))!;
  expect(video).toBeDefined();
  const medio: VideoMedios = {
    version: 1,
    videoId: video.id,
    estado: "listo",
    poster: { url: poster, origen: "render", ancho: 320, alto: 480 },
    preview: {
      url: preview,
      mime: "video/mp4",
      duracion: 5,
      bytes: mp4.byteLength,
    },
    tinte: "#997755",
    origenDimensiones: "video",
    ancho: 320,
    alto: 480,
    relacionAspecto: 2 / 3,
    actualizadoEn: Date.now(),
  };
  video.medios = {
    ...medio,
    estado: "pendiente",
    poster: null,
    preview: null,
    origenDimensiones: "reserva",
  };
  video.observabilidad.montaje = `${origen}/medios-completo.mp4`;
  video.observabilidad.miniatura = poster;
  video.observabilidad.publicaciones = [];
  estado.videos = [video];
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) errores.push(m.text());
  });
  let vistasPrevias = 0;
  let completos = 0;
  await page.route(`**${origen}/**`, (route) => {
    if (new URL(route.request().url()).pathname === preview) vistasPrevias++;
    if (route.request().url().endsWith("completo.mp4")) completos++;
    return route.fulfill({
      contentType: route.request().url().endsWith(".jpg")
        ? "image/jpeg"
        : "video/mp4",
      body: route.request().url().endsWith(".jpg") ? jpg : mp4,
    });
  });
  await page.route("**/api/estado", (route) => route.fulfill({ json: estado }));
  await page.route("**/api/eventos", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `event: estado\ndata: ${JSON.stringify(estado)}\n\n`,
    }),
  );
  let liberarMedios: () => void = () => {};
  const permiso = new Promise<void>((resolve) => {
    liberarMedios = resolve;
  });
  if (!retenerMedios) liberarMedios();
  await page.route(`**/api/videos/${video.id}/medios`, async (route) => {
    await permiso;
    return route.fulfill({ json: medio });
  });
  return {
    estado,
    video,
    medio,
    errores,
    liberarMedios,
    peticiones: () => ({ vistasPrevias, completos }),
  };
}

test("póster real, espera de hover, vista previa silenciosa y pausa sin descargar el original", async ({
  page,
}) => {
  const contexto = await preparar(page);
  await page.goto("/videos");
  const medio = page
    .locator(`[data-video-medio="${contexto.video.id}"]`)
    .first();
  const imagen = medio.locator("img");
  await expect(imagen).toHaveJSProperty(
    "src",
    new URL(poster, page.url()).href,
  );
  await expect(imagen).toHaveAttribute("loading", "lazy");
  await expect(imagen).toHaveAttribute("width", "320");
  await expect(imagen).toHaveAttribute("height", "480");
  await expect(imagen).toHaveCSS("object-fit", "contain");
  await expect(medio.locator("svg")).toHaveCount(0);
  await expect(medio).toHaveCSS("--tinte", "#997755");
  expect(contexto.peticiones()).toEqual({ vistasPrevias: 0, completos: 0 });
  const caja = await medio.boundingBox();
  await medio.evaluate((el) => {
    el.addEventListener(
      "pointerenter",
      () => el.setAttribute("data-inicio-hover", String(performance.now())),
      { once: true },
    );
    el.querySelector("video")!.addEventListener(
      "playing",
      () =>
        el.setAttribute(
          "data-espera-hover",
          String(
            performance.now() - Number(el.getAttribute("data-inicio-hover")),
          ),
        ),
      { once: true },
    );
  });
  await medio.hover();
  const player = medio.locator("video");
  await expect
    .poll(() => player.evaluate((el) => (el as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.1);
  expect(
    Number(await medio.getAttribute("data-espera-hover")),
  ).toBeGreaterThanOrEqual(175);
  expect(await player.evaluate((el) => (el as HTMLVideoElement).muted)).toBe(
    true,
  );
  await expect(player).toHaveAttribute("playsinline", "");
  await expect(player).toHaveCSS("transition-duration", "0.24s");
  await expect(medio).toHaveAttribute("data-reproduciendo", "true");
  await page.screenshot({
    path: `${salida}/medios-hover-1440.png`,
    fullPage: true,
  });
  await page.mouse.move(0, 0);
  await expect
    .poll(() => player.evaluate((el) => (el as HTMLVideoElement).paused))
    .toBe(true);
  await expect(medio).toHaveAttribute("data-reproduciendo", "false");
  expect(await medio.boundingBox()).toEqual(caja);
  await medio.hover();
  await expect(medio).toHaveAttribute("data-reproduciendo", "true");
  await page
    .getByRole("button", { name: "Pausar movimiento", exact: true })
    .click();
  await medio.hover();
  await expect(medio).toHaveAttribute("data-quieto", "true");
  await expect
    .poll(() => player.evaluate((el) => (el as HTMLVideoElement).paused))
    .toBe(true);
  await page
    .getByRole("button", { name: "Activar movimiento", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await medio.hover();
  await expect(medio).toHaveAttribute("data-quieto", "true");
  await expect
    .poll(() => player.evaluate((el) => (el as HTMLVideoElement).paused))
    .toBe(true);
  expect(contexto.peticiones().completos).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(contexto.errores).toEqual([]);
  const grabacion = page.video();
  await page.close();
  await grabacion?.saveAs(`${salida}/medios-hover-pausa-1440.webm`);
});

for (const ancho of [390, 1440])
  test(`medios ${ancho}: espacio reservado, movimiento visible y traza`, async ({
    page,
    context,
  }) => {
    const datos = await preparar(page, true);
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto("/videos");
    const medio = page
      .locator(`[data-video-medio="${datos.video.id}"]`)
      .first();
    await expect(medio).toHaveAttribute("data-estado", "pendiente");
    const cajaPendiente = await medio.boundingBox();
    await page.evaluate(() => {
      const state = {
        value: 0,
        observer: new PerformanceObserver((entries) => {
          for (const entry of entries.getEntries()) {
            const shift = entry as PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
            };
            if (!shift.hadRecentInput) state.value += shift.value;
          }
        }),
      };
      (window as typeof window & { clsMedios: typeof state }).clsMedios = state;
      state.observer.observe({ type: "layout-shift" });
    });
    datos.liberarMedios();
    await expect(medio.locator("img")).toHaveJSProperty(
      "src",
      new URL(poster, page.url()).href,
    );
    await expect
      .poll(() =>
        medio
          .locator("img")
          .evaluate((el) => (el as HTMLImageElement).naturalWidth),
      )
      .toBe(320);
    if (ancho === 1440) await medio.hover();
    await expect(medio).toHaveAttribute("data-reproduciendo", "true");
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: ancho === 390 ? 4 : 1,
    });
    await cdp.send("Tracing.start", {
      categories: "devtools.timeline,blink.user_timing",
      transferMode: "ReturnAsStream",
    });
    const estadistica = await page.evaluate(
      () =>
        new Promise<{
          fps: number;
          p95: number;
          maximo: number;
          muestras: number;
          cls: number;
        }>((resolve) => {
          const tiempos: number[] = [];
          let primero = 0,
            anterior = 0;
          const frame = (ahora: number) => {
            if (!primero) primero = ahora;
            if (anterior) tiempos.push(ahora - anterior);
            anterior = ahora;
            if (ahora - primero < 3000) requestAnimationFrame(frame);
            else {
              const ordenados = [...tiempos].sort((a, b) => a - b);
              const shift = (
                window as typeof window & {
                  clsMedios: { value: number; observer: PerformanceObserver };
                }
              ).clsMedios;
              shift.observer.disconnect();
              resolve({
                fps: (tiempos.length * 1000) / (ahora - primero),
                p95: ordenados[Math.floor(ordenados.length * 0.95)],
                maximo: Math.max(...tiempos),
                muestras: tiempos.length,
                cls: shift.value,
              });
            }
          };
          requestAnimationFrame(frame);
        }),
    );
    const final = new Promise<{ stream?: string }>((resolve) =>
      cdp.once("Tracing.tracingComplete", resolve),
    );
    await cdp.send("Tracing.end");
    const { stream } = await final;
    if (!stream) throw new Error("Chromium no entregó la traza solicitada");
    let traza = "";
    while (true) {
      const parte = await cdp.send("IO.read", { handle: stream });
      traza += parte.base64Encoded
        ? Buffer.from(parte.data, "base64").toString()
        : parte.data;
      if (parte.eof) break;
    }
    await cdp.send("IO.close", { handle: stream });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    writeFileSync(`${salida}/medios-traza-${ancho}.json`, traza);
    writeFileSync(
      `${salida}/medios-fluidez-${ancho}.json`,
      JSON.stringify(
        {
          ...estadistica,
          cpu: ancho === 390 ? 4 : 1,
          archivoSintetico: true,
          cumpleObjetivo:
            estadistica.fps >= 57 &&
            estadistica.p95 <= 25 &&
            estadistica.maximo < 100 &&
            estadistica.cls === 0,
        },
        null,
        2,
      ),
    );
    expect(estadistica.fps).toBeGreaterThanOrEqual(57);
    expect(estadistica.p95).toBeLessThanOrEqual(25);
    expect(estadistica.maximo).toBeLessThan(100);
    expect(estadistica.cls).toBe(0);
    expect(await medio.boundingBox()).toEqual(cajaPendiente);
    await page.screenshot({
      path: `${salida}/medios-lista-${ancho}.png`,
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(medio).toHaveAttribute("data-reproduciendo", "false");
    await page.goto(`/videos/${datos.video.id}`);
    const player = page
      .getByRole("region", { name: "Video terminado", exact: true })
      .getByLabel(`Video terminado: ${datos.video.title}`, { exact: true });
    await expect(player).toHaveJSProperty(
      "poster",
      new URL(poster, page.url()).href,
    );
    await expect(player).toHaveAttribute("preload", "none");
    const caja = await player.boundingBox();
    await player.evaluate(async (el) => {
      const v = el as HTMLVideoElement;
      v.muted = true;
      await v.play();
    });
    await expect
      .poll(() => player.evaluate((el) => (el as HTMLVideoElement).currentTime))
      .toBeGreaterThan(0.1);
    expect(await player.boundingBox()).toEqual(caja);
    for (const width of [360, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `${salida}/medios-detalle-${width}.png`,
        fullPage: true,
      });
    }
    expect(datos.errores).toEqual([]);
    const grabacion = page.video();
    await page.close();
    await grabacion?.saveAs(`${salida}/medios-visible-detalle-${ancho}.webm`);
  });

test("Publicados usa el medio de su publicación y conserva fallback tipográfico", async ({
  page,
}) => {
  const datos = await preparar(page);
  const resultados: Resultados = await (
    await page.request.get("/api/resultados")
  ).json();
  const publicacion = resultados.publicaciones.find((p) => p.tipo === "video")!;
  expect(publicacion?.tipo).toBe("video");
  if (publicacion.tipo !== "video")
    throw new Error("Falta publicación ficticia");
  publicacion.videoId = datos.video.id;
  publicacion.medios = {
    ...datos.medio,
    poster: { ...datos.medio.poster!, origen: "youtube" },
    preview: null,
  };
  await page.route(
    `**/api/videos/${datos.video.id}/medios?publicacion=*`,
    (route) => route.fulfill({ json: publicacion.medios }),
  );
  resultados.publicaciones = [publicacion];
  await page.route("**/api/resultados", (route) =>
    route.fulfill({ json: resultados }),
  );
  await page.goto("/publicados");
  const actualizado = page.waitForResponse("**/api/resultados");
  await page
    .getByRole("button", { name: "Actualizar resultados", exact: true })
    .click();
  await (await actualizado).finished();
  await expect(page.locator(".publication-thumb")).toHaveCount(1);
  const medio = page.locator(
    `.publication-thumb [data-video-medio="${datos.video.id}"][data-publicacion="${publicacion.publicacion.id}"]`,
  );
  await expect(medio).toHaveAttribute(
    "data-publicacion",
    publicacion.publicacion.id,
  );
  await expect(medio).toHaveAttribute("data-origen", "youtube");
  await expect(medio.locator("img")).toHaveJSProperty(
    "src",
    new URL(poster, page.url()).href,
  );
  await page.screenshot({
    path: `${salida}/medios-publicados-1440.png`,
    fullPage: true,
  });
  publicacion.medios = {
    ...publicacion.medios,
    estado: "sin_medio",
    poster: null,
    preview: null,
    actualizadoEn: Date.now() + 1,
  };
  await page
    .getByRole("button", { name: "Actualizar resultados", exact: true })
    .click();
  await expect(medio.locator(".medio-espera")).toContainText(
    publicacion.titulo,
  );
  await expect(medio.locator("svg")).toHaveCount(0);
  expect(datos.errores).toEqual([]);
  const grabacion = page.video();
  await page.close();
  await grabacion?.saveAs(`${salida}/medios-publicados-1440.webm`);
});

test("un derivado lento termina visible después de más de ocho consultas", async ({
  page,
}) => {
  await page.clock.install();
  const datos = await preparar(page);
  let consultas = 0;
  await page.route(`**/api/videos/${datos.video.id}/medios`, (route) => {
    consultas++;
    return route.fulfill({
      json: consultas < 10 ? datos.video.medios : datos.medio,
    });
  });
  await page.goto("/videos");
  const medio = page.locator(`[data-video-medio="${datos.video.id}"]`).first();
  await expect(medio).toHaveAttribute("data-estado", "pendiente");
  await expect.poll(() => consultas).toBe(1);
  for (let consulta = 2; consulta <= 10; consulta++) {
    const respuesta = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === `/api/videos/${datos.video.id}/medios`,
    );
    await page.clock.fastForward(15_000);
    await (await respuesta).finished();
    await page.clock.runFor(1);
    await expect.poll(() => consultas).toBe(consulta);
  }
  await expect(medio.locator("img")).toHaveJSProperty(
    "src",
    new URL(poster, page.url()).href,
  );
  expect(datos.errores).toEqual([]);
});
