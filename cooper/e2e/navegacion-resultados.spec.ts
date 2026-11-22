import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

test("Resultados enlaza las secciones de Marcas y conserva el destino al recargar", async ({
  page,
}) => {
  test.setTimeout(120000);
  const fixture = `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}`;
  expect(
    (
      await page.request.post(`${fixture}/sesion`, {
        data: {
          email: "admin@example.test",
          secret: process.env.COOPER_E2E_SECRET,
        },
      })
    ).ok(),
  ).toBe(true);
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));
  await page.goto("/marcas");
  await page
    .getByRole("button", {
      name: /^(Añadir marca o cuenta|Crear mi primera marca)$/,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Nombre de la marca" })
    .fill("Marca para navegación");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Marca para navegación", exact: true }),
  ).toBeVisible();
  for (const ruta of ["publicados", "aprendizaje"] as const) {
    const etiqueta = ruta === "publicados" ? "Publicados" : "Aprendizaje";
    await page.goto(`/${ruta}`);
    await page
      .getByRole("link", { name: `${etiqueta} de marcas`, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/marcas\\?seccion=${ruta}$`));
    const pestana = page
      .getByRole("navigation", { name: "Secciones de la marca" })
      .getByRole("button", { name: etiqueta, exact: true });
    await expect(pestana).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(pestana).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", {
        name: ruta === "publicados" ? "Publicados" : "Aprendizaje de la marca",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", {
        name:
          ruta === "publicados"
            ? "Ver videos publicados"
            : "Ver aprendizaje de videos",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${ruta}$`));
    await expect(
      page.getByRole("heading", {
        name: ruta === "publicados" ? "La pared" : "Lo que aprendimos",
        exact: true,
      }),
    ).toBeVisible();
  }
  mkdirSync(".cache/total-sentinel/marcas", { recursive: true });
  const marcas = await (await page.request.get("/api/marcas")).json();
  const marca = marcas.marcas.find(
    (m: { nombre: string }) => m.nombre === "Marca para navegación",
  );
  await page.goto(`/marcas?marca=${marca.id}`);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [seccion, etiqueta] of [
      ["estudio", "Estudio"],
      ["competencia", "Competencia"],
      ["publicados", "Publicados"],
      ["aprendizaje", "Aprendizaje"],
      ["calendario", "Calendario"],
    ]) {
      const pestana = page
        .getByRole("navigation", { name: "Secciones de la marca" })
        .getByRole("button", { name: etiqueta, exact: true });
      await pestana.click();
      await expect
        .poll(() => new URL(page.url()).searchParams.get("seccion"))
        .toBe(seccion);
      await page.reload();
      await expect(pestana).toHaveAttribute("aria-current", "page");
      await expect(
        page.getByRole("heading", {
          name: "Marca para navegación",
          exact: true,
        }),
      ).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.cache/total-sentinel/marcas/${width}-${seccion}.png`,
        fullPage: true,
      });
    }
  }
  await page.goto("/marcas?seccion=no-admitida");
  await expect(
    page
      .getByRole("navigation", { name: "Secciones de la marca" })
      .getByRole("button", { name: "Calendario", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(errores).toEqual([]);
});
