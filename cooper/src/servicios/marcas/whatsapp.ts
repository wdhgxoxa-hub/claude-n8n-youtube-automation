import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  piezasMarca,
  users,
  whatsappOutbox,
  type AvisoWhatsApp,
} from "@/db/schema";
import { contacto, preferencias, DIA } from "@/servicios/mensajeria/cuentas";
import { ErrorHttp } from "@/lib/permisos";
export function piezaAviso(job: AvisoWhatsApp) {
  const p = db()
    .select()
    .from(piezasMarca)
    .where(eq(piezasMarca.id, job.resourceId))
    .get();
  if (!p || p.estado !== "pendiente" || String(p.revision) !== job.revision)
    throw new ErrorHttp(409, "La pieza cambió o ya recibió una decisión.");
  return p;
}
export function encolarMarca(id: string, botones = false, now = Date.now()) {
  const p = db().select().from(piezasMarca).where(eq(piezasMarca.id, id)).get();
  const admin = db()
    .select()
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true)))
    .get();
  if (!p || p.estado !== "pendiente" || !admin) return;
  const c = contacto(admin.id);
  if (!c?.verifiedAt || !c.consentAt || !preferencias(c.preferences).marca)
    return;
  db()
    .insert(whatsappOutbox)
    .values({
      id: randomUUID(),
      dedupeKey: `marca:${p.id}:${p.revision}:${c.verifiedAt}:${botones}`,
      contactVerifiedAt: c.verifiedAt,
      ownerId: admin.id,
      phone: c.phone,
      kind: "marca",
      resourceId: p.id,
      revision: String(p.revision),
      interactive: botones,
      simulated: c.simulated,
      nextAt: now,
      createdAt: now,
      expiresAt: now + DIA,
    })
    .onConflictDoNothing()
    .run();
}
