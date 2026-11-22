import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Estado } from "../src/servicios/datos";

const dir = "../evidencias-diseno";
const widths = [360, 390, 768, 1024, 1440, 1920];
async function login(page: Page) {
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
    ).ok(),
  ).toBe(true);
}

// Se conserva el fallo global de DIRECCION: esta misión no modifica el armazón.
// El test no aprueba ni silencia los tokens heredados; genera evidencia por ruta.
async function tokens(page: Page) {
  return page.evaluate(() => {
    const palette = new Set([
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
      "rgba(255, 255, 255, 0.06)",
      "rgba(255, 77, 46, 0.14)",
      "rgba(17, 17, 20, 0.72)",
      "rgba(0, 0, 0, 0)",
    ]);
    const found = new Map<
      string,
      { selector: string; property: string; value: string }
    >();
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      if (!(el instanceof HTMLElement) || !el.checkVisibility()) continue;
      const css = getComputedStyle(el);
      const selector =
        el.tagName.toLowerCase() +
        (el.className ? "." + el.className.trim().split(/\s+/).join(".") : "");
      const add = (property: string, value: string) =>
        found.set(`${selector}:${property}:${value}`, {
          selector,
          property,
          value,
        });
      if (
        Array.from(el.childNodes).some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
        ) &&
        parseFloat(css.fontSize) < 12
      )
        add("font-size", css.fontSize);
      for (const property of [
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomLeftRadius",
        "borderBottomRightRadius",
      ] as const) {
        if (!["0px", "8px", "14px", "22px", "999px"].includes(css[property]))
          add(property, css[property]);
      }
      for (const property of ["color", "backgroundColor"] as const) {
        // --tinte es un dato del medio, permitido explícitamente por DIRECCION.
        const tint = css.getPropertyValue("--tinte").trim();
        const probe = document.createElement("span");
        probe.style.color = tint;
        el.append(probe);
        const resolvedTint = tint ? getComputedStyle(probe).color : "";
        probe.remove();
        if (!palette.has(css[property]) && css[property] !== resolvedTint)
          add(property, css[property]);
      }
    }
    return [...found.values()];
  });
}

for (const width of widths)
  test(`capturas y accesibilidad ${width}`, async ({ page }) => {
    mkdirSync(dir, { recursive: true });
    await login(page);
    const state: Estado = await (await page.request.get("/api/estado")).json();
    await page.request.patch("/api/perfil", {
      data: { ...state.user, theme: "oscuro" },
    });
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (["warning", "error"].includes(m.type())) errors.push(m.text());
    });
    const paths = [
      ["inicio", "/"],
      ["fabrica", "/"],
      ["videos", "/videos"],
      ["detalle-video", `/videos/${state.videos[0].id}`],
      ["aprobacion-guion", `/videos/${state.videos[1].id}`],
      ["aprobacion-final", `/videos/${state.videos[2].id}`],
      ["publicado", `/videos/${state.videos[3].id}`],
      ["pedir-video", "/videos"],
      ["publicados", "/publicados"],
      ["aprendizaje", "/aprendizaje"],
      ["marcas", "/marcas"],
      ["canales", "/canales"],
      ["canal", `/canales/${state.channels[0].id}`],
      ["radar", "/radar"],
      ["rutina", "/rutina"],
      ["redes", "/redes"],
      ["referencias", "/referencias"],
      ["cuentas", "/cuentas"],
      ["programados", "/programados"],
      ["decisiones", "/decisiones"],
      ["incidencias", "/incidencias"],
      ["avisos", "/avisos"],
      ["avatares", "/avatares"],
      ["voces", "/avatares"],
      ["crear-avatar", "/avatares"],
      ["crear-voz", "/avatares"],
      ["perfil", "/perfil"],
      ["admin", "/admin"],
      ["admin-fabrica", "/admin/fabrica"],
      ["entrada", "/entrar"],
      ["entrada-error", "/entrar?error=AccessDenied"],
      ["no-encontrado", "/inexistente"],
      ["enlace-vencido", "/revisar/whatsapp/ficticio"],
    ];
    const evidence = [];
    for (const [name, path] of paths) {
      await page.goto(path);
      await expect(page.locator("h1:visible")).toHaveCount(1);
      await expect(
        page.getByText("Consultando la fábrica…", { exact: true }),
      ).toHaveCount(0);
      if (name === "fabrica" && width < 768)
        await page.getByRole("tab", { name: /Fábrica/ }).click();
      if (name === "voces" || name === "crear-voz")
        await page.getByRole("button", { name: "Voces", exact: true }).click();
      if (name === "crear-avatar" || name === "crear-voz")
        await page
          .getByRole("button", {
            name: name === "crear-voz" ? "Crear voz" : "Crear avatar",
            exact: true,
          })
          .click();
      if (name === "pedir-video")
        await page
          .getByRole("button", { name: "Pedir video", exact: true })
          .click();
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      );
      const outsideTokens = await tokens(page);
      await page.screenshot({
        path: `${dir}/${name}-${width}.png`,
        fullPage: true,
      });
      evidence.push({
        name,
        path,
        width,
        overflow,
        axe: serious,
        tokens: outsideTokens,
      });
    }
    writeFileSync(
      `${dir}/matriz-${width}.json`,
      JSON.stringify({ evidencia: evidence, consola: errors }, null, 2) + "\n",
    );
    expect(evidence.filter((e) => e.overflow || e.axe.length)).toEqual([]);
    expect(errors).toEqual([]);
  });

test("DIRECCION exige tamaño, radios y colores del sistema completo", async () => {
  const deviations = widths.flatMap((width) => {
    const report = JSON.parse(
      readFileSync(`${dir}/matriz-${width}.json`, "utf8"),
    );
    return report.evidencia.flatMap(
      (entry: { name: string; tokens: unknown[] }) =>
        entry.tokens.map((token) => ({ width, pantalla: entry.name, token })),
    );
  });
  writeFileSync(
    `${dir}/desviaciones-tokens.json`,
    JSON.stringify(deviations, null, 2) + "\n",
  );
  expect(
    deviations,
    "El armazón heredado debe migrarse en diseno-base antes de aceptar la puerta global.",
  ).toEqual([]);
});
