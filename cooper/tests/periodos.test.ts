import { describe, expect, it } from "vitest";
import { periodosLima } from "@/lib/periodos";

describe("día operativo de Lima", () => {
  it.each(["18:59", "19:00", "23:59"])(
    "mantiene el mismo día a las %s",
    (hora) => {
      const p = periodosLima(Date.parse(`2026-11-21T${hora}:00-05:00`));
      expect(p.date).toBe("2026-11-21");
      expect(p.day).toBe(Date.parse("2026-11-21T00:00:00-05:00"));
      expect(p.week).toBe(Date.parse("2026-11-16T00:00:00-05:00"));
    },
  );
  it("cambia día, lunes y mes juntos a medianoche local", () => {
    const before = periodosLima(Date.parse("2026-05-31T23:59:59-05:00"));
    const after = periodosLima(Date.parse("2026-06-01T00:00:00-05:00"));
    expect(before.date).toBe("2026-05-31");
    expect(after.date).toBe("2026-06-01");
    expect(after.day).toBe(after.week);
    expect(after.week).toBe(after.month);
    expect(after.day - before.day).toBe(86400000);
  });
});
