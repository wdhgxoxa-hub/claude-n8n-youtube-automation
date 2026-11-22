import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const dir = ".cache/capturas-diseno";
test.use({ timezoneId: "America/Lima" });
async function ready(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator(".pildora-conexion")).toHaveCount(0);
}
async function overflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
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
test("demostración: siete pantallas, dos tamaños y fábrica seleccionable", async ({
  page,
}) => {
  test.setTimeout(120000);
  mkdirSync(dir, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const state = await (await page.request.get("/api/estado")).json();
  expect(state.demo).toBe(true);
  expect(state.channels).toHaveLength(2);
  expect(state.videos.map((v: { stage: number }) => v.stage)).toEqual([
    7, 3, 9, 11,
  ]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const [name, path] of [
      ["inicio", "/"],
      ["canales", "/canales"],
      ["videos", "/videos"],
      ["detalle-video", `/videos/${state.videos[0].id}`],
      ["avatares", "/avatares"],
      ["perfil", "/perfil"],
      ["admin", "/admin"],
    ]) {
      await ready(page, path);
      await overflow(page);
      const result = await new AxeBuilder({ page })
        .withTags([
          "wcag2a",
          "wcag2aa",
          "wcag21a",
          "wcag21aa",
          "wcag22a",
          "wcag22aa",
        ])
        .analyze();
      expect(result.violations, `${name} ${width}`).toEqual([]);
      await page.screenshot({
        path: `${dir}/${name}-${width}.png`,
        fullPage: true,
      });
    }
    await ready(page);
    await expect(page.locator(".factory-pane .journey li")).toHaveCount(12);
    await page
      .getByRole("button", {
        name: /04 ¿A qué huele la lluvia\? Aprobación de guion/,
      })
      .click();
    await expect(page.locator(".factory-pane li.current")).toContainText(
      "Aprobación de guion",
    );
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    await page
      .getByRole("button", {
        name: /12 Por qué el cielo cambia de color/,
      })
      .click();
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "12",
    );
    await page
      .getByRole("button", { name: /08 El mar también respira/ })
      .click();
    await page.screenshot({
      path: `${dir}/fabrica-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
test("movimiento opcional, teclado y retícula en seis anchuras", async ({
  page,
}) => {
  await ready(page, "/perfil");
  await page.getByRole("button", { name: "Pausar movimiento" }).click();
  await ready(page);
  await page.getByRole("button", { name: "Abrir Cooper", exact: true }).click();
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  // La cara autoalojada conserva su PNG y retira el autoplay al pausar.
  const face = page.locator(".cooper-orb .cooper-presencia");
  await expect(face.locator("img")).toBeVisible();
  await expect(face.locator("video")).toHaveCount(0);
  const poster = await face.locator("img").getAttribute("src");
  await page.waitForTimeout(250);
  await expect(face.locator("img")).toHaveAttribute("src", poster!);

  await ready(page, "/perfil");
  await page.getByRole("button", { name: "Activar movimiento" }).click();
  await ready(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await overflow(page);
    await overflow(page);
  }
  expect(
    await page
      .locator(".stage-node")
      .first()
      .evaluate((el) => getComputedStyle(el, "::after").animationName),
  ).toBe("none");
  await page
    .getByRole("button", {
      name: /04 ¿A qué huele la lluvia\? Aprobación de guion/,
    })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".factory-pane li.current")).toContainText(
    "Aprobación de guion",
  );
  await page.locator(".factory-link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "¿A qué huele la lluvia?",
  );
});

test("capturas finales: todas las pantallas y formularios demo en el tema del estudio", async ({
  page,
}) => {
  test.setTimeout(240000);
  const dir = ".cache/capturas-final2";
  mkdirSync(dir, { recursive: true });
  const state = await (await page.request.get("/api/estado")).json();
  const manifest: {
    archivo: string;
    tema: string;
    ancho: number;
    ruta: string;
    demo: boolean;
  }[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["oscuro"]) {
    expect(
      (
        await page.request.patch("/api/perfil", {
          data: {
            name: "Walter",
            image: "",
            theme,
            home: "chat",
            whatsapp: "",
          },
        })
      ).ok(),
    ).toBe(true);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const [name, path] of [
        ["inicio", "/"],
        ["fabrica", "/"],
        ["canales", "/canales"],
        ["videos", "/videos"],
        ["detalle-video", `/videos/${state.videos[0].id}`],
        ["aprobacion-guion", `/videos/${state.videos[1].id}`],
        ["aprobacion-final", `/videos/${state.videos[2].id}`],
        ["publicado", `/videos/${state.videos[3].id}`],
        ["pedir-video", "/videos"],
        ["avatares", "/avatares"],
        ["voces", "/avatares"],
        ["crear-avatar", "/avatares"],
        ["crear-voz", "/avatares"],
        ["perfil", "/perfil"],
        ["admin", "/admin"],
        ["entrada", "/entrar"],
        ["entrada-error", "/entrar?error=AccessDenied"],
        ["no-encontrado", "/inexistente"],
      ]) {
        if (["entrada", "entrada-error", "no-encontrado"].includes(name)) {
          await page.goto(path);
          // Variante de tokens públicos; no implica selector público de tema.
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
          }, theme);
        } else await ready(page, path);
        if (name === "voces" || name === "crear-voz")
          await page
            .getByRole("button", { name: "Voces", exact: true })
            .click();
        if (name === "crear-avatar" || name === "crear-voz") {
          await page
            .getByRole("button", {
              name: name === "crear-voz" ? "Crear voz" : "Crear avatar",
              exact: true,
            })
            .click();
          await expect(page.locator(".identity-form blockquote")).toContainText(
            "Mi frase es:",
          );
        }
        if (name === "pedir-video")
          await page
            .getByRole("button", { name: "Pedir video", exact: true })
            .click();
        if (name === "admin") {
          await expect(page.locator(".identity-review")).toHaveCount(1);
          await expect(page.locator(".identity-review")).toContainText(
            "identidad ficticia",
          );
        }
        await overflow(page);
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
          `${name} ${theme} ${width}`,
        ).toEqual([]);
        await page.evaluate(() => {
          if (document.activeElement instanceof HTMLElement)
            document.activeElement.blur();
          window.scrollTo(0, 0);
        });
        const archivo = `${name}-${theme}-${width}.png`;
        await page.screenshot({ path: `${dir}/${archivo}`, fullPage: true });
        manifest.push({
          archivo,
          tema: theme,
          ancho: width,
          ruta: path,
          demo: true,
        });
      }
    }
  }
  writeFileSync(
    `${dir}/manifest.json`,
    JSON.stringify(manifest, null, 2) + "\n",
  );
});

test("I08 identidad se hidrata en Lima y Cooper no emite errores SVG", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  for (const theme of ["oscuro"]) {
    await page.request.patch("/api/perfil", {
      data: { name: "Walter", image: "", theme, home: "chat", whatsapp: "" },
    });
    for (const path of ["/admin", "/avatares", "/"]) {
      await ready(page, path);
      await page.waitForTimeout(900);
      expect(await page.locator('path[d="undefined"]').count()).toBe(0);
    }
    await page
      .getByRole("button", { name: "Abrir Cooper", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Mensaje para Cooper", exact: true })
      .fill("¿Qué tengo pendiente?");
    await page
      .getByRole("textbox", { name: "Mensaje para Cooper", exact: true })
      .press("Enter");
    await expect(page.locator(".conversation")).toContainText("pendiente");
    await expect(page.locator(".chat-heading").getByRole("status")).toHaveText(
      "De tu lado, de principio a fin.",
    );
    await ready(page, "/perfil");
    await page.getByRole("button", { name: "Pausar movimiento" }).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Activar movimiento" }).click();
  }
  expect(errors).toEqual([]);
});

test("riel y barra móvil permanecen accesibles en páginas largas y alturas pequeñas", async ({
  page,
}) => {
  test.setTimeout(120000);
  const state = await (await page.request.get("/api/estado")).json();
  const dir = ".cache/capturas-final2";
  mkdirSync(dir, { recursive: true });
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    for (const [name, path] of [
      ["inicio", "/"],
      ["detalle", `/videos/${state.videos[0].id}`],
    ]) {
      await page.setViewportSize({ width, height: 480 });
      await ready(page, path);
      const navigation = page
        .getByRole("navigation", {
          name: /^Principal(?: móvil)?$/,
          exact: true,
        })
        .filter({ visible: true });
      await expect(navigation).toBeVisible();
      await expect(navigation.getByRole("link")).toHaveCount(5);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(
        navigation.getByRole("link", { name: "Inicio", exact: true }),
      ).toBeInViewport();
      await page
        .getByRole("button", { name: "Más destinos", exact: true })
        .filter({ visible: true })
        .click();
      const profile = page
        .getByRole("link", { name: /^(?:Mi perfil|Perfil)$/ })
        .filter({ visible: true })
        .last();
      await profile.scrollIntoViewIfNeeded();
      await expect(profile).toBeInViewport();
      await overflow(page);
      await page.screenshot({
        path: `${dir}/barra-${name}-${width}-final.png`,
      });
      await page.keyboard.press("Escape");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${dir}/barra-${name}-${width}.png`,
        fullPage: width >= 768,
      });
    }
  }
});

test("integración final: chat, noticias y WhatsApp en seis anchuras y tema oscuro", async ({
  page,
}) => {
  test.setTimeout(180000);
  const output = ".cache/capturas-final2";
  mkdirSync(output, { recursive: true });
  mkdirSync("../evidencias-diseno", { recursive: true });
  const manifest: {
    archivo: string;
    tema: string;
    ancho: number;
    ruta: string;
    demo: boolean;
  }[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Usuario ficticio separado: la matriz no cambia los ejemplos del administrador.
  expect(
    (
      await page.request.post("/api/admin/permitidos", {
        data: { email: "final@example.test" },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT}/sesion`,
        {
          data: {
            email: "final@example.test",
            secret: process.env.COOPER_E2E_SECRET,
          },
        },
      )
    ).ok(),
  ).toBe(true);
  async function matriz(name: string) {
    for (const theme of ["oscuro"]) {
      // Mantiene estados transitorios (adjunto/OTP) al cambiar los mismos tokens.
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      for (const width of [360, 390, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
        await overflow(page);
        if (name === "chat-foto") {
          await page.locator(".conversation").focus();
          await expect(page.locator(".conversation")).toBeFocused();
          await page.keyboard.press("Home");
          await expect
            .poll(() =>
              page.locator(".conversation").evaluate((el) => el.scrollTop),
            )
            .toBe(0);
        }
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
              .analyze()
          ).violations,
          `${name} ${theme} ${width}`,
        ).toEqual([]);
        {
          await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement)
              document.activeElement.blur();
            window.scrollTo(0, 0);
          });
          const archivo = `${name}-${theme}-${width}.png`;
          const screenshot = await page.screenshot({
            path: `${output}/${archivo}`,
            fullPage: true,
          });
          writeFileSync(
            `../evidencias-diseno/${name}-${width}.png`,
            screenshot,
          );
          manifest.push({
            archivo,
            tema: theme,
            ancho: width,
            ruta: new URL(page.url()).pathname,
            demo: true,
          });
        }
      }
    }
  }
  await ready(page);
  await page.getByRole("button", { name: "Abrir Cooper", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Mensaje para Cooper", exact: true })
    .fill("Activa modo noticia");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  const card = page.getByRole("article", { name: "Ajustar guía del canal" });
  await expect(
    card.getByRole("button", { name: "Confirmar", exact: true }),
  ).toBeEnabled();
  await expect(card).toContainText("Modo noticia: activado");
  await matriz("chat-noticia-confirmacion");
  await card.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(card).toHaveCount(0);
  const state = await (await page.request.get("/api/estado")).json();
  const channel = state.channels.find((c: { newsMode: boolean }) => c.newsMode);
  expect(channel).toBeDefined();
  const created = await page.request.post("/api/orden", {
    data: {
      evento: "nuevo_video",
      recursoId: channel.id,
      texto: "Noticia verificada del día",
    },
  });
  expect(created.ok()).toBe(true);
  const video = await created.json();
  await ready(page, `/videos/${video.id}`);
  await expect(
    page.getByText(/el simulador no verifica noticias reales/),
  ).toBeVisible();
  await matriz("noticia-pausada");
  await ready(page, "/canales");
  await matriz("canal-noticias");
  await ready(page);
  await page.getByRole("button", { name: "Abrir Cooper", exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 48;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#a6d7ed";
    ctx.fillRect(0, 0, 48, 48);
    return canvas.toDataURL().split(",")[1];
  });
  await page.getByLabel("Archivo adjunto", { exact: true }).setInputFiles({
    name: "referencia.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(
    page.getByAltText("Vista previa de referencia.png"),
  ).toBeVisible();
  await matriz("chat-foto");
  await page
    .getByRole("link", { name: "Usar para mi avatar", exact: true })
    .click();
  await page.getByRole("button", { name: "Crear avatar", exact: true }).click();
  await expect(page.locator(".identity-form")).toContainText("Mi frase es:");
  await matriz("avatar-desde-chat");
  await ready(page, "/perfil");
  await page.getByRole("textbox", { name: /^WhatsApp/ }).fill("+51944444444");
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(page.getByText("Tu perfil está actualizado.")).toBeVisible();
  const wa = page.getByRole("region", { name: "Tus avisos por WhatsApp" });
  await wa.getByRole("checkbox").check();
  await wa.getByRole("button", { name: "Enviar código" }).click();
  const code = await wa.getByTestId("whatsapp-codigo-simulado").innerText();
  await matriz("whatsapp-codigo");
  await wa.getByRole("textbox", { name: "Código de verificación" }).fill(code);
  await wa.getByRole("button", { name: "Verificar número" }).click();
  await expect(wa.getByText("Número verificado: +51944444444")).toBeVisible();
  await expect(wa.getByText("Alerta de gasto diario")).toHaveCount(0);
  await matriz("whatsapp-preferencias");
  await page.goto("/revisar/whatsapp/invalido");
  await expect(
    page.getByRole("heading", { name: "Este enlace ya no está disponible" }),
  ).toBeVisible();
  await matriz("whatsapp-enlace-vencido");
  expect(errors).toEqual([]);
  writeFileSync(
    `${output}/manifest-nuevas.json`,
    JSON.stringify(manifest, null, 2) + "\n",
  );
});
