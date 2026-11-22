import type { Estado } from "@/servicios/datos";
import type { Medicion, Publicacion } from "@/contratos/observabilidad";
import { periodosLima } from "@/lib/periodos";

export type VideoInicio = Estado["videos"][number];
const DIA = 86_400_000;
const numero = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });

/** Corte estable entre SSR e hidratación; avanza con la evidencia propia recibida. */
export function corteInicio(videos: readonly VideoInicio[], inicial: number) {
  let corte = inicial;
  for (const video of videos) {
    if (Number.isFinite(video.createdAt))
      corte = Math.max(corte, video.createdAt);
    if (Number.isFinite(video.updatedAt))
      corte = Math.max(corte, video.updatedAt);
    // La observabilidad puede actualizarse sin un nuevo paso de producción ni updatedAt.
    for (const publicacion of video.observabilidad.publicaciones)
      for (const medicion of publicacion.historial) {
        const fecha = Date.parse(medicion.fecha);
        if (Number.isFinite(fecha)) corte = Math.max(corte, fecha);
      }
  }
  return corte;
}

export function fechaTerminada(video: VideoInicio) {
  const fechas = video.observabilidad.publicaciones.flatMap((p) =>
    p.fecha && Number.isFinite(Date.parse(p.fecha))
      ? [Date.parse(p.fecha)]
      : [],
  );
  return fechas.length ? Math.max(...fechas) : video.updatedAt;
}

export function terminadosInicio(videos: readonly VideoInicio[]) {
  return videos
    .filter((v) => v.stage >= 9 && v.productionState !== "cancelada")
    .sort(
      (a, b) =>
        fechaTerminada(b) - fechaTerminada(a) || a.id.localeCompare(b.id),
    )
    .slice(0, 5);
}

export function ultimaMedicion(publicacion?: Publicacion) {
  return publicacion?.historial
    .slice()
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))[0];
}

export function publicacionPrincipal(video: VideoInicio, red?: string) {
  const publicaciones = video.observabilidad.publicaciones;
  return (
    publicaciones.find((p) => p.red.toLowerCase() === (red ?? "youtube")) ??
    (red ? undefined : publicaciones[0])
  );
}

export function nombreRed(red: string) {
  return (
    {
      youtube: "YouTube",
      tiktok: "TikTok",
      instagram: "Instagram",
      facebook: "Facebook",
    }[red] ?? red
  );
}

type Contador = "vistas" | "seguidoresGanados";
type Dato = { valor: number | null; serie: number[]; variacion: string };

// Historial acumulativo: nunca confundir el total de una publicación con sus
// vistas de los últimos siete días. Ausencia de una frontera = dato desconocido.
function acumulado(
  publicacion: Publicacion,
  metrica: Contador,
  instante: number,
) {
  const fecha = publicacion.fecha ? Date.parse(publicacion.fecha) : null;
  if (fecha !== null && fecha >= instante) return 0;
  const muestra = publicacion.historial
    .filter((m) => Date.parse(m.fecha) <= instante)
    .slice()
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))[0];
  if (
    !muestra ||
    instante - Date.parse(muestra.fecha) > DIA ||
    muestra[metrica] == null
  )
    return null;
  return muestra[metrica];
}

function incremento(
  publicaciones: Publicacion[],
  metrica: Contador,
  inicio: number,
  fin: number,
) {
  if (!publicaciones.length) return null;
  let total = 0;
  for (const publicacion of publicaciones) {
    const antes = acumulado(publicacion, metrica, inicio);
    const despues = acumulado(publicacion, metrica, fin);
    // Una corrección de contadores se conserva como ausencia, no como crecimiento.
    if (antes === null || despues === null || despues < antes) return null;
    total += despues - antes;
  }
  return total;
}

function variacion(
  actual: number | null,
  anterior: number | null,
  unidad = "%",
) {
  if (actual === null || anterior === null) return "Sin comparación todavía";
  if (anterior === 0 && unidad !== "pp")
    return actual === 0 ? "Sin cambios" : "Primeros resultados";
  const diferencia =
    unidad === "pp"
      ? actual - anterior
      : ((actual - anterior) / anterior) * 100;
  return `${diferencia > 0 ? "+" : ""}${numero.format(diferencia)} ${unidad} frente al período anterior`;
}

function datoSemanal(
  publicaciones: Publicacion[],
  metrica: Contador,
  ahora: number,
): Dato {
  const valor = incremento(publicaciones, metrica, ahora - 7 * DIA, ahora);
  const previo = incremento(
    publicaciones,
    metrica,
    ahora - 14 * DIA,
    ahora - 7 * DIA,
  );
  const puntos = Array.from({ length: 7 }, (_, i) =>
    incremento(publicaciones, metrica, ahora - 7 * DIA, ahora - (6 - i) * DIA),
  );
  return {
    valor,
    serie: puntos.every((n): n is number => n !== null) ? puntos : [],
    variacion: variacion(valor, previo),
  };
}

function retencion(publicaciones: Publicacion[], instante: number) {
  const muestras: Medicion[] = publicaciones.flatMap((p) => {
    const m = p.historial
      .filter((m) => Date.parse(m.fecha) <= instante)
      .slice()
      .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))[0];
    return m && m.retencion !== null && m.vistas !== null && m.vistas > 0
      ? [m]
      : [];
  });
  if (!muestras.length) return null;
  return (
    (muestras.reduce((n, m) => n + m.retencion! * m.vistas!, 0) /
      muestras.reduce((n, m) => n + m.vistas!, 0)) *
      100
  );
}

export function resumenInicio(videos: readonly VideoInicio[], ahora: number) {
  // Una sola red: su audiencia y retención no se mezclan con otras plataformas.
  const redes = [
    ...new Set(
      videos.flatMap((v) =>
        v.observabilidad.publicaciones.map((p) => p.red.toLowerCase()),
      ),
    ),
  ];
  const red = redes.includes("youtube") ? "youtube" : (redes[0] ?? "");
  const unicas = new Map<string, Publicacion>();
  for (const v of videos)
    for (const p of v.observabilidad.publicaciones) {
      if (p.red.toLowerCase() !== red) continue;
      const anterior = unicas.get(p.id);
      if (
        !anterior ||
        (Date.parse(ultimaMedicion(p)?.fecha ?? "") || -Infinity) >
          (Date.parse(ultimaMedicion(anterior)?.fecha ?? "") || -Infinity)
      )
        unicas.set(p.id, p);
    }
  const publicaciones = [...unicas.values()];
  const media = retencion(publicaciones, ahora);
  const anterior = retencion(publicaciones, ahora - 7 * DIA);
  const serieRetencion = Array.from({ length: 7 }, (_, i) =>
    retencion(publicaciones, ahora - (6 - i) * DIA),
  );
  const { month } = periodosLima(ahora);
  const anteriorMes = periodosLima(month - 1).month;
  const finComparacion = Math.min(month, anteriorMes + (ahora - month));
  const creados = videos.filter(
    (v) => v.createdAt >= month && v.createdAt <= ahora,
  ).length;
  const creadosAntes = videos.filter(
    (v) => v.createdAt >= anteriorMes && v.createdAt < finComparacion,
  ).length;
  return {
    red,
    vistas: datoSemanal(publicaciones, "vistas", ahora),
    seguidores: datoSemanal(publicaciones, "seguidoresGanados", ahora),
    retencion: {
      valor: media === null ? null : Math.round(media * 10) / 10,
      serie: serieRetencion.every((n): n is number => n !== null)
        ? serieRetencion
        : [],
      variacion: variacion(media, anterior, "pp"),
    },
    videos: {
      valor: creados,
      serie: Array.from(
        { length: 7 },
        (_, i) =>
          videos.filter(
            (v) =>
              v.createdAt >= month &&
              v.createdAt <= month + ((ahora - month) * (i + 1)) / 7,
          ).length,
      ),
      variacion: variacion(creados, creadosAntes),
    },
  };
}
