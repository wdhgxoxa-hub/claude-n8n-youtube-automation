import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import type { Estado } from "../src/servicios/datos";
const ronda = process.env.COOPER_MOVIMIENTO_RONDA || "diagnostico";
const dir = `.cache/videos-movimiento/${ronda}`;
const fixture = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT}`;
async function login(page: Page) {
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
}
async function medir(page: Page) {
  return page.evaluate(async () => {
    const longTasks: number[] = [];
    let cls = 0;
    const tasks = new PerformanceObserver((l) =>
      longTasks.push(...l.getEntries().map((e) => e.duration)),
    );
    tasks.observe({ type: "longtask" });
    const shifts = new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => {
        const s = e as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!s.hadRecentInput) cls += s.value;
      }),
    );
    shifts.observe({ type: "layout-shift" });
    const intervals: number[] = [];
    await new Promise<void>((resolve) => {
      let last = 0,
        start = 0;
      function tick(t: number) {
        if (!start) start = t;
        if (last) intervals.push(t - last);
        last = t;
        if (t - start < 2000) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    tasks.disconnect();
    shifts.disconnect();
    const sorted = [...intervals].sort((a, b) => a - b);
    return {
      fps: 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length),
      p95: sorted[Math.floor(sorted.length * 0.95)],
      maxFrame: Math.max(...intervals),
      longTasks,
      cls,
      frames: intervals.length,
    };
  });
}
for (const width of [1440, 390])
  for (const theme of ["oscuro", "claro"])
    test(`${width} ${theme}: pantallas, scroll, pausa, vídeo y CPU ${width === 390 ? 4 : 1}x`, async ({
      browser,
      page,
      baseURL,
    }) => {
      mkdirSync(dir, { recursive: true });
      await login(page);
      const state: Estado = await (
        await page.request.get("/api/estado")
      ).json();
      expect(
        (
          await page.request.patch("/api/perfil", {
            data: { ...state.user, theme },
          })
        ).ok(),
      ).toBe(true);
      const storageState = await page.context().storageState();
      const channel = state.channels[0].id,
        video = state.videos[0].id;
      const paths = [
        "/entrar",
        "/",
        "/canales",
        `/canales/${channel}`,
        "/radar",
        "/rutina",
        "/redes",
        "/referencias",
        "/cuentas",
        "/programados",
        "/decisiones",
        "/incidencias",
        "/avisos",
        "/videos",
        `/videos/${video}`,
        "/publicados",
        "/aprendizaje",
        "/avatares",
        "/perfil",
        "/admin",
        "/admin/fabrica",
      ];
      const evidence = [];
      for (const [i, path] of paths.entries()) {
        const name = `${width}-${theme}-${String(i).padStart(2, "0")}-${path.split("/")[1] || "inicio"}`;
        const context = await browser.newContext({
          baseURL,
          storageState,
          viewport: { width, height: 900 },
          recordVideo: {
            dir: `${dir}/temporales`,
            size: { width, height: 900 },
          },
        });
        const current = await context.newPage();
        const errors: string[] = [];
        current.on("pageerror", (e) => errors.push(e.message));
        current.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
        });
        const cdp = await context.newCDPSession(current);
        await cdp.send("Emulation.setCPUThrottlingRate", {
          rate: width === 390 ? 4 : 1,
        });
        await current.goto(path);
        await expect(current.locator("h1:visible")).toHaveCount(1);
        if (path !== "/entrar")
          await expect(current.locator(".connection")).toHaveText("En vivo");
        await expect(
          current.getByText("Consultando la fábrica…", { exact: true }),
        ).toHaveCount(0);
        await current.waitForTimeout(900);
        const measure = await medir(current);
        // 60 Hz nominales: tolerancia de muestreo 5%; ningún atasco de 100 ms.
        expect(measure.fps, `${path}: FPS`).toBeGreaterThanOrEqual(57);
        expect(measure.p95, `${path}: p95 de frame`).toBeLessThanOrEqual(25);
        expect(measure.maxFrame, `${path}: frame más lento`).toBeLessThan(100);
        expect(
          Math.max(0, ...measure.longTasks),
          `${path}: long task`,
        ).toBeLessThan(100);
        expect(measure.cls, `${path}: CLS`).toBeLessThanOrEqual(0.01);
        await current.mouse.wheel(0, 380);
        await current.waitForTimeout(350);
        await current.mouse.wheel(0, -380);
        await current.waitForTimeout(350);
        expect(
          await current.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const button = current.getByRole("button", {
          name: "Actualizar",
          exact: true,
        });
        if (await button.count()) {
          await button.click();
          await expect(button).toBeEnabled();
        }
        const pause = current.getByRole("button", {
          name: "Pausar movimiento",
          exact: true,
        });
        await pause.click();
        await current.waitForTimeout(150);
        expect(
          await current.evaluate(() =>
            document
              .getAnimations()
              .filter((a) => a.playState === "running")
              .map((a) => ({
                target:
                  a.effect instanceof KeyframeEffect
                    ? (a.effect.target as Element)?.outerHTML.slice(0, 400)
                    : "",
                frames:
                  a.effect instanceof KeyframeEffect
                    ? a.effect.getKeyframes()
                    : [],
              })),
          ),
        ).toEqual([]);
        await current
          .getByRole("button", { name: "Activar movimiento", exact: true })
          .click();
        const interactions = ["entrada", "scroll", "pausa", "reanudar"];
        if (await button.count()) interactions.push("actualizar");
        const review = path.startsWith("/canales/")
          ? "Revisar tono"
          : (
              {
                "/rutina": "Revisar metas",
                "/redes": "Revisar redes",
                "/cuentas": "Revisar adopción",
                "/radar": "Solicitar nuevo radar",
                "/referencias": "Solicitar referencias pendientes",
                "/admin/fabrica": "Revisar ajustes",
              } as Record<string, string>
            )[path];
        if (path === "/cuentas")
          await current
            .getByLabel("Usuario de la cuenta")
            .fill("@ejemplo_movimiento");
        if (review) {
          await current
            .getByRole("button", { name: review, exact: true })
            .click();
          await expect(
            current.getByRole("region", { name: "Confirmar cambios" }),
          ).toBeVisible();
          await current.waitForTimeout(400);
          await current
            .getByRole("button", { name: "Cancelar", exact: true })
            .click();
          await expect(
            current.getByRole("region", { name: "Confirmar cambios" }),
          ).toHaveCount(0);
          interactions.push("preparar cambios", "cancelar sin enviar");
        }
        if (path === "/publicados") {
          await current
            .getByLabel("Métrica del gráfico")
            .first()
            .selectOption("meGusta");
          await current.waitForTimeout(650);
          await current
            .getByText("Ver datos de evolución", { exact: true })
            .first()
            .click();
          await expect(current.getByRole("table").first()).toBeVisible();
          interactions.push("cambiar métrica", "abrir tabla");
        }
        if (path === "/aprendizaje") {
          await current
            .getByRole("button", { name: "Corregidos", exact: true })
            .click();
          await current.waitForTimeout(350);
          interactions.push("filtrar corregidos");
        }
        await current.evaluate(() => window.scrollTo(0, 0));
        const axe = await new AxeBuilder({ page: current }).analyze();
        expect(axe.violations).toEqual([]);
        await current.screenshot({
          path: `${dir}/${name}.png`,
          fullPage: true,
        });
        expect(errors).toEqual([]);
        const clip = current.video()!;
        await context.close();
        copyFileSync(await clip.path(), `${dir}/${name}.webm`);
        evidence.push({
          name,
          path,
          width,
          theme,
          cpu: width === 390 ? 4 : 1,
          ...measure,
          video: `${name}.webm`,
          interacciones: interactions,
        });
        writeFileSync(
          `${dir}/pantallas-${width}-${theme}.json`,
          JSON.stringify(evidence, null, 2),
        );
      }
    });
