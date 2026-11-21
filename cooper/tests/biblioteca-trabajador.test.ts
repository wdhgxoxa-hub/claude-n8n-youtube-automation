import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, allowedEmails, users, type Asset } from "@/db/schema";
import {
  cicloBiblioteca,
  reservarMedio,
  iniciarBiblioteca,
  detenerBiblioteca,
} from "@/servicios/biblioteca-trabajador";
import { eliminarMedio, medioDisponible } from "@/servicios/biblioteca";
import { revocarConsentimiento } from "@/servicios/presentacion";
import type { TrabajoMedio } from "@/servicios/proveedores/tipos";

let owner: typeof users.$inferSelect;
const hijos: ChildProcess[] = [];
beforeEach(() => {
  db().delete(assets).run();
  const id = randomUUID();
  owner = db()
    .insert(users)
    .values({ id, name: "Ensayo M07", email: `${id}@example.test` })
    .returning()
    .get();
  db()
    .insert(allowedEmails)
    .values({ email: owner.email, createdAt: Date.now() })
    .run();
});
afterEach(async () => {
  detenerBiblioteca();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  for (const child of hijos.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await once(child, "exit");
    }
  }
});
function activo(extra: Partial<Asset> = {}) {
  const id = randomUUID();
  return db()
    .insert(assets)
    .values({
      id,
      ownerId: owner.id,
      kind: "avatar",
      name: "Material ficticio",
      evidenceId: "ficticio",
      providerId: id,
      status: "entrenando",
      verified: true,
      consentAt: Date.now(),
      createdAt: Date.now(),
      ...extra,
    })
    .returning()
    .get();
}
const leer = (id: string) =>
  db().select().from(assets).where(eq(assets.id, id)).get();
function diferida() {
  let resolve!: (t: TrabajoMedio) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<TrabajoMedio>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function hijo(mode: string, now = Date.now()) {
  const child = fork(
    "tests/fixtures/biblioteca-proceso.ts",
    [mode, String(now)],
    {
      execArgv: ["--import", "tsx"],
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    },
  );
  hijos.push(child);
  return { child, mensaje: once(child, "message") };
}

it("dos procesos compiten por la misma reserva SQLite y solo uno la obtiene", async () => {
  activo();
  const a = hijo("reservar"),
    b = hijo("reservar");
  const results = await Promise.all([a.mensaje, b.mensaje]);
  expect(results.map(([m]) => m.reservado).sort()).toEqual([false, true]);
}, 15000);

it("recupera tras SIGKILL en plena consulta y reinicio sin crear ni entrenar otra vez", async () => {
  const a = activo();
  const muerto = hijo("caer");
  expect((await muerto.mensaje)[0]).toEqual({ consultando: true });
  const lease = leer(a.id)!;
  muerto.child.kill("SIGKILL");
  await once(muerto.child, "exit");
  const antes = hijo("ciclo", lease.pollLeaseUntil - 1);
  expect((await antes.mensaje)[0]).toEqual({ consultas: 0 });
  const reiniciado = hijo("ciclo", lease.pollLeaseUntil + 1);
  expect((await reiniciado.mensaje)[0]).toEqual({ consultas: 1 });
  expect(leer(a.id)).toMatchObject({
    status: "listo",
    providerId: a.providerId,
    pollLease: "",
  });
}, 15000);

it("el temporizador avanza avatar y voz sin navegador ni SSE y arranca una sola vez", async () => {
  vi.useFakeTimers();
  const a = activo(),
    v = activo({ kind: "voz" });
  iniciarBiblioteca();
  iniciarBiblioteca();
  await vi.advanceTimersByTimeAsync(1);
  expect(leer(a.id)?.status).toBe("listo");
  expect(leer(v.id)?.status).toBe("listo");
  expect(vi.getTimerCount()).toBe(1);
  expect(fetch).not.toHaveBeenCalled();
});

it.each(["avatar", "voz"] as const)(
  "consulta %s simulado desde el primer segundo, sin saltar la reserva",
  async (kind) => {
    vi.useFakeTimers();
    const a = activo({ kind, polledAt: Date.now() });
    const respuesta = diferida();
    const consultar = vi.fn(() => respuesta.promise);
    await vi.advanceTimersByTimeAsync(999);
    await cicloBiblioteca({ consultar });
    expect(consultar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const ciclo = cicloBiblioteca({ consultar });
    await cicloBiblioteca({ consultar });
    expect(consultar).toHaveBeenCalledTimes(1);
    respuesta.resolve({ id: a.providerId, estado: "listo" });
    await ciclo;
    expect(leer(a.id)?.status).toBe("listo");
    expect(fetch).not.toHaveBeenCalled();
  },
);

it.each([false, true])(
  "conserva diez segundos para el adaptador remoto aunque simulated sea %s",
  async (simulated) => {
    vi.useFakeTimers();
    const a = activo({
      provider: "heygen",
      simulated,
      reviewedAt: Date.now(),
      reviewedBy: owner.id,
      polledAt: Date.now(),
    });
    const consultar = vi.fn(async (): Promise<TrabajoMedio> => ({
      id: a.providerId,
      estado: "entrenando",
    }));
    await vi.advanceTimersByTimeAsync(9999);
    await cicloBiblioteca({ consultar });
    expect(consultar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await cicloBiblioteca({ consultar });
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(leer(a.id)?.pollNextAt).toBe(Date.now() + 10000);
    expect(fetch).not.toHaveBeenCalled();
  },
);

it("el temporizador recoge una simulación recién creada sin sumar diez segundos de API", async () => {
  vi.useFakeTimers();
  iniciarBiblioteca();
  await vi.advanceTimersByTimeAsync(4999);
  const a = activo({ kind: "voz", polledAt: Date.now() });
  await vi.advanceTimersByTimeAsync(1);
  expect(leer(a.id)?.status).toBe("entrenando");
  await vi.advanceTimersByTimeAsync(5000);
  expect(leer(a.id)?.status).toBe("listo");
  expect(fetch).not.toHaveBeenCalled();
});

it("excluye el mismo recurso entre ciclos concurrentes y limita cada lote a dos", async () => {
  const a = activo();
  const respuesta = diferida();
  const consultar = vi.fn(() => respuesta.promise);
  const primero = cicloBiblioteca({ consultar });
  await cicloBiblioteca({ consultar });
  expect(consultar).toHaveBeenCalledTimes(1);
  respuesta.resolve({ id: a.providerId, estado: "listo" });
  await primero;
  for (let i = 0; i < 5; i++) activo();
  const rapido = vi.fn(
    async (r: { providerId: string }): Promise<TrabajoMedio> => ({
      id: r.providerId,
      estado: "listo",
    }),
  );
  await cicloBiblioteca({ consultar: rapido });
  expect(rapido).toHaveBeenCalledTimes(2);
});

it("persiste backoff creciente hasta 30 minutos y lo reinicia al recuperar", async () => {
  vi.useFakeTimers();
  const a = activo();
  const consultar = vi.fn(async (): Promise<TrabajoMedio> => {
    throw new Error("dato privado remoto");
  });
  for (let i = 1; i <= 8; i++) {
    const now = Date.now();
    await cicloBiblioteca({ consultar });
    const row = leer(a.id)!;
    expect(row).toMatchObject({
      status: "entrenando",
      syncError: true,
      pollFailures: i,
    });
    expect(row.pollNextAt - now).toBe(Math.min(30000 * 2 ** (i - 1), 1800000));
    await cicloBiblioteca({ consultar });
    expect(consultar).toHaveBeenCalledTimes(i);
    vi.setSystemTime(row.pollNextAt);
  }
  await cicloBiblioteca();
  expect(leer(a.id)).toMatchObject({
    status: "listo",
    syncError: false,
    pollFailures: 0,
  });
});

it("acota una consulta atascada y descarta su respuesta tardía", async () => {
  vi.useFakeTimers();
  const a = activo();
  const respuesta = diferida();
  const ciclo = cicloBiblioteca({ consultar: () => respuesta.promise });
  await vi.advanceTimersByTimeAsync(35000);
  await ciclo;
  expect(leer(a.id)).toMatchObject({
    status: "entrenando",
    syncError: true,
    pollLease: "",
  });
  respuesta.resolve({ id: a.providerId, estado: "listo" });
  await Promise.resolve();
  expect(leer(a.id)?.status).toBe("entrenando");
});

it("una respuesta de reserva vencida no sobrescribe el resultado del siguiente trabajador", async () => {
  vi.useFakeTimers();
  const a = activo();
  const respuesta = diferida();
  const primero = cicloBiblioteca({ consultar: () => respuesta.promise });
  vi.setSystemTime(Date.now() + 60001);
  await cicloBiblioteca();
  respuesta.resolve({ id: a.providerId, estado: "error" });
  await primero;
  expect(leer(a.id)?.status).toBe("listo");
});

it.each(["revocar", "borrar", "suspender", "retirar", "cambiar-id"])(
  "revalida al finalizar una consulta concurrente con %s",
  async (accion) => {
    const a = activo();
    const respuesta = diferida();
    const ciclo = cicloBiblioteca({ consultar: () => respuesta.promise });
    if (accion === "revocar") revocarConsentimiento(owner, a.id);
    if (accion === "borrar") await eliminarMedio(owner, a.id);
    if (accion === "suspender")
      db()
        .update(users)
        .set({ active: false })
        .where(eq(users.id, owner.id))
        .run();
    if (accion === "retirar")
      db()
        .delete(allowedEmails)
        .where(eq(allowedEmails.email, owner.email))
        .run();
    if (accion === "cambiar-id")
      db()
        .update(assets)
        .set({ providerId: "otro-id" })
        .where(eq(assets.id, a.id))
        .run();
    respuesta.resolve({
      id: a.providerId,
      estado: "listo",
      previewUrl: "https://files.heygen.ai/ficticio.mp4",
    });
    await ciclo;
    expect(leer(a.id)?.status).not.toBe("listo");
    expect(leer(a.id)?.previewUrl ?? "").toBe("");
    if (["revocar", "borrar"].includes(accion))
      expect(() => medioDisponible(owner, a.id, "avatar")).toThrow();
  },
);

it("no consulta ni reenvía faltantes de ID, estados inciertos, revocados o identidades sin revisión", async () => {
  for (const extra of [
    { providerId: "" },
    { status: "iniciando" as const },
    { status: "error" as const },
    { status: "revision" as const },
    { verified: false },
    { consentAt: 0 },
    { consentRevokedAt: Date.now() },
    { simulated: false, provider: "heygen", reviewedAt: 0 },
  ])
    activo(extra);
  const consultar = vi.fn();
  await cicloBiblioteca({ consultar });
  expect(consultar).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it("respeta verificación del proveedor, pausa global y ámbito del dueño", async () => {
  vi.useFakeTimers();
  const a = activo({ kind: "voz", status: "verificacion_proveedor" });
  const consultar = vi.fn(async (): Promise<TrabajoMedio> => ({
    id: a.providerId,
    estado: "verificacion_proveedor",
  }));
  await cicloBiblioteca({ ownerId: "ajeno", consultar });
  vi.stubEnv("COOPER_BIBLIOTECA_PAUSA", "1");
  expect(reservarMedio()).toBeUndefined();
  await cicloBiblioteca({ consultar });
  expect(consultar).not.toHaveBeenCalled();
  vi.stubEnv("COOPER_BIBLIOTECA_PAUSA", "0");
  await cicloBiblioteca({ ownerId: owner.id, consultar });
  expect(leer(a.id)?.pollNextAt).toBe(Date.now() + 300000);
  expect(() => medioDisponible(owner, a.id, "voz")).toThrow();
});

it("rechaza un ID remoto distinto sin cambiar el recurso y termina el sondeo de errores definitivos", async () => {
  vi.useFakeTimers();
  const a = activo();
  await cicloBiblioteca({
    consultar: async () => ({ id: "ajeno", estado: "listo" }),
  });
  expect(leer(a.id)).toMatchObject({
    status: "entrenando",
    providerId: a.providerId,
    syncError: true,
  });
  vi.setSystemTime(leer(a.id)!.pollNextAt);
  await cicloBiblioteca({
    consultar: async () => ({ id: a.providerId, estado: "error" }),
  });
  const consultar = vi.fn();
  vi.setSystemTime(Date.now() + 3600000);
  await cicloBiblioteca({ consultar });
  expect(consultar).not.toHaveBeenCalled();
});
