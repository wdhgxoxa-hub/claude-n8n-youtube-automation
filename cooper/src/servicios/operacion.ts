import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, videos, events, users, type User } from "@/db/schema";
import { ErrorHttp, requireAdmin, requireOwner } from "@/lib/permisos";
import {
  ajustesSchema,
  catalogo,
  camposBiblia,
  controlSchema,
  operacionSchema,
  type Operacion,
  type Ajustes,
} from "@/contratos/operacion";
import { aceptadoSchema } from "@/contratos/puente";
import { FabricaN8n, FabricaSimulada } from "./fabrica";
import { historial } from "./mensajeria/cola";
import { leerObservabilidad } from "@/contratos/observabilidad";
const remoto = () =>
  process.env.COOPER_FABRICA === "n8n" && process.env.COOPER_DEMO !== "1";
function registro(user: User, type: string, payload: unknown) {
  db()
    .insert(events)
    .values({
      id: randomUUID(),
      ownerId: user.id,
      type,
      payload: JSON.stringify(payload),
      createdAt: Date.now(),
    })
    .run();
}
function propios(user: User, type: string) {
  return db()
    .select()
    .from(events)
    .where(
      and(
        eq(events.type, type),
        ...(user.role === "admin" ? [] : [eq(events.ownerId, user.id)]),
      ),
    )
    .orderBy(desc(events.createdAt))
    .limit(500)
    .all();
}
export async function leerAjustes(user: User): Promise<Ajustes> {
  requireAdmin(user);
  if (remoto())
    return ajustesSchema.parse(
      await new FabricaN8n().request(user, "ajustes", {}),
    );
  const filas = propios(user, "ajustes_fabrica");
  const valores: Ajustes["valores"] = Object.fromEntries(
    Object.entries(catalogo).map(([k, v]) => [k, v.valor]),
  );
  for (const f of [...filas].reverse())
    Object.assign(valores, JSON.parse(f.payload).valores);
  return {
    revision: createHash("sha256")
      .update(JSON.stringify(valores))
      .digest("hex"),
    valores,
    historial: filas.map((f) => ({
      fecha: new Date(f.createdAt).toISOString(),
      actor: JSON.parse(f.payload).actor,
      cambios: Object.keys(JSON.parse(f.payload).valores),
    })),
  };
}
export async function leerOperacion(user: User): Promise<Operacion> {
  let op: Operacion;
  if (remoto())
    op = operacionSchema.parse(
      await new FabricaN8n().request(user, "operacion", {}),
    );
  else {
    const cs = db()
      .select()
      .from(channels)
      .where(user.role === "admin" ? undefined : eq(channels.ownerId, user.id))
      .all();
    const vs = db()
      .select()
      .from(videos)
      .where(user.role === "admin" ? undefined : eq(videos.ownerId, user.id))
      .all();
    const cambios = propios(user, "operacion_canal");
    const demo = process.env.COOPER_DEMO === "1";
    const hoy = new Date().toISOString();
    op = {
      modo: "simulada",
      actualizado: hoy,
      canales: cs.map((c) => {
        const guardado = cambios.find((e) => JSON.parse(e.payload).id === c.id);
        if (guardado)
          return JSON.parse(guardado.payload) as Operacion["canales"][number];
        return {
          id: c.id,
          nombre: c.name,
          estado: "activo",
          biblia: Object.fromEntries(
            Object.keys(camposBiblia).map((k) => [
              k,
              k === "notas"
                ? c.bible
                : demo
                  ? (
                      {
                        "estilo_visual.descripcion":
                          "Luz natural, primeros planos y diagramas sencillos.",
                        "voz.tono": "Cercano, preciso y curioso.",
                        "voz.descripcion": "Pausas breves antes de cada idea.",
                        "voz.gemini_voice": "Charon",
                      } as Record<string, string>
                    )[k] || ""
                  : "",
            ]),
          ),
          conexion: { estado: "sin conectar", nombre: "", url: "" },
          perfil: "",
          redes: ["youtube", "instagram"],
          zona: "America/Lima",
          metas: {
            videos_semana: 2,
            formato: "short",
            auto: false,
            retencion_min: 0.5,
          },
          cuenta: { red: "", handle: c.account, diagnostico: "" },
          radar: {
            fecha: demo ? hoy : "",
            resumen: demo ? "Ideas de ejemplo para explorar tu canal." : "",
            ideas: demo
              ? [
                  {
                    id: "demo-lluvia",
                    titulo: "Por qué reconocemos el olor de la lluvia",
                    red: "youtube",
                    gancho: "Tu nariz sabe que va a llover antes que tú.",
                    motivo:
                      "Una pregunta cotidiana con una explicación visual.",
                    fuente: "Ejemplo de demostración",
                    url: "https://es.wikipedia.org/wiki/Petricor",
                    formato: "short",
                  },
                ]
              : [],
            sonidos: demo
              ? [
                  {
                    nombre: "Lluvia sobre hojas",
                    uso: "Ambiente suave de ejemplo; revisa los derechos antes de publicar.",
                    url: "",
                  },
                ]
              : [],
          },
          rutina: demo
            ? [
                {
                  fecha: hoy,
                  decision: "En pausa",
                  motivo:
                    "La producción automática está apagada en este ejemplo.",
                  frenos: ["Automatización apagada"],
                  videoId: "",
                },
              ]
            : [],
          referencias: demo
            ? [
                {
                  id: "escena-mesa",
                  nombre: "Mesa del experimento",
                  tipo: "escenarios",
                  descripcion:
                    "Luz lateral y fondo neutro; pendiente de generar.",
                  urls: [],
                },
              ]
            : [],
          especialistas: demo
            ? vs
                .filter((v) => v.channelId === c.id)
                .slice(0, 1)
                .map((v) => ({
                  videoId: v.id,
                  titulo: v.title,
                  red: "youtube",
                  hora: "16:00",
                  formato: "Vertical breve",
                  sonido: "Ambiente discreto",
                  recomendacion:
                    "Ejemplo: abre con la pregunta y muestra el experimento.",
                }))
            : [],
        };
      }),
      decisiones: vs
        .filter((v) => [3, 9].includes(v.stage))
        .map((v) => ({
          id: v.id,
          canalId: v.channelId,
          videoId: v.id,
          etapa: v.stage === 3 ? "guion" : "final",
          resumen: v.title,
          detalle: v.script,
          fecha: new Date(v.updatedAt).toISOString(),
          opciones: ["aprobar", "cambios"],
          renovable: false,
        })),
      publicaciones: vs.flatMap((v) => {
        const obs = leerObservabilidad(v.observability);
        return [
          ...obs.publicaciones.map((p) => ({
            id: p.id,
            canalId: v.channelId,
            videoId: v.id,
            titulo: v.title,
            red: p.red,
            estado: "publicado",
            fecha: p.fecha || "",
            url: p.url,
            detalle: "",
          })),
          ...(v.scheduledAt
            ? [
                {
                  id: "programado:" + v.id,
                  canalId: v.channelId,
                  videoId: v.id,
                  titulo: v.title,
                  red: "youtube",
                  estado: v.stage === 11 ? "publicado" : "programado",
                  fecha: v.scheduledAt,
                  url: "",
                  detalle:
                    v.stage < 10
                      ? "Espera las aprobaciones antes de publicar."
                      : "",
                },
              ]
            : []),
        ];
      }),
      avisos: [],
      fallos: vs
        .filter((v) => v.productionState === "pausada")
        .map((v) => ({
          id: "fallo:" + v.id,
          canalId: v.channelId,
          videoId: v.id,
          titulo: v.title,
          fecha: new Date(v.updatedAt).toISOString(),
          motivo: v.productionNotice || "La producción está en pausa.",
          sugerencia: "Revisa la última versión antes de solicitar cambios.",
          reintento: v.newsMode ? "ninguno" : "corregir",
        })),
    };
  }
  op.avisos.push(
    ...historial(user).map((a) => ({
      id: a.id,
      canalId: "",
      videoId: "",
      medio: "whatsapp" as const,
      tipo: a.tipo,
      estado: a.entrega || a.estado,
      fecha: new Date(a.creado).toISOString(),
      resumen: a.simulada ? "Aviso de demostración" : "Aviso de tu espacio",
    })),
  );
  return operacionSchema.parse(op);
}
let turno: Promise<unknown> = Promise.resolve();
export function controlar(user: User, input: unknown) {
  const siguiente = turno.then(
    () => ejecutarControl(user, input),
    () => ejecutarControl(user, input),
  );
  turno = siguiente.catch(() => {});
  return siguiente;
}
async function ejecutarControl(user: User, input: unknown) {
  const c = controlSchema.parse(input);
  if (
    c.accion === "ajustes" ||
    (c.accion === "metas" && c.gasto_semana_usd !== undefined)
  )
    requireAdmin(user);
  if ("canalId" in c)
    requireOwner(
      user,
      db().select().from(channels).where(eq(channels.id, c.canalId)).get(),
    );
  if (c.accion === "ajustes") {
    if ((await leerAjustes(user)).revision !== c.revision)
      throw new ErrorHttp(
        409,
        "Los ajustes cambiaron. Actualiza y revísalos antes de confirmar.",
      );
  }
  if (remoto()) {
    const id = "id" in c ? c.id : randomUUID();
    const respuesta = await new FabricaN8n().request(user, "control_fabrica", {
      ...c,
      id,
    });
    if (!aceptadoSchema.safeParse(respuesta).success)
      throw new ErrorHttp(
        502,
        "La fábrica no confirmó la orden. Consulta el estado antes de repetir.",
      );
    registro(user, "control_fabrica", { accion: c.accion, estado: "recibida" });
    return {
      mensaje: "Solicitud recibida. Actualiza para comprobar el resultado.",
    };
  }
  if (c.accion === "ajustes") {
    registro(user, "ajustes_fabrica", {
      actor: user.email,
      valores: c.valores,
    });
    return { mensaje: "Ajustes guardados en la fábrica simulada." };
  }
  const op = await leerOperacion(user);
  const sim = new FabricaSimulada();
  const actorDe = (ownerId: string) => {
    const actor = db().select().from(users).where(eq(users.id, ownerId)).get();
    if (!actor) throw new ErrorHttp(404, "No encontramos el dueño.");
    return actor;
  };
  if ("canalId" in c) {
    const canal = op.canales.find((x) => x.id === c.canalId)!;
    switch (c.accion) {
      case "conectar":
        canal.conexion = {
          estado: "pendiente de conexión real",
          nombre: "",
          url: "",
        };
        break;
      case "radar":
        registro(user, "radar_solicitado", { canalId: c.canalId });
        break;
      case "biblia":
        canal.biblia[c.campo] = c.valor;
        break;
      case "referencia": {
        const ref = {
          id: c.id,
          nombre: c.id,
          tipo: c.tipo,
          descripcion: c.descripcion,
          urls: c.urls,
        };
        const index = canal.referencias.findIndex(
          (x) => x.id === c.id && x.tipo === c.tipo,
        );
        if (index < 0) canal.referencias.push(ref);
        else canal.referencias[index] = ref;
        break;
      }
      case "redes":
        Object.assign(canal, {
          perfil: c.perfil,
          redes: c.redes,
          zona: c.zona,
        });
        break;
      case "metas":
        canal.metas = {
          videos_semana: c.videos_semana,
          formato: c.formato,
          auto: c.auto,
          retencion_min: c.retencion_min,
        };
        canal.rutina = [
          {
            fecha: new Date().toISOString(),
            decision: c.auto ? "Meta guardada" : "En pausa",
            motivo: c.auto
              ? "El simulador conserva las metas; no ejecuta cron diario."
              : "La producción automática está apagada.",
            frenos: c.auto ? [] : ["Automatización apagada"],
            videoId: "",
          },
          ...canal.rutina,
        ].slice(0, 30);
        break;
      case "adoptar":
        canal.cuenta = {
          red: c.red,
          handle: c.cuenta,
          diagnostico: "Adopción simulada. No se consultó la cuenta externa.",
        };
        break;
      case "referencias":
        registro(user, "referencias_solicitadas", { canalId: c.canalId });
        break;
      case "idea": {
        const idea = canal.radar.ideas.find((i) => i.id === c.ideaId);
        if (!idea) throw new ErrorHttp(409, "Esta idea ya no está disponible.");
        const owner = db()
          .select()
          .from(channels)
          .where(eq(channels.id, c.canalId))
          .get()!;
        return sim.ejecutar(actorDe(owner.ownerId), {
          evento: "nuevo_video",
          recursoId: c.canalId,
          texto: idea.titulo,
          parametros: { formato: idea.formato },
        });
      }
    }
    registro(
      actorDe(
        db().select().from(channels).where(eq(channels.id, canal.id)).get()!
          .ownerId,
      ),
      "operacion_canal",
      canal,
    );
  } else if (c.accion === "renovar") {
    throw new ErrorHttp(
      409,
      "Esta decisión de demostración no necesita renovar un formulario.",
    );
  } else if (c.accion === "decidir") {
    const a = op.decisiones.find((a) => a.id === c.id);
    if (!a) throw new ErrorHttp(409, "Esta decisión ya no está pendiente.");
    if (c.decision === "aprobar")
      await sim.aprobar(
        actorDe(
          db().select().from(videos).where(eq(videos.id, a.videoId)).get()!
            .ownerId,
        ),
        a.videoId,
      );
    else if (c.decision === "cambios" && c.cambios.trim())
      await sim.ejecutar(
        actorDe(
          db().select().from(videos).where(eq(videos.id, a.videoId)).get()!
            .ownerId,
        ),
        {
          evento: "corregir",
          recursoId: a.videoId,
          texto: c.cambios,
        },
      );
    else throw new ErrorHttp(400, "Escribe los cambios que necesitas.");
  } else if (c.accion === "reintentar") {
    const f = op.fallos.find((f) => f.videoId === c.videoId);
    if (!f || f.reintento === "ninguno")
      throw new ErrorHttp(409, "Revisa el bloqueo antes de repetir.");
    await sim.ejecutar(
      actorDe(
        db().select().from(videos).where(eq(videos.id, c.videoId)).get()!
          .ownerId,
      ),
      {
        evento: "corregir",
        recursoId: c.videoId,
        texto: "Revisar y corregir el último paso.",
      },
    );
    db()
      .update(videos)
      .set({ productionState: "activa", productionNotice: "" })
      .where(eq(videos.id, c.videoId))
      .run();
  }
  registro(user, "control_fabrica", { accion: c.accion, estado: "aplicada" });
  return {
    mensaje:
      c.accion === "radar"
        ? "Solicitud de radar registrada. El simulador conserva ideas de ejemplo."
        : c.accion === "referencias"
          ? "Solicitud de referencias registrada. El simulador no genera imágenes."
          : "Cambios guardados en la fábrica simulada.",
  };
}
