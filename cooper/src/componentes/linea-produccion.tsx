"use client";

import { nombreRed } from "@/lib/redes";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
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
  numeric: "auto",
  style: "long",
});
const capitalizar = (texto: string) =>
  texto.charAt(0).toLocaleUpperCase("es-PE") + texto.slice(1);

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
    .map((valor) => (valor.trim() ? Number(valor) : NaN));
  const segundos = duracion
    ? Number(duracion[1]) / (duracion[2] === "ms" ? 1_000 : 1)
    : 0;
  if (
    reducido ||
    !duracion ||
    !Number.isFinite(segundos) ||
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
      duration: segundos,
      ease: coordenadas as [number, number, number, number],
    },
  };
}

function horaRelativa(fecha: number, ahora: number) {
  if (!ahora) return fechaCompleta.format(fecha);
  const minutos = Math.max(0, Math.floor((ahora - fecha) / 60_000));
  if (minutos < 1) return "Hace un momento";
  if (minutos < 60)
    return capitalizar(fechaRelativa.format(-minutos, "minute"));
  if (minutos < 1_440)
    return capitalizar(fechaRelativa.format(-Math.floor(minutos / 60), "hour"));
  return capitalizar(fechaRelativa.format(-Math.floor(minutos / 1_440), "day"));
}

/** Proporción real del medio, acotada para que ninguna cápsula se dispare. */
function proporcionMedio(video: Video) {
  const medios = video.medios;
  const real =
    medios?.poster?.ancho && medios.poster.alto
      ? medios.poster.ancho / medios.poster.alto
      : medios?.relacionAspecto;
  return Math.min(16 / 9, Math.max(4 / 5, real && real > 0 ? real : 16 / 9));
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
              texto: `Publicado en ${nombreRed(publicacion.red)}`,
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
    .slice(0, 6);
}

/** Lleva la estación al borde izquierdo, justo después del desvanecido. */
function izquierdaDe(estacion: HTMLElement) {
  const margen = Number.parseFloat(
    getComputedStyle(estacion.parentElement?.parentElement ?? estacion)
      .scrollPaddingInlineStart,
  );
  return Math.max(
    0,
    estacion.offsetLeft - (Number.isFinite(margen) ? margen : 0),
  );
}

export function LineaProduccion({
  videos,
  filtros,
}: {
  videos?: readonly Video[];
  filtros?: ReactNode;
}) {
  const { data, connected } = useEspacio();
  const piezas = videos ?? data.videos;
  const reducido = useMovimientoReducido();
  const transicion = useTransicionRuta(reducido);
  const carril = useRef<HTMLDivElement>(null);
  const primeraVisita = useRef(true);
  const arrastre = useRef({
    activo: false,
    movido: false,
    x: 0,
    inicio: 0,
  });
  const [vista, setVista] = useState({
    desde: 1,
    hasta: 1,
    inicio: true,
    fin: false,
  });
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

  const medirVista = useCallback(() => {
    const elemento = carril.current;
    if (!elemento) return;
    const horizontal = window.matchMedia("(min-width: 768px)").matches;
    const primera = elemento.querySelector<HTMLElement>('[data-estacion="1"]');
    const paso = primera ? primera.offsetLeft : 0;
    const hueco = primera ? paso - primera.offsetWidth : 0;
    const maximo = elemento.scrollWidth - elemento.clientWidth;
    const inicio = !horizontal || elemento.scrollLeft <= 1;
    const fin = !horizontal || elemento.scrollLeft >= maximo - 1;
    const desde = paso
      ? Math.min(12, Math.max(1, Math.round(elemento.scrollLeft / paso) + 1))
      : 1;
    const hasta = paso
      ? Math.min(
          12,
          Math.max(
            desde,
            Math.floor(
              (elemento.scrollLeft + elemento.clientWidth + hueco + 1) / paso,
            ),
          ),
        )
      : 12;
    setVista((previa) =>
      previa.desde === desde &&
      previa.hasta === hasta &&
      previa.inicio === inicio &&
      previa.fin === fin
        ? previa
        : { desde, hasta, inicio, fin },
    );
  }, []);

  useEffect(() => {
    const elemento = carril.current;
    if (!elemento || !piezas.length) return;
    const escritorio = window.matchMedia("(min-width: 768px)");
    const colocar = () => {
      const estacion = elemento.querySelector<HTMLElement>(
        `[data-estacion="${primeraEtapa}"]`,
      );
      if (estacion)
        elemento.scrollLeft = escritorio.matches ? izquierdaDe(estacion) : 0;
      medirVista();
    };
    if (primeraVisita.current) {
      colocar();
      primeraVisita.current = false;
    }
    const observador = new ResizeObserver(medirVista);
    observador.observe(elemento);
    escritorio.addEventListener("change", colocar);
    return () => {
      observador.disconnect();
      escritorio.removeEventListener("change", colocar);
    };
  }, [primeraEtapa, piezas.length, medirVista]);

  /** Un paso es una estación: la columna más el hueco, siempre la misma. */
  function paso() {
    const elemento = carril.current;
    const primera = elemento?.querySelector<HTMLElement>('[data-estacion="1"]');
    return primera?.offsetLeft || 0;
  }

  function irAEstacion(etapa: number) {
    const elemento = carril.current;
    const estacion = elemento?.querySelector<HTMLElement>(
      `[data-estacion="${etapa}"]`,
    );
    if (!elemento || !estacion) return;
    if (window.matchMedia("(min-width: 768px)").matches)
      elemento.scrollTo({
        left: izquierdaDe(estacion),
        behavior: reducido ? "instant" : "smooth",
      });
    else
      estacion.scrollIntoView({
        block: "start",
        behavior: reducido ? "instant" : "smooth",
      });
  }

  function desplazar(direccion: number) {
    const elemento = carril.current;
    if (!elemento) return;
    const unidad = paso();
    const estaciones = Math.max(
      1,
      Math.floor(elemento.clientWidth / (unidad || elemento.clientWidth)) - 1,
    );
    elemento.scrollBy({
      left: direccion * estaciones * unidad,
      behavior: reducido ? "instant" : "smooth",
    });
  }

  function teclado(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.target !== evento.currentTarget) return;
    const elemento = evento.currentTarget;
    const comportamiento = reducido ? "instant" : "smooth";
    if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
      evento.preventDefault();
      elemento.scrollBy({
        left: (evento.key === "ArrowRight" ? 1 : -1) * paso(),
        behavior: comportamiento,
      });
    } else if (evento.key === "Home" || evento.key === "End") {
      evento.preventDefault();
      elemento.scrollTo({
        left: evento.key === "Home" ? 0 : elemento.scrollWidth,
        behavior: comportamiento,
      });
    }
  }

  function empezarArrastre(evento: PointerEvent<HTMLDivElement>) {
    if (evento.pointerType !== "mouse" || evento.button !== 0) return;
    arrastre.current = {
      activo: true,
      movido: false,
      x: evento.clientX,
      inicio: evento.currentTarget.scrollLeft,
    };
  }

  function moverArrastre(evento: PointerEvent<HTMLDivElement>) {
    const estado = arrastre.current;
    if (!estado.activo) return;
    const distancia = evento.clientX - estado.x;
    if (!estado.movido && Math.abs(distancia) < 5) return;
    if (!estado.movido) {
      estado.movido = true;
      evento.currentTarget.setPointerCapture(evento.pointerId);
      evento.currentTarget.dataset.arrastrando = "true";
    }
    evento.currentTarget.scrollLeft = estado.inicio - distancia;
  }

  function terminarArrastre(evento: PointerEvent<HTMLDivElement>) {
    const estado = arrastre.current;
    if (!estado.activo) return;
    estado.activo = false;
    delete evento.currentTarget.dataset.arrastrando;
    if (evento.currentTarget.hasPointerCapture(evento.pointerId))
      evento.currentTarget.releasePointerCapture(evento.pointerId);
    // El clic que cierra un arrastre no debe abrir la cápsula bajo el cursor.
    if (estado.movido) setTimeout(() => (estado.movido = false), 0);
  }

  return (
    <section className={styles.linea} aria-label="Línea de producción">
      <h2 className="sr-only">Del radar al mundo.</h2>
      <div className={styles.resumen}>
        {filtros}
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
          <motion.div
            ref={carril}
            className={styles.carril}
            layoutScroll
            tabIndex={0}
            role="region"
            aria-label="Estaciones de producción; desplázate para recorrerlas"
            data-inicio={vista.inicio}
            data-fin={vista.fin}
            onScroll={medirVista}
            onKeyDown={teclado}
            onPointerDown={empezarArrastre}
            onPointerMove={moverArrastre}
            onPointerUp={terminarArrastre}
            onPointerCancel={terminarArrastre}
            onClickCapture={(evento) => {
              if (arrastre.current.movido) {
                evento.preventDefault();
                evento.stopPropagation();
              }
            }}
          >
            <div
              className={styles.pista}
              style={{ "--filas": filas } as CSSProperties}
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
                  <button
                    type="button"
                    className={styles.numeroEstacion}
                    onClick={() => irAEstacion(etapa)}
                    aria-label={`${String(etapa + 1).padStart(2, "0")} ${ETAPAS[etapa]}, ${videos.length} ${videos.length === 1 ? "video" : "videos"}`}
                  >
                    {String(etapa + 1).padStart(2, "0")}
                  </button>
                  <div className={styles.nombreEstacion}>
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
                const vivo =
                  video.productionState === "activa" &&
                  video.stage < 11 &&
                  !esperando;
                return (
                  <motion.article
                    key={video.id}
                    layout={reducido ? false : "position"}
                    className={styles.capsula}
                    data-capsula={video.id}
                    data-etapa={video.stage}
                    data-espera={esperando}
                    data-pausado={pausado}
                    data-vivo={vivo}
                    style={
                      {
                        "--estacion": video.stage + 1,
                        "--fila": posicion + 2,
                        "--fila-movil": estacion.fila + posicion + 1,
                        "--proporcion": proporcionMedio(video).toFixed(4),
                        "--tinte": video.medios?.tinte,
                      } as CSSProperties
                    }
                    initial={false}
                    transition={transicion}
                  >
                    <Link
                      href={`/videos/${video.id}`}
                      className={styles.enlaceCapsula}
                      draggable={false}
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
                        <span className={styles.etapa} aria-hidden="true">
                          Etapa {String(video.stage + 1).padStart(2, "0")}
                        </span>
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
                          <span>{estadoVideo(video)}</span>
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
            <p aria-live="off">
              Estaciones <strong>{vista.desde}</strong>–
              <strong>{vista.hasta}</strong> de 12 · arrastra o usa las flechas
            </p>
            <div>
              <Boton
                variante="fantasma"
                onClick={() => desplazar(-1)}
                disabled={vista.inicio}
                aria-label="Ver estaciones anteriores"
              >
                <ArrowLeft size={18} />
              </Boton>
              <Boton
                variante="fantasma"
                onClick={() => desplazar(1)}
                disabled={vista.fin}
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
                <p>{suceso.texto}</p>
                <Link href={`/videos/${suceso.video.id}`}>
                  <span>{suceso.video.title}</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
                <time
                  dateTime={new Date(suceso.fecha).toISOString()}
                  title={fechaCompleta.format(suceso.fecha)}
                >
                  {horaRelativa(suceso.fecha, ahora)}
                </time>
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
