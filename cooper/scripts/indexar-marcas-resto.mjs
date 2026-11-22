// Índice revisable de las capturas de esta misión; no modifica imágenes.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../../evidencias-diseno");
const widths = [360, 390, 768, 1024, 1440, 1920];
const manifests = widths.map((width) =>
  JSON.parse(
    readFileSync(`${root}/marcas-resto-manifest-${width}.json`, "utf8"),
  ),
);
const screens = manifests[0].map(({ screen }) => screen);
const hashes = [];
for (const [i, width] of widths.entries()) {
  if (
    JSON.stringify(manifests[i].map(({ screen }) => screen)) !==
    JSON.stringify(screens)
  )
    throw new Error(`La lista de estados difiere a ${width}px`);
  for (const entry of manifests[i]) {
    if (
      entry.overflow ||
      entry.tiny.length ||
      entry.violations.length ||
      entry.console.length
    )
      throw new Error(`Auditoría rechazada en ${entry.screen} a ${width}px`);
    for (const suffix of ["", "-viewport"]) {
      const file = `${entry.screen}-${width}${suffix}.png`;
      const data = readFileSync(`${root}/${file}`);
      hashes.push({
        file,
        bytes: data.length,
        sha256: createHash("sha256").update(data).digest("hex"),
      });
    }
  }
}
const videos = readdirSync(`${root}/recorridos-marcas-resto`, {
  recursive: true,
}).filter((file) => file.endsWith(".webm"));
const summary = {
  generated: new Date().toISOString(),
  widths,
  screens: screens.length,
  states: screens.length * widths.length,
  captures: hashes.length,
  seriousAxe: 0,
  unexpectedConsole: 0,
  horizontalOverflow: 0,
  textUnder12px: 0,
  scope:
    "Datos efímeros; capturas con movimiento reducido; recorridos activos separados a390/1440. Los HTTP deliberados se documentan en estados-resto-<ancho>.json.",
  files: hashes,
  videos: videos.map((file) => `recorridos-marcas-resto/${file}`),
};
writeFileSync(
  `${root}/marcas-resto-resumen.json`,
  JSON.stringify(summary, null, 2) + "\n",
);
const lines = [
  "# Evidencias de diseño — Marcas y resto",
  "",
  `${summary.screens} pantallas/estados, ${summary.states} auditorías y ${summary.captures} PNG.`,
  "",
  "Cada celda enlaza página completa y primer viewport. En la página completa se ocultan únicamente los accesos flotantes inferiores para no tapar contenido; el viewport conserva la interfaz fija real.",
  "",
  `| Estado | ${widths.join(" | ")} |`,
  `| --- | ${widths.map(() => "---").join(" | ")} |`,
  ...screens.map(
    (screen) =>
      `| ${screen} | ${widths.map((width) => `[página](${screen}-${width}.png) · [vista](${screen}-${width}-viewport.png)`).join(" | ")} |`,
  ),
  "",
  "## Videos",
  "",
  ...videos.map((file) => `- [${file}](recorridos-marcas-resto/${file})`),
  "",
  "## Mediciones",
  "",
  "- [Auditoría y huellas de las imágenes](marcas-resto-resumen.json).",
  "- [Lighthouse](lighthouse/resumen.json).",
  "- [Fluidez a 390](cooper-fluidez-390.json) y [a 1440](cooper-fluidez-1440.json), con trazas CDP separadas.",
  "- [Informe de la misión](../docs/informes/diseno-marcas-resto.md).",
  "",
];
writeFileSync(`${root}/README.md`, lines.join("\n"));
console.log(
  `${summary.states} auditorías y ${summary.captures} capturas indexadas; ${videos.length} videos.`,
);
