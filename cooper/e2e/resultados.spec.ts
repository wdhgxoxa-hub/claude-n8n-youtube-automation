import { test, expect } from "@playwright/test";
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
  await page.goto("/publicados");
  await expect(
    page.getByRole("heading", { name: "Publicados", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".publication")).toHaveCount(3);
  await page.getByRole("button", { name: "instagram", exact: true }).click();
  await expect(page.locator(".publication")).toHaveCount(1);
  await page.getByLabel("Métrica del gráfico").selectOption("retencion");
  await expect(
    page.getByText("Todavía no hay mediciones de esta métrica."),
  ).toBeVisible();
  await page.getByText("Ver datos de evolución").click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.goto("/aprendizaje");
  await page.getByRole("button", { name: "Pendientes", exact: true }).click();
  await expect(
    page.getByText("Dar más espacio al sonido de la calle."),
  ).toBeVisible();
  await expect(
    page.getByText("Una cifra del guion necesitaba una fuente más reciente."),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Corregidos", exact: true }).click();
  await expect(
    page.getByText("Una cifra del guion necesitaba una fuente más reciente."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Se sustituyó la cifra y se comprobó su fuente antes de repetir la revisión.",
    ),
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
