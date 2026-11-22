import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import type { Estado } from "../src/servicios/datos";
const ronda = process.env.COOPER_MOVIMIENTO_RONDA || "diagnostico";
const dir = `${process.env.COOPER_MOVIMIENTO_SALIDA || ".cache/videos-movimiento"}/${ronda}`;
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
// Comprueba la pausa con el control real del Perfil, abierto en otra pestaña
// del mismo navegador: la preferencia viaja por localStorage y la pantalla
// medida debe detenerse en vivo, sin recargar (src/componentes/movimiento.tsx).
async function cambiarMovimiento(
  perfil: Page,
  current: Page,
  pausar: boolean,
) {
  const [antes, despues] = pausar
    ? ["Pausar movimiento", "Activar movimiento"]
    : ["Activar movimiento", "Pausar movimiento"];
  await perfil.getByRole("button", { name: antes, exact: true }).click();
  await expect(
    perfil.getByRole("button", { name: despues, exact: true }),
  ).toHaveAttribute("aria-pressed", String(pausar));
  // La entrada (/entrar) no tiene armazón; el resto lo marca en .workspace.
  if (await current.locator(".workspace").count())
    await expect(current.locator(".workspace")).toHaveAttribute(
      "data-motion",
      pausar ? "paused" : "playing",
    );
}
for (const width of [1440, 390])
  // El tema claro se retiró (docs/diseno/DIRECCION.md:7, «tema oscuro, único
  // tema de esta versión»; src/app/layout.tsx fija data-theme="oscuro"), pero
  // la API y la base aún aceptan «claro» guardado de antes. La variante
  // «claro» comprueba ahora que un perfil heredado con «claro» ve la misma
  // sala oscura, sin errores y con los mismos umbrales.
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
      const brands = await (await page.request.get("/api/marcas")).json();
      if (!brands.marcas.length) {
        expect(
          (
            await page.request.post("/api/marcas", {
              data: { nombre: "Marca de integración", rubro: "general" },
            })
          ).ok(),
        ).toBe(true);
      }
      const storageState = await page.context().storageState();
      const channel = state.channels[0].id,
        video = state.videos[0].id;
      const paths = [
        "/entrar",
        "/",
        "/marcas",
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
        await expect(current.locator("html")).toHaveAttribute(
          "data-theme",
          "oscuro",
        );
        // El diseño nuevo ya no pinta «En vivo»: solo avisa del corte. El
        // enlace en vivo se lee en data-conexion del armazón.
        if (path !== "/entrar") {
          await expect(current.locator(".workspace")).toHaveAttribute(
            "data-conexion",
            "activa",
          );
          await expect(current.getByTestId("estado-conexion")).toHaveCount(0);
        }
        await expect(
          current.getByText("Consultando la fábrica…", { exact: true }),
        ).toHaveCount(0);
        await current.waitForTimeout(900);
        await current.locator("input[pattern]").evaluateAll((inputs) => {
          for (const input of inputs)
            new RegExp(`^(?:${input.getAttribute("pattern")})$`, "v");
        });
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
        // «Pausar movimiento» vive ahora solo en /perfil (src/componentes/perfil.tsx).
        let perfil = current;
        if (path !== "/perfil") {
          perfil = await context.newPage();
          perfil.on("pageerror", (e) => errors.push(`perfil: ${e.message}`));
          perfil.on("console", (m) => {
            if (m.type() === "error") errors.push(`perfil: ${m.text()}`);
          });
          await perfil.goto("/perfil");
          await current.bringToFront();
          // Abrir otra pestaña no debe pausar por sí solo (pestaña oculta).
          if (await current.locator(".workspace").count())
            await expect(current.locator(".workspace")).toHaveAttribute(
              "data-motion",
              "playing",
            );
        }
        await cambiarMovimiento(perfil, current, true);
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
        await cambiarMovimiento(perfil, current, false);
        if (perfil !== current) await perfil.close();
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
        // Los formularios de revisión viven ahora plegados en un <details>.
        const desplegable = path.startsWith("/canales/")
          ? "Editar tono"
          : (
              {
                "/rutina": "Ajustar metas",
                "/redes": "Editar redes",
                "/cuentas": "Estudiar una cuenta",
                "/admin/fabrica": "Editar controles de producción",
              } as Record<string, string>
            )[path];
        if (desplegable) {
          await current
            .getByRole("main")
            .getByText(desplegable, { exact: true })
            .click();
          interactions.push(`abrir «${desplegable}»`);
        }
        if (path === "/cuentas")
          await current
            .getByLabel("Usuario de la cuenta")
            .fill("@ejemplo_movimiento");
        if (path === "/redes")
          await current
            .getByLabel("Perfil de publicación")
            .fill("estudio_movimiento");
        if (path === "/admin/fabrica")
          await current.getByLabel("Voz", { exact: true }).click();
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
        if (path === "/marcas") {
          // «Competencia» es una sección nueva de la marca en este diseño.
          const secciones = current.getByRole("navigation", {
            name: "Secciones de la marca",
            exact: true,
          });
          for (const tab of [
            "Estudio",
            "Competencia",
            "Publicados",
            "Aprendizaje",
            "Calendario",
          ]) {
            await secciones
              .getByRole("button", { name: tab, exact: true })
              .click();
            await expect(
              secciones.getByRole("button", { name: tab, exact: true }),
            ).toHaveAttribute("aria-current", "page");
            expect(
              (await new AxeBuilder({ page: current }).analyze()).violations,
            ).toEqual([]);
            interactions.push(`marcas: ${tab}`);
          }
        }
        if (path === "/publicados") {
          // El gráfico de evolución vive ahora en el diálogo de cifras de cada
          // publicación de video (src/componentes/resultados.tsx).
          await current
            .getByRole("button", { name: "Filtros", exact: true })
            .click();
          await current
            .getByRole("group", { name: "Tipo de publicación" })
            .getByRole("button", { name: "Videos", exact: true })
            .click();
          await current
            .getByRole("button", { name: /^Ver cifras de / })
            .filter({ visible: true })
            .first()
            .click();
          const cifras = current.locator("dialog[open]");
          await expect(cifras).toBeVisible();
          await cifras
            .getByLabel("Métrica del gráfico")
            .first()
            .selectOption("meGusta");
          await current.waitForTimeout(650);
          await cifras
            .getByText("Ver datos de evolución", { exact: true })
            .first()
            .click();
          await expect(cifras.getByRole("table").first()).toBeVisible();
          expect(
            (await new AxeBuilder({ page: current }).analyze()).violations,
          ).toEqual([]);
          await cifras
            .getByRole("button", { name: "Cerrar cifras", exact: true })
            .click();
          await expect(cifras).toHaveCount(0);
          interactions.push(
            "abrir filtros",
            "filtrar videos",
            "abrir cifras",
            "cambiar métrica",
            "abrir tabla",
            "cerrar cifras",
          );
        }
        if (path === "/aprendizaje") {
          await current
            .getByRole("group", { name: "Filtrar fallos" })
            .getByRole("button", { name: "Corregidos", exact: true })
            .click();
          await expect(
            current
              .getByRole("group", { name: "Filtrar fallos" })
              .getByRole("button", { name: "Corregidos", exact: true }),
          ).toHaveAttribute("aria-pressed", "true");
          await current.waitForTimeout(350);
          interactions.push("filtrar corregidos");
        }
        await current.evaluate(() => window.scrollTo(0, 0));
        // Reanudar el movimiento vuelve a lanzar las entradas de un solo uso
        // (opacidad desde 0); axe audita el estado asentado, no un fundido a
        // medias. Se ignoran los bucles y las ligadas al scroll, que no acaban.
        const animacionesAntesDeAxe = await current.evaluate(async () => {
          const finitas = document
            .getAnimations()
            .filter(
              (a) =>
                a.playState === "running" &&
                a.timeline instanceof DocumentTimeline &&
                Number.isFinite(a.effect?.getComputedTiming().endTime),
            );
          await Promise.race([
            Promise.all(finitas.map((a) => a.finished.catch(() => null))),
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ]);
          return finitas.map(
            (a) =>
              (a as CSSAnimation).animationName ||
              (a as CSSTransition).transitionProperty ||
              a.constructor.name,
          );
        });
        const axe = await new AxeBuilder({ page: current }).analyze();
        expect(axe.violations).toEqual([]);
        const controles = await current
          .locator("button, a[href], input, select, textarea, summary")
          .evaluateAll((elements) =>
            elements
              .filter((element) => element.getClientRects().length)
              .map((element) => ({
                tipo: element.tagName.toLowerCase(),
                nombre:
                  element.getAttribute("aria-label") ||
                  (element instanceof HTMLInputElement ||
                  element instanceof HTMLSelectElement ||
                  element instanceof HTMLTextAreaElement
                    ? [...(element.labels || [])]
                        .map((l) => l.textContent)
                        .join(" ")
                    : element.textContent
                  )?.trim(),
                destino: element.getAttribute("href"),
                deshabilitado: element.matches(":disabled"),
              })),
          );
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
          animacionesAntesDeAxe,
          controles,
        });
        writeFileSync(
          `${dir}/pantallas-${width}-${theme}.json`,
          JSON.stringify(evidence, null, 2),
        );
      }
    });
