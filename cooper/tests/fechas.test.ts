import { describe, expect, it } from "vitest";
import {
  formatoDiaHora,
  formatoFechaHora,
  formatoFechaHoraCorta,
} from "@/lib/fechas";

// Espacio duro visible en las comparaciones.
const f = (s: string) => s.replace(/ /g, "~");
// 22-11-2026 13:04 en Lima (UTC−05).
const tarde = Date.UTC(2026, 10, 22, 18, 4);

describe("formateador único de fechas es-PE", () => {
  it("escribe fecha y hora de 12 horas sin depender del CLDR del motor", () => {
    expect(f(formatoFechaHora(tarde))).toBe("22 nov. 2026, 1:04~p.~m.");
    expect(f(formatoFechaHoraCorta(tarde))).toBe("22/11/26, 1:04~p.~m.");
    expect(f(formatoDiaHora(tarde))).toBe("22 nov., 1:04~p.~m.");
  });
  it("medianoche y mediodía son las 12", () => {
    expect(f(formatoFechaHora(Date.UTC(2026, 0, 1, 5, 0)))).toBe(
      "1 ene. 2026, 12:00~a.~m.",
    );
    expect(f(formatoFechaHora(Date.UTC(2026, 0, 1, 17, 5)))).toBe(
      "1 ene. 2026, 12:05~p.~m.",
    );
  });
  it("usa los meses de Perú y acepta texto ISO o Date", () => {
    expect(f(formatoFechaHora("2026-09-05T13:07:00.000Z"))).toBe(
      "5 set. 2026, 8:07~a.~m.",
    );
    expect(
      f(formatoFechaHoraCorta(new Date(Date.UTC(2026, 0, 5, 13, 7)))),
    ).toBe("5/01/26, 8:07~a.~m.");
  });
  it("respeta la zona de cada marca", () => {
    expect(f(formatoFechaHora(tarde, "Europe/Madrid"))).toBe(
      "22 nov. 2026, 7:04~p.~m.",
    );
    expect(f(formatoDiaHora(tarde, "Asia/Tokyo"))).toBe("23 nov., 3:04~a.~m.");
  });
  it("una fecha inválida no se inventa", () => {
    expect(formatoFechaHora("no es fecha")).toBe("—");
    expect(formatoFechaHoraCorta(Number.NaN)).toBe("—");
  });
});
