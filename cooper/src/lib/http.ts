import { ZodError } from "zod";
import { ErrorHttp } from "./permisos";
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof ErrorHttp)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      {
        error:
          "Revisa los campos. " +
          error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
      },
      400,
    );
  return json(
    { error: "No pudimos completar la solicitud. Inténtalo de nuevo." },
    500,
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(process.env.AUTH_URL ?? request.url).origin)
    throw new ErrorHttp(403, "Origen no permitido.");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new ErrorHttp(403, "Origen no permitido.");
}
export async function body(request: Request) {
  sameOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ErrorHttp(415, "Se requiere JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new ErrorHttp(400, "Falta el contenido.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8 * 1024 * 1024) {
      await reader.cancel();
      throw new ErrorHttp(413, "El archivo supera el límite de 5 MB.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString()) as unknown;
  } catch {
    throw new ErrorHttp(400, "JSON inválido.");
  }
}
const limits = new Map<string, { at: number; count: number }>();
export function rateLimit(id: string) {
  const now = Date.now();
  for (const [key, value] of limits)
    if (now - value.at > 60000) limits.delete(key);
  const current = limits.get(id) ?? { at: now, count: 0 };
  current.count++;
  limits.set(id, current);
  if (current.count > 90)
    throw new ErrorHttp(429, "Hay muchas solicitudes. Espera un minuto.");
}
