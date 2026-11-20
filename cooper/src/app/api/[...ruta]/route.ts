import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  users,
  allowedEmails,
  channels,
  videos,
  messages,
  attachments,
  assets,
} from "@/db/schema";
import { currentUser } from "@/lib/sesion";
import {
  ErrorHttp,
  requireAdmin,
  requireOwner,
  requireOwn,
} from "@/lib/permisos";
import { body, failure, json, rateLimit, sameOrigin } from "@/lib/http";
import { estado, administracion } from "@/servicios/datos";
import { fabrica, ordenSchema } from "@/servicios/fabrica";
import {
  chatSchema,
  proveedorChat,
  TranscripcionSimulada,
} from "@/servicios/chat";
import { AvatarSimulado, VozSimulada } from "@/servicios/medios";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ ruta: string[] }> };
const text = z.string().trim().min(1).max(120);
const uploadSchema = z.object({
  name: text,
  mime: z.enum([
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
    "text/plain",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
    "audio/wav",
    "video/webm",
    "video/mp4",
  ]),
  data: z
    .string()
    .min(4)
    .max(7100000)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/),
});
async function handle(request: Request, context: Context) {
  try {
    const user = await currentUser();
    const { ruta } = await context.params;
    const [section, id, action] = ruta;
    const method = request.method;
    if (method !== "GET") {
      sameOrigin(request);
      rateLimit(user.id);
    }
    if (method === "GET") {
      if (section === "estado") return json(estado(user));
      if (section === "admin") return json(administracion(user));
      if (section === "muestra-voz")
        return new Response(new VozSimulada().muestra() as BodyInit, {
          headers: {
            "Content-Type": "audio/wav",
            "Cache-Control": "private, max-age=3600",
          },
        });
      if (section === "archivos" && id) {
        const file = db()
          .select()
          .from(attachments)
          .where(eq(attachments.id, id))
          .get();
        const shared = db()
          .select()
          .from(assets)
          .where(
            and(
              eq(assets.photoId, id),
              eq(assets.shared, true),
              eq(assets.verified, true),
            ),
          )
          .get();
        if (!shared) requireOwner(user, file);
        if (!file) throw new ErrorHttp(404, "Archivo no encontrado.");
        return new Response(Buffer.from(file.data, "base64"), {
          headers: {
            "Content-Type": file.mime,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }
    if (method === "POST") {
      const input = await body(request);
      if (section === "orden") {
        const orden = ordenSchema.parse(input);
        let actor = user;
        if (orden.evento !== "nuevo_canal") {
          const table = ["corregir", "programar", "referencias"].includes(
            orden.evento,
          )
            ? videos
            : channels;
          const resource = db()
            .select()
            .from(table)
            .where(eq(table.id, orden.recursoId ?? ""))
            .get();
          requireOwner(user, resource);
          actor = db()
            .select()
            .from(users)
            .where(eq(users.id, resource!.ownerId))
            .get()!;
        }
        return json(await fabrica().ejecutar(actor, orden));
      }
      if (section === "chat") {
        const parsed = chatSchema.parse(input);
        for (const id of parsed.adjuntos)
          requireOwn(
            user,
            db().select().from(attachments).where(eq(attachments.id, id)).get(),
          );
        const reply = await proveedorChat.responder(user, parsed);
        const result = reply.orden
          ? await fabrica().ejecutar(user, reply.orden)
          : undefined;
        db().transaction((tx) => {
          tx.insert(messages)
            .values({
              id: randomUUID(),
              ownerId: user.id,
              role: "user",
              content: parsed.texto,
              attachmentIds: JSON.stringify(parsed.adjuntos),
              createdAt: Date.now(),
            })
            .run();
          tx.insert(messages)
            .values({
              id: randomUUID(),
              ownerId: user.id,
              role: "assistant",
              content: result?.mensaje ?? reply.texto,
              createdAt: Date.now() + 1,
            })
            .run();
        });
        return json({ texto: result?.mensaje ?? reply.texto, id: result?.id });
      }
      if (
        section === "videos" &&
        id &&
        ["aprobar", "cambios"].includes(action)
      ) {
        const video = db().select().from(videos).where(eq(videos.id, id)).get();
        requireOwner(user, video);
        const owner = db()
          .select()
          .from(users)
          .where(eq(users.id, video!.ownerId))
          .get()!;
        if (action === "aprobar") await fabrica().aprobar(owner, id);
        else {
          const { texto } = z
            .object({ texto: z.string().trim().min(3).max(6000) })
            .parse(input);
          await fabrica().ejecutar(owner, {
            evento: "corregir",
            recursoId: id,
            texto,
          });
        }
        return json({ ok: true });
      }
      if (section === "archivos") {
        const parsed = uploadSchema.parse(input);
        const size = Buffer.from(parsed.data, "base64").length;
        if (size > 5 * 1024 * 1024)
          throw new ErrorHttp(413, "El archivo supera los 5 MB.");
        if (size < 4) throw new ErrorHttp(400, "El archivo está vacío.");
        const id = randomUUID();
        db()
          .insert(attachments)
          .values({ ...parsed, id, ownerId: user.id, size })
          .run();
        return json({ id, name: parsed.name });
      }
      if (section === "transcribir") {
        const { id } = z.object({ id: z.string().uuid() }).parse(input);
        const file = db()
          .select()
          .from(attachments)
          .where(eq(attachments.id, id))
          .get();
        requireOwn(user, file);
        if (!file?.mime.startsWith("audio/"))
          throw new ErrorHttp(400, "Selecciona un audio.");
        return json({
          texto: await new TranscripcionSimulada().transcribir(),
          simulada: true,
        });
      }
      if (section === "activos") {
        const parsed = z
          .object({
            kind: z.enum(["avatar", "voz"]),
            name: text,
            evidenceId: z.string().uuid(),
            photoId: z.string().uuid().optional(),
            placement: z.enum(["completo", "partes"]),
            consentimiento: z.literal(true),
          })
          .parse(input);
        const evidence = db()
          .select()
          .from(attachments)
          .where(eq(attachments.id, parsed.evidenceId))
          .get();
        requireOwn(user, evidence);
        if (parsed.kind === "avatar") {
          const photo = db()
            .select()
            .from(attachments)
            .where(eq(attachments.id, parsed.photoId ?? ""))
            .get();
          requireOwn(user, photo);
          if (!photo?.mime.startsWith("image/"))
            throw new ErrorHttp(400, "Selecciona una foto.");
        }
        const provider =
          parsed.kind === "avatar" ? new AvatarSimulado() : new VozSimulada();
        const verified = await provider.verificar({
          mime: evidence!.mime,
          consentimiento: parsed.consentimiento,
        });
        const id = randomUUID();
        db()
          .insert(assets)
          .values({
            id,
            ownerId: user.id,
            kind: parsed.kind,
            name: parsed.name,
            evidenceId: parsed.evidenceId,
            photoId: parsed.photoId ?? "",
            placement: parsed.placement,
            verified: verified.verified,
            createdAt: Date.now(),
          })
          .run();
        return json({ id, simulada: true });
      }
      if (section === "admin" && id === "permitidos") {
        requireAdmin(user);
        const { email } = z
          .object({
            email: z
              .email()
              .max(254)
              .transform((v) => v.toLowerCase()),
          })
          .parse(input);
        if (db().select().from(allowedEmails).all().length >= 10)
          throw new ErrorHttp(409, "La lista admite diez correos.");
        db()
          .insert(allowedEmails)
          .values({ email, createdAt: Date.now() })
          .onConflictDoNothing()
          .run();
        return json({ ok: true });
      }
    }
    if (method === "PATCH") {
      const input = await body(request);
      if (section === "perfil") {
        const parsed = z
          .object({
            name: text,
            image: z
              .string()
              .max(400)
              .refine(
                (v) =>
                  v === "" ||
                  /^\/api\/archivos\/[\w-]+$/.test(v) ||
                  /^https:\/\/lh3\.googleusercontent\.com\//.test(v),
              ),
            theme: z.enum(["oscuro", "claro", "sistema"]),
            home: z.enum(["chat", "fabrica"]),
            whatsapp: z
              .string()
              .regex(
                /^(\+[1-9]\d{7,14})?$/,
                "Usa el formato E.164, por ejemplo +51987654321",
              ),
          })
          .parse(input);
        if (parsed.image.startsWith("/api/archivos/")) {
          const file = db()
            .select()
            .from(attachments)
            .where(eq(attachments.id, parsed.image.split("/").at(-1)!))
            .get();
          requireOwn(user, file);
          if (!file?.mime.startsWith("image/"))
            throw new ErrorHttp(400, "La foto debe ser una imagen.");
        }
        db().update(users).set(parsed).where(eq(users.id, user.id)).run();
        return json({ ok: true });
      }
      if (section === "activos" && id) {
        requireOwn(
          user,
          db().select().from(assets).where(eq(assets.id, id)).get(),
        );
        const parsed = z.object({ shared: z.boolean() }).parse(input);
        db().update(assets).set(parsed).where(eq(assets.id, id)).run();
        return json({ ok: true });
      }
      if (section === "admin" && id === "usuarios" && action) {
        requireAdmin(user);
        const { active } = z.object({ active: z.boolean() }).parse(input);
        const target = db()
          .select()
          .from(users)
          .where(eq(users.id, action))
          .get();
        if (!target || target.role === "admin")
          throw new ErrorHttp(400, "No se puede desactivar al administrador.");
        db().update(users).set({ active }).where(eq(users.id, action)).run();
        return json({ ok: true });
      }
    }
    if (method === "DELETE") {
      if (section === "videos" && id) {
        requireOwner(
          user,
          db().select().from(videos).where(eq(videos.id, id)).get(),
        );
        db().delete(videos).where(eq(videos.id, id)).run();
        return json({ ok: true });
      }
      if (section === "canales" && id) {
        requireOwner(
          user,
          db().select().from(channels).where(eq(channels.id, id)).get(),
        );
        db().delete(channels).where(eq(channels.id, id)).run();
        return json({ ok: true });
      }
      if (section === "activos" && id) {
        requireOwn(
          user,
          db().select().from(assets).where(eq(assets.id, id)).get(),
        );
        db().delete(assets).where(eq(assets.id, id)).run();
        return json({ ok: true });
      }
      if (section === "admin" && id === "permitidos" && action) {
        requireAdmin(user);
        if (action === user.email)
          throw new ErrorHttp(400, "Conserva el acceso del administrador.");
        db().delete(allowedEmails).where(eq(allowedEmails.email, action)).run();
        return json({ ok: true });
      }
    }
    throw new ErrorHttp(404, "Ruta no encontrada.");
  } catch (error) {
    return failure(error);
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
