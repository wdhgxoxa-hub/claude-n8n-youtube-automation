import { setTimeout as esperar } from "node:timers/promises";
import { resumenSchema } from "./memoria-tipos";
import type {
  EntradaModelo,
  EventoProveedor,
  LlamadaChat,
  ProveedorChat,
} from "./tipos";
export class ChatSimulado implements ProveedorChat {
  // Un guion permite evaluar el servidor con llamadas incluso hostiles sin red.
  constructor(
    private guion?: (entrada: EntradaModelo) => string | LlamadaChat[],
  ) {}
  async *generar(
    e: EntradaModelo,
    signal: AbortSignal,
  ): AsyncGenerator<EventoProveedor> {
    signal.throwIfAborted();
    const ultimo = e.mensajes.at(-1)!;
    let salida: string | LlamadaChat[];
    if (this.guion) salida = this.guion(e);
    else if (ultimo.resultados)
      salida = ultimo.resultados.map((r) => r.texto).join("\n");
    else {
      const texto = ultimo.texto;
      const clean = texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const despues = texto.includes(":")
        ? texto.slice(texto.indexOf(":") + 1).trim()
        : texto;
      // Simula la recuperación de contexto, sin presentar una idea como acción ejecutada.
      const recordar =
        /(?:video que (?:estabamos|estamos) pensando|donde lo dejamos|que (?:recuerdas|prefiero)|retomemos esta idea)/.test(
          clean,
        );
      if (recordar) {
        const contexto = JSON.parse(
          e.mensajes[0].texto.slice(e.mensajes[0].texto.indexOf("{")),
        ) as { memoria?: { resumen: unknown }[] };
        const recuerdos = (contexto.memoria ?? []).map((r) =>
          resumenSchema.parse(r.resumen),
        );
        const ideas = recuerdos.flatMap((r) => r.videos);
        const preferencias = recuerdos.flatMap((r) => r.preferencias);
        salida =
          /prefiero/.test(clean) && preferencias.length
            ? preferencias.join(" ")
            : ideas.length === 1
              ? `Estábamos pensando en «${ideas[0].titulo}». Sigue como idea; podemos retomarla.`
              : ideas.length > 1
                ? `Tenemos varias ideas: ${ideas.map((v) => `«${v.titulo}»`).join(", ")}. ¿Cuál retomamos?`
                : "No tengo una idea guardada para este canal. Cuéntame cuál quieres retomar.";
      } else {
        const cambiaNoticias =
          /\b(?:activa|activar|desactiva|desactivar)\b.*modo noticia/.test(
            clean,
          );
        const patrones: [RegExp, string][] = [
          [
            /\b(?:activa|activar|desactiva|desactivar)\b.*modo noticia/,
            "ajustar_biblia",
          ],
          [/(?:crea|crear|abre|nuevo)\s+(?:un\s+)?canal/, "nuevo_canal"],
          [/(crea|nuevo|quiero|haz|pedir|pide).*video/, "nuevo_video"],
          [/corrige|corregir|cambia|pedir cambios/, "corregir"],
          [/aprueba.*final|aprobar.*final/, "aprobar_final"],
          [/aprueba|aprobar/, "aprobar_guion"],
          [/biblia/, "ajustar_biblia"],
          [/programa/, "programar"],
          [/referencia/, "referencias"],
          [/redes|conecta/, "configurar_redes"],
          [/meta|objetivo/, "metas"],
          [/adopta|cuenta/, "adoptar_cuenta"],
          [/elimina|borra/, "eliminar"],
          [/pendiente/, "pendientes"],
          [/tendencia/, "tendencias"],
          [/reporte/, "reporte"],
          [/estado/, "estado"],
          [/gasto|costo|precio/, "gastos"],
        ];
        const nombre = patrones.find(([p]) => p.test(clean))?.[1];
        const consulta = [
          "estado",
          "reporte",
          "pendientes",
          "tendencias",
          "gastos",
        ].includes(nombre ?? "");
        salida =
          nombre && e.herramientas.some((h) => h.nombre === nombre)
            ? [
                {
                  id: "simulada-1",
                  nombre,
                  argumentos: consulta
                    ? {}
                    : nombre === "eliminar"
                      ? { tipo: /canal/.test(clean) ? "canal" : "video" }
                      : nombre.startsWith("aprobar_")
                        ? {}
                        : {
                            texto: despues,
                            ...(cambiaNoticias
                              ? {
                                  parametros: {
                                    campo: "modo_noticia",
                                    valor: !/\bdesactiva(?:r)?\b/.test(clean),
                                  },
                                }
                              : nombre === "nuevo_video" &&
                                  /\bnoticia\b/.test(clean)
                                ? { parametros: { modo_noticia: true } }
                                : {}),
                          },
                },
              ]
            : /avatar|foto/.test(clean)
              ? "Puedo usar tus fotos como referencia. Para crear tu avatar, abre Avatares y voces y completa la verificación de identidad y el consentimiento."
              : "Puedo ayudarte con tus canales y videos: crearlos, revisarlos y consultar su avance. Ese pedido está fuera de mi alcance o requiere la sección Administración.";
      }
    }
    if (typeof salida === "string") {
      for (const texto of (salida + "\n").match(/.{1,60}(?:\s|$)|.{1,60}/gs) ??
        []) {
        signal.throwIfAborted();
        yield { tipo: "texto", texto };
        // Demo/E2E entregan fragmentos observables; unitarias no esperan reloj real.
        if (process.env.NODE_ENV !== "test")
          await esperar(120, undefined, { signal });
      }
      yield {
        tipo: "fin",
        mensaje: { role: "assistant", texto: salida, llamadas: [] },
      };
    } else
      yield {
        tipo: "fin",
        mensaje: { role: "assistant", texto: "", llamadas: salida },
      };
  }
}
