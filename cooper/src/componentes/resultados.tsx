"use client";
import { useState } from "react";
import { InterruptorAprendizaje } from "./control-aprendizaje";
import Link from "next/link";
import { api, Heading, Empty, useEspacio } from "./espacio";
import { Medio } from "./primitivas";
import { nombreMedio } from "./transiciones";
import { PortadaVideo } from "./portada-video";
import {
  fecha,
  numero,
  MetricasVideo,
  EvidenciaLeccion,
} from "./metricas-resultados";
import {
  filtrarResultados,
  agruparPublicaciones,
  sinFiltros,
  type Resultados,
  type FiltroResultados,
  type AmbitoResultado,
} from "@/contratos/resultados";
import type { Metricas } from "@/servicios/marcas/tipos";

function cantidad(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function MetricasMarca({ metricas: m }: { metricas: Metricas | null }) {
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
function Origen({
  ambito,
  simulada,
}: {
  ambito: AmbitoResultado;
  simulada: boolean;
}) {
  return (
    <p className="muted">
      {ambito.tipo === "video" ? "Video" : "Marca"} · {ambito.nombre} ·{" "}
      {ambito.propietario} · {ambito.id.split(":").at(-1)?.slice(0, 8)}
      {simulada ? " · Datos simulados" : ""}
    </p>
  );
}
function Filtros({
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
  return (
    <section aria-label="Filtros de resultados" className="resultados-filtros">
      <div className="resultados-campos">
        <label>
          Tipo
          <select
            value={filtro.tipo}
            onChange={(e) =>
              cambiar({ ...filtro, tipo: e.target.value, ambitoId: "" })
            }
          >
            <option value="">Videos y Marcas</option>
            <option value="video">Videos</option>
            <option value="marca">Marcas</option>
          </select>
        </label>
        {data.user.role === "admin" && (
          <label>
            Dueño
            <select
              value={filtro.ownerId}
              onChange={(e) =>
                cambiar({ ...filtro, ownerId: e.target.value, ambitoId: "" })
              }
            >
              <option value="">Todo el equipo</option>
              {propietarios.map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre} · {id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Canal o marca
          <select
            value={filtro.ambitoId}
            onChange={(e) => cambiar({ ...filtro, ambitoId: e.target.value })}
          >
            <option value="">Todos los ámbitos</option>
            {ambitos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tipo === "video" ? "Canal" : "Marca"}: {a.nombre} ·{" "}
                {a.propietario} · {a.id.split(":").at(-1)?.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
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
      <div className="filters" role="group" aria-label="Filtrar por red">
        {["", ...redes].map((red) => (
          <button
            key={red}
            aria-pressed={filtro.red === red}
            onClick={() => cambiar({ ...filtro, red })}
          >
            {red || "Todas las redes"}
          </button>
        ))}
      </div>
      <div className="filters">
        <button onClick={() => cambiar({ ...sinFiltros })}>
          Limpiar filtros
        </button>
        <button disabled={ocupado} onClick={actualizar}>
          {ocupado ? "Actualizando…" : "Actualizar resultados"}
        </button>
      </div>
      <p className="muted">
        Fechas de publicación o aprendizaje en Lima. Sin fecha registrada, el
        resultado aparece al quitar el intervalo. Las lecciones sin red
        identificada aparecen en «Todas las redes».
      </p>
      {!!filtro.desde && !!filtro.hasta && filtro.desde > filtro.hasta && (
        <p role="alert">
          La fecha de inicio debe ser anterior a la fecha final.
        </p>
      )}
    </section>
  );
}
function useResultados(initial: Resultados) {
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
export function Publicados({ initial }: { initial: Resultados }) {
  const consulta = useResultados(initial);
  const { data } = useEspacio();
  const { resultado, filtro, error } = consulta;
  const visibles = filtrarResultados(
    resultado.publicaciones,
    resultado.ambitos,
    filtro,
  );
  const publicaciones = agruparPublicaciones(visibles, resultado.ambitos);
  return (
    <div className="page">
      <Heading
        title="Publicados"
        description="Videos y piezas de tus marcas, con sus resultados y origen."
        action={
          <Link className="button secondary" href="/marcas?seccion=publicados">
            Publicados de marcas
          </Link>
        }
      />
      <Filtros {...consulta} />
      {error && <p role="alert">{error}</p>}
      <p role="status">
        {cantidad(publicaciones.length, "publicación", "publicaciones")} ·{" "}
        {cantidad(visibles.length, "resultado", "resultados")}
      </p>
      <p className="muted">
        Cada red conserva sus propias cifras para que puedas comparar cómo va
        cada publicación.
      </p>
      {publicaciones.length ? (
        <div className="publications">
          {publicaciones.map((grupo) => {
            const primero = grupo.registros[0];
            const video =
              primero.tipo === "video"
                ? data.videos.find(
                    (v) =>
                      primero.href === `/videos/${encodeURIComponent(v.id)}`,
                  )
                : undefined;
            return (
              <article key={grupo.id} className="publication">
                <div className="publication-heading">
                  <Link
                    href={primero.href}
                    className="publication-thumb"
                    aria-label={`Ver detalle de ${primero.titulo}`}
                  >
                    <div
                      data-video-transition={
                        video ? nombreMedio(video.id) : undefined
                      }
                    >
                      {primero.tipo === "video" ? (
                        <PortadaVideo
                          videoId={
                            primero.videoId ??
                            decodeURIComponent(
                              primero.href.split("/").at(-1) ?? "",
                            )
                          }
                          titulo={primero.titulo}
                          inicial={primero.medios}
                          publicacion={primero.publicacion.id}
                        />
                      ) : (
                        <Medio alt="Miniatura pendiente" />
                      )}
                    </div>
                  </Link>
                  <div>
                    <p className="muted">{primero.redes.join(" · ")}</p>
                    <h2>
                      <Link href={primero.href}>{primero.titulo}</Link>
                    </h2>
                  </div>
                </div>
                {grupo.registros.length > 1 && (
                  <p>
                    Una publicación, {grupo.registros.length} registros.
                    Conservamos las mediciones de cada origen.
                  </p>
                )}
                {grupo.registros.map((p) => (
                  <div className="resultado-origen" key={p.id}>
                    <Origen
                      ambito={resultado.ambitos.find(
                        (a) => a.id === p.ambitoId,
                      )!}
                      simulada={p.simulada}
                    />
                    <Link className="text-link" href={p.href}>
                      Ver origen: {p.titulo}
                    </Link>
                    <p className="muted">
                      {fecha(p.fecha)}
                      {p.tipo === "marca"
                        ? ` · ${p.formato} · ${p.cuenta}`
                        : ""}
                    </p>
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
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="No hay publicaciones para estos filtros"
          description="Las publicaciones confirmadas aparecerán aquí. Puedes limpiar los filtros para ver todos los resultados disponibles."
        />
      )}
    </div>
  );
}
export function Aprendizaje({ initial }: { initial: Resultados }) {
  const { data } = useEspacio();
  const consulta = useResultados(initial);
  const { resultado, filtro, error } = consulta;
  const [estado, setEstado] = useState("todos");
  const lecciones = filtrarResultados(
    resultado.aprendizajes,
    resultado.ambitos,
    filtro,
  );
  const fallos = filtrarResultados(
    resultado.incidencias,
    resultado.ambitos,
    filtro,
  );
  const visibles = fallos.filter(
    (f) => estado === "todos" || f.incidencia.estado === estado,
  );
  return (
    <div className="page">
      <Heading
        title="Aprendizaje"
        description="Lecciones de videos, resultados de Marcas y cambios registrados, en una consulta."
        action={
          <Link className="button secondary" href="/marcas?seccion=aprendizaje">
            Aprendizaje de marcas
          </Link>
        }
      />
      {data.demo && (
        <p className="notice">Ejemplos de aprendizaje con datos ficticios.</p>
      )}
      {data.user.role === "admin" && <InterruptorAprendizaje />}
      <Filtros {...consulta} />
      {error && <p role="alert">{error}</p>}
      <p role="status">
        {cantidad(
          lecciones.filter((l) => l.tipo === "video").length,
          "lección",
          "lecciones",
        )}{" "}
        de videos ·{" "}
        {cantidad(
          lecciones.filter((l) => l.tipo === "marca").length,
          "registro",
          "registros",
        )}{" "}
        de Marcas
      </p>
      <p className="muted">
        Las observaciones de Marcas y las lecciones de videos conservan su
        alcance. Consulta la retención, las vistas y las interacciones en cada
        publicación.
      </p>
      <section className="learning-section">
        <h2>Lo que estamos aprendiendo</h2>
        {lecciones.map((l) => (
          <article className="lesson" key={l.id}>
            <Origen
              ambito={resultado.ambitos.find((a) => a.id === l.ambitoId)!}
              simulada={l.simulada}
            />
            <p className="muted">
              {fecha(l.fecha)} · {l.redes.join(" · ") || "Red sin identificar"}
            </p>
            <h3>{l.titulo}</h3>
            <Link className="text-link" href={l.href}>
              Ver origen
            </Link>
            {l.tipo === "video" ? (
              <EvidenciaLeccion leccion={l.leccion} />
            ) : (
              <>
                <p>
                  {l.clase === "estudio"
                    ? "Estudio descriptivo; no es una lección validada."
                    : "Observación de la pieza; no es una lección validada."}
                </p>
                <p>{l.resumen}</p>
                {l.aviso && <p>{l.aviso}</p>}
                {l.clase === "resultado" && (
                  <MetricasMarca metricas={l.metricas} />
                )}
              </>
            )}
          </article>
        ))}
        {!lecciones.length && <p>No hay aprendizajes para estos filtros.</p>}
      </section>
      <section className="learning-section">
        <h2>Fallos y correcciones de videos</h2>
        <div className="filters" role="group" aria-label="Filtrar fallos">
          {["todos", "pendiente", "corregido"].map((f) => (
            <button
              key={f}
              aria-pressed={estado === f}
              onClick={() => setEstado(f)}
            >
              {f === "todos"
                ? "Todos"
                : f === "pendiente"
                  ? "Pendientes"
                  : "Corregidos"}
            </button>
          ))}
        </div>
        {visibles.map((r) => (
          <article className="lesson" key={r.id}>
            <div className="incident-heading">
              <Link href={r.href}>{r.titulo}</Link>
              <span className={`incident-state ${r.incidencia.estado}`}>
                {r.incidencia.estado === "corregido"
                  ? "Corregido"
                  : "Pendiente"}
              </span>
            </div>
            <Origen
              ambito={resultado.ambitos.find((a) => a.id === r.ambitoId)!}
              simulada={r.simulada}
            />
            <p className="muted">
              {
                {
                  ejecucion: "Ejecución",
                  critico: "Revisión del guion",
                  verificador: "Verificación",
                  correccion: "Cambios solicitados",
                  calidad: "Control de calidad",
                }[r.incidencia.tipo]
              }{" "}
              · {fecha(r.fecha)}
            </p>
            <h3>{r.incidencia.resumen}</h3>
            <p>
              {r.incidencia.cambio ||
                "Todavía no hay una corrección registrada."}
            </p>
            {r.incidencia.corregidoEn && (
              <p className="muted">
                Corregido el {fecha(r.incidencia.corregidoEn)}
              </p>
            )}
          </article>
        ))}
        {!visibles.length && <p>No hay fallos registrados en este estado.</p>}
      </section>
    </div>
  );
}
