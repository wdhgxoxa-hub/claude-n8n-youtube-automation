import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve("../evidencias-diseno");
const files = readdirSync(dir)
  .filter((name) => /\.(png|webm|mp4)$/.test(name))
  .sort();
const escape = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const manifest = files.map((file) => {
  const data = readFileSync(resolve(dir, file));
  return {
    archivo: file,
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
});
writeFileSync(
  resolve(dir, "indice.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
writeFileSync(
  resolve(dir, "index.html"),
  `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Medios · evidencia para dirección</title><style>body{font:15px/1.5 system-ui;background:#0a0a0c;color:#f5f5f7;margin:32px}h1{font-size:28px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px}figure{margin:0;min-width:0}img,video{width:100%;height:360px;object-fit:contain;background:#111114}a{color:#7cc4ff}figcaption{overflow-wrap:anywhere}</style><h1>Medios · evidencia para dirección</h1><p>Datos de ensayo, sin sesión productiva. Cada enlace abre el original completo; las capturas no sustituyen las pruebas. Las desviaciones globales de tokens se conservan en <a href="desviaciones-tokens.json">el informe automático</a>.</p><main>${manifest.map(({ archivo }) => `<figure>${archivo.endsWith(".png") ? `<a href="${encodeURIComponent(archivo)}"><img loading="lazy" src="${encodeURIComponent(archivo)}" alt="${escape(archivo)}"></a>` : `<video controls preload="none" src="${encodeURIComponent(archivo)}"></video>`}<figcaption>${escape(archivo)}</figcaption></figure>`).join("")}</main></html>`,
);
console.log(`Índice de ${manifest.length} capturas/videos con SHA-256.`);
