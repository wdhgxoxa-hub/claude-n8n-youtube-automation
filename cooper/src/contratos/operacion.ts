import { z } from "./validacion";
import { competenciaSchema } from "./competencia-schema";
import catalogo from "./ajustes-fabrica.json";
import campos from "./biblia-campos.json";
export { campos };
export { catalogo };
const texto = z.string().max(6000);
const id = z.string().min(1).max(160);
const fecha = z.string().max(40);
const red = z.enum(["youtube", "tiktok", "instagram", "facebook"]);
export const camposBiblia = Object.fromEntries(
  Object.entries(campos).map(([k, v]) => [k, v.etiqueta]),
) as Record<keyof typeof campos, string>;
export function validarBiblia(campo: keyof typeof campos, valor: string) {
  const tipo = campos[campo].tipo;
  return tipo === "numero"
    ? valor.trim() !== "" &&
        Number.isFinite(Number(valor)) &&
        Number(valor) > 0 &&
        Number(valor) <= 120
    : tipo === "lista"
      ? valor.split("\n").filter((x) => x.trim()).length <= 30
      : true;
}
export const operacionSchema = z.object({
  modo: z.enum(["simulada", "n8n"]),
  actualizado: fecha,
  canales: z.array(
    z.object({
      id,
      nombre: texto,
      estado: texto,
      biblia: z.record(z.string(), texto),
      conexion: z
        .object({ estado: texto, nombre: texto, url: texto })
        .default({ estado: "sin conectar", nombre: "", url: "" }),
      perfil: texto,
      redes: z.array(red),
      zona: texto,
      metas: z.object({
        videos_semana: z.number(),
        formato: z.enum(["short", "largo"]),
        auto: z.boolean(),
        retencion_min: z.number(),
      }),
      cuenta: z.object({ red: texto, handle: texto, diagnostico: texto }),
      radar: z.object({
        competencia: competenciaSchema.optional(),
        fecha,
        resumen: texto,
        ideas: z.array(
          z.object({
            id,
            titulo: texto,
            red: texto,
            gancho: texto,
            motivo: texto,
            fuente: texto,
            url: texto,
            formato: z.enum(["short", "largo"]),
          }),
        ),
        sonidos: z.array(z.object({ nombre: texto, uso: texto, url: texto })),
      }),
      rutina: z.array(
        z.object({
          fecha,
          decision: texto,
          motivo: texto,
          frenos: z.array(texto),
          videoId: texto,
        }),
      ),
      referencias: z.array(
        z.object({
          id,
          nombre: texto,
          tipo: texto,
          descripcion: texto,
          urls: z.array(texto),
        }),
      ),
      especialistas: z.array(
        z.object({
          videoId: id,
          titulo: texto,
          red: texto,
          hora: texto,
          formato: texto,
          sonido: texto,
          recomendacion: texto,
        }),
      ),
    }),
  ),
  decisiones: z.array(
    z.object({
      id,
      canalId: texto,
      videoId: texto,
      etapa: texto,
      resumen: texto,
      detalle: texto,
      fecha,
      opciones: z.array(texto),
      renovable: z.boolean().default(false),
    }),
  ),
  publicaciones: z.array(
    z.object({
      id,
      canalId: texto,
      videoId: texto,
      titulo: texto,
      red: texto,
      estado: texto,
      fecha,
      url: texto,
      detalle: texto,
    }),
  ),
  avisos: z.array(
    z.object({
      id,
      canalId: texto,
      videoId: texto,
      medio: z.enum(["telegram", "whatsapp"]),
      tipo: texto,
      estado: texto,
      fecha,
      resumen: texto,
    }),
  ),
  fallos: z.array(
    z.object({
      id,
      canalId: texto,
      videoId: texto,
      titulo: texto,
      fecha,
      motivo: texto,
      sugerencia: texto,
      reintento: z.enum(["corregir", "consultar", "ninguno"]),
    }),
  ),
});
export type Operacion = z.infer<typeof operacionSchema>;
export const ajustesSchema = z.object({
  revision: texto,
  valores: z.record(z.string(), z.union([z.boolean(), z.number(), texto])),
  historial: z.array(
    z.object({ fecha, actor: texto, cambios: z.array(texto) }),
  ),
});
export type Ajustes = z.infer<typeof ajustesSchema>;
export function validarAjustes(valores: Record<string, unknown>) {
  const fields: Record<
    string,
    { tipo: string; min?: number; max?: number; entero?: boolean }
  > = catalogo;
  if (!Object.keys(valores).length) return false;
  return Object.entries(valores).every(([k, v]) => {
    const f = fields[k];
    if (!f || typeof v !== f.tipo) return false;
    if (typeof v === "number")
      return (
        Number.isFinite(v) &&
        v >= (f.min ?? 0) &&
        v <= (f.max ?? 10000) &&
        (!f.entero || Number.isInteger(v))
      );
    if (typeof v === "string") {
      if (k === "calendario.cortesDias")
        return /^(?:[1-9]|[12][0-9]|30)(?:,(?:[1-9]|[12][0-9]|30)){0,9}$/.test(
          v,
        );
      if (!/^[a-zA-Z0-9_./:-]{1,100}$/.test(v)) return false;
      if (k === "privacidadYoutube")
        return ["public", "private", "unlisted"].includes(v);
      if (k === "calendario.zona") {
        try {
          new Intl.DateTimeFormat("es", { timeZone: v });
        } catch {
          return false;
        }
      }
    }
    return true;
  });
}
const base = { canalId: id, confirmado: z.literal(true) };
export const controlSchema = z.discriminatedUnion("accion", [
  z
    .object({
      ...base,
      accion: z.literal("biblia"),
      campo: z.enum(
        Object.keys(camposBiblia) as [
          keyof typeof camposBiblia,
          ...(keyof typeof camposBiblia)[],
        ],
      ),
      valor: texto,
    })
    .refine((x) => validarBiblia(x.campo, x.valor)),
  z.object({
    ...base,
    accion: z.literal("redes"),
    perfil: z.string().regex(/^[A-Za-z0-9_.-]{2,60}$/),
    redes: z.array(red).min(1).max(4),
    zona: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("es", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
  }),
  z.object({
    ...base,
    accion: z.literal("metas"),
    videos_semana: z.number().int().min(0).max(21),
    formato: z.enum(["short", "largo"]),
    auto: z.boolean(),
    retencion_min: z.number().min(0).max(1),
    gasto_semana_usd: z.number().min(0).max(200).optional(),
  }),
  z.object({ ...base, accion: z.literal("referencias") }),
  z.object({ ...base, accion: z.literal("radar") }),
  z.object({ ...base, accion: z.literal("conectar") }),
  z.object({ accion: z.literal("renovar"), id, confirmado: z.literal(true) }),
  z.object({
    ...base,
    accion: z.literal("referencia"),
    tipo: z.enum(["personajes", "escenarios"]),
    id: z.string().regex(/^[a-z0-9_-]{1,60}$/),
    descripcion: z.string().min(1).max(4000),
    urls: z
      .array(
        z
          .string()
          .url()
          .refine((v) => {
            const u = new URL(v);
            return u.protocol === "https:" && !u.username && !u.password;
          }),
      )
      .max(8),
  }),
  z.object({
    ...base,
    accion: z.literal("adoptar"),
    cuenta: z.string().regex(/^@?[\w.-]{2,60}$/),
    red: z.enum(["youtube", "tiktok", "instagram"]),
  }),
  z.object({ ...base, accion: z.literal("idea"), ideaId: id }),
  z.object({
    accion: z.literal("decidir"),
    id,
    decision: z.enum(["aprobar", "cambios", "detener"]),
    cambios: texto,
    confirmado: z.literal(true),
  }),
  z.object({
    accion: z.literal("reintentar"),
    videoId: id,
    confirmado: z.literal(true),
  }),
  z.object({
    accion: z.literal("ajustes"),
    revision: texto,
    valores: z
      .record(z.string(), z.union([z.boolean(), z.number(), z.string()]))
      .refine(validarAjustes),
    confirmado: z.literal(true),
  }),
]);
export type Control = z.infer<typeof controlSchema>;
