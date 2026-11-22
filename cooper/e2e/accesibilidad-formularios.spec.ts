import { abrirCooper } from "./ayudas-diseno";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  const respuesta = await page.request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
    {
      data: {
        email: "admin@example.test",
        secret: process.env.COOPER_E2E_SECRET,
      },
    },
  );
  expect(respuesta.ok()).toBe(true);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function accesible(page: Page) {
  for (const tema of ["oscuro"]) {
    await page.evaluate((valor) => {
      document.documentElement.dataset.theme = valor;
    }, tema);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
}

test("Pedir video conserva el foco al cancelar y respeta el control elegido mientras guarda", async ({
  page,
}) => {
  await page.goto("/videos");
  const abrir = page.getByRole("button", { name: "Pedir video", exact: true });
  await expect(abrir).toHaveCount(1);
  await abrir.focus();
  await page.keyboard.press("Enter");
  await expect(abrir).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("combobox", { name: "Canal", exact: true }),
  ).toBeFocused();
  await accesible(page);
  await page.getByRole("button", { name: "Cancelar", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(abrir).toBeFocused();
  await expect(abrir).toHaveAttribute("aria-expanded", "false");
  const respuesta = await page.request.post("/api/orden", {
    data: {
      evento: "nuevo_canal",
      texto: "Ensayo de foco al guardar",
      nombre: "Foco de formulario",
    },
  });
  expect(respuesta.ok()).toBe(true);
  const { id } = await respuesta.json();
  await page.reload();
  await abrir.press("Enter");
  await page
    .getByRole("combobox", { name: "Canal", exact: true })
    .selectOption(id);
  await page.getByLabel("Idea del video").fill("Una idea con foco");
  const solicitud: { responder?: () => void } = {};
  await page.route("**/api/orden", async (route) => {
    await new Promise<void>((resolve) => {
      solicitud.responder = resolve;
    });
    await route.fulfill({ status: 200, json: { id: "video-de-ensayo" } });
  });
  const enviar = page.getByRole("button", {
    name: "Enviar a la fábrica",
    exact: true,
  });
  await enviar.press("Enter");
  await expect(enviar).toBeDisabled();
  await expect.poll(() => typeof solicitud.responder).toBe("function");
  const filtro = page.getByRole("button", {
    name: "En producción",
    exact: true,
  });
  await filtro.focus();
  await page.keyboard.press("Enter");
  solicitud.responder!();
  await expect(enviar).toHaveCount(0);
  await expect(filtro).toBeFocused();
});

test("Alta de marca anuncia cada paso y devuelve el foco al salir", async ({
  page,
}) => {
  await page.goto("/marcas");
  const abrir = page.getByRole("button", {
    name: /^(Añadir marca o cuenta|Crear mi primera marca)$/,
  });
  await expect(abrir).toHaveCount(1);
  await abrir.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Identidad y dueño", { exact: true }).last(),
  ).toBeFocused();
  await page.getByLabel("Nombre de la marca").fill("Marca accesible");
  await page
    .getByRole("button", { name: "Continuar", exact: true })
    .press("Enter");
  await expect(
    page.getByText("Guía visual", { exact: true }).last(),
  ).toBeFocused();
  await accesible(page);
  await page
    .getByRole("button", { name: "Continuar", exact: true })
    .press("Enter");
  await expect(
    page.getByText("Especialista y revisión", { exact: true }).last(),
  ).toBeFocused();
  await accesible(page);
  await page
    .getByRole("button", { name: "Anterior", exact: true })
    .press("Enter");
  await expect(
    page.getByText("Guía visual", { exact: true }).last(),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Cerrar", exact: true })
    .press("Enter");
  await expect(abrir).toBeFocused();
});

test("Confirmar operación permite cancelar con Escape y retomar el control de origen", async ({
  page,
}) => {
  const respuesta = await page.request.post("/api/orden", {
    data: {
      evento: "nuevo_canal",
      texto: "Ensayo de foco",
      nombre: "Canal accesible",
    },
  });
  expect(respuesta.ok()).toBe(true);
  const { id } = await respuesta.json();
  await page.goto(`/canales/${id}`);
  await page.locator(".operation-controls > summary").first().click();
  const revisar = page.getByRole("button", { name: /^Revisar / }).first();
  await revisar.focus();
  await page.keyboard.press("Enter");
  const confirmar = page.getByRole("region", { name: "Confirmar cambios" });
  await expect(confirmar).toBeFocused();
  await accesible(page);
  await page.keyboard.press("Escape");
  await expect(confirmar).toHaveCount(0);
  await expect(revisar).toBeFocused();
  await page.keyboard.press("Enter");
  await confirmar
    .getByRole("button", { name: "Cancelar", exact: true })
    .press("Enter");
  await expect(revisar).toBeFocused();
});

test("WhatsApp asocia el código rechazado con una explicación y permite corregirlo", async ({
  page,
}) => {
  await page.goto("/perfil");
  const telefono = page.getByRole("textbox", { name: "WhatsApp", exact: true });
  await expect(telefono).toHaveAccessibleDescription(/código del país/);
  await telefono.fill("+51955555360");
  await page
    .getByRole("button", { name: "Guardar perfil", exact: true })
    .click();
  await expect(page.getByText("Tu perfil está actualizado.")).toBeVisible();
  const avisos = page.getByRole("region", { name: "Tus avisos por WhatsApp" });
  await avisos.getByRole("checkbox").check();
  await avisos
    .getByRole("button", { name: "Enviar código", exact: true })
    .press("Enter");
  const codigo = avisos.getByRole("textbox", {
    name: "Código de verificación",
    exact: true,
  });
  await expect(codigo).toBeFocused();
  const valido = await avisos
    .getByTestId("whatsapp-codigo-simulado")
    .innerText();
  await codigo.fill(valido === "000000" ? "111111" : "000000");
  await avisos
    .getByRole("button", { name: "Verificar número", exact: true })
    .press("Enter");
  await expect(codigo).toHaveAttribute("aria-invalid", "true");
  await expect(codigo).toHaveAccessibleDescription(
    /El código no es válido o caducó/,
  );
  await accesible(page);
  await codigo.fill(valido);
  await expect(codigo).not.toHaveAttribute("aria-invalid", "true");
  await avisos
    .getByRole("button", { name: "Verificar número", exact: true })
    .press("Enter");
  await expect(
    avisos.getByText("Número verificado: +51955555360"),
  ).toBeVisible();
  await expect(
    avisos.getByText("Quiero recibir", { exact: true }),
  ).toBeFocused();
});

test("Micrófono denegado muestra una recuperación en español", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(
          new DOMException("Permission denied", "NotAllowedError"),
        ),
    });
  });
  await page.goto("/");
  await abrirCooper(page);
  const grabar = page.getByRole("button", {
    name: "Grabar audio",
    exact: true,
  });
  await grabar.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "Permite el micrófono en tu navegador o adjunta una grabación.",
  );
  await expect(grabar).toBeEnabled();
  await accesible(page);
});

test("Carga interrumpida conserva el control y explica la recuperación en español", async ({
  page,
}) => {
  await page.goto("/perfil");
  await page.route("**/api/archivos", (route) => route.abort("failed"));
  const foto = page
    .getByLabel("Cambiar foto", { exact: true })
    .filter({ visible: true });
  await foto.setInputFiles({
    name: "foto-interrumpida.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator(".notice[role=alert]")).toHaveText(
    "No pudimos confirmar la carga. Comprueba tu conexión antes de volver a seleccionar el archivo.",
  );
  await expect(foto).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Guardar perfil", exact: true }),
  ).toBeEnabled();
});

test("Biblioteca recupera el foco tras rechazar una carga sin quitarlo de otro campo", async ({
  page,
}) => {
  await page.goto("/avatares");
  await page
    .getByRole("button", { name: "Crear avatar", exact: true })
    .press("Enter");
  const nombre = page.getByRole("textbox", { name: "Nombre", exact: true });
  await expect(nombre).toBeFocused();
  await page.keyboard.press("Tab");
  const fotos = page.getByLabel("Fotos tuyas (hasta tres)");
  await expect(fotos).toBeFocused();
  const carga: { responder?: () => void } = {};
  const responder = () => carga.responder?.();
  await page.route("**/api/archivos", async (route) => {
    await new Promise<void>((resolve) => {
      carga.responder = resolve;
    });
    await route.fulfill({
      status: 400,
      json: { error: "No pudimos leer el archivo. Selecciona otra copia." },
    });
  });
  await fotos.setInputFiles({
    name: "foto-rechazada.png",
    mimeType: "image/png",
    buffer: Buffer.from("ensayo"),
  });
  await expect(fotos).toBeDisabled();
  await expect.poll(() => typeof carga.responder).toBe("function");
  responder();
  await expect(page.locator(".notice[role=alert]")).toHaveText(
    "No pudimos leer el archivo. Selecciona otra copia.",
  );
  await expect(fotos).toBeFocused();
  await page.keyboard.press("Tab");
  const grabacion = page.getByLabel("Grabación de identidad");
  await expect(grabacion).toBeFocused();
  carga.responder = undefined;
  await grabacion.setInputFiles({
    name: "voz-rechazada.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("ensayo"),
  });
  await expect(grabacion).toBeDisabled();
  await expect.poll(() => typeof carga.responder).toBe("function");
  await nombre.focus();
  responder();
  await expect(grabacion).toBeEnabled();
  await expect(nombre).toBeFocused();
});
