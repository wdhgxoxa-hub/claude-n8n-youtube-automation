import { createHash, randomUUID } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { marcaIngestas, attachments, messages } from "@/db/schema";
import { cuentaActiva, contacto } from "@/servicios/mensajeria/cuentas";
import { validarArchivo } from "@/lib/archivos";
import { ErrorHttp } from "@/lib/permisos";
export async function importarMediosWhatsApp(transporte: typeof fetch = fetch) {
  const pending = db()
    .select()
    .from(marcaIngestas)
    .where(
      and(eq(marcaIngestas.estado, "pendiente"), lt(marcaIngestas.intentos, 3)),
    )
    .limit(4)
    .all();
  for (const job of pending) {
    if (
      !db()
        .update(marcaIngestas)
        .set({ estado: "descargando", intentos: job.intentos + 1 })
        .where(
          and(
            eq(marcaIngestas.id, job.id),
            eq(marcaIngestas.estado, "pendiente"),
          ),
        )
        .run().changes
    )
      continue;
    try {
      const user = cuentaActiva(job.ownerId),
        c = contacto(user.id);
      if (!c?.consentAt || !c.verifiedAt || c.phone !== user.whatsapp)
        throw new ErrorHttp(403, "Contacto revocado.");
      const token = process.env.WHATSAPP_TOKEN,
        phone = process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!token || !phone || !/^\d+$/.test(job.mediaId))
        throw new ErrorHttp(503, "Adjuntos no configurados.");
      const opts = {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error" as const,
        signal: AbortSignal.timeout(15000),
      };
      const metadata = await transporte(
        `https://graph.facebook.com/v27.0/${job.mediaId}?phone_number_id=${encodeURIComponent(phone)}`,
        opts,
      );
      if (!metadata.ok) throw new ErrorHttp(502, "Medio no disponible.");
      const info = z
        .object({
          url: z.string().url(),
          mime_type: z.enum([
            "image/jpeg",
            "image/png",
            "image/webp",
            "video/mp4",
          ]),
          file_size: z
            .number()
            .positive()
            .max(5 * 1024 * 1024),
          sha256: z.string().optional(),
        })
        .parse(await metadata.json());
      const url = new URL(info.url);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        !["lookaside.fbsbx.com", "lookaside.facebook.com"].includes(
          url.hostname,
        )
      )
        throw new ErrorHttp(502, "Destino de medios inválido.");
      const r = await transporte(url, opts);
      if (!r.ok || !r.body) throw new ErrorHttp(502, "No se pudo descargar.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      const reader = r.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 5 * 1024 * 1024) {
          await reader.cancel();
          throw new ErrorHttp(413, "Medio demasiado grande.");
        }
        chunks.push(value);
      }
      const bytes = Buffer.concat(chunks),
        data = bytes.toString("base64");
      if (
        bytes.length !== info.file_size ||
        (info.sha256 &&
          ![
            createHash("sha256").update(bytes).digest("hex"),
            createHash("sha256").update(bytes).digest("base64"),
          ].includes(info.sha256))
      )
        throw new ErrorHttp(422, "Medio incompleto.");
      validarArchivo(info.mime_type, data);
      cuentaActiva(user.id);
      const vigente = contacto(user.id);
      if (!vigente?.consentAt || vigente.verifiedAt !== c.verifiedAt)
        throw new ErrorHttp(403, "Contacto revocado.");
      db().transaction((tx) => {
        const id = randomUUID();
        tx.insert(attachments)
          .values({
            id,
            ownerId: user.id,
            name: `WhatsApp · ${job.caption.slice(0, 70) || "Adjunto"}`,
            mime: info.mime_type,
            size,
            data,
          })
          .run();
        tx.insert(messages)
          .values({
            id: randomUUID(),
            ownerId: user.id,
            role: "user",
            content: job.caption || "Adjunto de WhatsApp para mis marcas.",
            attachmentIds: JSON.stringify([id]),
            createdAt: Date.now(),
          })
          .run();
        tx.update(marcaIngestas)
          .set({ estado: "completa" })
          .where(eq(marcaIngestas.id, job.id))
          .run();
      });
    } catch {
      db()
        .update(marcaIngestas)
        .set({ estado: job.intentos >= 2 ? "fallida" : "pendiente" })
        .where(eq(marcaIngestas.id, job.id))
        .run();
    }
  }
}
