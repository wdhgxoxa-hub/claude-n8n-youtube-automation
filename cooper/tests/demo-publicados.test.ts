import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { prepararDemo } from "@/servicios/demo";
import { leerResultados } from "@/servicios/resultados";
import { proporcionPublicacion } from "@/lib/reticula";

afterEach(() => vi.unstubAllEnvs());
function usuario(): User {
  const id = randomUUID();
  return db()
    .insert(users)
    .values({ id, email: `${id}@example.test`, name: "Demo" })
    .returning()
    .get();
}

it("la pared de demostración mezcla formatos y no repite pieza ni título", () => {
  vi.stubEnv("COOPER_DEMO", "1");
  const dueno = usuario();
  prepararDemo(dueno);
  const { publicaciones } = leerResultados(dueno);
  expect(publicaciones.length).toBeGreaterThanOrEqual(5);
  expect(new Set(publicaciones.map((p) => p.titulo)).size).toBe(
    publicaciones.length,
  );
  expect(new Set(publicaciones.map((p) => p.identidad)).size).toBe(
    publicaciones.length,
  );
  const proporciones = publicaciones.map(proporcionPublicacion);
  expect(proporciones.some((p) => p < 1)).toBe(true);
  expect(proporciones.some((p) => p > 1)).toBe(true);
  expect(publicaciones.every((p) => p.simulada)).toBe(true);
});

it("las lecciones de demostración enlazan un video de origen con cifra y cambio", () => {
  vi.stubEnv("COOPER_DEMO", "1");
  const dueno = usuario();
  prepararDemo(dueno);
  const { aprendizajes } = leerResultados(dueno);
  expect(aprendizajes.length).toBeGreaterThanOrEqual(2);
  for (const a of aprendizajes) {
    if (a.tipo !== "video") continue;
    expect(a.leccion.origenes?.length).toBeGreaterThan(0);
    expect(a.leccion.causa).toBeTruthy();
    expect(a.leccion.correccion).toBeTruthy();
  }
});
