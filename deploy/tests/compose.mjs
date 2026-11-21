// Ensayo local: nombres aleatorios, puertos loopback, red sin salida y secretos efímeros.
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import https from "node:https";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { mkdir, mkdtemp, writeFile, readFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { probarRuntimeMarcas } from "./marcas-runtime.mjs";
import { invocarWebhookRegistrado } from "./esperar-webhook.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const app = resolve(root, "cooper");
const require = createRequire(resolve(app, "package.json"));
const Database = require("better-sqlite3");
const exec = promisify(execFile);
const secret = () => randomBytes(32).toString("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function port() {
  const server = createServer();
  await new Promise((yes) => server.listen(0, "127.0.0.1", yes));
  const number = server.address().port;
  await new Promise((yes) => server.close(yes));
  return number;
}
async function until(check, label, timeout = 90000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await check()) return;
    } catch {
      /* servicio arrancando */
    }
    await sleep(300);
  }
  throw new Error(`Tiempo agotado: ${label}`);
}
await mkdir(resolve(app, ".cache"), { recursive: true });
const run = await mkdtemp(resolve(app, ".cache/e2e-vps-"));
const project = `cooper-vps-${randomBytes(5).toString("hex")}`;
const envFile = resolve(run, "ensayo.env");
const override = resolve(run, "compose.local.json");
const socket = resolve(run, "podman.sock");
const httpsPort = await port(),
  editorPort = await port(),
  httpPort = await port();
const fixturePort = await port();
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  ...(process.env.XDG_RUNTIME_DIR
    ? { XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR }
    : {}),
  DOCKER_HOST: `unix://${socket}`,
  CONTAINER_ENGINE: "podman",
  COOPER_LAB: "1",
  COMPOSE_PROJECT_NAME: project,
  COOPER_IMAGE: process.env.COOPER_VPS_TEST_IMAGE ?? "localhost/cooper:fase5",
  DATA_ROOT: resolve(run, "datos"),
  STATE_ROOT: resolve(run, "operacion"),
  COOPER_DOMAIN: "cooper.test",
  N8N_DOMAIN: "flujos.test",
  CADDY_TLS: "internal",
  COOPER_ORIGIN: `https://cooper.test:${httpsPort}`,
  N8N_EDITOR_ORIGIN: `https://flujos.test:${editorPort}`,
  PUBLIC_BIND: "127.0.0.1",
  HTTP_PORT: String(httpPort),
  HTTPS_PORT: String(httpsPort),
  EDITOR_PORT: String(editorPort),
  AUTH_SECRET: secret(),
  AUTH_GOOGLE_ID: "",
  AUTH_GOOGLE_SECRET: "",
  COOPER_ADMIN_EMAIL: "admin@example.test",
  COOPER_N8N_TOKEN: secret(),
  COOPER_WEBHOOK_SECRET: secret(),
  N8N_ENCRYPTION_KEY: secret(),
  N8N_RUNNERS_AUTH_TOKEN: secret(),
  COOPER_FABRICA: "n8n",
  COOPER_MARCAS: "simulada",
  COOPER_MARCAS_HABILITAR: "0",
  COOPER_MARCAS_WORKER_SECRET: secret(),
  COOPER_COMPOSE_OVERRIDE: override,
  RESTIC_REPOSITORY: resolve(run, "repositorio"),
  RESTIC_PASSWORD_FILE: resolve(run, "restic-password"),
  RESTIC_BIN: resolve(run, "restic"),
};
await writeFile(
  envFile,
  Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n"),
  { mode: 0o600 },
);
await writeFile(env.RESTIC_PASSWORD_FILE, secret(), { mode: 0o600 });
for (const name of ["cooper", "n8n", "caddy-data", "caddy-config"])
  await mkdir(resolve(env.DATA_ROOT, name), { recursive: true, mode: 0o700 });
const localCaddy = resolve(run, "Caddyfile.local");
// La CA local no tiene servidor OCSP. Producción conserva stapling por defecto.
await writeFile(
  localCaddy,
  (await readFile(resolve(root, "deploy/Caddyfile"), "utf8")).replace(
    "{\n",
    "{\n\tocsp_stapling off\n",
  ),
);
await writeFile(
  override,
  JSON.stringify({
    services: Object.fromEntries(
      ["cooper", "n8n", "runner", "caddy"].map((service) => [
        service,
        {
          userns_mode: "keep-id",
          runtime: "runc",
          pull_policy: "never",
          stop_grace_period: "15s",
          ...(service === "caddy"
            ? { volumes: [`${localCaddy}:/etc/caddy/Caddyfile:ro`] }
            : {}),
          ...(["cooper", "n8n"].includes(service)
            ? {
                healthcheck: {
                  start_period: "5s",
                  interval: "3s",
                  retries: 30,
                },
              }
            : {}),
          cpus: 0.5,
          ...(process.env.COOPER_ENSAYO_CPUSET
            ? { cpuset: process.env.COOPER_ENSAYO_CPUSET }
            : {}),
          // Solo loopback mediante Caddy; no se publican backend ni broker.
        },
      ]),
    ),
    networks: { salida: { internal: true } },
  }),
);
async function cmd(bin, args, options = {}) {
  try {
    return (
      await exec(bin, args, {
        env,
        cwd: root,
        maxBuffer: 16 * 1024 * 1024,
        ...options,
      })
    ).stdout.trim();
  } catch (e) {
    // Solo artefacto privado local. No imprimir env, respuestas ni tokens.
    await writeFile(
      resolve(run, "error-comando.log"),
      `${e.stdout ?? ""}\n${e.stderr ?? ""}`,
      { mode: 0o600 },
    );
    throw new Error(
      `${bin} ${args[0]} falló (${e.code}); ver artefacto privado local`,
    );
  }
}
const compose = (...args) =>
  cmd("docker", [
    "compose",
    "--env-file",
    envFile,
    "-f",
    resolve(root, "deploy/compose.yaml"),
    "-f",
    override,
    ...args,
  ]);
const operate = (...args) =>
  cmd("python3", [
    resolve(root, "deploy/operar.py"),
    "--env",
    envFile,
    ...args,
  ]);
let fixture, ca;
const socketProcess = spawn(
  "podman",
  ["--runtime", "runc", "system", "service", "--time=0", `unix://${socket}`],
  { env, stdio: "ignore" },
);
const requests = new Set();
function request(
  host,
  path,
  { method = "GET", body, headers = {}, editor = false, sse = false } = {},
) {
  return new Promise((yes, no) => {
    const req = https.request(
      {
        hostname: host,
        port: editor ? editorPort : httpsPort,
        path,
        method,
        ca,
        lookup: (_hostname, _options, cb) =>
          cb(null, [{ address: "127.0.0.1", family: 4 }]),
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
      },
      (res) => {
        let text = "";
        if (sse) {
          yes({ res, req });
          return;
        }
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () =>
          yes({ status: res.statusCode, headers: res.headers, text }),
        );
      },
    );
    requests.add(req);
    req.on("close", () => requests.delete(req));
    req.on("error", no);
    req.setTimeout(30000, () => req.destroy(new Error("timeout HTTPS")));
    req.end(
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
    );
  });
}
try {
  await until(async () => {
    await access(socket);
    return true;
  }, "socket privado");
  await compose("config", "--quiet");
  await compose("up", "-d", "--no-build", "--wait", "--wait-timeout", "180");
  await compose(
    "exec",
    "-T",
    "cooper",
    "node",
    "-e",
    "const fs=require('node:fs');process.exit(process.getuid()===0||fs.existsSync('/app/scripts')||fs.readdirSync('/app').some(n=>n.startsWith('.env'))?1:0)",
  );
  for (const network of ["backend", "salida"])
    assert.equal(
      await cmd("podman", [
        "network",
        "inspect",
        "--format",
        "{{.Internal}}",
        `${project}_${network}`,
      ]),
      "true",
    );
  await until(async () => {
    ca = await readFile(
      resolve(env.DATA_ROOT, "caddy-data/caddy/pki/authorities/local/root.crt"),
    );
    return true;
  }, "CA local");
  assert.equal((await request("cooper.test", "/api/salud")).status, 200);
  assert.equal(
    (await request("flujos.test", "/healthz/readiness", { editor: true }))
      .status,
    200,
  );
  for (const path of [
    "/",
    "/rest/settings",
    "/api/v1/workflows",
    "/webhook/cooper/v1",
  ])
    assert.equal((await request("flujos.test", path)).status, 404);
  const entry = await request("cooper.test", "/entrar");
  assert.equal(entry.status, 200);
  assert.match(entry.headers["content-security-policy"], /nonce-/);
  assert.equal(entry.headers["x-content-type-options"], "nosniff");
  assert.equal(entry.headers["server"], undefined);
  assert.equal((await request("cooper.test", "/api/estado")).status, 401);
  assert.equal(
    (
      await request("cooper.test", "/api/test/login", {
        method: "POST",
        body: {},
      })
    ).status,
    401,
  );
  console.log("PASS salud, TLS verificado, cabeceras y editor privado");

  // Reutiliza el emisor E2E existente, nunca empaquetado en la imagen.
  const fixtureSecret = secret();
  fixture = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/e2e-fixtures.ts"],
    {
      cwd: app,
      env: {
        ...env,
        AUTH_URL: env.COOPER_ORIGIN,
        COOPER_E2E_SECRET: fixtureSecret,
        COOPER_DATABASE_PATH: resolve(env.DATA_ROOT, "cooper/cooper.sqlite"),
        COOPER_E2E_FIXTURE_PORT: String(fixturePort),
      },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    },
  );
  await new Promise((yes, no) => {
    fixture.once("message", yes);
    fixture.once("exit", () => no(new Error("Emisor E2E falló")));
  });
  const session = await fetch(`http://127.0.0.1:${fixturePort}/sesion`, {
    method: "POST",
    body: JSON.stringify({
      secret: fixtureSecret,
      email: env.COOPER_ADMIN_EMAIL,
    }),
  });
  assert.equal(session.status, 200);
  const cookie = session.headers.get("set-cookie").split(";")[0];
  assert.match(cookie, /^__Secure-authjs.session-token=/);
  assert.equal(
    (await request("cooper.test", "/", { headers: { Cookie: cookie } })).status,
    200,
  );
  const db = new Database(resolve(env.DATA_ROOT, "cooper/cooper.sqlite"));
  const owner = db
    .prepare("SELECT id FROM users WHERE email=?")
    .get(env.COOPER_ADMIN_EMAIL).id;
  db.prepare(
    "INSERT INTO channels(id,owner_id,name,niche,created_at) VALUES(?,?,?,?,?)",
  ).run("canal-vps", owner, "Ensayo", "Ciencia", Date.now());
  db.prepare(
    "INSERT INTO videos(id,owner_id,channel_id,title,script,updated_at,created_at) VALUES(?,?,?,?,?,?,?)",
  ).run(
    "video-vps",
    owner,
    "canal-vps",
    "Ensayo VPS",
    "",
    Date.now(),
    Date.now(),
  );
  db.prepare(
    "INSERT INTO attachments(id,owner_id,name,mime,size,data) VALUES(?,?,?,?,?,?)",
  ).run(
    "adjunto-vps",
    owner,
    "prueba.txt",
    "text/plain",
    6,
    Buffer.from("prueba").toString("base64"),
  );
  db.close();
  console.log(
    "PASS login ficticio con cookie Auth.js Secure y datos de ensayo",
  );
  await probarRuntimeMarcas({ compose, request, cookie, env, run, Database, until });
  assert.doesNotMatch(await compose("logs", "--no-color", "cooper"), /Fontconfig (?:error|warning):/i);

  // Inicialización de n8n nuevo; endpoints cotejados contra código oficial 2.47.6.
  let n8nCookie;
  async function rest(path, body) {
    const res = await request("flujos.test", `/rest${path}`, {
      editor: true,
      method: body === undefined ? "GET" : "POST",
      body,
      headers: n8nCookie ? { Cookie: n8nCookie } : {},
    });
    assert.equal(res.status, 200, `REST de ensayo ${path}`);
    if (res.headers["set-cookie"])
      n8nCookie = res.headers["set-cookie"]
        .map((c) => c.split(";")[0])
        .join("; ");
    return JSON.parse(res.text).data;
  }
  await rest("/owner/setup", {
    email: "owner@example.test",
    firstName: "Ensayo",
    lastName: "VPS",
    password: `Aa1!${secret().slice(0, 40)}`,
  });
  const scopes = (await rest("/api-keys/scopes")).filter((s) =>
    s.startsWith("workflow:"),
  );
  const key = (
    await rest("/api-keys", {
      label: "Ensayo VPS efímero",
      scopes,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    })
  ).rawApiKey;
  async function api(method, path, body) {
    const res = await request("flujos.test", `/api/v1${path}`, {
      editor: true,
      method,
      body,
      headers: { "X-N8N-API-KEY": key },
    });
    assert.ok(
      res.status >= 200 && res.status < 300,
      `API ${path}: ${res.status}`,
    );
    return JSON.parse(res.text);
  }
  const realProgress = JSON.parse(
    await readFile(resolve(root, "workflows/v2/FabCooperProgr01.json"), "utf8"),
  );
  // Conservar el grafo real, incluidos los intentos y backoff del callback.
  // Solo el disparador interno se sustituye por el ingreso HTTP sintético.
  const signedNodes = realProgress.nodes.filter((n) => n.name !== "Inicio");
  const workflow = await api("POST", "/workflows", {
    name: "Ensayo VPS firma real",
    settings: {
      executionOrder: "v1",
      saveDataSuccessExecution: "none",
      saveDataErrorExecution: "none",
    },
    nodes: [
      {
        id: randomUUID(),
        name: "Entrada",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [0, 0],
        webhookId: randomUUID(),
        parameters: {
          path: "ensayo-vps",
          httpMethod: "POST",
          responseMode: "lastNode",
        },
      },
      {
        id: randomUUID(),
        name: "Inicio",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [200, 0],
        parameters: { jsCode: "if($env.COOPER_MARCAS_HABILITAR!=='0'||!$env.COOPER_MARCAS_URL?.startsWith('https://')||($env.COOPER_MARCAS_WORKER_SECRET||'').length<32)throw new Error('Entorno de Marcas no propagado al runner');return [{json:$input.first().json.body}];" },
      },
      ...signedNodes,
    ],
    connections: {
      ...realProgress.connections,
      Entrada: { main: [[{ node: "Inicio", type: "main", index: 0 }]] },
    },
  });
  await api("POST", `/workflows/${workflow.id}/activate`, {});
  const stream = await request("cooper.test", "/api/eventos", {
    headers: { Cookie: cookie },
    sse: true,
  });
  assert.equal(stream.res.statusCode, 200);
  assert.match(stream.res.headers["content-type"], /text\/event-stream/);
  let events = "";
  stream.res.on("data", (chunk) => {
    events += chunk;
  });
  await until(() => events.includes("event: estado"), "SSE inicial", 10000);
  const event = {
    video_id: "video-vps",
    canal_id: "canal-vps",
    dueno_email: env.COOPER_ADMIN_EMAIL,
    tema: "Ensayo VPS",
    etapa: "aprobacion_guion",
    guion_cooper: "Guion de ensayo",
    cooper_evento_id: "evento-vps-1",
    cooper_actualizado_en: Date.now(),
    updatedAt: new Date().toISOString(),
  };
  const { response: trigger, intentos } = await invocarWebhookRegistrado(
    () => request("flujos.test", "/webhook/ensayo-vps", { method: "POST", body: event }),
    () => {
      const journal = new Database(resolve(env.DATA_ROOT, "n8n/database.sqlite"), { readonly: true });
      try { return journal.prepare("SELECT count(*) AS total FROM execution_entity WHERE workflowId=?").get(workflow.id).total; }
      finally { journal.close(); }
    },
  );
  await writeFile(resolve(run, "registro-webhook.json"), JSON.stringify({ intentos, estado: trigger.status }), { mode: 0o600 });
  assert.equal(trigger.status, 200);
  await until(
    () => events.includes("event: progreso") && events.includes("video-vps"),
    "progreso firmado vía runner externo",
    10000,
  );
  stream.req.destroy();
  const payload = JSON.stringify({
    version: "cooper-v1",
    tipo: "progreso",
    id_evento: "firma-incorrecta",
    video: {
      id: "video-vps",
      canal_id: "canal-vps",
      dueno_email: env.COOPER_ADMIN_EMAIL,
      titulo: "Ensayo",
      stage: 7,
      script: "",
      actualizado_en: Date.now(),
    },
  });
  const timestamp = String(Date.now());
  assert.equal(
    (
      await request("cooper.test", "/api/n8n/webhook", {
        method: "POST",
        body: payload,
        headers: {
          "x-cooper-timestamp": timestamp,
          "x-cooper-signature": `sha256=${createHmac("sha256", secret()).update(`${timestamp}.${payload}`).digest("hex")}`,
        },
      })
    ).status,
    401,
  );
  console.log(
    "PASS runner externo 2.47.6, firma real n8n→Cooper, SSE sin buffering y rechazo de firma inválida",
  );
  // Cerrar pestañas debe liberar el límite de cuatro SSE del backend.
  for (let index = 0; index < 5; index++) {
    const reconnect = await request("cooper.test", "/api/eventos", {
      headers: { Cookie: cookie },
      sse: true,
    });
    assert.equal(
      reconnect.res.statusCode,
      200,
      "SSE libera su cupo tras desconectar",
    );
    reconnect.req.destroy();
    await sleep(200);
  }
  console.log("PASS desconexión y cinco reconexiones SSE sin agotar cupos");

  // Restic estático de imagen oficial; no instala software en el host.
  const resticContainer = `${project}-restic`;
  await cmd("podman", [
    "create",
    "--name",
    resticContainer,
    "docker.io/restic/restic:0.20.0",
  ]);
  try {
    await cmd("podman", [
      "cp",
      `${resticContainer}:/usr/bin/restic`,
      env.RESTIC_BIN,
    ]);
  } finally {
    await cmd("podman", ["rm", resticContainer]);
  }
  fixture.kill("SIGTERM");
  await new Promise((yes) => fixture.once("exit", yes));
  fixture = undefined;
  const beforeBackup = new Database(resolve(env.DATA_ROOT, "cooper/cooper.sqlite"), { readonly: true });
  const attachmentsBeforeBackup = beforeBackup.prepare("SELECT count(*) n FROM attachments").get().n;
  beforeBackup.close();
  await operate("iniciar-repositorio");
  await operate("copia");
  const backup = JSON.parse(
    await readFile(resolve(env.STATE_ROOT, "ultima-copia.json"), "utf8"),
  );
  const wrongPassword = resolve(run, "restic-password-incorrecta");
  await writeFile(wrongPassword, secret(), { mode: 0o600 });
  await assert.rejects(
    exec(env.RESTIC_BIN, ["--no-cache", "snapshots", "--json"], {
      env: { ...env, RESTIC_PASSWORD_FILE: wrongPassword },
    }),
    (error) => error.code !== 0,
  );
  await operate(
    "restaurar-prueba",
    backup.snapshot,
    resolve(run, "restauracion"),
  );
  const restored = new Database(
    resolve(run, "restauracion/datos/cooper/cooper.sqlite"),
    { readonly: true },
  );
  assert.equal(
    restored.prepare("SELECT stage FROM videos WHERE id=?").get("video-vps")
      .stage,
    3,
  );
  assert.equal(
    restored.prepare("SELECT count(*) n FROM attachments").get().n,
    attachmentsBeforeBackup,
    "La restauración conserva todos los adjuntos, incluidos los medios sintéticos de Marcas",
  );
  restored.close();
  await until(
    async () => (await request("cooper.test", "/api/salud")).status === 200,
    "reinicio tras copia",
  );
  console.log(
    "PASS restic cifrado, retención, restauración, conteos y hashes; reinicio saludable",
  );
  // Corte PC→VPS simulado: exportación offline, destino vacío y mismo repo cifrado.
  await compose("down", "--timeout", "30");
  await operate("exportar", "--origen", env.DATA_ROOT, "--origen-detenido");
  const migration = JSON.parse(
    await readFile(resolve(env.STATE_ROOT, "ultima-copia.json"), "utf8"),
  );
  env.DATA_ROOT = resolve(run, "datos-importados");
  await writeFile(
    envFile,
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
    { mode: 0o600 },
  );
  await operate("importar", migration.snapshot);
  await compose("up", "-d", "--no-build", "--wait", "--wait-timeout", "180");
  await until(
    async () => (await request("cooper.test", "/api/salud")).status === 200,
    "restauración arrancada",
  );
  assert.equal(
    (await request("cooper.test", "/", { headers: { Cookie: cookie } })).status,
    200,
  );
  assert.equal(
    (await request("flujos.test", "/healthz/readiness", { editor: true }))
      .status,
    200,
  );
  console.log(
    "PASS exportación PC, importación en volumen vacío y arranque de datos restaurados",
  );

  // Misma imagen aprobada con etiqueta inmutable local: ejercita el corte y la reversión de datos.
  const revision = await cmd("git", ["rev-parse", "HEAD"]);
  const imageTag = `localhost/cooper:${revision}`;
  await cmd("podman", ["tag", env.COOPER_IMAGE, imageTag]);
  const currentId = await compose("ps", "-q", "cooper");
  assert.match(currentId, /^[a-f0-9]+$/, "ID de contenedor para actualización");
  await cmd("podman", ["inspect", "--format", "{{.Image}}", currentId]);
  await operate("actualizar", imageTag);
  const changed = new Database(resolve(env.DATA_ROOT, "cooper/cooper.sqlite"));
  changed.prepare("UPDATE videos SET stage=5 WHERE id='video-vps'").run();
  changed.close();
  await operate("revertir");
  const reverted = new Database(
    resolve(env.DATA_ROOT, "cooper/cooper.sqlite"),
    { readonly: true },
  );
  assert.equal(
    reverted.prepare("SELECT stage FROM videos WHERE id='video-vps'").get()
      .stage,
    3,
  );
  reverted.close();
  await until(
    async () => (await request("cooper.test", "/api/salud")).status === 200,
    "salud tras reversión",
  );
  console.log(
    "PASS actualización y reversión conjunta de imagen/datos conservando estado anterior",
  );
  console.log(`Evidencia local: ${run}`);
} catch (error) {
  await writeFile(
    resolve(run, "servicios.log"),
    await compose("logs", "--no-color"),
    { mode: 0o600 },
  );
  console.error(`Diagnóstico privado: ${run}`);
  throw error;
} finally {
  for (const req of requests) req.destroy();
  fixture?.kill("SIGTERM");
  // Solo recursos del proyecto aleatorio de esta ejecución; nunca volúmenes ajenos.
  try {
    await compose("down", "--timeout", "30");
    const created = await cmd("podman", [
      "ps",
      "-a",
      "--filter",
      `label=com.docker.compose.project=${project}`,
      "--format",
      "{{.ID}}",
    ]);
    if (created) await cmd("podman", ["rm", "--force", ...created.split("\n")]);
  } finally {
    socketProcess.kill("SIGTERM");
  }
}
