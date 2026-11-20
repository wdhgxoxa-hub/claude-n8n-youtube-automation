import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videos, bridgeCommands, type User } from "@/db/schema";
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
      const body = JSON.parse(options.body);
      const event = body.evento;
      calls.push(event);
      if (event === "estado")
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      db()
        .update(bridgeCommands)
        .set({ confirmed: true })
        .where(eq(bridgeCommands.id, body.id_evento))
        .run();
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
  release(
    Response.json({
      canales: [],
      videos: [
        {
          id,
          stage: 3,
          canal_id: channel,
          dueno_email: user.email,
          titulo: "Carrera",
          script: "Guion",
          actualizado_en: 1,
        },
      ],
    }),
  );
  await sync;
  const settled = await results;
  expect(calls.filter((event) => event === "aprobar_guion")).toHaveLength(1);
  expect(
    settled.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(2);
  expect(db().select().from(videos).where(eq(videos.id, id)).get()?.stage).toBe(
    3,
  );
});
