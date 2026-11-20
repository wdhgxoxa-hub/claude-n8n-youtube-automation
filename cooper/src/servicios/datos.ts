import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  channels,
  videos,
  messages,
  assets,
  expenses,
  allowedEmails,
  type User,
} from "@/db/schema";
import { requireAdmin } from "@/lib/permisos";
import { catalogo, revisiones } from "./biblioteca";
import { proveedorAvatar, proveedorVoz } from "./proveedores";
export function estado(user: User) {
  return {
    user,
    catalogo: catalogo(),
    medios: {
      avatarSimulado: proveedorAvatar().simulada,
      vozSimulada: proveedorVoz().simulada,
    },
    channels: db()
      .select()
      .from(channels)
      .where(user.role === "admin" ? undefined : eq(channels.ownerId, user.id))
      .orderBy(desc(channels.createdAt))
      .all(),
    videos: db()
      .select()
      .from(videos)
      .where(user.role === "admin" ? undefined : eq(videos.ownerId, user.id))
      .orderBy(desc(videos.createdAt))
      .all(),
    messages: db()
      .select()
      .from(messages)
      .where(eq(messages.ownerId, user.id))
      .orderBy(desc(messages.createdAt))
      .limit(100)
      .all()
      .reverse(),
    assets: db()
      .select({
        id: assets.id,
        ownerId: assets.ownerId,
        kind: assets.kind,
        name: assets.name,
        shared: assets.shared,
        verified: assets.verified,
        status: assets.status,
        simulated: assets.simulated,
        consentAt: assets.consentAt,
        syncError: assets.syncError,
        retryable:
          sql<boolean>`${assets.provider} = 'heygen' AND ${assets.providerId} = '' AND ${assets.verified} = 1`.mapWith(
            Boolean,
          ),
        hasPreview: sql<boolean>`length(${assets.previewUrl}) > 0`.mapWith(
          Boolean,
        ),

        photoId: assets.photoId,
        placement: assets.placement,
        createdAt: assets.createdAt,
      })
      .from(assets)
      .where(
        or(
          eq(assets.ownerId, user.id),
          and(
            eq(assets.shared, true),
            eq(assets.verified, true),
            eq(assets.status, "listo"),
          ),
        ),
      )
      .all(),
  };
}
export type Estado = ReturnType<typeof estado>;
export function administracion(user: User) {
  requireAdmin(user);
  const now = new Date();
  const day = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const week = day - ((now.getUTCDay() + 6) % 7) * 86400000;
  const month = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const costs = db().select().from(expenses).all();
  const threshold = Number(process.env.COOPER_GASTO_ALERTA_USD) || 25;
  const team = db()
    .select()
    .from(users)
    .all()
    .map((u) => {
      const own = costs.filter((c) => c.ownerId === u.id);
      const sum = (since: number) =>
        Math.round(
          own
            .filter((c) => c.createdAt >= since)
            .reduce((a, c) => a + c.amount, 0) * 100,
        ) / 100;
      return {
        ...u,
        day: sum(day),
        week: sum(week),
        month: sum(month),
        alert: sum(day) >= threshold,
      };
    });
  return {
    identidades: revisiones(user),
    users: team,
    allowed: db().select().from(allowedEmails).all(),
    threshold,
  };
}
export type Administracion = ReturnType<typeof administracion>;
