import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  channels,
  videos,
  allowedEmails,
  chatActions,
} from "@/db/schema";
import { FabricaSimulada } from "@/servicios/fabrica";
import { responderChat, confirmarChat, estadoChat } from "@/servicios/chat";
import { aplicarEstado } from "@/servicios/puente";

async function espacio() {
  const id = randomUUID();
  const user = db()
    .insert(users)
    .values({ id, name: "Ensayo", email: `${id}@example.test` })
    .returning()
    .get();
  db()
    .insert(allowedEmails)
    .values({ email: user.email, createdAt: Date.now() })
    .run();
  const fabrica = new FabricaSimulada();
  const c = await fabrica.ejecutar(user, {
    evento: "nuevo_canal",
    texto: "Ciencia",
  });
  return { user, fabrica, canalId: c.id };
}
it("activa y desactiva noticias desde Cooper sin alterar la biblia ni otros canales", async () => {
  const { user, fabrica, canalId } = await espacio();
  const other = await espacio();
  for (const [texto, active] of [
    ["Activa modo noticia", true],
    ["Desactiva modo noticia", false],
  ] as const) {
    await responderChat(user, { texto, canalId, adjuntos: [] });
    const card = estadoChat(user).tarjetas.at(-1)!;
    expect(card).toBeDefined();
    expect(
      JSON.parse(
        db()
          .select()
          .from(chatActions)
          .where(eq(chatActions.id, card.id))
          .get()!.arguments,
      ).parametros,
    ).toEqual({ campo: "modo_noticia", valor: active });
    expect(
      db().select().from(channels).where(eq(channels.id, canalId)).get()
        ?.newsMode,
    ).toBe(!active);
    await expect(
      confirmarChat(other.user, { id: card.id, aceptar: true }),
    ).rejects.toThrow();
    await confirmarChat(user, { id: card.id, aceptar: true });
    expect(
      db().select().from(channels).where(eq(channels.id, canalId)).get(),
    ).toMatchObject({ newsMode: active, bible: "" });
  }
  await expect(
    fabrica.ejecutar(user, {
      evento: "ajustar_biblia",
      recursoId: other.canalId,
      texto: "Activar",
      parametros: { campo: "modo_noticia", valor: true },
    }),
  ).rejects.toThrow();
  await expect(
    fabrica.ejecutar(user, {
      evento: "ajustar_biblia",
      recursoId: canalId,
      texto: "Activar",
      parametros: { campo: "modo_noticia", valor: "false" },
    }),
  ).rejects.toThrow();
});
it("un pedido de noticia conserva la modalidad y el simulador no inventa verificaciones", async () => {
  const { user, fabrica, canalId } = await espacio();
  await fabrica.ejecutar(user, {
    evento: "ajustar_biblia",
    recursoId: canalId,
    texto: "Activar",
    parametros: { campo: "modo_noticia", valor: true },
  });
  const v = await fabrica.ejecutar(user, {
    evento: "nuevo_video",
    recursoId: canalId,
    texto: "Noticia de hoy",
  });
  await fabrica.ejecutar(user, {
    evento: "ajustar_biblia",
    recursoId: canalId,
    texto: "Desactivar",
    parametros: { campo: "modo_noticia", valor: false },
  });
  await fabrica.sincronizar(user);
  expect(
    db().select().from(videos).where(eq(videos.id, v.id)).get(),
  ).toMatchObject({ newsMode: true, stage: 2, productionState: "pausada" });
  await expect(fabrica.aprobar(user, v.id)).rejects.toThrow();
  await responderChat(user, {
    texto: "Quiero un video de la noticia del día",
    canalId,
    adjuntos: [],
  });
  const card = estadoChat(user).tarjetas.at(-1)!;
  expect(card).toBeDefined();
  expect(
    JSON.parse(
      db().select().from(chatActions).where(eq(chatActions.id, card.id)).get()!
        .arguments,
    ).parametros,
  ).toEqual({ modo_noticia: true });
  await confirmarChat(user, { id: card.id, aceptar: true });
  expect(
    db()
      .select()
      .from(videos)
      .where(eq(videos.title, "Quiero un video de la noticia del día"))
      .get()?.newsMode,
  ).toBe(true);
});
it("la conciliación conserva compatibilidad y aplica modalidad confirmada por n8n", async () => {
  const { user, canalId } = await espacio();
  aplicarEstado(user, {
    canales: [
      {
        id: canalId,
        dueno_email: user.email,
        nombre: "Ciencia",
        nicho: "Ciencia",
        modo_noticia: true,
      },
    ],
    videos: [],
  });
  expect(
    db().select().from(channels).where(eq(channels.id, canalId)).get()
      ?.newsMode,
  ).toBe(true);
  aplicarEstado(user, {
    canales: [
      {
        id: canalId,
        dueno_email: user.email,
        nombre: "Ciencia",
        nicho: "Ciencia",
      },
    ],
    videos: [],
  });
  expect(
    db().select().from(channels).where(eq(channels.id, canalId)).get()
      ?.newsMode,
  ).toBe(true);
});
