import { mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const salida = resolve("../evidencias-diseno");
const contactos = resolve(salida, "contactos");
mkdirSync(contactos, { recursive: true });
const anchoCelda = 320;
const altoCelda = 500;
for (const ancho of [360, 390, 768, 1024, 1440, 1920]) {
  const capturas = readdirSync(salida)
    .filter((nombre) => nombre.endsWith(`-${ancho}.png`))
    .sort();
  for (let inicio = 0; inicio < capturas.length; inicio += 12) {
    const grupo = capturas.slice(inicio, inicio + 12);
    const capas = [];
    for (const [indice, archivo] of grupo.entries()) {
      const izquierda = (indice % 3) * anchoCelda;
      const arriba = Math.floor(indice / 3) * altoCelda;
      const imagen = await sharp(resolve(salida, archivo))
        .resize(anchoCelda - 16, altoCelda - 40, {
          fit: "contain",
          background: "#000000",
        })
        .png()
        .toBuffer();
      capas.push({ input: imagen, left: izquierda + 8, top: arriba + 32 });
      const etiqueta = `<svg width="320" height="28"><rect width="320" height="28" fill="#18181c"/><text x="8" y="19" font-family="sans-serif" font-size="12" fill="#f5f5f7">${archivo}</text></svg>`;
      capas.push({
        input: Buffer.from(etiqueta),
        left: izquierda,
        top: arriba,
      });
    }
    const destino = resolve(contactos, `${ancho}-${inicio / 12 + 1}.png`);
    await sharp({
      create: {
        width: anchoCelda * 3,
        height: altoCelda * Math.ceil(grupo.length / 3),
        channels: 3,
        background: "#000000",
      },
    })
      .composite(capas)
      .png()
      .toFile(destino);
    console.log(destino);
  }
}
