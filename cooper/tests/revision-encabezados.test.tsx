import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
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
            stage: 0,
            createdAt: 0,
          },
        ],
      },
      refresh: async () => {},
    }),
  };
});
import { Videos } from "@/componentes/gestion";
it("R15 los títulos de videos siguen al h1 sin saltar a h3", () => {
  const html = renderToStaticMarkup(<Videos />);
  const headings = [
    ...html.matchAll(/<h([1-6])(?:\s[^>]*)?>(.*?)<\/h\1>/g),
  ].map((match) => ({ level: Number(match[1]), text: match[2] }));
  expect(
    headings.find((heading) => heading.text === "Título accesible")?.level,
  ).toBe(2);
});
