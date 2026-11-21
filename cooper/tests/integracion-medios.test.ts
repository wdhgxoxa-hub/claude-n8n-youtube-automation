import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users, assets, attachments } from "@/db/schema";
import {
  crearMedio,
  crearReto,
  sincronizarMedios,
  eliminarMedio,
} from "@/servicios/biblioteca";
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
it("I02 una voz no admite fotos aunque todas sean propias", async () => {
  const user = owner();
  const file = (mime: string) => {
    const id = randomUUID();
    db()
      .insert(attachments)
      .values({
        id,
        ownerId: user.id,
        name: "Ficticio",
        mime,
        data: "YWJjZA==",
        size: 4,
      })
      .run();
    return id;
  };
  await expect(
    crearMedio(user, {
      kind: "voz",
      name: "Ensayo",
      challengeId: crearReto(user, "voz").id,
      evidenceId: file("audio/wav"),
      photoIds: [file("image/png")],
      placement: "partes",
      consentimiento: true,
    }),
  ).rejects.toMatchObject({ status: 400 });
});
it("I04 un sondeo tardío no vuelve a habilitar un activo cuyo borrado falló", async () => {
  const user = owner(),
    id = randomUUID();
  db()
    .insert(assets)
    .values({
      id,
      ownerId: user.id,
      kind: "avatar",
      name: "Ensayo",
      evidenceId: "ficticio",
      provider: "heygen",
      providerId: "look-test",
      status: "entrenando",
      simulated: false,
      verified: true,
      polledAt: 0,
      createdAt: Date.now(),
    })
    .run();
  vi.stubEnv("HEYGEN_API_KEY", "ficticia");
  let release!: (r: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (init?.method === "DELETE") return new Response(null, { status: 503 });
      return new Promise<Response>((r) => {
        release = r;
      });
    }),
  );
  const sync = sincronizarMedios(user);
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  await expect(eliminarMedio(user, id)).rejects.toThrow();
  release(
    Response.json({
      data: { id: "look-test", name: "Ensayo", status: "completed" },
    }),
  );
  await sync;
  const a = db().select().from(assets).where(eq(assets.id, id)).get()!;
  expect(a.verified).toBe(false);
  expect(a.shared).toBe(false);
  expect(a.status).not.toBe("listo");
});

it("I06 el catálogo público no expone proveedores ni identificadores remotos", async () => {
  const { publicMedia } = await import("@/db/schema");
  const { catalogo, medioDisponible } = await import("@/servicios/biblioteca");
  const user = owner();
  vi.stubEnv("COOPER_AVATAR", "heygen");
  vi.stubEnv("COOPER_VOZ_CATALOGO", "gemini");
  db()
    .insert(publicMedia)
    .values({
      id: "heygen:remoto-ficticio",
      providerId: "remoto-ficticio",
      name: "Presentador",
      previewUrl: "https://files.heygen.ai/ficticio.mp4",
      updatedAt: Date.now(),
    })
    .run();
  const items = catalogo();
  expect(JSON.stringify(items)).not.toMatch(
    /heygen|gemini|remoto-ficticio|files\.heygen/,
  );
  const item = items.find((i) => i.name === "Presentador")!;
  expect(medioDisponible(user, item.id, "avatar")).toMatchObject({
    proveedor: "heygen",
    id: "remoto-ficticio",
  });
});
