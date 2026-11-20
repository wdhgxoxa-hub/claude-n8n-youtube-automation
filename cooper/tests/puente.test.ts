import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bridgeCommands,
  bridgeReceipts,
  channels,
  events,
  users,
  videos,
  type User,
} from "@/db/schema";
import { FabricaN8n } from "@/servicios/fabrica";
import { aplicarEstado } from "@/servicios/puente";
import { estado, administracionActual } from "@/servicios/datos";
import { solicitudSchema, webhookSchema } from "@/contratos/puente";
import { POST } from "@/app/api/n8n/webhook/route";
let active: User;
vi.mock("@/lib/sesion", () => ({ currentUser: async () => active }));
import { GET as SSE } from "@/app/api/eventos/route";
let ana: User, luis: User, admin: User;
const channelId = randomUUID(),
  videoId = randomUUID();
const secret = randomBytes(32).toString("hex");
const factory = () => new FabricaN8n({ timeoutMs: 30, backoffMs: 1 });
const remote = (extra = {}) => ({
  id: videoId,
  canal_id: channelId,
  dueno_email: ana.email,
  titulo: "Cielo",
  stage: 3,
  script: "Guion real",
  actualizado_en: Date.now(),
  ...extra,
});
const progress = (extra = {}) => ({
  version: "cooper-v1",
  tipo: "progreso",
  id_evento: randomUUID(),
  video: remote(),
  ...extra,
});
const signed = (
  value: unknown,
  options: { timestamp?: number; signature?: string; body?: string } = {},
) => {
  const raw = JSON.stringify(value),
    timestamp = String(options.timestamp ?? Date.now());
  const signature =
    options.signature ??
    "sha256=" +
      createHmac("sha256", secret)
        .update(timestamp + "." + raw)
        .digest("hex");
  return new Request("http://localhost/api/n8n/webhook", {
    method: "POST",
    headers: {
      "x-cooper-timestamp": timestamp,
      "x-cooper-signature": signature,
    },
    body: options.body ?? raw,
  });
};
beforeAll(() => {
  const make = (email: string, role: "admin" | "usuario") => {
    const id = randomUUID();
    db().insert(users).values({ id, email, name: email, role }).run();
    return db().select().from(users).where(eq(users.id, id)).get()!;
  };
  ana = make("ana-puente@example.test", "usuario");
  luis = make("luis-puente@example.test", "usuario");
  admin = make("admin-puente@example.test", "admin");
  db()
    .insert(channels)
    .values({
      id: channelId,
      ownerId: ana.id,
      name: "Ciencia",
      niche: "Ciencia",
      createdAt: Date.now(),
    })
    .run();
  db()
    .insert(videos)
    .values({
      id: videoId,
      ownerId: ana.id,
      channelId,
      title: "Cielo",
      script: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .run();
});
beforeEach(() => {
  process.env.COOPER_WEBHOOK_SECRET = secret;
  process.env.COOPER_N8N_TOKEN = secret;
  process.env.COOPER_N8N_URL = "https://fabrica.example.test/webhook/cooper/v1";
  process.env.COOPER_FABRICA = "n8n";
  active = ana;
  db()
    .update(videos)
    .set({ stage: 0, remoteUpdatedAt: 0 })
    .where(eq(videos.id, videoId))
    .run();
});
afterEach(() => {
  vi.unstubAllGlobals();
  process.env.COOPER_FABRICA = "simulada";
});

describe("Contrato y receptor firmado", () => {
  it("rechaza cuerpos fuera de contrato", () => {
    expect(
      webhookSchema.safeParse({ ...progress(), token: "extra" }).success,
    ).toBe(false);
    expect(
      webhookSchema.safeParse(progress({ video: remote({ stage: 12 }) }))
        .success,
    ).toBe(false);
    expect(
      solicitudSchema.safeParse({ version: "cooper-v1", evento: "desconocido" })
        .success,
    ).toBe(false);
  });
  it("verifica la firma emitida por el workflow generado", async () => {
    const wf = JSON.parse(
      readFileSync("../workflows/v2/FabCooperProgr01.json", "utf8"),
    ) as { nodes: { name: string; parameters: { jsCode: string } }[] };
    const code = wf.nodes.find((n) => n.name === "Firmar progreso")!.parameters
      .jsCode;
    const event = progress();
    const result = new Function("$", "$env", "require", code)(
      () => ({ first: () => ({ json: event }) }),
      { COOPER_WEBHOOK_SECRET: secret },
      () => ({ createHmac }),
    ) as { json: { cuerpo: string; timestamp: string; firma: string } }[];
    const s = result[0].json;
    const response = await POST(
      new Request("http://localhost/api/n8n/webhook", {
        method: "POST",
        body: s.cuerpo,
        headers: {
          "x-cooper-timestamp": s.timestamp,
          "x-cooper-signature": s.firma,
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(
      db().select().from(videos).where(eq(videos.id, videoId)).get()?.script,
    ).toBe("Guion real");
  });
  it("rechaza firma falsa, timestamp vencido/futuro y cuerpo alterado", async () => {
    const event = progress();
    for (const request of [
      signed(event, { signature: "sha256=" + "0".repeat(64) }),
      signed(event, { timestamp: Date.now() - 301000 }),
      signed(event, { timestamp: Date.now() + 301000 }),
      signed(event, {
        body: JSON.stringify({ ...event, video: remote({ stage: 11 }) }),
      }),
    ]) {
      expect((await POST(request)).status).toBe(401);
    }
    expect(
      db()
        .select()
        .from(bridgeReceipts)
        .where(eq(bridgeReceipts.id, event.id_evento))
        .get(),
    ).toBeUndefined();
  });
  it("limita cuerpos y falla cerrado sin secreto", async () => {
    expect((await POST(signed({ text: "x".repeat(140000) }))).status).toBe(413);
    delete process.env.COOPER_WEBHOOK_SECRET;
    expect((await POST(signed(progress()))).status).toBe(503);
  });
  it("idempotencia durable y rechazo de ID repetido con otro cuerpo", async () => {
    const event = progress();
    expect((await POST(signed(event))).status).toBe(200);
    const second = await POST(signed(event));
    expect(await second.json()).toMatchObject({ duplicado: true });
    expect(
      db().select().from(events).where(eq(events.id, event.id_evento)).all(),
    ).toHaveLength(1);
    expect(
      (await POST(signed({ ...event, video: remote({ stage: 11 }) }))).status,
    ).toBe(409);
  });
  it("acepta eventos atrasados sin retroceder y permite correcciones nuevas", async () => {
    await POST(
      signed(progress({ video: remote({ stage: 9, actualizado_en: 300 }) })),
    );
    await POST(
      signed(progress({ video: remote({ stage: 3, actualizado_en: 200 }) })),
    );
    expect(
      db().select().from(videos).where(eq(videos.id, videoId)).get()?.stage,
    ).toBe(9);
    await POST(
      signed(progress({ video: remote({ stage: 1, actualizado_en: 400 }) })),
    );
    expect(
      db().select().from(videos).where(eq(videos.id, videoId)).get()?.stage,
    ).toBe(1);
  });
  it("una firma válida no permite cambiar el dueño ni el canal", async () => {
    for (const video of [
      remote({ dueno_email: luis.email }),
      remote({ canal_id: "ajeno" }),
    ]) {
      expect((await POST(signed(progress({ video })))).status).toBe(404);
    }
  });
  it("conciliación filtra dueño y no reasigna recursos existentes", () => {
    aplicarEstado(luis, { canales: [], videos: [remote({ stage: 11 })] });
    expect(
      db().select().from(videos).where(eq(videos.id, videoId)).get()?.stage,
    ).toBe(0);
    expect(() =>
      aplicarEstado(admin, {
        canales: [
          {
            id: channelId,
            dueno_email: luis.email,
            nombre: "Cambio",
            nicho: "Otro",
          },
        ],
        videos: [],
      }),
    ).toThrow();
    aplicarEstado(admin, { canales: [], videos: [remote({ stage: 4 })] });
    expect(
      db().select().from(videos).where(eq(videos.id, videoId)).get()?.stage,
    ).toBe(4);
  });
});

describe("Órdenes, transporte y administración", () => {
  it("reserva atómica por ejecución, confirma y recupera una respuesta perdida", async () => {
    const req = solicitudSchema.parse({
      version: "cooper-v1",
      id_evento: randomUUID(),
      evento: "nuevo_video",
      dueno_email: ana.email,
      admin: false,
      datos: { id: randomUUID() },
    });
    db()
      .insert(bridgeCommands)
      .values({
        id: req.id_evento,
        ownerId: ana.id,
        request: JSON.stringify(req),
        createdAt: Date.now(),
      })
      .run();
    const claim = {
      version: "cooper-v1",
      tipo: "orden",
      id_evento: req.id_evento,
      ejecucion: "a",
      fase: "reservar",
      solicitud: req,
    };
    const result = await Promise.all([
      POST(signed(claim)),
      POST(signed({ ...claim, ejecucion: "b" })),
    ]);
    expect(await result[0].json()).toEqual({ estado: "reservada" });
    expect(await result[1].json()).toEqual({ estado: "pendiente" });
    expect(
      await (await POST(signed({ ...claim, fase: "confirmar" }))).json(),
    ).toEqual({ estado: "confirmada" });
    expect(
      await (await POST(signed({ ...claim, ejecucion: "c" }))).json(),
    ).toEqual({ estado: "confirmada" });
    expect(
      (
        await POST(
          signed({ ...claim, solicitud: { ...req, dueno_email: luis.email } }),
        )
      ).status,
    ).toBe(409);
  });
  it("no reserva órdenes desconocidas aunque estén firmadas", async () => {
    const req = solicitudSchema.parse({
      version: "cooper-v1",
      id_evento: randomUUID(),
      evento: "nuevo_canal",
      dueno_email: ana.email,
      admin: false,
      datos: {},
    });
    expect(
      (
        await POST(
          signed({
            version: "cooper-v1",
            tipo: "orden",
            id_evento: req.id_evento,
            ejecucion: "a",
            fase: "reservar",
            solicitud: req,
          }),
        )
      ).status,
    ).toBe(409);
  });
  it("reintenta con backoff usando el mismo ID y persiste una sola orden", async () => {
    const bodies: string[] = [];
    const mock = vi.fn(async (_url: unknown, init: RequestInit) => {
      bodies.push(String(init.body));
      return new Response(
        JSON.stringify(bodies.length < 3 ? {} : { aceptado: true }),
        { status: bodies.length < 3 ? 503 : 200 },
      );
    });
    vi.stubGlobal("fetch", mock);
    await factory().ejecutar(ana, {
      evento: "nuevo_video",
      recursoId: channelId,
      texto: "Prueba de reintentos",
    });
    expect(bodies).toHaveLength(3);
    expect(new Set(bodies).size).toBe(1);
    expect(
      db()
        .select()
        .from(bridgeCommands)
        .where(eq(bridgeCommands.id, JSON.parse(bodies[0]).id_evento))
        .all(),
    ).toHaveLength(1);
  });
  it("timeouts reales de HTTP terminan y no exponen detalles", async () => {
    const server = createServer((_req, res) => {
      setTimeout(() => {
        if (!res.destroyed) res.end("{}");
      }, 100);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Puerto");
    process.env.COOPER_N8N_URL = `http://127.0.0.1:${address.port}`;
    try {
      await expect(factory().sincronizar(ana)).rejects.toThrow(
        "La fábrica no respondió",
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it("no reintenta rechazos, valida respuestas y no filtra errores del proveedor", async () => {
    const mock = vi.fn(
      async () => new Response("secreto-del-proveedor", { status: 403 }),
    );
    vi.stubGlobal("fetch", mock);
    await expect(factory().sincronizar(ana)).rejects.toThrow(
      "La fábrica rechazó",
    );
    expect(mock).toHaveBeenCalledTimes(1);
    mock.mockImplementation(
      async () => new Response(JSON.stringify({ videos: [{ stage: 700 }] })),
    );
    await expect(factory().sincronizar(ana)).rejects.toThrow("estado inválido");
  });
  it("aprobaciones envían nombres exactos del contrato y no adelantan la etapa", async () => {
    const mock = vi.fn(async () => new Response('{"aceptado":true}'));
    vi.stubGlobal("fetch", mock);
    for (const [stage, name] of [
      [3, "aprobar_guion"],
      [9, "aprobar_final"],
    ] as const) {
      db().update(videos).set({ stage }).where(eq(videos.id, videoId)).run();
      await factory().aprobar(ana, videoId);
      const args = mock.mock.calls.at(-1) as unknown as [string, RequestInit];
      expect(JSON.parse(String(args[1].body)).evento).toBe(name);
      expect(
        db().select().from(videos).where(eq(videos.id, videoId)).get()?.stage,
      ).toBe(stage);
    }
  });
  it("gastos del panel vienen de n8n y se rechazan antes de HTTP para usuarios", async () => {
    const mock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            gastos: [{ dueno_email: ana.email, dia: 30, semana: 50, mes: 100 }],
            estimados: true,
          }),
        ),
    );
    vi.stubGlobal("fetch", mock);
    await expect(factory().gastos(ana)).rejects.toThrow("administrador");
    expect(mock).not.toHaveBeenCalled();
    const result = await administracionActual(admin);
    expect(result.users.find((u) => u.id === ana.id)).toMatchObject({
      day: 30,
      week: 50,
      month: 100,
      alert: true,
    });
    expect(result.fuente).toBe("n8n_estimado");
    expect(JSON.stringify(estado(ana))).not.toMatch(
      /"gastos"|"amount"|"concept"/,
    );
  });
  it("eliminación remota confirmada y aislamiento antes de enviar HTTP", async () => {
    const id = randomUUID();
    db()
      .insert(videos)
      .values({
        id,
        channelId,
        ownerId: ana.id,
        title: "Borrar",
        script: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .run();
    const mock = vi.fn(async () => new Response('{"aceptado":true}'));
    vi.stubGlobal("fetch", mock);
    await expect(factory().eliminar(luis, id, "video")).rejects.toThrow();
    expect(mock).not.toHaveBeenCalled();
    await factory().eliminar(ana, id, "video");
    expect(
      db().select().from(videos).where(eq(videos.id, id)).get(),
    ).toBeUndefined();
  });
  it("SSE reemite el evento persistido y omite eventos de otros dueños y costos", async () => {
    const event = progress();
    await POST(signed(event));
    const foreign = randomUUID();
    db()
      .insert(events)
      .values({
        id: foreign,
        ownerId: luis.id,
        type: "progreso",
        payload: '{"id":"video-ajeno"}',
        createdAt: Date.now(),
      })
      .run();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"canales":[],"videos":[]}')),
    );
    const controller = new AbortController();
    const response = await SSE(
      new Request("http://localhost/api/eventos", {
        signal: controller.signal,
      }),
    );
    const reader = response.body!.getReader();
    let text = "";
    while (!text.includes("event: estado")) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += new TextDecoder().decode(chunk.value);
    }
    controller.abort();
    await reader.cancel();
    expect(text).toContain(`id: ${event.id_evento}`);
    expect(text).toContain("event: progreso");
    expect(text).not.toContain("video-ajeno");
    expect(text).not.toContain('"usd"');
  });
});
