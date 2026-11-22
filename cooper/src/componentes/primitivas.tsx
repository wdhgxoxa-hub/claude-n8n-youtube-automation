"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useInView } from "framer-motion";
import type { VideoMedios } from "@/contratos/video-medios";
import { estiloMedio, useVideoMedios } from "./portada-video";
import { nombreMedio } from "./transiciones";
import {
  NumeroAnimado,
  useMovimientoReducido,
  usePausaMovimiento,
} from "./movimiento";

const clases = (...values: (string | undefined | false)[]) =>
  values.filter(Boolean).join(" ");

export function Boton({
  variante = "primario",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "fantasma" | "peligro";
}) {
  return (
    <button
      {...props}
      type={type}
      className={clases("boton", `boton-${variante}`, className)}
    />
  );
}

export function Chip({
  activo = false,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { activo?: boolean }) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={activo}
      className={clases("chip", activo && "chip-activo", className)}
    />
  );
}

export function Tarjeta({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <article {...props} className={clases("tarjeta", className)} />;
}

/** CSS puede normalizar 180ms como .18s al compilar. */
function esperaPreview() {
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue("--duracion-preview")
    .trim();
  const milisegundos =
    Number.parseFloat(valor) * (valor.endsWith("ms") ? 1 : 1000);
  return Number.isFinite(milisegundos) ? milisegundos : 180;
}

/** Un medio real o su espera. Nunca inventa una miniatura ni inicia sonido. */
export function Medio({
  poster: posterInicial,
  preview: previewInicial,
  alt,
  proporcion = "horizontal",
  idCompartido,
  videoId,
  prioridad = false,
  mediosIniciales,
  publicacionId,
  enCola = false,
  tinte: tinteInicial,
  className,
  children,
}: {
  poster?: string;
  preview?: string;
  alt: string;
  proporcion?: "horizontal" | "vertical" | "cuadrado";
  idCompartido?: string;
  videoId?: string;
  prioridad?: boolean;
  mediosIniciales?: VideoMedios;
  publicacionId?: string;
  enCola?: boolean;
  /** Color ya extraído por el adaptador de medios; evita consultar dos veces. */
  tinte?: string;
  className?: string;
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useMovimientoReducido();
  const [paused] = usePausaMovimiento();
  const permitted = !reduced && !paused;
  const [cerca, setCerca] = useState(false);
  const [falloPoster, setFalloPoster] = useState("");
  const medioId = videoId ?? idCompartido;
  const medio = useVideoMedios({
    videoId: medioId ?? "",
    inicial: mediosIniciales,
    publicacion: publicacionId,
    visible: Boolean(medioId) && cerca,
  });
  const poster =
    medio?.estado === "sin_medio"
      ? undefined
      : (medio?.poster?.origen !== "tipografico" && medio?.poster?.url) ||
        posterInicial ||
        medio?.poster?.url;
  const preview = medio?.preview?.url ?? previewInicial;
  const tinte = tinteInicial
    ? ({ "--tinte": tinteInicial } as CSSProperties)
    : medio?.tinte
      ? estiloMedio(medio)
      : undefined;

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCerca(entry.isIntersecting),
      { rootMargin: "240px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function stop() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    video.current?.pause();
    if (root.current) {
      root.current.dataset.preview = "off";
      root.current.dataset.reproduciendo = "false";
    }
  }

  function start() {
    if (!permitted || !preview || document.hidden) return;
    if (timer.current) clearTimeout(timer.current);
    // La intención ya da prioridad al contenido durante la espera de 180 ms.
    if (root.current) root.current.dataset.preview = "preparando";
    timer.current = setTimeout(() => {
      timer.current = null;
      void video.current?.play().catch(stop);
    }, esperaPreview());
  }

  useEffect(() => {
    const element = root.current;
    const player = video.current;
    if (!element || !player) return;
    const halt = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      player.pause();
      element.dataset.preview = "off";
      element.dataset.reproduciendo = "false";
    };
    if (!permitted) halt();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.65) {
          halt();
          return;
        }
        if (
          permitted &&
          !document.hidden &&
          (window.matchMedia("(max-width: 767px), (hover: none)").matches ||
            element.matches(":hover, :focus-within"))
        ) {
          if (timer.current) clearTimeout(timer.current);
          element.dataset.preview = "preparando";
          timer.current = setTimeout(() => {
            timer.current = null;
            void player.play().catch(halt);
          }, esperaPreview());
        }
      },
      { threshold: 0.65 },
    );
    observer.observe(element);
    const onVisibility = () => {
      if (document.hidden) halt();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      halt();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [permitted, preview]);

  return (
    <div
      ref={root}
      className={clases("medio", `medio-${proporcion}`, className)}
      data-preview="off"
      data-video-medio={medioId}
      data-publicacion={publicacionId}
      data-contexto={enCola ? "cola" : undefined}
      data-estado={
        falloPoster ? "no_disponible" : (medio?.estado ?? "pendiente")
      }
      data-origen={
        medio?.poster?.origen ?? (poster ? "miniatura" : "pendiente")
      }
      data-reproduciendo="false"
      data-quieto={!permitted}
      data-video-transition={medioId ? nombreMedio(medioId) : undefined}
      data-tinte={Boolean(tinte)}
      style={
        {
          ...tinte,
          viewTransitionName: idCompartido
            ? nombreMedio(idCompartido)
            : undefined,
        } as CSSProperties
      }
      onPointerEnter={start}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      {poster && falloPoster !== poster ? (
        <Image
          className="medio-poster"
          src={poster}
          alt={alt}
          width={medio?.poster?.ancho ?? 1600}
          height={medio?.poster?.alto ?? 900}
          loading={prioridad ? "eager" : "lazy"}
          fetchPriority={prioridad ? "high" : "auto"}
          decoding="async"
          unoptimized
          style={medio ? { objectFit: "contain" } : undefined}
          onError={() => setFalloPoster(poster)}
        />
      ) : (
        <div className="medio-espera">
          <span data-poster="tipografico">{alt}</span>
          <small>El medio aparecerá aquí</small>
        </div>
      )}
      {preview && (
        <video
          ref={video}
          className="medio-preview"
          src={preview}
          muted
          playsInline
          loop
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          style={medio ? { objectFit: "contain" } : undefined}
          onPlaying={() => {
            if (root.current) {
              root.current.dataset.preview = "on";
              root.current.dataset.reproduciendo = "true";
            }
          }}
          onPause={() => {
            if (root.current) {
              root.current.dataset.preview = "off";
              root.current.dataset.reproduciendo = "false";
            }
          }}
          onError={stop}
        />
      )}
      {children && <div className="medio-contenido">{children}</div>}
    </div>
  );
}

export function Cifra({
  valor,
  etiqueta,
  serie = [],
  variacion,
  heroe = false,
  compacta = false,
  className,
}: {
  valor: number | null;
  etiqueta: string;
  serie?: readonly number[];
  variacion?: string;
  heroe?: boolean;
  compacta?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const visible = useInView(ref, { once: true, amount: 0.5 });
  const reduced = useMovimientoReducido();
  const [paused] = usePausaMovimiento();
  const points = serie.filter(Number.isFinite);
  const min = Math.min(...points),
    max = Math.max(...points);
  const path = points
    .map(
      (value, index) =>
        `${index ? "L" : "M"}${(index / Math.max(1, points.length - 1)) * 120},${36 - ((value - min) / (max - min || 1)) * 32}`,
    )
    .join(" ");
  return (
    <figure
      ref={ref}
      className={clases("cifra", heroe && "cifra-heroe", className)}
      data-visible={visible && !reduced && !paused}
    >
      <figcaption>{etiqueta}</figcaption>
      <div className="cifra-valor">
        {valor === null ? (
          "—"
        ) : visible && !reduced && !paused ? (
          <NumeroAnimado value={valor} compact={compacta} />
        ) : (
          new Intl.NumberFormat(
            "es-PE",
            compacta ? { notation: "compact", maximumFractionDigits: 1 } : {},
          ).format(valor)
        )}
      </div>
      {valor === null && <span className="cifra-detalle">Sin dato</span>}
      {variacion && <span className="cifra-detalle">{variacion}</span>}
      {points.length > 1 && (
        <>
          <svg
            className="cifra-grafica"
            viewBox="0 0 120 40"
            aria-hidden="true"
          >
            <path d={path} pathLength="1" />
          </svg>
          <span className="sr-only">Serie: {points.join(", ")}</span>
        </>
      )}
    </figure>
  );
}

/** Superficie de vidrio. Quien abre la hoja controla foco, Escape y modalidad. */
export function HojaVidrio({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={clases("hoja-vidrio", className)} />;
}

export function Esqueleto({
  className,
  etiqueta = "Cargando",
  ...props
}: HTMLAttributes<HTMLDivElement> & { etiqueta?: string }) {
  return (
    <div {...props} className={clases("esqueleto", className)} role="status">
      <span className="sr-only">{etiqueta}</span>
    </div>
  );
}

export function Vacio({
  titulo,
  descripcion,
  accion,
  children,
  className,
}: {
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clases("vacio", className)}>
      {children}
      <h2>{titulo}</h2>
      <p>{descripcion}</p>
      {accion}
    </div>
  );
}

/** Aviso de corte real: `aviso` lo decide conectarEventos (corte sostenido >5 s).
 * La región de estado queda montada para que el anuncio sea fiable. */
export function PildoraConexion({ aviso }: { aviso: boolean }) {
  return (
    <div className="connection-notice" role="status" aria-atomic="true">
      {aviso && (
        <span className="pildora-conexion" data-testid="estado-conexion">
          <i aria-hidden="true" />
          Sin conexión, reintentando
        </span>
      )}
    </div>
  );
}
