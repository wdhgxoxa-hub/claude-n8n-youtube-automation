import { and, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { assets, users } from "@/db/schema";
import { sincronizarMedios } from "./biblioteca";

/** Solo consulta trabajos ya creados; nunca crea, entrena, sintetiza ni publica. */
export async function cicloBiblioteca(now = Date.now()) {
  const due = db()
    .select({ user: users })
    .from(users)
    .innerJoin(assets, eq(assets.ownerId, users.id))
    .where(
      and(
        eq(users.active, true),
        eq(assets.verified, true),
        eq(assets.consentRevokedAt, 0),
        inArray(assets.status, ["entrenando", "verificacion_proveedor"]),
        lt(assets.polledAt, now - 10000),
        or(eq(assets.syncError, false), lt(assets.polledAt, now - 120000)),
      ),
    )
    .groupBy(users.id)
    .limit(10)
    .all();
  for (const { user } of due) await sincronizarMedios(user);
}
const globals = globalThis as typeof globalThis & {
  cooperBibliotecaTimer?: ReturnType<typeof setInterval>;
};
export function iniciarBiblioteca() {
  if (globals.cooperBibliotecaTimer) return;
  let busy = false;
  globals.cooperBibliotecaTimer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await cicloBiblioteca();
    } catch {
      console.error("No se pudo actualizar la biblioteca de Cooper.");
    } finally {
      busy = false;
    }
  }, 15000);
  globals.cooperBibliotecaTimer.unref();
}
