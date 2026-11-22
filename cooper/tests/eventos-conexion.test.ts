import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { allowedEmails, events, users, type User } from "@/db/schema";
import { loginGoogle } from "@/lib/identidad";
import { ErrorHttp } from "@/lib/permisos";

const mocks = vi.hoisted(() => ({ sincronizar: vi.fn() }));
let active: User;
let revoked = false;
vi.mock("@/lib/sesion", () => ({
  currentUser: async () => {
    if (revoked) throw new ErrorHttp(401, "Sesión revocada");
    return active;
  },
}));
vi.mock("@/servicios/fabrica", () => ({
  fabrica: () => ({ sincronizar: mocks.sincronizar }),
}));
import { GET, HEAD } from "@/app/api/eventos/route";

const aborters: AbortController[] = [];
const pending: Array<() => void> = [];

function bloquearFabrica() {
  let resolve!: () => void;
  mocks.sincronizar.mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  pending.push(() => resolve?.());
  return () => resolve();
}

async function abrir(query = "", headers?: HeadersInit) {
  const aborter = new AbortController();
  aborters.push(aborter);
  const response = await GET(
    new Request(`http://localhost/api/eventos${query}`, {
      signal: aborter.signal,
      headers,
    }),
  );
  const chunks: string[] = [];
  let ended = false;
  const reader = response.body!.getReader();
  const drain = (async () => {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      chunks.push(new TextDecoder().decode(chunk.value));
    }
    ended = true;
  })();
  await vi.advanceTimersByTimeAsync(0);
  return { response, chunks, aborter, drain, ended: () => ended };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("COOPER_FABRICA", "n8n");
  vi.stubEnv("COOPER_DEMO", "0");
  revoked = false;
  mocks.sincronizar.mockReset().mockResolvedValue(undefined);
  db().delete(events).run();
  db().delete(users).run();
  db().delete(allowedEmails).run();
  const email = `${randomUUID()}@example.test`;
  db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  active = loginGoogle(email, "Conexión de ensayo");
});

afterEach(async () => {
  for (const aborter of aborters.splice(0)) aborter.abort();
  for (const resolve of pending.splice(0)) resolve();
  await vi.advanceTimersByTimeAsync(0);
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it("abre SSE y entrega la proyección local mientras n8n sigue esperando", async () => {
  bloquearFabrica();
  const stream = await abrir();
  expect(stream.response.status).toBe(200);
  expect(stream.chunks[0]).toBe("event: latido\ndata: {}\n\n");
  expect(stream.chunks.join("")).toContain("event: estado");
  expect(stream.response.headers.get("cache-control")).toContain(
    "no-transform",
  );
  expect(stream.response.headers.get("x-accel-buffering")).toBe("no");
  expect(mocks.sincronizar).toHaveBeenCalledOnce();
});

it("mantiene latidos y recibe progreso local sin esperar a la conciliación remota", async () => {
  bloquearFabrica();
  const stream = await abrir();
  const eventId = randomUUID();
  db()
    .insert(events)
    .values({
      id: eventId,
      ownerId: active.id,
      type: "progreso",
      payload: '{"id":"video-propio"}',
      createdAt: Date.now(),
    })
    .run();
  await vi.advanceTimersByTimeAsync(31000);
  expect(
    stream.chunks.filter((chunk) => chunk.includes("event: latido")),
  ).toHaveLength(3);
  expect(stream.chunks.join("")).toContain(`id: ${eventId}`);
  expect(stream.ended()).toBe(false);
  expect(mocks.sincronizar).toHaveBeenCalledOnce();
});

it("revoca una sesión mientras la fábrica espera, sin emitir nuevos datos privados", async () => {
  const complete = bloquearFabrica();
  const stream = await abrir();
  const before = stream.chunks.length;
  revoked = true;
  await vi.advanceTimersByTimeAsync(2000);
  expect(stream.ended()).toBe(true);
  expect(stream.chunks.slice(before).join("")).toBe(
    "event: sesion-finalizada\ndata: {}\n\n",
  );
  complete();
  await vi.advanceTimersByTimeAsync(60000);
  expect(stream.chunks.slice(before).join("")).not.toContain("event: estado");
  expect(mocks.sincronizar).toHaveBeenCalledOnce();
});

it("un 401 remoto no expulsa al usuario y conserva el progreso local", async () => {
  mocks.sincronizar.mockRejectedValue(
    new ErrorHttp(401, "detalle-privado-ficticio"),
  );
  const stream = await abrir();
  await vi.advanceTimersByTimeAsync(16000);
  const text = stream.chunks.join("");
  expect(text).toContain("event: fallo");
  expect(text).toContain("event: estado");
  expect(text).toContain("event: latido");
  expect(text).not.toContain("detalle-privado-ficticio");
  expect(text).not.toContain("sesion-finalizada");
  expect(stream.ended()).toBe(false);
  expect(mocks.sincronizar).toHaveBeenCalledOnce();
});

it("cancelar libera todos los temporizadores y los cuatro cupos aun con n8n pendiente", async () => {
  bloquearFabrica();
  const stream = await abrir();
  stream.aborter.abort();
  await stream.drain;
  expect(vi.getTimerCount()).toBe(0);
  mocks.sincronizar.mockResolvedValue(undefined);
  const responses: Response[] = [];
  try {
    for (let index = 0; index < 5; index++)
      responses.push(await GET(new Request("http://localhost/api/eventos")));
    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200, 429,
    ]);
  } finally {
    for (const response of responses) await response.body?.cancel();
  }
  expect(vi.getTimerCount()).toBe(0);
});

it("un lector detenido mantiene una cola acotada", async () => {
  const response = await GET(new Request("http://localhost/api/eventos"));
  await vi.advanceTimersByTimeAsync(120000);
  const reader = response.body!.getReader();
  try {
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(
      "event: latido\ndata: {}\n\n",
    );
    let second = false;
    const next = reader.read().then(() => {
      second = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(second).toBe(false);
    await reader.cancel();
    await next;
  } finally {
    await reader.cancel();
  }
});

it("la sonda HEAD revalida permisos sin fábrica ni cupo SSE", async () => {
  for (let index = 0; index < 6; index++) {
    const response = await HEAD();
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-store");
  }
  expect(mocks.sincronizar).not.toHaveBeenCalled();
  revoked = true;
  expect((await HEAD()).status).toBe(401);
  const response = await GET(new Request("http://localhost/api/eventos"));
  expect(response.status).toBe(401);
  expect(await response.text()).not.toContain("event:");
});

function registrarProgreso(ownerId: string, createdAt: number) {
  const id = randomUUID();
  db()
    .insert(events)
    .values({
      id,
      ownerId,
      type: "progreso",
      payload: JSON.stringify({ id }),
      createdAt,
    })
    .run();
  return id;
}

it("retoma desde el cursor propio de la URL y conserva Last-Event-ID nativo", async () => {
  const first = registrarProgreso(active.id, Date.now() - 3000);
  const second = registrarProgreso(active.id, Date.now() - 2000);
  const third = registrarProgreso(active.id, Date.now() - 1000);
  const resumed = await abrir(`?ultimoEvento=${encodeURIComponent(second)}`);
  await vi.advanceTimersByTimeAsync(1000);
  const text = resumed.chunks.join("");
  expect(text).toContain(`id: ${third}\n`);
  expect(text).not.toContain(`id: ${first}\n`);
  expect(text).not.toContain(`id: ${second}\n`);
  expect(text).toContain("event: estado");
  resumed.aborter.abort();
  await resumed.drain;

  const native = await abrir(`?ultimoEvento=${first}`, {
    "last-event-id": third,
  });
  expect(native.chunks.join("")).not.toContain("event: progreso");
  expect(native.chunks.join("")).toContain("event: estado");
});

it.each(["ajeno", "inexistente", "malformado", "largo"])(
  "ignora un cursor %s sin ampliar el acceso al historial",
  async (kind) => {
    const own = registrarProgreso(active.id, Date.now() - 2000);
    const foreignEmail = `${randomUUID()}@example.test`;
    db()
      .insert(allowedEmails)
      .values({ email: foreignEmail, createdAt: Date.now() })
      .run();
    const foreignUser = loginGoogle(foreignEmail, "Otra persona");
    const foreign = registrarProgreso(foreignUser.id, Date.now() - 1000);
    const cursor = {
      ajeno: foreign,
      inexistente: randomUUID(),
      malformado: "cursor-no-valido",
      largo: "a".repeat(129),
    }[kind]!;
    const stream = await abrir(`?ultimoEvento=${encodeURIComponent(cursor)}`);
    await vi.advanceTimersByTimeAsync(1000);
    const text = stream.chunks.join("");
    expect(text).toContain(`id: ${own}\n`);
    expect(text).not.toContain(foreign);
    expect(text).not.toContain(foreignUser.email);
    expect(text).toContain("event: estado");
  },
);

it("el administrador retoma eventos del mismo equipo que su stream ya autoriza", async () => {
  const own = registrarProgreso(active.id, Date.now() - 3000);
  const colleagueEmail = `${randomUUID()}@example.test`;
  db()
    .insert(allowedEmails)
    .values({ email: colleagueEmail, createdAt: Date.now() })
    .run();
  const colleague = loginGoogle(colleagueEmail, "Integrante del equipo");
  const cursor = registrarProgreso(colleague.id, Date.now() - 2000);
  const next = registrarProgreso(colleague.id, Date.now() - 1000);
  active = { ...active, role: "admin" };
  const stream = await abrir(`?ultimoEvento=${cursor}`);
  await vi.advanceTimersByTimeAsync(1000);
  const text = stream.chunks.join("");
  expect(text).not.toContain(`id: ${own}\n`);
  expect(text).not.toContain(`id: ${cursor}\n`);
  expect(text).toContain(`id: ${next}\n`);
  expect(text).toContain("event: estado");
});

function progresoRecibido(chunks: string[]) {
  return [...chunks.join("").matchAll(/^id: ([\da-f-]+)$/gm)].map(
    (match) => match[1],
  );
}

it("un historial de mil eventos entrega estado desde el primer tick y avanza cien por tick", async () => {
  vi.stubEnv("COOPER_SIMULACION_MS", "2000");
  const ids = db().transaction(() =>
    Array.from({ length: 1000 }, (_, index) =>
      registrarProgreso(active.id, Date.now() - 1000 + index),
    ),
  );
  const stream = await abrir();
  expect(progresoRecibido(stream.chunks)).toEqual(ids.slice(0, 100));
  expect(stream.chunks.join("")).toContain("event: estado");
  for (let batch = 2; batch <= 10; batch++) {
    await vi.advanceTimersByTimeAsync(2000);
    expect(progresoRecibido(stream.chunks)).toEqual(ids.slice(0, batch * 100));
  }
  expect(
    stream.chunks.filter((chunk) => chunk.includes("event: estado")),
  ).toHaveLength(10);
});

it("más de cien eventos con la misma fecha avanzan sin duplicarse ni bloquearse", async () => {
  vi.stubEnv("COOPER_SIMULACION_MS", "2000");
  const ids = db()
    .transaction(() =>
      Array.from({ length: 250 }, () =>
        registrarProgreso(active.id, Date.now() - 1000),
      ),
    )
    .sort();
  const stream = await abrir();
  expect(progresoRecibido(stream.chunks)).toEqual(ids.slice(0, 100));
  await vi.advanceTimersByTimeAsync(2000);
  expect(progresoRecibido(stream.chunks)).toEqual(ids.slice(0, 200));
  await vi.advanceTimersByTimeAsync(2000);
  expect(progresoRecibido(stream.chunks)).toEqual(ids);
  await vi.advanceTimersByTimeAsync(2000);
  expect(progresoRecibido(stream.chunks)).toEqual(ids);
  expect(
    stream.chunks.filter((chunk) => chunk.includes("event: estado")),
  ).toHaveLength(4);
});

it("la contrapresión conserva el cursor hasta que el consumidor acepta un lote", async () => {
  vi.stubEnv("COOPER_SIMULACION_MS", "2000");
  const ids = db().transaction(() =>
    Array.from({ length: 150 }, (_, index) =>
      registrarProgreso(active.id, Date.now() - 1000 + index),
    ),
  );
  const aborter = new AbortController();
  aborters.push(aborter);
  const response = await GET(
    new Request("http://localhost/api/eventos", { signal: aborter.signal }),
  );
  await vi.advanceTimersByTimeAsync(6000);
  const reader = response.body!.getReader();
  expect(new TextDecoder().decode((await reader.read()).value)).toBe(
    "event: latido\ndata: {}\n\n",
  );
  const next = reader.read();
  await vi.advanceTimersByTimeAsync(2000);
  const chunk = new TextDecoder().decode((await next).value);
  expect(progresoRecibido([chunk])).toEqual(ids.slice(0, 100));
  expect(chunk).toContain("event: estado");
  await reader.cancel();
});
