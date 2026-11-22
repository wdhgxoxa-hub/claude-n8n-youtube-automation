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
  const player = useRef<HTMLVideoElement>(null);
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
  }, [activo, reduced, paused, cederAPreview]);
  return (
    <span
      className="cooper-presencia"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src="/cooper-cara/cooper.png"
        alt=""
        width={size}
        height={size}
        unoptimized
      />
      {!reduced && !paused && !failed && (
        <video
          ref={player}
          src="/cooper-cara/cooper.webm"
          poster="/cooper-cara/cooper.png"
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
