import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Índice de una sola corrida completa. Los diagnósticos anteriores se conservan
// en disco, pero nunca se suman a las evidencias de aceptación.
const root = resolve("../evidencias-diseno");
const read = (name) => JSON.parse(readFileSync(resolve(root, name), "utf8"));
const run = read("inicio-playwright.json");
const started = new Date(run.stats.startTime).getTime();
const widths = [360, 390, 768, 1024, 1440, 1920];
const scenarios = ["", "-vacio", "-sin-terminados", "-sin-medios"];
const file = (name) => {
  const path = resolve(root, name);
  if (statSync(path).mtimeMs < started)
    throw new Error(`Evidencia anterior a la última corrida: ${name}`);
  const bytes = readFileSync(path);
  return {
    name,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    ...(name.endsWith(".png")
      ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
      : {}),
  };
};
const captures = widths.flatMap((width) =>
  scenarios.map((scenario) => {
    const name = `inicio${scenario}-${width}`;
    const auditFile = file(`${name}.json`);
    const audit = read(auditFile.name);
    return {
      screen: scenario ? scenario.slice(1) : "demostracion",
      width,
      fullPage: file(`${name}.png`),
      viewport: file(`${name}-viewport.png`),
      auditFile,
      serious: audit.serious.length,
      tokenDeviations: audit.deviations.length,
      console: audit.errors,
      overflow: audit.overflow,
      figuresOverflow: audit.figuresOverflow,
      fullPageMethod: audit.fullPageMethod,
    };
  }),
);
const motion = [390, 1440].map((width) => {
  const audit = file(`inicio-movimiento-${width}.json`);
  const data = read(audit.name);
  return {
    width,
    audit,
    trace: file(`inicio-traza-${width}.json`),
    video: file(`inicio-interacciones-${width}.webm`),
    renderer: data.renderer,
    cpu: data.cpu,
    samples: data.samples.map((sample) => ({
      phase: sample.phase,
      interactionFps: sample.fps,
      interactionP95: sample.p95,
      animationBudgets: sample.animations.length
        ? sample.animations.map(({ fps, p95, latencyUntilReady }) => ({
            fps,
            p95,
            latencyUntilReady,
          }))
        : [{ fps: sample.fps, p95: sample.p95 }],
      cls: sample.cls,
      longTasks: sample.longTasks,
    })),
    console: data.errors,
    scope: data.scope,
  };
});
const summary = {
  run: run.stats,
  states: captures.length,
  png: captures.length * 2,
  videos: motion.length,
  traces: motion.length,
  serious: captures.reduce((sum, item) => sum + item.serious, 0),
  tokenDeviations: captures.reduce(
    (sum, item) => sum + item.tokenDeviations,
    0,
  ),
  console: [...captures, ...motion].flatMap((item) => item.console),
  horizontalOverflow: Math.max(...captures.map((item) => item.overflow)),
  figuresOverflow: captures.flatMap((item) => item.figuresOverflow),
  captures,
  motion,
};
writeFileSync(
  resolve(root, "inicio-indice.json"),
  JSON.stringify(summary, null, 2) + "\n",
);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
writeFileSync(
  resolve(root, "inicio-index.html"),
  `<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Inicio · evidencia de diseño</title>
<style>body{font:15px/1.5 system-ui;background:#0a0a0c;color:#f5f5f7;margin:32px}h1{font-size:28px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:24px}figure{margin:0;min-width:0}img,video{width:100%;height:360px;object-fit:contain;background:#111114}a{color:#7cc4ff}figcaption{overflow-wrap:anywhere}</style>
<h1>Inicio · ${captures.length} estados / ${captures.length * 2} capturas</h1>
<p>Corrida ${escape(run.stats.startTime)}. Datos locales de ensayo y medios reales del proyecto. <a href="inicio-indice.json">Resultado, alcance y SHA-256</a>. <a href="medios-inicio/manifest.json">Procedencia de los cinco segmentos de un único montaje</a>.</p>
<main>${captures.map((item) => `<figure><a href="${item.fullPage.name}"><img loading="lazy" src="${item.fullPage.name}" alt="${escape(item.screen)} a ${item.width}px"></a><figcaption>${escape(item.screen)} · ${item.width}px · <a href="${item.viewport.name}">primer viewport</a> · <a href="${item.auditFile.name}">auditoría</a></figcaption></figure>`).join("\n")}</main>
<h2>Interacciones</h2><main>${motion.map((item) => `<figure><video controls preload="none" src="${item.video.name}"></video><figcaption>${item.width}px · <a href="${item.audit.name}">medición</a> · <a href="${item.trace.name}">traza</a></figcaption></figure>`).join("\n")}</main></html>`,
);
console.log(
  `Inicio: ${captures.length} estados, ${captures.length * 2} PNG, ${motion.length} videos, ${motion.length} trazas; sin mezclar corridas.`,
);
