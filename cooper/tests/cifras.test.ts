import { describe, expect, it } from "vitest";
import {
  formatoCompacto,
  formatoDecimal,
  formatoEntero,
  formatoMoneda,
  formatoPorcentaje,
  formatoVariacion,
} from "@/lib/cifras";

const f = (s: string) => s.replace(/ /g, "_").replace(/ /g, "~");

describe("formateador único es-PE", () => {
  it("compacta con «mil» y «M», coma decimal", () => {
    expect(f(formatoCompacto(42_600))).toBe("42,6~mil");
    expect(f(formatoCompacto(1_800))).toBe("1,8~mil");
    expect(f(formatoCompacto(105_300))).toBe("105,3~mil");
    expect(f(formatoCompacto(1_200_000))).toBe("1,2~M");
    expect(f(formatoCompacto(1_000))).toBe("1~mil");
    expect(f(formatoCompacto(2_500_000_000))).toBe("2,5~mil~M");
  });
  it("deja enteros por debajo de mil y asciende al redondear", () => {
    expect(formatoCompacto(0)).toBe("0");
    expect(formatoCompacto(7)).toBe("7");
    expect(formatoCompacto(999)).toBe("999");
    expect(formatoCompacto(999.6)).toBe("1 mil");
    expect(f(formatoCompacto(999_960))).toBe("1~M");
    expect(formatoCompacto(-42_600)).toBe("-42,6 mil");
  });
  it("nunca usa k, K ni punto decimal", () => {
    for (const n of [1, 999, 1500, 42_600, 105_300, 1_200_000, 3.456])
      expect(formatoCompacto(n)).not.toMatch(/[kK.]/);
  });
  it("enteros, decimales y porcentajes con coma", () => {
    expect(f(formatoEntero(42_600))).toBe("42_600");
    expect(formatoEntero(950)).toBe("950");
    expect(formatoDecimal(63.456)).toBe("63,5");
    expect(formatoDecimal(63)).toBe("63");
    expect(formatoDecimal(-0.04)).toBe("0");
    expect(f(formatoPorcentaje(63.5))).toBe("63,5~%");
    expect(f(formatoVariacion(3.54))).toBe("+3,5~%");
    expect(f(formatoVariacion(-1.2, "pp"))).toBe("-1,2~pp");
    expect(f(formatoVariacion(0))).toBe("0~%");
  });
  it("dinero en dólares y valores no finitos", () => {
    expect(f(formatoMoneda(1234.5))).toBe("US$~1_234,50");
    expect(f(formatoMoneda(0))).toBe("US$~0,00");
    expect(formatoCompacto(Number.NaN)).toBe("—");
    expect(formatoEntero(Infinity)).toBe("—");
  });
});
