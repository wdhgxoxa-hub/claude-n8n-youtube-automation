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

/** Un medio real o su espera. Nunca inventa una miniatura ni inicia sonido. */
export function Medio({
  poster,
  preview,
  alt,
  proporcion = "horizontal",
  idCompartido,
  className,
  children,
}: {
  poster?: string;
  preview?: string;
  alt: string;
  proporcion?: "horizontal" | "vertical" | "cuadrado";
  idCompartido?: string;
  className?: string;
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useMovimientoReducido();
  const [paused] = usePausaMovimiento();
  const permitted = !reduced && !paused;

  function stop() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    video.current?.pause();
    if (root.current) root.current.dataset.preview = "off";
  }

  function start() {
    if (!permitted || !preview || timer.current) return;
    const delay =
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--duracion-preview",
        ),
      ) || 180;
    timer.current = setTimeout(() => {
      timer.current = null;
      void video.current?.play().catch(() => {
        /* El póster sigue disponible si no hay codec o permiso. */
      });
    }, delay);
  }

  useEffect(() => {
    const element = root.current;
    const player = video.current;
    if (!element || !player) return;
    let viewportTimer: ReturnType<typeof setTimeout> | undefined;
    const halt = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      clearTimeout(viewportTimer);
      player.pause();
      element.dataset.preview = "off";
    };
    if (!permitted) halt();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.65) {
          halt();
          return;
        }
        if (permitted && window.matchMedia("(hover: none)").matches) {
          const delay =
            Number.parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue(
                "--duracion-preview",
              ),
            ) || 180;
          viewportTimer = setTimeout(() => {
            void player.play().catch(() => {});
          }, delay);
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
      style={
        idCompartido
          ? ({
              viewTransitionName: `video-${idCompartido.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
            } as CSSProperties)
          : undefined
      }
      onPointerEnter={start}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      {poster ? (
        <Image
          className="medio-poster"
          src={poster}
          alt={alt}
          fill
          sizes="(max-width: 767px) 100vw, 50vw"
          unoptimized
        />
      ) : (
        <div className="medio-espera">
          <span>{alt}</span>
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
          onPlaying={() => {
            if (root.current) root.current.dataset.preview = "on";
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
  className,
}: {
  valor: number | null;
  etiqueta: string;
  serie?: readonly number[];
  variacion?: string;
  heroe?: boolean;
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
          <NumeroAnimado value={valor} />
        ) : (
          new Intl.NumberFormat("es-PE").format(valor)
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

function CorteConexion() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), 5_000);
    return () => clearTimeout(timeout);
  }, []);
  return visible ? (
    <span className="pildora-conexion" role="status">
      <i aria-hidden="true" />
      Sin conexión, reintentando
    </span>
  ) : null;
}

export function PildoraConexion({ conectado }: { conectado: boolean }) {
  return conectado ? null : <CorteConexion />;
}
