import { beforeAll, expect, it, vi } from "vitest";
import { randomUUID, createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import {
  allowedEmails,
  marcas,
  piezasMarca,
  attachments,
  users,
  whatsappContacts,
  whatsappOutbox,
  type User,
  type CuentaMarca,
} from "@/db/schema";
import { loginGoogle } from "@/lib/identidad";
import {
  agregarCuenta,
  conectarCuenta,
  guardarMarca,
  estadoMarcas,
  guardarPieza,
  enviarRevision,
  decidirPieza,
  procesarMarcas,
  actualizarMetricas,
  obtenerPieza,
  revocarCuenta,
  leerMedio,
  urlsMedios,
} from "@/servicios/marcas/servicio";
import {
  registrarCita,
  verificarCitas,
  proponerTexto,
} from "@/servicios/marcas/especialistas";
import { RedOficial, RedSimulada } from "@/servicios/marcas/redes";
import { estudiar, proximoHorario } from "@/servicios/marcas/estudio";
import { plantillaSvg, renderizar } from "@/servicios/marcas/diseno";
import { recibirTrabajo } from "@/servicios/marcas/worker";
import { encolarMarca, piezaAviso } from "@/servicios/marcas/whatsapp";
import { construirMensaje } from "@/servicios/mensajeria/cola";
import { GET, POST } from "@/app/api/[...ruta]/route";
let active: User;
vi.mock("@/lib/sesion", () => ({ currentUser: async () => active }));
let admin: User, ana: User, luis: User;
beforeAll(() => {
  admin = loginGoogle("admin@example.test", "Walter");
  for (const email of ["marcas-ana@example.test", "marcas-luis@example.test"])
    db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  ana = loginGoogle("marcas-ana@example.test", "Ana");
  luis = loginGoogle("marcas-luis@example.test", "Luis");
  active = ana;
});
async function escenario(
  red: "instagram" | "youtube" | "facebook" = "instagram",
) {
  const m = guardarMarca(ana, {
    nombre: "Congregación de ensayo",
    rubro: "iglesia-reformada",
  });
  const c = agregarCuenta(ana, m.id, {
    red,
    alias: "Ensayo",
    remoto:
      red === "youtube"
        ? randomUUID()
        : String(Math.floor(Math.random() * 1e14)),
    pagina: "123",
  });
  await conectarCuenta(admin, c.id);
  const d = {
    cuentaId: c.id,
    formato: red === "youtube" ? "reel" : "imagen",
    plantilla: "domingo",
    titulo: "Nos encontramos",
    texto: "Te esperamos este domingo.",
    detalle: "Domingo · 10:00",
    programada: new Date(Date.now() + 3600000).toISOString(),
  };
  const p = guardarPieza(ana, m.id, d);
  return { m, c, p, d };
}
it("aísla marcas, archivos, cuentas y mutaciones; Walter ve todo", async () => {
  const { m, c, p } = await escenario();
  expect(estadoMarcas(ana).marcas.some((x) => x.id === m.id)).toBe(true);
  expect(estadoMarcas(luis).marcas.some((x) => x.id === m.id)).toBe(false);
  expect(estadoMarcas(admin).marcas.some((x) => x.id === m.id)).toBe(true);
  expect(() => obtenerPieza(luis, p.id)).toThrow();
  await expect(conectarCuenta(ana, c.id)).rejects.toThrow();
  expect(() =>
    guardarMarca(luis, { nombre: "Robo", rubro: "moda", ownerId: ana.id }),
  ).toThrow();
  active = luis;
  expect(
    (
      await GET(new Request("http://localhost/api/marcas"), {
        params: Promise.resolve({ ruta: ["marcas"] }),
      })
    ).status,
  ).toBe(200);
  const response = await POST(
    new Request(`http://localhost/api/marcas/${m.id}/piezas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ ruta: ["marcas", m.id, "piezas"] }) },
  );
  expect(response.status).toBe(404);
  active = ana;
});
it("solo Walter aprueba una revisión exacta, editar invalida aprobación y se respeta horario", async () => {
  const { m, p, d } = await escenario();
  await enviarRevision(ana, p.id, 1);
  const vista = obtenerPieza(ana, p.id).p;
  expect(vista.mediosIds).toHaveLength(1);
  const medio = leerMedio(p.id, new URL("http://localhost?i=0"), ana);
  expect(
    (await sharp(Buffer.from(medio.data, "base64")).metadata()).width,
  ).toBe(1080);
  expect(() => decidirPieza(ana, p.id, 1, true)).toThrow();
  decidirPieza(admin, p.id, 1, true);
  const red = new RedSimulada(),
    spy = vi.spyOn(red, "publicar");
  await procesarMarcas(red);
  expect(spy).not.toHaveBeenCalled();
  guardarPieza(ana, m.id, { ...d, texto: "Cambiamos el horario." }, p.id, 1);
  expect(obtenerPieza(ana, p.id).p.estado).toBe("borrador");
  expect(() => decidirPieza(admin, p.id, 1, true)).toThrow();
});
it("no duplica en trabajadores concurrentes y alimenta métricas", async () => {
  const { p } = await escenario();
  await enviarRevision(ana, p.id, 1);
  decidirPieza(admin, p.id, 1, true);
  const red = new RedSimulada();
  const spy = vi.spyOn(red, "publicar");
  const at = p.programada + 1;
  await Promise.all([procesarMarcas(red, at), procesarMarcas(red, at)]);
  expect(spy.mock.calls.filter(([, v]) => v.id === p.id)).toHaveLength(1);
  expect(obtenerPieza(ana, p.id).p.estado).toBe("publicada");
  await actualizarMetricas(red, at);
  expect(obtenerPieza(ana, p.id).p.metricas?.vistas).toBe(240);
});
it("timeout posterior al envío se concilia sin reenviar; desconexión cancela cola", async () => {
  const { p } = await escenario();
  await enviarRevision(ana, p.id, 1);
  decidirPieza(admin, p.id, 1, true);
  const red = new RedSimulada();
  const spy = vi.spyOn(red, "publicar").mockRejectedValue(new Error("timeout"));
  await procesarMarcas(red, p.programada + 1);
  await procesarMarcas(red, p.programada + 2);
  expect(obtenerPieza(ana, p.id).p.estado).toBe("revision");
  expect(spy).toHaveBeenCalledTimes(1);
  const b = await escenario();
  await enviarRevision(ana, b.p.id, 1);
  decidirPieza(admin, b.p.id, 1, true);
  revocarCuenta(ana, b.c.id);
  expect(obtenerPieza(ana, b.p.id).p.estado).toBe("cancelada");
});
it("bloquea cuentas suspendidas y medios ajenos antes de publicar", async () => {
  const { p, m, d } = await escenario();
  const id = randomUUID();
  db()
    .insert(attachments)
    .values({
      id,
      ownerId: luis.id,
      name: "Privado",
      mime: "image/jpeg",
      size: 4,
      data: "AAAA",
    })
    .run();
  expect(() => guardarPieza(ana, m.id, { ...d, adjuntos: [id] })).toThrow();
  await enviarRevision(ana, p.id, 1);
  decidirPieza(admin, p.id, 1, true);
  db().update(users).set({ active: false }).where(eq(users.id, ana.id)).run();
  const red = new RedSimulada();
  const spy = vi.spyOn(red, "publicar");
  await procesarMarcas(red, p.programada + 1);
  expect(spy).not.toHaveBeenCalled();
  db().update(users).set({ active: true }).where(eq(users.id, ana.id)).run();
});
it("citas exactas: rechaza invención, versión incorrecta, referencia sin cotejo y cambios posteriores", async () => {
  const { p, m, d } = await escenario();
  const marca = db().select().from(marcas).where(eq(marcas.id, m.id)).get()!;
  const cita = {
    referencia: "Juan 11:35",
    version: "RVR1960",
    texto: "Jesús lloró.",
  };
  const datos = {
    ...obtenerPieza(ana, p.id).p.datos,
    texto: `${cita.texto} ${cita.referencia}`,
    citas: [cita],
  };
  expect(() => verificarCitas(marca, datos)).toThrow();
  expect(() =>
    registrarCita(ana, {
      ...cita,
      fuente: "https://example.org/biblia",
      cotejada: true,
    }),
  ).toThrow();
  registrarCita(admin, {
    ...cita,
    fuente: "https://example.org/edicion-cotejada",
    cotejada: true,
  });
  expect(() => verificarCitas(marca, datos)).not.toThrow();
  expect(() =>
    verificarCitas(marca, {
      ...datos,
      citas: [{ ...cita, texto: "Texto inventado" }],
    }),
  ).toThrow();
  expect(() =>
    verificarCitas(marca, { ...datos, citas: [{ ...cita, version: "OTRA" }] }),
  ).toThrow();
  expect(() => verificarCitas(marca, { ...datos, citas: [] })).toThrow();
  const q = guardarPieza(ana, m.id, {
    ...d,
    texto: datos.texto,
    citas: datos.citas,
  });
  await enviarRevision(ana, q.id, 1);
  registrarCita(admin, {
    ...cita,
    texto: "Cotejo modificado",
    fuente: "https://example.org/edicion-cotejada",
    cotejada: true,
  });
  expect(() => decidirPieza(admin, q.id, 1, true)).toThrow();
});
it("estudio sin datos no inventa resultados y calcula horarios en la zona de marca", async () => {
  const { m } = await escenario();
  const marca = db().select().from(marcas).where(eq(marcas.id, m.id)).get()!;
  expect(estudiar(marca, []).evidencia).toMatch(/sin evidencia/);
  const estudio = estudiar(marca, await new RedSimulada().historial());
  expect(estudio.horas).toContain(18);
  expect(estudio.muestra).toBe(6);
  expect(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Lima",
      hourCycle: "h23",
      hour: "numeric",
    }).format(proximoHorario("America/Lima", [18])),
  ).toBe("18");
});
it("especialista usa el proveedor existente sin herramientas de aprobación", async () => {
  const { m } = await escenario();
  const marca = db().select().from(marcas).where(eq(marcas.id, m.id)).get()!;
  const fake = {
    generar: vi.fn(async function* () {
      yield { tipo: "texto" as const, texto: "Nos reunimos para adorar." };
    }),
  };
  expect((await proponerTexto(marca, "Aviso dominical", fake)).texto).toContain(
    "adorar",
  );
  expect(fake.generar.mock.calls[0]).toBeDefined();
});
it("URLs firmadas solo entregan la revisión aprobada y no permiten otra pieza", async () => {
  const { p } = await escenario();
  await enviarRevision(ana, p.id, 1);
  decidirPieza(admin, p.id, 1, true);
  vi.stubEnv("AUTH_URL", "https://cooper.example.test");
  db()
    .update(piezasMarca)
    .set({ estado: "enviando" })
    .where(eq(piezasMarca.id, p.id))
    .run();
  const actual = obtenerPieza(ana, p.id).p,
    now = Date.now(),
    url = new URL(urlsMedios(actual, now)[0]);
  expect(leerMedio(p.id, url, undefined, now).mime).toBe("image/jpeg");
  url.searchParams.set("r", "2");
  expect(() => leerMedio(p.id, url, undefined, now)).toThrow();
  expect(() =>
    leerMedio(p.id, new URL("http://localhost?i=0"), luis),
  ).toThrow();
  db()
    .update(piezasMarca)
    .set({ estado: "cancelada" })
    .where(eq(piezasMarca.id, p.id))
    .run();
  vi.unstubAllEnvs();
});
it("rechaza trabajo sin firma, alterado y antiguo; acepta contrato firmado", async () => {
  const secret = "x".repeat(48),
    now = Date.now();
  vi.stubEnv("COOPER_MARCAS_WORKER_SECRET", secret);
  const body = JSON.stringify({ accion: "metricas" });
  const request = (at: number, s: string) =>
    new Request("https://cooper.test/api/marcas/operar", {
      method: "POST",
      body,
      headers: { "x-cooper-time": String(at), "x-cooper-signature": s },
    });
  await expect(
    recibirTrabajo(request(now, "0".repeat(64)), now),
  ).rejects.toThrow();
  const sign = createHmac("sha256", secret)
    .update(`${now}.${body}`)
    .digest("hex");
  await expect(recibirTrabajo(request(now, sign), now)).resolves.toHaveProperty(
    "actualizadas",
  );
  await expect(
    recibirTrabajo(request(now, sign), now + 400000),
  ).rejects.toThrow();
  vi.unstubAllEnvs();
});
it("WhatsApp avisa solo a Walter y una revisión editada invalida el botón", async () => {
  db()
    .update(users)
    .set({ whatsapp: "+51955550000" })
    .where(eq(users.id, admin.id))
    .run();
  db()
    .insert(whatsappContacts)
    .values({
      ownerId: admin.id,
      phone: "+51955550000",
      verifiedAt: Date.now(),
      consentAt: Date.now(),
      incomingAt: Date.now(),
      preferences: JSON.stringify({
        guion: false,
        final: false,
        publicado: false,
        gasto: false,
        marca: true,
      }),
      simulated: true,
    })
    .onConflictDoNothing()
    .run();
  const { m, p, d } = await escenario();
  await enviarRevision(ana, p.id, 1);
  encolarMarca(p.id, true);
  const job = db()
    .select()
    .from(whatsappOutbox)
    .where(eq(whatsappOutbox.resourceId, p.id))
    .all()
    .find((j) => j.interactive)!;
  expect(job.ownerId).toBe(admin.id);
  expect(construirMensaje(job).type).toBe("interactive");
  guardarPieza(ana, m.id, { ...d, titulo: "Cambio" }, p.id, 1);
  expect(() => piezaAviso(job)).toThrow();
});
const cuenta = (red: CuentaMarca["red"] = "instagram"): CuentaMarca => ({
  id: "c",
  marcaId: "m",
  red,
  alias: "Cuenta",
  remoto: "12345",
  pagina: "123",
  tipo: "BUSINESS",
  estado: "conectada",
  simulada: false,
  verificada: 1,
});
function transporte(responses: unknown[]) {
  return vi.fn<typeof fetch>(async () => Response.json(responses.shift()));
}
const config = {
  meta: "ficticio-meta",
  upload: "ficticio-upload",
  version: "v27.0",
};
it("Instagram crea carrusel, espera FINISHED y publica con transporte simulado", async () => {
  const { p } = await escenario();
  const pieza = {
    ...obtenerPieza(ana, p.id).p,
    datos: { ...obtenerPieza(ana, p.id).p.datos, formato: "carrusel" as const },
  };
  const http = transporte([
    {
      access_token: "pagina-ficticia",
      instagram_business_account: { id: "12345" },
    },
    { data: [{ quota_usage: 4 }] },
    { id: "a" },
    { id: "b" },
    { id: "parent" },
    {
      access_token: "pagina-ficticia",
      instagram_business_account: { id: "12345" },
    },
    { status_code: "IN_PROGRESS" },
    {
      access_token: "pagina-ficticia",
      instagram_business_account: { id: "12345" },
    },
    { status_code: "FINISHED" },
    { id: "post" },
  ]);
  const red = new RedOficial(http, config);
  const guardar = vi.fn();
  const a = await red.publicar(
    cuenta(),
    pieza,
    ["https://example.test/a.jpg", "https://example.test/b.jpg"],
    guardar,
  );
  expect(a.estado).toBe("procesando");
  expect(a.checkpoint.id).toBe("parent");
  const b = await red.publicar(
    cuenta(),
    { ...pieza, checkpoint: a.checkpoint },
    [],
    guardar,
  );
  expect(b.estado).toBe("procesando");
  const c = await red.publicar(
    cuenta(),
    { ...pieza, checkpoint: b.checkpoint },
    [],
    guardar,
  );
  expect(c.remoto).toBe("post");
  expect(String(http.mock.calls.at(-1)![0])).toContain("/12345/media_publish");
});
it("Upload-Post conserva request_id y no confunde inbox de TikTok con publicación", async () => {
  const { p } = await escenario("youtube");
  const pieza = obtenerPieza(ana, p.id).p;
  const http = transporte([
    { success: true, request_id: "req" },
    {
      history: [
        {
          request_id: "req",
          profile_username: "12345",
          platform: "tiktok",
          success: true,
          fallback_to_inbox: true,
          post_url: null,
        },
      ],
    },
  ]);
  const red = new RedOficial(http, config);
  const a = await red.publicar(
    cuenta("tiktok"),
    pieza,
    ["https://example.test/a.mp4"],
    () => {},
  );
  expect(a.estado).toBe("procesando");
  expect(
    new Headers(http.mock.calls[0][1]?.headers).get("Idempotency-Key"),
  ).toContain(p.id);
  expect(
    (
      await red.publicar(
        cuenta("tiktok"),
        { ...pieza, checkpoint: a.checkpoint },
        [],
        () => {},
      )
    ).estado,
  ).toBe("revision");
});
it("Facebook imagen/historia usa foto no publicada; errores y cuota no se ocultan", async () => {
  const { p } = await escenario("facebook");
  const pieza = {
    ...obtenerPieza(ana, p.id).p,
    datos: { ...obtenerPieza(ana, p.id).p.datos, formato: "historia" as const },
  };
  const http = transporte([
    { access_token: "pagina-ficticia" },
    { id: "photo" },
    { success: true, post_id: "post" },
  ]);
  const r = await new RedOficial(http, config).publicar(
    cuenta("facebook"),
    pieza,
    ["https://example.test/a.jpg"],
    () => {},
  );
  expect(r.estado).toBe("publicada");
  expect(JSON.parse(String(http.mock.calls[1][1]?.body)).published).toBe(false);
  expect(String(http.mock.calls[2][0])).toContain("photo_stories");
  const limited = transporte([
    { access_token: "pagina", instagram_business_account: { id: "12345" } },
    { data: [{ quota_usage: 100 }] },
  ]);
  await expect(
    new RedOficial(limited, config).publicar(cuenta(), pieza, [], () => {}),
  ).rejects.toThrow();
});
it("render escapa texto y compone un reel real sin proveedor pago", async () => {
  const { p, m } = await escenario("youtube");
  const pieza = obtenerPieza(ana, p.id).p;
  expect(
    plantillaSvg(
      { ...pieza, datos: { ...pieza.datos, titulo: "<b>Hola</b>" } },
      "Marca & equipo",
      0,
    ),
  ).not.toContain("<b>");
  const marca = db().select().from(marcas).where(eq(marcas.id, m.id)).get()!;
  const ids = await renderizar(pieza, marca);
  const a = db()
    .select()
    .from(attachments)
    .where(eq(attachments.id, ids[0]))
    .get()!;
  expect(a.mime).toBe("video/mp4");
  expect(Buffer.from(a.data, "base64").subarray(4, 8).toString()).toBe("ftyp");
}, 30000);

it("IG User solicita solo campos documentados; el tipo Business requiere confirmación de Walter", async () => {
  const http = transporte([
    { access_token: "pagina", instagram_business_account: { id: "12345" } },
    { id: "12345", username: "cuenta" },
  ]);
  expect(await new RedOficial(http, config).comprobar(cuenta())).toEqual({
    tipo: "PROFESSIONAL",
  });
  expect(String(http.mock.calls[1][0])).not.toContain("account_type");
  expect(new Headers(http.mock.calls[1][1]?.headers).get("Authorization")).toBe(
    `Bearer ${config.meta}`,
  );
});
it("estudio visual examina píxeles de CDN permitida y bloquea URLs arbitrarias", async () => {
  const { observarImagenes } = await import("@/servicios/marcas/visual");
  const bytes = await sharp({
    create: { width: 40, height: 80, channels: 3, background: "#ff0000" },
  })
    .jpeg()
    .toBuffer();
  const http = vi.fn<typeof fetch>(
    async () =>
      new Response(bytes, { headers: { "content-type": "image/jpeg" } }),
  );
  const rows = (await new RedSimulada().historial()).slice(0, 2);
  rows[0].imagen = "https://scontent.cdninstagram.com/a.jpg";
  rows[1].imagen = "https://example.test/privada";
  const result = await observarImagenes(rows, http);
  expect(result[0].visual?.proporcion).toBe(0.5);
  expect(result[0].visual?.color).toMatch(/^#f/);
  expect(result[1].visual).toBeUndefined();
  expect(http).toHaveBeenCalledTimes(1);
});
it("ingesta WhatsApp deduplica archivos, revalida contacto y limita descarga", async () => {
  const { marcaIngestas } = await import("@/db/schema");
  const { importarMediosWhatsApp } =
    await import("@/servicios/marcas/adjuntos-whatsapp");
  vi.stubEnv("WHATSAPP_TOKEN", "solo-prueba");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
  db()
    .update(users)
    .set({ whatsapp: "+51911112222" })
    .where(eq(users.id, ana.id))
    .run();
  db()
    .insert(whatsappContacts)
    .values({
      ownerId: ana.id,
      phone: "+51911112222",
      verifiedAt: Date.now(),
      consentAt: Date.now(),
      preferences: "{}",
      simulated: true,
    })
    .onConflictDoNothing()
    .run();
  const id = randomUUID(),
    bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer();
  db()
    .insert(marcaIngestas)
    .values({
      id,
      ownerId: ana.id,
      mediaId: "12345",
      caption: "Foto del domingo",
      createdAt: Date.now(),
    })
    .run();
  const http = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        url: "https://lookaside.fbsbx.com/medio",
        mime_type: "image/png",
        file_size: bytes.length,
      }),
    )
    .mockResolvedValueOnce(new Response(bytes));
  await importarMediosWhatsApp(http);
  await importarMediosWhatsApp(http);
  expect(http).toHaveBeenCalledTimes(2);
  expect(
    db().select().from(marcaIngestas).where(eq(marcaIngestas.id, id)).get()
      ?.estado,
  ).toBe("completa");
  expect(
    estadoMarcas(ana).archivos.some((a) => a.name.includes("Foto del domingo")),
  ).toBe(true);
  const evil = randomUUID();
  db()
    .insert(marcaIngestas)
    .values({
      id: evil,
      ownerId: ana.id,
      mediaId: "12346",
      caption: "Host inválido",
      createdAt: Date.now(),
    })
    .run();
  const blocked = transporte([
    {
      url: "https://127.0.0.1/privado",
      mime_type: "image/png",
      file_size: 100,
    },
  ]);
  await importarMediosWhatsApp(blocked);
  expect(blocked).toHaveBeenCalledTimes(1);
  expect(
    db().select().from(marcaIngestas).where(eq(marcaIngestas.id, evil)).get()
      ?.estado,
  ).toBe("pendiente");
  vi.unstubAllEnvs();
});
it("webhook de WhatsApp aprueba una sola vez la revisión de marca con remitente verificado", async () => {
  const { recibirWhatsApp } = await import("@/servicios/mensajeria/webhook");
  const now = Date.now();
  vi.stubEnv("WHATSAPP_APP_SECRET", "secreto-ficticio-de-firma-whatsapp");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
  const { p } = await escenario();
  await enviarRevision(ana, p.id, 1);
  encolarMarca(p.id, true);
  const job = db()
    .select()
    .from(whatsappOutbox)
    .where(eq(whatsappOutbox.resourceId, p.id))
    .all()
    .find((j) => j.interactive)!;
  db()
    .update(whatsappOutbox)
    .set({ state: "aceptado", remoteId: "wamid-prueba" })
    .where(eq(whatsappOutbox.id, job.id))
    .run();
  const raw = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "123" },
              messages: [
                {
                  id: randomUUID(),
                  from: "51955550000",
                  timestamp: String(Math.floor(now / 1000)),
                  type: "interactive",
                  context: { id: "wamid-prueba" },
                  interactive: {
                    type: "button_reply",
                    button_reply: { id: `aprobar:${job.id}` },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const req = () =>
    new Request("https://cooper.test/api/whatsapp/webhook", {
      method: "POST",
      body: raw,
      headers: {
        "x-hub-signature-256": `sha256=${createHmac("sha256", process.env.WHATSAPP_APP_SECRET!).update(raw).digest("hex")}`,
      },
    });
  await recibirWhatsApp(req(), now);
  await recibirWhatsApp(req(), now);
  expect(obtenerPieza(ana, p.id).p.estado).toBe("programada");
  vi.unstubAllEnvs();
});
