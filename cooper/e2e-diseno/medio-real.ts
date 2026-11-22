import type { Page, Route } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Estado } from "../src/servicios/datos";
import type { VideoMedios } from "../src/contratos/video-medios";

type RutaInstalada = {
  patron: string | RegExp;
  resolver: (route: Route) => Promise<void>;
};
const instaladas = new WeakMap<Page, RutaInstalada[]>();

/** Retira únicamente las intercepciones de este helper, sin tocar otras fixtures. */
export async function cleanup(page: Page) {
  const rutas = instaladas.get(page) ?? [];
  instaladas.delete(page);
  for (const { patron, resolver } of rutas.reverse())
    await page.unroute(patron, resolver);
}

/**
 * Ensayo visual autenticado con dos derivados del render existente del proyecto.
 * El original completo no está disponible aquí; el MP4 servido dura cinco segundos.
 * No crea datos ni presenta el extracto como publicación. Requiere un Estado demo
 * con un video propio existente para conservar la autorización SSR del detalle.
 * Uso: const ensayo = await instalarMedioReal(page, estado); ... await ensayo.cleanup();
 */
export async function instalarMedioReal(page: Page, state: Estado) {
  const origen = new URL(page.url());
  if (
    !["http:", "https:"].includes(origen.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(origen.hostname) ||
    !state.demo
  )
    throw new Error(
      "El medio real de ensayo requiere la web demo en loopback.",
    );

  const base = state.videos.find(
    (video) =>
      video.ownerId === state.user.id &&
      state.channels.some(
        (canal) =>
          canal.id === video.channelId && canal.ownerId === state.user.id,
      ),
  );
  const canalBase = state.channels.find(
    (canal) => canal.id === base?.channelId,
  );
  if (!base || !canalBase)
    throw new Error(
      "El ensayo necesita un canal y un video propios en la base demo.",
    );

  const salida = resolve("../evidencias-diseno");
  const poster = readFileSync(resolve(salida, "b2-real-poster.webp"));
  const preview = readFileSync(resolve(salida, "b2-real-preview.mp4"));
  const hash = (buffer: Buffer) =>
    createHash("sha256").update(buffer).digest("hex");
  // Huellas comprobadas en los dos derivados existentes; jamás se sustituyen
  // por otra imagen o un video sintético si faltan los archivos autorizados.
  if (
    poster.byteLength !== 36778 ||
    hash(poster) !==
      "81ebcfe161024e23de721252f3995b88507892150b05714f6d27c2bca8349e4f" ||
    preview.byteLength !== 336834 ||
    hash(preview) !==
      "0bbef53ea911e5016929605e5351f0218d8dfb5c624d740a522474d3d18ede75"
  )
    throw new Error(
      "Los derivados no coinciden con el render real autorizado.",
    );

  const urlAsset = (tipo: "poster" | "preview") =>
    `/__ensayo-medio-real/${tipo}${tipo === "poster" ? ".webp" : ".mp4"}?video=${encodeURIComponent(base.id)}`;
  const medio: VideoMedios = {
    version: 1,
    videoId: base.id,
    estado: "listo",
    poster: {
      url: urlAsset("poster"),
      origen: "render",
      ancho: 900,
      alto: 1600,
    },
    preview: {
      url: urlAsset("preview"),
      mime: "video/mp4",
      duracion: 5,
      bytes: preview.byteLength,
    },
    tinte: "hsl(0 0% 45%)",
    ancho: 1080,
    alto: 1920,
    relacionAspecto: 9 / 16,
    origenDimensiones: "video",
    actualizadoEn: base.updatedAt,
  };
  const canal: Estado["channels"][number] = {
    ...canalBase,
    name: "Render del proyecto · Ensayo",
    niche: "Revisión local de un render existente",
    bible:
      "Ensayo visual: el medio procede del proyecto, los datos de esta vista son de prueba.",
    networks: "",
    account: "",
    goals: "Revisar el póster y el extracto sin publicar.",
    newsMode: false,
    lecciones: [],
  };
  const video: Estado["videos"][number] = {
    ...base,
    title: "Render existente · extracto de cinco segundos",
    stage: 9,
    productionState: "pausada",
    productionNotice:
      "Ensayo local de un extracto real de cinco segundos. Sin publicación.",
    script:
      "Vista de ensayo del render existente. Este extracto no acredita el guion ni reproduce el montaje completo.",
    feedback: "",
    references: "",
    scheduledAt: "",
    avatarId: "",
    voiceId: "",
    newsMode: false,
    medios: medio,
    observabilidad: {
      montaje: urlAsset("preview"),
      miniatura: "",
      escenas: [],
      publicaciones: [],
      incidencias: [],
    },
  };
  const estado: Estado = { ...state, channels: [canal], videos: [video] };
  const solicitudesExternas: string[] = [];
  const solicitudes = { poster: 0, preview: 0, metadata: 0 };

  await cleanup(page);
  const rutas: RutaInstalada[] = [];
  instaladas.set(page, rutas);
  const instalar = async (
    patron: RutaInstalada["patron"],
    resolver: RutaInstalada["resolver"],
  ) => {
    await page.route(patron, resolver);
    rutas.push({ patron, resolver });
  };
  await instalar("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origen.origin) {
      solicitudesExternas.push(url.origin);
      await route.abort("blockedbyclient");
    } else if (
      url.pathname.startsWith("/api/") &&
      !["GET", "HEAD"].includes(route.request().method())
    ) {
      await route.fulfill({
        status: 409,
        json: { error: "Este ensayo visual permite solo lecturas." },
      });
    } else {
      await route.fallback();
    }
  });
  await instalar(/\/api\/estado(?:\?|$)/, (route) =>
    route.fulfill({ json: estado }),
  );
  await instalar(/\/api\/eventos(?:\?|$)/, (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      headers: { "Cache-Control": "no-cache" },
      body: `event: estado\ndata: ${JSON.stringify(estado)}\n\n`,
    }),
  );
  await instalar(/\/api\/videos\/[^/]+\/medios(?:\?|$)/, async (route) => {
    const id = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/")[3],
    );
    if (id !== base.id) return route.fallback();
    solicitudes.metadata++;
    await route.fulfill({ json: medio });
  });
  await instalar("**/__ensayo-medio-real/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("video") !== base.id) {
      await route.fulfill({
        status: 404,
        body: "Medio no disponible en este ensayo.",
      });
      return;
    }
    const imagen = url.pathname.endsWith("/poster.webp");
    if (!imagen && !url.pathname.endsWith("/preview.mp4")) {
      await route.fulfill({
        status: 404,
        body: "Medio no disponible en este ensayo.",
      });
      return;
    }
    solicitudes[imagen ? "poster" : "preview"]++;
    await route.fulfill({
      contentType: imagen ? "image/webp" : "video/mp4",
      body: imagen ? poster : preview,
    });
  });
  return {
    estado,
    canal,
    video,
    medio,
    solicitudes,
    solicitudesExternas,
    evidencia: {
      poster: {
        bytes: poster.byteLength,
        sha256: hash(poster),
        ancho: 900,
        alto: 1600,
      },
      preview: {
        bytes: preview.byteLength,
        sha256: hash(preview),
        ancho: 360,
        alto: 640,
        segundos: 5,
        audio: false,
      },
      originalCompletoDisponible: false,
      publicaciones: 0,
      origen:
        "Derivados locales del render existente del proyecto; docs/informes/diseno-medios-diagnostico.md.",
    },
    cleanup: () => cleanup(page),
  };
}
