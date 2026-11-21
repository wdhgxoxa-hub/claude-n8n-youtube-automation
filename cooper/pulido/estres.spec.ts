import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
const fixture = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT ?? "33173"}`;
test.beforeEach(async ({ page }) => {
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
  await page.goto("/");
  await expect(page.locator(".connection")).toHaveText("En vivo");
});
test("chat: ráfaga de envíos, texto de 6000 caracteres, foto, rechazo recuperable y red", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const counts: number[] = [];
  for (let i = 0; i < 12; i++) {
    const before = await (await page.request.get("/api/estado")).json();
    const text =
      i === 0 ? "x".repeat(6000) : `Hola Cooper, ensayo de ráfaga ${i}`;
    await page.getByLabel("Mensaje para Cooper").fill(text);
    await page
      .getByRole("region", { name: "Chat con Cooper" })
      .locator("form.composer")
      .evaluate((f) => {
        for (let j = 0; j < 5; j++) (f as HTMLFormElement).requestSubmit();
      });
    await expect(page.getByLabel("Mensaje para Cooper")).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Cancelar espera" }),
    ).toHaveCount(0);
    const after = await (await page.request.get("/api/estado")).json();
    const added = after.messages.filter(
      (m: { id: string; role: string }) =>
        m.role === "user" &&
        !before.messages.some((p: { id: string }) => p.id === m.id),
    );
    counts.push(added.length);
    expect(added).toHaveLength(1);
  }
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=",
    "base64",
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "ensayo.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(page.getByAltText("Vista previa de ensayo.png")).toBeVisible();
  await page
    .getByLabel("Mensaje para Cooper")
    .fill("Esta foto es una referencia para el video");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.getByLabel("Mensaje para Cooper")).toHaveValue("");
  await context.setOffline(true);
  await expect(page.locator(".connection")).toHaveText("Reconectando");
  await page
    .getByLabel("Mensaje para Cooper")
    .fill("Un mensaje durante el corte");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.locator(".notice[role=alert]:visible")).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator(".connection")).toHaveText("En vivo", {
    timeout: 45000,
  });
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.getByLabel("Mensaje para Cooper")).toHaveValue("");
  expect(errors).toEqual([]);
  const dir = `.cache/capturas-pulido/${process.env.COOPER_PULIDO_RONDA || "diagnostico"}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/rafagas.json`,
    JSON.stringify(
      {
        intentos: 60,
        mensajesAceptados: counts.reduce((a, b) => a + b, 0),
        longitudMaxima: 6000,
        foto: true,
        recuperacionRed: true,
      },
      null,
      2,
    ),
  );
});
test("formularios: doble envío crea un solo canal, cancelación de chat lento y recuperación", async ({
  page,
}) => {
  await page.goto("/canales");
  const title = `Ensayo ${Date.now()}`;
  await page.getByRole("textbox", { name: "Nombre del canal" }).fill(title);
  await page
    .getByRole("textbox", { name: "¿De qué trata?" })
    .fill("Datos ficticios");
  await page.locator("#nuevo-canal form").evaluate((f) => {
    for (let j = 0; j < 5; j++) (f as HTMLFormElement).requestSubmit();
  });
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(1);
  const data = await (await page.request.get("/api/estado")).json();
  expect(
    data.channels.filter((c: { name: string }) => c.name === title),
  ).toHaveLength(1);
  await page.goto("/");
  await page.route("**/api/chat", async (route) => {
    await new Promise((r) => setTimeout(r, 16000));
    await route
      .fulfill({
        status: 503,
        json: { error: "La fábrica no responde. Inténtalo de nuevo." },
      })
      .catch(() => {});
  });
  await page.getByLabel("Mensaje para Cooper").fill("Hola");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await page.getByRole("button", { name: "Cancelar espera" }).click();
  await expect(page.locator(".notice[role=alert]:visible")).toContainText(
    "Cancelaste",
  );
  await page.unroute("**/api/chat");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.getByLabel("Mensaje para Cooper")).toHaveValue("");
});

test("audio ficticio repetido, descarga privada y fábrica temporalmente caída", async ({
  page,
}) => {
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Grabar audio", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Detener grabación" }),
    ).toBeVisible();
    await page.waitForTimeout(550);
    await page.getByRole("button", { name: "Detener grabación" }).click();
    await expect(page.getByLabel("Mensaje para Cooper")).toHaveValue(
      /Quiero un nuevo video/,
    );
    await page
      .getByLabel("Mensaje para Cooper")
      .fill("Audio de ensayo recibido");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByLabel("Mensaje para Cooper")).toHaveValue("");
  }
  const descarga = page.getByRole("link", { name: "Adjunto 1" }).last();
  const href = await descarga.getAttribute("href");
  expect(href).toMatch(/^\/api\/archivos\//);
  expect((await page.request.get(href!)).ok()).toBe(true);
  await page.route("**/api/orden", (r) =>
    r.fulfill({
      status: 503,
      json: { error: "La fábrica no respondió. Vuelve a intentarlo." },
    }),
  );
  await page.goto("/canales");
  await page
    .getByRole("textbox", { name: "Nombre del canal" })
    .fill("Recuperación");
  await page
    .getByRole("textbox", { name: "¿De qué trata?" })
    .fill("Ensayo de caída");
  await page.getByRole("button", { name: "Crear canal", exact: true }).click();
  await expect(page.locator(".notice[role=alert]:visible")).toContainText(
    "La fábrica no respondió",
  );
  await page.unroute("**/api/orden");
  await page.getByRole("button", { name: "Crear canal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Recuperación", exact: true }),
  ).toBeVisible();
});
