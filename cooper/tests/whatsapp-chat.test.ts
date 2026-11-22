import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  allowedEmails,
  users,
  messages,
  chatActions,
  chatSessions,
  chatMemories,
  marcaIngestas,
  channels,
  videos,
  whatsappContacts as contacts,
  whatsappChatJobs as jobs,
  whatsappOutbox as outbox,
  whatsappAttempts as attempts,
  whatsappInbox as inbox,
  whatsappActions as actions,
  type User,
} from "@/db/schema";
import { POST as webhook } from "@/app/api/whatsapp/webhook/route";
import {
  procesarChatWhatsApp,
  respuestaBreveWhatsApp,
} from "@/servicios/mensajeria/chat-whatsapp";
import { procesarCola, revision } from "@/servicios/mensajeria/cola";
import { ChatSimulado } from "@/servicios/chat/simulado";
import { colaChat } from "@/servicios/chat/cola";
import { ErrorHttp } from "@/lib/permisos";
import type { EntradaModelo } from "@/servicios/chat/tipos";
import { FabricaSimulada } from "@/servicios/fabrica";
import { DIA } from "@/servicios/mensajeria/cuentas";
import texto from "./fixtures/whatsapp/texto.json";
import reenviado from "./fixtures/whatsapp/texto-reenviado.json";
import estados from "./fixtures/whatsapp/estados.json";
import interactivo from "./fixtures/whatsapp/interactivo.json";
import bsuid from "./fixtures/whatsapp/bsuid-sin-telefono.json";

let user: User, now: number, secret: string;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  now = Number(texto.entry[0].changes[0].value.messages[0].timestamp) * 1000;
  vi.setSystemTime(now);
  secret = randomBytes(32).toString("hex");
  vi.stubEnv("WHATSAPP_APP_SECRET", secret);
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "100000000000001");
  vi.stubEnv("WHATSAPP_WABA_ID", "100000000000002");
  vi.stubEnv("COOPER_MENSAJERIA", "simulada");
  vi.stubEnv("COOPER_MENSAJERIA_PAUSA", "0");
  db().delete(attempts).run();
  db().delete(outbox).run();
  db().delete(jobs).run();
  db().delete(inbox).run();
  db().delete(contacts).run();
  db().delete(actions).run();
  const id = randomUUID(),
    email = `${id}@example.test`;
  db().insert(allowedEmails).values({ email, createdAt: now }).run();
  user = db()
    .insert(users)
    .values({ id, email, name: "Ensayo WhatsApp", whatsapp: "+15555550101" })
    .returning()
    .get();
  db()
    .insert(contacts)
    .values({
      ownerId: id,
      phone: user.whatsapp,
      verifiedAt: now - 1000,
      consentAt: now - 1000,
      simulated: true,
    })
    .run();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function signed(payload: unknown) {
  const body = JSON.stringify(payload);
  return new Request("http://localhost/api/whatsapp/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256":
        "sha256=" + createHmac("sha256", secret).update(body).digest("hex"),
    },
    body,
  });
}
function packet(body = "Hola Cooper", id = randomUUID()) {
  const value = structuredClone(texto);
  Object.assign(value.entry[0].changes[0].value.messages[0], {
    id,
    timestamp: String(Math.floor(now / 1000)),
    text: { body },
  });
  return value;
}
function pending() {
  return db().select().from(jobs).all();
}
function outgoing() {
  return db().select().from(outbox).where(eq(outbox.kind, "chat")).all();
}
function history() {
  return db()
    .select()
    .from(messages)
    .where(eq(messages.ownerId, user.id))
    .all();
}

describe("Texto oficial simulado → chat privado → cola WhatsApp", () => {
  it("persiste antes del ACK, responde corto, concilia recibos oficiales y no duplica", async () => {
    const incoming = packet("¿Qué videos tengo pendientes?");
    expect((await webhook(signed(incoming))).status).toBe(200);
    expect(history()).toEqual([]);
    expect(pending()).toMatchObject([{ state: "pendiente", ownerId: user.id }]);
    const provider = new ChatSimulado(
      () =>
        "Tienes un video pendiente de revisión. Puedes abrir Cooper para ver los detalles.",
    );
    const spy = vi.spyOn(provider, "generar");
    await Promise.all([
      procesarChatWhatsApp(now, provider),
      procesarChatWhatsApp(now, provider),
    ]);
    await webhook(signed(incoming));
    await procesarChatWhatsApp(now, provider);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(history().map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(pending()).toMatchObject([
      {
        state: "completado",
        response: "Tienes un video pendiente de revisión.",
      },
    ]);
    expect(outgoing()).toHaveLength(1);
    const send = vi.fn(async () => ({ id: "wamid.simulado.salida.1" }));
    await procesarCola({ simulada: true, enviar: send }, now);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: user.whatsapp.slice(1),
        type: "text",
        context: {
          message_id: incoming.entry[0].changes[0].value.messages[0].id,
        },
        text: {
          body: "Tienes un video pendiente de revisión.",
          preview_url: false,
        },
      },
      outgoing()[0].id,
      expect.any(Function),
    );
    expect((await webhook(signed(estados))).status).toBe(200);
    expect(outgoing()[0].delivery).toBe("read");
  });
  it("conserva propuestas como tarjetas web sin crear canales ni aceptar un sí escrito", async () => {
    const before = db()
      .select()
      .from(channels)
      .where(eq(channels.ownerId, user.id))
      .all().length;
    await webhook(signed(packet("Crea un canal: Ciencia")));
    await procesarChatWhatsApp(now);
    const cards = db()
      .select()
      .from(chatActions)
      .where(eq(chatActions.ownerId, user.id))
      .all();
    expect(cards).toMatchObject([{ status: "pendiente", tool: "nuevo_canal" }]);
    expect(outgoing()[0].detail).toBe(
      "Abre Cooper y confirma la tarjeta pendiente para realizar el cambio.",
    );
    await webhook(signed(packet("sí")));
    await procesarChatWhatsApp(now);
    expect(
      db().select().from(channels).where(eq(channels.ownerId, user.id)).all(),
    ).toHaveLength(before);
    expect(
      db()
        .select()
        .from(chatActions)
        .where(eq(chatActions.ownerId, user.id))
        .get()?.status,
    ).toBe("pendiente");
  });
  it("comparte memoria privada sin alterar el JSON de síntesis ni incluir otro dueño", async () => {
    const otherId = randomUUID();
    const other = db()
      .insert(users)
      .values({
        id: otherId,
        email: `${otherId}@example.test`,
        name: "Otro dueño",
      })
      .returning()
      .get();
    await new FabricaSimulada().ejecutar(other, {
      evento: "nuevo_canal",
      texto: "CANARIO PRIVADO AJENO",
    });
    vi.stubEnv("COOPER_CHAT", "auto");
    const inputs: EntradaModelo[] = [];
    const provider = new ChatSimulado((input) => {
      inputs.push(input);
      return input.herramientas.length
        ? "Recordaré que prefieres videos cortos."
        : JSON.stringify({
            pendientes: [],
            videos: [],
            decisiones: [],
            preferencias: ["Prefiere videos cortos."],
          });
    });
    await webhook(signed(packet("Recuerda que prefiero videos cortos")));
    await procesarChatWhatsApp(now, provider);
    expect(inputs).toHaveLength(2);
    expect(inputs[0].sistema).toContain("Este turno llega por WhatsApp");
    expect(inputs[1].sistema).not.toContain("Este turno llega por WhatsApp");
    expect(inputs[1].sistema).toContain("exclusivamente un objeto JSON");
    expect(JSON.stringify(inputs)).not.toContain("CANARIO PRIVADO AJENO");
    expect(
      db()
        .select()
        .from(chatMemories)
        .where(eq(chatMemories.ownerId, user.id))
        .get(),
    ).toMatchObject({ method: "resumen" });
  });
  it("reintenta reserva web ocupada sin guardar mensajes ni adelantar el siguiente turno", async () => {
    db()
      .insert(chatSessions)
      .values({ ownerId: user.id, lease: "sesion-web", busyUntil: now + 60000 })
      .run();
    await webhook(signed(packet("primero")));
    await webhook(signed(packet("segundo")));
    const provider = new ChatSimulado(() => "Listo.");
    const spy = vi.spyOn(provider, "generar");
    await procesarChatWhatsApp(now, provider);
    expect(spy).not.toHaveBeenCalled();
    expect(history()).toEqual([]);
    expect(pending().map((j) => j.attempts)).toEqual([1, 0]);
    db()
      .update(chatSessions)
      .set({ lease: "", busyUntil: 0 })
      .where(eq(chatSessions.ownerId, user.id))
      .run();
    vi.setSystemTime(now + 5000);
    await procesarChatWhatsApp(now + 5000, provider);
    expect(
      history()
        .filter((m) => m.role === "user")
        .map((m) => m.content),
    ).toEqual(["primero", "segundo"]);
  });
  it("un fallo ambiguo o reserva huérfana no repite el modelo", async () => {
    await webhook(signed(packet()));
    const provider = new ChatSimulado(() => {
      throw new Error("respuesta privada del proveedor");
    });
    const spy = vi.spyOn(provider, "generar");
    await procesarChatWhatsApp(now, provider);
    await procesarChatWhatsApp(now + 200000, provider);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(pending()[0].state).toBe("incierto");
    expect(JSON.stringify(pending())).not.toContain(
      "respuesta privada del proveedor",
    );
    await webhook(signed(packet("otro")));
    db()
      .update(jobs)
      .set({ state: "procesando", leaseAt: now - 180001 })
      .where(eq(jobs.state, "pendiente"))
      .run();
    await procesarChatWhatsApp(now, provider);
    expect(pending().map((j) => j.state)).toEqual(["incierto", "incierto"]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("reintenta 429 previo al modelo y reanuda sin duplicar mensaje ni tarjeta", async () => {
    vi.stubEnv("COOPER_CHAT", "auto");
    await webhook(signed(packet("Crea un canal: Ciencia")));
    const occupied = vi
      .spyOn(colaChat, "entrar")
      .mockRejectedValue(new ErrorHttp(429, "Cola ocupada."));
    await procesarChatWhatsApp(now);
    expect(pending()[0]).toMatchObject({
      state: "pendiente",
      attempts: 1,
      nextAt: now + 15 * 60000,
    });
    expect(history().filter((m) => m.role === "user")).toHaveLength(0);
    occupied.mockRestore();
    vi.setSystemTime(now + 15 * 60000);
    const provider = new ChatSimulado((input) =>
      input.herramientas.length === 0
        ? JSON.stringify({
            pendientes: [],
            videos: [],
            decisiones: [],
            preferencias: [],
          })
        : (input.mensajes
            .at(-1)
            ?.resultados?.map((r) => r.texto)
            .join(" ") ?? [
            {
              id: "call-1",
              nombre: "nuevo_canal",
              argumentos: { texto: "Ciencia" },
            },
          ]),
    );
    await procesarChatWhatsApp(now + 15 * 60000, provider);
    expect(pending()[0].state).toBe("completado");
    expect(history().filter((m) => m.role === "user")).toHaveLength(1);
    expect(
      db()
        .select()
        .from(chatActions)
        .where(eq(chatActions.ownerId, user.id))
        .all(),
    ).toHaveLength(1);
    expect(outgoing()).toHaveLength(1);
  });
  it("agota cinco rechazos 429 sin invocar el modelo y marca fallido conocido", async () => {
    vi.stubEnv("COOPER_CHAT", "auto");
    await webhook(signed(packet()));
    const occupied = vi
      .spyOn(colaChat, "entrar")
      .mockRejectedValue(new ErrorHttp(429, "Cola ocupada."));
    const provider = new ChatSimulado(() => "Listo.");
    const spy = vi.spyOn(provider, "generar");
    for (let attempt = 0; attempt < 6; attempt++) {
      vi.setSystemTime(now + attempt * 15 * 60000);
      await procesarChatWhatsApp(now + attempt * 15 * 60000, provider);
    }
    expect(occupied).toHaveBeenCalledTimes(5);
    expect(spy).not.toHaveBeenCalled();
    expect(pending()[0]).toMatchObject({ state: "fallido", attempts: 5 });
    expect(outgoing()).toEqual([]);
  });
  it("un proceso que perdió la reserva no encola una respuesta tardía", async () => {
    await webhook(signed(packet()));
    const provider = new ChatSimulado(() => {
      db()
        .update(jobs)
        .set({ state: "incierto" })
        .where(eq(jobs.state, "procesando"))
        .run();
      return "Respuesta tardía.";
    });
    await procesarChatWhatsApp(now, provider);
    expect(pending()[0].state).toBe("incierto");
    expect(outgoing()).toEqual([]);
  });
  it.each(["suspension", "lista", "numero", "baja", "verificacion", "ventana"])(
    "revalida %s antes de llamar al modelo",
    async (reason) => {
      await webhook(signed(packet()));
      if (reason === "suspension")
        db()
          .update(users)
          .set({ active: false })
          .where(eq(users.id, user.id))
          .run();
      if (reason === "lista")
        db()
          .delete(allowedEmails)
          .where(eq(allowedEmails.email, user.email))
          .run();
      if (reason === "numero")
        db()
          .update(users)
          .set({ whatsapp: "+15555550102" })
          .where(eq(users.id, user.id))
          .run();
      if (reason === "baja")
        db()
          .update(contacts)
          .set({ consentAt: 0 })
          .where(eq(contacts.ownerId, user.id))
          .run();
      if (reason === "verificacion")
        db()
          .update(contacts)
          .set({ verifiedAt: now })
          .where(eq(contacts.ownerId, user.id))
          .run();
      const provider = new ChatSimulado(() => "Listo.");
      const spy = vi.spyOn(provider, "generar");
      await procesarChatWhatsApp(
        reason === "ventana" ? now + DIA : now,
        provider,
      );
      expect(pending()[0].state).toBe("cancelado");
      expect(spy).not.toHaveBeenCalled();
      expect(outgoing()).toEqual([]);
    },
  );
  it("revalida baja ocurrida durante el modelo antes de preparar la respuesta", async () => {
    await webhook(signed(packet()));
    const provider = new ChatSimulado(() => {
      db()
        .update(contacts)
        .set({ consentAt: 0 })
        .where(eq(contacts.ownerId, user.id))
        .run();
      return "Respuesta ya generada.";
    });
    await procesarChatWhatsApp(now, provider);
    expect(pending()[0].state).toBe("cancelado");
    expect(outgoing()).toEqual([]);
  });
  it("conserva texto durante pausa, reanuda y atiende STOP aun pausado", async () => {
    vi.stubEnv("COOPER_MENSAJERIA_PAUSA", "1");
    await webhook(signed(packet()));
    await procesarChatWhatsApp(now);
    expect(pending()[0].state).toBe("pendiente");
    expect(history()).toEqual([]);
    vi.stubEnv("COOPER_MENSAJERIA_PAUSA", "0");
    await procesarChatWhatsApp(now);
    expect(pending()[0].state).toBe("completado");
    vi.stubEnv("COOPER_MENSAJERIA_PAUSA", "1");
    await webhook(signed(packet("Otro pedido")));
    await webhook(signed(packet("STOP")));
    expect(pending().map((j) => j.state)).toEqual(["completado", "cancelado"]);
    expect(outgoing()[0].state).toBe("cancelado");
  });
});

describe("Sobres y controles oficiales simulados", () => {
  it("admite texto reenviado sin context.id y conserva aislamiento BSUID", async () => {
    expect((await webhook(signed(reenviado))).status).toBe(200);
    expect(pending()).toHaveLength(1);
    expect((await webhook(signed(bsuid))).status).toBe(200);
    expect(pending()).toHaveLength(1);
  });
  it.each(["waba", "numero", "producto", "remitente"])(
    "ignora lote de %s no autorizado",
    async (reason) => {
      const payload = packet();
      const value = payload.entry[0].changes[0].value;
      if (reason === "waba") payload.entry[0].id = "otra";
      if (reason === "numero") value.metadata.phone_number_id = "otro";
      if (reason === "producto") value.messaging_product = "otro";
      if (reason === "remitente") value.messages[0].from = "15555550102";
      expect((await webhook(signed(payload))).status).toBe(200);
      expect(pending()).toEqual([]);
    },
  );
  it("pausa impide una aprobación válida y la ingesta de medios, con recibos permitidos", async () => {
    const factory = new FabricaSimulada();
    const channel = await factory.ejecutar(user, {
      evento: "nuevo_canal",
      texto: "Ciencia",
    });
    const video = await factory.ejecutar(user, {
      evento: "nuevo_video",
      recursoId: channel.id,
      texto: "Luna",
    });
    db().update(videos).set({ stage: 3 }).where(eq(videos.id, video.id)).run();
    const current = db()
      .select()
      .from(videos)
      .where(eq(videos.id, video.id))
      .get()!;
    db()
      .update(contacts)
      .set({
        preferences: JSON.stringify({
          guion: true,
          final: false,
          publicado: false,
          gasto: false,
          marca: false,
        }),
        incomingAt: now,
      })
      .where(eq(contacts.ownerId, user.id))
      .run();
    db()
      .insert(outbox)
      .values({
        id: "10000000-0000-4000-8000-000000000001",
        dedupeKey: randomUUID(),
        ownerId: user.id,
        phone: user.whatsapp,
        kind: "guion",
        resourceId: video.id,
        revision: revision(current),
        state: "aceptado",
        interactive: true,
        simulated: true,
        contactVerifiedAt: now - 1000,
        remoteId: "wamid.simulado.salida.1",
        createdAt: now,
        nextAt: now,
        expiresAt: now + DIA,
      })
      .run();
    vi.stubEnv("COOPER_MENSAJERIA_PAUSA", "1");
    expect((await webhook(signed(interactivo))).status).toBe(200);
    expect(db().select().from(actions).all()).toEqual([]);
    expect(
      db().select().from(videos).where(eq(videos.id, video.id)).get()?.stage,
    ).toBe(3);
    const mediaId = randomUUID();
    const media = packet();
    const value = media.entry[0].changes[0].value;
    expect(
      (
        await webhook(
          signed({
            ...media,
            entry: [
              {
                ...media.entry[0],
                changes: [
                  {
                    field: "messages",
                    value: {
                      ...value,
                      messages: [
                        {
                          id: mediaId,
                          from: user.whatsapp.slice(1),
                          timestamp: String(now / 1000),
                          type: "image",
                          image: {
                            id: "100000000000003",
                            caption: "Referencia sintética",
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      db()
        .select()
        .from(marcaIngestas)
        .where(eq(marcaIngestas.id, mediaId))
        .get(),
    ).toBeUndefined();
    expect((await webhook(signed(estados))).status).toBe(200);
    expect(
      db()
        .select()
        .from(outbox)
        .where(and(eq(outbox.ownerId, user.id), eq(outbox.kind, "guion")))
        .get()?.delivery,
    ).toBe("read");
  });
  it("recorta salida extrema a una frase, 18 palabras y 240 caracteres", () => {
    for (const source of [
      "palabra ".repeat(500),
      "x".repeat(1000),
      "Primera frase. Segunda frase.",
      "",
    ]) {
      const answer = respuestaBreveWhatsApp(source);
      expect(answer.length).toBeLessThanOrEqual(240);
      expect(answer.split(/\s+/).length).toBeLessThanOrEqual(18);
    }
    expect(respuestaBreveWhatsApp("Primera frase. Segunda frase.")).toBe(
      "Primera frase.",
    );
  });
});
