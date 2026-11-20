import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
const dir = ".cache/capturas-diseno";
async function ready(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.locator(".connection")).toHaveText("En vivo");
  await expect(page.locator(".demo-label")).toHaveText("Demostración");
}
async function overflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test.beforeEach(async ({ page }) => {
  expect(
    (
      await page.request.post("/api/prueba", {
        data: {
          email: "admin@example.test",
          secret: process.env.COOPER_E2E_SECRET,
        },
      })
    ).status(),
  ).toBe(200);
});
test("demostración: siete pantallas, dos tamaños y fábrica seleccionable", async ({
  page,
}) => {
  test.setTimeout(120000);
  mkdirSync(dir, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const state = await (await page.request.get("/api/estado")).json();
  expect(state.demo).toBe(true);
  expect(state.channels).toHaveLength(2);
  expect(state.videos.map((v: { stage: number }) => v.stage)).toEqual([
    7, 3, 9, 11,
  ]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const [name, path] of [
      ["inicio", "/"],
      ["canales", "/canales"],
      ["videos", "/videos"],
      ["detalle-video", `/videos/${state.videos[0].id}`],
      ["avatares", "/avatares"],
      ["perfil", "/perfil"],
      ["admin", "/admin"],
    ]) {
      await ready(page, path);
      await overflow(page);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(result.violations, `${name} ${width}`).toEqual([]);
      await page.screenshot({
        path: `${dir}/${name}-${width}.png`,
        fullPage: true,
      });
    }
    await ready(page);
    if (width === 390) await page.getByRole("tab", { name: /Fábrica/ }).click();
    await expect(page.locator(".factory-pane .journey li")).toHaveCount(12);
    await page
      .getByRole("button", { name: "Ver recorrido: ¿A qué huele la lluvia?" })
      .click();
    await expect(page.locator(".factory-pane li.current")).toContainText(
      "Aprobación de guion",
    );
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    await page
      .getByRole("button", {
        name: "Ver recorrido: Por qué el cielo cambia de color",
      })
      .click();
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "12",
    );
    await page
      .getByRole("button", { name: "Ver recorrido: El mar también respira" })
      .click();
    await page.screenshot({
      path: `${dir}/fabrica-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
test("movimiento opcional, teclado y retícula en seis anchuras", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Pausar movimiento" }).click();
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  // Detener también las animaciones SVG que ya estaban en marcha.
  const face = page.getByRole("img", { name: "Cooper reposo" }).first();
  await expect
    .poll(async () => face.locator("g").first().getAttribute("style"))
    .not.toContain("scaleY(0.");
  const before = await face.evaluate((el) =>
    Array.from(el.querySelectorAll("g,path")).map((n) => [
      n.getAttribute("style"),
      n.getAttribute("d"),
    ]),
  );
  await page.waitForTimeout(250);
  expect(
    await face.evaluate((el) =>
      Array.from(el.querySelectorAll("g,path")).map((n) => [
        n.getAttribute("style"),
        n.getAttribute("d"),
      ]),
    ),
  ).toEqual(before);

  await page.getByRole("button", { name: "Activar movimiento" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await overflow(page);
    if (width < 768) await page.getByRole("tab", { name: /Fábrica/ }).click();
    await overflow(page);
  }
  expect(
    await page
      .locator(".stage-node")
      .first()
      .evaluate((el) => getComputedStyle(el, "::after").animationName),
  ).toBe("none");
  await page
    .getByRole("button", { name: "Ver recorrido: ¿A qué huele la lluvia?" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".factory-pane li.current")).toContainText(
    "Aprobación de guion",
  );
  await page.locator(".factory-link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "¿A qué huele la lluvia?",
  );
});
