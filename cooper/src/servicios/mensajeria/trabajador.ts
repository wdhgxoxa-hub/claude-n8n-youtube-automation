import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, videos } from "@/db/schema";
import { proveedorMensajeria } from "./proveedor";
import { contacto, cuentaActiva, preferencias } from "./cuentas";
import { encolarVideo, encolarGasto, procesarCola } from "./cola";
let lastCosts = 0;
export async function cicloMensajeria(now = Date.now()) {
  for (const video of db().select().from(videos).all())
    encolarVideo(video, false, now);
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
            `${total.toFixed(2)} USD${data.fuente === "simulada" ? " (simulado)" : data.fuente === "n8n_estimado" ? " (estimado)" : ""}`,
            now,
          );
      } catch {
        /* No convertir una consulta fallida en un importe ni detener los avisos de revisión. */
      }
    }
  }
  await procesarCola(undefined, now);
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
