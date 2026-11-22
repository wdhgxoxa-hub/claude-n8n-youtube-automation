import { formatoMoneda } from "@/lib/cifras";
import { and, eq, inArray, ne, notExists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, videos, whatsappContacts, whatsappOutbox } from "@/db/schema";
import { mensajeriaPausada, proveedorMensajeria } from "./proveedor";
import { procesarChatWhatsApp } from "./chat-whatsapp";
import { contacto, cuentaActiva, preferencias } from "./cuentas";
import { encolarVideo, encolarGasto, procesarCola } from "./cola";
let lastCosts = 0;
export async function cicloMensajeria(now = Date.now()) {
  if (mensajeriaPausada()) return;
  const inicio = Date.now();
  const ambitos = db()
    .select()
    .from(whatsappContacts)
    .where(
      and(
        ne(whatsappContacts.verifiedAt, 0),
        ne(whatsappContacts.consentAt, 0),
      ),
    )
    .all()
    .flatMap((c) => {
      const p = preferencias(c.preferences);
      const etapas = [p.guion && 3, p.final && 9, p.publicado && 11].filter(
        (etapa): etapa is number => etapa !== false,
      );
      if (!etapas.length) return [];
      // Misma clave durable que encolarVideo; incluye reverificación y reloj remoto.
      // No usar un cursor temporal: preferencias nuevas pueden habilitar videos antiguos.
      const clave = sql<string>`'aviso:' || ${videos.ownerId} || ':' || ${videos.id} || ':' || ${videos.stage} || ':' || coalesce(nullif(${videos.remoteUpdatedAt}, 0), ${videos.updatedAt}) || ':' || ${String(c.verifiedAt)}`;
      return [
        and(
          eq(videos.ownerId, c.ownerId),
          inArray(videos.stage, etapas),
          notExists(
            db()
              .select({ id: whatsappOutbox.id })
              .from(whatsappOutbox)
              .where(eq(whatsappOutbox.dedupeKey, clave)),
          ),
        ),
      ];
    });
  if (ambitos.length) {
    const pendientes = db()
      .select({
        id: videos.id,
        ownerId: videos.ownerId,
        stage: videos.stage,
        productionState: videos.productionState,
        remoteUpdatedAt: videos.remoteUpdatedAt,
        updatedAt: videos.updatedAt,
      })
      .from(videos)
      .where(and(eq(videos.productionState, "activa"), or(...ambitos)))
      // Conserva el orden de descubrimiento previo (rowid), también entre dueños.
      .orderBy(sql`${videos}.rowid`)
      .all();
    for (const video of pendientes) encolarVideo(video, false, now);
  }
  if (now - lastCosts >= 60000) {
    lastCosts = now;
    const admin = db()
      .select()
      .from(users)
      .where(eq(users.role, "admin"))
      .get();
    const c = admin && contacto(admin.id);
    if (
      admin &&
      c?.verifiedAt &&
      c.simulated === proveedorMensajeria().simulada &&
      preferencias(c.preferences).gasto
    ) {
      try {
        cuentaActiva(admin.id);
        const { administracionActual } = await import("@/servicios/datos");
        const data = await administracionActual(admin);
        const total = data.users.reduce((sum, u) => sum + u.day, 0);
        if (total >= data.threshold)
          encolarGasto(
            admin,
            `${formatoMoneda(total)}${data.fuente === "simulada" ? " (simulado)" : data.fuente === "n8n_estimado" ? " (estimado)" : ""}`,
            now,
          );
      } catch {
        /* No convertir una consulta fallida en un importe ni detener los avisos de revisión. */
      }
    }
  }
  await procesarChatWhatsApp(now + Math.max(0, Date.now() - inicio));
  await procesarCola(undefined, now + Math.max(0, Date.now() - inicio));
}
const globals = globalThis as typeof globalThis & {
  cooperWhatsAppTimer?: ReturnType<typeof setInterval>;
};
export function iniciarMensajeria() {
  if (globals.cooperWhatsAppTimer) return;
  let busy = false;
  globals.cooperWhatsAppTimer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await cicloMensajeria();
    } catch {
      console.error("No se pudo procesar la cola de avisos de Cooper.");
    } finally {
      busy = false;
    }
  }, 15000);
  globals.cooperWhatsAppTimer.unref();
}
