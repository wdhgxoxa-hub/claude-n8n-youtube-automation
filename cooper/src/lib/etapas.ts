export const ETAPAS = [
  "Radar",
  "Guion",
  "Verificación",
  "Aprobación de guion",
  "Storyboard",
  "Imágenes y clips",
  "Voz y música",
  "Montaje",
  "Control de calidad",
  "Aprobación final",
  "Programado",
  "Publicado",
] as const;
export const esperaAprobacion = (stage: number) => stage === 3 || stage === 9;
export function siguienteEtapa(stage: number, approved = false): number {
  if (!Number.isInteger(stage) || stage < 0 || stage >= ETAPAS.length)
    throw new Error("Etapa inválida");
  return esperaAprobacion(stage) && !approved
    ? stage
    : Math.min(stage + 1, ETAPAS.length - 1);
}
export function guionInicial(title: string) {
  return `# ${title}\n\nAPERTURA · 0:00–0:08\nUna pregunta para empezar: ¿qué cambiaría si miramos este tema desde otra perspectiva?\n\nDESARROLLO · 0:08–0:45\nPresentamos ${title.toLowerCase()} en tres ideas claras, con ejemplos visuales propios. Cada afirmación se contrasta antes de pasar a producción.\n\nCIERRE · 0:45–1:00\nRecapitulamos la idea principal e invitamos a la audiencia a compartir su experiencia.\n\nNotas de producción: formato vertical 9:16, subtítulos legibles, música suave y una voz cercana.`;
}
