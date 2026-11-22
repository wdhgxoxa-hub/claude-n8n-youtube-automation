// Contrato público: nunca contiene enlaces firmados del proveedor ni rutas locales.
export type OrigenPoster =
  "render" | "miniatura" | "escena" | "youtube" | "tiktok" | "tipografico";

export type VideoMedios = {
  version: 1;
  videoId: string;
  estado: "listo" | "sin_medio" | "pendiente" | "no_disponible";
  poster: {
    url: string;
    origen: OrigenPoster;
    ancho: number;
    alto: number;
  } | null;
  preview: {
    url: string;
    mime: "video/mp4";
    duracion: number;
    bytes: number;
  } | null;
  tinte: string;
  // Dimensiones del video cuando hay MP4; en otro caso, las del póster.
  ancho: number;
  alto: number;
  relacionAspecto: number;
  origenDimensiones: "video" | "poster" | "reserva";
  actualizadoEn: number;
};
