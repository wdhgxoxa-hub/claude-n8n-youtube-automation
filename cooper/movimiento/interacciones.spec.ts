import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { abrirCooper } from "../e2e/ayudas-diseno";
const dir = `${process.env.COOPER_MOVIMIENTO_SALIDA || ".cache/videos-movimiento"}/${process.env.COOPER_MOVIMIENTO_RONDA || "diagnostico"}`;
const animacionesVivas = (p: Page) =>
  p.evaluate(
    () =>
      document.getAnimations().filter((a) => a.playState === "running").length,
  );
const destino = (p: Page, nombre: string) =>
  p
    .getByRole("navigation", { name: /^Principal(?: móvil)?$/ })
    .filter({ visible: true })
    .getByRole("link", { name: nombre, exact: true });
for (const width of [1440, 390])
  test(`${width}: conexión, Cooper, pausa persistente, publicación y movimiento reducido`, async ({
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
    // La conexión sana ya no se anuncia con «En vivo» (DIRECCION §3): queda
    // en data-conexion y la píldora solo aparece tras un corte real.
    await expect(p.locator(".workspace")).toHaveAttribute(
      "data-conexion",
      "activa",
    );
    await expect(p.locator(".pildora-conexion")).toHaveCount(0);
    // El recorrido de bienvenida y sus Lottie salieron del rediseño. La
    // ilustración viva es la cara de Cooper: con movimiento, su loop corre.
    const cara = p.locator(".cooper-orb .cooper-presencia");
    await expect(cara.locator("video")).toBeVisible();
    await expect
      .poll(() =>
        cara
          .locator("video")
          .evaluate((v) => (v as HTMLVideoElement).currentTime),
      )
      .toBeGreaterThan(0);
    // Foco y Escape: el diálogo actual es la hoja de Cooper.
    const orbe = p.getByRole("button", { name: "Abrir Cooper", exact: true });
    await orbe.click();
    const hoja = p.getByRole("dialog", {
      name: "Cooper, tu compañero",
      exact: true,
    });
    await expect(hoja).toBeVisible();
    await expect(
      hoja.getByRole("button", { name: "Cerrar Cooper", exact: true }),
    ).toBeFocused();
    await p.waitForTimeout(1100);
    await p.keyboard.press("Escape");
    await expect(hoja).toHaveCount(0);
    await expect(orbe).toBeFocused();
    // La pausa vive en Perfil y sobrevive a la recarga.
    await p.goto("/perfil");
    await p
      .getByRole("button", { name: "Pausar movimiento", exact: true })
      .click();
    await p.reload();
    await expect(
      p.getByRole("button", { name: "Activar movimiento", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await destino(p, "Inicio").click();
    await expect(p).toHaveURL(/\/$/);
    await expect(p.locator(".workspace")).toHaveAttribute(
      "data-motion",
      "paused",
    );
    // En pausa la cara queda en su póster fijo y nada sigue animándose.
    await expect(cara.locator("video")).toHaveCount(0);
    await expect(cara.locator("img")).toBeVisible();
    await abrirCooper(p);
    await expect.poll(() => animacionesVivas(p)).toBe(0);
    await p.waitForTimeout(450);
    expect(await animacionesVivas(p)).toBe(0);
    await p.keyboard.press("Escape");
    await expect(hoja).toHaveCount(0);
    await p.goto("/perfil");
    await p
      .getByRole("button", { name: "Activar movimiento", exact: true })
      .click();
    await expect(
      p.getByRole("button", { name: "Pausar movimiento", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await destino(p, "Inicio").click();
    await expect(p.locator(".workspace")).toHaveAttribute(
      "data-motion",
      "playing",
    );
    await expect(cara.locator("video")).toBeVisible();
    // La grabación vive en la hoja de Cooper; el chat dejó el Inicio.
    await abrirCooper(p);
    await hoja
      .getByRole("button", { name: "Grabar audio", exact: true })
      .click();
    await expect(
      hoja.getByRole("button", { name: "Detener grabación" }),
    ).toBeVisible();
    await p.waitForTimeout(700);
    await hoja.getByRole("button", { name: "Detener grabación" }).click();
    await expect(hoja.getByLabel("Mensaje para Cooper")).toHaveValue(
      /Quiero un nuevo video/,
    );
    await hoja.getByLabel("Mensaje para Cooper").fill("¿Qué tengo pendiente?");
    await hoja.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(hoja.getByLabel("Mensaje para Cooper")).toHaveValue("");
    await p.waitForTimeout(1200);
    await hoja
      .getByRole("button", { name: "Cerrar Cooper", exact: true })
      .click();
    await expect(hoja).toHaveCount(0);
    // La Fábrica es la Línea de producción: cada cápsula abre su detalle, con
    // la pista de etapas en lugar de la antigua barra de progreso.
    const actual = await (await p.request.get("/api/estado")).json();
    const propio = (titulo: string, etapa: number) =>
      actual.videos.find(
        (v: { ownerId: string; title: string; stage: number }) =>
          v.ownerId === actual.user.id &&
          v.title === titulo &&
          v.stage === etapa,
      );
    const publicado = propio("Por qué el cielo cambia de color", 11);
    const montaje = propio("El mar también respira", 7);
    expect(publicado).toBeDefined();
    expect(montaje).toBeDefined();
    const recorrido = p.getByRole("region", {
      name: "Recorrido de producción",
    });
    await destino(p, "Fábrica").click();
    await expect(p).toHaveURL(/\/videos$/);
    await p.locator(`[data-capsula="${publicado.id}"] a`).click();
    await expect(p).toHaveURL(new RegExp(`/videos/${publicado.id}$`));
    await expect(p.getByRole("heading", { level: 1 })).toHaveText(
      publicado.title,
    );
    await expect(recorrido).toContainText("12 / 12");
    await expect(p.locator('.journey li[aria-current="step"]')).toContainText(
      "Publicado",
    );
    // Abrir un video ya publicado no lo celebra.
    await expect(p.locator(".publication-celebration")).toHaveCount(0);
    await destino(p, "Fábrica").click();
    await expect(p).toHaveURL(/\/videos$/);
    await p.locator(`[data-capsula="${montaje.id}"] a`).click();
    await expect(p).toHaveURL(new RegExp(`/videos/${montaje.id}$`));
    await expect(recorrido).toContainText("08 / 12");
    await expect(p.locator(".journey li.current")).toContainText("Montaje");
    await p.waitForTimeout(750);
    await p.screenshot({ path: `${dir}/${width}-fabrica.png`, fullPage: true });
    // Evento local explícitamente ficticio: comprobar transición, no llegada inicial ni recarga.
    const state = await (await p.request.get("/api/estado")).json();
    const candidate = state.videos.find(
      (video: { stage: number }) => video.stage < 11,
    );
    expect(candidate).toBeDefined();
    candidate.stage = 11;
    let entregas = 0;
    await p.route("**/api/eventos", async (route) => {
      await new Promise((r) => setTimeout(r, 650));
      entregas += 1;
      await route.fulfill({
        contentType: "text/event-stream",
        body: `event: estado\ndata: ${JSON.stringify(state)}\n\n`,
      });
    });
    await p.goto("/");
    const celebracion = p.getByRole("complementary", {
      name: "Publicación confirmada",
    });
    await expect(celebracion).toBeVisible();
    await expect(celebracion).toContainText(candidate.title);
    await p.screenshot({ path: `${dir}/${width}-celebracion.png` });
    // DIRECCION §2: el momento dura ≤900 ms y se cierra solo, una vez.
    await expect(p.locator(".publication-celebration")).toHaveCount(0, {
      timeout: 2000,
    });
    // El SSE finito se reconecta y repite el mismo estado: no se celebra otra vez.
    await expect.poll(() => entregas).toBeGreaterThanOrEqual(2);
    await p.waitForTimeout(1300);
    await expect(p.locator(".publication-celebration")).toHaveCount(0);
    await p.unrouteAll({ behavior: "wait" });
    await p.emulateMedia({ reducedMotion: "reduce" });
    await expect(p.locator(".workspace")).toHaveAttribute(
      "data-motion",
      "paused",
    );
    await expect(cara.locator("video")).toHaveCount(0);
    await abrirCooper(p);
    await expect(hoja).not.toHaveAttribute("data-projecting", "true");
    await expect.poll(() => animacionesVivas(p)).toBe(0);
    await p.waitForTimeout(500);
    expect(await animacionesVivas(p)).toBe(0);
    await p.keyboard.press("Escape");
    await expect(hoja).toHaveCount(0);
    await p.goto("/radar");
    await expect(p.locator("h1:visible")).toHaveCount(1);
    expect(await animacionesVivas(p)).toBe(0);
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
            "conexión sana sin aviso",
            "cara de Cooper animada con movimiento",
            "foco y Escape en la hoja de Cooper",
            "pausa desde Perfil: cara fija y cero animaciones",
            "persistencia recarga",
            "audio y chat ficticios en la hoja de Cooper",
            "Línea de producción y detalle con su etapa",
            "celebración una vez por evento ficticio, cierre sola",
            "reduced motion dinámico",
            "navegación coreografiada",
          ],
        },
        null,
        2,
      ),
    );
  });
