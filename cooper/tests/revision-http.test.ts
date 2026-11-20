import { expect, it, vi } from "vitest";
import { body, sameOrigin, rateLimit, failure } from "@/lib/http";
it("limita JSON por bytes durante lectura, incluso sin Content-Length", async () => {
  const request = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texto: "a".repeat(8 * 1024 * 1024) }),
  });
  await expect(body(request)).rejects.toMatchObject({ status: 413 });
});
it("rechaza JSON roto, tipos incorrectos y origen cruzado", async () => {
  await expect(
    body(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    body(
      new Request("http://localhost/api/chat", {
        method: "POST",
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
