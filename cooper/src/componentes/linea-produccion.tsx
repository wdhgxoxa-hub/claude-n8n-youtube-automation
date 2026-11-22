"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { m as motion, type Transition } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Pause,
} from "lucide-react";
import { ETAPAS, esperaAprobacion } from "@/lib/etapas";
import type { Estado } from "@/servicios/datos";
import { useEspacio } from "./espacio";
import { Boton, Cifra, Medio } from "./primitivas";
import { useMovimientoReducido } from "./movimiento";
import { nombreMedio } from "./transiciones";
import styles from "./linea-produccion.module.css";

type Video = Estado["videos"][number];
type Suceso = {
  id: string;
  video: Video;
  fecha: number;
  texto: string;
  tipo: "estado" | "publicacion" | "revision";
};

const fechaCompleta = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Lima",
});
const fechaRelativa = new Intl.RelativeTimeFormat("es-PE", {
  numeric: "always",
  style: "short",
});

function observarReloj(notify: () => void) {
  const timer = setInterval(notify, 30_000);
  return () => clearInterval(timer);
}

// Los tokens viven en la hoja base estática; React vuelve a comprobar el
// snapshot al hidratar y en cada render, sin duplicar sus valores en JS.
function observarTokens() {
  return () => undefined;
}

function leerTokensRuta() {
  const css = window.getComputedStyle(document.documentElement);
  return `${css.getPropertyValue("--duracion-ruta")}|${css.getPropertyValue("--curva-salida")}`;
}

function useTransicionRuta(reducido: boolean): Transition {
  const tokens = useSyncExternalStore(observarTokens, leerTokensRuta, () => "");
  const [tiempo, curva] = tokens.split("|");
  const duracion = tiempo?.trim().match(/^(\d*\.?\d+)(ms|s)$/);
  const coordenadas = curva
    ?.trim()
    .match(/^cubic-bezier\(([^)]+)\)$/)?.[1]
    .split(",")
    .map(Number);
  if (
    reducido ||
    !duracion ||
    coordenadas?.length !== 4 ||
    !coordenadas.every(Number.isFinite) ||
    coordenadas[0] < 0 ||
    coordenadas[0] > 1 ||
    coordenadas[2] < 0 ||
    coordenadas[2] > 1
  )
    return { layout: { duration: 0 } };
  return {
    layout: {
      duration: Number(duracion[1]) / (duracion[2] === "ms" ? 1_000 : 1),
      ease: coordenadas as [number, number, number, number],
    },
  };
}

function horaRelativa(fecha: number, ahora: number) {
  if (!ahora) return fechaCompleta.format(fecha);
  const minutos = Math.max(0, Math.floor((ahora - fecha) / 60_000));
  if (minutos < 1) return "Hace un momento";
  if (minutos < 60) return fechaRelativa.format(-minutos, "minute");
  if (minutos < 1_440)
    return fechaRelativa.format(-Math.floor(minutos / 60), "hour");
  return fechaRelativa.format(-Math.floor(minutos / 1_440), "day");
}

function estadoVideo(video: Video) {
  if (video.productionState === "cancelada") return "Cancelado";
  if (video.productionState === "pausada") return "En pausa";
  if (esperaAprobacion(video.stage)) return "Necesita tu mirada";
  if (video.stage === 11) return "Publicado";
  if (video.stage === 10) return "Listo para salir";
  return "En proceso";
}

/** El estado SSE aporta actualizaciones; solo las fechas persistidas forman el feed. */
function sucesosDeVideos(videos: readonly Video[]): Suceso[] {
  const sucesos = videos.flatMap((video): Suceso[] => [
    {
      id: `estado-${video.id}`,
      video,
      fecha: video.updatedAt,
      texto:
        video.productionState !== "activa"
          ? estadoVideo(video)
          : esperaAprobacion(video.stage)
            ? "Espera tu aprobación"
            : `Actualizado · ${ETAPAS[video.stage]}`,
      tipo: "estado",
    },
    ...video.observabilidad.publicaciones.flatMap((publicacion): Suceso[] => {
      const fecha = publicacion.fecha ? Date.parse(publicacion.fecha) : NaN;
      return Number.isFinite(fecha)
        ? [
            {
              id: `publicacion-${video.id}-${publicacion.id}`,
              video,
              fecha,
              texto: `Publicado en ${publicacion.red}`,
              tipo: "publicacion",
            },
          ]
        : [];
    }),
    ...video.observabilidad.incidencias.flatMap((incidencia): Suceso[] => {
      const fecha = Date.parse(incidencia.corregidoEn || incidencia.fecha);
      return Number.isFinite(fecha)
        ? [
            {
              id: `revision-${video.id}-${incidencia.id}`,
              video,
              fecha,
              texto:
                incidencia.estado === "corregido"
                  ? "Corrección completada"
                  : "Revisión pendiente",
              tipo: "revision",
            },
          ]
        : [];
    }),
  ]);
  return sucesos
    .filter((suceso) => Number.isFinite(suceso.fecha) && suceso.fecha > 0)
    .sort((a, b) => b.fecha - a.fecha)
    .slice(0, 8);
}

export function LineaProduccion({ videos }: { videos?: readonly Video[] }) {
  const { data, connected } = useEspacio();
  const piezas = videos ?? data.videos;
  const reducido = useMovimientoReducido();
  const transicion = useTransicionRuta(reducido);
  const carril = useRef<HTMLDivElement>(null);
  const primeraVisita = useRef(true);
  const ahora = useSyncExternalStore(
    observarReloj,
    () => Math.floor(Date.now() / 30_000) * 30_000,
    () => 0,
  );
  const sucesos = sucesosDeVideos(piezas);
  const porEtapa = ETAPAS.map((_, etapa) =>
    piezas.filter((video) => video.stage === etapa),
  );
  const produciendo = piezas.filter(
    (video) => video.stage < 11 && video.productionState === "activa",
  );
  const pendientes = produciendo.filter((video) =>
    esperaAprobacion(video.stage),
  );
  const primeraEtapa = piezas.reduce(
    (min, video) => Math.min(min, video.stage),
    11,
  );
  const estaciones = porEtapa.map((videos, etapa) => {
    const fila = porEtapa
      .slice(0, etapa)
      .reduce((total, anteriores) => total + anteriores.length + 1, 1);
    return { etapa, videos, fila };
  });
  const filas = Math.max(1, ...porEtapa.map((videos) => videos.length));

  useEffect(() => {
    const elemento = carril.current;
    if (!elemento || !piezas.length) return;
    const escritorio = window.matchMedia("(min-width: 768px)");
    const colocar = () => {
      const estacion = elemento.querySelector<HTMLElement>(
        `[data-estacion="${primeraEtapa}"]`,
      );
      if (!estacion) return;
      elemento.scrollLeft = escritorio.matches ? estacion.offsetLeft : 0;
      elemento.scrollTop = escritorio.matches ? 0 : estacion.offsetTop;
    };
    if (primeraVisita.current) {
      colocar();
      primeraVisita.current = false;
    }
    escritorio.addEventListener("change", colocar);
    return () => escritorio.removeEventListener("change", colocar);
  }, [primeraEtapa, piezas.length]);

  function irAEstacion(etapa: number) {
    const elemento = carril.current;
    const estacion = elemento?.querySelector<HTMLElement>(
      `[data-estacion="${etapa}"]`,
    );
    if (elemento && estacion)
      elemento.scrollTo({
        left: estacion.offsetLeft,
        behavior: reducido ? "instant" : "smooth",
      });
  }

  function desplazar(direccion: number) {
    const elemento = carril.current;
    if (elemento) {
      const escritorio = window.matchMedia("(min-width: 768px)").matches;
      elemento.scrollBy({
        left: escritorio ? direccion * elemento.clientWidth : 0,
        top: escritorio ? 0 : direccion * elemento.clientHeight,
        behavior: reducido ? "instant" : "smooth",
      });
    }
  }

  return (
    <section className={styles.linea} aria-label="Línea de producción">
      <div className={styles.resumen}>
        <div className={styles.recorridoTitulo}>
          <p className={styles.eyebrow}>12 estaciones · Una historia</p>
          <h2>Del radar al mundo.</h2>
          <p>Abre una pieza para seguir su recorrido.</p>
        </div>
        <div
          className={styles.cifras}
          aria-label="Producción de esta selección"
        >
          <Cifra
            valor={produciendo.length}
            etiqueta="En producción"
            className={styles.cifra}
          />
          <Cifra
            valor={pendientes.length}
            etiqueta="Por revisar"
            className={styles.cifra}
          />
          <Cifra
            valor={piezas.filter((video) => video.stage === 11).length}
            etiqueta="Publicados"
            className={styles.cifra}
          />
        </div>
      </div>

      <div className={styles.composicion}>
        <div className={styles.mesa}>
          <nav className={styles.mapa} aria-label="Ir a una estación">
            {ETAPAS.map((nombre, etapa) => (
              <button
                key={nombre}
                type="button"
                className={styles.mapaEstacion}
                data-ocupada={porEtapa[etapa].length > 0}
                onClick={() => irAEstacion(etapa)}
                aria-label={`${String(etapa + 1).padStart(2, "0")} ${nombre}, ${porEtapa[etapa].length} ${porEtapa[etapa].length === 1 ? "video" : "videos"}`}
                title={nombre}
              >
                <span>{String(etapa + 1).padStart(2, "0")}</span>
                <span className={styles.mapaPunto} aria-hidden="true" />
              </button>
            ))}
          </nav>
          <motion.div
            ref={carril}
            className={styles.carril}
            layoutScroll
            tabIndex={0}
            role="region"
            aria-label="Estaciones de producción; desplázate para recorrerlas"
          >
            <div
              className={styles.pista}
              style={
                {
                  "--filas": filas,
                  "--columnas-estaciones": porEtapa
                    .map((videos) =>
                      videos.length
                        ? "var(--ancho-estacion)"
                        : "var(--espacio-96)",
                    )
                    .join(" "),
                } as CSSProperties
              }
            >
              {estaciones.map(({ etapa, videos, fila }) => (
                <motion.div
                  key={`estacion-${etapa}`}
                  layout={reducido ? false : "position"}
                  initial={false}
                  transition={transicion}
                  data-estacion={etapa}
                  className={styles.estacion}
                  data-ocupada={videos.length > 0}
                  data-aprobacion={esperaAprobacion(etapa)}
                  style={
                    {
                      "--estacion": etapa + 1,
                      "--fila-movil": fila,
                    } as CSSProperties
                  }
                >
                  <span className={styles.numeroEstacion} aria-hidden="true">
                    {String(etapa + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{ETAPAS[etapa]}</h3>
                    <p>
                      {videos.length
                        ? `${videos.length} ${videos.length === 1 ? "video" : "videos"}`
                        : "Sin videos"}
                    </p>
                  </div>
                </motion.div>
              ))}
              {piezas.map((video) => {
                const estacion = estaciones[video.stage];
                const posicion = estacion.videos.findIndex(
                  (item) => item.id === video.id,
                );
                const esperando =
                  video.productionState === "activa" &&
                  esperaAprobacion(video.stage);
                const pausado =
                  video.productionState === "pausada" ||
                  video.productionState === "cancelada";
                return (
                  <motion.article
                    key={video.id}
                    layout={reducido ? false : "position"}
                    className={styles.capsula}
                    data-capsula={video.id}
                    data-etapa={video.stage}
                    data-espera={esperando}
                    data-pausado={pausado}
                    style={
                      {
                        "--estacion": video.stage + 1,
                        "--fila": posicion + 2,
                        "--fila-movil": estacion.fila + posicion + 1,
                        "--tinte": video.medios?.tinte,
                      } as CSSProperties
                    }
                    initial={false}
                    transition={transicion}
                  >
                    <Link
                      href={`/videos/${video.id}`}
                      className={styles.enlaceCapsula}
                    >
                      <span className="sr-only">
                        {ETAPAS[video.stage]}. Abrir detalle:{" "}
                      </span>
                      <div
                        className={styles.portada}
                        data-video-transition={nombreMedio(video.id)}
                      >
                        <Medio
                          videoId={video.id}
                          mediosIniciales={video.medios}
                          alt={video.title}
                          enCola
                        />
                      </div>
                      <div className={styles.cuerpoCapsula}>
                        <span className={styles.canal}>
                          {data.channels.find(
                            (canal) => canal.id === video.channelId,
                          )?.name ?? "Tu canal"}
                        </span>
                        <h4>{video.title}</h4>
                        <span className={styles.estadoCapsula}>
                          {pausado ? (
                            <Pause size={14} aria-hidden="true" />
                          ) : video.stage === 11 ? (
                            <Check size={14} aria-hidden="true" />
                          ) : (
                            <span
                              className={styles.puntoEstado}
                              aria-hidden="true"
                            />
                          )}
                          {estadoVideo(video)}
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  </motion.article>
                );
              })}
            </div>
          </motion.div>
          <div className={styles.pieCarril}>
            <p>Recorre las 12 estaciones, de la idea a la pantalla.</p>
            <div>
              <Boton
                variante="fantasma"
                onClick={() => desplazar(-1)}
                aria-label="Ver estaciones anteriores"
              >
                <ArrowLeft size={18} />
              </Boton>
              <Boton
                variante="fantasma"
                onClick={() => desplazar(1)}
                aria-label="Ver estaciones siguientes"
              >
                <ArrowRight size={18} />
              </Boton>
            </div>
          </div>
          {!piezas.length && (
            <p className={styles.vacio}>
              La línea está lista. Tu próxima historia empieza con una idea.
            </p>
          )}
        </div>

        <aside
          className={styles.actividad}
          aria-labelledby="actividad-produccion-titulo"
        >
          <div className={styles.actividadTitulo}>
            <h2 id="actividad-produccion-titulo">Lo que está pasando</h2>
            {connected && (
              <span className={styles.enVivo}>
                <i aria-hidden="true" />
                En vivo
              </span>
            )}
          </div>
          <ol className={styles.sucesos} aria-label="Últimos movimientos">
            {sucesos.map((suceso) => (
              <motion.li
                key={suceso.id}
                data-tipo={suceso.tipo}
                layout={reducido ? false : "position"}
                initial={false}
                transition={transicion}
              >
                <span className={styles.marcaSuceso} aria-hidden="true" />
                <time
                  dateTime={new Date(suceso.fecha).toISOString()}
                  title={fechaCompleta.format(suceso.fecha)}
                >
                  {horaRelativa(suceso.fecha, ahora)}
                </time>
                <p>{suceso.texto}</p>
                <Link href={`/videos/${suceso.video.id}`}>
                  {suceso.video.title}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </motion.li>
            ))}
          </ol>
          {!sucesos.length && (
            <p className={styles.actividadVacia}>
              Los avances de tus videos aparecerán aquí.
            </p>
          )}
          <span className="sr-only" role="status">
            {sucesos[0]
              ? `${sucesos[0].video.title}: ${sucesos[0].texto}`
              : "Sin movimientos recientes"}
          </span>
        </aside>
      </div>
    </section>
  );
}
