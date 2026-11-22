import type { PublicacionResultado } from "@/contratos/resultados";

// Retícula justificada: cada fila llena el ancho disponible con piezas de la
// misma altura. Las proporciones reales se respetan; la última fila conserva
// la altura objetivo y se alinea a la izquierda en lugar de estirarse.
export type Medida = { ancho: number; alto: number };

export type OpcionesReticula = {
  /** Altura de fila deseada, en px. */
  objetivo: number;
  /** Separación entre piezas de una fila, en px. */
  hueco: number;
  /** Múltiplo máximo del objetivo que una fila puede alcanzar. */
  tope?: number;
  /** Las alturas de fila caen en múltiplos de este paso. */
  paso?: number;
};

const PROPORCION_MIN = 0.25;
const PROPORCION_MAX = 4;

function proporcionValida(valor: number) {
  return Number.isFinite(valor) && valor > 0
    ? Math.min(PROPORCION_MAX, Math.max(PROPORCION_MIN, valor))
    : 16 / 9;
}

export function distribuirFilas(
  proporciones: number[],
  anchoTotal: number,
  { objetivo, hueco, tope = 1.25, paso = 8 }: OpcionesReticula,
): Medida[][] {
  const r = proporciones.map(proporcionValida);
  const filas: Medida[][] = [];
  if (!r.length || !(anchoTotal > 0)) return filas;
  const maximo = objetivo * tope;
  const libre = (cantidad: number) => anchoTotal - hueco * (cantidad - 1);
  const alturaDe = (inicio: number, fin: number) => {
    let suma = 0;
    for (let k = inicio; k < fin; k++) suma += r[k];
    return libre(fin - inicio) / suma;
  };
  const alinear = (alto: number) =>
    Math.max(paso, Math.round(alto / paso) * paso);

  let inicio = 0;
  while (inicio < r.length) {
    // Cabe todo lo que, a la altura objetivo, no pasa del ancho disponible.
    let fin = inicio + 1;
    while (fin < r.length && alturaDe(inicio, fin + 1) >= objetivo) fin++;
    const ultima = fin >= r.length;
    if (!ultima) {
      // La pieza siguiente desborda: se elige la fila más cercana al objetivo,
      // sin estirarla por encima del tope.
      const sin = alturaDe(inicio, fin);
      const con = alturaDe(inicio, fin + 1);
      if (sin > maximo || Math.abs(con - objetivo) < Math.abs(sin - objetivo))
        fin++;
    }
    const cantidad = fin - inicio;
    const natural = alturaDe(inicio, fin);
    if (ultima && natural >= objetivo) {
      // Última fila: altura objetivo, sin justificar.
      const alto = alinear(objetivo);
      filas.push(
        r
          .slice(inicio, fin)
          .map((p) => ({ ancho: Math.round(p * alto), alto })),
      );
    } else {
      const alto = Math.min(alinear(natural), Math.floor(maximo / paso) * paso);
      const bruto = r.slice(inicio, fin).map((p) => p * alto);
      const total = bruto.reduce((a, b) => a + b, 0);
      // El redondeo de la altura deja unos píxeles de más o de menos: se
      // reparten entre las piezas para que la fila cierre exacta.
      const escala = libre(cantidad) / total;
      const anchos = bruto.map((a) => Math.floor(a * escala));
      let resto =
        Math.floor(libre(cantidad)) - anchos.reduce((a, b) => a + b, 0);
      for (let k = 0; resto > 0; k = (k + 1) % anchos.length, resto--)
        anchos[k]++;
      filas.push(anchos.map((ancho) => ({ ancho, alto })));
    }
    inicio = fin;
  }
  return filas;
}

/**
 * Proporción real de una pieza: las dimensiones de la publicación mandan sobre
 * la reserva genérica 16:9 que el servidor usa cuando todavía no hay medio.
 */
export function proporcionPublicacion(p: PublicacionResultado) {
  if (p.tipo === "marca")
    return p.formato === "reel" || p.formato === "historia" ? 9 / 16 : 1;
  const medios = p.medios;
  if (medios && medios.origenDimensiones !== "reserva")
    return medios.relacionAspecto;
  if (p.publicacion.ancho && p.publicacion.alto)
    return p.publicacion.ancho / p.publicacion.alto;
  return medios?.relacionAspecto ?? 16 / 9;
}

/** Tinte estable por canal o marca mientras la pieza no tiene color extraído. */
export function tinteEstable(clave: string) {
  let h = 0;
  for (const c of clave) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 30% 52%)`;
}
