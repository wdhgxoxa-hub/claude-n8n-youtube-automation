import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Uso: node generar.mjs /ruta/local/al/original.mp4
// Solo acepta el render existente de Margen Real; no usa red ni credenciales.
const original = process.argv[2];
if (!original) throw new Error("Indica el archivo original existente.");
const hash = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
if (
  hash(original) !==
  "727421fdd1fbc2c705c6457a58496e90a84349b0ae7e27ee0cd20482b084f0a3"
)
  throw new Error("El archivo no corresponde al render documentado.");
const directory = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(directory, "procedencia.json"), "utf8"),
);
for (const [index, second] of [4, 7, 43, 49].entries()) {
  const item = manifest.derivados[index];
  const poster = join(directory, item.poster.archivo);
  const preview = join(directory, item.preview.archivo);
  const base = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(second),
    "-i",
    original,
  ];
  execFileSync("ffmpeg", [
    ...base,
    "-frames:v",
    "1",
    "-vf",
    "scale=720:-2",
    "-c:v",
    "libwebp",
    "-quality",
    "84",
    poster,
  ]);
  execFileSync("ffmpeg", [
    ...base,
    "-t",
    "5",
    "-vf",
    "scale=360:-2,fps=24",
    "-an",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    "-b:v",
    "400k",
    "-maxrate",
    "500k",
    "-bufsize",
    "800k",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    preview,
  ]);
  item.segundo = second;
  for (const [key, path] of [
    ["poster", poster],
    ["preview", preview],
  ])
    Object.assign(item[key], {
      sha256: hash(path),
      bytes: statSync(path).size,
    });
}
writeFileSync(
  join(directory, "procedencia.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
