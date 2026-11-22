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
}: {
  size?: 56 | 112;
  activo?: boolean;
}) {
  const reduced = useMovimientoReducido();
  const [paused] = usePausaMovimiento();
  const [failed, setFailed] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = player.current;
    if (!video) return;
    const previews = new Map<HTMLVideoElement, () => void>();
    const update = () => {
      // El contenido tiene prioridad; la cara estática y el botón siguen visibles.
      if (!activo || reduced || paused || document.hidden || previews.size)
        video.pause();
      else void video.play().catch(() => {});
    };
    const watch = (preview: HTMLVideoElement) => {
      if (preview.paused || preview.ended || previews.has(preview)) return;
      const release = () => {
        // Una pausa encolada antes de otro play no libera un medio ya reanudado.
        if (!preview.paused && !preview.ended && preview.readyState !== 0) return;
        preview.removeEventListener("pause", release);
        preview.removeEventListener("ended", release);
        preview.removeEventListener("emptied", release);
        previews.delete(preview);
        update();
      };
      previews.set(preview, release);
      // Directos al elemento: también liberan al desmontar el medio del carrusel.
      preview.addEventListener("pause", release);
      preview.addEventListener("ended", release);
      preview.addEventListener("emptied", release);
      update();
    };
    const onPlay = (event: Event) => {
      if (
        event.target instanceof HTMLVideoElement &&
        event.target.matches(".medio-preview")
      )
        watch(event.target);
    };
    document.querySelectorAll<HTMLVideoElement>(".medio-preview").forEach(watch);
    document.addEventListener("play", onPlay, true);
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      document.removeEventListener("play", onPlay, true);
      for (const [preview, release] of previews) {
        preview.removeEventListener("pause", release);
        preview.removeEventListener("ended", release);
        preview.removeEventListener("emptied", release);
      }
      video.pause();
    };
  }, [activo, reduced, paused]);
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
