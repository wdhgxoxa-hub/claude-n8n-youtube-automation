import { z } from "zod";
import { calcularConversionTienda as calcularConversionValidada } from "./tienda-contenido";
export {
  crearPlantillaTienda,
  pilaresTienda,
  calendarioTienda,
  requisitosCatalogoTienda,
  pendientesTienda,
  metricasTienda,
  metricasConversionEjemplo,
} from "./tienda-contenido";

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

// Validación de entradas externas; los componentes usan solo tienda-contenido.
export function calcularConversionTienda(raw: unknown = {}) {
  return calcularConversionValidada(conversionTiendaSchema.parse(raw));
}
