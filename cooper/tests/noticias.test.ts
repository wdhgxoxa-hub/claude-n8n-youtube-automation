import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, channels, videos } from "@/db/schema";
import { FabricaSimulada } from "@/servicios/fabrica";
import { ChatSimulado } from "@/servicios/chat";
import { aplicarEstado } from "@/servicios/puente";

async function espacio() {
  const id = randomUUID();
  const user = db()
    .insert(users)
    .values({ id, name: "Ensayo", email: `${id}@example.test` })
    .returning()
    .get();
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
  const chat = new ChatSimulado();
  for (const [texto, active] of [
    ["Activa modo noticia", true],
    ["Desactiva modo noticia", false],
  ] as const) {
    const r = await chat.responder(user, { texto, canalId, adjuntos: [] });
    expect(r.orden?.parametros).toEqual({
      campo: "modo_noticia",
      valor: active,
    });
    await fabrica.ejecutar(user, r.orden!);
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
  const r = await new ChatSimulado().responder(user, {
    texto: "Quiero un video de la noticia del día",
    canalId,
    adjuntos: [],
  });
  expect(r.orden?.parametros).toEqual({ modo_noticia: true });
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
