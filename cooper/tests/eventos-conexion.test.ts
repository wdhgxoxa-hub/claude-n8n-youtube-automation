import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { allowedEmails, events, type User } from "@/db/schema";
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

async function abrir() {
  const aborter = new AbortController();
  aborters.push(aborter);
  const response = await GET(
    new Request("http://localhost/api/eventos", { signal: aborter.signal }),
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
