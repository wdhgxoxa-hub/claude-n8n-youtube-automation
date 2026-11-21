import { leerObservabilidad, leerLecciones } from "@/contratos/observabilidad";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
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
import { periodosLima } from "@/lib/periodos";
import { catalogo, revisiones } from "./biblioteca";
import { proveedorAvatar, proveedorVoz } from "./proveedores";
import { estadoChat } from "./chat";
import { estadoWhatsApp } from "./mensajeria/cuentas";
export function estado(user: User) {
  return {
    chat: estadoChat(user),
    demo: process.env.COOPER_DEMO === "1",
    user,
    whatsapp: estadoWhatsApp(user),
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
      .all()
      .map(({ learning, ...channel }) => ({
        ...channel,
        lecciones: leerLecciones(learning),
      })),
    videos: db()
      .select()
      .from(videos)
      .where(user.role === "admin" ? undefined : eq(videos.ownerId, user.id))
      .orderBy(desc(videos.createdAt))
      .all()
      .map(({ observability, ...video }) => ({
        ...video,
        observabilidad: leerObservabilidad(observability),
      })),
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
        consentRevokedAt: assets.consentRevokedAt,
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
  const now = Date.now();
  const { day, week, month } = periodosLima(now);
  // La semana puede empezar en el mes anterior: conservar ambos periodos.
  const costs = db()
    .select({
      ownerId: expenses.ownerId,
      day: sql<number>`sum(case when ${expenses.createdAt} >= ${day} then ${expenses.amount} else 0 end)`,
      week: sql<number>`sum(case when ${expenses.createdAt} >= ${week} then ${expenses.amount} else 0 end)`,
      month: sql<number>`sum(case when ${expenses.createdAt} >= ${month} then ${expenses.amount} else 0 end)`,
    })
    .from(expenses)
    .where(and(gte(expenses.createdAt, Math.min(week, month)), lte(expenses.createdAt, now)))
    .groupBy(expenses.ownerId)
    .all();
  const threshold = Number(process.env.COOPER_GASTO_ALERTA_USD) || 25;
  const team = db()
    .select()
    .from(users)
    .all()
    .map((u) => {
      const own = costs.find((c) => c.ownerId === u.id);
      const round = (amount = 0) => Math.round(amount * 100) / 100;
      const day = round(own?.day);
      return {
        ...u,
        day,
        week: round(own?.week),
        month: round(own?.month),
        alert: day >= threshold,
      };
    });
  return {
    identidades: revisiones(user),
    users: team,
    allowed: db().select().from(allowedEmails).all(),
    threshold,
  };
}
export type Administracion = Awaited<ReturnType<typeof administracionActual>>;

export async function administracionActual(user: User) {
  const local = administracion(user);
  if (process.env.COOPER_DEMO === "1" || process.env.COOPER_FABRICA !== "n8n")
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
