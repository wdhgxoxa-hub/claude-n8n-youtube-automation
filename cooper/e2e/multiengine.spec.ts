import { test, expect, type Page, type Locator, type Request } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import type { Estado } from "../src/servicios/datos";

// Reutiliza el emisor Auth.js y la fábrica demo existentes, sin OAuth.
async function entrar(page: Page, theme: string) {
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
    ).status(),
  ).toBe(200);
  const state: Estado = await (await page.request.get("/api/estado")).json();
  expect(
    (
      await page.request.patch("/api/perfil", {
        data: {
          name: state.user.name,
          image: state.user.image,
          theme,
          home: "chat",
          whatsapp: "",
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator(".connection")).toHaveText("En vivo");
}

// Recorre Tab de verdad: no sustituir por focus() ni click().
async function teclado(page: Page, target: Locator, backwards = false) {
  const pasos: string[] = [];
  for (let i = 0; i < 100; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(backwards ? "Shift+Tab" : "Tab");
    pasos.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        return `${el?.tagName}: ${el?.getAttribute("aria-label") ?? el?.textContent?.slice(0, 60)}`;
      }),
    );
  }
  await test.info().attach("foco", {
    body: JSON.stringify(pasos),
    contentType: "application/json",
  });
  await expect(target, [...new Set(pasos)].join(" | ")).toBeFocused();
}

const errores = new WeakMap<Page, string[]>();
const precargas = new WeakMap<Page, { pendientes: Set<Request>; actividad: number }>();
async function esperarPrecargas(page: Page) {
  // Next programa las precargas por lotes. Un hueco vacío entre dos lotes no
  // significa que hayan terminado; recargar ahí aborta el siguiente en WebKit.
  // Esperamos silencio real de RSC sin silenciar errores ni contar el SSE.
  const desde = performance.now();
  await expect.poll(() => {
    const estado = precargas.get(page)!;
    return estado.pendientes.size === 0 &&
      performance.now() - Math.max(desde, estado.actividad) >= 500;
  }).toBe(true);
}
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errores.set(page, list);
  const estado = { pendientes: new Set<Request>(), actividad: performance.now() };
  precargas.set(page, estado);
  page.on("request", (r) => {
    if (r.url().includes("_rsc=")) {
      estado.pendientes.add(r);
      estado.actividad = performance.now();
    }
  });
  const terminar = (r: Request) => {
    if (estado.pendientes.delete(r)) estado.actividad = performance.now();
  };
  page.on("requestfinished", terminar);
  page.on("requestfailed", terminar);
  page.on("pageerror", (e) => list.push(e.message));
  // Ninguna URL de un fixture debe salir a Internet.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) =>
    route.abort(),
  );
});
test.afterEach(async ({ page, browser }, info) => {
  await info.attach("motor", {
    body: JSON.stringify({
      proyecto: info.project.name,
      version: browser.version(),
      viewport: page.viewportSize(),
      tema: info.project.metadata.theme,
      errores: errores.get(page),
    }),
    contentType: "application/json",
  });
  await info.attach("pantalla", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  expect(errores.get(page)).toEqual([]);
});

test("entrada, teclado, chat, reconexión SSE y dos aprobaciones manuales", async ({
  page,
  context,
}, info) => {
  await page.goto("/");
  await expect(page).toHaveURL(/entrar/);
  const google = page.getByRole("button", { name: "Continuar con Google" });
  await teclado(page, google);
  await expect(google).toBeFocused(); // No iniciar OAuth.
  expect((await page.request.get("/api/estado")).status()).toBe(401);
  await entrar(page, info.project.metadata.theme);
  const salto = page.getByRole("link", { name: "Saltar al contenido" });
  await teclado(page, salto);
  await page.keyboard.press("Enter");
  await expect(page.locator("#contenido")).toBeFocused();
  const message = page.getByLabel("Mensaje para Cooper");
  const canal = `M11 ${info.project.name}`;
  await teclado(page, message);
  await page.keyboard.type(`Crea un canal: ${canal}`);
  await page.keyboard.press("Enter");
  let confirm = page
    .getByRole("article", { name: "Crear canal" })
    .filter({ hasText: canal })
    .getByRole("button", { name: "Confirmar", exact: true });
  await expect(confirm).toBeEnabled();
  const before: Estado = await (await page.request.get("/api/estado")).json();
  expect(before.channels.some((c) => c.name === canal)).toBe(false);
  await teclado(page, confirm, true);
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Tu canal está listo.", { exact: false }).last(),
  ).toBeVisible();
  await page.getByLabel("Canal del chat").selectOption({ label: canal });
  const titulo = `Historia ${info.project.name}`;
  await message.fill(`Quiero un video: ${titulo}`);
  await message.press("Enter");
  confirm = page
    .getByRole("article", { name: "Producir video" })
    .filter({ hasText: titulo })
    .getByRole("button", { name: "Confirmar", exact: true });
  await expect(confirm).toBeEnabled();
  await teclado(page, confirm, true);
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => {
      const state: Estado = await (
        await page.request.get("/api/estado")
      ).json();
      return state.videos.find((v) => v.title === titulo)?.stage;
    })
    .toBe(3);
  const state: Estado = await (await page.request.get("/api/estado")).json();
  const video = state.videos.find((v) => v.title === titulo)!;
  await page.goto(`/videos/${video.id}`);
  await expect(page.locator(".journey li.current")).toContainText(
    "Aprobación de guion",
  );
  await context.setOffline(true);
  await expect(page.locator(".connection")).not.toHaveText("En vivo");
  await context.setOffline(false);
  await expect(page.locator(".connection")).toHaveText("En vivo");
  const approve = page.getByRole("button", { name: "Aprobar", exact: true });
  for (const [stage, next] of [
    [3, "Aprobación final"],
    [9, "Publicado"],
  ] as const) {
    // Más de tres pulsos simulados: ninguna aprobación avanza por tiempo/SSE.
    await page.waitForTimeout(1400);
    const current: Estado = await (
      await page.request.get("/api/estado")
    ).json();
    expect(current.videos.find((v) => v.id === video.id)?.stage).toBe(stage);
    await teclado(page, approve);
    await page.keyboard.press("Enter");
    await expect(page.locator(".journey li.current")).toContainText(next);
  }
});

test("pausa persistente, movimiento reducido y accesibilidad en ambos tamaños", async ({
  page,
}, info) => {
  await entrar(page, info.project.metadata.theme);
  const pausa = page.getByRole("button", { name: "Pausar movimiento" });
  await teclado(page, pausa);
  await page.keyboard.press("Enter");
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await page.keyboard.press("Escape");
  await esperarPrecargas(page);
  await page.goto("/videos");
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await esperarPrecargas(page);
  await page.reload();
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    )
    .toBe(0);
  expect(
    await page.evaluate(() => localStorage.getItem("cooper-motion-paused")),
  ).toBe("true");
  await page.evaluate(() =>
    localStorage.setItem("cooper-motion-paused", "false"),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await esperarPrecargas(page);
  await page.reload();
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    )
    .toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags([
          "wcag2a",
          "wcag2aa",
          "wcag21a",
          "wcag21aa",
          "wcag22a",
          "wcag22aa",
        ])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("grabación nativa con señal sintética y reproducción de medios soportados", async ({
  page,
  browserName,
}, info) => {
  await entrar(page, info.project.metadata.theme);
  const supported = await page.evaluate(() => ({
    grabacion: Object.fromEntries(
      ["audio/webm", "audio/ogg", "audio/mp4"].map((mime) => [
        mime,
        typeof MediaRecorder !== "undefined" &&
          MediaRecorder.isTypeSupported(mime),
      ]),
    ),
    video: Object.fromEntries(
      ["video/webm; codecs=vp8", "video/mp4; codecs=avc1.42E01E"].map(
        (mime) => [mime, document.createElement("video").canPlayType(mime)],
      ),
    ),
  }));
  await info.attach("formatos", {
    body: JSON.stringify(supported),
    contentType: "application/json",
  });
  const canRecord = Object.values(supported.grabacion).some(Boolean);
  if (browserName === "firefox") expect(canRecord).toBe(true);
  if (canRecord) {
    await teclado(
      page,
      page.getByRole("button", { name: "Grabar audio", exact: true }),
    );
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("status", { name: "Grabando audio" }),
    ).toBeVisible();
    await page.waitForTimeout(700);
    const upload = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/archivos" &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Detener grabación" })
      .press("Enter");
    const uploaded = await upload;
    const payload = uploaded.request().postDataJSON();
    expect(uploaded.status(), `Formato capturado: ${payload.mime}`).toBe(200);
    expect(payload.mime).toMatch(/^audio\/(ogg|webm|mp4)$/);
    await info.attach("grabacion", {
      body: JSON.stringify({ mime: payload.mime, nombre: payload.name }),
      contentType: "application/json",
    });
    await expect(
      page.getByText("Transcripción simulada.", { exact: false }),
    ).toBeVisible();
    const message = page.getByLabel("Mensaje para Cooper");
    await expect(message).not.toHaveValue("");
    await message.fill("Transcripción corregida por teclado");
    await expect(message).toHaveValue("Transcripción corregida por teclado");
  } else {
    await page
      .getByRole("button", { name: "Grabar audio", exact: true })
      .press("Enter");
    await expect(
      page.getByText(
        "Tu navegador no permite grabar audio. Puedes adjuntar una grabación.",
      ),
    ).toBeVisible();
    const wav = execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
      "-threads",
      "1",
      "-f",
      "wav",
      "pipe:1",
    ]);
    await page.getByLabel("Archivo adjunto", { exact: true }).setInputFiles({
      name: "voz-ficticia.wav",
      mimeType: "audio/wav",
      buffer: wav,
    });
    await expect(page.locator(".file-chips")).toContainText("voz-ficticia.wav");
    await info.attach("grabacion", {
      body: JSON.stringify({
        estado: "NOT_SUPPORTED",
        alternativa: "adjunto WAV",
      }),
      contentType: "application/json",
    });
  }
  // Mismo fixture de observabilidad y FFmpeg de resultados.spec.ts, sin destinos externos.
  const state: Estado = await (await page.request.get("/api/estado")).json();
  const video = state.videos[0];
  const webm = supported.video["video/webm; codecs=vp8"] !== "";
  expect(webm || supported.video["video/mp4; codecs=avc1.42E01E"] !== "").toBe(
    true,
  );
  const format = webm ? "webm" : "mp4";
  const clip = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=160x240:r=10",
    "-t",
    "2",
    "-threads",
    "1",
    "-c:v",
    webm ? "libvpx" : "libx264",
    "-pix_fmt",
    "yuv420p",
    ...(webm ? [] : ["-movflags", "frag_keyframe+empty_moov"]),
    "-f",
    format,
    "pipe:1",
  ]);
  const voice = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=2",
    "-threads",
    "1",
    "-f",
    "wav",
    "pipe:1",
  ]);
  video.observabilidad = {
    montaje: `https://media.example.test/ensayo.${format}`,
    miniatura: "",
    escenas: [
      {
        id: "m11",
        orden: 0,
        imagen: "",
        clip: "",
        voz: "https://media.example.test/ensayo.wav",
      },
    ],
    publicaciones: [],
    incidencias: [],
  };
  await page.route("https://media.example.test/**", (r) =>
    r.fulfill({
      contentType: r.request().url().endsWith("wav")
        ? "audio/wav"
        : `video/${format}`,
      body: r.request().url().endsWith("wav") ? voice : clip,
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
  for (const selector of [".real-player video", ".scene-gallery audio"]) {
    const player = page.locator(selector);
    await expect(player).toBeVisible();
    await player.evaluate(async (el: HTMLMediaElement) => {
      el.muted = true;
      await el.play();
    });
    await expect
      .poll(() => player.evaluate((el: HTMLMediaElement) => el.currentTime))
      .toBeGreaterThan(0.1);
    expect(
      await player.evaluate((el: HTMLMediaElement) => el.error),
    ).toBeNull();
    await player.evaluate((el: HTMLMediaElement) => el.pause());
  }
});
