import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
const ronda = process.env.COOPER_COBERTURA_RONDA || "diagnostico";
const dir = `.cache/capturas-cobertura/${ronda}`;
const fixture = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT ?? "33173"}`;
async function sesion(page: Page) {
  expect(
    (
      await page.request.post(`${fixture}/sesion`, {
        data: {
          email: "admin@example.test",
          secret: process.env.COOPER_E2E_SECRET,
        },
      })
    ).status(),
  ).toBe(200);
}
async function rutas(page: Page) {
  const op = await (await page.request.get("/api/operacion")).json();
  return [
    `/canales/${op.canales[0].id}`,
    "/radar",
    "/rutina",
    "/redes",
    "/referencias",
    "/cuentas",
    "/programados",
    "/decisiones",
    "/incidencias",
    "/avisos",
    "/admin/fabrica",
  ];
}
test.beforeEach(async ({ page }) => {
  mkdirSync(dir, { recursive: true });
  await sesion(page);
});
for (const theme of ["oscuro", "claro"])
  for (const width of [360, 390, 768, 1024, 1440, 1920])
    test(`${width}px ${theme}: todas las pantallas nuevas`, async ({
      page,
    }) => {
      test.setTimeout(180000);
      const perfil = await (await page.request.get("/api/estado")).json();
      expect(
        (
          await page.request.patch("/api/perfil", {
            data: { ...perfil.user, theme },
          })
        ).ok(),
      ).toBe(true);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      const paths = await rutas(page);
      for (const [i, path] of paths.entries()) {
        await page.goto(path);
        // Next puede conservar temporalmente un árbol oculto durante la hidratación.
        // Comprobar la única pantalla visible evita elegir ese árbol de respaldo.
        const pantalla = page.locator(".operation-page:visible");
        await expect(pantalla).toHaveCount(1);
        await expect(pantalla.locator("h1")).toBeVisible();
        await expect(pantalla.getByText("Consultando la fábrica…")).toHaveCount(
          0,
        );
        await expect(
          page.getByRole("button", { name: "Actualizar", exact: true }),
        ).toBeEnabled();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        const ax = await new AxeBuilder({ page }).analyze();
        expect(ax.violations, JSON.stringify(ax.violations)).toEqual([]);
        await page.keyboard.press("Tab");
        await page.screenshot({
          path: `${dir}/${width}-${theme}-${i}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
      expect(errors).toEqual([]);
    });
test("Sistema Sentinel: recorridos, caos y estabilidad sobre sesión local", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(600000);
  const perfil = await (await page.request.get("/api/estado")).json();
  expect(
    (
      await page.request.patch("/api/perfil", {
        headers: { Origin: baseURL! },
        data: { ...perfil.user, theme: "oscuro" },
      })
    ).ok(),
  ).toBe(true);
  const paths = await rutas(page);
  const statePath = resolve(dir, "sesion-efimera.json");
  await page.context().storageState({ path: statePath });
  const configPath = resolve(dir, "sentinel-config.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      url: baseURL,
      fixture,
      sesion: statePath,
      salida: resolve(dir, "sentinel"),
      pantallas: paths,
      duracion: 160,
      esperar_operacion: true,
      ancho: 1440,
    }),
    { mode: 0o600 },
  );
  try {
    const python =
      process.env.SENTINEL_PYTHON ||
      `${process.env.HOME}/Proyectos/Sistema-Sentinel/codigo/.venv/bin/python`;
    const result = await new Promise<{ code: number | null; log: string }>(
      (done, reject) => {
        const child = spawn(
          python,
          ["scripts/sentinel-cooper.py", configPath],
          {
            env: {
              ...process.env,
              PLAYWRIGHT_BROWSERS_PATH: resolve(".cache/sentinel-browsers"),
            },
            detached: true,
          },
        );
        let log = "";
        const timer = setTimeout(() => {
          process.kill(-child.pid!, "SIGTERM");
          reject(new Error("Sentinel excedió 540 s"));
        }, 540000);
        child.stdout.on("data", (d) => {
          log += String(d);
        });
        child.stderr.on("data", (d) => {
          log += String(d);
        });
        child.on("error", reject);
        child.on("exit", (code) => {
          clearTimeout(timer);
          done({ code, log });
        });
      },
    );
    writeFileSync(`${dir}/sentinel.log`, result.log);
    expect(result.code, result.log).toBe(0);
    const report = JSON.parse(
      readFileSync(`${dir}/sentinel/informe.json`, "utf8"),
    );
    expect(report.pantallas.length).toBeGreaterThanOrEqual(10);
  } finally {
    unlinkSync(statePath);
  }
});
