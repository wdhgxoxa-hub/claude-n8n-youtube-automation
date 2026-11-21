import { test, expect } from "@playwright/test";
const secret = process.env.COOPER_E2E_SECRET!;
test.beforeEach(async ({ page }) => {
  expect(
    (
      await page.request.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT ?? "33172"}/sesion`,
        {
          data: { email: "admin@example.test", secret },
        },
      )
    ).status(),
  ).toBe(200);
});
test("R08 recupera SSE después de una respuesta HTTP temporal", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/eventos", async (route) => {
    attempts++;
    if (attempts === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"Temporal"}',
      });
    else await route.continue();
  });
  await page.goto("/");
  await expect(page.locator(".connection")).toHaveText("En vivo", {
    timeout: 8000,
  });
  expect(attempts).toBeGreaterThan(1);
});
test("R09 el menú móvil contiene el foco y lo devuelve al cerrar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await expect(page.locator(".sidebar a").first()).toBeFocused();
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => !!document.activeElement?.closest(".sidebar")),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Abrir navegación" }),
  ).toBeFocused();
});
test("privacidad en HTML, JSON y carga de sesión Auth.js", async ({
  page,
  browser,
}) => {
  const email = "privacidad@example.test";
  expect(
    (
      await page.request.post("/api/admin/permitidos", { data: { email } })
    ).status(),
  ).toBe(200);
  const context = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env.COOPER_E2E_PORT ?? "33171"}`,
    extraHTTPHeaders: {
      Referer: `http://127.0.0.1:${process.env.COOPER_E2E_PORT ?? "33171"}`,
    },
  });
  try {
    const session = await context.request.post(
      `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT ?? "33172"}/sesion`,
      { data: { email, secret } },
    );
    expect(session.status()).toBe(200);
    const cookies = await context.cookies();
    expect(
      cookies.find((cookie) => cookie.name === "authjs.session-token"),
    ).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    const channel = await (
      await context.request.post("/api/orden", {
        data: { evento: "nuevo_canal", texto: "Solo mío" },
      })
    ).json();
    const video = await (
      await context.request.post("/api/orden", {
        data: {
          evento: "nuevo_video",
          recursoId: channel.id,
          texto: '<img src=x onerror="window.inyeccion=1">',
        },
      })
    ).json();
    const forbidden =
      /Producción simulada|"(?:amount|expenses|threshold|concept|day|week|month)"\s*:/;
    for (const path of [
      "/api/estado",
      "/api/auth/session",
      "/",
      "/canales",
      "/videos",
      `/videos/${video.id}`,
      "/avatares",
      "/perfil",
      "/admin",
    ]) {
      const response = await context.request.get(path);
      const text = (await response.text()).replaceAll('\\"', '"');
      expect(text, path).not.toMatch(forbidden);
      expect(text, path).not.toContain("El equipo, en perspectiva");
    }
    const other = await context.newPage();
    await other.goto(`/videos/${video.id}`);
    expect(await other.evaluate(() => "inyeccion" in window)).toBe(false);
    const first = await context.request.get("/entrar");
    const second = await context.request.get("/entrar");
    expect(first.headers()["content-security-policy"]).not.toBe(
      second.headers()["content-security-policy"],
    );
    await other
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .click();
    await expect(other).toHaveURL(/entrar/);
    expect((await context.request.get("/api/estado")).status()).toBe(401);
  } finally {
    await context.close();
  }
});
test("R12 conserva el correo de invitación cuando falla la red", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.route("**/api/admin/permitidos", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"Inténtalo de nuevo"}',
    }),
  );
  await page.getByLabel("Correo permitido").fill("reintento@example.test");
  await page.getByRole("button", { name: "Invitar", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Inténtalo de nuevo" }),
  ).toBeVisible();
  await expect(page.getByLabel("Correo permitido")).toHaveValue(
    "reintento@example.test",
  );
});
test("R13 libera el micrófono cuando MediaRecorder no puede iniciar", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      Object.assign(window, { grabacionEnsayo: stream });
      return stream;
    };
    Object.defineProperty(window, "MediaRecorder", {
      value: class {
        constructor() {
          throw new Error("Grabador no disponible");
        }
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Grabar audio", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Grabador no disponible" }),
  ).toHaveText("Grabador no disponible");
  expect(
    await page.evaluate(() =>
      (window as unknown as { grabacionEnsayo: MediaStream }).grabacionEnsayo
        .getTracks()
        .every((track) => track.readyState === "ended"),
    ),
  ).toBe(true);
});
test("entrada, no encontrado y formularios accesibles en ambos temas y cuatro anchuras", async ({
  page,
}) => {
  test.setTimeout(180000);
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  for (const theme of ["oscuro", "claro"]) {
    expect(
      (
        await page.request.patch("/api/perfil", {
          data: {
            name: "Ensayo visual",
            image: "",
            theme,
            home: "chat",
            whatsapp: "",
          },
        })
      ).status(),
    ).toBe(200);
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const screen of [
        "entrada",
        "no-encontrado",
        "pedir-video",
        "crear-avatar",
        "crear-voz",
      ]) {
        const path =
          screen === "entrada"
            ? "/entrar?error=AccessDenied"
            : screen === "no-encontrado"
              ? "/inexistente"
              : screen === "pedir-video"
                ? "/videos"
                : "/avatares";
        await page.goto(path);
        if (["entrada", "no-encontrado"].includes(screen)) {
          // La entrada no tiene selector: se inspecciona también el juego de tokens claro.
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
          }, theme);
        } else {
          await expect(page.locator(".connection")).toHaveText("En vivo");
          if (screen === "pedir-video")
            await page
              .getByRole("button", { name: "Pedir video", exact: true })
              .click();
          else {
            if (screen === "crear-voz")
              await page
                .getByRole("button", { name: "Voces", exact: true })
                .click();
            await page
              .getByRole("button", {
                name: screen === "crear-voz" ? "Crear voz" : "Crear avatar",
                exact: true,
              })
              .click();
          }
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          `${screen} ${width}`,
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
          `${screen} ${theme} ${width}`,
        ).toEqual([]);
        await page.screenshot({
          path: `test-results/visual/${screen}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
});
