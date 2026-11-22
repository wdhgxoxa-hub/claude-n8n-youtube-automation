import { afterEach, expect, it, vi } from "vitest";
import type { Marca } from "@/db/schema";
import { loginGoogle } from "@/lib/identidad";
import { lineas } from "@/servicios/marcas/diseno";
import {
  proponerTexto,
  registrarCita,
  verificarCitas,
} from "@/servicios/marcas/especialistas";
import {
  calendarioIglesia,
  perfilIglesia,
  plantillasIglesia,
  proximaFechaIglesia,
} from "@/servicios/marcas/iglesia";
import { marcaSchema, piezaSchema } from "@/servicios/marcas/tipos";
import { proveedorChat } from "@/servicios/chat/seleccion";
import type { EntradaModelo, ProveedorChat } from "@/servicios/chat/tipos";

vi.mock("@/servicios/chat/seleccion", () => ({ proveedorChat: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());

const marca: Marca = {
  ...perfilIglesia,
  id: "iglesia-editorial-ficticia",
  ownerId: "responsable-ficticio",
  estudio: null,
  createdAt: 0,
};

it("prepara identidad provisional sin asumir una traducción ni programación", () => {
  const perfil = marcaSchema.parse(perfilIglesia);
  expect(perfil).toMatchObject({
    nombre: "Iglesia (por confirmar)",
    rubro: "iglesia-reformada",
    zona: "America/Lima",
    guia: { versionBiblia: "Por confirmar", logoId: "" },
  });
  expect(new Set(calendarioIglesia.map((s) => s.plantillaId))).toEqual(
    new Set(plantillasIglesia.map((p) => p.id)),
  );
  expect(new Set(calendarioIglesia.map((s) => s.diaSemana)).size).toBe(4);
});

it.each(plantillasIglesia)(
  "$nombre se puede guardar y componer como borrador de ejemplo sin inventar citas",
  ({ datos: plantilla }) => {
    const datos = piezaSchema.parse({
      ...plantilla,
      cuentaId: "cuenta-ficticia",
      ejemplo: true,
    });
    expect(datos.programada).toBeUndefined();
    expect(datos.citas).toEqual([]);
    expect(() => verificarCitas(marca, datos)).not.toThrow();
    expect(datos.texto).toMatch(/EJEMPLO/);
    expect(datos.titulo).toMatch(/EJEMPLO/);
    // Usa los mismos límites del compositor, también en cada lámina del carrusel.
    expect(lineas(datos.titulo, 23, 4).length).toBeGreaterThan(0);
    for (const texto of [datos.detalle, ...datos.diapositivas]) {
      expect(texto).toMatch(/EJEMPLO/);
      expect(lineas(texto, 38, 6).length).toBeGreaterThan(0);
    }
    if (datos.formato === "carrusel")
      expect(datos.diapositivas.length).toBeGreaterThanOrEqual(2);
    expect(datos.adjuntos).toEqual([]);
    expect(datos.videoId).toBe("");
    expect(fetch).not.toHaveBeenCalled();
  },
);

it.each([
  ["2026-11-22T23:00:00Z", "reel_predicacion", "2026-11-23T00:00:00.000Z"],
  ["2026-11-23T00:01:00Z", "reel_predicacion", "2026-11-30T00:00:00.000Z"],
  ["2026-11-23T04:59:00Z", "versiculo", "2026-11-23T13:00:00.000Z"],
  ["2026-11-23T05:00:00Z", "versiculo", "2026-11-23T13:00:00.000Z"],
  ["2026-11-23T12:50:00Z", "versiculo", "2026-11-23T13:00:00.000Z"],
  ["2026-11-23T12:50:00.001Z", "versiculo", "2026-11-30T13:00:00.000Z"],
  ["2026-12-31T23:00:00Z", "anuncios", "2027-01-01T23:00:00.000Z"],
] as const)(
  "propone horario Lima para %s y %s conservando semana y margen",
  (actual, plantillaId, esperada) => {
    const now = Date.parse(actual);
    expect(proximaFechaIglesia(plantillaId, now)).toBe(esperada);
    expect(Date.parse(esperada) - now).toBeGreaterThanOrEqual(10 * 60 * 1000);
  },
);

it("el horario propuesto conserva UTC-5 aunque el equipo use otra zona", () => {
  const now = Date.parse("2026-11-25T20:00:00Z");
  for (const zona of ["Pacific/Auckland", "America/Los_Angeles", "UTC"]) {
    vi.stubEnv("TZ", zona);
    expect(proximaFechaIglesia("devocional", now)).toBe(
      "2026-11-26T00:00:00.000Z",
    );
  }
});

it("envía al proveedor falso doctrina, tono y versión pendiente sin facultad de aprobación", async () => {
  const entradas: EntradaModelo[] = [];
  const proveedor: ProveedorChat = {
    async *generar(entrada) {
      entradas.push(entrada);
      yield { tipo: "texto", texto: "Borrador pastoral de ensayo." };
    },
  };
  const resultado = await proponerTexto(
    marca,
    "Devocional de ensayo",
    proveedor,
  );
  expect(resultado.texto).toBe("Borrador pastoral de ensayo.");
  expect(entradas).toHaveLength(1);
  const entrada = entradas[0];
  expect(entrada.herramientas).toEqual([]);
  expect(entrada.sistema).toMatch(/Westminster.*Heidelberg/);
  expect(entrada.sistema).toMatch(/reverente, pastoral.*sin sensacionalismo/);
  expect(entrada.sistema).toMatch(/Por confirmar no incluyas citas/);
  expect(entrada.sistema).toMatch(
    /Nunca publiques, apruebes ni certifiques doctrina/,
  );
  expect(JSON.parse(entrada.mensajes[0].texto)).toMatchObject({
    tema: "Devocional de ensayo",
    tono: perfilIglesia.guia.tono,
    versionBiblia: "Por confirmar",
    corpus: [],
  });
  expect(proveedorChat).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it("una versión confirmada recibe solo su corpus cotejado, sin llamar proveedores externos", async () => {
  const admin = loginGoogle("admin@example.test", "Walter de ensayo");
  for (const version of ["Edición ficticia A", "Edición ficticia B"])
    registrarCita(admin, {
      referencia: "Referencia editorial ficticia",
      texto: `Texto de prueba para ${version}; no es una cita bíblica real.`,
      version,
      fuente: "https://example.test/corpus-ficticio",
      cotejada: true,
    });
  const entradas: EntradaModelo[] = [];
  await proponerTexto(
    { ...marca, guia: { ...marca.guia, versionBiblia: "Edición ficticia A" } },
    "Lectura de ensayo",
    {
      async *generar(entrada) {
        entradas.push(entrada);
        yield { tipo: "texto", texto: "Propuesta de ensayo sin cita literal." };
      },
    },
  );
  expect(JSON.parse(entradas[0].mensajes[0].texto)).toMatchObject({
    versionBiblia: "Edición ficticia A",
    corpus: [{ version: "Edición ficticia A" }],
  });
  expect(proveedorChat).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
