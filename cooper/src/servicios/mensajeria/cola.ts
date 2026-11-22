import { piezaAviso } from "@/servicios/marcas/whatsapp";
import { randomUUID } from "node:crypto";
import { and, eq, lte, gte, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  videos,
  whatsappOutbox as outbox,
  whatsappDeliveries as deliveries,
  whatsappActions as actions,
  whatsappAttempts as attempts,
  whatsappChatJobs,
  type Video,
  type User,
  type AvisoWhatsApp,
} from "@/db/schema";
import { ErrorHttp } from "@/lib/permisos";
import { periodosLima } from "@/lib/periodos";
import {
  contacto,
  cuentaActiva,
  preferencias,
  codigoVerificacion,
  DIA,
  HORA,
} from "./cuentas";
import {
  ErrorMensajeria,
  proveedorMensajeria,
  mensajeriaPausada,
  type ProveedorMensajeria,
  type MensajeWhatsApp,
} from "./proveedor";
import { tokenRevision, urlRevision } from "./enlaces";
type RevisionVideo = Pick<Video, "stage" | "remoteUpdatedAt" | "updatedAt">;
export type VideoAviso = RevisionVideo &
  Pick<Video, "id" | "ownerId" | "productionState">;
export function revision(video: RevisionVideo) {
  return `${video.stage}:${video.remoteUpdatedAt || video.updatedAt}`;
}
export function claveAccion(job: AvisoWhatsApp) {
  return `${job.ownerId}:${job.resourceId}:${job.revision}`;
}
export function avisoVigente(
  job: AvisoWhatsApp,
  now = Date.now(),
  respuestaReservada = false,
) {
  if (["cancelado", "fallido"].includes(job.state) || job.expiresAt <= now)
    throw new ErrorHttp(410, "Este aviso caducó. Abre el video desde Cooper.");
  const user = cuentaActiva(job.ownerId),
    c = contacto(user.id);
  if (
    !c ||
    c.phone !== user.whatsapp ||
    c.phone !== job.phone ||
    c.simulated !== job.simulated ||
    job.simulated !== proveedorMensajeria().simulada
  )
    throw new ErrorHttp(409, "El número cambió. Verifícalo de nuevo.");
  if (job.kind === "verificacion") {
    if (c.challengeId !== job.id || c.challengeExpires <= now || c.verifiedAt)
      throw new ErrorHttp(410, "Código caducado.");
    return { user, contacto: c };
  }
  if (
    !c.verifiedAt ||
    c.verifiedAt !== job.contactVerifiedAt ||
    !c.consentAt ||
    (job.kind !== "chat" && !preferencias(c.preferences)[job.kind])
  )
    throw new ErrorHttp(403, "Este aviso está desactivado.");
  if (job.kind === "chat") {
    if (c.incomingAt <= now - DIA || c.incomingAt > now)
      throw new ErrorHttp(410, "La ventana de respuesta terminó.");
    return { user, contacto: c };
  }
  if (job.kind === "gasto") {
    if (user.role !== "admin") throw new ErrorHttp(403, "Aviso no disponible.");
    return { user, contacto: c };
  }
  if (job.kind === "marca") {
    if (user.role !== "admin")
      throw new ErrorHttp(403, "Solo Walter revisa estas piezas.");
    return { user, contacto: c, pieza: piezaAviso(job) };
  }
  const video = db()
    .select()
    .from(videos)
    .where(eq(videos.id, job.resourceId))
    .get();
  if (
    !video ||
    video.ownerId !== user.id ||
    video.productionState !== "activa" ||
    revision(video) !== job.revision
  )
    throw new ErrorHttp(
      409,
      "La revisión del video cambió. Abre el video desde Cooper.",
    );
  if (
    !respuestaReservada &&
    job.kind !== "publicado" &&
    db()
      .select()
      .from(actions)
      .where(eq(actions.id, claveAccion(job)))
      .get()
  )
    throw new ErrorHttp(409, "Esta revisión ya recibió una respuesta.");
  return { user, contacto: c, video };
}
export function encolarVideo(
  video: VideoAviso,
  botones = false,
  now = Date.now(),
) {
  const kind =
    video.stage === 3
      ? "guion"
      : video.stage === 9
        ? "final"
        : video.stage === 11
          ? "publicado"
          : undefined;
  if (!kind || video.productionState !== "activa") return;
  const c = contacto(video.ownerId);
  if (
    !c?.verifiedAt ||
    !c.consentAt ||
    !preferencias(c.preferences)[kind] ||
    (botones && kind === "publicado")
  )
    return;
  const job: typeof outbox.$inferInsert = {
    id: randomUUID(),
    contactVerifiedAt: c.verifiedAt,
    dedupeKey: `${botones ? "botones" : "aviso"}:${video.ownerId}:${video.id}:${revision(video)}:${c.verifiedAt}`,
    ownerId: video.ownerId,
    phone: c.phone,
    kind,
    resourceId: video.id,
    revision: revision(video),
    interactive: botones,
    simulated: c.simulated,
    nextAt: now,
    createdAt: now,
    expiresAt: now + DIA,
  };
  db().insert(outbox).values(job).onConflictDoNothing().run();
}
export function encolarGasto(admin: User, detail: string, now = Date.now()) {
  if (admin.role !== "admin") throw new ErrorHttp(403, "Aviso no disponible.");
  const c = contacto(admin.id);
  if (!c?.verifiedAt || !preferencias(c.preferences).gasto) return;
  const { date: day, day: start } = periodosLima(now);
  db()
    .insert(outbox)
    .values({
      id: randomUUID(),
      contactVerifiedAt: c.verifiedAt,
      dedupeKey: `gasto:${admin.id}:${day}`,
      ownerId: admin.id,
      phone: c.phone,
      kind: "gasto",
      detail,
      simulated: c.simulated,
      nextAt: now,
      createdAt: now,
      expiresAt: start + DIA,
    })
    .onConflictDoNothing()
    .run();
}
export function encolarRespuestaChat(
  entrada: {
    id: string;
    ownerId: string;
    phone: string;
    contactVerifiedAt: number;
    simulated: boolean;
  },
  texto: string,
  now = Date.now(),
) {
  const c = contacto(entrada.ownerId);
  const detail = Array.from(texto.trim()).slice(0, 280).join("");
  if (!detail) throw new ErrorHttp(400, "La respuesta está vacía.");
  const job: AvisoWhatsApp = {
    id: randomUUID(),
    dedupeKey: `chat:${entrada.id}`,
    ownerId: entrada.ownerId,
    phone: entrada.phone,
    contactVerifiedAt: entrada.contactVerifiedAt,
    kind: "chat",
    resourceId: entrada.id,
    revision: "",
    detail,
    interactive: false,
    simulated: entrada.simulated,
    state: "pendiente",
    attempts: 0,
    nextAt: now,
    leaseAt: 0,
    remoteId: "",
    delivery: "",
    errorCode: "",
    expiresAt: (c?.incomingAt ?? 0) + DIA,
    createdAt: now,
  };
  avisoVigente(job, now);
  db().insert(outbox).values(job).onConflictDoNothing().run();
}
export function construirMensaje(
  job: AvisoWhatsApp,
  now = Date.now(),
): MensajeWhatsApp {
  const { contacto: c, video, pieza } = avisoVigente(job, now);
  const base = {
    messaging_product: "whatsapp" as const,
    recipient_type: "individual" as const,
    to: job.phone.slice(1),
  };
  const text = (value: string) => ({ type: "text", text: value });
  if (job.kind === "chat")
    return {
      ...base,
      type: "text",
      context: { message_id: job.resourceId },
      text: { body: job.detail, preview_url: false },
    };
  if (job.kind === "verificacion") {
    const code = codigoVerificacion(job.id);
    return {
      ...base,
      type: "template",
      template: {
        name: "cooper_verificar_numero",
        language: { code: "es" },
        components: [
          { type: "body", parameters: [text(code)] },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [text(code)],
          },
        ],
      },
    };
  }
  const token = tokenRevision(job),
    url = urlRevision(token);
  if (
    (job.kind === "guion" || job.kind === "final" || job.kind === "marca") &&
    c.incomingAt > now - DIA &&
    c.incomingAt <= now
  ) {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: `Revisa ${job.kind === "guion" ? "el guion" : "la versión final"} de «${pieza?.datos.titulo ?? video!.title}» en Cooper: ${url}\nSi pides cambios, podrás detallarlos en Cooper.`,
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: { id: `aprobar:${job.id}`, title: "Aprobar" },
            },
            {
              type: "reply",
              reply: { id: `cambios:${job.id}`, title: "Cambios" },
            },
          ],
        },
      },
    };
  }
  if (job.interactive)
    throw new ErrorHttp(410, "La ventana de respuesta terminó.");
  const names = {
    guion: "cooper_aprobacion_guion",
    final: "cooper_aprobacion_final",
    publicado: "cooper_video_publicado",
    gasto: "cooper_alerta_gasto_admin",
    marca: "cooper_aprobacion_marca",
  };
  return {
    ...base,
    type: "template",
    template: {
      name: names[job.kind],
      language: { code: "es" },
      components: [
        {
          type: "body",
          parameters: [
            text(
              job.kind === "gasto"
                ? job.detail
                : (pieza?.datos.titulo ?? video!.title),
            ),
          ],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [text(token)],
        },
      ],
    },
  };
}
export function conciliarEntrega(job: AvisoWhatsApp) {
  if (!job.remoteId) return;
  const ranks: Record<string, number> = {
    failed: 0,
    sent: 1,
    delivered: 2,
    read: 3,
  };
  const receipt = db()
    .select()
    .from(deliveries)
    .where(
      and(
        eq(deliveries.remoteId, job.remoteId),
        eq(deliveries.phone, job.phone),
      ),
    )
    .all()
    .sort((a, b) => ranks[b.state] - ranks[a.state])[0];
  if (receipt)
    db()
      .update(outbox)
      .set({ delivery: receipt.state, errorCode: receipt.errorCode })
      .where(eq(outbox.id, job.id))
      .run();
}
export async function procesarCola(
  provider: ProveedorMensajeria = proveedorMensajeria(),
  now = Date.now(),
) {
  if (mensajeriaPausada()) return;
  const inicio = Date.now();
  const reloj = () => now + Math.max(0, Date.now() - inicio);
  // Un proceso que murió tras enviar pudo entregar: una reserva vencida nunca se reenvía automáticamente.
  db()
    .update(outbox)
    .set({ state: "incierto", errorCode: "reserva_vencida" })
    .where(and(eq(outbox.state, "enviando"), lte(outbox.leaseAt, now - 60000)))
    .run();
  for (let i = 0; i < 20; i++) {
    if (mensajeriaPausada()) break;
    const actual = reloj();
    const job = db().transaction(
      (tx) => {
        const row = tx
          .select()
          .from(outbox)
          .where(and(eq(outbox.state, "pendiente"), lte(outbox.nextAt, actual)))
          .orderBy(outbox.createdAt)
          .limit(1)
          .get();
        if (!row) return;
        try {
          avisoVigente(row, actual);
        } catch {
          tx.update(outbox)
            .set({ state: "cancelado" })
            .where(eq(outbox.id, row.id))
            .run();
          return null;
        }
        if (row.simulated !== provider.simulada) {
          tx.update(outbox)
            .set({ state: "cancelado" })
            .where(eq(outbox.id, row.id))
            .run();
          return null;
        }
        const day = tx
          .select()
          .from(attempts)
          .where(
            and(
              eq(attempts.ownerId, row.ownerId),
              gte(attempts.createdAt, actual - DIA),
            ),
          )
          .all();
        const recent = day.filter((j) => j.createdAt > actual - HORA);
        const last = day.reduce((max, j) => Math.max(max, j.createdAt), 0);
        if (day.length >= 20 || recent.length >= 5 || actual - last < 6000) {
          tx.update(outbox)
            .set({
              nextAt: Math.max(
                actual + 6000,
                day.length >= 20
                  ? Math.min(...day.map((j) => j.createdAt)) + DIA
                  : recent.length >= 5
                    ? Math.min(...recent.map((j) => j.createdAt)) + HORA
                    : last + 6000,
              ),
            })
            .where(eq(outbox.id, row.id))
            .run();
          return null;
        }
        const attemptId = randomUUID();
        tx.insert(attempts)
          .values({
            id: attemptId,
            jobId: row.id,
            ownerId: row.ownerId,
            createdAt: actual,
          })
          .run();
        tx.update(outbox)
          .set({
            state: "enviando",
            leaseAt: actual,
            attempts: row.attempts + 1,
          })
          .where(eq(outbox.id, row.id))
          .run();
        return {
          ...row,
          leaseAt: actual,
          attempts: row.attempts + 1,
          attemptId,
        };
      },
      { behavior: "immediate" },
    );
    if (job === undefined) break;
    if (!job) continue;
    try {
      const message = construirMensaje(job, reloj());
      const result = await provider.enviar(message, job.id, () => {
        const current = reloj();
        const { contacto: c } = avisoVigente(job, current);
        if (
          message.type !== "template" &&
          (c.incomingAt <= current - DIA || c.incomingAt > current)
        )
          throw new ErrorHttp(410, "La ventana de respuesta terminó.");
      });
      db()
        .update(outbox)
        .set({
          state: "aceptado",
          remoteId: result.id,
          errorCode: "",
          interactive: message.type === "interactive",
        })
        .where(
          and(
            eq(outbox.id, job.id),
            eq(outbox.state, "enviando"),
            eq(outbox.leaseAt, job.leaseAt),
          ),
        )
        .run();
      if (provider.simulada)
        db()
          .insert(deliveries)
          .values({
            id: `${result.id}:delivered`,
            remoteId: result.id,
            phone: job.phone,
            state: "delivered",
            occurredAt: reloj(),
          })
          .onConflictDoNothing()
          .run();
      conciliarEntrega({ ...job, remoteId: result.id });
    } catch (error) {
      const e =
        error instanceof ErrorMensajeria
          ? error
          : new ErrorMensajeria(
              error instanceof ErrorHttp ? "permanente" : "incierto",
              error instanceof ErrorHttp ? "aviso_vencido" : "interno",
            );
      if (e.codigo === "pausa") {
        db().transaction((tx) => {
          const released = tx
            .update(outbox)
            .set({ state: "pendiente", attempts: job.attempts - 1, leaseAt: 0 })
            .where(
              and(
                eq(outbox.id, job.id),
                eq(outbox.state, "enviando"),
                eq(outbox.leaseAt, job.leaseAt),
              ),
            )
            .run();
          if (released.changes)
            tx.delete(attempts).where(eq(attempts.id, job.attemptId)).run();
        });
        break;
      }
      const retry = e.clase === "temporal" && job.attempts < 5;
      db()
        .update(outbox)
        .set({
          state: retry
            ? "pendiente"
            : e.clase === "incierto"
              ? "incierto"
              : "fallido",
          errorCode: e.codigo,
          nextAt:
            reloj() + Math.max(e.esperaMs, 30000 * 2 ** (job.attempts - 1)),
        })
        .where(
          and(
            eq(outbox.id, job.id),
            eq(outbox.state, "enviando"),
            eq(outbox.leaseAt, job.leaseAt),
          ),
        )
        .run();
    }
  }
}
export function historial(user: User) {
  return db()
    .select({
      id: outbox.id,
      tipo: outbox.kind,
      estado: outbox.state,
      entrega: outbox.delivery,
      creado: outbox.createdAt,
      simulada: outbox.simulated,
    })
    .from(outbox)
    .where(eq(outbox.ownerId, user.id))
    .orderBy(desc(outbox.createdAt))
    .limit(20)
    .all();
}
// Para diagnóstico administrativo, sin cuerpos, teléfonos ni enlaces firmados.
export function resumenCola() {
  return {
    conversaciones: db()
      .select({
        estado: whatsappChatJobs.state,
        cantidad: sql<number>`count(*)`,
      })
      .from(whatsappChatJobs)
      .groupBy(whatsappChatJobs.state)
      .all(),
    envios: db()
      .select({ estado: outbox.state, cantidad: sql<number>`count(*)` })
      .from(outbox)
      .groupBy(outbox.state)
      .all(),
    respuestas: db()
      .select({ estado: actions.state, cantidad: sql<number>`count(*)` })
      .from(actions)
      .groupBy(actions.state)
      .all(),
  };
}
