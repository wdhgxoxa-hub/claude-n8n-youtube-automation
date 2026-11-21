import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
test("reutiliza montaje aprobado, reproduce MP4 y exige nueva revisión si cambia la fábrica", async ({
  page,
}) => {
  const fixture = `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`;
  const session = {
    email: "admin@example.test",
    secret: process.env.COOPER_E2E_SECRET,
  };
  expect(
    (
      await page.request.post(fixture, {
        data: { ...session, montaje: "crear" },
      })
    ).ok(),
  ).toBe(true);
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.goto("/marcas");
  await page.getByRole("button", { name: "Añadir marca o cuenta" }).click();
  await page
    .getByLabel("Nombre de la marca", { exact: true })
    .fill("Marca de montajes");
  await page
    .getByRole("combobox", { name: "Rubro", exact: true })
    .selectOption("general");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Marca de montajes", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Nombre de la cuenta", { exact: true })
    .fill("Montajes ficticios");
  await page
    .getByLabel("Identificador de cuenta o perfil", { exact: true })
    .fill("7777777777");
  await page
    .getByLabel("Página vinculada (para Instagram)", { exact: true })
    .fill("8888888888");
  await page
    .getByRole("button", { name: "Añadir cuenta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Verificar conexión", exact: true })
    .click();
  await expect(
    page.getByText("Conexión verificada.", { exact: true }),
  ).toBeVisible();
  const source = page.getByRole("combobox", {
    name: "Montaje aprobado de fábrica",
    exact: true,
  });
  const value = await source
    .locator("option")
    .filter({ hasText: "Montaje sintético aprobado" })
    .getAttribute("value");
  await source.selectOption(value!);
  await expect(
    page.getByLabel("Subir foto o video (hasta 5 MB)"),
  ).toBeDisabled();
  await page
    .getByLabel("Título de la pieza", { exact: true })
    .fill("Reutilización comprobada");
  await page
    .getByLabel("Texto de la publicación", { exact: true })
    .fill("Un montaje aprobado sin volver a subirlo.");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Preparar vista previa y enviar a Walter",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Pieza lista para la revisión de Walter.", { exact: true }),
  ).toBeVisible();
  await page.getByText("Vista previa de la pieza", { exact: true }).click();
  const video = page.locator(".marca-pieza video");
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  await video.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
  mkdirSync(".cache/total-m05", { recursive: true });
  for (const width of [390, 1440])
    for (const theme of ["claro", "oscuro"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: `.cache/total-m05/montaje-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  await page
    .getByRole("button", { name: "Aprobar y programar", exact: true })
    .click();
  await expect(page.getByText(/reel · programada · Revisión 1/)).toBeVisible();
  const src = await video.getAttribute("src");
  expect((await page.request.get(src!)).status()).toBe(200);
  expect(
    (
      await page.request.post(fixture, {
        data: { ...session, montaje: "cambiar" },
      })
    ).ok(),
  ).toBe(true);
  expect((await page.request.get(src!)).status()).toBe(409);
  await page.getByRole("button", { name: "Editar pieza", exact: true }).click();
  await page
    .getByRole("button", { name: "Actualizar montajes desde fábrica" })
    .click();
  await expect(
    page.getByText(
      "Montajes actualizados. Selecciona la revisión que vas a usar.",
      { exact: true },
    ),
  ).toBeVisible();
  const next = await source
    .locator("option")
    .filter({ hasText: "Montaje sintético aprobado" })
    .getAttribute("value");
  expect(next).not.toBe(value);
  await source.selectOption(next!);
  await page
    .getByRole("button", { name: "Guardar nueva revisión", exact: true })
    .click();
  await expect(page.getByText(/reel · borrador · Revisión 2/)).toBeVisible();
  expect(errores).toEqual([]);
});
