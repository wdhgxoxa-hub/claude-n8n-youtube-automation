import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, type Marca } from "@/db/schema";
import {
  competenciaSchema,
  type Competencia,
} from "@/contratos/competencia-schema";
import {
  competenciaVacia,
  normalizarCompetencia,
  promptCompetencia,
  proyectarCompetencia,
} from "@/contratos/competencia.mjs";
import { cuentaActiva } from "./mensajeria/cuentas";
export function leerCompetenciaMarca(m: Marca): Competencia {
  const filas = db()
    .select()
    .from(events)
    .where(
      and(eq(events.ownerId, m.ownerId), eq(events.type, "competencia_marca")),
    )
    .orderBy(desc(events.createdAt))
    .limit(500)
    .all();
  for (const f of filas) {
    try {
      const p = JSON.parse(f.payload);
      if (p.marcaId === m.id)
        return competenciaSchema.parse(
          proyectarCompetencia(p.competencia, m.nombre),
        );
    } catch {
      /* Una fila inválida no convierte datos en evidencia. */
    }
  }
  return competenciaVacia(m.nombre);
}
// Comparte el transporte restringido de ChatCodexLocal, pero usa el contrato /texto
// que acredita búsqueda real. No usa proveedorChat ni respaldo API de pago.
export async function investigarCompetencia(
  nombre: string,
  nicho: string,
  transporte: typeof fetch = fetch,
): Promise<Competencia> {
  try {
    const url = new URL(
      process.env.PUENTE_CODEX_URL || "http://127.0.0.1:8789",
    );
    if (
      url.protocol !== "http:" ||
      !["127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error("Origen inválido");
    const token = process.env.PUENTE_CODEX_TOKEN;
    if (!token || token.length < 32) throw new Error("Conexión ausente");
    const r = await transporte(new URL("/v1/texto", url), {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tarea: "radar",
        buscar_web: true,
        prompt: promptCompetencia({
          nombre,
          nicho,
          redes: "youtube,tiktok,instagram,facebook",
        }),
      }),
      signal: AbortSignal.timeout(190000),
    });
    if (!r.ok || !r.body) {
      await r.body?.cancel();
      throw new Error("Sin respuesta");
    }
    const reader = r.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 128 * 1024) throw new Error("Respuesta demasiado grande");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const respuesta = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const raw = JSON.parse(
      (respuesta.output ?? [])
        .filter((x: { type: string }) => x.type === "message")
        .flatMap(
          (x: { content?: { type: string; text?: string }[] }) =>
            x.content ?? [],
        )
        .filter((x: { type: string }) => x.type === "output_text")
        .map((x: { text: string }) => x.text)
        .join("\n"),
    );
    return competenciaSchema.parse(
      normalizarCompetencia(raw, respuesta, nombre),
    );
  } catch {
    return normalizarCompetencia(null, null, nombre);
  }
}
const enCurso = new Map<string, Promise<Competencia>>();
export async function actualizarCompetenciaMarca(
  m: Marca,
): Promise<Competencia> {
  const existente = enCurso.get(m.id);
  if (existente) return existente;
  const trabajo = (async () => {
    const competencia =
      process.env.COOPER_DEMO === "1" || process.env.COOPER_CHAT === "simulada"
        ? competenciaVacia(
            m.nombre,
            "Modo simulado: no se investigaron cuentas reales.",
          )
        : await investigarCompetencia(m.nombre, `${m.rubro}. ${m.guia.tono}`);
    cuentaActiva(m.ownerId);
    db()
      .insert(events)
      .values({
        id: randomUUID(),
        ownerId: m.ownerId,
        type: "competencia_marca",
        payload: JSON.stringify({ marcaId: m.id, competencia }),
        createdAt: Date.now(),
      })
      .run();
    return competencia;
  })();
  enCurso.set(m.id, trabajo);
  try {
    return await trabajo;
  } finally {
    enCurso.delete(m.id);
  }
}
