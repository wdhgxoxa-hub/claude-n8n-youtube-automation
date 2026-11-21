import type { Estudio, Historica } from "./tipos";
import type { Marca } from "@/db/schema";
export const pilares = {
  "iglesia-reformada": [
    "Escritura y catecismo",
    "Vida de la congregación",
    "Domingos, grupos y servicio",
  ],
  moda: [
    "Prendas y materiales",
    "Combinaciones y cuidado",
    "Colecciones y disponibilidad",
  ],
  general: ["Enseñar", "Mostrar el trabajo", "Conversar con la comunidad"],
};
export function estudiar(
  m: Pick<Marca, "zona" | "rubro" | "guia">,
  rows: Historica[],
  now = Date.now(),
): Estudio {
  const historial = [
    ...new Map(
      rows
        .filter((r) => Number.isFinite(Date.parse(r.fecha)))
        .map((r) => [r.id, r]),
    ).values(),
  ]
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))
    .slice(0, 150);
  const withMetrics = historial.filter(
    (r) => r.metricas.alcance && r.metricas.interacciones !== null,
  );
  const horas = new Map<number, { total: number; n: number }>();
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: m.zona,
    hour: "numeric",
    hourCycle: "h23",
  });
  for (const r of withMetrics) {
    const hour = Number(formatter.format(new Date(r.fecha))),
      previous = horas.get(hour) ?? { total: 0, n: 0 };
    horas.set(hour, {
      total: previous.total + r.metricas.interacciones! / r.metricas.alcance!,
      n: previous.n + 1,
    });
  }
  const ranked = [...horas]
    .filter(([, h]) => h.n >= 2)
    .sort((a, b) => b[1].total / b[1].n - a[1].total / a[1].n)
    .map(([hour]) => hour)
    .slice(0, 3);
  const days =
    historial.length > 1
      ? Math.max(
          7,
          (Date.parse(historial[0].fecha) -
            Date.parse(historial.at(-1)!.fecha)) /
            86400000,
        )
      : 7;
  const mean = historial.length
    ? Math.round(
        historial.reduce((s, r) => s + r.texto.length, 0) / historial.length,
      )
    : 0;
  return {
    muestra: historial.length,
    visuales: historial.filter((r) => !!r.imagen).length,
    estilo: historial.length
      ? `Textos de ${mean} caracteres en promedio. ${historial.filter((r) => /#\w/.test(r.texto)).length} publicaciones usan etiquetas. Tono de la guía: ${m.guia.tono}. ${historial.some((r) => r.visual) ? `En ${historial.filter((r) => r.visual).length} imágenes examinadas: colores dominantes ${[...new Set(historial.flatMap((r) => (r.visual ? [r.visual.color] : [])))].join(", ")}; proporciones ${[...new Set(historial.flatMap((r) => (r.visual ? [r.visual.proporcion] : [])))].join(", ")}.` : "Las imágenes quedan como referencias para revisión visual; no hubo muestras descargables."}`
      : `Sin historial suficiente. Partimos de la guía: ${m.guia.tono}.`,
    frecuencia: historial.length
      ? Math.max(1, Math.min(7, Math.round((historial.length * 7) / days)))
      : 3,
    pilares: pilares[m.rubro],
    horas: ranked.length ? ranked : [18],
    evidencia: ranked.length
      ? `Hipótesis según interacción/alcance; ${withMetrics.length} piezas con métricas, al menos dos por hora. Validar con nuevas publicaciones.`
      : "Horario inicial de prueba, sin evidencia suficiente para afirmar que sea el mejor.",
    actualizado: now,
    historial,
  };
}
export function proximoHorario(
  zona: string,
  horas: number[],
  now = Date.now(),
) {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: zona,
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
  });
  for (
    let at = Math.ceil((now + 600000) / 3600000) * 3600000;
    at < now + 3 * 86400000;
    at += 1800000
  ) {
    const parts = formatter.formatToParts(at);
    if (
      horas.includes(Number(parts.find((p) => p.type === "hour")?.value)) &&
      parts.find((p) => p.type === "minute")?.value === "00"
    )
      return at;
  }
  return now + 86400000;
}
