import { randomUUID } from "node:crypto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  allowedEmails,
  users,
  chatActions,
  bridgeCommands,
  chatSessions,
  events,
  marcaIngestas,
  whatsappOutbox,
  whatsappDeliveries,
  whatsappActions,
  piezasMarca,
  cuentasMarca,
  type User,
} from "@/db/schema";
import {
  conciliarOperacion,
  consultarCaso,
  listarConciliacion,
} from "@/servicios/conciliacion";
import { vincularOrden } from "@/servicios/conciliacion-registro";
import { FabricaN8n } from "@/servicios/fabrica";
import { recibirWebhook } from "@/servicios/puente";
import { importarMediosWhatsApp } from "@/servicios/marcas/adjuntos-whatsapp";
import { whatsappContacts, attachments } from "@/db/schema";
import { solicitudSchema } from "@/contratos/puente";
import {
  guardarMarca,
  agregarCuenta,
  guardarPieza,
} from "@/servicios/marcas/servicio";
import { RedOficial, RedSimulada } from "@/servicios/marcas/redes";
let admin: User, ana: User, active: User;
vi.mock("@/lib/sesion", () => ({ currentUser: async () => active }));
import { GET, POST } from "@/app/api/admin/conciliacion/route";
function persona(role: User["role"] = "usuario") {
  const id = randomUUID(),
    email = `${id}@example.test`;
  db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  return db()
    .insert(users)
    .values({ id, email, name: "Ensayo", role })
    .returning()
    .get();
}
beforeEach(() => {
  admin = persona("admin");
  ana = persona();
  active = admin;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function chat(status = "revisar") {
  return db()
    .insert(chatActions)
    .values({
      id: randomUUID(),
      ownerId: ana.id,
      tool: "nuevo_canal",
      arguments: "{}",
      fingerprint: "prueba",
      channelId: "",
      title: "Ensayo",
      detail: "",
      status,
      createdAt: Date.now() - 600000,
      expiresAt: Date.now() + 600000,
    })
    .returning()
    .get();
}
function orden(confirmed = false) {
  const id = randomUUID();
  const request = solicitudSchema.parse({
    version: "cooper-v1",
    id_evento: id,
    evento: "nuevo_canal",
    dueno_email: ana.email,
    admin: false,
    datos: { id: randomUUID(), texto: "Ensayo" },
  });
  return db()
    .insert(bridgeCommands)
    .values({
      id,
      ownerId: ana.id,
      request: JSON.stringify(request),
      execution: "ejecucion-ficticia",
      confirmed,
      createdAt: Date.now() - 600000,
    })
    .returning()
    .get();
}
function decidir(
  tipo: Parameters<typeof consultarCaso>[1],
  id: string,
  extra = {},
) {
  const c = consultarCaso(admin, tipo, id);
  return { tipo, id, huella: c.huella, accion: "consultar", ...extra };
}
const evidencia = {
  accion: "confirmar",
  referencia: "informe-ensayo-001",
  comprobado: true,
  remoto: "resultado-ficticio",
};
it("rechaza usuario, rol forjado, admin revocado y origen ausente/cruzado", async () => {
  expect(() => listarConciliacion({ ...ana, role: "admin" })).toThrow();
  active = ana;
  expect(
    (await GET(new Request("http://localhost/api/admin/conciliacion"))).status,
  ).toBe(403);
  active = admin;
  for (const origin of [undefined, "https://ajeno.test"]) {
    const r = await POST(
      new Request("http://localhost/api/admin/conciliacion", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(origin ? { origin } : {}),
        },
        body: "{}",
      }),
    );
    expect(r.status).toBe(403);
  }
  db().update(users).set({ active: false }).where(eq(users.id, admin.id)).run();
  expect(() => listarConciliacion(admin)).toThrow();
});
it("no expone payloads, números, argumentos ni órdenes en el panel", () => {
  const a = chat();
  orden();
  db()
    .update(chatActions)
    .set({ arguments: '{"privado":"valor-no-publico"}' })
    .where(eq(chatActions.id, a.id))
    .run();
  expect(JSON.stringify(listarConciliacion(admin))).not.toContain(
    "valor-no-publico",
  );
});
it.each(["chat", "accion_whatsapp"] as const)(
  "%s se cierra por callback exacto sin invocar fábrica",
  async (tipo) => {
    const a =
      tipo === "chat"
        ? chat()
        : db()
            .insert(whatsappActions)
            .values({
              id: randomUUID(),
              ownerId: ana.id,
              decision: "aprobar",
              state: "incierta",
              createdAt: Date.now() - 600000,
            })
            .returning()
            .get();
    const o = orden(true);
    vincularOrden(ana.id, { tipo, id: a.id }, o.id);
    const r = await conciliarOperacion(admin, decidir(tipo, a.id));
    expect(r.estado).toBe(tipo === "chat" ? "confirmada" : "completada");
    expect(r.cierre?.fuente).toBe("callback_fabrica");
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("un callback ajeno no confirma; ausencia de evidencia conserva la tarjeta", async () => {
  const a = chat(),
    o = orden(true);
  db()
    .update(bridgeCommands)
    .set({ ownerId: admin.id })
    .where(eq(bridgeCommands.id, o.id))
    .run();
  vincularOrden(ana.id, { tipo: "chat", id: a.id }, o.id);
  const r = await conciliarOperacion(admin, decidir("chat", a.id));
  expect(r.estado).toBe("revisar");
  expect(r.cierre).toBeNull();
});
it("conserva reserva tras cierre administrativo, timeout y callback repetido", async () => {
  const o = orden();
  await conciliarOperacion(
    admin,
    decidir("fabrica", o.id, {
      accion: "archivar",
      referencia: "sin-evidencia-001",
      comprobado: true,
    }),
  );
  const r = db()
    .select()
    .from(bridgeCommands)
    .where(eq(bridgeCommands.id, o.id))
    .get()!;
  expect(r.execution).toBe(o.execution);
  expect(r.confirmed).toBe(false);
  expect(
    listarConciliacion(admin).casos.some(
      (c) => c.tipo === "fabrica" && c.id === o.id,
    ),
  ).toBe(false);
  expect(
    recibirWebhook(
      {
        version: "cooper-v1",
        tipo: "orden",
        fase: "reservar",
        ejecucion: "otra-ejecucion",
        id_evento: o.id,
        solicitud: JSON.parse(o.request),
      },
      "",
    ),
  ).toEqual({ estado: "pendiente" });
  expect(fetch).not.toHaveBeenCalled();
});
it("exige la ejecución exacta y evidencia para cerrar una reserva como confirmada", async () => {
  const o = orden();
  await expect(
    conciliarOperacion(admin, decidir("fabrica", o.id, evidencia)),
  ).rejects.toMatchObject({ status: 409 });
  const r = await conciliarOperacion(
    admin,
    decidir("fabrica", o.id, { ...evidencia, remoto: o.execution }),
  );
  expect(r.estado).toBe("confirmada");
  expect(r.cierre?.fuente).toBe("revision_administrativa");
});
it("rechaza versión antigua, ejecución activa, decisión incompleta y doble cierre concurrente", async () => {
  const a = chat("ejecutando");
  db()
    .insert(chatSessions)
    .values({ ownerId: ana.id, lease: "ensayo", busyUntil: Date.now() + 60000 })
    .run();
  await expect(
    conciliarOperacion(admin, decidir("chat", a.id, evidencia)),
  ).rejects.toMatchObject({ status: 409 });
  db()
    .update(chatSessions)
    .set({ busyUntil: 0 })
    .where(eq(chatSessions.ownerId, ana.id))
    .run();
  const stale = decidir("chat", a.id, evidencia);
  db()
    .update(chatActions)
    .set({ status: "revisar" })
    .where(eq(chatActions.id, a.id))
    .run();
  await expect(conciliarOperacion(admin, stale)).rejects.toMatchObject({
    status: 409,
  });
  await expect(
    conciliarOperacion(admin, decidir("chat", a.id, { accion: "confirmar" })),
  ).rejects.toMatchObject({ status: 400 });
  const d = decidir("chat", a.id, evidencia);
  const results = await Promise.allSettled([
    conciliarOperacion(admin, d),
    conciliarOperacion(admin, d),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([
    "fulfilled",
    "rejected",
  ]);
  expect(
    db()
      .select()
      .from(events)
      .where(eq(events.id, `conciliacion:chat:${a.id}`))
      .all(),
  ).toHaveLength(1);
});
function aviso() {
  return db()
    .insert(whatsappOutbox)
    .values({
      id: randomUUID(),
      dedupeKey: randomUUID(),
      ownerId: ana.id,
      phone: "+51911111111",
      kind: "guion",
      state: "incierto",
      createdAt: Date.now() - 600000,
      nextAt: 0,
      expiresAt: Date.now() + 600000,
    })
    .returning()
    .get();
}
it("WhatsApp exige recibo del destinatario, fecha y remoto exclusivo; no convierte ausencia en fallo", async () => {
  const a = aviso(),
    remote = `wamid.${randomUUID()}`;
  const d = decidir("whatsapp", a.id, { ...evidencia, remoto: remote });
  await expect(conciliarOperacion(admin, d)).rejects.toMatchObject({
    status: 409,
  });
  db()
    .insert(whatsappDeliveries)
    .values({
      id: `${remote}:read`,
      remoteId: remote,
      phone: "+51922222222",
      state: "read",
      occurredAt: Date.now(),
    })
    .run();
  await expect(conciliarOperacion(admin, d)).rejects.toMatchObject({
    status: 409,
  });
  db()
    .update(whatsappDeliveries)
    .set({ phone: a.phone, occurredAt: a.createdAt - 10000 })
    .where(eq(whatsappDeliveries.remoteId, remote))
    .run();
  await expect(conciliarOperacion(admin, d)).rejects.toMatchObject({
    status: 409,
  });
  db()
    .update(whatsappDeliveries)
    .set({ occurredAt: Date.now() })
    .where(eq(whatsappDeliveries.remoteId, remote))
    .run();
  expect((await conciliarOperacion(admin, d)).estado).toBe("aceptado");
  const b = aviso();
  await expect(
    conciliarOperacion(
      admin,
      decidir("whatsapp", b.id, { ...evidencia, remoto: remote }),
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect(fetch).not.toHaveBeenCalled();
});
it("ingesta interrumpida se cierra sin crear adjuntos ni reencolar", async () => {
  const a = db()
    .insert(marcaIngestas)
    .values({
      id: randomUUID(),
      ownerId: ana.id,
      mediaId: "12345",
      caption: "",
      estado: "descargando",
      intentos: 1,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  await expect(
    conciliarOperacion(admin, decidir("ingesta", a.id, evidencia)),
  ).rejects.toMatchObject({ status: 409 });
  const r = await conciliarOperacion(
    admin,
    decidir("ingesta", a.id, { ...evidencia, accion: "archivar" }),
  );
  expect(r.estado).toBe("cancelada");
  expect(r.cierre?.accion).toBe("cerrada_sin_reenvio");
});
function pieza(red: "youtube" | "facebook" = "youtube") {
  const m = guardarMarca(ana, { nombre: "Ensayo", rubro: "general" });
  const c = agregarCuenta(ana, m.id, {
    red,
    alias: "Ensayo",
    remoto: randomUUID(),
  });
  db()
    .update(cuentasMarca)
    .set({ estado: "conectada" })
    .where(eq(cuentasMarca.id, c.id))
    .run();
  const p = guardarPieza(ana, m.id, {
    cuentaId: c.id,
    formato: "reel",
    plantilla: "libre",
    titulo: "Ensayo",
    texto: "Texto de ensayo",
    programada: new Date(Date.now() + 600000).toISOString(),
  });
  db()
    .update(piezasMarca)
    .set({ estado: "revision", checkpoint: { envio: `marca-${p.id}-1` } })
    .where(eq(piezasMarca.id, p.id))
    .run();
  return {
    p: db().select().from(piezasMarca).where(eq(piezasMarca.id, p.id)).get()!,
    c: db().select().from(cuentasMarca).where(eq(cuentasMarca.id, c.id)).get()!,
  };
}
it("consulta de Upload-Post usa el envío persistido y solo GET, con coincidencia estricta", async () => {
  const { p, c } = pieza();
  let match = false;
  const transport = vi.fn(
    async (url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.method).toBe("GET");
      expect(String(url)).toContain("request_id=marca-");
      return Response.json({
        history: [
          {
            request_id: p.checkpoint.envio,
            profile_username: match ? c.remoto : "ajeno",
            platform: "youtube",
            success: true,
            post_url: "https://youtube.com/watch?v=ensayo",
          },
        ],
      });
    },
  );
  const red = new RedOficial(transport as typeof fetch, {
    meta: "ficticio",
    upload: "ficticio",
    version: "v27.0",
  });
  expect((await red.consultarPublicacion(c, p)).publicada).toBe(false);
  match = true;
  expect(await red.consultarPublicacion(c, p)).toEqual({
    publicada: true,
    remoto: p.checkpoint.envio,
  });
});
it("consulta marca jamás llama publicar y revalida dueño y cambios durante la respuesta", async () => {
  const { p } = pieza();
  const red = Object.assign(new RedSimulada(), {
    consultarPublicacion: vi.fn(async () => ({
      publicada: true,
      remoto: "post-ensayo",
    })),
  });
  const publicar = vi.spyOn(red, "publicar");
  const r = await conciliarOperacion(admin, decidir("marca", p.id), red);
  expect(r.estado).toBe("publicada");
  expect(publicar).not.toHaveBeenCalled();
  const b = pieza();
  red.consultarPublicacion.mockImplementationOnce(async () => {
    db().update(users).set({ active: false }).where(eq(users.id, ana.id)).run();
    return { publicada: true, remoto: "post-ensayo" };
  });
  await expect(
    conciliarOperacion(admin, decidir("marca", b.p.id), red),
  ).rejects.toMatchObject({ status: 403 });
  expect(consultarCaso(admin, "marca", b.p.id).estado).toBe("revision");
});
it("persiste vínculo chat-orden antes de contactar al transporte", async () => {
  const a = chat();
  vi.stubEnv("COOPER_N8N_URL", "http://127.0.0.1:9999/ficticio");
  vi.stubEnv("COOPER_N8N_TOKEN", "ficticio");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_u, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      expect(consultarCaso(admin, "chat", a.id).referencia).toBe(
        request.id_evento,
      );
      return Response.json({ aceptado: true });
    }),
  );
  await new FabricaN8n(undefined, { tipo: "chat", id: a.id }).request(
    ana,
    "nuevo_canal",
    { id: randomUUID(), texto: "Ensayo" },
  );
});

it.each([false, true])(
  "ingesta cercada conserva el cierre ante respuesta tardía (fallo=%s)",
  async (fallo) => {
    vi.stubEnv("WHATSAPP_TOKEN", "ficticio");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "12345");
    const phone = `+519${Math.floor(Math.random() * 1e8)
      .toString()
      .padStart(8, "0")}`;
    db()
      .update(users)
      .set({ whatsapp: phone })
      .where(eq(users.id, ana.id))
      .run();
    db()
      .insert(whatsappContacts)
      .values({
        ownerId: ana.id,
        phone,
        verifiedAt: Date.now(),
        consentAt: Date.now(),
      })
      .run();
    const job = db()
      .insert(marcaIngestas)
      .values({
        id: randomUUID(),
        ownerId: ana.id,
        mediaId: "12345",
        caption: "Ensayo",
        createdAt: Date.now(),
      })
      .returning()
      .get();
    let terminar!: (r: Response) => void;
    let rechazar!: (e: Error) => void;
    const pending = new Promise<Response>((resolve, reject) => {
      terminar = resolve;
      rechazar = reject;
    });
    const jpeg = Buffer.from("ffd8ffffd9", "hex");
    const work = importarMediosWhatsApp(async (url) =>
      String(url).includes("graph.facebook.com") ? pending : new Response(jpeg),
    );
    await conciliarOperacion(
      admin,
      decidir("ingesta", job.id, { ...evidencia, accion: "archivar" }),
    );
    if (fallo) rechazar(new Error("respuesta ficticia perdida"));
    else
      terminar(
        Response.json({
          url: "https://lookaside.fbsbx.com/ensayo",
          mime_type: "image/jpeg",
          file_size: jpeg.length,
        }),
      );
    await work;
    expect(consultarCaso(admin, "ingesta", job.id).estado).toBe("cancelada");
    expect(
      db()
        .select()
        .from(attachments)
        .where(eq(attachments.ownerId, ana.id))
        .all(),
    ).toHaveLength(0);
  },
);
