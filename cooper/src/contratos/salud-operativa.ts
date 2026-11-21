import { z } from "./validacion";

export const umbralesSaludSchema = z
  .object({
    discoLibrePorcentaje: z.number().finite().min(1).max(50),
    memoriaUsadaPorcentaje: z.number().finite().min(10).max(100),
    certificadoDias: z.number().int().min(1).max(90),
    copiaLocalHoras: z.number().int().min(1).max(720),
    copiaRemotaHoras: z.number().int().min(1).max(720),
    videoSinAvanceMinutos: z.number().int().min(5).max(10080),
    fallosN8n: z.number().int().min(1).max(500),
    gastoDiarioUsd: z.number().finite().positive().max(100000),
    datosVpsMinutos: z.number().int().min(1).max(1440),
  })
  .strict();
export type UmbralesSalud = z.infer<typeof umbralesSaludSchema>;
export const umbralesSaludPredeterminados: UmbralesSalud = {
  discoLibrePorcentaje: 10,
  memoriaUsadaPorcentaje: 90,
  certificadoDias: 14,
  copiaLocalHoras: 30,
  copiaRemotaHoras: 36,
  videoSinAvanceMinutos: 60,
  fallosN8n: 1,
  gastoDiarioUsd: 25,
  datosVpsMinutos: 15,
};

export type EstadoSalud =
  "ok" | "degradado" | "desconocido" | "sin_configurar" | "error" | "simulada";
export interface FuenteSalud {
  estado: EstadoSalud;
  actualizado: string | null;
  detalle: string;
}
export interface EjecucionSalud {
  id: string;
  workflowId: string;
  workflow: string;
  estado:
    | "correcta"
    | "fallida"
    | "ejecutando"
    | "esperando"
    | "cancelada"
    | "desconocida";
  inicio: string | null;
  fin: string | null;
  causa: string | null;
}
export interface VideoSalud {
  id: string;
  titulo: string;
  etapa: number;
  actualizado: string | null;
  sinAvanceMinutos: number | null;
  estado:
    | "en_curso"
    | "colgado"
    | "aprobacion"
    | "programado"
    | "pausado"
    | "cancelado"
    | "publicado"
    | "desconocido";
}
export interface AlertaSalud {
  codigo: string;
  fuente: "n8n" | "vps" | "fabrica";
  severidad: "aviso" | "critica";
  titulo: string;
  detalle: string;
}
export interface SaludOperativa {
  actualizado: string;
  modo: "simulada" | "n8n";
  n8n: FuenteSalud & {
    ejecuciones: EjecucionSalud[];
    fallosRecientes: EjecucionSalud[];
    workflows: { id: string; nombre: string; activo: boolean }[];
    workflowsActivos: number | null;
    ejecucionesDisponibles: boolean;
    workflowsDisponibles: boolean;
    ejecucionesTruncadas: boolean;
    workflowsTruncados: boolean;
    ventanaDesde: string;
  };
  vps: FuenteSalud & {
    antiguedadMinutos: number | null;
    mantenimiento: boolean;
    disco: {
      totalBytes: number;
      libreBytes: number;
      librePorcentaje: number;
    } | null;
    memoria: {
      totalBytes: number;
      disponibleBytes: number;
      usadaPorcentaje: number;
    } | null;
    certificados: {
      servicio: "cooper" | "n8n";
      vence: string | null;
      diasRestantes: number | null;
    }[];
    copias: {
      tipo: "local" | "remota";
      completada: string | null;
      antiguedadHoras: number | null;
    }[];
    servicios: {
      cooper: "ok" | "down" | "unknown";
      n8n: "ok" | "down" | "unknown";
      runner: "ok" | "down" | "unknown";
      caddy: "ok" | "down" | "unknown";
    };
  };
  fabrica: FuenteSalud & {
    videos: VideoSalud[];
    videosTruncados: boolean;
    enCurso: number | null;
    colgados: number | null;
    aprobaciones: number | null;
    programados: number | null;
    pausados: number | null;
    cancelados: number | null;
    publicados: number | null;
    gastoDiarioUsd: number | null;
    gastoFuente: "simulada" | "n8n" | "n8n_estimado" | "desconocida";
    gastoFecha: string | null;
    gastoZona: "America/Lima";
  };
  alertas: AlertaSalud[];
}
