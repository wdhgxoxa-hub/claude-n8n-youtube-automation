import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";

describe("presupuesto y contrato de las ilustraciones originales", () => {
  for (const name of [
    "cooper-recibe",
    "cooper-reacciona",
    "cooper-celebra",
    "fabrica",
  ])
    it(`${name}: local, ligera, sin geometría ni color animados`, () => {
      const path = `public/movimiento/${name}.json`;
      const data = JSON.parse(readFileSync(path, "utf8"));
      expect(statSync(path).size).toBeLessThan(32768);
      expect(data.fr).toBe(60);
      expect(data.assets).toEqual([]);
      const visit = (value: unknown, path: string[]) => {
        if (!value || typeof value !== "object") return;
        const object = value as Record<string, unknown>;
        if (object.a === 1) {
          expect(path.at(-2)).toBe("ks");
          expect(["p", "r", "s", "o"]).toContain(path.at(-1));
        }
        expect(object.x).not.toBeTypeOf("string"); // Sin expresiones ejecutables.
        for (const [key, child] of Object.entries(object))
          visit(child, [...path, key]);
      };
      visit(data, []);
      const svg = readFileSync(`public/movimiento/${name}.svg`, "utf8");
      expect(svg).toContain("viewBox=");
      expect(svg).not.toMatch(/<script|<image|href=/);
      if (name.startsWith("cooper")) {
        for (const color of ["83c8e4", "82966b", "8d603d"])
          expect(svg).toContain(color);
      }
    });
});
