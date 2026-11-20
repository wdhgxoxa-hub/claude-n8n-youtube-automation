import { z } from "zod";
import { ETAPAS, esperaAprobacion } from "@/lib/etapas";
import type { User } from "@/db/schema";
import { canalesPropios, videosPropios, type Orden } from "./fabrica";
export const CONSULTAS = [
  "estado",
  "reporte",
  "pendientes",
  "tendencias",
] as const;
export const chatSchema = z.object({
  texto: z.string().trim().min(1).max(6000),
  adjuntos: z.array(z.string().uuid()).max(5).default([]),
  canalId: z.string().optional(),
  videoId: z.string().optional(),
});
export type PeticionChat = z.infer<typeof chatSchema>;
export interface ProveedorChat {
  responder(
    user: User,
    input: PeticionChat,
  ): Promise<{ texto: string; orden?: Orden }>;
}
export class ChatSimulado implements ProveedorChat {
  async responder(user: User, input: PeticionChat) {
    const text = input.texto.trim();
    const clean = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const channels = canalesPropios(user),
      videos = videosPropios(user);
    const channel = channels.find((c) => c.id === input.canalId) || channels[0];
    const video = videos.find((v) => v.id === input.videoId) || videos[0];
    const after = text.includes(":")
      ? text.slice(text.indexOf(":") + 1).trim()
      : text;
    let evento: Orden["evento"] | undefined;
    if (/(?:crea|crear|abre|nuevo)\s+(?:un\s+)?canal/.test(clean))
      evento = "nuevo_canal";
    else if (/(crea|nuevo|quiero|haz|pedir|pide).*video/.test(clean))
      evento = "nuevo_video";
    else if (/corrige|corregir|cambia|pedir cambios/.test(clean))
      evento = "corregir";
    else if (/biblia/.test(clean)) evento = "ajustar_biblia";
    else if (/programa/.test(clean)) evento = "programar";
    else if (/referencia/.test(clean)) evento = "referencias";
    else if (/redes|conecta/.test(clean)) evento = "configurar_redes";
    else if (/meta|objetivo/.test(clean)) evento = "metas";
    else if (/adopta|cuenta/.test(clean)) evento = "adoptar_cuenta";
    if (evento) {
      const isVideo = ["corregir", "programar", "referencias"].includes(evento);
      const recursoId = isVideo
        ? (input.videoId ?? video?.id)
        : (input.canalId ?? channel?.id);
      if (evento !== "nuevo_canal" && !recursoId)
        return {
          texto: isVideo
            ? "Primero pide un video para tu canal."
            : "Primero crea un canal. Por ejemplo: «Crea un canal: Ciencia cotidiana».",
        };
      return {
        texto: "",
        orden: { evento, recursoId, texto: after, nombre: after.slice(0, 80) },
      };
    }
    if (/pendiente/.test(clean))
      return {
        texto:
          videos
            .filter((v) => esperaAprobacion(v.stage))
            .map((v) => `«${v.title}»: ${ETAPAS[v.stage]}.`)
            .join("\n") || "No tienes aprobaciones pendientes.",
      };
    if (/estado|reporte/.test(clean))
      return {
        texto: videos.length
          ? `${videos.length} videos en tu espacio.\n` +
            videos.map((v) => `«${v.title}»: ${ETAPAS[v.stage]}.`).join("\n")
          : "Todavía no tienes videos. Crea un canal y cuéntame tu primera idea.",
      };
    if (/tendencia/.test(clean))
      return {
        texto:
          "Radar de ejemplo: explicaciones en un minuto, mitos del nicho y preguntas de la comunidad. Son ideas simuladas; todavía no consulto tendencias en tiempo real.",
      };
    return {
      texto:
        "Puedo crear canales y videos, corregir guiones, ajustar la biblia, programar publicaciones, guardar referencias, configurar redes, definir metas y adoptar cuentas. También puedes preguntarme por el estado, el reporte, los pendientes o las tendencias. Escribe, por ejemplo: «Crea un canal: Ciencia cotidiana».",
    };
  }
}
export const proveedorChat: ProveedorChat = new ChatSimulado();
