import type { Competencia } from "@/contratos/competencia-schema";
import { competenciaVacia } from "@/contratos/competencia.mjs";
const etiquetas = {
  pendiente: "Por investigar",
  sin_datos: "Sin datos comprobados",
  parcial: "Investigación parcial",
  listo: "Investigación disponible",
};
function Fuente({ url, children }: { url: string; children: React.ReactNode }) {
  return /^https:\/\/(?:www\.|m\.)?(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com)\//i.test(
    url,
  ) ? (
    <a className="text-link" href={url} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}
export function PanelCompetencia({
  nombre,
  competencia,
}: {
  nombre: string;
  competencia?: Competencia | null;
}) {
  const c = competencia ?? competenciaVacia(nombre);
  return (
    <section
      className="competencia-panel"
      aria-label={`Competencia de ${nombre}`}
    >
      <h2>Competencia e identidad</h2>
      <p>
        <strong>{etiquetas[c.estado]}</strong>
        {c.fecha &&
          ` · ${new Date(c.fecha).toLocaleDateString("es-PE", { timeZone: "America/Lima" })}`}
      </p>
      <p>{c.resumen}</p>
      <p>{c.diferenciacion}</p>
      <p className="muted">
        Buscamos crecer en vistas, retención y seguidores. La investigación se
        renueva antes de cada idea; los patrones son hipótesis para probar.
      </p>
      {c.limitaciones.length > 0 && (
        <ul>
          {c.limitaciones.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      <div className="operation-list">
        {c.competidores.map((p) => (
          <article key={p.url}>
            <div>
              <h3>
                <Fuente url={p.url}>{p.nombre}</Fuente>
              </h3>
              <p className="muted">
                {p.red}
                {p.pais ? ` · ${p.pais}` : " · País sin confirmar"}
              </p>
              <p>{p.patron}</p>
              {p.outliers.length ? (
                p.outliers.map((v) => (
                  <p key={v.url}>
                    <Fuente url={v.url}>
                      {v.titulo || "Ver publicación destacada"}
                    </Fuente>
                    <br />
                    {v.vistas.toLocaleString("es-PE")} vistas ·{" "}
                    {v.multiplicador}× la mediana (
                    {v.mediana.toLocaleString("es-PE")}) de {v.muestra}{" "}
                    publicaciones anteriores del mismo formato.
                  </p>
                ))
              ) : (
                <p className="muted">
                  Sin publicaciones destacadas comprobables con una muestra
                  comparable.
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
      <h3>Cuentas con el mismo nombre</h3>
      {c.homonimos.length ? (
        c.homonimos.map((h) => (
          <p key={h.url}>
            <Fuente url={h.url}>{h.nombre}</Fuente> · {h.red}
            {h.pais && ` · ${h.pais}`}
            <br />
            {h.diferencia}
          </p>
        ))
      ) : (
        <p>
          No hay homónimos confirmados en esta investigación; no demuestra que
          no existan.
        </p>
      )}
      {c.comprobaciones.map((p, i) => (
        <p className="muted" key={`${p.red}-${i}`}>
          <Fuente url={p.url}>Consulta: {p.consulta}</Fuente>
        </p>
      ))}
    </section>
  );
}
