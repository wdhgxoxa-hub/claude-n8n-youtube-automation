import { expect, type Page, type Request } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Estado } from "../src/servicios/datos";

/**
 * Abre los formularios reales y sus revisiones locales en el servidor demo E2E.
 * No confirma solicitudes, cambios administrativos ni conciliaciones.
 * Debe ejecutarse después de retirar la intercepción de medio-real.
 */
export async function capturarFormulariosOperacion(
  page: Page,
  shot: (name: string) => Promise<unknown>,
) {
  const previousUrl = page.url();
  const width = page.viewportSize()?.width;
  const port = process.env.COOPER_E2E_DEMO_PORT;
  const fixturePort = process.env.COOPER_E2E_DEMO_FIXTURE_PORT;
  for (const value of [port, fixturePort])
    if (!value || !/^\d+$/.test(value) || +value < 1 || +value > 65535)
      throw new Error("Falta un puerto válido del ensayo demo aislado.");
  const origin = `http://127.0.0.1:${port}`;
  const fixture = `http://127.0.0.1:${fixturePort}`;
  expect(new URL(previousUrl).origin).toBe(origin);
  const response = await page.request.get(`${origin}/api/estado`);
  expect(response.ok()).toBe(true);
  const state: Estado = await response.json();
  expect(state.demo).toBe(true);
  expect(state.user.role).toBe("admin");
  expect(state.channels.length).toBeGreaterThan(0);
  const probe = await page.request.get(`${fixture}/destino`);
  expect(probe.ok()).toBe(true);
  expect(await probe.json()).toEqual({ destino: "cooper-e2e-aislado" });
  if (!process.env.COOPER_E2E_SECRET || !width)
    throw new Error("Falta el contexto efímero de la matriz.");

  const writes: string[] = [];
  const watchWrites = (request: Request) => {
    const url = new URL(request.url());
    if (
      url.origin === origin &&
      url.pathname.startsWith("/api/") &&
      !["GET", "HEAD"].includes(request.method())
    )
      writes.push(`${request.method()} ${url.pathname}`);
  };
  page.on("request", watchWrites);
  const screens: string[] = [];
  const capture = async (name: string) => {
    expect(writes, "Abrir y revisar no ejecuta operaciones").toEqual([]);
    await shot(name);
    screens.push(name);
  };
  const main = page.getByRole("main");
  async function open(path: string, summary: string) {
    await page.goto(new URL(path, origin).href);
    await main.getByText(summary, { exact: true }).click();
  }
  try {
    await open(`/canales/${state.channels[0].id}`, "Editar tono");
    const tone = main.getByRole("textbox", { name: "Tono", exact: true });
    await expect(tone).toBeVisible();
    await tone.fill("Claro, cercano y preciso. Una idea cotidiana por video.");
    await capture("operacion-tono-editar");
    await main
      .getByRole("button", { name: "Revisar tono", exact: true })
      .click();
    const confirmation = main.getByRole("region", {
      name: "Confirmar cambios",
      exact: true,
    });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText("Actualizar biblia");
    await capture("operacion-tono-confirmar");
    await confirmation
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    await expect(confirmation).toBeHidden();

    await open("/rutina", "Ajustar metas");
    await expect(
      main.getByLabel("Videos por semana", { exact: true }),
    ).toBeVisible();
    await capture("operacion-metas-editar");

    await open("/redes", "Editar redes");
    await expect(
      main.getByLabel("Perfil de publicación", { exact: true }),
    ).toBeVisible();
    await capture("operacion-redes-editar");

    await open("/cuentas", "Estudiar una cuenta");
    const account = main.getByLabel("Usuario de la cuenta", { exact: true });
    await expect(account).toBeVisible();
    await account.fill("@ciencia_cotidiana");
    await capture("operacion-cuenta-estudiar");

    await open("/admin/fabrica", "Editar controles de producción");
    const voice = main.getByRole("checkbox", { name: "Voz", exact: true });
    await expect(voice).toBeVisible();
    await voice.setChecked(!(await voice.isChecked()));
    await capture("administracion-fabrica-editar");
    await main
      .getByRole("button", { name: "Revisar ajustes", exact: true })
      .click();
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText("Guardar ajustes administrativos");
    await expect(confirmation).toContainText("Voz");
    await capture("administracion-fabrica-confirmar");
    await confirmation
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    await expect(confirmation).toBeHidden();

    // El emisor existente inserta un caso ficticio en la base temporal E2E.
    // No se consulta ni cambia ninguna operación externa.
    await page.goto("about:blank");
    const session = await page.request.post(`${fixture}/sesion`, {
      data: {
        email: "admin@example.test",
        secret: process.env.COOPER_E2E_SECRET,
        escenario: "conciliacion",
      },
    });
    expect(session.ok()).toBe(true);
    await page.goto(`${origin}/admin`);
    await main
      .getByRole("button", {
        name: "Consultar operaciones interrumpidas",
        exact: true,
      })
      .click();
    await main
      .getByRole("button", {
        name: "Revisar operación e2e-conciliacion",
        exact: true,
      })
      .click();
    await expect(
      main.getByRole("heading", {
        name: "Revisión de la operación",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      main.getByRole("combobox", {
        name: "Decisión de conciliación",
        exact: true,
      }),
    ).toBeVisible();
    await capture("administracion-conciliacion-revisar");
  } finally {
    page.off("request", watchWrites);
    mkdirSync("../evidencias-diseno", { recursive: true });
    writeFileSync(
      `../evidencias-diseno/formularios-operacion-${width}.json`,
      JSON.stringify(
        {
          width,
          servidor: "E2E demo, proveedores simulados y base temporal",
          pantallas: screens,
          escriturasDesdeNavegador: writes,
          limite:
            "La revisión de conciliación usa el caso e2e-conciliacion del emisor aislado. Ninguna solicitud ni conciliación se confirma.",
        },
        null,
        2,
      ),
    );
    await page.goto(previousUrl);
  }
  expect(writes, "La cobertura visual no envía cambios").toEqual([]);
}
