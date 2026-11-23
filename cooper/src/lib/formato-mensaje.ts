/**
 * Formato mínimo de las respuestas de Cooper: párrafos, listas («- », «* »,
 * «• », «1. ») y **negritas**. No interpreta HTML ni enlaces: todo lo demás
 * queda como texto, así que nada de lo que escriba el modelo puede inyectarse.
 */
export type Tramo = { texto: string; fuerte: boolean };
export type Bloque =
  | { tipo: "parrafo"; lineas: Tramo[][] }
  | { tipo: "lista"; ordenada: boolean; items: Tramo[][] };

const VIÑETA = /^\s*(?:[-*•]|(\d{1,3})[.)])\s+(.*)$/;

export function tramos(linea: string): Tramo[] {
  const partes: Tramo[] = [];
  let resto = linea;
  for (;;) {
    const abre = resto.indexOf("**");
    const cierra = abre < 0 ? -1 : resto.indexOf("**", abre + 2);
    // Sin pareja (o negrita vacía) los asteriscos son texto corriente.
    if (cierra < 0 || cierra === abre + 2) break;
    if (abre > 0) partes.push({ texto: resto.slice(0, abre), fuerte: false });
    partes.push({ texto: resto.slice(abre + 2, cierra), fuerte: true });
    resto = resto.slice(cierra + 2);
  }
  if (resto) partes.push({ texto: resto, fuerte: false });
  return partes;
}

export function bloquesMensaje(contenido: string): Bloque[] {
  const bloques: Bloque[] = [];
  let abierto: Bloque | null = null;
  const cerrar = () => {
    if (abierto) bloques.push(abierto);
    abierto = null;
  };
  for (const cruda of contenido.replace(/\r\n?/g, "\n").split("\n")) {
    const linea = cruda.trimEnd();
    if (!linea.trim()) {
      cerrar();
      continue;
    }
    const viñeta = VIÑETA.exec(linea);
    if (viñeta) {
      const ordenada = viñeta[1] !== undefined;
      if (abierto?.tipo !== "lista" || abierto.ordenada !== ordenada) {
        cerrar();
        abierto = { tipo: "lista", ordenada, items: [] };
      }
      abierto.items.push(tramos(viñeta[2]));
    } else {
      if (abierto?.tipo !== "parrafo") {
        cerrar();
        abierto = { tipo: "parrafo", lineas: [] };
      }
      abierto.lineas.push(tramos(linea.trimStart()));
    }
  }
  cerrar();
  return bloques;
}
