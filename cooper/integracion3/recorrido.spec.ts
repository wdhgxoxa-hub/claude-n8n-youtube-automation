import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const dir = `${process.env.COOPER_MOVIMIENTO_SALIDA || ".cache/videos-integracion3"}/${process.env.COOPER_MOVIMIENTO_RONDA || "diagnostico"}`;
for (const width of [1440, 390]) {
  test(`recorrido completo continuo de ${width} px`, async ({
    browser,
    page,
    baseURL,
  }) => {
    mkdirSync(dir, { recursive: true });
    const auth = await page.request.post(
      `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT}/sesion`,
      {
        data: {
          email: "admin@example.test",
          secret: process.env.COOPER_E2E_SECRET,
        },
      },
    );
    expect(auth.ok()).toBe(true);
    const state = await (await page.request.get("/api/estado")).json();
    expect(
      (
        await page.request.patch("/api/perfil", {
          data: { ...state.user, theme: "oscuro" },
        })
      ).ok(),
    ).toBe(true);
    const context = await browser.newContext({
      baseURL,
      storageState: await page.context().storageState(),
      viewport: { width, height: 900 },
      recordVideo: { dir: `${dir}/temporales`, size: { width, height: 900 } },
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
    const steps: { ruta: string; segundos: number }[] = [];
    const started = Date.now();
    const paths = [
      "/entrar",
      "/",
      "/marcas",
      "/canales",
      `/canales/${state.channels[0].id}`,
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
      `/videos/${state.videos[0].id}`,
      "/publicados",
      "/aprendizaje",
      "/avatares",
      "/perfil",
      "/admin",
      "/admin/fabrica",
    ];
    for (const path of paths) {
      steps.push({ ruta: path, segundos: (Date.now() - started) / 1000 });
      await current.goto(path);
      await expect(current.locator("h1:visible")).toHaveCount(1);
      await expect(
        current.getByText("Consultando la fábrica…", { exact: true }),
      ).toHaveCount(0);
      await current.waitForTimeout(1000);
      if (path === "/") {
        await current
          .getByRole("button", { name: "Conocer el estudio" })
          .click();
        for (let step = 0; step < 2; step++) {
          await current.waitForTimeout(750);
          await current
            .getByRole("button", { name: "Continuar", exact: true })
            .click();
        }
        await current.getByRole("button", { name: "Empezar a crear" }).click();
        if (width === 390) {
          await current.getByRole("tab", { name: /^Fábrica/ }).click();
          await current.waitForTimeout(1000);
        }
      }
      if (path === "/marcas") {
        for (const tab of [
          "Estudio",
          "Publicados",
          "Aprendizaje",
          "Calendario",
        ]) {
          await current.getByRole("button", { name: tab, exact: true }).click();
          await current.waitForTimeout(700);
        }
      }
      await current.mouse.wheel(0, 450);
      await current.waitForTimeout(450);
      await current.evaluate(() => window.scrollTo(0, 0));
      expect(
        await current.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    }
    const clip = current.video()!;
    await context.close();
    await clip.saveAs(`${dir}/recorrido-completo-${width}.webm`);
    writeFileSync(
      `${dir}/recorrido-completo-${width}.json`,
      JSON.stringify({ width, height: 900, pasos: steps }, null, 2),
    );
  });
}
