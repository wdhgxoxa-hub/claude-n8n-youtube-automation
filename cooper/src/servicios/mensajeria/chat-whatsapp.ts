import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { whatsappChatJobs as jobs } from "@/db/schema";
import { ErrorHttp } from "@/lib/permisos";
import { proveedorChat } from "@/servicios/chat/seleccion";
import type { ProveedorChat } from "@/servicios/chat/tipos";
import { contacto, cuentaActiva, DIA } from "./cuentas";
import { encolarRespuestaChat } from "./cola";
import { mensajeriaPausada, proveedorMensajeria } from "./proveedor";

type Turno = typeof jobs.$inferSelect;
const RESERVA = 180000;

function vigente(job: Turno, now: number) {
  const user = cuentaActiva(job.ownerId),
    c = contacto(job.ownerId);
  if (
    !c?.verifiedAt ||
    !c.consentAt ||
    c.verifiedAt !== job.contactVerifiedAt ||
    c.phone !== job.phone ||
    user.whatsapp !== job.phone ||
    c.simulated !== job.simulated ||
    job.simulated !== proveedorMensajeria().simulada ||
    c.incomingAt <= now - DIA ||
    c.incomingAt > now ||
    job.createdAt <= now - DIA
  )
    throw new ErrorHttp(410, "La conversación ya no está disponible.");
  return user;
}

/** El historial web conserva el turno completo; el teléfono recibe como máximo 18 palabras. */
export function respuestaBreveWhatsApp(text: string, tarjeta = false) {
  if (tarjeta)
    return "Abre Cooper y confirma la tarjeta pendiente para realizar el cambio.";
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Abre Cooper para revisar tu pedido.";
  const sentence = clean.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() ?? clean;
  const words = sentence.split(" ");
  let brief = words.slice(0, 18).join(" ");
  if (brief.length > 239) {
    brief = brief.slice(0, 239);
    const space = brief.lastIndexOf(" ");
    if (space > 0) brief = brief.slice(0, space);
  }
  return brief.length < sentence.length
    ? brief.replace(/[.,;:!?]+$/, "") + "…"
    : brief;
}

function reservar(now: number) {
  return db().transaction(
    (tx) => {
      // Un proceso muerto pudo guardar mensajes o tarjetas. Nunca repetir ese turno a ciegas.
      tx.update(jobs)
        .set({ state: "incierto" })
        .where(
          and(eq(jobs.state, "procesando"), lte(jobs.leaseAt, now - RESERVA)),
        )
        .run();
      const waiting = tx
        .select()
        .from(jobs)
        .where(inArray(jobs.state, ["pendiente", "procesando"]))
        .orderBy(jobs.createdAt, sql`${jobs}.rowid`)
        .all();
      const owners = new Set<string>();
      for (const job of waiting) {
        if (owners.has(job.ownerId)) continue;
        owners.add(job.ownerId);
        // La respuesta anterior mantiene el orden incluso durante el backoff o entre consumidores.
        if (job.state !== "pendiente" || job.nextAt > now) continue;
        try {
          vigente(job, now);
        } catch {
          tx.update(jobs)
            .set({ state: "cancelado" })
            .where(eq(jobs.id, job.id))
            .run();
          continue;
        }
        tx.update(jobs)
          .set({
            state: "procesando",
            leaseAt: now,
            attempts: job.attempts + 1,
          })
          .where(and(eq(jobs.id, job.id), eq(jobs.state, "pendiente")))
          .run();
        return {
          ...job,
          state: "procesando" as const,
          leaseAt: now,
          attempts: job.attempts + 1,
        };
      }
      return undefined;
    },
    { behavior: "immediate" },
  );
}

/** Cola durable independiente del webhook y del transporte; las tarjetas se confirman en la web. */
export async function procesarChatWhatsApp(
  now = Date.now(),
  provider?: ProveedorChat,
) {
  const startedAt = Date.now();
  const reloj = () => now + Math.max(0, Date.now() - startedAt);
  for (let processed = 0; processed < 4; processed++) {
    if (mensajeriaPausada()) return;
    const job = reservar(reloj());
    if (!job) return;
    let started = false;
    try {
      const user = vigente(job, reloj());
      let response: string;
      if (job.text.length > 6000) {
        response =
          "Tu mensaje es demasiado largo. Envíame un pedido más corto.";
      } else {
        const { responderChat } = await import("@/servicios/chat");
        const original = provider ?? proveedorChat();
        const shortProvider: ProveedorChat = {
          async *generar(input, signal) {
            started = true;
            yield* original.generar(
              {
                ...input,
                sistema:
                  input.sistema +
                  (input.herramientas.length
                    ? "\nEste turno llega por WhatsApp. Responde con una sola frase, como máximo 18 palabras. Si preparas una tarjeta, pide abrir Cooper para confirmar; un sí por WhatsApp nunca confirma."
                    : ""),
              },
              signal,
            );
          },
        };
        let card = false;
        const result = await responderChat(
          user,
          { texto: job.text, adjuntos: [] },
          (event) => {
            if (event.tipo === "tarjeta") card = true;
          },
          AbortSignal.timeout(120000),
          shortProvider,
        );
        response = respuestaBreveWhatsApp(result.texto, card);
      }
      // Revalidar después del modelo: baja, suspensión o cambio de teléfono cancelan la salida.
      vigente(job, reloj());
      db().transaction(
        (tx) => {
          const claimed = tx
            .update(jobs)
            .set({ state: "completado", response })
            .where(
              and(
                eq(jobs.id, job.id),
                eq(jobs.state, "procesando"),
                eq(jobs.leaseAt, job.leaseAt),
              ),
            )
            .run();
          if (claimed.changes) encolarRespuestaChat(job, response, reloj());
        },
        { behavior: "immediate" },
      );
    } catch (error) {
      // Antes del modelo, 409 es la reserva web y 429 es la cola global; todavía no hay turno que repetir.
      const limited =
        !started && error instanceof ErrorHttp && error.status === 429;
      const retry =
        !started &&
        error instanceof ErrorHttp &&
        (error.status === 409 || (limited && job.attempts < 5));
      let cancelled = false;
      try {
        vigente(job, reloj());
      } catch {
        cancelled = true;
      }
      db()
        .update(jobs)
        .set({
          state: cancelled
            ? "cancelado"
            : retry
              ? "pendiente"
              : limited
                ? "fallido"
                : "incierto",
          nextAt:
            reloj() +
            (limited
              ? 15 * 60000
              : Math.min(60000, 5000 * 2 ** Math.min(job.attempts - 1, 4))),
        })
        .where(
          and(
            eq(jobs.id, job.id),
            eq(jobs.state, "procesando"),
            eq(jobs.leaseAt, job.leaseAt),
          ),
        )
        .run();
    }
  }
}
