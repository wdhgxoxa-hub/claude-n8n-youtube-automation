import { test, expect, type CDPSession, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Patrón de e2e/base-diseno.spec.ts, aislado para no mezclar grabación y medición.
// Documentación oficial: playwright.dev/docs/api/class-browsercontext#browser-context-new-cdp-session
// chromedevtools.github.io/devtools-protocol/tot/{Emulation,Tracing,IO}/
const directory = "../evidencias-diseno";
const thresholds = {
  fpsMin: 57,
  p95MaxMs: 25,
  blockingMaxMs: 100,
  clsMax: 0.01,
};

type Shift = PerformanceEntry & { value: number; hadRecentInput: boolean };
type Sample = {
  phase: string;
  startedAt: number;
  previous: number;
  active: boolean;
  frames: { at: number; delta: number }[];
  longTasks: { at: number; duration: number }[];
  shifts: { at: number; value: number; hadRecentInput: boolean }[];
  observer: PerformanceObserver;
};

async function startSample(page: Page, phase: string) {
  await page.evaluate(async (name) => {
    const current = window as Window & { cooperFluidez?: Sample };
    if (current.cooperFluidez?.active)
      throw new Error("La muestra anterior sigue abierta.");
    performance.mark(`cooper-fluidez:${name}:inicio`);
    const sample: Sample = {
      phase: name,
      startedAt: performance.now(),
      previous: 0,
      active: true,
      frames: [],
      longTasks: [],
      shifts: [],
      observer: new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          if (entry.entryType === "longtask") {
            sample.longTasks.push({
              at: entry.startTime,
              duration: entry.duration,
            });
          } else {
            const shift = entry as Shift;
            sample.shifts.push({
              at: shift.startTime,
              value: shift.value,
              hadRecentInput: shift.hadRecentInput,
            });
          }
        }
      }),
    };
    sample.observer.observe({ entryTypes: ["longtask", "layout-shift"] });
    current.cooperFluidez = sample;
    await new Promise<void>((resolve) => {
      const frame = (time: number) => {
        if (!sample.active) return;
        if (sample.previous)
          sample.frames.push({ at: time, delta: time - sample.previous });
        else resolve();
        sample.previous = time;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }, phase);
}

async function stopSample(page: Page) {
  return page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    const sample = (window as Window & { cooperFluidez?: Sample })
      .cooperFluidez;
    if (!sample?.active) throw new Error("No hay una muestra activa.");
    sample.active = false;
    for (const entry of sample.observer.takeRecords()) {
      if (entry.entryType === "longtask")
        sample.longTasks.push({
          at: entry.startTime,
          duration: entry.duration,
        });
      else {
        const shift = entry as Shift;
        sample.shifts.push({
          at: shift.startTime,
          value: shift.value,
          hadRecentInput: shift.hadRecentInput,
        });
      }
    }
    sample.observer.disconnect();
    performance.mark(`cooper-fluidez:${sample.phase}:fin`);
    const intervals = sample.frames.map((frame) => frame.delta);
    const sorted = [...intervals].sort((a, b) => a - b);
    return {
      phase: sample.phase,
      startedAt: sample.startedAt,
      duration: performance.now() - sample.startedAt,
      frames: intervals.length,
      fps: intervals.length
        ? 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length)
        : 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] ?? null,
      maxFrame: sorted.at(-1) ?? null,
      cls: sample.shifts
        .filter((shift) => !shift.hadRecentInput)
        .reduce((sum, shift) => sum + shift.value, 0),
      longTasks: sample.longTasks,
      layoutShifts: sample.shifts,
      frameTimeline: sample.frames,
    };
  });
}

async function saveTrace(client: CDPSession, path: string) {
  const completed = new Promise<string>((resolve, reject) => {
    client.once("Tracing.tracingComplete", ({ stream }) => {
      if (stream) resolve(stream);
      else reject(new Error("Chromium no entregó la traza de Cooper."));
    });
  });
  await client.send("Tracing.end");
  const stream = await completed;
  writeFileSync(path, "");
  try {
    while (true) {
      const chunk = await client.send("IO.read", { handle: stream });
      appendFileSync(
        path,
        chunk.base64Encoded ? Buffer.from(chunk.data, "base64") : chunk.data,
      );
      if (chunk.eof) break;
    }
  } finally {
    await client.send("IO.close", { handle: stream });
  }
}

for (const width of [390, 1440]) {
  test(`Cooper: fluidez real de apertura, chips y arrastre a ${width}px`, async ({
    page,
    context,
    browser,
  }, testInfo) => {
    mkdirSync(directory, { recursive: true });
    expect(
      page.video(),
      "La medición no debe iniciar una grabación",
    ).toBeNull();
    expect(testInfo.project.use.trace).toBe("off");
    expect(testInfo.project.use.screenshot).toBe("off");
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const response = await page.request.post(
      `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT ?? "33173"}/sesion`,
      {
        data: {
          email: "admin@example.test",
          secret: process.env.COOPER_E2E_SECRET,
        },
      },
    );
    expect(response.ok()).toBe(true);
    const browserClient = await browser.newBrowserCDPSession();
    const systemInfo = await browserClient.send("SystemInfo.getInfo");
    const renderer = {
      devices: systemInfo.gpu.devices,
      features: systemInfo.gpu.featureStatus,
      renderer: systemInfo.gpu.auxAttributes?.glRenderer,
      vendor: systemInfo.gpu.auxAttributes?.glVendor,
      driver: systemInfo.gpu.auxAttributes?.displayType,
      browserVersion: browser.version(),
      launchOptions: testInfo.project.use.launchOptions?.args ?? [],
    };
    await browserClient.detach();
    const client = await context.newCDPSession(page);
    const cpu = width < 768 ? 4 : 1;
    await client.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    const diagnostics: string[] = [];
    const mutations: string[] = [];
    page.on("pageerror", (error) => diagnostics.push(error.message));
    page.on("console", (message) => {
      if (["warning", "error"].includes(message.type()))
        diagnostics.push(message.text());
    });
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/chat"
      )
        mutations.push("POST /api/chat");
    });
    await page.goto("/marcas");
    await expect(page.locator(".workspace")).toHaveAttribute(
      "data-motion",
      "playing",
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const panel = page.getByRole("dialog", {
      name: "Cooper, tu compañero",
      exact: true,
    });
    const input = page.getByRole("textbox", {
      name: "Mensaje para Cooper",
      exact: true,
    });
    const samples: Awaited<ReturnType<typeof stopSample>>[] = [];
    let failure: unknown;
    const measure = async (
      phase: string,
      action: () => Promise<void>,
      settle = 700,
    ) => {
      await startSample(page, phase);
      try {
        await action();
        // Ventana de asentamiento del muelle, también incluida en las muestras crudas.
        await page.waitForTimeout(settle);
      } finally {
        samples.push(await stopSample(page));
      }
    };
    const drag = async (distance: number) => {
      const grip = await page.locator(".cooper-drag").boundingBox();
      expect(grip).not.toBeNull();
      if (!grip) throw new Error("No aparece el tirador de Cooper.");
      const x = grip.x + grip.width / 2;
      const y = grip.y + grip.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + distance, { steps: 12 });
      await page.mouse.up();
    };
    await client.send("Tracing.start", {
      categories:
        "devtools.timeline,loading,blink.user_timing,disabled-by-default-devtools.timeline.frame,cc,viz,gpu",
      transferMode: "ReturnAsStream",
    });
    const traceName = `cooper-fluidez-${width}-traza.json`;
    try {
      await measure(
        "orbe-en-reposo",
        async () => {
          await expect(panel).toHaveCount(0);
        },
        1600,
      );
      await measure("cooper-primera-apertura", async () => {
        await page
          .getByRole("button", { name: "Abrir Cooper", exact: true })
          .click();
        await expect(panel).toBeVisible();
        await expect(input).toBeVisible();
      });
      if (width < 768) {
        expect((await panel.boundingBox())!.height).toBeCloseTo(900 * 0.62, 0);
      }
      const chips = panel.locator(".cooper-suggestions");
      await expect(chips.getByRole("button")).toHaveCount(3);
      expect(
        await chips.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        ),
      ).toBe(true);
      await measure("chips-desplazamiento-horizontal", async () => {
        await chips.hover();
        await page.mouse.wheel(360, 0);
        await expect
          .poll(() => chips.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(0);
        await expect(chips).toHaveAttribute("data-inicio", "true");
      });
      await measure("chips-seleccion-y-compositor", async () => {
        await chips
          .getByRole("button", { name: "Revisar mis pendientes", exact: true })
          .click();
        await expect(input).toHaveValue("¿Qué tengo pendiente?");
        if (width < 768) await expect(panel).toHaveClass(/is-full/);
      });
      if (width < 768) {
        await measure("cooper-reducir-con-control", async () => {
          await panel
            .getByRole("button", { name: "Reducir Cooper", exact: true })
            .click();
          await expect(panel).not.toHaveClass(/is-full/);
        });
        await measure("cooper-arrastrar-a-completa", async () => {
          await drag(-110);
          await expect(panel).toHaveClass(/is-full/);
        });
        await measure("cooper-arrastrar-a-parcial", async () => {
          await drag(110);
          await expect(panel).not.toHaveClass(/is-full/);
        });
        await measure("cooper-arrastrar-a-cerrar", async () => {
          await drag(110);
          await expect(panel).toHaveCount(0);
        });
      } else {
        await measure("cooper-primer-cierre", async () => {
          await panel
            .getByRole("button", { name: "Cerrar Cooper", exact: true })
            .click();
          await expect(panel).toHaveCount(0);
        });
      }
      await measure("cooper-reapertura", async () => {
        await page
          .getByRole("button", { name: "Abrir Cooper", exact: true })
          .click();
        await expect(input).toBeVisible();
      });
      await measure("cooper-cierre-con-control", async () => {
        await panel
          .getByRole("button", { name: "Cerrar Cooper", exact: true })
          .click();
        await expect(panel).toHaveCount(0);
      });
    } catch (cause) {
      failure = cause;
    } finally {
      await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      try {
        await saveTrace(client, `${directory}/${traceName}`);
      } catch (cause) {
        diagnostics.push(
          `No se pudo guardar la traza: ${(cause as Error).message}`,
        );
      }
      writeFileSync(
        `${directory}/cooper-fluidez-${width}.json`,
        JSON.stringify(
          {
            commit: execFileSync("git", ["rev-parse", "HEAD"], {
              encoding: "utf8",
            }).trim(),
            measuredAt: new Date().toISOString(),
            viewport: { width, height: 900 },
            cpu,
            renderer,
            thresholds,
            instrumentation: {
              cdpTrace: true,
              playwrightTrace: false,
              video: false,
              screenshotsDuringMeasurement: false,
              samplesIncludeInteractionAndSettling: true,
              realAnimationClock: true,
            },
            samples,
            trace: traceName,
            diagnostics,
            mutations,
            interactionFailure:
              failure instanceof Error
                ? failure.message
                : failure
                  ? String(failure)
                  : null,
            limitation:
              "Laboratorio Chromium local con el renderizador CDP registrado y CPU 4× en el viewport móvil. No acredita rendimiento de teléfono físico ni teclado virtual. Los tiempos completos y todos los fotogramas se conservan, incluidos los que exceden el presupuesto.",
          },
          null,
          2,
        ) + "\n",
      );
      await client.detach();
    }
    for (const sample of samples) {
      expect
        .soft(sample.frames, `${sample.phase}: muestra suficiente`)
        .toBeGreaterThanOrEqual(20);
      expect
        .soft(sample.fps, `${sample.phase}: FPS`)
        .toBeGreaterThanOrEqual(thresholds.fpsMin);
      expect
        .soft(sample.p95 ?? Infinity, `${sample.phase}: p95`)
        .toBeLessThanOrEqual(thresholds.p95MaxMs);
      expect
        .soft(sample.maxFrame ?? Infinity, `${sample.phase}: fotograma largo`)
        .toBeLessThan(thresholds.blockingMaxMs);
      expect
        .soft(
          sample.longTasks.filter(
            (task) => task.duration >= thresholds.blockingMaxMs,
          ),
          `${sample.phase}: bloqueo del hilo principal`,
        )
        .toEqual([]);
      expect
        .soft(sample.cls, `${sample.phase}: desplazamiento inesperado`)
        .toBeLessThanOrEqual(thresholds.clsMax);
    }
    expect.soft(diagnostics).toEqual([]);
    expect
      .soft(mutations, "Los chips preparan el mensaje sin enviarlo")
      .toEqual([]);
    if (failure) throw failure;
    expect(samples).toHaveLength(width < 768 ? 10 : 7);
  });
}
