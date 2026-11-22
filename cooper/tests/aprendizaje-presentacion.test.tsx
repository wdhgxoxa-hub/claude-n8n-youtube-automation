import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Resultados } from "@/contratos/resultados";
import { sinFiltros } from "@/contratos/resultados";
import { Aprendizaje } from "@/componentes/aprendizaje-vista";

vi.mock("@/componentes/espacio", () => ({
  useEspacio: () => ({
    data: { videos: [], user: { role: "usuario" }, demo: false },
  }),
}));
vi.mock("@/componentes/resultados", () => ({
  Filtros: () => null,
  Origen: () => null,
  useResultados: (initial: Resultados) => ({
    resultado: initial,
    filtro: { ...sinFiltros },
    error: "",
  }),
}));

function ejemplo(): Resultados {
  return {
    ambitos: [
      {
        id: "video:canal",
        tipo: "video",
        nombre: "Ensayo local",
        ownerId: "ficticio",
        propietario: "Persona ficticia",
      },
    ],
    aprendizajes: [
      {
        id: "aprendizaje",
        ambitoId: "video:canal",
        tipo: "video",
        titulo: "Abrir con una pregunta",
        href: "/canales/canal",
        fecha: "2026-11-20T12:00:00Z",
        redes: ["youtube"],
        simulada: true,
        leccion: {
          id: "leccion",
          fecha: "2026-11-20T12:00:00Z",
          resumen: "Abrir con una pregunta",
          ganchos: [],
          temas: [],
          nivel: "hipotesis",
          causa: "La explicación llega después de la apertura.",
          correccion: "Mover la explicación al inicio.",
          origenes: [
            {
              videoId: "anterior",
              red: "YouTube",
              ventana: "24h",
              fecha: "2026-11-19T12:00:00Z",
              metrica: "retencion",
              valor: 0.4,
              demoraHoras: 0,
            },
          ],
          aplicaciones: [
            { videoId: "siguiente", cambio: "La explicación abre el video." },
          ],
        },
      },
    ],
    publicaciones: [
      {
        id: "publicacion",
        ambitoId: "video:canal",
        tipo: "video",
        titulo: "Una segunda mirada",
        href: "/videos/siguiente",
        fecha: "2026-11-21T12:00:00Z",
        redes: ["youtube"],
        simulada: true,
        videoId: "siguiente",
        identidad: "solo-ensayo",
        publicacion: {
          id: "publicacion",
          red: "youtube",
          url: "",
          miniatura: "",
          fecha: "2026-11-21T12:00:00Z",
          historial: [
            {
              fecha: "2026-11-22T12:00:00Z",
              vistas: 200,
              comentarios: 2,
              meGusta: 5,
              retencion: 0.63,
              ventana: "24h",
            },
            {
              fecha: "2026-11-21T12:00:00Z",
              vistas: 100,
              comentarios: 0,
              meGusta: 3,
              retencion: 0.55,
              ventana: "24h",
            },
            {
              fecha: "2026-11-23T12:00:00Z",
              vistas: 300,
              comentarios: 4,
              meGusta: 9,
              retencion: 0.99,
              ventana: "72h",
            },
          ],
        },
      },
    ],
    incidencias: [],
  };
}

const pintar = (datos: Resultados) =>
  renderToStaticMarkup(<Aprendizaje initial={datos} />);

it("compara la última medición de la misma red y ventana sin atribuir causalidad", () => {
  const html = pintar(ejemplo());
  expect(html).toContain("Antes: 40 % · 24h");
  expect(html).toContain('class="cifra-valor">63</div>');
  expect(html).not.toContain('class="cifra-valor">99</div>');
  expect(html).toContain("Todavía no demuestra que el cambio sea la causa.");
  expect(html).toContain("La fecha del cambio aún no está disponible.");
  expect(fetch).not.toHaveBeenCalled();
});

it("muestra el póster de la red que dio origen a la lección cuando hay cortes distintos", () => {
  const datos = ejemplo();
  const publicacion = datos.publicaciones[0];
  if (publicacion.tipo !== "video")
    throw new Error("Fixture de video inválida");
  for (const red of ["instagram", "youtube"]) {
    datos.publicaciones.push({
      ...publicacion,
      id: `origen-${red}`,
      videoId: "anterior",
      href: "/videos/anterior",
      titulo: "Video anterior",
      publicacion: { ...publicacion.publicacion, id: `origen-${red}`, red },
      medios: {
        version: 1,
        videoId: "anterior",
        estado: "listo",
        poster: {
          url: `/api/videos/anterior/medios/poster?red=${red}`,
          origen: "render",
          ancho: 1600,
          alto: 900,
        },
        preview: null,
        tinte: "",
        ancho: 1600,
        alto: 900,
        relacionAspecto: 16 / 9,
        origenDimensiones: "video",
        actualizadoEn: 0,
      },
    });
  }
  const html = pintar(datos);
  expect(html).toContain("/api/videos/anterior/medios/poster?red=youtube");
  expect(html).not.toContain(
    "/api/videos/anterior/medios/poster?red=instagram",
  );
});

it.each([
  "otra red",
  "otra ventana",
  "medición previa",
  "mismo video",
  "otro canal",
])("espera un resultado comparable cuando hay %s", (caso) => {
  const datos = ejemplo();
  const siguiente = datos.publicaciones[0];
  const aprendizaje = datos.aprendizajes[0];
  if (siguiente.tipo !== "video" || aprendizaje.tipo !== "video")
    throw new Error("Fixture de video inválida");
  if (caso === "otra red") siguiente.publicacion.red = "instagram";
  if (caso === "otra ventana")
    siguiente.publicacion.historial.forEach((m) => {
      m.ventana = "7d";
    });
  if (caso === "medición previa")
    siguiente.publicacion.historial.forEach((m) => {
      m.fecha = "2026-11-18T12:00:00Z";
    });
  if (caso === "mismo video")
    aprendizaje.leccion.aplicaciones![0].videoId = "anterior";
  if (caso === "otro canal") siguiente.ambitoId = "video:ajeno";
  const html = pintar(datos);
  expect(html).toContain("Esperando el siguiente resultado");
  expect(html).not.toContain("Antes: 40 %");
});

it("conserva una cifra ausente como ausente y distingue el ejemplo vacío de datos reales", () => {
  const datos = ejemplo();
  const aprendizaje = datos.aprendizajes[0];
  if (aprendizaje.tipo !== "video")
    throw new Error("Fixture de video inválida");
  aprendizaje.leccion.origenes = [];
  const html = pintar(datos);
  expect(html).toContain("Sin cifra enlazada");
  expect(html).toContain("Sin dato");
  expect(html).not.toContain('class="cifra-valor">0</div>');
  datos.aprendizajes = [];
  expect(pintar(datos)).toContain("Ejemplo ficticio · así se lee una lección");
});
