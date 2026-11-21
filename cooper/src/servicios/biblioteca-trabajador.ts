import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { allowedEmails, assets, users } from "@/db/schema";
import { proveedorAvatar, proveedorVoz } from "./proveedores";
import type { TrabajoMedio } from "./proveedores/tipos";

const INTERVALO = 10000;
// La simulación es local: no necesita el enfriamiento de la API remota.
// Conserva una transición observable antes de que el siguiente ciclo la consulte.
const INTERVALO_SIMULADO = 1000;
const RESERVA = 60000;
const LIMITE_CONSULTA = 35000;
const LOTE = 2;

// Igual que la sesión: dueño activo y permitido (incluido el administrador configurado).
function habilitado(ownerId?: string) {
  const owners = db()
    .select({ id: users.id })
    .from(users)
    .leftJoin(allowedEmails, eq(allowedEmails.email, users.email))
    .where(
      and(
        eq(users.active, true),
        or(
          eq(users.email, allowedEmails.email),
          eq(users.email, process.env.COOPER_ADMIN_EMAIL?.toLowerCase() ?? ""),
        ),
      ),
    );
  return and(
    ownerId ? eq(assets.ownerId, ownerId) : undefined,
    inArray(assets.ownerId, owners),
    eq(assets.verified, true),
    gt(assets.consentAt, 0),
    eq(assets.consentRevokedAt, 0),
    or(
      eq(assets.simulated, true),
      and(gt(assets.reviewedAt, 0), ne(assets.reviewedBy, "")),
    ),
    ne(assets.providerId, ""),
    inArray(assets.status, ["entrenando", "verificacion_proveedor"]),
  );
}

// El token distingue procesos y descarta respuestas de una reserva vencida.
// No se leen originales, grabaciones ni muestras para consultar el estado.
export function reservarMedio(ownerId?: string) {
  if (process.env.COOPER_BIBLIOTECA_PAUSA === "1") return;
  const now = Date.now();
  return db().transaction(
    (tx) => {
      const a = tx
        .select({
          id: assets.id,
          ownerId: assets.ownerId,
          kind: assets.kind,
          provider: assets.provider,
          simulated: assets.simulated,
          providerId: assets.providerId,
          status: assets.status,
          failures: assets.pollFailures,
        })
        .from(assets)
        .where(
          and(
            habilitado(ownerId),
            lte(assets.pollNextAt, now),
            lte(assets.pollLeaseUntil, now),
            or(
              lte(assets.polledAt, now - INTERVALO),
              and(
                eq(assets.simulated, true),
                eq(assets.provider, "simulada"),
                lte(assets.polledAt, now - INTERVALO_SIMULADO),
              ),
            ),
          ),
        )
        .orderBy(asc(assets.pollNextAt), asc(assets.polledAt), asc(assets.id))
        .limit(1)
        .get();
      if (!a) return;
      const token = randomUUID();
      tx.update(assets)
        .set({
          pollLease: token,
          pollLeaseUntil: now + RESERVA,
          polledAt: now,
        })
        .where(eq(assets.id, a.id))
        .run();
      return { ...a, token };
    },
    { behavior: "immediate" },
  );
}
type Reserva = NonNullable<ReturnType<typeof reservarMedio>>;
type Consultar = (a: Reserva) => Promise<TrabajoMedio>;
const consultarProveedor: Consultar = (a) =>
  (a.kind === "avatar"
    ? proveedorAvatar(a.provider)
    : proveedorVoz(a.provider)
  ).consultar(a.providerId);

function vigente(a: Reserva) {
  return and(
    eq(assets.id, a.id),
    eq(assets.ownerId, a.ownerId),
    eq(assets.pollLease, a.token),
    gt(assets.pollLeaseUntil, Date.now()),
    eq(assets.provider, a.provider),
    eq(assets.providerId, a.providerId),
    eq(assets.status, a.status),
    habilitado(),
  );
}
async function sondear(a: Reserva, consultar: Consultar) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (
      process.env.COOPER_BIBLIOTECA_PAUSA === "1" ||
      !db().select({ id: assets.id }).from(assets).where(vigente(a)).get()
    )
      return;
    // Los adaptadores abortan HTTP a los 30 s. El límite exterior también acota
    // un adaptador defectuoso; su resultado tardío nunca escribe en SQLite.
    const trabajo = await Promise.race([
      consultar(a),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Sondeo agotado")),
          LIMITE_CONSULTA,
        );
      }),
    ]);
    if (
      trabajo.id !== a.providerId ||
      !["entrenando", "verificacion_proveedor", "listo", "error"].includes(
        trabajo.estado,
      )
    )
      throw new Error("Respuesta incompatible");
    if (process.env.COOPER_BIBLIOTECA_PAUSA === "1") return;
    db()
      .update(assets)
      .set({
        status: trabajo.estado,
        previewUrl: trabajo.previewUrl ?? "",
        syncError: false,
        pollFailures: 0,
        pollNextAt:
          Date.now() +
          (trabajo.estado === "verificacion_proveedor"
            ? 300000
            : a.simulated && a.provider === "simulada"
              ? INTERVALO_SIMULADO
              : INTERVALO),
      })
      .where(vigente(a))
      .run();
  } catch {
    if (process.env.COOPER_BIBLIOTECA_PAUSA === "1") return;
    const failures = Math.min(a.failures + 1, 10);
    db()
      .update(assets)
      .set({
        syncError: true,
        pollFailures: failures,
        pollNextAt: Date.now() + Math.min(30000 * 2 ** (failures - 1), 1800000),
      })
      .where(vigente(a))
      .run();
  } finally {
    if (timer) clearTimeout(timer);
    db()
      .update(assets)
      .set({ pollLease: "", pollLeaseUntil: 0 })
      .where(and(eq(assets.id, a.id), eq(assets.pollLease, a.token)))
      .run();
  }
}

export async function cicloBiblioteca(
  options: { ownerId?: string; consultar?: Consultar } = {},
) {
  const tasks: Promise<void>[] = [];
  for (let i = 0; i < LOTE; i++) {
    const a = reservarMedio(options.ownerId);
    if (!a) break;
    tasks.push(sondear(a, options.consultar ?? consultarProveedor));
  }
  await Promise.all(tasks);
}

const globals = globalThis as typeof globalThis & {
  cooperBiblioteca?: { detener: () => void };
};
export function iniciarBiblioteca() {
  if (globals.cooperBiblioteca || process.env.COOPER_BIBLIOTECA_PAUSA === "1")
    return;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    try {
      await cicloBiblioteca();
    } catch {
      console.error("No se pudo actualizar la biblioteca de Cooper.");
    } finally {
      if (!stopped) {
        timer = setTimeout(tick, 5000);
        timer.unref();
      }
    }
  };
  globals.cooperBiblioteca = {
    detener: () => {
      stopped = true;
      clearTimeout(timer);
      delete globals.cooperBiblioteca;
    },
  };
  timer = setTimeout(tick, 0);
  timer.unref();
}
export function detenerBiblioteca() {
  globals.cooperBiblioteca?.detener();
}
