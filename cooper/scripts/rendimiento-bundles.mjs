import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";

// Inventario del build público: no abre bases, variables ni archivos de entorno.
const output = process.argv[2] ?? ".cache/rendimiento/bundles.json";
function inventory(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return inventory(path);
    if (!/\.(js|css|woff2|svg|json|png|webp|avif|mp4|webm)$/.test(path))
      return [];
    const bytes = readFileSync(path);
    return [
      {
        path,
        type: extname(path),
        bytes: bytes.length,
        gzip: gzipSync(bytes).length,
        brotli: brotliCompressSync(bytes).length,
      },
    ];
  });
}
const files = [...inventory(".next/static"), ...inventory("public")];
const totals = {};
for (const file of files) {
  const key = `${file.path.startsWith("public") ? "public" : "build"}${file.type}`;
  const total = (totals[key] ??= { files: 0, bytes: 0, gzip: 0, brotli: 0 });
  total.files++;
  for (const metric of ["bytes", "gzip", "brotli"])
    total[metric] += file[metric];
}
mkdirSync(join(output, ".."), { recursive: true });
writeFileSync(
  output,
  JSON.stringify(
    {
      revision: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      buildId: readFileSync(".next/BUILD_ID", "utf8").trim(),
      fecha: new Date().toISOString(),
      nota: "Bytes de todos los chunks, no suma por navegación. gzip/Brotli offline; no prueban compresión del VPS.",
      totals,
      files: files.sort((a, b) => b.bytes - a.bytes),
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(totals));
