import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, chmod, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ChatClaudeCli,
  ChatCodexLocal,
  ejecutarClaude,
  promptLocal,
  validarSalidaLocal,
} from "@/servicios/chat/locales";
import { proveedorChat } from "@/servicios/chat/seleccion";
import { ChatClaude, ChatOpenAI } from "@/servicios/chat/proveedores";
import { ChatSimulado } from "@/servicios/chat/simulado";
import type {
  EntradaModelo,
  EventoProveedor,
  ProveedorChat,
} from "@/servicios/chat/tipos";
import { ColaChat } from "@/servicios/chat/cola";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { allowedEmails, users, channels } from "@/db/schema";
import { responderChat, estadoChat, confirmarChat } from "@/servicios/chat";

const entrada: EntradaModelo = {
  sistema: "Solo el estudio",
  herramientas: [
    { nombre: "estado", descripcion: "Estado propio", parametros: {} },
  ],
  mensajes: [{ role: "user", texto: "¿Cuál es el estado? $(nunca) `nunca`" }],
};
let fixture: string, bin: string;
beforeAll(async () => {
  fixture = await mkdtemp(join(tmpdir(), "cooper-cli-falso-"));
  bin = join(fixture, "claude");
  const script = `#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const a = process.argv.slice(2);
assert.deepEqual(fs.readdirSync(process.cwd()), []);
assert.equal(fs.statSync(process.cwd()).mode & 0o777, 0o700);
for (const k of ['ANTHROPIC_API_KEY','OPENAI_API_KEY','PUENTE_CODEX_TOKEN','AUTH_SECRET','CLAUDE_CODE_OAUTH_TOKEN','NODE_OPTIONS']) assert.equal(process.env[k], undefined);
for (const flag of ['--safe-mode','--restricted','--setting-sources','--settings']) assert(a.includes(flag));
if (a.includes('status')) { console.log(JSON.stringify({loggedIn: !__filename.endsWith('sin-sesion'),authMethod:'claude.ai'})); process.exit(0); }
for (const flag of ['-p','--output-format','--json-schema','--tools','--strict-mcp-config','--mcp-config','--disable-slash-commands','--no-chrome','--no-session-persistence','--permission-mode']) assert(a.includes(flag));
assert.equal(a[a.indexOf('--tools')+1], '');
assert.equal(a[a.indexOf('--permission-mode')+1], 'dontAsk');
assert.deepEqual(JSON.parse(a[a.indexOf('--mcp-config')+1]),{mcpServers:{}});
assert.equal(JSON.parse(a[a.indexOf('--settings')+1]).disableAllHooks,true);
assert.equal(JSON.parse(a[a.indexOf('--json-schema')+1]).$schema,'http://json-schema.org/draft-07/schema#');
let text='';process.stdin.on('data',c=>text+=c);process.stdin.on('end',()=>{
 const last = JSON.parse(text).mensajes.at(-1).texto;
 if (last==='COLGAR') { setInterval(()=>{},1000);return; }
 if (last==='EXCESO') { process.stdout.write('a'.repeat(2*1024*1024));return; }
 if (last==='FALLAR') { process.stderr.write('CLAVE_FICTICIA_NO_MOSTRAR');process.exit(1); }
 if (last==='INVALIDO') { console.log('inválido');return; }
 const value = last.startsWith('SALIDA:') ? JSON.parse(last.slice(7)) : {texto:JSON.parse(text).mensajes.at(-1).resultados?'Solicitud revisada.':process.cwd(),llamadas:[]};
 console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,structured_output:value}));
});
`;
  for (const name of ["claude", "sin-sesion"]) {
    const path = join(fixture, name);
    await writeFile(path, script);
    await chmod(path, 0o700);
  }
});
afterAll(async () => {
  await rm(fixture, { recursive: true, force: true });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function reunir(
  p: ProveedorChat,
  e = entrada,
  signal = AbortSignal.timeout(5000),
) {
  const events: EventoProveedor[] = [];
  for await (const event of p.generar(e, signal)) events.push(event);
  return events;
}
function conTexto(texto: string) {
  return { ...entrada, mensajes: [{ role: "user" as const, texto }] };
}
function conSalida(value: unknown) {
  return conTexto("SALIDA:" + JSON.stringify(value));
}

it("Claude aislado: stdin literal, cwd vacío privado, sin herramientas/claves y limpieza", async () => {
  const events = await reunir(
    new ChatClaudeCli({
      bin,
      env: {
        PATH: process.env.PATH,
        ANTHROPIC_API_KEY: "ficticia",
        AUTH_SECRET: "ficticia",
        CLAUDE_CODE_OAUTH_TOKEN: "ficticia",
        NODE_OPTIONS: "no-heredar",
      },
    }),
  );
  const first = events[0];
  expect(first.tipo).toBe("texto");
  if (first.tipo !== "texto") throw new Error("Falta texto");
  expect(first.texto).toContain("cooper-claude-");
  await expect(stat(first.texto)).rejects.toThrow();
});
it("requiere sesión de suscripción, detecta CLI ausente y no filtra errores privados", async () => {
  await expect(
    reunir(new ChatClaudeCli({ bin: join(fixture, "sin-sesion") })),
  ).rejects.toThrow("Cooper no pudo");
  await expect(
    reunir(new ChatClaudeCli({ bin: join(fixture, "ausente") })),
  ).rejects.toThrow("Cooper no pudo");
  for (const texto of ["FALLAR", "INVALIDO", "EXCESO"])
    await expect(
      reunir(new ChatClaudeCli({ bin }), conTexto(texto)),
    ).rejects.toThrow("Cooper no pudo");
});
it("mata el CLI al agotar tiempo o cancelar", async () => {
  await expect(
    reunir(new ChatClaudeCli({ bin, timeoutMs: 80 }), conTexto("COLGAR")),
  ).rejects.toThrow("tardó demasiado");
  const control = new AbortController();
  const job = reunir(
    new ChatClaudeCli({ bin }),
    conTexto("COLGAR"),
    control.signal,
  );
  setTimeout(() => control.abort(), 100);
  await expect(job).rejects.toThrow("tardó demasiado");
  const aborted = AbortSignal.abort();
  await expect(ejecutarClaude([], "", aborted, { bin })).rejects.toThrow();
});
it("valida el sobre entero antes de emitir texto o propuestas; no acepta herramientas del sistema", async () => {
  const result = await reunir(
    new ChatClaudeCli({ bin }),
    conSalida({
      texto: "",
      llamadas: [{ nombre: "estado", argumentos: "{}" }],
    }),
  );
  expect(result).toEqual([
    {
      tipo: "fin",
      mensaje: {
        role: "assistant",
        texto: "",
        llamadas: [
          { id: expect.any(String), nombre: "estado", argumentos: {} },
        ],
      },
    },
  ]);
  for (const raw of [
    { texto: "Bien", llamadas: [{ nombre: "Bash", argumentos: "{}" }] },
    { texto: "Bien", llamadas: [{ nombre: "estado", argumentos: "no json" }] },
    { texto: "Bien", llamadas: [{ nombre: "estado", argumentos: "[]" }] },
    { texto: "Bien", llamadas: [], comando: "pwd" },
    { texto: "", llamadas: [] },
    {
      texto: "Bien",
      llamadas: Array(5).fill({ nombre: "estado", argumentos: "{}" }),
    },
  ])
    await expect(
      reunir(new ChatClaudeCli({ bin }), conSalida(raw)),
    ).rejects.toThrow();
});
it("omite bytes de imágenes y bloques nativos; acota el contexto y conserva resultados", () => {
  const prompt = promptLocal({
    ...entrada,
    mensajes: [
      {
        role: "user",
        texto: "Foto",
        imagenes: [{ mime: "image/png", data: "BYTES_PRIVADOS" }],
        resultados: [{ id: "t", texto: "Estado" }],
      },
    ],
  });
  expect(prompt).not.toContain("BYTES_PRIVADOS");
  expect(prompt).toContain("no disponibles");
  expect(prompt).toContain('"resultados"');
  expect(() => promptLocal(conTexto("x".repeat(60001)))).toThrow(
    "demasiado larga",
  );
});
it("Codex usa el puente loopback autenticado, sin redirecciones ni metadatos", async () => {
  vi.stubEnv("PUENTE_CODEX_TOKEN", "t".repeat(32));
  vi.stubEnv("PUENTE_CODEX_URL", "http://127.0.0.1:8789");
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ texto: "Estado correcto.", llamadas: [] }),
    );
  const events = await reunir(new ChatCodexLocal(fetcher));
  expect(events[0]).toEqual({ tipo: "texto", texto: "Estado correcto." });
  const [url, init] = fetcher.mock.calls[0];
  expect(String(url)).toBe("http://127.0.0.1:8789/v1/chat");
  expect(init).toMatchObject({
    redirect: "error",
    method: "POST",
    cache: "no-store",
  });
  expect(new Headers(init?.headers).get("authorization")).toBe(
    "Bearer " + "t".repeat(32),
  );
  expect(JSON.parse(String(init?.body))).toEqual({
    prompt: promptLocal(entrada),
  });
  for (const url of [
    "https://127.0.0.1:8789",
    "http://localhost:8789",
    "http://externo.test",
    "http://127.0.0.1:8789/otra",
    "http://usuario@127.0.0.1:8789",
  ]) {
    vi.stubEnv("PUENTE_CODEX_URL", url);
    await expect(reunir(new ChatCodexLocal(fetcher))).rejects.toThrow();
  }
  expect(fetcher).toHaveBeenCalledOnce();
});
it("Codex rechaza exceso, timeout, estado HTTP y JSON no válido antes de emitir", async () => {
  vi.stubEnv("PUENTE_CODEX_TOKEN", "t".repeat(32));
  for (const response of [
    new Response("privado", { status: 429 }),
    new Response("privado", { status: 504 }),
    new Response("x".repeat(140000)),
    Response.json({
      texto: "hola",
      llamadas: [{ nombre: "estado", argumentos: "null" }],
    }),
  ]) {
    await expect(
      reunir(
        new ChatCodexLocal(vi.fn<typeof fetch>().mockResolvedValue(response)),
      ),
    ).rejects.toThrow();
  }
});
it("selecciona Claude CLI → Codex → APIs con clave → básico, fija respaldo y respeta cancelación", async () => {
  vi.stubEnv("COOPER_CHAT", "auto");
  vi.stubEnv("COOPER_CHAT_API_RESPALDO", "1");
  vi.stubEnv("ANTHROPIC_API_KEY", "ficticia");
  vi.stubEnv("OPENAI_API_KEY", "ficticia");
  const orden: string[] = [];
  for (const [Clase, nombre] of [
    [ChatClaudeCli, "cli"],
    [ChatCodexLocal, "codex"],
    [ChatClaude, "api-claude"],
    [ChatOpenAI, "api-openai"],
  ] as const) {
    vi.spyOn(Clase.prototype, "generar").mockImplementation(async function* () {
      orden.push(nombre);
      yield* [];
      throw new Error("fallo");
    });
  }
  const p = proveedorChat();
  expect(JSON.stringify(await reunir(p))).toContain("modo básico temporal");
  expect(orden).toEqual(["cli", "codex", "api-claude", "api-openai"]);
  await reunir(p);
  expect(orden).toHaveLength(4);
  orden.length = 0;
  vi.stubEnv("COOPER_CHAT_API_RESPALDO", "0");
  await reunir(proveedorChat());
  expect(orden).toEqual(["cli", "codex"]);
  orden.length = 0;
  await expect(
    reunir(proveedorChat(), entrada, AbortSignal.abort()),
  ).rejects.toThrow();
  expect(orden).toEqual(["cli"]);
  vi.stubEnv("COOPER_DEMO", "1");
  expect(proveedorChat()).toBeInstanceOf(ChatSimulado);
});
it("la cola conserva FIFO, una petición por dueño, límite global y liberación idempotente", async () => {
  const cola = new ColaChat({
    simultaneos: 1,
    porHora: 3,
    esperaMs: 1000,
    maxCola: 2,
  });
  const signal = AbortSignal.timeout(2000);
  const liberar = await cola.entrar("a", signal);
  await expect(cola.entrar("a", signal)).rejects.toThrow("otro mensaje");
  let started = false;
  const b = cola.entrar("b", signal).then((release) => {
    started = true;
    return release;
  });
  const c = cola.entrar("c", signal);
  await expect(cola.entrar("d", signal)).rejects.toThrow("ocupado");
  expect(started).toBe(false);
  liberar();
  liberar();
  const rb = await b;
  expect(started).toBe(true);
  rb();
  (await c)();
  await expect(cola.entrar("d", signal)).rejects.toThrow("límite temporal");
});
it("retira esperas canceladas o vencidas sin bloquear al siguiente ni gastar cuota", async () => {
  const cola = new ColaChat({
    simultaneos: 1,
    porHora: 2,
    esperaMs: 20,
    maxCola: 2,
  });
  const signal = AbortSignal.timeout(1000),
    controller = new AbortController();
  const liberar = await cola.entrar("a", signal);
  const b = cola.entrar("b", controller.signal);
  controller.abort();
  await expect(b).rejects.toThrow("espera");
  await expect(cola.entrar("c", signal)).rejects.toThrow("ocupado");
  liberar();
  (await cola.entrar("b", signal))();
});
it("el JSON del ejecutable pasa por dueño, esquema de herramienta y confirmación real de Cooper", async () => {
  const id = randomUUID(),
    email = `${id}@example.test`;
  db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  const user = db()
    .insert(users)
    .values({ id, email, name: "Ensayo local" })
    .returning()
    .get();
  const responder = async (nombre: string, argumentos: unknown) =>
    responderChat(
      user,
      {
        texto:
          "SALIDA:" +
          JSON.stringify({
            texto: "",
            llamadas: [{ nombre, argumentos: JSON.stringify(argumentos) }],
          }),
        adjuntos: [],
      },
      undefined,
      AbortSignal.timeout(5000),
      new ChatClaudeCli({ bin }),
    );
  await responder("nuevo_canal", { texto: "Ciencia ficticia" });
  expect(
    db().select().from(channels).where(eq(channels.ownerId, id)).all(),
  ).toHaveLength(0);
  const card = estadoChat(user).tarjetas[0];
  expect(card.estado).toBe("pendiente");
  await confirmarChat(user, { id: card.id, aceptar: true });
  expect(
    db().select().from(channels).where(eq(channels.ownerId, id)).all(),
  ).toHaveLength(1);
  await expect(
    confirmarChat(user, { id: card.id, aceptar: true }),
  ).rejects.toThrow();
  const otro = db()
    .insert(users)
    .values({
      id: randomUUID(),
      email: `${randomUUID()}@example.test`,
      name: "Otro",
    })
    .returning()
    .get();
  const ajeno = db()
    .insert(channels)
    .values({
      id: randomUUID(),
      ownerId: otro.id,
      name: "Privado",
      niche: "Ciencia",
      createdAt: Date.now(),
    })
    .returning()
    .get();
  await responder("eliminar", { recursoId: ajeno.id, tipo: "canal" });
  await responder("estado", { ownerId: otro.id });
  expect(estadoChat(user).tarjetas).toHaveLength(1);
  expect(
    db().select().from(channels).where(eq(channels.id, ajeno.id)).get(),
  ).toBeDefined();
  expect(
    validarSalidaLocal(
      {
        texto: "",
        llamadas: [{ nombre: "estado", argumentos: '{"ownerId":"ajeno"}' }],
      },
      entrada,
    ).llamadas[0].argumentos,
  ).toEqual({ ownerId: "ajeno" });
});
