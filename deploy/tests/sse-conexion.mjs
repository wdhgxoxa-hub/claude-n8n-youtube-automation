// Ensayo local del proxy exacto: no lee .env, no usa sesiones ni contacta al VPS.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";
import { createGunzip } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evidence = resolve(root, "docs/informes/evidencias/diseno-conexion/infraestructura");
const require = createRequire(resolve(root, "cooper/package.json"));
const compression = require("next/dist/compiled/compression");
const { pipeToNodeResponse } = require("next/dist/server/pipe-readable");
const exec = promisify(execFile);
const env = Object.fromEntries(["PATH", "HOME", "XDG_RUNTIME_DIR"].filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
const image = JSON.parse(await readFile(resolve(root, "deploy/infra-imagenes.json"), "utf8")).servicios.caddy.imagen;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const wait = (ms) => new Promise((yes) => setTimeout(yes, ms));
await mkdir(resolve(root, "cooper/.cache/diseno-conexion-infra"), { recursive: true });
const run = await mkdtemp(resolve(root, "cooper/.cache/diseno-conexion-infra/ensayo-"));
await mkdir(resolve(run, "deploy"));
const baseline = await readFile(resolve(root, "deploy/Caddyfile"), "utf8");
const candidatePath = resolve(run, "deploy/Caddyfile");
await writeFile(candidatePath, baseline);
const command = (bin, args, options = {}) => exec(bin, args, { cwd: run, env, timeout: 30000, maxBuffer: 4 * 1024 * 1024, ...options });
for (const patch of ["caddy.patch", "caddy-reversa.patch", "caddy.patch"]) {
  await command("git", ["apply", "--check", resolve(evidence, patch)]);
  await command("git", ["apply", resolve(evidence, patch)]);
  if (patch === "caddy-reversa.patch") assert.equal(await readFile(candidatePath, "utf8"), baseline);
}
const candidate = await readFile(candidatePath, "utf8");

async function adapt(source) {
  const result = await new Promise((yes, no) => {
    const child = spawn("podman", ["run", "--rm", "--pull=never", "-i", "--network=none", "--read-only", "--cap-drop=all", "--security-opt=no-new-privileges", "-e", "COOPER_DOMAIN=cooper.test", "-e", "N8N_DOMAIN=flujos.test", "-e", "CADDY_TLS=internal", image, "caddy", "adapt", "--adapter", "caddyfile", "--config", "/dev/stdin"], { env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", no);
    child.on("close", (code) => code ? no(new Error(`caddy adapt: ${code}`)) : yes({ stdout, stderr }));
    child.stdin.end(source);
  });
  assert.doesNotMatch(result.stderr, /warn|error/i);
  return JSON.parse(result.stdout);
}
const beforeConfig = await adapt(baseline), afterConfig = await adapt(candidate);
function cooperRoute(config) {
  return Object.values(config.apps.http.servers).flatMap((server) => server.routes).find((route) => route.match?.some((match) => match.host?.length === 1 && match.host[0] === "cooper.test"));
}
function walk(value, fn) {
  if (!value || typeof value !== "object") return;
  fn(value);
  for (const child of Object.values(value)) walk(child, fn);
}
const beforeRoute = cooperRoute(beforeConfig), afterRoute = cooperRoute(afterConfig);
assert.ok(beforeRoute && afterRoute);
// Caddy ajeno a Cooper se conserva exactamente, incluido el bloqueo del puente.
const withoutCooper = (config) => {
  const copy = structuredClone(config);
  for (const server of Object.values(copy.apps.http.servers)) server.routes = server.routes.filter((route) => !route.match?.some((match) => match.host?.length === 1 && match.host[0] === "cooper.test"));
  return copy;
};
assert.deepEqual(withoutCooper(beforeConfig), withoutCooper(afterConfig));

// Compose resuelve solo variables ficticias y /dev/null; no abre el .env real.
const composeEnv = { ...env, COMPOSE_PROJECT_NAME: "cooper-sse-ensayo", COOPER_IMAGE: "localhost/cooper:ensayo", DATA_ROOT: resolve(run, "datos"), COOPER_DOMAIN: "cooper.test", COOPER_ORIGIN: "https://cooper.test", N8N_DOMAIN: "flujos.test", N8N_EDITOR_ORIGIN: "https://flujos.test:8443", COOPER_ADMIN_EMAIL: "admin@example.test", CADDY_TLS: "internal", COOPER_CADDY_SSE_CANDIDATO: candidatePath, COOPER_CADDY_SSE_ANTERIOR: resolve(root, "deploy/Caddyfile") };
for (const key of ["AUTH_SECRET", "COOPER_N8N_TOKEN", "COOPER_WEBHOOK_SECRET", "N8N_ENCRYPTION_KEY", "N8N_RUNNERS_AUTH_TOKEN", "PUENTE_CODEX_TOKEN"]) composeEnv[key] = "solo-ensayo-sin-autenticacion-real";
const composeArgs = ["compose", "--env-file", "/dev/null", "-f", resolve(root, "deploy/compose.yaml"), "-f", resolve(root, "deploy/compose.chat.yaml")];
const compose = async (overlays = []) => {
  const result = await command("docker", [...composeArgs, ...overlays.flatMap((overlay) => ["-f", resolve(evidence, overlay)]), "config", "--format", "json"], { env: composeEnv });
  assert.equal(result.stderr.trim(), "");
  return JSON.parse(result.stdout);
};
const composeBefore = await compose(), composeAfter = await compose(["compose.sse.yaml"]);
assert.equal(composeAfter.services.caddy.volumes.filter((volume) => volume.target === "/etc/caddy/Caddyfile").length, 1);
assert.equal(composeAfter.services.caddy.volumes.find((volume) => volume.target === "/etc/caddy/Caddyfile").source, candidatePath);
const expected = structuredClone(composeBefore);
expected.services.caddy.volumes.find((volume) => volume.target === "/etc/caddy/Caddyfile").source = candidatePath;
delete expected.services.caddy.volumes.find((volume) => volume.target === "/etc/caddy/Caddyfile").bind;
assert.ok(isDeepStrictEqual(composeAfter, expected), "El overlay solo puede sustituir el montaje Caddy (sin imprimir variables)");
const composeReverted = await compose(["compose.sse.yaml", "compose.sse-reversa.yaml"]);
const revertedExpected = structuredClone(composeBefore);
delete revertedExpected.services.caddy.volumes.find((volume) => volume.target === "/etc/caddy/Caddyfile").bind;
assert.ok(isDeepStrictEqual(composeReverted, revertedExpected), "La reversa restaura el montaje anterior sin cambiar servicios");
console.log("PASS parche/reversa exactos, Caddy adaptado y overlay Compose limitado a un montaje");

const active = new Set(), receipts = [];
const compress = compression();
let originRequests = 0;
const origin = http.createServer((req, res) => {
  const url = new URL(req.url, "http://ensayo.test");
  if (url.pathname === "/salud") { res.end("ok"); return; }
  if (url.pathname === "/normal") {
    compress(req, res, () => { res.setHeader("Content-Type", "text/plain"); res.end("contenido ".repeat(400)); });
    return;
  }
  if (active.size >= 4) { res.writeHead(429); res.end(); return; }
  const id = ++originRequests;
  active.add(id);
  const timers = [];
  const stop = () => { active.delete(id); for (const timer of timers) clearTimeout(timer); };
  res.on("close", stop);
  compress(req, res, () => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", url.searchParams.has("no_transform") ? "private, no-store, no-transform" : "no-cache, no-store");
    const stream = new ReadableStream({
      start(controller) {
        const emit = (event) => controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: {}\n\n`));
        if (!url.searchParams.has("sin_latido")) emit("latido");
        if (url.searchParams.has("lento")) {
          if (!url.searchParams.has("sin_latido")) {
            timers.push(setTimeout(() => emit("latido"), 15000));
            timers.push(setTimeout(() => emit("latido"), 30000));
          }
          // Más que el timeout real de cabeceras del proxy (35 segundos).
          timers.push(setTimeout(() => { emit("estado"); controller.close(); }, 37000));
        } else timers.push(setTimeout(() => emit("estado"), 50));
      },
      cancel() { stop(); },
    });
    void pipeToNodeResponse(stream, res).catch(() => res.destroy());
  });
});
await new Promise((yes) => origin.listen(0, "127.0.0.1", yes));
const upstream = origin.address().port;
const proxies = [];
async function startProxy(route, mode) {
  const socket = http.createServer();
  await new Promise((yes) => socket.listen(0, "127.0.0.1", yes));
  const port = socket.address().port;
  await new Promise((yes) => socket.close(yes));
  const proxyRoute = structuredClone(route);
  delete proxyRoute.match;
  walk(proxyRoute, (value) => { if (value.handler === "reverse_proxy") value.upstreams = [{ dial: `127.0.0.1:${upstream}` }]; });
  const configPath = resolve(run, `caddy-${mode}.json`);
  await writeFile(configPath, JSON.stringify({ admin: { disabled: true }, apps: { http: { servers: { ensayo: { listen: [`127.0.0.1:${port}`], automatic_https: { disable: true }, routes: [proxyRoute] } } } } }));
  const name = `cooper-sse-${mode}-${process.pid}`;
  const child = spawn("podman", ["run", "--rm", "--pull=never", "--name", name, "--network=host", "--read-only", "--cap-drop=all", "--security-opt=no-new-privileges", "--tmpfs", "/config", "--tmpfs", "/data", "-v", `${configPath}:/etc/caddy/ensayo.json:ro`, image, "caddy", "run", "--config", "/etc/caddy/ensayo.json"], { env, stdio: "ignore" });
  proxies.push({ name, child });
  for (let attempt = 0; attempt < 40; attempt++) {
    try { const response = await fetch(`http://127.0.0.1:${port}/salud`); if (response.ok) return port; } catch { /* arranque propio */ }
    await wait(100);
  }
  throw new Error(`No inició el proxy ${mode}`);
}
function observe(port, path, untilEvent = "latido") {
  return new Promise((yes, no) => {
    const started = performance.now();
    let firstEventMs = null, headersMs = null;
    const req = http.get({ host: "127.0.0.1", port, path, headers: { "Accept-Encoding": "gzip", Accept: "text/event-stream" } }, (res) => {
      headersMs = Math.round(performance.now() - started);
      const input = res.headers["content-encoding"] === "gzip" ? res.pipe(createGunzip()) : res;
      let content = "";
      const done = () => {
        const receipt = { path, status: res.statusCode, content_encoding: res.headers["content-encoding"] ?? null, headers_ms: headersMs, first_event_ms: firstEventMs, total_ms: Math.round(performance.now() - started) };
        req.destroy();
        yes(receipt);
      };
      input.on("error", no);
      input.on("data", (data) => {
        content += data.toString();
        if (firstEventMs === null && content.includes("event:")) firstEventMs = Math.round(performance.now() - started);
        if (content.includes(`event: ${untilEvent}`)) done();
      });
      input.once("end", done);
    });
    req.on("error", no);
    req.setTimeout(42000, () => req.destroy(new Error("SSE de ensayo agotó el tiempo")));
  });
}
try {
  const oldPort = await startProxy(beforeRoute, "anterior"), newPort = await startProxy(afterRoute, "candidato");
  const [red, green, compressed] = await Promise.all([
    observe(oldPort, "/api/eventos?sin_latido&lento", "estado"),
    observe(newPort, "/api/eventos?lento&no_transform", "estado"),
    observe(oldPort, "/api/eventos"),
  ]);
  assert.equal(red.status, 504);
  assert.ok(red.headers_ms >= 34000 && red.headers_ms < 40000);
  assert.equal(red.first_event_ms, null);
  assert.equal(green.status, 200);
  assert.equal(green.content_encoding, null);
  assert.ok(green.first_event_ms < 1000 && green.total_ms >= 36000);
  assert.equal(compressed.status, 200);
  assert.equal(compressed.content_encoding, "gzip");
  assert.ok(compressed.first_event_ms < 1000, "Next vacía gzip por chunk: la compresión por sí sola no reprodujo el fallo");
  receipts.push({ case: "rojo_sin_primer_byte", ...red }, { case: "verde_latidos_durante_sincronizacion_lenta", ...green }, { case: "gzip_original_sin_bloqueo", ...compressed });
  for (const path of ["/api/eventos", "/api/chat"]) {
    const result = await observe(newPort, path);
    assert.equal(result.status, 200);
    assert.equal(result.content_encoding, null, "El parche impide gzip incluso sin no-transform en el origen");
    receipts.push({ case: "identity_por_ruta", ...result });
    await wait(50);
  }
  const normal = await fetch(`http://127.0.0.1:${newPort}/normal`, { headers: { "Accept-Encoding": "gzip" } });
  assert.equal(normal.headers.get("content-encoding"), "gzip");
  await normal.arrayBuffer();
  const reconnections = [];
  for (let index = 0; index < 6; index++) {
    const result = await observe(newPort, "/api/eventos?no_transform");
    assert.equal(result.status, 200);
    reconnections.push(result.status);
    await wait(100);
  }
  assert.equal(active.size, 0, "Cerrar cliente libera el cupo upstream");
  const report = { at_utc: new Date().toISOString(), caddy_image: image, next_version: require("next/package.json").version, node_version: process.version, scope: "Proxy Caddy real + transporte HTTP/compresión real de Next; origen sintético, loopback, sin sesión ni fábrica real", baseline_sha256: hash(baseline), candidate_sha256: hash(candidate), patch_reverse_exact: true, caddy_adapt_warnings: 0, compose_only_caddy_mount: true, compose_reverse_exact: true, normal_response_keeps_gzip: true, reconnections, active_after_disconnects: active.size, results: receipts };
  await writeFile(resolve(evidence, "ensayo-proxy.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log("PASS rojo 504 a 35s; verde primer latido inmediato y estado tras 37s; gzip no causó bloqueo");
  console.log("PASS identidad solo SSE, gzip habitual, seis reconexiones y liberación del cupo");
} finally {
  for (const { name } of proxies) await command("podman", ["stop", "--time", "0", name]).catch(() => {});
  origin.closeAllConnections();
  await new Promise((yes) => origin.close(yes));
}
