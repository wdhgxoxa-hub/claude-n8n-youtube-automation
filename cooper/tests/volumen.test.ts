import { beforeAll, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  videos,
  whatsappContacts,
  whatsappOutbox,
  whatsappAttempts,
  users,
} from "@/db/schema";
import { fixtureVolumen, AHORA_VOLUMEN } from "../scripts/fixture-volumen";
import { cicloMensajeria } from "@/servicios/mensajeria/trabajador";
import * as cola from "@/servicios/mensajeria/cola";
import { estado } from "@/servicios/datos";
import { leerResultados } from "@/servicios/resultados";

beforeAll(() => {
  fixtureVolumen();
}, 30000);
it("H19: un historial estable de 10.000 videos no vuelve a encolarse", async () => {
  const antes = db().select().from(whatsappOutbox).all();
  const encolar = vi.spyOn(cola, "encolarVideo");
  try {
    await cicloMensajeria(AHORA_VOLUMEN);
    expect(encolar.mock.calls.length).toBe(0);
    expect(db().select().from(whatsappOutbox).all()).toEqual(antes);
    expect(db().select().from(whatsappAttempts).all()).toHaveLength(0);
  } finally {
    encolar.mockRestore();
  }
});

it("H19: conserva lectura completa, orden de datos y aislamiento con volumen", () => {
  const equipo = fixtureUsuarios();
  const propio = estado(equipo[1]);
  expect(propio.videos).toHaveLength(1000);
  expect(propio.videos.every((v) => v.ownerId === equipo[1].id)).toBe(true);
  expect(propio.videos.map((v) => v.createdAt)).toEqual(
    propio.videos.map((v) => v.createdAt).sort((a, b) => b - a),
  );
  expect(propio.messages).toHaveLength(100);
  expect(propio.messages.map((m) => m.createdAt)).toEqual(
    propio.messages.map((m) => m.createdAt).sort((a, b) => a - b),
  );
  expect(estado(equipo[0]).videos).toHaveLength(10000);
  const r = leerResultados(equipo[1]);
  expect(r.publicaciones).toHaveLength(1000);
  expect(r.ambitos.every((a) => a.ownerId === equipo[1].id)).toBe(true);
  expect(
    r.publicaciones.every(
      (p) =>
        p.tipo === "video" &&
        p.publicacion.historial[0].fecha < p.publicacion.historial[1].fecha,
    ),
  ).toBe(true);
  expect(leerResultados(equipo[0]).publicaciones).toHaveLength(10000);
});

it("H19: reabrir SQLite conserva la deduplicación incluso de fallidos e inciertos", async () => {
  const antes = db().select().from(whatsappOutbox).all();
  db().$client.close();
  delete (
    globalThis as typeof globalThis & { cooperDb?: ReturnType<typeof db> }
  ).cooperDb;
  const encolar = vi.spyOn(cola, "encolarVideo");
  try {
    await cicloMensajeria(AHORA_VOLUMEN);
    expect(encolar.mock.calls.length).toBe(0);
    expect(db().select().from(whatsappOutbox).all()).toEqual(antes);
  } finally {
    encolar.mockRestore();
  }
});

it("H19: mantiene el orden entre dueños y proyecta solo los campos del aviso", async () => {
  for (const id of ["video-9023", "video-9021", "video-9022"])
    db()
      .update(videos)
      .set({ stage: 3, remoteUpdatedAt: 0, updatedAt: AHORA_VOLUMEN + 2 })
      .where(eq(videos.id, id))
      .run();
  const encolar = vi.spyOn(cola, "encolarVideo");
  try {
    await cicloMensajeria(AHORA_VOLUMEN);
    expect(encolar.mock.calls.map(([v]) => v.id)).toEqual([
      "video-9021",
      "video-9022",
      "video-9023",
    ]);
    expect(Object.keys(encolar.mock.calls[0][0]).sort()).toEqual([
      "id",
      "ownerId",
      "productionState",
      "remoteUpdatedAt",
      "stage",
      "updatedAt",
    ]);
  } finally {
    encolar.mockRestore();
  }
});

it("H19: descubre revisiones locales/remotas sin duplicar ni perder cambios con igual fecha", async () => {
  for (const id of ["video-9001", "video-9011"])
    db()
      .update(videos)
      .set({ stage: 3, remoteUpdatedAt: 0, updatedAt: AHORA_VOLUMEN })
      .where(eq(videos.id, id))
      .run();
  await cicloMensajeria(AHORA_VOLUMEN);
  const nuevos = db()
    .select()
    .from(whatsappOutbox)
    .all()
    .filter((j) => j.revision === `3:${AHORA_VOLUMEN}`);
  expect(nuevos).toHaveLength(2);
  expect(nuevos.every((j) => j.ownerId === "dueno-1")).toBe(true);
  await cicloMensajeria(AHORA_VOLUMEN);
  expect(
    db()
      .select()
      .from(whatsappOutbox)
      .all()
      .filter((j) => j.revision === `3:${AHORA_VOLUMEN}`),
  ).toHaveLength(2);
  db()
    .update(videos)
    .set({ stage: 9, remoteUpdatedAt: AHORA_VOLUMEN + 1 })
    .where(eq(videos.id, "video-9001"))
    .run();
  await cicloMensajeria(AHORA_VOLUMEN + 1);
  expect(
    db()
      .select()
      .from(whatsappOutbox)
      .all()
      .filter((j) => j.revision === `9:${AHORA_VOLUMEN + 1}`),
  ).toHaveLength(1);
});

it("H19: habilitar avisos después descubre historia; reverificar permite una nueva clave", async () => {
  const video = db()
    .select()
    .from(videos)
    .where(eq(videos.id, "video-9998"))
    .get()!;
  db()
    .update(videos)
    .set({ stage: 3, productionState: "activa" })
    .where(eq(videos.id, video.id))
    .run();
  const propios = () =>
    db()
      .select()
      .from(whatsappOutbox)
      .where(eq(whatsappOutbox.resourceId, video.id))
      .all();
  await cicloMensajeria(AHORA_VOLUMEN);
  expect(propios()).toHaveLength(0);
  db()
    .update(whatsappContacts)
    .set({
      verifiedAt: AHORA_VOLUMEN,
      preferences: JSON.stringify({
        guion: false,
        final: false,
        publicado: false,
        gasto: false,
      }),
    })
    .where(eq(whatsappContacts.ownerId, video.ownerId))
    .run();
  await cicloMensajeria(AHORA_VOLUMEN);
  expect(propios()).toHaveLength(0);
  db()
    .update(whatsappContacts)
    .set({
      preferences: JSON.stringify({
        guion: true,
        final: false,
        publicado: false,
        gasto: false,
      }),
    })
    .where(eq(whatsappContacts.ownerId, video.ownerId))
    .run();
  await cicloMensajeria(AHORA_VOLUMEN);
  expect(propios()).toHaveLength(1);
  db()
    .update(whatsappContacts)
    .set({ verifiedAt: AHORA_VOLUMEN + 1 })
    .where(eq(whatsappContacts.ownerId, video.ownerId))
    .run();
  await cicloMensajeria(AHORA_VOLUMEN + 1);
  expect(propios()).toHaveLength(2);
  await cicloMensajeria(AHORA_VOLUMEN + 1);
  expect(propios()).toHaveLength(2);
});

function fixtureUsuarios() {
  return db().select().from(users).all();
}
