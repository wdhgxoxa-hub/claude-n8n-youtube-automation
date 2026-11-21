import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { whatsappOutbox, type AvisoWhatsApp, type User } from "@/db/schema";
import { ErrorHttp } from "@/lib/permisos";
import { patronTokenRevision } from "@/lib/revision-whatsapp";
import { firma } from "./cuentas";
import { avisoVigente } from "./cola";
export function tokenRevision(job: AvisoWhatsApp) {
  const value = `${job.id}.${job.expiresAt}`;
  return `${value}.${firma("revision", value).toString("base64url")}`;
}
export function urlRevision(token: string) {
  const origin = new URL(process.env.AUTH_URL ?? "http://localhost:3000");
  if (
    origin.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(origin.hostname)
  )
    throw new ErrorHttp(503, "Configura el origen HTTPS de Cooper.");
  return new URL(`/revisar/whatsapp/${token}`, origin.origin).toString();
}
export function resolverEnlace(user: User, token: string, now = Date.now()) {
  const match = patronTokenRevision.exec(token);
  if (
    !match ||
    !timingSafeEqual(
      firma("revision", `${match[1]}.${match[2]}`),
      Buffer.from(match[3], "base64url"),
    )
  )
    throw new ErrorHttp(404, "Enlace no disponible.");
  const job = db()
    .select()
    .from(whatsappOutbox)
    .where(eq(whatsappOutbox.id, match[1]))
    .get();
  if (
    !job ||
    job.ownerId !== user.id ||
    job.expiresAt !== Number(match[2]) ||
    job.kind === "verificacion"
  )
    throw new ErrorHttp(404, "Enlace no disponible.");
  avisoVigente(job, now);
  return job.kind === "gasto" ? "/admin" : `/videos/${job.resourceId}`;
}
