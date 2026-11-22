import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  channels,
  users,
  videoMedios,
  videos,
  montajesFabrica,
  type User,
} from "@/db/schema";
import {
  sinObservabilidad,
  type Observabilidad,
} from "@/contratos/observabilidad";
import {
  leerVideoMedios,
  origenPermitido,
  servirVideoMedio,
  sincronizarVideoMedios,
} from "@/servicios/video-medios";
import {
  derivarMp4,
  MAX_PREVIEW_BYTES,
  normalizarTinte,
} from "@/servicios/video-medios-ffmpeg";
import { revisionMontaje } from "@/servicios/marcas/montajes";

let mp4: Buffer, jpg: Buffer, directory: string;
beforeAll(async () => {
  directory = mkdtempSync(".cache/video-medios-");
  const input = join(directory, "original.mp4");
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=180x320:rate=12:duration=6",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=6",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    input,
  ]);
  mp4 = readFileSync(input);
  jpg = await sharp({
    create: { width: 480, height: 360, channels: 3, background: "#f02010" },
  })
    .jpeg()
    .toBuffer();
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));
function crear(observabilidad: Partial<Observabilidad> = {}) {
  const id = randomUUID();
  const user = db()
    .insert(users)
    .values({ id, email: `${id}@example.test`, name: "Creadora" })
    .returning()
    .get();
  db()
    .insert(channels)
    .values({
      id,
      ownerId: id,
      name: "Ciencia",
      niche: "Ciencia",
      createdAt: 1,
    })
    .run();
  const video = db()
    .insert(videos)
    .values({
      id,
      ownerId: id,
      channelId: id,
      title: "Una historia <propia>",
      stage: 11,
      script: "Guion",
      observability: JSON.stringify({
        ...sinObservabilidad,
        ...observabilidad,
      }),
      createdAt: 1,
      updatedAt: 1,
    })
    .returning()
    .get();
  return { user, video };
}
const publicacion = (id = "youtube-1") => ({
  id,
  red: "youtube",
  url: "https://www.youtube.com/watch?v=abcdefghijk",
  miniatura: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
  historial: [],
  fecha: null,
});
const respuestaJpg = () =>
  new Response(new Uint8Array(jpg), {
    headers: { "content-type": "image/jpeg" },
  });

it("migra una caché aditiva, tipográfica y privada sin medio; escapa títulos y mantiene tinte de canal", async () => {
  const { user, video } = crear();
  const meta = leerVideoMedios(user, video.id);
  expect(meta).toMatchObject({
    estado: "sin_medio",
    ancho: 1600,
    alto: 900,
    preview: null,
    poster: { origen: "tipografico" },
  });
  const response = servirVideoMedio(
    user,
    video.id,
    "",
    "poster",
    new Request("http://localhost/"),
  );
  expect(response.headers.get("cache-control")).toBe(
    "private, max-age=0, must-revalidate",
  );
  expect(await response.text()).toContain("&lt;propia&gt;");
  expect(normalizarTinte(255, 0, 0)).toBe("hsl(0 45% 50%)");
  expect(normalizarTinte(0, 0, 0)).toBe("hsl(0 0% 45%)");
  const row = db()
    .select()
    .from(videoMedios)
    .where(eq(videoMedios.videoId, video.id))
    .get();
  expect(row?.tinte).toBe(meta.tinte);
  db().delete(videos).where(eq(videos.id, video.id)).run();
  expect(
    db()
      .select()
      .from(videoMedios)
      .where(eq(videoMedios.videoId, video.id))
      .all(),
  ).toHaveLength(0);
});

it("FFmpeg extrae fotograma y 5 segundos reales sin audio bajo 600 KB, con dimensión vertical", async () => {
  const result = await derivarMp4(mp4);
  expect(result).toMatchObject({ ancho: 180, alto: 320, duracion: 5 });
  expect(result.preview.length).toBeLessThanOrEqual(MAX_PREVIEW_BYTES);
  expect(result.poster.ancho / result.poster.alto).toBeCloseTo(9 / 16, 2);
  const file = join(directory, "derivado.mp4");
  writeFileSync(file, result.preview);
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type:format=duration",
        "-of",
        "json",
        file,
      ],
      { encoding: "utf8" },
    ),
  );
  expect(probe.streams).toEqual([{ codec_type: "video" }]);
  expect(Number(probe.format.duration)).toBeGreaterThanOrEqual(4);
  expect(Number(probe.format.duration)).toBeLessThanOrEqual(6);
});

it("reutiliza el MP4 aprobado local y conserva las dimensiones del render separadas de su póster oficial", async () => {
  const p = {
    ...publicacion(),
    montaje: "https://cdn.creatomate.com/renders/local.mp4",
  };
  const { user, video } = crear({ montaje: p.montaje, publicaciones: [p] });
  db()
    .insert(montajesFabrica)
    .values({
      id: randomUUID(),
      ownerId: user.id,
      videoId: video.id,
      revision: revisionMontaje(video),
      sha256: "ficticia",
      size: mp4.length,
      data: mp4.toString("base64"),
      createdAt: 1,
    })
    .run();
  const http = vi.fn(async () => respuestaJpg());
  await sincronizarVideoMedios(user, video.id, p.id, http);
  const meta = leerVideoMedios(user, video.id, p.id);
  expect(meta).toMatchObject({
    estado: "listo",
    origenDimensiones: "video",
    ancho: 180,
    alto: 320,
    poster: { origen: "youtube", ancho: 480, alto: 360 },
    preview: { duracion: 5 },
  });
  expect(http).toHaveBeenCalledTimes(1);
  expect(meta.poster?.url).toContain("publicacion=youtube-1");
  expect(JSON.stringify(meta)).not.toContain("cdn.creatomate");
  expect(JSON.stringify(meta)).not.toContain("base64");
});

it("deduplica peticiones y aprovecha la miniatura oficial de un publicado también en la fábrica", async () => {
  const { user, video } = crear({ publicaciones: [publicacion()] });
  const http = vi.fn(async () => respuestaJpg());
  await Promise.all(
    Array.from({ length: 8 }, () =>
      sincronizarVideoMedios(user, video.id, "", http),
    ),
  );
  expect(http).toHaveBeenCalledTimes(1);
  const meta = leerVideoMedios(user, video.id);
  expect(meta).toMatchObject({
    estado: "listo",
    poster: { origen: "youtube" },
    preview: null,
    origenDimensiones: "poster",
  });
  await sincronizarVideoMedios(user, video.id, "", http);
  expect(http).toHaveBeenCalledTimes(1);
});

it("recupera miniatura oficial desde oEmbed acotado sin usar HTML ni OAuth", async () => {
  const p = { ...publicacion(), miniatura: "" };
  const { user, video } = crear({ publicaciones: [p] });
  const http = vi.fn(async (url: string | URL | Request) =>
    String(url).startsWith("https://www.youtube.com/oembed?")
      ? Response.json({
          thumbnail_url: publicacion().miniatura,
          html: "<script>nunca</script>",
        })
      : respuestaJpg(),
  );
  await sincronizarVideoMedios(user, video.id, p.id, http);
  expect(http).toHaveBeenCalledTimes(2);
  expect(leerVideoMedios(user, video.id, p.id).poster?.origen).toBe("youtube");
  expect(http.mock.calls[0][0]).toContain(
    "url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabcdefghijk",
  );
});

it("no fabrica un póster para un medio caído, bloquea SSRF y limita reintentos", async () => {
  const { user, video } = crear({ montaje: "https://127.0.0.1/video.mp4" });
  const http = vi.fn(async () => {
    throw new Error("URL privada ficticia");
  });
  await sincronizarVideoMedios(user, video.id, "", http);
  expect(leerVideoMedios(user, video.id)).toMatchObject({
    estado: "no_disponible",
    poster: null,
    preview: null,
  });
  await sincronizarVideoMedios(user, video.id, "", http);
  expect(http).not.toHaveBeenCalled();
  for (const url of [
    "https://cdn.creatomate.com.evil.test/renders/a.mp4",
    "http://cdn.creatomate.com/renders/a.mp4",
    "https://user:pass@cdn.creatomate.com/renders/a.mp4",
    "https://cdn.creatomate.com:444/renders/a.mp4",
    "file:///etc/passwd",
    "https://169.254.169.254/a.mp4",
  ])
    expect(() => origenPermitido(url, "mp4")).toThrow();
});

it("rechaza miniatura YouTube de otro video incluso desde una observabilidad heredada", async () => {
  const p = {
    ...publicacion(),
    miniatura: "https://i.ytimg.com/vi/xxxxxxxxxxx/hqdefault.jpg",
  };
  const { user, video } = crear({ publicaciones: [p] });
  const http = vi.fn(async () => Response.json({ thumbnail_url: p.miniatura }));
  await sincronizarVideoMedios(user, video.id, p.id, http);
  expect(leerVideoMedios(user, video.id, p.id).poster).toBeNull();
  expect(http).toHaveBeenCalledTimes(1);
});

it("renueva la misma revisión sin retirar el póster mientras descarga ni tras un fallo", async () => {
  const { user, video } = crear({
    miniatura: "https://cdn.creatomate.com/renders/a.jpg",
  });
  await sincronizarVideoMedios(user, video.id, "", async () => respuestaJpg());
  const anterior = leerVideoMedios(user, video.id);
  db()
    .update(videoMedios)
    .set({ reintentarEn: 0, actualizadoEn: 1 })
    .where(eq(videoMedios.videoId, video.id))
    .run();
  let liberar!: () => void;
  const bloqueo = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  const trabajo = sincronizarVideoMedios(user, video.id, "", async () => {
    await bloqueo;
    throw new Error("Caducó");
  });
  expect(leerVideoMedios(user, video.id).poster).toEqual(anterior.poster);
  expect(
    servirVideoMedio(
      user,
      video.id,
      "",
      "poster",
      new Request("http://localhost/"),
    ).status,
  ).toBe(200);
  liberar();
  await trabajo;
  expect(leerVideoMedios(user, video.id).poster).toEqual(anterior.poster);
});

it("un cambio durante la descarga no guarda ni expone la revisión antigua", async () => {
  const { user, video } = crear({
    miniatura: "https://cdn.creatomate.com/renders/a.jpg",
  });
  let liberar!: () => void;
  const bloqueo = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  const trabajo = sincronizarVideoMedios(user, video.id, "", async () => {
    await bloqueo;
    return respuestaJpg();
  });
  db()
    .update(videos)
    .set({
      observability: JSON.stringify({
        ...sinObservabilidad,
        miniatura: "https://cdn.creatomate.com/renders/b.jpg",
      }),
    })
    .where(eq(videos.id, video.id))
    .run();
  liberar();
  await trabajo;
  expect(leerVideoMedios(user, video.id)).toMatchObject({
    estado: "pendiente",
    poster: null,
  });
  await sincronizarVideoMedios(user, video.id, "", async () => respuestaJpg());
  expect(leerVideoMedios(user, video.id).estado).toBe("listo");
});

it("revalida dueño antes de devolver caché/304 y permite al administrador", async () => {
  const { user, video } = crear();
  const response = servirVideoMedio(
    user,
    video.id,
    "",
    "poster",
    new Request("http://localhost/"),
  );
  const request = new Request("http://localhost/", {
    headers: { "if-none-match": response.headers.get("etag")! },
  });
  expect(servirVideoMedio(user, video.id, "", "poster", request).status).toBe(
    304,
  );
  const ajeno = crear().user;
  expect(() =>
    servirVideoMedio(ajeno, video.id, "", "poster", request),
  ).toThrow("No encontramos ese recurso");
  await expect(sincronizarVideoMedios(ajeno, video.id)).rejects.toThrow(
    "No encontramos ese recurso",
  );
  expect(
    servirVideoMedio(
      { ...ajeno, role: "admin" } as User,
      video.id,
      "",
      "poster",
      request,
    ).status,
  ).toBe(304);
});

it("rechaza descargas sobredimensionadas antes de decodificar y respeta redirect:error", async () => {
  const { user, video } = crear({
    miniatura: "https://cdn.creatomate.com/renders/a.jpg",
  });
  const http = vi.fn(
    async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe("error");
      return new Response(new Uint8Array(jpg), {
        headers: {
          "content-type": "image/jpeg",
          "content-length": String(9 * 1024 * 1024),
        },
      });
    },
  );
  await sincronizarVideoMedios(user, video.id, "", http);
  expect(leerVideoMedios(user, video.id).poster).toBeNull();
});

it("acepta únicamente el bucket B2 público comprobado y prepara un clip real de escena", async () => {
  const url =
    "https://f002.backblazeb2.com/file/creatomate-c8xg3hsxdu/ficticio.mp4";
  expect(origenPermitido(url, "mp4")).toBe(url);
  for (const raw of [
    url.replace("creatomate-c8xg3hsxdu", "otro-bucket"),
    url + "?token=ficticio",
    url.replace("f002", "f003"),
  ])
    expect(() => origenPermitido(raw, "mp4")).toThrow();
  const { user, video } = crear({
    escenas: [{ id: "escena", orden: 0, imagen: "", clip: url, voz: "" }],
  });
  await sincronizarVideoMedios(
    user,
    video.id,
    "",
    async () =>
      new Response(new Uint8Array(mp4), {
        headers: { "content-type": "video/mp4" },
      }),
  );
  expect(leerVideoMedios(user, video.id)).toMatchObject({
    estado: "listo",
    origenDimensiones: "video",
    poster: { origen: "escena" },
    preview: { duracion: 5 },
  });
});

it("simulación no descarga medios remotos automáticamente", async () => {
  const { user, video } = crear({ publicaciones: [publicacion()] });
  await sincronizarVideoMedios(user, video.id);
  expect(fetch).not.toHaveBeenCalled();
  expect(leerVideoMedios(user, video.id)).toMatchObject({
    estado: "no_disponible",
    poster: null,
  });
});

it("una dimensión aislada no se mezcla con la reserva y su corrección cambia revisión", async () => {
  const p = { ...publicacion(), alto: 1920 };
  const { user, video } = crear({ publicaciones: [p] });
  expect(leerVideoMedios(user, video.id, p.id)).toMatchObject({
    ancho: 1600,
    alto: 900,
    origenDimensiones: "reserva",
  });
  await sincronizarVideoMedios(user, video.id, p.id, async () =>
    respuestaJpg(),
  );
  expect(leerVideoMedios(user, video.id, p.id)).toMatchObject({
    ancho: 480,
    alto: 360,
    origenDimensiones: "poster",
  });
  db()
    .update(videos)
    .set({
      observability: JSON.stringify({
        ...sinObservabilidad,
        publicaciones: [{ ...p, ancho: 1080 }],
      }),
    })
    .where(eq(videos.id, video.id))
    .run();
  expect(leerVideoMedios(user, video.id, p.id)).toMatchObject({
    estado: "pendiente",
    ancho: 1080,
    alto: 1920,
    origenDimensiones: "video",
  });
});
