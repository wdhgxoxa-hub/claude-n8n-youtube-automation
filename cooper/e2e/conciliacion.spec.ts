import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
test("conciliación administrativa: consulta, evidencia, cierre durable y acceso aislado", async ({
  page,
}) => {
  const fixture = `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`;
  expect(
    (
      await page.request.post(fixture, {
        data: {
          email: "admin@example.test",
          secret: process.env.COOPER_E2E_SECRET,
          escenario: "conciliacion",
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/admin");
  await page
    .getByRole("button", { name: "Consultar operaciones interrumpidas" })
    .click();
  await page
    .getByRole("button", { name: "Revisar operación e2e-conciliacion" })
    .click();
  await page.getByRole("button", { name: "Guardar conciliación" }).click();
  await expect(
    page.getByRole("button", { name: "Guardar conciliación" }),
  ).toBeEnabled();
  await page
    .getByRole("combobox", { name: "Decisión de conciliación", exact: true })
    .selectOption("archivar");
  await page
    .getByLabel("Referencia de evidencia")
    .fill("informe-e2e-sin-resultado");
  await page.getByRole("checkbox", { name: /He cotejado operación/ }).check();
  mkdirSync(".cache/conciliacion-visual", { recursive: true });
  for (const tema of ["oscuro"])
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator("html")).toHaveAttribute("data-theme", tema);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: `.cache/conciliacion-visual/${tema}-${width}.png`,
        fullPage: true,
      });
    }
  await page.getByRole("button", { name: "Guardar conciliación" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cierre registrado:" }),
  ).toContainText("cerrada_sin_reenvio");
  await page.reload();
  await page
    .getByRole("button", { name: "Consultar operaciones interrumpidas" })
    .click();
  await page
    .getByLabel("Identificador de operación", { exact: true })
    .fill("e2e-conciliacion");
  await page.getByRole("button", { name: "Buscar operación por ID" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cierre registrado:" }),
  ).toContainText("informe-e2e-sin-resultado");
  const origin = new URL(page.url()).origin;
  expect(
    (
      await page.request.post("/api/admin/permitidos", {
        headers: { origin },
        data: { email: "conciliacion@example.test" },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post(fixture, {
        data: {
          email: "conciliacion@example.test",
          secret: process.env.COOPER_E2E_SECRET,
        },
      })
    ).ok(),
  ).toBe(true);
  expect((await page.request.get("/api/admin/conciliacion")).status()).toBe(
    403,
  );
});
