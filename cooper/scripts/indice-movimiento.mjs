import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
const root = process.env.COOPER_MOVIMIENTO_SALIDA || ".cache/videos-movimiento";
const rounds = readdirSync(root)
  .filter((n) => {
    if (!/^ronda-\d+$/.test(n)) return false;
    try {
      const report = JSON.parse(
        readFileSync(`${root}/${n}/playwright.json`, "utf8"),
      );
      return (
        report.stats.unexpected === 0 &&
        report.stats.flaky === 0 &&
        report.stats.skipped === 0 &&
        report.stats.expected >= 10 &&
        report.errors.length === 0
      );
    } catch {
      return false;
    }
  })
  .sort();
const clips = [];
for (const round of rounds)
  for (const file of readdirSync(`${root}/${round}`).filter((n) =>
    n.endsWith(".webm"),
  )) {
    const path = `${round}/${file}`;
    const bytes = readFileSync(`${root}/${path}`);
    clips.push({
      ronda: round,
      archivo: path,
      bytes: statSync(`${root}/${path}`).size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
const escape = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
writeFileSync(
  `${root}/indice.json`,
  JSON.stringify({ fecha: new Date().toISOString(), clips }, null, 2),
);
writeFileSync(
  `${root}/index.html`,
  `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Cooper · movimiento</title><style>body{font:16px system-ui;background:#101214;color:#f0eee7;margin:32px}a{color:#a6d7ed}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}video{width:100%;max-height:600px;background:#191d20}summary{padding:12px;cursor:pointer}p{max-width:70ch}details{border:1px solid #343b40;border-radius:12px;overflow:hidden}h1{font-size:36px}</style><h1>Cooper, en movimiento.</h1><p>Videos de navegador a 1440 y 390 px. Datos y sesiones ficticios. Cada archivo conserva su resolución; Playwright codifica video a una cadencia distinta del muestreo de requestAnimationFrame. Los FPS se consultan en los JSON de cada ronda.</p><p><a href="indice.json">Índice con SHA-256</a> · ${clips.length} videos</p><main>${clips.map((c) => `<details><summary>${escape(c.archivo)}</summary><video controls preload="none" src="${escape(c.archivo)}"></video><p><a href="${escape(c.archivo)}">Abrir video</a></p></details>`).join("")}</main></html>`,
);
writeFileSync(
  `${root}/INDICE.md`,
  `# Videos de movimiento de Cooper\n\n${clips.length} videos. [Reproductor local](index.html), [manifiesto SHA-256](indice.json).\n\n` +
    clips.map((c) => `- [${c.archivo}](${c.archivo})`).join("\n") +
    "\n",
);
console.log(`${clips.length} videos indexados`);
