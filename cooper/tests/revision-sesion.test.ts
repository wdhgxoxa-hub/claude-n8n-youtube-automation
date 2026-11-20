import { expect, it, vi, afterEach } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { loginGoogle } from "@/lib/identidad";
const state = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3000" }),
  cookies: async () => ({ get: () => ({ value: state.cookie }) }),
}));
vi.mock("@/auth", () => ({ auth: async () => null }));
import { currentUser } from "@/lib/sesion";
afterEach(() => vi.unstubAllEnvs());
it("R02 nunca autentica una cookie de ensayo en producción aunque se configuren las banderas", async () => {
  const user = loginGoogle("admin@example.test", "Administrador de ensayo");
  const secret = randomBytes(32).toString("hex");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("COOPER_TEST_MODE", "1");
  vi.stubEnv("COOPER_TEST_SECRET", secret);
  const payload = Buffer.from(
    JSON.stringify({ email: user.email, expires: Date.now() + 3600000 }),
  ).toString("base64url");
  state.cookie = `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
  await expect(currentUser()).rejects.toMatchObject({ status: 401 });
});
