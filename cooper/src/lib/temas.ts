/** Temas de apariencia. Los colores viven en `app/tokens.css` (html[data-tema]). */
export const TEMAS = ["feria", "sala", "dia"] as const;
export type Tema = (typeof TEMAS)[number];
export const TEMA_INICIAL: Tema = "feria";

export const TEMAS_INFO: Record<
  Tema,
  { nombre: string; lema: string; esquema: "oscuro" | "claro" }
> = {
  feria: {
    nombre: "Feria",
    lema: "Alegre. Un color para cada sección.",
    esquema: "oscuro",
  },
  sala: {
    nombre: "Sala",
    lema: "Sobria. Negro de cine y un solo acento.",
    esquema: "oscuro",
  },
  dia: {
    nombre: "Día",
    lema: "Clara. Papel, aire y vidrio esmerilado.",
    esquema: "claro",
  },
};

/** Cualquier valor desconocido (o ausente) cae en el tema inicial. */
export function temaValido(valor: unknown): Tema {
  return (TEMAS as readonly unknown[]).includes(valor)
    ? (valor as Tema)
    : TEMA_INICIAL;
}
