import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { estado } from "@/servicios/datos";
import { aplicarEstado } from "@/servicios/puente";
import { estadoRemotoSchema } from "@/contratos/puente";
import {
  enlaceIncrustado,
  medicionSchema,
  observabilidadSchema,
  publicacionSchema,
  sinObservabilidad,
} from "@/contratos/observabilidad";
it("reconoce solo reproductores oficiales y rechaza URLs ejecutables o credenciales", () => {
  expect(enlaceIncrustado("https://youtube.com/watch?v=abcdefghijk")).toBe(
    "https://www.youtube.com/embed/abcdefghijk",
  );
  expect(
    enlaceIncrustado("https://www.tiktok.com/@canal/video/123456789"),
  ).toBe("https://www.tiktok.com/player/v1/123456789?autoplay=0");
  for (const url of [
    "javascript:alert(1)",
    "https://youtube.com.evil.test/watch?v=abcdefghijk",
    "https://user:pass@youtube.com/watch?v=abcdefghijk",
  ])
    expect(enlaceIncrustado(url)).toBeNull();
  expect(
    observabilidadSchema.safeParse({
      ...sinObservabilidad,
      montaje: "http://video.test/a.mp4",
    }).success,
  ).toBe(false);
});
it("conserva el montaje por publicación sin romper estados anteriores y valida sus dimensiones", () => {
  const anterior = {
    id: "publicacion-1",
    red: "youtube",
    url: "https://youtube.com/watch?v=abcdefghijk",
    fecha: null,
    miniatura: "",
    historial: [],
  };
  expect(publicacionSchema.parse(anterior).montaje).toBeUndefined();
  expect(
    publicacionSchema.parse({
      ...anterior,
      montaje: "https://cdn.example.test/corte.mp4",
      ancho: 1080,
      alto: 1920,
    }),
  ).toMatchObject({
    montaje: "https://cdn.example.test/corte.mp4",
    ancho: 1080,
    alto: 1920,
  });
  for (const cambio of [
    { montaje: "https://user:pass@cdn.example.test/corte.mp4" },
    { montaje: "file:///privado/corte.mp4" },
    { ancho: 0 },
    { alto: 1920.5 },
    { ancho: 16385 },
  ])
    expect(
      publicacionSchema.safeParse({ ...anterior, ...cambio }).success,
    ).toBe(false);
});
it("sincroniza medios y métricas aunque la etapa no cambie; aísla dueños y costos", () => {
  const id = randomUUID(),
    otro = randomUUID();
  const user = db()
    .insert(users)
    .values({ id, email: `${id}@example.test`, name: "Ensayo" })
    .returning()
    .get();
  const snapshot = estadoRemotoSchema.parse({
    canales: [
      {
        id,
        dueno_email: user.email,
        nombre: "Ciencia",
        nicho: "Ciencia",
        lecciones: [
          {
            id: "l",
            fecha: "2026-11-21T00:00:00Z",
            resumen: "Una pregunta concreta",
            ganchos: [],
            temas: [],
          },
        ],
      },
    ],
    videos: [
      {
        id,
        dueno_email: user.email,
        canal_id: id,
        titulo: "Video",
        stage: 11,
        script: "Guion",
        actualizado_en: 100,
        observabilidad: {
          ...sinObservabilidad,
          montaje: "https://cdn.example.test/video.mp4",
          costo_usd: 999,
        },
      },
    ],
  });
  aplicarEstado(user, snapshot);
  const dato = estado(user);
  expect(dato.videos[0].observabilidad.montaje).toContain("video.mp4");
  expect(dato.channels[0].lecciones).toHaveLength(1);
  expect(JSON.stringify(dato)).not.toContain("999");
  snapshot.videos[0].observabilidad!.miniatura =
    "https://cdn.example.test/portada.png";
  aplicarEstado(user, snapshot);
  expect(estado(user).videos[0].observabilidad.miniatura).toContain(
    "portada.png",
  );
  aplicarEstado(user, {
    canales: [
      {
        id: otro,
        dueno_email: "ajeno@example.test",
        nombre: "Privado",
        nicho: "Privado",
      },
    ],
    videos: [],
  });
  expect(estado(user).channels).toHaveLength(1);
  snapshot.videos[0].actualizado_en = 1;
  snapshot.videos[0].observabilidad!.miniatura =
    "https://cdn.example.test/vieja.png";
  aplicarEstado(user, snapshot);
  expect(estado(user).videos[0].observabilidad.miniatura).toContain(
    "portada.png",
  );
});

it("conserva repeticiones superiores a 100 % en media y curva de YouTube", () => {
  const punto = {
    fecha: "2026-11-21T00:00:00Z",
    vistas: 12,
    meGusta: 2,
    comentarios: 0,
    retencion: 1.25,
  };
  expect(medicionSchema.parse(punto).retencion).toBe(1.25);
  expect(
    medicionSchema.safeParse({
      ...punto,
      curvaFuente: "youtube_intervalos",
      curvaRetencion: [{ segundo: 1, porcentaje: 1.25 }],
    }).success,
  ).toBe(true);
});

it("sincroniza evidencia y aplicaciones con métricas opcionales sin convertir ausencias en cero", () => {
  const medicion = medicionSchema.parse({
    fecha: "2026-11-21T00:00:00Z",
    vistas: 0,
    meGusta: null,
    comentarios: null,
    retencion: null,
    seguidoresGanados: 3,
    ventana: "72h",
    demoraHoras: 2,
  });
  expect(medicion.vistas).toBe(0);
  expect(medicion.meGusta).toBeNull();
  expect(medicion.seguidoresGanados).toBe(3);
  expect(medicion.ventana).toBe("72h");
});
