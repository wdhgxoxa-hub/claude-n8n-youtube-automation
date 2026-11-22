import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MediosVideo } from "@/componentes/medios-video";
import { sinObservabilidad } from "@/contratos/observabilidad";
import type { VideoMedios } from "@/contratos/video-medios";

const videoId = "video-ficticio";
const datos = {
  ...sinObservabilidad,
  montaje: "https://example.test/ficticio.mp4",
};

it("no inventa un halo antes de recibir el color del servidor", () => {
  const html = renderToStaticMarkup(
    <MediosVideo videoId={videoId} titulo="Ensayo local" datos={datos} />,
  );
  expect(html).toContain('data-tinte="false"');
  expect(html).not.toContain("--tinte:");
  expect(fetch).not.toHaveBeenCalled();
});

it("conserva el tinte de los medios del servidor y la transición del video", () => {
  const inicial: VideoMedios = {
    version: 1,
    videoId,
    estado: "listo",
    poster: {
      url: "/api/videos/video-ficticio/medios/poster",
      origen: "render",
      ancho: 1600,
      alto: 900,
    },
    preview: null,
    tinte: "hsl(210 40% 45%)",
    ancho: 1600,
    alto: 900,
    relacionAspecto: 16 / 9,
    origenDimensiones: "video",
    actualizadoEn: 1,
  };
  const html = renderToStaticMarkup(
    <MediosVideo
      videoId={videoId}
      titulo="Ensayo local"
      datos={datos}
      inicial={inicial}
    />,
  );
  expect(html).toContain('data-tinte="true"');
  expect(html).toContain("--tinte:hsl(210 40% 45%)");
  expect(html).toContain("view-transition-name:video-video-ficticio");
  expect(fetch).not.toHaveBeenCalled();
});
