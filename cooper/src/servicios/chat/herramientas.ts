import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { channels, videos, expenses, type User } from "@/db/schema";
import { contrato } from "@/contratos/puente";
import { ErrorHttp, requireOwn, requireAdmin } from "@/lib/permisos";
import { ETAPAS, esperaAprobacion } from "@/lib/etapas";
import {
  fabrica,
  FabricaN8n,
  ordenSchema,
  validarOrden,
  videosPropios,
} from "../fabrica";
import { catalogo, activoVisible, medioDisponible } from "../biblioteca";
import type { HerramientaChat, LlamadaChat } from "./tipos";
const id = z.string().min(1).max(100);
const base = z.object({ recursoId: id.optional() }).strict();
const datos = base.extend({
  texto: z.string().trim().min(1).max(6000),
  nombre: z.string().trim().min(1).max(120).optional(),
});
const schemas = {
  nuevo_canal: z
    .object({ texto: datos.shape.texto, nombre: datos.shape.nombre })
    .strict(),
  nuevo_video: datos.extend({
    avatarId: id.optional(),
    voiceId: id.optional(),
    avatarPlacement: z.enum(["completo", "partes"]).optional(),
  }),
  corregir: datos,
  ajustar_biblia: datos,
  programar: datos,
  referencias: datos,
  configurar_redes: datos,
  metas: datos,
  adoptar_cuenta: datos,
  aprobar_guion: base,
  aprobar_final: base,
  eliminar: base.extend({ tipo: z.enum(["canal", "video"]) }),
  estado: z.object({}).strict(),
  reporte: z.object({}).strict(),
  pendientes: z.object({}).strict(),
  tendencias: z.object({}).strict(),
  gastos: z.object({}).strict(),
};
export type NombreHerramienta = keyof typeof schemas;
export const titulos: Record<NombreHerramienta, string> = {
  nuevo_canal: "Crear canal",
  nuevo_video: "Producir video",
  corregir: "Solicitar cambios",
  ajustar_biblia: "Ajustar guía del canal",
  programar: "Programar publicación",
  referencias: "Guardar referencias",
  configurar_redes: "Configurar redes",
  metas: "Definir metas",
  adoptar_cuenta: "Adoptar cuenta",
  aprobar_guion: "Aprobar guion y continuar producción",
  aprobar_final: "Aprobar video para publicar",
  eliminar: "Eliminar recurso",
  estado: "Consultar estado",
  reporte: "Consultar reporte",
  pendientes: "Consultar pendientes",
  tendencias: "Consultar tendencias",
  gastos: "Consultar gasto propio",
};
export function herramientas(user: User): HerramientaChat[] {
  return [...Object.keys(contrato.eventos), ...contrato.consultas]
    .filter((n) => n !== "gastos" || user.role === "admin")
    .map((n) => {
      const nombre = n as NombreHerramienta;
      return {
        nombre,
        descripcion: `${titulos[nombre]}. Solo recursos propios. ${nombre in contrato.eventos ? "Prepara una tarjeta; no ejecuta hasta que el dueño pulse Confirmar. recursoId es el ID local del contexto. Si falta usa el recurso activo; pide aclaración ante ambigüedad. programar requiere texto ISO 8601 con zona horaria. Nunca inventes IDs." : "Consulta datos actuales del dueño."}`,
        parametros: z.toJSONSchema(schemas[nombre]),
      };
    });
}
export function esConsulta(nombre: string) {
  return (contrato.consultas as string[]).includes(nombre);
}
export type ContextoActivo = { canalId: string; videoId: string };
export function prepararLlamada(
  user: User,
  llamada: LlamadaChat,
  activo: ContextoActivo,
) {
  if (!Object.hasOwn(schemas, llamada.nombre))
    throw new ErrorHttp(400, "Esa acción está fuera de mi alcance.");
  const nombre = llamada.nombre as NombreHerramienta;
  if (nombre === "gastos") requireAdmin(user);
  const argumentos = schemas[nombre].parse(llamada.argumentos) as Record<
    string,
    string
  >;
  if (esConsulta(nombre))
    return { nombre, argumentos, huella: "", detalle: titulos[nombre] };
  const isVideo =
    [
      "corregir",
      "programar",
      "referencias",
      "aprobar_guion",
      "aprobar_final",
    ].includes(nombre) ||
    (nombre === "eliminar" && argumentos.tipo === "video");
  const recursoId =
    argumentos.recursoId ?? (isVideo ? activo.videoId : activo.canalId);
  let recurso:
    typeof videos.$inferSelect | typeof channels.$inferSelect | undefined;
  if (nombre !== "nuevo_canal") {
    if (!recursoId)
      throw new ErrorHttp(
        400,
        isVideo
          ? "Elige un video de tu canal antes de continuar."
          : "Primero crea o elige un canal.",
      );
    recurso = isVideo
      ? db().select().from(videos).where(eq(videos.id, recursoId)).get()
      : db().select().from(channels).where(eq(channels.id, recursoId)).get();
    requireOwn(user, recurso);
    argumentos.recursoId = recursoId;
    if (
      isVideo &&
      activo.canalId &&
      recurso &&
      "channelId" in recurso &&
      recurso.channelId !== activo.canalId
    )
      throw new ErrorHttp(
        400,
        "Ese video no pertenece al canal activo. Selecciona su canal.",
      );
    if (
      nombre.startsWith("aprobar_") &&
      recurso &&
      "stage" in recurso &&
      (recurso.productionState !== "activa" ||
        recurso.stage !== (nombre === "aprobar_guion" ? 3 : 9))
    )
      throw new ErrorHttp(
        409,
        "La revisión cambió o no necesita esa aprobación. Revisa el video.",
      );
  }
  if (!nombre.startsWith("aprobar_") && nombre !== "eliminar")
    validarOrden(user, ordenSchema.parse({ evento: nombre, ...argumentos }));
  const medios =
    nombre === "nuevo_video"
      ? (
          [
            ["avatarId", "avatar"],
            ["voiceId", "voz"],
          ] as const
        )
          .filter(([campo]) => argumentos[campo])
          .map(([campo, tipo]) => {
            const ref = medioDisponible(user, argumentos[campo], tipo);
            const item = catalogo().find((m) => m.id === argumentos[campo]);
            return {
              tipo,
              nombre: item?.name ?? activoVisible(user, argumentos[campo]).name,
              ref,
            };
          })
      : [];
  const dependientes =
    nombre === "eliminar" && argumentos.tipo === "canal"
      ? videosPropios(user).filter((v) => v.channelId === recursoId)
      : [];
  const huella = createHash("sha256")
    .update(JSON.stringify({ recurso: recurso ?? null, medios, dependientes }))
    .digest("hex");
  const etiqueta = recurso
    ? "title" in recurso
      ? recurso.title
      : recurso.name
    : (argumentos.nombre ?? argumentos.texto);
  return {
    nombre,
    argumentos,
    huella,
    detalle: `${etiqueta}${nombre === "eliminar" && argumentos.tipo === "canal" ? `\nTambién se eliminarán ${dependientes.length} videos de este canal.` : ""}${argumentos.texto && recurso ? `\n${argumentos.texto}` : ""}${medios.length ? `\n${medios.map((m) => `${m.tipo === "avatar" ? "Presentador" : "Voz"}: ${m.nombre}`).join("\n")}\nPresencia: ${argumentos.avatarPlacement === "completo" ? "todo el video" : "solo en partes"}` : ""}`,
  };
}
export async function consultar(
  user: User,
  nombre: NombreHerramienta,
  activo: ContextoActivo,
) {
  if (!esConsulta(nombre)) throw new ErrorHttp(400, "Acción no disponible.");
  const actor = { ...user, role: "usuario" as const };
  if (nombre === "gastos") {
    requireAdmin(user);
    // Nunca se incorporan importes del equipo al contexto del chat.
    if (
      process.env.COOPER_DEMO !== "1" &&
      process.env.COOPER_FABRICA === "n8n"
    ) {
      return "Consulta el gasto actualizado en Administración.";
    }
    const total = db()
      .select()
      .from(expenses)
      .where(eq(expenses.ownerId, user.id))
      .all()
      .reduce((n, r) => n + r.amount, 0);
    return `Gasto propio registrado: ${total.toFixed(2)} USD (simulado).`;
  }
  if (process.env.COOPER_DEMO !== "1" && process.env.COOPER_FABRICA === "n8n") {
    const f = new FabricaN8n();
    if (nombre === "tendencias") return f.consultar(actor, nombre);
    await f.consultar(actor, nombre as "estado" | "reporte" | "pendientes");
    await f.sincronizar(actor);
  }
  if (nombre === "tendencias")
    return "Radar de ejemplo: mitos del nicho y preguntas de la comunidad. Ideas simuladas, sin consulta en tiempo real.";
  const items = videosPropios(user).filter(
    (v) =>
      (!activo.canalId || v.channelId === activo.canalId) &&
      (nombre !== "pendientes" || esperaAprobacion(v.stage)),
  );
  return (
    items.map((v) => `«${v.title}»: ${ETAPAS[v.stage]}.`).join("\n") ||
    (nombre === "pendientes"
      ? "No tienes aprobaciones pendientes."
      : "Todavía no tienes videos en este canal.")
  );
}
export async function ejecutar(
  user: User,
  accion: ReturnType<typeof prepararLlamada>,
) {
  const actor = { ...user, role: "usuario" as const },
    f = fabrica();
  if (accion.nombre.startsWith("aprobar_")) {
    await f.aprobar(actor, accion.argumentos.recursoId);
    return "Aprobación enviada. Verás el avance en tu espacio.";
  }
  if (accion.nombre === "eliminar") {
    await f.eliminar(
      actor,
      accion.argumentos.recursoId,
      accion.argumentos.tipo as "canal" | "video",
    );
    return "El recurso se eliminó de tu espacio.";
  }
  const result = await f.ejecutar(
    actor,
    ordenSchema.parse({ evento: accion.nombre, ...accion.argumentos }),
  );
  return result.mensaje;
}
export function videoActivo(user: User, canalId: string, videoId?: string) {
  if (videoId) {
    const v = db().select().from(videos).where(eq(videos.id, videoId)).get();
    requireOwn(user, v);
    if (canalId && v?.channelId !== canalId)
      throw new ErrorHttp(400, "Selecciona el canal de ese video.");
    return videoId;
  }
  const items = db()
    .select()
    .from(videos)
    .where(and(eq(videos.ownerId, user.id), eq(videos.channelId, canalId)))
    .all();
  return items.length === 1 ? items[0].id : "";
}
