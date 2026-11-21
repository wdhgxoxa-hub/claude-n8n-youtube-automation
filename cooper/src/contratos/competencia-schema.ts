import { z } from "./validacion";
const texto = z.string().max(600);
const publicacion = {
  url: texto,
  titulo: texto,
  fecha: texto,
  vistas: z.number().nonnegative(),
  formato: texto,
};
export const competenciaSchema = z.object({
  version: z.literal(1),
  estado: z.enum(["pendiente", "sin_datos", "parcial", "listo"]),
  fecha: texto,
  fuente: z.literal("web_publica"),
  resumen: texto,
  diferenciacion: texto,
  competidores: z
    .array(
      z.object({
        nombre: texto,
        red: texto,
        url: texto,
        pais: texto,
        patron: texto,
        muestras: z.array(z.object(publicacion)).max(15),
        outliers: z
          .array(
            z.object({
              ...publicacion,
              mediana: z.number().positive(),
              muestra: z.number().int().min(3),
              multiplicador: z.number().min(2),
            }),
          )
          .max(3),
      }),
    )
    .max(5),
  homonimos: z
    .array(
      z.object({
        nombre: texto,
        red: texto,
        url: texto,
        pais: texto,
        diferencia: texto,
      }),
    )
    .max(10),
  comprobaciones: z
    .array(z.object({ red: texto, consulta: texto, url: texto }))
    .max(5),
  limitaciones: z.array(texto),
  objetivos: z.array(texto),
});
export type Competencia = z.infer<typeof competenciaSchema>;
