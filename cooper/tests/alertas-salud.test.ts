import { randomUUID } from "node:crypto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { allowedEmails, events, users, type User } from "@/db/schema";
import {
  umbralesSaludPredeterminados,
  type SaludOperativa,
} from "@/contratos/salud-operativa";
import {
  cicloAlertasSalud,
  enviarTelegramSalud,
  guardarConfiguracionSalud,
  leerConfiguracionSalud,
  leerTelegramSalud,
} from "@/servicios/alertas-salud";
let admin: User, normal: User, active: User;
vi.mock("@/lib/sesion", () => ({ currentUser: async () => active }));
import { GET, POST } from "@/app/api/admin/salud/route";
function persona(role: User["role"]) {
  const id = randomUUID(),
    email = `${id}@example.test`;
  db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  return db()
    .insert(users)
    .values({ id, email, name: "Ensayo salud", role })
    .returning()
    .get();
}
beforeEach(() => {
  db()
    .delete(events)
    .where(
      inArray(events.id, [
        "observabilidad:configuracion",
        "observabilidad:telegram",
      ]),
    )
    .run();
  db()
    .update(users)
    .set({ active: false })
    .where(eq(users.role, "admin"))
    .run();
  admin = persona("admin");
  normal = persona("usuario");
  active = admin;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function configurar(enabled = true) {
  return guardarConfiguracionSalud(admin, {
    ...leerConfiguracionSalud(admin),
    telegramActivo: enabled,
    confirmado: true,
  });
}
function salud(alerta = true): SaludOperativa {
  // El consumidor solo recibe la proyección ya saneada del recolector.
  return {
    modo: "n8n",
    alertas: alerta
      ? [
          {
            codigo: "vps:disco",
            fuente: "vps",
            severidad: "critica",
            titulo: "Disco bajo",
            detalle: "Queda menos del umbral configurado.",
          },
        ]
      : [],
  } as unknown as SaludOperativa;
}
const base = 1800000000000;
it("configuración validada con revisión atómica, confirmación y auditoría privada", () => {
  const first = leerConfiguracionSalud(admin);
  expect(first.telegramActivo).toBe(false);
  expect(() =>
    guardarConfiguracionSalud(normal, { ...first, confirmado: true }),
  ).toThrow();
  expect(() => guardarConfiguracionSalud(admin, first)).toThrow();
  const value = guardarConfiguracionSalud(admin, {
    ...first,
    confirmado: true,
    umbrales: { ...umbralesSaludPredeterminados, certificadoDias: 20 },
  });
  expect(leerConfiguracionSalud(admin)).toEqual(value);
  expect(() =>
    guardarConfiguracionSalud(admin, { ...first, confirmado: true }),
  ).toThrow("cambiaron");
  expect(() =>
    guardarConfiguracionSalud(admin, {
      ...value,
      confirmado: true,
      umbrales: { ...value.umbrales, memoriaUsadaPorcentaje: 101 },
    }),
  ).toThrow();
  expect(
    db()
      .select()
      .from(events)
      .where(eq(events.type, "observabilidad:ajustes"))
      .all()
      .some((e) => e.ownerId === admin.id),
  ).toBe(true);
});
it("rechaza roles forjados y acceso revocado en la capa de servicio", () => {
  expect(() => leerConfiguracionSalud({ ...normal, role: "admin" })).toThrow();
  db().update(users).set({ active: false }).where(eq(users.id, admin.id)).run();
  expect(() => leerTelegramSalud(admin)).toThrow();
});
it("API protege lecturas y escrituras, origen y MIME; consultar nunca envía Telegram", async () => {
  active = normal;
  expect((await GET()).status).toBe(403);
  expect(
    (
      await POST(
        new Request("https://cooper.test/api/admin/salud", { method: "POST" }),
      )
    ).status,
  ).toBe(403);
  active = admin;
  const config = leerConfiguracionSalud(admin);
  for (const origin of [undefined, "https://ajeno.test"]) {
    expect(
      (
        await POST(
          new Request("https://cooper.test/api/admin/salud", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(origin ? { origin } : {}),
            },
            body: JSON.stringify({ ...config, confirmado: true }),
          }),
        )
      ).status,
    ).toBe(403);
  }
  expect(
    (
      await POST(
        new Request("https://cooper.test/api/admin/salud", {
          method: "POST",
          headers: {
            origin: "https://cooper.test",
            "content-type": "text/plain",
          },
          body: "{}",
        }),
      )
    ).status,
  ).toBe(415);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(fetch).not.toHaveBeenCalled();
  expect(JSON.stringify(await response.json())).not.toContain("BOT_TOKEN");
});
it("deduplica sin navegador, recuerda incidencias y avisa la recuperación una sola vez", async () => {
  vi.stubEnv("COOPER_FABRICA", "n8n");
  configurar();
  const enviar = vi.fn(async () => ({ entrega: "enviado" as const }));
  const consultar = vi.fn(async () => salud());
  await cicloAlertasSalud({ ahora: base, enviar, consultar });
  await cicloAlertasSalud({ ahora: base + 60000, enviar, consultar });
  expect(enviar).toHaveBeenCalledTimes(1);
  await cicloAlertasSalud({ ahora: base + 360 * 60000, enviar, consultar });
  expect(enviar).toHaveBeenCalledTimes(2);
  consultar.mockResolvedValue(salud(false));
  await cicloAlertasSalud({ ahora: base + 361 * 60000, enviar, consultar });
  await cicloAlertasSalud({ ahora: base + 362 * 60000, enviar, consultar });
  expect(enviar).toHaveBeenCalledTimes(3);
  expect(enviar.mock.calls.at(-1)).toEqual([
    expect.stringContaining("resuelto"),
  ]);
  expect(leerTelegramSalud(admin)).toMatchObject({
    entrega: "enviado",
    pendientes: 0,
  });
});
it("no evalúa ni envía si está apagado, en demo o simulación", async () => {
  const consultar = vi.fn(async () => salud()),
    enviar = vi.fn(async () => ({ entrega: "enviado" as const }));
  configurar();
  await cicloAlertasSalud({ ahora: base, consultar, enviar });
  vi.stubEnv("COOPER_FABRICA", "n8n");
  vi.stubEnv("COOPER_DEMO", "1");
  await cicloAlertasSalud({ ahora: base, consultar, enviar });
  vi.stubEnv("COOPER_DEMO", "0");
  vi.stubEnv("COOPER_OBSERVABILIDAD_PAUSA", "1");
  await cicloAlertasSalud({ ahora: base, consultar, enviar });
  vi.stubEnv("COOPER_OBSERVABILIDAD_PAUSA", "0");
  configurar(false);
  await cicloAlertasSalud({ ahora: base, consultar, enviar });
  expect(consultar).not.toHaveBeenCalled();
  expect(enviar).not.toHaveBeenCalled();
});
it("reserva durable evita dos consumidores y un cambio durante consulta impide enviar", async () => {
  vi.stubEnv("COOPER_FABRICA", "n8n");
  configurar();
  let resolver!: (value: SaludOperativa) => void;
  const consultar = vi.fn(
    () =>
      new Promise<SaludOperativa>((resolve) => {
        resolver = resolve;
      }),
  );
  const enviar = vi.fn(async () => ({ entrega: "enviado" as const }));
  const first = cicloAlertasSalud({ ahora: base, consultar, enviar });
  await cicloAlertasSalud({ ahora: base, consultar, enviar });
  expect(consultar).toHaveBeenCalledTimes(1);
  configurar(false);
  resolver(salud());
  await first;
  expect(enviar).not.toHaveBeenCalled();
});
it("fallo confirmado usa espera; resultado incierto no se reenvía al siguiente pulso", async () => {
  vi.stubEnv("COOPER_FABRICA", "n8n");
  configurar();
  const consultar = vi.fn(async () => salud());
  const enviar = vi.fn(async () => ({
    entrega: "fallido" as "fallido" | "incierto",
    reintentarEn: 300000,
  }));
  await cicloAlertasSalud({ ahora: base, consultar, enviar });
  await cicloAlertasSalud({ ahora: base + 60000, consultar, enviar });
  expect(enviar).toHaveBeenCalledTimes(1);
  enviar.mockResolvedValue({ entrega: "incierto", reintentarEn: 300000 });
  await cicloAlertasSalud({ ahora: base + 300000, consultar, enviar });
  await cicloAlertasSalud({ ahora: base + 360000, consultar, enviar });
  expect(enviar).toHaveBeenCalledTimes(2);
  expect(leerTelegramSalud(admin).entrega).toBe("incierto");
});
it("conserva incertidumbre después de caída sin repetir inmediatamente un despacho", async () => {
  vi.stubEnv("COOPER_FABRICA", "n8n");
  configurar();
  db()
    .update(events)
    .set({
      payload: JSON.stringify({
        lease: "caido",
        leaseHasta: base - 1,
        siguiente: 0,
        evaluado: base - 60000,
        enviado: 0,
        intento: base - 60000,
        proximoEnvio: base + 360 * 60000,
        intentados: ["vps:disco:critica"],
        entrega: "incierto",
        notificados: [],
        pendientes: ["vps:disco"],
      }),
    })
    .where(eq(events.id, "observabilidad:telegram"))
    .run();
  const consultar = vi.fn(async () => salud()),
    enviar = vi.fn(async () => ({ entrega: "enviado" as const }));
  await cicloAlertasSalud({ ahora: base, consultar, enviar });
  await cicloAlertasSalud({ ahora: base + 60000, consultar, enviar });
  expect(enviar).not.toHaveBeenCalled();
  expect(leerTelegramSalud(admin).entrega).toBe("incierto");
});
it("evalúa durante incertidumbre, conserva espera al guardar y detecta un incidente nuevo", async () => {
  vi.stubEnv("COOPER_FABRICA", "n8n");
  configurar();
  const consultar = vi.fn(async () => salud());
  const enviar = vi.fn(async () => ({ entrega: "incierto" as const }));
  await cicloAlertasSalud({ ahora: base, consultar, enviar });
  configurar();
  await cicloAlertasSalud({ ahora: base + 60000, consultar, enviar });
  expect(consultar).toHaveBeenCalledTimes(2);
  expect(enviar).toHaveBeenCalledTimes(1);
  const updated = salud();
  updated.alertas.push({
    codigo: "n8n_fuente",
    fuente: "n8n",
    severidad: "critica",
    titulo: "n8n no disponible",
    detalle: "La conexión falló.",
  });
  consultar.mockResolvedValue(updated);
  await cicloAlertasSalud({ ahora: base + 120000, consultar, enviar });
  expect(enviar).toHaveBeenCalledTimes(2);
  expect(leerTelegramSalud(admin).pendientes).toBe(2);
});
it("guardar umbrales no elude retry_after aunque aparezca otro incidente", async () => {
  vi.stubEnv("COOPER_FABRICA", "n8n");
  configurar();
  const consultar = vi.fn(async () => salud());
  const enviar = vi.fn(async () => ({
    entrega: "fallido" as const,
    reintentarEn: 1200000,
  }));
  await cicloAlertasSalud({ ahora: base, consultar, enviar });
  configurar();
  await cicloAlertasSalud({ ahora: base + 60000, consultar, enviar });
  expect(enviar).toHaveBeenCalledTimes(1);
  expect(consultar).toHaveBeenCalledTimes(2);
  await cicloAlertasSalud({ ahora: base + 1200000, consultar, enviar });
  expect(enviar).toHaveBeenCalledTimes(2);
});
it("informa recuperación tras un aviso incierto inicial y no vuelve a enviarla", async () => {
  vi.stubEnv("COOPER_FABRICA", "n8n");
  configurar();
  const consultar = vi.fn(async () => salud());
  const enviar = vi.fn(async () => ({
    entrega: "incierto" as "incierto" | "enviado",
  }));
  await cicloAlertasSalud({ ahora: base, consultar, enviar });
  consultar.mockResolvedValue(salud(false));
  enviar.mockResolvedValue({ entrega: "enviado" });
  await cicloAlertasSalud({ ahora: base + 60000, consultar, enviar });
  await cicloAlertasSalud({ ahora: base + 120000, consultar, enviar });
  expect(enviar).toHaveBeenCalledTimes(2);
  expect(enviar.mock.calls.at(-1)).toEqual([
    expect.stringContaining("resuelto"),
  ]);
});
it("respuesta tardía de un consumidor vencido no pisa la evaluación del sucesor", async () => {
  vi.stubEnv("COOPER_FABRICA", "n8n");
  configurar();
  let resolver!: (value: SaludOperativa) => void;
  const enviar = vi.fn(async () => ({ entrega: "enviado" as const }));
  const anterior = cicloAlertasSalud({
    ahora: base,
    enviar,
    consultar: () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  });
  await cicloAlertasSalud({
    ahora: base + 120001,
    enviar,
    consultar: async () => salud(false),
  });
  resolver(salud());
  await anterior;
  expect(enviar).not.toHaveBeenCalled();
  expect(leerTelegramSalud(admin).ultimaEvaluacion).toBe(
    new Date(base + 120001).toISOString(),
  );
});
it("reintenta una recuperación incierta aunque el aviso inicial tampoco tuvo recibo", async () => {
  vi.stubEnv("COOPER_FABRICA", "n8n");
  configurar();
  const consultar = vi.fn(async () => salud());
  const enviar = vi.fn(async () => ({
    entrega: "incierto" as "incierto" | "enviado",
  }));
  await cicloAlertasSalud({ ahora: base, consultar, enviar });
  consultar.mockResolvedValue(salud(false));
  await cicloAlertasSalud({ ahora: base + 60000, consultar, enviar });
  await cicloAlertasSalud({ ahora: base + 120000, consultar, enviar });
  expect(enviar).toHaveBeenCalledTimes(2);
  enviar.mockResolvedValue({ entrega: "enviado" });
  await cicloAlertasSalud({ ahora: base + 361 * 60000, consultar, enviar });
  await cicloAlertasSalud({ ahora: base + 362 * 60000, consultar, enviar });
  expect(enviar).toHaveBeenCalledTimes(3);
  expect(leerTelegramSalud(admin).entrega).toBe("enviado");
});
it("transporte fijo confirma recibo y no propaga secretos, HTML ni gasto", async () => {
  vi.stubEnv("COOPER_TELEGRAM_BOT_TOKEN", "123:ficticio");
  vi.stubEnv("COOPER_TELEGRAM_CHAT_ID", "12345");
  const transport = vi.fn(async () =>
    Response.json({ ok: true, result: { message_id: 12 } }),
  );
  vi.stubGlobal("fetch", transport);
  expect(await enviarTelegramSalud("Disco bajo")).toEqual({
    entrega: "enviado",
  });
  expect(transport).toHaveBeenCalledWith(
    "https://api.telegram.org/bot123:ficticio/sendMessage",
    expect.objectContaining({
      redirect: "error",
      body: expect.stringContaining('"allow_paid_broadcast":false'),
    }),
  );
  transport.mockResolvedValue(
    Response.json(
      {
        ok: false,
        description: "canario-privado",
        parameters: { retry_after: 1200 },
      },
      { status: 429 },
    ),
  );
  expect(await enviarTelegramSalud("Disco bajo")).toEqual({
    entrega: "fallido",
    reintentarEn: 1200000,
  });
  transport.mockRejectedValue(new Error("canario-privado"));
  expect(await enviarTelegramSalud("Disco bajo")).toEqual({
    entrega: "incierto",
  });
});
