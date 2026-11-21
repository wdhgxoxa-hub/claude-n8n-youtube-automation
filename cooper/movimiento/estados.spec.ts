import { test, expect } from "@playwright/test";
import { mkdirSync, copyFileSync, writeFileSync } from "node:fs";
const dir = `${process.env.COOPER_MOVIMIENTO_SALIDA || ".cache/videos-movimiento"}/${process.env.COOPER_MOVIMIENTO_RONDA || "diagnostico"}`;
for (const width of [1440, 390])
  test(`${width}: vacío, ilustración sin motor, enlace vencido y página ausente`, async ({
    browser,
    page,
    baseURL,
  }) => {
    mkdirSync(dir, { recursive: true });
    expect(
      (
        await page.request.post(
          `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT}/sesion`,
          {
            data: {
              email: "admin@example.test",
              secret: process.env.COOPER_E2E_SECRET,
            },
          },
        )
      ).ok(),
    ).toBe(true);
    const context = await browser.newContext({
      baseURL,
      storageState: await page.context().storageState(),
      viewport: { width, height: 900 },
      recordVideo: { dir: `${dir}/temporales`, size: { width, height: 900 } },
    });
    const p = await context.newPage();
    const errors: string[] = [];
    p.on("pageerror", (e) => errors.push(e.message));
    // Un JSON defectuoso simula que el activo no llega; nunca se vacía el contenido útil.
    await p.route("**/movimiento/*.json", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: "no es JSON",
      }),
    );
    const state = await (await p.request.get("/api/estado")).json();
    state.channels = [];
    state.videos = [];
    state.messages = [];
    await p.route("**/api/eventos", (r) =>
      r.fulfill({
        contentType: "text/event-stream",
        body: `event: estado\ndata: ${JSON.stringify(state)}\n\n`,
      }),
    );
    await p.goto("/");
    // El SSE de esta fixture es finito: comprobar el estado recibido, no una conexión abierta.
    if (width === 390) await p.getByRole("tab", { name: /Fábrica/ }).click();
    await expect(
      p.getByRole("heading", { name: "Tu primera historia empieza aquí" }),
    ).toBeVisible();
    await p.waitForTimeout(1200);
    await expect(p.locator(".factory-pane .illustration-poster")).toBeVisible();
    await expect(p.locator(".factory-pane .lottie-layer svg")).toHaveCount(0);
    await p.screenshot({
      path: `${dir}/${width}-vacio-fallback.png`,
      fullPage: true,
    });
    await p.unrouteAll({ behavior: "wait" });
    await p.goto("/una-pagina-ausente");
    await expect(
      p.getByRole("heading", { name: "Este espacio no está disponible." }),
    ).toBeVisible();
    await p.waitForTimeout(1100);
    await p.screenshot({ path: `${dir}/${width}-ausente.png` });
    await p.goto("/revisar/whatsapp/enlace-ficticio");
    await expect(
      p.getByRole("heading", { name: "Este enlace ya no está disponible" }),
    ).toBeVisible();
    await p.waitForTimeout(1100);
    await p
      .getByRole("button", { name: "Pausar movimiento", exact: true })
      .click();
    await p.waitForTimeout(150);
    expect(
      await p.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    ).toBe(0);
    await p.screenshot({ path: `${dir}/${width}-enlace-vencido.png` });
    expect(errors).toEqual([]);
    const clip = p.video()!;
    await context.close();
    copyFileSync(await clip.path(), `${dir}/${width}-estados.webm`);
    writeFileSync(
      `${dir}/${width}-estados.json`,
      JSON.stringify(
        {
          width,
          video: `${width}-estados.webm`,
          estados: [
            "vacío ficticio por SSE",
            "fallback sin motor Lottie",
            "404",
            "enlace vencido",
            "pausa",
          ],
        },
        null,
        2,
      ),
    );
  });
