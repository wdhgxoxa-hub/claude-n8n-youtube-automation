import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { allowedEmails, chatSessions, users, type User } from "@/db/schema";
import { anotarMemoria, leerRecuerdos } from "@/servicios/chat/memoria";
let activa: User, ana: User, otro: User, admin: User;
vi.mock("@/lib/sesion", () => ({ currentUser: async () => activa }));
import { GET, DELETE } from "@/app/api/[...ruta]/route";
function persona(role: User["role"] = "usuario") {
  const id = randomUUID(),
    email = `${id}@example.test`;
  db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  return db()
    .insert(users)
    .values({ id, email, name: "HTTP memoria", role })
    .returning()
    .get();
}
function peticion(ruta: string, method = "GET", origin = "http://localhost") {
  return (method === "GET" ? GET : DELETE)(
    new Request(`http://localhost/api/${ruta}`, {
      method,
      headers: { origin },
    }),
    { params: Promise.resolve({ ruta: ruta.split("/") }) },
  );
}
beforeEach(() => {
  ana = persona();
  otro = persona();
  admin = persona("admin");
  activa = ana;
  anotarMemoria(ana, "", "Pendiente idea propia");
  anotarMemoria(otro, "", "Pendiente idea confidencial");
});
afterEach(() => vi.restoreAllMocks());
it("GET propio no filtra recuerdos ajenos; solo admin puede consultar otra persona", async () => {
  const propia = await peticion("memoria");
  expect(propia.status).toBe(200);
  expect(propia.headers.get("cache-control")).toContain("no-store");
  expect(await propia.text()).not.toContain("confidencial");
  expect((await peticion(`admin/memoria/${otro.id}`)).status).toBe(403);
  expect((await peticion(`memoria/${otro.id}`)).status).toBe(404);
  activa = admin;
  expect(await (await peticion(`admin/memoria/${otro.id}`)).text()).toContain(
    "confidencial",
  );
  expect(await (await peticion("estado")).text()).not.toContain("confidencial");
  expect((await peticion("admin/memoria/inexistente")).status).toBe(404);
});
it("DELETE solo borra al dueño y verifica origen, ruta y turno activo", async () => {
  expect(
    (await peticion("memoria", "DELETE", "https://otro.example.test")).status,
  ).toBe(403);
  expect((await peticion(`memoria/${otro.id}`, "DELETE")).status).toBe(404);
  db()
    .insert(chatSessions)
    .values({ ownerId: ana.id, busyUntil: Date.now() + 50000 })
    .run();
  expect((await peticion("memoria", "DELETE")).status).toBe(409);
  expect(leerRecuerdos(ana)).toHaveLength(1);
  db()
    .update(chatSessions)
    .set({ busyUntil: 0 })
    .where(eq(chatSessions.ownerId, ana.id))
    .run();
  expect((await peticion("memoria", "DELETE")).status).toBe(200);
  expect(leerRecuerdos(ana)).toEqual([]);
  expect(leerRecuerdos(otro)).toHaveLength(1);
  activa = admin;
  expect((await peticion(`admin/memoria/${otro.id}`, "DELETE")).status).toBe(
    404,
  );
});
