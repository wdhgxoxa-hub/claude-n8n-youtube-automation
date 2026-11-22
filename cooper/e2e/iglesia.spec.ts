import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { revisionDoctrinalIglesia } from "../src/servicios/marcas/iglesia";

async function entrar(request: APIRequestContext, email: string) {
  const response = await request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
    { data: { email, secret: process.env.COOPER_E2E_SECRET } },
  );
  expect(response.status()).toBe(200);
}

type MarcaEnsayo = {
  id: string;
  nombre: string;
  cuentas: unknown[];
  piezas: {
    id: string;
    revision: number;
    estado: string;
    datos: { ejemplo?: boolean };
    revisionDoctrinal: { revision: number } | null;
  }[];
};

async function marcaIglesia(request: APIRequestContext) {
  const response = await request.get("/api/marcas");
  expect(response.status()).toBe(200);
  const { marcas } = (await response.json()) as { marcas: MarcaEnsayo[] };
  const iglesias = marcas.filter((m) => m.nombre === "Iglesia (por confirmar)");
  expect(iglesias).toHaveLength(1);
  return iglesias[0];
}

test("Iglesia: ejemplo privado, calendario, revisión doctrinal humana y nueva revisión", async ({
  page,
}) => {
  test.setTimeout(120000);
  await entrar(page.request, "admin@example.test");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/marcas");
  await page
    .getByRole("button", {
      name: /^(Añadir marca o cuenta|Crear mi primera marca)$/,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Preparar Iglesia (por confirmar)",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Iglesia (por confirmar)", exact: true }),
  ).toBeVisible();
  const inicial = await marcaIglesia(page.request);
  expect(inicial.cuentas).toEqual([]);
  expect(inicial.piezas).toEqual([]);
  expect(
    (await page.request.post("/api/marcas/iglesia", { data: {} })).status(),
  ).toBe(200);
  expect((await marcaIglesia(page.request)).id).toBe(inicial.id);
  await page
    .getByText("Plantillas, revisión y pendientes de Walter", { exact: true })
    .click();
  await expect(page.getByText(/Westminster/).first()).toBeVisible();
  await expect(page.getByText(/Heidelberg/).first()).toBeVisible();
  const editorial = page.getByRole("region", {
    name: "Contenido reformado para la congregación",
    exact: true,
  });
  await expect(editorial).toContainText("Horarios de ejemplo en Lima");
  for (const horario of [
    "Lunes · 08:00",
    "Miércoles · 19:00",
    "Viernes · 18:00",
    "Domingo · 19:00",
  ]) {
    await expect(editorial).toContainText(horario);
  }

  await page
    .getByRole("button", { name: "Crear una publicación", exact: true })
    .click();
  for (const nombre of [
    "versículo de la semana",
    "devocional pastoral",
    "anuncios de la congregación",
    "reel de predicación",
  ]) {
    await page
      .getByRole("button", { name: `Usar plantilla de ${nombre}`, exact: true })
      .click();
    await expect(
      page.getByLabel("Título de la pieza", { exact: true }),
    ).toHaveValue(/EJEMPLO/);
    await expect(
      page.getByRole("textbox", {
        name: "Texto de la publicación",
        exact: true,
      }),
    ).toHaveValue(/EJEMPLO/);
  }
  expect((await marcaIglesia(page.request)).piezas).toEqual([]);

  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Cuentas y conexión", exact: true })
    .click();
  await page
    .getByLabel("Nombre de la cuenta", { exact: true })
    .fill("@iglesia_ficticia");
  await page
    .getByLabel("Identificador de cuenta o perfil", { exact: true })
    .fill("839105789201");
  await page
    .getByLabel("Página vinculada (para Instagram)", { exact: true })
    .fill("839105789202");
  await page
    .getByRole("button", { name: "Añadir cuenta", exact: true })
    .click();
  await page.getByLabel(/Confirmé en Meta que es Business/).check();
  await page
    .getByRole("button", { name: "Verificar conexión", exact: true })
    .click();
  await expect(
    page.getByText("Conexión verificada.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Crear una publicación", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Usar plantilla de anuncios de la congregación",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(
    page.getByText("Borrador guardado.", { exact: false }),
  ).toBeVisible();
  const guardada = (await marcaIglesia(page.request)).piezas[0];
  expect(guardada.datos.ejemplo).toBe(true);
  const pieza = page.locator(`#pieza-${guardada.id}`);
  await pieza
    .getByRole("button", {
      name: "Preparar vista previa y enviar a Walter",
      exact: true,
    })
    .click();
  await expect(pieza).toContainText("historia · pendiente · Revisión 1");
  await expect(
    pieza.getByRole("button", { name: "Aprobar y programar", exact: true }),
  ).toBeDisabled();
  await pieza
    .getByRole("button", { name: "Revisar doctrina", exact: true })
    .click();
  await expect(
    pieza.getByRole("button", {
      name: "Registrar revisión doctrinal",
      exact: true,
    }),
  ).toBeDisabled();
  expect(
    (
      await page.request.post(`/api/marcas/pieza/${guardada.id}`, {
        data: { accion: "aprobar", revision: 1 },
      })
    ).status(),
  ).toBe(409);
  expect((await marcaIglesia(page.request)).piezas[0].estado).toBe("pendiente");

  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Editar guía", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Versión bíblica (si corresponde)").fill("RVR1960");
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await pieza
    .getByRole("button", { name: "Editar pieza", exact: true })
    .click();
  await page
    .getByLabel("Título de la pieza", { exact: true })
    .fill("Encuentro pastoral de ensayo");
  await page
    .getByRole("textbox", { name: "Texto de la publicación", exact: true })
    .fill(
      "Material ficticio del ensayo automatizado: encuentro pastoral revisado por el equipo.",
    );
  await page
    .getByLabel("Horario, lugar u otro detalle de la pieza")
    .fill("Datos ficticios del ensayo automatizado");
  await page
    .getByLabel(
      "Confirmo que sustituí los datos de ejemplo por información verificada",
    )
    .check();
  await page
    .getByRole("button", { name: "Guardar nueva revisión", exact: true })
    .click();
  await expect(pieza).toContainText("historia · borrador · Revisión 2");
  await pieza
    .getByRole("button", {
      name: "Preparar vista previa y enviar a Walter",
      exact: true,
    })
    .click();
  await expect(pieza).toContainText("historia · pendiente · Revisión 2");
  await expect(
    pieza.getByRole("button", { name: "Aprobar y programar", exact: true }),
  ).toBeDisabled();
  await pieza
    .getByRole("button", { name: "Revisar doctrina", exact: true })
    .click();
  await pieza
    .getByLabel("Responsable pastoral", { exact: true })
    .fill("Responsable ficticio del ensayo");
  await pieza
    .getByRole("textbox", {
      name: "Observaciones y fuentes de la revisión",
      exact: true,
    })
    .fill(
      "Revisión ficticia de texto, contexto, tono y permisos para este ensayo local.",
    );
  for (const control of revisionDoctrinalIglesia) {
    await pieza.getByLabel(control.etiqueta).check();
  }
  await pieza
    .getByRole("button", { name: "Registrar revisión doctrinal", exact: true })
    .click();
  await expect(
    page.getByText(
      "Revisión doctrinal registrada. Ya puedes aprobar esta pieza.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    pieza.getByRole("button", { name: "Aprobar y programar", exact: true }),
  ).toBeEnabled();
  mkdirSync(".cache/capturas-iglesia", { recursive: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `.cache/capturas-iglesia/revision-doctrinal-${width}.png`,
      fullPage: true,
    });
  }
  await pieza
    .getByRole("button", { name: "Aprobar y programar", exact: true })
    .click();
  await expect(pieza).toContainText("historia · programada · Revisión 2");
  expect(
    (await marcaIglesia(page.request)).piezas[0].revisionDoctrinal?.revision,
  ).toBe(2);
  await pieza
    .getByRole("button", { name: "Editar pieza", exact: true })
    .click();
  await page
    .getByLabel("Título de la pieza", { exact: true })
    .fill("Encuentro pastoral corregido en ensayo");
  await page
    .getByRole("button", { name: "Guardar nueva revisión", exact: true })
    .click();
  await expect(pieza).toContainText("historia · borrador · Revisión 3");
  expect(
    (await marcaIglesia(page.request)).piezas[0].revisionDoctrinal,
  ).toBeNull();
  await page.reload();
  await expect(pieza).toContainText("historia · borrador · Revisión 3");

  expect(
    (
      await page.request.post("/api/admin/permitidos", {
        data: { email: "privacidad@example.test" },
      })
    ).status(),
  ).toBe(200);
  await entrar(page.request, "privacidad@example.test");
  expect(await (await page.request.get("/api/marcas")).text()).not.toContain(
    inicial.id,
  );
  expect(
    (await page.request.post("/api/marcas/iglesia", { data: {} })).status(),
  ).toBe(403);
  await page.goto("/marcas");
  await expect(
    page.getByRole("button", {
      name: "Preparar Iglesia (por confirmar)",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Iglesia (por confirmar)", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
