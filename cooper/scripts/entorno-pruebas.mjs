import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

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

export function comprobarSentinel(
  directorio = resolve(raiz, "vendor/sentinel"),
) {
  const origen = JSON.parse(
    readFileSync(resolve(directorio, "origen.json"), "utf8"),
  );
  for (const [archivo, esperado] of Object.entries(origen.archivos)) {
    const actual = createHash("sha256")
      .update(readFileSync(resolve(directorio, archivo)))
      .digest("hex");
    if (actual !== esperado) throw new Error(`Sentinel modificado: ${archivo}`);
  }
  return origen.revision;
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
      "import {chromium} from '@playwright/test'; const b=await chromium.launch(); await b.close();",
    ],
    {
      env: { ...entornoLimpio(), PLAYWRIGHT_BROWSERS_PATH: browsers },
    },
  );
}
