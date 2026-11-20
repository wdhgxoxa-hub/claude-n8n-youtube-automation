import { and, desc, eq, or } from "drizzle-orm";
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
export function estado(user: User) {
  return {
    user,
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
        photoId: assets.photoId,
        placement: assets.placement,
        createdAt: assets.createdAt,
      })
      .from(assets)
      .where(
        or(
          eq(assets.ownerId, user.id),
          and(eq(assets.shared, true), eq(assets.verified, true)),
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
    users: team,
    allowed: db().select().from(allowedEmails).all(),
    threshold,
  };
}
export type Administracion = Awaited<ReturnType<typeof administracionActual>>;

export async function administracionActual(user: User) {
  const local = administracion(user);
  if (process.env.COOPER_FABRICA !== "n8n")
    return { ...local, fuente: "simulada" };
  const { FabricaN8n } = await import("./fabrica");
  const remote = await new FabricaN8n().gastos(user);
  return {
    ...local,
    fuente: remote.estimados ? "n8n_estimado" : "n8n",
    users: local.users.map((u) => {
      const cost = remote.gastos.find((c) => c.dueno_email === u.email);
      const day = cost?.dia ?? 0,
        week = cost?.semana ?? 0,
        month = cost?.mes ?? 0;
      return { ...u, day, week, month, alert: day >= local.threshold };
    }),
  };
}
