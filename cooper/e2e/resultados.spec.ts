import { test, expect } from "@playwright/test";
import type { Estado } from "../src/servicios/datos";
import { readFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
test.beforeEach(async ({ page }) => {
  expect(
    (
      await page.request.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT ?? "33173"}/sesion`,
        {
          data: {
            email: "admin@example.test",
            secret: process.env.COOPER_E2E_SECRET,
          },
        },
      )
    ).status(),
  ).toBe(200);
});
test("Publicados y Aprendizaje: filtros, gráfico, tabla y estados de corrección", async ({
  page,
}) => {
  // El administrador ve también los ejemplos de cuentas creadas por otras E2E.
  // Contrastar contra la API comprueba la lista completa sin depender del orden de las suites.
  const estado: Estado = await (await page.request.get("/api/estado")).json();
  const publicaciones = estado.videos.flatMap(
    (v) => v.observabilidad.publicaciones,
  );
  const incidencias = estado.videos.flatMap(
    (v) => v.observabilidad.incidencias,
  );
  const pendientes = incidencias.filter((i) => i.estado === "pendiente");
  const corregidos = incidencias.filter((i) => i.estado === "corregido");
  expect(pendientes.length).toBeGreaterThan(0);
  expect(corregidos.length).toBeGreaterThan(0);
  await page.goto("/publicados");
  await expect(
    page.getByRole("heading", { name: "Publicados", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".publication:visible")).toHaveCount(
    publicaciones.length,
  );
  await page.getByRole("button", { name: "instagram", exact: true }).click();
  await expect(page.locator(".publication:visible")).toHaveCount(
    publicaciones.filter((p) => p.red === "instagram").length,
  );
  const publicacion = page.locator(".publication:visible").first();
  await publicacion.getByLabel("Métrica del gráfico").selectOption("retencion");
  await expect(
    publicacion.getByText("Todavía no hay mediciones de esta métrica."),
  ).toBeVisible();
  await publicacion.getByText("Ver datos de evolución").click();
  await expect(publicacion.getByRole("table")).toBeVisible();
  await page.goto("/aprendizaje");
  await page.getByRole("button", { name: "Pendientes", exact: true }).click();
  await expect(page.locator(".incident-state.pendiente:visible")).toHaveCount(
    pendientes.length,
  );
  await expect(page.locator(".incident-state.corregido:visible")).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Corregidos", exact: true }).click();
  await expect(page.locator(".incident-state.corregido:visible")).toHaveCount(
    corregidos.length,
  );
  await expect(page.locator(".incident-state.pendiente:visible")).toHaveCount(
    0,
  );
  for (const cambio of new Set(corregidos.map((i) => i.cambio)))
    await expect(
      page
        .locator(".learning-section:visible")
        .getByText(cambio, { exact: true })
        .first(),
    ).toBeVisible();
});
test("el montaje real se reproduce y sustituye la maqueta; galería y embeds usan URLs exactas", async ({
  page,
}) => {
  mkdirSync(".cache/capturas-pulido", { recursive: true });
  const result = spawnSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x191d20:s=320x180:d=2",
    "-c:v",
    "libvpx",
    "-an",
    ".cache/capturas-pulido/video-ensayo.webm",
  ]);
  expect(result.status).toBe(0);
  expect(
    spawnSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      ".cache/capturas-pulido/voz-ensayo.wav",
    ]).status,
  ).toBe(0);
  const state = await (await page.request.get("/api/estado")).json();
  const video = state.videos[0];
  video.observabilidad = {
    montaje: "https://media.example.test/ensayo.webm",
    miniatura: "",
    escenas: [
      {
        id: "p1",
        orden: 0,
        imagen: "https://media.example.test/ensayo.png",
        clip: "https://media.example.test/ensayo.webm",
        voz: "https://media.example.test/ensayo.wav",
      },
    ],
    publicaciones: [
      {
        id: "p1",
        red: "youtube",
        url: "https://www.youtube.com/watch?v=abcdefghijk",
        fecha: null,
        miniatura: "",
        historial: [],
      },
      {
        id: "p2",
        red: "tiktok",
        url: "https://www.tiktok.com/@ensayo/video/123456789",
        fecha: null,
        miniatura: "",
        historial: [],
      },
    ],
    incidencias: [],
  };
  await page.route("https://media.example.test/**", (r) => {
    const url = r.request().url();
    return r.fulfill(
      url.endsWith(".png")
        ? {
            contentType: "image/png",
            body: Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=",
              "base64",
            ),
          }
        : {
            contentType: url.endsWith(".wav") ? "audio/wav" : "video/webm",
            body: readFileSync(
              url.endsWith(".wav")
                ? ".cache/capturas-pulido/voz-ensayo.wav"
                : ".cache/capturas-pulido/video-ensayo.webm",
            ),
          },
    );
  });
  await page.route(/https:\/\/www\.(youtube|tiktok)\.com\/.*/, (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<p>Reproductor externo de ensayo</p>",
    }),
  );
  await page.route("**/api/estado", (r) => r.fulfill({ json: state }));
  await page.route("**/api/eventos", (r) =>
    r.fulfill({
      contentType: "text/event-stream",
      body: `event: estado\ndata: ${JSON.stringify(state)}\n\n`,
    }),
  );
  await page.goto(`/videos/${video.id}`);
  // La sincronización del contexto vuelve a consultar estado al abrir el SSE.
  await expect(
    page.getByRole("region", { name: "Video terminado", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Vista previa simulada" }),
  ).toHaveCount(0);
  const player = page.locator(".real-player video");
  await player.evaluate(async (el) => {
    const v = el as HTMLVideoElement;
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() => player.evaluate((el) => (el as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.1);
  await expect(
    page.getByRole("region", { name: "Piezas por escena" }),
  ).toBeVisible();
  await expect(page.locator("iframe").first()).toHaveAttribute(
    "src",
    "https://www.youtube.com/embed/abcdefghijk",
  );
  await expect(page.locator("iframe").nth(1)).toHaveAttribute(
    "src",
    "https://www.tiktok.com/player/v1/123456789?autoplay=0",
  );
  await expect(page.getByAltText("Imagen de la escena 1")).toBeVisible();
  const gallery = page.getByRole("region", { name: "Piezas por escena" });
  const bounds = await gallery.boundingBox();
  const picture = await page
    .getByAltText("Imagen de la escena 1")
    .boundingBox();
  expect(bounds).not.toBeNull();
  expect(picture).not.toBeNull();
  expect(picture!.y).toBeGreaterThan(bounds!.y);
  expect(picture!.y + picture!.height).toBeLessThanOrEqual(
    bounds!.y + bounds!.height,
  );
  const voz = page.getByLabel("Voz de la escena 1");
  await voz.evaluate(async (el) => {
    const a = el as HTMLAudioElement;
    a.muted = true;
    await a.play();
  });
  await expect
    .poll(() => voz.evaluate((el) => (el as HTMLAudioElement).currentTime))
    .toBeGreaterThan(0.1);
  await page.screenshot({
    path: ".cache/capturas-pulido/medios-reales-ensayo.png",
    fullPage: true,
  });
});
