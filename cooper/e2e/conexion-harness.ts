import { expect, type Page } from "@playwright/test";
import type { Estado } from "../src/servicios/datos";

export type ModoConexion = "sana" | "fallo" | "colgada" | "silencio";
type RegistroConexion = { abierta: number; cerrada: number | null };
type ControlConexion = {
  modo: ModoConexion;
  registros: RegistroConexion[];
  maximasActivas: number;
  cortar: () => void;
  emitir: (tipo: string, datos?: unknown) => void;
};
declare global {
  interface Window {
    __conexionEnsayo: ControlConexion;
  }
}

export async function entrarConexion(page: Page, demo = false) {
  const puerto = demo
    ? (process.env.COOPER_E2E_DEMO_FIXTURE_PORT ?? "33173")
    : (process.env.COOPER_E2E_FIXTURE_PORT ?? "33172");
  expect(
    (
      await page.request.post(`http://127.0.0.1:${puerto}/sesion`, {
        data: {
          email: "admin@example.test",
          secret: process.env.COOPER_E2E_SECRET,
        },
      })
    ).status(),
  ).toBe(200);
  return (await (await page.request.get("/api/estado")).json()) as Estado;
}

// Se sustituye solo el transporte del navegador. React, sesión, SSR y páginas
// siguen siendo la aplicación de producción del arnés aislado existente.
export async function simularConexion(
  page: Page,
  estado: Estado,
  modo: ModoConexion = "sana",
) {
  await page.addInitScript(
    ({ estado, modo }) => {
      const fuentes: FuenteEnsayo[] = [];
      const control: ControlConexion = {
        modo,
        registros: [],
        maximasActivas: 0,
        cortar() {
          control.modo = "fallo";
          for (const fuente of fuentes)
            if (fuente.readyState !== 2) fuente.emitir("error");
        },
        emitir(tipo, datos) {
          for (const fuente of fuentes)
            if (fuente.readyState !== 2) fuente.emitir(tipo, datos);
        },
      };
      class FuenteEnsayo extends EventTarget {
        static readonly CONNECTING = 0;
        static readonly OPEN = 1;
        static readonly CLOSED = 2;
        readonly CONNECTING = 0;
        readonly OPEN = 1;
        readonly CLOSED = 2;
        readonly url: string;
        readonly withCredentials = false;
        readyState = 0;
        onopen: ((event: Event) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        onmessage: ((event: Event) => void) | null = null;
        private intervalo?: ReturnType<typeof setInterval>;
        private registro: RegistroConexion;
        constructor(url: string | URL) {
          super();
          this.url = String(url);
          this.registro = { abierta: Date.now(), cerrada: null };
          control.registros.push(this.registro);
          fuentes.push(this);
          control.maximasActivas = Math.max(
            control.maximasActivas,
            fuentes.filter((f) => f.readyState !== 2).length,
          );
          queueMicrotask(() => {
            if (this.readyState === 2 || control.modo === "colgada") return;
            if (control.modo === "fallo") return this.emitir("error");
            this.emitir("open");
            if (control.modo === "silencio") return;
            this.emitir("latido", { fecha: Date.now() });
            this.emitir("estado", estado);
            this.intervalo = setInterval(() => {
              if (control.modo === "sana")
                this.emitir("latido", { fecha: Date.now() });
            }, 15_000);
          });
        }
        emitir(tipo: string, datos?: unknown) {
          if (this.readyState === 2) return;
          if (tipo === "open") this.readyState = 1;
          const event = ["open", "error"].includes(tipo)
            ? new Event(tipo)
            : new MessageEvent(tipo, { data: JSON.stringify(datos ?? {}) });
          this.dispatchEvent(event);
          if (tipo === "open") this.onopen?.(event);
          if (tipo === "error") this.onerror?.(event);
          if (tipo === "message") this.onmessage?.(event);
        }
        close() {
          if (this.readyState === 2) return;
          this.readyState = 2;
          this.registro.cerrada = Date.now();
          clearInterval(this.intervalo);
        }
      }
      window.__conexionEnsayo = control;
      window.EventSource = FuenteEnsayo as unknown as typeof EventSource;
    },
    { estado, modo },
  );
}

export async function pausarRelojConexion(page: Page) {
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 100)),
  );
}

export async function esperarConexion(page: Page) {
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-conexion",
    "activa",
  );
  await expect(page.getByTestId("estado-conexion")).toHaveCount(0);
}
