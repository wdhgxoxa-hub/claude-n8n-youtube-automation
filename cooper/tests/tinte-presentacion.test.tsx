import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MediosVideo } from "@/componentes/medios-video";
import { sinObservabilidad } from "@/contratos/observabilidad";

it.each([undefined, "video-ficticio"])(
  "no inventa un halo antes de recibir el color del servidor (%s)",
  (videoId) => {
    const html = renderToStaticMarkup(
      <MediosVideo
        videoId={videoId}
        titulo="Ensayo local"
        datos={{
          ...sinObservabilidad,
          montaje: "https://example.test/ficticio.mp4",
        }}
      />,
    );
    expect(html).toContain('data-tinte="false"');
    expect(html).not.toContain("--tinte:");
    expect(fetch).not.toHaveBeenCalled();
  },
);
