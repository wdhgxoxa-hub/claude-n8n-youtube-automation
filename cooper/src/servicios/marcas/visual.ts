import sharp from "sharp";
import type { Historica } from "./tipos";
/** Descarga acotada de CDN conocidos; nunca sigue una redirección. */
export async function descargarImagenVisual(
  origen: string,
  transporte: typeof fetch = fetch,
  video = false,
): Promise<Buffer | null> {
  const url = new URL(origen);
  const redSocial = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname);
  const proveedor =
    video &&
    [
      "files.heygen.ai",
      "resource.heygen.ai",
      "files2.heygen.ai",
      "cdn.heygen.ai",
    ].includes(url.hostname);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    (!redSocial && !proveedor)
  )
    return null;
  const response = await transporte(url, {
    redirect: "error",
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (
    !response.ok ||
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
      response.headers.get("content-type")?.split(";")[0] ?? "",
    )
  ) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 5 * 1024 * 1024) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function analizarImagenVisual(buffer: Buffer) {
  const image = sharp(buffer, { limitInputPixels: 20000000 });
  const metadata = await image.metadata();
  // stats() lee la entrada: materializar primero el resize para limitar el análisis.
  const reduced = await image.resize(64, 64, { fit: "inside" }).toBuffer();
  const { dominant } = await sharp(reduced).stats();
  return { dominant, metadata };
}

export async function observarImagenes(
  historial: Historica[],
  transporte: typeof fetch = fetch,
) {
  let inspected = 0;
  for (const row of historial) {
    if (!row.imagen || inspected >= 6) continue;
    try {
      const url = new URL(row.imagen);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        !/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname)
      )
        continue;
      inspected++;
      const buffer = await descargarImagenVisual(row.imagen, transporte);
      if (!buffer) continue;
      const { metadata, dominant } = await analizarImagenVisual(buffer);
      row.visual = {
        color: `#${[dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`,
        proporcion:
          Math.round(((metadata.width ?? 1) / (metadata.height ?? 1)) * 100) /
          100,
      };
    } catch {
      /* Conserva el historial aunque la URL de la imagen haya expirado. */
    }
  }
  return historial;
}
