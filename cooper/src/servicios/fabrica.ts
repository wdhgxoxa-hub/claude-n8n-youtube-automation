import { randomUUID } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { channels, videos, events, expenses, type User } from "@/db/schema";
import { ErrorHttp, requireOwn } from "@/lib/permisos";
import { medioDisponible } from "./biblioteca";
import { guionInicial, siguienteEtapa, esperaAprobacion } from "@/lib/etapas";
export const EVENTOS = [
  "nuevo_canal",
  "nuevo_video",
  "corregir",
  "ajustar_biblia",
  "programar",
  "referencias",
  "configurar_redes",
  "metas",
  "adoptar_cuenta",
] as const;
export const ordenSchema = z.object({
  evento: z.enum(EVENTOS),
  recursoId: z.string().max(100).optional(),
  texto: z.string().trim().min(1).max(6000),
  nombre: z.string().trim().max(120).optional(),
  avatarId: z.string().max(100).optional(),
  voiceId: z.string().max(100).optional(),
  avatarPlacement: z.enum(["completo", "partes"]).optional(),
});
export type Orden = z.infer<typeof ordenSchema>;
export interface Fabrica {
  ejecutar(user: User, orden: Orden): Promise<{ mensaje: string; id: string }>;
  sincronizar(user: User): Promise<void>;
  aprobar(user: User, id: string): Promise<void>;
}
export function canalesPropios(user: User) {
  return db()
    .select()
    .from(channels)
    .where(eq(channels.ownerId, user.id))
    .orderBy(desc(channels.createdAt))
    .all();
}
export function videosPropios(user: User) {
  return db()
    .select()
    .from(videos)
    .where(eq(videos.ownerId, user.id))
    .orderBy(desc(videos.createdAt))
    .all();
}
export function validarOrden(user: User, orden: Orden) {
  if (orden.evento === "nuevo_canal") return;
  const isVideo = ["corregir", "programar", "referencias"].includes(
    orden.evento,
  );
  const resource = isVideo
    ? db()
        .select()
        .from(videos)
        .where(eq(videos.id, orden.recursoId ?? ""))
        .get()
    : db()
        .select()
        .from(channels)
        .where(eq(channels.id, orden.recursoId ?? ""))
        .get();
  requireOwn(user, resource);
  if (orden.evento === "nuevo_video") {
    if (orden.avatarId) medioDisponible(user, orden.avatarId, "avatar");
    if (orden.voiceId) medioDisponible(user, orden.voiceId, "voz");
  }

  if (
    orden.evento === "programar" &&
    (!z.iso.datetime({ offset: true }).safeParse(orden.texto).success ||
      Date.parse(orden.texto) <= Date.now())
  )
    throw new ErrorHttp(400, "Elige una fecha futura con zona horaria.");
}
function registrar(user: User, type: string, payload: unknown) {
  db()
    .insert(events)
    .values({
      id: randomUUID(),
      ownerId: user.id,
      type,
      payload: JSON.stringify(payload),
      createdAt: Date.now(),
    })
    .run();
}
export class FabricaSimulada implements Fabrica {
  constructor(
    private nuevoId?: string,
    private registrarGasto = true,
  ) {}
  async ejecutar(user: User, raw: Orden) {
    const orden = ordenSchema.parse(raw);
    validarOrden(user, orden);
    const now = Date.now();
    const id = this.nuevoId ?? randomUUID();
    return db().transaction((tx) => {
      let resourceId = orden.recursoId ?? id;
      switch (orden.evento) {
        case "nuevo_canal":
          tx.insert(channels)
            .values({
              id,
              ownerId: user.id,
              name: orden.nombre || orden.texto.slice(0, 80),
              niche: orden.texto,
              createdAt: now,
            })
            .run();
          resourceId = id;
          break;
        case "nuevo_video":
          tx.insert(videos)
            .values({
              id,
              ownerId: user.id,
              channelId: orden.recursoId!,
              title: orden.texto.slice(0, 160),
              avatarId: orden.avatarId ?? "",
              voiceId: orden.voiceId ?? "",
              avatarPlacement: orden.avatarPlacement ?? "partes",
              script: guionInicial(orden.texto),
              createdAt: now,
              updatedAt: now,
            })
            .run();
          if (this.registrarGasto)
            tx.insert(expenses)
              .values({
                id: randomUUID(),
                ownerId: user.id,
                amount: 0.84,
                concept: "Producción simulada",
                createdAt: now,
              })
              .run();
          resourceId = id;
          break;
        case "corregir": {
          const video = tx
            .select()
            .from(videos)
            .where(eq(videos.id, orden.recursoId!))
            .get()!;
          tx.update(videos)
            .set({
              feedback: orden.texto,
              script: video.script + "\n\nREVISIÓN SOLICITADA\n" + orden.texto,
              stage: video.stage >= 9 ? 4 : 1,
              updatedAt: now,
            })
            .where(eq(videos.id, video.id))
            .run();
          break;
        }
        case "programar": {
          const date = z.iso.datetime({ offset: true }).safeParse(orden.texto);
          if (!date.success || Date.parse(orden.texto) <= now)
            throw new ErrorHttp(
              400,
              "Elige una fecha futura con zona horaria.",
            );
          tx.update(videos)
            .set({ scheduledAt: orden.texto })
            .where(eq(videos.id, orden.recursoId!))
            .run();
          break;
        }
        case "referencias":
          tx.update(videos)
            .set({ references: orden.texto })
            .where(eq(videos.id, orden.recursoId!))
            .run();
          break;
        default: {
          const field = {
            ajustar_biblia: "bible",
            configurar_redes: "networks",
            metas: "goals",
            adoptar_cuenta: "account",
          }[orden.evento];
          tx.update(channels)
            .set({ [field]: orden.texto })
            .where(eq(channels.id, orden.recursoId!))
            .run();
        }
      }
      registrar(user, orden.evento, { ...orden, id: resourceId });
      const mensaje =
        orden.evento === "nuevo_video"
          ? "El video ya está en Radar. Te avisaré cuando el guion necesite tu aprobación."
          : orden.evento === "nuevo_canal"
            ? "Tu canal está listo. Cuéntame qué video quieres crear."
            : "Listo. Guardé los cambios en tu espacio.";
      return { mensaje, id: resourceId };
    });
  }
  async sincronizar(user: User) {
    const now = Date.now();
    const interval = Math.max(
      200,
      Number(process.env.COOPER_SIMULACION_MS) || 8000,
    );
    db().transaction((tx) => {
      for (const video of tx
        .select()
        .from(videos)
        .where(eq(videos.ownerId, user.id))
        .all()) {
        if (
          now - video.updatedAt < interval ||
          esperaAprobacion(video.stage) ||
          video.stage === 11
        )
          continue;
        if (
          video.stage === 10 &&
          video.scheduledAt &&
          Date.parse(video.scheduledAt) > now
        )
          continue;
        tx.update(videos)
          .set({ stage: siguienteEtapa(video.stage), updatedAt: now })
          .where(and(eq(videos.id, video.id), eq(videos.stage, video.stage)))
          .run();
      }
    });
  }
  async aprobar(user: User, id: string) {
    db().transaction((tx) => {
      const video = tx.select().from(videos).where(eq(videos.id, id)).get();
      requireOwn(user, video);
      if (!video || !esperaAprobacion(video.stage))
        throw new ErrorHttp(409, "Este video todavía no necesita aprobación.");
      tx.update(videos)
        .set({
          stage: siguienteEtapa(video.stage, true),
          updatedAt: Date.now(),
        })
        .where(eq(videos.id, id))
        .run();
      registrar(user, "aprobacion", { id, stage: video.stage });
    });
  }
}
const snapshotSchema = z.object({
  videos: z
    .array(
      z.object({
        id: z.string(),
        stage: z.number().int().min(0).max(11),
        script: z.string().max(30000).optional(),
      }),
    )
    .max(500),
});
export class FabricaN8n implements Fabrica {
  private async request(user: User, event: string, payload: unknown) {
    const url = process.env.COOPER_N8N_URL;
    const token = process.env.COOPER_N8N_TOKEN;
    if (!url || !token)
      throw new ErrorHttp(503, "La fábrica todavía no está conectada.");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          evento: event,
          dueno_email: user.email,
          usuario_id: user.id,
          datos: payload,
        }),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("respuesta");
      return (await response.json()) as unknown;
    } catch {
      throw new ErrorHttp(502, "La fábrica no respondió. Inténtalo de nuevo.");
    }
  }
  async ejecutar(user: User, raw: Orden) {
    const orden = ordenSchema.parse(raw);
    validarOrden(user, orden);
    // El puente debe aceptar IDs generados por Cooper y devolver confirmación antes de persistir.
    const id = randomUUID();
    const result = z
      .object({ aceptado: z.literal(true) })
      .safeParse(
        await this.request(user, orden.evento, {
          ...orden,
          id,
          ...(orden.evento === "nuevo_video"
            ? {
                presentacion: {
                  version: 1,
                  presencia: orden.avatarPlacement ?? "partes",
                  avatar: orden.avatarId
                    ? medioDisponible(user, orden.avatarId, "avatar")
                    : null,
                  voz: orden.voiceId
                    ? medioDisponible(user, orden.voiceId, "voz")
                    : null,
                },
              }
            : {}),
        }),
      );
    if (!result.success)
      throw new ErrorHttp(502, "La fábrica no confirmó la solicitud.");
    return new FabricaSimulada(id, false).ejecutar(user, orden);
  }
  async sincronizar(user: User) {
    const result = snapshotSchema.safeParse(
      await this.request(user, "estado", {}),
    );
    if (!result.success)
      throw new ErrorHttp(502, "La fábrica devolvió un estado inválido.");
    for (const video of result.data.videos)
      db()
        .update(videos)
        .set({
          stage: video.stage,
          ...(video.script ? { script: video.script } : {}),
          updatedAt: Date.now(),
        })
        .where(and(eq(videos.id, video.id), eq(videos.ownerId, user.id)))
        .run();
  }
  async aprobar(user: User, id: string) {
    const video = db().select().from(videos).where(eq(videos.id, id)).get();
    requireOwn(user, video);
    if (!video || !esperaAprobacion(video.stage))
      throw new ErrorHttp(409, "No hay una aprobación pendiente.");
    const response = z
      .object({ aceptado: z.literal(true) })
      .safeParse(
        await this.request(user, "aprobar", { id, stage: video.stage }),
      );
    if (!response.success)
      throw new ErrorHttp(502, "No se confirmó la aprobación.");
    await new FabricaSimulada().aprobar(user, id);
  }
}
export function fabrica(): Fabrica {
  const mode = process.env.COOPER_FABRICA ?? "simulada";
  if (!["simulada", "n8n"].includes(mode))
    throw new ErrorHttp(503, "Configuración de fábrica inválida.");
  return mode === "n8n" ? new FabricaN8n() : new FabricaSimulada();
}
