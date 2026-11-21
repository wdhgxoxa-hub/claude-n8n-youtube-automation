"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import type { AnimationItem } from "lottie-web";
import { useMovimientoReducido } from "./movimiento";
export type Ilustracion =
  "cooper-recibe" | "cooper-reacciona" | "cooper-celebra" | "fabrica";

/** Poster primero; el reproductor SVG ligero no entra en el JS inicial. */
export function IlustracionViva({
  nombre = "cooper-recibe",
  className = "",
  repetir = true,
  activo = true,
}: {
  nombre?: Ilustracion;
  className?: string;
  repetir?: boolean;
  activo?: boolean;
}) {
  const container = useRef<HTMLSpanElement>(null);
  const player = useRef<AnimationItem | null>(null);
  const preference = useMovimientoReducido();
  const reduced = preference || !activo;
  const policy = useRef(reduced);
  useEffect(() => {
    policy.current = reduced;
    if (reduced) player.current?.pause();
    else if (!document.hidden && container.current?.dataset.visible === "true")
      player.current?.play();
  }, [reduced]);
  useEffect(() => {
    const target = container.current;
    if (!target) return;
    let cancelled = false;
    let loading = false;
    const controller = new AbortController();
    const update = () => {
      if (
        policy.current ||
        document.hidden ||
        target.dataset.visible !== "true"
      )
        player.current?.pause();
      else player.current?.play();
    };
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const [module, response] = await Promise.all([
          import("lottie-web/build/player/lottie_light"),
          fetch(`/movimiento/${nombre}.json`, { signal: controller.signal }),
        ]);
        if (!response.ok) return;
        const animationData = await response.json();
        if (cancelled) return;
        const animation = module.default.loadAnimation({
          container: target,
          renderer: "svg",
          loop: repetir,
          autoplay: false,
          animationData,
          rendererSettings: { progressiveLoad: true, hideOnTransparent: true },
        });
        player.current = animation;
        animation.addEventListener("DOMLoaded", () => {
          if (cancelled) return;
          target.dataset.ready = "true";
          animation.goToAndStop(0, true);
          update();
        });
      } catch {
        /* El dibujo de reposo conserva la escena aunque no cargue el motor. */
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        target.dataset.visible = String(entry.isIntersecting);
        if (entry.isIntersecting) void load();
        update();
      },
      { threshold: 0.05 },
    );
    observer.observe(target);
    document.addEventListener("visibilitychange", update);
    return () => {
      cancelled = true;
      controller.abort();
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      player.current?.destroy();
      player.current = null;
      delete target.dataset.ready;
    };
  }, [nombre, repetir]);
  return (
    <span
      className={`living-illustration ${className}`}
      aria-hidden="true"
      data-illustration={nombre}
    >
      <span ref={container} className="lottie-layer" />
      <Image
        className="illustration-poster"
        src={`/movimiento/${nombre}.svg`}
        alt=""
        width={nombre === "fabrica" ? 600 : 320}
        height={nombre === "fabrica" ? 230 : 280}
        unoptimized
      />
    </span>
  );
}
