import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  whatsappContacts,
  whatsappOutbox,
  whatsappAttempts,
  whatsappDeliveries,
  type User,
} from "@/db/schema";
import { loginGoogle } from "@/lib/identidad";
import {
  DIA,
  sinAvisos,
  solicitarCodigo,
} from "@/servicios/mensajeria/cuentas";
import { resolverEnlace, tokenRevision } from "@/servicios/mensajeria/enlaces";
import {
  construirMensaje,
  encolarRespuestaChat,
  procesarCola,
} from "@/servicios/mensajeria/cola";
import {
  WhatsAppCloudAPI,
  WhatsAppSimulada,
  ErrorMensajeria,
  type MensajeWhatsApp,
  type ProveedorMensajeria,
} from "@/servicios/mensajeria/proveedor";

const template: MensajeWhatsApp = {
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to: "51911111111",
  type: "template",
  template: {
    name: "cooper_aprobacion_guion",
    language: { code: "es" },
    components: [],
  },
};
const texto: MensajeWhatsApp = {
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to: "51911111111",
  type: "text",
  context: { message_id: "wamid.entrada" },
  text: { body: "Listo. Puedes revisarlo en Cooper.", preview_url: false },
};
const aprobada = () =>
  Response.json({
    data: [
      { name: "cooper_aprobacion_guion", language: "es", status: "APPROVED" },
    ],
  });
let now: number;
let user: User;
beforeEach(() => {
  vi.useFakeTimers();
  now = Date.UTC(2026, 10, 21, 12);
  vi.setSystemTime(now);
  vi.stubEnv("COOPER_MENSAJERIA", "simulada");
  vi.stubEnv("COOPER_MENSAJERIA_PAUSA", "0");
  vi.stubEnv("WHATSAPP_TOKEN", randomBytes(32).toString("hex"));
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123456789");
  vi.stubEnv("WHATSAPP_WABA_ID", "987654321");
  db().delete(whatsappAttempts).run();
  db().delete(whatsappOutbox).run();
  db().delete(whatsappContacts).run();
  db().delete(whatsappDeliveries).run();
  user = loginGoogle("admin@example.test", "Walter");
  user.whatsapp = "+51911111111";
  db()
    .update(users)
    .set({ whatsapp: user.whatsapp, active: true })
    .where(eq(users.id, user.id))
    .run();
  db()
    .insert(whatsappContacts)
    .values({
      ownerId: user.id,
      phone: user.whatsapp,
      verifiedAt: now - 10000,
      consentAt: now - 10000,
      incomingAt: now,
      preferences: JSON.stringify(sinAvisos),
      simulated: true,
    })
    .run();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const entrada = () => ({
  id: "wamid.entrada",
  ownerId: user.id,
  phone: user.whatsapp,
  contactVerifiedAt: now - 10000,
  simulated: true,
});
const jobs = () => db().select().from(whatsappOutbox).all();

describe("Plantillas aprobadas y transporte seguro", () => {
  it("consulta aprobación exacta sin caché antes de cada envío y deja secretos fuera de la URL", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(aprobada())
      .mockResolvedValueOnce(Response.json({ messages: [{ id: "wamid.uno" }] }))
      .mockResolvedValueOnce(
        Response.json({
          data: [
            {
              name: "cooper_aprobacion_guion",
              language: "es",
              status: "PAUSED",
            },
          ],
        }),
      );
    const provider = new WhatsAppCloudAPI(transport);
    await expect(provider.enviar(template)).resolves.toEqual({
      id: "wamid.uno",
    });
    await expect(provider.enviar(template)).rejects.toMatchObject({
      codigo: "plantilla_no_aprobada",
    });
    expect(transport).toHaveBeenCalledTimes(3);
    const url = new URL(String(transport.mock.calls[0][0]));
    expect(url.pathname).toBe("/v27.0/987654321/message_templates");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      name: "cooper_aprobacion_guion",
      language: "es",
      fields: "name,language,status",
    });
    expect(transport.mock.calls[0][1]).toMatchObject({
      method: "GET",
      redirect: "error",
      cache: "no-store",
    });
  });
  it.each(["PENDING", "REJECTED", "PAUSED", "DISABLED"])(
    "no envía una plantilla %s",
    async (status) => {
      const transport = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          data: [{ name: "cooper_aprobacion_guion", language: "es", status }],
        }),
      );
      await expect(
        new WhatsAppCloudAPI(transport).enviar(template),
      ).rejects.toMatchObject({
        clase: "permanente",
        codigo: "plantilla_no_aprobada",
      });
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    [],
    [{ name: "otra", language: "es", status: "APPROVED" }],
    [
      {
        name: "cooper_aprobacion_guion",
        language: "es_MX",
        status: "APPROVED",
      },
    ],
  ])("exige coincidencia exacta de nombre e idioma", async (...data) => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data }));
    await expect(
      new WhatsAppCloudAPI(transport).enviar(template),
    ).rejects.toMatchObject({ codigo: "plantilla_no_aprobada" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("sin WABA falla cerrado antes de red", async () => {
    vi.stubEnv("WHATSAPP_WABA_ID", "");
    const transport = vi.fn<typeof fetch>();
    await expect(
      new WhatsAppCloudAPI(transport).enviar(template),
    ).rejects.toMatchObject({ codigo: "configuracion_plantillas" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("una consulta de aprobación fallida puede repetirse porque no hubo POST", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("ficticio"));
    await expect(
      new WhatsAppCloudAPI(transport).enviar(template),
    ).rejects.toMatchObject({
      clase: "temporal",
      codigo: "consulta_plantilla",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("revalida después de consultar y bloquea la pausa que llegó durante el GET", async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => {
      vi.stubEnv("COOPER_MENSAJERIA_PAUSA", "1");
      return aprobada();
    });
    await expect(
      new WhatsAppCloudAPI(transport).enviar(template),
    ).rejects.toMatchObject({ codigo: "pausa" });
    expect(transport).toHaveBeenCalledTimes(1);
    vi.stubEnv("COOPER_MENSAJERIA_PAUSA", "0");
    transport.mockImplementation(async () => aprobada());
    const guard = vi.fn(() => {
      throw new Error("Consentimiento revocado");
    });
    await expect(
      new WhatsAppCloudAPI(transport).enviar(template, "local", guard),
    ).rejects.toThrow("revocado");
    expect(guard).toHaveBeenCalledOnce();
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it.each([4, 80007, 130429, 131056, 131016])(
    "reintenta rechazo Meta %s con HTTP 400",
    async (code) => {
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { error: { code } },
            { status: 400, headers: { "Retry-After": "60" } },
          ),
        );
      await expect(
        new WhatsAppCloudAPI(transport).enviar(texto),
      ).rejects.toMatchObject({
        clase: "temporal",
        codigo: String(code),
        esperaMs: 60000,
      });
    },
  );
  it.each([131042, 131047, 132001, 190])(
    "no reintenta rechazo permanente Meta %s",
    async (code) => {
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ error: { code } }, { status: 400 }));
      await expect(
        new WhatsAppCloudAPI(transport).enviar(texto),
      ).rejects.toMatchObject({ clase: "permanente", codigo: String(code) });
    },
  );
  it("POST con red, 5xx opaco o cuerpo ilegible queda incierto", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("fallo privado"))
      .mockResolvedValueOnce(new Response("sin recibo", { status: 502 }))
      .mockResolvedValueOnce(Response.json({}));
    const provider = new WhatsAppCloudAPI(transport);
    for (let i = 0; i < 3; i++)
      await expect(provider.enviar(texto)).rejects.toMatchObject({
        clase: "incierto",
      });
    expect(transport).toHaveBeenCalledTimes(3);
  });
});

describe("Respuesta de chat durable y ventana de 24 horas", () => {
  it("renueva reloj y reserva entre envíos lentos ante otro consumidor", async () => {
    encolarRespuestaChat(entrada(), "Primero.", now);
    encolarRespuestaChat(
      { ...entrada(), id: "wamid.segunda" },
      "Segundo.",
      now,
    );
    const concurrente = new WhatsAppSimulada();
    const otroEnvio = vi.spyOn(concurrente, "enviar");
    let count = 0;
    const provider: ProveedorMensajeria = {
      simulada: true,
      enviar: async (_message, id, guard) => {
        guard?.();
        count++;
        if (count === 1) vi.setSystemTime(now + 61000);
        else await procesarCola(concurrente, Date.now());
        return { id: `simulada.${id}` };
      },
    };
    await procesarCola(provider, now);
    expect(count).toBe(2);
    expect(otroEnvio).not.toHaveBeenCalled();
    expect(jobs().map((j) => j.state)).toEqual(["aceptado", "aceptado"]);
    expect(jobs()[1].leaseAt).toBe(now + 61000);
  });
  it("calcula el reintento desde el rechazo y no desde el inicio del ciclo", async () => {
    encolarRespuestaChat(entrada(), "Listo.", now);
    const provider: ProveedorMensajeria = {
      simulada: true,
      enviar: async () => {
        vi.setSystemTime(now + 20000);
        throw new ErrorMensajeria("temporal", "130429", 45000);
      },
    };
    await procesarCola(provider, now);
    expect(jobs()[0]).toMatchObject({
      state: "pendiente",
      attempts: 1,
      nextAt: now + 65000,
    });
  });
  it("deduplica el mensaje entrante y conserva el vínculo y respuesta corta", async () => {
    encolarRespuestaChat(
      entrada(),
      "Recibido. Puedes revisarlo en Cooper.",
      now,
    );
    encolarRespuestaChat(entrada(), "No debe reemplazarlo.", now);
    expect(jobs()).toHaveLength(1);
    expect(() => resolverEnlace(user, tokenRevision(jobs()[0]), now)).toThrow(
      "Enlace no disponible",
    );
    expect(construirMensaje(jobs()[0], now)).toMatchObject({
      type: "text",
      context: { message_id: "wamid.entrada" },
      text: {
        body: "Recibido. Puedes revisarlo en Cooper.",
        preview_url: false,
      },
    });
    const provider = new WhatsAppSimulada();
    const send = vi.spyOn(provider, "enviar");
    await Promise.all([
      procesarCola(provider, now),
      procesarCola(provider, now),
    ]);
    expect(send).toHaveBeenCalledOnce();
    expect(jobs()[0]).toMatchObject({
      state: "aceptado",
      attempts: 1,
      delivery: "delivered",
    });
  });
  it("pausa conserva los pendientes sin consumir intentos y reanudar despacha una vez", async () => {
    encolarRespuestaChat(entrada(), "Listo.", now);
    const provider = new WhatsAppSimulada();
    const send = vi.spyOn(provider, "enviar");
    vi.stubEnv("COOPER_MENSAJERIA_PAUSA", "1");
    await procesarCola(provider, now);
    expect(send).not.toHaveBeenCalled();
    expect(jobs()[0]).toMatchObject({ state: "pendiente", attempts: 0 });
    expect(db().select().from(whatsappAttempts).all()).toHaveLength(0);
    vi.stubEnv("COOPER_MENSAJERIA_PAUSA", "0");
    await procesarCola(provider, now);
    expect(send).toHaveBeenCalledOnce();
  });
  it("pausar durante la consulta de plantilla libera la reserva sin contabilizar envío", async () => {
    vi.stubEnv("COOPER_MENSAJERIA", "whatsapp");
    solicitarCodigo(user, { consentimiento: true }, now);
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => {
      vi.stubEnv("COOPER_MENSAJERIA_PAUSA", "1");
      return Response.json({
        data: [
          {
            name: "cooper_verificar_numero",
            language: "es",
            status: "APPROVED",
          },
        ],
      });
    });
    await procesarCola(new WhatsAppCloudAPI(transport), now);
    expect(transport).toHaveBeenCalledOnce();
    expect(jobs()[0]).toMatchObject({
      state: "pendiente",
      attempts: 0,
      leaseAt: 0,
    });
    expect(db().select().from(whatsappAttempts).all()).toHaveLength(0);
  });
  it.each(["ventana", "futuro", "consentimiento", "numero", "verificacion"])(
    "revalida %s antes de despachar chat",
    async (reason) => {
      encolarRespuestaChat(entrada(), "Listo.", now);
      const changes =
        reason === "ventana"
          ? { incomingAt: now - DIA }
          : reason === "futuro"
            ? { incomingAt: now + 1 }
            : reason === "consentimiento"
              ? { consentAt: 0 }
              : reason === "numero"
                ? { phone: "+51922222222" }
                : { verifiedAt: now - 1 };
      db()
        .update(whatsappContacts)
        .set(changes)
        .where(eq(whatsappContacts.ownerId, user.id))
        .run();
      const provider = new WhatsAppSimulada();
      const send = vi.spyOn(provider, "enviar");
      await procesarCola(provider, now);
      expect(send).not.toHaveBeenCalled();
      expect(jobs()[0].state).toBe("cancelado");
    },
  );
  it("una espera asíncrona no prolonga la ventana del reloj inicial", async () => {
    db()
      .update(whatsappContacts)
      .set({ incomingAt: now - DIA + 1000 })
      .where(eq(whatsappContacts.ownerId, user.id))
      .run();
    encolarRespuestaChat(entrada(), "Listo.", now);
    let posted = false;
    const provider: ProveedorMensajeria = {
      simulada: true,
      enviar: async (_message, _id, guard) => {
        vi.setSystemTime(now + 1000);
        guard?.();
        posted = true;
        return { id: "wamid.tarde" };
      },
    };
    await procesarCola(provider, now);
    expect(posted).toBe(false);
    expect(jobs()[0]).toMatchObject({
      state: "fallido",
      errorCode: "aviso_vencido",
    });
  });
});
