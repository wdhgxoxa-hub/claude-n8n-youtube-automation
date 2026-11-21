import type { Incidencia, Leccion, Publicacion } from "./observabilidad";
import type { Metricas } from "@/servicios/marcas/tipos";

export type AmbitoResultado = {
  id: string;
  tipo: "video" | "marca";
  nombre: string;
  ownerId: string;
  propietario: string;
};
type Registro = {
  id: string;
  ambitoId: string;
  titulo: string;
  href: string;
  fecha: string | null;
  redes: string[];
  simulada: boolean;
};
export type PublicacionResultado = Registro &
  (
    | { tipo: "video"; publicacion: Publicacion; identidad: string }
    | {
        tipo: "marca";
        metricas: Metricas | null;
        formato: string;
        cuenta: string;
        identidad: string;
      }
  );
export type AprendizajeResultado = Registro &
  (
    | { tipo: "video"; leccion: Leccion }
    | {
        tipo: "marca";
        clase: "resultado" | "estudio";
        resumen: string;
        aviso: string;
        metricas: Metricas | null;
      }
  );
export type IncidenciaResultado = Registro & {
  incidencia: Incidencia;
  tipo: "video";
};
export type Resultados = {
  ambitos: AmbitoResultado[];
  publicaciones: PublicacionResultado[];
  aprendizajes: AprendizajeResultado[];
  incidencias: IncidenciaResultado[];
};
export type FiltroResultados = {
  tipo: string;
  ownerId: string;
  ambitoId: string;
  red: string;
  desde: string;
  hasta: string;
};
export const sinFiltros: FiltroResultados = {
  tipo: "",
  ownerId: "",
  ambitoId: "",
  red: "",
  desde: "",
  hasta: "",
};
export function filtrarResultados<T extends Registro & { tipo: string }>(
  registros: T[],
  ambitos: AmbitoResultado[],
  filtro: FiltroResultados,
): T[] {
  return registros
    .filter((r) => {
      const ambito = ambitos.find((a) => a.id === r.ambitoId);
      const dia = r.fecha
        ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(
            new Date(r.fecha),
          )
        : "";
      return (
        !!ambito &&
        (!filtro.tipo || r.tipo === filtro.tipo) &&
        (!filtro.ownerId || ambito.ownerId === filtro.ownerId) &&
        (!filtro.ambitoId || r.ambitoId === filtro.ambitoId) &&
        (!filtro.red || r.redes.includes(filtro.red)) &&
        (!filtro.desde || (!!dia && dia >= filtro.desde)) &&
        (!filtro.hasta || (!!dia && dia <= filtro.hasta))
      );
    })
    .sort(
      (a, b) =>
        (Date.parse(b.fecha ?? "") || 0) - (Date.parse(a.fecha ?? "") || 0) ||
        a.id.localeCompare(b.id),
    );
}

// Agrupar después de filtrar conserva cada ámbito y cada lectura de origen.
// Una coincidencia de título, video reutilizado o contador nunca prueba identidad.
export function agruparPublicaciones(
  registros: PublicacionResultado[],
  ambitos: AmbitoResultado[],
) {
  const grupos = new Map<string, PublicacionResultado[]>();
  for (const r of registros) {
    const owner = ambitos.find((a) => a.id === r.ambitoId)?.ownerId;
    const clave = JSON.stringify([
      owner,
      r.tipo,
      r.simulada,
      r.redes,
      r.identidad,
    ]);
    const grupo = grupos.get(clave) ?? [];
    if (!grupo.some((p) => p.id === r.id)) grupo.push(r);
    grupos.set(clave, grupo);
  }
  return [...grupos].map(([id, registros]) => ({ id, registros }));
}
