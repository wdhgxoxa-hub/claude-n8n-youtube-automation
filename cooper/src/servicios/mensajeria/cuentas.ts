import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { and, eq, gte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  users,
  allowedEmails,
  whatsappContacts as contacts,
  whatsappOutbox as outbox,
  type User,
} from "@/db/schema";
import { ErrorHttp } from "@/lib/permisos";
import { proveedorMensajeria } from "./proveedor";
export const HORA = 3600000;
export const DIA = 24 * HORA;
export const preferenciasSchema = z.object({
  guion: z.boolean(),
  final: z.boolean(),
  publicado: z.boolean(),
  gasto: z.boolean().default(false),
  marca: z.boolean().default(false),
});
export const sinAvisos = {
  guion: false,
  final: false,
  publicado: false,
  gasto: false,
  marca: false,
};
export function preferencias(text: string) {
  return preferenciasSchema.catch(sinAvisos).parse(JSON.parse(text));
}
export function cuentaActiva(id: string) {
  const user = db().select().from(users).where(eq(users.id, id)).get();
  if (
    !user?.active ||
    !db()
      .select()
      .from(allowedEmails)
      .where(eq(allowedEmails.email, user.email))
      .get()
  )
    throw new ErrorHttp(403, "La cuenta ya no tiene acceso.");
  return user;
}
export function contacto(id: string) {
  return db().select().from(contacts).where(eq(contacts.ownerId, id)).get();
}
export function firma(proposito: string, texto: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new ErrorHttp(503, "Los avisos todavía no están configurados.");
  return createHmac("sha256", secret)
    .update(`cooper:whatsapp:${proposito}:`)
    .update(texto)
    .digest();
}
export function codigoVerificacion(id: string) {
  return (firma("codigo", id).readUInt32BE(0) % 1000000)
    .toString()
    .padStart(6, "0");
}
export function reiniciarNumero(ownerId: string) {
  db().delete(contacts).where(eq(contacts.ownerId, ownerId)).run();
  db()
    .update(outbox)
    .set({ state: "cancelado" })
    .where(and(eq(outbox.ownerId, ownerId), eq(outbox.state, "pendiente")))
    .run();
}
export function solicitarCodigo(user: User, raw: unknown, now = Date.now()) {
  const { consentimiento } = z
    .object({ consentimiento: z.literal(true) })
    .parse(raw);
  void consentimiento;
  const current = cuentaActiva(user.id);
  const phone = z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, "Guarda primero tu número con código de país.")
    .parse(current.whatsapp);
  const simulated = proveedorMensajeria().simulada;
  const challengeId = randomUUID();
  const code = codigoVerificacion(challengeId);
  db().transaction(
    (tx) => {
      const recent = tx
        .select()
        .from(outbox)
        .where(
          and(
            eq(outbox.kind, "verificacion"),
            gte(outbox.createdAt, now - HORA),
            or(eq(outbox.ownerId, user.id), eq(outbox.phone, phone)),
          ),
        )
        .all();
      if (recent.length >= 3 || recent.some((j) => now - j.createdAt < 60000))
        throw new ErrorHttp(
          429,
          "Espera un minuto; puedes pedir hasta tres códigos por hora.",
        );
      const used = tx
        .select()
        .from(contacts)
        .where(and(eq(contacts.phone, phone), gte(contacts.verifiedAt, 1)))
        .get();
      if (used && used.ownerId !== user.id)
        throw new ErrorHttp(409, "No se puede verificar este número.");
      const fields = {
        phone,
        verifiedAt: 0,
        consentAt: now,
        preferences: JSON.stringify(sinAvisos),
        incomingAt: 0,
        challengeId,
        challengeExpires: now + 10 * 60000,
        challengeAttempts: 0,
        simulated,
      };
      tx.insert(contacts)
        .values({ ownerId: user.id, ...fields })
        .onConflictDoUpdate({ target: contacts.ownerId, set: fields })
        .run();
      tx.update(outbox)
        .set({ state: "cancelado" })
        .where(
          and(
            eq(outbox.ownerId, user.id),
            eq(outbox.kind, "verificacion"),
            eq(outbox.state, "pendiente"),
          ),
        )
        .run();
      tx.insert(outbox)
        .values({
          id: challengeId,
          dedupeKey: challengeId,
          ownerId: user.id,
          phone,
          kind: "verificacion",
          simulated,
          nextAt: now,
          expiresAt: fields.challengeExpires,
          createdAt: now,
        })
        .run();
    },
    { behavior: "immediate" },
  );
  return {
    ok: true,
    simulada: simulated,
    ...(simulated ? { codigoSimulado: code } : {}),
  };
}
export function verificarCodigo(user: User, raw: unknown, now = Date.now()) {
  const { codigo } = z
    .object({ codigo: z.string().regex(/^\d{6}$/) })
    .parse(raw);
  const current = cuentaActiva(user.id);
  // El intento fallido se confirma antes de devolver el error: no se revierte el contador.
  const valid = db().transaction(
    (tx) => {
      const c = contacto(user.id);
      if (
        !c ||
        c.phone !== current.whatsapp ||
        !c.challengeId ||
        c.challengeExpires <= now ||
        c.challengeAttempts >= 5 ||
        c.simulated !== proveedorMensajeria().simulada
      )
        return false;
      const correct = timingSafeEqual(
        Buffer.from(codigo),
        Buffer.from(codigoVerificacion(c.challengeId)),
      );
      tx.update(contacts)
        .set({ challengeAttempts: c.challengeAttempts + 1 })
        .where(eq(contacts.ownerId, user.id))
        .run();
      if (!correct) return false;
      const used = tx
        .select()
        .from(contacts)
        .where(and(eq(contacts.phone, c.phone), gte(contacts.verifiedAt, 1)))
        .get();
      if (used && used.ownerId !== user.id) return false;
      tx.update(contacts)
        .set({ verifiedAt: now, challengeId: "", challengeExpires: 0 })
        .where(eq(contacts.ownerId, user.id))
        .run();
      tx.update(outbox)
        .set({ state: "cancelado" })
        .where(
          and(
            eq(outbox.ownerId, user.id),
            eq(outbox.kind, "verificacion"),
            eq(outbox.state, "pendiente"),
          ),
        )
        .run();
      return true;
    },
    { behavior: "immediate" },
  );
  if (!valid)
    throw new ErrorHttp(
      400,
      "El código no es válido o caducó. Revisa el código o pide uno nuevo.",
    );
  return { ok: true };
}
export function guardarPreferencias(
  user: User,
  raw: unknown,
  now = Date.now(),
) {
  const p = preferenciasSchema.parse(raw);
  const current = cuentaActiva(user.id),
    c = contacto(user.id);
  if (
    !c?.verifiedAt ||
    c.phone !== current.whatsapp ||
    c.simulated !== proveedorMensajeria().simulada
  )
    throw new ErrorHttp(409, "Verifica tu número antes de activar los avisos.");
  if ((p.gasto || p.marca) && current.role !== "admin")
    throw new ErrorHttp(403, "Aviso no disponible.");
  db()
    .update(contacts)
    .set({ preferences: JSON.stringify(p), consentAt: now })
    .where(eq(contacts.ownerId, user.id))
    .run();
  return { ok: true };
}
export function estadoWhatsApp(user: User) {
  const c = contacto(user.id),
    simulated = proveedorMensajeria().simulada;
  const verified =
    !!c?.verifiedAt && c.phone === user.whatsapp && c.simulated === simulated;
  const p = verified ? preferencias(c.preferences) : sinAvisos;
  return {
    verificado: verified,
    simulada: simulated,
    preferencias: {
      guion: p.guion,
      final: p.final,
      publicado: p.publicado,
      ...(user.role === "admin" ? { gasto: p.gasto, marca: p.marca } : {}),
    },
  };
}
