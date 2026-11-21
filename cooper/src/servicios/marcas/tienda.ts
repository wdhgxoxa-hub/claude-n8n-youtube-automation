import { z } from "zod";

// Configuración editorial local. No contiene cuentas, pedidos ni credenciales.
export const tiendaSchema = z
  .object({
    version: z.literal(1),
    plantilla: z.literal("tienda-ropa"),
    datosEjemplo: z.literal(true),
    catalogo: z
      .object({
        estado: z.literal("sin_conectar"),
        plataforma: z.literal("por_definir"),
        url: z.null(),
      })
      .strict(),
  })
  .strict();

export function crearPlantillaTienda() {
  return {
    nombre: "Tienda de ropa de Walter · Ejemplo",
    rubro: "moda" as const,
    zona: "America/Lima",
    guia: {
      colores: ["#191d20", "#f0eee7", "#cbbb9f"],
      tipografia: "sans" as const,
      logoId: "",
      tono: "Moda cercana, inclusiva y concreta. Explica combinaciones y cuidados con datos confirmados; evita urgencia artificial y promesas sobre el cuerpo.",
      versionBiblia: "RVR1960",
      tienda: tiendaSchema.parse({
        version: 1,
        plantilla: "tienda-ropa",
        datosEjemplo: true,
        catalogo: {
          estado: "sin_conectar",
          plataforma: "por_definir",
          url: null,
        },
      }),
    },
  };
}

export const pilaresTienda = [
  {
    id: "lanzamientos",
    nombre: "Lanzamientos",
    objetivo: "Presentar una colección y llevar a su ficha de producto.",
    formato: "carrusel",
    brief:
      "Ejemplo: presenta una colección por confirmar. Pide fecha, fotografías autorizadas, materiales, tallas, precio y disponibilidad antes de redactar la versión final.",
  },
  {
    id: "lookbooks",
    nombre: "Lookbooks",
    objetivo: "Mostrar combinaciones y ayudar a elegir una prenda.",
    formato: "carrusel",
    brief:
      "Ejemplo: propone tres combinaciones de prendas. Describe el uso y solicita referencias reales de color, tejido y tallaje; no inventes productos disponibles.",
  },
  {
    id: "reels-producto",
    nombre: "Reels de producto",
    objetivo: "Mostrar detalles, movimiento y cuidados de la prenda.",
    formato: "reel",
    brief:
      "Ejemplo: guion de 20 segundos con detalle, caída y uso. Solicita video o fotos propias y composición confirmada; no prometas un ajuste universal.",
  },
  {
    id: "ofertas",
    nombre: "Ofertas",
    objetivo: "Explicar una promoción comprobada con sus condiciones.",
    formato: "historia",
    brief:
      "Ejemplo: estructura una oferta sin asignar descuento. Pide precio anterior y final, vigencia, stock, exclusiones y condiciones; no inventes escasez ni un contador.",
  },
  {
    id: "ugc",
    nombre: "UGC",
    objetivo: "Compartir experiencias reales con permiso de sus autores.",
    formato: "reel",
    brief:
      "Ejemplo: invita a mostrar cómo combinan una prenda. Solicita consentimiento y testimonio original verificable; no fabriques clientes, reseñas ni recomendaciones.",
  },
] as const;

// Semana orientativa, sin fecha absoluta: nunca entra en la cola de publicación.
export const calendarioTienda = [
  {
    dia: "Lunes",
    hora: "19:00",
    pilarId: "lanzamientos",
    titulo: "Presentación de colección · Ejemplo",
    formato: "carrusel",
    objetivo: "Visitas a producto",
  },
  {
    dia: "Martes",
    hora: "19:00",
    pilarId: "lookbooks",
    titulo: "Tres combinaciones · Ejemplo",
    formato: "carrusel",
    objetivo: "Guardados y visitas a producto",
  },
  {
    dia: "Miércoles",
    hora: "19:00",
    pilarId: "reels-producto",
    titulo: "Detalles de una prenda · Ejemplo",
    formato: "reel",
    objetivo: "Sesiones con carrito",
  },
  {
    dia: "Viernes",
    hora: "12:00",
    pilarId: "ofertas",
    titulo: "Condiciones de una promoción · Ejemplo",
    formato: "historia",
    objetivo: "Sesiones con compra",
  },
  {
    dia: "Sábado",
    hora: "11:00",
    pilarId: "ugc",
    titulo: "Cómo la combinas · Ejemplo",
    formato: "reel",
    objetivo: "Participaciones autorizadas",
  },
] as const;

export const requisitosCatalogoTienda = [
  {
    campo: "Identidad y variantes",
    detalle:
      "ID estable de producto y SKU de cada variante; nombre, talla, color y URL pública de su ficha.",
  },
  {
    campo: "Precio y disponibilidad",
    detalle:
      "Precio vigente, moneda, stock por variante y fecha de actualización. Ausencia de dato se conserva como desconocida.",
  },
  {
    campo: "Materiales y medios",
    detalle:
      "Composición, cuidados, guía de tallas e imágenes propias o autorizadas. No completar atributos por inferencia.",
  },
  {
    campo: "Promociones",
    detalle:
      "Precio anterior comprobado, precio final, vigencia con zona horaria, exclusiones y condiciones aprobadas.",
  },
  {
    campo: "Atribución y medición",
    detalle:
      "Relacionar marca, pieza y SKU con campaña/UTM. Recibir sesiones, carrito, checkout, compras y pedidos del mismo periodo, fuente y modelo de atribución; deduplicar pedidos.",
  },
  {
    campo: "Conexión futura",
    detalle:
      "Elegir plataforma y contrato oficial antes de implementar un adaptador de lectura autorizado. Esta plantilla no descarga, sincroniza ni modifica un catálogo.",
  },
] as const;

export const pendientesTienda = [
  "Definir nombre definitivo, público, estilo, logo y fotografías autorizadas.",
  "Confirmar catálogo, tallas, materiales, precios, moneda, stock, envíos y cambios.",
  "Elegir plataforma web y dominio; autorizar por separado la futura conexión de lectura.",
  "Acordar fuente, periodo y atribución de conversiones, tratamiento de devoluciones y consentimiento de medición.",
  "Aprobar calendario, promociones, permisos UGC y cuentas antes de producir o publicar.",
] as const;

const conteo = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable()
  .default(null);
export const conversionTiendaSchema = z
  .object({
    sesiones: conteo,
    sesionesConCarrito: conteo,
    sesionesConCheckout: conteo,
    sesionesConCompra: conteo,
    pedidos: conteo,
    ingresos: z
      .number()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const campo of [
      "sesionesConCarrito",
      "sesionesConCheckout",
      "sesionesConCompra",
    ] as const) {
      if (v.sesiones !== null && v[campo] !== null && v[campo] > v.sesiones)
        ctx.addIssue({
          code: "custom",
          path: [campo],
          message:
            "Las sesiones de una etapa no pueden superar las sesiones del mismo periodo.",
        });
    }
  });

export const metricasTienda = [
  {
    id: "tasaCarrito",
    nombre: "Añadidos al carrito",
    unidad: "%",
    formula: "Sesiones con carrito / sesiones × 100",
    definicion:
      "Porcentaje de sesiones con al menos un producto añadido al carrito.",
  },
  {
    id: "tasaCheckout",
    nombre: "Inicio de checkout",
    unidad: "%",
    formula: "Sesiones con checkout / sesiones × 100",
    definicion: "Porcentaje de sesiones que iniciaron el proceso de compra.",
  },
  {
    id: "tasaConversion",
    nombre: "Conversión a compra",
    unidad: "%",
    formula: "Sesiones con compra / sesiones × 100",
    definicion:
      "Porcentaje de sesiones con una compra confirmada; varios pedidos en una sesión cuentan una sola vez.",
  },
  {
    id: "ticketMedio",
    nombre: "Ticket medio",
    unidad: "PEN",
    formula: "Ingresos de pedidos / pedidos confirmados",
    definicion:
      "Importe medio por pedido del mismo periodo y moneda. PEN es solo la moneda del ejemplo.",
  },
] as const;

export function calcularConversionTienda(raw: unknown = {}) {
  const v = conversionTiendaSchema.parse(raw);
  const dividir = (
    numerador: number | null,
    denominador: number | null,
    factor = 100,
  ) =>
    numerador === null || denominador === null || denominador === 0
      ? null
      : (numerador / denominador) * factor;
  return {
    tasaCarrito: dividir(v.sesionesConCarrito, v.sesiones),
    tasaCheckout: dividir(v.sesionesConCheckout, v.sesiones),
    tasaConversion: dividir(v.sesionesConCompra, v.sesiones),
    ticketMedio: dividir(v.ingresos, v.pedidos, 1),
  };
}

// Solo para la vista «Ejemplo». No se persiste ni se envía al especialista.
export const metricasConversionEjemplo = {
  sesiones: 1000,
  sesionesConCarrito: 120,
  sesionesConCheckout: 60,
  sesionesConCompra: 30,
  pedidos: 32,
  ingresos: 3840,
} as const;
