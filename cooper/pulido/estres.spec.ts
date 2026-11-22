import { test, expect, type Locator, type Page } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { abrirCooper } from "../e2e/ayudas-diseno";
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
  // La insignia «En vivo» del armazón viejo ya no existe: el armazón publica el
  // estado real del SSE en data-conexion (misma señal que usa la suite e2e/).
  await esperarConexion(page);
});
async function esperarConexion(page: Page, timeout?: number) {
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-conexion",
    "activa",
    { timeout },
  );
  await expect(page.getByTestId("estado-conexion")).toHaveCount(0);
}
// Con el rediseño el chat vive en la hoja flotante de Cooper, no en la página.
const avisoChat = (panel: Locator) => panel.locator(".notice[role=alert]");
test("chat: ráfaga de envíos, texto de 6000 caracteres, foto, rechazo recuperable y red", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const counts: number[] = [];
  const panel = await abrirCooper(page);
  const mensaje = panel.getByRole("textbox", {
    name: "Mensaje para Cooper",
    exact: true,
  });
  for (let i = 0; i < 12; i++) {
    const before = await (await page.request.get("/api/estado")).json();
    const text =
      i === 0 ? "x".repeat(6000) : `Hola Cooper, ensayo de ráfaga ${i}`;
    await expect(mensaje).toHaveCount(1);
    await expect(mensaje).toBeVisible();
    await mensaje.fill(text);
    // Escritorio y móvil comparten el mismo campo accesible dentro de la hoja.
    await mensaje.evaluate((campo: HTMLTextAreaElement) => {
      const formulario = campo.form;
      if (!formulario)
        throw new Error("El mensaje no tiene formulario asociado");
      for (let j = 0; j < 5; j++) formulario.requestSubmit();
    });
    await expect(mensaje).toHaveValue("");
    await expect(
      panel.getByRole("button", { name: "Cancelar espera" }),
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
  await panel.locator("input[type=file]").setInputFiles({
    name: "ensayo.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(panel.getByAltText("Vista previa de ensayo.png")).toBeVisible();
  await mensaje.fill("Esta foto es una referencia para el video");
  await panel.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(mensaje).toHaveValue("");
  await expect(panel.getByAltText("Vista previa de ensayo.png")).toHaveCount(0);
  await context.setOffline(true);
  // «Reconectando» pasó a la píldora de corte sostenido (aparece a los 5 s).
  await expect(page.getByTestId("estado-conexion")).toHaveText(
    "Sin conexión, reintentando",
    { timeout: 12000 },
  );
  await expect(page.locator(".workspace")).not.toHaveAttribute(
    "data-conexion",
    "activa",
  );
  await mensaje.fill("Un mensaje durante el corte");
  await panel.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(avisoChat(panel)).toBeVisible();
  // El texto no se pierde con el corte: se reenvía tal cual al volver la red.
  await expect(mensaje).toHaveValue("Un mensaje durante el corte");
  await context.setOffline(false);
  await esperarConexion(page, 45000);
  await panel.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(mensaje).toHaveValue("");
  expect(errors).toEqual([]);
  const dir = `.cache/capturas-pulido/${process.env.COOPER_PULIDO_RONDA || "diagnostico"}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/rafagas-${testInfo.project.name}.json`,
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
  const hoja = await abrirNuevoCanal(page);
  await hoja.getByRole("textbox", { name: "Nombre del canal" }).fill(title);
  await hoja
    .getByRole("textbox", { name: "¿De qué trata?" })
    .fill("Datos ficticios");
  await hoja.locator("form").evaluate((f) => {
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
  const panel = await abrirCooper(page);
  const mensaje = panel.getByRole("textbox", {
    name: "Mensaje para Cooper",
    exact: true,
  });
  await mensaje.fill("Hola");
  await panel.getByRole("button", { name: "Enviar mensaje" }).click();
  await panel.getByRole("button", { name: "Cancelar espera" }).click();
  await expect(avisoChat(panel)).toContainText("Cancelaste");
  await expect(mensaje).toHaveValue("Hola");
  await page.unroute("**/api/chat");
  await panel.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(mensaje).toHaveValue("");
  await expect(avisoChat(panel)).toHaveCount(0);
});
// El formulario de canal nuevo vive ahora en una hoja modal que se abre a demanda.
async function abrirNuevoCanal(page: Page) {
  await page
    .getByRole("button", { name: /^(Nuevo canal|Dar nombre a mi canal)$/ })
    .click();
  const hoja = page.getByRole("dialog", { name: "Un nuevo canal" });
  await expect(hoja).toBeVisible();
  return hoja;
}

test("audio ficticio repetido, descarga privada y fábrica temporalmente caída", async ({
  page,
}, testInfo) => {
  const nombre = `Recuperación ${testInfo.project.name}`;
  const panel = await abrirCooper(page);
  const mensaje = panel.getByRole("textbox", {
    name: "Mensaje para Cooper",
    exact: true,
  });
  for (let i = 0; i < 3; i++) {
    await panel
      .getByRole("button", { name: "Grabar audio", exact: true })
      .click();
    await expect(
      panel.getByRole("button", { name: "Detener grabación" }),
    ).toBeVisible();
    await page.waitForTimeout(550);
    await panel.getByRole("button", { name: "Detener grabación" }).click();
    await expect(mensaje).toHaveValue(/Quiero un nuevo video/);
    await mensaje.fill("Audio de ensayo recibido");
    await panel.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(mensaje).toHaveValue("");
  }
  const descarga = panel.getByRole("link", { name: "Adjunto 1" }).last();
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
  const hoja = await abrirNuevoCanal(page);
  await hoja.getByRole("textbox", { name: "Nombre del canal" }).fill(nombre);
  await hoja
    .getByRole("textbox", { name: "¿De qué trata?" })
    .fill("Ensayo de caída");
  await hoja.getByRole("button", { name: "Crear canal", exact: true }).click();
  await expect(hoja.getByRole("alert")).toContainText(
    "La fábrica no respondió",
  );
  // La caída no borra lo escrito: el reintento usa los mismos datos.
  await expect(
    hoja.getByRole("textbox", { name: "Nombre del canal" }),
  ).toHaveValue(nombre);
  await page.unroute("**/api/orden");
  await hoja.getByRole("button", { name: "Crear canal", exact: true }).click();
  await expect(hoja).toBeHidden();
  await expect(
    page.getByRole("heading", { name: nombre, exact: true }),
  ).toBeVisible();
});

test("aprendizaje: red lenta, doble clic, caída y reintento conservan el ajuste", async ({
  page,
}) => {
  const inicial = await (await page.request.get("/api/admin/fabrica")).json();
  const activo = inicial.valores.allowAnalytics === true;
  let intentos = 0;
  await page.route("**/api/operacion", async (route) => {
    intentos++;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({
      status: 503,
      json: { error: "Caída de ensayo Sentinel" },
    });
  });
  await page.goto("/aprendizaje");
  const control = page.getByRole("switch", {
    name: "Medición y aprendizaje automático",
  });
  await expect(control).toBeEnabled();
  await expect(control).toBeChecked({ checked: activo });
  await control.evaluate((element: HTMLInputElement) => {
    element.click();
    element.click();
  });
  await expect(control).toBeDisabled();
  await expect(
    page.getByRole("alert").filter({ hasText: "Caída de ensayo Sentinel" }),
  ).toBeVisible();
  await expect(control).toBeEnabled();
  await expect(control).toBeChecked({ checked: activo });
  expect(intentos).toBe(1);
  expect(
    (await (await page.request.get("/api/admin/fabrica")).json()).valores
      .allowAnalytics,
  ).toBe(activo);
  await page.unroute("**/api/operacion");
  try {
    await control.click();
    await expect(control).toBeEnabled();
    await expect(control).toBeChecked({ checked: !activo });
    await page.reload();
    await expect(control).toBeEnabled();
    await expect(control).toBeChecked({ checked: !activo });
  } finally {
    const actual = await (await page.request.get("/api/admin/fabrica")).json();
    expect(
      (
        await page.request.post("/api/operacion", {
          data: {
            accion: "ajustes",
            revision: actual.revision,
            valores: { allowAnalytics: activo },
            confirmado: true,
          },
        })
      ).ok(),
    ).toBe(true);
  }
});
