import { test, expect } from "@playwright/test";
import { existsSync, writeFileSync } from "node:fs";
import {
  crearMediosDeEnsayo,
  poster,
  preparar,
  salida,
} from "./videos-medios-ayudas";

test.beforeAll(crearMediosDeEnsayo);

test.use({
  viewport: { width: 1440, height: 900 },
  video: "off",
  trace: "off",
  launchOptions: {
    args: [
      "--enable-gpu",
      "--use-gl=angle",
      existsSync("/dev/dri/renderD128")
        ? "--use-angle=gl-egl"
        : "--use-angle=swiftshader",
    ],
  },
});

for (const ancho of [390, 1440])
  test(`medios ${ancho}: espacio reservado, movimiento visible y traza`, async ({
    page,
    context,
    browser,
  }) => {
    // La grabación funcional se conserva en el caso de hover; aquí medimos
    // sin screencast ni traza de Playwright, como en base-diseno.
    expect(page.video()).toBeNull();
    const browserClient = await browser.newBrowserCDPSession();
    const systemInfo = await browserClient.send("SystemInfo.getInfo");
    await browserClient.detach();
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
      categories: "devtools.timeline,blink.user_timing,cc,viz,gpu",
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
          instrumentacion: {
            grabacion: false,
            trazaPlaywright: false,
            navegador: browser.version(),
            gpu: systemInfo.gpu,
          },
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
    await page.close();
  });
