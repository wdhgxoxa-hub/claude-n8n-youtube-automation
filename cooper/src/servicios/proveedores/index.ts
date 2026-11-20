import { ErrorHttp } from "@/lib/permisos";
import { AvatarHeyGen, VozHeyGen } from "./heygen";
import { VozGemini, TranscripcionGemini } from "./gemini";
import { VozElevenLabs } from "./elevenlabs";
import {
  AvatarSimulado,
  VozSimulada,
  TranscripcionSimulada,
} from "./simulados";
import type {
  ProveedorAvatar,
  ProveedorVoz,
  ProveedorTranscripcion,
  Transporte,
} from "./tipos";
export type {
  ProveedorAvatar,
  ProveedorVoz,
  ProveedorTranscripcion,
} from "./tipos";
function invalido(): never {
  throw new ErrorHttp(
    503,
    "Configuración de medios inválida. Contacta con Walter.",
  );
}
export function proveedorAvatar(
  nombre = process.env.COOPER_AVATAR ?? "simulada",
  transporte?: Transporte,
): ProveedorAvatar {
  if (nombre === "simulada") return new AvatarSimulado();
  if (nombre === "heygen") return new AvatarHeyGen(transporte);
  return invalido();
}
export function proveedorVoz(
  nombre?: string,
  transporte?: Transporte,
): ProveedorVoz {
  if (nombre === undefined) {
    nombre = process.env.COOPER_VOZ_CLONADA ?? "simulada";
    if (!["simulada", "heygen", "elevenlabs"].includes(nombre))
      return invalido();
  }
  if (nombre === "simulada") return new VozSimulada();
  if (nombre === "heygen") return new VozHeyGen(transporte);
  if (nombre === "gemini") return new VozGemini(transporte);
  if (nombre === "elevenlabs") return new VozElevenLabs(transporte);
  return invalido();
}
export function proveedorCatalogoVoz() {
  const mode = process.env.COOPER_VOZ_CATALOGO ?? "simulada";
  if (!["simulada", "gemini"].includes(mode)) return invalido();
  return proveedorVoz(mode);
}
export function proveedorTranscripcion(
  transporte?: Transporte,
): ProveedorTranscripcion {
  const mode = process.env.COOPER_TRANSCRIPCION ?? "simulada";
  if (mode === "simulada") return new TranscripcionSimulada();
  if (mode === "gemini") return new TranscripcionGemini(transporte);
  return invalido();
}
