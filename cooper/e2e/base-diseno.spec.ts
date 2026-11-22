import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { Estado } from "../src/servicios/datos";

const directory = "../evidencias-diseno";
const widths = [360, 390, 768, 1024, 1440, 1920];
type Screen = {
  name: string;
  path: string;
  prepare?: (page: Page) => Promise<void>;
  expectedStatus?: number;
};
type Evidence = {
  screen: string;
  width: number;
  path: string;
  file: string;
  captureMode: "viewport" | "full-page";
  visibleDialogs: string[];
  violations: unknown[];
  overflow: number;
  textBelowMinimum: unknown[];
  console: string[];
  expectedBrowserDiagnostics: string[];
};

async function login(page: Page) {
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
}

async function readyReduced(page: Page) {
  await page.locator("main").waitFor({ state: "visible" });
  if (await page.locator(".workspace").count())
    await expect(page.locator(".workspace")).toHaveAttribute(
      "data-motion",
      "paused",
    );
}

type MotionSample = {
  phase: string;
  startedAt: number;
  intervals: number[];
  longTasks: number[];
  previous: number;
  active: boolean;
  observer: PerformanceObserver;
};

async function startMotionSample(page: Page, phase: string) {
  await page.evaluate((name) => {
    performance.mark(`diseno:${name}:inicio`);
    const sample: MotionSample = {
      phase: name,
      startedAt: performance.now(),
      intervals: [],
      longTasks: [],
      previous: 0,
      active: true,
      observer: new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries())
          sample.longTasks.push(entry.duration);
      }),
    };
    sample.observer.observe({ type: "longtask" });
    (
      window as Window & { cooperDesignSample?: MotionSample }
    ).cooperDesignSample = sample;
    const frame = (time: number) => {
      if (!sample.active) return;
      if (sample.previous) sample.intervals.push(time - sample.previous);
      sample.previous = time;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, phase);
}

async function stopMotionSample(page: Page) {
  return page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    const sample = (window as Window & { cooperDesignSample?: MotionSample })
      .cooperDesignSample;
    if (!sample) throw new Error("La fase de movimiento no se inició.");
    sample.active = false;
    sample.observer.disconnect();
    performance.mark(`diseno:${sample.phase}:fin`);
    const sorted = [...sample.intervals].sort((a, b) => a - b);
    return {
      phase: sample.phase,
      duration: performance.now() - sample.startedAt,
      frames: sample.intervals.length,
      fps:
        1000 /
        (sample.intervals.reduce((sum, value) => sum + value, 0) /
          sample.intervals.length),
      p95: sorted[Math.floor(sorted.length * 0.95)],
      maxFrame: Math.max(...sample.intervals),
      longTasks: sample.longTasks,
    };
  });
}

async function capture(
  page: Page,
  screen: string,
  width: number,
  messages: string[],
  expectedBrowserDiagnostics: string[] = [],
  options: { preserveScroll?: boolean } = {},
): Promise<Evidence> {
  const visibleDialogs: string[] = [];
  for (const selector of [".cooper-panel", ".more-sheet"])
    if (await page.locator(selector).isVisible()) visibleDialogs.push(selector);
  const captureMode: Evidence["captureMode"] = visibleDialogs.length
    ? "viewport"
    : "full-page";
  await page.evaluate(async (preserveScroll) => {
    await document.fonts.ready;
    if (!preserveScroll) window.scrollTo(0, 0);
  }, options.preserveScroll);
  const geometry = await page.evaluate(() => ({
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    textBelowMinimum: Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    ).flatMap((element) => {
      if (
        !Array.from(element.childNodes).some(
          (node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        )
      )
        return [];
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        !box.width ||
        !box.height ||
        style.visibility === "hidden" ||
        style.display === "none"
      )
        return [];
      const size = parseFloat(style.fontSize);
      return size < 12
        ? [
            {
              element: element.tagName,
              class: element.className,
              size,
              text: element.textContent?.slice(0, 60),
            },
          ]
        : [];
    }),
  }));
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const violations = audit.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  for (const selector of visibleDialogs)
    await expect(
      page.locator(selector),
      `${screen} ${width}: la hoja permanece visible tras axe`,
    ).toBeVisible();
  const file = `${screen}-${width}.png`;
  await page.screenshot({
    path: `${directory}/${file}`,
    fullPage: captureMode === "full-page",
  });
  for (const selector of visibleDialogs)
    await expect(
      page.locator(selector),
      `${screen} ${width}: la captura conserva la hoja abierta`,
    ).toBeVisible();
  const result = {
    screen,
    width,
    path: new URL(page.url()).pathname,
    file,
    captureMode,
    visibleDialogs,
    violations,
    ...geometry,
    console: [...messages],
    expectedBrowserDiagnostics,
  };
  writeFileSync(
    `${directory}/${screen}-${width}.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
  expect
    .soft(geometry.overflow, `${screen} ${width}: desbordamiento horizontal`)
    .toBe(0);
  expect
    .soft(
      geometry.textBelowMinimum,
      `${screen} ${width}: texto inferior a 12px`,
    )
    .toEqual([]);
  expect.soft(violations, `${screen} ${width}: axe`).toEqual([]);
  expect.soft(messages, `${screen} ${width}: consola`).toEqual([]);
  const panel = page.locator(".cooper-panel");
  if (await panel.isVisible()) {
    const box = (await panel.boundingBox())!;
    const send = (await panel
      .getByRole("button", { name: "Enviar mensaje", exact: true })
      .boundingBox())!;
    expect
      .soft(send, `${screen} ${width}: compositor disponible`)
      .not.toBeNull();
    if (send) {
      expect
        .soft(send.y, `${screen} ${width}: enviar dentro de la hoja`)
        .toBeGreaterThanOrEqual(box.y);
      expect
        .soft(
          send.y + send.height,
          `${screen} ${width}: enviar sin recorte inferior`,
        )
        .toBeLessThanOrEqual(box.y + box.height);
      expect
        .soft(
          send.x + send.width,
          `${screen} ${width}: enviar sin recorte lateral`,
        )
        .toBeLessThanOrEqual(box.x + box.width);
    }
  }
  return result;
}

test.beforeEach(async ({ page }) => {
  mkdirSync(directory, { recursive: true });
  await login(page);
});

for (const width of widths) {
  test(`pantallas y estados completos a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const state = await (await page.request.get("/api/estado")).json();
    const video = (stage: number) =>
      state.videos.find((item: { stage: number }) => item.stage === stage).id;
    const screens: Screen[] = [
      { name: "inicio", path: "/" },
      { name: "fabrica", path: "/videos" },
      { name: "video-en-produccion", path: `/videos/${video(7)}` },
      { name: "video-aprobacion-guion", path: `/videos/${video(3)}` },
      { name: "video-aprobacion-final", path: `/videos/${video(9)}` },
      { name: "video-publicado", path: `/videos/${video(11)}` },
      { name: "publicados", path: "/publicados" },
      { name: "aprendizaje", path: "/aprendizaje" },
      { name: "marcas-vacio", path: "/marcas" },
      { name: "canales", path: "/canales" },
      { name: "canal-detalle", path: `/canales/${state.channels[0].id}` },
      { name: "avatares", path: "/avatares" },
      {
        name: "voces",
        path: "/avatares",
        prepare: async (p) => {
          await p.getByRole("button", { name: "Voces", exact: true }).click();
        },
      },
      {
        name: "crear-avatar",
        path: "/avatares",
        prepare: async (p) => {
          await p
            .getByRole("button", { name: "Crear avatar", exact: true })
            .click();
          await expect(p.locator(".identity-form blockquote")).toContainText(
            "Mi frase es:",
          );
        },
      },
      {
        name: "crear-voz",
        path: "/avatares",
        prepare: async (p) => {
          await p.getByRole("button", { name: "Voces", exact: true }).click();
          await p
            .getByRole("button", { name: "Crear voz", exact: true })
            .click();
          await expect(p.locator(".identity-form blockquote")).toContainText(
            "Mi frase es:",
          );
        },
      },
      {
        name: "pedir-video",
        path: "/videos",
        prepare: async (p) => {
          await p
            .getByRole("button", { name: "Pedir video", exact: true })
            .click();
        },
      },
      { name: "perfil", path: "/perfil" },
      { name: "administracion", path: "/admin" },
      ...[
        "radar",
        "rutina",
        "redes",
        "referencias",
        "cuentas",
        "programados",
        "decisiones",
        "incidencias",
        "avisos",
      ].map((name) => ({ name, path: `/${name}` })),
      { name: "administracion-fabrica", path: "/admin/fabrica" },
      {
        name: "cooper-abierto",
        path: "/",
        prepare: async (p) => {
          await p
            .getByRole("button", { name: "Abrir Cooper", exact: true })
            .click();
          await expect(
            p.getByRole("textbox", { name: "Mensaje para Cooper" }),
          ).toBeVisible();
        },
      },
      {
        name: "cooper-contexto-video",
        path: `/videos/${video(3)}`,
        prepare: async (p) => {
          await p
            .getByRole("button", { name: "Abrir Cooper", exact: true })
            .click();
          await expect(
            p.getByRole("textbox", { name: "Mensaje para Cooper" }),
          ).toBeVisible();
        },
      },
      {
        name: "navegacion-mas",
        path: "/",
        prepare: async (p) => {
          await p
            .getByRole("button", { name: "Más destinos", exact: true })
            .filter({ visible: true })
            .click();
          await expect(
            p.getByRole("dialog", { name: "Más destinos", exact: true }),
          ).toBeVisible();
        },
      },
      { name: "entrada", path: "/entrar" },
      { name: "entrada-error", path: "/entrar?error=AccessDenied" },
      {
        name: "no-encontrado",
        path: "/videos/no-existe-en-este-ensayo",
        expectedStatus: 404,
      },
      { name: "enlace-invalido", path: "/revisar/whatsapp/enlace-invalido" },
    ];
    const manifest: Evidence[] = [];
    const messages: string[] = [];
    page.on("pageerror", (error) => messages.push(error.message));
    page.on("console", (message) => {
      if (["warning", "error"].includes(message.type()))
        messages.push(`${message.type()}: ${message.text()}`);
    });
    for (const screen of screens) {
      messages.length = 0;
      await page.goto(screen.path);
      await readyReduced(page);
      if (screen.prepare) await screen.prepare(page);
      const expected =
        screen.expectedStatus === 404
          ? messages.filter((message) =>
              /Failed to load resource.*404/.test(message),
            )
          : [];
      if (screen.expectedStatus === 404)
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          "no está disponible",
        );
      manifest.push(
        await capture(
          page,
          screen.name,
          width,
          messages.filter((message) => !expected.includes(message)),
          expected,
        ),
      );
    }
    writeFileSync(
      `${directory}/manifest-${width}.json`,
      JSON.stringify(manifest, null, 2) + "\n",
    );
  });
}

for (const mode of ["medicion", "grabacion"] as const) {
  test.describe(`Movimiento: ${mode}`, () => {
    test.use({ video: mode === "grabacion" ? "on" : "off", trace: "off" });
    for (const width of [390, 1440]) {
      test(`ruta, Cooper y navegación en movimiento a ${width}px`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "no-preference" });
        const client = await context.newCDPSession(page);
        await client.send("Emulation.setCPUThrottlingRate", {
          rate: width < 768 ? 4 : 1,
        });
        if (mode === "medicion")
          await client.send("Tracing.start", {
            categories:
              "devtools.timeline,loading,blink.user_timing,disabled-by-default-devtools.timeline.frame",
            transferMode: "ReturnAsStream",
          });
        const errors: string[] = [];
        const interactions: Awaited<ReturnType<typeof stopMotionSample>>[] = [];
        const beginPhase = async (phase: string) => {
          if (mode === "medicion") await startMotionSample(page, phase);
        };
        const finishPhase = async () => {
          if (mode === "medicion")
            interactions.push(await stopMotionSample(page));
        };
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (["warning", "error"].includes(message.type()))
            errors.push(message.text());
        });
        await page.goto("/");
        await page.evaluate(() => {
          const original = document.startViewTransition?.bind(document);
          if (!original) return;
          const observations: { names: string[] }[] = [];
          (
            window as Window & { transitionsObserved?: typeof observations }
          ).transitionsObserved = observations;
          document.startViewTransition = (
            ...args: Parameters<typeof original>
          ) => {
            observations.push({
              names: [
                ...document.querySelectorAll<HTMLElement>(
                  "[data-video-transition]",
                ),
              ]
                .map((element) => element.style.viewTransitionName)
                .filter(Boolean),
            });
            return original(...args);
          };
        });
        await expect(
          page.getByRole("textbox", { name: "Mensaje para Cooper" }),
        ).toHaveCount(0);
        await expect(
          page.locator("header").getByText("Modo de prueba", { exact: true }),
        ).toHaveCount(0);
        await expect(
          page
            .locator("header")
            .getByRole("button", { name: "Pausar movimiento" }),
        ).toHaveCount(0);
        await expect(page.locator(".pildora-conexion")).toHaveCount(0);
        await beginPhase("cooper-abrir");
        await page
          .getByRole("button", { name: "Abrir Cooper", exact: true })
          .click();
        await expect(
          page.getByRole("textbox", { name: "Mensaje para Cooper" }),
        ).toBeVisible();
        await page.waitForTimeout(700);
        await finishPhase();
        const sheet = page.locator(".cooper-panel");
        if (width < 768) {
          expect((await sheet.boundingBox())!.height).toBeCloseTo(
            900 * 0.62,
            0,
          );
          const grip = page.locator(".cooper-drag");
          const start = (await grip.boundingBox())!;
          await beginPhase("cooper-arrastrar");
          await page.mouse.move(
            start.x + start.width / 2,
            start.y + start.height / 2,
          );
          await page.mouse.down();
          await page.mouse.move(start.x + start.width / 2, start.y - 100, {
            steps: 8,
          });
          await page.mouse.up();
          await expect(sheet).toHaveClass(/is-full/);
          await page.waitForTimeout(700);
          await finishPhase();
          if (mode === "grabacion")
            await capture(page, "cooper-expandido", width, errors);
          await page
            .getByRole("button", { name: "Reducir Cooper", exact: true })
            .click();
          await expect(sheet).not.toHaveClass(/is-full/);
        } else {
          const panelBounds = (await sheet.boundingBox())!;
          const contentBounds = (await page.locator("main").boundingBox())!;
          expect(panelBounds.width).toBe(420);
          expect(contentBounds.x + contentBounds.width).toBeLessThanOrEqual(
            panelBounds.x,
          );
        }
        await beginPhase("cooper-cerrar");
        await page
          .getByRole("button", { name: "Cerrar Cooper", exact: true })
          .click();
        await expect(
          page.getByRole("textbox", { name: "Mensaje para Cooper" }),
        ).toHaveCount(0);
        await page.waitForTimeout(700);
        await finishPhase();
        for (const path of [
          "/videos",
          "/publicados",
          "/aprendizaje",
          "/marcas",
          "/",
        ]) {
          const link = page
            .locator(`a[href="${path}"]`)
            .filter({ visible: true })
            .first();
          await beginPhase(`ruta-${path.replaceAll("/", "_")}`);
          await link.click();
          await expect(page).toHaveURL(
            new RegExp(`${path === "/" ? "/$" : path + "$"}`),
          );
          await page.waitForTimeout(700);
          await finishPhase();
        }
        const target = page.locator(".video-mini").first();
        const href = await target.getAttribute("href");
        await beginPhase("video-elemento-compartido");
        await target.click();
        await expect(page).toHaveURL(new RegExp(`${href}$`));
        await page.waitForTimeout(800);
        await finishPhase();
        const transitions = await page.evaluate(
          () =>
            (window as Window & { transitionsObserved?: { names: string[] }[] })
              .transitionsObserved ?? [],
        );
        expect(transitions.length).toBeGreaterThanOrEqual(6);
        expect(
          transitions.some((transition) =>
            transition.names.some((name) => name.startsWith("video-")),
          ),
        ).toBe(true);
        writeFileSync(
          `${directory}/transiciones-${mode === "grabacion" ? "grabacion-" : ""}${width}.json`,
          JSON.stringify(transitions, null, 2) + "\n",
        );
        if (mode === "grabacion") {
          await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
          expect(errors).toEqual([]);
          return;
        }
        await page.goto("/");
        const metrics = await page.evaluate(async () => {
          let cls = 0;
          const longTasks: number[] = [];
          const layoutShifts: unknown[] = [];
          const startedAt = performance.now();
          const fontsAtStart = document.fonts.status;
          let fontsReadyAt: number | null = null;
          void document.fonts.ready.then(() => {
            fontsReadyAt = performance.now();
          });
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === "longtask")
                longTasks.push(entry.duration);
              else {
                const shift = entry as PerformanceEntry & {
                  hadRecentInput: boolean;
                  value: number;
                  sources?: {
                    node?: Node;
                    previousRect: DOMRectReadOnly;
                    currentRect: DOMRectReadOnly;
                  }[];
                };
                if (!shift.hadRecentInput) cls += shift.value;
                layoutShifts.push({
                  time: shift.startTime,
                  value: shift.value,
                  hadRecentInput: shift.hadRecentInput,
                  sources: shift.sources?.map(
                    ({ node, previousRect, currentRect }) => ({
                      element:
                        node instanceof Element
                          ? `${node.tagName}${node.id ? `#${node.id}` : ""}.${Array.from(node.classList).join(".")}`
                          : node?.nodeName,
                      previous: previousRect.toJSON(),
                      current: currentRect.toJSON(),
                    }),
                  ),
                });
              }
            }
          });
          observer.observe({ entryTypes: ["layout-shift", "longtask"] });
          const intervals: number[] = [];
          await new Promise<void>((resolve) => {
            let previous = 0,
              start = 0;
            function tick(now: number) {
              if (!start) start = now;
              if (previous) intervals.push(now - previous);
              previous = now;
              if (now - start < 2500) requestAnimationFrame(tick);
              else resolve();
            }
            requestAnimationFrame(tick);
          });
          observer.disconnect();
          const sorted = [...intervals].sort((a, b) => a - b);
          return {
            fps:
              1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length),
            p95: sorted[Math.floor(sorted.length * 0.95)],
            cls,
            longTasks,
            layoutShifts,
            startedAt,
            fontsAtStart,
            fontsReadyAt,
          };
        });
        await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        const finished = new Promise<string>((resolve, reject) => {
          client.once("Tracing.tracingComplete", ({ stream }) => {
            if (stream) resolve(stream);
            else reject(new Error("Chromium no devolvió el archivo de traza."));
          });
        });
        await client.send("Tracing.end");
        const stream = await finished;
        const tracePath = `${directory}/traza-movimiento-${width}.json`;
        writeFileSync(tracePath, "");
        while (true) {
          const chunk = await client.send("IO.read", { handle: stream });
          appendFileSync(
            tracePath,
            chunk.base64Encoded
              ? Buffer.from(chunk.data, "base64")
              : chunk.data,
          );
          if (chunk.eof) break;
        }
        await client.send("IO.close", { handle: stream });
        writeFileSync(
          `${directory}/movimiento-${width}.json`,
          JSON.stringify(
            {
              viewport: width,
              instrumentation: {
                cdpTrace: true,
                playwrightTrace: false,
                video: false,
                screenshotsDuringMeasurement: false,
                recordedSeparately: true,
              },
              cpu: width < 768 ? 4 : 1,
              metrics,
              interactions,
              trace: `traza-movimiento-${width}.json`,
              errors,
              limitation:
                "Laboratorio Chromium local; no acredita un teléfono físico.",
            },
            null,
            2,
          ) + "\n",
        );
        expect(metrics.fps).toBeGreaterThanOrEqual(57);
        expect(metrics.p95).toBeLessThanOrEqual(25);
        expect(metrics.cls).toBe(0);
        expect(metrics.longTasks.filter((duration) => duration >= 100)).toEqual(
          [],
        );
        for (const sample of interactions) {
          expect
            .soft(sample.fps, `${sample.phase}: fluidez real de interacción`)
            .toBeGreaterThanOrEqual(57);
          expect
            .soft(sample.p95, `${sample.phase}: percentil95 de fotograma`)
            .toBeLessThanOrEqual(25);
          expect
            .soft(
              sample.longTasks.filter((duration) => duration >= 100),
              `${sample.phase}: bloqueo de interfaz`,
            )
            .toEqual([]);
        }
        expect(errors).toEqual([]);
      });
    }
  });
}

test("Marcas: tres pasos, cinco secciones y edición en seis anchuras", async ({
  page,
}) => {
  const messages: string[] = [];
  page.on("pageerror", (error) => messages.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      messages.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.goto("/marcas");
    await readyReduced(page);
    await page
      .getByRole("button", {
        name: /^(Añadir marca o cuenta|Crear mi primera marca)$/,
        exact: true,
      })
      .first()
      .click();
    await capture(page, "marca-identidad", width, messages);
    await page
      .getByRole("textbox", { name: "Nombre de la marca" })
      .fill("Estudio de ensayo visual");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await capture(page, "marca-guia", width, messages);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await capture(page, "marca-especialista", width, messages);
  }
  const response = await page.request.post("/api/marcas", {
    data: { nombre: "Estudio de ensayo visual", rubro: "general" },
  });
  expect(response.ok()).toBe(true);
  const brand = await response.json();
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    for (const section of [
      "calendario",
      "estudio",
      "competencia",
      "publicados",
      "aprendizaje",
    ]) {
      await page.goto(`/marcas?marca=${brand.id}&seccion=${section}`);
      await readyReduced(page);
      await capture(page, `marca-${section}`, width, messages);
    }
  }
});

test("cargas y errores recuperables conservan la interfaz en seis anchuras", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const diagnostics: unknown[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      errors.push(message.text());
  });
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.goto("/radar");
    await readyReduced(page);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      "**/api/operacion",
      async (route) => {
        await held;
        await route.continue();
      },
      { times: 1 },
    );
    await page.getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(
      page.getByText("Consultando la fábrica…", { exact: true }),
    ).toBeVisible();
    try {
      await capture(page, "operacion-cargando", width, errors);
    } finally {
      release();
    }
    await expect(
      page.getByRole("button", { name: "Actualizar", exact: true }),
    ).toBeEnabled();
    await page.route(
      "**/api/operacion",
      async (route) => {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "La fábrica no responde. Puedes volver a intentarlo.",
          }),
        });
      },
      { times: 1 },
    );
    await page.getByRole("button", { name: "Actualizar", exact: true }).click();
    const failure = page
      .getByRole("alert")
      .filter({ hasText: "La fábrica no responde" });
    await expect(failure).toContainText("La fábrica no responde");
    const expected = errors.filter((message) =>
      /Failed to load resource.*503/.test(message),
    );
    const unexpected = errors.filter((message) => !expected.includes(message));
    diagnostics.push({
      width,
      expectedHttpStatus: 503,
      injectedFailure: true,
      expectedBrowserDiagnostics: expected,
      unexpected,
    });
    await capture(
      page,
      "operacion-error-recuperable",
      width,
      unexpected,
      expected,
    );
    errors.splice(0, errors.length, ...unexpected);
    await page.getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(failure).toHaveCount(0);
    await capture(page, "operacion-recuperada", width, errors);
  }
  writeFileSync(
    `${directory}/errores-provocados.json`,
    JSON.stringify(diagnostics, null, 2) + "\n",
  );
});

test("Cooper conserva el compositor con dos selectores, adjunto y error", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      errors.push(message.text());
  });
  const state: Estado = await (await page.request.get("/api/estado")).json();
  const target = state.videos.find(
    (video) => video.ownerId === state.user.id && video.stage === 3,
  )!;
  const diagnostics: unknown[] = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 1024 ? 844 : 1000 });
    await page.goto(`/videos/${target.id}`);
    await readyReduced(page);
    await page
      .getByRole("button", { name: "Abrir Cooper", exact: true })
      .click();
    const panel = page.locator(".cooper-panel");
    await expect(panel.locator(".composer-tools select")).toHaveCount(2);
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 48;
      const context = canvas.getContext("2d")!;
      context.fillStyle = getComputedStyle(
        document.documentElement,
      ).getPropertyValue("--tally");
      context.fillRect(0, 0, 48, 48);
      return canvas.toDataURL().split(",")[1];
    });
    await page.getByLabel("Archivo adjunto", { exact: true }).setInputFiles({
      name: "referencia-de-ensayo.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
    await expect(
      page.getByAltText("Vista previa de referencia-de-ensayo.png"),
    ).toBeVisible();
    await capture(page, "cooper-adjunto-selectores", width, errors);
    await page.route(
      "**/api/chat",
      (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Cooper necesita un momento. Vuelve a intentarlo.",
          }),
        }),
      { times: 1 },
    );
    await page
      .getByRole("textbox", { name: "Mensaje para Cooper", exact: true })
      .fill("Revisa esta referencia de ensayo");
    await page
      .getByRole("button", { name: "Enviar mensaje", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Cooper necesita un momento" }),
    ).toContainText("Cooper necesita un momento");
    const expected = errors.filter((message) =>
      /Failed to load resource.*503/.test(message),
    );
    const unexpected = errors.filter((message) => !expected.includes(message));
    await capture(
      page,
      "cooper-error-con-adjunto",
      width,
      unexpected,
      expected,
    );
    diagnostics.push({ width, expectedHttpStatus: 503, expected, unexpected });
    errors.splice(0, errors.length, ...unexpected);
  }
  writeFileSync(
    `${directory}/chat-errores-provocados.json`,
    JSON.stringify(diagnostics, null, 2) + "\n",
  );
});

for (const width of [390, 1440]) {
  test.describe(`Medio con ${width < 768 ? "pantalla táctil" : "puntero"}`, () => {
    test.use({ isMobile: width < 768, hasTouch: width < 768 });
    test(`medios y contadores: reproducción local real y datos que cambian a ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      // El patrón audiovisual es un fixture explícito, nunca se presenta como una producción real.
      const clip = execFileSync("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=s=480x270:r=24",
        "-t",
        "2",
        "-an",
        "-c:v",
        "libx264",
        "-threads",
        "1",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "frag_keyframe+empty_moov",
        "-f",
        "mp4",
        "pipe:1",
      ]);
      const poster = execFileSync("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=s=480x270:r=24",
        "-frames:v",
        "1",
        "-threads",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "pipe:1",
      ]);
      await page.route(
        "https://cooper-media.example.test/ensayo.mp4",
        (route) =>
          route.fulfill({ status: 200, contentType: "video/mp4", body: clip }),
      );
      await page.route(
        "https://cooper-media.example.test/ensayo.png",
        (route) =>
          route.fulfill({
            status: 200,
            contentType: "image/png",
            body: poster,
          }),
      );
      const state: Estado = await (
        await page.request.get("/api/estado")
      ).json();
      const target = state.videos.find(
        (video) => video.ownerId === state.user.id && video.stage === 3,
      )!;
      target.title = "Ensayo local de vista previa";
      target.observabilidad.miniatura =
        "https://cooper-media.example.test/ensayo.png";
      target.observabilidad.montaje =
        "https://cooper-media.example.test/ensayo.mp4";
      await page.route("**/api/eventos", (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: `event: estado\ndata: ${JSON.stringify(state)}\n\n`,
        }),
      );
      await page.route("**/api/estado", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(state),
        }),
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type()))
          errors.push(message.text());
      });
      await page.goto("/");
      const media = page
        .locator(`.video-mini[href="/videos/${target.id}"] .medio`)
        .first();
      await expect(media).toBeVisible();
      await media.scrollIntoViewIfNeeded();
      if (width < 768) {
        expect(
          await page.evaluate(() => matchMedia("(hover: none)").matches),
        ).toBe(true);
      } else {
        await expect(media).toHaveAttribute("data-preview", "off");
        await media.hover();
      }
      await expect(media).toHaveAttribute("data-preview", "on");
      const player = media.locator("video");
      expect(
        await player.evaluate((element) => (element as HTMLVideoElement).muted),
      ).toBe(true);
      await expect
        .poll(() =>
          player.evaluate(
            (element) => (element as HTMLVideoElement).currentTime,
          ),
        )
        .toBeGreaterThan(0.05);
      await capture(page, "medio-vista-previa-fixture", width, errors, [], {
        preserveScroll: true,
      });
      if (width < 768) {
        const visibleRatio = await media.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const top = box.top + scrollY;
          const maxScroll = document.documentElement.scrollHeight - innerHeight;
          const ratioAt = (scroll: number) =>
            Math.max(
              0,
              Math.min(top + box.height, scroll + innerHeight) -
                Math.max(top, scroll),
            ) / box.height;
          const position = ratioAt(0) < ratioAt(maxScroll) ? 0 : maxScroll;
          window.scrollTo(0, position);
          return ratioAt(position);
        });
        expect(visibleRatio).toBeLessThan(0.65);
      } else await page.mouse.move(0, 0);
      await expect(media).toHaveAttribute("data-preview", "off");
      expect(
        await player.evaluate(
          (element) => (element as HTMLVideoElement).paused,
        ),
      ).toBe(true);
      const counter = page.locator(".home-overview .cifra").first();
      const before = await counter.boundingBox();
      const originalCount = state.videos.filter(
        (video) => video.ownerId === state.user.id && video.stage < 11,
      ).length;
      // El video añadido pertenece únicamente al fixture SSE de esta prueba.
      await page.route("**/api/videos/ensayo-cifra-adicional/tinte", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ color: null }),
        }),
      );
      state.videos.push({ ...target, id: "ensayo-cifra-adicional", stage: 0 });
      await page.evaluate(() => {
        window.dispatchEvent(new Event("offline"));
        window.dispatchEvent(new Event("online"));
      });
      await expect(counter.locator(".sr-only")).toHaveText(
        String(originalCount + 1),
      );
      await page.waitForTimeout(900);
      const after = await counter.boundingBox();
      expect(after?.width).toBe(before?.width);
      await capture(page, "cifra-actualizada", width, errors);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await media.scrollIntoViewIfNeeded();
      if (width >= 768) await media.hover();
      await page.waitForTimeout(400);
      await expect(media).toHaveAttribute("data-preview", "off");
      expect(
        await player.evaluate(
          (element) => (element as HTMLVideoElement).paused,
        ),
      ).toBe(true);
      await capture(page, "medio-reducido-fixture", width, errors, [], {
        preserveScroll: true,
      });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.addInitScript(() => {
        const traces: { name: string; duration: string }[] = [];
        (
          window as Window & { sparklineAnimations?: typeof traces }
        ).sparklineAnimations = traces;
        document.addEventListener("animationstart", (event) => {
          if (
            event.target instanceof Element &&
            event.target.matches(".cifra-grafica path")
          )
            traces.push({
              name: event.animationName,
              duration: getComputedStyle(event.target).animationDuration,
            });
        });
      });
      await page.goto("/publicados");
      const sparkline = page.locator(".cifra-grafica path").first();
      await sparkline.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as Window & { sparklineAnimations?: unknown[] })
                .sparklineAnimations?.length ?? 0,
          ),
        )
        .toBeGreaterThan(0);
      await expect
        .poll(() =>
          sparkline.evaluate(
            (element) => getComputedStyle(element).strokeDashoffset,
          ),
        )
        .toBe("0px");
      const animations = await page.evaluate(
        () =>
          (
            window as Window & {
              sparklineAnimations?: { name: string; duration: string }[];
            }
          ).sparklineAnimations,
      );
      expect(
        animations?.every(
          (animation) =>
            animation.name === "cifra-trazo" && animation.duration === "0.64s",
        ),
      ).toBe(true);
      writeFileSync(
        `${directory}/minigrafica-${width}.json`,
        JSON.stringify(
          {
            source: "Historial persistido del simulador de demostración",
            animations,
          },
          null,
          2,
        ) + "\n",
      );
      await capture(page, "cifra-minigrafica", width, errors, [], {
        preserveScroll: true,
      });
      expect(errors).toEqual([]);
    });
  });
}
