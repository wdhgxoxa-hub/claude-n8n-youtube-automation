import { describe, expect, it } from "vitest";
import { bloquesMensaje, tramos } from "@/lib/formato-mensaje";

const texto = (lineas: { texto: string }[][]) =>
  lineas.map((l) => l.map((t) => t.texto).join(""));

describe("formato de las respuestas de Cooper", () => {
  it("separa párrafos y reconoce listas con guion, punto y número", () => {
    const bloques = bloquesMensaje(
      "¡Hola! Soy Cooper.\nTienes dos canales.\n\nPuedo ayudarte a:\n- Crear canales.\n- Producir videos.\n\n1. Uno\n2) Dos\n\n¿Qué quieres hacer?",
    );
    expect(bloques.map((b) => b.tipo)).toEqual([
      "parrafo",
      "parrafo",
      "lista",
      "lista",
      "parrafo",
    ]);
    expect(bloques[0].tipo === "parrafo" && texto(bloques[0].lineas)).toEqual([
      "¡Hola! Soy Cooper.",
      "Tienes dos canales.",
    ]);
    expect(bloques[2]).toMatchObject({ tipo: "lista", ordenada: false });
    expect(bloques[2].tipo === "lista" && texto(bloques[2].items)).toEqual([
      "Crear canales.",
      "Producir videos.",
    ]);
    expect(bloques[3]).toMatchObject({ tipo: "lista", ordenada: true });
  });

  it("marca negritas solo cuando tienen pareja", () => {
    expect(tramos("Va en **etapa 4** hoy")).toEqual([
      { texto: "Va en ", fuerte: false },
      { texto: "etapa 4", fuerte: true },
      { texto: " hoy", fuerte: false },
    ]);
    expect(tramos("2 ** 3 = 8")).toEqual([
      { texto: "2 ** 3 = 8", fuerte: false },
    ]);
    expect(tramos("****")).toEqual([{ texto: "****", fuerte: false }]);
  });

  it("no pierde ni un carácter visible y deja el HTML como texto", () => {
    const entrada =
      'Un <b>título</b> y <script>alert("x")</script>\n- [enlace](http://x)\n  sigue\n\n-sin espacio no es lista\n3.14 tampoco';
    const bloques = bloquesMensaje(entrada);
    const visible = bloques
      .flatMap((b) => texto(b.tipo === "lista" ? b.items : b.lineas))
      .join("");
    expect(visible).toContain('<script>alert("x")</script>');
    expect(visible.replace(/\s/g, "")).toBe(
      entrada.replace(/^- /m, "").replace(/\s/g, ""),
    );
    expect(bloques.at(-1)).toMatchObject({ tipo: "parrafo" });
  });

  it("un mensaje vacío o de solo espacios no produce bloques", () => {
    expect(bloquesMensaje("")).toEqual([]);
    expect(bloquesMensaje(" \n\n ")).toEqual([]);
  });
});
