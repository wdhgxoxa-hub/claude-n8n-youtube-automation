import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/db";
import {
  channels,
  videos,
  marcas,
  cuentasMarca,
  piezasMarca,
  users,
  type User,
} from "@/db/schema";
import {
  leerLecciones,
  leerObservabilidad,
  enlaceIncrustado,
} from "@/contratos/observabilidad";
import type { Resultados } from "@/contratos/resultados";

const iso = (value: number) =>
  value > 0 && Number.isFinite(value) ? new Date(value).toISOString() : null;
const huella = (value: string) =>
  createHash("sha256").update(value).digest("hex");

// Proyección de lectura: no sincroniza proveedores, publica ni genera lecciones.
// Los dos contratos de métricas se conservan sin sumarlos ni convertir unidades.
export function leerResultados(user: User): Resultados {
  const resultado: Resultados = {
    ambitos: [],
    publicaciones: [],
    aprendizajes: [],
    incidencias: [],
  };
  const canales = db()
    .select({
      id: channels.id,
      nombre: channels.name,
      ownerId: channels.ownerId,
      learning: channels.learning,
      propietario: users.name,
    })
    .from(channels)
    .innerJoin(users, eq(users.id, channels.ownerId))
    .where(user.role === "admin" ? undefined : eq(channels.ownerId, user.id))
    .all();
  const propios = db()
    .select({
      id: videos.id,
      titulo: videos.title,
      channelId: videos.channelId,
      observability: videos.observability,
    })
    .from(videos)
    .innerJoin(
      channels,
      and(
        eq(channels.id, videos.channelId),
        eq(channels.ownerId, videos.ownerId),
      ),
    )
    .where(user.role === "admin" ? undefined : eq(videos.ownerId, user.id))
    .all();
  for (const c of canales) {
    const ambitoId = `video:${c.id}`;
    resultado.ambitos.push({
      id: ambitoId,
      tipo: "video",
      nombre: c.nombre,
      ownerId: c.ownerId,
      propietario: c.propietario,
    });
    const ids = new Set(
      propios.filter((v) => v.channelId === c.id).map((v) => v.id),
    );
    const vistas = new Set<string>();
    for (const [indice, leccion] of leerLecciones(c.learning).entries()) {
      const id = leccion.id || `sin-id:${indice}`;
      if (vistas.has(id)) continue;
      vistas.add(id);
      const l = {
        ...leccion,
        origenes: leccion.origenes?.filter((o) => ids.has(o.videoId)),
        aplicaciones: leccion.aplicaciones?.filter((a) => ids.has(a.videoId)),
      };
      resultado.aprendizajes.push({
        id: `${ambitoId}:${id}`,
        tipo: "video",
        ambitoId,
        titulo: l.resumen,
        href: `/canales/${encodeURIComponent(c.id)}`,
        fecha: l.fecha,
        redes: [...new Set(l.origenes?.map((o) => o.red.toLowerCase()) ?? [])],
        simulada:
          process.env.COOPER_DEMO === "1" ||
          (process.env.COOPER_FABRICA ?? "simulada") === "simulada",
        leccion: l,
      });
    }
  }
  for (const v of propios) {
    const base = {
      ambitoId: `video:${v.channelId}`,
      titulo: v.titulo,
      href: `/videos/${encodeURIComponent(v.id)}`,
      simulada:
        process.env.COOPER_DEMO === "1" ||
        (process.env.COOPER_FABRICA ?? "simulada") === "simulada",
    };
    const observabilidad = leerObservabilidad(v.observability);
    for (const [indice, p] of observabilidad.publicaciones.entries()) {
      const id = p.id || `sin-id:${indice}`;
      const publicacion = {
        ...p,
        historial: [...p.historial].sort(
          (a, b) => Date.parse(a.fecha) - Date.parse(b.fecha),
        ),
      };
      resultado.publicaciones.push({
        ...base,
        id: `video:${v.id}:${p.red}:${id}`,
        tipo: "video",
        fecha: p.fecha,
        redes: [p.red.toLowerCase()],
        publicacion,
        identidad: huella(
          (p.url && (enlaceIncrustado(p.url) ?? p.url)) || `${v.id}:${id}`,
        ),
      });
    }
    for (const i of observabilidad.incidencias)
      resultado.incidencias.push({
        ...base,
        id: `video:${v.id}:${i.id}`,
        tipo: "video",
        fecha: i.fecha,
        redes: [
          ...new Set(
            observabilidad.publicaciones.map((p) => p.red.toLowerCase()),
          ),
        ],
        incidencia: i,
      });
  }
  const visibles = db()
    .select({
      id: marcas.id,
      nombre: marcas.nombre,
      ownerId: marcas.ownerId,
      propietario: users.name,
      estudio: marcas.estudio,
    })
    .from(marcas)
    .innerJoin(users, eq(users.id, marcas.ownerId))
    .where(user.role === "admin" ? undefined : eq(marcas.ownerId, user.id))
    .all();
  const piezas = db()
    .select({
      p: piezasMarca,
      cuenta: {
        alias: cuentasMarca.alias,
        red: cuentasMarca.red,
        remoto: cuentasMarca.remoto,
        simulada: cuentasMarca.simulada,
      },
    })
    .from(piezasMarca)
    .innerJoin(marcas, eq(marcas.id, piezasMarca.marcaId))
    .innerJoin(
      cuentasMarca,
      and(
        eq(cuentasMarca.id, piezasMarca.cuentaId),
        eq(cuentasMarca.marcaId, marcas.id),
      ),
    )
    .where(user.role === "admin" ? undefined : eq(marcas.ownerId, user.id))
    .all();
  for (const m of visibles) {
    const ambitoId = `marca:${m.id}`;
    resultado.ambitos.push({
      id: ambitoId,
      tipo: "marca",
      nombre: m.nombre,
      ownerId: m.ownerId,
      propietario: m.propietario,
    });
    if (m.estudio)
      resultado.aprendizajes.push({
        id: `${ambitoId}:estudio`,
        tipo: "marca",
        clase: "estudio",
        ambitoId,
        titulo: "Estudio de la marca",
        href: `/marcas?marca=${encodeURIComponent(m.id)}&seccion=aprendizaje`,
        fecha: iso(m.estudio.actualizado),
        redes: [],
        simulada:
          process.env.COOPER_DEMO === "1" ||
          process.env.COOPER_MARCAS !== "real",
        resumen: m.estudio.evidencia,
        aviso: "",
        metricas: null,
      });
  }
  for (const { p, cuenta: c } of piezas) {
    const base = {
      ambitoId: `marca:${p.marcaId}`,
      titulo: p.datos.titulo,
      redes: [c.red],
      simulada: c.simulada,
    };
    const origen = `/marcas?pieza=${encodeURIComponent(p.id)}`;
    if (p.estado === "publicada")
      resultado.publicaciones.push({
        ...base,
        id: `marca:${p.id}`,
        tipo: "marca",
        href: `${origen}&seccion=publicados#pieza-${encodeURIComponent(p.id)}`,
        fecha: null,
        metricas: p.metricas,
        formato: p.datos.formato,
        cuenta: c.alias,
        identidad: huella(
          p.remoto ? JSON.stringify([c.remoto, p.remoto]) : p.id,
        ),
      });
    if (p.aviso || p.metricas)
      resultado.aprendizajes.push({
        ...base,
        id: `marca:${p.id}`,
        tipo: "marca",
        clase: "resultado",
        href: `${origen}&seccion=aprendizaje#aprendizaje-${encodeURIComponent(p.id)}`,
        fecha: iso(p.aviso ? p.updatedAt : (p.metricas?.capturadas ?? 0)),
        resumen:
          "Resultado observado de la pieza; compáralo con el mismo formato y red antes de cambiar el calendario.",
        aviso: p.aviso,
        metricas: p.metricas,
      });
  }
  return resultado;
}
