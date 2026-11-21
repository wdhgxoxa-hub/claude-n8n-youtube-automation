import { expect, it, vi } from "vitest";
import { body, sameOrigin, rateLimit, failure } from "@/lib/http";
import { marcaSchema } from "@/servicios/marcas/tipos";

it.each([
  [123, "nombre: Entrada inválida: se esperaba texto, recibido número"],
  [
    "A",
    "nombre: Demasiado pequeño: se esperaba que texto tuviera >=2 caracteres",
  ],
])(
  "devuelve validación en español y conserva mensajes propios (%s)",
  async (nombre, mensaje) => {
    const result = marcaSchema.safeParse({
      nombre,
      rubro: "general",
      zona: "Zona/inexistente",
    });
    expect(result.success).toBe(false);
    if (result.success)
      throw new Error("El ensayo debe producir un error de validación");
    const response = failure(result.error);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: `Revisa los campos. ${mensaje}; zona: Zona horaria inválida`,
    });
  },
);
it("limita JSON por bytes durante lectura, incluso sin Content-Length", async () => {
  const request = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ texto: "a".repeat(8 * 1024 * 1024) }),
  });
  await expect(body(request)).rejects.toMatchObject({ status: 413 });
});
it("rechaza JSON roto, tipos incorrectos y origen cruzado", async () => {
  await expect(
    body(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: "{",
      }),
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    body(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { origin: "http://localhost" },
        body: "hola",
      }),
    ),
  ).rejects.toMatchObject({ status: 415 });
  expect(() =>
    sameOrigin(
      new Request("http://localhost/api/chat", {
        headers: { "sec-fetch-site": "cross-site" },
      }),
    ),
  ).toThrow("Origen");
  expect(() =>
    sameOrigin(
      new Request("http://localhost/api/chat", {
        headers: { origin: "https://ajeno.example.test" },
      }),
    ),
  ).toThrow("Origen");
});
it("limita escrituras a 90 y no revela errores internos", async () => {
  for (let i = 0; i < 90; i++) rateLimit("escritura-ficticia");
  expect(() => rateLimit("escritura-ficticia")).toThrow("solicitudes");
  const future = Date.now() + 61000;
  const clock = vi.spyOn(Date, "now").mockReturnValue(future);
  try {
    expect(() => rateLimit("escritura-ficticia")).not.toThrow();
  } finally {
    clock.mockRestore();
  }
  const response = failure(new Error("Detalle privado del transporte"));
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("privado");
});
