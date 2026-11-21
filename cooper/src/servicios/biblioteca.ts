import { createHash, randomInt, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  assets,
  attachments,
  identityChallenges,
  publicMedia,
  type Asset,
  type User,
} from "@/db/schema";
import { ErrorHttp, requireAdmin, requireOwn } from "@/lib/permisos";
import {
  CATALOGO,
  CONSENTIMIENTO,
  CONSENTIMIENTO_VERSION,
  VOCES_GEMINI,
  type ItemCatalogo,
} from "./medios";
import {
  proveedorAvatar,
  proveedorVoz,
  proveedorCatalogoVoz,
} from "./proveedores";
import { revocarConsentimiento } from "./presentacion";
import { descargar } from "./proveedores/http";
import type { ArchivoMedio, TrabajoMedio } from "./proveedores/tipos";

export function crearReto(user: User, kind: "avatar" | "voz") {
  const palabras = [
    "cielo",
    "río",
    "bosque",
    "luna",
    "cobre",
    "mar",
    "nube",
    "olivo",
    "arena",
    "faro",
    "hoja",
    "viento",
    "piedra",
    "sol",
    "valle",
    "flor",
  ];
  const codigo = Array.from(
    { length: 6 },
    () => palabras[randomInt(palabras.length)],
  ).join(" ");
  const row = {
    id: randomUUID(),
    ownerId: user.id,
    kind,
    phrase: `Soy la persona de esta grabación. Autorizo crear mi ${kind === "avatar" ? "avatar" : "voz"} en Cooper. Mi frase es: ${codigo}.`,
    expiresAt: Date.now() + 15 * 60000,
  };
  db().insert(identityChallenges).values(row).run();
  return { id: row.id, phrase: row.phrase, expiresAt: row.expiresAt };
}
export const altaMedioSchema = z
  .object({
    kind: z.enum(["avatar", "voz"]),
    name: z.string().trim().min(1).max(120),
    challengeId: z.string().uuid(),
    evidenceId: z.string().uuid(),
    photoIds: z.array(z.string().uuid()).max(3).default([]),
    placement: z.enum(["completo", "partes"]),
    consentimiento: z.literal(true),
  })
  .strict();
function archivoPropio(user: User, id: string) {
  const file = db()
    .select()
    .from(attachments)
    .where(eq(attachments.id, id))
    .get();
  requireOwn(user, file);
  return file!;
}
export async function crearMedio(user: User, raw: unknown) {
  const input = altaMedioSchema.parse(raw);
  if (input.kind === "voz" && input.photoIds.length)
    throw new ErrorHttp(400, "Una voz no admite fotos adjuntas.");
  const reto = db()
    .select()
    .from(identityChallenges)
    .where(eq(identityChallenges.id, input.challengeId))
    .get();
  requireOwn(user, reto);
  if (
    !reto ||
    reto.kind !== input.kind ||
    reto.usedAt ||
    reto.expiresAt <= Date.now()
  )
    throw new ErrorHttp(
      409,
      "La frase caducó o ya fue utilizada. Inicia una nueva creación.",
    );
  const evidence = archivoPropio(user, input.evidenceId);
  if (
    !/^(audio|video)\//.test(evidence.mime) ||
    (input.kind === "voz" && !evidence.mime.startsWith("audio/"))
  )
    throw new ErrorHttp(
      400,
      "Usa una grabación de voz para clonar tu voz; para el avatar también se admite video.",
    );
  if (input.kind === "avatar" && !input.photoIds.length)
    throw new ErrorHttp(400, "Sube al menos una foto tuya.");
  for (const id of input.photoIds)
    if (!archivoPropio(user, id).mime.startsWith("image/"))
      throw new ErrorHttp(400, "Selecciona fotos válidas.");
  const provider = input.kind === "avatar" ? proveedorAvatar() : proveedorVoz();
  const id = randomUUID(),
    now = Date.now();
  db().transaction(
    (tx) => {
      const consumed = tx
        .update(identityChallenges)
        .set({ usedAt: now })
        .where(
          and(
            eq(identityChallenges.id, reto.id),
            eq(identityChallenges.usedAt, 0),
          ),
        )
        .run();
      if (consumed.changes !== 1)
        throw new ErrorHttp(409, "Esta frase ya fue utilizada.");
      tx.insert(assets)
        .values({
          id,
          ownerId: user.id,
          kind: input.kind,
          name: input.name,
          evidenceId: evidence.id,
          photoId: input.photoIds[0] ?? "",
          photoIds: JSON.stringify(input.photoIds),
          challengeId: reto.id,
          placement: input.placement,
          consentAt: now,
          consentText: CONSENTIMIENTO,
          consentVersion: CONSENTIMIENTO_VERSION,
          simulated: provider.simulada,
          provider: provider.nombre,
          status: provider.simulada ? "iniciando" : "revision",
          verified: provider.simulada,
          createdAt: now,
        })
        .run();
    },
    { behavior: "immediate" },
  );
  if (provider.simulada) await iniciarMedio(id);
  return { id, simulada: provider.simulada };
}
function guardarTrabajo(id: string, trabajo: TrabajoMedio) {
  db()
    .update(assets)
    .set({
      providerId: trabajo.id,
      status: trabajo.estado,
      previewUrl: trabajo.previewUrl ?? "",
      polledAt: Date.now(),
      syncError: false,
    })
    .where(
      and(
        eq(assets.id, id),
        eq(assets.verified, true),
        eq(assets.consentRevokedAt, 0),
        eq(assets.status, "iniciando"),
      ),
    )
    .run();
}
async function iniciarMedio(id: string) {
  const a = db().select().from(assets).where(eq(assets.id, id)).get()!;
  db()
    .update(assets)
    .set({ polledAt: Date.now() })
    .where(eq(assets.id, id))
    .run();
  try {
    const archivo = db()
      .select()
      .from(attachments)
      .where(eq(attachments.id, a.kind === "avatar" ? a.photoId : a.evidenceId))
      .get();
    if (!archivo)
      throw new ErrorHttp(404, "Falta el material de entrenamiento.");
    const trabajo =
      a.kind === "avatar"
        ? await proveedorAvatar(a.provider).crear({
            nombre: a.name,
            foto: archivo,
            operacionId: a.id,
          })
        : await proveedorVoz(a.provider).clonar({
            nombre: a.name,
            audio: archivo,
            operacionId: a.id,
          });
    guardarTrabajo(id, trabajo);
  } catch (e) {
    db()
      .update(assets)
      .set({ status: "error", syncError: true })
      .where(eq(assets.id, id))
      .run();
    throw e;
  }
}
export async function revisarIdentidad(
  user: User,
  id: string,
  aceptar: boolean,
) {
  requireAdmin(user);
  const a = db().select().from(assets).where(eq(assets.id, id)).get();
  if (!a || a.consentRevokedAt > 0 || a.status !== "revision")
    throw new ErrorHttp(409, "No hay una identidad pendiente de revisión.");
  const result = db()
    .update(assets)
    .set({
      verified: aceptar,
      reviewedBy: user.id,
      reviewedAt: Date.now(),
      status: aceptar ? "iniciando" : "rechazado",
    })
    .where(and(eq(assets.id, id), eq(assets.status, "revision")))
    .run();
  if (!result.changes) throw new ErrorHttp(409, "La revisión ya fue resuelta.");
  if (aceptar) await iniciarMedio(id);
}
export function revisiones(user: User) {
  requireAdmin(user);
  return db()
    .select({
      id: assets.id,
      ownerId: assets.ownerId,
      name: assets.name,
      kind: assets.kind,
      photoIds: assets.photoIds,
      evidenceId: assets.evidenceId,
      consentAt: assets.consentAt,
      consentText: assets.consentText,
      phrase: identityChallenges.phrase,
    })
    .from(assets)
    .innerJoin(
      identityChallenges,
      eq(assets.challengeId, identityChallenges.id),
    )
    .where(eq(assets.status, "revision"))
    .all();
}
export function archivoRevision(user: User, id: string, fileId: string) {
  requireAdmin(user);
  const a = db().select().from(assets).where(eq(assets.id, id)).get();
  if (
    !a ||
    a.status !== "revision" ||
    (fileId !== a.evidenceId &&
      !(JSON.parse(a.photoIds) as string[]).includes(fileId))
  )
    throw new ErrorHttp(404, "No encontramos ese recurso.");
  return db()
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, fileId), eq(attachments.ownerId, a.ownerId)))
    .get()!;
}
// Compatibilidad para consultas internas; comparte la misma reserva durable.
export async function sincronizarMedios(user: User) {
  const { cicloBiblioteca } = await import("./biblioteca-trabajador");
  await cicloBiblioteca({ ownerId: user.id });
}
// Identificadores de interfaz estables; los IDs del proveedor quedan en servidor.
const idPresentador = (id: string) =>
  `presentador-${createHash("sha256").update(id).digest("hex").slice(0, 32)}`;
const idVoz = (voice: string) => `voz-${voice.toLowerCase()}`;
const vozCatalogo = (id: string) => VOCES_GEMINI.find((v) => idVoz(v) === id);
const avatarCatalogo = (id: string) =>
  db()
    .select()
    .from(publicMedia)
    .all()
    .find((a) => idPresentador(a.providerId) === id);
export function catalogo(): ItemCatalogo[] {
  const avatarSim = proveedorAvatar().simulada,
    vozSim = proveedorCatalogoVoz().simulada;
  const fixed: ItemCatalogo[] = CATALOGO.filter((a) =>
    a.kind === "avatar" ? avatarSim || a.style === "ilustrado" : vozSim,
  ).map((a) => ({ ...a, simulada: true, preview: true }));
  if (!vozSim)
    fixed.push(
      ...VOCES_GEMINI.map((v) => ({
        id: idVoz(v),
        kind: "voz" as const,
        name: v,
        description: "Voz de catálogo · español",
        style: "voz",
        simulada: false,
        preview: true,
      })),
    );
  if (!avatarSim)
    fixed.push(
      ...db()
        .select()
        .from(publicMedia)
        .all()
        .map((a) => ({
          id: idPresentador(a.providerId),
          kind: "avatar" as const,
          name: a.name,
          description: "Presentador del estudio",
          style: "realista",
          simulada: false,
          preview: true,
        })),
    );
  return fixed;
}
let actualizacion: Promise<void> | undefined;
let ultimaActualizacion = 0;
export async function actualizarCatalogo() {
  if (
    proveedorAvatar().simulada ||
    Date.now() - ultimaActualizacion < 15 * 60000
  )
    return;
  if (actualizacion) return actualizacion;
  actualizacion = (async () => {
    const items = await proveedorAvatar().catalogo();
    db().transaction(
      (tx) => {
        tx.delete(publicMedia).run();
        for (const a of items)
          tx.insert(publicMedia)
            .values({
              id: `heygen:${a.id}`,
              providerId: a.id,
              name: a.nombre,
              previewUrl: a.previewUrl,
              updatedAt: Date.now(),
            })
            .run();
      },
      { behavior: "immediate" },
    );
    ultimaActualizacion = Date.now();
  })();
  try {
    await actualizacion;
  } finally {
    actualizacion = undefined;
  }
}
export function medioDisponible(
  user: User,
  id: string,
  kind: "avatar" | "voz",
) {
  const item = catalogo().find((a) => a.id === id && a.kind === kind);
  if (item) {
    const remoteAvatar =
      kind === "avatar" && !item.simulada ? avatarCatalogo(id) : undefined;
    const remoteVoice =
      kind === "voz" && !item.simulada ? vozCatalogo(id) : undefined;
    const provider = remoteAvatar
      ? "heygen"
      : remoteVoice
        ? "gemini"
        : "simulada";
    return {
      recurso_id: id,
      proveedor: provider,
      id: remoteAvatar?.providerId ?? remoteVoice ?? id,
      tipo: "catalogo" as const,
    };
  }
  const a = db().select().from(assets).where(eq(assets.id, id)).get();
  if (
    !a ||
    a.kind !== kind ||
    !a.verified ||
    a.consentRevokedAt > 0 ||
    a.status !== "listo" ||
    (!a.shared && a.ownerId !== user.id)
  )
    throw new ErrorHttp(
      404,
      "Ese avatar o voz no está disponible en tu biblioteca.",
    );
  return {
    recurso_id: id,
    proveedor: a.provider,
    id: a.providerId || a.id,
    tipo: "propio" as const,
  };
}
export function activoVisible(user: User, id: string): Asset {
  const a = db().select().from(assets).where(eq(assets.id, id)).get();
  if (
    !a ||
    a.consentRevokedAt > 0 ||
    (a.ownerId !== user.id && !(a.shared && a.verified && a.status === "listo"))
  )
    throw new ErrorHttp(404, "No encontramos ese recurso.");
  return a;
}
const muestras = new Map<string, ArchivoMedio>();
const pendientesMuestra = new Map<string, Promise<ArchivoMedio>>();
export async function muestraMedio(
  user: User,
  id: string,
): Promise<ArchivoMedio> {
  const cat = catalogo().find((a) => a.id === id);
  const a = cat ? undefined : activoVisible(user, id);
  if (a && a.status !== "listo")
    throw new ErrorHttp(409, "Tu creación todavía no está lista.");
  if (a?.previewData) return { data: a.previewData, mime: a.previewMime };
  const key = a ? `propio:${a.id}` : `catalogo:${id}`;
  const cached = cat && muestras.get(key);
  if (cached) return cached;
  if (pendientesMuestra.has(key)) {
    const file = await pendientesMuestra.get(key)!;
    if (a) activoVisible(user, id);
    return file;
  }
  const work = (async () => {
    let file: ArchivoMedio;
    if ((a?.kind ?? cat?.kind) === "voz") {
      const p = proveedorVoz(
        a?.provider ??
          (vozCatalogo(id) && !cat?.simulada ? "gemini" : "simulada"),
      );
      file = await p.sintetizar(
        a?.providerId ?? vozCatalogo(id) ?? id,
        "Hola. Esta es mi voz en Cooper. Vamos a contar una buena historia.",
      );
    } else {
      const url = a?.previewUrl ?? avatarCatalogo(id)?.previewUrl;
      if (!url)
        throw new ErrorHttp(
          404,
          "Todavía no hay una vista previa en movimiento.",
        );
      file = await descargar(url);
    }
    if (a)
      db()
        .update(assets)
        .set({ previewData: file.data, previewMime: file.mime })
        .where(eq(assets.id, a.id))
        .run();
    else {
      if (muestras.size >= 40) muestras.delete(muestras.keys().next().value!);
      muestras.set(key, file);
    }
    return file;
  })();
  pendientesMuestra.set(key, work);
  try {
    const file = await work;
    if (a) activoVisible(user, id);
    return file;
  } finally {
    pendientesMuestra.delete(key);
  }
}
export async function eliminarMedio(user: User, id: string) {
  const a = db().select().from(assets).where(eq(assets.id, id)).get();
  requireOwn(user, a);
  if (a!.status === "iniciando")
    throw new ErrorHttp(409, "Espera a que termine el envío antes de borrar.");
  if (!a!.simulated && !a!.providerId && a!.status === "error")
    throw new ErrorHttp(
      409,
      "Walter debe conciliar el envío antes de borrar; podría existir una creación remota.",
    );
  revocarConsentimiento(user, id);
  // Retirar acceso antes de pedir el borrado remoto; un fallo conserva la fila para reintentar.
  db()
    .update(assets)
    .set({ shared: false, verified: false, status: "error" })
    .where(eq(assets.id, id))
    .run();
  if (a!.providerId) {
    const p =
      a!.kind === "avatar"
        ? proveedorAvatar(a!.provider)
        : proveedorVoz(a!.provider);
    await p.eliminar(a!.providerId);
  }
  db().delete(assets).where(eq(assets.id, id)).run();
}

export async function reintentarMedio(user: User, id: string) {
  const a = db().select().from(assets).where(eq(assets.id, id)).get();
  requireOwn(user, a);
  if (
    !a ||
    !a.verified ||
    a.provider !== "heygen" ||
    a.providerId ||
    !["error", "iniciando"].includes(a.status) ||
    Date.now() - a.reviewedAt >= 23 * 3600000
  )
    throw new ErrorHttp(
      409,
      "Walter debe revisar esta solicitud antes de volver a enviarla.",
    );
  if (a.status === "iniciando" && Date.now() - a.polledAt < 60000)
    throw new ErrorHttp(409, "El envío sigue en curso.");
  const claim = db()
    .update(assets)
    .set({ status: "iniciando", polledAt: Date.now() })
    .where(
      and(
        eq(assets.id, id),
        eq(assets.status, a.status),
        eq(assets.polledAt, a.polledAt),
      ),
    )
    .run();
  if (!claim.changes) throw new ErrorHttp(409, "El envío sigue en curso.");
  await iniciarMedio(id);
}
