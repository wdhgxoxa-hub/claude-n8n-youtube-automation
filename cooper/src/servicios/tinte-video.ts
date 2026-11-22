import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videos, type User } from "@/db/schema";
import { leerObservabilidad } from "@/contratos/observabilidad";
import { requireOwner } from "@/lib/permisos";
import { rutaBase } from "@/lib/demo";
import { analizarImagenVisual, descargarImagenVisual } from "./marcas/visual";

const colorSeguro =
  /^hsl\((?:\d|[1-9]\d|[12]\d\d|3[0-5]\d) (?:\d|[1-5]\d|60)% (?:4[5-9]|5\d|60)%\)$/;
const pendientes = new Map<string, Promise<string | null>>();

/** Tono del medio; saturación máxima 60%, luminosidad 45–60%. */
export async function extraerTinte(buffer: Buffer) {
  const { dominant } = await analizarImagenVisual(buffer);
  const [r, g, b] = [dominant.r, dominant.g, dominant.b].map((n) => n / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  if (delta) {
    hue =
      max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  return `hsl(${Math.round(hue) % 360} ${Math.round(Math.min(60, saturation * 100))}% ${Math.round(Math.max(45, Math.min(60, lightness * 100)))}%)`;
}

type Opciones = { transporte?: typeof fetch; directorio?: string };
export async function tinteVideo(
  user: User,
  videoId: string,
  opciones: Opciones = {},
): Promise<string | null> {
  const row = db().select().from(videos).where(eq(videos.id, videoId)).get();
  requireOwner(user, row);
  if (!row) return null;
  // Ninguna descarga durante ensayo o demo. Los tests inyectan solo búferes ficticios.
  if (
    !opciones.transporte &&
    (process.env.COOPER_DEMO === "1" || process.env.COOPER_FABRICA !== "n8n")
  )
    return null;
  const datos = leerObservabilidad(row.observability);
  const origen =
    datos.miniatura || datos.publicaciones.find((p) => p.miniatura)?.miniatura;
  if (!origen) return null;
  // El caché privado se crea en ejecución; no pertenece al paquete desplegable.
  const directorio = resolve(
    /* turbopackIgnore: true */ opciones.directorio ??
      `${rutaBase(process.env.COOPER_DATABASE_PATH ?? "./data/cooper.sqlite", process.env.COOPER_DEMO === "1")}.tintes`,
  );
  // Una configuración equivocada nunca convierte el caché en un recurso público.
  if (
    directorio === resolve("public") ||
    directorio.startsWith(`${resolve("public")}${sep}`)
  )
    return null;
  const key = createHash("sha256")
    .update(`${row.ownerId}\0${origen}\0${row.remoteUpdatedAt}`)
    .digest("hex");
  const archivo = resolve(directorio, `${key}.json`);
  if (pendientes.has(archivo)) return pendientes.get(archivo)!;
  const tarea = (async () => {
    try {
      const saved: unknown = JSON.parse(await readFile(archivo, "utf8"));
      if (
        saved &&
        typeof saved === "object" &&
        "color" in saved &&
        "hasta" in saved &&
        typeof saved.hasta === "number" &&
        saved.hasta > Date.now() &&
        (saved.color === null ||
          (typeof saved.color === "string" && colorSeguro.test(saved.color)))
      )
        return saved.color as string | null;
    } catch {
      /* La ausencia o corrupción del caché se recupera recalculando. */
    }
    let color: string | null = null;
    try {
      const buffer = await descargarImagenVisual(
        origen,
        opciones.transporte ?? fetch,
        true,
      );
      if (buffer) color = await extraerTinte(buffer);
    } catch {
      /* Un póster vencido no impide ver el video. */
    }
    let temporal: string | undefined;
    try {
      await mkdir(directorio, { recursive: true, mode: 0o700 });
      temporal = `${archivo}.${randomUUID()}.tmp`;
      await writeFile(
        temporal,
        JSON.stringify({
          color,
          hasta: Date.now() + (color ? 30 * 86400000 : 300000),
        }),
        { mode: 0o600, flag: "wx" },
      );
      await rename(temporal, archivo);
    } catch {
      if (temporal) await unlink(temporal).catch(() => {});
      // Si el disco es de solo lectura, se conserva el resultado de esta petición.
    }
    return color;
  })();
  pendientes.set(archivo, tarea);
  try {
    return await tarea;
  } finally {
    pendientes.delete(archivo);
  }
}
