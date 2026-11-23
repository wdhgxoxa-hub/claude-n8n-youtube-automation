import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Resultados } from "@/contratos/resultados";
import type { Medicion } from "@/contratos/observabilidad";
import { Publicados } from "@/componentes/resultados";

vi.mock("@/componentes/espacio", () => ({
  api: vi.fn(),
  useEspacio: () => ({
    data: { videos: [], user: { role: "usuario" }, demo: false },
  }),
}));

// Datos con la forma de producción (22-11-2026): tres publicaciones reales y
// solo una con lectura, y esa lectura fue tomada a la hora de publicar (0 y 0).
function medicion(vistas: number, meGusta: number): Medicion {
  return {
    fecha: "2026-11-21T21:00:24.164Z",
    vistas,
    meGusta,
    comentarios: null,
    retencion: null,
  } as Medicion;
}
function produccion(medidas: Medicion[][]): Resultados {
  return {
    ambitos: [
      {
        id: "video:canal",
        tipo: "video",
        nombre: "Margen Real",
        ownerId: "dueno",
        propietario: "Walter",
      },
    ],
    publicaciones: medidas.map((historial, i) => ({
      id: `video:canal:p${i}`,
      ambitoId: "video:canal",
      tipo: "video" as const,
      titulo: `Historia ${i + 1}`,
      href: `/videos/v${i}`,
      fecha: `2026-11-2${i}T12:00:00Z`,
      redes: ["youtube"],
      simulada: false,
      identidad: `youtube:id${i}`,
      videoId: `v${i}`,
      publicacion: {
        id: `p${i}`,
        red: "youtube",
        url: `https://www.youtube.com/watch?v=abcdefghij${i}`,
        fecha: `2026-11-2${i}T12:00:00Z`,
        miniatura: "",
        historial,
      },
    })) as Resultados["publicaciones"],
    aprendizajes: [],
    incidencias: [],
  };
}
const pintar = (r: Resultados) =>
  renderToStaticMarkup(<Publicados initial={r} />);

it("sin ninguna lectura la pared dice «Sin medir todavía», nunca 0", () => {
  const html = pintar(produccion([[], [], []]));
  const cifras = html.slice(0, html.indexOf("Publicaciones</figcaption>"));
  expect(cifras.match(/Sin medir todavía/g)).toHaveLength(2);
  expect(cifras).not.toContain('class="cifra-valor">0</div>');
  // Cada tarjeta lo dice una vez, en lugar de «Sin dato» repetido.
  expect(html.match(/<strong>Sin medir todavía<\/strong>/g)).toHaveLength(3);
  expect(html).not.toContain("<strong>Sin dato</strong>");
});

it("una suma parcial declara cuántas publicaciones tienen lectura", () => {
  const html = pintar(produccion([[medicion(0, 0)], [], []]));
  expect(html).toContain("1 de 3 medidas");
  expect(html.match(/<strong>Sin medir todavía<\/strong>/g)).toHaveLength(2);
  // La pieza medida conserva su lectura real, aunque sea cero.
  expect(html.match(/<strong>0<\/strong>/g)).toHaveLength(2);
});

it("con todas medidas no añade la aclaración parcial", () => {
  const html = pintar(
    produccion([[medicion(307, 4)], [medicion(12, 1)], [medicion(5, 0)]]),
  );
  expect(html).not.toContain("medidas");
  expect(html).not.toContain("Sin medir todavía");
});
