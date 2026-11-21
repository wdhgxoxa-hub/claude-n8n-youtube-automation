import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
test("radar presenta competencia, diferenciación y límites sin inventar mediciones", async ({
  page,
}) => {
  await page.goto("/radar");
  await expect(
    page.getByRole("heading", { name: "Competencia e identidad" }),
  ).toBeVisible();
  await expect(page.getByText("Por investigar", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cuentas con el mismo nombre" }),
  ).toBeVisible();
  const op = await (await page.request.get("/api/operacion")).json();
  op.canales[0].nombre = "Margen Real de ensayo";
  op.canales[0].radar.ideas = [];
  op.canales[0].radar.sonidos = [];
  op.canales[0].radar.resumen = "Sin ideas reales en esta prueba.";
  op.canales[0].radar.competencia = {
    version: 1,
    estado: "listo",
    fecha: new Date().toISOString(),
    fuente: "web_publica",
    resumen: "Investigación ficticia para la prueba de presentación.",
    diferenciacion: "Margen Real es Perú: cifras en soles y casos peruanos.",
    competidores: [1, 2, 3].map((i) => ({
      nombre: `Competidor ficticio ${i}`,
      red: "youtube",
      url: `https://www.youtube.com/@ensayo${i}`,
      pais: "Perú",
      fuente_identidad: `https://editorial-ficticia${i}.example.org/canal`,
      patron: "Hipótesis de gancho visual, pendiente de probar.",
      muestras: [100, 120, 80, i === 1 ? 600 : 110].map((vistas, k) => ({
        titulo: `Muestra ficticia ${i}-${k + 1}`,
        formato: "short",
        vistas,
        fecha: new Date(Date.now() - (10 - k) * 86400000).toISOString(),
        url: `https://www.youtube.com/shorts/ensayo${i}${k}`,
      })),
      outliers:
        i === 1
          ? [
              {
                titulo: "Publicación de ensayo",
                url: "https://www.youtube.com/shorts/ensayo13",
                fecha: new Date(Date.now() - 7 * 86400000).toISOString(),
                vistas: 600,
                formato: "short",
                mediana: 100,
                muestra: 3,
                multiplicador: 6,
              },
            ]
          : [],
    })),
    homonimos: [
      {
        nombre: "Homónimo ficticio",
        red: "tiktok",
        pais: "México",
        url: "https://www.tiktok.com/@homonimoensayo",
        diferencia: "Cuenta distinta; no atribuirla al canal peruano.",
      },
    ],
    comprobaciones: [],
    limitaciones: [],
    objetivos: ["vistas", "retención", "seguidores"],
  };
  await page.route("**/api/operacion", (route) => route.fulfill({ json: op }));
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Competidor ficticio 1", exact: true }),
  ).toBeVisible();
  const destacado = page
    .getByRole("link", { name: "Publicación de ensayo" })
    .locator("..");
  await expect(destacado).toBeVisible();
  await expect(destacado).toContainText("600 vistas");
  await expect(
    page.getByRole("link", {
      name: "Fuente de identidad de Competidor ficticio 1",
    }),
  ).toHaveAttribute("href", "https://editorial-ficticia1.example.org/canal");
  await expect(
    page.getByRole("link", { name: "Homónimo ficticio" }),
  ).toBeVisible();
  await page
    .getByText("Ver muestra de 4 publicaciones de Competidor ficticio 1")
    .click();
  await expect(
    page.getByRole("link", { name: "Muestra ficticia 1-1" }),
  ).toHaveAttribute("href", "https://www.youtube.com/shorts/ensayo10");
  const muestra = page.getByRole("listitem").filter({
    has: page.getByRole("link", { name: "Muestra ficticia 1-1", exact: true }),
  });
  await expect(muestra).toBeVisible();
  await expect(muestra).toContainText("100 vistas");
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: ".cache/competencia-radar-1440.png",
    fullPage: true,
  });
});
test("operación: el HTML inicial contiene los datos y actualizar mantiene la consulta explícita", async ({
  page,
}) => {
  const html = await (await page.request.get("/radar")).text();
  expect(html).toContain(
    ">Fábrica simulada. Los ejemplos no consultan cuentas externas.<",
  );
  expect(html).toContain("Por qué reconocemos el olor de la lluvia");
  let consultas = 0;
  await page.route("**/api/operacion", (route) => {
    consultas++;
    return route.continue();
  });
  await page.goto("/radar");
  await expect(
    page.getByRole("button", { name: "Solicitar nuevo radar" }),
  ).toBeVisible();
  expect(consultas).toBe(0);
  const respuesta = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/operacion") &&
      response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  expect((await respuesta).status()).toBe(200);
  expect(consultas).toBe(1);
});
test("canales con nombres repetidos conservan menús accesibles distintos", async ({
  page,
}) => {
  const state = await (await page.request.get("/api/estado")).json();
  state.channels = [0, 1].map((i) => ({
    ...state.channels[0],
    id: `canal-duplicado-${i}`,
    name: "Canal con nombre compartido",
  }));
  // La regresión de presentación no modifica los canales de las demás suites.
  await page.route("**/api/estado", (route) => route.fulfill({ json: state }));
  await page.route("**/api/eventos", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `event: estado\ndata: ${JSON.stringify(state)}\n\n`,
    }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/canales");
  const menus = page.getByRole("navigation", {
    name: /Operación de Canal con nombre compartido/,
  });
  await expect(menus).toHaveCount(2);
  const names = await menus.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label")),
  );
  expect(new Set(names).size).toBe(2);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
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
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
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
  // El streaming de Next puede conservar temporalmente una copia oculta del HTML.
  // Contar las decisiones presentadas, no los buffers de Suspense pendientes.
  const entries = page.locator(".operation-entry:visible");
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
