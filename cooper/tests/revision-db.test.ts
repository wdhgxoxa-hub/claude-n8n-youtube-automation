import { expect, it } from "vitest";
import { Worker } from "node:worker_threads";
import { db } from "@/db";
import { loginGoogle } from "@/lib/identidad";
import { allowedEmails } from "@/db/schema";
it("R06 espera un escritor SQLite sin fallar al pasar de lectura a escritura", async () => {
  const email = "competencia@example.test";
  db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  const worker = new Worker(
    `
    const { parentPort, workerData } = require('node:worker_threads');
    const Database = require('better-sqlite3');
    const connection = new Database(workerData);
    connection.exec('BEGIN IMMEDIATE');
    parentPort.postMessage('ready');
    setTimeout(() => { connection.exec('COMMIT'); connection.close(); }, 250);
  `,
    { eval: true, workerData: process.env.COOPER_DATABASE_PATH },
  );
  await new Promise((resolve, reject) => {
    worker.once("message", resolve);
    worker.once("error", reject);
  });
  try {
    expect(() => loginGoogle(email, "Competencia")).not.toThrow();
  } finally {
    await worker.terminate();
  }
});
it("R06 conserva una sola aprobación bajo solicitudes simultáneas", async () => {
  const { FabricaSimulada } = await import("@/servicios/fabrica");
  const { videos, events } = await import("@/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const user = loginGoogle("competencia@example.test", "Competencia");
  const factory = new FabricaSimulada();
  const channel = await factory.ejecutar(user, {
    evento: "nuevo_canal",
    texto: "Ensayo",
  });
  const video = await factory.ejecutar(user, {
    evento: "nuevo_video",
    recursoId: channel.id,
    texto: "Ensayo",
  });
  db().update(videos).set({ stage: 3 }).where(eq(videos.id, video.id)).run();
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => factory.aprobar(user, video.id)),
  );
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(
    db()
      .select()
      .from(events)
      .where(and(eq(events.ownerId, user.id), eq(events.type, "aprobacion")))
      .all(),
  ).toHaveLength(1);
});
