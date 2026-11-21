import { createHash, randomUUID } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { videos, montajesFabrica, type User, type Video } from "@/db/schema";
import { leerObservabilidad } from "@/contratos/observabilidad";
import { ErrorHttp } from "@/lib/permisos";
import { validarArchivo } from "@/lib/archivos";
import { medioDisponible } from "@/servicios/biblioteca";
import { cuentaActiva } from "@/servicios/mensajeria/cuentas";
import { solicitar } from "@/servicios/proveedores/http";
import type { Transporte } from "@/servicios/proveedores/tipos";
import type { PiezaDatos } from "./tipos";

export const MAX_MONTAJE_BYTES = 50 * 1024 * 1024;
const hash = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
// Los pulsos SSE, métricas y el paso Programado → Publicado no cambian el medio.
// Un nuevo guion, selección, escena o enlace sí exige seleccionar otra revisión.
export function revisionMontaje(v: Video) {
  const { montaje, escenas } = leerObservabilidad(v.observability);
  return hash(
    JSON.stringify([
      v.id,
      v.ownerId,
      v.script,
      v.avatarId,
      v.voiceId,
      v.avatarPlacement,
      montaje,
      escenas,
    ]),
  );
}
function disponible(v: Video) {
  const owner = cuentaActiva(v.ownerId);
  if (
    v.stage < 10 ||
    v.productionState !== "activa" ||
    !leerObservabilidad(v.observability).montaje
  )
    throw new ErrorHttp(
      409,
      "El montaje necesita aprobación final y estar disponible en la fábrica.",
    );
  for (const [kind, id] of [
    ["avatar", v.avatarId],
    ["voz", v.voiceId],
  ] as const)
    if (id) medioDisponible(owner, id, kind);
}
export function listarMontajes(user: User) {
  return db()
    .select()
    .from(videos)
    .where(
      and(
        user.role === "admin" ? undefined : eq(videos.ownerId, user.id),
        gte(videos.stage, 10),
      ),
    )
    .all()
    .flatMap((v) => {
      try {
        disponible(v);
        return [
          {
            id: v.id,
            ownerId: v.ownerId,
            titulo: v.title,
            revision: revisionMontaje(v),
          },
        ];
      } catch {
        return [];
      }
    });
}
export function comprobarMontaje(ownerId: string, datos: PiezaDatos) {
  const v = db()
    .select()
    .from(videos)
    .where(eq(videos.id, datos.videoId))
    .get();
  if (!v || v.ownerId !== ownerId)
    throw new ErrorHttp(404, "Montaje ajeno o no disponible para esta marca.");
  disponible(v);
  if (
    !datos.montaje ||
    datos.formato !== "reel" ||
    datos.adjuntos.length ||
    datos.montaje.revision !== revisionMontaje(v)
  )
    throw new ErrorHttp(
      409,
      "El montaje cambió de revisión. Actualiza los montajes y vuelve a seleccionarlo antes de revisar.",
    );
  return v;
}
export function buscarCopia(ownerId: string, datos: PiezaDatos) {
  comprobarMontaje(ownerId, datos);
  return db()
    .select()
    .from(montajesFabrica)
    .where(
      and(
        eq(montajesFabrica.ownerId, ownerId),
        eq(montajesFabrica.videoId, datos.videoId),
        eq(montajesFabrica.revision, datos.montaje!.revision),
      ),
    )
    .get();
}
export async function prepararMontaje(
  ownerId: string,
  datos: PiezaDatos,
  transporte: Transporte = fetch,
) {
  const v = comprobarMontaje(ownerId, datos),
    existente = buscarCopia(ownerId, datos);
  if (existente) return existente;
  const url = new URL(leerObservabilidad(v.observability).montaje);
  // Reutiliza el transporte acotado de medios. Solo el CDN oficial del montaje
  // Creatomate; nunca URLs recibidas del formulario, IPs ni redirecciones.
  if (
    url.protocol !== "https:" ||
    url.hostname !== "cdn.creatomate.com" ||
    url.port ||
    url.username ||
    url.password ||
    !/^\/renders\/[\w-]+\.mp4$/.test(url.pathname)
  )
    throw new ErrorHttp(
      422,
      "El origen del montaje no está habilitado para reutilización. Walter debe revisar su almacenamiento.",
    );
  let response: Response;
  try {
    response = await solicitar(transporte, url.href);
  } catch {
    throw new ErrorHttp(
      409,
      "El enlace del montaje no está disponible o caducó. Actualiza los montajes desde la fábrica; si sigue igual, Walter debe recuperar el archivo original.",
    );
  }
  const cancel = async () => {
    await response.body?.cancel();
  };
  if (
    response.status !== 200 ||
    response.headers.get("content-type")?.split(";")[0].trim() !== "video/mp4"
  ) {
    await cancel();
    throw new ErrorHttp(415, "La fábrica no entregó un MP4 completo.");
  }
  if (Number(response.headers.get("content-length")) > MAX_MONTAJE_BYTES) {
    await cancel();
    throw new ErrorHttp(
      413,
      "El montaje supera 50 MiB. Walter debe revisar el almacenamiento.",
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ErrorHttp(422, "Montaje vacío.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_MONTAJE_BYTES)
        throw new ErrorHttp(
          413,
          "El montaje supera 50 MiB. Walter debe revisar el almacenamiento.",
        );
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof ErrorHttp) throw error;
    throw new ErrorHttp(
      502,
      "La descarga del montaje se interrumpió. Vuelve a preparar la vista previa.",
    );
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks),
    data = bytes.toString("base64");
  validarArchivo("video/mp4", data);
  comprobarMontaje(ownerId, datos);
  return {
    id: randomUUID(),
    ownerId,
    videoId: v.id,
    revision: datos.montaje!.revision,
    sha256: hash(bytes),
    size,
    data,
    createdAt: Date.now(),
  };
}
