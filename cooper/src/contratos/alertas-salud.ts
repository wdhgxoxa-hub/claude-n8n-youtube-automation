import { z } from "./validacion";
import { umbralesSaludSchema, type SaludOperativa } from "./salud-operativa";

export const configurarAlertasSchema = z
  .object({
    revision: z.string().min(1).max(80),
    telegramActivo: z.boolean(),
    recordatorioMinutos: z.number().int().min(15).max(10080),
    umbrales: umbralesSaludSchema,
    confirmado: z.literal(true),
  })
  .strict();
export type ConfiguracionSalud = Omit<
  z.infer<typeof configurarAlertasSchema>,
  "confirmado"
>;
export interface TelegramSalud {
  configurado: boolean;
  activo: boolean;
  ultimaEvaluacion: string | null;
  ultimoEnvio: string | null;
  entrega: "sin_envios" | "enviado" | "fallido" | "incierto";
  pendientes: number;
}
export interface PanelSalud {
  salud: SaludOperativa;
  configuracion: ConfiguracionSalud;
  telegram: TelegramSalud;
}
