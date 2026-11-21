import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  channels,
  users,
  videos,
  whatsappContacts,
  whatsappOutbox,
  type User,
} from "@/db/schema";
import { aplicarEstado } from "@/servicios/puente";
import { sinObservabilidad } from "@/contratos/observabilidad";

type Snapshot = Parameters<typeof aplicarEstado>[1];
function cuenta(role: User["role"] = "usuario") {
  const id = randomUUID();
  db()
    .insert(users)
    .values({ id, email: `${id}@example.test`, name: "Ensayo", role })
    .run();
  return db().select().from(users).where(eq(users.id, id)).get()!;
}
function canal(user: User, id = randomUUID()): Snapshot["canales"][number] {
  return { id, dueno_email: user.email, nombre: "Canal", nicho: "Ensayo" };
}
function video(
  user: User,
  channelId: string,
  id = randomUUID(),
): Snapshot["videos"][number] {
  return {
    id,
    dueno_email: user.email,
    canal_id: channelId,
    titulo: "Original",
    stage: 1,
    script: "Guion",
    actualizado_en: 100,
  };
}
const leerVideo = (id: string) =>
  db().select().from(videos).where(eq(videos.id, id)).get();
afterEach(() => vi.restoreAllMocks());

it("no prepara una sentencia nativa por fila al sincronizar un lote y repetirlo", () => {
  const user = cuenta(),
    c = canal(user);
  const snapshot = {
    canales: [c],
    videos: Array.from({ length: 256 }, () => video(user, c.id)),
  };
  const prepare = vi.spyOn(db().$client, "prepare");
  for (let i = 0; i < 3; i++) {
    prepare.mockClear();
    aplicarEstado(user, snapshot);
    // El límite incluye la transacción. No depende del tamaño del lote.
    expect(prepare.mock.calls.length).toBeLessThanOrEqual(8);
  }
  prepare.mockRestore();
  expect(
    db().select().from(videos).where(eq(videos.ownerId, user.id)).all(),
  ).toHaveLength(256);
  expect(leerVideo(snapshot.videos[255].id)).toMatchObject({
    ownerId: user.id,
    channelId: c.id,
    remoteUpdatedAt: 100,
  });
});

it("ve cambios anteriores del mismo lote y conserva cancelación, revisión y observabilidad", () => {
  const user = cuenta(),
    c = canal(user),
    v = video(user, c.id);
  aplicarEstado(user, {
    canales: [
      { ...c, modo_noticia: true },
      { ...c, nombre: "Renombrado" },
    ],
    videos: [
      { ...v, modo_noticia: true },
      { ...v, actualizado_en: 200, titulo: "Nuevo" },
    ],
  });
  const before = leerVideo(v.id)!;
  expect(before).toMatchObject({
    title: "Nuevo",
    remoteUpdatedAt: 200,
    newsMode: true,
  });
  expect(
    db().select().from(channels).where(eq(channels.id, c.id)).get(),
  ).toMatchObject({ name: "Renombrado", newsMode: true });
  db()
    .update(videos)
    .set({ productionState: "cancelada", stage: 4 })
    .where(eq(videos.id, v.id))
    .run();
  const observabilidad = {
    ...sinObservabilidad,
    montaje: "https://example.test/publicado.mp4",
  };
  aplicarEstado(user, {
    canales: [],
    videos: [
      {
        ...v,
        actualizado_en: 300,
        stage: 11,
        titulo: "Corregido",
        observabilidad,
      },
      {
        ...v,
        actualizado_en: 300,
        stage: 9,
        titulo: "No reemplazar",
        observabilidad: {
          ...observabilidad,
          miniatura: "https://example.test/miniatura.jpg",
        },
      },
      {
        ...v,
        actualizado_en: 100,
        titulo: "Atrasado",
        observabilidad: sinObservabilidad,
      },
    ],
  });
  expect(leerVideo(v.id)).toMatchObject({
    ownerId: user.id,
    channelId: c.id,
    createdAt: before.createdAt,
    title: "Corregido",
    stage: 4,
    productionState: "cancelada",
    newsMode: true,
    remoteUpdatedAt: 300,
  });
  expect(JSON.parse(leerVideo(v.id)!.observability)).toEqual({
    ...observabilidad,
    miniatura: "https://example.test/miniatura.jpg",
  });
});

it("mantiene el encolado por revisión, el aislamiento y la reversa completa ante dueño incompatible", () => {
  const user = cuenta(),
    other = cuenta(),
    admin = cuenta("admin"),
    c = canal(user),
    foreignChannel = canal(other);
  db()
    .insert(whatsappContacts)
    .values({
      ownerId: user.id,
      phone: "+51900000001",
      verifiedAt: 1,
      consentAt: 1,
      preferences: JSON.stringify({
        guion: true,
        final: true,
        publicado: true,
      }),
    })
    .run();
  const v = { ...video(user, c.id), stage: 3 },
    foreign = video(other, foreignChannel.id);
  aplicarEstado(admin, { canales: [c, foreignChannel], videos: [v, foreign] });
  aplicarEstado(user, {
    canales: [],
    videos: [
      v,
      { ...foreign, actualizado_en: 500, titulo: "Prohibido" },
      { ...v, actualizado_en: 200, stage: 9 },
    ],
  });
  const jobs = () =>
    db()
      .select()
      .from(whatsappOutbox)
      .where(eq(whatsappOutbox.ownerId, user.id))
      .all();
  expect(jobs().map((j) => j.revision)).toEqual(["3:100", "9:200"]);
  expect(leerVideo(foreign.id)?.title).toBe("Original");
  expect(() =>
    aplicarEstado(admin, {
      canales: [{ ...c, nombre: "Debe revertirse" }],
      videos: [
        { ...v, actualizado_en: 300, stage: 11 },
        {
          ...foreign,
          dueno_email: user.email,
          canal_id: c.id,
          actualizado_en: 600,
        },
      ],
    }),
  ).toThrow("Propietario incompatible.");
  expect(leerVideo(v.id)).toMatchObject({ stage: 9, remoteUpdatedAt: 200 });
  expect(jobs()).toHaveLength(2);
  expect(
    db().select().from(channels).where(eq(channels.id, c.id)).get()?.name,
  ).toBe("Canal");
  expect(leerVideo(foreign.id)?.ownerId).toBe(other.id);
});
