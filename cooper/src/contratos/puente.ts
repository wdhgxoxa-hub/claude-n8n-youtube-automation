import { z } from "zod";
import contrato from "./cooper-v1.json";
export { contrato };
export type EventoPuente = keyof typeof contrato.eventos;
export type ConsultaPuente =
  "estado" | "reporte" | "pendientes" | "tendencias" | "gastos";
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
  stage: z.number().int().min(0).max(11),
  script: z.string().max(30000),
  actualizado_en: z.number().int().nonnegative(),
});
export const estadoRemotoSchema = z.object({
  canales: z.array(
    z.object({ id, dueno_email: email, nombre: z.string(), nicho: z.string() }),
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
export const webhookSchema = z.discriminatedUnion("tipo", [
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
      fase: z.enum(["reservar", "confirmar"]),
      solicitud: solicitudSchema,
    })
    .strict(),
]);
export type WebhookPuente = z.infer<typeof webhookSchema>;
