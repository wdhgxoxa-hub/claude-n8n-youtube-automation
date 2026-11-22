"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import type { VideoMedios } from "@/contratos/video-medios";
import { useMovimientoReducido } from "./movimiento";
import { Portada } from "./portada";
import styles from "./portada-video.module.css";

const consultas = new Map<string, Promise<VideoMedios>>();
const ESPERA_PREVIEW_MS = 180;
const PLAZO_MEDIOS_MS = 300_000;
const ESPERA_MAXIMA_MS = 15_000;

/** La caché durable está en servidor; solo unifica solicitudes simultáneas. */
function consultar(url: string): Promise<VideoMedios> {
  const activa = consultas.get(url);
  if (activa) return activa;
  const solicitud = fetch(url, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(15_000),
  })
    .then(async (r) => {
      if (!r.ok) throw new Error("Medio no disponible");
      return (await r.json()) as VideoMedios;
    })
    .finally(() => consultas.delete(url));
  consultas.set(url, solicitud);
  return solicitud;
}

export function useVideoMedios({
  videoId,
  inicial,
  publicacion,
  visible = true,
}: {
  videoId: string;
  inicial?: VideoMedios;
  publicacion?: string;
  visible?: boolean;
}) {
  const url = `/api/videos/${encodeURIComponent(videoId)}/medios${publicacion ? `?publicacion=${encodeURIComponent(publicacion)}` : ""}`;
  const [respuesta, setRespuesta] = useState<{
    url: string;
    datos: VideoMedios;
  }>();
  const plazos = useRef(new Map<string, number>());
  const estadoInicial = inicial?.estado;
  const actualizadoInicial = inicial?.actualizadoEn;
  useEffect(() => {
    if (!visible || estadoInicial === "sin_medio") return;
    const vence = plazos.current.get(url) ?? Date.now() + PLAZO_MEDIOS_MS;
    plazos.current.set(url, vence);
    if (Date.now() >= vence) return;
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let intentos = 0;
    const leer = async () => {
      try {
        const datos = await consultar(url);
        if (cancelado) return;
        setRespuesta({ url, datos });
        const espera = Math.min(1500 * 2 ** intentos++, ESPERA_MAXIMA_MS);
        if (datos.estado === "pendiente" && Date.now() + espera < vence)
          timer = setTimeout(leer, espera);
      } catch {
        // La cartela o el póster recibido permanece visible sin romper el enlace.
      }
    };
    void leer();
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [url, visible, estadoInicial, actualizadoInicial]);
  if (respuesta?.url !== url) return inicial;
  return inicial && inicial.actualizadoEn > respuesta.datos.actualizadoEn
    ? inicial
    : respuesta.datos;
}

export function estiloMedio(
  medio?: VideoMedios,
  proporcion?: number,
): CSSProperties {
  return {
    "--tinte": medio?.tinte,
    "--medio-proporcion": proporcion ?? medio?.relacionAspecto ?? 16 / 9,
  } as CSSProperties;
}

export function PortadaVideo({
  videoId,
  titulo,
  inicial,
  publicacion,
  protagonista = false,
}: {
  videoId: string;
  titulo: string;
  inicial?: VideoMedios;
  publicacion?: string;
  protagonista?: boolean;
}) {
  const contenedor = useRef<HTMLSpanElement>(null);
  const reproductor = useRef<HTMLVideoElement>(null);
  const permisoPreview = useRef(false);
  const reducido = useMovimientoReducido();
  const [cerca, setCerca] = useState(false);
  const [enVista, setEnVista] = useState(false);
  const [movil, setMovil] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hover, setHover] = useState(false);
  const [preparado, setPreparado] = useState(false);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [falloPoster, setFalloPoster] = useState("");
  const medio = useVideoMedios({
    videoId,
    inicial,
    publicacion,
    visible: cerca,
  });
  // La caja conserva la proporción SSR durante esta visita. Una fuente nueva
  // se encaja; descubrir su altura nunca desplaza el contenido ya presentado.
  const [proporcion] = useState(inicial?.relacionAspecto ?? 16 / 9);
  const reproducir =
    !!medio?.preview && !reducido && visible && enVista && (hover || movil);

  useEffect(() => {
    const target = contenedor.current;
    if (!target) return;
    const proximidad = new IntersectionObserver(
      ([entry]) => setCerca(entry.isIntersecting),
      { rootMargin: "240px" },
    );
    const vista = new IntersectionObserver(
      ([entry]) =>
        setEnVista(entry.isIntersecting && entry.intersectionRatio >= 0.55),
      { threshold: [0, 0.55] },
    );
    const media = matchMedia("(max-width: 767px)");
    const actualizarMovil = () => setMovil(media.matches);
    const actualizarVisible = () => setVisible(!document.hidden);
    actualizarMovil();
    actualizarVisible();
    proximidad.observe(target);
    vista.observe(target);
    media.addEventListener("change", actualizarMovil);
    document.addEventListener("visibilitychange", actualizarVisible);
    return () => {
      proximidad.disconnect();
      vista.disconnect();
      media.removeEventListener("change", actualizarMovil);
      document.removeEventListener("visibilitychange", actualizarVisible);
    };
  }, []);

  useEffect(() => {
    const player = reproductor.current;
    permisoPreview.current = false;
    if (!reproducir) {
      player?.pause();
      if (player) player.currentTime = 0;
      return;
    }
    let cancelado = false;
    const timer = setTimeout(() => {
      permisoPreview.current = true;
      setPreparado(true);
      // En el primer hover React todavía tiene que colocar src. El efecto
      // siguiente inicia play después de ese commit; en visitas posteriores
      // el recurso ya está preparado y puede arrancar aquí.
      if (player?.getAttribute("src"))
        void player
          .play()
          .then(() => {
            if (cancelado) player.pause();
          })
          .catch(() => {
            /* El póster permanece si el navegador bloquea play. */
          });
    }, ESPERA_PREVIEW_MS);
    return () => {
      cancelado = true;
      permisoPreview.current = false;
      clearTimeout(timer);
      player?.pause();
    };
  }, [reproducir, medio?.preview?.url]);

  useEffect(() => {
    const player = reproductor.current;
    if (!preparado || !permisoPreview.current || !player) return;
    void player.play().catch(() => {
      /* El póster permanece si el navegador bloquea play. */
    });
    return () => player.pause();
  }, [preparado, medio?.preview?.url]);

  const poster = medio?.poster?.url;
  return (
    <span
      ref={contenedor}
      className={`${styles.medio} ${protagonista ? styles.protagonista : ""}`}
      style={estiloMedio(medio, proporcion)}
      data-video-medio={videoId}
      data-publicacion={publicacion}
      data-estado={falloPoster ? "no_disponible" : medio?.estado ?? "pendiente"}
      data-origen={
        medio?.poster?.origen ??
        (medio?.estado === "sin_medio" ? "tipografico" : "pendiente")
      }
      data-reproduciendo={reproducir && reproduciendo}
      data-quieto={reducido}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      aria-hidden="true"
    >
      {medio?.estado === "sin_medio" && !protagonista ? (
        <Portada title={titulo} />
      ) : poster && falloPoster !== poster ? (
        <Image
          src={poster}
          alt=""
          width={medio?.poster?.ancho ?? 1600}
          height={medio?.poster?.alto ?? 900}
          loading="lazy"
          decoding="async"
          unoptimized
          onError={() => setFalloPoster(poster)}
        />
      ) : medio?.estado === "sin_medio" ? (
        <Portada title={titulo} />
      ) : (
        <span className={styles.espera}>
          {protagonista &&
            (medio?.estado === "no_disponible" || falloPoster
              ? "Portada no disponible"
              : "Preparando portada")}
        </span>
      )}
      {medio?.preview && (
        <video
          ref={reproductor}
          src={preparado ? medio.preview.url : undefined}
          muted
          playsInline
          loop
          preload="none"
          tabIndex={-1}
          width={medio.ancho}
          height={medio.alto}
          onPlaying={() => setReproduciendo(true)}
          onPause={() => setReproduciendo(false)}
          onError={() => setReproduciendo(false)}
        />
      )}
    </span>
  );
}
