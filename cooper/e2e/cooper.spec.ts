import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
const secret = process.env.COOPER_E2E_SECRET!;
async function login(request: APIRequestContext, email = "ana@example.test") {
  const response = await request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT ?? "33172"}/sesion`,
    {
      data: { email, secret },
    },
  );
  expect(response.status()).toBe(200);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
let videoId = "";
test.beforeAll(async ({ request }) => {
  await login(request, "admin@example.test");
  for (const email of ["ana@example.test", "luis@example.test"])
    expect(
      (
        await request.post("/api/admin/permitidos", { data: { email } })
      ).status(),
    ).toBe(200);
  mkdirSync("test-results/visual", { recursive: true });
});
test("entrada pública, cabeceras y protección de rutas", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/entrar/);
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeVisible();
  expect((await request.get("/api/estado")).status()).toBe(401);
  const response = await request.get("/entrar");
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  const csp = response.headers()["content-security-policy"];
  expect(
    csp.split(";").find((value) => value.trim().startsWith("script-src")),
  ).not.toContain("unsafe-inline");
  expect(csp).toMatch(/nonce-[A-Za-z0-9+/=]+/);
  expect(
    (
      await request.post("/api/prueba", {
        data: { email: "admin@example.test", secret },
      })
    ).status(),
  ).toBe(401);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(
    (
      await request.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT ?? "33172"}/sesion`,
        {
          data: { email: "intruso@example.test", secret },
        },
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT ?? "33172"}/sesion`,
        {
          data: { email: "admin@example.test", secret: "incorrecto" },
        },
      )
    ).status(),
  ).toBe(403);
  await expect(page).toHaveTitle(/Cooper/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "test-results/visual/entrar-1440.png",
    fullPage: true,
  });
});
test("conversa, pide un video, observa SSE y aprueba las dos puertas", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page.request);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hagamos algo bueno." }),
  ).toBeVisible();
  const message = page.getByRole("textbox", { name: "Mensaje para Cooper" });
  await message.fill("Crea un canal: Ciencia cotidiana");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText("Tu canal está listo.", { exact: false }),
  ).toBeVisible();
  await message.fill("Quiero un video: Por qué el cielo es azul");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText("El video ya está en Radar.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".approval-alert")).toBeVisible();
  const state = await (await page.request.get("/api/estado")).json();
  videoId = state.videos[0].id;
  expect(state).not.toHaveProperty("expenses");
  await page.screenshot({
    path: "test-results/visual/inicio-1440.png",
    fullPage: true,
  });
  await page.locator(".factory-link").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Por qué el cielo es azul" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aprobar", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Pedir cambios" }).click();
  await page
    .getByLabel("¿Qué cambiamos?")
    .fill("Incluye la dispersión de Rayleigh con un ejemplo.");
  await page.getByRole("button", { name: "Enviar cambios" }).click();
  await expect(
    page.getByRole("button", { name: "Aprobar", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await expect(page.locator(".journey li.current")).toContainText(
    "Aprobación final",
  );
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await expect(page.locator(".journey li.current")).toContainText("Publicado");
  expect(errors).toEqual([]);
});
test("chat conserva tarjetas al recargar, cancela y bloquea confirmaciones ajenas", async ({
  page,
  browser,
}) => {
  await login(page.request);
  await page.goto("/");
  const before = await (await page.request.get("/api/estado")).json();
  await page
    .getByRole("textbox", { name: "Mensaje para Cooper", exact: true })
    .fill("Quiero un video: Un viaje a las estrellas");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  const card = page.getByRole("article", { name: "Producir video" });
  await expect(card).toContainText("Un viaje a las estrellas");
  await expect(
    card.getByRole("button", { name: "Confirmar", exact: true }),
  ).toBeEnabled();
  const proposed = await (await page.request.get("/api/estado")).json();
  expect(proposed.videos).toHaveLength(before.videos.length);
  const id = proposed.chat.tarjetas.at(-1).id;
  const other = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env.COOPER_E2E_PORT}`,
    extraHTTPHeaders: {
      Referer: `http://127.0.0.1:${process.env.COOPER_E2E_PORT}`,
    },
  });
  await login(other.request, "luis@example.test");
  expect(
    (
      await other.request.post("/api/chat/confirmar", {
        data: { id, aceptar: true },
      })
    ).status(),
  ).toBe(404);
  await other.close();
  await page.reload();
  await expect(card).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `test-results/visual/chat-confirmacion-${width}.png`,
      fullPage: true,
    });
  }
  await card.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(card).toHaveCount(0);
  expect(
    (
      await page.request.post("/api/chat/confirmar", {
        data: { id, aceptar: true },
      })
    ).status(),
  ).toBe(409);
});
test("boca de Cooper sigue las frases y vuelve a reposo al finalizar el stream", async ({
  page,
}) => {
  await login(page.request);
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      if (input === "/api/chat") {
        const encoder = new TextEncoder();
        return new Response(
          new ReadableStream({
            start(c) {
              const send = (event: unknown) =>
                c.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              setTimeout(
                () =>
                  send({ tipo: "texto", texto: "Estoy revisando tu idea. " }),
                100,
              );
              setTimeout(
                () =>
                  send({
                    tipo: "texto",
                    texto: "Podemos convertirla en un video.",
                  }),
                1800,
              );
              setTimeout(() => {
                send({ tipo: "fin" });
                c.close();
              }, 2600);
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }
      return original(input, init);
    };
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Mensaje para Cooper", exact: true })
    .fill("Revisa mi idea");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.locator(".conversation [aria-busy=true]")).toContainText(
    "Estoy revisando",
  );
  await expect(
    page.getByRole("img", { name: "Cooper hablando", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Cooper pensando", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".conversation [aria-busy=true]")).toContainText(
    "Podemos convertirla",
  );
  await expect(
    page.getByRole("img", { name: "Cooper reposo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar mensaje" }),
  ).toBeDisabled();
});
test("aísla usuarios, gasto, chat, SSE y acciones de video", async ({
  page,
  request,
}) => {
  await login(request);
  videoId = (await (await request.get("/api/estado")).json()).videos[0].id;
  await login(request, "luis@example.test");
  const state = await (await request.get("/api/estado")).json();
  expect(state.videos).toHaveLength(0);
  expect(state.channels).toHaveLength(0);
  expect(state.messages).toHaveLength(0);
  expect(JSON.stringify(state)).not.toMatch(/amount|expenses|concept/);
  expect((await request.get("/api/admin")).status()).toBe(403);
  expect((await request.delete(`/api/videos/${videoId}`)).status()).toBe(404);
  expect(
    (
      await request.post(`/api/videos/${videoId}/aprobar`, { data: {} })
    ).status(),
  ).toBe(404);
  await login(page.request, "luis@example.test");
  await page.goto(`/videos/${videoId}`);
  await expect(
    page.getByRole("heading", { name: "Este espacio no está disponible." }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(page.locator(".workspace")).toHaveAttribute("data-conexion", "activa");
  await expect(
    page.getByRole("heading", { name: "Este espacio no está disponible." }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tu primera historia empieza aquí" }),
  ).toBeVisible();
  const event = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const stream = new EventSource("/api/eventos");
        stream.addEventListener("estado", (e) => {
          stream.close();
          resolve(e.data);
        });
      }),
  );
  expect(JSON.parse(event).videos).toHaveLength(0);
  expect(event).not.toContain("Por qué el cielo");
});
test("adjuntos y grabación con transcripción editable", async ({ page }) => {
  await login(page.request);
  await page.goto("/");
  await expect(page.locator(".workspace")).toHaveAttribute("data-conexion", "activa");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Adjuntar archivo", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "referencia.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Referencia de ciencia cotidiana"),
  });
  await expect(page.locator(".file-chips")).toContainText("referencia.txt");
  await page
    .getByRole("textbox", { name: "Mensaje para Cooper" })
    .fill("Estas son mis referencias");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.getByRole("link", { name: "Adjunto 1" })).toBeVisible();
  await page.getByRole("button", { name: "Grabar audio", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Detener grabación" }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Detener grabación" }).click();
  await expect(
    page.getByText("Transcripción simulada.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Mensaje para Cooper" }),
  ).toHaveValue(/Quiero un nuevo video/);
  await page
    .getByRole("textbox", { name: "Mensaje para Cooper", exact: true })
    .fill("Quiero un video: Idea dictada y revisada");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  const propuesta = page.getByRole("article", { name: "Producir video" });
  await expect(propuesta).toContainText("Idea dictada y revisada");
  await propuesta
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
});
test("una foto del chat abre el avatar privado sin omitir verificación", async ({
  page,
  browser,
}) => {
  await login(page.request);
  await page.goto("/");
  await expect(page.locator(".workspace")).toHaveAttribute("data-conexion", "activa");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Adjuntar archivo", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "retrato.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("link", { name: "Usar para mi avatar", exact: true })
    .click();
  await expect(
    page.getByText("Tu foto del chat está preparada.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Crear avatar", exact: true }).click();
  await expect(
    page.getByText("1 fotos recibidas.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Fotos tuyas (hasta tres)")).not.toHaveAttribute(
    "required",
    "",
  );
  await expect(
    page.getByLabel("Declaro que soy la persona de las fotos"),
  ).not.toBeChecked();
  await expect(page.locator("blockquote")).toBeVisible();
  const other = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env.COOPER_E2E_PORT}`,
    extraHTTPHeaders: {
      Referer: `http://127.0.0.1:${process.env.COOPER_E2E_PORT}`,
    },
  });
  await login(other.request, "luis@example.test");
  const foreignPage = await other.newPage();
  await foreignPage.goto(page.url());
  await expect(
    foreignPage.getByRole("heading", {
      name: "Este espacio no está disponible.",
    }),
  ).toBeVisible();
  await other.close();
});
test("biblioteca propia, verificación simulada, privacidad y compartir", async ({
  page,
  browser,
}) => {
  await login(page.request);
  await page.goto("/avatares");
  await page.getByRole("button", { name: "Vista previa de Alma" }).click();
  await expect(page.getByRole("button", { name: "Pausar Alma" })).toBeVisible();
  await page.getByRole("button", { name: "Crear avatar" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Ana presentadora");
  await page.getByLabel("Fotos tuyas (hasta tres)").setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByText("1 fotos recibidas.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Grabar audio", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Detener grabación" }).click();
  await expect(page.getByText("Grabación recibida")).toBeVisible();
  await page.getByLabel("Declaro que soy la persona de las fotos").check();
  await page.getByRole("button", { name: "Crear en modo simulado" }).click();
  await expect(
    page.getByRole("heading", { name: "Ana presentadora" }),
  ).toBeVisible();
  await expect(page.getByText("Solo tú", { exact: true })).toBeVisible();
  const other = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env.COOPER_E2E_PORT ?? "3107"}`,
    extraHTTPHeaders: {
      Referer: `http://127.0.0.1:${process.env.COOPER_E2E_PORT ?? "3107"}`,
    },
  });
  await login(other.request, "luis@example.test");
  expect(
    (await (await other.request.get("/api/estado")).json()).assets,
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Compartir", exact: true }).click();
  await expect(page.getByText("Compartido con el equipo")).toBeVisible();
  expect(
    (await (await other.request.get("/api/estado")).json()).assets,
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Hacer privado" }).click();
  expect(
    (await (await other.request.get("/api/estado")).json()).assets,
  ).toHaveLength(0);
  await other.close();
});
test("perfil guarda tema, inicio y WhatsApp; móvil y teclado", async ({
  page,
}) => {
  await login(page.request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/perfil");
  await page
    .getByRole("textbox", { name: "Tu nombre", exact: true })
    .fill("Ana del equipo");
  await page.getByRole("textbox", { name: /^WhatsApp/ }).fill("+51987654321");
  await page.getByRole("radio", { name: "Día", exact: true }).check();
  await page
    .getByRole("combobox", { name: "Al abrir Cooper", exact: true })
    .selectOption("fabrica");
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(page.getByText("Tu perfil está actualizado.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "claro");
  await page.goto("/");
  await expect(page.getByRole("tab", { name: /Fábrica/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Mensaje para Cooper" }),
  ).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page.getByRole("link", { name: "Mi perfil" }).click();
  await page.getByRole("radio", { name: "Noche", exact: true }).check();
  await page
    .getByRole("combobox", { name: "Al abrir Cooper", exact: true })
    .selectOption("chat");
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "oscuro");
});
test("administración, gastos por periodo, alerta y revocación inmediata", async ({
  page,
  browser,
}) => {
  await login(page.request, "admin@example.test");
  await page.goto("/admin");
  await expect(page.locator(".workspace")).toHaveAttribute("data-conexion", "activa");
  await expect(
    page.getByRole("heading", { name: "El equipo, en perspectiva" }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByText("Gasto diario alto", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Semana", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mes", exact: true }).click();
  await page.getByLabel("Correo permitido").fill("invitado@example.test");
  await page.getByRole("button", { name: "Invitar", exact: true }).click();
  await expect(
    page.getByText("invitado@example.test", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retirar invitado@example.test" })
    .click();
  await expect(
    page.getByText("invitado@example.test", { exact: true }),
  ).toHaveCount(0);
  const other = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env.COOPER_E2E_PORT ?? "3107"}`,
    extraHTTPHeaders: {
      Referer: `http://127.0.0.1:${process.env.COOPER_E2E_PORT ?? "3107"}`,
    },
  });
  await login(other.request, "luis@example.test");
  const suspendedPage = await other.newPage();
  await suspendedPage.goto("/");
  await expect(suspendedPage.locator(".workspace")).toHaveAttribute("data-conexion", "activa");
  const row = page.getByRole("row").filter({ hasText: "luis@example.test" });
  await row.getByRole("button", { name: "Desactivar" }).click();
  expect((await other.request.get("/api/estado")).status()).toBe(401);
  await expect(suspendedPage).toHaveURL(/entrar/);
  await row.getByRole("button", { name: "Reactivar" }).click();
  expect((await other.request.get("/api/estado")).status()).toBe(200);
  await other.close();
  await page.screenshot({
    path: "test-results/visual/admin-1440.png",
    fullPage: true,
  });
});
test("auditoría AA de todas las pantallas, anchuras y ambos temas", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page.request, "admin@example.test");
  videoId = (await (await page.request.get("/api/estado")).json()).videos[0].id;
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await noOverflow(page);
    await expect(page.locator(".workspace")).toHaveAttribute("data-conexion", "activa");
    if (width < 768) await page.getByRole("tab", { name: /Fábrica/ }).click();
    await noOverflow(page);
    await page.screenshot({
      path: `test-results/visual/inicio-${width}.png`,
      fullPage: true,
    });
  }
  for (const theme of ["oscuro", "claro"]) {
    const state = await (await page.request.get("/api/estado")).json();
    await page.request.patch("/api/perfil", {
      data: {
        name: state.user.name,
        image: state.user.image,
        theme,
        home: "chat",
        whatsapp: "",
      },
    });
    for (const path of [
      "/",
      "/canales",
      "/videos",
      `/videos/${videoId}`,
      "/avatares",
      "/perfil",
      "/admin",
    ]) {
      for (const width of [360, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator(".workspace")).toHaveAttribute("data-conexion", "activa");
        await noOverflow(page);
        const results = await new AxeBuilder({ page })
          .withTags([
            "wcag2a",
            "wcag2aa",
            "wcag21a",
            "wcag21aa",
            "wcag22a",
            "wcag22aa",
          ])
          .analyze();
        expect(results.violations, `${path} ${theme} ${width}`).toEqual([]);
        await page.screenshot({
          path: `test-results/visual/${path.replaceAll("/", "_") || "inicio"}-${theme}-${width}.png`,
          fullPage: true,
        });
        if (path === "/" && width < 768) {
          await page.getByRole("tab", { name: /Fábrica/ }).click();
          await noOverflow(page);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          await page.screenshot({
            path: `test-results/visual/fabrica-${theme}-${width}.png`,
            fullPage: true,
          });
        }
      }
    }
  }
  await page.setViewportSize({ width: 720, height: 500 });
  await page.goto("/perfil");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await noOverflow(page);
});

test("elige avatar, voz y presencia al pedir un video desde la biblioteca", async ({
  page,
}) => {
  await login(page.request);
  await page.goto("/videos");
  await expect(page.locator(".workspace")).toHaveAttribute("data-conexion", "activa");
  await page.getByRole("button", { name: "Pedir video", exact: true }).click();
  const state = await (await page.request.get("/api/estado")).json();
  await page
    .getByRole("combobox", { name: "Canal", exact: true })
    .selectOption(state.channels[0].id);
  await page.getByLabel("Idea del video").fill("Cooper explica las mareas");
  await page
    .getByRole("combobox", { name: "Presentador", exact: true })
    .selectOption("cooper");
  await page
    .getByRole("combobox", { name: "Voz", exact: true })
    .selectOption("clara");
  await page.getByLabel("Presencia del avatar").selectOption("completo");
  await page.getByRole("button", { name: "Enviar a la fábrica" }).click();
  await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", { name: "Cooper explica las mareas" }),
    })
    .click();
  await expect(page.locator(".presenter-summary")).toContainText(
    "Presentador: Cooper",
  );
  await expect(page.locator(".presenter-summary")).toContainText("Voz: Clara");
  await expect(page.locator(".presenter-summary")).toContainText(
    "En todo el video",
  );
});

test("bienvenida vacía: las tres acciones quedan antes del compositor", async ({
  page,
}) => {
  // Luis no ha creado contenido; no usar el administrador con todos los videos.
  await login(page.request, "luis@example.test");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/");
    const first = page.getByRole("button", { name: "Crear mi primer canal" });
    await expect(first).toBeVisible();
    const actions = await page.locator(".suggestions:visible").boundingBox();
    const composer = await page.locator(".composer-area:visible").boundingBox();
    expect(actions!.y + actions!.height).toBeLessThanOrEqual(composer!.y);
    await first.click();
    await expect(
      page.getByRole("textbox", { name: "Mensaje para Cooper" }),
    ).toHaveValue("Crea un canal: Ciencia cotidiana");
    await noOverflow(page);
  }
});
test("identidad con frase renovable, formulario accesible y entrenamiento en vivo", async ({
  page,
}) => {
  await login(page.request);
  await page.goto("/avatares");
  await page.getByRole("button", { name: "Voces", exact: true }).click();
  await page.getByRole("button", { name: "Crear voz", exact: true }).click();
  const primera = await page.locator(".identity-form blockquote").innerText();
  await page.getByRole("button", { name: "Crear voz", exact: true }).click();
  await page.getByRole("button", { name: "Crear voz", exact: true }).click();
  await expect(page.locator(".identity-form blockquote")).not.toHaveText(
    primera,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `test-results/visual/identidad-${width}.png`,
      fullPage: true,
    });
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("Nombre", { exact: true }).fill("Voz de prueba");
  await page.getByRole("button", { name: "Grabar audio", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Detener grabación" }).click();
  await expect(page.getByText("Grabación recibida")).toBeVisible();
  await page.getByLabel("Declaro que soy la persona de las fotos").check();
  await page.getByRole("button", { name: "Crear en modo simulado" }).click();
  const asset = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Voz de prueba" }) });
  await expect(asset.getByRole("status")).toHaveText("Entrenamiento en curso");
  await expect(
    asset.getByRole("button", { name: "Compartir", exact: true }),
  ).toBeDisabled();
  await expect(asset.getByRole("status")).toHaveText("Listo para usar");
  await expect(
    asset.getByRole("button", { name: "Compartir", exact: true }),
  ).toBeEnabled();
  const state = await (await page.request.get("/api/estado")).json();
  const own = state.assets.find(
    (a: { name: string }) => a.name === "Voz de prueba",
  );
  expect(own.consentAt).toBeGreaterThan(0);
  expect(
    (await page.request.get(`/api/muestra/${own.id}`)).headers()[
      "content-type"
    ],
  ).toBe("audio/wav");
  await page.reload();
  await page.getByRole("button", { name: "Voces", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Voz de prueba" }),
  ).toBeVisible();
  const channel = await (
    await page.request.post("/api/orden", {
      data: { evento: "nuevo_canal", texto: "Consentimiento de ensayo" },
    })
  ).json();
  const video = await (
    await page.request.post("/api/orden", {
      data: {
        evento: "nuevo_video",
        recursoId: channel.id,
        texto: "Mi voz elegida",
        voiceId: own.id,
        avatarPlacement: "partes",
      },
    })
  ).json();
  await asset.getByRole("button", { name: "Revocar consentimiento" }).click();
  await expect(
    asset.getByText("Consentimiento revocado. Los videos en cola se cancelan."),
  ).toBeVisible();
  const final = await (await page.request.get("/api/estado")).json();
  expect(
    final.videos.find((v: { id: string }) => v.id === video.id),
  ).toMatchObject({ voiceId: own.id, productionState: "cancelada" });
  await page.goto(`/videos/${video.id}`);
  await expect(
    page.getByRole("status").filter({ hasText: "Video cancelado" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aprobar", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Pedir cambios" }),
  ).toBeDisabled();
  await expect(page.locator(".presenter-summary")).toContainText(
    "Voz de prueba",
  );
  await expect(page.locator(".journey .current small")).toHaveText("Cancelado");
  await expect(page.locator(".stage-live")).toHaveCount(0);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `.cache/capturas-final2/presentacion-revocada-${width}.png`,
      fullPage: true,
    });
  }
});

test("modo noticia por canal se detiene sin verificación real", async ({
  page,
}) => {
  const request = page.request;
  await login(request);
  const created = await request.post("/api/orden", {
    data: {
      evento: "nuevo_canal",
      texto: "Observatorio del día",
      nombre: "Observatorio del día",
    },
  });
  expect(created.status()).toBe(200);
  const { id } = await created.json();
  await page.goto("/canales");
  const toggle = page.getByRole("button", {
    name: /Modo noticia: .* de Observatorio del día/,
  });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({
      path: `test-results/visual/noticias-${width}.png`,
      fullPage: true,
    });
  }
  const made = await request.post("/api/orden", {
    data: {
      evento: "nuevo_video",
      recursoId: id,
      texto: "Noticia del observatorio",
    },
  });
  expect(made.status()).toBe(200);
  const video = await made.json();
  await page.goto(`/videos/${video.id}`);
  await expect(
    page.getByText(
      "Modo noticia: el simulador no verifica noticias reales. Se necesitan datos con fuentes antes de avanzar.",
    ),
  ).toBeVisible();
  const state = await (await request.get("/api/estado")).json();
  expect(
    state.videos.find((v: { id: string }) => v.id === video.id),
  ).toMatchObject({ newsMode: true, stage: 2, productionState: "pausada" });
  await page.goto("/canales");
  await page
    .getByRole("button", { name: /Modo noticia: .* de Observatorio del día/ })
    .click();
  await expect(
    page.getByRole("button", {
      name: /Modo noticia: .* de Observatorio del día/,
    }),
  ).toHaveAttribute("aria-pressed", "false");
});
