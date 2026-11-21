import { z } from "zod";
export const redes = ["instagram", "facebook", "tiktok", "youtube"] as const;
export const rubros = ["iglesia-reformada", "moda", "general"] as const;
export const formatos = ["imagen", "carrusel", "reel", "historia"] as const;
export const guiaSchema = z.object({
  colores: z
    .array(z.string().regex(/^#[a-f\d]{6}$/i))
    .min(2)
    .max(5)
    .default(["#142c3b", "#f0eee7"]),
  tipografia: z.enum(["sans", "serif"]).default("serif"),
  logoId: z.string().max(100).default(""),
  tono: z.string().trim().min(3).max(500).default("Cercano, cuidadoso y claro"),
  versionBiblia: z.string().trim().min(2).max(30).default("RVR1960"),
});
export const marcaSchema = z
  .object({
    nombre: z.string().trim().min(2).max(100),
    rubro: z.enum(rubros),
    ownerId: z.string().max(100).optional(),
    zona: z
      .string()
      .default("America/Lima")
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("es", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Zona horaria inválida"),
    guia: guiaSchema.default(() => guiaSchema.parse({})),
  })
  .strict();
export const cuentaSchema = z
  .object({
    red: z.enum(redes),
    alias: z.string().trim().min(2).max(100),
    remoto: z.string().regex(/^[a-zA-Z0-9_@-]{1,100}$/),
    pagina: z
      .string()
      .regex(/^\d{1,40}$/)
      .optional(),
  })
  .strict();
export const citaSchema = z.object({
  referencia: z.string().trim().min(3).max(100),
  texto: z.string().trim().min(2).max(2000),
  version: z.string().min(2).max(30),
});
export const piezaSchema = z
  .object({
    cuentaId: z.string().min(1).max(100),
    formato: z.enum(formatos),
    plantilla: z.enum(["domingo", "grupos", "evento", "coleccion", "libre"]),
    titulo: z.string().trim().min(2).max(100),
    texto: z.string().trim().min(2).max(1800),
    detalle: z.string().trim().max(180).default(""),
    diapositivas: z
      .array(z.string().trim().min(2).max(180))
      .max(20)
      .default([]),
    adjuntos: z.array(z.string().min(1).max(100)).max(20).default([]),
    citas: z.array(citaSchema).max(10).default([]),
    programada: z.string().datetime({ offset: true }).optional(),
    origen: z.enum(["web", "chat", "whatsapp", "fabrica"]).default("web"),
    videoId: z.string().max(100).default(""),
  })
  .strict();
export type Guia = z.infer<typeof guiaSchema>;
export type PiezaDatos = z.infer<typeof piezaSchema>;
export type Red = (typeof redes)[number];
export type Formato = (typeof formatos)[number];
export type Metricas = {
  vistas: number | null;
  interacciones: number | null;
  alcance: number | null;
  capturadas: number;
};
export type Historica = {
  visual?: { color: string; proporcion: number };
  id: string;
  texto: string;
  fecha: string;
  tipo: string;
  imagen: string;
  metricas: Metricas;
};
export type Estudio = {
  muestra: number;
  visuales: number;
  estilo: string;
  frecuencia: number;
  pilares: string[];
  horas: number[];
  evidencia: string;
  actualizado: number;
  historial: Historica[];
};
export type Checkpoint = {
  metricasIntento?: number;
  fase?: string;
  id?: string;
  hijos?: string[];
  envio?: string;
};
export type ResultadoRed = {
  estado: "procesando" | "publicada" | "revision";
  remoto: string;
  checkpoint: Checkpoint;
  aviso?: string;
};
