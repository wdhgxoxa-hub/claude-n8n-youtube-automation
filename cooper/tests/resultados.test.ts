import { beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, videos, channels, piezasMarca, type User } from "@/db/schema";
import { leerResultados } from "@/servicios/resultados";
import {
  agruparPublicaciones,
  filtrarResultados,
  sinFiltros,
} from "@/contratos/resultados";
import { prepararResultados } from "../scripts/fixtures-resultados";
import { GET } from "@/app/api/[...ruta]/route";
import { ErrorHttp } from "@/lib/permisos";
let active: User | null;
vi.mock("@/lib/sesion", () => ({
  currentUser: async () => {
    if (!active) throw new ErrorHttp(401, "Sin sesión");
    return active;
  },
}));
let ana: User, luis: User, admin: User;
beforeAll(() => {
  [ana, luis, admin] = ["usuario", "usuario", "admin"].map((role) => {
    const id = randomUUID();
    return db()
      .insert(users)
      .values({
        id,
        email: `${id}@example.test`,
        name: "Alex",
        role: role as User["role"],
      })
      .returning()
      .get();
  });
  prepararResultados(ana);
  prepararResultados(luis);
});
it("aísla dos dueños homónimos y permite al administrador filtrar sin mezclar identidades", () => {
  const propios = leerResultados(ana),
    equipo = leerResultados(admin);
  expect(propios.ambitos).toHaveLength(2);
  expect(propios.ambitos.every((a) => a.ownerId === ana.id)).toBe(true);
  expect(JSON.stringify(propios)).not.toContain(luis.id);
  expect(equipo.ambitos).toHaveLength(4);
  const visibles = filtrarResultados(equipo.publicaciones, equipo.ambitos, {
    ...sinFiltros,
    ownerId: ana.id,
  });
  expect(visibles).toHaveLength(propios.publicaciones.length);
  expect(
    agruparPublicaciones(equipo.publicaciones, equipo.ambitos),
  ).toHaveLength(8);
  expect(
    filtrarResultados(propios.publicaciones, propios.ambitos, {
      ...sinFiltros,
      ownerId: luis.id,
    }),
  ).toEqual([]);
});
it("agrupa duplicados por identidad comprobable, conserva orígenes y no equipara homónimos ni métricas", () => {
  const r = leerResultados(ana);
  const grupos = agruparPublicaciones(r.publicaciones, r.ambitos);
  expect(r.publicaciones).toHaveLength(6);
  expect(grupos).toHaveLength(4);
  expect(grupos.filter((g) => g.registros.length === 2)).toHaveLength(2);
  expect(grupos.flatMap((g) => g.registros)).toHaveLength(6);
  const v = r.publicaciones.find(
    (p) => p.tipo === "video" && p.publicacion.id === "original",
  )!;
  expect(v.tipo === "video" && v.publicacion.historial.at(-1)?.retencion).toBe(
    1.25,
  );
  expect(
    v.tipo === "video" && v.publicacion.historial.at(-1)?.comentarios,
  ).toBe(0);
  const m = r.publicaciones.find((p) => p.id === `marca:${ana.id}-original`)!;
  expect(m.fecha).toBeNull();
  expect(m.tipo === "marca" && m.metricas?.vistas).toBeNull();
  expect(m.tipo === "marca" && m.metricas?.interacciones).toBe(5);
  expect(m).not.toHaveProperty("retencion");
  expect(JSON.stringify(r)).not.toContain("Guion ficticio");
  expect(JSON.stringify(r)).not.toContain("checkpoint");
});
it("filtra por tipo, identidad de canal/marca, red y día Lima; no convierte fecha ausente en programada", () => {
  const r = leerResultados(ana);
  const filtrar = (f: Partial<typeof sinFiltros>) =>
    filtrarResultados(r.publicaciones, r.ambitos, { ...sinFiltros, ...f });
  expect(filtrar({ tipo: "marca" })).toHaveLength(3);
  expect(filtrar({ ambitoId: `video:${ana.id}-canal` })).toHaveLength(3);
  expect(filtrar({ red: "instagram" })).toHaveLength(4);
  expect(filtrar({ desde: "2026-11-20", hasta: "2026-11-20" })).toHaveLength(2);
  expect(filtrar({ desde: "2026-11-21" })).toHaveLength(0);
  expect(filtrar({ desde: "2026-11-21", hasta: "2026-11-20" })).toHaveLength(0);
  expect(
    filtrarResultados(r.aprendizajes, r.ambitos, {
      ...sinFiltros,
      red: "youtube",
    }),
  ).toHaveLength(1);
});
it("conserva una lección por canal y su contrato ampliado; excluye enlaces ajenos y no reentrena al leer", () => {
  const before = db().select().from(piezasMarca).all();
  const r = leerResultados(ana);
  expect(r.aprendizajes.filter((l) => l.tipo === "video")).toHaveLength(1);
  const l = r.aprendizajes.find((l) => l.tipo === "video")!;
  expect(l.tipo === "video" && l.leccion.origenes?.[0].ventana).toBe("24h");
  expect(l.tipo === "video" && l.leccion.aplicaciones?.[0].cambio).toBe(
    "Apertura revisada",
  );
  expect(
    r.aprendizajes.filter((l) => l.tipo === "marca" && l.clase === "estudio"),
  ).toHaveLength(1);
  const canal = db()
    .select()
    .from(channels)
    .where(eq(channels.id, `${ana.id}-canal`))
    .get()!;
  const lessons = JSON.parse(canal.learning);
  lessons[0].origenes.push({
    ...lessons[0].origenes[0],
    videoId: `${luis.id}-video`,
  });
  db()
    .update(channels)
    .set({ learning: JSON.stringify(lessons) })
    .where(eq(channels.id, canal.id))
    .run();
  expect(JSON.stringify(leerResultados(ana))).not.toContain(luis.id);
  expect(db().select().from(piezasMarca).all()).toEqual(before);
  expect(fetch).not.toHaveBeenCalled();
});
it("rechaza relaciones inconsistentes de dueño entre canal y video", () => {
  const v = db()
    .select()
    .from(videos)
    .where(eq(videos.id, `${ana.id}-video`))
    .get()!;
  db()
    .update(videos)
    .set({ channelId: `${luis.id}-canal` })
    .where(eq(videos.id, v.id))
    .run();
  expect(
    leerResultados(ana).publicaciones.every((p) => p.tipo === "marca"),
  ).toBe(true);
  db()
    .update(videos)
    .set({ channelId: v.channelId })
    .where(eq(videos.id, v.id))
    .run();
});
it("la consulta HTTP exige sesión, mantiene no-store y no acepta suplantar al dueño por query", async () => {
  const context = { params: Promise.resolve({ ruta: ["resultados"] }) };
  active = null;
  expect(
    (await GET(new Request("http://localhost/api/resultados"), context)).status,
  ).toBe(401);
  active = ana;
  const response = await GET(
    new Request(
      `http://localhost/api/resultados?ownerId=${luis.id}&admin=true`,
    ),
    context,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.text()).not.toContain(luis.id);
});

it("no agrupa publicaciones ni lecciones sin identificador por sus títulos", () => {
  const v = db()
    .select()
    .from(videos)
    .where(eq(videos.id, `${ana.id}-video`))
    .get()!;
  const c = db()
    .select()
    .from(channels)
    .where(eq(channels.id, v.channelId))
    .get()!;
  const observabilidad = JSON.parse(v.observability);
  const p = { ...observabilidad.publicaciones[0], id: "", url: "" };
  db()
    .update(videos)
    .set({
      observability: JSON.stringify({
        ...observabilidad,
        publicaciones: [p, p],
      }),
    })
    .where(eq(videos.id, v.id))
    .run();
  const l = { ...JSON.parse(c.learning)[0], id: "" };
  db()
    .update(channels)
    .set({ learning: JSON.stringify([l, l]) })
    .where(eq(channels.id, c.id))
    .run();
  const r = leerResultados(ana);
  expect(
    agruparPublicaciones(
      r.publicaciones.filter((p) => p.tipo === "video"),
      r.ambitos,
    ),
  ).toHaveLength(2);
  expect(r.aprendizajes.filter((a) => a.tipo === "video")).toHaveLength(2);
  db()
    .update(videos)
    .set({ observability: v.observability })
    .where(eq(videos.id, v.id))
    .run();
  db()
    .update(channels)
    .set({ learning: c.learning })
    .where(eq(channels.id, c.id))
    .run();
});

it("conserva capturas distintas con el mismo ID y elige la versión más reciente de una lección", () => {
  const v = db()
    .select()
    .from(videos)
    .where(eq(videos.id, `${ana.id}-video`))
    .get()!;
  const c = db()
    .select()
    .from(channels)
    .where(eq(channels.id, v.channelId))
    .get()!;
  const observabilidad = JSON.parse(v.observability);
  const p = observabilidad.publicaciones[0];
  const l = JSON.parse(c.learning)[0];
  try {
    db()
      .update(videos)
      .set({
        observability: JSON.stringify({
          ...observabilidad,
          publicaciones: [
            p,
            { ...p, historial: [{ ...p.historial[0], vistas: 1234 }] },
          ],
        }),
      })
      .where(eq(videos.id, v.id))
      .run();
    db()
      .update(channels)
      .set({
        learning: JSON.stringify([
          l,
          { ...l, fecha: "2026-11-22T00:00:00Z", resumen: "Lección revisada" },
        ]),
      })
      .where(eq(channels.id, c.id))
      .run();
    const r = leerResultados(ana);
    const grupos = agruparPublicaciones(
      r.publicaciones.filter((p) => p.tipo === "video"),
      r.ambitos,
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].registros).toHaveLength(2);
    expect(
      grupos[0].registros.map(
        (p) => p.tipo === "video" && p.publicacion.historial.at(-1)?.vistas,
      ),
    ).toEqual([100, 1234]);
    const lessons = r.aprendizajes.filter((a) => a.tipo === "video");
    expect(lessons).toHaveLength(1);
    expect(lessons[0].titulo).toBe("Lección revisada");
  } finally {
    db()
      .update(videos)
      .set({ observability: v.observability })
      .where(eq(videos.id, v.id))
      .run();
    db()
      .update(channels)
      .set({ learning: c.learning })
      .where(eq(channels.id, c.id))
      .run();
  }
});
