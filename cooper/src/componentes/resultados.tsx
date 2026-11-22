"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Eye,
  Heart,
  RefreshCw,
  X,
} from "lucide-react";
import { api, useEspacio } from "./espacio";
import { Boton, Chip, Cifra, HojaVidrio, Medio, Vacio } from "./primitivas";
import { useVideoMedios, estiloMedio } from "./portada-video";
import { fecha, numero, MetricasVideo } from "./metricas-resultados";
import {
  filtrarResultados,
  agruparPublicaciones,
  sinFiltros,
  type Resultados,
  type FiltroResultados,
  type AmbitoResultado,
  type PublicacionResultado,
} from "@/contratos/resultados";
import type { Metricas } from "@/servicios/marcas/tipos";
import styles from "./publicados.module.css";
import { nombreMedio } from "./transiciones";

export function cantidad(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function MetricasMarca({ metricas: m }: { metricas: Metricas | null }) {
  return (
    <>
      <dl className="metrics-strip">
        {[
          ["Vistas", m?.vistas],
          ["Alcance", m?.alcance],
          ["Interacciones", m?.interacciones],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dt>{label}</dt>
            <dd data-ausente={typeof value !== "number"}>
              {numero(typeof value === "number" ? value : null)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="muted">
        {m
          ? `Última medición: ${fecha(new Date(m.capturadas).toISOString())}.`
          : "Todavía no hay métricas de esta publicación."}{" "}
        Las interacciones y el alcance conservan la definición de esta red.
      </p>
    </>
  );
}

export function Origen({
  ambito,
  simulada,
}: {
  ambito: AmbitoResultado;
  simulada: boolean;
}) {
  return (
    <p className="muted">
      {ambito.nombre} · {ambito.propietario}
      {simulada ? " · Datos de ejemplo" : ""}
    </p>
  );
}

export function Filtros({
  resultado,
  filtro,
  cambiar,
  actualizar,
  ocupado,
}: {
  resultado: Resultados;
  filtro: FiltroResultados;
  cambiar: (v: FiltroResultados) => void;
  actualizar: () => void;
  ocupado: boolean;
}) {
  const { data } = useEspacio();
  const [abierto, abrir] = useState(false);
  const periodo = useRef<HTMLDialogElement>(null);
  const id = useId();
  const ambitos = resultado.ambitos.filter(
    (a) =>
      (!filtro.tipo || a.tipo === filtro.tipo) &&
      (!filtro.ownerId || a.ownerId === filtro.ownerId),
  );
  const propietarios = [
    ...new Map(
      resultado.ambitos.map((a) => [a.ownerId, a.propietario]),
    ).entries(),
  ];
  const redes = [
    ...new Set(
      [...resultado.publicaciones, ...resultado.aprendizajes].flatMap(
        (r) => r.redes,
      ),
    ),
  ].sort();
  const activos = Object.values(filtro).filter(Boolean).length;
  return (
    <section aria-label="Filtros de resultados" className={styles.filtros}>
      <div className={styles.filaChips}>
        <Boton
          variante="secundario"
          aria-expanded={abierto}
          aria-controls={`${id}-chips`}
          onClick={() => abrir(!abierto)}
        >
          Filtros
          {activos > 0 && <span className={styles.conteo}>{activos}</span>}
          <ChevronDown size={16} aria-hidden="true" />
        </Boton>
        <Chip
          activo={Boolean(filtro.desde || filtro.hasta)}
          onClick={() => periodo.current?.showModal()}
        >
          <CalendarDays size={16} aria-hidden="true" />
          {filtro.desde || filtro.hasta ? "Periodo elegido" : "Todo el periodo"}
        </Chip>
        {activos > 0 && (
          <Boton variante="fantasma" onClick={() => cambiar({ ...sinFiltros })}>
            Limpiar filtros
          </Boton>
        )}
        <Boton
          variante="fantasma"
          className={styles.actualizar}
          aria-label={
            ocupado ? "Actualizando resultados" : "Actualizar resultados"
          }
          disabled={ocupado}
          onClick={actualizar}
        >
          <RefreshCw size={16} aria-hidden="true" />
          <span>{ocupado ? "Actualizando…" : "Actualizar"}</span>
        </Boton>
      </div>
      <div id={`${id}-chips`} hidden={!abierto} className={styles.opciones}>
        <div
          className={styles.grupoChips}
          role="group"
          aria-label="Tipo de publicación"
        >
          {[
            ["", "Todo"],
            ["video", "Videos"],
            ["marca", "Marcas"],
          ].map(([value, label]) => (
            <Chip
              key={value}
              activo={filtro.tipo === value}
              onClick={() => cambiar({ ...filtro, tipo: value, ambitoId: "" })}
            >
              {label}
            </Chip>
          ))}
        </div>
        <div
          className={styles.grupoChips}
          role="group"
          aria-label="Filtrar por red"
        >
          {["", ...redes].map((red) => (
            <Chip
              key={red}
              activo={filtro.red === red}
              onClick={() => cambiar({ ...filtro, red })}
            >
              {red || "Todas las redes"}
            </Chip>
          ))}
        </div>
        <div
          className={styles.grupoChips}
          role="group"
          aria-label="Canal o marca"
        >
          <Chip
            activo={!filtro.ambitoId}
            onClick={() => cambiar({ ...filtro, ambitoId: "" })}
          >
            Todos los canales y marcas
          </Chip>
          {ambitos.map((a) => (
            <Chip
              key={a.id}
              activo={filtro.ambitoId === a.id}
              onClick={() => cambiar({ ...filtro, ambitoId: a.id })}
            >
              {a.nombre}
              {data.user.role === "admin" ? ` · ${a.propietario}` : ""}
              <span className="sr-only">
                {" "}
                · {a.tipo === "video" ? "Canal" : "Marca"}
              </span>
            </Chip>
          ))}
        </div>
        {data.user.role === "admin" && (
          <div className={styles.grupoChips} role="group" aria-label="Dueño">
            <Chip
              activo={!filtro.ownerId}
              onClick={() => cambiar({ ...filtro, ownerId: "", ambitoId: "" })}
            >
              Todo el equipo
            </Chip>
            {propietarios.map(([ownerId, nombre]) => (
              <Chip
                key={ownerId}
                activo={filtro.ownerId === ownerId}
                onClick={() => cambiar({ ...filtro, ownerId, ambitoId: "" })}
              >
                {nombre}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <dialog
        ref={periodo}
        className={styles.dialogo}
        aria-labelledby={`${id}-periodo`}
      >
        <HojaVidrio className={styles.hoja}>
          <div className={styles.cabeceraHoja}>
            <h2 id={`${id}-periodo`}>Elegir periodo</h2>
            <Boton
              variante="fantasma"
              aria-label="Cerrar periodo"
              onClick={() => periodo.current?.close()}
            >
              <X size={20} aria-hidden="true" />
            </Boton>
          </div>
          <p>Publicaciones y lecciones de estas fechas, en hora de Lima.</p>
          <div className={styles.fechas}>
            <label>
              Desde (Lima)
              <input
                type="date"
                value={filtro.desde}
                max={filtro.hasta || undefined}
                onChange={(e) => cambiar({ ...filtro, desde: e.target.value })}
              />
            </label>
            <label>
              Hasta (Lima)
              <input
                type="date"
                value={filtro.hasta}
                min={filtro.desde || undefined}
                onChange={(e) => cambiar({ ...filtro, hasta: e.target.value })}
              />
            </label>
          </div>
          {!!filtro.desde && !!filtro.hasta && filtro.desde > filtro.hasta && (
            <p role="alert">
              La fecha de inicio debe ser anterior a la fecha final.
            </p>
          )}
          <p className="muted">
            Si una publicación aún no tiene fecha, aparece al elegir todo el
            periodo.
          </p>
          <div className={styles.filaChips}>
            <Boton
              variante="secundario"
              onClick={() => cambiar({ ...filtro, desde: "", hasta: "" })}
            >
              Todo el periodo
            </Boton>
            <Boton onClick={() => periodo.current?.close()}>
              Ver resultados
            </Boton>
          </div>
        </HojaVidrio>
      </dialog>
    </section>
  );
}

export function useResultados(initial: Resultados) {
  const [resultado, setResultado] = useState(initial);
  const [filtro, cambiar] = useState({ ...sinFiltros });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function actualizar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      setResultado(await api<Resultados>("resultados", undefined, "GET"));
      setError("");
    } catch {
      setError(
        "No pudimos actualizar. Se conservan los últimos resultados cargados.",
      );
    } finally {
      setOcupado(false);
    }
  }
  return { resultado, filtro, cambiar, actualizar, ocupado, error };
}

type Grupo = ReturnType<typeof agruparPublicaciones>[number];
function ultimaCifra(p: PublicacionResultado) {
  if (p.tipo === "marca")
    return {
      vistas: p.metricas?.vistas ?? null,
      likes: null,
      momento: p.metricas?.capturadas ?? 0,
    };
  const m = [...p.publicacion.historial].sort(
    (a, b) => Date.parse(b.fecha) - Date.parse(a.fecha),
  )[0];
  return {
    vistas: m?.vistas ?? null,
    likes: m?.meGusta ?? null,
    momento: Date.parse(m?.fecha ?? "") || 0,
  };
}
function principal(grupo: Grupo) {
  return [...grupo.registros].sort(
    (a, b) => ultimaCifra(b).momento - ultimaCifra(a).momento,
  )[0];
}
const sumaMedida = (valores: (number | null)[]) =>
  valores.some((v) => v !== null)
    ? valores.reduce<number>((suma, valor) => suma + (valor ?? 0), 0)
    : null;

function PublicacionPared({
  grupo,
  ambitos,
  abrir,
  orden,
}: {
  grupo: Grupo;
  orden: number;
  ambitos: AmbitoResultado[];
  abrir: () => void;
}) {
  const p = principal(grupo);
  const videoId =
    p.tipo === "video"
      ? (p.videoId ?? decodeURIComponent(p.href.split("/").at(-1) ?? ""))
      : "";
  const contenedor = useRef<HTMLDivElement>(null);
  const [cerca, setCerca] = useState(false);
  useEffect(() => {
    const target = contenedor.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCerca(entry.isIntersecting),
      { rootMargin: "240px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  const medio = useVideoMedios({
    videoId,
    inicial: p.tipo === "video" ? p.medios : undefined,
    publicacion: p.tipo === "video" ? p.publicacion.id : undefined,
    visible: cerca && p.tipo === "video",
  });
  // La proporción inicial reserva el espacio; la llegada del derivado no mueve la pared.
  const [proporcion] = useState(
    p.tipo === "video"
      ? (p.medios?.relacionAspecto ??
          (p.publicacion.ancho && p.publicacion.alto
            ? p.publicacion.ancho / p.publicacion.alto
            : 16 / 9))
      : 1,
  );
  const cifras = ultimaCifra(p);
  const ambito = ambitos.find((a) => a.id === p.ambitoId)!;
  return (
    <article
      className={`${styles.publicacion} publication${orden < 8 ? " entrada-estudio" : ""}`}
      data-publicacion-id={p.id}
      style={
        {
          ...estiloMedio(medio, proporcion),
          "--proporcion": proporcion,
          "--orden": Math.min(orden, 7),
        } as CSSProperties
      }
    >
      <div className={styles.marco} ref={contenedor}>
        <Link
          href={p.href}
          className={`publication-thumb ${styles.enlaceMedio}`}
          aria-label={`Ver detalle de ${p.titulo}`}
        >
          <div
            className={styles.contenedorMedio}
            data-video-transition={videoId ? nombreMedio(videoId) : undefined}
            data-video-medio={videoId || undefined}
            data-publicacion={p.tipo === "video" ? p.publicacion.id : undefined}
            data-origen={
              medio?.poster?.origen ??
              (medio?.estado === "sin_medio" ? "tipografico" : "pendiente")
            }
          >
            <Medio
              tinte={medio?.tinte}
              poster={medio?.poster?.url}
              preview={medio?.preview?.url}
              alt={p.titulo}
              videoId={videoId || undefined}
              className={styles.medio}
              proporcion={
                proporcion < 1
                  ? "vertical"
                  : proporcion === 1
                    ? "cuadrado"
                    : "horizontal"
              }
            />
          </div>
        </Link>
        <span className={styles.red}>{p.redes.join(" · ") || "Sin red"}</span>
        <button className={styles.cifrasSobreMedio} onClick={abrir}>
          <span className="sr-only">Ver cifras de {p.titulo}: </span>
          <span>
            <Eye size={16} aria-hidden="true" />
            <strong>{numero(cifras.vistas)}</strong>
            <span className="sr-only"> vistas</span>
          </span>
          <span>
            <Heart size={16} aria-hidden="true" />
            <strong>{numero(cifras.likes)}</strong>
            <span className="sr-only"> me gusta</span>
          </span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.piePublicacion}>
        <h2>
          <Link href={p.href}>{p.titulo}</Link>
        </h2>
        <p>
          {ambito.nombre} · {fecha(p.fecha)}
          {p.simulada ? " · Ejemplo" : ""}
        </p>
        {grupo.registros.length > 1 && (
          <span className={styles.lecturas}>
            {cantidad(
              grupo.registros.length,
              "medición disponible",
              "mediciones disponibles",
            )}
          </span>
        )}
      </div>
    </article>
  );
}

export function Publicados({ initial }: { initial: Resultados }) {
  const consulta = useResultados(initial);
  const { resultado, filtro, error } = consulta;
  const [orden, setOrden] = useState<"rendimiento" | "recientes">(
    "rendimiento",
  );
  const [seleccion, seleccionar] = useState<Grupo | null>(null);
  const detalle = useRef<HTMLDialogElement>(null);
  const tituloDetalle = useId();
  const visibles = filtrarResultados(
    resultado.publicaciones,
    resultado.ambitos,
    filtro,
  );
  const publicaciones = agruparPublicaciones(visibles, resultado.ambitos).sort(
    (a, b) => {
      const pa = principal(a),
        pb = principal(b);
      return (
        (orden === "rendimiento"
          ? (ultimaCifra(pb).vistas ?? -1) - (ultimaCifra(pa).vistas ?? -1) ||
            (ultimaCifra(pb).likes ?? -1) - (ultimaCifra(pa).likes ?? -1)
          : 0) ||
        (Date.parse(pb.fecha ?? "") || 0) - (Date.parse(pa.fecha ?? "") || 0)
      );
    },
  );
  const cifras = publicaciones.map((g) => ultimaCifra(principal(g)));
  const likes = sumaMedida(cifras.map((m) => m.likes));
  const cifrasLargas =
    (likes ?? 0) >= 1_000_000 || publicaciones.length >= 1_000;
  return (
    <div className={`page ${styles.pagina}`}>
      <header className={styles.cabecera}>
        <div>
          <h1>La pared</h1>
          <p className={styles.intro}>Mira qué historias llegan más lejos.</p>
        </div>
        <Link href="/marcas?seccion=publicados" className={styles.enlaceMarcas}>
          Ver marcas
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <section
        className={`${styles.heroes}${cifrasLargas ? ` ${styles.cifrasLargas}` : ""}`}
        aria-label="Cifras del periodo"
      >
        <Cifra
          heroe
          etiqueta="Vistas"
          valor={sumaMedida(cifras.map((m) => m.vistas))}
        />
        <Cifra heroe etiqueta="Me gusta de videos" valor={likes} />
        <Cifra heroe etiqueta="Publicaciones" valor={publicaciones.length} />
      </section>
      <p className={styles.aclaracion}>
        Últimas cifras de las publicaciones del periodo. Las que aún no tienen
        medición no se suman.
      </p>
      <Filtros {...consulta} />
      {error && <p role="alert">{error}</p>}
      <div className={styles.controlPared}>
        <p role="status">
          {cantidad(publicaciones.length, "publicación", "publicaciones")} ·{" "}
          {cantidad(
            visibles.length,
            "medición disponible",
            "mediciones disponibles",
          )}
        </p>
        <Boton
          variante="fantasma"
          onClick={() =>
            setOrden(orden === "rendimiento" ? "recientes" : "rendimiento")
          }
          aria-label={
            orden === "rendimiento" ? "Mejor rendimiento" : "Más recientes"
          }
        >
          <ArrowDownWideNarrow size={16} aria-hidden="true" />
          {orden === "rendimiento" ? "Mejor rendimiento" : "Más recientes"}
          <ChevronDown size={16} aria-hidden="true" />
        </Boton>
      </div>
      {publicaciones.length ? (
        <section className={styles.pared} aria-label="Publicaciones ordenadas">
          {publicaciones.map((grupo, indice) => (
            <PublicacionPared
              key={grupo.id}
              grupo={grupo}
              orden={indice}
              ambitos={resultado.ambitos}
              abrir={() => {
                seleccionar(grupo);
                detalle.current?.showModal();
              }}
            />
          ))}
        </section>
      ) : (
        <Vacio
          titulo="Tu próxima historia puede abrir esta pared"
          descripcion="Las publicaciones confirmadas aparecerán aquí, con sus imágenes y lo que consiguió cada una."
          accion={
            Object.values(filtro).some(Boolean) ? (
              <Boton
                variante="secundario"
                onClick={() => consulta.cambiar({ ...sinFiltros })}
              >
                Limpiar filtros
              </Boton>
            ) : (
              <Link className="boton boton-secundario" href="/videos">
                Ir a la fábrica
              </Link>
            )
          }
        />
      )}
      <dialog
        ref={detalle}
        className={`${styles.dialogo} ${styles.detalle}`}
        aria-labelledby={tituloDetalle}
      >
        <HojaVidrio className={styles.hoja}>
          <div className={styles.cabeceraHoja}>
            <h2 id={tituloDetalle}>
              {seleccion
                ? principal(seleccion).titulo
                : "Cifras de la publicación"}
            </h2>
            <Boton
              variante="fantasma"
              aria-label="Cerrar cifras"
              onClick={() => detalle.current?.close()}
            >
              <X size={20} aria-hidden="true" />
            </Boton>
          </div>
          {seleccion?.registros.map((p) => (
            <div className={`resultado-origen ${styles.lectura}`} key={p.id}>
              <Origen
                ambito={resultado.ambitos.find((a) => a.id === p.ambitoId)!}
                simulada={p.simulada}
              />
              <p className="muted">
                {p.redes.join(" · ")} · {fecha(p.fecha)}
                {p.tipo === "marca" ? ` · ${p.formato} · ${p.cuenta}` : ""}
              </p>
              <Link className="text-link" href={p.href}>
                Ver video o pieza: {p.titulo}
              </Link>
              {p.tipo === "video" ? (
                <>
                  {p.publicacion.url && (
                    <a
                      className="text-link"
                      href={p.publicacion.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir publicación
                    </a>
                  )}
                  <MetricasVideo publicacion={p.publicacion} />
                </>
              ) : (
                <MetricasMarca metricas={p.metricas} />
              )}
            </div>
          ))}
        </HojaVidrio>
      </dialog>
    </div>
  );
}

export { Aprendizaje } from "./aprendizaje-vista";
