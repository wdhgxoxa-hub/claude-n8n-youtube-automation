import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomUUID, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  allowedEmails,
  channels,
  videos,
  whatsappContacts as contacts,
  whatsappOutbox as outbox,
  whatsappDeliveries as deliveries,
  whatsappActions as actions,
  whatsappAttempts as attempts,
  type User,
  type AvisoWhatsApp,
} from "@/db/schema";
import { destinoRevision } from "@/lib/revision-whatsapp";
import { loginGoogle } from "@/lib/identidad";
import {
  solicitarCodigo,
  verificarCodigo,
  guardarPreferencias,
  estadoWhatsApp,
  contacto,
  sinAvisos,
  codigoVerificacion,
  DIA,
  HORA,
} from "@/servicios/mensajeria/cuentas";
import {
  encolarVideo,
  encolarGasto,
  construirMensaje,
  procesarCola,
  historial,
  revision,
} from "@/servicios/mensajeria/cola";
import { resolverEnlace, tokenRevision } from "@/servicios/mensajeria/enlaces";
import {
  WhatsAppCloudAPI,
  WhatsAppSimulada,
  ErrorMensajeria,
  proveedorMensajeria,
} from "@/servicios/mensajeria/proveedor";
import { FabricaSimulada, FabricaN8n } from "@/servicios/fabrica";
import { aplicarEstado } from "@/servicios/puente";
import { cicloMensajeria } from "@/servicios/mensajeria/trabajador";
import {
  GET as handshake,
  POST as webhook,
} from "@/app/api/whatsapp/webhook/route";
let active: User, ana: User, luis: User, admin: User;
vi.mock("@/lib/sesion", () => ({
  currentUser: async () =>
    db().select().from(users).where(eq(users.id, active.id)).get()!,
}));
import { POST, PATCH, GET } from "@/app/api/[...ruta]/route";
let now: number;
const factory = new FabricaSimulada();
beforeEach(() => {
  vi.useFakeTimers();
  now = Date.now();
  vi.stubEnv("WHATSAPP_APP_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", randomBytes(32).toString("hex"));
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123456789");
  vi.stubEnv("AUTH_URL", "http://localhost:3000");
  vi.stubEnv("COOPER_MENSAJERIA", "simulada");
  db().delete(attempts).run();
  db().delete(outbox).run();
  db().delete(actions).run();
  db().delete(contacts).run();
  db().delete(deliveries).run();
  db().delete(videos).run();
  db().delete(channels).run();
  db().update(users).set({ active: true }).run();
  admin = loginGoogle("admin@example.test", "Walter");
  for (const email of ["ana@example.test", "luis@example.test"])
    db()
      .insert(allowedEmails)
      .values({ email, createdAt: now })
      .onConflictDoNothing()
      .run();
  ana = loginGoogle("ana@example.test", "Ana");
  luis = loginGoogle("luis@example.test", "Luis");
  for (const [user, phone] of [
    [ana, "+51911111111"],
    [luis, "+51922222222"],
    [admin, "+51933333333"],
  ] as [User, string][]) {
    db()
      .update(users)
      .set({ whatsapp: phone, active: true })
      .where(eq(users.id, user.id))
      .run();
    user.whatsapp = phone;
  }
  active = ana;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
function verify(user = ana) {
  const result = solicitarCodigo(user, { consentimiento: true }, now);
  verificarCodigo(user, { codigo: result.codigoSimulado }, now);
  guardarPreferencias(
    user,
    { guion: true, final: true, publicado: true, gasto: user.role === "admin" },
    now,
  );
}
async function video(user = ana, stage = 3) {
  const c = await factory.ejecutar(user, {
    evento: "nuevo_canal",
    texto: "Canal ficticio",
  });
  const v = await factory.ejecutar(user, {
    evento: "nuevo_video",
    recursoId: c.id,
    texto: "Video ficticio",
  });
  db().update(videos).set({ stage }).where(eq(videos.id, v.id)).run();
  return db().select().from(videos).where(eq(videos.id, v.id)).get()!;
}
function jobs(user = ana) {
  return db()
    .select()
    .from(outbox)
    .where(and(eq(outbox.ownerId, user.id), eq(outbox.kind, "guion")))
    .all();
}
function envelope(value: object) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: { metadata: { phone_number_id: "123456789" }, ...value },
          },
        ],
      },
    ],
  };
}
function signed(payload: unknown, signature?: string) {
  const bytes = JSON.stringify(payload);
  return new Request("http://localhost:3000/api/whatsapp/webhook", {
    method: "POST",
    body: bytes,
    headers: {
      "X-Hub-Signature-256":
        signature ??
        `sha256=${createHmac("sha256", process.env.WHATSAPP_APP_SECRET!).update(bytes).digest("hex")}`,
    },
  });
}
async function inbound(body: string, user = ana, at = now, id = randomUUID()) {
  return webhook(
    signed(
      envelope({
        messages: [
          {
            id,
            from: user.whatsapp.slice(1),
            timestamp: String(Math.floor(at / 1000)),
            type: "text",
            text: { body },
          },
        ],
      }),
    ),
  );
}
async function click(
  job: AvisoWhatsApp,
  decision = "aprobar",
  user = ana,
  overrides = {},
) {
  return webhook(
    signed(
      envelope({
        messages: [
          {
            id: randomUUID(),
            from: user.whatsapp.slice(1),
            timestamp: String(Math.floor(now / 1000)),
            type: "interactive",
            context: { id: job.remoteId },
            interactive: {
              type: "button_reply",
              button_reply: {
                id: `${decision}:${job.id}`,
                title: "No se confía en este título",
              },
            },
            ...overrides,
          },
        ],
      }),
    ),
  );
}
async function route(
  method: "POST" | "PATCH" | "GET",
  path: string,
  input?: unknown,
) {
  return { POST, PATCH, GET }[method](
    new Request(`http://localhost:3000/api/${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    }),
    { params: Promise.resolve({ ruta: path.split("/") }) },
  );
}

describe("Número, consentimiento y aislamiento", () => {
  it("guardar número no autoriza; código y preferencias habilitan solo al dueño", async () => {
    const v = await video();
    encolarVideo(v);
    expect(jobs()).toHaveLength(0);
    expect(() => solicitarCodigo(ana, { consentimiento: false })).toThrow();
    const response = await route("POST", "whatsapp/codigo", {
      consentimiento: true,
    });
    const data = await response.json();
    expect(data.codigoSimulado).toMatch(/^\d{6}$/);
    expect(
      (
        await route("POST", "whatsapp/verificar", {
          codigo: data.codigoSimulado,
        })
      ).status,
    ).toBe(200);
    encolarVideo(v);
    expect(jobs()).toHaveLength(0);
    guardarPreferencias(ana, { guion: true, final: false, publicado: false });
    encolarVideo(v);
    encolarVideo(v);
    expect(jobs()).toHaveLength(1);
    expect(jobs()[0].ownerId).toBe(ana.id);
    active = luis;
    expect(await (await route("GET", "whatsapp")).json()).toEqual([]);
    expect(estadoWhatsApp(luis)).not.toHaveProperty("preferencias.gasto");
  });
  it("bloquea reutilización, cinco errores, caducidad y código de otro usuario", () => {
    const a = solicitarCodigo(ana, { consentimiento: true });
    const b = solicitarCodigo(luis, { consentimiento: true });
    expect(() => verificarCodigo(luis, { codigo: a.codigoSimulado })).toThrow();
    const wrong = a.codigoSimulado === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++)
      expect(() => verificarCodigo(ana, { codigo: wrong })).toThrow();
    expect(() => verificarCodigo(ana, { codigo: a.codigoSimulado })).toThrow();
    expect(contacto(ana.id)?.challengeAttempts).toBe(5);
    expect(() =>
      verificarCodigo(luis, { codigo: b.codigoSimulado }, now + 600001),
    ).toThrow();
    verificarCodigo(luis, { codigo: b.codigoSimulado });
    expect(() => verificarCodigo(luis, { codigo: b.codigoSimulado })).toThrow();
  });
  it("encola OTP sin almacenarlo en claro y usa la plantilla de autenticación", async () => {
    const requested = solicitarCodigo(ana, { consentimiento: true });
    const job = db()
      .select()
      .from(outbox)
      .where(eq(outbox.kind, "verificacion"))
      .get()!;
    const message = construirMensaje(job);
    expect(message.type).toBe("template");
    if (message.type === "template") {
      expect(message.template.name).toBe("cooper_verificar_numero");
      expect(message.template.components).toEqual([
        {
          type: "body",
          parameters: [{ type: "text", text: requested.codigoSimulado }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: requested.codigoSimulado }],
        },
      ]);
    }
    expect(job.detail).toBe("");
    expect(contacto(ana.id)?.challengeId).toBe(job.id);
    await procesarCola();
    expect(
      db().select().from(outbox).where(eq(outbox.id, job.id)).get()?.state,
    ).toBe("aceptado");
    verificarCodigo(ana, { codigo: codigoVerificacion(job.id) });
  });
  it("una nueva verificación del mismo teléfono invalida el enlace anterior", async () => {
    verify();
    encolarVideo(await video());
    const token = tokenRevision(jobs()[0]);
    vi.setSystemTime(now + HORA + 1);
    const result = solicitarCodigo(ana, { consentimiento: true });
    verificarCodigo(ana, { codigo: result.codigoSimulado });
    guardarPreferencias(ana, { ...sinAvisos, guion: true });
    expect(() => resolverEnlace(ana, token)).toThrow();
  });
  it("aplica límites persistentes por cuenta y teléfono al pedir OTP", () => {
    solicitarCodigo(ana, { consentimiento: true });
    expect(() => solicitarCodigo(ana, { consentimiento: true })).toThrow(
      "minuto",
    );
    solicitarCodigo(ana, { consentimiento: true }, now + 61000);
    solicitarCodigo(ana, { consentimiento: true }, now + 122000);
    expect(() =>
      solicitarCodigo(ana, { consentimiento: true }, now + 183000),
    ).toThrow();
    db()
      .update(users)
      .set({ whatsapp: ana.whatsapp })
      .where(eq(users.id, luis.id))
      .run();
    expect(() =>
      solicitarCodigo(luis, { consentimiento: true }, now + 183000),
    ).toThrow();
  });
  it("impide asociar un número verificado a dos cuentas", () => {
    verify();
    db()
      .update(users)
      .set({ whatsapp: ana.whatsapp })
      .where(eq(users.id, luis.id))
      .run();
    expect(() =>
      solicitarCodigo(luis, { consentimiento: true }, now + HORA + 1),
    ).toThrow();
  });
  it("revoca verificación, preferencias, enlaces y cola al cambiar el número", async () => {
    verify();
    const v = await video();
    encolarVideo(v);
    const token = tokenRevision(jobs()[0]);
    const response = await route("PATCH", "perfil", {
      name: "Ana",
      image: "",
      theme: "oscuro",
      home: "chat",
      whatsapp: "+51944444444",
    });
    expect(response.status).toBe(200);
    expect(contacto(ana.id)).toBeUndefined();
    expect(jobs()[0].state).toBe("cancelado");
    expect(() => resolverEnlace(ana, token)).toThrow();
  });
  it("no acepta una verificación simulada al activar el proveedor real", () => {
    verify();
    vi.stubEnv("COOPER_MENSAJERIA", "whatsapp");
    expect(estadoWhatsApp(ana).verificado).toBe(false);
    expect(() =>
      guardarPreferencias(ana, { ...sinAvisos, guion: true }),
    ).toThrow();
    const result = solicitarCodigo(
      ana,
      { consentimiento: true },
      now + HORA + 1,
    );
    expect(result).not.toHaveProperty("codigoSimulado");
    vi.stubEnv("COOPER_DEMO", "1");
    expect(proveedorMensajeria().simulada).toBe(true);
  });
});

describe("Enlaces y avisos", () => {
  it("firma caducable ligada a usuario, revisión y acceso sin aprobar por GET", async () => {
    verify();
    const v = await video();
    encolarVideo(v);
    const job = jobs()[0],
      token = tokenRevision(job);
    expect(resolverEnlace(ana, token)).toBe(`/videos/${v.id}`);
    expect(destinoRevision(token)).toBe(`/revisar/whatsapp/${token}`);
    expect(destinoRevision("https://ajeno.example/robar")).toBe("/");
    expect(destinoRevision([token])).toBe("/");
    expect(
      db().select().from(videos).where(eq(videos.id, v.id)).get()?.stage,
    ).toBe(3);
    for (const user of [luis, admin])
      expect(() => resolverEnlace(user, token)).toThrow();
    expect(() => resolverEnlace(ana, token.slice(0, -2) + "aa")).toThrow();
    expect(() => resolverEnlace(ana, token, now + DIA)).toThrow();
    db()
      .update(videos)
      .set({ updatedAt: now + 1 })
      .where(eq(videos.id, v.id))
      .run();
    expect(() => resolverEnlace(ana, token)).toThrow();
  });
  it("plantilla fuera de 24 h, botones dentro y plantilla al vencer antes del envío", async () => {
    verify();
    const v = await video();
    encolarVideo(v);
    const job = jobs()[0];
    expect(construirMensaje(job).type).toBe("template");
    db()
      .update(contacts)
      .set({ incomingAt: now })
      .where(eq(contacts.ownerId, ana.id))
      .run();
    const interactive = construirMensaje(job);
    expect(interactive.type).toBe("interactive");
    expect(JSON.stringify(interactive)).toContain(`aprobar:${job.id}`);
    db()
      .update(contacts)
      .set({ incomingAt: now - DIA })
      .where(eq(contacts.ownerId, ana.id))
      .run();
    expect(construirMensaje(job).type).toBe("template");
    expect(() => construirMensaje({ ...job, interactive: true })).toThrow(
      "ventana",
    );
  });
  it("final y publicado respetan preferencias; gastos son exclusivos de admin", async () => {
    verify();
    verify(admin);
    const final = await video(ana, 9),
      published = await video(ana, 11);
    encolarVideo(final);
    encolarVideo(published);
    encolarGasto(admin, "30.00 USD");
    encolarGasto(admin, "31.00 USD");
    expect(
      historial(ana)
        .filter((j) => j.tipo !== "verificacion")
        .map((j) => j.tipo)
        .sort(),
    ).toEqual(["final", "publicado"]);
    expect(historial(admin).filter((j) => j.tipo === "gasto")).toHaveLength(1);
    expect(() => encolarGasto(ana, "30.00 USD")).toThrow();
    expect(() =>
      guardarPreferencias(ana, { ...sinAvisos, gasto: true }),
    ).toThrow();
    const job = db()
      .select()
      .from(outbox)
      .where(eq(outbox.kind, "gasto"))
      .get()!;
    expect(construirMensaje(job).type).toBe("template");
    expect(resolverEnlace(admin, tokenRevision(job))).toBe("/admin");
  });
  it("encola atómicamente al avanzar simulación y aplicar estado n8n", async () => {
    verify();
    const v = await video(ana, 2);
    vi.setSystemTime(now + 1000);
    await factory.sincronizar(ana);
    expect(jobs()).toHaveLength(1);
    aplicarEstado(ana, {
      canales: [],
      videos: [
        {
          id: v.id,
          canal_id: v.channelId,
          dueno_email: ana.email,
          titulo: v.title,
          script: v.script,
          stage: 9,
          actualizado_en: now + 2000,
        },
      ],
    });
    expect(historial(ana).some((j) => j.tipo === "final")).toBe(true);
  });
  it("el consumidor descubre avisos sin depender de una pestaña SSE", async () => {
    verify();
    await video();
    await cicloMensajeria(now);
    expect(jobs()[0].state).toBe("aceptado");
  });
});

describe("Cola durable y transporte", () => {
  it("dos consumidores no duplican; conserva entrega simulada e idempotencia", async () => {
    verify();
    encolarVideo(await video());
    const provider = new WhatsAppSimulada();
    const spy = vi.spyOn(provider, "enviar");
    await Promise.all([procesarCola(provider), procesarCola(provider)]);
    await procesarCola(provider);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(jobs()[0]).toMatchObject({
      state: "aceptado",
      delivery: "delivered",
      attempts: 1,
    });
    expect(JSON.stringify(db().select().from(outbox).all())).not.toContain(
      "sha256=",
    );
  });
  it("reintenta fallos temporales con espera y termina tras cinco intentos", async () => {
    verify();
    encolarVideo(await video());
    const provider = new WhatsAppSimulada();
    const spy = vi
      .spyOn(provider, "enviar")
      .mockRejectedValue(new ErrorMensajeria("temporal", "130429", 45000));
    for (let i = 0; i < 5; i++) {
      await procesarCola(provider, now);
      const row = jobs()[0];
      expect(row.attempts).toBe(i + 1);
      expect(row.nextAt - now).toBeGreaterThanOrEqual(45000);
      now = row.nextAt;
      vi.setSystemTime(now);
    }
    expect(jobs()[0].state).toBe("fallido");
    await procesarCola(provider, now + HORA);
    expect(spy).toHaveBeenCalledTimes(5);
  });
  it.each(["permanente", "incierto"] as const)(
    "no reintenta un fallo %s",
    async (kind) => {
      verify();
      encolarVideo(await video());
      const provider = new WhatsAppSimulada();
      const spy = vi
        .spyOn(provider, "enviar")
        .mockRejectedValue(new ErrorMensajeria(kind, "ensayo"));
      await procesarCola(provider);
      await procesarCola(provider, now + HORA);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(jobs()[0].state).toBe(
        kind === "incierto" ? "incierto" : "fallido",
      );
    },
  );
  it("una reserva huérfana queda incierta y no se reenvía", async () => {
    verify();
    encolarVideo(await video());
    db()
      .update(outbox)
      .set({ state: "enviando", leaseAt: now - 61000 })
      .where(eq(outbox.id, jobs()[0].id))
      .run();
    const provider = new WhatsAppSimulada();
    const spy = vi.spyOn(provider, "enviar");
    await procesarCola(provider);
    expect(jobs()[0].state).toBe("incierto");
    expect(spy).not.toHaveBeenCalled();
  });
  it("limita a cinco intentos por hora y veinte por día por usuario", async () => {
    verify();
    for (let i = 0; i < 6; i++) encolarVideo(await video());
    const provider = new WhatsAppSimulada();
    const spy = vi.spyOn(provider, "enviar");
    for (let i = 0; i < 6; i++) await procesarCola(provider, now + i * 7000);
    expect(spy).toHaveBeenCalledTimes(5);
    expect(jobs().filter((j) => j.state === "pendiente")).toHaveLength(1);
    for (let i = 0; i < 15; i++)
      db()
        .insert(attempts)
        .values({
          id: randomUUID(),
          jobId: jobs()[0].id,
          ownerId: ana.id,
          createdAt: now - 2 * HORA,
        })
        .run();
    await procesarCola(provider, now + HORA + 1);
    expect(spy).toHaveBeenCalledTimes(5);
  });
  it.each(["baja", "suspension", "lista", "revision", "borrado"])(
    "revalida %s antes de despachar",
    async (reason) => {
      verify();
      const v = await video();
      encolarVideo(v);
      if (reason === "baja") guardarPreferencias(ana, sinAvisos);
      if (reason === "suspension")
        db()
          .update(users)
          .set({ active: false })
          .where(eq(users.id, ana.id))
          .run();
      if (reason === "lista")
        db()
          .delete(allowedEmails)
          .where(eq(allowedEmails.email, ana.email))
          .run();
      if (reason === "revision")
        db().update(videos).set({ stage: 4 }).where(eq(videos.id, v.id)).run();
      if (reason === "borrado")
        db().delete(videos).where(eq(videos.id, v.id)).run();
      const provider = new WhatsAppSimulada();
      const spy = vi.spyOn(provider, "enviar");
      await procesarCola(provider);
      expect(spy).not.toHaveBeenCalled();
      expect(jobs()[0].state).toBe("cancelado");
    },
  );
  it("Cloud API usa ruta oficial, Bearer, timeout, sin redirección y jamás filtra respuesta privada", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", randomBytes(32).toString("hex"));
    verify();
    encolarVideo(await video());
    const message = construirMensaje(jobs()[0]);
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ messages: [{ id: "wamid.ensayo" }] }));
    expect(await new WhatsAppCloudAPI(transport).enviar(message)).toEqual({
      id: "wamid.ensayo",
    });
    expect(transport.mock.calls[0][0]).toBe(
      "https://graph.facebook.com/v27.0/123456789/messages",
    );
    expect(transport.mock.calls[0][1]).toMatchObject({
      method: "POST",
      redirect: "error",
      cache: "no-store",
      body: JSON.stringify(message),
    });
    expect(transport.mock.calls[0][1]?.headers).toHaveProperty("Authorization");
    transport.mockResolvedValue(
      Response.json(
        { error: { code: 130429, message: "dato privado" } },
        { status: 429, headers: { "retry-after": "60" } },
      ),
    );
    await expect(
      new WhatsAppCloudAPI(transport).enviar(message),
    ).rejects.toMatchObject({
      clase: "temporal",
      codigo: "130429",
      esperaMs: 60000,
    });
    transport.mockRejectedValue(new Error("dato privado"));
    await expect(
      new WhatsAppCloudAPI(transport).enviar(message),
    ).rejects.toMatchObject({ clase: "incierto", codigo: "red" });
    transport.mockResolvedValue(Response.json({}));
    await expect(
      new WhatsAppCloudAPI(transport).enviar(message),
    ).rejects.toMatchObject({ clase: "incierto" });
  });
});

describe("Webhook firmado y decisiones", () => {
  it("valida desafío, firma sobre bytes, JSON, tamaño y Phone Number ID", async () => {
    const url = `http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=123&hub.verify_token=${process.env.WHATSAPP_VERIFY_TOKEN}`;
    const r = await handshake(new Request(url));
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("123");
    expect((await handshake(new Request(url + "x"))).status).toBe(403);
    expect(
      (await webhook(signed(envelope({}), "sha256=" + "0".repeat(64)))).status,
    ).toBe(401);
    expect((await webhook(signed(envelope({}), "SHA256=x"))).status).toBe(401);
    const oversized = "x".repeat(1024 * 1024 + 1);
    expect((await webhook(signed(oversized))).status).toBe(413);
    verify();
    const payload = envelope({
      metadata: { phone_number_id: "otro" },
      messages: [
        {
          id: randomUUID(),
          from: ana.whatsapp.slice(1),
          type: "text",
          text: { body: "hola" },
          timestamp: String(Math.floor(now / 1000)),
        },
      ],
    });
    expect((await webhook(signed(payload))).status).toBe(200);
    expect(contacto(ana.id)?.incomingAt).toBe(0);
  });
  it("mensaje entrante abre ventana; texto aprobar solo solicita botones y replay no duplica", async () => {
    verify();
    const v = await video();
    const id = randomUUID();
    await inbound("aprobar", ana, now, id);
    await inbound("aprobar", ana, now, id);
    expect(jobs()).toHaveLength(1);
    expect(jobs()[0].interactive).toBe(true);
    expect(
      db().select().from(videos).where(eq(videos.id, v.id)).get()?.stage,
    ).toBe(3);
    await procesarCola();
    expect(jobs()[0].interactive).toBe(true);
  });
  it.each(["aprobar", "cambios"])(
    "botón %s aplica exactamente una decisión de su dueño",
    async (decision) => {
      verify();
      const v = await video();
      await inbound("revisar");
      await procesarCola();
      const job = jobs()[0];
      expect((await click(job, decision)).status).toBe(200);
      await click(job, decision);
      await click(job, decision === "aprobar" ? "cambios" : "aprobar");
      expect(
        db().select().from(videos).where(eq(videos.id, v.id)).get()?.stage,
      ).toBe(decision === "aprobar" ? 4 : 1);
      expect(db().select().from(actions).all()).toMatchObject([
        { decision, state: "completada" },
      ]);
    },
  );
  it("rechaza botón ajeno, contexto falso, mensaje viejo y revisión obsoleta", async () => {
    verify();
    verify(luis);
    const v = await video();
    await inbound("hola");
    await procesarCola();
    const job = jobs()[0];
    await click(job, "aprobar", luis);
    await click(job, "aprobar", ana, { context: { id: "ajeno" } });
    await click(job, "aprobar", ana, {
      timestamp: String(Math.floor((now - DIA - 1) / 1000)),
    });
    db()
      .update(videos)
      .set({ updatedAt: now + 1 })
      .where(eq(videos.id, v.id))
      .run();
    await click(job);
    expect(db().select().from(actions).all()).toHaveLength(0);
    expect(
      db().select().from(videos).where(eq(videos.id, v.id)).get()?.stage,
    ).toBe(3);
  });
  it("baja revoca en el webhook y mensajes tardíos no reabren la ventana", async () => {
    verify();
    encolarVideo(await video());
    await inbound("baja");
    expect(contacto(ana.id)?.consentAt).toBe(0);
    expect(jobs()[0].state).toBe("cancelado");
    const last = contacto(ana.id)?.incomingAt;
    await inbound("hola", ana, now - DIA - 1);
    expect(contacto(ana.id)?.incomingAt).toBe(last);
  });
  it("BSUID sin teléfono se ignora sin rechazar el lote ni autorizar una acción", async () => {
    verify();
    const response = await webhook(
      signed(
        envelope({
          messages: [
            {
              id: randomUUID(),
              from_user_id: "US.ficticio",
              type: "text",
              text: { body: "aprobar" },
              timestamp: String(Math.floor(now / 1000)),
            },
          ],
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(contacto(ana.id)?.incomingAt).toBe(0);
  });
  it("una decisión ambigua queda para conciliación y no se repite", async () => {
    verify();
    await video();
    await inbound("hola");
    await procesarCola();
    const job = jobs()[0];
    const spy = vi
      .spyOn(FabricaSimulada.prototype, "aprobar")
      .mockRejectedValue(new Error("sin confirmación"));
    try {
      await click(job);
      await click(job);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(db().select().from(actions).all()).toMatchObject([
        { state: "incierta" },
      ]);
    } finally {
      spy.mockRestore();
    }
  });
  it("registra entregas duplicadas y fuera de orden sin retroceder de leído", async () => {
    verify();
    encolarVideo(await video());
    await procesarCola();
    const job = jobs()[0];
    for (const status of ["read", "sent", "read", "failed"])
      await webhook(
        signed(
          envelope({
            statuses: [
              {
                id: job.remoteId,
                recipient_id: ana.whatsapp.slice(1),
                timestamp: String(Math.floor(now / 1000)),
                status,
              },
            ],
          }),
        ),
      );
    expect(jobs()[0].delivery).toBe("read");
    expect(db().select().from(deliveries).all()).toHaveLength(4);
    expect(
      await webhook(
        signed(
          envelope({
            statuses: [
              {
                id: job.remoteId,
                recipient_id: luis.whatsapp.slice(1),
                timestamp: String(Math.floor(now / 1000)),
                status: "delivered",
              },
            ],
          }),
        ),
      ),
    ).toHaveProperty("status", 200);
    expect(jobs()[0].delivery).toBe("read");
  });
  it("las fábricas rechazan una revisión esperada obsoleta antes de enviar", async () => {
    const v = await video();
    await expect(factory.aprobar(ana, v.id, "3:0")).rejects.toThrow("revisión");
    await expect(new FabricaN8n().aprobar(ana, v.id, "3:0")).rejects.toThrow(
      "revisión",
    );
    await expect(
      factory.ejecutar(ana, {
        evento: "corregir",
        recursoId: v.id,
        texto: "Cambios",
        parametros: { revisionWhatsApp: "3:0" },
      }),
    ).rejects.toThrow("revisión");
    expect(revision(v)).not.toBe("3:0");
  });
});

it("los seis JSON tienen español, ejemplos, categorías y nombres compatibles con el emisor", () => {
  const files = readdirSync("whatsapp/plantillas");
  expect(files).toHaveLength(6);
  for (const file of files) {
    const template = JSON.parse(
      readFileSync(`whatsapp/plantillas/${file}`, "utf8"),
    );
    expect(template.language).toBe("es");
    expect(file).toBe(`${template.name}.json`);
    if (template.category === "AUTHENTICATION") {
      expect(template.components[2].buttons[0].otp_type).toBe("COPY_CODE");
      expect(template.components[1].code_expiration_minutes).toBe(10);
    } else {
      expect(template.category).toBe("UTILITY");
      expect(template.components[0].example.body_text[0]).toHaveLength(1);
      expect(template.components[2].buttons[0].url).toContain(
        "/revisar/whatsapp/{{1}}",
      );
    }
  }
});
