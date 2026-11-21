import { z } from "./validacion";
import { observabilidadSchema, leccionSchema } from "./observabilidad";
import contrato from "./cooper-v1.json";
export { contrato };
export type EventoPuente = keyof typeof contrato.eventos;
export type ConsultaPuente =
  | "estado"
  | "reporte"
  | "pendientes"
  | "tendencias"
  | "gastos"
  | "operacion"
  | "ajustes";
const id = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[^\r\n]+$/);
const email = z.email().max(254).toLowerCase();
export const solicitudSchema = z
  .object({
    version: z.literal("cooper-v1"),
    id_evento: z.uuid(),
    evento: z.enum([...Object.keys(contrato.eventos), ...contrato.consultas]),
    dueno_email: email,
    admin: z.boolean(),
    datos: z.record(z.string(), z.unknown()),
  })
  .strict();
export type SolicitudPuente = z.infer<typeof solicitudSchema>;
export const aceptadoSchema = z.object({ aceptado: z.literal(true) });
export const videoRemotoSchema = z.object({
  id,
  dueno_email: email,
  canal_id: id,
  titulo: z.string().max(500),
  observabilidad: observabilidadSchema.optional(),
  stage: z.number().int().min(0).max(11),
  script: z.string().max(30000),
  actualizado_en: z.number().int().nonnegative(),
  modo_noticia: z.boolean().optional(),
});
export const estadoRemotoSchema = z.object({
  canales: z.array(
    z.object({
      id,
      dueno_email: email,
      nombre: z.string(),
      lecciones: z.array(leccionSchema).max(100).optional(),
      nicho: z.string(),
      modo_noticia: z.boolean().optional(),
    }),
  ),
  videos: z.array(videoRemotoSchema),
});
export const gastosSchema = z.object({
  gastos: z.array(
    z.object({
      dueno_email: email,
      dia: z.number().nonnegative(),
      semana: z.number().nonnegative(),
      mes: z.number().nonnegative(),
    }),
  ),
  estimados: z.boolean(),
});
export const consultaSchema = z.object({ resumen: z.string().max(30000) });
const medioPresentacion = z
  .object({
    recurso_id: id,
    proveedor: z.enum(["heygen", "elevenlabs", "gemini", "simulada"]),
    id,
    tipo: z.enum(["propio", "catalogo"]),
  })
  .strict();
export const presentacionSchema = z
  .object({
    version: z.literal(1),
    presencia: z.enum(["completo", "partes"]),
    avatar: medioPresentacion.nullable(),
    voz: medioPresentacion.nullable(),
  })
  .strict();
export const comprobacionPresentacionSchema = z
  .object({
    version: z.literal("cooper-v1"),
    tipo: z.literal("presentacion"),
    orden_id: z.uuid(),
    video_id: id,
    dueno_email: email,
    presentacion: presentacionSchema,
    bloqueo: z
      .enum([
        "",
        "avatar_apagado",
        "voz_apagada",
        "presupuesto",
        "produccion_pausada",
      ])
      .default(""),
  })
  .strict();
export const webhookSchema = z.discriminatedUnion("tipo", [
  comprobacionPresentacionSchema,
  z
    .object({
      version: z.literal("cooper-v1"),
      tipo: z.literal("progreso"),
      id_evento: id,
      video: videoRemotoSchema,
    })
    .strict(),
  z
    .object({
      version: z.literal("cooper-v1"),
      tipo: z.literal("orden"),
      id_evento: z.uuid(),
      ejecucion: id,
      fase: z.enum(["consultar", "reservar", "confirmar"]),
      solicitud: solicitudSchema,
    })
    .strict(),
]);
export type WebhookPuente = z.infer<typeof webhookSchema>;
