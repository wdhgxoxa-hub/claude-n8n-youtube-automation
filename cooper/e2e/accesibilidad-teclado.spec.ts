import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function comprobarReferenciasAccesibles(page: Page) {
  const referenciasInvalidas = await page.evaluate(() => {
    // Incluye las rutas ocultas conservadas por Next: sus IDs también comparten DOM.
    const ids = new Map<string, number>();
    document.querySelectorAll("[id]").forEach((element) => {
      ids.set(element.id, (ids.get(element.id) ?? 0) + 1);
    });
    const referencias: { atributo: string; id: string; destinos: number }[] =
      [];
    for (const atributo of [
      "aria-controls",
      "aria-labelledby",
      "aria-describedby",
      "for",
    ]) {
      document.querySelectorAll(`[${atributo}]`).forEach((element) => {
        const valor = element.getAttribute(atributo) ?? "";
        const destinos = atributo === "for" ? [valor] : valor.split(/\s+/);
        for (const id of destinos.filter(Boolean)) {
          if (ids.get(id) !== 1)
            referencias.push({ atributo, id, destinos: ids.get(id) ?? 0 });
        }
      });
    }
    return referencias;
  });
  expect(referenciasInvalidas).toEqual([]);
}

async function entrar(request: APIRequestContext) {
  const response = await request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
    {
      data: {
        email: "admin@example.test",
        secret: process.env.COOPER_E2E_SECRET,
      },
    },
  );
  expect(response.status()).toBe(200);
}

test("inicio a 360 px: pestañas, navegación modal y ruta completa por teclado", async ({
  page,
}) => {
  await entrar(page.request);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await comprobarReferenciasAccesibles(page);
  const chat = page.getByRole("tab", { name: "Chat", exact: true });
  const fabrica = page.getByRole("tab", { name: /Fábrica/ });
  await chat.focus();
  await page.keyboard.press("ArrowRight");
  await expect(fabrica).toBeFocused();
  await expect(fabrica).toHaveAttribute("aria-selected", "true");
  await expect(chat).toHaveAttribute("tabindex", "-1");
  await expect(page.getByRole("tabpanel", { name: "Chat" })).toBeHidden();
  await expect(page.getByRole("tabpanel", { name: /Fábrica/ })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tabpanel", { name: /Fábrica/ })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(fabrica).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(chat).toBeFocused();
  await page.keyboard.press("End");
  await expect(fabrica).toBeFocused();
  await page.keyboard.press("Home");
  await expect(chat).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(fabrica).toBeFocused();
  await page.keyboard.press("Home");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tabpanel", { name: "Chat" })).toBeFocused();

  const opener = page.getByRole("button", { name: "Abrir navegación" });
  await opener.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("dialog", { name: "Navegación del estudio" });
  const brand = menu.getByRole("link", { name: "Cooper, inicio" });
  await expect(brand).toBeFocused();
  await expect(page.locator(".main-column")).toHaveAttribute("inert", "");
  await expect(
    page.getByRole("link", {
      name: "Saltar al contenido",
      includeHidden: true,
    }),
  ).toHaveAttribute("inert", "");
  await page.keyboard.press("Shift+Tab");
  await expect(
    menu.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(brand).toBeFocused();
  for (const theme of ["claro", "oscuro"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await expect(menu).toHaveCount(0);
  await page.keyboard.press("Enter");
  await menu.getByRole("link", { name: /videos en producción/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/videos$/);
  await expect(page).toHaveTitle("Videos · Cooper");
  await expect(
    page.getByRole("heading", { level: 1, name: "Videos" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".main-column")).not.toHaveAttribute("inert", "");

  await opener.press("Enter");
  await menu
    .getByRole("navigation", { name: "Principal", exact: true })
    .getByRole("link", { name: "Inicio", exact: true })
    .press("Enter");
  await expect(page).toHaveTitle("Inicio · Cooper");
  await expect(
    page.getByRole("tab", { name: "Chat", exact: true }),
  ).toBeVisible();
  await comprobarReferenciasAccesibles(page);
  await expect(
    page.getByRole("textbox", { name: "Mensaje para Cooper" }),
  ).toHaveAccessibleDescription(/Pulsa Entrar para enviar/);
  const bienvenida = page.getByRole("button", { name: "Conocer el estudio" });
  await bienvenida.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Una idea, un equipo." }),
  ).toBeVisible();
  await comprobarReferenciasAccesibles(page);
  await page.keyboard.press("Escape");
  await expect(bienvenida).toBeFocused();
});

test("recuerdos: retomar desde fábrica y cancelar o borrar conservan el foco", async ({
  page,
}) => {
  await entrar(page.request);
  expect(
    (
      await page.request.post("/api/chat", {
        data: {
          texto:
            "Título provisional: Una idea accesible. Pendiente revisar el guion.",
        },
      })
    ).status(),
  ).toBe(200);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("tab", { name: /Fábrica/ }).click();
  await page.getByRole("button", { name: "Retomar", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("textbox", { name: "Mensaje para Cooper", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Chat", exact: true }),
  ).toHaveAttribute("aria-selected", "true");

  await page
    .getByRole("button", { name: "Ver lo recordado", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const borrar = page.getByRole("button", {
    name: "Borrar lo recordado",
    exact: true,
  });
  const conservar = page.getByRole("button", {
    name: "Conservar recuerdos",
    exact: true,
  });
  await borrar.focus();
  await page.keyboard.press("Enter");
  await expect(conservar).toBeFocused();
  await expect(
    page.getByRole("group", { name: "Confirmación de borrado" }),
  ).toBeVisible();
  for (const theme of ["oscuro", "claro"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.keyboard.press("Escape");
  await expect(borrar).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(conservar).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(borrar).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(conservar).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Confirmar borrado de recuerdos" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(borrar).toBeFocused();
  await expect(
    page.getByRole("status").filter({ hasText: "Se borró lo recordado." }),
  ).toBeVisible();
});

test("chat: salto al contenido, composición, confirmaciones y errores con teclado", async ({
  page,
}) => {
  await entrar(page.request);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { user } = await (await page.request.get("/api/estado")).json();
  try {
    expect(
      (
        await page.request.patch("/api/perfil", {
          data: { ...user, home: "fabrica" },
        })
      ).status(),
    ).toBe(200);
    await page.goto("/");
    await expect(page.locator(".studio:visible")).toHaveClass(/tab-fabrica/);
  } finally {
    // Restaurar la preferencia compartida; Inicio conserva su selección montada.
    expect(
      (await page.request.patch("/api/perfil", { data: user })).status(),
    ).toBe(200);
  }
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Saltar al contenido" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const message = page.getByRole("textbox", {
    name: "Mensaje para Cooper",
    exact: true,
  });
  await message.fill("Crea un canal: Una idea de teclado");
  await page.keyboard.press("Shift+Enter");
  await expect(message).toHaveValue("Crea un canal: Una idea de teclado\n");
  await page.keyboard.press("Enter");
  const cancel = page.getByRole("button", { name: "Cancelar", exact: true });
  await expect(cancel).toBeEnabled();
  await expect(
    page.getByRole("log", { name: "Conversación con Cooper" }),
  ).toHaveAttribute("aria-busy", "false");
  await cancel.focus();
  await page.keyboard.press("Enter");
  await expect(cancel).toHaveCount(0);
  await expect(message).toBeFocused();

  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "No pudimos responder. Vuelve a intentarlo." },
    }),
  );
  await message.fill("Revisar mis pendientes");
  await page.keyboard.press("Enter");
  await expect(page.locator(".notice[role=alert]")).toHaveText(
    "No pudimos responder. Vuelve a intentarlo.",
  );
  await expect(message).toHaveValue("Revisar mis pendientes");
  await expect(message).toBeFocused();
  await page.unroute("**/api/chat");
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 502,
      contentType: "text/html",
      body: "<p>Servicio no disponible</p>",
    }),
  );
  await message.press("Enter");
  await expect(page.locator(".notice[role=alert]")).toHaveText(
    "No pudimos confirmar la respuesta. Revisa las tarjetas pendientes antes de repetir el pedido.",
  );
  await expect(message).toHaveValue("Revisar mis pendientes");
  await expect(message).toBeFocused();
  await page.unroute("**/api/chat");
  await page.route("**/api/chat", (route) =>
    route.abort("internetdisconnected"),
  );
  await message.press("Enter");
  await expect(page.locator(".notice[role=alert]")).toHaveText(
    "No pudimos conectar. Tu mensaje sigue aquí; revisa tu conexión antes de enviarlo otra vez.",
  );
  await expect(message).toHaveValue("Revisar mis pendientes");
  await expect(message).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("perfil conserva los campos y explica fallos de conexión y respuesta en español", async ({
  page,
}) => {
  await entrar(page.request);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/perfil");
  const nombre = page.getByRole("textbox", { name: "Tu nombre", exact: true });
  const anterior = await nombre.inputValue();
  const guardar = page.getByRole("button", {
    name: "Guardar perfil",
    exact: true,
  });
  const aviso = page.locator(".profile-form .notice[role=alert]");
  await page.route("**/api/perfil", (route) =>
    route.abort("internetdisconnected"),
  );
  await guardar.press("Enter");
  await expect(aviso).toHaveText(
    "No pudimos conectar. Comprueba tu conexión y revisa si el cambio se guardó.",
  );
  await expect(nombre).toHaveValue(anterior);
  await page.unroute("**/api/perfil");
  await page.route("**/api/perfil", (route) =>
    route.fulfill({
      status: 502,
      contentType: "text/html",
      body: "<p>Servicio no disponible</p>",
    }),
  );
  await guardar.press("Enter");
  await expect(aviso).toHaveText(
    "No pudimos confirmar el resultado. Revisa si el cambio se guardó.",
  );
  await page.unroute("**/api/perfil");
  await page.route("**/api/perfil", (route) =>
    route.fulfill({
      status: 422,
      json: { error: "Revisa el nombre e inténtalo de nuevo." },
    }),
  );
  await guardar.press("Enter");
  await expect(aviso).toHaveText("Revisa el nombre e inténtalo de nuevo.");
  await expect(nombre).toHaveValue(anterior);
  await page.unroute("**/api/perfil");
  await guardar.press("Enter");
  await expect(page.locator(".profile-form .notice[role=status]")).toHaveText(
    "Tu perfil está actualizado.",
  );
  await expect(aviso).toHaveCount(0);
});
