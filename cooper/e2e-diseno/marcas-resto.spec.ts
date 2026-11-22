import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import type { EstadoMarcas } from "../src/servicios/marcas/servicio";
import type { Estado } from "../src/servicios/datos";
import { abrirCooper } from "../e2e/ayudas-diseno";
import { capturarEstados } from "./estados-resto";
import { instalarMedioReal } from "./medio-real";

const directory = "../evidencias-diseno";
const widths = [360, 390, 768, 1024, 1440, 1920];
async function login(page: Page, email = "admin@example.test") {
  expect(
    (
      await page.request.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT}/sesion`,
        { data: { email, secret: process.env.COOPER_E2E_SECRET } },
      )
    ).ok(),
  ).toBe(true);
}
async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post(`/api/${path}`, { data });
  expect(r.ok(), `${path}: ${await r.text()}`).toBe(true);
  return r.json();
}
async function prepararMarcas(page: Page) {
  let data: EstadoMarcas = await (await page.request.get("/api/marcas")).json();
  if (!data.marcas.some((m) => m.nombre === "Casa Abierta · Ejemplo")) {
    const church = await post(page, "marcas/iglesia", {});
    await post(page, `marcas/${church.id}`, {
      nombre: "Casa Abierta · Ejemplo",
      rubro: "iglesia-reformada",
      guia: { ...church.guia, colores: ["#6587a5", "#f5f5f7"] },
    });
    const shop = await post(page, "marcas", {
      nombre: "Lino · Ejemplo",
      rubro: "moda",
      guia: {
        colores: ["#a57c65", "#f5f5f7"],
        tienda: {
          version: 1,
          plantilla: "tienda-ropa",
          datosEjemplo: true,
          catalogo: {
            estado: "sin_conectar",
            plataforma: "por_definir",
            url: null,
          },
        },
      },
    });
    for (const [marca, alias] of [
      [church, "@casaabierta.ejemplo"],
      [shop, "@lino.ejemplo"],
    ] as const) {
      const cuenta = await post(page, `marcas/${marca.id}/cuentas`, {
        red: "instagram",
        alias,
        remoto: marca.id === church.id ? "123456789001" : "123456789002",
        pagina: "123456789000",
      });
      await post(page, `marcas/${marca.id}/piezas`, {
        cuentaId: cuenta.id,
        formato: "imagen",
        plantilla: "libre",
        titulo:
          marca.id === church.id
            ? "Una mesa para todos"
            : "La textura de lo cotidiano",
        texto: "Borrador de ejemplo para revisar con el equipo.",
        detalle: "Contenido de demostración",
        programada: "2030-11-25T19:00:00-05:00",
        ejemplo: true,
      });
    }
  }
  data = await (await page.request.get("/api/marcas")).json();
  return data;
}
async function capture(
  page: Page,
  screen: string,
  width: number,
  consoleMessages: string[],
) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = audit.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  const geometry = await page.evaluate(() => ({
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    tiny: Array.from(document.querySelectorAll<HTMLElement>("body *")).flatMap(
      (el) => {
        const r = el.getBoundingClientRect(),
          s = getComputedStyle(el);
        return r.width &&
          r.height &&
          s.visibility !== "hidden" &&
          Array.from(el.childNodes).some(
            (n) => n.nodeType === 3 && n.textContent?.trim(),
          ) &&
          parseFloat(s.fontSize) < 12
          ? [{ element: el.tagName, size: s.fontSize }]
          : [];
      },
    ),
  }));
  await page.screenshot({
    path: `${directory}/${screen}-${width}-viewport.png`,
  });
  // Una sola aparición de cada elemento fijo en la página completa, en la posición
  // del primer viewport. No se pega ni se reconstruye contenido de capturas distintas.
  await page.evaluate(() => {
    const saved: { element: HTMLElement; style: string | null }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      if (
        getComputedStyle(el).position !== "fixed" ||
        !el.getClientRects().length
      )
        continue;
      const rect = el.getBoundingClientRect();
      saved.push({ element: el, style: el.getAttribute("style") });
      Object.assign(el.style, {
        position: "absolute",
        top: `${rect.top + scrollY}px`,
        left: `${rect.left + scrollX}px`,
        right: "auto",
        bottom: "auto",
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    }
    (window as Window & { fixedCapture?: typeof saved }).fixedCapture = saved;
  });
  await page.screenshot({
    path: `${directory}/${screen}-${width}.png`,
    fullPage: true,
    // Los accesos flotantes se documentan en el viewport; aquí no ocultan contenido.
    style:
      ".mobile-dock, .mobile-more, .cooper-orb { visibility: hidden !important; }",
  });
  await page.evaluate(() => {
    const state = window as Window & {
      fixedCapture?: { element: HTMLElement; style: string | null }[];
    };
    for (const { element, style } of state.fixedCapture ?? []) {
      if (style === null) element.removeAttribute("style");
      else element.setAttribute("style", style);
    }
    delete state.fixedCapture;
  });
  const result = {
    screen,
    width,
    path: new URL(page.url()).pathname,
    ...geometry,
    violations: serious,
    console: [...consoleMessages],
  };
  writeFileSync(
    `${directory}/${screen}-${width}.json`,
    JSON.stringify(result, null, 2),
  );
  expect.soft(geometry.overflow, `${screen}: overflow`).toBe(0);
  expect.soft(geometry.tiny, `${screen}: texto mínimo`).toEqual([]);
  expect.soft(serious, `${screen}: axe`).toEqual([]);
  expect.soft(consoleMessages, `${screen}: consola`).toEqual([]);
  return result;
}

for (const width of widths)
  test(`Marcas y resto: matriz ${width}`, async ({ page }) => {
    mkdirSync(directory, { recursive: true });
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await login(page);
    await post(page, "admin/permitidos", { email: "diseno@example.test" });
    await login(page, "diseno@example.test");
    const messages: string[] = [];
    page.on("pageerror", (e) => messages.push(e.message));
    page.on("console", (m) => {
      if (["warning", "error"].includes(m.type())) messages.push(m.text());
    });
    const manifest: Awaited<ReturnType<typeof capture>>[] = [];
    const shot = async (name: string) =>
      manifest.push(await capture(page, name, width, messages));
    await page.goto("/marcas");
    await expect(
      page.getByRole("heading", { name: "Marcas", exact: true }),
    ).toBeVisible();
    await shot("marcas-vacio");
    await page
      .getByRole("button", {
        name: /Crear mi primera marca|Añadir marca o cuenta/,
      })
      .click();
    await shot("marcas-nueva");
    await login(page);
    const marcas = await prepararMarcas(page);
    const state: Estado = await (await page.request.get("/api/estado")).json();
    const church = marcas.marcas.find((m) => m.rubro === "iglesia-reformada")!;
    const shop = marcas.marcas.find((m) => m.rubro === "moda")!;
    const screens: {
      name: string;
      path: string;
      prepare?: () => Promise<void>;
    }[] = [
      { name: "marcas", path: "/marcas" },
      { name: "marca-iglesia", path: `/marcas?marca=${church.id}` },
      { name: "marca-tienda", path: `/marcas?marca=${shop.id}&seccion=tienda` },
      ...["estudio", "competencia", "publicados", "aprendizaje"].map((s) => ({
        name: `marca-${s}`,
        path: `/marcas?marca=${church.id}&seccion=${s}`,
      })),
      { name: "canales", path: "/canales" },
      {
        name: "crear-canal",
        path: "/canales",
        prepare: async () => {
          await page
            .getByRole("button", { name: "Nuevo canal", exact: true })
            .click();
        },
      },
      { name: "canal-detalle", path: `/canales/${state.channels[0].id}` },
      { name: "avatares", path: "/avatares" },
      {
        name: "voces",
        path: "/avatares",
        prepare: async () => {
          await page
            .getByRole("button", { name: "Voces", exact: true })
            .click();
        },
      },
      {
        name: "crear-avatar",
        path: "/avatares",
        prepare: async () => {
          await page
            .getByRole("button", { name: "Crear avatar", exact: true })
            .click();
          await expect(page.locator(".identity-form blockquote")).toContainText(
            "Mi frase es:",
          );
        },
      },
      {
        name: "crear-voz",
        path: "/avatares",
        prepare: async () => {
          await page
            .getByRole("button", { name: "Voces", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Crear voz", exact: true })
            .click();
          await expect(page.locator(".identity-form blockquote")).toContainText(
            "Mi frase es:",
          );
        },
      },
      { name: "perfil", path: "/perfil" },
      { name: "administracion", path: "/admin" },
      { name: "administracion-salud", path: "/admin/salud" },
      { name: "administracion-fabrica", path: "/admin/fabrica" },
      ...[
        "radar",
        "rutina",
        "redes",
        "referencias",
        "cuentas",
        "programados",
        "decisiones",
        "incidencias",
        "avisos",
      ].map((name) => ({ name, path: `/${name}` })),
      { name: "entrada", path: "/entrar" },
      { name: "entrada-error", path: "/entrar?error=AccessDenied" },
      { name: "enlace-invalido", path: "/revisar/whatsapp/enlace-invalido" },
    ];
    for (const screen of screens) {
      messages.length = 0;
      await page.goto(screen.path);
      await page.locator("main").waitFor({ state: "visible" });
      if (screen.prepare) await screen.prepare();
      await shot(screen.name);
    }
    messages.length = 0;
    await page.goto("/marcas");
    const panel = await abrirCooper(page);
    await shot("cooper-abierto");
    const suggestions = panel.locator(".cooper-suggestions");
    await expect(suggestions).toHaveAttribute("data-fin", "true");
    await suggestions.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(suggestions).toHaveAttribute("data-fin", "false");
    await shot("cooper-chips-final");
    await panel
      .getByRole("textbox", { name: "Mensaje para Cooper" })
      .fill("¿Qué tengo pendiente?");
    await panel
      .getByRole("button", { name: "Enviar mensaje", exact: true })
      .click();
    await expect(panel.locator(".message.assistant").last()).toBeVisible();
    await shot("cooper-historial");
    await page
      .locator('input[type="file"][aria-label="Archivo adjunto"]')
      .setInputFiles({
        name: "Idea para la semana.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Una idea de ensayo para preparar con el equipo."),
      });
    await expect(panel.locator(".attachment-preview")).toBeVisible();
    await shot("cooper-adjunto");
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'data: {"tipo":"error","texto":"No pudimos completar la respuesta. Tu mensaje sigue aquí."}\n\n',
      }),
    );
    await panel
      .getByRole("textbox", { name: "Mensaje para Cooper" })
      .fill("Conserva esta idea");
    await panel
      .getByRole("button", { name: "Enviar mensaje", exact: true })
      .click();
    await expect(panel.getByRole("alert")).toContainText(
      "Tu mensaje sigue aquí",
    );
    await shot("cooper-error");
    await page.unroute("**/api/chat");
    await panel
      .getByRole("button", { name: "Cerrar Cooper", exact: true })
      .click();
    const ensayo = await instalarMedioReal(page, state);
    await page.goto("/canales");
    await expect(
      page.getByRole("heading", { name: ensayo.canal.name }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".canal-ultimo .medio-poster")
          .evaluate((el) => (el as HTMLImageElement).naturalWidth),
      )
      .toBe(900);
    await shot("canales-medio-real");
    expect(ensayo.solicitudesExternas).toEqual([]);
    writeFileSync(
      `${directory}/medio-real-${width}.json`,
      JSON.stringify(ensayo.evidencia, null, 2),
    );
    await ensayo.cleanup();
    await capturarEstados(page, shot, messages);
    writeFileSync(
      `${directory}/marcas-resto-manifest-${width}.json`,
      JSON.stringify(manifest, null, 2),
    );
  });

for (const width of [390, 1440])
  test(`Cooper y navegación en movimiento a ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.goto("/canales");
    const state: Estado = await (await page.request.get("/api/estado")).json();
    const ensayo = await instalarMedioReal(page, state);
    await page.reload();
    const medio = page.locator(".canal-ultimo .medio");
    await expect(medio).toBeVisible();
    await medio.hover();
    await expect(medio).toHaveAttribute("data-preview", "on");
    await expect
      .poll(() =>
        medio
          .locator("video")
          .evaluate((el: HTMLVideoElement) => el.currentTime),
      )
      .toBeGreaterThan(0.5);
    await page.mouse.move(0, 0);
    await expect(medio).toHaveAttribute("data-preview", "off");
    expect(ensayo.solicitudesExternas).toEqual([]);
    await ensayo.cleanup();
    await page
      .getByRole("link", { name: "Marcas", exact: true })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/marcas/);
    const panel = await abrirCooper(page);
    await expect(panel).not.toContainText("Chat de demostración");
    if (width < 1024) {
      const initial = await panel.boundingBox();
      expect(initial!.height).toBeCloseTo(900 * 0.62, 0);
      const handle = panel.locator(".cooper-drag");
      let box = (await handle.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y - 120, { steps: 12 });
      await page.mouse.up();
      await expect(panel).toHaveClass(/is-full/);
      await expect
        .poll(async () => (await panel.boundingBox())!.height)
        .toBe(900);
      box = (await handle.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + 160, { steps: 12 });
      await page.mouse.up();
      await expect(panel).not.toHaveClass(/is-full/);
    } else {
      const layout = await page
        .locator(".studio-shell")
        .evaluate((el) => parseFloat(getComputedStyle(el).paddingRight));
      expect(layout).toBeGreaterThanOrEqual(420);
    }
    await panel
      .getByRole("button", { name: "Cerrar Cooper", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Abrir Cooper", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Más destinos", exact: true })
      .filter({ visible: true })
      .click();
    await page
      .getByRole("dialog", { name: "Más destinos", exact: true })
      .getByRole("link", { name: "Mi perfil", exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page
      .getByRole("button", { name: "Pausar movimiento", exact: true })
      .click();
    await expect(page.locator(".workspace")).toHaveAttribute(
      "data-motion",
      "paused",
    );
    await page.reload();
    await expect(page.locator(".workspace")).toHaveAttribute(
      "data-motion",
      "paused",
    );
  });
