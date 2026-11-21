import sharp, { type OverlayOptions } from "sharp";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments, type Marca, type PiezaMarca } from "@/db/schema";
import { ErrorHttp } from "@/lib/permisos";
const escapeXml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function lineas(texto: string, ancho: number, maximo: number) {
  const rows: string[] = [];
  for (const word of texto.split(/\s+/).filter(Boolean)) {
    if (word.length > ancho)
      throw new ErrorHttp(
        400,
        "Acorta las palabras largas en el texto de la pieza.",
      );
    if (!rows.length || rows.at(-1)!.length + word.length + 1 > ancho)
      rows.push(word);
    else rows[rows.length - 1] += ` ${word}`;
  }
  if (rows.length > maximo)
    throw new ErrorHttp(
      400,
      "El texto no cabe en la plantilla. Acórtalo o añade otra diapositiva.",
    );
  return rows;
}
export function plantillaSvg(p: PiezaMarca, nombre: string, index: number) {
  const vertical = p.datos.formato === "historia" || p.datos.formato === "reel",
    h = vertical ? 1920 : 1350;
  const titulo = lineas(p.datos.titulo, 23, 4),
    detalle = lineas(p.datos.diapositivas[index] ?? p.datos.detalle, 38, 6);
  const blocks = (rows: string[], x: number, y: number, dy: number) =>
    rows
      .map(
        (s, i) => `<tspan x="${x}" y="${y + i * dy}">${escapeXml(s)}</tspan>`,
      )
      .join("");
  const acento = p.guia.colores[1];
  const motivo = {
    domingo: `<path d="M300 580 V360 A240 240 0 0 1 780 360 V580" fill="none" stroke="${acento}" stroke-width="3"/>`,
    grupos: `<g fill="none" stroke="${acento}" stroke-width="3"><circle cx="440" cy="360" r="150"/><circle cx="640" cy="360" r="150"/></g>`,
    evento: `<path d="M104 350 H976 M540 170 V530 M240 200 L840 500 M240 500 L840 200" stroke="${acento}" stroke-width="3"/>`,
    coleccion: `<g fill="none" stroke="${acento}" stroke-width="3"><rect x="160" y="170" width="360" height="380"/><rect x="560" y="220" width="360" height="330"/></g>`,
    libre: `<path d="M104 500 C340 160 740 650 976 230" fill="none" stroke="${acento}" stroke-width="3"/>`,
  }[p.datos.plantilla];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${h}"><rect width="1080" height="${h}" fill="${p.guia.colores[0]}"/><g opacity=".22">${motivo}</g><rect x="64" y="${h - 700}" width="952" height="636" rx="12" fill="${p.guia.colores[0]}" fill-opacity=".96"/><path d="M104 ${h - 650} H260" stroke="${p.guia.colores[1]}" stroke-width="5"/><text font-family="${p.guia.tipografia === "serif" ? "DejaVu Serif" : "DejaVu Sans"}" font-size="64" fill="${p.guia.colores[1]}">${blocks(titulo, 104, h - 555, 80)}</text><text font-family="DejaVu Sans" font-size="34" fill="${p.guia.colores[1]}">${blocks(detalle, 104, h - 260, 45)}</text><text x="104" y="110" font-family="DejaVu Sans" font-size="30" fill="${p.guia.colores[1]}">${escapeXml(nombre)}</text><text x="930" y="${h - 105}" font-family="DejaVu Sans" font-size="26" fill="${p.guia.colores[1]}">${index + 1}</text></svg>`;
}
async function imagen(
  p: PiezaMarca,
  m: Marca,
  index: number,
  background?: Buffer,
) {
  const height = ["historia", "reel"].includes(p.datos.formato) ? 1920 : 1350;
  const overlays: OverlayOptions[] = [];
  if (background) {
    overlays.push({
      input: await sharp(background)
        .rotate()
        .resize(1080, height - 650, { fit: "cover" })
        .jpeg()
        .toBuffer(),
      top: 0,
      left: 0,
    });
  }
  // Texto siempre compuesto por SVG, jamás generado dentro del fondo por IA.
  const svg = plantillaSvg(p, m.nombre, index).replace(
    /<rect width="1080" height="\d+" fill="#[a-f\d]+"\/>/i,
    background ? "" : `$&`,
  );
  overlays.push({ input: Buffer.from(svg), top: 0, left: 0 });
  if (p.guia.logoId) {
    const logo = db()
      .select()
      .from(attachments)
      .where(eq(attachments.id, p.guia.logoId))
      .get();
    if (!logo || logo.ownerId !== m.ownerId || !logo.mime.startsWith("image/"))
      throw new ErrorHttp(409, "El logo ya no está disponible.");
    overlays.push({
      input: await sharp(Buffer.from(logo.data, "base64"))
        .resize(110, 110, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer(),
      top: 140,
      left: 104,
    });
  }
  return sharp({
    create: { width: 1080, height, channels: 3, background: p.guia.colores[0] },
  })
    .composite(overlays)
    .jpeg({ quality: 90 })
    .toBuffer();
}
async function tieneAudio(path: string) {
  return new Promise<boolean>((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "csv=p=0",
        path,
      ],
      {
        env: { PATH: process.env.PATH, NODE_ENV: "production" },
        timeout: 10000,
      },
    );
    let out = "";
    child.stdout.on("data", (d) => {
      out += String(d);
      if (out.length > 1024) child.kill();
    });
    child.once("error", () =>
      reject(new ErrorHttp(503, "El compositor necesita FFprobe.")),
    );
    child.once("close", (code) =>
      code === 0
        ? resolve(out.includes("audio"))
        : reject(
            new ErrorHttp(422, "No se pudo comprobar el audio del video."),
          ),
    );
  });
}
async function ffmpeg(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", "-nostdin", ...args],
      {
        stdio: "ignore",
        env: { PATH: process.env.PATH, NODE_ENV: "production" },
        timeout: 120000,
      },
    );
    child.once("error", () =>
      reject(
        new ErrorHttp(
          503,
          "El compositor de reels necesita FFmpeg en el servidor.",
        ),
      ),
    );
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new ErrorHttp(
              422,
              "No se pudo componer el reel. Revisa los archivos.",
            ),
          ),
    );
  });
}
export async function renderizar(p: PiezaMarca, m: Marca) {
  const fuentes = p.datos.adjuntos.map((id) => {
    const a = db()
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .get();
    if (!a || a.ownerId !== m.ownerId || !/^(image|video)\//.test(a.mime))
      throw new ErrorHttp(404, "Un adjunto no pertenece a la marca.");
    return a;
  });
  const salida: { data: Buffer; mime: string }[] = [];
  if (p.datos.formato !== "reel") {
    for (
      let i = 0;
      i < (p.datos.formato === "carrusel" ? p.datos.diapositivas.length : 1);
      i++
    )
      salida.push({
        data: await imagen(
          p,
          m,
          i,
          fuentes[i] ? Buffer.from(fuentes[i].data, "base64") : undefined,
        ),
        mime: "image/jpeg",
      });
  } else {
    const folder = await mkdtemp(join(tmpdir(), "cooper-reel-"));
    try {
      const segments: string[] = [];
      for (let i = 0; i < Math.max(1, fuentes.length); i++) {
        const f = fuentes[i],
          video = f?.mime.startsWith("video/");
        const input = join(folder, `input-${i}${video ? ".mp4" : ".jpg"}`),
          output = join(folder, `parte-${i}.mp4`);
        await writeFile(
          input,
          video
            ? Buffer.from(f.data, "base64")
            : await imagen(
                p,
                m,
                i,
                f ? Buffer.from(f.data, "base64") : undefined,
              ),
        );
        const audio = video ? await tieneAudio(input) : false;
        await ffmpeg([
          ...(video ? [] : ["-loop", "1"]),
          "-i",
          input,
          "-f",
          "lavfi",
          "-i",
          "anullsrc=r=48000:cl=stereo",
          "-map",
          "0:v:0",
          "-map",
          audio ? "0:a:0" : "1:a:0",
          "-t",
          String(
            video
              ? Math.max(3, Math.floor(60 / Math.max(1, fuentes.length)))
              : 3,
          ),
          "-vf",
          "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25",
          "-c:a",
          "aac",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-shortest",
          "-c:v",
          "libx264",
          "-threads",
          "1",
          "-pix_fmt",
          "yuv420p",
          "-y",
          output,
        ]);
        segments.push(`file '${output}'`);
      }
      await writeFile(join(folder, "lista.txt"), segments.join("\n"));
      await ffmpeg([
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        join(folder, "lista.txt"),
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        "-y",
        join(folder, "reel.mp4"),
      ]);
      salida.push({
        data: await readFile(join(folder, "reel.mp4")),
        mime: "video/mp4",
      });
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
  return salida.map((v, i) => {
    if (v.data.length > 50 * 1024 * 1024)
      throw new ErrorHttp(413, "La pieza compuesta supera 50 MB.");
    const id = randomUUID();
    db()
      .insert(attachments)
      .values({
        id,
        ownerId: m.ownerId,
        name: `${p.datos.titulo}-${i + 1}`,
        mime: v.mime,
        size: v.data.length,
        data: v.data.toString("base64"),
      })
      .run();
    return id;
  });
}
