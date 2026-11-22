import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, users, type User } from "@/db/schema";
import { ErrorHttp, requireAdmin } from "@/lib/permisos";
import { cuentaActiva } from "./mensajeria/cuentas";
import { leerSaludOperativa } from "./salud-operativa";
import {
  umbralesSaludPredeterminados,
  type SaludOperativa,
} from "@/contratos/salud-operativa";
import {
  configurarAlertasSchema,
  type ConfiguracionSalud,
  type TelegramSalud,
  type PanelSalud,
} from "@/contratos/alertas-salud";

const CONFIG = "observabilidad:configuracion";
const ESTADO = "observabilidad:telegram";
const MINUTO = 60000;
type Entrega = TelegramSalud["entrega"];
interface Estado {
  lease: string;
  leaseHasta: number;
  siguiente: number;
  evaluado: number;
  enviado: number;
  intento: number;
  proximoEnvio: number;
  intentados: string[];
  avisoPosible: boolean;
  entrega: Entrega;
  notificados: string[];
  pendientes: string[];
}
const inicial = (): Estado => ({
  lease: "",
  leaseHasta: 0,
  siguiente: 0,
  evaluado: 0,
  enviado: 0,
  intento: 0,
  proximoEnvio: 0,
  intentados: [],
  avisoPosible: false,
  entrega: "sin_envios",
  notificados: [],
  pendientes: [],
});
function administrador(user: User) {
  const actual = cuentaActiva(user.id);
  requireAdmin(actual);
  return actual;
}
function estado(): Estado {
  const row = db().select().from(events).where(eq(events.id, ESTADO)).get();
  return row
    ? ({ ...inicial(), ...JSON.parse(row.payload) } as Estado)
    : inicial();
}
function guardarEstado(user: User, value: Estado) {
  db()
    .insert(events)
    .values({
      id: ESTADO,
      ownerId: user.id,
      type: ESTADO,
      payload: JSON.stringify(value),
      createdAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: events.id,
      set: { payload: JSON.stringify(value), createdAt: Date.now() },
    })
    .run();
}
export function leerConfiguracionSalud(user: User): ConfiguracionSalud {
  administrador(user);
  const row = db().select().from(events).where(eq(events.id, CONFIG)).get();
  if (row) return JSON.parse(row.payload) as ConfiguracionSalud;
  return {
    revision: "inicial",
    telegramActivo: false,
    recordatorioMinutos: 360,
    umbrales: { ...umbralesSaludPredeterminados },
  };
}
export function guardarConfiguracionSalud(
  user: User,
  input: unknown,
): ConfiguracionSalud {
  const actor = administrador(user);
  const parsed = configurarAlertasSchema.parse(input);
  return db().transaction(
    () => {
      const anterior = leerConfiguracionSalud(actor);
      if (anterior.revision !== parsed.revision)
        throw new ErrorHttp(
          409,
          "Los umbrales cambiaron. Actualiza antes de confirmar.",
        );
      const value: ConfiguracionSalud = {
        revision: randomUUID(),
        telegramActivo: parsed.telegramActivo,
        recordatorioMinutos: parsed.recordatorioMinutos,
        umbrales: parsed.umbrales,
      };
      db()
        .insert(events)
        .values({
          id: CONFIG,
          ownerId: actor.id,
          type: CONFIG,
          payload: JSON.stringify(value),
          createdAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: events.id,
          set: {
            ownerId: actor.id,
            payload: JSON.stringify(value),
            createdAt: Date.now(),
          },
        })
        .run();
      db()
        .insert(events)
        .values({
          id: randomUUID(),
          ownerId: actor.id,
          type: "observabilidad:ajustes",
          payload: JSON.stringify(value),
          createdAt: Date.now(),
        })
        .run();
      const current = estado();
      guardarEstado(actor, { ...current, siguiente: 0 });
      return value;
    },
    { behavior: "immediate" },
  );
}
function telegramConfigurado() {
  return (
    /^\d+:[A-Za-z0-9_-]+$/.test(process.env.COOPER_TELEGRAM_BOT_TOKEN ?? "") &&
    /^-?\d+$/.test(process.env.COOPER_TELEGRAM_CHAT_ID ?? "")
  );
}
export function leerTelegramSalud(user: User): TelegramSalud {
  const config = leerConfiguracionSalud(user),
    current = estado();
  return {
    configurado: telegramConfigurado(),
    activo:
      config.telegramActivo &&
      process.env.COOPER_OBSERVABILIDAD_PAUSA !== "1" &&
      process.env.COOPER_DEMO !== "1" &&
      process.env.COOPER_FABRICA === "n8n",
    ultimaEvaluacion: current.evaluado
      ? new Date(current.evaluado).toISOString()
      : null,
    ultimoEnvio: current.enviado
      ? new Date(current.enviado).toISOString()
      : null,
    entrega: current.entrega,
    pendientes: current.pendientes.length,
  };
}
export async function leerPanelSalud(user: User): Promise<PanelSalud> {
  const actor = administrador(user);
  const configuracion = leerConfiguracionSalud(actor);
  const salud = await leerSaludOperativa(actor, configuracion.umbrales);
  administrador(actor);
  return { salud, configuracion, telegram: leerTelegramSalud(actor) };
}

export interface ResultadoTelegram {
  entrega: "enviado" | "fallido" | "incierto";
  reintentarEn?: number;
}
// sendMessage no tiene clave de idempotencia. Un timeout nunca se declara entregado.
// No se lee ni registra la descripción del proveedor; puede incluir datos privados.
export async function enviarTelegramSalud(
  texto: string,
): Promise<ResultadoTelegram> {
  if (!telegramConfigurado())
    return { entrega: "fallido", reintentarEn: 5 * MINUTO };
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.COOPER_TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.COOPER_TELEGRAM_CHAT_ID,
          text: texto.slice(0, 3500),
          protect_content: true,
          link_preview_options: { is_disabled: true },
          allow_paid_broadcast: false,
        }),
      },
    );
    const reader = response.body?.getReader();
    if (!reader) return { entrega: "incierto" };
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 65536) {
        await reader.cancel();
        return { entrega: "incierto" };
      }
      chunks.push(part.value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString()) as {
      ok?: unknown;
      result?: { message_id?: unknown };
      parameters?: { retry_after?: unknown };
    };
    if (
      response.ok &&
      data.ok === true &&
      Number.isSafeInteger(data.result?.message_id)
    )
      return { entrega: "enviado" };
    if (data.ok === false) {
      const delay = data.parameters?.retry_after;
      return {
        entrega: "fallido",
        reintentarEn:
          typeof delay === "number" && Number.isFinite(delay)
            ? Math.max(5 * MINUTO, Math.min(delay * 1000, 86400000))
            : 5 * MINUTO,
      };
    }
    return { entrega: "incierto" };
  } catch {
    return { entrega: "incierto" };
  }
}
type OpcionesCiclo = {
  ahora?: number;
  consultar?: typeof leerSaludOperativa;
  enviar?: typeof enviarTelegramSalud;
};
function habilitado() {
  return (
    process.env.COOPER_OBSERVABILIDAD_PAUSA !== "1" &&
    process.env.COOPER_DEMO !== "1" &&
    process.env.COOPER_FABRICA === "n8n"
  );
}
function textoAviso(salud: SaludOperativa) {
  if (!salud.alertas.length)
    return "Cooper: las alertas observadas se han resuelto. Revisa Salud operativa en la web.";
  return (
    "Cooper · Salud operativa\n" +
    salud.alertas.map((a) => `${a.titulo}: ${a.detalle}`).join("\n") +
    "\nRevisa Salud operativa en la web."
  );
}
export async function cicloAlertasSalud(options: OpcionesCiclo = {}) {
  if (!habilitado()) return;
  const user = db()
    .select()
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true)))
    .get();
  if (!user) return;
  try {
    administrador(user);
  } catch {
    return;
  }
  const now = options.ahora ?? Date.now();
  const config = leerConfiguracionSalud(user);
  if (!config.telegramActivo) return;
  const lease = randomUUID();
  const reserved = db().transaction(
    () => {
      const current = estado();
      if (current.leaseHasta > now || current.siguiente > now) return false;
      // La espera del transporte no detiene la evaluación de incidentes nuevos.
      guardarEstado(user, { ...current, lease, leaseHasta: now + 120000 });
      return true;
    },
    { behavior: "immediate" },
  );
  if (!reserved) return;
  try {
    const salud = await (options.consultar ?? leerSaludOperativa)(
      user,
      config.umbrales,
    );
    administrador(user);
    if (
      !habilitado() ||
      leerConfiguracionSalud(user).revision !== config.revision
    )
      return;
    const current = estado();
    if (
      current.lease !== lease ||
      current.leaseHasta <= (options.ahora ?? Date.now())
    )
      return;
    const codes = [
      ...new Set(salud.alertas.map((a) => `${a.codigo}:${a.severidad}`)),
    ].sort();
    const changed =
      JSON.stringify(codes) !== JSON.stringify(current.notificados);
    const uncertainChange =
      current.entrega === "incierto" &&
      JSON.stringify(codes) !== JSON.stringify(current.intentados);
    const due =
      now - Math.max(current.enviado, current.intento) >=
      config.recordatorioMinutos * MINUTO;
    const send =
      changed ||
      uncertainChange ||
      ((codes.length > 0 || current.avisoPosible) && due) ||
      current.entrega === "fallido";
    guardarEstado(user, {
      ...current,
      evaluado: now,
      pendientes: codes,
      siguiente: now + MINUTO,
    });
    if (
      !send ||
      (!codes.length && !current.notificados.length && !current.avisoPosible)
    )
      return;
    // 429 respeta su plazo incluso si se cambia la configuración. Un incidente
    // distinto sí puede avisarse tras un timeout, sin repetir el mismo estado.
    if (
      current.proximoEnvio > now &&
      (current.entrega === "fallido" ||
        (current.entrega === "incierto" && !uncertainChange))
    )
      return;
    // Estado durable antes de HTTP. El resultado tardío solo escribe con su reserva.
    guardarEstado(user, {
      ...estado(),
      intento: now,
      entrega: "incierto",
      intentados: codes,
      avisoPosible: current.avisoPosible || codes.length > 0,
      proximoEnvio: now + config.recordatorioMinutos * MINUTO,
    });
    const result = await (options.enviar ?? enviarTelegramSalud)(
      textoAviso(salud),
    );
    db().transaction(
      () => {
        const latest = estado();
        if (latest.lease !== lease) return;
        guardarEstado(user, {
          ...latest,
          entrega: result.entrega,
          enviado: result.entrega === "enviado" ? now : latest.enviado,
          notificados:
            result.entrega === "enviado" ? codes : latest.notificados,
          avisoPosible:
            result.entrega === "enviado"
              ? codes.length > 0
              : result.entrega === "fallido"
                ? current.avisoPosible
                : latest.avisoPosible,
          proximoEnvio:
            result.entrega === "enviado"
              ? 0
              : now +
                (result.entrega === "fallido"
                  ? (result.reintentarEn ?? 5 * MINUTO)
                  : config.recordatorioMinutos * MINUTO),
        });
      },
      { behavior: "immediate" },
    );
  } finally {
    db().transaction(
      () => {
        const latest = estado();
        if (latest.lease === lease)
          guardarEstado(user, {
            ...latest,
            lease: "",
            leaseHasta: 0,
            siguiente: Math.max(latest.siguiente, now + MINUTO),
          });
      },
      { behavior: "immediate" },
    );
  }
}

const globals = globalThis as typeof globalThis & {
  cooperSaludTimer?: ReturnType<typeof setInterval>;
};
export function iniciarAlertasSalud() {
  if (globals.cooperSaludTimer || !habilitado()) return;
  let busy = false;
  globals.cooperSaludTimer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await cicloAlertasSalud();
    } catch {
      /* El panel conserva la fecha vencida; nunca registrar errores privados. */
    } finally {
      busy = false;
    }
  }, MINUTO);
  globals.cooperSaludTimer.unref();
}
