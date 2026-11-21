import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { createInterface } from "node:readline";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { N8nApi } from "../../tools/cooper/n8n-api.mjs";

export const ADMIN = "wdhg.xoxa@gmail.com";
export const OTHER = "ana@example.test";
export const CONTAINER = "cooper-ensayo-n8n";
const n8n = JSON.parse(
  readFileSync(
    new URL("../../deploy/infra-imagenes.json", import.meta.url),
    "utf8",
  ),
).servicios.n8n;
const imagenes = [n8n.imagen, n8n.anterior];
const referencia =
  /^ghcr\.io\/n8n-io\/n8n:(\d+\.\d+\.\d+)@sha256:[a-f0-9]{64}$/;
if (
  imagenes.some(
    (imagen) => typeof imagen !== "string" || !referencia.test(imagen),
  )
)
  throw new Error("El ensayo requiere imágenes oficiales fijadas por digest");
export const N8N_IMAGE = process.env.COOPER_ENSAYO_N8N_IMAGEN ?? n8n.imagen;
if (!imagenes.includes(N8N_IMAGE))
  throw new Error(
    "La imagen de ensayo debe ser la candidata o la anterior del manifiesto",
  );
export const N8N_VERSION = referencia.exec(N8N_IMAGE)[1];
if (referencia.exec(n8n.imagen)[1] !== n8n.version)
  throw new Error("La versión candidata no coincide con su referencia");
export const secret = () => randomBytes(32).toString("hex");
export const podman = (...args) =>
  execFileSync("podman", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
export async function freePort() {
  const server = createServer();
  await new Promise((yes, no) => {
    server.once("error", no);
    server.listen(0, "127.0.0.1", yes);
  });
  const port = server.address().port;
  await new Promise((yes) => server.close(yes));
  return port;
}
export async function until(check, label, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const result = await check();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Tiempo agotado: ${label}`);
}
export async function startN8n(appPort, options = {}) {
  const { credencialFicticia = false } = options;
  const CONTAINER = options.container || "cooper-ensayo-n8n";
  const networkName = options.network || "cooper-ensayo-red";
  const root = resolve(homedir(), options.root || ".cache/cooper-ensayo");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const run = mkdtempSync(`${root}/run-`);
  mkdirSync(`${run}/n8n`, { mode: 0o700 });
  const port = await freePort();
  const env = {
    N8N_SECURE_COOKIE: "false",
    N8N_DIAGNOSTICS_ENABLED: "false",
    N8N_VERSION_NOTIFICATIONS_ENABLED: "false",
    N8N_TEMPLATES_ENABLED: "false",
    N8N_DISABLED_MODULES: "mcp-registry",
    N8N_PERSONALIZATION_ENABLED: "false",
    N8N_RUNNERS_MODE: "internal",
    NODE_FUNCTION_ALLOW_BUILTIN: "crypto",
    N8N_BLOCK_ENV_ACCESS_IN_NODE: "false",
    N8N_ENCRYPTION_KEY: secret(),
    N8N_LOG_LEVEL: "error",
    COOPER_N8N_TOKEN: secret(),
    COOPER_WEBHOOK_SECRET: secret(),
    COOPER_ADMIN_EMAIL: ADMIN,
    COOPER_WEBHOOK_URL: "http://127.0.0.1:8889/api/n8n/webhook",
  };
  const envPath = `${run}/ensayo.env`;
  writeFileSync(
    envPath,
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
    { mode: 0o600 },
  );
  const existing = podman(
    "ps",
    "-a",
    "--filter",
    `name=^${CONTAINER}$`,
    "--format",
    "{{.Names}}",
  );
  if (existing) {
    const info = JSON.parse(
      podman("inspect", "--format", "{{json .Config.Labels}}", CONTAINER),
    );
    if (
      info["cooper.ensayo"] !== "true" ||
      podman("inspect", "--format", "{{.State.Running}}", CONTAINER) !== "false"
    )
      throw new Error(
        "El nombre de ensayo está ocupado; no se modifica un contenedor ajeno/en ejecución",
      );
    podman("rename", CONTAINER, `${CONTAINER}-${Date.now()}`);
  }
  if (
    !podman(
      "network",
      "ls",
      "--filter",
      `name=^${networkName}$`,
      "--format",
      "{{.Name}}",
    )
  )
    podman("network", "create", "--internal", networkName);
  const network = JSON.parse(podman("network", "inspect", networkName))[0];
  if (!network.internal)
    throw new Error("La red de ensayo debe impedir salida externa");
  podman(
    "run",
    "-d",
    "--name",
    CONTAINER,
    "--label",
    "cooper.ensayo=true",
    "--network",
    networkName,
    "--cpus",
    "0.5",
    "--pull",
    "never",
    "-p",
    `127.0.0.1:${port}:5678`,
    "-v",
    `${run}/n8n:/home/node/.n8n:U,Z`,
    "--env-file",
    envPath,
    N8N_IMAGE,
  );
  try {
    const url = `http://127.0.0.1:${port}`;
    writeFileSync(
      `${root}/actual.json`,
      JSON.stringify(
        { run, port, appPort, container: CONTAINER, image: N8N_IMAGE },
        null,
        2,
      ),
    );
    await until(
      async () => {
        try {
          return (await fetch(`${url}/healthz/readiness`)).ok;
        } catch {
          return false;
        }
      },
      "n8n listo",
      60000,
    );
    if (podman("exec", CONTAINER, "n8n", "--version") !== N8N_VERSION)
      throw new Error("Versión de n8n inesperada");
    podman(
      "exec",
      CONTAINER,
      "node",
      "-e",
      "fetch('https://example.com',{signal:AbortSignal.timeout(2000)}).then(()=>process.exit(1),()=>process.exit(0))",
    );
    let cookie;
    const rest = async (path, body) => {
      const res = await fetch(`${url}/rest${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error",
      });
      if (!res.ok) throw new Error(`REST local ${path}: HTTP ${res.status}`);
      cookie =
        res.headers
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; ") || cookie;
      const encoded = await res.text();
      try {
        return JSON.parse(encoded).data;
      } catch {
        throw new Error(
          `REST local ${path}: respuesta no JSON (${res.headers.get("content-type")})`,
        );
      }
    };
    await rest("/owner/setup", {
      email: "owner@example.test",
      firstName: "Ensayo",
      lastName: "Local",
      password: `Aa1!${secret().slice(0, 40)}`,
    });
    const scopes = (await rest("/api-keys/scopes")).filter(
      (s) =>
        /^(dataTable|workflow|execution)/.test(s) ||
        (credencialFicticia && s === "credential:create"),
    );
    const key = (
      await rest("/api-keys", {
        label: "Ensayo aislado",
        scopes,
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
      })
    ).rawApiKey;
    return {
      api: new N8nApi(url, key),
      url,
      env,
      run,
      key,
      version: N8N_VERSION,
    };
  } catch (error) {
    podman("stop", CONTAINER);
    throw error;
  }
}

// Puente por stdin/stdout: el contenedor sigue sin ruta a Internet ni al host.
// Solo reenvía el receptor HMAC; no abre un proxy general ni imprime los bytes.
export function callbackRelay(appURL) {
  const code = `
const http=require('node:http'), readline=require('node:readline');
const pending=new Map();let id=0;
readline.createInterface({input:process.stdin}).on('line',line=>{const a=JSON.parse(line),res=pending.get(a.id);if(res){pending.delete(a.id);res.writeHead(a.status,{'Content-Type':'application/json'});res.end(a.body);}});
http.createServer(async(req,res)=>{if(req.method!=='POST'||req.url!=='/api/n8n/webhook'){res.writeHead(404);res.end();return;}let body='';for await(const c of req){body+=c;if(body.length>131072){res.writeHead(413);res.end();return;}}const n=++id;pending.set(n,res);process.stdout.write(JSON.stringify({id:n,body,headers:req.headers})+'\\n');}).listen(8889,'127.0.0.1',()=>process.stdout.write('{"ready":true}\\n'));
`;
  const child = spawn("podman", ["exec", "-i", CONTAINER, "node", "-e", code], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const state = {
    child,
    deliveries: [],
    failProgress: 0,
    failConfirm: false,
    failures: 0,
  };
  state.ready = new Promise((resolveReady) => {
    createInterface({ input: child.stdout }).on("line", async (line) => {
      const input = JSON.parse(line);
      if (input.ready) {
        resolveReady();
        return;
      }
      const payload = JSON.parse(input.body);
      state.deliveries.push({ payload, body: input.body });
      let status = 503,
        body = '{"error":"fallo inducido de ensayo"}';
      const fail =
        (payload.tipo === "progreso" && state.failProgress-- > 0) ||
        (payload.tipo === "orden" &&
          payload.fase === "confirmar" &&
          state.failConfirm);
      if (fail) state.failures++;
      else {
        try {
          const response = await fetch(`${appURL}/api/n8n/webhook`, {
            method: "POST",
            body: input.body,
            headers: {
              "Content-Type": "application/json",
              "x-cooper-timestamp": input.headers["x-cooper-timestamp"],
              "x-cooper-signature": input.headers["x-cooper-signature"],
            },
            signal: AbortSignal.timeout(15000),
          });
          status = response.status;
          body = await response.text();
        } catch {
          /* Un transporte caído se conserva como 503 para probar la recuperación. */
        }
      }
      if (!child.stdin.destroyed)
        child.stdin.write(
          JSON.stringify({ id: input.id, status, body }) + "\n",
        );
    });
  });
  return state;
}
export function startProcess(args, env, logPath, ipc = false) {
  const child = spawn(process.execPath, args, {
    env,
    stdio: ["ignore", "pipe", "pipe", ...(ipc ? ["ipc"] : [])],
  });
  const chunks = [];
  child.stdout.on("data", (chunk) => chunks.push(chunk));
  child.stderr.on("data", (chunk) => chunks.push(chunk));
  child.on("exit", () => writeFileSync(logPath, Buffer.concat(chunks)));
  return child;
}
export async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((r) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 8000);
    child.once("exit", () => {
      clearTimeout(timer);
      r();
    });
  });
}
export function cleanEnv() {
  // Lista permitida: no heredar tokens de proveedores ni cargar archivos .env.
  return Object.fromEntries(
    ["PATH", "HOME", "LANG", "TZ", "TMPDIR"]
      .filter((key) => process.env[key])
      .map((key) => [key, process.env[key]]),
  );
}
export function assertNoEnvFiles() {
  for (const name of [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
  ])
    if (existsSync(name))
      throw new Error(
        "Ejecutar ensayo en un worktree sin archivos .env reales",
      );
}
