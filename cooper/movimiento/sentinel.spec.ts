import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
const dir = `${process.env.COOPER_MOVIMIENTO_SALIDA || ".cache/videos-movimiento"}/${process.env.COOPER_MOVIMIENTO_RONDA || "diagnostico"}`;
for (const width of [1440, 390])
  test(`Sistema Sentinel ${width}: recorrido, caos y estabilidad`, async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(600000);
    mkdirSync(dir, { recursive: true });
    const fixture = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT}`;
    expect(
      (
        await page.request.post(`${fixture}/sesion`, {
          data: {
            email: "admin@example.test",
            secret: process.env.COOPER_E2E_SECRET,
          },
        })
      ).ok(),
    ).toBe(true);
    const state = await (await page.request.get("/api/estado")).json();
    const paths = [
      "/",
      "/marcas",
      "/canales",
      `/canales/${state.channels[0].id}`,
      "/videos",
      `/videos/${state.videos[0].id}`,
      "/publicados",
      "/aprendizaje",
      "/avatares",
      "/perfil",
      "/admin",
      "/radar",
      "/rutina",
      "/redes",
      "/referencias",
      "/cuentas",
      "/programados",
      "/decisiones",
      "/incidencias",
      "/avisos",
      "/admin/fabrica",
    ];
    const sesion = resolve(dir, `sesion-${width}.json`),
      config = resolve(dir, `sentinel-${width}.json`),
      salida = resolve(dir, `sentinel-${width}`);
    await page.context().storageState({ path: sesion });
    writeFileSync(
      config,
      JSON.stringify({
        url: baseURL,
        fixture,
        sesion,
        salida,
        pantallas: paths,
        duracion: 160,
        esperar_operacion: true,
        excluir_textos: [
          "Desconectar",
          "Verificar conexión",
          "Estudiar la cuenta",
          "Proponer texto con el especialista",
          "Pedir cambios",
        ],
        ancho: width,
      }),
      { mode: 0o600 },
    );
    try {
      const python =
        process.env.SENTINEL_PYTHON ||
        `${process.env.HOME}/Proyectos/Sistema-Sentinel/codigo/.venv/bin/python`;
      const result = await new Promise<{ code: number | null; log: string }>(
        (done, reject) => {
          const child = spawn(python, ["scripts/sentinel-cooper.py", config], {
            env: {
              ...process.env,
              PLAYWRIGHT_BROWSERS_PATH: resolve(".cache/sentinel-browsers"),
            },
            detached: true,
          });
          let log = "";
          const timer = setTimeout(() => {
            process.kill(-child.pid!, "SIGTERM");
            reject(new Error("Sentinel excedió 540 s"));
          }, 540000);
          child.stdout.on("data", (d) => {
            log += String(d);
          });
          child.stderr.on("data", (d) => {
            log += String(d);
          });
          child.on("error", reject);
          child.on("exit", (code) => {
            clearTimeout(timer);
            done({ code, log });
          });
        },
      );
      writeFileSync(`${salida}.log`, result.log);
      expect(result.code, result.log).toBe(0);
      const report = JSON.parse(readFileSync(`${salida}/informe.json`, "utf8"));
      expect(report.pantallas.length).toBeGreaterThanOrEqual(20);
      expect(
        report.hallazgos.filter(
          (h: { gravedad: string }) => h.gravedad !== "info",
        ),
      ).toEqual([]);
    } finally {
      unlinkSync(sesion);
    }
  });
