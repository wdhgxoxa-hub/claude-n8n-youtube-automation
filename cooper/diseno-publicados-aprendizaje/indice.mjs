// Índice estático de evidencia local: nunca incorpora cookies, trazas o secretos.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const directory = resolve("../evidencias-diseno");
const files = readdirSync(directory);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const widths = [360, 390, 768, 1024, 1440, 1920];
const entries = files
  .filter((file) =>
    /^(publicados|aprendizaje)(?:-[a-z]+)*-(360|390|768|1024|1440|1920)\.png$/.test(
      file,
    ),
  )
  .map((file) => {
    const [, name, width] = file.match(/^(.*)-(\d+)\.png$/);
    const viewport = file.replace(/\.png$/, "-viewport.png");
    const reportPath = resolve(directory, file.replace(/\.png$/, ".json"));
    const report = existsSync(reportPath)
      ? JSON.parse(readFileSync(reportPath, "utf8"))
      : null;
    return {
      name,
      width: Number(width),
      fullPage: file,
      viewport: files.includes(viewport) ? viewport : null,
      overflow: report?.overflow ?? null,
      seriousAxe: report?.axe?.length ?? null,
      tokens: report?.tokens?.length ?? null,
      console: report?.consola?.length ?? null,
    };
  })
  .sort((a, b) => a.width - b.width || a.name.localeCompare(b.name));
const videos = files.filter((file) => file.endsWith(".webm"));
const motion = widths.flatMap((width) => {
  const file = resolve(directory, `movimiento-${width}.json`);
  return existsSync(file)
    ? [{ width, ...JSON.parse(readFileSync(file, "utf8")) }]
    : [];
});
writeFileSync(
  resolve(directory, "indice-publicados-aprendizaje.json"),
  JSON.stringify({ entries, videos, motion }, null, 2) + "\n",
);
const summary = (entry) =>
  `Axe serias: ${entry.seriousAxe ?? "sin informe"} · tokens: ${entry.tokens ?? "sin informe"} · overflow: ${entry.overflow ?? "sin informe"} · consola: ${entry.console ?? "sin informe"}`;
const body = widths
  .map(
    (width) =>
      `<section id="ancho-${width}"><h2>${width} px</h2><div class="grid">${entries
        .filter((entry) => entry.width === width)
        .map(
          (entry) =>
            `<article><h3>${escape(entry.name)}</h3><p>${summary(entry)}</p><div class="pair"><a href="${escape(entry.fullPage)}"><img loading="lazy" src="${escape(entry.fullPage)}" alt="${escape(entry.name)}: página completa a ${width}px"><span>Página completa</span></a>${entry.viewport ? `<a href="${escape(entry.viewport)}"><img loading="lazy" src="${escape(entry.viewport)}" alt="${escape(entry.name)}: primer viewport a ${width}px"><span>Primer viewport</span></a>` : "<p>Falta primer viewport</p>"}</div></article>`,
        )
        .join("")}</div></section>`,
  )
  .join("");
writeFileSync(
  resolve(directory, "index.html"),
  `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Publicados y Aprendizaje · Evidencias</title><style>:root{color-scheme:dark;--lienzo:#000;--texto:#f5f5f7;--texto-2:#a1a1aa;--sup:#111114;--linea:rgba(255,255,255,.14)}*{box-sizing:border-box}body{margin:0;padding:32px;background:var(--lienzo);color:var(--texto);font:15px/1.5 system-ui,sans-serif}h1{font-size:40px;line-height:1.1}h2{font-size:28px;margin-top:48px}h3{font-size:17px}a{color:inherit}nav{display:flex;gap:24px;flex-wrap:wrap}p{color:var(--texto-2)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:24px}article{border:1px solid var(--linea);border-radius:14px;padding:16px;background:var(--sup)}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pair a{display:grid;gap:8px}img{width:100%;height:320px;object-fit:contain;background:var(--lienzo)}video{max-width:100%;max-height:560px}.videos{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))}summary{cursor:pointer}</style><h1>Publicados y Aprendizaje</h1><p>Evidencia local con datos ficticios y medios fotográficos del render existente. Cada enlace abre la captura original. Los estados de error 503 son provocados y están documentados por separado.</p><nav>${widths.map((width) => `<a href="#ancho-${width}">${width}px</a>`).join("")}<a href="#videos">Vídeos</a><a href="medios/procedencia.json">Procedencia</a><a href="indice-publicados-aprendizaje.json">Manifiesto</a></nav>${body}<section id="videos"><h2>Interacciones</h2><div class="videos">${videos.map((file) => `<details><summary>${escape(file)}</summary><video controls preload="none" src="${escape(file)}"></video></details>`).join("")}</div></section></html>\n`,
);
console.log(
  `Índice: ${entries.length} pares de captura y ${videos.length} vídeos.`,
);
