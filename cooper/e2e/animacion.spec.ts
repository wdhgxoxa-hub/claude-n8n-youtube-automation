import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Estado } from "../src/servicios/datos";
const dir = ".cache/animacion";
async function captura(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}
async function login(page: Page) {
  const response = await page.request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT}/sesion`,
    {
      data: {
        email: "admin@example.test",
        secret: process.env.COOPER_E2E_SECRET,
      },
    },
  );
  expect(response.ok()).toBe(true);
  await page.goto("/");
  await expect(page.locator(".connection")).toHaveText("En vivo");
}
async function settledFace(page: Page) {
  return page
    .locator(".chat-heading svg[data-cooper-state]")
    .evaluate((el) =>
      Array.from(el.querySelectorAll("g,path")).map((node) =>
        node.getAttribute("style"),
      ),
    );
}
test.beforeAll(() => mkdirSync(dir, { recursive: true }));
test.use({
  video: { mode: "on", size: { width: 1440, height: 900 } },
  viewport: { width: 1440, height: 900 },
});
test.describe("evidencia de movimiento", () => {
  test("entrada, fábrica, mirada, chat, audio y adjunto en movimiento", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/entrar");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Las ideas buenas",
    );
    await page.screenshot({ path: `${dir}/entrada-revelado-1440.png` });
    await page.waitForTimeout(950);
    await page.screenshot({ path: `${dir}/entrada-1440.png` });
    await login(page);
    await expect(page.locator(".factory-pane .journey li")).toHaveCount(12);
    const gaze = page.locator(".chat-heading .cooper-gaze");
    await page.mouse.move(1380, 200);
    await expect
      .poll(() => gaze.getAttribute("style"))
      .toContain("translateX(3px)");
    await page.mouse.move(10, 100);
    await expect
      .poll(() => gaze.getAttribute("style"))
      .toContain("translateX(-3px)");
    const state: Estado = await (await page.request.get("/api/estado")).json();
    const ownPublished = state.videos.find(
      (video) =>
        video.ownerId === state.user.id &&
        video.title === "Por qué el cielo cambia de color" &&
        video.stage === 11,
    );
    const ownEditing = state.videos.find(
      (video) =>
        video.ownerId === state.user.id &&
        video.title === "El mar también respira" &&
        video.stage === 7,
    );
    expect(ownPublished).toBeDefined();
    expect(ownEditing).toBeDefined();
    // El administrador ve demos de varios dueños con el mismo título. La cola
    // conserva el orden del estado; el enlace de detalle comprueba el ID elegido.
    const queue = page.locator(".queue-item");
    await expect(queue).toHaveCount(state.videos.length);
    const card = queue.nth(
      state.videos.findIndex((video) => video.id === ownPublished!.id),
    );
    await expect(card).toHaveAccessibleName(
      "12 Por qué el cielo cambia de color Publicado",
    );
    await card.hover({ position: { x: 8, y: 8 } });
    await expect.poll(() => card.getAttribute("style")).toContain("rotateY");
    await card.click();
    await expect(page.locator(".factory-link")).toHaveAttribute(
      "href",
      `/videos/${ownPublished!.id}`,
    );
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "12",
    );
    await expect(page.locator(".factory-progress .sr-only")).toHaveText("100");
    const editing = queue.nth(
      state.videos.findIndex((video) => video.id === ownEditing!.id),
    );
    await expect(editing).toHaveAccessibleName(
      "08 El mar también respira Montaje",
    );
    await editing.click();
    await expect(page.locator(".factory-link")).toHaveAttribute(
      "href",
      `/videos/${ownEditing!.id}`,
    );
    await page.waitForTimeout(750);
    await captura(page, "fabrica-1440");
    // El chat ahora termina al acabar el stream. Espaciamos sus frames reales
    // para observar también respuestas de una sola frase sin carreras con el sondeo.
    await page.evaluate(() => {
      const original = window.fetch;
      window.fetch = async (input, init) => {
        const response = await original(input, init);
        if (input !== "/api/chat" || !response.body || !response.ok)
          return response;
        const decoder = new TextDecoder(),
          encoder = new TextEncoder();
        let pending = "";
        const stream = response.body.pipeThrough(
          new TransformStream({
            async transform(chunk, controller) {
              pending += decoder.decode(chunk, { stream: true });
              let split;
              while ((split = pending.indexOf("\n\n")) >= 0) {
                controller.enqueue(encoder.encode(pending.slice(0, split + 2)));
                pending = pending.slice(split + 2);
                await new Promise((resolve) => setTimeout(resolve, 650));
              }
            },
            flush(controller) {
              pending += decoder.decode();
              if (pending) controller.enqueue(encoder.encode(pending));
            },
          }),
        );
        return new Response(stream, {
          status: response.status,
          headers: response.headers,
        });
      };
    });
    // Retardar la respuesta real local permite observar el estado pensando sin alterar su contrato.
    await page.route("**/api/chat", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });
    await page
      .getByRole("textbox", { name: "Mensaje para Cooper", exact: true })
      .fill("¿Qué tengo pendiente?");
    await page.getByLabel("Enviar mensaje").click();
    await expect(
      page
        .locator(".chat-heading")
        .getByRole("img", { name: "Cooper pensando" }),
    ).toBeVisible();
    await expect(page.locator(".thinking")).toBeVisible();
    await expect(
      page
        .locator(".chat-heading")
        .getByRole("img", { name: "Cooper hablando" }),
    ).toBeVisible();
    await expect(page.locator(".response-word").first()).toBeVisible();
    await captura(page, "respuesta-1440");
    await expect(
      page.locator(".chat-heading").getByRole("img", { name: "Cooper reposo" }),
    ).toBeVisible();
    await page.getByLabel("Grabar audio").click();
    await expect(
      page
        .locator(".chat-heading")
        .getByRole("img", { name: "Cooper escuchando" }),
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Grabando audio" }),
    ).toBeVisible();
    await captura(page, "escuchando-1440");
    await page.getByLabel("Detener grabación").click();
    await expect(page.locator(".attachment-preview")).toHaveCount(1);
    await page.getByRole("button", { name: /Quitar grabacion/ }).click();
    // PNG generado por el propio navegador; ningún archivo personal.
    const png = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = c.height = 48;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#a6d7ed";
      ctx.fillRect(0, 0, 48, 48);
      return c.toDataURL().split(",")[1];
    });
    await page.getByLabel("Archivo adjunto", { exact: true }).setInputFiles({
      name: "referencia-ensayo.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
    await expect(
      page.getByAltText("Vista previa de referencia-ensayo.png"),
    ).toBeVisible();
    await captura(page, "adjunto-1440");
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: /^Videos/ })
      .click();
    await expect(
      page.locator('.sidebar [aria-current="page"] .nav-indicator'),
    ).toHaveCount(1);
    await page
      .getByRole("link", { name: "Administración", exact: true })
      .click();
    await page.getByRole("button", { name: "Mes", exact: true }).click();
    await captura(page, "administracion-1440");
    expect(errors).toEqual([]);
    const video = page.video()!;
    await page.close();
    await video.saveAs(`${dir}/recorrido.webm`);
  });
});

test("pausa y movimiento reducido detienen efectos activos, incluso al navegar", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Pausar movimiento" }).click();
  await page.waitForTimeout(350);
  const before = await settledFace(page);
  await page.mouse.move(20, 30);
  await page.waitForTimeout(350);
  expect(await settledFace(page)).toEqual(before);
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: /^Videos/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Activar movimiento" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Inicio", exact: true }).click();
  await page.getByRole("button", { name: "Activar movimiento" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(350);
  const reducedFace = await settledFace(page);
  await page.mouse.move(1000, 30);
  await page.waitForTimeout(350);
  expect(await settledFace(page)).toEqual(reducedFace);
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 768) await page.getByRole("tab", { name: /Fábrica/ }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${dir}/reducido-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto("/entrar");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".login-track")).toBeVisible();
  await captura(page, "entrada-390");
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
});

test("fluidez local y propiedades de animación sin cambios de geometría", async ({
  page,
}) => {
  await login(page);
  await page.waitForTimeout(1200);
  const client = await page.context().newCDPSession(page);
  const results = [];
  for (const rate of [1, 4]) {
    await client.send("Emulation.setCPUThrottlingRate", { rate });
    const sample = await page.evaluate(async () => {
      const properties = [
        ...new Set(
          document
            .getAnimations()
            .flatMap((animation) =>
              animation.effect instanceof KeyframeEffect
                ? animation.effect
                    .getKeyframes()
                    .flatMap((frame) => Object.keys(frame))
                : [],
            ),
        ),
      ];
      let cls = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (
            !(entry as PerformanceEntry & { hadRecentInput: boolean })
              .hadRecentInput
          )
            cls += (entry as PerformanceEntry & { value: number }).value;
      });
      observer.observe({ type: "layout-shift" });
      const intervals: number[] = [];
      await new Promise<void>((resolve) => {
        let previous = 0,
          start = 0;
        const tick = (now: number) => {
          if (!start) start = now;
          if (previous) intervals.push(now - previous);
          previous = now;
          if (now - start < 2500) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      observer.disconnect();
      const sorted = intervals.slice().sort((a, b) => a - b);
      return {
        properties,
        cls,
        frames: intervals.length,
        fps:
          1000 / (intervals.reduce((sum, n) => sum + n, 0) / intervals.length),
        p95ms: sorted[Math.floor(sorted.length * 0.95)],
      };
    });
    expect(
      sample.properties.filter(
        (p) =>
          ![
            "transform",
            "opacity",
            "offset",
            "computedOffset",
            "easing",
            "composite",
          ].includes(p),
      ),
    ).toEqual([]);
    expect(sample.cls).toBe(0);
    expect(sample.fps).toBeGreaterThan(55);
    results.push({ cpu: rate, ...sample });
  }
  await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  writeFileSync(
    `${dir}/fluidez.json`,
    JSON.stringify(
      {
        entorno:
          "Chromium headless local; requestAnimationFrame, no certificación de dispositivos físicos",
        muestras: results,
      },
      null,
      2,
    ),
  );
});

test("avance por evento: relleno, destello único y porcentaje final", async ({
  page,
}) => {
  await login(page);
  const state = await (await page.request.get("/api/estado")).json();
  state.videos[0].stage = 8;
  await page.route("**/api/eventos", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `event: estado\ndata: ${JSON.stringify(state)}\n\n`,
    });
  });
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "8",
  );
  const ring = page
    .locator(".factory-pane .journey li")
    .nth(7)
    .locator(".stage-spark");
  await expect
    .poll(() => ring.evaluate((el) => Number(getComputedStyle(el).opacity)), {
      intervals: [20],
    })
    .toBeGreaterThan(0.01);
  await expect(page.locator(".factory-progress .sr-only")).toHaveText("67");
  await expect
    .poll(() => ring.evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBe(0);
});
