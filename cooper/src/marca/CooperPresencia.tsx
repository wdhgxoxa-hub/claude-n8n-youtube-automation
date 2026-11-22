"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  useMovimientoReducido,
  usePausaMovimiento,
} from "@/componentes/movimiento";
export function CooperPresencia({
  size = 56,
  activo = true,
  cederAPreview = false,
}: {
  size?: 56 | 112;
  activo?: boolean;
  cederAPreview?: boolean;
}) {
  const reduced = useMovimientoReducido();
  const [paused] = usePausaMovimiento();
  const [failed, setFailed] = useState(false);
  const [pintado, setPintado] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    // Crear un <video> obliga a Chromium a abrir el canal con el proceso GPU de
    // forma síncrona en el hilo principal. Si el GPU aún no está listo (navegador
    // recién abierto o equipo cargado), la página queda congelada ~3 s antes de su
    // primer cuadro. Tras dos cuadros pintados el canal ya existe y el reproductor
    // nace sin bloquear; mientras tanto se ve la misma cara fija de debajo.
    // Además el loop (~380 KB) espera a que la página termine de cargar y quede
    // ociosa: en una red móvil lenta competía con el CSS, las fuentes y el
    // JavaScript de la primera pintura y retrasaba el contenido principal.
    let primero = 0,
      segundo = 0,
      ocioso = 0,
      espera = 0;
    const crear = () => {
      primero = requestAnimationFrame(() => {
        segundo = requestAnimationFrame(() => setPintado(true));
      });
    };
    const trasCarga = () => {
      // Safari no ofrece requestIdleCallback: allí basta un respiro tras la carga.
      if (typeof window.requestIdleCallback === "function")
        ocioso = window.requestIdleCallback(crear, { timeout: 2000 });
      else espera = window.setTimeout(crear, 200);
    };
    if (document.readyState === "complete") trasCarga();
    else window.addEventListener("load", trasCarga, { once: true });
    return () => {
      window.removeEventListener("load", trasCarga);
      if (ocioso) cancelIdleCallback(ocioso);
      window.clearTimeout(espera);
      cancelAnimationFrame(primero);
      cancelAnimationFrame(segundo);
    };
  }, []);
  useEffect(() => {
    const video = player.current;
    if (!video) return;
    const update = () => {
      // El contenido tiene prioridad: la cara sigue presente mientras su loop
      // cede la reproducción a una vista previa visible de la producción.
      const previewActiva =
        cederAPreview &&
        [
          ...document.querySelectorAll<HTMLVideoElement>("video.medio-preview"),
        ].some(
          (preview) =>
            ((!preview.paused && !preview.ended) ||
              preview
                .closest("[data-preview]")
                ?.getAttribute("data-preview") === "preparando") &&
            preview.checkVisibility(),
        );
      if (!activo || reduced || paused || document.hidden || previewActiva) {
        video.pause();
        // Retira también la capa de composición del video detenido; la
        // imagen inferior conserva la cara (aporte de diseno-inicio).
        video.style.visibility = "hidden";
      } else {
        video.style.visibility = "";
        void video.play().catch(() => {});
      }
    };
    const cambioPreview = (event: Event) => {
      if (
        event.target instanceof HTMLVideoElement &&
        event.target.matches(".medio-preview")
      )
        update();
    };
    // La intención llega antes de play. Las retiradas cubren la navegación,
    // donde React puede desconectar la preview antes del evento pause.
    const cambiosPreview = cederAPreview
      ? new MutationObserver((records) => {
          if (
            records.some(
              (record) =>
                record.type === "attributes" ||
                [...record.removedNodes].some(
                  (node) =>
                    node instanceof Element &&
                    (node.matches(".medio-preview") ||
                      node.querySelector(".medio-preview")),
                ),
            )
          )
            update();
        })
      : null;
    update();
    document.addEventListener("visibilitychange", update);
    if (cederAPreview) {
      for (const evento of ["play", "pause", "ended"])
        document.addEventListener(evento, cambioPreview, true);
      cambiosPreview?.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-preview"],
      });
    }
    return () => {
      document.removeEventListener("visibilitychange", update);
      for (const evento of ["play", "pause", "ended"])
        document.removeEventListener(evento, cambioPreview, true);
      cambiosPreview?.disconnect();
      video.pause();
    };
  }, [activo, reduced, paused, cederAPreview, pintado]);
  return (
    <span
      className="cooper-presencia"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src="/cooper-cara/cooper.webp"
        alt=""
        width={size}
        height={size}
        unoptimized
      />
      {pintado && !reduced && !paused && !failed && (
        <video
          ref={player}
          src="/cooper-cara/cooper.webm"
          poster="/cooper-cara/cooper.webp"
          width={size}
          height={size}
          muted
          playsInline
          loop
          autoPlay={activo}
          preload="none"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
