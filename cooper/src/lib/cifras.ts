/**
 * Formateador único de cifras de Cooper (es-PE, coma decimal).
 *
 * - Separador de miles: espacio fino sin salto (U+202F), nunca punto ni coma.
 * - Decimal: coma. Nunca «k»/«K» ni punto decimal inglés.
 * - Compacto: <1000 entero · «42,6 mil» · «105,3 mil» · «1,2 M» · «2,5 mil M».
 * - Porcentaje y unidades: la unidad va separada por espacio duro (U+00A0).
 *
 * Todas las pantallas usan estas funciones; no se debe llamar a
 * Intl.NumberFormat ni a toLocaleString para mostrar cifras.
 */
export const ESPACIO_FINO = " ";
export const ESPACIO_DURO = " ";

const NO_DATO = "—";

function agrupar(entero: string) {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACIO_FINO);
}

/** Redondea a `max` decimales y quita los ceros finales; devuelve signo, parte entera y fracción. */
function partes(valor: number, max: number) {
  const fijo = Math.abs(valor).toFixed(max);
  const [entero, fraccion = ""] = fijo.split(".");
  const limpia = fraccion.replace(/0+$/, "");
  const cero = Number(entero) === 0 && limpia === "";
  return { negativo: valor < 0 && !cero, entero, fraccion: limpia };
}

function componer(
  valor: number,
  max: number,
  { agruparMiles = true }: { agruparMiles?: boolean } = {},
) {
  const { negativo, entero, fraccion } = partes(valor, max);
  const cuerpo = agruparMiles ? agrupar(entero) : entero;
  return `${negativo ? "-" : ""}${cuerpo}${fraccion ? `,${fraccion}` : ""}`;
}

/** 42600 → «42 600» (enteros; los decimales se redondean). */
export function formatoEntero(valor: number): string {
  return Number.isFinite(valor) ? componer(valor, 0) : NO_DATO;
}

/** 63.456 → «63,5». Hasta `max` decimales, sin ceros sobrantes. */
export function formatoDecimal(valor: number, max = 1): string {
  return Number.isFinite(valor) ? componer(valor, max) : NO_DATO;
}

/** 63.5 → «63,5 %» (la entrada ya está en escala 0–100). */
export function formatoPorcentaje(valor: number, max = 1): string {
  return Number.isFinite(valor)
    ? `${componer(valor, max)}${ESPACIO_DURO}%`
    : NO_DATO;
}

/** Variación con signo explícito: +3,5 % · -1,2 pp. */
export function formatoVariacion(valor: number, unidad: "%" | "pp" = "%") {
  if (!Number.isFinite(valor)) return NO_DATO;
  const texto = componer(valor, 1);
  return `${valor > 0 && texto !== "0" ? "+" : ""}${texto}${ESPACIO_DURO}${unidad}`;
}

/**
 * Cifras grandes legibles en poco ancho.
 * 999 → «999» · 1800 → «1,8 mil» · 42600 → «42,6 mil» · 105300 → «105,3 mil»
 * · 1200000 → «1,2 M» · 2500000000 → «2,5 mil M».
 */
export function formatoCompacto(valor: number): string {
  if (!Number.isFinite(valor)) return NO_DATO;
  const absoluto = Math.abs(valor);
  if (absoluto < 1000 && Math.round(absoluto) < 1000)
    return componer(valor, 0);
  const escalas = [
    { desde: 1e9, divisor: 1e9, sufijo: "mil\u00a0M" },
    { desde: 1e6, divisor: 1e6, sufijo: "M" },
    { desde: 1e3, divisor: 1e3, sufijo: "mil" },
  ] as const;
  for (const [indice, escala] of escalas.entries()) {
    if (absoluto < escala.desde && Math.round(absoluto) < escala.desde)
      continue;
    const escalado = valor / escala.divisor;
    // 999 950 se redondea a «1000 mil»: asciende a la escala superior.
    const superior = escalas[indice - 1];
    if (superior && Math.abs(Number(escalado.toFixed(1))) >= 1000)
      return `${componer(valor / superior.divisor, 1)}${ESPACIO_DURO}${superior.sufijo}`;
    return `${componer(escalado, 1)}${ESPACIO_DURO}${escala.sufijo}`;
  }
  return componer(valor, 0);
}

/** Dinero en dólares: 1234.5 → «US$ 1 234,50». */
export function formatoMoneda(valor: number): string {
  if (!Number.isFinite(valor)) return NO_DATO;
  const { negativo, entero, fraccion } = partes(valor, 2);
  return `${negativo ? "-" : ""}US$${ESPACIO_DURO}${agrupar(entero)},${fraccion.padEnd(2, "0")}`;
}
