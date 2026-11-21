import { z } from "zod";
import { ErrorHttp } from "@/lib/permisos";
import { leerSSE } from "@/lib/stream";
import type {
  EntradaModelo,
  EventoProveedor,
  MensajeModelo,
  ProveedorChat,
} from "./tipos";
export type { ProveedorChat } from "./tipos";
const objeto = z.record(z.string(), z.unknown());
const llamada = z.object({
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});
const funcion = z.object({
  call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
});
const indisponible = () =>
  new ErrorHttp(
    503,
    "Cooper no pudo responder. Inténtalo de nuevo en un momento.",
  );
async function solicitar(
  transporte: typeof fetch,
  url: string,
  key: string | undefined,
  cuerpo: unknown,
  signal: AbortSignal,
  claude = false,
) {
  if (!key) throw indisponible();
  const response = await transporte(url, {
    method: "POST",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(claude ? { "anthropic-version": "2026-10-21" } : {}),
    },
    body: JSON.stringify(cuerpo),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw indisponible();
  }
  return response;
}
function claudeMensaje(m: MensajeModelo) {
  if (m.nativo?.proveedor === "claude")
    return { role: m.role, content: m.nativo.bloques };
  return {
    role: m.role,
    content: [
      ...(m.resultados ?? []).map((r) => ({
        type: "tool_result",
        tool_use_id: r.id,
        content: r.texto,
        is_error: !!r.error,
      })),
      ...(m.imagenes ?? []).map((i) => ({
        type: "image",
        source: { type: "base64", media_type: i.mime, data: i.data },
      })),
      ...(m.texto ? [{ type: "text", text: m.texto }] : []),
      ...(m.llamadas ?? []).map((l) => ({
        type: "tool_use",
        id: l.id,
        name: l.nombre,
        input: l.argumentos,
      })),
    ],
  };
}
export class ChatClaude implements ProveedorChat {
  constructor(private transporte: typeof fetch = fetch) {}
  async *generar(
    e: EntradaModelo,
    signal: AbortSignal,
  ): AsyncGenerator<EventoProveedor> {
    const response = await solicitar(
      this.transporte,
      "https://api.anthropic.com/v1/messages",
      process.env.ANTHROPIC_API_KEY,
      {
        model: process.env.COOPER_CHAT_MODELO_CLAUDE ?? "claude-sonnet-5-5",
        max_tokens: 4096,
        stream: true,
        system: e.sistema,
        messages: e.mensajes.map(claudeMensaje),
        tools: e.herramientas.map((h) => ({
          name: h.nombre,
          description: h.descripcion,
          input_schema: h.parametros,
        })),
      },
      signal,
      true,
    );
    const bloques: Record<string, unknown>[] = [];
    const argumentos = new Map<number, string>();
    let texto = "",
      terminado = false,
      motivo = "";
    for await (const raw of leerSSE(response)) {
      const event = objeto.parse(raw);
      const index = typeof event.index === "number" ? event.index : -1;
      if (event.type === "error") throw indisponible();
      if (event.type === "content_block_start")
        bloques[index] = objeto.parse(event.content_block);
      if (event.type === "content_block_delta") {
        const delta = objeto.parse(event.delta),
          block = bloques[index];
        if (!block) throw indisponible();
        if (delta.type === "text_delta") {
          const part = z.string().parse(delta.text);
          texto += part;
          block.text = String(block.text ?? "") + part;
          yield { tipo: "texto", texto: part };
        } else if (delta.type === "input_json_delta") {
          argumentos.set(
            index,
            (argumentos.get(index) ?? "") +
              z.string().parse(delta.partial_json),
          );
        } else if (delta.type === "thinking_delta") {
          block.thinking =
            String(block.thinking ?? "") + z.string().parse(delta.thinking);
        } else if (delta.type === "signature_delta") {
          block.signature =
            String(block.signature ?? "") + z.string().parse(delta.signature);
        }
      }
      if (event.type === "message_delta")
        motivo = String(objeto.parse(event.delta).stop_reason);
      if (event.type === "message_stop") terminado = true;
    }
    if (!terminado || !["end_turn", "tool_use"].includes(motivo))
      throw indisponible();
    for (const [index, json] of argumentos)
      bloques[index].input = JSON.parse(json);
    const llamadas = bloques
      .filter((b) => b.type === "tool_use")
      .map((b) => {
        const l = llamada.parse(b);
        return { id: l.id, nombre: l.name, argumentos: l.input };
      });
    yield {
      tipo: "fin",
      mensaje: {
        role: "assistant",
        texto,
        llamadas,
        nativo: { proveedor: "claude", bloques },
      },
    };
  }
}
function openaiMensajes(m: MensajeModelo): Record<string, unknown>[] {
  if (m.nativo?.proveedor === "openai") return m.nativo.bloques;
  return [
    ...(m.texto || m.imagenes?.length
      ? [
          {
            role: m.role,
            content:
              m.role === "assistant"
                ? m.texto
                : [
                    {
                      type: "input_text",
                      text: m.texto || "Fotos de referencia",
                    },
                    ...(m.imagenes ?? []).map((i) => ({
                      type: "input_image",
                      image_url: `data:${i.mime};base64,${i.data}`,
                      detail: "auto",
                    })),
                  ],
          },
        ]
      : []),
    ...(m.llamadas ?? []).map((l) => ({
      type: "function_call",
      call_id: l.id,
      name: l.nombre,
      arguments: JSON.stringify(l.argumentos),
    })),
    ...(m.resultados ?? []).map((r) => ({
      type: "function_call_output",
      call_id: r.id,
      output: r.texto,
    })),
  ];
}
export class ChatOpenAI implements ProveedorChat {
  constructor(private transporte: typeof fetch = fetch) {}
  async *generar(
    e: EntradaModelo,
    signal: AbortSignal,
  ): AsyncGenerator<EventoProveedor> {
    const response = await solicitar(
      this.transporte,
      "https://api.openai.com/v1/responses",
      process.env.OPENAI_API_KEY,
      {
        model: process.env.COOPER_CHAT_MODELO_OPENAI ?? "gpt-6.1-sol",
        max_output_tokens: 4096,
        stream: true,
        store: false,
        include: ["reasoning.encrypted_content"],
        instructions: e.sistema,
        input: e.mensajes.flatMap(openaiMensajes),
        tools: e.herramientas.map((h) => ({
          type: "function",
          name: h.nombre,
          description: h.descripcion,
          parameters: h.parametros,
          strict: false,
        })),
        parallel_tool_calls: false,
      },
      signal,
    );
    let completo: Record<string, unknown> | undefined;
    for await (const raw of leerSSE(response)) {
      const event = objeto.parse(raw);
      if (
        ["error", "response.failed", "response.incomplete"].includes(
          String(event.type),
        )
      )
        throw indisponible();
      if (event.type === "response.output_text.delta")
        yield { tipo: "texto", texto: z.string().parse(event.delta) };
      if (event.type === "response.completed")
        completo = objeto.parse(event.response);
    }
    if (!completo || completo.status !== "completed") throw indisponible();
    const bloques = z.array(objeto).parse(completo.output);
    const llamadas = bloques
      .filter((b) => b.type === "function_call")
      .map((b) => {
        const l = funcion.parse(b);
        return {
          id: l.call_id,
          nombre: l.name,
          argumentos: JSON.parse(l.arguments) as unknown,
        };
      });
    const texto = bloques
      .filter((b) => b.type === "message")
      .flatMap((b) => z.array(objeto).parse(b.content))
      .filter((c) => c.type === "output_text")
      .map((c) => z.string().parse(c.text))
      .join("");
    yield {
      tipo: "fin",
      mensaje: {
        role: "assistant",
        texto,
        llamadas,
        nativo: { proveedor: "openai", bloques },
      },
    };
  }
}
// Solo respalda antes de emitir contenido: nunca duplica texto ni repite herramientas.
export class ChatConRespaldo implements ProveedorChat {
  private usandoRespaldo = false;
  constructor(
    private principal: ProveedorChat,
    private respaldo: ProveedorChat,
  ) {}
  async *generar(
    e: EntradaModelo,
    signal: AbortSignal,
  ): AsyncGenerator<EventoProveedor> {
    if (this.usandoRespaldo) {
      yield* this.respaldo.generar(e, signal);
      return;
    }
    let emitido = false;
    try {
      for await (const event of this.principal.generar(e, signal)) {
        emitido = true;
        yield event;
      }
    } catch {
      if (signal.aborted || emitido) throw indisponible();
      this.usandoRespaldo = true;
      yield* this.respaldo.generar(e, signal);
    }
  }
}
