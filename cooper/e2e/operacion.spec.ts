import { test, expect, type Page } from "@playwright/test";
async function entrar(page: Page) {
  expect(
    (
      await page.request.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT}/sesion`,
        {
          data: {
            email: "admin@example.test",
            secret: process.env.COOPER_E2E_SECRET,
          },
        },
      )
    ).status(),
  ).toBe(200);
}
async function confirmar(page: Page) {
  await expect(
    page.getByRole("region", { name: "Confirmar cambios" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar solicitud", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Confirmar cambios" }),
  ).toHaveCount(0);
}
test.beforeEach(async ({ page }) => entrar(page));
test("operación: biblia, metas, redes, referencias y adopción con confirmación y persistencia", async ({
  page,
}) => {
  const op = await (await page.request.get("/api/operacion")).json();
  const id = op.canales[0].id;
  await page.goto(`/canales/${id}`);
  await page
    .getByRole("textbox", { name: "Tono", exact: true })
    .fill("Cálido y preciso, sin exageraciones.");
  await page.getByRole("button", { name: "Revisar tono", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(
    (await (await page.request.get("/api/operacion")).json()).canales[0].biblia[
      "voz.tono"
    ],
  ).not.toBe("Cálido y preciso, sin exageraciones.");
  await page.getByRole("button", { name: "Revisar tono", exact: true }).click();
  await confirmar(page);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Tono", exact: true }),
  ).toHaveValue("Cálido y preciso, sin exageraciones.");
  await page.goto("/rutina");
  await page.getByLabel("Videos por semana").fill("4");
  await page.getByLabel("Producir automáticamente").check();
  await page.getByRole("button", { name: "Revisar metas" }).click();
  await confirmar(page);
  await expect(page.getByLabel("Videos por semana")).toHaveValue("4");
  await page.goto("/redes");
  await page.getByLabel("Perfil de publicación").fill("ciencia_e2e");
  await page.getByRole("button", { name: "Revisar redes" }).click();
  await confirmar(page);
  await page.reload();
  await expect(page.getByLabel("Perfil de publicación")).toHaveValue(
    "ciencia_e2e",
  );
  await page.goto("/referencias");
  await page
    .getByRole("button", { name: "Solicitar referencias pendientes" })
    .click();
  await confirmar(page);
  await expect(
    page.getByText("Solicitud de referencias registrada.", { exact: false }),
  ).toBeVisible();
  await page.goto("/cuentas");
  await page.getByLabel("Usuario de la cuenta").fill("@ciencia_e2e");
  await page.getByRole("button", { name: "Revisar adopción" }).click();
  await confirmar(page);
  await expect(page.getByText("@ciencia_e2e", { exact: true })).toBeVisible();
});
test("operación: una idea produce un video, los ajustes registran cambios y el fallo de lectura se recupera", async ({
  page,
}) => {
  await page.goto("/radar");
  await page
    .getByRole("button", { name: "Usar idea y pedir video" })
    .first()
    .click();
  await confirmar(page);
  const state = await (await page.request.get("/api/estado")).json();
  expect(
    state.videos.some(
      (v: { title: string }) =>
        v.title === "Por qué reconocemos el olor de la lluvia",
    ),
  ).toBe(true);
  await page.goto("/admin/fabrica");
  const control = page.getByLabel("Voz", { exact: true });
  const anterior = await control.isChecked();
  await control.setChecked(!anterior);
  await page.getByRole("button", { name: "Revisar ajustes" }).click();
  await expect(
    page.getByRole("region", { name: "Confirmar cambios" }),
  ).toContainText("costo");
  await confirmar(page);
  await expect(control).toBeChecked({ checked: !anterior });
  await expect(
    page.getByRole("heading", { name: "Registro de cambios" }),
  ).toBeVisible();
  await page.route("**/api/operacion", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "La fábrica no respondió. Vuelve a consultar.",
      }),
    }),
  );
  await page.goto("/avisos");
  await expect(
    page.getByText("La fábrica no respondió. Vuelve a consultar."),
  ).toBeVisible();
  await page.unroute("**/api/operacion");
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Historial de avisos" }),
  ).toBeVisible();
  await expect(
    page.getByText("La fábrica no respondió. Vuelve a consultar."),
  ).toHaveCount(0);
});
test("operación: la aprobación exige confirmar y el estado no muestra datos administrativos", async ({
  page,
}) => {
  await page.goto("/decisiones");
  const entries = page.locator(".operation-entry");
  await expect(entries.first()).toBeVisible();
  const cantidad = await entries.count();
  await entries
    .first()
    .getByRole("button", { name: "Revisar decisión" })
    .click();
  await confirmar(page);
  await expect(entries).toHaveCount(cantidad - 1);
  const op = await (await page.request.get("/api/operacion")).json();
  expect(JSON.stringify(op)).not.toMatch(/allowVoz|api_key|refresh_token/);
});

test("operación: referencias editables y solicitudes de radar y conexión permanecen en el simulador", async ({
  page,
}) => {
  await page.goto("/referencias");
  await page
    .getByText("Añadir o actualizar una referencia", { exact: true })
    .click();
  await page.getByLabel("Nombre corto", { exact: true }).fill("presentadora");
  await page
    .getByLabel("Descripción fija", { exact: true })
    .fill("Chaqueta azul y voz serena");
  await page
    .getByLabel("Enlaces de referencia — uno por línea", { exact: true })
    .fill("https://example.test/referencia.png");
  await page
    .getByRole("button", { name: "Revisar referencia", exact: true })
    .click();
  await confirmar(page);
  await page.reload();
  await expect(
    page.getByText("Chaqueta azul y voz serena", { exact: true }),
  ).toBeVisible();
  await page.goto("/radar");
  await page.getByRole("button", { name: "Solicitar nuevo radar" }).click();
  await confirmar(page);
  await expect(
    page.getByText("Solicitud de radar registrada.", { exact: false }),
  ).toBeVisible();
  await page.goto("/redes");
  await page
    .getByRole("button", { name: "Preparar conexión de YouTube" })
    .click();
  await confirmar(page);
  await expect(
    page.getByText("pendiente de conexión real", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continuar en Google" }),
  ).toHaveCount(0);
});
