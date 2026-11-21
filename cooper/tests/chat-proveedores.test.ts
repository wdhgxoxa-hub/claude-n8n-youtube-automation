import { afterEach, expect, it, vi } from "vitest";
import {
  ChatClaude,
  ChatOpenAI,
  ChatConRespaldo,
} from "@/servicios/chat/proveedores";
import { ChatSimulado } from "@/servicios/chat/simulado";
import { TranscripcionOpenAI } from "@/servicios/proveedores/openai";
import { leerSSE } from "@/lib/stream";
import type {
  EntradaModelo,
  EventoProveedor,
  ProveedorChat,
} from "@/servicios/chat/tipos";
const entrada: EntradaModelo = {
  sistema: "Solo el estudio",
  herramientas: [
    {
      nombre: "estado",
      descripcion: "Estado propio",
      parametros: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  mensajes: [
    {
      role: "user",
      texto: "Mira la foto",
      imagenes: [{ mime: "image/png", data: "cHJ1ZWJh" }],
    },
  ],
};
function sse(events: unknown[], fragmentado = false) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(
    events.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join(""),
  );
  return new Response(
    new ReadableStream({
      start(c) {
        if (fragmentado)
          for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
        else c.enqueue(bytes);
        c.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}
const finalClaude = [
  {
    type: "content_block_start",
    index: 0,
    content_block: { type: "text", text: "" },
  },
  {
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text: "Sí, está listo." },
  },
  { type: "message_delta", delta: { stop_reason: "end_turn" } },
  { type: "message_stop" },
];
async function reunir(
  p: ProveedorChat,
  e = entrada,
  signal = AbortSignal.timeout(5000),
) {
  const events: EventoProveedor[] = [];
  for await (const event of p.generar(e, signal)) events.push(event);
  return events;
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("Claude envía contrato, fotos y reconstruye tool use y firmas sin exponer pensamiento", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "ficticia-solo-pruebas");
  const transporte = vi.fn<typeof fetch>().mockResolvedValue(
    sse(
      [
        { type: "message_start", message: { role: "assistant" } },
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "thinking", thinking: "", signature: "" },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "razonamiento privado" },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "signature_delta", signature: "firma" },
        },
        {
          type: "content_block_start",
          index: 1,
          content_block: {
            type: "tool_use",
            id: "t1",
            name: "estado",
            input: {},
          },
        },
        {
          type: "content_block_delta",
          index: 1,
          delta: { type: "input_json_delta", partial_json: "{" },
        },
        {
          type: "content_block_delta",
          index: 1,
          delta: { type: "input_json_delta", partial_json: "}" },
        },
        { type: "message_delta", delta: { stop_reason: "tool_use" } },
        { type: "message_stop" },
      ],
      true,
    ),
  );
  const p = new ChatClaude(transporte),
    events = await reunir(p);
  expect(events.filter((e) => e.tipo === "texto")).toEqual([]);
  const fin = events.at(-1)!;
  if (fin.tipo !== "fin") throw new Error("Falta final");
  expect(fin.mensaje.llamadas).toEqual([
    { id: "t1", nombre: "estado", argumentos: {} },
  ]);
  let [url, init] = transporte.mock.calls[0];
  expect(url).toBe("https://api.anthropic.com/v1/messages");
  expect(init?.redirect).toBe("error");
  expect(new Headers(init?.headers).get("anthropic-version")).toBe(
    "2026-10-21",
  );
  expect(new Headers(init?.headers).has("x-api-key")).toBe(false);
  const request = JSON.parse(String(init?.body));
  expect(request.model).toBe("claude-sonnet-5-5");
  expect(request.messages[0].content[0]).toMatchObject({
    type: "image",
    source: { type: "base64", media_type: "image/png" },
  });
  transporte.mockResolvedValueOnce(sse(finalClaude));
  const second = await reunir(p, {
    ...entrada,
    mensajes: [
      ...entrada.mensajes,
      fin.mensaje,
      {
        role: "user",
        texto: "",
        resultados: [{ id: "t1", texto: "Tu video está listo." }],
      },
    ],
  });
  expect(second[0]).toEqual({ tipo: "texto", texto: "Sí, está listo." });
  [url, init] = transporte.mock.calls[1];
  const body = JSON.parse(String(init?.body));
  expect(body.messages[1].content[0]).toMatchObject({
    signature: "firma",
    thinking: "razonamiento privado",
  });
  expect(body.messages[2].content[0]).toMatchObject({
    type: "tool_result",
    tool_use_id: "t1",
  });
});
it("OpenAI usa Responses sin persistencia y conserva razonamiento cifrado al continuar herramientas", async () => {
  vi.stubEnv("OPENAI_API_KEY", "ficticia-solo-pruebas");
  const output = [
    { type: "reasoning", id: "r1", summary: [], encrypted_content: "cifrado" },
    { type: "function_call", call_id: "c1", name: "estado", arguments: "{}" },
  ];
  const transporte = vi.fn<typeof fetch>().mockImplementation(async () =>
    sse([
      {
        type: "response.completed",
        response: { status: "completed", output },
      },
    ]),
  );
  const p = new ChatOpenAI(transporte),
    events = await reunir(p);
  const fin = events.at(-1)!;
  if (fin.tipo !== "fin") throw new Error("Falta final");
  expect(fin.mensaje.llamadas).toEqual([
    { id: "c1", nombre: "estado", argumentos: {} },
  ]);
  await reunir(p, {
    ...entrada,
    mensajes: [
      ...entrada.mensajes,
      fin.mensaje,
      { role: "user", texto: "", resultados: [{ id: "c1", texto: "Estado" }] },
    ],
  });
  const [url, init] = transporte.mock.calls[1];
  expect(url).toBe("https://api.openai.com/v1/responses");
  const body = JSON.parse(String(init?.body));
  expect(body).toMatchObject({
    store: false,
    stream: true,
    parallel_tool_calls: false,
    include: ["reasoning.encrypted_content"],
  });
  expect(body.input).toContainEqual(output[0]);
  expect(body.input.at(-1)).toEqual({
    type: "function_call_output",
    call_id: "c1",
    output: "Estado",
  });
  expect(body.input[0].content[1].image_url).toBe(
    "data:image/png;base64,cHJ1ZWJh",
  );
});
it("respalda fallos previos al primer texto y nunca repite un stream parcial", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "ficticia-solo-pruebas");
  const fallback = new ChatSimulado(() => "Respaldo correcto.");
  const spy = vi.spyOn(fallback, "generar");
  const bad = new ChatClaude(
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("detalle privado", { status: 429 })),
  );
  const events = await reunir(new ChatConRespaldo(bad, fallback));
  expect(JSON.stringify(events)).toContain("Respaldo correcto");
  expect(spy).toHaveBeenCalledOnce();
  spy.mockClear();
  const partial = new ChatClaude(
    vi.fn<typeof fetch>().mockResolvedValue(sse(finalClaude.slice(0, 2))),
  );
  await expect(reunir(new ChatConRespaldo(partial, fallback))).rejects.toThrow(
    "Cooper no pudo",
  );
  expect(spy).not.toHaveBeenCalled();
});
it("rechaza error SSE, JSON inválido, fin ausente y max_tokens antes de ejecutar herramientas", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "ficticia-solo-pruebas");
  for (const events of [
    [{ type: "error", error: { message: "privado" } }],
    finalClaude.slice(0, 2),
    [
      ...finalClaude.slice(0, 2),
      { type: "message_delta", delta: { stop_reason: "max_tokens" } },
      { type: "message_stop" },
    ],
  ]) {
    await expect(
      reunir(
        new ChatClaude(vi.fn<typeof fetch>().mockResolvedValue(sse(events))),
      ),
    ).rejects.toThrow();
  }
  const stream = new Response('data: {"type":\n\n', {
    headers: { "content-type": "text/event-stream" },
  });
  await expect(
    (async () => {
      for await (const e of leerSSE(stream)) void e;
    })(),
  ).rejects.toThrow();
});
it("OpenAI transmite deltas UTF-8 y rechaza respuestas incompletas", async () => {
  vi.stubEnv("OPENAI_API_KEY", "ficticia-solo-pruebas");
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(
    sse(
      [
        { type: "response.output_text.delta", delta: "Sí, revisión." },
        {
          type: "response.completed",
          response: {
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "Sí, revisión." }],
              },
            ],
          },
        },
      ],
      true,
    ),
  );
  expect((await reunir(new ChatOpenAI(transport)))[0]).toEqual({
    tipo: "texto",
    texto: "Sí, revisión.",
  });
  transport.mockResolvedValueOnce(
    sse([{ type: "response.incomplete", response: { status: "incomplete" } }]),
  );
  await expect(reunir(new ChatOpenAI(transport))).rejects.toThrow();
});
it("transcripción usa multipart con el modelo documentado y devuelve texto editable", async () => {
  vi.stubEnv("OPENAI_API_KEY", "ficticia-solo-pruebas");
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ text: "Quiero un video sobre el mar." }),
    );
  expect(
    await new TranscripcionOpenAI(transport).transcribir({
      mime: "audio/webm",
      data: "cHJ1ZWJh",
    }),
  ).toBe("Quiero un video sobre el mar.");
  const [url, init] = transport.mock.calls[0];
  expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
  const form = init?.body as FormData;
  expect(form.get("model")).toBe("gpt-transcribe");
  expect(form.get("language")).toBe("es");
  expect((form.get("file") as File).name).toBe("grabacion.webm");
  expect(new Headers(init?.headers).has("content-type")).toBe(false);
});
