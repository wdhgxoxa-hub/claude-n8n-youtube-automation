import { randomUUID } from "node:crypto";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assets,
  bridgeCommands,
  events,
  messages,
  users,
  videos,
  type User,
} from "@/db/schema";
import {
  comprobacionPresentacionSchema,
  presentacionSchema,
  solicitudSchema,
} from "@/contratos/puente";
import { ErrorHttp, requireOwn } from "@/lib/permisos";

const CANCELADA =
  "Video cancelado en la fábrica: el dueño revocó el consentimiento de un avatar o una voz. Tu elección se conserva. Walter debe revisar los trabajos ya enviados.";
const AVISOS = {
  avatar_apagado:
    "Tu video está en pausa porque la creación con avatar está desactivada. Conservamos tu elección; Walter debe habilitarla antes de continuar.",
  voz_apagada:
    "Tu video está en pausa porque la creación de voz está desactivada. Conservamos tu elección; Walter debe habilitarla antes de continuar.",
  presupuesto:
    "Tu video está en pausa: necesita una revisión del presupuesto por Walter. Conservamos el avatar y la voz elegidos.",
  produccion_pausada:
    "Tu video está en pausa porque la producción está desactivada. Conservamos tu elección para continuar cuando Walter la habilite.",
};
function avisar(
  videoId: string,
  ownerId: string,
  state: string,
  notice: string,
) {
  const v = db().select().from(videos).where(eq(videos.id, videoId)).get();
  if (
    !v ||
    v.ownerId !== ownerId ||
    v.productionState === "cancelada" ||
    (v.productionState === state && v.productionNotice === notice)
  )
    return;
  db()
    .update(videos)
    .set({
      productionState: state,
      productionNotice: notice,
      updatedAt: Date.now(),
    })
    .where(eq(videos.id, videoId))
    .run();
  if (notice)
    db()
      .insert(messages)
      .values({
        id: randomUUID(),
        ownerId,
        role: "assistant",
        content: notice,
        createdAt: Date.now(),
      })
      .run();
  const last = db()
    .select({ at: events.createdAt })
    .from(events)
    .where(eq(events.type, "progreso"))
    .orderBy(desc(events.createdAt))
    .limit(1)
    .get();
  db()
    .insert(events)
    .values({
      id: randomUUID(),
      ownerId,
      type: "progreso",
      payload: JSON.stringify({ id: videoId, stage: v.stage }),
      createdAt: Math.max(Date.now(), (last?.at ?? 0) + 1),
    })
    .run();
}
export function revocarConsentimiento(user: User, id: string) {
  db().transaction(
    () => {
      const a = db().select().from(assets).where(eq(assets.id, id)).get();
      requireOwn(user, a);
      db()
        .update(assets)
        .set({
          consentRevokedAt: a!.consentRevokedAt || Date.now(),
          shared: false,
          verified: false,
        })
        .where(eq(assets.id, id))
        .run();
      for (const v of db()
        .select()
        .from(videos)
        .where(
          and(
            lt(videos.stage, 11),
            or(eq(videos.avatarId, id), eq(videos.voiceId, id)),
          ),
        )
        .all())
        avisar(v.id, v.ownerId, "cancelada", CANCELADA);
    },
    { behavior: "immediate" },
  );
}

// Consulta firmada, repetible, sobre el sobre que Cooper guardó antes de despachar.
// Retirar compartir afecta nuevas selecciones; revocar consentimiento cancela las aceptadas.
export function comprobarPresentacion(
  raw: z.infer<typeof comprobacionPresentacionSchema>,
) {
  const input = comprobacionPresentacionSchema.parse(raw);
  return db().transaction(
    () => {
      const order = db()
        .select()
        .from(bridgeCommands)
        .where(eq(bridgeCommands.id, input.orden_id))
        .get();
      const owner =
        order &&
        db().select().from(users).where(eq(users.id, order.ownerId)).get();
      if (!order?.execution || !owner || owner.email !== input.dueno_email)
        throw new ErrorHttp(403, "Orden no autorizada.");
      const request = solicitudSchema.parse(JSON.parse(order.request));
      const selected = presentacionSchema.parse(request.datos.presentacion);
      if (
        request.evento !== "nuevo_video" ||
        request.datos.id !== input.video_id ||
        JSON.stringify(selected) !== JSON.stringify(input.presentacion)
      )
        throw new ErrorHttp(409, "Presentación incompatible.");
      const video = db()
        .select()
        .from(videos)
        .where(eq(videos.id, input.video_id))
        .get();
      if (!video || video.ownerId !== owner.id)
        throw new ErrorHttp(403, "Video no autorizado.");
      let revoked = !owner.active || video?.productionState === "cancelada";
      for (const [kind, media] of [
        ["avatar", selected.avatar],
        ["voz", selected.voz],
      ] as const) {
        if (!media) continue;
        if (media.proveedor === "simulada")
          throw new ErrorHttp(422, "El recurso es de demostración.");
        if (media.tipo !== "propio") continue;
        const a = db()
          .select()
          .from(assets)
          .where(eq(assets.id, media.recurso_id))
          .get();
        if (
          !a ||
          a.kind !== kind ||
          a.consentRevokedAt ||
          !a.consentAt ||
          !a.verified ||
          a.status !== "listo" ||
          a.provider !== media.proveedor ||
          a.providerId !== media.id
        )
          revoked = true;
      }
      const state = revoked
        ? "cancelada"
        : input.bloqueo
          ? "pausada"
          : "activa";
      const notice = revoked
        ? CANCELADA
        : input.bloqueo
          ? AVISOS[input.bloqueo]
          : "";
      avisar(input.video_id, owner.id, state, notice);
      return { permitido: state === "activa", estado: state, aviso: notice };
    },
    { behavior: "immediate" },
  );
}
