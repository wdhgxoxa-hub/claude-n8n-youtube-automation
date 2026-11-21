import { test, expect } from "@playwright/test";

test("Resultados enlaza las secciones de Marcas y conserva el destino al recargar", async ({
  page,
}) => {
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
  await page.getByRole("button", { name: "Añadir marca o cuenta" }).click();
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
      page.getByRole("heading", { name: etiqueta, exact: true }),
    ).toBeVisible();
  }
  await page.goto("/marcas?seccion=no-admitida");
  await expect(
    page
      .getByRole("navigation", { name: "Secciones de la marca" })
      .getByRole("button", { name: "Calendario", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(errores).toEqual([]);
});
