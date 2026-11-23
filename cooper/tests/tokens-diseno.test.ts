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
  if (property === "font" && /\d(?:px|rem|em|pt|vw|vh|%)/.test(value))
    return "atajo tipográfico fuera de tokens";
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
      !/^(?:inherit|var\(--(?:texto-(?:12|13|15|17|20|28|40|48|56|72)|titulo-pantalla|titulo-seccion|titulo-cartel|cifra-heroe|cifra-fluida|cifra-fluida-menor)\))$/.test(
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
      lienzo: "#0B0B1E",
      "sup-1": "#121230",
      "sup-2": "#1A1A40",
      "sup-3": "#24244F",
      texto: "#FFFFFF",
      "texto-2": "#CFCFEA",
      "texto-3": "#A3A3CC",
      tally: "#FF6A45",
      sube: "#2EE6A6",
      baja: "#FF7A8A",
      aviso: "#FFD23F",
      info: "#5CC8FF",
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
          if (ts.isJsxAttribute(node) && node.initializer) {
            const property = node.name.getText(parsed);
            // Estos tres dibujos son contenido ilustrado, no colores de interfaz.
            const artwork = [
              "componentes/avatares.tsx",
              "marca/CooperCara.tsx",
            ].includes(relative(root, path));
            if (
              /^(?:fontSize|borderRadius|color|fill|stroke)$/.test(property) &&
              !(artwork && /^(?:fill|stroke)$/.test(property))
            ) {
              if (ts.isStringLiteral(node.initializer))
                report(property, node.initializer.text, node.pos);
              else if (
                ts.isJsxExpression(node.initializer) &&
                node.initializer.expression &&
                (ts.isStringLiteralLike(node.initializer.expression) ||
                  ts.isNumericLiteral(node.initializer.expression))
              )
                report(property, node.initializer.expression.text, node.pos);
            }
          }
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
    expect(invalidDeclaration("font", "600 11px Geist")).toBeTruthy();
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
