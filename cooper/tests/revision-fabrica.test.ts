import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videos, type User } from "@/db/schema";
import { loginGoogle } from "@/lib/identidad";
import { FabricaN8n, FabricaSimulada } from "@/servicios/fabrica";
let user: User, channel: string;
beforeAll(async () => {
  user = loginGoogle("admin@example.test", "Ensayo");
  channel = (
    await new FabricaSimulada().ejecutar(user, {
      evento: "nuevo_canal",
      texto: "Prueba HTTP aislada",
    })
  ).id;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("R10 serializa dos aprobaciones HTTP y una sincronización en vuelo", async () => {
  const id = (
    await new FabricaSimulada().ejecutar(user, {
      evento: "nuevo_video",
      texto: "Carrera",
      recursoId: channel,
    })
  ).id;
  db().update(videos).set({ stage: 3 }).where(eq(videos.id, id)).run();
  vi.stubEnv("COOPER_N8N_URL", "https://fabrica.example.test/ensayo");
  vi.stubEnv("COOPER_N8N_TOKEN", "valor-ficticio");
  let release!: (value: Response) => void;
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      const event = JSON.parse(options.body).evento;
      calls.push(event);
      if (event === "estado")
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      return Response.json({ aceptado: true });
    }),
  );
  const sync = new FabricaN8n().sincronizar(user);
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  const results = Promise.allSettled([
    new FabricaN8n().aprobar(user, id),
    new FabricaN8n().aprobar(user, id),
  ]);
  // El estado anterior responde después de las solicitudes de aprobación.
  await new Promise((resolve) => setTimeout(resolve, 20));
  release(Response.json({ videos: [{ id, stage: 3 }] }));
  await sync;
  const settled = await results;
  expect(calls.filter((event) => event === "aprobar")).toHaveLength(1);
  expect(
    settled.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(db().select().from(videos).where(eq(videos.id, id)).get()?.stage).toBe(
    4,
  );
});
