import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { prepararSentinel } from "./sentinel-cache.mjs";
import {
  comprobarHerramientas,
  comprobarInstalacion,
  ejecutar,
  entornoLimpio,
  raiz,
  python,
  browsers,
  sentinelBrowsers,
  versiones,
} from "./entorno-pruebas.mjs";

prepararSentinel();
console.log(JSON.stringify(comprobarHerramientas()));
mkdirSync(resolve(raiz, ".cache"), { recursive: true });
const opciones = { stdio: "inherit" };
ejecutar(
  "uv",
  [
    "venv",
    "--allow-existing",
    "--python",
    versiones.python,
    resolve(raiz, ".cache/sentinel-venv"),
  ],
  opciones,
);
ejecutar(
  "uv",
  [
    "pip",
    "sync",
    "--python",
    python,
    "--require-hashes",
    "--only-binary",
    ":all:",
    "ci/sentinel-requirements.txt",
  ],
  opciones,
);
ejecutar(python, ["-m", "playwright", "install", "chromium"], {
  ...opciones,
  env: { ...entornoLimpio(), PLAYWRIGHT_BROWSERS_PATH: sentinelBrowsers },
});
ejecutar(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "install",
    "chromium",
    "firefox",
    "webkit",
  ],
  {
    ...opciones,
    env: { ...entornoLimpio(), PLAYWRIGHT_BROWSERS_PATH: browsers },
  },
);
comprobarInstalacion();
console.log("Preparación y lanzamiento de ambos Chromium: PASS.");
