import { expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { resolve } from "node:path";
import { aplicarMigraciones } from "@/db/migraciones";
import { db } from "@/db";
import { expenses, users } from "@/db/schema";
import { administracion } from "@/servicios/datos";

it("Rendimiento mantiene aislamiento y orden del cursor SSE sin ordenar el historial", () => {
  const sqlite = new Database(":memory:");
  try {
    aplicarMigraciones(sqlite, resolve("drizzle"));
    sqlite.exec(`
      INSERT INTO users(id,email,name) VALUES
        ('ana','ana@rendimiento.test','Ana'),('luis','luis@rendimiento.test','Luis');
      INSERT INTO events(id,owner_id,type,payload,created_at) VALUES
        ('a','ana','progreso','{}',10),('b','ana','progreso','{}',10),
        ('c','luis','progreso','{}',10),('d','ana','operacion_canal','{}',11),
        ('e','ana','progreso','{}',12);
    `);
    const byOwner =
      "SELECT * FROM events WHERE type = ? AND owner_id = ? AND created_at > ? ORDER BY created_at, id LIMIT 100";
    const allOwners =
      "SELECT * FROM events WHERE type = ? AND created_at > ? ORDER BY created_at, id LIMIT 100";
    const own = sqlite.prepare(byOwner).all("progreso", "ana", 9) as {
      id: string;
    }[];
    expect(own.map((row) => row.id)).toEqual(["a", "b", "e"]);
    expect(
      (sqlite.prepare(allOwners).all("progreso", 9) as { id: string }[]).map(
        (row) => row.id,
      ),
    ).toEqual(["a", "b", "c", "e"]);
    for (const [query, params] of [
      [byOwner, ["progreso", "ana", 9]],
      [allOwners, ["progreso", 9]],
      [
        "SELECT * FROM messages WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100",
        ["ana"],
      ],
      [
        "SELECT * FROM piezas_marca WHERE marca_id = ? ORDER BY programada",
        ["marca-ficticia"],
      ],
    ] as const) {
      const plan = sqlite
        .prepare(`EXPLAIN QUERY PLAN ${query}`)
        .all(...params) as { detail: string }[];
      expect(plan.map((row) => row.detail).join(" ")).toContain("USING INDEX");
      expect(plan.map((row) => row.detail).join(" ")).not.toContain(
        "USE TEMP B-TREE",
      );
    }
    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
  } finally {
    sqlite.close();
  }
});

it("Rendimiento agrega gasto sin perder la semana que empieza en el mes anterior ni el permiso admin", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-02T12:00:00Z"));
  try {
    db()
      .insert(users)
      .values([
        {
          id: "admin-gasto",
          email: "admin@gasto.test",
          name: "Admin",
          role: "admin",
        },
        { id: "ana-gasto", email: "ana@gasto.test", name: "Ana" },
        { id: "sin-gasto", email: "nadie@gasto.test", name: "Sin gastos" },
      ])
      .run();
    db()
      .insert(expenses)
      .values(
        [
          ["antes", "2026-07-27T04:59:59.999Z", 900],
          ["semana", "2026-07-27T05:00:00Z", 2],
          ["mes", "2026-08-01T05:00:00Z", 3],
          ["dia", "2026-08-02T05:00:00Z", 25.005],
          // El contrato integrado usa Lima y excluye registros futuros.
          ["futuro", "2026-08-03T00:00:00Z", 4],
        ].map(([id, at, amount]) => ({
          id: String(id),
          ownerId: "ana-gasto",
          amount: Number(amount),
          concept: "Ensayo sintético",
          createdAt: Date.parse(String(at)),
        })),
      )
      .run();
    const team = db().select().from(users).all();
    const admin = team.find((u) => u.id === "admin-gasto")!;
    const ana = team.find((u) => u.id === "ana-gasto")!;
    expect(() => administracion(ana)).toThrow("administrador");
    const result = administracion(admin);
    expect(result.users.find((u) => u.id === ana.id)).toMatchObject({
      day: 25.01,
      // Mismo redondeo del agregado JS, sin sumar el registro futuro.
      week: 30.01,
      month: 28.01,
      alert: true,
    });
    expect(result.users.find((u) => u.id === "sin-gasto")).toMatchObject({
      day: 0,
      week: 0,
      month: 0,
      alert: false,
    });
  } finally {
    vi.useRealTimers();
  }
});
