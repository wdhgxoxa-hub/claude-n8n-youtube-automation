import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import type { EstadoMarcas } from "../src/servicios/marcas/servicio";

const plantilla = {
  version: 1,
  plantilla: "tienda-ropa",
  datosEjemplo: true,
  catalogo: {
    estado: "sin_conectar",
    plataforma: "por_definir",
    url: null,
  },
};

async function entrar(request: APIRequestContext, email: string) {
  const respuesta = await request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
    { data: { email, secret: process.env.COOPER_E2E_SECRET } },
  );
  expect(respuesta.status()).toBe(200);
}

async function prepararCuenta(page: Page) {
  await entrar(page.request, "admin@example.test");
  // Reutilizar las cuentas de ensayo evita superar el límite real de diez
  // usuarios cuando se ejecuta toda la puerta, y permite ejecutar este archivo solo.
  for (const email of ["ana@example.test", "luis@example.test"]) {
    expect(
      (
        await page.request.post("/api/admin/permitidos", { data: { email } })
      ).status(),
    ).toBe(200);
  }
  await entrar(page.request, "ana@example.test");
}

async function estado(request: APIRequestContext): Promise<EstadoMarcas> {
  const respuesta = await request.get("/api/marcas");
  expect(respuesta.status()).toBe(200);
  return respuesta.json();
}

async function crearTienda(page: Page, nombre: string) {
  await page.goto("/marcas");
  await page.getByRole("button", { name: "Añadir marca o cuenta" }).click();
  const inicio = page.getByRole("combobox", { name: "Punto de partida" });
  await expect(inicio).toHaveValue("blanco");
  await inicio.selectOption({ label: "Tienda de ropa de Walter (ejemplo)" });
  await expect(
    page.getByLabel("Nombre de la marca", { exact: true }),
  ).toHaveValue("Tienda de ropa de Walter · Ejemplo");
  await expect(
    page.getByRole("combobox", { name: "Rubro", exact: true }),
  ).toHaveValue("moda");
  await page.getByLabel("Nombre de la marca", { exact: true }).fill(nombre);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: nombre, exact: true }),
  ).toBeVisible();
  const marca = (await estado(page.request)).marcas.find(
    (m) => m.nombre === nombre,
  );
  expect(marca).toBeDefined();
  expect(marca!.rubro).toBe("moda");
  expect(marca!.guia.tienda).toEqual(plantilla);
  expect(marca!.cuentas).toEqual([]);
  expect(marca!.piezas).toEqual([]);
  await expect
    .poll(() => new URL(page.url()).searchParams.get("seccion"))
    .toBe("tienda");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("marca"))
    .toBe(marca!.id);
  return marca!;
}

test("Tienda de ropa: creación explícita, edición persistente y aislamiento", async ({
  page,
}) => {
  await prepararCuenta(page);
  const marca = await crearTienda(
    page,
    "Tienda de ropa · Ensayo de persistencia",
  );
  await expect(
    page.getByText(
      "Plantilla de ejemplo · Pendiente de definición con Walter",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("navigation", { name: "Secciones de la marca" })
      .getByRole("button", { name: "Tienda", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Editar guía", exact: true }).click();
  await page
    .getByLabel("Nombre de la marca", { exact: true })
    .fill("Tienda de ropa · Guía editada de ensayo");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  // El texto DOM inicial del textarea forma parte de su label anidado;
  // el nombre accesible del control sigue siendo «Tono».
  await page
    .getByRole("textbox", { name: "Tono", exact: true })
    .fill("Cercano, con detalles comprobados de cada prenda. Guía de ensayo.");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(
    page.getByText("Guía de marca guardada.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("seccion"))
    .toBe("tienda");
  await expect(
    page.getByRole("heading", {
      name: "Tienda de ropa · Guía editada de ensayo",
      exact: true,
    }),
  ).toBeVisible();
  const guardada = (await estado(page.request)).marcas.find(
    (m) => m.id === marca.id,
  )!;
  expect(guardada.guia.tienda).toEqual(plantilla);
  expect(guardada.guia.tono).toBe(
    "Cercano, con detalles comprobados de cada prenda. Guía de ensayo.",
  );
  expect(guardada.cuentas).toEqual([]);
  expect(guardada.piezas).toEqual([]);

  await entrar(page.request, "luis@example.test");
  expect(
    (await estado(page.request)).marcas.some((m) => m.id === marca.id),
  ).toBe(false);
  const ajena = await page.request.post(`/api/marcas/${marca.id}`, {
    data: {
      nombre: "No debe modificar la tienda ajena",
      rubro: guardada.rubro,
      zona: guardada.zona,
      guia: guardada.guia,
    },
  });
  expect(ajena.status()).toBe(404);
  await entrar(page.request, "ana@example.test");
  expect(
    (await estado(page.request)).marcas.find((m) => m.id === marca.id),
  ).toEqual(guardada);

  await page.getByRole("button", { name: "Añadir marca o cuenta" }).click();
  await expect(
    page.getByRole("combobox", { name: "Punto de partida" }),
  ).toHaveValue("blanco");
  await page
    .getByLabel("Nombre de la marca", { exact: true })
    .fill("Marca sin plantilla · Ensayo tienda");
  await page
    .getByRole("combobox", { name: "Rubro", exact: true })
    .selectOption("moda");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Marca sin plantilla · Ensayo tienda",
      exact: true,
    }),
  ).toBeVisible();
  const marcas = page.getByRole("complementary", { name: "Tus marcas" });
  await marcas
    .getByRole("button")
    .filter({
      hasText: "Tienda de ropa · Guía editada de ensayo",
    })
    .click();
  await page
    .getByRole("navigation", { name: "Secciones de la marca" })
    .getByRole("button", { name: "Tienda", exact: true })
    .click();
  await marcas
    .getByRole("button")
    .filter({
      hasText: "Marca sin plantilla · Ensayo tienda",
    })
    .click();
  const secciones = page.getByRole("navigation", {
    name: "Secciones de la marca",
  });
  await expect(
    secciones.getByRole("button", { name: "Tienda", exact: true }),
  ).toHaveCount(0);
  await expect(
    secciones.getByRole("button", { name: "Calendario", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("seccion"))
    .toBe("calendario");
  await expect(
    page.getByRole("heading", {
      name: "Especialista de moda y ecommerce",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(
    (await estado(page.request)).marcas.find(
      (m) => m.nombre === "Marca sin plantilla · Ensayo tienda",
    )!.guia.tienda,
  ).toBeUndefined();
});

for (const width of [390, 1440]) {
  test(`Tienda de ropa: calendario, conversión y catálogo accesibles a ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const issues: unknown[] = [];
    const cdp = await page.context().newCDPSession(page);
    cdp.on("Audits.issueAdded", (issue) => issues.push(issue));
    await cdp.send("Audits.enable");
    await prepararCuenta(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errores: string[] = [];
    page.on("pageerror", (error) => errores.push(error.message));
    const marca = await crearTienda(
      page,
      `Tienda de ropa · Ensayo visual ${width}`,
    );
    await expect(
      page.getByRole("heading", {
        name: "Especialista de moda y ecommerce",
        exact: true,
      }),
    ).toBeVisible();
    for (const pilar of [
      "Lanzamientos",
      "Lookbooks",
      "Reels de producto",
      "Ofertas",
      "UGC",
    ]) {
      await expect(
        page.getByRole("heading", { name: pilar, exact: true }),
      ).toBeVisible();
    }
    for (const titulo of [
      "Calendario editorial de ejemplo",
      "Conversión de la tienda",
      "Catálogo web futuro",
    ]) {
      await expect(
        page.getByRole("heading", { name: titulo, exact: true }),
      ).toBeVisible();
    }
    await expect(page.getByText("Desconectado", { exact: true })).toBeVisible();
    const calendario = page.getByRole("region", {
      name: "Calendario editorial de ejemplo",
      exact: true,
    });
    await expect(calendario.getByRole("listitem")).toHaveCount(5);
    await expect(
      calendario.getByText("Propuesta · No programada", { exact: true }),
    ).toHaveCount(5);
    for (const dia of ["Lunes", "Martes", "Miércoles", "Viernes", "Sábado"]) {
      await expect(calendario.getByText(dia, { exact: true })).toBeVisible();
    }
    await expect(calendario).toContainText("America/Lima");
    const reales = page.locator(
      'dl[aria-label="Conversión real sin conectar"]',
    );
    await expect(reales.getByText("Sin datos", { exact: true })).toHaveCount(4);
    await page
      .getByText("Ver cálculo con datos ficticios", { exact: true })
      .click();
    const ficticias = page.locator(
      'dl[aria-label="Conversión ficticia de ejemplo"]',
    );
    for (const valor of [/^12\s?%$/, /^6\s?%$/, /^3\s?%$/, /^S\/\s?120\.00$/]) {
      await expect(ficticias.getByText(valor)).toBeVisible();
    }
    await expect(
      page.getByText(/Ejemplo didáctico, ajeno a esta marca/),
    ).toBeVisible();
    await expect(reales.getByText("Sin datos", { exact: true })).toHaveCount(4);
    await page
      .getByText("Datos que necesitará el catálogo", { exact: true })
      .click();
    const catalogo = page.getByRole("region", {
      name: "Catálogo web futuro",
      exact: true,
    });
    for (const campo of [
      "Identidad y variantes",
      "Precio y disponibilidad",
      "Atribución y medición",
    ]) {
      await expect(catalogo.getByText(campo, { exact: true })).toBeVisible();
    }

    mkdirSync(".cache/total-marca-tienda", { recursive: true });
    for (const tema of ["oscuro", "claro"]) {
      await page.evaluate((valor) => {
        document.documentElement.dataset.theme = valor;
      }, tema);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: `.cache/total-marca-tienda/tienda-${width}-${tema}.png`,
        fullPage: true,
      });
    }
    const actual = (await estado(page.request)).marcas.find(
      (m) => m.id === marca.id,
    )!;
    expect(actual.guia.tienda).toEqual(plantilla);
    expect(actual.cuentas).toEqual([]);
    expect(actual.piezas).toEqual([]);
    expect(errores).toEqual([]);
    expect(issues).toEqual([]);
  });
}
