import { expect, type Page } from "@playwright/test";

export async function abrirCooper(page: Page) {
  const panel = page.getByRole("dialog", {
    name: "Cooper, tu compañero",
    exact: true,
  });
  if (!(await panel.isVisible())) {
    await page
      .getByRole("button", { name: "Abrir Cooper", exact: true })
      .click();
  }
  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole("textbox", { name: "Mensaje para Cooper", exact: true }),
  ).toBeVisible();
  return panel;
}

export async function cerrarCooper(page: Page) {
  const panel = page.getByRole("dialog", {
    name: "Cooper, tu compañero",
    exact: true,
  });
  if (await panel.isVisible()) {
    await panel
      .getByRole("button", { name: "Cerrar Cooper", exact: true })
      .click();
    await expect(panel).toBeHidden();
  }
}

export async function abrirMasDestinos(page: Page) {
  await cerrarCooper(page);
  await page
    .getByRole("button", { name: "Más destinos", exact: true })
    .filter({ visible: true })
    .click();
  const menu = page.getByRole("dialog", { name: "Más destinos", exact: true });
  await expect(menu).toBeVisible();
  return menu;
}
