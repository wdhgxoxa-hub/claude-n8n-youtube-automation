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
import { formatoCompacto, formatoDecimal, formatoEntero } from "@/lib/cifras";
import type { VideoMedios } from "@/contratos/video-medios";
import { useVideoMedios } from "./video-medios-cliente";
import { nombreMedio } from "./transiciones";
import { Cartel } from "./cartel";
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

/** Un medio real, su espera o su póster tipográfico. Nunca inventa una
 * miniatura ni inicia sonido.
 * - Medio real (póster): imagen completa, sin recortes, y vista previa
 *   silenciosa tras 180 ms de intención (hover/foco) o, en táctil, al estar
 *   en vista. La fuente de la vista previa se asigna solo en ese momento.
 * - Medio en preparación o no disponible: caja neutra reservada.
 * - Sin medio: póster tipográfico (Cartel). */
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
  vistaPrevia = true,
  tinte: tinteInicial,
  titulo,
  canal,
  detalle,
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
  /** Falso cuando la pantalla reserva la vista previa a otra pieza. */
  vistaPrevia?: boolean;
  /** Color ya extraído por el adaptador de medios; evita consultar dos veces. */
  tinte?: string;
  /** Título del póster tipográfico; por defecto, el texto alternativo. */
  titulo?: string;
  /** Firma del póster tipográfico (canal o marca). */
  canal?: string;
  /** Detalle editorial del póster tipográfico (etapa o número). */
  detalle?: string;
  className?: string;
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const permiso = useRef(false);
  const reduced = useMovimientoReducido();
  const [paused] = usePausaMovimiento();
  const permitted = !reduced && !paused;
  const [cerca, setCerca] = useState(false);
  const [asoma, setAsoma] = useState(false);
  const [enVista, setEnVista] = useState(false);
  const [tactil, setTactil] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [intencion, setIntencion] = useState(false);
  const [fuente, setFuente] = useState(false);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [rechazado, setRechazado] = useState(false);
  const [falloPoster, setFalloPoster] = useState("");
  const medioId = videoId ?? idCompartido;
  const medio = useVideoMedios({
    videoId: medioId ?? "",
    inicial: mediosIniciales,
    publicacion: publicacionId,
    visible: Boolean(medioId) && cerca,
  });
  const sinMedio = medio?.estado === "sin_medio";
  // El SVG tipográfico del servidor no es una imagen del video: en su lugar
  // se compone el póster tipográfico con la fuente display y el tinte.
  const tipografico =
    medio?.poster?.origen === "tipografico" ? medio.poster.url : undefined;
  const poster = sinMedio
    ? undefined
    : (!tipografico && medio?.poster?.url) ||
      (posterInicial !== tipografico ? posterInicial : undefined);
  const posterFallido = Boolean(poster) && falloPoster === poster;
  // Hay un medio real que aún no se puede mostrar: se reserva su caja sin
  // sustituirlo por la carátula de las piezas que no tienen medio.
  const enEspera =
    !sinMedio &&
    (posterFallido ||
      (!poster &&
        (medio
          ? medio.estado === "pendiente" || medio.estado === "no_disponible"
          : Boolean(medioId))));
  const preview = vistaPrevia
    ? (medio?.preview?.url ?? previewInicial)
    : undefined;
  const tinte = tinteInicial ?? medio?.tinte;
  const quiere =
    Boolean(preview) &&
    permitted &&
    !oculto &&
    !rechazado &&
    (tactil ? enVista : intencion && asoma);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const proximidad = new IntersectionObserver(
      ([entry]) => setCerca(entry.isIntersecting),
      { rootMargin: "240px" },
    );
    const vista = new IntersectionObserver(
      ([entry]) => {
        const suficiente =
          entry.isIntersecting && entry.intersectionRatio >= 0.649;
        setAsoma(entry.isIntersecting);
        setEnVista(suficiente);
        // Al volver a entrar en vista se permite un nuevo intento de play.
        if (!suficiente) setRechazado(false);
      },
      { threshold: [0, 0.65] },
    );
    const media = matchMedia("(max-width: 767px), (hover: none)");
    const actualizarTactil = () => setTactil(media.matches);
    const actualizarOculto = () => setOculto(document.hidden);
    actualizarTactil();
    actualizarOculto();
    proximidad.observe(element);
    vista.observe(element);
    media.addEventListener("change", actualizarTactil);
    document.addEventListener("visibilitychange", actualizarOculto);
    return () => {
      proximidad.disconnect();
      vista.disconnect();
      media.removeEventListener("change", actualizarTactil);
      document.removeEventListener("visibilitychange", actualizarOculto);
    };
  }, []);

  useEffect(() => {
    const player = video.current;
    permiso.current = false;
    if (!quiere) {
      player?.pause();
      // Al salir vuelve al póster; la próxima vista previa empieza de cero.
      if (player) player.currentTime = 0;
      return;
    }
    let cancelado = false;
    const timer = setTimeout(() => {
      permiso.current = true;
      setFuente(true);
      // En la primera intención React aún debe colocar src: el efecto
      // siguiente inicia play tras ese commit. Después ya está preparada.
      if (player?.getAttribute("src"))
        void player
          .play()
          .then(() => {
            if (cancelado) player.pause();
          })
          .catch((error: unknown) => {
            if ((error as Error)?.name !== "AbortError") setRechazado(true);
          });
    }, esperaPreview());
    return () => {
      cancelado = true;
      permiso.current = false;
      clearTimeout(timer);
      player?.pause();
    };
  }, [quiere, preview]);

  useEffect(() => {
    const player = video.current;
    if (!fuente || !permiso.current || !player) return;
    void player.play().catch((error: unknown) => {
      if ((error as Error)?.name !== "AbortError") setRechazado(true);
    });
    return () => player.pause();
  }, [fuente, preview]);

  function intencionNueva() {
    setRechazado(false);
    setIntencion(true);
  }

  return (
    <div
      ref={root}
      className={clases("medio", `medio-${proporcion}`, className)}
      data-preview={quiere ? (reproduciendo ? "on" : "preparando") : "off"}
      data-video-medio={medioId}
      data-publicacion={publicacionId}
      data-contexto={enCola ? "cola" : undefined}
      data-estado={
        posterFallido ? "no_disponible" : (medio?.estado ?? "pendiente")
      }
      data-origen={
        medio?.poster?.origen ??
        (poster ? "miniatura" : sinMedio ? "tipografico" : "pendiente")
      }
      data-reproduciendo={quiere && reproduciendo}
      data-quieto={!permitted}
      data-video-transition={medioId ? nombreMedio(medioId) : undefined}
      data-tinte={Boolean(tinte)}
      style={
        {
          "--tinte": tinte,
          viewTransitionName: idCompartido
            ? nombreMedio(idCompartido)
            : undefined,
        } as CSSProperties
      }
      onPointerEnter={intencionNueva}
      onPointerLeave={() => setIntencion(false)}
      onFocus={intencionNueva}
      onBlur={() => setIntencion(false)}
    >
      {poster && !posterFallido ? (
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
          onError={() => setFalloPoster(poster)}
        />
      ) : (
        // Sin póster utilizable (sin medio, pendiente, no disponible o carga
        // fallida) siempre hay carátula: nunca una caja vacía. Mientras el
        // medio real sigue en camino, la carátula lleva un brillo de espera.
        <>
          <Cartel titulo={titulo ?? alt} canal={canal} detalle={detalle} />
          {enEspera && medio?.estado !== "no_disponible" && !posterFallido && (
            <span className="medio-espera" aria-hidden="true" />
          )}
        </>
      )}
      {preview && (
        <video
          ref={video}
          className="medio-preview"
          src={fuente ? preview : undefined}
          muted
          playsInline
          loop
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setReproduciendo(true)}
          onPause={() => setReproduciendo(false)}
          onError={() => {
            setReproduciendo(false);
            setRechazado(true);
          }}
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
  decimales,
  className,
}: {
  valor: number | null;
  etiqueta: string;
  serie?: readonly number[];
  variacion?: string;
  heroe?: boolean;
  compacta?: boolean;
  decimales?: number;
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
          <NumeroAnimado
            value={valor}
            compact={compacta}
            decimales={decimales}
          />
        ) : decimales !== undefined ? (
          formatoDecimal(valor, decimales)
        ) : (
          (compacta ? formatoCompacto : formatoEntero)(valor)
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
