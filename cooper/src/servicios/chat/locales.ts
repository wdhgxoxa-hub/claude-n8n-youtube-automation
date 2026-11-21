import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { ErrorHttp } from "@/lib/permisos";
import type { EntradaModelo, EventoProveedor, ProveedorChat } from "./tipos";

// Los argumentos viajan como JSON textual para mantener un esquema cerrado en ambos CLI.
// Se validan de nuevo por herramienta y dueño en prepararLlamada; aquí no se ejecuta nada.
export const salidaLocal = z
  .object({
    texto: z.string().max(24000),
    llamadas: z
      .array(
        z
          .object({
            nombre: z.string().min(1).max(80),
            argumentos: z.string().max(16000),
          })
          .strict(),
      )
      .max(4),
  })
  .strict();
const noDisponible = () =>
  new ErrorHttp(
    503,
    "Cooper no pudo responder. Inténtalo de nuevo en un momento.",
  );
const tiempoAgotado = () =>
  new ErrorHttp(
    504,
    "Cooper tardó demasiado. Revisa las tarjetas pendientes y vuelve a intentarlo.",
  );

export function promptLocal(e: EntradaModelo) {
  const prompt = JSON.stringify({
    instrucciones:
      e.sistema +
      "\nDevuelve únicamente el JSON del esquema: texto y llamadas. Cada llamada contiene nombre y argumentos (un objeto codificado como cadena JSON). Las herramientas son propuestas para Cooper, nunca herramientas del CLI. No ejecutes comandos, no leas archivos ni uses conectores. No puedes ver imágenes ni abrir adjuntos: pide una descripción si hace falta. No inventes lo que contienen.",
    herramientas: e.herramientas,
    mensajes: e.mensajes.map(
      ({ role, texto, llamadas, resultados, imagenes }) => ({
        role,
        texto,
        llamadas,
        resultados,
        ...(imagenes?.length
          ? {
              aviso:
                "Fotos adjuntas no disponibles para este modelo. Pide una descripción; no afirmes verlas.",
            }
          : {}),
      }),
    ),
  });
  if (prompt.length > 60000)
    throw new ErrorHttp(
      413,
      "La conversación es demasiado larga. Selecciona un video y concreta tu pedido.",
    );
  return prompt;
}

export function validarSalidaLocal(raw: unknown, e: EntradaModelo) {
  const salida = salidaLocal.parse(raw);
  if (!salida.texto.trim() && !salida.llamadas.length) throw noDisponible();
  return {
    role: "assistant" as const,
    texto: salida.texto,
    llamadas: salida.llamadas.map((l) => {
      if (!e.herramientas.some((h) => h.nombre === l.nombre))
        throw noDisponible();
      const argumentos = z
        .record(z.string(), z.unknown())
        .parse(JSON.parse(l.argumentos));
      return { id: randomUUID(), nombre: l.nombre, argumentos };
    }),
  };
}

export async function ejecutarClaude(
  args: string[],
  input: string,
  signal: AbortSignal,
  {
    bin = process.env.COOPER_CLAUDE_BIN || "claude",
    timeoutMs = 45000,
    env = process.env,
  }: {
    bin?: string;
    timeoutMs?: number;
    env?: Record<string, string | undefined>;
  } = {},
): Promise<unknown> {
  const cwd = await mkdtemp(join(tmpdir(), "cooper-claude-"));
  const childEnv: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    ...Object.fromEntries(
      ["PATH", "HOME", "LANG", "TMPDIR"]
        .filter((k) => env[k])
        .map((k) => [k, env[k]]),
    ),
  };
  try {
    return await new Promise((resolve, reject) => {
      if (signal.aborted) return reject(tiempoAgotado());
      // El CLI lo instala el operador fuera del build; nunca empaquetar su ruta ni el proyecto.
      const child = spawn(/* turbopackIgnore: true */ bin, args, {
        cwd,
        env: childEnv,
        shell: false,
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "",
        bytes = 0,
        failure: Error | undefined;
      const kill = (error: Error) => {
        failure ??= error;
        try {
          if (process.platform !== "win32")
            process.kill(-child.pid!, "SIGKILL");
          else child.kill("SIGKILL");
        } catch {
          /* El proceso ya terminó. */
        }
      };
      const abort = () => kill(tiempoAgotado());
      signal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, timeoutMs);
      const collect = (chunk: string | Buffer, save: boolean) => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 1024 * 1024) return kill(noDisponible());
        if (save) stdout += chunk.toString();
      };
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (c) => collect(c, true));
      child.stderr.on("data", (c) => collect(c, false)); // No registrar salida privada del CLI.
      child.stdin.on("error", () => {});
      child.on("error", () => {
        failure = noDisponible();
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        if (failure || code !== 0) return reject(failure ?? noDisponible());
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(noDisponible());
        }
      });
      child.stdin.end(input);
    });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

const opcionesSeguras = [
  "--safe-mode",
  "--restricted",
  "--setting-sources",
  "",
  "--settings",
  JSON.stringify({
    disableAllHooks: true,
    disableClaudeAiConnectors: true,
    autoMemoryEnabled: false,
  }),
];

export class ChatClaudeCli implements ProveedorChat {
  constructor(private opciones: Parameters<typeof ejecutarClaude>[3] = {}) {}
  async disponible(signal: AbortSignal) {
    try {
      const auth = z.object({
        loggedIn: z.literal(true),
        authMethod: z.literal("claude.ai"),
      });
      return auth.safeParse(
        await ejecutarClaude(
          [...opcionesSeguras, "auth", "status"],
          "",
          signal,
          { ...this.opciones, timeoutMs: 5000 },
        ),
      ).success;
    } catch {
      return false;
    }
  }
  async *generar(
    e: EntradaModelo,
    signal: AbortSignal,
  ): AsyncGenerator<EventoProveedor> {
    const prompt = promptLocal(e);
    if (!(await this.disponible(signal))) throw noDisponible();
    const raw = await ejecutarClaude(
      [
        ...opcionesSeguras,
        "-p",
        "--output-format",
        "json",
        "--json-schema",
        JSON.stringify(z.toJSONSchema(salidaLocal, { target: "draft-7" })),
        "--tools",
        "",
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers":{}}',
        "--disable-slash-commands",
        "--no-chrome",
        "--no-session-persistence",
        "--permission-mode",
        "dontAsk",
        "--max-turns",
        "3",
        "--effort",
        "low",
        "--system-prompt",
        "Eres Cooper. Solo transforma el contexto recibido en una respuesta JSON. No tienes herramientas del sistema ni acceso a archivos. Sigue las instrucciones del estudio incluidas en el contexto.",
      ],
      prompt,
      signal,
      this.opciones,
    );
    const result = z
      .object({
        type: z.literal("result"),
        subtype: z.literal("success"),
        is_error: z.literal(false),
        structured_output: z.unknown(),
      })
      .parse(raw);
    const mensaje = validarSalidaLocal(result.structured_output, e);
    if (mensaje.texto) yield { tipo: "texto", texto: mensaje.texto };
    yield { tipo: "fin", mensaje };
  }
}

export class ChatCodexLocal implements ProveedorChat {
  constructor(private transporte: typeof fetch = fetch) {}
  async *generar(
    e: EntradaModelo,
    signal: AbortSignal,
  ): AsyncGenerator<EventoProveedor> {
    const url = new URL(
      process.env.PUENTE_CODEX_URL || "http://127.0.0.1:8789",
    );
    if (
      url.protocol !== "http:" ||
      !["127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw noDisponible();
    const token = process.env.PUENTE_CODEX_TOKEN;
    if (!token || token.length < 32) throw noDisponible();
    const response = await this.transporte(new URL("/v1/chat", url), {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt: promptLocal(e) }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw response.status === 504 ? tiempoAgotado() : noDisponible();
    }
    // Acotar incluso una respuesta local defectuosa; nunca propagar metadatos del CLI.
    if (!response.body) throw noDisponible();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 128 * 1024) throw noDisponible();
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const mensaje = validarSalidaLocal(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
      e,
    );
    if (mensaje.texto) yield { tipo: "texto", texto: mensaje.texto };
    yield { tipo: "fin", mensaje };
  }
}
