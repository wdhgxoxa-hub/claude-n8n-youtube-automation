import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users, channels } from "@/db/schema";
import { Worker } from "node:worker_threads";
import { aplicarEstado } from "@/servicios/puente";
import { eq } from "drizzle-orm";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function owner() {
  const id = randomUUID();
  return db()
    .insert(users)
    .values({ id, email: `${id}@example.test`, name: "Ensayo", role: "admin" })
    .returning()
    .get();
}
it("I03 conciliación del puente espera al escritor SQLite antes de leer y modificar", async () => {
  const user = owner(),
    id = randomUUID();
  const worker = new Worker(
    `const { parentPort, workerData } = require('node:worker_threads'); const Database = require('better-sqlite3'); const db = new Database(workerData); db.exec('BEGIN IMMEDIATE'); parentPort.postMessage('ready'); setTimeout(() => { db.exec('COMMIT'); db.close(); }, 250);`,
    { eval: true, workerData: process.env.COOPER_DATABASE_PATH },
  );
  await new Promise((resolve, reject) => {
    worker.once("message", resolve);
    worker.once("error", reject);
  });
  try {
    expect(() =>
      aplicarEstado(user, {
        canales: [
          { id, dueno_email: user.email, nombre: "Ensayo", nicho: "Ciencia" },
        ],
        videos: [],
      }),
    ).not.toThrow();
  } finally {
    await worker.terminate();
  }
  expect(
    db().select().from(channels).where(eq(channels.id, id)).get()?.ownerId,
  ).toBe(user.id);
});
