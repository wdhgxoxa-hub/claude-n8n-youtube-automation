"use client";
import { useState } from "react";
import Link from "next/link";
import { Cifra } from "./primitivas";
import { useEspacio } from "./espacio";
import { m as motion } from "framer-motion";
import { NumeroAnimado, useMovimientoReducido } from "./movimiento";
import type {
  Medicion,
  Publicacion,
  Leccion,
} from "@/contratos/observabilidad";
export const fecha = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("es", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "America/Lima",
      }).format(new Date(value))
    : "Fecha sin registrar";
export const numero = (value: number | null | undefined) =>
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
          <Cifra etiqueta={metrica === "meGusta" ? "Me gusta" : metrica === "retencion" ? "Retención (%)" : metrica === "comentarios" ? "Comentarios" : "Vistas"} valor={metrica === "retencion" ? Math.round(valores.at(-1)![metrica]! * 100) : valores.at(-1)![metrica]!} serie={valores.map((d) => metrica === "retencion" ? d[metrica]! * 100 : d[metrica]!)} />
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
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Mediciones de la publicación"
        >
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
  fuente,
}: {
  puntos: NonNullable<Medicion["curvaRetencion"]>;
  fuente?: Medicion["curvaFuente"];
}) {
  if (!puntos.length) return null;
  const fin = Math.max(1, ...puntos.map((p) => p.segundo));
  const maximo = Math.max(1, ...puntos.map((p) => p.porcentaje));
  return (
    <details className="evolution">
      <summary>
        {fuente === "youtube_intervalos"
          ? "Retención por intervalo"
          : "Retención por segundo"}
      </summary>
      {fuente === "youtube_intervalos" && (
        <p className="muted">
          Intervalos de YouTube ubicados en segundos según la duración
          publicada. Las repeticiones pueden superar el 100 %.
        </p>
      )}
      <svg
        viewBox="0 0 600 150"
        role="img"
        aria-label="Retención en los momentos medidos del video"
      >
        <path className="chart-axis" d="M24 24 V120 H576" />
        <polyline
          className="chart-line"
          points={puntos
            .map(
              (p) =>
                `${24 + (p.segundo / fin) * 552},${120 - (p.porcentaje / maximo) * 96}`,
            )
            .join(" ")}
        />
      </svg>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Curva de retención"
      >
        <table>
          <caption>Curva de retención</caption>
          <thead>
            <tr>
              <th>Segundo</th>
              <th>Retención</th>
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
export function MetricasVideo({
  publicacion: p,
}: {
  publicacion: Publicacion;
}) {
  const m = p.historial.at(-1);
  return (
    <>
      <dl className="metrics-strip">
        {[
          ["Vistas", m?.vistas],
          ["Me gusta", m?.meGusta],
          ["Comentarios", m?.comentarios],
          ["Seguidores ganados", m?.seguidoresGanados],
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
                <NumeroAnimado value={Math.round(m.retencion * 100)} /> %
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
      <CurvaRetencion
        puntos={m?.curvaRetencion ?? []}
        fuente={m?.curvaFuente}
      />
    </>
  );
}
export function EvidenciaLeccion({ leccion: l }: { leccion: Leccion }) {
  const { data } = useEspacio();
  return (
    <>
      {!l.origenes?.length && (
        <p className="muted">
          Registro histórico sin evidencia enlazada; no se aplica
          automáticamente al guion.
        </p>
      )}
      {l.nivel && (
        <p className="muted">
          {l.nivel === "patron"
            ? "Patrón en tres o más videos; causa por contrastar."
            : "Hipótesis: necesita más videos para confirmar el patrón."}
        </p>
      )}
      {l.causa && (
        <p>
          <strong>Posible causa:</strong> {l.causa}
        </p>
      )}
      {l.correccion && (
        <p>
          <strong>Cambio propuesto:</strong> {l.correccion}
        </p>
      )}
      {!!l.origenes?.length && (
        <ul aria-label="Evidencia de la lección">
          {l.origenes.map((o, i) => (
            <li key={o.videoId + o.red + i}>
              <Link href={"/videos/" + encodeURIComponent(o.videoId)}>
                {data.videos.find((v) => v.id === o.videoId)?.title || "Video de origen"}
              </Link>
              {" · "}
              {o.red}
              {" · "}
              {o.ventana}
              {" · "}
              {
                {
                  vistas: "Vistas",
                  meGusta: "Me gusta",
                  comentarios: "Comentarios",
                  retencion: "Retención",
                  seguidoresGanados: "Seguidores ganados",
                }[o.metrica]
              }
              :{" "}
              {o.metrica === "retencion"
                ? Math.round(o.valor * 100) + " %"
                : numero(o.valor)}
              {o.segundo !== undefined && " en el segundo " + numero(o.segundo)}
              {o.demoraHoras > 0 &&
                " (captura " + o.demoraHoras + " h después del hito)"}
            </li>
          ))}
        </ul>
      )}
      {l.correccion && (
        <p className="muted">
          {l.aplicaciones?.length
            ? "Aplicada en guiones; el efecto aún necesita nuevas métricas."
            : "Pendiente de aplicar en el siguiente guion."}
        </p>
      )}
      {!!l.aplicaciones?.length && (
        <ul aria-label="Aplicaciones de la lección">
          {l.aplicaciones.map((a, i) => (
            <li key={a.videoId + i}>
              <Link href={"/videos/" + encodeURIComponent(a.videoId)}>
                Ver guion
              </Link>
              : {a.cambio}
            </li>
          ))}
        </ul>
      )}
      {l.ganchos.length > 0 && (
        <p>
          <strong>Ganchos que funcionan:</strong> {l.ganchos.join(" · ")}
        </p>
      )}
      {l.temas.length > 0 && (
        <p>
          <strong>Temas que funcionan:</strong> {l.temas.join(" · ")}
        </p>
      )}
    </>
  );
}
