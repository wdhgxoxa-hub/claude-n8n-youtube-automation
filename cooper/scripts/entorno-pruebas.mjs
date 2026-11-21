import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { comprobarSentinel } from "./sentinel-cache.mjs";
export { comprobarSentinel } from "./sentinel-cache.mjs";

export const raiz = resolve(import.meta.dirname, "..");
export const versiones = JSON.parse(
  readFileSync(resolve(raiz, "ci/versiones.json"), "utf8"),
);
export const python = resolve(raiz, ".cache/sentinel-venv/bin/python");
export const browsers = resolve(raiz, ".cache/browsers");
export const sentinelBrowsers = resolve(raiz, ".cache/sentinel-browsers");

// No heredar credenciales, proveedores, destinos, NODE_OPTIONS ni configuración npm/pip.
export function entornoLimpio(origen = process.env) {
  const env = {};
  for (const key of ["PATH", "HOME", "LANG", "TMPDIR", "UV_PYTHON_INSTALL_DIR"])
    if (origen[key]) env[key] = origen[key];
  return {
    ...env,
    // La imagen oficial ya trae las cabeceras de su Node. Evitar descargarlas y
    // extraer propietarios de un tar bajo un contenedor sin capacidades.
    ...(existsSync(resolve(dirname(process.execPath), "../include/node/node.h"))
      ? {
          npm_package_config_node_gyp_nodedir: resolve(
            dirname(process.execPath),
            "..",
          ),
        }
      : {}),
    NEXT_TELEMETRY_DISABLED: "1",
    TZ: "UTC",
    PYTHONDONTWRITEBYTECODE: "1",
    npm_config_update_notifier: "false",
    npm_config_fund: "false",
    npm_config_userconfig: resolve(raiz, "ci/npmrc"),
    npm_config_globalconfig: "/dev/null",
    UV_NO_CONFIG: "1",
    UV_KEYRING_PROVIDER: "disabled",
    UV_INDEX_URL: "https://pypi.org/simple",
    UV_LINK_MODE: "copy",
  };
}

export function comprobarArchivosEntorno(directorio = raiz) {
  // Solo nombres: nunca abrir .env reales. Next los carga aun con env saneado.
  for (const dir of [directorio, resolve(directorio, "..")]) {
    if (
      readdirSync(dir).some(
        (name) => /^\.env(?:\.|$)/.test(name) && name !== ".env.example",
      )
    )
      throw new Error(
        "Hay archivos .env reales. Use el checkout limpio de ci:limpia; no se leyeron sus valores.",
      );
  }
}

export function comprobarGremlins(
  directorio = resolve(raiz, "node_modules/gremlins.js"),
) {
  const bundle = resolve(directorio, "dist/gremlins.min.js");
  if (!existsSync(bundle))
    throw new Error(
      "Falta gremlins.js para el caos de Sentinel. Ejecute npm ci.",
    );
  const hash = createHash("sha256").update(readFileSync(bundle)).digest("hex");
  if (hash !== versiones.gremlinsSha256)
    throw new Error("gremlins.js no coincide con la distribución fijada.");
}

export function ejecutar(cmd, args, opciones = {}) {
  const result = spawnSync(cmd, args, {
    cwd: raiz,
    env: entornoLimpio(),
    encoding: "utf8",
    ...opciones,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Falló ${cmd} (rc ${result.status ?? "sin proceso"}). ${result.stderr || ""}`,
    );
  return result.stdout?.trim() ?? "";
}

export function comprobarHerramientas() {
  comprobarArchivosEntorno();
  if (process.platform !== "linux" || process.arch !== "x64")
    throw new Error("La puerta fijada requiere Linux x86_64. Use ci:limpia.");
  const os = readFileSync("/etc/os-release", "utf8");
  const id = os.match(/^ID=["']?([^\n"']+)/m)?.[1];
  const version = os.match(/^VERSION_ID=["']?([^\n"']+)/m)?.[1];
  if (!versiones.plataformas[id]?.includes(version))
    throw new Error(
      "Plataforma no soportada por esta puerta. Use npm run ci:limpia (contenedor Debian 12).",
    );
  const actual = {
    node: process.versions.node,
    npm: ejecutar("npm", ["--version"]),
    python: ejecutar("python3", ["--version"]).split(" ")[1],
    uv: ejecutar("uv", ["--version"]).split(" ")[1],
  };
  for (const [nombre, version] of Object.entries(actual))
    if (version !== versiones[nombre])
      throw new Error(
        `Versión incompatible de ${nombre}: requiere ${versiones[nombre]}. Use ci:limpia.`,
      );
  ejecutar("ffmpeg", ["-version"]);
  return {
    ...actual,
    sistema: `${id} ${version}`,
    sentinel: comprobarSentinel(),
  };
}

export function comprobarInstalacion() {
  comprobarArchivosEntorno();
  comprobarSentinel();
  comprobarGremlins();
  if (!existsSync(python))
    throw new Error(
      "Falta Python de ensayo. Ejecute npm run preparar:pruebas o npm run ci:limpia.",
    );
  const expected = versiones.playwrightPython;
  const actual = ejecutar(python, [
    "-c",
    "import importlib.metadata; print(importlib.metadata.version('playwright'))",
  ]);
  if (actual !== expected)
    throw new Error(
      "Playwright de Sentinel no coincide con la versión fijada.",
    );
  ejecutar(
    python,
    [
      "-c",
      "from playwright.sync_api import sync_playwright\nwith sync_playwright() as p:\n b=p.chromium.launch(); b.close()",
    ],
    {
      env: { ...entornoLimpio(), PLAYWRIGHT_BROWSERS_PATH: sentinelBrowsers },
    },
  );
  ejecutar(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import {chromium,firefox,webkit} from '@playwright/test'; for (const motor of [chromium,firefox,webkit]) { const b=await motor.launch(); try { const p=await b.newPage(); await p.goto('data:text/html,<title>preflight</title>'); if (await p.title() !== 'preflight') throw new Error('El motor no abrió la página de prueba'); } finally { await b.close(); } }",
    ],
    {
      env: { ...entornoLimpio(), PLAYWRIGHT_BROWSERS_PATH: browsers },
    },
  );
}
