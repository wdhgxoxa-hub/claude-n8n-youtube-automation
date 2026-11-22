"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMovimientoReducido } from "./movimiento";

/** Captura enlaces internos: la promesa termina cuando React ha montado la ruta. */
export function Transiciones() {
  const router = useRouter();
  const path = usePathname();
  const reduced = useMovimientoReducido();
  const resolver = useRef<(() => void) | null>(null);
  useEffect(() => {
    resolver.current?.();
    resolver.current = null;
  }, [path]);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        !link ||
        link.target ||
        link.download ||
        !document.startViewTransition ||
        reduced
      )
        return;
      const url = new URL(link.href);
      if (
        url.origin !== location.origin ||
        url.pathname === location.pathname ||
        url.pathname.startsWith("/api/")
      )
        return;
      event.preventDefault();
      // Solo la miniatura activada toma el nombre; evita duplicados de un mismo video.
      const videoPath = /^\/videos\/([^/]+)$/.exec(url.pathname);
      const targetName = videoPath
        ? nombreMedio(decodeURIComponent(videoPath[1]))
        : undefined;
      const thumbnail =
        link.querySelector<HTMLElement>("[data-video-transition]") ??
        // El título y la miniatura de Publicados son enlaces distintos al mismo video.
        (targetName
          ? Array.from(
              document.querySelectorAll<HTMLElement>("[data-video-transition]"),
            ).find(
              (element) =>
                element.dataset.videoTransition === targetName &&
                element.getClientRects().length > 0,
            )
          : undefined);
      if (thumbnail)
        thumbnail.style.viewTransitionName =
          thumbnail.dataset.videoTransition ?? "";
      const transition = document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            resolver.current = resolve;
            router.push(url.pathname + url.search + url.hash);
            timeout = setTimeout(resolve, 4000);
          }),
      );
      void transition.finished
        .catch(() => {})
        .finally(() => {
          clearTimeout(timeout);
          if (thumbnail) thumbnail.style.viewTransitionName = "";
        });
    };
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("click", click, true);
      resolver.current?.();
      clearTimeout(timeout);
    };
  }, [router, reduced]);
  return null;
}
export function nombreMedio(id: string) {
  return `video-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
