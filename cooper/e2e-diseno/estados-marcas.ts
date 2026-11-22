import { expect, type Page, type Request } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Estado } from "../src/servicios/datos";
import type { EstadoMarcas } from "../src/servicios/marcas/servicio";

/** Captura controles reales de una marca de ensayo, sin editar ni guardar datos. */
export async function capturarEstadosMarcas(
  page: Page,
  shot: (name: string) => Promise<unknown>,
  marcaId: string,
) {
  const previousUrl = page.url();
  const origin = new URL(previousUrl);
  const width = page.viewportSize()?.width;
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(origin.hostname);
  if (!width) throw new Error("La matriz necesita un viewport explícito.");
  const stateResponse = await page.request.get(`${origin.origin}/api/estado`);
  expect(stateResponse.ok()).toBe(true);
  const state: Estado = await stateResponse.json();
  expect(state.demo, "Las hojas se capturan en el ensayo demo local").toBe(
    true,
  );

  async function readBrand() {
    const response = await page.request.get(`${origin.origin}/api/marcas`);
    expect(response.ok()).toBe(true);
    const data: EstadoMarcas = await response.json();
    const brand = data.marcas.find((item) => item.id === marcaId);
    if (!brand) throw new Error("Falta la marca preparada por la matriz.");
    return brand;
  }
  const initial = await readBrand();
  const piece = initial.piezas.find((item) => item.estado === "borrador");
  if (!piece) throw new Error("Falta el borrador existente de la matriz.");

  const writes: string[] = [];
  const watchWrites = (request: Request) => {
    const url = new URL(request.url());
    if (
      url.origin === origin.origin &&
      url.pathname.startsWith("/api/") &&
      !["GET", "HEAD"].includes(request.method())
    )
      writes.push(`${request.method()} ${url.pathname}`);
  };
  const screens: string[] = [];
  const capture = async (name: string) => {
    expect(writes, "Abrir las hojas no modifica datos").toEqual([]);
    await shot(name);
    screens.push(name);
  };
  async function closeSheet(name: string) {
    const sheet = page.getByRole("dialog", { name, exact: true });
    await sheet.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(sheet).toBeHidden();
  }

  page.on("request", watchWrites);
  try {
    await page.goto(
      new URL(
        `/marcas?marca=${encodeURIComponent(marcaId)}&seccion=calendario`,
        origin.origin,
      ).href,
    );
    await expect(
      page.getByRole("heading", { name: initial.nombre, exact: true }),
    ).toBeVisible();
    const guide = page.locator(".marca-guia-resumen");
    const summary = guide.getByText("Guía de la marca", { exact: true });
    await summary.click();
    await expect(guide).toHaveAttribute("open", "");
    await expect(
      guide.getByText(initial.guia.tono, { exact: true }),
    ).toBeVisible();
    await capture("marca-guia-desplegada");
    await summary.click();
    await expect(guide).not.toHaveAttribute("open", "");

    await page
      .getByRole("button", { name: "Editar guía", exact: true })
      .click();
    const editor = page.getByRole("dialog", {
      name: "Editar guía",
      exact: true,
    });
    await expect(
      editor.getByLabel("Nombre de la marca", { exact: true }),
    ).toHaveValue(initial.nombre);
    // El segundo paso muestra la guía visual. Continuar solo cambia el paso local.
    await editor
      .getByRole("button", { name: "Continuar", exact: true })
      .click();
    await expect(
      editor.getByRole("textbox", { name: "Tono", exact: true }),
    ).toHaveValue(initial.guia.tono);
    await capture("marca-guia-editar");
    await closeSheet("Editar guía");

    await page
      .getByRole("button", { name: "Cuentas y conexión", exact: true })
      .click();
    const accounts = page.getByRole("dialog", {
      name: "Cuentas y conexión",
      exact: true,
    });
    await expect(
      accounts.getByLabel("Nombre de la cuenta", { exact: true }),
    ).toBeVisible();
    await capture("marca-cuentas-conexion");
    await closeSheet("Cuentas y conexión");

    const article = page.locator(".marca-pieza").filter({
      has: page.getByRole("heading", { name: piece.datos.titulo, exact: true }),
    });
    await expect(article).toHaveCount(1);
    await article
      .getByRole("button", { name: "Editar pieza", exact: true })
      .click();
    const draft = page.getByRole("dialog", {
      name: "Editar borrador",
      exact: true,
    });
    await expect(
      draft.getByLabel("Título de la pieza", { exact: true }),
    ).toHaveValue(piece.datos.titulo);
    await capture("marca-pieza-editar");
    await closeSheet("Editar borrador");
    expect(writes, "Ninguna conexión ni revisión se confirma").toEqual([]);
    expect(
      await readBrand(),
      "La marca conserva todos sus datos iniciales",
    ).toEqual(initial);
  } finally {
    page.off("request", watchWrites);
    mkdirSync("../evidencias-diseno", { recursive: true });
    writeFileSync(
      `../evidencias-diseno/estados-marcas-${width}.json`,
      JSON.stringify(
        {
          width,
          servidor: "E2E demo local, base temporal y proveedores simulados",
          pantallas: screens,
          escriturasDesdeNavegador: writes,
          limite:
            "Las hojas se abren y cierran sin cambiar valores, guardar, conectar ni enviar a revisión.",
        },
        null,
        2,
      ),
    );
    await page.goto(previousUrl);
  }
}
