import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const root = join(process.cwd(), "src");
const source = join(root, "app/tokens.css");
const colors =
  /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|hwb|lab|lch)\s*\(/i;
const clean = (value: string) => value.replace(/\/\*[\s\S]*?\*\//g, "");
const files = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : /\.(?:css|tsx?)$/.test(entry.name)
        ? [join(directory, entry.name)]
        : [],
  );

function invalidDeclaration(property: string, value: string) {
  if (colors.test(value)) return "color literal fuera de tokens";
  if (
    /^(?:color|background|fill|stroke|(?:background|border|outline|text-decoration)(?:-color|Color))$/.test(
      property,
    ) &&
    /^(?!var\(|color-mix\(|(?:repeating-)?(?:linear|radial|conic)-gradient\(|url\(|(?:inherit|initial|unset|none|transparent|currentColor)$)[a-z]+$/i.test(
      value,
    )
  )
    return "nombre de color fuera de tokens";
  if (/^(?:font-size|fontSize)$/.test(property)) {
    if (
      !/^(?:inherit|var\(--(?:texto-(?:12|13|15|17|20|28|40|48|56|72)|titulo-pantalla|titulo-seccion|cifra-heroe)\))$/.test(
        value,
      )
    )
      return "tamaño de texto fuera de tokens";
  }
  if (
    /^(?:border(?:-[\w]+)?-radius|border(?:[A-Z][a-z]+)*Radius)$/.test(property)
  ) {
    if (
      !/^(?:0|inherit|var\(--radio-(?:control|tarjeta|panel|pildora)\))(?:\s+(?:0|var\(--radio-(?:control|tarjeta|panel|pildora)\)))*$/.test(
        value,
      )
    )
      return "radio fuera de tokens";
  }
  return null;
}

describe("guardián de Sala de proyección", () => {
  it("conserva los colores obligatorios y una única fuente de tokens", () => {
    const css = clean(readFileSync(source, "utf8"));
    for (const [token, value] of Object.entries({
      lienzo: "#000000",
      "sup-1": "#0A0A0C",
      "sup-2": "#111114",
      "sup-3": "#18181C",
      texto: "#F5F5F7",
      "texto-2": "#A1A1AA",
      "texto-3": "#71717A",
      tally: "#FF4D2E",
      sube: "#3DDC97",
      baja: "#FF6B6B",
      aviso: "#FFC53D",
      info: "#7CC4FF",
    }))
      expect(css).toMatch(new RegExp(`--${token}:\\s*${value}\\s*;`, "i"));
    const radii = [...css.matchAll(/--radio-[\w-]+:\s*([\d.]+)px/g)].map((m) =>
      Number(m[1]),
    );
    expect(new Set(radii)).toEqual(new Set([8, 14, 22, 999]));
    const sizes = [
      ...css.matchAll(
        /--(?:texto|tipo|tamano|fuente|font)-[\w-]+:\s*([\d.]+)px/g,
      ),
    ].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThanOrEqual(9);
    expect(
      sizes.every((n) => [12, 13, 15, 17, 20, 28, 40, 48, 56, 72].includes(n)),
    ).toBe(true);
    expect(css).not.toMatch(/data-theme.*claro|color-scheme:\s*light/);
  });

  it("impide colores, tamaños y radios sueltos en CSS y estilos React", () => {
    const errors: string[] = [];
    for (const path of files(root)) {
      if (path === source) continue;
      const content = clean(readFileSync(path, "utf8"));
      const report = (property: string, value: string, position: number) => {
        const reason = invalidDeclaration(property, value.trim());
        if (reason)
          errors.push(
            `${relative(root, path)}:${content.slice(0, position).split("\n").length} ${property}: ${value} (${reason})`,
          );
      };
      if (path.endsWith(".css")) {
        for (const match of content.matchAll(
          /(?:^|[;{])\s*([\w-]+)\s*:\s*([^;{}]+)/g,
        )) {
          report(match[1], match[2], match.index);
        }
        expect(content, path).not.toMatch(/data-theme.*claro/);
      } else {
        const parsed = ts.createSourceFile(
          path,
          content,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX,
        );
        const visit = (node: ts.Node) => {
          if (ts.isPropertyAssignment(node)) {
            const property = node.name
              .getText(parsed)
              .replace(/^['"]|['"]$/g, "");
            if (
              /^(?:fontSize|border(?:[A-Z][a-z]+)*Radius|color|background|backgroundColor|borderColor|outlineColor|boxShadow)$/.test(
                property,
              )
            ) {
              if (
                ts.isStringLiteralLike(node.initializer) ||
                ts.isNumericLiteral(node.initializer)
              )
                report(property, node.initializer.text, node.pos);
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(parsed);
      }
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  it("detecta regresiones concretas sin aceptar literales que coincidan con la paleta", () => {
    expect(invalidDeclaration("font-size", "11px")).toBeTruthy();
    expect(invalidDeclaration("fontSize", "11")).toBeTruthy();
    expect(invalidDeclaration("border-radius", "10px")).toBeTruthy();
    expect(invalidDeclaration("borderRadius", "50%")).toBeTruthy();
    expect(invalidDeclaration("color", "#FF4D2E")).toBeTruthy();
    expect(invalidDeclaration("background", "rgba(0, 0, 0, .6)")).toBeTruthy();
    expect(invalidDeclaration("color", "rebeccapurple")).toBeTruthy();
    expect(
      invalidDeclaration("font-size", "var(--token-inventado)"),
    ).toBeTruthy();
    expect(
      invalidDeclaration("border-radius", "var(--espacio-16)"),
    ).toBeTruthy();
    expect(invalidDeclaration("font-size", "var(--texto-12)")).toBeNull();
    expect(
      invalidDeclaration("border-radius", "var(--radio-tarjeta)"),
    ).toBeNull();
    expect(invalidDeclaration("color", "var(--tally)")).toBeNull();
  });
});
