import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";

export type OrigenOperacion = { tipo: "chat" | "accion_whatsapp"; id: string };
export function vincularOrden(
  ownerId: string,
  origen: OrigenOperacion,
  orden: string,
) {
  db()
    .insert(events)
    .values({
      id: `orden:${origen.tipo}:${origen.id}`,
      ownerId,
      type: "vinculo_operacion",
      payload: JSON.stringify({ orden }),
      createdAt: Date.now(),
    })
    .onConflictDoNothing()
    .run();
}
export function ordenVinculada(tipo: string, id: string): string {
  const row = db()
    .select()
    .from(events)
    .where(eq(events.id, `orden:${tipo}:${id}`))
    .get();
  return row ? (JSON.parse(row.payload) as { orden: string }).orden : "";
}
export function registrarConciliacion(
  ownerId: string,
  datos: Record<string, unknown>,
  cierre?: string,
) {
  db()
    .insert(events)
    .values({
      id: cierre ? `conciliacion:${cierre}` : randomUUID(),
      ownerId,
      type: "conciliacion",
      payload: JSON.stringify(datos),
      createdAt: Date.now(),
    })
    .run();
}
