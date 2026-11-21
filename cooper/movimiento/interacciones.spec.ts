import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
const dir = `${process.env.COOPER_MOVIMIENTO_SALIDA || ".cache/videos-movimiento"}/${process.env.COOPER_MOVIMIENTO_RONDA || "diagnostico"}`;
for (const width of [1440, 390])
  test(`${width}: bienvenida, Lottie, pausa persistente, publicación y movimiento reducido`, async ({
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
      permissions: ["microphone"],
      storageState: await page.context().storageState(),
      viewport: { width, height: 900 },
      recordVideo: { dir: `${dir}/temporales`, size: { width, height: 900 } },
    });
    const p = await context.newPage();
    const errors: string[] = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("/");
    await expect(p.locator(".connection")).toHaveText("En vivo");
    await p.getByRole("button", { name: "Conocer el estudio" }).click();
    const tour = p.getByRole("dialog", { name: "Una idea, un equipo." });
    await expect(tour).toBeVisible();
    await expect(tour.locator(".lottie-layer")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await p.waitForTimeout(1100);
    await tour.getByRole("button", { name: "Continuar" }).click();
    await p.waitForTimeout(1100);
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Continuar" })
      .click();
    await p.waitForTimeout(1600);
    await p.getByRole("button", { name: "Empezar a crear" }).click();
    await expect(p.getByRole("dialog")).toHaveCount(0);
    await expect(
      p.getByRole("button", { name: "Conocer el estudio" }),
    ).toBeFocused();
    await p
      .getByRole("button", { name: "Pausar movimiento", exact: true })
      .click();
    await p.reload();
    await expect(
      p.getByRole("button", { name: "Activar movimiento", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await p.getByRole("button", { name: "Conocer el estudio" }).click();
    await expect(p.locator(".welcome-tour .lottie-layer")).toHaveAttribute(
      "data-ready",
      "true",
    );
    const transform = () =>
      p.locator(".welcome-tour .lottie-layer svg").evaluate((e) => e.innerHTML);
    const paused = await transform();
    await p.waitForTimeout(450);
    expect(await transform()).toBe(paused);
    await p.keyboard.press("Escape");
    await p
      .getByRole("button", { name: "Activar movimiento", exact: true })
      .click();
    await p.getByRole("button", { name: "Grabar audio", exact: true }).click();
    await expect(
      p.getByRole("button", { name: "Detener grabación" }),
    ).toBeVisible();
    await p.waitForTimeout(700);
    await p.getByRole("button", { name: "Detener grabación" }).click();
    await expect(p.getByLabel("Mensaje para Cooper")).toHaveValue(
      /Quiero un nuevo video/,
    );
    await p.getByLabel("Mensaje para Cooper").fill("¿Qué tengo pendiente?");
    await p.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(p.getByLabel("Mensaje para Cooper")).toHaveValue("");
    await p.waitForTimeout(1200);
    if (width === 390) await p.getByRole("tab", { name: /Fábrica/ }).click();
    await p
      .getByRole("button", { name: /12 Por qué el cielo cambia de color/ })
      // El administrador puede ver ejemplos de varias cuentas de la suite conjunta.
      .first()
      .click();
    await expect(p.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "12",
    );
    await expect(p.locator(".publication-celebration")).toHaveCount(0);
    await p
      .getByRole("button", { name: /08 El mar también respira/ })
      .first()
      .click();
    await p.waitForTimeout(750);
    await p.screenshot({ path: `${dir}/${width}-fabrica.png`, fullPage: true });
    if (width === 390)
      await p.getByRole("tab", { name: "Chat", exact: true }).click();
    // Evento local explícitamente ficticio: comprobar transición, no llegada inicial ni recarga.
    const state = await (await p.request.get("/api/estado")).json();
    const candidate = state.videos.find(
      (video: { stage: number }) => video.stage < 11,
    );
    expect(candidate).toBeDefined();
    candidate.stage = 11;
    await p.route("**/api/eventos", async (route) => {
      await new Promise((r) => setTimeout(r, 650));
      await route.fulfill({
        contentType: "text/event-stream",
        body: `event: estado\ndata: ${JSON.stringify(state)}\n\n`,
      });
    });
    await p.reload();
    await expect(
      p.getByRole("complementary", { name: "Publicación confirmada" }),
    ).toBeVisible();
    await expect(
      p.locator(".publication-celebration .lottie-layer"),
    ).toHaveAttribute("data-ready", "true");
    await p.waitForTimeout(1600);
    await p.screenshot({ path: `${dir}/${width}-celebracion.png` });
    await p.getByRole("button", { name: "Cerrar celebración" }).click();
    await p.waitForTimeout(1300);
    await expect(p.locator(".publication-celebration")).toHaveCount(0);
    await p.unrouteAll({ behavior: "wait" });
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.getByRole("button", { name: "Conocer el estudio" }).click();
    await expect(p.locator(".welcome-tour .lottie-layer")).toHaveAttribute(
      "data-ready",
      "true",
    );
    const reduced = await transform();
    await p.waitForTimeout(500);
    expect(await transform()).toBe(reduced);
    expect(
      await p.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    ).toBe(0);
    await p.keyboard.press("Escape");
    await p.goto("/radar");
    await expect(p.locator("h1:visible")).toHaveCount(1);
    expect(
      await p.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    ).toBe(0);
    await p.emulateMedia({ reducedMotion: "no-preference" });
    await p.getByRole("link", { name: "Rutina y metas", exact: true }).click();
    await expect(p).toHaveURL(/rutina/);
    await p.waitForTimeout(700);
    expect(errors).toEqual([]);
    const video = p.video()!;
    await context.close();
    copyFileSync(await video.path(), `${dir}/${width}-interacciones.webm`);
    writeFileSync(
      `${dir}/${width}-interacciones.json`,
      JSON.stringify(
        {
          width,
          video: `${width}-interacciones.webm`,
          comprobaciones: [
            "recorrido 3 pasos",
            "audio y chat ficticios",
            "selección de fábrica y contadores",
            "foco y Escape",
            "pausa Lottie real",
            "persistencia recarga",
            "celebración una vez por evento ficticio",
            "reduced motion dinámico",
            "navegación coreografiada",
          ],
        },
        null,
        2,
      ),
    );
  });
