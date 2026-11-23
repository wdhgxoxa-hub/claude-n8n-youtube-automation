import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { TEMAS, TEMAS_INFO, TEMA_INICIAL, temaValido } from "@/lib/temas";

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

const SECCIONES = [
  "inicio",
  "fabrica",
  "publicados",
  "aprendizaje",
  "marcas",
  "mas",
];
const PALETAS: Record<string, Record<string, string>> = {
  feria: {
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
  },
  sala: {
    lienzo: "#000000",
    "sup-1": "#0A0A0C",
    "sup-2": "#111114",
    "sup-3": "#18181C",
    texto: "#F5F5F7",
    "texto-2": "#A1A1AA",
    "texto-3": "#8B8B94",
    tally: "#FF4D2E",
    sube: "#3DDC97",
    baja: "#FF6B6B",
    aviso: "#FFC53D",
    info: "#7CC4FF",
  },
  dia: {
    lienzo: "#F5F5F7",
    "sup-1": "#FFFFFF",
    "sup-2": "#F0F0F4",
    "sup-3": "#E6E6EC",
    texto: "#1D1D1F",
    "texto-2": "#424245",
    "texto-3": "#5F5F66",
    tally: "#0060C8",
    sube: "#007548",
    baja: "#C0271F",
    aviso: "#8A5300",
    info: "#0060C8",
  },
};
/** Tokens efectivos de un tema: los de «feria» (base) más los que el tema cambia. */
function tokensDe(css: string, tema: string) {
  const leer = (selector: RegExp) => {
    const cuerpo = css.match(selector)?.[1] ?? "";
    return Object.fromEntries(
      [...cuerpo.matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]+);/g)].map(
        (m) => [m[1].replace(/^--/, ""), m[2].trim()],
      ),
    );
  };
  const base = leer(/:root,\s*\[data-tema="feria"\]\s*\{([^}]+)\}/);
  return tema === "feria"
    ? base
    : {
        ...base,
        ...leer(new RegExp(`\\n\\[data-tema="${tema}"\\]\\s*\\{([^}]+)\\}`)),
      };
}
/** Sigue un var(--otro) hasta el color literal. */
function resolver(tokens: Record<string, string>, nombre: string): string {
  const valor = tokens[nombre];
  const referencia = valor?.match(/^var\(--([\w-]+)\)$/)?.[1];
  return referencia ? resolver(tokens, referencia) : valor;
}
function luminancia(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a: string, b: string) {
  expect(a, "color literal").toMatch(/^#[\da-f]{6}$/i);
  expect(b, "color literal").toMatch(/^#[\da-f]{6}$/i);
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

describe("guardián de Sala de proyección", () => {
  it("conserva las tres paletas y una única fuente de tokens", () => {
    const css = clean(readFileSync(source, "utf8"));
    for (const [tema, paleta] of Object.entries(PALETAS))
      for (const [token, value] of Object.entries(paleta))
        expect(
          tokensDe(css, tema)[token]?.toUpperCase(),
          `${tema} --${token}`,
        ).toBe(value);
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
    // Solo «Día» es claro, y solo él (y su vuelta a oscuro en los medios) lo declara.
    expect(css.match(/color-scheme:\s*light/g)).toHaveLength(1);
    expect(tokensDe(css, "dia")["color-scheme"]).toBe("light");
  });

  it("cada tema cumple contraste AA en texto y en sus acentos", () => {
    const css = clean(readFileSync(source, "utf8"));
    for (const tema of ["feria", "sala", "dia"]) {
      const t = tokensDe(css, tema);
      const fondos = ["lienzo", "sup-1", "sup-2", "sup-3"].map((k) => t[k]);
      // Texto corriente y de apoyo: AA (4,5:1) sobre toda superficie.
      for (const texto of ["texto", "texto-2", "texto-3"])
        for (const fondo of fondos)
          expect(
            contraste(t[texto], fondo),
            `${tema}: --${texto} sobre ${fondo}`,
          ).toBeGreaterThanOrEqual(4.5);
      // Acentos y estados usados como texto o icono: AA sobre toda superficie.
      for (const color of [
        "tally",
        "sube",
        "baja",
        "aviso",
        "info",
        ...SECCIONES.map((s) => `color-${s}`),
      ])
        for (const fondo of fondos)
          expect(
            contraste(resolver(t, color), fondo),
            `${tema}: --${color} sobre ${fondo}`,
          ).toBeGreaterThanOrEqual(4.5);
      // Tinta sobre rellenos de color (botón principal, iconos de atajo).
      expect(
        contraste(resolver(t, "sobre-tally"), t.tally),
        `${tema}: tinta sobre --tally`,
      ).toBeGreaterThanOrEqual(4.5);
      for (const s of SECCIONES)
        expect(
          contraste(t["sobre-acento"], resolver(t, `color-${s}`)),
          `${tema}: tinta sobre --color-${s}`,
        ).toBeGreaterThanOrEqual(4.5);
      // Cine: el texto sobre medios se lee en cualquier tema.
      for (const texto of ["cine-texto", "cine-texto-2"])
        for (const fondo of ["cine-lienzo", "cine-sup"])
          expect(
            contraste(t[texto], t[fondo]),
            `${tema}: --${texto} sobre --${fondo}`,
          ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("los temas del código, de la base y del CSS son los mismos", () => {
    const css = clean(readFileSync(source, "utf8"));
    const enCss = [...css.matchAll(/\[data-tema="(\w+)"\]\s*\{/g)].map(
      (m) => m[1],
    );
    expect(new Set(enCss)).toEqual(new Set(TEMAS));
    expect(Object.keys(TEMAS_INFO).sort()).toEqual([...TEMAS].sort());
    expect(TEMAS).toContain(TEMA_INICIAL);
    expect(temaValido("oscuro")).toBe(TEMA_INICIAL);
    expect(temaValido(undefined)).toBe(TEMA_INICIAL);
    expect(temaValido("dia")).toBe("dia");
    for (const tema of TEMAS)
      expect(tokensDe(css, tema)["color-scheme"] ?? "dark").toBe(
        TEMAS_INFO[tema].esquema === "claro" ? "light" : "dark",
      );
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
        // Los temas solo se declaran en tokens.css: ninguna hoja se bifurca por tema.
        expect(content, path).not.toMatch(/data-theme|data-tema="/);
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
