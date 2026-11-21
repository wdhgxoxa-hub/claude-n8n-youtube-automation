"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { m as motion } from "framer-motion";
import { Heading, Empty, useEspacio } from "./espacio";
import { NumeroAnimado, useMovimientoReducido } from "./movimiento";
import { Portada } from "./portada";
import type { Medicion } from "@/contratos/observabilidad";
const fecha = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("es", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "America/Lima",
      }).format(new Date(value))
    : "Fecha sin registrar";
const numero = (value: number | null | undefined) =>
  value == null ? "Sin dato" : new Intl.NumberFormat("es").format(value);
function Evolucion({ historial }: { historial: Medicion[] }) {
  const [metrica, setMetrica] = useState<
    "vistas" | "meGusta" | "comentarios" | "retencion"
  >("vistas");
  const reduced = useMovimientoReducido();
  const datos = [...historial].sort(
    (a, b) => Date.parse(a.fecha) - Date.parse(b.fecha),
  );
  const valores = datos.filter((d) => d[metrica] !== null);
  const max = Math.max(1, ...valores.map((d) => d[metrica]!));
  const inicio = Date.parse(datos[0]?.fecha ?? "") || 0;
  const intervalo = Math.max(
    1,
    (Date.parse(datos.at(-1)?.fecha ?? "") || 0) - inicio,
  );
  const xy = (d: Medicion) =>
    `${24 + ((Date.parse(d.fecha) - inicio) / intervalo) * 552},${120 - (d[metrica]! / max) * 96}`;
  return (
    <div className="evolution">
      <label>
        Métrica del gráfico
        <select
          value={metrica}
          onChange={(e) => setMetrica(e.target.value as typeof metrica)}
        >
          <option value="vistas">Vistas</option>
          <option value="meGusta">Me gusta</option>
          <option value="comentarios">Comentarios</option>
          <option value="retencion">Retención</option>
        </select>
      </label>
      {valores.length > 0 ? (
        <>
          <svg
            viewBox="0 0 600 150"
            role="img"
            aria-label={`Evolución de ${metrica === "meGusta" ? "me gusta" : metrica}: ${valores.length} mediciones; datos en la tabla`}
          >
            <path d="M24 24 V120 H576" className="chart-axis" />
            <motion.polyline
              className="chart-line"
              points={valores.map(xy).join(" ")}
              key={metrica}
              style={{ transformOrigin: "24px 120px" }}
              initial={{ scaleX: reduced ? 1 : 0, opacity: reduced ? 1 : 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.6 }}
            />
            {valores.map((d) => {
              const [cx, cy] = xy(d).split(",");
              return (
                <circle
                  key={d.fecha}
                  cx={cx}
                  cy={cy}
                  r="4"
                  className="chart-point"
                >
                  <title>{`${fecha(d.fecha)}: ${metrica === "retencion" ? `${Math.round(d.retencion! * 100)} %` : numero(d[metrica])}`}</title>
                </circle>
              );
            })}
          </svg>
          <div className="chart-range">
            <span>{fecha(valores[0].fecha)}</span>
            <span>{fecha(valores.at(-1)!.fecha)}</span>
          </div>
        </>
      ) : (
        <p className="muted">Todavía no hay mediciones de esta métrica.</p>
      )}
      <details>
        <summary>Ver datos de evolución</summary>
        <div className="table-scroll">
          <table>
            <caption>Mediciones de la publicación</caption>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vistas</th>
                <th>Me gusta</th>
                <th>Comentarios</th>
                <th>Retención</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.fecha}>
                  <td>{fecha(d.fecha)}</td>
                  <td>{numero(d.vistas)}</td>
                  <td>{numero(d.meGusta)}</td>
                  <td>{numero(d.comentarios)}</td>
                  <td>
                    {d.retencion === null
                      ? "Sin dato"
                      : `${Math.round(d.retencion * 100)} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
function CurvaRetencion({
  puntos,
}: {
  puntos: NonNullable<Medicion["curvaRetencion"]>;
}) {
  if (!puntos.length) return null;
  const fin = Math.max(1, ...puntos.map((p) => p.segundo));
  return (
    <details className="evolution">
      <summary>Retención por segundo</summary>
      <svg
        viewBox="0 0 600 150"
        role="img"
        aria-label="Porcentaje de audiencia que permanece en cada segundo"
      >
        <path className="chart-axis" d="M24 24 V120 H576" />
        <polyline
          className="chart-line"
          points={puntos
            .map(
              (p) =>
                `${24 + (p.segundo / fin) * 552},${120 - p.porcentaje * 96}`,
            )
            .join(" ")}
        />
      </svg>
      <div className="table-scroll">
        <table>
          <caption>Curva de retención</caption>
          <thead>
            <tr>
              <th>Segundo</th>
              <th>Audiencia que permanece</th>
            </tr>
          </thead>
          <tbody>
            {puntos.map((p, i) => (
              <tr key={i}>
                <td>{p.segundo}</td>
                <td>{Math.round(p.porcentaje * 100)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
export function Publicados() {
  const { data } = useEspacio();
  const [red, setRed] = useState("todas");
  const publicaciones = data.videos
    .flatMap((v) =>
      v.observabilidad.publicaciones.map((p) => ({ ...p, video: v })),
    )
    .sort(
      (a, b) =>
        (Date.parse(b.fecha ?? "") || 0) - (Date.parse(a.fecha ?? "") || 0),
    );
  const redes = [...new Set(publicaciones.map((p) => p.red))].sort();
  const visibles = publicaciones.filter(
    (p) => red === "todas" || p.red === red,
  );
  return (
    <div className="page">
      <Heading
        title="Publicados"
        description="Cada historia, su audiencia y lo que cambia con el tiempo."
      />
      {data.demo && (
        <p className="notice">
          Datos de demostración. Las cifras son ficticias.
        </p>
      )}
      <div className="filters" aria-label="Filtrar por red">
        {["todas", ...redes].map((r) => (
          <button key={r} aria-pressed={r === red} onClick={() => setRed(r)}>
            {r === "todas" ? "Todas las redes" : r}
          </button>
        ))}
      </div>
      {visibles.length ? (
        <div className="publications">
          {visibles.map((p) => {
            const m = p.historial.at(-1);
            return (
              <article key={`${p.video.id}:${p.id}`} className="publication">
                <div className="publication-heading">
                  <Link
                    href={`/videos/${p.video.id}`}
                    className="publication-thumb"
                    aria-label={`Ver detalle de ${p.video.title}`}
                  >
                    {p.miniatura ? (
                      <Image
                        unoptimized
                        src={p.miniatura}
                        alt=""
                        width={240}
                        height={160}
                      />
                    ) : (
                      <Portada title={p.video.title} />
                    )}
                  </Link>
                  <div>
                    <p className="muted">
                      {p.red} · {fecha(p.fecha)}
                    </p>
                    <h2>
                      <Link href={`/videos/${p.video.id}`}>
                        {p.video.title}
                      </Link>
                    </h2>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link"
                      >
                        Abrir publicación
                      </a>
                    )}
                  </div>
                </div>
                <dl className="metrics-strip">
                  {[
                    ["Vistas", m?.vistas],
                    ["Me gusta", m?.meGusta],
                    ["Comentarios", m?.comentarios],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt>{label}</dt>
                      <dd>
                        {typeof value === "number" ? (
                          <NumeroAnimado value={value} />
                        ) : (
                          "Sin dato"
                        )}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt>Retención media</dt>
                    <dd>
                      {m?.retencion == null ? (
                        "Sin dato"
                      ) : (
                        <>
                          <NumeroAnimado
                            value={Math.round(m.retencion * 100)}
                          />{" "}
                          %
                        </>
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="muted">
                  {m
                    ? `Última medición: ${fecha(m.fecha)}`
                    : "La fábrica todavía no ha recibido métricas de esta publicación."}
                </p>
                <Evolucion historial={p.historial} />
                <CurvaRetencion puntos={m?.curvaRetencion ?? []} />
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Las historias publicadas aparecerán aquí"
          description="Cuando una red confirme la publicación, podrás seguir sus resultados."
        />
      )}
    </div>
  );
}
export function Aprendizaje() {
  const { data } = useEspacio();
  const [filtro, setFiltro] = useState("todos");
  const lecciones = data.channels
    .flatMap((c) => c.lecciones.map((l) => ({ ...l, canal: c.name })))
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  const fallos = data.videos
    .flatMap((v) =>
      v.observabilidad.incidencias.map((i) => ({ ...i, video: v })),
    )
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  const retenciones = data.videos
    .flatMap((v) =>
      v.observabilidad.publicaciones.map((p) => p.historial.at(-1)?.retencion),
    )
    .filter((r): r is number => r != null);
  const media = retenciones.length
    ? Math.round(
        (retenciones.reduce((a, b) => a + b, 0) / retenciones.length) * 100,
      )
    : null;
  return (
    <div className="page">
      <Heading
        title="Aprendizaje"
        description="Lo que funciona, lo que falló y los cambios que deja cada intento."
      />
      {data.demo && (
        <p className="notice">Ejemplos de aprendizaje con datos ficticios.</p>
      )}
      <dl className="metrics-strip learning-metrics">
        <div>
          <dt>Lecciones registradas</dt>
          <dd>
            <NumeroAnimado value={lecciones.length} />
          </dd>
        </div>
        <div>
          <dt>Retención media</dt>
          <dd>
            {media === null ? (
              "Sin dato"
            ) : (
              <>
                <NumeroAnimado value={media} /> %
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Fallos corregidos</dt>
          <dd>
            <NumeroAnimado
              value={fallos.filter((i) => i.estado === "corregido").length}
            />
          </dd>
        </div>
        <div>
          <dt>Pendientes</dt>
          <dd>
            <NumeroAnimado
              value={fallos.filter((i) => i.estado === "pendiente").length}
            />
          </dd>
        </div>
      </dl>
      <p className="muted">
        Retención: media de la última medición disponible de{" "}
        {retenciones.length} publicaciones; sin estimar los datos ausentes.
      </p>
      <section className="learning-section">
        <h2>Lo que estamos aprendiendo</h2>
        {lecciones.length ? (
          lecciones.map((l) => (
            <article className="lesson" key={l.id}>
              <p className="muted">
                {l.canal} · {fecha(l.fecha)}
              </p>
              <h3>{l.resumen}</h3>
              {l.ganchos.length > 0 && (
                <p>
                  <strong>Ganchos que funcionan:</strong>{" "}
                  {l.ganchos.join(" · ")}
                </p>
              )}
              {l.temas.length > 0 && (
                <p>
                  <strong>Temas que funcionan:</strong> {l.temas.join(" · ")}
                </p>
              )}
            </article>
          ))
        ) : (
          <p>
            Las lecciones aparecerán cuando la fábrica analice resultados
            suficientes.
          </p>
        )}
      </section>
      <section className="learning-section">
        <h2>Fallos y correcciones</h2>
        <div className="filters" aria-label="Filtrar fallos">
          {["todos", "pendiente", "corregido"].map((f) => (
            <button
              key={f}
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
            >
              {f === "todos"
                ? "Todos"
                : f === "pendiente"
                  ? "Pendientes"
                  : "Corregidos"}
            </button>
          ))}
        </div>
        {fallos
          .filter((f) => filtro === "todos" || f.estado === filtro)
          .map((f) => (
            <article className="lesson" key={`${f.video.id}:${f.id}`}>
              <div className="incident-heading">
                <Link href={`/videos/${f.video.id}`}>{f.video.title}</Link>
                <span className={`incident-state ${f.estado}`}>
                  {f.estado === "corregido" ? "Corregido" : "Pendiente"}
                </span>
              </div>
              <p className="muted">
                {
                  {
                    ejecucion: "Ejecución",
                    critico: "Revisión del guion",
                    verificador: "Verificación",
                    correccion: "Cambios solicitados",
                    calidad: "Control de calidad",
                  }[f.tipo]
                }{" "}
                · {fecha(f.fecha)}
              </p>
              <h3>{f.resumen}</h3>
              <p>{f.cambio || "Todavía no hay una corrección registrada."}</p>
              {f.corregidoEn && (
                <p className="muted">Corregido el {fecha(f.corregidoEn)}</p>
              )}
            </article>
          ))}
        {!fallos.filter((f) => filtro === "todos" || f.estado === filtro)
          .length && <p>No hay fallos registrados en este estado.</p>}
      </section>
    </div>
  );
}
