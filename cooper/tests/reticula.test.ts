import { describe, expect, it } from "vitest";
import { distribuirFilas } from "@/lib/reticula";
import { nombreRed } from "@/lib/redes";

const V = 9 / 16;
const H = 16 / 9;
const escritorio = { objetivo: 320, hueco: 24 };
const movil = { objetivo: 220, hueco: 16 };

function anchoFila(fila: { ancho: number }[], hueco: number) {
  return (
    fila.reduce((suma, p) => suma + p.ancho, 0) + hueco * (fila.length - 1)
  );
}

describe("retícula justificada", () => {
  it("cierra exacta cada fila completa y respeta el tope de 1,25×", () => {
    const filas = distribuirFilas(
      [H, V, V, V, H, V, V, H, V],
      1216,
      escritorio,
    );
    for (const fila of filas.slice(0, -1)) {
      expect(anchoFila(fila, 24)).toBe(1216);
      expect(fila[0].alto).toBeLessThanOrEqual(400);
      expect(fila[0].alto % 8).toBe(0);
      expect(new Set(fila.map((p) => p.alto)).size).toBe(1);
    }
  });

  it("no estira la última fila: dos piezas 9:16 quedan a 320 px y a la izquierda", () => {
    const filas = distribuirFilas([H, H, V, V], 1216, escritorio);
    const ultima = filas.at(-1)!;
    expect(ultima).toHaveLength(2);
    expect(ultima.every((p) => p.alto === 320)).toBe(true);
    expect(ultima.every((p) => p.ancho === 180)).toBe(true);
    expect(anchoFila(ultima, 24)).toBeLessThan(1216);
  });

  it("una pieza sola nunca supera el objetivo ni se deforma", () => {
    const [[pieza]] = distribuirFilas([V], 1216, escritorio);
    expect(pieza).toEqual({ ancho: 180, alto: 320 });
    const [[ancha]] = distribuirFilas([H], 1216, escritorio);
    expect(ancha.alto).toBe(320);
  });

  it("en móvil usa la altura objetivo de 220 px (múltiplo de 8: 224) y no desborda", () => {
    const filas = distribuirFilas([H, V, V, V, V, 1], 358, movil);
    for (const fila of filas) {
      expect(anchoFila(fila, 16)).toBeLessThanOrEqual(358);
      expect(fila[0].alto).toBeLessThanOrEqual(272);
    }
    expect(filas[0]).toHaveLength(1);
    expect(filas[0][0].ancho).toBe(358);
  });

  it("mantiene las proporciones con una desviación menor al 3 %", () => {
    const proporciones = [H, V, 1, V, H, V, V];
    const filas = distribuirFilas(proporciones, 1216, escritorio).flat();
    filas.forEach((p, i) => {
      expect(Math.abs(p.ancho / p.alto / proporciones[i] - 1)).toBeLessThan(
        0.03,
      );
    });
  });

  it("tolera datos inválidos o un ancho cero", () => {
    expect(distribuirFilas([], 1000, escritorio)).toEqual([]);
    expect(distribuirFilas([H], 0, escritorio)).toEqual([]);
    expect(distribuirFilas([NaN, -1, 0], 800, escritorio).flat()).toHaveLength(
      3,
    );
  });
});

describe("nombre visible de las redes", () => {
  it("usa la grafía oficial", () => {
    expect(nombreRed("youtube")).toBe("YouTube");
    expect(nombreRed("TikTok")).toBe("TikTok");
    expect(nombreRed("TIKTOK")).toBe("TikTok");
    expect(nombreRed("instagram")).toBe("Instagram");
    expect(nombreRed("YouTube Shorts")).toBe("YouTube Shorts");
    expect(nombreRed("")).toBe("");
  });
});
