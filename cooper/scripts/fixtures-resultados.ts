// Datos ficticios compartidos por Vitest y el emisor E2E aislado; nunca por src/.
import { db } from "../src/db";
import {
  channels,
  videos,
  marcas,
  cuentasMarca,
  piezasMarca,
  type User,
} from "../src/db/schema";
import { guiaSchema, piezaSchema } from "../src/servicios/marcas/tipos";
import { sinObservabilidad } from "../src/contratos/observabilidad";
import { eq } from "drizzle-orm";
export function prepararResultados(user: User) {
  const canal = `${user.id}-canal`,
    marca = `${user.id}-marca`,
    cuenta = `${user.id}-cuenta`,
    video = `${user.id}-video`;
  if (db().select().from(channels).where(eq(channels.id, canal)).get())
    return { canal, marca, cuenta, video };
  const fecha = "2026-11-21T03:30:00Z",
    now = Date.parse(fecha);
  const leccion = {
    id: "misma-leccion",
    fecha,
    resumen: "Abrir con una pregunta verificable",
    ganchos: [],
    temas: [],
    causa: "Pregunta concreta",
    correccion: "Mostrar la pregunta al inicio",
    nivel: "hipotesis",
    origenes: [
      {
        videoId: video,
        red: "youtube",
        ventana: "24h",
        fecha,
        metrica: "retencion",
        valor: 1.25,
        demoraHoras: 0,
      },
    ],
    aplicaciones: [{ videoId: video, cambio: "Apertura revisada" }],
  };
  db()
    .insert(channels)
    .values({
      id: canal,
      ownerId: user.id,
      name: "Horizonte",
      niche: "Ensayo",
      createdAt: now,
      learning: JSON.stringify([leccion, leccion]),
    })
    .run();
  const publicacion = {
    id: "original",
    red: "youtube",
    fecha,
    url: "https://www.youtube.com/watch?v=abcdefghijk",
    miniatura: "",
    historial: [
      {
        fecha: "2026-11-21T06:00:00Z",
        vistas: 100,
        meGusta: 3,
        comentarios: 0,
        retencion: 1.25,
        seguidoresGanados: null,
        ventana: "24h",
        demoraHoras: 0,
        curvaFuente: "youtube_intervalos",
        curvaRetencion: [{ segundo: 1, porcentaje: 1.25 }],
      },
      { fecha, vistas: 10, meGusta: null, comentarios: null, retencion: null },
    ],
  };
  db()
    .insert(videos)
    .values({
      id: video,
      ownerId: user.id,
      channelId: canal,
      title: "Una misma historia",
      script: "Guion ficticio",
      stage: 11,
      updatedAt: now,
      createdAt: now,
      observability: JSON.stringify({
        ...sinObservabilidad,
        publicaciones: [
          publicacion,
          {
            ...publicacion,
            id: "duplicada",
            url: "https://youtu.be/abcdefghijk",
          },
          {
            ...publicacion,
            id: "sin-metricas",
            red: "instagram",
            url: "https://www.instagram.com/p/ensayo/",
            fecha: null,
            historial: [],
          },
        ],
      }),
    })
    .run();
  const guia = guiaSchema.parse({});
  db()
    .insert(marcas)
    .values({
      id: marca,
      ownerId: user.id,
      nombre: "Horizonte",
      rubro: "general",
      zona: "America/Lima",
      guia,
      createdAt: now,
      estudio: {
        muestra: 0,
        visuales: 0,
        estilo: "Ensayo",
        frecuencia: 3,
        pilares: [],
        horas: [18],
        evidencia: "Sin evidencia suficiente",
        actualizado: now,
        historial: [],
      },
    })
    .run();
  db()
    .insert(cuentasMarca)
    .values({
      id: cuenta,
      marcaId: marca,
      red: "instagram",
      alias: "@horizonte",
      remoto: user.id,
      estado: "conectada",
      simulada: true,
    })
    .run();
  for (const [id, remoto, metricas, estado] of [
    [
      "original",
      "misma-publicacion",
      { vistas: null, interacciones: 5, alcance: 50, capturadas: now },
      "publicada",
    ],
    [
      "duplicada",
      "misma-publicacion",
      { vistas: 0, interacciones: null, alcance: null, capturadas: now },
      "publicada",
    ],
    ["sin-metricas", "otra-publicacion", null, "publicada"],
    ["no-publicada", "", null, "revision"],
  ] as const)
    db()
      .insert(piezasMarca)
      .values({
        id: `${user.id}-${id}`,
        marcaId: marca,
        cuentaId: cuenta,
        datos: piezaSchema.parse({
          cuentaId: cuenta,
          titulo: "Una misma historia",
          texto: "Texto ficticio",
          formato: "imagen",
          plantilla: "libre",
        }),
        guia,
        estado,
        programada: now,
        remoto,
        metricas,
        createdAt: now,
        updatedAt: now,
        aviso: estado === "revision" ? "Pendiente de revisión" : "",
      })
      .run();
  return { canal, marca, cuenta, video };
}
