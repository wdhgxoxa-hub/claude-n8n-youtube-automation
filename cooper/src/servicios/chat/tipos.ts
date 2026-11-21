export type LlamadaChat = { id: string; nombre: string; argumentos: unknown };
export type MensajeModelo = {
  role: "user" | "assistant";
  texto: string;
  imagenes?: { mime: string; data: string }[];
  llamadas?: LlamadaChat[];
  resultados?: { id: string; texto: string; error?: boolean }[];
  nativo?: {
    proveedor: "claude" | "openai";
    bloques: Record<string, unknown>[];
  };
};
export type HerramientaChat = {
  nombre: string;
  descripcion: string;
  parametros: Record<string, unknown>;
};
export type EntradaModelo = {
  sistema: string;
  mensajes: MensajeModelo[];
  herramientas: HerramientaChat[];
};
export type EventoProveedor =
  { tipo: "texto"; texto: string } | { tipo: "fin"; mensaje: MensajeModelo };
export interface ProveedorChat {
  generar(
    entrada: EntradaModelo,
    signal: AbortSignal,
  ): AsyncGenerator<EventoProveedor>;
}
export type TarjetaChat = {
  id: string;
  titulo: string;
  detalle: string;
  estado: string;
  vence: number;
};
export type EventoChat =
  | { tipo: "texto"; texto: string }
  | { tipo: "tarjeta"; tarjeta: TarjetaChat }
  | { tipo: "fin" }
  | { tipo: "error"; texto: string };
