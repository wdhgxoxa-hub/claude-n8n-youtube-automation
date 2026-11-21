import { z } from "zod";

const frase = z.string().trim().min(1).max(240);
export const resumenSchema = z
  .object({
    pendientes: z.array(frase).max(8),
    videos: z
      .array(z.object({ titulo: frase, detalle: frase }).strict())
      .max(8),
    decisiones: z.array(frase).max(8),
    preferencias: z.array(frase).max(8),
  })
  .strict();
export type ResumenMemoria = z.infer<typeof resumenSchema>;
export type Recuerdo = {
  canalId: string;
  nombre: string;
  resumen: ResumenMemoria;
  actualizado: number;
};
export const memoriaVacia = (): ResumenMemoria => ({
  pendientes: [],
  videos: [],
  decisiones: [],
  preferencias: [],
});
