import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  entrarConexion,
  esperarConexion,
  simularConexion,
} from "./conexion-harness";

const salida = resolve("../evidencias-diseno");
const anchos = [360, 390, 768, 1024, 1440, 1920];

async function auditarTokens(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((raices) => {
    const colores = new Set([
      "rgb(0, 0, 0)",
      "rgb(10, 10, 12)",
      "rgb(17, 17, 20)",
      "rgb(24, 24, 28)",
      "rgb(245, 245, 247)",
      "rgb(161, 161, 170)",
      "rgb(113, 113, 122)",
      "rgb(255, 77, 46)",
      "rgb(61, 220, 151)",
      "rgb(255, 107, 107)",
      "rgb(255, 197, 61)",
      "rgb(124, 196, 255)",
      "rgba(255, 255, 255, 0.08)",
      "rgba(255, 255, 255, 0.14)",
      "rgba(255, 77, 46, 0.14)",
      "rgba(17, 17, 20, 0.72)",
      "rgba(0, 0, 0, 0)",
    ]);
    const radios = new Set(["0px", "8px", "14px", "22px", "999px"]);
    const elementos = new Set<Element>();
    for (const raiz of raices) {
      elementos.add(raiz);
      for (const hijo of raiz.querySelectorAll("*")) elementos.add(hijo);
    }
    const incidencias: {
      elemento: string;
      propiedad: string;
      valor: string;
    }[] = [];
    for (const elemento of elementos) {
      if (!elemento.getClientRects().length || elemento.closest("svg"))
        continue;
      const estilo = getComputedStyle(elemento);
      const nombre =
        `${elemento.tagName.toLowerCase()}.${elemento.className}`.slice(0, 100);
      const registrar = (propiedad: string, valor: string) =>
        incidencias.push({ elemento: nombre, propiedad, valor });
      if (parseFloat(estilo.fontSize) < 12)
        registrar("font-size", estilo.fontSize);
      for (const propiedad of [
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomLeftRadius",
        "borderBottomRightRadius",
      ] as const)
        if (!radios.has(estilo[propiedad]))
          registrar(propiedad, estilo[propiedad]);
      for (const propiedad of ["color", "backgroundColor"] as const)
        if (!colores.has(estilo[propiedad]))
          registrar(propiedad, estilo[propiedad]);
      if (
        parseFloat(estilo.borderTopWidth) &&
        !colores.has(estilo.borderTopColor)
      )
        registrar("borderTopColor", estilo.borderTopColor);
    }
    return incidencias;
  });
}

for (const ancho of anchos) {
  test(`${ancho}: todas las rutas, estados de conexión y diagnóstico de diseño heredado`, async ({
    page,
  }) => {
    test.setTimeout(300_000);
    mkdirSync(salida, { recursive: true });
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const estado = await entrarConexion(page, true);
    await simularConexion(page, estado);
    const consola: string[] = [];
    const errores: string[] = [];
    page.on("console", (mensaje) => {
      if (["warning", "error"].includes(mensaje.type()))
        consola.push(mensaje.text());
    });
    page.on("pageerror", (error) => errores.push(error.message));
    const rutas: [string, string][] = [
      ["inicio", "/"],
      ["canales", "/canales"],
      ["canal", `/canales/${estado.channels[0].id}`],
      ["videos", "/videos"],
      ["video-montaje", `/videos/${estado.videos[0].id}`],
      ["video-aprobacion-guion", `/videos/${estado.videos[1].id}`],
      ["video-aprobacion-final", `/videos/${estado.videos[2].id}`],
      ["video-publicado", `/videos/${estado.videos[3].id}`],
      ["publicados", "/publicados"],
      ["aprendizaje", "/aprendizaje"],
      ["marcas", "/marcas"],
      ["avatares", "/avatares"],
      ["perfil", "/perfil"],
      ["administracion", "/admin"],
      ["ajustes-fabrica", "/admin/fabrica"],
      ["radar", "/radar"],
      ["rutina", "/rutina"],
      ["redes", "/redes"],
      ["referencias", "/referencias"],
      ["cuentas", "/cuentas"],
      ["programados", "/programados"],
      ["decisiones", "/decisiones"],
      ["incidencias", "/incidencias"],
      ["avisos", "/avisos"],
      ["entrar", "/entrar"],
      ["entrar-denegado", "/entrar?error=AccessDenied"],
      ["enlace-vencido", "/revisar/whatsapp/enlace-ficticio"],
      ["no-encontrado", "/pagina-de-ensayo-ausente"],
    ];
    const evidencia: unknown[] = [];
    for (const [nombre, ruta] of rutas) {
      const inicioConsola = consola.length;
      await page.goto(ruta);
      await expect(page.locator("h1:visible")).toHaveCount(1);
      if (await page.locator(".workspace").count()) await esperarConexion(page);
      await expect(
        page.getByText("Consultando la fábrica…", { exact: true }),
      ).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${salida}/${nombre}-${ancho}.png`,
        fullPage: true,
      });
      const axe = await new AxeBuilder({ page }).analyze();
      const serias = axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      );
      const tokens = await auditarTokens(page, "body");
      const desbordamiento = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      evidencia.push({
        pantalla: nombre,
        ruta,
        captura: `${nombre}-${ancho}.png`,
        axeSerias: serias,
        tokensFueraDeDireccion: tokens,
        desbordamiento,
        consola: consola.slice(inicioConsola),
      });
    }

    // Estados de la misión: aserciones estrictas, independientes de la deuda
    // de las otras pantallas que queda íntegra en el manifiesto anterior.
    await page.goto("/");
    await esperarConexion(page);
    const contenidoAntes = await page.locator("#contenido").boundingBox();
    await page.evaluate(() => window.__conexionEnsayo.cortar());
    await expect(page.getByTestId("estado-conexion")).toHaveText(
      "Sin conexión, reintentando",
      { timeout: 8_000 },
    );
    await expect(page.getByTestId("estado-conexion")).toBeVisible();
    const contenidoDurante = await page.locator("#contenido").boundingBox();
    expect(contenidoAntes).not.toBeNull();
    expect(contenidoDurante).not.toBeNull();
    for (const dimension of ["x", "y", "width", "height"] as const)
      expect(contenidoDurante![dimension]).toBeCloseTo(
        contenidoAntes![dimension],
        1,
      );
    await page.screenshot({
      path: `${salida}/conexion-interrumpida-${ancho}.png`,
      fullPage: true,
    });
    const indicador = await auditarTokens(
      page,
      '[data-testid="estado-conexion"]',
    );
    expect(indicador).toEqual([]);
    const axeIndicador = await new AxeBuilder({ page })
      .include(".connection-notice")
      .analyze();
    expect(axeIndicador.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const caja = await page.getByTestId("estado-conexion").boundingBox();
    expect(caja).not.toBeNull();
    expect(caja!.x).toBeGreaterThanOrEqual(0);
    expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho);
    const textosTapados = await page.evaluate(() => {
      const aviso = document.querySelector('[data-testid="estado-conexion"]')!;
      const cajaAviso = aviso.getBoundingClientRect();
      return Array.from(
        document.querySelectorAll(
          ".topbar > span, .motion-toggle, .demo-label, h1",
        ),
      ).flatMap((elemento) => {
        if (!elemento.getClientRects().length) return [];
        const rango = document.createRange();
        rango.selectNodeContents(elemento);
        const solapa = Array.from(rango.getClientRects()).some(
          (texto) =>
            texto.left < cajaAviso.right &&
            texto.right > cajaAviso.left &&
            texto.top < cajaAviso.bottom &&
            texto.bottom > cajaAviso.top,
        );
        return solapa ? [elemento.textContent?.trim()] : [];
      });
    });
    expect(
      textosTapados,
      "La píldora debe dejar legible el encabezado",
    ).toEqual([]);
    await page.evaluate(() => {
      window.__conexionEnsayo.modo = "sana";
    });
    await esperarConexion(page);
    await page.screenshot({
      path: `${salida}/conexion-recuperada-${ancho}.png`,
      fullPage: true,
    });
    expect(errores).toEqual([]);
    const globalAprobada = evidencia.every((item) => {
      const valor = item as {
        axeSerias: unknown[];
        tokensFueraDeDireccion: unknown[];
        desbordamiento: boolean;
        consola: string[];
      };
      return (
        !valor.axeSerias.length &&
        !valor.tokensFueraDeDireccion.length &&
        !valor.desbordamiento &&
        !valor.consola.length
      );
    });
    writeFileSync(
      `${salida}/auditoria-${ancho}.json`,
      JSON.stringify(
        {
          ancho,
          componenteConexionAprobado: true,
          puertaGlobalAprobada: globalAprobada,
          alcance:
            "Capturas de todas las rutas actuales; estados de conexión estrictos; sistema global heredado se diagnostica, no se certifica.",
          evidencia,
          consola,
          errores,
        },
        null,
        2,
      ),
    );
    if (process.env.COOPER_DISENO_EXIGIR_TOKENS_GLOBALES === "1")
      expect(
        evidencia.flatMap(
          (item) =>
            (item as { tokensFueraDeDireccion: unknown[] })
              .tokensFueraDeDireccion,
        ),
        "La dirección de diseño exige tokens globales: la deuda heredada debe bloquear esta puerta.",
      ).toEqual([]);
  });
}

test("video: corte, recuperación, navegación y menú móvil existentes", async ({
  page,
}) => {
  test.setTimeout(90_000);
  mkdirSync(salida, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const estado = await entrarConexion(page, true);
  await simularConexion(page, estado);
  await page.goto("/");
  await esperarConexion(page);
  await page.waitForTimeout(1_000);
  await page.evaluate(() => window.__conexionEnsayo.cortar());
  await expect(page.getByTestId("estado-conexion")).toBeVisible({
    timeout: 8_000,
  });
  await page.waitForTimeout(1_000);
  await page.evaluate(() => {
    window.__conexionEnsayo.modo = "sana";
  });
  await esperarConexion(page);
  await page
    .getByRole("button", { name: "Abrir navegación", exact: true })
    .click();
  await page.waitForTimeout(500);
  await page.getByRole("link", { name: "Publicados", exact: true }).click();
  await expect(page).toHaveURL(/publicados/);
  await page.waitForTimeout(1_000);
  const video = page.video();
  await page.close();
  await video?.saveAs(`${salida}/conexion-recorrido-390.webm`);
});
