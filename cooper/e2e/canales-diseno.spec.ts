import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("canales: la hoja conserva foco, errores y creación sin dejar la colección", async ({
  page,
}) => {
  const login = await page.request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT ?? "33172"}/sesion`,
    {
      data: {
        email: "admin@example.test",
        secret: process.env.COOPER_E2E_SECRET,
      },
    },
  );
  expect(login.ok()).toBe(true);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/canales");
  const abrir = page.getByRole("button", {
    name: /^(Nuevo canal|Dar nombre a mi canal)$/,
  });
  await abrir.focus();
  await abrir.press("Enter");
  const hoja = page.getByRole("dialog", { name: "Un nuevo canal" });
  await expect(hoja).toBeVisible();
  await expect(
    hoja.getByRole("textbox", { name: "Nombre del canal" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(hoja).not.toBeVisible();
  await expect(abrir).toBeFocused();
  await abrir.press("Enter");
  await hoja
    .getByRole("textbox", { name: "Nombre del canal" })
    .fill("Historias del barrio");
  await hoja
    .getByRole("textbox", { name: "¿De qué trata?" })
    .fill("Historias de las personas que dan vida a nuestro barrio.");
  await page.route(
    "**/api/orden",
    async (route) => {
      await route.fulfill({
        status: 503,
        json: { error: "No pudimos guardar el canal. Inténtalo de nuevo." },
      });
    },
    { times: 1 },
  );
  await hoja.getByRole("button", { name: "Crear canal", exact: true }).click();
  await expect(hoja.getByRole("alert")).toContainText(
    "No pudimos guardar el canal",
  );
  await expect(
    hoja.getByRole("textbox", { name: "Nombre del canal" }),
  ).toHaveValue("Historias del barrio");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await hoja.getByRole("button", { name: "Crear canal", exact: true }).click();
  await expect(hoja).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Historias del barrio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Canal creado" }),
  ).toBeVisible();
});
