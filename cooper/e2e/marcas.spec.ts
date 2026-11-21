import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
const fixture = () => `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}`;
test("Marcas: alta, estudio, pieza, revisión, edición y matriz accesible", async ({
  page,
}) => {
  expect(
    (
      await page.request.post(`${fixture()}/sesion`, {
        data: {
          email: "admin@example.test",
          secret: process.env.COOPER_E2E_SECRET,
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/marcas");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Añadir marca o cuenta" }).click();
  await page
    .getByRole("textbox", { name: "Nombre de la marca" })
    .fill("Iglesia de ensayo");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Iglesia de ensayo", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Nombre de la cuenta", { exact: true })
    .fill("@iglesia_ensayo");
  await page
    .getByLabel("Identificador de cuenta o perfil", { exact: true })
    .fill("123456789");
  await page
    .getByLabel("Página vinculada (para Instagram)", { exact: true })
    .fill("987654321");
  await page
    .getByRole("button", { name: "Añadir cuenta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Verificar conexión", exact: true })
    .click();
  await expect(
    page.getByText("Conexión verificada.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Estudio", exact: true }).click();
  await page
    .getByRole("button", { name: "Estudiar la cuenta", exact: true })
    .click();
  await expect(page.getByText(/Muestra: 6 publicaciones/)).toBeVisible();
  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  await page
    .getByLabel("Título de la pieza", { exact: true })
    .fill("Nos reunimos el domingo");
  await page
    .getByLabel("Horario, lugar u otro detalle de la pieza")
    .fill("Domingo · 10:00 · Auditorio");
  await page
    .getByRole("button", { name: "Proponer texto con el especialista" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Texto de la publicación", exact: true }),
  ).not.toHaveValue("");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(
    page.getByText("Borrador guardado.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Preparar vista previa y enviar a Walter",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Pieza lista para la revisión de Walter.", { exact: true }),
  ).toBeVisible();
  await page.getByText("Vista previa de la pieza", { exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "Nos reunimos el domingo, pieza 1",
      exact: true,
    }),
  ).toBeVisible();
  mkdirSync(".cache/capturas-marcas", { recursive: true });
  for (const theme of ["oscuro", "claro"]) {
    await page.evaluate(
      (t) => (document.documentElement.dataset.theme = t),
      theme,
    );
    for (const width of [360, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
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
      });
      await page.screenshot({
        path: `.cache/capturas-marcas/${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page
    .getByRole("button", { name: "Aprobar y programar", exact: true })
    .click();
  await expect(
    page.getByText(/imagen · programada · Revisión 1/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar pieza", exact: true }).click();
  await page
    .getByLabel("Título de la pieza", { exact: true })
    .fill("Horario revisado");
  await page
    .getByRole("button", { name: "Guardar nueva revisión", exact: true })
    .click();
  await expect(page.getByText(/imagen · borrador · Revisión 2/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Horario revisado" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("Marcas: Sentinel recorre la instancia efímera con su guardián activo", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(240000);
  expect(
    (
      await page.request.post(`${fixture()}/sesion`, {
        data: {
          email: "admin@example.test",
          secret: process.env.COOPER_E2E_SECRET,
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/marcas");
  const folder = resolve(".cache/sentinel-marcas");
  mkdirSync(folder, { recursive: true });
  const session = resolve(folder, "sesion-efimera.json"),
    config = resolve(folder, "config.json");
  await page.context().storageState({ path: session });
  writeFileSync(
    config,
    JSON.stringify({
      url: baseURL,
      fixture: fixture(),
      sesion: session,
      salida: folder,
      pantallas: ["/marcas"],
      duracion: 55,
      ancho: 390,
      modulos: ["recorridos", "caos", "estabilidad"],
    }),
    { mode: 0o600 },
  );
  try {
    const python =
      process.env.SENTINEL_PYTHON ||
      `${process.env.HOME}/Proyectos/Sistema-Sentinel/codigo/.venv/bin/python`;
    const result = await new Promise<{ code: number | null; log: string }>(
      (done, reject) => {
        const child = spawn(python, ["scripts/sentinel-cooper.py", config], {
          env: {
            ...process.env,
            PLAYWRIGHT_BROWSERS_PATH: `${process.env.HOME}/.cache/ms-playwright`,
          },
          detached: true,
        });
        let log = "";
        const timer = setTimeout(() => {
          process.kill(-child.pid!, "SIGTERM");
          reject(new Error("Sentinel excedió 210 s"));
        }, 210000);
        child.stdout.on("data", (d) => {
          log += String(d);
        });
        child.stderr.on("data", (d) => {
          log += String(d);
        });
        child.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.on("exit", (code) => {
          clearTimeout(timer);
          done({ code, log });
        });
      },
    );
    writeFileSync(resolve(folder, "ejecucion.log"), result.log);
    expect(result.code, result.log).toBe(0);
  } finally {
    unlinkSync(session);
  }
});
