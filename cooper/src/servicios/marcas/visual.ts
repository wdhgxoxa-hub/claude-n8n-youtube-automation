import sharp from "sharp";
import type { Historica } from "./tipos";
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
      const response = await transporte(url, {
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/")
      ) {
        await response.body?.cancel();
        continue;
      }
      const reader = response.body?.getReader();
      if (!reader) continue;
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 5 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("imagen grande");
        }
        chunks.push(value);
      }
      const image = sharp(Buffer.concat(chunks), {
        limitInputPixels: 20000000,
      });
      const metadata = await image.metadata(),
        { dominant } = await image.resize(64, 64, { fit: "inside" }).stats();
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
