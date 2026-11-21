import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, users, allowedEmails } from "@/db/schema";
import { cicloBiblioteca } from "@/servicios/biblioteca-trabajador";
import { sincronizarMedios } from "@/servicios/biblioteca";
import { AvatarSimulado } from "@/servicios/proveedores/simulados";

beforeEach(() => {
  db().delete(assets).run();
  db().delete(users).run();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function preparar(extra = {}) {
  const ownerId = randomUUID(),
    id = randomUUID();
  db()
    .insert(users)
    .values({ id: ownerId, email: `${ownerId}@example.test`, name: "Prueba" })
    .run();
  db()
    .insert(allowedEmails)
    .values({ email: `${ownerId}@example.test`, createdAt: Date.now() })
    .run();
  db()
    .insert(assets)
    .values({
      id,
      ownerId,
      name: "Avatar",
      kind: "avatar",
      evidenceId: "prueba",
      verified: true,
      consentAt: Date.now(),
      providerId: "ya-creado",
      status: "entrenando",
      createdAt: 1,
      ...extra,
    })
    .run();
  return {
    id,
    user: db().select().from(users).where(eq(users.id, ownerId)).get()!,
  };
}
it("recupera un trabajo persistido sin navegador y comparte la reserva con SSE", async () => {
  const { id, user } = preparar();
  const consultar = vi.spyOn(AvatarSimulado.prototype, "consultar");
  const crear = vi.spyOn(AvatarSimulado.prototype, "crear");
  await Promise.all([cicloBiblioteca(), sincronizarMedios(user)]);
  expect(consultar).toHaveBeenCalledTimes(1);
  expect(crear).not.toHaveBeenCalled();
  expect(
    db().select().from(assets).where(eq(assets.id, id)).get()?.status,
  ).toBe("listo");
});
it("respeta revocación, identidad pendiente y dueño suspendido", async () => {
  preparar({ consentRevokedAt: 1 });
  preparar({ verified: false });
  const { user } = preparar();
  db().update(users).set({ active: false }).where(eq(users.id, user.id)).run();
  const consultar = vi.spyOn(AvatarSimulado.prototype, "consultar");
  await cicloBiblioteca();
  await sincronizarMedios(user);
  expect(consultar).not.toHaveBeenCalled();
});
it("un error conserva la espera y una respuesta tardía no restaura consentimiento revocado", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-21T17:00:00Z"));
  const { id } = preparar();
  const consultar = vi
    .spyOn(AvatarSimulado.prototype, "consultar")
    .mockRejectedValueOnce(new Error("caída"));
  await cicloBiblioteca();
  vi.setSystemTime(Date.now() + 11000);
  await cicloBiblioteca();
  expect(consultar).toHaveBeenCalledTimes(1);
  consultar.mockImplementationOnce(async (providerId) => {
    db()
      .update(assets)
      .set({ consentRevokedAt: Date.now(), status: "error" })
      .where(eq(assets.id, id))
      .run();
    return { id: providerId, estado: "listo" };
  });
  vi.setSystemTime(Date.now() + 120000);
  await cicloBiblioteca();
  expect(consultar).toHaveBeenCalledTimes(2);
  expect(
    db().select().from(assets).where(eq(assets.id, id)).get()?.status,
  ).toBe("error");
});
