import { describe, expect, it } from "vitest";
import { resumenInicio, terminadosInicio, ultimaMedicion, type VideoInicio } from "@/componentes/inicio-datos";
import { sinObservabilidad, type Publicacion } from "@/contratos/observabilidad";

const DIA = 86400000;
const ahora = Date.parse("2026-11-21T17:00:00-05:00");
function publicacion(id = "p", red = "youtube", multiplicador = 1): Publicacion {
  return {
    id, red, url: "", miniatura: "", fecha: new Date(ahora - 30 * DIA).toISOString(),
    historial: Array.from({ length: 15 }, (_, i) => ({
      fecha: new Date(ahora - (14 - i) * DIA).toISOString(),
      vistas: (1000 + i * 100) * multiplicador,
      seguidoresGanados: 10 + i,
      retencion: 0.5 + i / 100,
      meGusta: 10, comentarios: 2,
    })),
  };
}
function video(id: string, opciones: Partial<VideoInicio> = {}): VideoInicio {
  return {
    id, ownerId: "propietario", channelId: "canal", title: id, stage: 11,
    productionState: "activa", createdAt: ahora - DIA, updatedAt: ahora,
    observabilidad: { ...sinObservabilidad, publicaciones: [publicacion(id)] },
    ...opciones,
  } as VideoInicio;
}

describe("Inicio: cifras con contexto y sin resultados inventados", () => {
  it("calcula incremento semanal en una red sin sumar audiencias ni duplicar una publicación", () => {
    const v = video("v", { observabilidad: { ...sinObservabilidad, publicaciones: [publicacion(), publicacion("tiktok", "tiktok", 100)] } });
    const resultado = resumenInicio([v, video("copia", { observabilidad: v.observabilidad })], ahora);
    expect(resultado.red).toBe("youtube");
    expect(resultado.vistas.valor).toBe(700);
    expect(resultado.vistas.serie).toEqual([100, 200, 300, 400, 500, 600, 700]);
    expect(resultado.seguidores.valor).toBe(7);
    expect(resultado.retencion.valor).toBe(64);
    expect(resultado.vistas.variacion).toBe("0 % frente al período anterior");
  });

  it("no transforma límites ausentes o antiguos en cero ni en totales de siete días", () => {
    const p = publicacion();
    p.historial = p.historial.slice(-1);
    const v = video("sin-base", { observabilidad: { ...sinObservabilidad, publicaciones: [p] } });
    expect(resumenInicio([v], ahora).vistas.valor).toBeNull();
    expect(resumenInicio([v], ahora).vistas.serie).toEqual([]);
    expect(resumenInicio([video("v")], ahora + 2 * DIA).vistas.valor).toBeNull();
    p.historial[0].seguidoresGanados = undefined;
    expect(resumenInicio([v], ahora).seguidores.valor).toBeNull();
  });

  it("prefiere la copia con mediciones aunque la primera publicación venga sin historial", () => {
    const vacia = publicacion("duplicada");
    vacia.historial = [];
    const v = video("v", { observabilidad: { ...sinObservabilidad, publicaciones: [vacia, publicacion("duplicada")] } });
    expect(resumenInicio([v], ahora).vistas.valor).toBe(700);
  });

  it("una publicación nueva empieza en cero y conserva crecimiento real", () => {
    const p = publicacion();
    p.fecha = new Date(ahora - 3 * DIA).toISOString();
    p.historial = p.historial.slice(-3);
    const resultado = resumenInicio([video("nueva", { observabilidad: { ...sinObservabilidad, publicaciones: [p] } })], ahora);
    expect(resultado.vistas.valor).toBe(2400);
    expect(resultado.vistas.variacion).toBe("Primeros resultados");
    expect(resultado.vistas.serie.slice(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it("pondera retención por vistas observadas y conserva el valor cero", () => {
    const a = publicacion("a");
    const b = publicacion("b");
    a.historial.at(-1)!.vistas = 300;
    a.historial.at(-1)!.retencion = 0;
    b.historial.at(-1)!.vistas = 100;
    b.historial.at(-1)!.retencion = 1;
    expect(resumenInicio([video("retencion", { observabilidad: { ...sinObservabilidad, publicaciones: [a, b] } })], ahora).retencion.valor).toBe(25);
  });

  it("cuenta el mes de Lima, no el cambio de mes UTC", () => {
    const instante = Date.parse("2026-12-01T03:00:00Z");
    const resultado = resumenInicio([
      video("noviembre", { createdAt: Date.parse("2026-11-30T22:00:00Z") }),
      video("diciembre-utc", { createdAt: Date.parse("2026-12-01T02:00:00Z") }),
      video("fuera", { createdAt: Date.parse("2026-11-01T03:00:00Z") }),
    ], instante);
    expect(resultado.videos.valor).toBe(2);
  });

  it("selecciona los cinco últimos terminados sin cancelados y sin mutar la respuesta SSE", () => {
    const videos = Array.from({ length: 7 }, (_, i) => video(String(i), { stage: 9, updatedAt: ahora - i * DIA, observabilidad: sinObservabilidad }));
    videos.push(video("cancelada", { productionState: "cancelada" }));
    videos.push(video("en-montaje", { stage: 7 }));
    const original = structuredClone(videos);
    expect(terminadosInicio(videos).map((v) => v.id)).toEqual(["0", "1", "2", "3", "4"]);
    expect(videos).toEqual(original);
    const p = publicacion();
    p.historial.reverse();
    expect(ultimaMedicion(p)?.vistas).toBe(2400);
  });
});
