import { abrirCooper } from "./ayudas-diseno";
import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";

test("contraste de campos, ayudas y foco visible en el tema oscuro", async ({
  page,
}) => {
  expect(
    (
      await page.request.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT ?? "33172"}/sesion`,
        {
          data: {
            email: "admin@example.test",
            secret: process.env.COOPER_E2E_SECRET,
          },
        },
      )
    ).ok(),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/perfil");
  await expect(page).toHaveTitle("Tu perfil · Cooper");
  await expect(page.locator(".workspace")).toBeVisible();
  const muestras = [];
  for (const theme of ["oscuro"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    const contrast = await page
      .locator('input[name="whatsapp"]:visible')
      .evaluate((input) => {
        const rgb = (value: string) =>
          value
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number);
        const luminance = (color: number[]) =>
          color
            .map((v) => {
              const n = v / 255;
              return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (a: number[], b: number[]) => {
          const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
          return (values[1] + 0.05) / (values[0] + 0.05);
        };
        const field = getComputedStyle(input);
        const placeholder = getComputedStyle(input, "::placeholder");
        const background = rgb(field.backgroundColor);
        const opacity = Number(placeholder.opacity);
        const text = rgb(placeholder.color).map(
          (v, i) => v * opacity + background[i] * (1 - opacity),
        );
        return {
          border: ratio(rgb(field.borderColor), background),
          placeholder: ratio(text, background),
        };
      });
    muestras.push({ tema: theme, ...contrast });
    expect.soft(contrast.border, `borde ${theme}`).toBeGreaterThanOrEqual(3);
    expect
      .soft(contrast.placeholder, `ayuda ${theme}`)
      .toBeGreaterThanOrEqual(4.5);
  }
  writeFileSync(
    ".cache/accesibilidad-contraste.json",
    JSON.stringify(muestras, null, 2) + "\n",
  );
  await page.goto("/");
  await expect(page).toHaveTitle("Inicio · Cooper");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Saltar al contenido" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  expect
    .soft(
      await page
        .locator("main")
        .evaluate((el) => getComputedStyle(el).outlineStyle),
    )
    .toBe("solid");
  await abrirCooper(page);
  const composer = page.getByRole("textbox", { name: "Mensaje para Cooper" });
  await composer.focus();
  expect
    .soft(await composer.evaluate((el) => getComputedStyle(el).outlineStyle))
    .toBe("solid");
});
