import { createHash } from "node:crypto";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  channels,
  montajesFabrica,
  videoMedios,
  videos,
  type User,
  type Video,
} from "@/db/schema";
import { leerObservabilidad } from "@/contratos/observabilidad";
import type { OrigenPoster, VideoMedios } from "@/contratos/video-medios";
import { ErrorHttp, requireOwner } from "@/lib/permisos";
import { enlaceIncrustado } from "@/lib/enlaces-medios";
import { solicitar } from "@/servicios/proveedores/http";
import type { Transporte } from "@/servicios/proveedores/tipos";
import {
  MAX_MONTAJE_BYTES,
  revisionMontaje,
} from "@/servicios/marcas/montajes";
import { derivarMp4, procesarPoster } from "./video-medios-ffmpeg";

const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const DIA = 24 * 60 * 60 * 1000;
const campos = getTableColumns(videoMedios);
// Las proyecciones de listas nunca leen los blobs base64.
const metadatos = Object.fromEntries(
  Object.entries(campos).filter(
    ([key]) => !["posterData", "previewData"].includes(key),
  ),
) as Omit<typeof campos, "posterData" | "previewData">;
type Fila = Omit<
  typeof videoMedios.$inferSelect,
  "posterData" | "previewData"
> & { tienePoster: boolean };
const cache = (clave: string): Fila | undefined =>
  db()
    .select({
      ...metadatos,
      tienePoster:
        sql<boolean>`${videoMedios.estado} IN ('listo', 'sin_medio')`.mapWith(
          Boolean,
        ),
    })
    .from(videoMedios)
    .where(eq(videoMedios.clave, clave))
    .get();

function contexto(
  user: User,
  id: string | Video,
  publicacionId = "",
  canales?: Map<string, string>,
) {
  if (publicacionId.length > 300)
    throw new ErrorHttp(400, "Publicación inválida.");
  const video =
    typeof id === "string"
      ? db().select().from(videos).where(eq(videos.id, id)).get()
      : id;
  requireOwner(user, video);
  if (!video) throw new ErrorHttp(404, "No encontramos ese video.");
  const observabilidad = leerObservabilidad(video.observability);
  const publicacion = publicacionId
    ? observabilidad.publicaciones.find((p) => p.id === publicacionId)
    : !observabilidad.montaje && !observabilidad.miniatura
      ? [...observabilidad.publicaciones]
          .sort(
            (a, b) =>
              (Date.parse(b.fecha ?? "") || 0) -
              (Date.parse(a.fecha ?? "") || 0),
          )
          .find((p) => p.url || p.miniatura)
      : undefined;
  if (publicacionId && !publicacion)
    throw new ErrorHttp(404, "No encontramos esa publicación.");
  const dimensiones =
    publicacion?.ancho && publicacion.alto
      ? { ancho: publicacion.ancho, alto: publicacion.alto }
      : undefined;
  const escena =
    !publicacion && !observabilidad.montaje && !observabilidad.miniatura
      ? observabilidad.escenas.find((e) => e.imagen || e.clip)
      : undefined;
  const montaje = publicacion
    ? (publicacion.montaje ?? "")
    : observabilidad.montaje || escena?.clip || "";
  const miniatura = publicacion
    ? publicacion.miniatura
    : observabilidad.miniatura || escena?.imagen || "";
  const red = publicacion?.red.toLowerCase() ?? "";
  const canal =
    canales?.get(video.channelId) ??
    db()
      .select({ name: channels.name })
      .from(channels)
      .where(eq(channels.id, video.channelId))
      .get()?.name ??
    "";
  const clave = hash(JSON.stringify([video.id, publicacionId]));
  const revision = hash(
    JSON.stringify([
      1,
      ...(!montaje && !miniatura && !publicacion?.url
        ? ["tipografico-v2"]
        : []),
      video.ownerId,
      video.title,
      video.channelId,
      canal,
      revisionMontaje(video),
      publicacionId,
      publicacion?.id,
      montaje,
      miniatura,
      publicacion?.url,
      publicacion?.ancho,
      publicacion?.alto,
      red,
    ]),
  );
  const sinMedio =
    !montaje &&
    !miniatura &&
    !publicacion?.url &&
    !observabilidad.escenas.some((e) => e.imagen || e.clip);
  const tinte = `hsl(${parseInt(hash(video.channelId).slice(0, 6), 16) % 360} 30% 52%)`;
  return {
    video,
    publicacionId,
    publicacion,
    dimensiones,
    escena: !!escena,
    montaje,
    miniatura,
    red,
    canal,
    clave,
    revision,
    sinMedio,
    tinte,
  };
}
type Contexto = ReturnType<typeof contexto>;

function urlMedio(c: Contexto, tipo: "poster" | "preview", revision: string) {
  const query = new URLSearchParams({ v: revision.slice(0, 16) });
  if (c.publicacionId) query.set("publicacion", c.publicacionId);
  return `/api/videos/${encodeURIComponent(c.video.id)}/medios/${tipo}?${query}`;
}
function exponer(c: Contexto, row?: Fila): VideoMedios {
  const vigente = row?.revision === c.revision ? row : undefined;
  const ancho = vigente?.ancho ?? c.dimensiones?.ancho ?? 1600,
    alto = vigente?.alto ?? c.dimensiones?.alto ?? 900;
  return {
    version: 1,
    videoId: c.video.id,
    estado: vigente?.estado ?? (c.sinMedio ? "sin_medio" : "pendiente"),
    poster: vigente?.tienePoster
      ? {
          url: urlMedio(c, "poster", vigente.revision),
          origen: vigente.posterOrigen,
          ancho: vigente.posterAncho,
          alto: vigente.posterAlto,
        }
      : c.sinMedio
        ? {
            url: urlMedio(c, "poster", c.revision),
            origen: "tipografico",
            ancho: 1600,
            alto: 900,
          }
        : null,
    preview: vigente?.previewBytes
      ? {
          url: urlMedio(c, "preview", vigente.revision),
          mime: "video/mp4",
          duracion: vigente.previewDuracion,
          bytes: vigente.previewBytes,
        }
      : null,
    tinte: vigente?.tinte ?? c.tinte,
    ancho,
    alto,
    relacionAspecto: ancho / alto,
    origenDimensiones:
      vigente?.origenDimensiones ?? (c.dimensiones ? "video" : "reserva"),
    actualizadoEn: vigente?.actualizadoEn ?? 0,
  };
}
function escapar(value: string) {
  return value.replace(
    /[&<>"']/g,
    (letter) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[letter]!,
  );
}
function tipografico(c: Contexto) {
  const words = c.video.title.slice(0, 240).split(/\s+/);
  const lines: string[] = [""];
  for (const word of words) {
    if (lines.at(-1)!.length + word.length > 28 && lines.at(-1)) lines.push("");
    lines[lines.length - 1] += `${lines.at(-1) ? " " : ""}${word}`;
  }
  const title = lines
    .slice(0, 4)
    .map(
      (line, i) =>
        `<tspan x="96" y="${300 + i * 96}">${escapar(line.length > 30 ? line.slice(0, 29) + "…" : line)}</tspan>`,
    )
    .join("");
  // SVG escrito por el servidor, sin HTML, enlaces, scripts ni texto sin escapar.
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#0A0A0C"/><rect x="96" y="120" width="96" height="8" fill="${c.tinte}"/><text fill="#F5F5F7" font-family="sans-serif" font-size="72" font-weight="600">${title}</text></svg>`,
  );
}
function guardarTipografico(c: Contexto) {
  const values = {
    clave: c.clave,
    videoId: c.video.id,
    publicacionId: c.publicacionId,
    revision: c.revision,
    estado: "sin_medio" as const,
    posterData: tipografico(c).toString("base64"),
    posterMime: "image/svg+xml",
    posterOrigen: "tipografico" as const,
    tinte: c.tinte,
    actualizadoEn: Date.now(),
    previewData: "",
    previewBytes: 0,
    previewDuracion: 0,
    ancho: 1600,
    alto: 900,
    posterAncho: 1600,
    posterAlto: 900,
    reintentarEn: 0,
    reservaHasta: 0,
    intentos: 0,
  };
  db()
    .insert(videoMedios)
    .values(values)
    .onConflictDoUpdate({ target: videoMedios.clave, set: values })
    .run();
}

export function leerVideoMedios(
  user: User,
  id: string | Video,
  publicacionId = "",
): VideoMedios {
  const c = contexto(user, id, publicacionId);
  return exponer(c, cache(c.clave));
}

// Una lectura de metadatos y otra de canales para la lista/SSE completa. No
// genera SVG ni lee blobs; 10.000 videos no provocan 20.000 consultas/escrituras.
export function crearLectorVideoMedios(user: User) {
  const canales = new Map(
    db()
      .select({ id: channels.id, name: channels.name })
      .from(channels)
      .where(user.role === "admin" ? undefined : eq(channels.ownerId, user.id))
      .all()
      .map((c) => [c.id, c.name]),
  );
  const filas = new Map(
    db()
      .select({
        ...metadatos,
        tienePoster:
          sql<boolean>`${videoMedios.estado} IN ('listo', 'sin_medio')`.mapWith(
            Boolean,
          ),
      })
      .from(videoMedios)
      .innerJoin(videos, eq(videoMedios.videoId, videos.id))
      .where(user.role === "admin" ? undefined : eq(videos.ownerId, user.id))
      .all()
      .map((fila) => [fila.clave, fila]),
  );
  return (video: Video, publicacionId = "") => {
    const c = contexto(user, video, publicacionId, canales);
    return exponer(c, filas.get(c.clave));
  };
}

export function origenPermitido(raw: string, tipo: "mp4" | "imagen", red = "") {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ErrorHttp(422, "El medio no está disponible.");
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash)
    throw new ErrorHttp(422, "El origen del medio no está habilitado.");
  const creatomate =
    u.hostname === "cdn.creatomate.com" &&
    /^\/renders\/[\w./-]+$/.test(u.pathname);
  // Almacenamiento público observado de los MP4 históricos de Creatomate.
  // No abre otros buckets ni requiere credenciales de B2.
  const backblaze =
    u.hostname === "f002.backblazeb2.com" &&
    /^\/file\/creatomate-c8xg3hsxdu\/[\w-]+\.mp4$/.test(u.pathname) &&
    !u.search;
  const youtube =
    [
      "i.ytimg.com",
      "i1.ytimg.com",
      "i2.ytimg.com",
      "i3.ytimg.com",
      "i4.ytimg.com",
    ].includes(u.hostname) &&
    /^\/vi(?:_webp)?\/[\w-]{11}\/[\w.-]+$/.test(u.pathname);
  const tiktok =
    /^(?:[a-z0-9-]+\.)+(?:tiktokcdn\.com|tiktokcdn-us\.com|tiktokcdn-eu\.com|muscdn\.com)$/.test(
      u.hostname,
    );
  const permitted =
    tipo === "mp4"
      ? (creatomate && /\.mp4$/.test(u.pathname)) || backblaze
      : red === "youtube"
        ? youtube
        : red === "tiktok"
          ? tiktok
          : creatomate || youtube || tiktok;
  if (!permitted)
    throw new ErrorHttp(422, "El origen del medio no está habilitado.");
  return u.href;
}
async function descargar(
  raw: string,
  tipo: "mp4" | "imagen",
  red: string,
  transporte: Transporte,
) {
  const url = origenPermitido(raw, tipo, red);
  const response = await solicitar(transporte, url);
  const mime = response.headers.get("content-type")?.split(";")[0].trim();
  const max = tipo === "mp4" ? MAX_MONTAJE_BYTES : 8 * 1024 * 1024;
  const fail = async () => {
    await response.body?.cancel();
    throw new ErrorHttp(415, "El medio no tiene un formato compatible.");
  };
  if (
    response.status !== 200 ||
    (tipo === "mp4"
      ? mime !== "video/mp4"
      : !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
          mime ?? "",
        )) ||
    Number(response.headers.get("content-length")) > max
  )
    return fail();
  const reader = response.body?.getReader();
  if (!reader) throw new ErrorHttp(422, "El medio está vacío.");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > max)
        throw new ErrorHttp(413, "El medio supera el tamaño permitido.");
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function validarMiniaturaPublicada(c: Contexto, url: string) {
  origenPermitido(url, "imagen", c.red);
  if (c.red === "youtube") {
    const embed = enlaceIncrustado(c.publicacion?.url ?? "");
    const id = embed?.match(
      /^https:\/\/www\.youtube\.com\/embed\/([\w-]{11})$/,
    )?.[1];
    if (!id || new URL(url).pathname.split("/")[2] !== id)
      throw new ErrorHttp(
        422,
        "La miniatura no corresponde a esta publicación.",
      );
  }
}

async function miniaturaPublica(c: Contexto, transporte: Transporte) {
  const embed = enlaceIncrustado(c.publicacion?.url ?? "");
  if (!embed || !["youtube", "tiktok"].includes(c.red)) return "";
  const youtubeId = embed.match(
    /^https:\/\/www\.youtube\.com\/embed\/([\w-]{11})$/,
  )?.[1];
  const tiktokId = embed.match(
    /^https:\/\/www\.tiktok\.com\/player\/v1\/(\d+)/,
  )?.[1];
  if ((c.red === "youtube" && !youtubeId) || (c.red === "tiktok" && !tiktokId))
    return "";
  // Endpoints oficiales del registro oEmbed; nunca descargar/incrustar su HTML.
  const endpoint = new URL(
    c.red === "youtube"
      ? "https://www.youtube.com/oembed"
      : "https://www.tiktok.com/oembed",
  );
  endpoint.searchParams.set(
    "url",
    youtubeId
      ? `https://www.youtube.com/watch?v=${youtubeId}`
      : c.publicacion!.url,
  );
  endpoint.searchParams.set("format", "json");
  const response = await solicitar(transporte, endpoint.href);
  const max = 64 * 1024;
  if (
    !response.headers.get("content-type")?.includes("application/json") ||
    Number(response.headers.get("content-length")) > max
  ) {
    await response.body?.cancel();
    return "";
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max)
        throw new ErrorHttp(413, "Respuesta de publicación demasiado grande.");
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString()) as {
      thumbnail_url?: unknown;
    };
    if (
      typeof data.thumbnail_url !== "string" ||
      data.thumbnail_url.length > 4096
    )
      return "";
    validarMiniaturaPublicada(c, data.thumbnail_url);
    return data.thumbnail_url;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

const trabajos = new Map<string, Promise<void>>();
let activos = 0;
const espera: (() => void)[] = [];
async function turno(run: () => Promise<void>) {
  if (activos >= 2) await new Promise<void>((resolve) => espera.push(resolve));
  else activos++;
  try {
    await run();
  } finally {
    const next = espera.shift();
    if (next) next();
    else activos--;
  }
}

async function preparar(c: Contexto, user: User, transporte: Transporte) {
  const now = Date.now();
  const anterior = cache(c.clave);
  const conservar = anterior?.revision === c.revision && anterior.tienePoster;
  const claimed = db().transaction((tx) => {
    const row = cache(c.clave);
    if (
      row?.revision === c.revision &&
      (row.reservaHasta > now ||
        row.reintentarEn > now ||
        (row.estado === "listo" &&
          !row.reintentarEn &&
          row.actualizadoEn + DIA > now))
    )
      return false;
    const values = {
      clave: c.clave,
      videoId: c.video.id,
      publicacionId: c.publicacionId,
      revision: c.revision,
      estado: conservar ? ("listo" as const) : ("pendiente" as const),
      tinte: conservar ? anterior.tinte : c.tinte,
      actualizadoEn: conservar ? anterior.actualizadoEn : now,
      reservaHasta: now + 5 * 60_000,
      intentos: row?.revision === c.revision ? row.intentos + 1 : 1,
    };
    tx.insert(videoMedios)
      .values(values)
      .onConflictDoUpdate({
        target: videoMedios.clave,
        set: {
          ...values,
          ...(conservar
            ? {}
            : {
                posterData: "",
                previewData: "",
                previewBytes: 0,
                previewDuracion: 0,
              }),
        },
      })
      .run();
    return true;
  });
  if (!claimed) return;
  let poster: Awaited<ReturnType<typeof procesarPoster>> | undefined;
  let derivado: Awaited<ReturnType<typeof derivarMp4>> | undefined;
  let origen: OrigenPoster = c.escena ? "escena" : "render";
  try {
    if (c.montaje) {
      try {
        const copy =
          c.montaje === leerObservabilidad(c.video.observability).montaje
            ? db()
                .select({ data: montajesFabrica.data })
                .from(montajesFabrica)
                .where(
                  and(
                    eq(montajesFabrica.videoId, c.video.id),
                    eq(montajesFabrica.ownerId, c.video.ownerId),
                    eq(montajesFabrica.revision, revisionMontaje(c.video)),
                  ),
                )
                .get()
            : undefined;
        const bytes = copy
          ? Buffer.from(copy.data, "base64")
          : await descargar(c.montaje, "mp4", "", transporte);
        if (bytes.length > MAX_MONTAJE_BYTES)
          throw new ErrorHttp(413, "El montaje supera el tamaño permitido.");
        derivado = await derivarMp4(bytes);
        if (!c.publicacion || !["youtube", "tiktok"].includes(c.red))
          poster = derivado.poster;
      } catch {
        /* Una portada real existente sigue siendo útil sin preview. */
      }
    }
    if (c.miniatura && (!poster || c.publicacion)) {
      try {
        if (c.publicacion) validarMiniaturaPublicada(c, c.miniatura);
        poster = await procesarPoster(
          await descargar(c.miniatura, "imagen", c.red, transporte),
        );
        origen =
          c.red === "youtube" || c.red === "tiktok"
            ? c.red
            : c.escena
              ? "escena"
              : "miniatura";
      } catch {
        /* No convertir un fallo de red en una ilustración de relleno. */
      }
    }
    if (!poster && c.publicacion) {
      try {
        const url = await miniaturaPublica(c, transporte);
        if (url) {
          poster = await procesarPoster(
            await descargar(url, "imagen", c.red, transporte),
          );
          origen = c.red === "youtube" ? "youtube" : "tiktok";
        }
      } catch {
        /* oEmbed no garantiza una miniatura para contenido retirado. */
      }
    }
    // Revalidar la revisión y el dueño después de descargar, antes de guardar.
    const fresh = contexto(user, c.video.id, c.publicacionId);
    if (fresh.revision !== c.revision) return;
    const completa = !!poster && (!c.montaje || !!derivado);
    const intentos = cache(c.clave)?.intentos ?? 1;
    db()
      .update(videoMedios)
      .set({
        estado: poster || conservar ? "listo" : "no_disponible",
        tinte:
          poster?.tinte ??
          derivado?.poster.tinte ??
          (conservar ? anterior.tinte : c.tinte),
        ...(poster
          ? {
              posterData: poster.data.toString("base64"),
              posterMime: "image/webp",
              posterOrigen: origen,
              posterAncho: poster.ancho,
              posterAlto: poster.alto,
              tinte: poster.tinte,
            }
          : {}),
        ...(derivado
          ? {
              previewData: derivado.preview.toString("base64"),
              previewBytes: derivado.preview.length,
              previewDuracion: derivado.duracion,
            }
          : {}),
        ancho:
          derivado?.ancho ??
          (conservar
            ? anterior.ancho
            : (c.dimensiones?.ancho ?? poster?.ancho ?? 1600)),
        alto:
          derivado?.alto ??
          (conservar
            ? anterior.alto
            : (c.dimensiones?.alto ?? poster?.alto ?? 900)),
        origenDimensiones: derivado
          ? "video"
          : conservar
            ? anterior.origenDimensiones
            : c.dimensiones
              ? "video"
              : poster
                ? "poster"
                : "reserva",
        actualizadoEn:
          poster || derivado
            ? Date.now()
            : (anterior?.actualizadoEn ?? Date.now()),
        reservaHasta: 0,
        reintentarEn:
          completa || intentos >= 3
            ? Date.now() + DIA
            : Date.now() + 5 * 60_000,
      })
      .where(
        and(
          eq(videoMedios.clave, c.clave),
          eq(videoMedios.revision, c.revision),
        ),
      )
      .run();
  } catch {
    db()
      .update(videoMedios)
      .set({
        estado: conservar ? "listo" : "no_disponible",
        reservaHasta: 0,
        reintentarEn: Date.now() + 5 * 60_000,
      })
      .where(
        and(
          eq(videoMedios.clave, c.clave),
          eq(videoMedios.revision, c.revision),
        ),
      )
      .run();
  }
}

export async function sincronizarVideoMedios(
  user: User,
  id: string,
  publicacionId = "",
  transporte?: Transporte,
) {
  const c = contexto(user, id, publicacionId);
  if (c.sinMedio) {
    if (cache(c.clave)?.revision !== c.revision) guardarTipografico(c);
    return;
  }
  const key = `${c.clave}:${c.revision}`;
  const actual = trabajos.get(key);
  if (actual) return actual;
  // Cola acotada: la siguiente petición vuelve a intentarlo si estaba llena.
  if (trabajos.size >= 18) return;
  // Simulador/demo no salen a proveedores al renderizar tarjetas. La copia
  // local sigue disponible; un ensayo puede inyectar un transporte explícito.
  const http: Transporte =
    transporte ??
    (process.env.COOPER_DEMO === "1" || process.env.COOPER_FABRICA !== "n8n"
      ? async () => {
          throw new ErrorHttp(
            409,
            "El medio remoto no está disponible en esta demostración.",
          );
        }
      : fetch);
  const promise = turno(() => preparar(c, user, http)).finally(() =>
    trabajos.delete(key),
  );
  trabajos.set(key, promise);
  return promise;
}

export function servirVideoMedio(
  user: User,
  id: string,
  publicacionId: string,
  tipo: "poster" | "preview",
  request: Request,
) {
  const c = contexto(user, id, publicacionId);
  if (c.sinMedio && cache(c.clave)?.revision !== c.revision)
    guardarTipografico(c);
  const row = db()
    .select()
    .from(videoMedios)
    .where(eq(videoMedios.clave, c.clave))
    .get();
  if (
    !row ||
    row.revision !== c.revision ||
    !(tipo === "poster" ? row.posterData : row.previewData)
  )
    throw new ErrorHttp(404, "Este medio todavía no está disponible.");
  const bytes = Buffer.from(
    tipo === "poster" ? row.posterData : row.previewData,
    "base64",
  );
  const etag = `"${hash(bytes)}"`;
  const headers = new Headers({
    "Cache-Control": "private, max-age=0, must-revalidate",
    ETag: etag,
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "Content-Type": tipo === "poster" ? row.posterMime : "video/mp4",
  });
  if (request.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });
  headers.set("Content-Length", String(bytes.length));
  return new Response(bytes, { headers });
}
