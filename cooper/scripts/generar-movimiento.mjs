// Dibujos originales de Cooper. Geometría estática: solo animamos transform/opacidad.
// Genera Lottie y un SVG de reposo idéntico, visible antes de descargar el reproductor.
import { mkdirSync, writeFileSync } from "node:fs";
const dir = "public/movimiento";
mkdirSync(dir, { recursive: true });
const color = (h) => h.match(/\w\w/g).map((v) => parseInt(v, 16) / 255);
const fixed = (k) => ({ a: 0, k });
const keys = (values) => ({
  a: 1,
  k: values.map(([t, s], i) => ({
    t,
    s: Array.isArray(s) ? s : [s],
    ...(i < values.length - 1
      ? {
          e: Array.isArray(values[i + 1][1])
            ? values[i + 1][1]
            : [values[i + 1][1]],
          o: { x: 0.22, y: 1 },
          i: { x: 0.36, y: 1 },
        }
      : {}),
  })),
});
const ellipse = (x, y, w, h, fill) => ({ kind: "el", x, y, w, h, fill });
const rect = (x, y, w, h, r, fill) => ({ kind: "rc", x, y, w, h, r, fill });
const path = (v, fill, ins = v.map(() => [0, 0]), outs = ins) => ({
  kind: "sh",
  v,
  ins,
  outs,
  fill,
});
function shapes(items) {
  return items.map((item) => ({
    ty: "gr",
    it: [
      item.kind === "sh"
        ? {
            ty: "sh",
            ks: fixed({ i: item.ins, o: item.outs, v: item.v, c: true }),
          }
        : {
            ty: item.kind,
            p: fixed([item.x, item.y]),
            s: fixed([item.w, item.h]),
            ...(item.kind === "rc" ? { r: fixed(item.r) } : {}),
          },
      { ty: "fl", c: fixed(color(item.fill)), o: fixed(100), r: 1 },
      {
        ty: "tr",
        p: fixed([0, 0]),
        a: fixed([0, 0]),
        s: fixed([100, 100]),
        r: fixed(0),
        o: fixed(100),
      },
    ],
  }));
}
function svg(items) {
  return items
    .map((i) =>
      i.kind === "el"
        ? `<ellipse cx="${i.x}" cy="${i.y}" rx="${i.w / 2}" ry="${i.h / 2}" fill="#${i.fill}"/>`
        : i.kind === "rc"
          ? `<rect x="${i.x - i.w / 2}" y="${i.y - i.h / 2}" width="${i.w}" height="${i.h}" rx="${i.r}" fill="#${i.fill}"/>`
          : `<path d="M${i.v[0]} ${i.v
              .map((p, j) => {
                const k = (j + 1) % i.v.length;
                return `C${p[0] + i.outs[j][0]},${p[1] + i.outs[j][1]} ${i.v[k][0] + i.ins[k][0]},${i.v[k][1] + i.ins[k][1]} ${i.v[k]}`;
              })
              .join(" ")}Z" fill="#${i.fill}"/>`,
    )
    .join("");
}
function save(name, w, h, layers) {
  const data = {
    v: "5.13.0",
    fr: 60,
    ip: 0,
    op: 240,
    w,
    h,
    nm: `Cooper · ${name}`,
    ddd: 0,
    assets: [],
    layers: [...layers].reverse().map((l, i) => ({
      ddd: 0,
      ind: i + 1,
      ty: 4,
      nm: l.name,
      sr: 1,
      ks: {
        o: fixed(100),
        r: fixed(0),
        p: fixed([0, 0, 0]),
        a: fixed([0, 0, 0]),
        s: fixed([100, 100, 100]),
        ...l.ks,
      },
      ao: 0,
      shapes: shapes([...l.items].reverse()),
      ip: 0,
      op: 240,
      st: 0,
      bm: 0,
    })),
  };
  writeFileSync(`${dir}/${name}.json`, JSON.stringify(data));
  writeFileSync(
    `${dir}/${name}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${layers.map((l) => svg(l.items)).join("")}</svg>`,
  );
}
for (const mood of ["recibe", "reacciona", "celebra"]) {
  const joy = mood === "celebra",
    listen = mood === "reacciona";
  const sway = keys([
    [0, 0],
    [40, listen ? -5 : joy ? -4 : 2],
    [100, joy ? 4 : 0],
    [180, 0],
    [240, 0],
  ]);
  const body = [
    ellipse(160, 259, 174, 13, "20272c"),
    path(
      [
        [96, 252],
        [106, 208],
        [134, 189],
        [186, 189],
        [214, 208],
        [224, 252],
      ],
      "171c21",
    ),
    ellipse(160, 228, 60, 42, "9a6846"),
    rect(109, 247, 37, 27, 12, "b17f5c"),
    rect(211, 247, 37, 27, 12, "b17f5c"),
  ];
  const face = [
    path(
      [
        [76, 118],
        [60, 36],
        [116, 69],
      ],
      "151a1f",
    ),
    path(
      [
        [244, 118],
        [260, 36],
        [204, 69],
      ],
      "151a1f",
    ),
    path(
      [
        [79, 86],
        [73, 56],
        [101, 77],
      ],
      "996644",
    ),
    path(
      [
        [241, 86],
        [247, 56],
        [219, 77],
      ],
      "996644",
    ),
    ellipse(160, 147, 190, 174, "252c33"),
    ellipse(160, 137, 172, 154, "1b2026"),
    path(
      [
        [75, 154],
        [83, 191],
        [111, 215],
        [130, 165],
      ],
      "9a6846",
    ),
    path(
      [
        [245, 154],
        [237, 191],
        [209, 215],
        [190, 165],
      ],
      "9a6846",
    ),
    ellipse(114, 118, 39, 14, "b17f5c"),
    ellipse(206, 118, 39, 14, "b17f5c"),
    ellipse(160, 185, 112, 65, "b17f5c"),
    ellipse(143, 179, 57, 39, "c18c63"),
    ellipse(177, 179, 57, 39, "c18c63"),
    path(
      [
        [138, 172],
        [146, 165],
        [174, 165],
        [182, 172],
        [173, 185],
        [147, 185],
      ],
      "11161b",
    ),
    rect(159, 168, 27, 3, 2, "4a5055"),
    rect(160, 193, 3, 18, 1, "32271f"),
    ellipse(160, 205, joy ? 36 : 28, joy ? 17 : 7, "14191e"),
  ];
  const eyes = [
    ellipse(113, 141, 36, 25, "e0ded1"),
    ellipse(207, 141, 36, 25, "e0ded1"),
    ellipse(113, 141, 24, 25, "83c8e4"),
    ellipse(207, 141, 24, 25, "82966b"),
    path(
      [
        [207, 129],
        [218, 133],
        [219, 145],
        [207, 153],
      ],
      "8d603d",
    ),
    ellipse(113, 141, 11, 15, "101519"),
    ellipse(207, 141, 11, 15, "101519"),
    ellipse(109, 136, 6, 6, "ffffff"),
    ellipse(203, 136, 6, 6, "ffffff"),
  ];
  const layers = [
    { name: "Silueta y patas", items: body },
    {
      name: "Cabeza",
      items: face,
      ks: {
        a: fixed([160, 205, 0]),
        p: keys([
          [0, [160, 205, 0]],
          [42, [160, joy ? 193 : 205, 0]],
          [96, [160, 205, 0]],
          [240, [160, 205, 0]],
        ]),
        r: sway,
      },
    },
    {
      name: "Mirada de dos colores",
      items: eyes,
      ks: {
        a: fixed([160, 141, 0]),
        p: fixed([160, 141, 0]),
        s: keys([
          [0, [100, 100, 100]],
          [140, [100, 100, 100]],
          [146, [100, 10, 100]],
          [152, [100, 100, 100]],
          [240, [100, 100, 100]],
        ]),
      },
    },
  ];
  // Los ojos acompañan el gesto sin deformar los trazados.
  layers[2].ks.p = keys([
    [0, [160, 141, 0]],
    [42, [listen ? 157 : 160, joy ? 129 : 141, 0]],
    [96, [160, 141, 0]],
    [240, [160, 141, 0]],
  ]);
  if (joy)
    for (let i = 0; i < 6; i++)
      layers.push({
        name: `Brasa ${i + 1}`,
        items: [rect(0, 0, 5, 13, 2, i % 2 ? "c79b75" : "a6d7ed")],
        ks: {
          p: keys([
            [0, [160, 130, 0]],
            [30, [55 + i * 42, 48 + (i % 2) * 25, 0]],
            [100, [45 + i * 46, 100 + (i % 2) * 28, 0]],
            [240, [45 + i * 46, 100, 0]],
          ]),
          r: keys([
            [0, 0],
            [100, 30 + i * 20],
            [240, 30 + i * 20],
          ]),
          o: keys([
            [0, 0],
            [10, 100],
            [60, 100],
            [100, 0],
            [240, 0],
          ]),
        },
      });
  save(`cooper-${mood}`, 320, 280, layers);
}
const stations = [];
for (let i = 0; i < 4; i++) {
  const x = 80 + i * 145;
  stations.push({
    name: `Mesa ${i}`,
    items: [
      rect(x, 120, 108, 102, 12, "20282e"),
      rect(x, 117, 94, 86, 8, "141b20"),
      rect(x, 157, 58, 3, 1, "48545d"),
      ...Array.from({ length: 3 }, (_, j) =>
        rect(x - 26 + j * 26, 173, 12, 3, 1, "48545d"),
      ),
    ],
  });
  stations.push({
    name: `Fotograma ${i}`,
    items:
      i === 0
        ? [
            ellipse(x, 109, 38, 38, "a6d7ed"),
            ellipse(x, 109, 30, 30, "20282e"),
            ellipse(x, 109, 8, 8, "a6d7ed"),
            rect(x, 136, 20, 3, 1, "a6d7ed"),
          ]
        : i === 1
          ? [
              rect(x, 111, 43, 57, 4, "364853"),
              ...Array.from({ length: 4 }, (_, j) =>
                rect(x - 2, 95 + j * 10, j === 3 ? 18 : 28, 3, 1, "a6d7ed"),
              ),
            ]
          : i === 3
            ? Array.from({ length: 7 }, (_, j) =>
                rect(
                  x - 27 + j * 9,
                  110,
                  4,
                  12 + (3 - Math.abs(3 - j)) * 11,
                  2,
                  "a6d7ed",
                ),
              )
            : [
                rect(x, 110, 64, 45, 5, "364853"),
                rect(x, 109, 54, 33, 3, "a6d7ed"),
                path(
                  [
                    [x - 17, 119],
                    [x - 3, 103],
                    [x + 7, 114],
                    [x + 17, 98],
                    [x + 27, 124],
                    [x - 27, 124],
                  ],
                  "30444f",
                ),
              ],
    ks: {
      p: keys([
        [0, [0, 0, 0]],
        [30 + i * 12, [0, -7, 0]],
        [70 + i * 12, [0, 0, 0]],
        [240, [0, 0, 0]],
      ]),
    },
  });
}
stations.unshift({
  name: "Carril",
  items: [rect(298, 196, 548, 2, 0, "39474e")],
});
stations.push({
  name: "Luz en tránsito",
  items: [rect(0, 196, 36, 3, 1, "a6d7ed")],
  ks: {
    p: keys([
      [0, [24, 0, 0]],
      [210, [572, 0, 0]],
      [240, [572, 0, 0]],
    ]),
    o: keys([
      [0, 0],
      [15, 100],
      [195, 100],
      [215, 0],
      [240, 0],
    ]),
  },
});
save("fabrica", 600, 230, stations);
