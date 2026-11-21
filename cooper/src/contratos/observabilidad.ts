import { z } from "./validacion";
// Solo recursos HTTPS; nunca HTML, credenciales de URL ni esquemas ejecutables.
export const urlMedio = z
  .string()
  .max(4096)
  .refine((value) => {
    if (!value) return true;
    try {
      const u = new URL(value);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "URL de medio inválida");
const fecha = z.iso.datetime({ offset: true });
const contador = z.number().finite().nonnegative().nullable();
export const medicionSchema = z.object({
  curvaFuente: z.enum(["youtube_intervalos", "post_segundos"]).optional(),
  curvaRetencion: z
    .array(
      z.object({
        segundo: z.number().nonnegative(),
        porcentaje: z.number().finite().nonnegative(),
      }),
    )
    .max(600)
    .optional(),
  fecha,
  vistas: contador,
  meGusta: contador,
  comentarios: contador,
  // El porcentaje medio visto puede superar el 100 % por repeticiones.
  retencion: contador,
  seguidoresGanados: contador.optional(),
  ventana: z.enum(["24h", "72h", "7d"]).nullable().optional(),
  demoraHoras: contador.optional(),
});
export const publicacionSchema = z.object({
  id: z.string().max(300),
  red: z.string().max(40),
  url: urlMedio,
  fecha: fecha.nullable(),
  miniatura: urlMedio,
  historial: z.array(medicionSchema).max(90),
});
export const incidenciaSchema = z.object({
  id: z.string().max(300),
  tipo: z.enum([
    "ejecucion",
    "critico",
    "verificador",
    "correccion",
    "calidad",
  ]),
  resumen: z.string().max(2000),
  fecha,
  estado: z.enum(["pendiente", "corregido"]),
  corregidoEn: fecha.nullable(),
  cambio: z.string().max(2000),
});
export const leccionSchema = z.object({
  causa: z.string().max(2000).optional(),
  correccion: z.string().max(2000).optional(),
  nivel: z.enum(["hipotesis", "patron"]).optional(),
  origenes: z
    .array(
      z.object({
        videoId: z.string().max(300),
        red: z.string().max(40),
        ventana: z.enum(["24h", "72h", "7d"]),
        fecha,
        metrica: z.enum([
          "vistas",
          "meGusta",
          "comentarios",
          "retencion",
          "seguidoresGanados",
        ]),
        valor: z.number().finite().nonnegative(),
        segundo: z.number().finite().nonnegative().optional(),
        demoraHoras: z.number().nonnegative(),
      }),
    )
    .max(20)
    .optional(),
  aplicaciones: z
    .array(
      z.object({ videoId: z.string().max(300), cambio: z.string().max(1500) }),
    )
    .max(20)
    .optional(),
  id: z.string().max(300),
  fecha,
  resumen: z.string().max(3000),
  ganchos: z.array(z.string().max(500)).max(20),
  temas: z.array(z.string().max(500)).max(20),
});
export const observabilidadSchema = z.object({
  montaje: urlMedio,
  miniatura: urlMedio,
  escenas: z
    .array(
      z.object({
        id: z.string().max(160),
        orden: z.number().int().nonnegative(),
        imagen: urlMedio,
        clip: urlMedio,
        voz: urlMedio,
      }),
    )
    .max(200),
  publicaciones: z.array(publicacionSchema).max(100),
  incidencias: z.array(incidenciaSchema).max(200),
});
export type Observabilidad = z.infer<typeof observabilidadSchema>;
export type Publicacion = z.infer<typeof publicacionSchema>;
export type Medicion = z.infer<typeof medicionSchema>;
export type Leccion = z.infer<typeof leccionSchema>;
export const sinObservabilidad: Observabilidad = {
  montaje: "",
  miniatura: "",
  escenas: [],
  publicaciones: [],
  incidencias: [],
};
export function leerObservabilidad(raw: string): Observabilidad {
  try {
    return observabilidadSchema.parse(JSON.parse(raw));
  } catch {
    return sinObservabilidad;
  }
}
export function leerLecciones(raw: string): Leccion[] {
  try {
    return z.array(leccionSchema).max(100).parse(JSON.parse(raw));
  } catch {
    return [];
  }
}
export function enlaceIncrustado(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const host = u.hostname.replace(/^www\./, "");
    if (["youtube.com", "youtu.be"].includes(host)) {
      const id =
        host === "youtu.be"
          ? u.pathname.slice(1)
          : u.searchParams.get("v") ||
            u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1];
      return id && /^[\w-]{11}$/.test(id)
        ? `https://www.youtube.com/embed/${id}`
        : null;
    }
    const id =
      host === "tiktok.com" &&
      u.pathname.match(/^\/@[^/]+\/video\/(\d+)$/)?.[1];
    return id ? `https://www.tiktok.com/player/v1/${id}?autoplay=0` : null;
  } catch {
    return null;
  }
}
