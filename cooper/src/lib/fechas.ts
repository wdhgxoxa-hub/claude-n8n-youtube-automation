/**
 * Formateador único de fechas con hora de Cooper (es-PE).
 *
 * Los textos de fecha y hora de Intl salen de los datos de idioma (CLDR) de
 * cada motor, y esos datos cambian entre versiones: con «es-PE», el ICU 78 de
 * Node escribe «22 nov. 2026, 8:44 a. m.» y el ICU 72 de WebKit «22 nov. 2026,
 * 08:44». Si el servidor y el navegador escriben distinto, React no puede
 * hidratar la página (error #418).
 *
 * Aquí Intl solo aporta los números de la fecha en la zona pedida, que son
 * iguales en todos los motores; el orden, los meses y «a. m./p. m.» los pone
 * Cooper. Todas las pantallas que muestran una hora usan estas funciones; no se
 * debe llamar a Intl.DateTimeFormat ni a toLocaleString con hora.
 */
import { ESPACIO_DURO } from "./cifras";

export const ZONA_LIMA = "America/Lima";

const MESES = [
  "ene.",
  "feb.",
  "mar.",
  "abr.",
  "may.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "oct.",
  "nov.",
  "dic.",
] as const;

const NO_DATO = "—";

const lectores = new Map<string, Intl.DateTimeFormat>();

function lector(zona: string) {
  let formato = lectores.get(zona);
  if (!formato) {
    formato = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    lectores.set(zona, formato);
  }
  return formato;
}

type Valor = string | number | Date;

/** Números de la fecha en la zona dada; null si la fecha no es válida. */
function partes(valor: Valor, zona: string) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  const leidas: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const parte of lector(zona).formatToParts(fecha))
    if (parte.type !== "literal") leidas[parte.type] = Number(parte.value);
  return {
    anio: leidas.year ?? 0,
    mes: leidas.month ?? 1,
    dia: leidas.day ?? 1,
    // Algunos motores escriben «24» para la medianoche aun con h23.
    hora: (leidas.hour ?? 0) % 24,
    minuto: leidas.minute ?? 0,
  };
}

/** 13:04 → «1:04 p. m.»; la hora y su franja no se separan al cortar la línea. */
function hora12(hora: number, minuto: number) {
  const franja = hora < 12 ? "a." : "p.";
  return `${hora % 12 || 12}:${String(minuto).padStart(2, "0")}${ESPACIO_DURO}${franja}${ESPACIO_DURO}m.`;
}

/** «22 nov. 2026, 1:04 p. m.» en la zona dada (Lima por omisión). */
export function formatoFechaHora(valor: Valor, zona: string = ZONA_LIMA) {
  const p = partes(valor, zona);
  if (!p) return NO_DATO;
  return `${p.dia} ${MESES[p.mes - 1]} ${p.anio}, ${hora12(p.hora, p.minuto)}`;
}

/** «22/11/26, 1:04 p. m.»: la misma fecha en poco ancho. */
export function formatoFechaHoraCorta(valor: Valor, zona: string = ZONA_LIMA) {
  const p = partes(valor, zona);
  if (!p) return NO_DATO;
  const mes = String(p.mes).padStart(2, "0");
  const anio = String(p.anio % 100).padStart(2, "0");
  return `${p.dia}/${mes}/${anio}, ${hora12(p.hora, p.minuto)}`;
}

/** «22 nov., 1:04 p. m.»: día y hora sin año, para lo que está por venir. */
export function formatoDiaHora(valor: Valor, zona: string = ZONA_LIMA) {
  const p = partes(valor, zona);
  if (!p) return NO_DATO;
  return `${p.dia} ${MESES[p.mes - 1]}, ${hora12(p.hora, p.minuto)}`;
}
