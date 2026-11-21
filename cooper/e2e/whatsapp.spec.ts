import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

test("WhatsApp: verificar número, elegir avisos, revocar al cambiar y revisar accesibilidad", async ({
  page,
}) => {
  const token =
    "00000000-0000-4000-8000-000000000000.1795176000000." + "a".repeat(43);
  await page.goto(`/revisar/whatsapp/${token}`);
  await expect(page).toHaveURL(
    new RegExp(`/entrar\\?revision=${token.replaceAll(".", "\\.")}`),
  );
  const fixtureUrl = `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`;
  expect(
    (
      await page.request.post(fixtureUrl, {
        data: {
          email: "admin@example.test",
          secret: process.env.COOPER_E2E_SECRET,
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post("/api/admin/permitidos", {
        data: { email: "whatsapp@example.test" },
      })
    ).status(),
  ).toBe(200);
  const session = await page.request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
    {
      data: {
        email: "whatsapp@example.test",
        secret: process.env.COOPER_E2E_SECRET,
      },
    },
  );
  expect(session.status()).toBe(200);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/perfil");
  await page.getByRole("textbox", { name: /^WhatsApp/ }).fill("+51955555555");
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(page.getByText("Tu perfil está actualizado.")).toBeVisible();
  const section = page.getByRole("region", { name: "Tus avisos por WhatsApp" });
  await expect(
    section.getByText("Modo simulado:", { exact: false }),
  ).toBeVisible();
  await section.getByRole("checkbox").check();
  await section.getByRole("button", { name: "Enviar código" }).click();
  const code = await section
    .getByTestId("whatsapp-codigo-simulado")
    .innerText();
  await section
    .getByRole("textbox", { name: "Código de verificación" })
    .fill(code === "000000" ? "111111" : "000000");
  await section.getByRole("button", { name: "Verificar número" }).click();
  await expect(
    section.getByText("El código no es válido", { exact: false }),
  ).toBeVisible();
  await section
    .getByRole("textbox", { name: "Código de verificación" })
    .fill(code);
  await section.getByRole("button", { name: "Verificar número" }).click();
  await expect(
    section.getByText("Número verificado: +51955555555"),
  ).toBeVisible();
  await section
    .getByRole("checkbox", { name: "Guion listo para aprobar", exact: true })
    .check();
  await section
    .getByRole("checkbox", { name: "Video publicado", exact: true })
    .check();
  await expect(section.getByText("Alerta de gasto diario")).toHaveCount(0);
  await section.getByRole("button", { name: "Guardar avisos" }).click();
  await expect(
    section.getByText("Tus avisos están actualizados."),
  ).toBeVisible();
  await page.reload();
  await expect(
    section.getByRole("checkbox", {
      name: "Guion listo para aprobar",
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    section.getByRole("checkbox", {
      name: "Video listo para la aprobación final",
      exact: true,
    }),
  ).not.toBeChecked();
  mkdirSync(".cache/capturas-whatsapp", { recursive: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("heading", { name: "A tu manera" }).click();
    await page.screenshot({
      path: `.cache/capturas-whatsapp/perfil-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("textbox", { name: /^WhatsApp/ }).fill("+51966666666");
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(
    section.getByText("Número pendiente de verificar: +51966666666"),
  ).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Guardar avisos" }),
  ).toHaveCount(0);
  expect((await page.request.get("/api/whatsapp/resumen")).status()).toBe(403);
});
