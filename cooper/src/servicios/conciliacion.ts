import { createHash } from "node:crypto";
import { and, desc, eq, inArray, notExists, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { db } from "@/db";
import {
  bridgeCommands,
  chatActions,
  chatSessions,
  cuentasMarca,
  events,
  marcaIngestas,
  marcas,
  piezasMarca,
  whatsappActions,
  whatsappDeliveries,
  whatsappOutbox,
  users,
  type User,
} from "@/db/schema";
import { ErrorHttp, requireAdmin } from "@/lib/permisos";
import { cuentaActiva } from "./mensajeria/cuentas";
import { conciliarEntrega } from "./mensajeria/cola";
import { proveedorRed, type RedSocial } from "./marcas/redes";
import { ordenVinculada, registrarConciliacion } from "./conciliacion-registro";

export const tipoConciliacion = z.enum([
  "chat",
  "fabrica",
  "whatsapp",
  "accion_whatsapp",
  "marca",
  "ingesta",
]);
type Tipo = z.infer<typeof tipoConciliacion>;
const identificador = z.string().min(1).max(512);
export const decisionConciliacion = z
  .object({
    tipo: tipoConciliacion,
    id: identificador,
    huella: z.string().regex(/^[a-f0-9]{64}$/),
    accion: z.enum(["consultar", "confirmar", "archivar"]),
    referencia: z.string().trim().max(240).default(""),
    remoto: z.string().trim().max(512).default(""),
    comprobado: z.boolean().default(false),
  })
  .strict();
function administrador(user: User) {
  const actual = cuentaActiva(user.id);
  requireAdmin(actual);
  return actual;
}
function falta(): never {
  throw new ErrorHttp(404, "Operación no disponible.");
}
function obtener(tipo: Tipo, id: string) {
  const d = db();
  if (tipo === "chat") {
    const r =
      d.select().from(chatActions).where(eq(chatActions.id, id)).get() ??
      falta();
    const session = d
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.ownerId, r.ownerId))
      .get();
    const orden = ordenVinculada(tipo, id);
    return {
      ownerId: r.ownerId,
      estado: r.status,
      referencia: orden,
      raw: r,
      enCurso:
        r.status === "ejecutando" && (session?.busyUntil ?? 0) > Date.now(),
      pendiente: ["ejecutando", "revisar"].includes(r.status),
    };
  }
  if (tipo === "fabrica") {
    const r =
      d.select().from(bridgeCommands).where(eq(bridgeCommands.id, id)).get() ??
      falta();
    return {
      ownerId: r.ownerId,
      estado: r.confirmed
        ? "confirmada"
        : r.execution
          ? "reservada"
          : "sin_confirmacion",
      referencia: r.execution,
      raw: r,
      enCurso: r.createdAt > Date.now() - 300000,
      pendiente: !r.confirmed,
    };
  }
  if (tipo === "whatsapp") {
    const r =
      d.select().from(whatsappOutbox).where(eq(whatsappOutbox.id, id)).get() ??
      falta();
    return {
      ownerId: r.ownerId,
      estado: r.state,
      referencia: r.remoteId,
      raw: r,
      enCurso: r.state === "enviando" && r.leaseAt > Date.now() - 60000,
      pendiente: ["enviando", "incierto"].includes(r.state),
    };
  }
  if (tipo === "accion_whatsapp") {
    const r =
      d
        .select()
        .from(whatsappActions)
        .where(eq(whatsappActions.id, id))
        .get() ?? falta();
    return {
      ownerId: r.ownerId,
      estado: r.state,
      referencia: ordenVinculada(tipo, id),
      raw: r,
      enCurso: r.state === "procesando" && r.createdAt > Date.now() - 300000,
      pendiente: ["procesando", "incierta"].includes(r.state),
    };
  }
  if (tipo === "marca") {
    const r =
      d.select().from(piezasMarca).where(eq(piezasMarca.id, id)).get() ??
      falta();
    const m =
      d.select().from(marcas).where(eq(marcas.id, r.marcaId)).get() ?? falta();
    const c =
      d
        .select()
        .from(cuentasMarca)
        .where(eq(cuentasMarca.id, r.cuentaId))
        .get() ?? falta();
    return {
      ownerId: m.ownerId,
      estado: r.estado,
      referencia: r.remoto || r.checkpoint.id || r.checkpoint.envio || "",
      raw: { pieza: r, cuenta: c, ownerId: m.ownerId },
      enCurso: r.estado === "enviando" && r.leaseAt > Date.now() - 300000,
      pendiente: ["enviando", "procesando", "revision"].includes(r.estado),
    };
  }
  const r =
    d.select().from(marcaIngestas).where(eq(marcaIngestas.id, id)).get() ??
    falta();
  return {
    ownerId: r.ownerId,
    estado: r.estado,
    referencia: r.mediaId,
    raw: r,
    enCurso: false,
    pendiente: r.estado === "descargando",
  };
}
function cierre(tipo: Tipo, id: string) {
  return db()
    .select()
    .from(events)
    .where(eq(events.id, `conciliacion:${tipo}:${id}`))
    .get();
}
function huella(r: ReturnType<typeof obtener>) {
  return createHash("sha256")
    .update(JSON.stringify([r.raw, r.referencia]))
    .digest("hex");
}
export function consultarCaso(user: User, tipo: Tipo, id: string) {
  administrador(user);
  const r = obtener(tipo, id),
    terminal = cierre(tipo, id);
  const dueno =
    db()
      .select({ nombre: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, r.ownerId))
      .get() ?? falta();
  return {
    tipo,
    id,
    ownerId: r.ownerId,
    propietario: `${dueno.nombre} · ${dueno.email}`,
    cuenta:
      "cuenta" in r.raw
        ? `${r.raw.cuenta.red}: ${r.raw.cuenta.alias} (${r.raw.cuenta.remoto})`
        : "",
    estado: r.estado,
    referencia: r.referencia,
    huella: huella(r),
    enCurso: r.enCurso,
    pendiente: r.pendiente && !terminal,
    cierre: terminal
      ? (JSON.parse(terminal.payload) as RegistroDecision)
      : null,
  };
}
type RegistroDecision = {
  actor: string;
  accion: string;
  fuente: string;
  referencia: string;
  remoto: string;
  fecha: number;
};
export type CasoConciliacion = ReturnType<typeof consultarCaso>;
function sinCierre(tipo: Tipo, id: AnySQLiteColumn) {
  return notExists(
    db()
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, sql`${`conciliacion:${tipo}:`} || ${id}`)),
  );
}
export function listarConciliacion(user: User) {
  administrador(user);
  const d = db();
  const grupos: [Tipo, { id: string }[]][] = [
    [
      "chat",
      d
        .select({ id: chatActions.id })
        .from(chatActions)
        .where(
          and(
            inArray(chatActions.status, ["ejecutando", "revisar"]),
            sinCierre("chat", chatActions.id),
          ),
        )
        .limit(100)
        .all(),
    ],
    [
      "fabrica",
      d
        .select({ id: bridgeCommands.id })
        .from(bridgeCommands)
        .where(
          and(
            eq(bridgeCommands.confirmed, false),
            sinCierre("fabrica", bridgeCommands.id),
          ),
        )
        .limit(100)
        .all(),
    ],
    [
      "whatsapp",
      d
        .select({ id: whatsappOutbox.id })
        .from(whatsappOutbox)
        .where(
          and(
            inArray(whatsappOutbox.state, ["enviando", "incierto"]),
            sinCierre("whatsapp", whatsappOutbox.id),
          ),
        )
        .limit(100)
        .all(),
    ],
    [
      "accion_whatsapp",
      d
        .select({ id: whatsappActions.id })
        .from(whatsappActions)
        .where(
          and(
            inArray(whatsappActions.state, ["procesando", "incierta"]),
            sinCierre("accion_whatsapp", whatsappActions.id),
          ),
        )
        .limit(100)
        .all(),
    ],
    [
      "marca",
      d
        .select({ id: piezasMarca.id })
        .from(piezasMarca)
        .where(
          and(
            inArray(piezasMarca.estado, ["enviando", "procesando", "revision"]),
            sinCierre("marca", piezasMarca.id),
          ),
        )
        .limit(100)
        .all(),
    ],
    [
      "ingesta",
      d
        .select({ id: marcaIngestas.id })
        .from(marcaIngestas)
        .where(
          and(
            eq(marcaIngestas.estado, "descargando"),
            sinCierre("ingesta", marcaIngestas.id),
          ),
        )
        .limit(100)
        .all(),
    ],
  ];
  return {
    casos: grupos.flatMap(([tipo, filas]) =>
      filas.map(({ id }) => consultarCaso(user, tipo, id)),
    ),
    limitePorTipo: 100,
    historial: d
      .select({ id: events.id, datos: events.payload, fecha: events.createdAt })
      .from(events)
      .where(eq(events.type, "conciliacion"))
      .orderBy(desc(events.createdAt))
      .limit(50)
      .all()
      .map((e) => ({
        ...(JSON.parse(e.datos) as RegistroDecision),
        id: e.id,
        fecha: e.fecha,
      })),
  };
}
export type PanelConciliacion = ReturnType<typeof listarConciliacion>;

export async function conciliarOperacion(
  user: User,
  raw: unknown,
  red?: RedSocial,
) {
  const actor = administrador(user),
    input = decisionConciliacion.parse(raw);
  const { tipo, id, accion } = input;
  const previo = obtener(tipo, id);
  function comprobar() {
    administrador(actor);
    const r = obtener(tipo, id);
    if (huella(r) !== input.huella || cierre(tipo, id) || !r.pendiente)
      throw new ErrorHttp(
        409,
        "El resultado cambió o ya está cerrado. Actualiza la consulta.",
      );
    if (r.enCurso)
      throw new ErrorHttp(
        409,
        "La operación sigue en curso. No se ha modificado.",
      );
    return r;
  }
  comprobar();
  let confirmado = false,
    remoto = "",
    fuente = "sin_evidencia";
  if (
    accion !== "consultar" &&
    (!input.comprobado || input.referencia.length < 8)
  )
    throw new ErrorHttp(
      400,
      "Registra la referencia de evidencia y confirma su revisión.",
    );
  if (tipo === "chat" || tipo === "accion_whatsapp") {
    const orden = db()
      .select()
      .from(bridgeCommands)
      .where(eq(bridgeCommands.id, previo.referencia))
      .get();
    confirmado = !!orden?.confirmed && orden.ownerId === previo.ownerId;
    remoto = confirmado ? orden!.id : "";
    fuente = confirmado ? "callback_fabrica" : fuente;
  }
  if (tipo === "whatsapp" && accion !== "archivar") {
    const job = db()
      .select()
      .from(whatsappOutbox)
      .where(eq(whatsappOutbox.id, id))
      .get()!;
    remoto = job.remoteId || (accion === "confirmar" ? input.remoto : "");
    const recibo = db()
      .select()
      .from(whatsappDeliveries)
      .where(
        and(
          eq(whatsappDeliveries.remoteId, remoto),
          eq(whatsappDeliveries.phone, job.phone),
        ),
      )
      .all()
      .find(
        (r) =>
          ["sent", "delivered", "read", "failed"].includes(r.state) &&
          r.occurredAt >= job.createdAt - 1000,
      );
    const usado = db()
      .select()
      .from(whatsappOutbox)
      .where(eq(whatsappOutbox.remoteId, remoto))
      .all()
      .some((r) => r.id !== id);
    confirmado = !!remoto && !!recibo && !usado;
    fuente = confirmado ? "recibo_whatsapp" : fuente;
  }
  if (tipo === "marca" && accion === "consultar") {
    const p = db()
      .select()
      .from(piezasMarca)
      .where(eq(piezasMarca.id, id))
      .get()!;
    const c = db()
      .select()
      .from(cuentasMarca)
      .where(eq(cuentasMarca.id, p.cuentaId))
      .get()!;
    cuentaActiva(previo.ownerId);
    red ??= proveedorRed();
    if (c.estado !== "conectada" || c.simulada !== red.simulada)
      throw new ErrorHttp(
        409,
        "La cuenta no tiene una conexión vigente para consultar.",
      );
    if (red.consultarPublicacion) {
      const r = await red.consultarPublicacion(c, p);
      confirmado = r.publicada && !!r.remoto;
      remoto = r.remoto;
      fuente = confirmado ? "consulta_red" : fuente;
    }
  }
  if (accion === "confirmar" && tipo !== "whatsapp") {
    if (tipo === "ingesta")
      throw new ErrorHttp(
        409,
        "Una ingesta incompleta solo se puede cerrar sin reenvío.",
      );
    if (!input.remoto)
      throw new ErrorHttp(400, "Falta el identificador comprobado.");
    if (
      tipo === "fabrica" &&
      (!previo.referencia || input.remoto !== previo.referencia)
    )
      throw new ErrorHttp(
        409,
        "La ejecución no coincide con la reserva conservada.",
      );
    confirmado = true;
    remoto = input.remoto;
    fuente = "revision_administrativa";
  }
  if (accion === "confirmar" && !confirmado)
    throw new ErrorHttp(
      409,
      "No existe un recibo compatible. Conserva el bloqueo.",
    );
  if (accion === "archivar") confirmado = false;
  db().transaction(
    () => {
      comprobar();
      // Revalidar permisos después de una consulta remota; nunca ejecutar una acción de cuenta.
      if (tipo === "marca" && accion === "consultar")
        cuentaActiva(previo.ownerId);
      if (confirmado) {
        if (tipo === "chat")
          db()
            .update(chatActions)
            .set({ status: "confirmada" })
            .where(eq(chatActions.id, id))
            .run();
        if (tipo === "accion_whatsapp")
          db()
            .update(whatsappActions)
            .set({ state: "completada" })
            .where(eq(whatsappActions.id, id))
            .run();
        if (tipo === "fabrica")
          db()
            .update(bridgeCommands)
            .set({ confirmed: true })
            .where(eq(bridgeCommands.id, id))
            .run();
        if (tipo === "marca")
          db()
            .update(piezasMarca)
            .set({
              estado: "publicada",
              remoto,
              aviso:
                "Publicación conciliada; consultar el registro administrativo.",
              updatedAt: Date.now(),
            })
            .where(eq(piezasMarca.id, id))
            .run();
        if (tipo === "whatsapp") {
          db()
            .update(whatsappOutbox)
            .set({ state: "aceptado", remoteId: remoto })
            .where(eq(whatsappOutbox.id, id))
            .run();
          conciliarEntrega(
            db()
              .select()
              .from(whatsappOutbox)
              .where(eq(whatsappOutbox.id, id))
              .get()!,
          );
        }
      } else if (accion === "archivar") {
        // Conservar las reservas, IDs e idempotencia. Ingesta se cerca para impedir escrituras tardías.
        if (tipo === "ingesta")
          db()
            .update(marcaIngestas)
            .set({ estado: "cancelada" })
            .where(eq(marcaIngestas.id, id))
            .run();
        if (tipo === "marca")
          db()
            .update(piezasMarca)
            .set({ estado: "revision" })
            .where(eq(piezasMarca.id, id))
            .run();
      }
      const final = confirmado || accion === "archivar";
      registrarConciliacion(
        previo.ownerId,
        {
          tipo,
          id,
          actor: actor.id,
          accion: confirmado
            ? "confirmada"
            : accion === "archivar"
              ? "cerrada_sin_reenvio"
              : "sin_evidencia",
          fuente,
          referencia: input.referencia,
          remoto,
          antes: previo.estado,
          despues: obtener(tipo, id).estado,
          huella: input.huella,
          fecha: Date.now(),
        },
        final ? `${tipo}:${id}` : undefined,
      );
    },
    { behavior: "immediate" },
  );
  return consultarCaso(actor, tipo, id);
}
