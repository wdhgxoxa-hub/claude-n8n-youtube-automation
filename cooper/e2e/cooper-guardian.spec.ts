import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const fixture = () => `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}`;

for (const width of [1440, 390]) {
  test(`Cooper: el guardián cierra el diálogo durante la proyección a ${width}`, async ({
    page,
    baseURL,
  }, info) => {
    expect(
      (
        await page.request.post(`${fixture()}/sesion`, {
          data: {
            email: "admin@example.test",
            secret: process.env.COOPER_E2E_SECRET,
          },
        })
      ).ok(),
    ).toBe(true);
    const guardian = execFileSync(
      ".cache/sentinel-venv/bin/python",
      [
        "-c",
        `import sys
from urllib.parse import urlsplit
sys.dont_write_bytecode = True
sys.path.insert(0, 'scripts')
from sentinel_cache import comprobar_sentinel
from sentinel_exclusiones import TEXTOS, SELECTORES
sys.path.insert(0, str(comprobar_sentinel()))
from sentinel.contrato import Objetivo, ComprobacionDestino, Exclusiones
from sentinel.guardian.guardian import Guardian
url, fixture = sys.argv[1:]
assert all(urlsplit(u).hostname == '127.0.0.1' for u in (url, fixture))
objetivo = Objetivo(nombre='cooper-cierre-aislado', url_interfaz=url, url_api_base=fixture,
    ruta_openapi='/no-openapi', destino=ComprobacionDestino('/destino', 'destino', 'cooper-e2e-aislado'),
    exclusiones=Exclusiones(textos=TEXTOS, selectores=SELECTORES))
guardian = Guardian(objetivo, lambda: {})
guardian.verificar_destino()
print(guardian.script_inyectado())`,
        baseURL!,
        fixture(),
      ],
      { encoding: "utf8" },
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      localStorage.setItem("cooper-motion-paused", "false");
      const diagnostic: unknown[] = [];
      Object.assign(window, { cierreCooperDiagnostico: diagnostic });
      function describir(node: Node | null) {
        return node instanceof Element
          ? { tag: node.tagName, id: node.id, clase: node.className }
          : { tipo: node?.nodeType ?? null };
      }
      const remove = Element.prototype.remove;
      Element.prototype.remove = function () {
        if (this.matches('[role="dialog"]')) {
          diagnostic.push({
            evento: "retiro-forzado",
            instante: performance.now(),
            nodo: describir(this),
            pila: new Error().stack,
          });
        }
        return remove.call(this);
      };
      const removeChild = Node.prototype.removeChild;
      Node.prototype.removeChild = function <T extends Node>(child: T): T {
        if (child.parentNode !== this) {
          diagnostic.push({
            evento: "padre-ajeno",
            instante: performance.now(),
            padre: describir(this),
            hijo: describir(child),
            padreActual: describir(child.parentNode),
            pila: new Error().stack,
          });
        }
        return removeChild.call(this, child) as T;
      };
    });
    await page.addInitScript(guardian);
    await page.goto("/marcas?seccion=competencia");
    await expect(
      page.getByRole("heading", { name: "Marcas", exact: true }),
    ).toBeVisible();
    let diagnostic: unknown[] | undefined;
    try {
      for (let round = 0; round < 8; round++) {
        await page
          .getByRole("button", { name: "Abrir Cooper", exact: true })
          .click();
        // El guardián original solicita cierre al encontrar Enviar/Borrar, incluso ocultos.
        await expect(
          page.getByRole("button", { name: "Abrir Cooper", exact: true }),
        ).toBeVisible();
        await expect(page.locator("#cooper-panel")).toHaveCount(0);
        await page.waitForTimeout(350);
        await expect(
          page.getByRole("heading", { name: "Marcas", exact: true }),
        ).toBeVisible();
      }
    } finally {
      diagnostic = await page.evaluate(
        () =>
          (window as Window & { cierreCooperDiagnostico?: unknown[] })
            .cierreCooperDiagnostico,
      );
      const evidence = info.outputPath("cierre-cooper.json");
      writeFileSync(
        evidence,
        JSON.stringify({ width, diagnostic, errors }, null, 2),
      );
      await info.attach("cierre-cooper.json", {
        path: evidence,
        contentType: "application/json",
      });
    }
    expect(diagnostic).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`Cooper: cerrar desmonta el diálogo y devuelve el orbe mediante proyección a ${width}`, async ({
    page,
  }, info) => {
    expect(
      (
        await page.request.post(`${fixture()}/sesion`, {
          data: {
            email: "admin@example.test",
            secret: process.env.COOPER_E2E_SECRET,
          },
        })
      ).ok(),
    ).toBe(true);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      localStorage.setItem("cooper-motion-paused", "false");
    });
    await page.goto("/marcas?seccion=competencia");
    await page
      .getByRole("button", { name: "Abrir Cooper", exact: true })
      .click();
    const panel = page.getByRole("dialog", { name: "Cooper, tu compañero" });
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveAttribute("data-projecting", "true");
    await page.evaluate(() => {
      const orb = document.querySelector<HTMLElement>(".cooper-orb")!;
      const face = orb.querySelector<HTMLElement>(".cooper-presencia")!;
      const sheet = document.getElementById("cooper-panel")!;
      const samples: {
        width: number;
        height: number;
        projecting: boolean;
        faceOpacity: number;
        panelPresent: boolean;
      }[] = [];
      const state = { done: false, samples };
      Object.assign(window, { proyeccionCierreCooper: state });
      sheet.querySelector('[aria-label="Cerrar Cooper"]')!.addEventListener(
        "click",
        () => {
          let projected = false;
          const frame = () => {
            const bounds = orb.getBoundingClientRect();
            const projecting = orb.getAttribute("data-projecting") === "true";
            const faceOpacity = Number(getComputedStyle(face).opacity);
            samples.push({
              width: bounds.width,
              height: bounds.height,
              projecting,
              faceOpacity,
              panelPresent: sheet.isConnected,
            });
            projected ||= projecting;
            if (projected && !projecting && faceOpacity === 1)
              state.done = true;
            else requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        },
        { once: true },
      );
    });
    await panel
      .getByRole("button", { name: "Cerrar Cooper", exact: true })
      .click();
    await expect(page.locator("#cooper-panel")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as Window & { proyeccionCierreCooper?: { done: boolean } })
              .proyeccionCierreCooper?.done,
        ),
      )
      .toBe(true);
    const result = await page.evaluate(
      () =>
        (
          window as Window & {
            proyeccionCierreCooper?: {
              samples: {
                width: number;
                height: number;
                projecting: boolean;
                faceOpacity: number;
                panelPresent: boolean;
              }[];
            };
          }
        ).proyeccionCierreCooper!,
    );
    const evidence = info.outputPath("proyeccion-cierre-cooper.json");
    writeFileSync(evidence, JSON.stringify({ width, ...result }, null, 2));
    await info.attach("proyeccion-cierre-cooper.json", {
      path: evidence,
      contentType: "application/json",
    });
    expect(result.samples.every((sample) => !sample.panelPresent)).toBe(true);
    expect(result.samples.some((sample) => sample.width > 80)).toBe(true);
    expect(
      result.samples.filter((sample) => sample.projecting).length,
    ).toBeGreaterThan(1);
    expect(
      result.samples
        .filter((sample) => sample.projecting)
        .every((sample) => sample.faceOpacity === 0),
    ).toBe(true);
    expect(result.samples.at(-1)?.width).toBeCloseTo(56, 1);
    expect(result.samples.at(-1)?.height).toBeCloseTo(56, 1);
    await expect(
      page.getByRole("button", { name: "Abrir Cooper", exact: true }),
    ).toBeFocused();
  });
}
