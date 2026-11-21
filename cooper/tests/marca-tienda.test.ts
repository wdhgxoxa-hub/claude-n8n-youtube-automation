import { beforeAll, expect, it, vi } from "vitest";
import { db } from "@/db";
import { allowedEmails, type User } from "@/db/schema";
import { loginGoogle } from "@/lib/identidad";
import type { EntradaModelo } from "@/servicios/chat/tipos";
import { proponerTexto } from "@/servicios/marcas/especialistas";
import {
  guardarMarca,
  estadoMarcas,
  obtenerMarca,
} from "@/servicios/marcas/servicio";
import { marcaSchema } from "@/servicios/marcas/tipos";
import {
  calendarioTienda,
  calcularConversionTienda,
  conversionTiendaSchema,
  crearPlantillaTienda,
  metricasConversionEjemplo,
  pilaresTienda,
  tiendaSchema,
} from "@/servicios/marcas/tienda";

let admin: User, ana: User, luis: User;
beforeAll(() => {
  admin = loginGoogle("admin@example.test", "Walter");
  for (const email of ["tienda-ana@example.test", "tienda-luis@example.test"])
    db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  ana = loginGoogle("tienda-ana@example.test", "Ana");
  luis = loginGoogle("tienda-luis@example.test", "Luis");
});

it("prepara una guía explícita y conserva las marcas anteriores sin plantilla", () => {
  const plantilla = crearPlantillaTienda();
  const otra = crearPlantillaTienda();
  expect(marcaSchema.parse(plantilla).guia.tienda).toEqual({
    version: 1,
    plantilla: "tienda-ropa",
    datosEjemplo: true,
    catalogo: { estado: "sin_conectar", plataforma: "por_definir", url: null },
  });
  expect(plantilla.nombre).toContain("Ejemplo");
  expect(plantilla.zona).toBe("America/Lima");
  plantilla.guia.colores[0] = "#ffffff";
  expect(otra.guia.colores[0]).toBe("#191d20");
  expect(
    marcaSchema.parse({ nombre: "Moda existente", rubro: "moda" }).guia.tienda,
  ).toBeUndefined();
  expect(
    marcaSchema.parse({
      nombre: "Iglesia existente",
      rubro: "iglesia-reformada",
    }).guia.tienda,
  ).toBeUndefined();
  expect(() => marcaSchema.parse({ ...otra, rubro: "general" })).toThrow();
});

it("mantiene catálogo desconectado y rechaza activar conexiones o persistir métricas de ejemplo", () => {
  const config = crearPlantillaTienda().guia.tienda;
  for (const raw of [
    { ...config, datosEjemplo: false },
    { ...config, version: 2 },
    { ...config, metricas: metricasConversionEjemplo },
    { ...config, catalogo: { ...config.catalogo, estado: "conectado" } },
    {
      ...config,
      catalogo: { ...config.catalogo, url: "https://example.test/catalogo" },
    },
    {
      ...config,
      catalogo: { ...config.catalogo, credencialId: "referencia-no-admitida" },
    },
  ])
    expect(tiendaSchema.safeParse(raw).success).toBe(false);
});

it("cubre cinco pilares en una semana orientativa sin IDs de cuentas ni fechas de publicación", () => {
  expect(pilaresTienda.map((p) => p.id)).toEqual([
    "lanzamientos",
    "lookbooks",
    "reels-producto",
    "ofertas",
    "ugc",
  ]);
  expect(calendarioTienda.map((p) => p.pilarId)).toEqual(
    pilaresTienda.map((p) => p.id),
  );
  for (const propuesta of calendarioTienda) {
    expect(propuesta.titulo).toContain("Ejemplo");
    expect(propuesta).not.toHaveProperty("cuentaId");
    expect(propuesta).not.toHaveProperty("programada");
    expect(propuesta.hora).toMatch(/^\d{2}:\d{2}$/);
  }
});

it("persiste la plantilla en la guía existente y no crea cuentas, piezas o resultados", () => {
  const creada = guardarMarca(ana, crearPlantillaTienda());
  const guardada = obtenerMarca(ana, creada.id);
  expect(guardada.guia).toEqual(creada.guia);
  const vista = estadoMarcas(ana).marcas.find((m) => m.id === creada.id)!;
  expect(vista.cuentas).toEqual([]);
  expect(vista.piezas).toEqual([]);
  expect(vista.estudio).toBeNull();
  expect(guardada.guia.tienda).not.toHaveProperty("metricas");
  guardarMarca(
    ana,
    {
      nombre: "Nombre revisado",
      rubro: guardada.rubro,
      zona: guardada.zona,
      guia: { ...guardada.guia, tono: "Cercano y descriptivo" },
    },
    creada.id,
  );
  expect(obtenerMarca(ana, creada.id).guia.tienda).toEqual(creada.guia.tienda);
  expect(fetch).not.toHaveBeenCalled();
});

it("conserva permisos por dueño al consultar, modificar y asignar una tienda", () => {
  const creada = guardarMarca(ana, crearPlantillaTienda());
  expect(estadoMarcas(luis).marcas.some((m) => m.id === creada.id)).toBe(false);
  expect(() => obtenerMarca(luis, creada.id)).toThrow();
  expect(() => guardarMarca(luis, crearPlantillaTienda(), creada.id)).toThrow();
  expect(() =>
    guardarMarca(luis, { ...crearPlantillaTienda(), ownerId: ana.id }),
  ).toThrow();
  expect(obtenerMarca(admin, creada.id).ownerId).toBe(ana.id);
});

it("mantiene métricas ausentes y divisiones por cero como null", () => {
  const ausentes = {
    tasaCarrito: null,
    tasaCheckout: null,
    tasaConversion: null,
    ticketMedio: null,
  };
  expect(calcularConversionTienda()).toEqual(ausentes);
  expect(
    calcularConversionTienda({
      sesiones: 0,
      sesionesConCarrito: 0,
      sesionesConCheckout: 0,
      sesionesConCompra: 0,
      pedidos: 0,
      ingresos: 0,
    }),
  ).toEqual(ausentes);
  expect(calcularConversionTienda({ sesiones: 50 })).toEqual(ausentes);
  expect(calcularConversionTienda({ sesionesConCompra: 3 })).toEqual(ausentes);
  expect(calcularConversionTienda({ pedidos: 3 })).toEqual(ausentes);
});

it("calcula conversiones por sesiones y ticket por pedidos, separando el ejemplo de los ceros reales", () => {
  expect(calcularConversionTienda(metricasConversionEjemplo)).toEqual({
    tasaCarrito: 12,
    tasaCheckout: 6,
    tasaConversion: 3,
    ticketMedio: 120,
  });
  expect(
    calcularConversionTienda({
      sesiones: 10,
      sesionesConCarrito: 0,
      sesionesConCheckout: 0,
      sesionesConCompra: 0,
      pedidos: 1,
      ingresos: 0,
    }),
  ).toEqual({
    tasaCarrito: 0,
    tasaCheckout: 0,
    tasaConversion: 0,
    ticketMedio: 0,
  });
  expect(
    calcularConversionTienda({
      sesiones: 10,
      sesionesConCompra: 2,
      pedidos: 20,
      ingresos: 200,
    }),
  ).toMatchObject({ tasaConversion: 20, ticketMedio: 10 });
  expect(
    calcularConversionTienda({ sesiones: 3, sesionesConCompra: 1 })
      .tasaConversion,
  ).toBeCloseTo(100 / 3);
  expect(crearPlantillaTienda().guia.tienda).not.toHaveProperty("metricas");
});

it.each([
  { sesiones: -1 },
  { sesiones: 1.5 },
  { sesiones: "20" },
  { pedidos: Number.MAX_SAFE_INTEGER + 1 },
  { ingresos: Number.POSITIVE_INFINITY },
  { ingresos: Number.NaN },
  { ingresos: -0.01 },
  { sesiones: 10, sesionesConCompra: 11 },
  { sesiones: 0, sesionesConCarrito: 1 },
  { sesiones: 5, sesionesConCheckout: 6 },
  { vistas: 100 },
])("rechaza datos inválidos antes de calcular: %j", (raw) => {
  expect(conversionTiendaSchema.safeParse(raw).success).toBe(false);
  expect(() => calcularConversionTienda(raw)).toThrow();
});

it("entrega al especialista contexto editorial sin ventas ficticias ni herramientas de aprobación", async () => {
  const creada = guardarMarca(ana, crearPlantillaTienda());
  const fake = {
    generar: vi.fn(async function* (entrada: EntradaModelo) {
      expect(entrada.herramientas).toEqual([]);
      yield {
        tipo: "texto" as const,
        texto:
          "Confirma la colección y sus fotografías para preparar el lanzamiento.",
      };
    }),
  };
  const resultado = await proponerTexto(
    obtenerMarca(ana, creada.id),
    "Preparar lanzamiento",
    fake,
  );
  expect(resultado.texto).toContain("Confirma");
  const entrada = fake.generar.mock.calls[0][0];
  expect(entrada.sistema).toContain(
    "No inventes disponibilidad, descuentos, escasez, testimonios",
  );
  expect(entrada.sistema).toContain("UGC exige permiso del autor");
  expect(entrada.sistema).toContain("Nunca apruebes, programes ni publiques");
  const datos = JSON.parse(entrada.mensajes[0].texto);
  expect(datos.tienda.datosEjemplo).toBe(true);
  expect(datos.tienda.catalogo.estado).toBe("sin_conectar");
  expect(datos.tienda.pilares).toHaveLength(5);
  expect(datos.tienda).not.toHaveProperty("metricas");
  expect(entrada.mensajes[0].texto).not.toContain("3840");
  expect(fetch).not.toHaveBeenCalled();
});

it("etiqueta también el texto simulado de la plantilla", async () => {
  const creada = guardarMarca(ana, crearPlantillaTienda());
  const resultado = await proponerTexto(
    obtenerMarca(ana, creada.id),
    "Preparar lookbook",
  );
  expect(resultado.simulada).toBe(true);
  expect(resultado.texto).toContain("Borrador de ejemplo");
});
