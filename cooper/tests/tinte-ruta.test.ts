import { expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users, channels, videos, type User } from "@/db/schema";
import { ErrorHttp } from "@/lib/permisos";

const sesion = vi.hoisted(() => ({ user: undefined as User | undefined }));
vi.mock("@/lib/sesion", () => ({
  currentUser: async () => {
    if (!sesion.user) throw new ErrorHttp(401, "Inicia sesión para continuar.");
    return sesion.user;
  },
}));
import { GET } from "@/app/api/videos/[id]/tinte/route";

it("exige sesión, autoriza dueño/admin y solo responde color; ignora URL del cliente", async () => {
  const id = randomUUID();
  const user = db()
    .insert(users)
    .values({ id, email: `${id}@example.test`, name: "Ensayo" })
    .returning()
    .get();
  db()
    .insert(channels)
    .values({ id, ownerId: id, name: "Ensayo", niche: "Ensayo", createdAt: 1 })
    .run();
  db()
    .insert(videos)
    .values({
      id,
      ownerId: id,
      channelId: id,
      title: "Ensayo",
      script: "",
      updatedAt: 1,
      createdAt: 1,
    })
    .run();
  const request = new Request(
    `http://localhost/api/videos/${id}/tinte?url=https://127.0.0.1/privado`,
  );
  const context = { params: Promise.resolve({ id }) };
  sesion.user = undefined;
  expect((await GET(request, context)).status).toBe(401);
  sesion.user = { ...user, id: "otro-dueno-ficticio" };
  expect((await GET(request, context)).status).toBe(404);
  for (const permitido of [
    user,
    { ...user, id: "admin-ficticio", role: "admin" as const },
  ]) {
    sesion.user = permitido;
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ color: null });
  }
  expect(fetch).not.toHaveBeenCalled();
});
