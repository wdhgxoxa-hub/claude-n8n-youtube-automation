export type ArchivoMedio = { mime: string; data: string };
export type TrabajoMedio = {
  id: string;
  estado: "entrenando" | "listo" | "error" | "verificacion_proveedor";
  previewUrl?: string;
};
export type AvatarPublico = { id: string; nombre: string; previewUrl: string };
export interface ProveedorAvatar {
  readonly nombre: string;
  readonly simulada: boolean;
  crear(input: {
    nombre: string;
    foto: ArchivoMedio;
    operacionId: string;
  }): Promise<TrabajoMedio>;
  consultar(id: string): Promise<TrabajoMedio>;
  catalogo(): Promise<AvatarPublico[]>;
  eliminar(id: string): Promise<void>;
}
export interface ProveedorVoz {
  readonly nombre: string;
  readonly simulada: boolean;
  clonar(input: {
    nombre: string;
    audio: ArchivoMedio;
    operacionId: string;
  }): Promise<TrabajoMedio>;
  consultar(id: string): Promise<TrabajoMedio>;
  sintetizar(id: string, texto: string): Promise<ArchivoMedio>;
  eliminar(id: string): Promise<void>;
}
export interface ProveedorTranscripcion {
  readonly simulada: boolean;
  transcribir(archivo: ArchivoMedio): Promise<string>;
}
export type Transporte = typeof fetch;
