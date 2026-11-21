import { test, expect } from "@playwright/test";

test("mutaciones exigen origen comprobado y JSON exacto; la sesión sigue utilizable", async ({
  request,
  baseURL,
}) => {
  const login = await request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
    {
      data: {
        email: "admin@example.test",
        secret: process.env.COOPER_E2E_SECRET,
      },
    },
  );
  expect(login.status()).toBe(200);
  const invalid: Record<string, string>[] = [
    { origin: "", referer: "" },
    { origin: "https://ajeno.example.test" },
    { origin: "null" },
    { origin: baseURL!, "sec-fetch-site": "cross-site" },
  ];
  for (const headers of invalid) {
    const response = await request.delete("/api/memoria", { headers });
    expect(response.status()).toBe(403);
  }
  const simple = await request.post("/api/marcas", {
    headers: {
      "content-type": "text/plain; type=application/json",
      origin: baseURL!,
    },
    data: JSON.stringify({ nombre: "No debe crearse", rubro: "moda" }),
  });
  expect(simple.status()).toBe(415);
  expect((await request.get("/api/estado")).status()).toBe(200);
  const first = await request.get("/entrar");
  const second = await request.get("/entrar");
  expect(first.headers()["content-security-policy"]).not.toBe(
    second.headers()["content-security-policy"],
  );
  expect(first.headers()["x-frame-options"]).toBe("DENY");
  expect(first.headers()["x-powered-by"]).toBeUndefined();
});
