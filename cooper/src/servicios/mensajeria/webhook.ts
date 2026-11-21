import { encolarMarca } from "@/servicios/marcas/whatsapp";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  videos,
  piezasMarca,
  marcaIngestas,
  whatsappContacts as contacts,
  whatsappOutbox as outbox,
  whatsappInbox as inbox,
  whatsappDeliveries as deliveries,
  whatsappActions as actions,
  type User,
} from "@/db/schema";
import { ErrorHttp } from "@/lib/permisos";
import { cuentaActiva, preferencias, sinAvisos, DIA } from "./cuentas";
import {
  avisoVigente,
  claveAccion,
  conciliarEntrega,
  encolarVideo,
} from "./cola";
import { proveedorMensajeria } from "./proveedor";
const id = z.string().min(1).max(512);
const timestamp = z.string().regex(/^\d{1,12}$/);
const webhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              field: z.string(),
              value: z.object({
                metadata: z.object({ phone_number_id: z.string() }).optional(),
                messages: z
                  .array(
                    z.object({
                      id,
                      from: z.string().optional(),
                      timestamp,
                      type: z.string(),
                      context: z.object({ id }).optional(),
                      image: z
                        .object({
                          id: z.string().regex(/^\d+$/),
                          caption: z.string().max(1800).optional(),
                        })
                        .optional(),
                      video: z
                        .object({
                          id: z.string().regex(/^\d+$/),
                          caption: z.string().max(1800).optional(),
                        })
                        .optional(),
                      text: z
                        .object({ body: z.string().max(10000) })
                        .optional(),
                      interactive: z
                        .object({
                          type: z.string(),
                          button_reply: z
                            .object({ id, title: z.string().optional() })
                            .optional(),
                        })
                        .optional(),
                    }),
                  )
                  .max(1000)
                  .optional(),
                statuses: z
                  .array(
                    z.object({
                      id,
                      recipient_id: z.string().optional(),
                      timestamp,
                      status: z.string(),
                      errors: z
                        .array(z.object({ code: z.number().int() }))
                        .optional(),
                    }),
                  )
                  .max(1000)
                  .optional(),
              }),
            }),
          )
          .max(1000),
      }),
    )
    .max(1000),
});
export function verificarSuscripcion(url: URL) {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN,
    provided = url.searchParams.get("hub.verify_token") ?? "";
  if (!expected) throw new ErrorHttp(503, "Receptor no configurado.");
  const hash = (v: string) => createHmac("sha256", expected).update(v).digest();
  if (
    url.searchParams.get("hub.mode") !== "subscribe" ||
    !timingSafeEqual(hash(expected), hash(provided))
  )
    throw new ErrorHttp(403, "Verificación inválida.");
  const challenge = url.searchParams.get("hub.challenge");
  if (!challenge || challenge.length > 1000)
    throw new ErrorHttp(400, "Falta el desafío.");
  return challenge;
}
export async function recibirWhatsApp(request: Request, now = Date.now()) {
  const secret = process.env.WHATSAPP_APP_SECRET,
    phone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!secret || !phone) throw new ErrorHttp(503, "Receptor no configurado.");
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!/^sha256=[a-f0-9]{64}$/.test(signature))
    throw new ErrorHttp(401, "Firma inválida.");
  const reader = request.body?.getReader();
  if (!reader) throw new ErrorHttp(400, "Cuerpo vacío.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1024 * 1024) {
      await reader.cancel();
      throw new ErrorHttp(413, "Cuerpo demasiado grande.");
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  if (
    !timingSafeEqual(
      createHmac("sha256", secret).update(bytes).digest(),
      Buffer.from(signature.slice(7), "hex"),
    )
  )
    throw new ErrorHttp(401, "Firma inválida.");
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new ErrorHttp(400, "JSON inválido.");
  }
  const payload = webhookSchema.parse(raw);
  const pending: {
    key: string;
    user: User;
    resourceId: string;
    decision: string;
    jobId: string;
    revision: string;
  }[] = [];
  db().transaction(
    (tx) => {
      for (const entry of payload.entry)
        for (const change of entry.changes) {
          if (
            change.field !== "messages" ||
            change.value.metadata?.phone_number_id !== phone
          )
            continue;
          for (const status of change.value.statuses ?? []) {
            if (
              !["sent", "delivered", "read", "failed"].includes(
                status.status,
              ) ||
              !/^[1-9]\d{7,14}$/.test(status.recipient_id ?? "")
            )
              continue;
            const recipient = `+${status.recipient_id}`;
            // Solo IDs enviados por Cooper; los recibos adelantados se conservan sin cuerpo para conciliación.
            tx.insert(deliveries)
              .values({
                id: `${status.id}:${status.status}`,
                remoteId: status.id,
                phone: recipient,
                state: status.status,
                occurredAt: Number(status.timestamp) * 1000,
                errorCode: status.errors?.[0]
                  ? String(status.errors[0].code)
                  : "",
              })
              .onConflictDoNothing()
              .run();
            const job = tx
              .select()
              .from(outbox)
              .where(
                and(
                  eq(outbox.remoteId, status.id),
                  eq(outbox.phone, recipient),
                ),
              )
              .get();
            if (job) conciliarEntrega(job);
          }
          for (const message of change.value.messages ?? []) {
            if (
              !tx
                .insert(inbox)
                .values({ id: message.id, createdAt: now })
                .onConflictDoNothing()
                .run().changes
            )
              continue;
            const sentAt = Number(message.timestamp) * 1000;
            if (
              sentAt <= now - DIA ||
              sentAt > now + 300000 ||
              !/^[1-9]\d{7,14}$/.test(message.from ?? "")
            )
              continue;
            const c = tx
              .select()
              .from(contacts)
              .where(
                and(
                  eq(contacts.phone, `+${message.from}`),
                  sql`${contacts.verifiedAt} > 0`,
                ),
              )
              .get();
            if (!c || c.simulated !== proveedorMensajeria().simulada) continue;
            let user: User;
            try {
              user = cuentaActiva(c.ownerId);
            } catch {
              continue;
            }
            if (user.whatsapp !== c.phone || sentAt < c.verifiedAt - 1000)
              continue;
            tx.update(contacts)
              .set({
                incomingAt: Math.max(c.incomingAt, Math.min(sentAt, now)),
              })
              .where(eq(contacts.ownerId, c.ownerId))
              .run();
            if (
              message.type === "text" &&
              /^(baja|stop|cancelar)$/i.test(message.text?.body.trim() ?? "")
            ) {
              tx.update(contacts)
                .set({ preferences: JSON.stringify(sinAvisos), consentAt: 0 })
                .where(eq(contacts.ownerId, c.ownerId))
                .run();
              tx.update(outbox)
                .set({ state: "cancelado" })
                .where(
                  and(
                    eq(outbox.ownerId, c.ownerId),
                    eq(outbox.state, "pendiente"),
                  ),
                )
                .run();
              continue;
            }
            const media =
              message.type === "image"
                ? message.image
                : message.type === "video"
                  ? message.video
                  : undefined;
            if (media && c.consentAt)
              tx.insert(marcaIngestas)
                .values({
                  id: message.id,
                  ownerId: user.id,
                  mediaId: media.id,
                  caption: media.caption ?? "",
                  createdAt: now,
                })
                .onConflictDoNothing()
                .run();
            const reply =
              message.type === "interactive" &&
              message.interactive?.type === "button_reply"
                ? /^(aprobar|cambios):([a-f0-9-]{36})$/.exec(
                    message.interactive.button_reply?.id ?? "",
                  )
                : null;
            if (reply) {
              const job = tx
                .select()
                .from(outbox)
                .where(eq(outbox.id, reply[2]))
                .get();
              if (
                !job ||
                job.ownerId !== user.id ||
                !job.interactive ||
                job.state !== "aceptado" ||
                job.remoteId !== message.context?.id ||
                !["guion", "final", "marca"].includes(job.kind)
              )
                continue;
              try {
                avisoVigente(job, now);
              } catch {
                continue;
              }
              const key = claveAccion(job);
              if (
                tx
                  .insert(actions)
                  .values({
                    id: key,
                    ownerId: user.id,
                    decision: reply[1],
                    state: "procesando",
                    createdAt: now,
                  })
                  .onConflictDoNothing()
                  .run().changes
              )
                pending.push({
                  key,
                  user,
                  resourceId: job.resourceId,
                  jobId: job.id,
                  revision: job.revision,
                  decision: reply[1],
                });
            } else if (
              message.type === "text" &&
              c.consentAt &&
              Object.values(preferencias(c.preferences)).some(Boolean)
            ) {
              if (user.role === "admin")
                for (const p of tx
                  .select()
                  .from(piezasMarca)
                  .where(eq(piezasMarca.estado, "pendiente"))
                  .all())
                  encolarMarca(p.id, true, now);
              // El texto libre abre la ventana; la decisión requiere un botón ligado a una revisión concreta.
              for (const video of tx
                .select()
                .from(videos)
                .where(eq(videos.ownerId, user.id))
                .all())
                encolarVideo(video, true, now);
            }
          }
        }
    },
    { behavior: "immediate" },
  );
  for (const action of pending) {
    try {
      const { fabrica } = await import("@/servicios/fabrica");
      const user = cuentaActiva(action.user.id);
      const job = db()
        .select()
        .from(outbox)
        .where(eq(outbox.id, action.jobId))
        .get();
      if (!job) throw new ErrorHttp(404, "Aviso no disponible.");
      avisoVigente(job, now, true);
      if (job.kind === "marca") {
        const { decidirPieza } = await import("@/servicios/marcas/servicio");
        decidirPieza(
          user,
          action.resourceId,
          Number(action.revision),
          action.decision === "aprobar",
          now,
        );
      } else if (action.decision === "aprobar")
        await fabrica({ tipo: "accion_whatsapp", id: action.key }).aprobar(
          user,
          action.resourceId,
          action.revision,
        );
      else
        await fabrica({ tipo: "accion_whatsapp", id: action.key }).ejecutar(
          user,
          {
            evento: "corregir",
            recursoId: action.resourceId,
            parametros: { revisionWhatsApp: action.revision },
            texto:
              "Solicito cambios desde WhatsApp. Detallaré la revisión en Cooper antes de aprobar.",
          },
        );
      db()
        .update(actions)
        .set({ state: "completada" })
        .where(eq(actions.id, action.key))
        .run();
    } catch {
      // La orden pudo llegar a n8n. Persistir para revisión, sin repetir acciones automáticamente.
      db()
        .update(actions)
        .set({ state: "incierta" })
        .where(eq(actions.id, action.key))
        .run();
    }
  }
  return { ok: true };
}
