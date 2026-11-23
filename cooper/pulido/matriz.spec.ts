import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
const ronda = process.env.COOPER_PULIDO_RONDA || "diagnostico";
const dir = `.cache/capturas-pulido/${ronda}`;
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
  const data = await (await page.request.get("/api/estado")).json();
  return [
    "/",
    "/canales",
    "/videos",
    `/videos/${data.videos[0].id}`,
    `/videos/${data.videos[3].id}`,
    "/publicados",
    "/aprendizaje",
    "/avatares",
    "/perfil",
    "/admin",
  ];
}
test.beforeEach(async ({ page }) => {
  mkdirSync(dir, { recursive: true });
  await sesion(page);
});
// Dos temas oscuros del selector de apariencia (lib/temas.ts).
for (const theme of ["feria", "sala"])
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    test(`${width}px ${theme}: pantallas, teclado, axe, consola y fluidez`, async ({
      page,
    }) => {
      const respuestaPerfil = await page.request.get("/api/estado");
      const perfil = await respuestaPerfil.json();
      expect(
        (
          await page.request.patch("/api/perfil", {
            headers: { Origin: new URL(respuestaPerfil.url()).origin },
            data: { ...perfil.user, theme },
          })
        ).ok(),
      ).toBe(true);
      await page.setViewportSize({ width, height: 900 });
      const errores: string[] = [];
      page.on("pageerror", (e) => errores.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text());
      });
      page.on("response", (r) => {
        if (r.status() >= 400)
          errores.push(`${r.status()} ${new URL(r.url()).pathname}`);
      });
      await page.addInitScript(() => {
        const w = window as unknown as {
          mediciones: { cls: number; longTasks: number[] };
        };
        w.mediciones = { cls: 0, longTasks: [] };
        new PerformanceObserver((l) =>
          l.getEntries().forEach((e) => {
            const x = e as PerformanceEntry & {
              hadRecentInput: boolean;
              value: number;
            };
            if (!x.hadRecentInput) w.mediciones.cls += x.value;
          }),
        ).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((l) =>
          l
            .getEntries()
            .forEach((e) => w.mediciones.longTasks.push(e.duration)),
        ).observe({ type: "longtask", buffered: true });
      });
      const medidas = [];
      for (const [i, path] of (await rutas(page)).entries()) {
        const start = Date.now();
        await page.goto(path);
        await expect(page.locator(".connection")).toHaveText("En vivo");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const respuestaMs = Date.now() - start;
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const measure = await page.evaluate(async () => {
          const tiempos: number[] = [];
          let last = performance.now();
          const start = last;
          await new Promise<void>((done) => {
            function tick(t: number) {
              tiempos.push(t - last);
              last = t;
              if (t - start < 1000) requestAnimationFrame(tick);
              else done();
            }
            requestAnimationFrame(tick);
          });
          return {
            ...(
              window as unknown as {
                mediciones: { cls: number; longTasks: number[] };
              }
            ).mediciones,
            fps: 1000 / (tiempos.reduce((a, b) => a + b, 0) / tiempos.length),
          };
        });
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(result.violations, `${path}: axe`).toEqual([]);
        medidas.push({ path, respuestaMs, ...measure });
        expect(measure.cls, `${path}: CLS`).toBeLessThanOrEqual(0.1);
        expect(measure.fps, `${path}: FPS`).toBeGreaterThanOrEqual(45);
        if (path === "/publicados") {
          for (const b of await page.locator(".filters button:visible").all()) {
            await b.click();
            await expect(b).toHaveAttribute("aria-pressed", "true");
          }
          for (const select of await page
            .getByLabel("Métrica del gráfico")
            .all())
            for (const value of [
              "meGusta",
              "comentarios",
              "retencion",
              "vistas",
            ])
              await select.selectOption(value);
          for (const detail of await page
            .locator(".evolution summary:visible")
            .all()) {
            await detail.click();
            await detail.click();
          }
        }
        if (path === "/aprendizaje" || path === "/videos")
          for (const b of await page.locator(".filters button:visible").all()) {
            await b.click();
            await expect(b).toHaveAttribute("aria-pressed", "true");
          }
        if (path === "/videos") {
          await page
            .getByRole("button", { name: "Pedir video", exact: true })
            .click();
          await expect(page.getByLabel("Idea del video")).toBeVisible();
          await page
            .getByRole("button", { name: "Cancelar", exact: true })
            .click();
        }
        if (path === "/canales")
          for (const summary of await page
            .locator("details summary:visible")
            .all()) {
            await summary.click();
            await summary.click();
          }
        if (path === "/canales") {
          const modo = page
            .getByRole("button", { name: /Modo noticia:/ })
            .first();
          const before = await modo.getAttribute("aria-pressed");
          await modo.click();
          await expect(modo).toHaveAttribute(
            "aria-pressed",
            before === "true" ? "false" : "true",
          );
          await modo.click();
          await expect(modo).toHaveAttribute("aria-pressed", before!);
        }
        await page.getByRole("heading", { level: 1 }).click();
        await page.waitForTimeout(800); // Terminar las transiciones provocadas por los filtros.
        await page.screenshot({
          path: `${dir}/${width}-${theme}-${i}.png`,
          fullPage: true,
        });
        if (width < 768) {
          await page.getByRole("button", { name: "Abrir navegación" }).click();
          await expect(
            page.getByRole("link", { name: "Aprendizaje", exact: true }),
          ).toBeVisible();
          await page.keyboard.press("Escape");
        }
      }
      writeFileSync(
        `${dir}/metricas-${width}-${theme}.json`,
        JSON.stringify(medidas, null, 2),
      );
      expect(errores).toEqual([]);
    });
  }
test("Sistema Sentinel: recorridos, caos y estabilidad sobre sesión local", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(300000);
  const perfil = await (await page.request.get("/api/estado")).json();
  expect(
    (
      await page.request.patch("/api/perfil", {
        headers: { Origin: baseURL! },
        data: { ...perfil.user, theme: "feria" },
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
      duracion: 55,
      ancho: 1440,
    }),
    { mode: 0o600 },
  );
  try {
    const python = resolve(".cache/sentinel-venv/bin/python");
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
          reject(new Error("Sentinel excedió 240 s"));
        }, 240000);
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
