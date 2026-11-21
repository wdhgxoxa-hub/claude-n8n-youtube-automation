import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  allowedEmails,
  users,
  videos,
  expenses,
  attachments,
  assets,
  events,
  type User,
} from "@/db/schema";
import { loginGoogle } from "@/lib/identidad";
import { requireAdmin, requireOwner, requireOwn } from "@/lib/permisos";
import { ETAPAS, siguienteEtapa } from "@/lib/etapas";
import {
  FabricaSimulada,
  FabricaN8n,
  EVENTOS,
  videosPropios,
} from "@/servicios/fabrica";
import { ChatSimulado, responderChat } from "@/servicios/chat";
import { herramientas } from "@/servicios/chat/herramientas";
import type { MensajeModelo } from "@/servicios/chat/tipos";
import { estado, administracion } from "@/servicios/datos";
import { sincronizarMedios } from "@/servicios/biblioteca";
import { AvatarSimulado } from "@/servicios/proveedores/simulados";
let active: User;
vi.mock("@/lib/sesion", () => ({ currentUser: async () => active }));
import { GET, POST, PATCH, DELETE } from "@/app/api/[...ruta]/route";
let admin: User, ana: User, luis: User, channel: string, video: string;
const factory = new FabricaSimulada();
beforeAll(async () => {
  admin = loginGoogle("admin@example.test", "Walter");
  for (const email of ["ana@example.test", "luis@example.test"])
    db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  ana = loginGoogle("ana@example.test", "Ana");
  luis = loginGoogle("luis@example.test", "Luis");
  active = ana;
  channel = (
    await factory.ejecutar(ana, {
      evento: "nuevo_canal",
      texto: "Ciencia",
      nombre: "Ciencia cotidiana",
    })
  ).id;
  video = (
    await factory.ejecutar(ana, {
      evento: "nuevo_video",
      recursoId: channel,
      texto: "Por qué el cielo es azul",
    })
  ).id;
});
async function route(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  data?: unknown,
) {
  const handler = { GET, POST, PATCH, DELETE }[method];
  return handler(
    new Request(`http://localhost/api/${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
    { params: Promise.resolve({ ruta: path.split("/") }) },
  );
}
describe("Identidad y autorización", () => {
  it("crea al primer administrador y mantiene usuarios normales", () => {
    expect(admin.role).toBe("admin");
    expect(ana.role).toBe("usuario");
    expect(loginGoogle(" ANA@example.test ", "Otra").id).toBe(ana.id);
  });
  it("rechaza correos no permitidos y cuentas desactivadas", () => {
    expect(() => loginGoogle("extra@example.test", "Extra")).toThrow();
    db()
      .update(users)
      .set({ active: false })
      .where(eq(users.id, luis.id))
      .run();
    expect(() => loginGoogle(luis.email, "Luis")).toThrow();
    db().update(users).set({ active: true }).where(eq(users.id, luis.id)).run();
  });
  it("solo dueño o admin; chat siempre exige dueño", () => {
    expect(() => requireOwner(luis, { ownerId: ana.id })).toThrow();
    expect(() => requireOwn(admin, { ownerId: ana.id })).toThrow();
    expect(requireOwner(admin, { ownerId: ana.id })).toBeTruthy();
    expect(() => requireAdmin(ana)).toThrow();
  });
  it("nunca incluye gasto en el estado normal y la consulta está protegida", () => {
    expect(estado(luis).videos).toHaveLength(0);
    expect(estado(luis).channels).toHaveLength(0);
    expect(JSON.stringify(estado(ana))).not.toMatch(
      /amount|expenses|concept|Producción simulada/,
    );
    expect(() => administracion(ana)).toThrow();
    expect(administracion(admin).users.find((u) => u.id === ana.id)?.day).toBe(
      0.84,
    );
  });
  it("bloquea lectura de gasto, modificación, aprobación y borrado ajenos en las rutas", async () => {
    active = luis;
    expect((await route("GET", "admin")).status).toBe(403);
    expect((await route("POST", `videos/${video}/aprobar`, {})).status).toBe(
      404,
    );
    expect(
      (await route("POST", `videos/${video}/cambios`, { texto: "Robar" }))
        .status,
    ).toBe(404);
    expect((await route("DELETE", `videos/${video}`)).status).toBe(404);
    expect((await route("DELETE", `canales/${channel}`)).status).toBe(404);
    expect(
      (
        await route("POST", "orden", {
          evento: "nuevo_video",
          recursoId: channel,
          texto: "Ajeno",
        })
      ).status,
    ).toBe(404);
  });
  it("limita diez cuentas sin dar permisos administrativos por correo arbitrario", () => {
    for (let i = 0; i < 7; i++) {
      const email = `extra${i}@example.test`;
      db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
      loginGoogle(email, "Extra");
    }
    db()
      .insert(allowedEmails)
      .values({ email: "once@example.test", createdAt: Date.now() })
      .run();
    expect(() => loginGoogle("once@example.test", "Once")).toThrow("diez");
  });
});
describe("Etapas y fábrica", () => {
  it("tiene doce etapas y dos puertas de aprobación", () => {
    expect(ETAPAS).toHaveLength(12);
    expect(siguienteEtapa(3)).toBe(3);
    expect(siguienteEtapa(9)).toBe(9);
    expect(siguienteEtapa(3, true)).toBe(4);
    expect(siguienteEtapa(11, true)).toBe(11);
    expect(() => siguienteEtapa(-1)).toThrow();
  });
  it("avanza con reloj, pausa, aprueba una sola vez y espera publicación programada", async () => {
    const id = (
      await factory.ejecutar(ana, {
        evento: "nuevo_video",
        recursoId: channel,
        texto: "Otro video",
      })
    ).id;
    for (let stage = 0; stage < 3; stage++) {
      db().update(videos).set({ updatedAt: 0 }).where(eq(videos.id, id)).run();
      await factory.sincronizar(ana);
      expect(videosPropios(ana).find((v) => v.id === id)?.stage).toBe(
        stage + 1,
      );
    }
    db().update(videos).set({ updatedAt: 0 }).where(eq(videos.id, id)).run();
    await factory.sincronizar(ana);
    expect(videosPropios(ana).find((v) => v.id === id)?.stage).toBe(3);
    await factory.aprobar(ana, id);
    await expect(factory.aprobar(ana, id)).rejects.toThrow();
    db()
      .update(videos)
      .set({ stage: 9, updatedAt: 0 })
      .where(eq(videos.id, id))
      .run();
    await factory.sincronizar(ana);
    expect(videosPropios(ana).find((v) => v.id === id)?.stage).toBe(9);
    await factory.aprobar(ana, id);
    await factory.ejecutar(ana, {
      evento: "programar",
      recursoId: id,
      texto: new Date(Date.now() + 86400000).toISOString(),
    });
    db().update(videos).set({ updatedAt: 0 }).where(eq(videos.id, id)).run();
    await factory.sincronizar(ana);
    expect(videosPropios(ana).find((v) => v.id === id)?.stage).toBe(10);
  });
  it("corregir vuelve a producción y conserva indicaciones", async () => {
    await factory.ejecutar(ana, {
      evento: "corregir",
      recursoId: video,
      texto: "Explica la dispersión de Rayleigh.",
    });
    expect(videosPropios(ana).find((v) => v.id === video)?.stage).toBe(1);
    expect(videosPropios(ana).find((v) => v.id === video)?.script).toContain(
      "Rayleigh",
    );
  });
  it("no programa una fecha inválida o pasada", async () => {
    await expect(
      factory.ejecutar(ana, {
        evento: "programar",
        recursoId: video,
        texto: "ayer",
      }),
    ).rejects.toThrow();
  });
  it("el contrato HTTP atribuye propietario y usa el mismo ID sin gasto ficticio", async () => {
    process.env.COOPER_N8N_URL = "https://fabrica.example.test/cooper";
    process.env.COOPER_N8N_TOKEN = "solo-prueba";
    const mock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ aceptado: true })));
    vi.stubGlobal("fetch", mock);
    const before = db().select().from(expenses).all().length;
    const result = await new FabricaN8n().ejecutar(ana, {
      evento: "nuevo_video",
      recursoId: channel,
      texto: "Contrato HTTP",
    });
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(body.dueno_email).toBe(ana.email);
    expect(body.datos.id).toBe(result.id);
    expect(db().select().from(expenses).all()).toHaveLength(before);
    vi.unstubAllGlobals();
  });
  it("no envía HTTP si el recurso pertenece a otro usuario", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    await expect(
      new FabricaN8n().ejecutar(luis, {
        evento: "corregir",
        recursoId: video,
        texto: "Ajeno",
      }),
    ).rejects.toThrow();
    expect(mock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
describe("Proveedor simulado y aislamiento del chat", () => {
  async function seleccionar(texto: string) {
    let reply: MensajeModelo | undefined;
    for await (const e of new ChatSimulado().generar(
      {
        sistema: "",
        mensajes: [{ role: "user", texto }],
        herramientas: herramientas(ana),
      },
      AbortSignal.timeout(1000),
    )) {
      if (e.tipo === "fin") reply = e.mensaje;
    }
    return reply!;
  }
  it("crear un video en un canal no crea otro canal", async () => {
    const reply = await seleccionar("Crea un video en mi canal: El cielo");
    expect(reply.llamadas?.[0].nombre).toBe("nuevo_video");
  });
  const phrases = [
    "Crea un canal: Ciencia",
    "Quiero un video: El cielo",
    "Corrige: El inicio",
    "Ajusta la biblia: Claro",
    "Programa: 2030-01-01T00:00:00Z",
    "Referencias: Libro",
    "Configura redes: YouTube",
    "Metas: Uno por semana",
    "Adopta cuenta: @ciencia",
  ];
  it.each(EVENTOS)("mapea %s uno a uno", async (evento) => {
    const reply = await seleccionar(phrases[EVENTOS.indexOf(evento)]);
    expect(reply.llamadas?.[0].nombre).toBe(evento);
  });
  it.each(["estado", "reporte", "pendientes", "tendencias"])(
    "responde %s sin acceder a otro espacio",
    async (texto) => {
      const reply = await responderChat(luis, { texto, adjuntos: [] });
      expect(reply.texto).not.toContain("Por qué el cielo");
    },
  );
  it("es determinista y no revela costos", async () => {
    const texto = "Hola, ¿cuánto gasto?";
    expect(await seleccionar(texto)).toEqual(await seleccionar(texto));
    expect((await seleccionar(texto)).texto).not.toContain("0.84");
  });
  it("rechaza una selección de canal ajeno aunque se fuerce desde el chat", async () => {
    active = luis;
    expect(
      (
        await route("POST", "chat", {
          texto: "Quiero un video: Intrusión",
          canalId: channel,
        })
      ).status,
    ).toBe(404);
  });
  it("registra los eventos del orquestador por dueño", () => {
    expect(
      db()
        .select()
        .from(events)
        .all()
        .every((e) => e.ownerId === ana.id),
    ).toBe(true);
  });
});
describe("Archivos, identidad y entradas", () => {
  let photo: string, evidence: string, asset: string;
  it("protege adjuntos y rechaza transcripción ajena", async () => {
    photo = randomUUID();
    evidence = randomUUID();
    db()
      .insert(attachments)
      .values([
        {
          id: photo,
          ownerId: ana.id,
          name: "foto.png",
          mime: "image/png",
          size: 4,
          data: "YWJjZA==",
        },
        {
          id: evidence,
          ownerId: ana.id,
          name: "voz.webm",
          mime: "audio/webm",
          size: 4,
          data: "YWJjZA==",
        },
      ])
      .run();
    active = luis;
    expect((await route("GET", `archivos/${photo}`)).status).toBe(404);
    expect((await route("POST", "transcribir", { id: evidence })).status).toBe(
      404,
    );
  });
  it("requiere consentimiento y mantiene la creación privada", async () => {
    await expect(
      new AvatarSimulado().verificar({
        mime: "audio/webm",
        consentimiento: false,
      }),
    ).rejects.toThrow();
    active = ana;
    const reto = await (
      await route("POST", "identidad", { kind: "avatar" })
    ).json();
    const result = await route("POST", "activos", {
      challengeId: reto.id,
      kind: "avatar",
      name: "Ana",
      photoIds: [photo],
      evidenceId: evidence,
      consentimiento: true,
      placement: "partes",
    });
    expect(result.status).toBe(200);
    asset = (await result.json()).id;
    expect(estado(luis).assets).toHaveLength(0);
    expect(
      db().select().from(assets).where(eq(assets.id, asset)).get()?.shared,
    ).toBe(false);
  });
  it("compartir permite la foto, nunca la evidencia ni modificar al otro", async () => {
    active = ana;
    db().update(assets).set({ polledAt: 0 }).where(eq(assets.id, asset)).run();
    await sincronizarMedios(ana);
    expect(
      (await route("PATCH", `activos/${asset}`, { shared: true })).status,
    ).toBe(200);
    active = luis;
    expect(estado(luis).assets).toHaveLength(1);
    expect((await route("GET", `archivos/${photo}`)).status).toBe(200);
    expect((await route("GET", `archivos/${evidence}`)).status).toBe(404);
    expect(
      (await route("PATCH", `activos/${asset}`, { shared: false })).status,
    ).toBe(404);
    expect((await route("DELETE", `activos/${asset}`)).status).toBe(404);
  });
  it("valida E.164, MIME y CSRF", async () => {
    active = ana;
    expect(
      (
        await route("PATCH", "perfil", {
          name: "Ana",
          theme: "claro",
          home: "chat",
          image: "",
          whatsapp: "98765",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await route("POST", "archivos", {
          name: "peligro.html",
          mime: "text/html",
          data: "YWJjZA==",
        })
      ).status,
    ).toBe(400);
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        origin: "https://otro.test",
        "content-type": "application/json",
      },
      body: '{"texto":"Hola"}',
    });
    expect(
      (await POST(request, { params: Promise.resolve({ ruta: ["chat"] }) }))
        .status,
    ).toBe(403);
  });
});

describe("Administración y validación reforzada", () => {
  it("permite al administrador editar un canal ajeno desde gestión, manteniendo el chat aislado", async () => {
    active = admin;
    expect(
      (
        await route("POST", "orden", {
          evento: "ajustar_biblia",
          recursoId: channel,
          texto: "Contenido didáctico",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await route("POST", "chat", {
          texto: "Ajusta la biblia: No autorizado en chat",
          canalId: channel,
        })
      ).status,
    ).toBe(404);
  });
  it("no eleva el rol mediante el perfil", async () => {
    active = ana;
    expect(
      (
        await route("PATCH", "perfil", {
          name: "Ana",
          theme: "oscuro",
          home: "chat",
          image: "",
          whatsapp: "",
          role: "admin",
        })
      ).status,
    ).toBe(200);
    expect(
      db().select().from(users).where(eq(users.id, ana.id)).get()?.role,
    ).toBe("usuario");
  });
});

describe("Selección de presentador por video", () => {
  it("conserva avatar, voz y presencia en cada producción", async () => {
    const result = await factory.ejecutar(ana, {
      evento: "nuevo_video",
      recursoId: channel,
      texto: "Con Cooper",
      avatarId: "cooper",
      voiceId: "clara",
      avatarPlacement: "completo",
    });
    expect(videosPropios(ana).find((v) => v.id === result.id)).toMatchObject({
      avatarId: "cooper",
      voiceId: "clara",
      avatarPlacement: "completo",
    });
  });
  it("rechaza una voz o avatar que no están disponibles", async () => {
    await expect(
      factory.ejecutar(ana, {
        evento: "nuevo_video",
        recursoId: channel,
        texto: "No disponible",
        avatarId: randomUUID(),
      }),
    ).rejects.toThrow("biblioteca");
    await expect(
      factory.ejecutar(ana, {
        evento: "nuevo_video",
        recursoId: channel,
        texto: "Tipo incorrecto",
        voiceId: "cooper",
      }),
    ).rejects.toThrow("biblioteca");
  });
});
