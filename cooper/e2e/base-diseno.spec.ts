import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
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

async function capture(
  page: Page,
  screen: string,
  width: number,
  messages: string[],
  expectedBrowserDiagnostics: string[] = [],
): Promise<Evidence> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
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
  const file = `${screen}-${width}.png`;
  await page.screenshot({ path: `${directory}/${file}`, fullPage: true });
  const result = {
    screen,
    width,
    path: new URL(page.url()).pathname,
    file,
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
      await page.locator("main").waitFor({ state: "visible" });
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

for (const width of [390, 1440]) {
  test(`ruta, Cooper y navegación en movimiento a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const errors: string[] = [];
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
      document.startViewTransition = (...args: Parameters<typeof original>) => {
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
      page.locator("header").getByRole("button", { name: "Pausar movimiento" }),
    ).toHaveCount(0);
    await expect(page.locator(".pildora-conexion")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Abrir Cooper", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Mensaje para Cooper" }),
    ).toBeVisible();
    await page.waitForTimeout(700);
    const sheet = page.locator(".cooper-panel");
    if (width < 768) {
      expect((await sheet.boundingBox())!.height).toBeCloseTo(900 * 0.62, 0);
      const grip = page.locator(".cooper-drag");
      const start = (await grip.boundingBox())!;
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
    await page
      .getByRole("button", { name: "Cerrar Cooper", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Mensaje para Cooper" }),
    ).toHaveCount(0);
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
      await link.click();
      await expect(page).toHaveURL(
        new RegExp(`${path === "/" ? "/$" : path + "$"}`),
      );
      await page.waitForTimeout(700);
    }
    const target = page.locator(".video-mini").first();
    const href = await target.getAttribute("href");
    await target.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await page.waitForTimeout(800);
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
      `${directory}/transiciones-${width}.json`,
      JSON.stringify(transitions, null, 2) + "\n",
    );
    await page.goto("/");
    const client = await context.newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", {
      rate: width < 768 ? 4 : 1,
    });
    const metrics = await page.evaluate(async () => {
      let cls = 0;
      const longTasks: number[] = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "longtask") longTasks.push(entry.duration);
          else if (
            !(entry as PerformanceEntry & { hadRecentInput: boolean })
              .hadRecentInput
          )
            cls += (entry as PerformanceEntry & { value: number }).value;
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
        fps: 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length),
        p95: sorted[Math.floor(sorted.length * 0.95)],
        cls,
        longTasks,
      };
    });
    await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    writeFileSync(
      `${directory}/movimiento-${width}.json`,
      JSON.stringify(
        {
          viewport: width,
          cpu: width < 768 ? 4 : 1,
          metrics,
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
    expect(metrics.longTasks.filter((duration) => duration >= 100)).toEqual([]);
    expect(errors).toEqual([]);
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
    await page
      .getByRole("button", { name: "Añadir marca", exact: true })
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
      await capture(page, `marca-${section}`, width, messages);
    }
  }
});

test("cargas y errores recuperables conservan la interfaz en seis anchuras", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const diagnostics: unknown[] = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.goto("/radar");
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
      await capture(page, "operacion-cargando", width, []);
    } finally {
      release();
    }
    await expect(
      page.getByRole("button", { name: "Actualizar", exact: true }),
    ).toBeEnabled();
    const errors: string[] = [];
    const listener = (message: import("@playwright/test").ConsoleMessage) => {
      if (["error", "warning"].includes(message.type()))
        errors.push(message.text());
    };
    page.on("console", listener);
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
    await expect(page.getByRole("alert")).toContainText(
      "La fábrica no responde",
    );
    page.off("console", listener);
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
    await page.getByRole("button", { name: "Actualizar", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  writeFileSync(
    `${directory}/errores-provocados.json`,
    JSON.stringify(diagnostics, null, 2) + "\n",
  );
});

for (const width of [390, 1440]) {
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
    await page.route("https://cooper-media.example.test/ensayo.mp4", (route) =>
      route.fulfill({ status: 200, contentType: "video/mp4", body: clip }),
    );
    await page.route("https://cooper-media.example.test/ensayo.png", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: poster }),
    );
    const state: Estado = await (await page.request.get("/api/estado")).json();
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
    await expect(media).toHaveAttribute("data-preview", "off");
    await media.hover();
    await expect(media).toHaveAttribute("data-preview", "on");
    const player = media.locator("video");
    expect(
      await player.evaluate((element) => (element as HTMLVideoElement).muted),
    ).toBe(true);
    await expect
      .poll(() =>
        player.evaluate((element) => (element as HTMLVideoElement).currentTime),
      )
      .toBeGreaterThan(0.05);
    await capture(page, "medio-vista-previa-fixture", width, errors);
    await page.mouse.move(0, 0);
    await expect(media).toHaveAttribute("data-preview", "off");
    expect(
      await player.evaluate((element) => (element as HTMLVideoElement).paused),
    ).toBe(true);
    const counter = page.locator(".home-overview .cifra").first();
    const before = await counter.boundingBox();
    const originalCount = state.videos.filter(
      (video) => video.ownerId === state.user.id && video.stage < 11,
    ).length;
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
    await media.hover();
    await page.waitForTimeout(400);
    await expect(media).toHaveAttribute("data-preview", "off");
    expect(
      await player.evaluate((element) => (element as HTMLVideoElement).paused),
    ).toBe(true);
    await capture(page, "medio-reducido-fixture", width, errors);
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
    await capture(page, "cifra-minigrafica", width, errors);
    expect(errors).toEqual([]);
  });
}
