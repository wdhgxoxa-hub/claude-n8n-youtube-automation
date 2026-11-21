import { beforeEach, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/db", () => ({ db: () => ({ get }) }));
import { GET } from "@/app/api/salud/route";

beforeEach(() => {
  get.mockReset();
});

it("comprueba SQLite y evita cachear salud", async () => {
  get.mockReturnValue({ 1: 1 });
  const response = GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(get).toHaveBeenCalledOnce();
  expect(await response.json()).toEqual({ ok: true });
});

it("marca indisponibilidad sin revelar errores internos", async () => {
  get.mockImplementation(() => {
    throw new Error("ruta interna reservada");
  });
  const response = GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ok: false });
});
