/** M09: observación de propuestas y memoria; jamás despacha ni confirma herramientas. */
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  allowedEmails,
  users,
  channels,
  videos,
  messages,
  chatMemories,
  chatActions,
  type User,
} from "../src/db/schema";
import { prepararEntradaChat } from "../src/servicios/chat";
import { prepararLlamada } from "../src/servicios/chat/herramientas";
import {
  anotarMemoria,
  borrarRecuerdos,
  historialRecordable,
  leerRecuerdos,
  resumirMemoria,
} from "../src/servicios/chat/memoria";
import {
  memoriaVacia,
  resumenSchema,
} from "../src/servicios/chat/memoria-tipos";
import { ErrorHttp } from "../src/lib/permisos";
import type {
  EntradaModelo,
  MensajeModelo,
  ProveedorChat,
} from "../src/servicios/chat/tipos";
import conversaciones from "../tests/fixtures/chat-30.json";

export const limites = {
  llamadas: 40,
  totalMs: 15 * 60_000,
  respuestaMs: 45_000,
  sintesisMs: 12_000,
} as const;
type Estado = "PASS" | "FAIL" | "ERROR" | "NOT_RUN";
type Fase = "respuesta" | "sintesis";
export type Medicion = {
  fase: Fase;
  proveedorMs: number;
  primerEventoMs: number | null;
  estado: "OK" | "ERROR";
  error?: string;
};
export type Resultado = {
  id: number;
  tipo: string;
  texto: string;
  estado: Estado;
  controles: Record<string, boolean>;
  respuesta?: MensajeModelo;
  memoria?: unknown;
  palabras?: number;
  frases?: number;
  brevedad?: "PASS" | "FAIL" | "NA";
  mediciones: Medicion[];
  totalMs: number;
  error?: string;
  dia?: number;
};
export function errorSeguro(error: unknown) {
  if (error instanceof ErrorHttp) return `HTTP_${error.status}`;
  if (
    error instanceof Error &&
    ["TimeoutError", "AbortError"].includes(error.name)
  )
    return "TIEMPO_AGOTADO";
  // No registrar mensajes, stderr, parámetros o cuerpos de errores del proveedor.
  return "SALIDA_O_TRANSPORTE_INVALIDO";
}
export class Observador implements ProveedorChat {
  llamadas = 0;
  ultimaSalida: MensajeModelo | undefined;
  mediciones: Medicion[] = [];
  fase: Fase = "respuesta";
  detenido = "";
  private errores = 0;
  private fin = performance.now() + limites.totalMs;
  constructor(
    private proveedor: ProveedorChat,
    private maximo: number = limites.llamadas,
  ) {
    if (!Number.isInteger(maximo) || maximo < 1 || maximo > limites.llamadas)
      throw new Error("Cuota inválida");
  }
  disponible() {
    if (this.llamadas >= this.maximo) this.detenido ||= "CUOTA_LOCAL";
    if (performance.now() >= this.fin) this.detenido ||= "TIEMPO_TOTAL";
    return !this.detenido;
  }
  async *generar(e: EntradaModelo, signal: AbortSignal) {
    if (!this.disponible()) throw new ErrorHttp(429, "Evaluación detenida");
    this.llamadas++;
    this.ultimaSalida = undefined;
    const inicio = performance.now();
    const medicion: Medicion = {
      fase: this.fase,
      proveedorMs: 0,
      primerEventoMs: null,
      estado: "ERROR",
    };
    this.mediciones.push(medicion);
    const control = AbortSignal.any([
      signal,
      AbortSignal.timeout(
        Math.max(
          1,
          Math.min(
            this.fin - inicio,
            this.fase === "sintesis" ? limites.sintesisMs : limites.respuestaMs,
          ),
        ),
      ),
    ]);
    try {
      let completa = false;
      for await (const evento of this.proveedor.generar(e, control)) {
        control.throwIfAborted();
        medicion.primerEventoMs ??= performance.now() - inicio;
        if (evento.tipo === "fin") {
          completa = true;
          this.ultimaSalida = evento.mensaje;
        }
        yield evento;
      }
      if (!completa) throw new Error("Respuesta incompleta");
      medicion.estado = "OK";
      this.errores = 0;
    } catch (error) {
      medicion.error = errorSeguro(error);
      if (
        ++this.errores >= 3 ||
        (error instanceof ErrorHttp && error.status === 429)
      )
        this.detenido = "PROVEEDOR_NO_DISPONIBLE";
      throw error;
    } finally {
      medicion.proveedorMs = performance.now() - inicio;
    }
  }
}
const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function brevedad(texto: string) {
  const palabras = texto.trim().split(/\s+/u).filter(Boolean).length;
  const frases = [
    ...new Intl.Segmenter("es", { granularity: "sentence" }).segment(
      texto.trim(),
    ),
  ].length;
  return {
    palabras,
    frases,
    brevedad: !palabras
      ? ("NA" as const)
      : palabras <= 40 && frases <= 2
        ? ("PASS" as const)
        : ("FAIL" as const),
  };
}
export function seleccion(
  g: (typeof conversaciones)[number],
  respuesta: MensajeModelo,
) {
  const nombres = (respuesta.llamadas ?? []).map((l) => l.nombre);
  const esperado = g.herramienta || (g.tipo === "audio" ? "nuevo_video" : "");
  const texto = normal(respuesta.texto);
  const controles: Record<string, boolean> = {
    seleccion: esperado
      ? nombres.length === 1 && nombres[0] === esperado
      : nombres.length === 0,
    noAfirmaEjecucion:
      !/\b(?:he (?:creado|publicado|eliminado|programado|aprobado)|ya (?:cree|publique|elimine|programe|aprobe)|(?:video|canal|guion) (?:creado|publicado|eliminado|programado|aprobado))\b/.test(
        texto,
      ),
  };
  if (!esperado) controles.respuestaPresente = !!texto.trim();
  if (g.tipo === "avatar")
    controles.identidadConsentimiento =
      /identidad/.test(texto) && /consentimiento/.test(texto);
  if (g.tipo === "si_ambiguo")
    controles.confirmacionExplicita =
      /confirm|tarjeta|aclar|cual|que .*quier/.test(texto);
  if (g.tipo === "fuera")
    controles.limiteEstudio = /no |estudio|video|canal|alcance/.test(texto);
  return controles;
}
function persona(admin = false) {
  const id = randomUUID(),
    email = `${id}@example.test`;
  db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  return db()
    .insert(users)
    .values({
      id,
      email,
      name: "Persona ficticia M09",
      role: admin ? "admin" : "usuario",
    })
    .returning()
    .get();
}
function canal(user: User, name: string) {
  return db()
    .insert(channels)
    .values({
      id: randomUUID(),
      ownerId: user.id,
      name,
      niche: "Divulgación ficticia",
      createdAt: Date.now(),
    })
    .returning()
    .get();
}
function escenario(admin = false, stage = 3) {
  const user = persona(admin),
    otro = persona();
  const propio = canal(user, "Ciencia"),
    secundario = canal(user, "Botánica"),
    ajeno = canal(otro, "Canal de otra persona");
  const video = db()
    .insert(videos)
    .values({
      id: randomUUID(),
      ownerId: user.id,
      channelId: propio.id,
      title: "Luna",
      script: "Guion ficticio de la Luna",
      stage,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .returning()
    .get();
  anotarMemoria(otro, ajeno.id, "Título provisional: CANARIO_AJENO_732");
  anotarMemoria(
    user,
    secundario.id,
    "Título provisional: CANARIO_OTRO_CANAL_418",
  );
  return { user, otro, propio, secundario, ajeno, video };
}
type Escenario = ReturnType<typeof escenario>;
function contexto(s: Escenario, texto: string, canalId = s.propio.id) {
  return prepararEntradaChat(s.user, {
    texto,
    adjuntos: [],
    canalId,
    ...(canalId === s.propio.id ? { videoId: s.video.id } : {}),
  });
}
function aislamiento(e: EntradaModelo, respuesta?: MensajeModelo) {
  return !/CANARIO_AJENO_732|CANARIO_OTRO_CANAL_418/.test(
    JSON.stringify([e, respuesta]),
  );
}
function instantanea(s: Escenario) {
  return JSON.stringify({
    canales: db()
      .select()
      .from(channels)
      .all()
      .filter((c) => [s.user.id, s.otro.id].includes(c.ownerId)),
    videos: db()
      .select()
      .from(videos)
      .all()
      .filter((v) => [s.user.id, s.otro.id].includes(v.ownerId)),
    tarjetas: db().select().from(chatActions).all(),
  });
}
async function respuesta(observador: Observador, e: EntradaModelo) {
  let final: MensajeModelo | undefined;
  for await (const evento of observador.generar(
    e,
    AbortSignal.timeout(limites.respuestaMs),
  ))
    if (evento.tipo === "fin") final = evento.mensaje;
  if (!final) throw new Error("Sin resultado");
  return final;
}
function verificarPropuestas(s: Escenario, r: MensajeModelo) {
  try {
    for (const llamada of r.llamadas ?? [])
      prepararLlamada(s.user, structuredClone(llamada), {
        canalId: s.propio.id,
        videoId: s.video.id,
      });
    return true;
  } catch {
    return false;
  }
}
export const casosMemoria = [
  {
    id: 31,
    dia: 1,
    fase: "sintesis",
    tipo: "recuerdo_inicial",
    texto:
      "Título provisional: Faros de papel. Prefiero videos de un minuto. Pendiente: buscar ilustraciones.",
  },
  {
    id: 32,
    dia: 2,
    fase: "sintesis",
    tipo: "correccion",
    texto:
      "Cambio de preferencia: ahora los videos deben durar noventa segundos en vez de un minuto.",
  },
  {
    id: 33,
    dia: 2,
    fase: "sintesis",
    tipo: "pendiente_resuelto",
    texto:
      "Ya conseguimos todas las ilustraciones; esa búsqueda está resuelta.",
  },
  {
    id: 34,
    dia: 5,
    fase: "respuesta",
    tipo: "regreso_40_mensajes",
    texto:
      "Volví después de varios días. ¿Qué título habíamos pensado y cuánto deben durar mis videos?",
  },
  {
    id: 35,
    dia: 5,
    fase: "sintesis",
    tipo: "segunda_idea",
    texto:
      "Otra idea pendiente. Título provisional: Ríos de cobre. No hemos producido ninguna de las dos ideas.",
  },
  {
    id: 36,
    dia: 5,
    fase: "respuesta",
    tipo: "ambiguedad",
    texto: "Retomemos el video que estábamos pensando. ¿Cuál era?",
  },
  {
    id: 37,
    dia: 5,
    fase: "respuesta",
    tipo: "olvido",
    texto: "¿Qué título habíamos pensado y cuánto debían durar mis videos?",
  },
] as const;
export function criteriosMemoria(
  id: number,
  contenido: string,
  r?: MensajeModelo,
) {
  const n = normal(contenido);
  const vigente = n
    .replace(
      /\((?:corrige|sustituye|reemplaza) la preferencia anterior de (?:un minuto|60 segundos|sesenta segundos)\)/g,
      "",
    )
    .replace(
      /(?:en vez de|en lugar de) (?:un minuto|60 segundos|sesenta segundos)/g,
      "",
    );
  switch (id) {
    case 31:
      return {
        idea: n.includes("faros de papel"),
        preferencia: /un minuto|60|sesenta/.test(n),
        pendiente: n.includes("ilustraciones"),
      };
    case 32:
      return {
        corregida: /noventa|90/.test(n),
        anteriorRetirada: !/un minuto|60 segundos|sesenta/.test(vigente),
        ideaConservada: n.includes("faros de papel"),
      };
    case 33:
      return { pendienteRetirado: !n.includes("ilustraciones") };
    case 34:
      return {
        recuerdaTitulo:
          n.includes("faros de papel") &&
          !/no (?:recuerdo|era|pensamos|habiamos pensado)/.test(n),
        recuerdaCorreccion:
          /noventa|90/.test(n) && !/no[^.!?]{0,35}(?:noventa|90)/.test(n),
        noEjecuta: !r?.llamadas?.length,
      };
    case 35:
      return {
        dosIdeas: n.includes("faros de papel") && n.includes("rios de cobre"),
      };
    case 36:
      return {
        aclara: /\?|¿/.test(n) && n.includes("faros") && n.includes("rios"),
        noAsume: !r?.llamadas?.length,
      };
    case 37:
      return {
        noRecuperaOlvidado: !/faros|noventa|90|rios de cobre/.test(n),
        reconoceAusencia: /no |sin |recuerd|record|dime|cuent|compart/.test(n),
        noEjecuta: !r?.llamadas?.length,
      };
    default:
      throw new Error("Caso desconocido");
  }
}
function salida(r: Resultado) {
  if (r.estado !== "ERROR" && r.estado !== "NOT_RUN")
    r.estado =
      Object.values(r.controles).every(Boolean) && r.brevedad !== "FAIL"
        ? "PASS"
        : "FAIL";
  return r;
}
export async function evaluar(
  proveedor: ProveedorChat,
  opciones: { maximo?: number; alTerminar?: (r: Resultado) => void } = {},
) {
  const observador = new Observador(proveedor, opciones.maximo);
  const resultados: Resultado[] = [];
  const registrar = (r: Resultado) => {
    resultados.push(salida(r));
    opciones.alTerminar?.(r);
  };
  for (const g of conversaciones) {
    const r: Resultado = {
      id: g.id,
      tipo: g.tipo,
      texto: g.texto,
      estado: "PASS",
      controles: {},
      mediciones: [],
      totalMs: 0,
    };
    if (!observador.disponible()) {
      registrar({ ...r, estado: "NOT_RUN", error: observador.detenido });
      continue;
    }
    const inicio = performance.now(),
      desde = observador.mediciones.length;
    const s = escenario(
      g.herramienta === "gastos" || g.tipo === "admin_ajeno",
      g.herramienta === "aprobar_final" ? 9 : 3,
    );
    const antes = instantanea(s);
    try {
      const e = contexto(s, g.texto);
      r.controles.contextoAislado = aislamiento(e);
      if (!r.controles.contextoAislado) throw new Error("Contexto no aislado");
      r.respuesta = await respuesta(observador, e);
      Object.assign(r, brevedad(r.respuesta.texto));
      Object.assign(r.controles, seleccion(g, r.respuesta), {
        salidaAislada: aislamiento(e, r.respuesta),
        argumentosValidos: verificarPropuestas(s, r.respuesta),
      });
    } catch (error) {
      r.estado = "ERROR";
      r.error = errorSeguro(error);
    }
    r.controles.sinMutaciones = instantanea(s) === antes;
    r.totalMs = performance.now() - inicio;
    r.mediciones = observador.mediciones.slice(desde);
    registrar(r);
  }
  const s = escenario();
  for (const g of casosMemoria) {
    const r: Resultado = {
      id: g.id,
      dia: g.dia,
      tipo: g.tipo,
      texto: g.texto,
      estado: "PASS",
      controles: {},
      mediciones: [],
      totalMs: 0,
    };
    if (!observador.disponible()) {
      registrar({ ...r, estado: "NOT_RUN", error: observador.detenido });
      continue;
    }
    const inicio = performance.now(),
      desde = observador.mediciones.length;
    const antes = instantanea(s);
    observador.fase = g.fase;
    try {
      if (g.id === 34) {
        // Cuarenta mensajes posteriores desplazan la conversación inicial; el regreso depende del resumen.
        for (let i = 0; i < 40; i++)
          db()
            .insert(messages)
            .values({
              id: randomUUID(),
              ownerId: s.user.id,
              channelId: s.propio.id,
              role: i % 2 ? "assistant" : "user",
              content: "Seguimos revisando el estudio.",
              createdAt: Date.UTC(2030, 0, 4) + i,
            })
            .run();
      }
      if (g.id === 37) borrarRecuerdos(s.user);
      const e = contexto(s, g.texto);
      r.controles.contextoAislado = aislamiento(e);
      if (!r.controles.contextoAislado) throw new Error("Contexto no aislado");
      if (g.fase === "sintesis") {
        anotarMemoria(s.user, s.propio.id, g.texto);
        await resumirMemoria(
          s.user,
          s.propio.id,
          g.texto,
          "Lo tendremos en cuenta como propuesta pendiente.",
          observador,
          AbortSignal.timeout(limites.sintesisMs),
        );
        const fila = db()
          .select()
          .from(chatMemories)
          .where(
            and(
              eq(chatMemories.ownerId, s.user.id),
              eq(chatMemories.scope, s.propio.id),
            ),
          )
          .get();
        const resumen = resumenSchema.parse(
          JSON.parse(fila?.summary ?? JSON.stringify(memoriaVacia())),
        );
        r.memoria = resumen;
        // guardar() evita escribir si el resumen coincide con los apuntes: el método
        // persistido por sí solo no demuestra si esta síntesis fue válida.
        const propuesta = (() => {
          try {
            if (observador.ultimaSalida?.llamadas?.length) return null;
            return resumenSchema.parse(
              JSON.parse(observador.ultimaSalida?.texto ?? ""),
            );
          } catch {
            return null;
          }
        })();
        r.controles.sintesisAceptada =
          propuesta !== null &&
          JSON.stringify(propuesta) === JSON.stringify(resumen);
        Object.assign(
          r.controles,
          criteriosMemoria(
            g.id,
            JSON.stringify(g.id === 33 ? resumen.pendientes : resumen),
          ),
        );
        db()
          .update(chatMemories)
          .set({ updatedAt: Date.UTC(2030, 0, g.dia) })
          .where(
            and(
              eq(chatMemories.ownerId, s.user.id),
              eq(chatMemories.scope, s.propio.id),
            ),
          )
          .run();
        db()
          .insert(messages)
          .values({
            id: randomUUID(),
            ownerId: s.user.id,
            channelId: s.propio.id,
            role: "user",
            content: g.texto,
            createdAt: Date.UTC(2030, 0, g.dia),
          })
          .run();
      } else {
        if (g.id === 34)
          r.controles.soloResumenAntiguo =
            historialRecordable(s.user, s.propio.id).length === 30 &&
            !JSON.stringify(e.mensajes.slice(1, -1)).includes("Faros");
        if (g.id === 37)
          r.controles.cortePersistente =
            leerRecuerdos(s.user).length === 0 &&
            historialRecordable(s.user, s.propio.id).length === 0;
        r.respuesta = await respuesta(observador, e);
        Object.assign(r, brevedad(r.respuesta.texto));
        Object.assign(
          r.controles,
          criteriosMemoria(g.id, r.respuesta.texto, r.respuesta),
          { salidaAislada: aislamiento(e, r.respuesta) },
        );
      }
    } catch (error) {
      r.estado = "ERROR";
      r.error = errorSeguro(error);
    }
    r.controles.sinMutaciones = instantanea(s) === antes;
    r.totalMs = performance.now() - inicio;
    r.mediciones = observador.mediciones.slice(desde);
    const fallo = r.mediciones.find((m) => m.estado === "ERROR");
    if (fallo) {
      r.estado = "ERROR";
      r.error = fallo.error;
    }
    registrar(r);
  }
  return { resultados, llamadas: observador.llamadas, limites };
}
export function estadisticas(resultados: Resultado[]) {
  const percentil = (numeros: number[], p: number) =>
    numeros.length
      ? [...numeros].sort((a, b) => a - b)[Math.ceil(numeros.length * p) - 1]
      : null;
  return Object.fromEntries(
    (["respuesta", "sintesis"] as const).map((fase) => {
      const muestras = resultados
        .flatMap((r) => r.mediciones)
        .filter((m) => m.fase === fase);
      return [
        fase,
        {
          n: muestras.length,
          errores: muestras.filter((m) => m.estado === "ERROR").length,
          p50Ms: percentil(
            muestras.map((m) => m.proveedorMs),
            0.5,
          ),
          p95Ms: percentil(
            muestras.map((m) => m.proveedorMs),
            0.95,
          ),
        },
      ];
    }),
  );
}
