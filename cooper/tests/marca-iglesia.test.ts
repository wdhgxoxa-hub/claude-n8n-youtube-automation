import { beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aplicarMigraciones } from "@/db/migraciones";
import { allowedEmails, piezasMarca, users, type User } from "@/db/schema";
import { loginGoogle } from "@/lib/identidad";
import {
  agregarCuenta,
  conectarCuenta,
  decidirPieza,
  enviarRevision,
  estadoMarcas,
  guardarMarca,
  guardarPieza,
  obtenerPieza,
  prepararIglesia,
  procesarMarcas,
  revisarDoctrina,
} from "@/servicios/marcas/servicio";
import { controlesDoctrinalesIglesia } from "@/servicios/marcas/iglesia";
import { RedSimulada } from "@/servicios/marcas/redes";
import { piezaSchema } from "@/servicios/marcas/tipos";

let admin: User, miembro: User;
beforeAll(() => {
  admin = loginGoogle("admin@example.test", "Walter");
  db()
    .insert(allowedEmails)
    .values({ email: "iglesia@example.test", createdAt: Date.now() })
    .run();
  miembro = loginGoogle("iglesia@example.test", "Miembro de ensayo");
});
const evidencia = () => ({
  revisorPastoral: "Responsable pastoral de ensayo",
  observaciones:
    "Revisión ficticia del texto y la composición completos, con permisos de ensayo.",
  comprobaciones: [...controlesDoctrinalesIglesia],
});
async function escenario(ejemplo = false) {
  const m = guardarMarca(miembro, {
    nombre: "Congregación de ensayo",
    rubro: "iglesia-reformada",
  });
  const facebook = agregarCuenta(miembro, m.id, {
    red: "facebook",
    alias: "Página de ensayo",
    remoto: String(Math.floor(Math.random() * 1e14)),
  });
  await conectarCuenta(admin, facebook.id);
  const d = {
    cuentaId: facebook.id,
    formato: "imagen",
    plantilla: "domingo",
    titulo: "Anuncio de ensayo",
    texto: "Contenido ficticio para comprobar la revisión pastoral.",
    detalle: "Ensayo local",
    programada: new Date(Date.now() + 3600000).toISOString(),
    ejemplo,
  };
  const p = guardarPieza(miembro, m.id, d);
  await enviarRevision(miembro, p.id, p.revision);
  return { m, p, d };
}

it("prepara la iglesia solo para Walter, de forma idempotente y sin inventar cuentas ni piezas", () => {
  expect(() => prepararIglesia(miembro)).toThrow();
  const m = prepararIglesia(admin);
  expect(m.nombre).toBe("Iglesia (por confirmar)");
  expect(m.guia.versionBiblia).toBe("Por confirmar");
  guardarMarca(
    admin,
    {
      nombre: "Nombre confirmado de ensayo",
      rubro: m.rubro,
      zona: m.zona,
      guia: m.guia,
    },
    m.id,
  );
  expect(prepararIglesia(admin).nombre).toBe("Nombre confirmado de ensayo");
  expect(estadoMarcas(admin).marcas.filter((v) => v.id === m.id)).toHaveLength(
    1,
  );
  expect(estadoMarcas(admin).marcas.find((v) => v.id === m.id)).toMatchObject({
    cuentas: [],
    piezas: [],
  });
  expect(estadoMarcas(miembro).marcas.some((v) => v.id === m.id)).toBe(false);
});

it("exige revisión doctrinal completa y humana de la revisión exacta, separada de aprobar", async () => {
  const { p } = await escenario();
  expect(() => decidirPieza(admin, p.id, 1, true)).toThrow(
    /revisión doctrinal/,
  );
  expect(() => revisarDoctrina(miembro, p.id, 1, evidencia())).toThrow();
  expect(() => revisarDoctrina(admin, p.id, 2, evidencia())).toThrow(
    /revisión/i,
  );
  expect(() =>
    revisarDoctrina(admin, p.id, 1, {
      ...evidencia(),
      comprobaciones: controlesDoctrinalesIglesia.slice(1),
    }),
  ).toThrow();
  expect(() =>
    revisarDoctrina(admin, p.id, 1, {
      ...evidencia(),
      comprobaciones: Array(6).fill("revision_final"),
    }),
  ).toThrow();
  const registro = revisarDoctrina(admin, p.id, 1, evidencia());
  expect(registro).toMatchObject({ revision: 1, revisadaPor: admin.id });
  expect(obtenerPieza(miembro, p.id).p.estado).toBe("pendiente");
  decidirPieza(admin, p.id, 1, true);
  const red = new RedSimulada(),
    publicar = vi.spyOn(red, "publicar");
  await procesarMarcas(red, p.programada + 1);
  expect(
    publicar.mock.calls.filter(([, pieza]) => pieza.id === p.id),
  ).toHaveLength(1);
});

it("editar y pedir cambios invalidan el registro doctrinal", async () => {
  const { m, p, d } = await escenario();
  revisarDoctrina(admin, p.id, 1, evidencia());
  decidirPieza(admin, p.id, 1, false);
  expect(obtenerPieza(miembro, p.id).p.revisionDoctrinal).toBeNull();
  await enviarRevision(miembro, p.id, 1);
  revisarDoctrina(admin, p.id, 1, evidencia());
  decidirPieza(admin, p.id, 1, true);
  guardarPieza(
    miembro,
    m.id,
    { ...d, texto: "Texto corregido que requiere otra lectura pastoral." },
    p.id,
    1,
  );
  expect(obtenerPieza(miembro, p.id).p).toMatchObject({
    estado: "borrador",
    revision: 2,
    revisionDoctrinal: null,
    aprobadaRevision: 0,
  });
  await enviarRevision(miembro, p.id, 2);
  expect(() => decidirPieza(admin, p.id, 2, true)).toThrow(
    /revisión doctrinal/,
  );
});

it("cambiar la guía tras aprobar bloquea el trabajador y obliga a guardar otra revisión", async () => {
  const { m, p, d } = await escenario();
  revisarDoctrina(admin, p.id, 1, evidencia());
  decidirPieza(admin, p.id, 1, true);
  guardarMarca(
    miembro,
    {
      nombre: m.nombre,
      rubro: m.rubro,
      zona: m.zona,
      guia: { ...m.guia, tono: "Tono pastoral actualizado para el ensayo" },
    },
    m.id,
  );
  const red = new RedSimulada(),
    publicar = vi.spyOn(red, "publicar");
  await procesarMarcas(red, p.programada + 1);
  expect(publicar.mock.calls.some(([, pieza]) => pieza.id === p.id)).toBe(
    false,
  );
  expect(obtenerPieza(miembro, p.id).p.estado).toBe("revision");
  const q = guardarPieza(miembro, m.id, d);
  await enviarRevision(miembro, q.id, 1);
  expect(() => revisarDoctrina(admin, q.id, 1, evidencia())).not.toThrow();
});

it("cambiar el rubro y falsear el indicador no elimina la obligación doctrinal", async () => {
  const { m, p, d } = await escenario();
  guardarMarca(
    miembro,
    { nombre: m.nombre, rubro: "general", zona: m.zona, guia: m.guia },
    m.id,
  );
  const q = guardarPieza(
    miembro,
    m.id,
    { ...d, requiereRevisionDoctrinal: false },
    p.id,
    1,
  );
  expect(q.datos.requiereRevisionDoctrinal).toBe(true);
  await enviarRevision(miembro, q.id, 2);
  expect(() => decidirPieza(admin, q.id, 2, true)).toThrow(
    /revisión doctrinal/,
  );
  expect(() =>
    piezaSchema.parse({ ...d, revisionDoctrinal: evidencia() }),
  ).toThrow();
});

it("una versión bíblica pendiente no permite registrar la revisión doctrinal", async () => {
  const { m, p, d } = await escenario();
  guardarMarca(
    miembro,
    {
      nombre: m.nombre,
      rubro: m.rubro,
      zona: m.zona,
      guia: { ...m.guia, versionBiblia: "Por confirmar" },
    },
    m.id,
  );
  expect(() => revisarDoctrina(admin, p.id, 1, evidencia())).toThrow(
    /versión bíblica/,
  );
  const q = guardarPieza(miembro, m.id, d);
  await enviarRevision(miembro, q.id, 1);
  expect(() => revisarDoctrina(admin, q.id, 1, evidencia())).toThrow(
    /versión bíblica/,
  );
});

it("las piezas de ejemplo tienen vista previa pero nunca se aprueban ni publican", async () => {
  const { p } = await escenario(true);
  expect(obtenerPieza(miembro, p.id).p.mediosIds).toHaveLength(1);
  expect(() => revisarDoctrina(admin, p.id, 1, evidencia())).toThrow(
    /datos de ejemplo/,
  );
  expect(() => decidirPieza(admin, p.id, 1, true)).toThrow(/datos de ejemplo/);
  db()
    .update(piezasMarca)
    .set({ estado: "programada", aprobadaPor: admin.id, aprobadaRevision: 1 })
    .where(eq(piezasMarca.id, p.id))
    .run();
  const red = new RedSimulada(),
    publicar = vi.spyOn(red, "publicar");
  await procesarMarcas(red, p.programada + 1);
  expect(publicar.mock.calls.some(([, pieza]) => pieza.id === p.id)).toBe(
    false,
  );
});

it("falsear el indicador de ejemplo no permite aprobar los marcadores de las plantillas", async () => {
  const { m, p, d } = await escenario();
  for (const texto of [
    "EJEMPLO — BORRADOR. Una convocatoria ficticia.",
    "Actividad: [por confirmar].",
    "Versión: [cotejo pendiente].",
  ]) {
    const q = guardarPieza(miembro, m.id, { ...d, texto, ejemplo: false });
    await enviarRevision(miembro, q.id, 1);
    expect(() => revisarDoctrina(admin, q.id, 1, evidencia())).toThrow(
      /datos de ejemplo/,
    );
    expect(() => decidirPieza(admin, q.id, 1, true)).toThrow(
      /datos de ejemplo/,
    );
  }
  const q = guardarPieza(
    miembro,
    m.id,
    {
      ...d,
      texto: "Cuidamos al prójimo, por ejemplo, al escuchar sus necesidades.",
    },
    p.id,
    1,
  );
  await enviarRevision(miembro, q.id, 2);
  expect(() => revisarDoctrina(admin, q.id, 2, evidencia())).not.toThrow();
});

it("el trabajador vuelve a comprobar registro doctrinal y revisor activo", async () => {
  const a = await escenario(),
    b = await escenario();
  for (const { p } of [a, b]) {
    revisarDoctrina(admin, p.id, 1, evidencia());
    decidirPieza(admin, p.id, 1, true);
  }
  db()
    .update(piezasMarca)
    .set({ revisionDoctrinal: null })
    .where(eq(piezasMarca.id, a.p.id))
    .run();
  // El aprobador sigue activo; se retira exclusivamente al revisor de la evidencia.
  const registro = obtenerPieza(miembro, b.p.id).p.revisionDoctrinal!;
  const revisorId = randomUUID();
  db()
    .insert(users)
    .values({
      id: revisorId,
      email: `${revisorId}@example.test`,
      name: "Revisor de ensayo retirado",
      role: "admin",
      active: false,
    })
    .run();
  db()
    .update(piezasMarca)
    .set({ revisionDoctrinal: { ...registro, revisadaPor: revisorId } })
    .where(eq(piezasMarca.id, b.p.id))
    .run();
  const red = new RedSimulada(),
    publicar = vi.spyOn(red, "publicar");
  await procesarMarcas(red, b.p.programada + 1);
  expect(
    publicar.mock.calls.some(([, pieza]) =>
      [a.p.id, b.p.id].includes(pieza.id),
    ),
  ).toBe(false);
});

it("la migración conserva datos y protege las piezas heredadas aunque después cambie el rubro", () => {
  const sqlite = new Database(":memory:");
  try {
    const folder = resolve("drizzle"),
      migraciones = readMigrationFiles({ migrationsFolder: folder });
    sqlite.exec(
      "CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)",
    );
    for (const migration of migraciones.slice(
      0,
      migraciones.findIndex((migration) =>
        migration.sql.some((sql) => sql.includes("revision_doctrinal")),
      ),
    )) {
      for (const statement of migration.sql) sqlite.exec(statement);
      sqlite
        .prepare(
          "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        )
        .run(migration.hash, migration.folderMillis);
    }
    sqlite.exec(
      "INSERT INTO users (id,email,name) VALUES ('u','u@example.test','Ensayo')",
    );
    sqlite
      .prepare(
        "INSERT INTO marcas (id,owner_id,nombre,rubro,zona,guia,created_at) VALUES ('m','u','Ensayo','iglesia-reformada','America/Lima','{}',1)",
      )
      .run();
    sqlite.exec(
      "INSERT INTO cuentas_marca (id,marca_id,red,alias,remoto) VALUES ('c','m','facebook','Ensayo','123')",
    );
    sqlite
      .prepare(
        "INSERT INTO piezas_marca (id,marca_id,cuenta_id,datos,guia,programada,created_at,updated_at) VALUES ('p','m','c',?,'{}',10,1,1)",
      )
      .run(JSON.stringify({ texto: "Dato heredado" }));
    aplicarMigraciones(sqlite, folder);
    aplicarMigraciones(sqlite, folder);
    const pieza = sqlite
      .prepare(
        "SELECT datos, revision_doctrinal FROM piezas_marca WHERE id='p'",
      )
      .get() as { datos: string; revision_doctrinal: unknown };
    expect(JSON.parse(pieza.datos)).toEqual({
      texto: "Dato heredado",
      requiereRevisionDoctrinal: true,
    });
    expect(pieza.revision_doctrinal).toBeNull();
    expect(
      sqlite.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get(),
    ).toEqual({ n: migraciones.length });
  } finally {
    sqlite.close();
  }
});
