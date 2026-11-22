import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";

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
      manifest.push(await capture(page, screen.name, width, messages));
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
