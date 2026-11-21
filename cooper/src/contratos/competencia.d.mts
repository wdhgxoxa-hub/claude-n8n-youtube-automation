import type { Competencia } from "./competencia-schema";
export function diferenciacionCompetencia(nombre: string): string;
export function urlPublicaCompetencia(url: unknown): string;
export function competenciaVacia(nombre: string, motivo?: string): Competencia;
export function normalizarCompetencia(
  raw: unknown,
  respuesta: unknown,
  nombre: string,
  ahora?: number,
): Competencia;
export function competenciaVigente(
  c: Competencia | undefined | null,
  ahora?: number,
): boolean;
export function promptCompetencia(c: {
  nombre: string;
  nicho?: string;
  redes?: string;
}): string;
export function proyectarCompetencia(c: unknown, nombre: string): Competencia;
export function candidatosYouTubeCompetencia(pedido: unknown): string[];
export function normalizarCompetenciaYouTube(
  datos: unknown,
  nombre: string,
  ahora?: number,
): Competencia;
export function combinarCompetenciaYouTube(
  web: Competencia,
  nativa: Competencia,
  nombre: string,
  ahora?: number,
): Competencia;
