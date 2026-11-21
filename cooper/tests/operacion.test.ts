import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users, channels, events, videos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { leerOperacion, leerAjustes, controlar } from "@/servicios/operacion";
import { catalogo, controlSchema } from "@/contratos/operacion";
function cuenta(role: "admin" | "usuario" = "usuario") {
  const id = randomUUID();
  const user = db()
    .insert(users)
    .values({
      id,
      name: "Ensayo de cobertura",
      email: id + "@example.test",
      role,
    })
    .returning()
    .get();
  const canal = db()
    .insert(channels)
    .values({
      id: randomUUID(),
      ownerId: id,
      name: "Ciencia",
      niche: "Ciencia",
      createdAt: Date.now(),
    })
    .returning()
    .get();
  return { user, canal };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("la operación persiste biblia, plataformas, metas y cuenta por dueño", async () => {
  const { user, canal } = cuenta();
  const ajeno = cuenta();
  const base = { canalId: canal.id, confirmado: true };
  await controlar(user, {
    ...base,
    accion: "biblia",
    campo: "voz.tono",
    valor: "Cálido y preciso",
  });
  await controlar(user, {
    ...base,
    accion: "redes",
    perfil: "ciencia",
    redes: ["youtube", "instagram"],
    zona: "America/Lima",
  });
  await controlar(user, {
    ...base,
    accion: "metas",
    videos_semana: 4,
    formato: "short",
    auto: true,
    retencion_min: 0.6,
  });
  await controlar(user, {
    ...base,
    accion: "adoptar",
    cuenta: "@ciencia",
    red: "youtube",
  });
  const estado = await leerOperacion(user);
  expect(estado.canales).toHaveLength(1);
  const c = estado.canales[0];
  expect(c.biblia["voz.tono"]).toBe("Cálido y preciso");
  expect(c.redes).toEqual(["youtube", "instagram"]);
  expect(c.metas.videos_semana).toBe(4);
  expect(c.cuenta.handle).toBe("@ciencia");
  expect(JSON.stringify(await leerOperacion(ajeno.user))).not.toContain(
    "Cálido",
  );
  await expect(
    controlar(ajeno.user, { ...base, accion: "referencias" }),
  ).rejects.toMatchObject({ status: 404 });
  expect(
    db().select().from(events).where(eq(events.type, "control_fabrica")).all()
      .length,
  ).toBeGreaterThanOrEqual(4);
});
it("solo el administrador modifica presupuesto y ajustes, con revisión vigente y registro", async () => {
  const { user } = cuenta("admin"),
    normal = cuenta();
  await expect(leerAjustes(normal.user)).rejects.toMatchObject({ status: 403 });
  const anterior = await leerAjustes(user);
  await expect(
    controlar(normal.user, {
      accion: "ajustes",
      revision: anterior.revision,
      valores: { allowVoz: true },
      confirmado: true,
    }),
  ).rejects.toMatchObject({ status: 403 });
  await controlar(user, {
    accion: "ajustes",
    revision: anterior.revision,
    valores: { allowVoz: true, presupuestoShortUsd: 3.5 },
    confirmado: true,
  });
  const despues = await leerAjustes(user);
  expect(despues.valores.allowVoz).toBe(true);
  expect(despues.historial[0].actor).toBe(user.email);
  await expect(
    controlar(user, {
      accion: "ajustes",
      revision: anterior.revision,
      valores: { allowVoz: false },
      confirmado: true,
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    controlar(normal.user, {
      accion: "metas",
      canalId: normal.canal.id,
      videos_semana: 2,
      formato: "short",
      auto: false,
      retencion_min: 0.5,
      gasto_semana_usd: 20,
      confirmado: true,
    }),
  ).rejects.toMatchObject({ status: 403 });
  expect(JSON.stringify(await leerOperacion(normal.user))).not.toMatch(
    /presupuesto|allowVoz|USD/,
  );
});
it("rechaza cambios sin confirmar, campos de infraestructura y valores inválidos", () => {
  for (const valores of [
    { baseUrl: "https://ajeno.test" },
    { allowAvatar: "true" },
    { maxVideosDiaTotal: -1 },
    { maxVideosDiaTotal: 1.5 },
    { "calendario.zona": "No/Existe" },
    { presupuestoShortUsd: Infinity },
    { __proto__: { x: 1 } },
    { privacidadYoutube: "todos" },
  ])
    expect(
      controlSchema.safeParse({
        accion: "ajustes",
        revision: "r",
        valores,
        confirmado: true,
      }).success,
    ).toBe(false);
  expect(
    controlSchema.safeParse({
      accion: "ajustes",
      revision: "r",
      valores: { allowVoz: true },
    }).success,
  ).toBe(false);
  expect(
    controlSchema.safeParse({
      accion: "biblia",
      canalId: "c",
      campo: "__proto__.x",
      valor: "x",
      confirmado: true,
    }).success,
  ).toBe(false);
  expect(
    Object.keys(catalogo).filter((k) => k.startsWith("allow")).length,
  ).toBe(22);
});
it("aprobar y corregir no atraviesan otra puerta ni permiten decidir sobre videos ajenos", async () => {
  const { user, canal } = cuenta();
  const otro = cuenta();
  const id = randomUUID();
  db()
    .insert(videos)
    .values({
      id,
      channelId: canal.id,
      ownerId: user.id,
      title: "Lluvia",
      script: "Guion para revisar",
      stage: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .run();
  await expect(
    controlar(otro.user, {
      accion: "decidir",
      id,
      decision: "aprobar",
      cambios: "",
      confirmado: true,
    }),
  ).rejects.toMatchObject({ status: 409 });
  await controlar(user, {
    accion: "decidir",
    id,
    decision: "aprobar",
    cambios: "",
    confirmado: true,
  });
  expect(db().select().from(videos).where(eq(videos.id, id)).get()?.stage).toBe(
    4,
  );
  await expect(
    controlar(user, {
      accion: "decidir",
      id,
      decision: "aprobar",
      cambios: "",
      confirmado: true,
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("un video cancelado o una noticia sin verificar no se reanima mediante reintento", async () => {
  const { user, canal } = cuenta();
  for (const [state, news] of [
    ["cancelada", false],
    ["pausada", true],
  ] as const) {
    const id = randomUUID();
    db()
      .insert(videos)
      .values({
        id,
        ownerId: user.id,
        channelId: canal.id,
        title: "Noticia",
        script: "",
        stage: 2,
        newsMode: news,
        productionState: state,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .run();
    await expect(
      controlar(user, { accion: "reintentar", videoId: id, confirmado: true }),
    ).rejects.toMatchObject({ status: 409 });
  }
});
it("el puente transporta controles y consultas con registro de orden y nunca simula un éxito remoto", async () => {
  const { user, canal } = cuenta();
  const simulated = await leerOperacion(user);
  vi.stubEnv("COOPER_FABRICA", "n8n");
  vi.stubEnv("COOPER_N8N_URL", "https://fabrica.example.test/cooper/v1");
  vi.stubEnv("COOPER_N8N_TOKEN", "x".repeat(32));
  const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
    const b = JSON.parse(String(init.body));
    return Response.json(
      b.evento === "operacion"
        ? { ...simulated, modo: "n8n" }
        : { aceptado: true },
    );
  });
  vi.stubGlobal("fetch", fetch);
  expect((await leerOperacion(user)).modo).toBe("n8n");
  await controlar(user, {
    accion: "referencias",
    canalId: canal.id,
    confirmado: true,
  });
  const b = JSON.parse(String(fetch.mock.calls.at(-1)![1].body));
  expect(b.evento).toBe("control_fabrica");
  expect(b.dueno_email).toBe(user.email);
  expect(b.datos.accion).toBe("referencias");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ error: "Dato privado" }, { status: 409 }),
    ),
  );
  await expect(
    controlar(user, {
      accion: "referencias",
      canalId: canal.id,
      confirmado: true,
    }),
  ).rejects.toMatchObject({ status: 409 });
});

it("administración edita el canal de su dueño y las referencias persisten como campos estructurados", async () => {
  const admin = cuenta("admin"),
    owner = cuenta();
  await controlar(admin.user, {
    accion: "referencia",
    canalId: owner.canal.id,
    tipo: "personajes",
    id: "ana",
    descripcion: "Presentadora de pelo corto",
    urls: ["https://example.test/ana.png"],
    confirmado: true,
  });
  const op = await leerOperacion(owner.user);
  expect(op.canales[0].referencias[0].descripcion).toBe(
    "Presentadora de pelo corto",
  );
  expect(
    controlSchema.safeParse({
      accion: "referencia",
      canalId: owner.canal.id,
      tipo: "personajes",
      id: "ana",
      descripcion: "x",
      urls: ["file:///etc/passwd"],
      confirmado: true,
    }).success,
  ).toBe(false);
});
it("una decisión remota reserva el mismo identificador aunque cambie la respuesta", async () => {
  const { user } = cuenta();
  vi.stubEnv("COOPER_FABRICA", "n8n");
  vi.stubEnv("COOPER_N8N_URL", "https://fabrica.example.test/cooper/v1");
  vi.stubEnv("COOPER_N8N_TOKEN", "x".repeat(32));
  const solicitudes: { id_evento: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init: RequestInit) => {
      solicitudes.push(JSON.parse(String(init.body)));
      return Response.json({ aceptado: true });
    }),
  );
  for (const decision of ["aprobar", "cambios"])
    await controlar(user, {
      accion: "decidir",
      id: "ap-una",
      decision,
      cambios: "Más claridad",
      confirmado: true,
    });
  expect(solicitudes).toHaveLength(2);
  expect(solicitudes[0].id_evento).toBe(solicitudes[1].id_evento);
});
