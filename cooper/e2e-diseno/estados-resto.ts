import {
  expect,
  type ConsoleMessage,
  type Page,
  type Route,
} from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Estado } from "../src/servicios/datos";

type EvidenciaHttp = {
  estado: string;
  metodo: string;
  ruta: string;
  status: number;
  origen: "respuesta real de ensayo" | "respuesta interceptada en Playwright";
  motivo: string;
  diagnosticosEsperados: { texto: string; ruta: string }[];
};

/**
 * Captura estados de componentes reales, sin añadir rutas al producto.
 * Debe llamarse desde la matriz demo, con sus listeners de consola ya instalados.
 * Usa el servidor NO demo y su emisor aislado; restaura la sesión demo al salir.
 * Los 503 se inyectan solo en el transporte del navegador. Los 400 y 404 vienen
 * de la aplicación. No fuerza ni representa como probado el error.tsx global.
 */
export async function capturarEstados(
  page: Page,
  shot: (name: string) => Promise<unknown>,
  messages: string[],
) {
  const width = page.viewportSize()?.width;
  if (!width) throw new Error("La matriz necesita un viewport explícito.");
  const port = (name: string) => {
    const value = process.env[name];
    if (
      !value ||
      !/^\d+$/.test(value) ||
      Number(value) > 65535 ||
      Number(value) < 1
    )
      throw new Error(`Falta el puerto de ensayo ${name}.`);
    return value;
  };
  const origin = `http://127.0.0.1:${port("COOPER_E2E_PORT")}`;
  const fixture = `http://127.0.0.1:${port("COOPER_E2E_FIXTURE_PORT")}`;
  const demoOrigin = `http://127.0.0.1:${port("COOPER_E2E_DEMO_PORT")}`;
  const demoFixture = `http://127.0.0.1:${port("COOPER_E2E_DEMO_FIXTURE_PORT")}`;
  const previousUrl = page.url();
  expect(new URL(previousUrl).origin, "El helper parte de la matriz demo").toBe(
    demoOrigin,
  );
  if (
    !process.env.COOPER_E2E_SECRET ||
    process.env.COOPER_E2E_SECRET.length < 32
  )
    throw new Error("Falta la credencial efímera del emisor de pruebas.");
  for (const destination of [fixture, demoFixture]) {
    const probe = await page.request.get(`${destination}/destino`);
    expect(probe.ok()).toBe(true);
    expect(await probe.json()).toEqual({ destino: "cooper-e2e-aislado" });
  }
  const directory = "../evidencias-diseno";
  mkdirSync(directory, { recursive: true });
  const http: EvidenciaHttp[] = [];
  const screens: string[] = [];
  const save = () =>
    writeFileSync(
      `${directory}/estados-resto-${width}.json`,
      JSON.stringify(
        {
          width,
          servidor: "E2E no demo; base temporal y proveedores simulados",
          pantallas: screens,
          http,
          limites: [
            "El esqueleto capturado es el estado de carga real de SaludOperativa mientras espera su API.",
            "Los errores recuperables son estados reales de Perfil, WhatsApp y SaludOperativa; no se fuerza el error.tsx global.",
            "Avatares y Voces conservan su catálogo; el vacío corresponde a la biblioteca privada sin recursos.",
            "Los 404 transmitidos por streaming pueden conservar HTTP 200; se verifica además la página no encontrada.",
          ],
        },
        null,
        2,
      ),
    );
  const capture = async (name: string) => {
    await shot(name);
    screens.push(name);
    save();
  };
  async function login(target: string, email: string) {
    const result = await page.request.post(`${target}/sesion`, {
      data: { email, secret: process.env.COOPER_E2E_SECRET },
    });
    expect(result.ok(), "El emisor aislado acepta la cuenta ficticia").toBe(
      true,
    );
  }
  async function state(): Promise<Estado> {
    const result = await page.request.get(`${origin}/api/estado`, {
      headers: { Referer: origin },
    });
    expect(result.ok()).toBe(true);
    const value: Estado = await result.json();
    expect(value.demo, "Los vacíos deben proceder de la base sin demo").toBe(
      false,
    );
    return value;
  }
  async function expectedHttp(
    config: Omit<EvidenciaHttp, "diagnosticosEsperados" | "status"> & {
      statuses: number[];
    },
    action: () => Promise<unknown>,
  ) {
    const url = new URL(config.ruta, origin).href;
    const captured: EvidenciaHttp["diagnosticosEsperados"] = [];
    const start = messages.length;
    const onConsole = (message: ConsoleMessage) => {
      if (
        captured.length ||
        message.type() !== "error" ||
        message.location().url !== url
      )
        return;
      const text = message.text();
      const known = config.statuses
        .filter((status) => status >= 400)
        .some((status) =>
          new RegExp(
            `^Failed to load resource: the server responded with a status of ${status}(?: \\([^)]*\\))?$`,
          ).test(text),
        );
      if (!known) return;
      // El listener de la matriz se ejecuta primero. Retiramos únicamente el
      // evento exacto que acabamos de identificar por URL y HTTP esperado.
      // Otro warning, pageerror o error sin URL queda intacto y falla la puerta.
      const index = messages.length - 1;
      if (index >= start && messages[index] === text) messages.splice(index, 1);
      captured.push({ texto: text, ruta: config.ruta });
    };
    page.on("console", onConsole);
    try {
      const [response] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url() === url &&
            response.request().method() === config.metodo,
        ),
        action(),
      ]);
      expect(config.statuses).toContain(response.status());
      await response.finished();
      // Entrega los diagnósticos del navegador antes de cerrar la clasificación.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      );
      http.push({
        estado: config.estado,
        metodo: config.metodo,
        ruta: config.ruta,
        status: response.status(),
        origen: config.origen,
        motivo: config.motivo,
        diagnosticosEsperados: captured,
      });
      save();
    } finally {
      page.off("console", onConsole);
    }
  }
  const userEmail = `estados-${width}@example.test`;
  const phone = `+51910${String(width).padStart(6, "0")}`;
  try {
    // La cookie Auth.js es por host, no por puerto: cerrar el SSE antes de cambiarla.
    await page.goto("about:blank");
    await page.setExtraHTTPHeaders({ Referer: origin });
    await login(fixture, "admin@example.test");
    const invited = await page.request.post(`${origin}/api/admin/permitidos`, {
      data: { email: userEmail },
      headers: { Referer: origin },
    });
    expect(
      invited.ok(),
      "Alta ficticia para esta anchura, dentro del máximo de diez cuentas",
    ).toBe(true);
    await login(fixture, userEmail);
    const initial = await state();
    expect(initial.channels).toEqual([]);
    expect(initial.assets).toEqual([]);
    expect(initial.whatsapp.simulada).toBe(true);

    await page.goto(`${origin}/canales`);
    await expect(
      page.getByRole("heading", {
        name: "Un espacio para tu primera historia",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Dar nombre a mi canal" }),
    ).toHaveCount(1);
    await capture("canales-vacio");
    await page.goto(`${origin}/avatares`);
    await expect(page.locator(".library-empty")).toContainText(
      "Aquí vivirán tus avatares",
    );
    await capture("avatares-biblioteca-vacia");
    await page.getByRole("button", { name: "Voces", exact: true }).click();
    await expect(page.locator(".library-empty")).toContainText(
      "Aquí vivirán tus voces",
    );
    await capture("voces-biblioteca-vacia");

    await page.goto(`${origin}/perfil`);
    const nameInput = page.getByRole("textbox", {
      name: "Tu nombre",
      exact: true,
    });
    const phoneInput = page.getByRole("textbox", { name: /^WhatsApp/ });
    await nameInput.fill("Lucía · Ensayo visual");
    await phoneInput.fill("");
    const saveProfile = page.getByRole("button", {
      name: "Guardar perfil",
      exact: true,
    });
    await saveProfile.click();
    await expect(
      page.getByText("Tu perfil está actualizado.", { exact: true }),
    ).toBeVisible();
    await capture("perfil-guardado");
    await page
      .getByRole("button", { name: "Pausar movimiento", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Activar movimiento", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await capture("perfil-movimiento-pausado");
    await page
      .getByRole("button", { name: "Activar movimiento", exact: true })
      .click();

    await phoneInput.fill(phone);
    const profilePath = `${origin}/api/perfil`;
    const profileError = async (route: Route) =>
      route.fulfill({
        status: 503,
        json: {
          error:
            "No pudimos guardar tu perfil. Conservamos los campos; vuelve a intentarlo.",
        },
      });
    await page.route(profilePath, profileError, { times: 1 });
    await expectedHttp(
      {
        estado: "perfil-error",
        metodo: "PATCH",
        ruta: "/api/perfil",
        statuses: [503],
        origen: "respuesta interceptada en Playwright",
        motivo:
          "Fallo de guardado deliberado; se conserva el formulario y se verifica el reintento.",
      },
      () => saveProfile.click(),
    );
    await expect(
      page.locator(".profile-form").getByRole("alert"),
    ).toContainText("Conservamos los campos");
    await expect(phoneInput).toHaveValue(phone);
    await capture("perfil-error");
    await page.unroute(profilePath, profileError);
    await saveProfile.click();
    await expect(
      page.getByText("Tu perfil está actualizado.", { exact: true }),
    ).toBeVisible();

    const whatsapp = page.getByRole("region", {
      name: "Tus avisos por WhatsApp",
    });
    await expect(
      whatsapp.getByText(`Número pendiente de verificar: ${phone}`, {
        exact: true,
      }),
    ).toBeVisible();
    await capture("whatsapp-pendiente");
    await whatsapp
      .getByRole("checkbox", { name: /Acepto recibir un código/ })
      .check();
    await whatsapp
      .getByRole("button", { name: "Enviar código", exact: true })
      .click();
    const code = await whatsapp
      .getByTestId("whatsapp-codigo-simulado")
      .innerText();
    expect(code).toMatch(/^\d{6}$/);
    await capture("whatsapp-codigo");
    const codeInput = whatsapp.getByRole("textbox", {
      name: "Código de verificación",
      exact: true,
    });
    await codeInput.fill(code === "000000" ? "111111" : "000000");
    await expectedHttp(
      {
        estado: "whatsapp-codigo-error",
        metodo: "POST",
        ruta: "/api/whatsapp/verificar",
        statuses: [400],
        origen: "respuesta real de ensayo",
        motivo:
          "Código ficticio incorrecto para comprobar el rechazo real y la recuperación.",
      },
      () =>
        whatsapp
          .getByRole("button", { name: "Verificar número", exact: true })
          .click(),
    );
    await expect(whatsapp.getByRole("alert")).toContainText(
      "El código no es válido",
    );
    await expect(codeInput).toHaveAttribute("aria-invalid", "true");
    await capture("whatsapp-codigo-error");
    await codeInput.fill(code);
    await whatsapp
      .getByRole("button", { name: "Verificar número", exact: true })
      .click();
    await expect(
      whatsapp.getByText(`Número verificado: ${phone}`, { exact: true }),
    ).toBeVisible();
    await whatsapp
      .getByRole("checkbox", { name: "Guion listo para aprobar", exact: true })
      .check();
    await whatsapp
      .getByRole("checkbox", { name: "Video publicado", exact: true })
      .check();
    await whatsapp
      .getByRole("button", { name: "Guardar avisos", exact: true })
      .click();
    await expect(
      whatsapp.getByText("Tus avisos están actualizados.", { exact: true }),
    ).toBeVisible();
    await capture("whatsapp-verificado");

    for (const [label, path, link] of [
      [
        "error-404-publico",
        "/pagina-inexistente-ensayo-diseno",
        "Volver al inicio",
      ],
      [
        "error-404-estudio",
        "/videos/video-inexistente-ensayo-diseno",
        "Ver mis videos",
      ],
    ] as const) {
      await expectedHttp(
        {
          estado: label,
          metodo: "GET",
          ruta: path,
          statuses: [200, 404],
          origen: "respuesta real de ensayo",
          motivo:
            "Recurso inexistente; Next puede transmitir la página 404 con HTTP 200 después de iniciar streaming.",
        },
        () => page.goto(`${origin}${path}`),
      );
      await expect(
        page.getByRole("heading", {
          name: "Este espacio no está disponible.",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: link, exact: true }),
      ).toBeVisible();
      await capture(label);
    }

    await page.goto("about:blank");
    await login(fixture, "admin@example.test");
    const healthPath = `${origin}/api/admin/salud`;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = page.waitForRequest(
      (request) => request.url() === healthPath && request.method() === "GET",
      { timeout: 10_000 },
    );
    const healthError = async (route: Route) => {
      await gate;
      await route.fulfill({
        status: 503,
        json: {
          error: "No pudimos consultar la operación. Vuelve a intentarlo.",
        },
      });
    };
    await page.route(healthPath, healthError, { times: 1 });
    try {
      await page.goto(`${origin}/admin/salud`, {
        waitUntil: "domcontentloaded",
      });
      await pending;
      await expect(page.locator(".operacion-carga")).toHaveAttribute(
        "aria-busy",
        "true",
      );
      await capture("salud-carga");
      await expect(page.locator(".operacion-carga")).toBeVisible();
      await expectedHttp(
        {
          estado: "salud-error",
          metodo: "GET",
          ruta: "/api/admin/salud",
          statuses: [503],
          origen: "respuesta interceptada en Playwright",
          motivo:
            "La petición retenida permite capturar el esqueleto; después falla para revisar la recuperación.",
        },
        async () => release(),
      );
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "No pudimos consultar la operación",
      );
      await capture("salud-error");
    } finally {
      release();
      await page.unroute(healthPath, healthError);
    }
    await page
      .getByRole("button", { name: "Actualizar salud", exact: true })
      .click();
    await expect(
      page.getByRole("navigation", { name: "Resumen de salud", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await capture("salud-recuperada");
  } finally {
    save();
    await page.goto("about:blank");
    await page.setExtraHTTPHeaders({ Referer: demoOrigin });
    await login(demoFixture, "admin@example.test");
    await page.goto(previousUrl);
  }
}
