import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, channels, videos, type User } from "@/db/schema";
import { prepararDemo } from "@/servicios/demo";
import { estado } from "@/servicios/datos";
import { rutaBase } from "@/lib/demo";
import { fabrica, FabricaSimulada } from "@/servicios/fabrica";

afterEach(() => vi.unstubAllEnvs());
function user(id: string): User {
  return db()
    .insert(users)
    .values({ id, email: `${id}@example.test`, name: id })
    .returning()
    .get();
}
describe("Demostración aislada", () => {
  it("selecciona otro archivo sin alterar la ruta habitual", () => {
    expect(rutaBase("/tmp/cooper.sqlite", true)).toBe(
      "/tmp/cooper.sqlite.demo",
    );
    expect(rutaBase("/tmp/cooper.sqlite", false)).toBe("/tmp/cooper.sqlite");
  });
  it("no crea ejemplos cuando la variable está apagada", () => {
    vi.stubEnv("COOPER_DEMO", "0");
    const owner = user("sin-demo");
    prepararDemo(owner);
    expect(estado(owner).channels).toHaveLength(0);
    expect(estado(owner).demo).toBe(false);
  });
  it("crea dos canales y cuatro etapas por usuario una sola vez y conserva eliminaciones", () => {
    vi.stubEnv("COOPER_DEMO", "1");
    const owner = user("con-demo"),
      other = user("otro-demo");
    prepararDemo(owner);
    prepararDemo(owner);
    const snapshot = estado(owner);
    expect(snapshot.channels).toHaveLength(2);
    expect(snapshot.videos.map((v) => v.stage)).toEqual([7, 3, 9, 11]);
    expect(estado(other).videos).toHaveLength(0);
    expect(
      snapshot.videos.every((v) =>
        snapshot.channels.some((c) => c.id === v.channelId),
      ),
    ).toBe(true);
    db().delete(channels).where(eq(channels.ownerId, owner.id)).run();
    prepararDemo(owner);
    expect(estado(owner).channels).toHaveLength(0);
  });
  it("usa solo el simulador, mantiene el ejemplo de montaje y respeta aprobaciones", async () => {
    vi.stubEnv("COOPER_DEMO", "1");
    vi.stubEnv("COOPER_FABRICA", "n8n");
    const owner = user("puertas-demo");
    prepararDemo(owner);
    db()
      .update(videos)
      .set({ updatedAt: 0 })
      .where(eq(videos.ownerId, owner.id))
      .run();
    expect(fabrica()).toBeInstanceOf(FabricaSimulada);
    await fabrica().sincronizar(owner);
    expect(estado(owner).videos.map((v) => v.stage)).toEqual([7, 3, 9, 11]);
    const pending = estado(owner).videos.find((v) => v.stage === 3)!;
    await fabrica().aprobar(owner, pending.id);
    expect(estado(owner).videos.find((v) => v.id === pending.id)?.stage).toBe(
      4,
    );
  });
});
