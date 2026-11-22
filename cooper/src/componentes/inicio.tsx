"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { m, animate, useMotionValue } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Play,
} from "lucide-react";
import { useEspacio, Empty } from "./espacio";
import {
  Entrada,
  useMovimientoReducido,
  usePausaMovimiento,
} from "./movimiento";
import { Boton, Cifra, Medio, Tarjeta } from "./primitivas";
import { useVideoMedios, estiloMedio } from "./portada-video";
import { nombreMedio } from "./transiciones";
import { ETAPAS, esperaAprobacion } from "@/lib/etapas";
import { nombreRed } from "@/lib/redes";
import {
  corteInicio,
  publicacionPrincipal,
  resumenInicio,
  terminadosInicio,
  ultimaMedicion,
  type VideoInicio,
} from "./inicio-datos";
import "./inicio.css";

function MedioInicio({
  video,
  heroe = false,
  vistaPrevia = false,
}: {
  video: VideoInicio;
  heroe?: boolean;
  vistaPrevia?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [cerca, setCerca] = useState(heroe);
  const medio = useVideoMedios({
    videoId: video.id,
    inicial: video.medios,
    visible: cerca,
  });
  const [vertical] = useState(video.medios.relacionAspecto < 1);
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
  return (
    <div
      ref={root}
      className={`inicio-medio halo-medio${heroe ? " inicio-medio-heroe" : ""}`}
      data-tinte={Boolean(medio?.poster)}
      data-proporcion={vertical ? "vertical" : "horizontal"}
      data-video-transition={nombreMedio(video.id)}
      style={estiloMedio(medio)}
    >
      <Medio
        poster={medio?.poster?.url}
        preview={heroe || vistaPrevia ? medio?.preview?.url : undefined}
        // Fuera del héroe, el mismo control ya contiene su título en texto.
        alt={heroe ? video.title : ""}
        proporcion={vertical ? "vertical" : "horizontal"}
        prioridad={heroe}
      />
      {heroe && (
        <span className="inicio-reproducir">
          <Play size={20} fill="currentColor" aria-hidden="true" />
          Ver video
        </span>
      )}
    </div>
  );
}

function Carrusel({
  videos,
  seleccionado,
  elegir,
}: {
  videos: VideoInicio[];
  seleccionado: string;
  elegir: (id: string) => void;
}) {
  const ventana = useRef<HTMLDivElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  const arrastrando = useRef(false);
  const [limite, setLimite] = useState(0);
  const x = useMotionValue(0);
  const reduced = useMovimientoReducido();
  const [paused] = usePausaMovimiento();
  const quieto = reduced || paused;
  const actual = videos.findIndex((v) => v.id === seleccionado);
  useEffect(() => {
    const frame = ventana.current,
      track = pista.current;
    if (!frame || !track) return;
    const observer = new ResizeObserver(() => {
      const overflow = Math.max(0, track.scrollWidth - frame.clientWidth);
      setLimite(overflow);
      x.set(Math.max(-overflow, Math.min(0, x.get())));
    });
    observer.observe(frame);
    observer.observe(track);
    return () => observer.disconnect();
  }, [x, videos.length]);

  function seleccionar(index: number) {
    const destino = videos[index];
    if (!destino) return;
    elegir(destino.id);
    const item = pista.current?.children[index] as HTMLElement | undefined;
    if (item) {
      const siguiente = Math.max(-limite, Math.min(0, -item.offsetLeft));
      if (quieto) x.set(siguiente);
      else animate(x, siguiente, { duration: 0.24, ease: [0.16, 1, 0.3, 1] });
    }
  }
  return (
    <section
      className="inicio-carrusel"
      aria-label="Tus últimos videos"
      aria-roledescription="carrusel"
    >
      <div className="inicio-carrusel-cabecera">
        <p className="inicio-nota">
          Últimos terminados{" "}
          <span className="inicio-posicion">
            {String(actual + 1).padStart(2, "0")} /{" "}
            {String(videos.length).padStart(2, "0")}
          </span>
        </p>
        <div className="inicio-flechas">
          <Boton
            variante="fantasma"
            aria-label="Video anterior"
            disabled={actual <= 0}
            onClick={() => seleccionar(actual - 1)}
          >
            <ChevronLeft size={20} />
          </Boton>
          <Boton
            variante="fantasma"
            aria-label="Video siguiente"
            disabled={actual >= videos.length - 1}
            onClick={() => seleccionar(actual + 1)}
          >
            <ChevronRight size={20} />
          </Boton>
        </div>
      </div>
      <div ref={ventana} className="inicio-carrusel-ventana">
        <m.div
          ref={pista}
          className="inicio-carrusel-pista"
          style={{ x }}
          drag={limite > 0 ? "x" : false}
          dragConstraints={{ left: -limite, right: 0 }}
          dragElastic={quieto ? 0 : 0.08}
          dragMomentum={!quieto}
          onDragStart={() => {
            arrastrando.current = true;
          }}
          onDragEnd={() => {
            requestAnimationFrame(() => {
              arrastrando.current = false;
            });
          }}
        >
          {videos.map((video, index) => (
            <button
              type="button"
              key={video.id}
              className="inicio-selector"
              aria-pressed={video.id === seleccionado}
              onClick={() => {
                if (!arrastrando.current) seleccionar(index);
              }}
              onFocus={() => {
                const item = pista.current?.children[index] as
                  HTMLElement | undefined;
                if (item && ventana.current) {
                  const left = item.offsetLeft + x.get();
                  if (
                    left < 0 ||
                    left + item.offsetWidth > ventana.current.clientWidth
                  )
                    x.set(Math.max(-limite, -item.offsetLeft));
                }
              }}
              onKeyDown={(event) => {
                const siguiente =
                  event.key === "ArrowRight"
                    ? index + 1
                    : event.key === "ArrowLeft"
                      ? index - 1
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? videos.length - 1
                          : null;
                if (siguiente === null || !videos[siguiente]) return;
                event.preventDefault();
                seleccionar(siguiente);
                (
                  pista.current?.children[siguiente] as HTMLElement | undefined
                )?.focus({ preventScroll: true });
              }}
            >
              <MedioInicio video={video} />
              <span className="inicio-selector-texto">
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <strong>{video.title}</strong>
                {video.id === seleccionado && (
                  <Check size={16} aria-hidden="true" />
                )}
              </span>
            </button>
          ))}
        </m.div>
      </div>
    </section>
  );
}

function Heroe({
  videos,
  canal,
}: {
  videos: VideoInicio[];
  canal: (id: string) => string;
}) {
  // Sigue al último recibido hasta que la persona elija una pieza del carrusel.
  const [seleccionado, seleccionar] = useState<string | null>(null);
  const video = videos.find((v) => v.id === seleccionado) ?? videos[0];
  const publicacion = publicacionPrincipal(video);
  const medicion = ultimaMedicion(publicacion);
  // El halo es una capa persistente: al cambiar de video solo cambia su tinte (640ms).
  const medios = useVideoMedios({
    videoId: video.id,
    inicial: video.medios,
    visible: true,
  });
  return (
    <div className="inicio-proyeccion">
      <section className="inicio-hero" aria-label="Video protagonista">
        <div
          className="inicio-escena"
          style={{ "--tinte": medios?.tinte } as CSSProperties}
        >
          <span className="inicio-halo" aria-hidden="true" />
          <Link
            className="inicio-hero-enlace"
            href={`/videos/${video.id}`}
          >
            <MedioInicio key={video.id} video={video} heroe />
          </Link>
        </div>
        <div className="inicio-hero-pie">
          <div
            className="inicio-hero-texto"
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="inicio-nota">
              <span className="inicio-estado">
                {video.stage === 11
                  ? "Publicado"
                  : video.stage === 10
                    ? "Programado"
                    : "Listo para revisar"}
              </span>
              <span>{canal(video.channelId)}</span>
            </p>
            <h2>{video.title}</h2>
            <Link href={`/videos/${video.id}`} className="inicio-enlace">
              Entrar a la historia <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="inicio-hero-resultados">
            <p className="inicio-nota">
              {publicacion
                ? nombreRed(publicacion.red)
                : "Las cifras llegan al publicar"}
            </p>
            <div className="inicio-hero-cifras">
              <Cifra compacta etiqueta="Vistas" valor={medicion?.vistas ?? null} />
              <Cifra compacta etiqueta="Me gusta" valor={medicion?.meGusta ?? null} />
              <Cifra
                etiqueta="Comentarios"
                valor={medicion?.comentarios ?? null}
              />
            </div>
          </div>
        </div>
      </section>
      <Carrusel videos={videos} seleccionado={video.id} elegir={seleccionar} />
    </div>
  );
}

export function Inicio({ ahora }: { ahora: number }) {
  const { data } = useEspacio();
  const propios = data.videos.filter((v) => v.ownerId === data.user.id);
  const terminados = terminadosInicio(propios);
  const pendientes = propios.filter(
    (v) => v.productionState === "activa" && esperaAprobacion(v.stage),
  );
  const produccion = propios.filter(
    (v) => v.stage < 11 && v.productionState !== "cancelada",
  );
  const resumen = resumenInicio(propios, corteInicio(propios, ahora));
  const canal = (id: string) =>
    data.channels.find((c) => c.id === id)?.name ?? "Tu canal";
  return (
    <div className="page inicio-estudio">
      <header className="inicio-titulo">
        <p className="eyebrow">COOPER / ESTUDIO</p>
        <h1>
          Hoy en el estudio<span className="title-stop">.</span>
        </h1>
        <p className="inicio-subtitulo">
          De la primera idea al momento de compartirla.
        </p>
      </header>
      {propios.length ? (
        <>
          {terminados.length ? (
            <Heroe videos={terminados} canal={canal} />
          ) : (
            <section className="inicio-primera-proyeccion">
              <Clapperboard size={32} />
              <h2>Tu próxima historia empieza aquí.</h2>
              <p>Cuando esté lista, este será su lugar.</p>
              <a className="inicio-enlace" href="#inicio-produccion">
                Ver qué está tomando forma <ArrowDown size={18} />
              </a>
            </section>
          )}
          <section
            className="inicio-pendientes"
            aria-labelledby="inicio-pendientes-titulo"
          >
            <div className="inicio-seccion-titulo">
              <h2 id="inicio-pendientes-titulo">
                Te toca a ti
                <span className="inicio-cantidad">
                  {String(pendientes.length).padStart(2, "0")}
                </span>
              </h2>
              <p>Tu mirada hace la diferencia.</p>
            </div>
            {pendientes.length ? (
              <div className="inicio-pendientes-grid">
                {pendientes.map((video, index) => (
                  <Entrada key={video.id} orden={Math.min(index, 7)}>
                    <Tarjeta className="inicio-pendiente">
                      <Link
                        href={`/videos/${video.id}`}
                      >
                        <MedioInicio video={video} vistaPrevia />
                        <span className="sr-only">Revisar: {video.title}</span>
                      </Link>
                      <div className="inicio-pendiente-cuerpo">
                        <p className="inicio-nota">
                          {canal(video.channelId)}
                          <span>
                            {video.stage === 3 ? "Guion" : "Montaje final"}
                          </span>
                        </p>
                        <h3>{video.title}</h3>
                        <div className="inicio-pendiente-accion">
                          <p>
                            {video.stage === 3
                              ? "La historia está escrita. Dale tu visto bueno."
                              : "El último corte espera tu mirada."}
                          </p>
                          <Link
                            className="boton boton-primario"
                            href={`/videos/${video.id}`}
                          >
                            Revisar <ArrowUpRight size={18} />
                          </Link>
                        </div>
                      </div>
                    </Tarjeta>
                  </Entrada>
                ))}
              </div>
            ) : (
              <p className="inicio-descanso">
                <Check size={20} />
                Todo revisado. Las próximas decisiones aparecerán aquí.
              </p>
            )}
          </section>
          <section
            id="inicio-produccion"
            className="inicio-produccion"
            aria-labelledby="inicio-produccion-titulo"
          >
            <div className="inicio-seccion-titulo">
              <h2 id="inicio-produccion-titulo">
                En producción
                <span className="inicio-cantidad">
                  {String(produccion.length).padStart(2, "0")}
                </span>
              </h2>
              <Link className="inicio-enlace" href="/videos">
                Abrir fábrica <ArrowUpRight size={18} />
              </Link>
            </div>
            {produccion.length ? (
              <div className="inicio-pistas">
                {produccion.map((video) => (
                  <Link
                    className="inicio-pista"
                    key={video.id}
                    href={`/videos/${video.id}`}
                  >
                    <div className="inicio-pista-mini">
                      <MedioInicio video={video} />
                    </div>
                    <div className="inicio-pista-identidad">
                      <span className="inicio-nota">
                        {canal(video.channelId)}
                      </span>
                      <h3>{video.title}</h3>
                    </div>
                    <div className="inicio-pista-avance">
                      <div className="inicio-pista-estado">
                        <span>
                          <i
                            data-viva={
                              video.productionState === "activa" &&
                              !esperaAprobacion(video.stage)
                            }
                          />
                          {video.productionState === "activa"
                            ? ETAPAS[video.stage]
                            : "En pausa"}
                        </span>
                        <span>
                          {String(video.stage + 1).padStart(2, "0")} / 12
                        </span>
                      </div>
                      <div
                        className="inicio-etapas"
                        role="img"
                        aria-label={`${video.stage} etapas completadas de 12. ${ETAPAS[video.stage]}`}
                      >
                        {ETAPAS.map((etapa, index) => (
                          <span
                            key={etapa}
                            data-completa={index < video.stage}
                            data-actual={index === video.stage}
                            data-viva={
                              index === video.stage &&
                              video.productionState === "activa" &&
                              !esperaAprobacion(video.stage)
                            }
                            title={etapa}
                          />
                        ))}
                      </div>
                    </div>
                    <ArrowUpRight
                      className="inicio-pista-flecha"
                      size={20}
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="inicio-descanso">
                No hay videos en producción. Cooper te ayuda con la próxima
                idea.
              </p>
            )}
          </section>
          <section
            className="inicio-metricas"
            aria-labelledby="inicio-metricas-titulo"
          >
            <div className="inicio-seccion-titulo">
              <h2 id="inicio-metricas-titulo">Cómo vamos</h2>
              <p>
                {resumen.red
                  ? `${nombreRed(resumen.red)} · Últimas mediciones`
                  : "Tus primeras cifras llegarán al publicar."}
              </p>
            </div>
            <div className="inicio-metricas-grid">
              {(
                [
                  [
                    "Vistas · 7 días",
                    resumen.vistas,
                    "Entre las mediciones de esta semana.",
                  ],
                  [
                    "Seguidores",
                    resumen.seguidores,
                    "Ganados en los últimos 7 días.",
                  ],
                  [
                    "Retención media · %",
                    resumen.retencion,
                    "Promedio ponderado por vistas medidas.",
                  ],
                  [
                    "Videos del mes",
                    resumen.videos,
                    "Creados este mes, en todos tus canales.",
                  ],
                ] as const
              ).map(([etiqueta, dato, nota]) => (
                <div
                  key={etiqueta}
                  className="inicio-metrica"
                  data-tendencia={
                    dato.variacion.startsWith("-") ? "baja" : "sube"
                  }
                >
                  <Cifra
                    etiqueta={etiqueta}
                    valor={dato.valor}
                    serie={dato.serie}
                    variacion={dato.valor === null ? undefined : dato.variacion}
                    heroe
                    compacta
                    decimales={etiqueta.startsWith("Retención") ? 1 : undefined}
                  />
                  <p>{nota}</p>
                </div>
              ))}
            </div>
            <Link className="inicio-enlace" href="/publicados">
              Mirar los resultados <ArrowRight size={18} />
            </Link>
          </section>
        </>
      ) : (
        <Empty
          title="Una idea. Todo por crear."
          description="Crea tu primer canal y dale un lugar a tu próxima historia."
        >
          <Link className="button" href="/canales">
            <Clapperboard size={18} />
            Crear mi primer canal
          </Link>
          <p className="helper">
            Cooper te acompaña desde el botón de la esquina.
          </p>
        </Empty>
      )}
    </div>
  );
}
