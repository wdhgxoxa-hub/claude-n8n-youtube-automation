import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AmbitoResultado } from "@/contratos/resultados";

let demo = false;
vi.mock("@/componentes/espacio", () => ({
  useEspacio: () => ({
    data: { videos: [], user: { role: "admin" }, demo },
  }),
  api: vi.fn(),
}));
const { Origen } = await import("@/componentes/resultados");

const ambito: AmbitoResultado = {
  id: "video:c",
  tipo: "video",
  nombre: "Ciencia cotidiana",
  ownerId: "u",
  propietario: "Alex",
};

it("la etiqueta de ejemplo solo aparece en modo demostración", () => {
  demo = false;
  expect(
    renderToStaticMarkup(<Origen ambito={ambito} simulada={true} />),
  ).not.toContain("ejemplo");
  demo = true;
  expect(
    renderToStaticMarkup(<Origen ambito={ambito} simulada={true} />),
  ).toContain("Datos de ejemplo");
  expect(
    renderToStaticMarkup(<Origen ambito={ambito} simulada={false} />),
  ).not.toContain("ejemplo");
});

it("el propietario se muestra solo cuando hace falta distinguirlo", () => {
  demo = false;
  expect(
    renderToStaticMarkup(
      <Origen ambito={ambito} simulada={false} conPropietario={false} />,
    ),
  ).not.toContain("Alex");
  expect(
    renderToStaticMarkup(<Origen ambito={ambito} simulada={false} />),
  ).toContain("Alex");
});
