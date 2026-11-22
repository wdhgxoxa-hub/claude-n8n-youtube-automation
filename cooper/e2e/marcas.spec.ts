import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
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
  const issues: unknown[] = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on("Audits.issueAdded", (issue) => issues.push(issue));
  await cdp.send("Audits.enable");
  await page.goto("/marcas");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .getByRole("button", {
      name: /^(Añadir marca o cuenta|Crear mi primera marca)$/,
    })
    .click();
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
  await page.getByRole("button", { name: "Competencia", exact: true }).click();
  await page
    .getByRole("button", { name: "Investigar competencia", exact: true })
    .click();
  await expect(
    page.getByText("Investigación actualizada.", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Modo simulado: no se investigaron cuentas reales.", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Competencia", exact: true }).click();
  await expect(
    page
      .getByText("Modo simulado: no se investigaron cuentas reales.", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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
  let solicitudesMedios = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/marcas/medio/")) solicitudesMedios++;
  });
  await page
    .getByRole("button", {
      name: "Preparar vista previa y enviar a Walter",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Pieza lista para la revisión de Walter.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".marca-galeria img")).toHaveCount(0);
  expect(solicitudesMedios).toBe(0);
  await page.getByText("Vista previa de la pieza", { exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "Nos reunimos el domingo, pieza 1",
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".marca-galeria img")
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(solicitudesMedios).toBeGreaterThan(0);
  mkdirSync(".cache/capturas-marcas", { recursive: true });
  for (const theme of ["oscuro"]) {
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
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
        window.scrollTo(0, 0);
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
  expect(issues).toEqual([]);
});
for (const width of [1440, 390])
  test(`Marcas: Sentinel ${width} recorre sus cinco secciones con el guardián activo`, async ({
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
    // El contexto con videos activos reproduce los pulsos SSE de la suite completa.
    const canal = await page.request.post("/api/orden", {
      data: { evento: "nuevo_canal", texto: "Ensayo de estabilidad Marcas" },
    });
    expect(canal.ok()).toBe(true);
    const { id: canalId } = await canal.json();
    for (let i = 0; i < 3; i++) {
      const video = await page.request.post("/api/orden", {
        data: {
          evento: "nuevo_video",
          recursoId: canalId,
          texto: `Ensayo ${i}`,
        },
      });
      expect(video.ok()).toBe(true);
    }
    await page.goto("/marcas");
    const folder = resolve(`.cache/sentinel-marcas/${width}`);
    const pantallas = [
      "calendario",
      "estudio",
      "competencia",
      "publicados",
      "aprendizaje",
    ].map((seccion) => `/marcas?seccion=${seccion}`);
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
        pantallas,
        excluir_selectores: [
          'a[href^="/"]:not([href^="/marcas"]):not([href^="/api/marcas/medio/"])',
        ],
        // El contrato común excluye las escrituras también en la ronda general;
        // Marcas y Montajes las ejercitan con acciones dirigidas autorizadas.
        duracion: 55,
        ancho: width,
        modulos: ["recorridos", "caos", "estabilidad"],
      }),
      { mode: 0o600 },
    );
    try {
      const python = resolve(".cache/sentinel-venv/bin/python");
      const result = await new Promise<{ code: number | null; log: string }>(
        (done, reject) => {
          const child = spawn(python, ["scripts/sentinel-cooper.py", config], {
            env: {
              ...process.env,
              PLAYWRIGHT_BROWSERS_PATH: resolve(".cache/sentinel-browsers"),
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
      const report = JSON.parse(
        readFileSync(resolve(folder, "informe.json"), "utf8"),
      );
      expect(report.modulos.map((m: { nombre: string }) => m.nombre)).toEqual([
        "recorridos",
        "caos",
        "estabilidad",
      ]);
      expect(
        report.medidas_caos.some((m: { acciones: number }) => m.acciones > 0),
      ).toBe(true);
      for (const path of pantallas) {
        expect(report.pantallas).toContain(path);
        expect(
          report.medidas_caos.some(
            (m: { url: string; acciones: number }) =>
              m.url === new URL(path, baseURL).href && m.acciones > 0,
          ),
          `Caos efectivo en ${path}`,
        ).toBe(true);
      }
    } finally {
      unlinkSync(session);
    }
  });
