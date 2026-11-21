import { afterEach, expect, it, vi } from "vitest";
import { body, sameOrigin } from "@/lib/http";

afterEach(() => vi.unstubAllEnvs());
const request = (headers: Record<string, string> = {}) =>
  new Request("https://cooper.example.test/api/perfil", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: "{}",
  });

it.each<Record<string, string>>([
  {},
  { "sec-fetch-site": "same-site" },
  { referer: "roto" },
])("cierra mutaciones sin un origen comprobable: %j", (headers) => {
  expect(() => sameOrigin(request(headers))).toThrow("Origen");
});
it("acepta origen exacto o Referer del mismo origen y no confía en subdominios", () => {
  vi.stubEnv("AUTH_URL", "https://cooper.example.test");
  expect(() =>
    sameOrigin(request({ origin: "https://cooper.example.test" })),
  ).not.toThrow();
  expect(() =>
    sameOrigin(request({ referer: "https://cooper.example.test/marcas" })),
  ).not.toThrow();
  const invalid: Record<string, string>[] = [
    { referer: "https://otro.cooper.example.test/marcas" },
    { referer: "https://cooper.example.test.evil.test/" },
    { origin: "null", referer: "https://cooper.example.test/" },
    { origin: "https://cooper.example.test", "sec-fetch-site": "cross-site" },
    { origin: "https://ajeno.test", "x-forwarded-host": "ajeno.test" },
  ];
  for (const headers of invalid)
    expect(() => sameOrigin(request(headers))).toThrow("Origen");
});
it.each([
  "text/plain; application/json",
  "application/jsonp",
  "text/plain; type=application/json",
])("rechaza Content-Type engañoso %s", async (type) => {
  await expect(
    body(
      request({ origin: "https://cooper.example.test", "content-type": type }),
    ),
  ).rejects.toMatchObject({ status: 415 });
});
it("admite JSON con charset", async () => {
  await expect(
    body(
      request({
        origin: "https://cooper.example.test",
        "content-type": "Application/JSON; charset=utf-8",
      }),
    ),
  ).resolves.toEqual({});
});
