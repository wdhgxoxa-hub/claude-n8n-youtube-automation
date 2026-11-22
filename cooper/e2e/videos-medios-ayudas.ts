import { expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import type { Estado } from "../src/servicios/datos";
import type { VideoMedios } from "../src/contratos/video-medios";

export const salida = "../evidencias-diseno";
export const origen = "/__ensayo-medios";
export const poster = `${origen}/medios-poster.jpg`;
const preview = `${origen}/medios-preview.mp4`;
let mp4: Buffer;
let jpg: Buffer;

export function crearMediosDeEnsayo() {
  mkdirSync(salida, { recursive: true });
  mkdirSync(".cache/diseno-medios", { recursive: true });
  const archivo = ".cache/diseno-medios/preview-sintetica.mp4";
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=s=320x480:r=15:d=5",
    "-an",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    "-b:v",
    "400k",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    archivo,
  ]);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    archivo,
    "-frames:v",
    "1",
    ".cache/diseno-medios/poster-sintetico.jpg",
  ]);
  mp4 = readFileSync(archivo);
  jpg = readFileSync(".cache/diseno-medios/poster-sintetico.jpg");
  expect(mp4.byteLength).toBeLessThanOrEqual(600000);
}

export async function preparar(page: Page, retenerMedios = false) {
  const r = await page.request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
    {
      data: {
        email: "admin@example.test",
        secret: process.env.COOPER_E2E_SECRET,
        montaje: "crear",
        resultados: true,
      },
    },
  );
  expect(r.ok()).toBe(true);
  const estado: Estado = await (await page.request.get("/api/estado")).json();
  const video = estado.videos.find((v) => v.id.startsWith("montaje-e2e-"))!;
  expect(video).toBeDefined();
  const medio: VideoMedios = {
    version: 1,
    videoId: video.id,
    estado: "listo",
    poster: { url: poster, origen: "render", ancho: 320, alto: 480 },
    preview: {
      url: preview,
      mime: "video/mp4",
      duracion: 5,
      bytes: mp4.byteLength,
    },
    tinte: "#997755",
    origenDimensiones: "video",
    ancho: 320,
    alto: 480,
    relacionAspecto: 2 / 3,
    actualizadoEn: Date.now(),
  };
  video.medios = {
    ...medio,
    estado: "pendiente",
    poster: null,
    preview: null,
    origenDimensiones: "reserva",
  };
  video.observabilidad.montaje = `${origen}/medios-completo.mp4`;
  video.observabilidad.miniatura = poster;
  video.observabilidad.publicaciones = [];
  estado.videos = [video];
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) errores.push(m.text());
  });
  let vistasPrevias = 0;
  let completos = 0;
  await page.route(`**${origen}/**`, (route) => {
    if (new URL(route.request().url()).pathname === preview) vistasPrevias++;
    if (route.request().url().endsWith("completo.mp4")) completos++;
    return route.fulfill({
      contentType: route.request().url().endsWith(".jpg")
        ? "image/jpeg"
        : "video/mp4",
      body: route.request().url().endsWith(".jpg") ? jpg : mp4,
    });
  });
  await page.route("**/api/estado", (route) => route.fulfill({ json: estado }));
  await page.route("**/api/eventos", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `event: estado\ndata: ${JSON.stringify(estado)}\n\n`,
    }),
  );
  let liberarMedios: () => void = () => {};
  const permiso = new Promise<void>((resolve) => {
    liberarMedios = resolve;
  });
  if (!retenerMedios) liberarMedios();
  await page.route(`**/api/videos/${video.id}/medios`, async (route) => {
    await permiso;
    return route.fulfill({ json: medio });
  });
  return {
    estado,
    video,
    medio,
    errores,
    liberarMedios,
    peticiones: () => ({ vistasPrevias, completos }),
  };
}
