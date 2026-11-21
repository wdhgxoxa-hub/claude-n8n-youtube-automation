import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  messages,
  allowedEmails,
  users,
  videos,
  attachments,
  channels,
  chatActions,
} from "@/db/schema";
import {
  ChatSimulado,
  responderChat,
  confirmarChat,
  estadoChat,
} from "@/servicios/chat";
import { FabricaSimulada } from "@/servicios/fabrica";
import { herramientas } from "@/servicios/chat/herramientas";
import type {
  EntradaModelo,
  LlamadaChat,
  MensajeModelo,
} from "@/servicios/chat/tipos";
import guiones from "./fixtures/chat-30.json";
function mediana(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return n
    ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2
    : 0;
}
const resultado: {
  id: number;
  tipo: string;
  resultado: string;
  palabras: number[];
}[] = [];
function persona(admin = false) {
  const id = randomUUID(),
    email = `${id}@example.test`;
  db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  return db()
    .insert(users)
    .values({
      id,
      email,
      name: "Evaluación",
      role: admin ? "admin" : "usuario",
    })
    .returning()
    .get();
}
afterAll(() => {
  expect(mediana(resultado.flatMap((r) => r.palabras))).toBeLessThanOrEqual(20);
  writeFileSync(
    ".cache/evaluacion-chat-30.json",
    JSON.stringify(
      {
        proveedor: "simulado",
        conversaciones: resultado,
        total: resultado.length,
        respuestas: resultado.flatMap((r) => r.palabras).length,
        medianaPalabras: mediana(resultado.flatMap((r) => r.palabras)),
        maximoPalabras: Math.max(0, ...resultado.flatMap((r) => r.palabras)),
        descripcion:
          "Evalúa selección determinista, orquestación y defensas. No mide acierto de modelos remotos.",
      },
      null,
      2,
    ),
  );
});
it.each(guiones)("conversación $id: $tipo — $texto", async (g) => {
  const user = persona(g.herramienta === "gastos" || g.tipo === "admin_ajeno"),
    other = persona();
  const f = new FabricaSimulada();
  const canal = (
    await f.ejecutar(user, { evento: "nuevo_canal", texto: "Ciencia" })
  ).id;
  const ajeno = (
    await f.ejecutar(other, { evento: "nuevo_canal", texto: "Canal reservado" })
  ).id;
  const video = (
    await f.ejecutar(user, {
      evento: "nuevo_video",
      recursoId: canal,
      texto: "Luna",
    })
  ).id;
  const privado = (
    await f.ejecutar(other, {
      evento: "nuevo_video",
      recursoId: ajeno,
      texto: "Video confidencial",
    })
  ).id;
  db()
    .update(videos)
    .set({ stage: g.herramienta === "aprobar_final" ? 9 : 3 })
    .where(eq(videos.id, video))
    .run();
  const input = {
    texto: g.texto,
    adjuntos: [] as string[],
    canalId: canal,
    videoId: video,
  };
  const beforeOther = JSON.stringify({
    channel: db().select().from(channels).where(eq(channels.id, ajeno)).get(),
    video: db().select().from(videos).where(eq(videos.id, privado)).get(),
  });
  if (g.tipo === "intencion") {
    let seleccion: MensajeModelo | undefined;
    for await (const e of new ChatSimulado().generar(
      {
        sistema: "",
        mensajes: [{ role: "user", texto: g.texto }],
        herramientas: herramientas(user),
      },
      AbortSignal.timeout(1000),
    ))
      if (e.tipo === "fin") seleccion = e.mensaje;
    expect(seleccion?.llamadas?.[0]?.nombre).toBe(g.herramienta);
    await responderChat(user, input);
    if (Object.keys(contratoEventos).includes(g.herramienta)) {
      const card = estadoChat(user).tarjetas.at(-1)!;
      expect(
        db().select().from(chatActions).where(eq(chatActions.id, card.id)).get()
          ?.tool,
      ).toBe(g.herramienta);
      await confirmarChat(user, { id: card.id, aceptar: true });
      expect(estadoChat(user).tarjetas.at(-1)?.estado).toBe("confirmada");
    } else expect(estadoChat(user).tarjetas).toHaveLength(0);
  } else if (
    [
      "canal_ajeno",
      "video_ajeno",
      "admin_ajeno",
      "dueno_inyectado",
      "herramienta_inyectada",
    ].includes(g.tipo)
  ) {
    const llamada: LlamadaChat =
      g.tipo === "video_ajeno"
        ? {
            id: "x",
            nombre: "corregir",
            argumentos: { recursoId: privado, texto: "Cambio" },
          }
        : g.tipo === "dueno_inyectado"
          ? {
              id: "x",
              nombre: "nuevo_canal",
              argumentos: { texto: "Cambio", dueno_email: other.email },
            }
          : g.tipo === "herramienta_inyectada"
            ? { id: "x", nombre: "ejecutar_sql", argumentos: {} }
            : {
                id: "x",
                nombre: "metas",
                argumentos: { recursoId: ajeno, texto: "Cambio" },
              };
    const provider = new ChatSimulado((e) =>
      e.mensajes.at(-1)?.resultados
        ? "No puedo realizar esa acción."
        : [llamada],
    );
    await responderChat(user, input, undefined, undefined, provider);
    expect(estadoChat(user).tarjetas).toHaveLength(0);
  } else if (g.tipo === "foto_ajena") {
    const id = randomUUID();
    db()
      .insert(attachments)
      .values({
        id,
        ownerId: other.id,
        name: "privada.png",
        mime: "image/png",
        size: 4,
        data: "cHJ1ZWJh",
      })
      .run();
    await expect(
      responderChat(user, { ...input, adjuntos: [id] }),
    ).rejects.toThrow("recurso");
  } else if (g.tipo === "tarjeta_ajena") {
    await responderChat(other, { texto: "Crea un canal: Otro", adjuntos: [] });
    const card = estadoChat(other).tarjetas.at(-1)!;
    await expect(
      confirmarChat(user, { id: card.id, aceptar: true }),
    ).rejects.toThrow("recurso");
  } else if (g.tipo === "si_ambiguo") {
    await responderChat(user, { ...input, texto: "Quiero un video: Nuevo" });
    const card = estadoChat(user).tarjetas.at(-1)!;
    await responderChat(user, input);
    expect(
      estadoChat(user).tarjetas.find((c) => c.id === card.id)?.estado,
    ).toBe("pendiente");
  } else if (g.tipo === "memoria") {
    await responderChat(user, input);
    let context: EntradaModelo | undefined;
    await responderChat(
      user,
      { texto: "¿Qué prefiero?", adjuntos: [] },
      undefined,
      undefined,
      new ChatSimulado((e) => {
        context = e;
        return "Videos de un minuto.";
      }),
    );
    expect(context?.sistema).toContain("una sola frase de hasta 18 palabras");
    expect(context?.sistema).toContain(
      "usa una segunda frase solo si hace falta una decisión",
    );
    expect(context?.sistema).toContain(
      "solo extiéndete si el usuario pide detalle",
    );
    expect(JSON.stringify(context)).toContain(g.texto);
    expect(JSON.stringify(context)).toContain(canal);
    expect(JSON.stringify(context)).not.toContain("Video confidencial");
    expect(estadoChat(user).canalId).toBe(canal);
  } else if (g.tipo === "audio") {
    // Texto editable que devuelve el contrato de transcripción, enviado como mensaje.
    await responderChat(user, input);
    expect(estadoChat(user).tarjetas.at(-1)?.detalle).toContain(
      "Pedido dictado",
    );
  } else {
    const answer = await responderChat(user, input);
    expect(estadoChat(user).tarjetas).toHaveLength(0);
    expect(answer.texto).toMatch(
      g.tipo === "avatar" ? /identidad.*consentimiento/ : /fuera de mi alcance/,
    );
  }
  expect(
    JSON.stringify({
      channel: db().select().from(channels).where(eq(channels.id, ajeno)).get(),
      video: db().select().from(videos).where(eq(videos.id, privado)).get(),
    }),
  ).toBe(beforeOther);
  const respuestas = db()
    .select()
    .from(messages)
    .where(eq(messages.ownerId, user.id))
    .all()
    .filter((m) => m.role === "assistant");
  resultado.push({
    id: g.id,
    tipo: g.tipo,
    resultado: "PASS",
    palabras: respuestas.map(
      (m) => m.content.trim().split(/\s+/u).filter(Boolean).length,
    ),
  });
});
import { contrato } from "@/contratos/puente";
const contratoEventos = contrato.eventos;
