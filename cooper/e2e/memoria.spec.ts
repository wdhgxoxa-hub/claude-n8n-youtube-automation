import { abrirCooper } from "./ayudas-diseno";
import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

async function entrar(request: APIRequestContext, email: string) {
  const r = await request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
    { data: { email, secret: process.env.COOPER_E2E_SECRET } },
  );
  expect(r.status()).toBe(200);
}
test("recuerdos privados, regreso al estudio, revisión administrativa y borrado", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await entrar(page.request, "admin@example.test");
  expect(
    (
      await page.request.post("/api/admin/permitidos", {
        data: { email: "memoria@example.test" },
      })
    ).status(),
  ).toBe(200);
  await entrar(page.request, "memoria@example.test");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const canal = await (
    await page.request.post("/api/orden", {
      data: { evento: "nuevo_canal", texto: "Barrio memorable" },
    })
  ).json();
  const otra = await (
    await page.request.post("/api/orden", {
      data: { evento: "nuevo_canal", texto: "Otra marca" },
    })
  ).json();
  const estado = await (await page.request.get("/api/estado")).json();
  expect(
    (
      await page.request.post("/api/chat", {
        data: {
          texto:
            "Título provisional: Luz de barrio. Pendiente entrevistar a Rosa. Prefiero videos cortos.",
          canalId: canal.id,
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post("/api/chat", {
        data: {
          texto: "Título provisional: Colección de invierno",
          canalId: otra.id,
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/");
  await abrirCooper(page);
  await expect(
    page.getByRole("heading", { name: "Donde lo dejamos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Memoria de Cooper" }),
  ).toContainText("Colección de invierno");
  await page.getByRole("button", { name: "Retomar", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Mensaje para Cooper", exact: true }),
  ).toHaveValue("Retomemos esta idea: Colección de invierno");
  mkdirSync(".cache/capturas-memoria", { recursive: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    // Retomar enfoca el compositor y desplaza la página; normaliza solo la captura.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({
      path: `.cache/capturas-memoria/tarjeta-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Ver lo recordado", exact: true })
    .click();
  const memoria = page.getByRole("region", { name: "Memoria de Cooper" });
  await expect(memoria).toContainText("Luz de barrio");
  await expect(memoria).toContainText("Prefiero videos cortos");
  for (const tema of ["oscuro"]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, tema);
    for (const width of [360, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).include(".memory-card").analyze())
          .violations,
      ).toEqual([]);
      await page.screenshot({
        path: `.cache/capturas-memoria/${tema}-${width}.png`,
        fullPage: true,
      });
    }
  }
  // Sesión independiente: la lectura administrativa nunca contamina su propio chat.
  const admin = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  try {
    await entrar(admin.request, "admin@example.test");
    expect(
      await (await admin.request.get("/api/memoria")).text(),
    ).not.toContain("Luz de barrio");
    const vista = await admin.newPage();
    await vista.goto("/admin");
    await vista
      .getByRole("region", { name: "Recuerdos del equipo" })
      .getByLabel("Persona para consultar recuerdos")
      .selectOption(estado.user.id);
    await vista
      .getByRole("button", { name: "Ver recuerdos de la persona" })
      .click();
    await expect(
      vista.getByRole("region", { name: "Recuerdos del equipo" }),
    ).toContainText("Luz de barrio");
    await vista.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => vista.evaluate(() => window.scrollY)).toBe(0);
    await vista.screenshot({
      path: ".cache/capturas-memoria/admin.png",
      fullPage: true,
    });
    expect(
      (await new AxeBuilder({ page: vista }).include(".memory-admin").analyze())
        .violations,
    ).toEqual([]);
  } finally {
    await admin.close();
  }
  expect(
    (await page.request.get(`/api/admin/memoria/${estado.user.id}`)).status(),
  ).toBe(403);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Borrar lo recordado", exact: true })
    .click();
  await page.getByRole("button", { name: "Conservar recuerdos" }).click();
  await expect(memoria).toContainText("Luz de barrio");
  await page
    .getByRole("button", { name: "Borrar lo recordado", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar borrado de recuerdos" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Donde lo dejamos" }),
  ).toHaveCount(0);
  await expect(memoria).toContainText("Todavía no hay recuerdos guardados.");
  await page.reload();
  // La recarga cierra la hoja: vuelve a abrirla antes de verificar su memoria.
  await abrirCooper(page);
  await expect(
    page.getByRole("heading", { name: "Donde lo dejamos" }),
  ).toHaveCount(0);
  const respuesta = await (
    await page.request.post("/api/chat", {
      data: { texto: "El video que estábamos pensando", canalId: canal.id },
    })
  ).json();
  expect(respuesta.texto).toContain("No tengo una idea guardada");
  expect(respuesta.texto).not.toContain("Luz de barrio");
  expect(
    (
      await page.request.post("/api/chat", {
        data: { texto: "Prefiero ilustraciones", canalId: canal.id },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await abrirCooper(page);
  await page
    .getByRole("button", { name: "Ver lo recordado", exact: true })
    .click();
  await expect(memoria).toContainText("Prefiero ilustraciones");
  await expect(
    page.getByRole("heading", { name: "Donde lo dejamos" }),
  ).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).include(".memory-card").analyze())
      .violations,
  ).toEqual([]);
  expect(errors).toEqual([]);
});
