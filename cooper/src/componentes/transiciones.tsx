"use client";
import { use, useEffect, useLayoutEffect, ViewTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMovimientoReducido } from "./movimiento";

/**
 * Navegación con View Transition abierta en el commit de React.
 *
 * Al tocar un enlace se pide la ruta y la pantalla actual sigue viva: responde
 * al tacto y anima mientras llegan los datos. La navegación de Next es una
 * Transition; el `<ViewTransition>` de abajo, que cambia de clave con cada
 * ruta, hace que React llame a `document.startViewTransition` justo cuando la
 * ruta nueva está lista para pintar y aplique el cambio dentro de la llamada.
 * Así el navegador no deja de dibujar mientras espera la red.
 *
 * En estas navegaciones el esqueleto de `loading.tsx` no se monta (lo retiene
 * `RetenerEsqueleto`): la captura nueva es la página definitiva, sin la espera
 * mínima de 300 ms que React impone a un fallback ya mostrado.
 */
type Espera = {
  destino: string;
  liberada: boolean;
  puerta: Promise<void>;
  liberar: () => void;
};

let espera: Espera | null = null;

/** Hasta aquí se retiene el esqueleto; una ruta más lenta lo muestra. */
const PLAZO_ESQUELETO_MS = 1000;

function crearEspera(destino: string): Espera {
  let abrir = () => {};
  const puerta = new Promise<void>((resolve) => (abrir = resolve));
  const nueva: Espera = {
    destino,
    liberada: false,
    puerta,
    liberar: () => {
      nueva.liberada = true;
      if (espera === nueva) espera = null;
      abrir();
    },
  };
  return nueva;
}

/**
 * Dentro de `loading.tsx`. En una navegación animada el fallback se suspende y
 * React conserva la pantalla anterior hasta que la ruta nueva está completa.
 * En la carga inicial, sin movimiento o sin la API, el esqueleto se comporta
 * como siempre.
 */
export function RetenerEsqueleto() {
  const path = usePathname();
  const actual = espera;
  if (actual && !actual.liberada && actual.destino === path) use(actual.puerta);
  return null;
}

/** Captura enlaces internos y deja que React anime la ruta en su commit. */
export function Transiciones() {
  const router = useRouter();
  const path = usePathname();
  const reduced = useMovimientoReducido();
  useLayoutEffect(() => {
    // React solo anima la raíz si alguien la nombra a propósito; el resto de
    // la página funde y se desplaza con ::view-transition-*(root).
    document.documentElement.style.viewTransitionName = "root";
  }, []);
  useLayoutEffect(() => {
    // Commit de una ruta (la pedida o una ajena: atrás, redirección). Corre
    // dentro de la View Transition, ya tomada la captura anterior: la
    // miniatura devuelve su nombre antes de la captura nueva.
    espera?.liberar();
    for (const element of document.querySelectorAll<HTMLElement>(
      "[data-nombre-prestado]",
    )) {
      element.style.viewTransitionName = "";
      delete element.dataset.nombrePrestado;
    }
    for (const enlace of document.querySelectorAll<HTMLElement>(
      "[data-navegando]",
    ))
      delete enlace.dataset.navegando;
  }, [path]);
  useEffect(() => {
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
      espera?.liberar();
      for (const element of document.querySelectorAll<HTMLElement>(
        "[data-nombre-prestado]",
      )) {
        element.style.viewTransitionName = "";
        delete element.dataset.nombrePrestado;
      }
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
      if (thumbnail) {
        thumbnail.style.viewTransitionName =
          thumbnail.dataset.videoTransition ?? "";
        thumbnail.dataset.nombrePrestado = "";
      }
      const actual = crearEspera(url.pathname);
      espera = actual;
      // Si la ruta tarda más de un segundo, se suelta el esqueleto: la persona
      // ve que la pantalla llega en vez de quedarse mirando la anterior.
      setTimeout(actual.liberar, PLAZO_ESQUELETO_MS);
      // Señal de espera mientras llega la red (solo opacidad, ver armazon.css).
      link.dataset.navegando = "";
      router.push(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("click", click, true);
      espera?.liberar();
    };
  }, [router, reduced]);
  // Sin movimiento no se monta: React no abre ninguna View Transition.
  return reduced ? null : (
    <ViewTransition key={path} default="none">
      <span hidden />
    </ViewTransition>
  );
}

export function nombreMedio(id: string) {
  return `video-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
