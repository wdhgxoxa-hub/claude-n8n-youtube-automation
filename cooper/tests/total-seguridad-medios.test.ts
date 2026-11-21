import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  allowedEmails,
  attachments,
  cuentasMarca,
  piezasMarca,
  users,
  type User,
} from "@/db/schema";
import { loginGoogle } from "@/lib/identidad";
import {
  agregarCuenta,
  guardarMarca,
  guardarPieza,
  leerMedio,
  urlsMedios,
  conectarCuenta,
} from "@/servicios/marcas/servicio";
let active: User;
vi.mock("@/lib/sesion", () => ({ currentUser: async () => active }));
import { GET } from "@/app/api/marcas/medio/[id]/route";
beforeAll(() => {
  active = loginGoogle("admin@example.test", "Ana");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("rechaza referencias heredadas a medios de otro dueño incluso para una pieza propia", () => {
  const ana = loginGoogle("admin@example.test", "Ana");
  db()
    .insert(allowedEmails)
    .values({ email: "medio-luis@example.test", createdAt: Date.now() })
    .run();
  const luis = loginGoogle("medio-luis@example.test", "Luis");
  active = ana;
  const marca = guardarMarca(ana, { nombre: "Marca propia", rubro: "moda" });
  const cuenta = agregarCuenta(ana, marca.id, {
    red: "facebook",
    remoto: "123",
    alias: "Cuenta",
  });
  const pieza = guardarPieza(ana, marca.id, {
    cuentaId: cuenta.id,
    formato: "imagen",
    plantilla: "libre",
    titulo: "Pieza propia",
    texto: "Ensayo de aislamiento",
  });
  const ajeno = randomUUID();
  db()
    .insert(attachments)
    .values({
      id: ajeno,
      ownerId: luis.id,
      name: "privado.txt",
      mime: "text/plain",
      data: "cHJpdmFkbw==",
      size: 7,
    })
    .run();
  db()
    .update(piezasMarca)
    .set({ mediosIds: [ajeno] })
    .where(eq(piezasMarca.id, pieza.id))
    .run();
  expect(() =>
    leerMedio(pieza.id, new URL("https://cooper.test/?i=0"), ana),
  ).toThrow("Medio no disponible");
});
it("firma, revisión, dueño activo y cuenta de la misma marca son necesarios para entrega pública", async () => {
  vi.stubEnv("AUTH_URL", "https://cooper.example.test");
  const marca = guardarMarca(active, {
    nombre: "Entrega firmada",
    rubro: "moda",
  });
  const cuenta = agregarCuenta(active, marca.id, {
    red: "facebook",
    remoto: "456",
    alias: "Cuenta",
  });
  await conectarCuenta(active, cuenta.id);
  const pieza = guardarPieza(active, marca.id, {
    cuentaId: cuenta.id,
    formato: "imagen",
    plantilla: "libre",
    titulo: "Entrega",
    texto: "Ensayo de firma",
  });
  const medio = randomUUID();
  db()
    .insert(attachments)
    .values({
      id: medio,
      ownerId: active.id,
      name: "medio.jpg",
      mime: "image/jpeg",
      data: "/9j/2Q==",
      size: 4,
    })
    .run();
  const aprobada = {
    ...pieza,
    mediosIds: [medio],
    estado: "enviando" as const,
    aprobadaRevision: 1,
  };
  db()
    .update(piezasMarca)
    .set(aprobada)
    .where(eq(piezasMarca.id, pieza.id))
    .run();
  const now = Date.now(),
    url = new URL(
      urlsMedios(
        db()
          .select()
          .from(piezasMarca)
          .where(eq(piezasMarca.id, pieza.id))
          .get()!,
        now,
      )[0],
    );
  expect(leerMedio(pieza.id, url, undefined, now).id).toBe(medio);
  for (const [key, value] of [
    ["s", "0".repeat(64)],
    ["r", "2"],
    ["i", "1"],
    ["e", "NaN"],
    ["e", String(now - 1)],
  ]) {
    const altered = new URL(url);
    altered.searchParams.set(key, value);
    expect(() => leerMedio(pieza.id, altered, undefined, now)).toThrow();
  }
  const otra = guardarMarca(active, { nombre: "Otra marca", rubro: "moda" });
  db()
    .update(cuentasMarca)
    .set({ marcaId: otra.id })
    .where(eq(cuentasMarca.id, cuenta.id))
    .run();
  expect(() => leerMedio(pieza.id, url, undefined, now)).toThrow(
    "Medio no disponible",
  );
  db()
    .update(cuentasMarca)
    .set({ marcaId: marca.id })
    .where(eq(cuentasMarca.id, cuenta.id))
    .run();
  db()
    .update(users)
    .set({ active: false })
    .where(eq(users.id, active.id))
    .run();
  try {
    expect(() => leerMedio(pieza.id, url, undefined, now)).toThrow();
  } finally {
    db()
      .update(users)
      .set({ active: true })
      .where(eq(users.id, active.id))
      .run();
  }
});
it("no permite evadir el límite público rotando IDs y no consume el cupo de una sesión", async () => {
  const call = (id: string, signed = true) =>
    GET(
      new Request(
        `https://cooper.test/api/marcas/medio/${id}${signed ? "?s=falsa" : ""}`,
      ),
      { params: Promise.resolve({ id }) },
    );
  for (let i = 0; i < 300; i++)
    expect((await call(randomUUID())).status).toBe(404);
  const limited = await call(randomUUID());
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("60");
  expect((await call(randomUUID(), false)).status).toBe(404);
  const future = Date.now() + 61000;
  vi.spyOn(Date, "now").mockReturnValue(future);
  expect((await call(randomUUID())).status).toBe(404);
});
