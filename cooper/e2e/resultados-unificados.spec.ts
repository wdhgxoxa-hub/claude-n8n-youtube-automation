import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import type { Resultados } from "../src/contratos/resultados";
const fixture = () => `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}`;
async function entrar(page: Page, email: string, resultados = false) {
  expect(
    (
      await page.request.post(`${fixture()}/sesion`, {
        data: { email, resultados, secret: process.env.COOPER_E2E_SECRET },
      })
    ).ok(),
  ).toBe(true);
}
test("consulta conjunta: dos dueños, homónimos, filtros, ausencia, duplicados y origen", async ({
  page,
}) => {
  test.setTimeout(120000);
  await entrar(page, "admin@example.test");
  for (const email of [
    "resultados-ana@example.test",
    "resultados-luis@example.test",
  ]) {
    expect(
      (
        await page.request.post("/api/admin/permitidos", { data: { email } })
      ).ok(),
    ).toBe(true);
  }
  await entrar(page, "resultados-luis@example.test", true);
  const ajeno: Resultados = await (
    await page.request.get("/api/resultados")
  ).json();
  await entrar(page, "resultados-ana@example.test", true);
  const propio: Resultados = await (
    await page.request.get("/api/resultados")
  ).json();
  expect(propio.ambitos).toHaveLength(2);
  expect(JSON.stringify(propio)).not.toContain(ajeno.ambitos[0].ownerId);
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.goto("/publicados");
  await expect(page.locator(".publication:visible")).toHaveCount(4);
  await expect(
    page.getByRole("group", { name: "Dueño", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("2 mediciones disponibles", { exact: true }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByRole("group", { name: "Tipo de publicación" })
    .getByRole("button", { name: "Marcas", exact: true })
    .click();
  await expect(page.locator(".publication:visible")).toHaveCount(2);
  await expect(
    page.getByText("Fecha sin registrar", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Sin dato", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Todo el periodo", exact: true })
    .click();
  await page.getByLabel("Desde (Lima)").fill("2026-11-20");
  await page
    .getByRole("button", { name: "Ver resultados", exact: true })
    .click();
  await expect(page.locator(".publication:visible")).toHaveCount(0);
  await page.getByRole("button", { name: "Limpiar filtros" }).first().click();
  await page
    .getByRole("group", { name: "Canal o marca" })
    .getByRole("button", { name: /· Canal$/ })
    .click();
  await page
    .getByRole("button", { name: "Todo el periodo", exact: true })
    .click();
  await page.getByLabel("Desde (Lima)").fill("2026-11-20");
  await page.getByLabel("Hasta (Lima)").fill("2026-11-20");
  await page
    .getByRole("button", { name: "Ver resultados", exact: true })
    .click();
  await expect(page.locator(".publication:visible")).toHaveCount(1);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "1 publicación · 2 mediciones disponibles",
  );
  await page.getByRole("button", { name: /^Ver cifras de / }).click();
  await expect(page.getByText("125", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Cerrar cifras" }).click();
  await page.getByRole("button", { name: "Limpiar filtros" }).first().click();
  await page.getByRole("button", { name: "instagram", exact: true }).click();
  await expect(page.locator(".publication:visible")).toHaveCount(3);
  // Las capturas duplicadas del fixture comparten fecha: cualquiera de sus
  // destinos propios es válido, pero nunca uno de la persona ajena.
  const enlaceMarca = page
    .locator('.publication-thumb[href^="/marcas?pieza="]')
    .first();
  const destinoMarca = await enlaceMarca.getAttribute("href");
  expect(
    propio.publicaciones.filter((p) => p.tipo === "marca").map((p) => p.href),
  ).toContain(destinoMarca);
  await enlaceMarca.click();
  await expect(
    page.getByRole("heading", { name: "Horizonte", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Secciones de la marca" })
      .getByRole("button", { name: "Publicados", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(
    page.locator(`#pieza-${new URL(destinoMarca!, "http://localhost").searchParams.get("pieza")}`),
  ).toBeVisible();
  await page.goto("/aprendizaje");
  await expect(
    page.getByRole("switch", { name: "Medición y aprendizaje automático" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Abrir con una pregunta verificable" }),
  ).toHaveCount(1);
  await page
    .getByText("Ver las mediciones y el contexto", { exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Evidencia de la lección")).toContainText("24h");
  await expect(page.getByLabel("Aplicaciones de la lección")).toContainText(
    "Apertura revisada",
  );
  await expect(
    page.getByText(
      "Estudio descriptivo; todavía no es una lección comprobada.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page.getByRole("button", { name: "youtube", exact: true }).click();
  await expect(page.locator(".lesson:visible")).toHaveCount(1);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "1 lección · 0 de marcas",
  );
  await page.getByRole("button", { name: "Limpiar filtros" }).first().click();
  await page.route("**/api/resultados", (r) =>
    r.fulfill({ status: 503, json: { error: "Ensayo" } }),
  );
  await page.getByRole("button", { name: "Actualizar resultados" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Se conservan los últimos resultados",
  );
  await expect(
    page.getByRole("heading", { name: "Abrir con una pregunta verificable" }),
  ).toBeVisible();
  await page.unroute("**/api/resultados");
  mkdirSync(".cache/total-m10", { recursive: true });
  for (const ruta of ["publicados", "aprendizaje"])
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${ruta}`);
      for (const tema of ["oscuro"]) {
        await page.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          tema,
        );
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `.cache/total-m10/${ruta}-${width}-${tema}.png`,
          fullPage: true,
        });
      }
    }
  await entrar(page, "admin@example.test");
  await page.goto("/publicados");
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByRole("group", { name: "Dueño" })
    .getByRole("button", { name: propio.ambitos[0].propietario, exact: true })
    .click();
  await expect(page.locator(".publication:visible")).toHaveCount(4);
  await page
    .getByRole("group", { name: "Dueño" })
    .getByRole("button", { name: ajeno.ambitos[0].propietario, exact: true })
    .click();
  await expect(page.locator(".publication:visible")).toHaveCount(4);
  await page.goto("/aprendizaje");
  await expect(
    page.getByRole("switch", { name: "Medición y aprendizaje automático" }),
  ).toBeEnabled();
  expect(errores).toEqual([]);
});
