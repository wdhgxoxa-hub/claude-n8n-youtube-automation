import { z } from "zod";
import { ErrorHttp } from "@/lib/permisos";
import type { ArchivoMedio, Transporte } from "./tipos";
export function clave(nombre: string) {
  const value = process.env[nombre];
  if (!value)
    throw new ErrorHttp(
      503,
      "El servicio de medios no está configurado. Contacta con Walter.",
    );
  return value;
}
export async function solicitar(
  transporte: Transporte,
  url: string,
  init: RequestInit = {},
) {
  try {
    const response = await transporte(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new ErrorHttp(
        response.status === 429 ? 429 : 502,
        response.status === 429
          ? "El servicio está ocupado. Inténtalo más tarde."
          : "El servicio de medios no pudo completar la solicitud.",
      );
    return response;
  } catch (error) {
    if (error instanceof ErrorHttp) throw error;
    throw new ErrorHttp(502, "No pudimos conectar con el servicio de medios.");
  }
}
export async function respuesta<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    return schema.parse(await response.json());
  } catch {
    throw new ErrorHttp(
      502,
      "El servicio devolvió una respuesta de medios inválida.",
    );
  }
}
// Solo CDN documentados. Nunca se acepta una URL del cliente ni se siguen redirecciones.
export async function descargar(
  url: string,
  transporte: Transporte = fetch,
): Promise<ArchivoMedio> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ErrorHttp(502, "Vista previa no disponible.");
  }
  const allowed = [
    "files.heygen.ai",
    "resource.heygen.ai",
    "files2.heygen.ai",
    "cdn.heygen.ai",
  ];
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !allowed.includes(parsed.hostname)
  )
    throw new ErrorHttp(
      502,
      "El origen de la vista previa no está habilitado.",
    );
  const r = await solicitar(transporte, url);
  const mime = r.headers.get("content-type")?.split(";")[0] ?? "";
  if (
    ![
      "audio/wav",
      "audio/x-wav",
      "audio/mpeg",
      "video/mp4",
      "video/webm",
    ].includes(mime)
  )
    throw new ErrorHttp(502, "Formato de vista previa no admitido.");
  const reader = r.body?.getReader();
  if (!reader) throw new ErrorHttp(502, "Vista previa vacía.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 20 * 1024 * 1024) {
      await reader.cancel();
      throw new ErrorHttp(502, "Vista previa demasiado grande.");
    }
    chunks.push(value);
  }
  return { mime, data: Buffer.concat(chunks).toString("base64") };
}
