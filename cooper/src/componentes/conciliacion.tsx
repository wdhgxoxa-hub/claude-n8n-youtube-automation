"use client";
import { useState } from "react";
import type {
  CasoConciliacion,
  PanelConciliacion,
} from "@/servicios/conciliacion";
import { api, Notice } from "./espacio";
import { Esqueleto, Vacio } from "./primitivas";
import "./operacion-diseno.css";
export function ConciliacionAdmin() {
  const [data, setData] = useState<PanelConciliacion | null>(null);
  const [seleccion, setSeleccion] = useState<CasoConciliacion | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function cargar() {
    setBusy(true);
    setError("");
    try {
      setData(
        await api<PanelConciliacion>("admin/conciliacion", undefined, "GET"),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack identity-reviews conciliacion-diseno">
      <h2>Operaciones por conciliar</h2>
      <p>
        Consulta el resultado de una operación interrumpida. Ninguna acción de
        esta sección reenvía, publica ni libera reservas.
      </p>
      <Notice error={error} />
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void cargar()}
      >
        Consultar operaciones interrumpidas
      </button>
      {busy && !data && (
        <Esqueleto
          className="operacion-carga"
          etiqueta="Buscando operaciones interrumpidas…"
        />
      )}
      {data && (
        <>
          <p className="helper">
            Hasta {data.limitePorTipo} operaciones por tipo. Conserva el
            identificador para consultar un cierre.
          </p>
          {!data.casos.length && (
            <Vacio
              titulo="Todo está revisado"
              descripcion="No hay operaciones por conciliar."
            />
          )}
          {data.casos.map((c) => (
            <div className="stack identity-review" key={`${c.tipo}:${c.id}`}>
              <strong>
                {c.tipo} · {c.estado}
              </strong>
              <p style={{ overflowWrap: "anywhere" }}>
                {c.propietario}
                {c.cuenta ? ` · ${c.cuenta}` : ""}
              </p>
              <p className="helper" style={{ overflowWrap: "anywhere" }}>
                ID: {c.id}
                <br />
                Referencia: {c.referencia || "Sin identificador remoto"}
              </p>
              <button
                className="button secondary small"
                disabled={busy}
                onClick={() => setSeleccion(c)}
              >
                Revisar operación {c.id}
              </button>
            </div>
          ))}
          <details className="conciliacion-buscar">
            <summary>Buscar una operación por ID</summary>
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  const params = new URLSearchParams({
                    tipo: String(f.get("tipo")),
                    id: String(f.get("id")),
                  });
                  setSeleccion(
                    await api<CasoConciliacion>(
                      `admin/conciliacion?${params}`,
                      undefined,
                      "GET",
                    ),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Tipo de operación
                <select name="tipo">
                  {[
                    "chat",
                    "fabrica",
                    "whatsapp",
                    "accion_whatsapp",
                    "marca",
                    "ingesta",
                  ].map((tipo) => (
                    <option key={tipo}>{tipo}</option>
                  ))}
                </select>
              </label>
              <label>
                Identificador de operación
                <input name="id" required maxLength={512} />
              </label>
              <button className="button secondary" disabled={busy}>
                Buscar operación por ID
              </button>
            </form>
          </details>
          {seleccion && (
            <form
              className="stack identity-review"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  const result = await api<CasoConciliacion>(
                    "admin/conciliacion",
                    {
                      tipo: seleccion.tipo,
                      id: seleccion.id,
                      huella: seleccion.huella,
                      accion: f.get("accion"),
                      referencia: f.get("referencia"),
                      remoto: f.get("remoto"),
                      comprobado: f.get("comprobado") === "on",
                    },
                  );
                  setSeleccion(result);
                  setData(
                    await api<PanelConciliacion>(
                      "admin/conciliacion",
                      undefined,
                      "GET",
                    ),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3>Revisión de la operación</h3>
              <p style={{ overflowWrap: "anywhere" }}>
                {seleccion.propietario}
                {seleccion.cuenta ? ` · ${seleccion.cuenta}` : ""}
              </p>
              <p style={{ overflowWrap: "anywhere" }}>
                {seleccion.id} · {seleccion.estado}
              </p>
              {seleccion.cierre ? (
                <p role="status">
                  Cierre registrado: {seleccion.cierre.accion}. Evidencia:{" "}
                  {seleccion.cierre.referencia || seleccion.cierre.fuente}.
                </p>
              ) : (
                <>
                  <label>
                    Decisión
                    <select name="accion" aria-label="Decisión de conciliación">
                      <option value="consultar">
                        Consultar recibo o estado guardado
                      </option>
                      <option value="archivar">
                        Cerrar sin reenvío; conservar bloqueo
                      </option>
                      <option value="confirmar">
                        Confirmar resultado con evidencia revisada
                      </option>
                    </select>
                  </label>
                  <label>
                    Referencia de evidencia
                    <input
                      name="referencia"
                      maxLength={240}
                      placeholder="Identificador del informe o recibo revisado"
                    />
                  </label>
                  <label>
                    Identificador remoto comprobado
                    <input name="remoto" maxLength={512} />
                  </label>
                  <label className="checkbox-label">
                    <input name="comprobado" type="checkbox" />
                    He cotejado operación, cuenta y resultado. La referencia no
                    contiene claves ni datos privados.
                  </label>
                  <p className="helper">
                    Cerrar conserva el resultado como desconocido. Confirmar
                    registra tu comprobación; no concede permisos ni ejecuta
                    acciones de cuenta.
                  </p>
                  <button
                    className="button"
                    disabled={busy || seleccion.enCurso || !seleccion.pendiente}
                  >
                    Guardar conciliación
                  </button>
                  {seleccion.enCurso && (
                    <p>
                      La operación sigue en curso. Actualiza antes de decidir.
                    </p>
                  )}
                </>
              )}
            </form>
          )}
          <details>
            <summary>Últimas 50 consultas y decisiones</summary>
            <ul>
              {data.historial.map((h) => (
                <li key={h.id} style={{ overflowWrap: "anywhere" }}>
                  {h.accion} · {h.fuente} ·{" "}
                  {h.referencia || "Consulta por identificador"} ·{" "}
                  {new Date(h.fecha).toLocaleString("es-PE")}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
