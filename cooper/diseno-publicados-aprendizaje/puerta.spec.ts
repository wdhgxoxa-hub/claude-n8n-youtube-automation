import {
  test,
  expect,
  request,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import type { Estado } from "../src/servicios/datos";
import type { Resultados } from "../src/contratos/resultados";
import { capture, evidenceDir, startSample, stopSample } from "./auditoria";

let cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
const widths = [360, 390, 768, 1024, 1440, 1920];

test.beforeAll(async ({ baseURL }) => {
  mkdirSync(evidenceDir, { recursive: true });
  // Este cliente queda fuera de las trazas: ninguna credencial ni cookie se
  // guarda en archivos, capturas o informes del ensayo.
  const session = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Referer: baseURL! },
  });
  expect(
    (
      await session.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
        {
          data: {
            email: "admin@example.test",
            secret: process.env.COOPER_E2E_SECRET,
          },
        },
      )
    ).ok(),
  ).toBe(true);
  const state: Estado = await (await session.get("/api/estado")).json();
  const matches: string[] = [];
  // Solo bases temporales de este worktree y solo la columna ID de la cuenta
  // recién creada. No se consultan bases del usuario, archivos .env ni secretos.
  for (const directory of readdirSync(".cache", { withFileTypes: true })) {
    if (!directory.isDirectory() || !directory.name.startsWith("e2e-"))
      continue;
    const path = resolve(".cache", directory.name, "cooper.sqlite");
    if (!existsSync(path)) continue;
    const db = new Database(path, { readonly: true });
    try {
      if (db.prepare("SELECT id FROM users WHERE id = ?").get(state.user.id))
        matches.push(path);
    } finally {
      db.close();
    }
  }
  expect(
    matches,
    "Una sola base de ensayo corresponde a la sesión",
  ).toHaveLength(1);
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "diseno-publicados-aprendizaje/preparar-fixture.mts",
      matches[0],
      state.user.id,
    ],
    { stdio: "pipe", timeout: 120000 },
  );
  const results: Resultados = await (
    await session.get("/api/resultados")
  ).json();
  expect(results.publicaciones).toHaveLength(12);
  expect(results.aprendizajes).toHaveLength(3);
  expect(
    results.publicaciones.every(
      (p) =>
        p.tipo === "video" &&
        p.medios?.poster?.origen === "render" &&
        p.medios.preview,
    ),
  ).toBe(true);
  const poster = results.publicaciones[0];
  if (poster.tipo !== "video") throw new Error("Fixture inválido");
  expect((await session.get(poster.medios!.poster!.url)).ok()).toBe(true);
  const anonymous = await request.newContext({ baseURL });
  expect((await anonymous.get(poster.medios!.poster!.url)).status()).toBe(401);
  await anonymous.dispose();
  cookies = (await session.storageState()).cookies;
  await session.dispose();
});

test.beforeEach(async ({ context }) => {
  await context.addCookies(cookies);
});

function errors(page: Page) {
  const found: string[] = [];
  page.on("pageerror", (e) => found.push(e.message));
  page.on("console", (m) => {
    if (["warning", "error"].includes(m.type())) found.push(m.text());
  });
  return found;
}

async function ready(page: Page, route: "publicados" | "aprendizaje") {
  await page.goto(`/${route}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: route === "publicados" ? "La pared" : "Lo que aprendimos",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator("main img").first()).toHaveJSProperty(
    "complete",
    true,
  );
}

for (const width of widths)
  test(`pantallas y hojas a ${width}px`, async ({ page }) => {
    const consoleErrors = errors(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page, "publicados");
    await expect(page.locator(".publication")).toHaveCount(12);
    await expect(page.locator(".publication").first()).toContainText(
      "El margen empieza después de pagar las cuentas",
    );
    await expect(page.getByLabel("Cifras del periodo")).toBeVisible();
    await expect(page.locator("main select")).toHaveCount(0);
    await expect(page.locator("main input[type=date]:visible")).toHaveCount(0);
    await capture(page, "publicados", width, consoleErrors);
    await page.getByRole("button", { name: "Filtros", exact: true }).click();
    await capture(page, "publicados-filtros", width, consoleErrors);
    await page
      .getByRole("button", { name: "Todo el periodo", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Elegir periodo", exact: true }),
    ).toBeVisible();
    await capture(page, "publicados-periodo", width, consoleErrors);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: /^Ver cifras de / })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture(page, "publicados-cifras", width, consoleErrors);
    await page.keyboard.press("Escape");
    await ready(page, "aprendizaje");
    await expect(page.getByRole("switch", { name: /Medición/ })).toBeEnabled();
    await expect(
      page.getByLabel("Línea de tiempo del aprendizaje").locator(".lesson"),
    ).toHaveCount(3);
    await expect(
      page.locator(".lesson").first().locator(".cifra-valor").nth(0),
    ).toHaveText("36");
    await expect(
      page.locator(".lesson").first().locator(".cifra-valor").nth(1),
    ).toHaveText("58");
    await capture(page, "aprendizaje", width, consoleErrors);
    expect(consoleErrors).toEqual([]);
  });

for (const width of [390, 1440])
  test(`teclado, filtros, medición y movimiento reducido a ${width}px`, async ({
    page,
  }) => {
    const consoleErrors = errors(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page, "publicados");
    await page
      .getByRole("button", { name: "Mejor rendimiento", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Más recientes", exact: true }),
    ).toBeFocused();
    await expect(page.locator(".publication").first()).toContainText(
      "El precio cambia; la cuenta tiene que cerrar",
    );
    await page
      .getByRole("button", { name: "Todo el periodo", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog", {
      name: "Elegir periodo",
      exact: true,
    });
    await sheet.getByLabel("Desde (Lima)", { exact: true }).fill("2026-11-18");
    await sheet
      .getByRole("button", { name: "Ver resultados", exact: true })
      .click();
    await expect(page.locator(".publication")).toHaveCount(2);
    await capture(page, "publicados-periodo-aplicado", width, consoleErrors);
    const media = page.locator(".publication-thumb .medio").first();
    await media.hover();
    await expect(media).toHaveAttribute("data-preview", "off");
    await page.waitForTimeout(300);
    await expect(media.locator("video")).toHaveJSProperty("paused", true);
    await ready(page, "aprendizaje");
    const control = page.getByRole("switch", { name: /Medición/ });
    const initial = await control.isChecked();
    await control.focus();
    await page.keyboard.press("Space");
    await expect(control).toBeChecked({ checked: !initial });
    await page.reload();
    await expect(control).toBeChecked({ checked: !initial });
    await capture(page, "aprendizaje-medicion-cambiada", width, consoleErrors);
    await control.click();
    await expect(control).toBeChecked({ checked: initial });
    await page
      .getByRole("button", { name: "Abrir Cooper", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("textbox", { name: "Mensaje para Cooper" }),
    ).toBeVisible();
    await capture(page, "aprendizaje-cooper", width, consoleErrors);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Abrir Cooper", exact: true }),
    ).toBeFocused();
    expect(consoleErrors).toEqual([]);
  });

for (const width of [390, 1440])
  test(`recorrido grabado de interacciones a ${width}px`, async ({ page }) => {
    const consoleErrors = errors(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/publicados");
    await expect(
      page.getByRole("heading", { name: "La pared", exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(1000);
    const media = page.locator(".publication-thumb .medio").first();
    await media.hover();
    await expect(media).toHaveAttribute("data-preview", "on");
    await expect
      .poll(() =>
        media
          .locator("video")
          .evaluate((v) => (v as HTMLVideoElement).currentTime),
      )
      .toBeGreaterThan(0.1);
    await page.waitForTimeout(1000);
    await page.mouse.move(0, 0);
    await expect(media).toHaveAttribute("data-preview", "off");
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
    await page
      .locator('a[href="/aprendizaje"]')
      .filter({ visible: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Lo que aprendimos", exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(1000);
    if (width < 768) {
      const links = page.locator(".bottom-nav a");
      expect(await links.count()).toBeGreaterThanOrEqual(4);
      for (const link of await links.all())
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      await page
        .getByRole("button", { name: "Más destinos", exact: true })
        .filter({ visible: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Más destinos", exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(700);
      await page.keyboard.press("Escape");
    }
    expect(consoleErrors).toEqual([]);
  });

test.describe("medición sin grabación", () => {
  for (const width of [390, 1440])
    test(`fluidez y CLS a ${width}px`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", {
        rate: width < 768 ? 4 : 1,
      });
      await page.goto("/publicados");
      await expect(page.locator(".publication")).toHaveCount(12);
      await page.waitForTimeout(1000);
      await cdp.send("Tracing.start", {
        categories:
          "devtools.timeline,loading,blink.user_timing,disabled-by-default-devtools.timeline.frame",
        transferMode: "ReturnAsStream",
      });
      await startSample(page);
      await page.locator(".publication-thumb .medio").first().hover();
      await page.waitForTimeout(1500);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(700);
      const sample = await stopSample(page);
      const completed = new Promise<string>((accept) =>
        cdp.once("Tracing.tracingComplete", (event) => accept(event.stream!)),
      );
      await cdp.send("Tracing.end");
      const handle = await completed;
      const traceChunks: string[] = [];
      for (;;) {
        const chunk = await cdp.send("IO.read", { handle });
        traceChunks.push(
          chunk.base64Encoded
            ? Buffer.from(chunk.data, "base64").toString("utf8")
            : chunk.data,
        );
        if (chunk.eof) break;
      }
      await cdp.send("IO.close", { handle });
      writeFileSync(
        `${evidenceDir}/traza-movimiento-${width}.json`,
        traceChunks.join(""),
      );
      writeFileSync(
        `${evidenceDir}/movimiento-${width}.json`,
        JSON.stringify(
          {
            ...sample,
            cpu: width < 768 ? 4 : 1,
            grabacion: false,
            alcance:
              "Hover del medio real con armazón visible en Chromium de laboratorio; no representa teléfono físico.",
          },
          null,
          2,
        ) + "\n",
      );
      expect(sample.fps).toBeGreaterThanOrEqual(57);
      expect(sample.p95).toBeLessThanOrEqual(25);
      expect(sample.cls).toBeLessThanOrEqual(0.01);
    });
});

for (const width of widths)
  test(`vacío, carga y recuperación explícitos a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const consoleErrors = errors(page);
    for (const screen of ["publicados", "aprendizaje"] as const) {
      await ready(page, screen);
      let pending: Route | undefined;
      await page.route("**/api/resultados", (route) => {
        pending = route;
      });
      await page
        .getByRole("button", { name: "Actualizar resultados", exact: true })
        .click();
      await expect.poll(() => Boolean(pending)).toBe(true);
      await expect(
        page.getByRole("button", {
          name: "Actualizar resultados",
          exact: true,
        }),
      ).toBeDisabled();
      await capture(page, `${screen}-actualizando`, width, consoleErrors);
      await pending!.fulfill({
        status: 503,
        json: {
          error: "No pudimos actualizar las cifras. Inténtalo de nuevo.",
        },
      });
      await expect(page.getByRole("alert")).toContainText(
        "No pudimos actualizar",
      );
      const expectedDiagnostics = consoleErrors.filter((m) =>
        /Failed to load resource.*503/.test(m),
      );
      const unexpected = consoleErrors.filter(
        (m) => !expectedDiagnostics.includes(m),
      );
      writeFileSync(
        `${evidenceDir}/${screen}-error-provocado-${width}.json`,
        JSON.stringify(
          {
            escenario:
              "503 deliberado solo en esta prueba; el camino feliz no intercepta APIs",
            expectedDiagnostics,
            unexpected,
          },
          null,
          2,
        ) + "\n",
      );
      await capture(page, `${screen}-error`, width, unexpected);
      consoleErrors.splice(0, consoleErrors.length, ...unexpected);
      await page.unroute("**/api/resultados");
      await page
        .getByRole("button", { name: "Actualizar resultados", exact: true })
        .click();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(
        page.locator(screen === "publicados" ? ".publication" : ".lesson"),
      ).toHaveCount(screen === "publicados" ? 12 : 3);
      await page.route("**/api/resultados", (route) =>
        route.fulfill({
          json: {
            ambitos: [],
            publicaciones: [],
            aprendizajes: [],
            incidencias: [],
          },
        }),
      );
      await page
        .getByRole("button", { name: "Actualizar resultados", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name:
            screen === "publicados"
              ? "Tu próxima historia puede abrir esta pared"
              : "El próximo puede empezar mejor.",
        }),
      ).toBeVisible();
      await capture(page, `${screen}-vacio`, width, consoleErrors);
      await page.unroute("**/api/resultados");
    }
    expect(consoleErrors).toEqual([]);
  });

test.afterEach(async ({ page }, info) => {
  const video = page.video();
  await page.close();
  if (video)
    await video.saveAs(
      `${evidenceDir}/${info.title.replace(/[^a-zA-Z0-9áéíóúñ]+/g, "-")}.webm`,
    );
});
