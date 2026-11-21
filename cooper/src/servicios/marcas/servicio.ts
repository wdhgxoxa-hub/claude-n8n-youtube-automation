import {
  leerCompetenciaMarca,
  actualizarCompetenciaMarca,
} from "../competencia";
import { competenciaVigente } from "@/contratos/competencia.mjs";
import { observarImagenes } from "./visual";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  marcas,
  cuentasMarca,
  piezasMarca,
  citasMarca,
  attachments,
  users,
  montajesFabrica,
  type User,
  type Marca,
  type PiezaMarca,
} from "@/db/schema";
import { ErrorHttp, requireAdmin, requireOwner } from "@/lib/permisos";
import { cuentaActiva } from "@/servicios/mensajeria/cuentas";
import { marcaSchema, cuentaSchema, piezaSchema } from "./tipos";
import { estudiar, proximoHorario } from "./estudio";
import { verificarCitas, registrarCita, proponerTexto } from "./especialistas";
import { proveedorRed, type RedSocial } from "./redes";
import { lineas, renderizar } from "./diseno";
import {
  listarMontajes,
  comprobarMontaje,
  prepararMontaje,
  buscarCopia,
} from "./montajes";
import { fabrica } from "@/servicios/fabrica";
export function obtenerMarca(user: User, id: string): Marca {
  const m = db().select().from(marcas).where(eq(marcas.id, id)).get();
  requireOwner(user, m);
  return m!;
}
export function obtenerPieza(user: User, id: string) {
  const p = db().select().from(piezasMarca).where(eq(piezasMarca.id, id)).get();
  if (!p) throw new ErrorHttp(404, "No encontramos la pieza.");
  return { p, m: obtenerMarca(user, p.marcaId) };
}
export function estadoMarcas(user: User) {
  const visibles = db()
    .select()
    .from(marcas)
    .where(user.role === "admin" ? undefined : eq(marcas.ownerId, user.id))
    .all();
  return {
    simulada: proveedorRed().simulada,
    montajes: listarMontajes(user),
    marcas: visibles.map((m) => ({
      ...m,
      competencia: leerCompetenciaMarca(m),
      cuentas: db()
        .select()
        .from(cuentasMarca)
        .where(eq(cuentasMarca.marcaId, m.id))
        .all(),
      piezas: db()
        .select()
        .from(piezasMarca)
        .where(eq(piezasMarca.marcaId, m.id))
        .orderBy(piezasMarca.programada)
        .all(),
    })),
    citas: db()
      .select({
        referencia: citasMarca.referencia,
        version: citasMarca.version,
        texto: citasMarca.texto,
        fuente: citasMarca.fuente,
      })
      .from(citasMarca)
      .all(),
    archivos: db()
      .select({
        id: attachments.id,
        name: attachments.name,
        mime: attachments.mime,
        ownerId: attachments.ownerId,
      })
      .from(attachments)
      .where(
        user.role === "admin" ? undefined : eq(attachments.ownerId, user.id),
      )
      .all(),
    propietarios:
      user.role === "admin"
        ? db()
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(eq(users.active, true))
            .all()
        : [{ id: user.id, name: user.name }],
  };
}
export type EstadoMarcas = ReturnType<typeof estadoMarcas>;
function validarLogo(m: { ownerId: string; guia: Marca["guia"] }) {
  if (!m.guia.logoId) return;
  const a = db()
    .select()
    .from(attachments)
    .where(eq(attachments.id, m.guia.logoId))
    .get();
  if (!a || a.ownerId !== m.ownerId || !a.mime.startsWith("image/"))
    throw new ErrorHttp(404, "Selecciona un logo del dueño de la marca.");
}
export function guardarMarca(user: User, raw: unknown, id?: string) {
  const data = marcaSchema.parse(raw),
    anterior = id ? obtenerMarca(user, id) : undefined;
  const ownerId = anterior?.ownerId ?? data.ownerId ?? user.id;
  if (ownerId !== user.id) requireAdmin(user);
  cuentaActiva(ownerId);
  validarLogo({ ownerId, guia: data.guia });
  if (anterior && data.ownerId && data.ownerId !== anterior.ownerId)
    throw new ErrorHttp(
      409,
      "La transferencia de dueño requiere revisión independiente.",
    );
  const value = {
    ...data,
    ownerId,
    id: id ?? randomUUID(),
    createdAt: anterior?.createdAt ?? Date.now(),
  };
  db()
    .insert(marcas)
    .values(value)
    .onConflictDoUpdate({
      target: marcas.id,
      set: {
        nombre: value.nombre,
        rubro: value.rubro,
        zona: value.zona,
        guia: value.guia,
      },
    })
    .run();
  return value;
}
export function agregarCuenta(user: User, marcaId: string, raw: unknown) {
  obtenerMarca(user, marcaId);
  const v = cuentaSchema.parse(raw);
  if (v.red === "instagram" && !v.pagina)
    throw new ErrorHttp(400, "Instagram necesita la página vinculada.");
  if (["instagram", "facebook"].includes(v.red) && !/^\d+$/.test(v.remoto))
    throw new ErrorHttp(400, "Identificador de cuenta inválido.");
  if (
    db()
      .select()
      .from(cuentasMarca)
      .where(
        and(eq(cuentasMarca.red, v.red), eq(cuentasMarca.remoto, v.remoto)),
      )
      .get()
  )
    throw new ErrorHttp(
      409,
      "Esa cuenta ya está registrada. Walter puede revisar la asignación.",
    );
  const id = randomUUID();
  db()
    .insert(cuentasMarca)
    .values({ ...v, id, marcaId, simulada: proveedorRed().simulada })
    .run();
  return { id };
}
export async function conectarCuenta(
  user: User,
  cuentaId: string,
  red: RedSocial = proveedorRed(),
  businessConfirmada = false,
) {
  requireAdmin(user);
  const c = db()
    .select()
    .from(cuentasMarca)
    .where(eq(cuentasMarca.id, cuentaId))
    .get();
  if (!c) throw new ErrorHttp(404, "Cuenta no disponible.");
  const m = obtenerMarca(user, c.marcaId);
  cuentaActiva(m.ownerId);
  const result = await red.comprobar(c);
  db()
    .update(cuentasMarca)
    .set({
      estado: "conectada",
      tipo:
        c.red === "instagram" && businessConfirmada ? "BUSINESS" : result.tipo,
      simulada: red.simulada,
      verificada: Date.now(),
    })
    .where(eq(cuentasMarca.id, c.id))
    .run();
}
export function revocarCuenta(user: User, id: string) {
  const c = db()
    .select()
    .from(cuentasMarca)
    .where(eq(cuentasMarca.id, id))
    .get();
  if (!c) throw new ErrorHttp(404, "Cuenta no disponible.");
  obtenerMarca(user, c.marcaId);
  db()
    .update(cuentasMarca)
    .set({ estado: "revocada" })
    .where(eq(cuentasMarca.id, id))
    .run();
  db()
    .update(piezasMarca)
    .set({ estado: "cancelada", aviso: "Cuenta desconectada." })
    .where(
      and(
        eq(piezasMarca.cuentaId, id),
        inArray(piezasMarca.estado, ["borrador", "pendiente", "programada"]),
      ),
    )
    .run();
}
export async function estudiarMarca(
  user: User,
  id: string,
  red: RedSocial = proveedorRed(),
) {
  const m = obtenerMarca(user, id),
    rows = [];
  for (const c of db()
    .select()
    .from(cuentasMarca)
    .where(
      and(eq(cuentasMarca.marcaId, id), eq(cuentasMarca.estado, "conectada")),
    )
    .all()) {
    if (c.simulada !== red.simulada)
      throw new ErrorHttp(
        409,
        "Verifica de nuevo la conexión en el modo actual.",
      );
    for (const row of await red.historial(c))
      rows.push({ ...row, id: `${c.id}:${row.id}` });
  }
  if (!red.simulada) await observarImagenes(rows);
  cuentaActiva(user.id);
  const estudio = estudiar(m, rows);
  db().update(marcas).set({ estudio }).where(eq(marcas.id, id)).run();
  return estudio;
}
function comprobarPieza(
  m: Marca,
  p: Pick<PiezaMarca, "datos" | "cuentaId" | "guia">,
  red: RedSocial,
) {
  const c = db()
    .select()
    .from(cuentasMarca)
    .where(eq(cuentasMarca.id, p.cuentaId))
    .get();
  if (!c || c.marcaId !== m.id)
    throw new ErrorHttp(404, "Cuenta no disponible para esta marca.");
  if (c.estado !== "conectada" || c.simulada !== red.simulada)
    throw new ErrorHttp(
      409,
      "Walter debe verificar la conexión antes de publicar.",
    );
  const v = p.datos;
  if (
    v.formato === "historia" &&
    (c.red === "youtube" ||
      c.red === "tiktok" ||
      (c.red === "instagram" && c.tipo !== "BUSINESS"))
  )
    throw new ErrorHttp(
      422,
      "Esta cuenta no admite historias en la conexión elegida.",
    );
  if (c.red === "youtube" && v.formato !== "reel")
    throw new ErrorHttp(422, "YouTube necesita una pieza de video.");
  if (
    v.formato === "carrusel" &&
    (v.diapositivas.length < 2 || v.diapositivas.length > 20)
  )
    throw new ErrorHttp(400, "El carrusel necesita entre 2 y 20 diapositivas.");
  lineas(v.titulo, 23, 4);
  lineas(v.detalle, 38, 6);
  v.diapositivas.forEach((t) => lineas(t, 38, 6));
  for (const id of v.adjuntos) {
    const a = db()
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .get();
    if (
      !a ||
      a.ownerId !== m.ownerId ||
      !(v.formato === "reel" ? /^(image|video)\// : /^image\//).test(a.mime)
    )
      throw new ErrorHttp(404, "Adjunto incompatible o ajeno a la marca.");
  }
  if (v.videoId) comprobarMontaje(m.ownerId, v);
  verificarCitas({ ...m, guia: p.guia }, v);
  return c;
}
export function guardarPieza(
  user: User,
  marcaId: string,
  raw: unknown,
  piezaId?: string,
  revision?: number,
  now = Date.now(),
) {
  const m = obtenerMarca(user, marcaId),
    datos = piezaSchema.parse(raw);
  if (datos.videoId) {
    comprobarMontaje(m.ownerId, datos);
    datos.origen = "fabrica";
  }
  const cuenta = db()
    .select()
    .from(cuentasMarca)
    .where(eq(cuentasMarca.id, datos.cuentaId))
    .get();
  if (!cuenta || cuenta.marcaId !== m.id)
    throw new ErrorHttp(404, "Cuenta ajena a la marca.");
  const programada = datos.programada
    ? Date.parse(datos.programada)
    : proximoHorario(m.zona, m.estudio?.horas ?? [18], now);
  if (programada < now + 60000)
    throw new ErrorHttp(400, "Elige un horario futuro.");
  const anterior = piezaId ? obtenerPieza(user, piezaId).p : undefined;
  if (
    anterior &&
    (anterior.marcaId !== m.id ||
      anterior.revision !== revision ||
      !["borrador", "pendiente", "programada"].includes(anterior.estado))
  )
    throw new ErrorHttp(409, "La pieza cambió o ya está en publicación.");
  // Un borrador puede tener citas pendientes; dueño/medios se comprueban antes de exponerlos.
  for (const id of datos.adjuntos) {
    const a = db()
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .get();
    if (!a || a.ownerId !== m.ownerId)
      throw new ErrorHttp(404, "Adjunto ajeno a la marca.");
  }
  const value = {
    id: piezaId ?? randomUUID(),
    marcaId,
    cuentaId: datos.cuentaId,
    datos,
    guia: m.guia,
    programada,
    revision: (anterior?.revision ?? 0) + 1,
    estado: "borrador" as const,
    aprobadaPor: "",
    aprobadaRevision: 0,
    mediosIds: [],
    checkpoint: {},
    updatedAt: now,
    createdAt: anterior?.createdAt ?? now,
  };
  if (anterior) {
    const changed = db()
      .update(piezasMarca)
      .set(value)
      .where(
        and(
          eq(piezasMarca.id, anterior.id),
          eq(piezasMarca.revision, anterior.revision),
          inArray(piezasMarca.estado, ["borrador", "pendiente", "programada"]),
        ),
      )
      .run().changes;
    if (!changed)
      throw new ErrorHttp(409, "La pieza cambió. Recarga la página.");
  } else db().insert(piezasMarca).values(value).run();
  return value;
}
export async function enviarRevision(user: User, id: string, revision: number) {
  const { p, m } = obtenerPieza(user, id);
  if (p.revision !== revision || p.estado !== "borrador")
    throw new ErrorHttp(409, "Revisión desactualizada.");
  comprobarPieza(m, p, proveedorRed());
  const copia = p.datos.videoId
    ? await prepararMontaje(m.ownerId, p.datos)
    : undefined;
  const compuestos = copia ? [] : await renderizar(p, m);
  db().transaction(
    () => {
      // La descarga no mantiene un bloqueo SQLite; revalidar tras cada espera y
      // guardar copia + transición juntas evita huérfanos por edición concurrente.
      cuentaActiva(user.id);
      comprobarPieza(m, p, proveedorRed());
      let mediosIds: string[] = compuestos;
      if (copia) {
        db().insert(montajesFabrica).values(copia).onConflictDoNothing().run();
        mediosIds = [buscarCopia(m.ownerId, p.datos)!.id];
      }
      const changed = db()
        .update(piezasMarca)
        .set({ estado: "pendiente", mediosIds, updatedAt: Date.now() })
        .where(
          and(
            eq(piezasMarca.id, id),
            eq(piezasMarca.revision, revision),
            eq(piezasMarca.estado, "borrador"),
          ),
        )
        .run().changes;
      if (!changed)
        throw new ErrorHttp(409, "La pieza cambió durante la composición.");
    },
    { behavior: "immediate" },
  );
  const { encolarMarca } = await import("./whatsapp");
  encolarMarca(id);
}
export function decidirPieza(
  user: User,
  id: string,
  revision: number,
  aprobar: boolean,
  now = Date.now(),
) {
  requireAdmin(user);
  const { p, m } = obtenerPieza(user, id);
  if (p.estado !== "pendiente" || p.revision !== revision)
    throw new ErrorHttp(409, "Esta revisión ya cambió o recibió una decisión.");
  if (aprobar) {
    comprobarPieza(m, p, proveedorRed());
    if (p.programada <= now)
      throw new ErrorHttp(
        409,
        "El horario pasó. Reprograma y vuelve a revisar.",
      );
    if (!p.mediosIds.length)
      throw new ErrorHttp(409, "Falta la composición revisable.");
  }
  db()
    .update(piezasMarca)
    .set({
      estado: aprobar ? "programada" : "borrador",
      aprobadaPor: aprobar ? user.id : "",
      aprobadaRevision: aprobar ? revision : 0,
      updatedAt: now,
    })
    .where(
      and(
        eq(piezasMarca.id, id),
        eq(piezasMarca.revision, revision),
        eq(piezasMarca.estado, "pendiente"),
      ),
    )
    .run();
}
function firmaMedio(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new ErrorHttp(503, "Medios no configurados.");
  return createHmac("sha256", secret).update(`cooper:marca:${value}`).digest();
}
export function urlsMedios(p: PiezaMarca, now = Date.now()) {
  const origin = new URL(process.env.AUTH_URL ?? "http://localhost:3000");
  if (origin.protocol !== "https:")
    throw new ErrorHttp(
      503,
      "Configura el origen HTTPS público para entregar los medios a la red.",
    );
  return p.mediosIds.map((_, i) => {
    const value = `${p.id}:${p.revision}:${i}:${now + 86400000}`;
    return `${origin.origin}/api/marcas/medio/${p.id}?r=${p.revision}&i=${i}&e=${now + 86400000}&s=${firmaMedio(value).toString("hex")}`;
  });
}
export function leerMedio(id: string, url: URL, user?: User, now = Date.now()) {
  const p = db().select().from(piezasMarca).where(eq(piezasMarca.id, id)).get();
  if (!p) throw new ErrorHttp(404, "Medio no disponible.");
  const m = db().select().from(marcas).where(eq(marcas.id, p.marcaId)).get();
  if (!m) throw new ErrorHttp(404, "Medio no disponible.");
  const index = Number(url.searchParams.get("i") ?? "0");
  if (!Number.isInteger(index) || index < 0 || index >= p.mediosIds.length)
    throw new ErrorHttp(404, "Medio no disponible.");
  if (user) obtenerMarca(user, p.marcaId);
  else {
    const r = url.searchParams.get("r"),
      expires = Number(url.searchParams.get("e")),
      signature = url.searchParams.get("s") ?? "";
    if (
      r !== String(p.revision) ||
      !Number.isSafeInteger(expires) ||
      expires <= now ||
      expires > now + 86400000 ||
      !/^[a-f0-9]{64}$/.test(signature) ||
      !timingSafeEqual(
        firmaMedio(`${p.id}:${r}:${index}:${expires}`),
        Buffer.from(signature, "hex"),
      ) ||
      p.aprobadaRevision !== p.revision ||
      !["enviando", "procesando", "publicada"].includes(p.estado)
    )
      throw new ErrorHttp(404, "Medio no disponible.");
    cuentaActiva(m.ownerId);
    const c = db()
      .select()
      .from(cuentasMarca)
      .where(eq(cuentasMarca.id, p.cuentaId))
      .get();
    if (c?.estado !== "conectada" || c.marcaId !== m.id)
      throw new ErrorHttp(404, "Medio no disponible.");
  }
  if (p.datos.videoId) {
    const copia = buscarCopia(m.ownerId, p.datos);
    if (!copia || copia.id !== p.mediosIds[index])
      throw new ErrorHttp(404, "Medio no disponible.");
    return { ...copia, mime: "video/mp4", name: p.datos.titulo };
  }
  const a = db()
    .select()
    .from(attachments)
    .where(eq(attachments.id, p.mediosIds[index]))
    .get();
  if (!a || a.ownerId !== m.ownerId)
    throw new ErrorHttp(404, "Medio no disponible.");
  return a;
}
export async function procesarMarcas(
  red: RedSocial = proveedorRed(),
  now = Date.now(),
) {
  db()
    .update(piezasMarca)
    .set({
      estado: "revision",
      aviso: "La ejecución se interrumpió. Conciliar antes de reenviar.",
    })
    .where(
      and(
        eq(piezasMarca.estado, "enviando"),
        lte(piezasMarca.leaseAt, now - 300000),
      ),
    )
    .run();
  const pendientes = db()
    .select()
    .from(piezasMarca)
    .where(
      and(
        inArray(piezasMarca.estado, ["programada", "procesando"]),
        lte(piezasMarca.programada, now),
      ),
    )
    .orderBy(piezasMarca.updatedAt, piezasMarca.programada)
    .limit(4)
    .all();
  let atendidas = 0;
  for (const p of pendientes) {
    const claim = db()
      .update(piezasMarca)
      .set({ estado: "enviando", leaseAt: now })
      .where(
        and(
          eq(piezasMarca.id, p.id),
          eq(piezasMarca.estado, p.estado),
          eq(piezasMarca.revision, p.revision),
        ),
      )
      .run().changes;
    if (!claim) continue;
    try {
      const m = db()
        .select()
        .from(marcas)
        .where(eq(marcas.id, p.marcaId))
        .get();
      if (!m) throw new ErrorHttp(404, "Marca no disponible.");
      cuentaActiva(m.ownerId);
      const admin = cuentaActiva(p.aprobadaPor);
      requireAdmin(admin);
      if (p.aprobadaRevision !== p.revision)
        throw new ErrorHttp(409, "La pieza no tiene aprobación vigente.");
      const c = comprobarPieza(m, p, red);
      if (
        c.red === "facebook" &&
        p.datos.formato === "reel" &&
        !p.checkpoint.id
      ) {
        const count = db()
          .select({ n: sql<number>`count(*)` })
          .from(piezasMarca)
          .where(
            and(
              eq(piezasMarca.cuentaId, c.id),
              eq(piezasMarca.estado, "publicada"),
              sql`${piezasMarca.updatedAt} > ${now - 86400000}`,
            ),
          )
          .get()!.n;
        if (count >= 30)
          throw new ErrorHttp(
            429,
            "Facebook alcanzó el límite diario de reels.",
          );
      }
      const result = await red.publicar(
        c,
        p,
        red.simulada ? [] : urlsMedios(p, now),
        (checkpoint) =>
          db()
            .update(piezasMarca)
            .set({ checkpoint })
            .where(
              and(
                eq(piezasMarca.id, p.id),
                eq(piezasMarca.estado, "enviando"),
                eq(piezasMarca.leaseAt, now),
              ),
            )
            .run(),
      );
      db()
        .update(piezasMarca)
        .set({
          estado: result.estado,
          remoto: result.remoto,
          checkpoint: result.checkpoint,
          aviso: result.aviso ?? "",
          updatedAt: now,
        })
        .where(
          and(
            eq(piezasMarca.id, p.id),
            eq(piezasMarca.estado, "enviando"),
            eq(piezasMarca.leaseAt, now),
          ),
        )
        .run();
      atendidas++;
    } catch {
      db()
        .update(piezasMarca)
        .set({
          estado: "revision",
          aviso:
            "La red o la validación no confirmaron la publicación. Revisa la conexión y concilia; no se reenviará automáticamente.",
          updatedAt: now,
        })
        .where(
          and(
            eq(piezasMarca.id, p.id),
            eq(piezasMarca.estado, "enviando"),
            eq(piezasMarca.leaseAt, now),
          ),
        )
        .run();
    }
  }
  return { atendidas };
}
export async function actualizarMetricas(
  red: RedSocial = proveedorRed(),
  now = Date.now(),
) {
  let actualizadas = 0;
  const ultimoIntento = (p: PiezaMarca) =>
    p.checkpoint.metricasIntento ?? p.metricas?.capturadas ?? 0;
  for (const p of db()
    .select()
    .from(piezasMarca)
    .where(eq(piezasMarca.estado, "publicada"))
    .all()
    .filter((p) => now - ultimoIntento(p) > 3600000)
    .sort((a, b) => ultimoIntento(a) - ultimoIntento(b))
    .slice(0, 10)) {
    db()
      .update(piezasMarca)
      .set({ checkpoint: { ...p.checkpoint, metricasIntento: now } })
      .where(eq(piezasMarca.id, p.id))
      .run();
    const c = db()
        .select()
        .from(cuentasMarca)
        .where(eq(cuentasMarca.id, p.cuentaId))
        .get(),
      m = db().select().from(marcas).where(eq(marcas.id, p.marcaId)).get();
    if (!c || c.estado !== "conectada" || c.simulada !== red.simulada || !m)
      continue;
    try {
      cuentaActiva(m.ownerId);
      const metricas = await red.metricas(c, p.remoto);
      db()
        .update(piezasMarca)
        .set({ metricas })
        .where(eq(piezasMarca.id, p.id))
        .run();
      const historia = {
        id: `${c.id}:${p.remoto}`,
        texto: p.datos.texto,
        fecha: new Date(p.updatedAt).toISOString(),
        tipo: p.datos.formato,
        imagen: "",
        metricas,
      };
      db()
        .update(marcas)
        .set({
          estudio: estudiar(
            m,
            [...(m.estudio?.historial ?? []), historia],
            now,
          ),
        })
        .where(eq(marcas.id, m.id))
        .run();
      actualizadas++;
    } catch {
      /* Mantener la última medida, nunca sustituirla por cero. */
    }
  }
  return { actualizadas };
}
export async function rutaMarcas(
  user: User,
  method: string,
  path: string[],
  raw?: unknown,
) {
  const [id, action] = path;
  if (method === "GET" && !id) return estadoMarcas(user);
  if (method !== "POST") throw new ErrorHttp(405, "Método no permitido.");
  if (!id) return guardarMarca(user, raw);
  if (id === "montajes") {
    z.object({}).strict().parse(raw);
    // Lectura del puente existente, con permisos del usuario autenticado.
    await fabrica().sincronizar(user);
    return { ok: true };
  }
  if (id === "citas") {
    registrarCita(user, raw);
    return { ok: true };
  }
  if (id === "cuenta") {
    const data = z
      .object({
        accion: z.enum(["conectar", "revocar"]),
        businessConfirmada: z.boolean().default(false),
      })
      .strict()
      .parse(raw);
    if (data.accion === "conectar")
      await conectarCuenta(user, action, undefined, data.businessConfirmada);
    else revocarCuenta(user, action);
    return { ok: true };
  }
  if (id === "pieza") {
    const data = z
      .object({
        accion: z.enum(["enviar", "aprobar", "cambios", "editar"]),
        revision: z.number().int().positive(),
        datos: piezaSchema.optional(),
      })
      .strict()
      .parse(raw);
    if (data.accion === "enviar")
      await enviarRevision(user, action, data.revision);
    else if (data.accion === "editar") {
      const { m } = obtenerPieza(user, action);
      return guardarPieza(user, m.id, data.datos, action, data.revision);
    } else decidirPieza(user, action, data.revision, data.accion === "aprobar");
    return { ok: true };
  }
  if (action === "cuentas") return agregarCuenta(user, id, raw);
  if (action === "competencia")
    return actualizarCompetenciaMarca(obtenerMarca(user, id));
  if (action === "estudio") return estudiarMarca(user, id);
  if (action === "piezas") return guardarPieza(user, id, raw);
  if (action === "texto") {
    const { tema } = z.object({ tema: z.string() }).strict().parse(raw);
    const m = obtenerMarca(user, id);
    const competencia = await actualizarCompetenciaMarca(m);
    obtenerMarca(user, id);
    if (
      process.env.COOPER_CHAT !== "simulada" &&
      process.env.COOPER_DEMO !== "1" &&
      !competenciaVigente(competencia)
    )
      throw new ErrorHttp(
        409,
        "Completa la investigación en Competencia antes de proponer una idea.",
      );
    return proponerTexto(m, tema, undefined, competencia);
  }
  if (!action) return guardarMarca(user, raw, id);
  throw new ErrorHttp(404, "Acción no disponible.");
}
