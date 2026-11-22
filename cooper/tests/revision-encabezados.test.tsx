import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Estado } from "@/servicios/datos";
vi.mock("@/componentes/espacio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/componentes/espacio")>();
  return {
    ...actual,
    useEspacio: () => ({
      data: {
        user: { id: "propio", role: "usuario" },
        channels: [{ id: "canal", name: "Ciencia" }],
        assets: [],
        videos: [
          {
            id: "video",
            ownerId: "propio",
            channelId: "canal",
            title: "Título accesible",
            newsMode: false,
            avatarId: "",
            voiceId: "",
            avatarPlacement: "partes",
            productionState: "activa",
            productionNotice: "",
            remoteUpdatedAt: 0,
            stage: 0,
            script: "",
            feedback: "",
            references: "",
            scheduledAt: "",
            updatedAt: 1,
            createdAt: 0,
            observabilidad: {
              montaje: "",
              miniatura: "",
              escenas: [],
              publicaciones: [],
              incidencias: [],
            },
            medios: {
              version: 1,
              videoId: "video",
              estado: "sin_medio",
              poster: null,
              preview: null,
              tinte: "#7cc4ff",
              ancho: 1600,
              alto: 900,
              relacionAspecto: 16 / 9,
              origenDimensiones: "reserva",
              actualizadoEn: 1,
            },
          } satisfies Estado["videos"][number],
        ],
      },
      refresh: async () => {},
    }),
  };
});
import { Videos } from "@/componentes/gestion";
it("R15 fábrica mantiene la jerarquía de pantalla, recorrido, estación y video sin saltos", () => {
  const html = renderToStaticMarkup(<Videos />);
  const headings = [
    ...html.matchAll(/<h([1-6])(?:\s[^>]*)?>(.*?)<\/h\1>/g),
  ].map((match) => ({ level: Number(match[1]), text: match[2] }));
  expect(
    headings.find((heading) => heading.text === "Título accesible")?.level,
  ).toBe(4);
  expect(headings[0].level).toBe(1);
  expect(
    headings.find((heading) => heading.text === "Del radar al mundo.")?.level,
  ).toBe(2);
  expect(headings.find((heading) => heading.text === "Radar")?.level).toBe(3);
  for (let index = 1; index < headings.length; index++) {
    expect(headings[index].level).toBeLessThanOrEqual(
      headings[index - 1].level + 1,
    );
  }
});
