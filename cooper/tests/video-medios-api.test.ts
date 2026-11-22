import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { channels, users, videos, videoMedios } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ErrorHttp } from "@/lib/permisos";
import { currentUser } from "@/lib/sesion";
import { after } from "next/server";
import { GET } from "@/app/api/videos/[id]/medios/route";
import { GET as asset } from "@/app/api/videos/[id]/medios/[tipo]/route";

vi.mock("@/lib/sesion", () => ({ currentUser: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
beforeEach(() => vi.mocked(after).mockReset());
function preparar() {
  const id = randomUUID();
  const user = db()
    .insert(users)
    .values({ id, email: `${id}@example.test`, name: "Ana" })
    .returning()
    .get();
  db()
    .insert(channels)
    .values({ id, ownerId: id, name: "Canal", niche: "Ciencia", createdAt: 1 })
    .run();
  db()
    .insert(videos)
    .values({
      id,
      ownerId: id,
      channelId: id,
      title: "Historia",
      script: "Guion",
      createdAt: 1,
      updatedAt: 1,
    })
    .run();
  vi.mocked(currentUser).mockResolvedValue(user);
  return { id, user };
}

it("exige sesión y no encola trabajo ni revela archivos ante 401/404", async () => {
  const { id } = preparar();
  vi.mocked(currentUser).mockRejectedValueOnce(
    new ErrorHttp(401, "Entra con tu cuenta para continuar."),
  );
  expect(
    (
      await GET(new Request("http://localhost/api/medios"), {
        params: Promise.resolve({ id }),
      })
    ).status,
  ).toBe(401);
  const otro = preparar().user;
  vi.mocked(currentUser).mockResolvedValue(otro);
  expect(
    (
      await GET(new Request("http://localhost/api/medios"), {
        params: Promise.resolve({ id }),
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await asset(new Request("http://localhost/api/medios/poster"), {
        params: Promise.resolve({ id, tipo: "poster" }),
      })
    ).status,
  ).toBe(404);
  expect(after).not.toHaveBeenCalled();
});

it("responde metadatos antes de generar y el asset revalida permisos incluso con ETag", async () => {
  const { id } = preparar();
  const response = await GET(new Request("http://localhost/api/medios"), {
    params: Promise.resolve({ id }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    version: 1,
    estado: "sin_medio",
    videoId: id,
  });
  expect(
    db().select().from(videoMedios).where(eq(videoMedios.videoId, id)).all(),
  ).toHaveLength(0);
  expect(after).toHaveBeenCalledTimes(1);
  const poster = await asset(
    new Request("http://localhost/api/medios/poster"),
    { params: Promise.resolve({ id, tipo: "poster" }) },
  );
  expect(poster.status).toBe(200);
  expect(poster.headers.get("vary")).toBe("Cookie");
  const etag = poster.headers.get("etag")!;
  const request = new Request("http://localhost/api/medios/poster", {
    headers: { "if-none-match": etag },
  });
  expect(
    (await asset(request, { params: Promise.resolve({ id, tipo: "poster" }) }))
      .status,
  ).toBe(304);
  vi.mocked(currentUser).mockRejectedValue(
    new ErrorHttp(401, "Sesión retirada."),
  );
  expect(
    (await asset(request, { params: Promise.resolve({ id, tipo: "poster" }) }))
      .status,
  ).toBe(401);
});
