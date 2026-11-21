import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  bridgeCommands,
  bridgeReceipts,
  channels,
  events,
  users,
  videos,
  type User,
} from "@/db/schema";
import {
  webhookSchema,
  type WebhookPuente,
  type estadoRemotoSchema,
} from "@/contratos/puente";
import { comprobarPresentacion } from "./presentacion";
import { ErrorHttp } from "@/lib/permisos";
import type { z } from "zod";

export function aplicarEstado(
  user: User,
  snapshot: z.infer<typeof estadoRemotoSchema>,
) {
  db().transaction(
    (tx) => {
      for (const channel of snapshot.canales) {
        if (user.role !== "admin" && channel.dueno_email !== user.email)
          continue;
        const owner = tx
          .select()
          .from(users)
          .where(eq(users.email, channel.dueno_email))
          .get();
        if (!owner) continue;
        const existing = tx
          .select()
          .from(channels)
          .where(eq(channels.id, channel.id))
          .get();
        if (existing && existing.ownerId !== owner.id)
          throw new ErrorHttp(409, "Propietario incompatible.");
        tx.insert(channels)
          .values({
            id: channel.id,
            ownerId: owner.id,
            name: channel.nombre,
            niche: channel.nicho,
            createdAt: Date.now(),
          })
          .onConflictDoUpdate({
            target: channels.id,
            set: { name: channel.nombre, niche: channel.nicho },
          })
          .run();
      }
      for (const video of snapshot.videos) {
        if (user.role !== "admin" && video.dueno_email !== user.email) continue;
        const owner = tx
          .select()
          .from(users)
          .where(eq(users.email, video.dueno_email))
          .get();
        const channel = tx
          .select()
          .from(channels)
          .where(eq(channels.id, video.canal_id))
          .get();
        if (!owner || channel?.ownerId !== owner.id) continue;
        const existing = tx
          .select()
          .from(videos)
          .where(eq(videos.id, video.id))
          .get();
        if (existing && existing.ownerId !== owner.id)
          throw new ErrorHttp(409, "Propietario incompatible.");
        if (existing && existing.remoteUpdatedAt >= video.actualizado_en)
          continue;
        const fields = {
          stage:
            existing?.productionState === "cancelada"
              ? existing.stage
              : video.stage,
          script: video.script,
          title: video.titulo,
          remoteUpdatedAt: video.actualizado_en,
          updatedAt: Date.now(),
        };
        tx.insert(videos)
          .values({
            id: video.id,
            ownerId: owner.id,
            channelId: video.canal_id,
            createdAt: Date.now(),
            ...fields,
          })
          .onConflictDoUpdate({ target: videos.id, set: fields })
          .run();
      }
    },
    { behavior: "immediate" },
  );
}

export function recibirWebhook(input: WebhookPuente, raw: string) {
  if (input.tipo === "presentacion") return comprobarPresentacion(input);
  return db().transaction(
    (tx) => {
      if (input.tipo === "orden") {
        const order = tx
          .select()
          .from(bridgeCommands)
          .where(eq(bridgeCommands.id, input.id_evento))
          .get();
        // Lectura previa a resolver recursos: una creación/eliminación confirmada
        // ya cambió las tablas. Consultar nunca reserva ni habilita un despacho.
        if (!order && input.fase === "consultar") return { estado: "nueva" };
        // Solo órdenes originadas por el servidor Cooper. No basta conocer el secreto de callbacks.
        if (
          !order ||
          JSON.stringify(JSON.parse(order.request)) !==
            JSON.stringify(input.solicitud)
        )
          throw new ErrorHttp(409, "Orden incompatible.");
        const owner = tx
          .select()
          .from(users)
          .where(eq(users.id, order.ownerId))
          .get();
        if (!owner?.active) throw new ErrorHttp(403, "Cuenta no disponible.");
        if (order.confirmed) return { estado: "confirmada" };
        if (input.fase === "consultar")
          return { estado: order.execution ? "pendiente" : "nueva" };
        if (order.execution && order.execution !== input.ejecucion)
          return { estado: "pendiente" };
        if (input.fase === "confirmar" && !order.execution)
          throw new ErrorHttp(409, "Orden sin reserva.");
        tx.update(bridgeCommands)
          .set({
            execution: input.ejecucion,
            confirmed: input.fase === "confirmar",
          })
          .where(eq(bridgeCommands.id, order.id))
          .run();
        return {
          estado: input.fase === "confirmar" ? "confirmada" : "reservada",
        };
      }
      const digest = createHash("sha256").update(raw).digest("hex");
      const receipt = tx
        .select()
        .from(bridgeReceipts)
        .where(eq(bridgeReceipts.id, input.id_evento))
        .get();
      if (receipt) {
        if (receipt.digest !== digest)
          throw new ErrorHttp(409, "Evento incompatible.");
        return { aceptado: true, duplicado: true };
      }
      const owner = tx
        .select()
        .from(users)
        .where(eq(users.email, input.video.dueno_email))
        .get();
      const video = tx
        .select()
        .from(videos)
        .where(eq(videos.id, input.video.id))
        .get();
      if (
        !owner ||
        !video ||
        video.ownerId !== owner.id ||
        video.channelId !== input.video.canal_id
      )
        throw new ErrorHttp(404, "Video no disponible.");
      const current =
        video.productionState !== "cancelada" &&
        video.remoteUpdatedAt < input.video.actualizado_en;
      if (current) {
        tx.update(videos)
          .set({
            stage: input.video.stage,
            script: input.video.script,
            title: input.video.titulo,
            remoteUpdatedAt: input.video.actualizado_en,
            updatedAt: Date.now(),
          })
          .where(and(eq(videos.id, video.id), eq(videos.ownerId, owner.id)))
          .run();
        const last = tx
          .select({ at: events.createdAt })
          .from(events)
          .where(eq(events.type, "progreso"))
          .orderBy(desc(events.createdAt))
          .limit(1)
          .get();
        tx.insert(events)
          .values({
            id: input.id_evento,
            ownerId: owner.id,
            type: "progreso",
            payload: JSON.stringify({ id: video.id, stage: input.video.stage }),
            createdAt: Math.max(Date.now(), (last?.at ?? 0) + 1),
          })
          .run();
      }
      tx.insert(bridgeReceipts)
        .values({ id: input.id_evento, digest, createdAt: Date.now() })
        .run();
      return { aceptado: true, duplicado: false };
    },
    { behavior: "immediate" },
  );
}

export async function procesarWebhook(request: Request) {
  const secret = process.env.COOPER_WEBHOOK_SECRET;
  if (!secret || secret.length < 32)
    throw new ErrorHttp(503, "Receptor no configurado.");
  const timestamp = request.headers.get("x-cooper-timestamp") ?? "";
  const signature = request.headers.get("x-cooper-signature") ?? "";
  if (
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp)) > 300000 ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  )
    throw new ErrorHttp(401, "Firma inválida.");
  // Limitar también los cuerpos sin Content-Length antes de decodificar JSON.
  const reader = request.body?.getReader();
  if (!reader) throw new ErrorHttp(400, "Cuerpo vacío.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 131072) {
      await reader.cancel();
      throw new ErrorHttp(413, "Cuerpo demasiado grande.");
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  const expected = createHmac("sha256", secret)
    .update(timestamp + ".")
    .update(bytes)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex")))
    throw new ErrorHttp(401, "Firma inválida.");
  const raw = bytes.toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ErrorHttp(400, "JSON inválido.");
  }
  return recibirWebhook(webhookSchema.parse(parsed), raw);
}
