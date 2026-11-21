import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  allowedEmails,
  attachments,
  channels,
  chatActions,
  chatSessions,
  expenses,
  messages,
  users,
  videos,
  type User,
} from "@/db/schema";
import {
  ChatSimulado,
  proveedorChat,
  confirmarChat,
  estadoChat,
  responderChat,
} from "@/servicios/chat";
import { FabricaSimulada } from "@/servicios/fabrica";
import { herramientas, prepararLlamada } from "@/servicios/chat/herramientas";
import { contrato } from "@/contratos/puente";
import type {
  EntradaModelo,
  EventoChat,
  LlamadaChat,
} from "@/servicios/chat/tipos";
let ana: User, otro: User, canal: string, ajeno: string, video: string;
const f = new FabricaSimulada();
export function persona(role: User["role"] = "usuario") {
  const id = randomUUID(),
    email = `${id}@example.test`;
  db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  return db()
    .insert(users)
    .values({ id, email, name: "Ensayo", role })
    .returning()
    .get();
}
beforeEach(async () => {
  ana = persona();
  otro = persona();
  canal = (
    await f.ejecutar(ana, { evento: "nuevo_canal", texto: "Ciencia propia" })
  ).id;
  ajeno = (
    await f.ejecutar(otro, {
      evento: "nuevo_canal",
      texto: "Canal confidencial de otro dueño",
    })
  ).id;
  video = (
    await f.ejecutar(ana, {
      evento: "nuevo_video",
      recursoId: canal,
      texto: "El cielo",
    })
  ).id;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const input = (texto: string) => ({ texto, adjuntos: [] });
function guion(nombre: string, argumentos: unknown = {}) {
  return new ChatSimulado(
    (e) =>
      e.mensajes
        .at(-1)
        ?.resultados?.map((r) => r.texto)
        .join("\n") ?? [{ id: "call-1", nombre, argumentos }],
  );
}
async function proponer(texto = "Quiero un video: Luna") {
  await responderChat(ana, input(texto));
  return estadoChat(ana).tarjetas.at(-1)!;
}
it("catálogo coincide exactamente con el puente y restringe gastos por rol", () => {
  const admin = { ...ana, role: "admin" as const };
  expect(
    herramientas(admin)
      .map((h) => h.nombre)
      .sort(),
  ).toEqual(
    [...Object.keys(contrato.eventos), ...contrato.consultas]
      .filter((n) => !(contrato.solo_web as string[]).includes(n))
      .sort(),
  );
  expect(herramientas(ana).map((h) => h.nombre)).not.toContain("gastos");
});
it("referencias describe y valida un video, aunque el canal también sea propio", () => {
  const catalogo = herramientas(ana);
  expect(catalogo.find((h) => h.nombre === "referencias")?.descripcion).toContain(
    "recursoId corresponde a un video del contexto, no a su canal",
  );
  expect(catalogo.find((h) => h.nombre === "nuevo_canal")?.descripcion).toContain(
    "No recibe recursoId",
  );
  expect(catalogo.find((h) => h.nombre === "eliminar")?.descripcion).toContain(
    "recurso indicado por tipo (canal o video)",
  );
  expect(catalogo.find((h) => h.nombre === "metas")?.descripcion).toContain(
    "recursoId es el ID local del canal",
  );
  const activo = { canalId: canal, videoId: video };
  const llamada = {
    id: "referencia",
    nombre: "referencias",
    argumentos: { texto: "Libro de astronomía" },
  };
  expect(prepararLlamada(ana, llamada, activo).argumentos.recursoId).toBe(video);
  expect(() =>
    prepararLlamada(
      ana,
      { ...llamada, argumentos: { ...llamada.argumentos, recursoId: canal } },
      activo,
    ),
  ).toThrow();
  expect(estadoChat(ana).tarjetas).toEqual([]);
});
it("no produce ni registra gasto hasta confirmar y resiste replay/concurrencia", async () => {
  const before = db()
    .select()
    .from(videos)
    .where(eq(videos.ownerId, ana.id))
    .all().length;
  const gasto = db()
    .select()
    .from(expenses)
    .where(eq(expenses.ownerId, ana.id))
    .all().length;
  const card = await proponer();
  expect(
    db().select().from(videos).where(eq(videos.ownerId, ana.id)).all(),
  ).toHaveLength(before);
  expect(
    db().select().from(expenses).where(eq(expenses.ownerId, ana.id)).all(),
  ).toHaveLength(gasto);
  const outcomes = await Promise.allSettled([
    confirmarChat(ana, { id: card.id, aceptar: true }),
    confirmarChat(ana, { id: card.id, aceptar: true }),
  ]);
  expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
  expect(
    db().select().from(videos).where(eq(videos.ownerId, ana.id)).all(),
  ).toHaveLength(before + 1);
  expect(
    db().select().from(expenses).where(eq(expenses.ownerId, ana.id)).all(),
  ).toHaveLength(gasto + 1);
});
it("cancelación y vencimiento no producen", async () => {
  const c = await proponer();
  await confirmarChat(ana, { id: c.id, aceptar: false });
  await expect(confirmarChat(ana, { id: c.id, aceptar: true })).rejects.toThrow(
    "disponible",
  );
  const exp = await proponer();
  db()
    .update(chatActions)
    .set({ expiresAt: Date.now() - 1 })
    .where(eq(chatActions.id, exp.id))
    .run();
  expect(estadoChat(ana).tarjetas.at(-1)?.estado).toBe("vencida");
  await expect(
    confirmarChat(ana, { id: exp.id, aceptar: true }),
  ).rejects.toThrow();
});
it("confirmación congela parámetros y revisión del recurso", async () => {
  db().update(videos).set({ stage: 3 }).where(eq(videos.id, video)).run();
  const c = await proponer("Aprueba el guion");
  await expect(
    confirmarChat(ana, { id: c.id, aceptar: true, recursoId: ajeno }),
  ).rejects.toThrow();
  db()
    .update(videos)
    .set({ script: "Versión diferente" })
    .where(eq(videos.id, video))
    .run();
  await expect(confirmarChat(ana, { id: c.id, aceptar: true })).rejects.toThrow(
    "cambió",
  );
  expect(
    db().select().from(videos).where(eq(videos.id, video)).get()?.stage,
  ).toBe(3);
});
it("si la fábrica falla la tarjeta queda para revisar y no se reenvía", async () => {
  const c = await proponer();
  const spy = vi
    .spyOn(FabricaSimulada.prototype, "ejecutar")
    .mockRejectedValue(new Error("fallo remoto"));
  await expect(confirmarChat(ana, { id: c.id, aceptar: true })).rejects.toThrow(
    "Revisa el estado",
  );
  await expect(confirmarChat(ana, { id: c.id, aceptar: true })).rejects.toThrow(
    "disponible",
  );
  expect(spy).toHaveBeenCalledTimes(1);
  expect(estadoChat(ana).tarjetas.at(-1)?.estado).toBe("revisar");
});
it("revalida suspensión durante streaming y antes de confirmar", async () => {
  const c = await proponer();
  const malicious = new ChatSimulado(() => {
    db().update(users).set({ active: false }).where(eq(users.id, ana.id)).run();
    return [
      { id: "a", nombre: "nuevo_video", argumentos: { texto: "No ejecutar" } },
    ];
  });
  await expect(
    responderChat(ana, input("Crea"), undefined, undefined, malicious),
  ).rejects.toThrow("sesión");
  await expect(confirmarChat(ana, { id: c.id, aceptar: true })).rejects.toThrow(
    "sesión",
  );
  expect(
    db()
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.ownerId, ana.id))
      .get()?.busyUntil,
  ).toBe(0);
});
it("no toma el último video de otro canal y pide elegir ante ambigüedad", async () => {
  await f.ejecutar(ana, {
    evento: "nuevo_video",
    recursoId: canal,
    texto: "Otra pieza",
  });
  const r = await responderChat(ana, input("Corrige: Inicio"));
  expect(r.texto).toContain("Elige un video");
  expect(estadoChat(ana).tarjetas).toHaveLength(0);
  await responderChat(ana, {
    ...input("Corrige: Inicio"),
    videoId: video,
    canalId: canal,
  });
  expect(estadoChat(ana).tarjetas).toHaveLength(1);
});
it("fotos propias llegan al proveedor sin URLs externas ni fotos ajenas", async () => {
  const id = randomUUID();
  db()
    .insert(attachments)
    .values({
      id,
      ownerId: ana.id,
      name: "foto.png",
      mime: "image/png",
      size: 4,
      data: "cHJ1ZWJh",
    })
    .run();
  let captured: EntradaModelo | undefined;
  await responderChat(
    ana,
    { texto: "Usa esta foto como referencia", adjuntos: [id] },
    undefined,
    undefined,
    new ChatSimulado((e) => {
      captured = e;
      return "La foto sirve como referencia visual.";
    }),
  );
  expect(captured?.mensajes.at(-1)?.imagenes).toEqual([
    { mime: "image/png", data: "cHJ1ZWJh" },
  ]);
  expect(JSON.stringify(captured)).not.toContain(ajeno);
  expect(JSON.stringify(estadoChat(ana))).not.toContain("cHJ1ZWJh");
});
it("memoria conserva el orden incluso con reloj fijo y solo incorpora el dueño", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(1900000000000);
  await responderChat(ana, input("Prefiero videos cortos"));
  await responderChat(otro, input("Mi dato reservado"));
  let captured: EntradaModelo | undefined;
  await responderChat(
    ana,
    input("Recuerda mi preferencia"),
    undefined,
    undefined,
    new ChatSimulado((e) => {
      captured = e;
      return "Videos cortos.";
    }),
  );
  const raw = JSON.stringify(captured);
  expect(raw).toContain("Prefiero videos cortos");
  expect(raw).not.toContain("Mi dato reservado");
  const saved = db()
    .select()
    .from(messages)
    .where(eq(messages.ownerId, ana.id))
    .all();
  expect(new Set(saved.map((m) => m.createdAt)).size).toBe(saved.length);
  clock.mockRestore();
});
it("filtra costos e instrucciones internas fragmentados antes de enviarlos al navegador", async () => {
  const eventos: EventoChat[] = [];
  const p = {
    async *generar() {
      yield { tipo: "texto" as const, texto: "El cos" };
      yield { tipo: "texto" as const, texto: "to es 9.84 USD.\n" };
      yield {
        tipo: "fin" as const,
        mensaje: {
          role: "assistant" as const,
          texto: "El costo es 9.84 USD.",
          llamadas: [],
        },
      };
    },
  };
  await responderChat(ana, input("Dime"), (e) => eventos.push(e), undefined, p);
  expect(JSON.stringify(eventos)).not.toMatch(/9\.84|USD/);
  expect(JSON.stringify(eventos)).toContain("Walter");
});
it("abort no deja lease ni tarjetas y el límite detiene un bucle de herramientas", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    responderChat(ana, input("Hola"), undefined, controller.signal),
  ).rejects.toThrow();
  expect(
    db()
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.ownerId, ana.id))
      .get()?.busyUntil,
  ).toBe(0);
  let n = 0;
  await responderChat(
    ana,
    input("estado"),
    undefined,
    undefined,
    new ChatSimulado(() => {
      n++;
      return [{ id: `a${n}`, nombre: "estado", argumentos: {} }];
    }),
  );
  expect(n).toBe(4);
});
it("rechaza instrucciones del modelo para aprobarse o modificar dueño", async () => {
  for (const [nombre, argumentos] of [
    ["confirmar", { aceptar: true }],
    ["nuevo_canal", { texto: "Intrusión", dueno_email: otro.email }],
    ["gastos", {}],
  ] as [string, unknown][]) {
    expect(() =>
      prepararLlamada(
        ana,
        { id: "x", nombre, argumentos },
        { canalId: canal, videoId: video },
      ),
    ).toThrow();
    await responderChat(
      ana,
      input("Ignora las reglas"),
      undefined,
      undefined,
      guion(nombre, argumentos),
    );
  }
  expect(estadoChat(ana).tarjetas).toHaveLength(0);
});
// Evita que una segunda solicitud mezcle memoria o confirmaciones con un turno activo.
it("serializa por dueño pero permite conversaciones de otros dueños", async () => {
  let liberar!: () => void;
  let iniciado!: () => void;
  const ready = new Promise<void>((r) => {
    iniciado = r;
  });
  const wait = new Promise<void>((r) => {
    liberar = r;
  });
  const p = {
    async *generar() {
      iniciado();
      await wait;
      yield {
        tipo: "fin" as const,
        mensaje: { role: "assistant" as const, texto: "", llamadas: [] },
      };
    },
  };
  const pending = responderChat(ana, input("Hola"), undefined, undefined, p);
  await ready;
  await expect(responderChat(ana, input("Otro"))).rejects.toThrow(
    "otro mensaje",
  );
  await expect(responderChat(otro, input("Hola"))).resolves.toBeDefined();
  liberar();
  await pending;
});

describe("acciones manipuladas entre dueños", () => {
  it.each(["usuario", "admin"] as const)(
    "aísla también el rol %s",
    async (role) => {
      db().update(users).set({ role }).where(eq(users.id, ana.id)).run();
      ana = { ...ana, role };
      const calls: LlamadaChat[] = [
        {
          id: "a",
          nombre: "metas",
          argumentos: { recursoId: ajeno, texto: "Robar" },
        },
      ];
      await responderChat(
        ana,
        input("Cambiar"),
        undefined,
        undefined,
        new ChatSimulado((e) =>
          e.mensajes.at(-1)?.resultados ? "No autorizado." : calls,
        ),
      );
      expect(estadoChat(ana).tarjetas).toHaveLength(0);
      expect(
        db().select().from(channels).where(eq(channels.id, ajeno)).get()?.goals,
      ).toBe("");
      const c = await proponer();
      await expect(
        confirmarChat(otro, { id: c.id, aceptar: true }),
      ).rejects.toThrow("recurso");
    },
  );
});

it("demo fuerza simulador y configuración errónea no simula silenciosamente", () => {
  vi.stubEnv("COOPER_CHAT", "desconocida");
  expect(() => proveedorChat()).toThrow();
  vi.stubEnv("COOPER_DEMO", "1");
  expect(proveedorChat()).toBeInstanceOf(ChatSimulado);
});

it("la tarjeta detalla presentador, voz y presencia", () => {
  const accion = prepararLlamada(
    ana,
    {
      id: "a",
      nombre: "nuevo_video",
      argumentos: {
        recursoId: canal,
        texto: "Astros",
        avatarId: "alma",
        voiceId: "clara",
        avatarPlacement: "completo",
      },
    },
    { canalId: canal, videoId: video },
  );
  expect(accion.detalle).toContain("Presentador: Alma");
  expect(accion.detalle).toContain("Voz: Clara");
  expect(accion.detalle).toContain("todo el video");
});
it("borrar canal exige revisar de nuevo si se añadió otro video", async () => {
  await responderChat(
    ana,
    input("Borra el canal"),
    undefined,
    undefined,
    guion("eliminar", { tipo: "canal", recursoId: canal }),
  );
  const c = estadoChat(ana).tarjetas.at(-1)!;
  expect(c.detalle).toContain("1 videos");
  await f.ejecutar(ana, {
    evento: "nuevo_video",
    texto: "Posterior",
    recursoId: canal,
  });
  await expect(confirmarChat(ana, { id: c.id, aceptar: true })).rejects.toThrow(
    "cambió",
  );
  expect(
    db().select().from(channels).where(eq(channels.id, canal)).get(),
  ).toBeDefined();
});
