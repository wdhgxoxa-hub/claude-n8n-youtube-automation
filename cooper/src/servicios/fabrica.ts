import { createHash, randomUUID } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  channels,
  videos,
  events,
  expenses,
  bridgeCommands,
  type User,
} from "@/db/schema";
import {
  ErrorHttp,
  requireOwn,
  requireOwner,
  requireAdmin,
} from "@/lib/permisos";
import {
  aceptadoSchema,
  solicitudSchema,
  estadoRemotoSchema,
  gastosSchema,
  consultaSchema,
  type EventoPuente,
  type ConsultaPuente,
} from "@/contratos/puente";
import { aplicarEstado } from "./puente";
import { encolarVideo } from "./mensajeria/cola";
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
  parametros: z.record(z.string(), z.unknown()).optional(),
  avatarId: z.string().max(100).optional(),
  voiceId: z.string().max(100).optional(),
  avatarPlacement: z.enum(["completo", "partes"]).optional(),
});
export type Orden = z.infer<typeof ordenSchema>;
export interface Fabrica {
  ejecutar(user: User, orden: Orden): Promise<{ mensaje: string; id: string }>;
  sincronizar(user: User): Promise<void>;
  aprobar(user: User, id: string, revisionEsperada?: string): Promise<void>;
  eliminar(user: User, id: string, tipo: "canal" | "video"): Promise<void>;
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
  if (
    (orden.evento === "ajustar_biblia" &&
      orden.parametros?.campo === "modo_noticia" &&
      typeof orden.parametros.valor !== "boolean") ||
    (orden.evento === "nuevo_video" &&
      orden.parametros?.modo_noticia !== undefined &&
      typeof orden.parametros.modo_noticia !== "boolean")
  )
    throw new ErrorHttp(
      400,
      "El modo noticia debe estar activado o desactivado.",
    );
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
  if (
    orden.parametros?.revisionWhatsApp &&
    resource &&
    "stage" in resource &&
    `${resource.stage}:${resource.remoteUpdatedAt || resource.updatedAt}` !==
      orden.parametros.revisionWhatsApp
  )
    throw new ErrorHttp(409, "La revisión cambió. Abre el video desde Cooper.");
  if (
    isVideo &&
    resource &&
    "productionState" in resource &&
    resource.productionState === "cancelada"
  )
    throw new ErrorHttp(
      409,
      "El video se canceló por revocación del consentimiento.",
    );
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
    return db().transaction(
      (tx) => {
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
          case "nuevo_video": {
            const channel = tx
              .select()
              .from(channels)
              .where(eq(channels.id, orden.recursoId!))
              .get()!;
            const newsMode =
              typeof orden.parametros?.modo_noticia === "boolean"
                ? orden.parametros.modo_noticia
                : channel.newsMode;
            tx.insert(videos)
              .values({
                id,
                ownerId: user.id,
                channelId: orden.recursoId!,
                title: orden.texto.slice(0, 160),
                newsMode,
                ...(newsMode && this.registrarGasto
                  ? {
                      stage: 2,
                      productionState: "pausada",
                      productionNotice:
                        "Modo noticia: el simulador no verifica noticias reales. Se necesitan datos con fuentes antes de avanzar.",
                    }
                  : {}),
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
          }
          case "corregir": {
            if (!this.registrarGasto) {
              tx.update(videos)
                .set({ feedback: orden.texto })
                .where(eq(videos.id, orden.recursoId!))
                .run();
              break;
            }
            const video = tx
              .select()
              .from(videos)
              .where(eq(videos.id, orden.recursoId!))
              .get()!;
            tx.update(videos)
              .set({
                feedback: orden.texto,
                script:
                  video.script + "\n\nREVISIÓN SOLICITADA\n" + orden.texto,
                stage: video.stage >= 9 ? 4 : 1,
                updatedAt: now,
              })
              .where(eq(videos.id, video.id))
              .run();
            break;
          }
          case "programar": {
            const date = z.iso
              .datetime({ offset: true })
              .safeParse(orden.texto);
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
            if (
              orden.evento === "ajustar_biblia" &&
              orden.parametros?.campo === "modo_noticia"
            ) {
              tx.update(channels)
                .set({ newsMode: orden.parametros.valor === true })
                .where(eq(channels.id, orden.recursoId!))
                .run();
              break;
            }
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
      },
      { behavior: "immediate" },
    );
  }
  async eliminar(user: User, id: string, tipo: "canal" | "video") {
    const table = tipo === "canal" ? channels : videos;
    requireOwner(user, db().select().from(table).where(eq(table.id, id)).get());
    db().delete(table).where(eq(table.id, id)).run();
  }
  async sincronizar(user: User) {
    const now = Date.now();
    const interval = Math.max(
      200,
      Number(process.env.COOPER_SIMULACION_MS) || 8000,
    );
    db().transaction(
      (tx) => {
        for (const video of tx
          .select()
          .from(videos)
          .where(eq(videos.ownerId, user.id))
          .all()) {
          if (
            (process.env.COOPER_DEMO === "1" &&
              video.id === `demo-${user.id}-0` &&
              video.stage === 7) ||
            video.productionState !== "activa" ||
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
          encolarVideo({
            ...video,
            stage: siguienteEtapa(video.stage),
            updatedAt: now,
          });
        }
      },
      { behavior: "immediate" },
    );
  }
  async aprobar(user: User, id: string, revisionEsperada?: string) {
    db().transaction(
      (tx) => {
        const video = tx.select().from(videos).where(eq(videos.id, id)).get();
        requireOwn(user, video);
        if (
          revisionEsperada &&
          video &&
          `${video.stage}:${video.remoteUpdatedAt || video.updatedAt}` !==
            revisionEsperada
        )
          throw new ErrorHttp(409, "La revisión cambió.");
        if (
          !video ||
          video.productionState !== "activa" ||
          !esperaAprobacion(video.stage)
        )
          throw new ErrorHttp(
            409,
            "Este video todavía no necesita aprobación.",
          );
        tx.update(videos)
          .set({
            stage: siguienteEtapa(video.stage, true),
            updatedAt: Date.now(),
          })
          .where(eq(videos.id, id))
          .run();
        registrar(user, "aprobacion", { id, stage: video.stage });
      },
      { behavior: "immediate" },
    );
  }
}
const operaciones = new Map<string, Promise<void>>();
function serializar<T>(id: string, task: () => Promise<T>): Promise<T> {
  const previous = operaciones.get(id) ?? Promise.resolve();
  const current = previous.then(task, task);
  const settled = current.then(
    () => {},
    () => {},
  );
  operaciones.set(id, settled);
  void settled.then(() => {
    if (operaciones.get(id) === settled) operaciones.delete(id);
  });
  return current;
}
export class FabricaN8n implements Fabrica {
  ejecutar(user: User, raw: Orden) {
    return serializar(user.id, () => this.ejecutarOrden(user, raw));
  }
  sincronizar(user: User) {
    return serializar(user.id, () => this.sincronizarEstado(user));
  }
  aprobar(user: User, id: string, revisionEsperada?: string) {
    return serializar(user.id, () =>
      this.aprobarVideo(user, id, revisionEsperada),
    );
  }
  eliminar(user: User, id: string, tipo: "canal" | "video") {
    return serializar(user.id, () => this.eliminarRecurso(user, id, tipo));
  }

  constructor(private opciones = { timeoutMs: 10000, backoffMs: 250 }) {}
  private async request(
    user: User,
    event: EventoPuente | ConsultaPuente,
    payload: Record<string, unknown>,
  ) {
    const url = process.env.COOPER_N8N_URL;
    const token = process.env.COOPER_N8N_TOKEN;
    if (!url || !token)
      throw new ErrorHttp(503, "La fábrica todavía no está conectada.");
    const approval = event === "aprobar_guion" || event === "aprobar_final";
    const digest = createHash("sha256")
      .update(JSON.stringify([user.id, event, payload]))
      .digest("hex");
    const id = approval
      ? `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`
      : randomUUID();
    const request = solicitudSchema.parse({
      version: "cooper-v1",
      id_evento: id,
      evento: event,
      dueno_email: user.email,
      admin: user.role === "admin",
      datos: payload,
    });
    const encoded = JSON.stringify(request);
    if (
      !["estado", "reporte", "pendientes", "tendencias", "gastos"].includes(
        event,
      )
    )
      db()
        .insert(bridgeCommands)
        .values({
          id: request.id_evento,
          ownerId: user.id,
          request: encoded,
          createdAt: Date.now(),
        })
        .onConflictDoNothing()
        .run();
    for (let attempt = 0; attempt < 3; attempt++) {
      if (
        db()
          .select()
          .from(bridgeCommands)
          .where(eq(bridgeCommands.id, request.id_evento))
          .get()?.confirmed
      )
        return { aceptado: true };
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: encoded,
          signal: AbortSignal.timeout(this.opciones.timeoutMs),
          cache: "no-store",
          redirect: "error",
        });
        if ([408, 429, 500, 502, 503, 504].includes(response.status))
          throw new Error("temporal");
        if (response.status === 422)
          throw new ErrorHttp(
            422,
            "Ese avatar o voz es de demostración y aún no tiene un recurso de producción. Tu elección se conserva.",
          );
        if (!response.ok)
          throw new ErrorHttp(
            response.status === 409 ? 409 : 502,
            response.status === 409
              ? "La orden sigue pendiente de confirmación en la fábrica."
              : "La fábrica rechazó la solicitud.",
          );
        return (await response.json()) as unknown;
      } catch (error) {
        if (error instanceof ErrorHttp) throw error;
        if (attempt === 2)
          throw new ErrorHttp(
            502,
            "La fábrica no respondió. Revisa el estado antes de repetir la orden.",
          );
        await new Promise((resolve) =>
          setTimeout(resolve, this.opciones.backoffMs * 2 ** attempt),
        );
      }
    }
    throw new ErrorHttp(502, "La fábrica no respondió.");
  }
  private async ejecutarOrden(user: User, raw: Orden) {
    const orden = ordenSchema.parse(raw);
    validarOrden(user, orden);
    const id = randomUUID();
    if (
      !aceptadoSchema.safeParse(
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
      ).success
    )
      throw new ErrorHttp(502, "La fábrica no confirmó la solicitud.");
    const table = orden.evento === "nuevo_canal" ? channels : videos;
    const existing = db().select().from(table).where(eq(table.id, id)).get();
    if (existing) requireOwn(user, existing);
    const result = existing
      ? { id, mensaje: "Solicitud recibida." }
      : await new FabricaSimulada(id, false).ejecutar(user, orden);
    if (orden.evento === "nuevo_video" && !existing)
      db().update(videos).set({ script: "" }).where(eq(videos.id, id)).run();
    return {
      ...result,
      mensaje:
        "La fábrica recibió tu solicitud. Verás el avance en tu espacio.",
    };
  }
  private async sincronizarEstado(user: User) {
    const result = estadoRemotoSchema.safeParse(
      await this.request(user, "estado", {}),
    );
    if (!result.success)
      throw new ErrorHttp(502, "La fábrica devolvió un estado inválido.");
    aplicarEstado(user, result.data);
  }
  async consultar(user: User, consulta: Exclude<ConsultaPuente, "gastos">) {
    if (consulta === "estado") {
      await this.sincronizar(user);
      return "Estado de la fábrica actualizado.";
    }
    const result = consultaSchema.safeParse(
      await this.request(user, consulta, {}),
    );
    if (!result.success)
      throw new ErrorHttp(502, "La fábrica devolvió una consulta inválida.");
    return result.data.resumen;
  }
  async gastos(user: User) {
    requireAdmin(user);
    const result = gastosSchema.safeParse(
      await this.request(user, "gastos", {}),
    );
    if (!result.success)
      throw new ErrorHttp(502, "No se pudo consultar el gasto de la fábrica.");
    return result.data;
  }
  private async aprobarVideo(
    user: User,
    id: string,
    revisionEsperada?: string,
  ) {
    const video = db().select().from(videos).where(eq(videos.id, id)).get();
    requireOwn(user, video);
    if (
      !video ||
      video.productionState === "cancelada" ||
      !esperaAprobacion(video.stage)
    )
      throw new ErrorHttp(409, "No hay una aprobación pendiente.");
    if (
      revisionEsperada &&
      `${video.stage}:${video.remoteUpdatedAt || video.updatedAt}` !==
        revisionEsperada
    )
      throw new ErrorHttp(409, "La revisión cambió.");
    const event = video.stage === 3 ? "aprobar_guion" : "aprobar_final";
    if (
      !aceptadoSchema.safeParse(
        await this.request(user, event, {
          id,
          revision: video.remoteUpdatedAt,
        }),
      ).success
    )
      throw new ErrorHttp(502, "No se confirmó la aprobación.");
    // La etapa la confirma n8n por webhook o conciliación; nunca se adelanta localmente.
  }
  private async eliminarRecurso(
    user: User,
    id: string,
    tipo: "canal" | "video",
  ) {
    const table = tipo === "canal" ? channels : videos;
    requireOwner(user, db().select().from(table).where(eq(table.id, id)).get());
    if (
      !aceptadoSchema.safeParse(
        await this.request(user, "eliminar", { id, tipo }),
      ).success
    )
      throw new ErrorHttp(502, "No se confirmó la eliminación.");
    db().delete(table).where(eq(table.id, id)).run();
  }
}
export function fabrica(): Fabrica {
  const mode =
    process.env.COOPER_DEMO === "1"
      ? "simulada"
      : (process.env.COOPER_FABRICA ?? "simulada");
  if (!["simulada", "n8n"].includes(mode))
    throw new ErrorHttp(503, "Configuración de fábrica inválida.");
  return mode === "n8n" ? new FabricaN8n() : new FabricaSimulada();
}
