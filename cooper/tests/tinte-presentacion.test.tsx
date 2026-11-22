import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MediosVideo } from "@/componentes/medios-video";
import { sinObservabilidad } from "@/contratos/observabilidad";

it("no inventa un tinte antes de recibir el color del servidor", () => {
  const html = renderToStaticMarkup(
    <MediosVideo
      videoId="video-ficticio"
      titulo="Ensayo local"
      datos={{
        ...sinObservabilidad,
        montaje: "https://example.test/ficticio.mp4",
      }}
    />,
  );
  expect(html).not.toContain("--tinte:");
  expect(fetch).not.toHaveBeenCalled();
});
