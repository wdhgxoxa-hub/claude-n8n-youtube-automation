import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { ErrorHttp } from "@/lib/permisos";

export const MAX_PREVIEW_BYTES = 600_000;
const ejecutar = promisify(execFile);
const opciones = { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 };
const argumentos = [
  "-hide_banner",
  "-loglevel",
  "error",
  "-nostdin",
  "-y",
  "-threads",
  "1",
  "-filter_threads",
  "1",
];
const entrada = [
  "-protocol_whitelist",
  "file,pipe",
  "-format_whitelist",
  "mov",
  "-enable_drefs",
  "0",
];

export function normalizarTinte(r: number, g: number, b: number) {
  const colores = [r, g, b].map((n) => Math.max(0, Math.min(255, n)) / 255);
  const max = Math.max(...colores),
    min = Math.min(...colores),
    delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (delta) {
    if (max === colores[0]) h = ((colores[1] - colores[2]) / delta) % 6;
    else if (max === colores[1]) h = (colores[2] - colores[0]) / delta + 2;
    else h = (colores[0] - colores[1]) / delta + 4;
  }
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
  return `hsl(${Math.round((h * 60 + 360) % 360)} ${Math.round(Math.min(0.45, s) * 100)}% ${Math.round(Math.max(0.45, Math.min(0.6, l)) * 100)}%)`;
}

export async function procesarPoster(bytes: Buffer) {
  // Decodificar antes de servir elimina metadatos, SVG externos y cargas activas.
  const source = sharp(bytes, {
    limitInputPixels: 40_000_000,
    animated: false,
  });
  const metadata = await source.metadata();
  if (
    !metadata.format ||
    !["jpeg", "png", "webp", "avif"].includes(metadata.format)
  )
    throw new ErrorHttp(415, "La miniatura no es una imagen compatible.");
  const { data, info } = await source
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const { dominant } = await sharp(data).stats();
  return {
    data,
    ancho: info.width,
    alto: info.height,
    tinte: normalizarTinte(dominant.r, dominant.g, dominant.b),
  };
}

export async function derivarMp4(bytes: Buffer) {
  if (bytes.length < 12 || bytes.subarray(4, 8).toString() !== "ftyp")
    throw new ErrorHttp(415, "El montaje no es un MP4 compatible.");
  const directory = await mkdtemp(join(tmpdir(), "cooper-video-medios-"));
  const input = join(directory, "original.mp4"),
    poster = join(directory, "poster.png"),
    output = join(directory, "preview.mp4");
  try {
    await writeFile(input, bytes, { mode: 0o600 });
    const probe = await ejecutar(
      "ffprobe",
      [
        "-v",
        "error",
        ...entrada,
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,sample_aspect_ratio:stream_side_data=rotation:format=duration",
        "-of",
        "json",
        input,
      ],
      opciones,
    );
    const parsed = JSON.parse(probe.stdout) as {
      streams: {
        width: number;
        height: number;
        sample_aspect_ratio?: string;
        side_data_list?: { rotation?: number }[];
      }[];
      format: { duration: string };
    };
    const stream = parsed.streams[0];
    const duration = Number(parsed.format?.duration);
    if (
      !stream ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 4 * 3600 ||
      !Number.isInteger(stream.width) ||
      !Number.isInteger(stream.height) ||
      stream.width < 2 ||
      stream.height < 2 ||
      stream.width * stream.height > 40_000_000
    )
      throw new ErrorHttp(415, "El montaje no contiene un video válido.");
    const [sarN, sarD] = (stream.sample_aspect_ratio ?? "1:1")
      .split(":")
      .map(Number);
    const sar = sarN > 0 && sarD > 0 && sarN / sarD < 10 ? sarN / sarD : 1;
    let ancho = Math.round(stream.width * sar),
      alto = stream.height;
    if (
      stream.side_data_list?.some(
        (item) => Math.abs(item.rotation ?? 0) % 180 === 90,
      )
    )
      [ancho, alto] = [alto, ancho];
    const inicio = Math.min(1, duration / 10).toFixed(3);
    await ejecutar(
      "ffmpeg",
      [
        ...argumentos,
        ...entrada,
        "-ss",
        inicio,
        "-i",
        input,
        "-map",
        "0:v:0",
        "-frames:v",
        "1",
        "-vf",
        "scale=w=1600:h=1600:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
        "-an",
        "-sn",
        "-dn",
        poster,
      ],
      opciones,
    );
    const image = await procesarPoster(await readFile(poster));
    let preview: Buffer | undefined;
    for (const bitrate of [600, 350, 180]) {
      await ejecutar(
        "ffmpeg",
        [
          ...argumentos,
          ...entrada,
          "-stream_loop",
          "-1",
          "-ss",
          inicio,
          "-i",
          input,
          "-map",
          "0:v:0",
          "-t",
          "5",
          "-an",
          "-sn",
          "-dn",
          "-map_metadata",
          "-1",
          "-map_chapters",
          "-1",
          "-vf",
          "fps=12,scale=w=640:h=640:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
          "-c:v",
          "libx264",
          "-threads",
          "1",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          "-b:v",
          `${bitrate}k`,
          "-maxrate",
          `${bitrate}k`,
          "-bufsize",
          `${bitrate}k`,
          "-movflags",
          "+faststart",
          output,
        ],
        opciones,
      );
      const candidate = await readFile(output);
      if (candidate.length <= MAX_PREVIEW_BYTES) {
        preview = candidate;
        break;
      }
    }
    if (!preview)
      throw new ErrorHttp(422, "No se pudo ajustar la vista previa.");
    return { poster: image, preview, duracion: 5, ancho, alto };
  } catch (error) {
    if (error instanceof ErrorHttp) throw error;
    // No devolver stderr, URLs firmadas ni rutas internas de FFmpeg.
    throw new ErrorHttp(422, "No se pudo preparar el montaje.");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
