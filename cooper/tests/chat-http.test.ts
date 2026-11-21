import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  allowedEmails,
  users,
  chatSessions,
  attachments,
  type User,
} from "@/db/schema";
import { ChatSimulado } from "@/servicios/chat";
let active: User;
vi.mock("@/lib/sesion", () => ({ currentUser: async () => active }));
import { POST } from "@/app/api/[...ruta]/route";
function post(
  data: unknown,
  accept = "application/json",
  ruta = "chat",
  signal?: AbortSignal,
) {
  return POST(
    new Request(`http://localhost/api/${ruta}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept,
        origin: "http://localhost",
      },
      body: JSON.stringify(data),
      signal,
    }),
    { params: Promise.resolve({ ruta: ruta.split("/") }) },
  );
}
beforeEach(() => {
  const id = randomUUID(),
    email = `${id}@example.test`;
  db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  active = db()
    .insert(users)
    .values({ id, email, name: "HTTP" })
    .returning()
    .get();
});
afterEach(() => vi.restoreAllMocks());
it("SSE entrega texto antes del fin y conserva cabeceras privadas", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  vi.spyOn(ChatSimulado.prototype, "generar").mockImplementation(
    async function* () {
      yield { tipo: "texto", texto: "Primera frase. " };
      await gate;
      yield { tipo: "texto", texto: "Segunda frase." };
      yield {
        tipo: "fin",
        mensaje: {
          role: "assistant",
          texto: "Primera frase. Segunda frase.",
          llamadas: [],
        },
      };
    },
  );
  const response = await post({ texto: "Hola" }, "text/event-stream");
  expect(response.headers.get("x-accel-buffering")).toBe("no");
  expect(response.headers.get("cache-control")).toContain("private");
  const reader = response.body!.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  expect(first).toContain("Primera frase.");
  expect(first).not.toContain('"tipo":"fin"');
  release();
  let rest = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    rest += new TextDecoder().decode(value);
  }
  expect(rest).toContain("Segunda frase.");
  expect(rest).toContain('"tipo":"fin"');
});
it("SSE oculta errores del proveedor y libera la conversación", async () => {
  vi.spyOn(ChatSimulado.prototype, "generar").mockImplementation(
    async function* () {
      yield { tipo: "texto", texto: "Un momento. " };
      throw new Error("detalle interno privado");
    },
  );
  const response = await post({ texto: "Hola" }, "text/event-stream");
  const body = await response.text();
  expect(body).toContain('"tipo":"error"');
  expect(body).not.toContain("detalle interno privado");
  expect(
    db()
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.ownerId, active.id))
      .get()?.busyUntil,
  ).toBe(0);
});
it("JSON no omite confirmación y no acepta una confirmación dentro de una petición de chat", async () => {
  const r = await post({ texto: "Crea un canal: Ensayo" });
  expect(r.status).toBe(200);
  const { estadoChat } = await import("@/servicios/chat");
  const card = estadoChat(active).tarjetas[0];
  expect(card.estado).toBe("pendiente");
  expect((await post({ texto: "Sí", confirmar: card.id })).status).toBe(400);
  expect(
    (
      await post(
        { id: card.id, aceptar: true },
        "application/json",
        "chat/confirmar",
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await post(
        { id: card.id, aceptar: true },
        "application/json",
        "chat/confirmar",
      )
    ).status,
  ).toBe(409);
});
it("transcribir comprueba dueño antes de invocar al proveedor", async () => {
  const { TranscripcionSimulada } =
    await import("@/servicios/proveedores/simulados");
  const spy = vi.spyOn(TranscripcionSimulada.prototype, "transcribir");
  const otro = db()
    .insert(users)
    .values({
      id: randomUUID(),
      email: `${randomUUID()}@example.test`,
      name: "Otro",
    })
    .returning()
    .get();
  const id = randomUUID();
  db()
    .insert(attachments)
    .values({
      id,
      ownerId: otro.id,
      name: "voz.webm",
      mime: "audio/webm",
      data: "cHJ1ZWJh",
      size: 4,
    })
    .run();
  expect((await post({ id }, "application/json", "transcribir")).status).toBe(
    404,
  );
  expect(spy).not.toHaveBeenCalled();
});
