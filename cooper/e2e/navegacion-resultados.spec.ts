import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

for (const width of [390, 1440]) {
  test(`Cooper se cierra y reabre con el guardián íntegro a ${width}px`, async ({
    page,
  }) => {
    const fixture = `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}`;
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
    const ruta = "src/sentinel/guardian/proteger.js";
    const fuente = readFileSync(`.cache/sentinel/${ruta}`, "utf8");
    const manifiesto = JSON.parse(
      readFileSync("ci/sentinel-origen.json", "utf8"),
    );
    expect(createHash("sha256").update(fuente).digest("hex")).toBe(
      manifiesto.archivos[ruta],
    );
    const baseURL = new URL(test.info().project.use.baseURL!);
    expect(baseURL.hostname).toBe("127.0.0.1");
    // Se inyecta el guardián publicado completo, igual que Sentinel: la única
    // sustitución es su CONFIG. No se omite su cancelación ni su timeout de 300 ms.
    await page.addInitScript(
      fuente.replace(
        "__SENTINEL_CONFIG__",
        JSON.stringify({
          textos: ["Enviar"],
          selectores: [],
          origenes: [baseURL.origin],
        }),
      ),
    );
    await page.addInitScript(() => {
      localStorage.setItem("cooper-motion-paused", "false");
      const estado = window as Window & { cancelacionesCooper?: number };
      estado.cancelacionesCooper = 0;
      new MutationObserver((cambios) => {
        for (const cambio of cambios) {
          if (
            cambio.type === "attributes" &&
            cambio.attributeName === "data-sentinel-cancelado" &&
            (cambio.target as HTMLElement).id === "cooper-panel"
          )
            estado.cancelacionesCooper!++;
        }
      }).observe(document, {
        subtree: true,
        attributes: true,
        attributeFilter: ["data-sentinel-cancelado"],
      });
    });
    const errores: string[] = [];
    page.on("pageerror", (error) => errores.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errores.push(message.text());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/publicados");
    for (const apertura of [1, 2]) {
      await page
        .getByRole("button", { name: "Abrir Cooper", exact: true })
        .click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as Window & { cancelacionesCooper?: number })
                .cancelacionesCooper,
          ),
        )
        .toBe(apertura);
      await expect(
        page.getByRole("dialog", { name: "Cooper, tu compañero" }),
      ).toHaveCount(0);
      await expect(page.locator(".cooper-panel")).toHaveCount(0);
      // El desmontaje puede preceder al timer del guardián. Observar después
      // de ese plazo detecta también un removeChild tardío sin ocultarlo.
      await page.waitForTimeout(350);
      expect(errores).toEqual([]);
      await expect(
        page.getByRole("button", { name: "Abrir Cooper", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "La pared", exact: true }),
      ).toBeVisible();
    }
  });
}

test("Resultados enlaza las secciones de Marcas y conserva el destino al recargar", async ({
  page,
}) => {
  test.setTimeout(120000);
  const fixture = `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}`;
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
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));
  await page.goto("/marcas");
  await page
    .getByRole("button", {
      name: /^(Añadir marca o cuenta|Crear mi primera marca)$/,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Nombre de la marca" })
    .fill("Marca para navegación");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Marca para navegación", exact: true }),
  ).toBeVisible();
  for (const ruta of ["publicados", "aprendizaje"] as const) {
    const etiqueta = ruta === "publicados" ? "Publicados" : "Aprendizaje";
    await page.goto(`/${ruta}`);
    await page
      .getByRole("link", {
        name: ruta === "publicados" ? "Ver marcas" : "Aprendizaje de marcas",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/marcas\\?seccion=${ruta}$`));
    const pestana = page
      .getByRole("navigation", { name: "Secciones de la marca" })
      .getByRole("button", { name: etiqueta, exact: true });
    await expect(pestana).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(pestana).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", {
        name: ruta === "publicados" ? "Publicados" : "Aprendizaje de la marca",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", {
        name:
          ruta === "publicados"
            ? "Ver videos publicados"
            : "Ver aprendizaje de videos",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${ruta}$`));
    await expect(
      page.getByRole("heading", {
        name: ruta === "publicados" ? "La pared" : "Lo que aprendimos",
        exact: true,
      }),
    ).toBeVisible();
  }
  mkdirSync(".cache/total-sentinel/marcas", { recursive: true });
  const marcas = await (await page.request.get("/api/marcas")).json();
  const marca = marcas.marcas.find(
    (m: { nombre: string }) => m.nombre === "Marca para navegación",
  );
  await page.goto(`/marcas?marca=${marca.id}`);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [seccion, etiqueta] of [
      ["estudio", "Estudio"],
      ["competencia", "Competencia"],
      ["publicados", "Publicados"],
      ["aprendizaje", "Aprendizaje"],
      ["calendario", "Calendario"],
    ]) {
      const pestana = page
        .getByRole("navigation", { name: "Secciones de la marca" })
        .getByRole("button", { name: etiqueta, exact: true });
      await pestana.click();
      await expect
        .poll(() => new URL(page.url()).searchParams.get("seccion"))
        .toBe(seccion);
      await page.reload();
      await expect(pestana).toHaveAttribute("aria-current", "page");
      await expect(
        page.getByRole("heading", {
          name: "Marca para navegación",
          exact: true,
        }),
      ).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.cache/total-sentinel/marcas/${width}-${seccion}.png`,
        fullPage: true,
      });
    }
  }
  await page.goto("/marcas?seccion=no-admitida");
  await expect(
    page
      .getByRole("navigation", { name: "Secciones de la marca" })
      .getByRole("button", { name: "Calendario", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(errores).toEqual([]);
});
