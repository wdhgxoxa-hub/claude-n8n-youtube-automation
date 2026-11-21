import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  assets,
  bridgeCommands,
  channels,
  messages,
  users,
  videos,
  type User,
} from "@/db/schema";
import { FabricaN8n, FabricaSimulada } from "@/servicios/fabrica";
import { revocarConsentimiento } from "@/servicios/presentacion";
import { medioDisponible, eliminarMedio } from "@/servicios/biblioteca";
import { aplicarEstado } from "@/servicios/puente";
import { POST } from "@/app/api/n8n/webhook/route";
import {
  presentacionSchema,
  solicitudSchema,
  type SolicitudPuente,
} from "@/contratos/puente";
let owner: User, teammate: User, admin: User;
let avatar: string, voice: string, canal: string;
const secret = randomBytes(32).toString("hex");
const signed = (value: unknown) => {
  const raw = JSON.stringify(value),
    timestamp = String(Date.now());
  return new Request("http://localhost/api/n8n/webhook", {
    method: "POST",
    body: raw,
    headers: {
      "x-cooper-timestamp": timestamp,
      "x-cooper-signature":
        "sha256=" +
        createHmac("sha256", secret)
          .update(timestamp + "." + raw)
          .digest("hex"),
    },
  });
};
beforeEach(() => {
  vi.stubEnv("COOPER_WEBHOOK_SECRET", secret);
  vi.stubEnv("COOPER_N8N_TOKEN", secret);
  vi.stubEnv("COOPER_N8N_URL", "https://fabrica.example.test/cooper");
  const user = (role: "usuario" | "admin") =>
    db()
      .insert(users)
      .values({
        id: randomUUID(),
        email: randomUUID() + "@example.test",
        name: "Persona ficticia",
        role,
      })
      .returning()
      .get();
  owner = user("usuario");
  teammate = user("usuario");
  admin = user("admin");
  const asset = (kind: "avatar" | "voz", provider: string) => {
    const id = randomUUID();
    db()
      .insert(assets)
      .values({
        id,
        ownerId: owner.id,
        kind,
        name: kind,
        shared: true,
        verified: true,
        evidenceId: "ficticio",
        consentAt: Date.now(),
        provider,
        providerId: kind === "avatar" ? "look-elegido" : "voz-clonada",
        simulated: false,
        status: "listo",
        createdAt: Date.now(),
      })
      .run();
    return id;
  };
  avatar = asset("avatar", "heygen");
  voice = asset("voz", "elevenlabs");
  canal = randomUUID();
  db()
    .insert(channels)
    .values({
      id: canal,
      ownerId: teammate.id,
      name: "Canal",
      niche: "Ensayo",
      createdAt: Date.now(),
    })
    .run();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function encargar() {
  let request!: SolicitudPuente;
  const transport = vi.fn<typeof fetch>(async (_url, init) => {
    request = solicitudSchema.parse(JSON.parse(String(init?.body)));
    const reservation = await POST(
      signed({
        version: "cooper-v1",
        tipo: "orden",
        id_evento: request.id_evento,
        ejecucion: "ejecucion-ficticia",
        fase: "reservar",
        solicitud: request,
      }),
    );
    expect(reservation.status).toBe(200);
    return Response.json({ aceptado: true });
  });
  vi.stubGlobal("fetch", transport);
  const result = await new FabricaN8n({
    timeoutMs: 1000,
    backoffMs: 1,
  }).ejecutar(teammate, {
    evento: "nuevo_video",
    texto: "Video de ensayo",
    recursoId: canal,
    avatarId: avatar,
    voiceId: voice,
    avatarPlacement: "partes",
  });
  expect(transport).toHaveBeenCalledTimes(1);
  const input = {
    version: "cooper-v1" as const,
    tipo: "presentacion" as const,
    orden_id: request.id_evento,
    video_id: result.id,
    dueno_email: teammate.email,
    presentacion: presentacionSchema.parse(request.datos.presentacion),
    bloqueo: "",
  };
  return { input, transport, id: result.id, request };
}
it("el transporte recibe look, voz clonada y presencia; la consulta firmada revalida el sobre persistido", async () => {
  const { input, transport, id } = await encargar();
  expect(input.presentacion).toMatchObject({
    presencia: "partes",
    avatar: { id: "look-elegido", proveedor: "heygen" },
    voz: { id: "voz-clonada", proveedor: "elevenlabs" },
  });
  const response = await POST(signed(input));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ permitido: true });
  expect(
    db().select().from(videos).where(eq(videos.id, id)).get(),
  ).toMatchObject({
    avatarId: avatar,
    voiceId: voice,
    avatarPlacement: "partes",
  });
  const encoded = db()
    .select()
    .from(bridgeCommands)
    .where(eq(bridgeCommands.id, input.orden_id))
    .get()!.request;
  expect(encoded).not.toMatch(/evidenceId|consentText|ficticio/);
  expect(transport).toHaveBeenCalledTimes(1);
});
it("los interruptores y el presupuesto avisan una vez sin perder la selección; continuar limpia la pausa", async () => {
  const { input, id } = await encargar();
  for (const bloqueo of ["avatar_apagado", "voz_apagada", "presupuesto"]) {
    for (let n = 0; n < 2; n++) {
      const response = await POST(signed({ ...input, bloqueo }));
      expect(await response.json()).toMatchObject({
        permitido: false,
        estado: "pausada",
      });
    }
    const video = db().select().from(videos).where(eq(videos.id, id)).get()!;
    expect(video).toMatchObject({
      productionState: "pausada",
      avatarId: avatar,
      voiceId: voice,
    });
    expect(video.productionNotice).toMatch(/Conservamos/);
    expect(video.productionNotice).not.toMatch(/HeyGen|ElevenLabs|USD|token/);
  }
  expect(
    db()
      .select()
      .from(messages)
      .where(eq(messages.ownerId, teammate.id))
      .all()
      .filter((m) => m.content.includes("pausa")),
  ).toHaveLength(3);
  expect(await (await POST(signed(input))).json()).toMatchObject({
    permitido: true,
  });
  expect(
    db().select().from(videos).where(eq(videos.id, id)).get()?.productionNotice,
  ).toBe("");
});
it("retirar compartir bloquea nuevas selecciones; revocar cancela las aceptadas y ninguna firma antigua las reanuda", async () => {
  const { input, id, transport } = await encargar();
  db().update(assets).set({ shared: false }).where(eq(assets.id, avatar)).run();
  expect(() => medioDisponible(teammate, avatar, "avatar")).toThrow();
  expect(await (await POST(signed(input))).json()).toMatchObject({
    permitido: true,
  });
  expect(() => revocarConsentimiento(teammate, avatar)).toThrow();
  expect(() => revocarConsentimiento(admin, avatar)).toThrow();
  revocarConsentimiento(owner, avatar);
  revocarConsentimiento(owner, avatar);
  for (let n = 0; n < 2; n++)
    expect(await (await POST(signed(input))).json()).toMatchObject({
      permitido: false,
      estado: "cancelada",
    });
  expect(
    db().select().from(videos).where(eq(videos.id, id)).get(),
  ).toMatchObject({ productionState: "cancelada", avatarId: avatar });
  expect(
    db()
      .select()
      .from(messages)
      .where(eq(messages.ownerId, teammate.id))
      .all()
      .filter((m) => m.content.includes("revocó")),
  ).toHaveLength(1);
  expect(transport).toHaveBeenCalledTimes(1);
  const old = db().select().from(videos).where(eq(videos.id, id)).get()!;
  aplicarEstado(teammate, {
    canales: [],
    videos: [
      {
        id,
        dueno_email: teammate.email,
        canal_id: canal,
        titulo: old.title,
        stage: 11,
        script: "",
        actualizado_en: Date.now() + 100,
      },
    ],
  });
  expect(db().select().from(videos).where(eq(videos.id, id)).get()?.stage).toBe(
    old.stage,
  );
  await expect(new FabricaN8n().aprobar(teammate, id)).rejects.toThrow();
  await new FabricaSimulada().sincronizar(teammate);
  expect(db().select().from(videos).where(eq(videos.id, id)).get()?.stage).toBe(
    old.stage,
  );
});
it("revocar solo la voz cancela y borrar con fallo remoto mantiene la revocación durable", async () => {
  const { input, id } = await encargar();
  revocarConsentimiento(owner, voice);
  expect(await (await POST(signed(input))).json()).toMatchObject({
    permitido: false,
    estado: "cancelada",
  });
  expect(
    db().select().from(videos).where(eq(videos.id, id)).get()?.voiceId,
  ).toBe(voice);
  vi.stubEnv("HEYGEN_API_KEY", "credencial-ficticia");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("", { status: 503 })),
  );
  await expect(eliminarMedio(owner, avatar)).rejects.toThrow();
  expect(
    db().select().from(assets).where(eq(assets.id, avatar)).get()!
      .consentRevokedAt,
  ).toBeGreaterThan(0);
});
it("no basta una firma para cambiar IDs, dueño o selección; una consulta anónima falla antes de efectos", async () => {
  const { input } = await encargar();
  for (const change of [
    { orden_id: randomUUID() },
    { dueno_email: owner.email },
    { video_id: randomUUID() },
    {
      presentacion: {
        ...input.presentacion,
        avatar: { ...input.presentacion.avatar!, id: "otro-look" },
      },
    },
  ]) {
    const r = await POST(signed({ ...input, ...change }));
    expect([403, 409]).toContain(r.status);
  }
  const anonymous = await POST(
    new Request("http://localhost/api/n8n/webhook", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
  expect(anonymous.status).toBe(401);
  expect(
    db()
      .select()
      .from(messages)
      .where(eq(messages.ownerId, teammate.id))
      .all()
      .filter((m) => m.content.includes("cancelado")),
  ).toHaveLength(0);
});
