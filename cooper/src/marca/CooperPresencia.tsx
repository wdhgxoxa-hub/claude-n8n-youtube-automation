"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  useMovimientoReducido,
  usePausaMovimiento,
} from "@/componentes/movimiento";
export function CooperPresencia({ size = 56 }: { size?: 56 | 112 }) {
  const reduced = useMovimientoReducido();
  const [paused] = usePausaMovimiento();
  const [failed, setFailed] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = player.current;
    if (!video) return;
    const update = () => {
      if (reduced || paused || document.hidden) video.pause();
      else void video.play().catch(() => {});
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      video.pause();
    };
  }, [reduced, paused]);
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
          autoPlay
          preload="none"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
