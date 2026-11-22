import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, copyFileSync, writeFileSync } from "node:fs";
const dir = `${process.env.COOPER_MOVIMIENTO_SALIDA || ".cache/videos-movimiento"}/${process.env.COOPER_MOVIMIENTO_RONDA || "diagnostico"}`;
const animacionesVivas = (p: Page) =>
  p.evaluate(
    () =>
      document.getAnimations().filter((a) => a.playState === "running").length,
  );
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
    // El rediseño retiró Lottie (DIRECCION §2: una sola librería de
    // movimiento). La ilustración animada que queda es la cara de Cooper en el
    // orbe: un loop .webm sobre su póster WebP. Un video defectuoso simula que
    // el motor no llega; el póster debe quedarse y el reproductor retirarse.
    await p.route("**/cooper-cara/cooper.webm", (r) =>
      r.fulfill({
        status: 200,
        contentType: "video/webm",
        body: "no es un video",
      }),
    );
    const state = await (await p.request.get("/api/estado")).json();
    // El servidor pinta datos reales: el vacío solo puede venir del SSE.
    expect(state.videos.length).toBeGreaterThan(0);
    state.channels = [];
    state.videos = [];
    state.messages = [];
    await p.route("**/api/eventos", (r) =>
      r.fulfill({
        contentType: "text/event-stream",
        body: `event: estado\ndata: ${JSON.stringify(state)}\n\n`,
      }),
    );
    const pedidoCara = p.waitForRequest("**/cooper-cara/cooper.webm");
    await p.goto("/");
    // El SSE de esta fixture es finito: comprobar el estado recibido, no una conexión abierta.
    // El Inicio rediseñado ya no lleva un panel de Fábrica: su vacío propio
    // es «Una idea. Todo por crear.» en ambos anchos.
    await expect(
      p.getByRole("heading", { name: "Una idea. Todo por crear." }),
    ).toBeVisible();
    await pedidoCara;
    const cara = p.locator(".cooper-orb .cooper-presencia");
    await expect(cara.locator("video")).toHaveCount(0);
    await expect(cara.locator("img")).toBeVisible();
    await expect(cara.locator("img")).toHaveJSProperty("complete", true);
    expect(
      await cara
        .locator("img")
        .evaluate((i) => (i as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    await p.waitForTimeout(1200);
    await p.screenshot({
      path: `${dir}/${width}-vacio-fallback.png`,
      fullPage: true,
    });
    // La Fábrica (antes una pestaña del Inicio) es ahora su propio destino.
    await p
      .getByRole("navigation", { name: /^Principal(?: móvil)?$/ })
      .filter({ visible: true })
      .getByRole("link", { name: "Fábrica", exact: true })
      .click();
    await expect(p).toHaveURL(/\/videos$/);
    await expect(
      p.getByRole("heading", { name: "Tu primera idea va aquí" }),
    ).toBeVisible();
    await expect(cara.locator("video")).toHaveCount(0);
    await p.waitForTimeout(700);
    await p.screenshot({
      path: `${dir}/${width}-vacio-fabrica.png`,
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
    const marca = p.locator(".entrada-marca");
    await expect(marca).toHaveAttribute("data-motion", "playing");
    await p.waitForTimeout(1100);
    // «Pausar movimiento» se mudó a Perfil (DIRECCION §2). La pausa se guarda
    // y el enlace vencido, fuera del estudio, debe respetarla al volver.
    await p.goto("/perfil");
    await p
      .getByRole("button", { name: "Pausar movimiento", exact: true })
      .click();
    await expect(p.locator(".workspace")).toHaveAttribute(
      "data-motion",
      "paused",
    );
    await p.goto("/revisar/whatsapp/enlace-ficticio");
    await expect(
      p.getByRole("heading", { name: "Este enlace ya no está disponible" }),
    ).toBeVisible();
    await expect(marca).toHaveAttribute("data-motion", "paused");
    await p.waitForTimeout(150);
    expect(await animacionesVivas(p)).toBe(0);
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
            "vacío ficticio por SSE en Inicio y Fábrica",
            "cara de Cooper sin su loop: queda el póster",
            "404",
            "enlace vencido",
            "pausa desde Perfil respetada en el enlace vencido",
          ],
        },
        null,
        2,
      ),
    );
  });
