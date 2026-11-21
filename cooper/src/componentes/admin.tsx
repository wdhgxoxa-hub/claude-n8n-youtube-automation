"use client";
import { useState, type FormEvent } from "react";
import { ShieldCheck, Plus, Trash2, TriangleAlert } from "lucide-react";
import type { Administracion } from "@/servicios/datos";
import { api, Heading, Notice } from "./espacio";
import { motion } from "framer-motion";
import { Indicador, NumeroAnimado, useMovimientoReducido } from "./movimiento";
export function Admin({ initial }: { initial: Administracion }) {
  const reduced = useMovimientoReducido();
  const [data, setData] = useState(initial),
    [period, setPeriod] = useState<"day" | "week" | "month">("day"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const money = (v: number) =>
    new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "USD",
    }).format(v);
  async function mutate(path: string, value: unknown, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await api(path, value, method);
      setData(await api<Administracion>("admin", undefined, "GET"));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const saved = await mutate("admin/permitidos", {
      email: new FormData(form).get("email"),
    });
    if (saved) form.reset();
  }
  const total = data.users.reduce((a, u) => a + u[period], 0);
  return (
    <div className="page">
      <Heading
        title="El equipo, en perspectiva"
        description="Acceso y gasto. Solo visibles para ti."
        action={
          <span className="admin-badge">
            <ShieldCheck size={16} />
            Administrador
          </span>
        }
      />
      <Notice error={error} />
      {data.users.some((u) => u.alert) && (
        <div role="alert" className="spend-alert">
          <TriangleAlert size={22} />
          <div>
            <strong>Gasto diario alto</strong>
            <p>
              {data.users
                .filter((u) => u.alert)
                .map((u) => u.name)
                .join(", ")}{" "}
              superó {money(data.threshold)} hoy. La producción continúa sin
              bloqueo.
            </p>
          </div>
        </div>
      )}
      <section className="spend-section">
        <div className="spend-head">
          <div>
            <span className="muted">Gasto del equipo</span>
            <p className="spend-total">
              <NumeroAnimado value={total} money />
            </p>
          </div>
          <div className="filters">
            {(
              [
                ["day", "Hoy"],
                ["week", "Semana"],
                ["month", "Mes"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
              >
                {period === value && <Indicador id="periodo-gasto" />}
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="helper">
          Periodos de calendario en UTC.{" "}
          {data.fuente === "simulada"
            ? "Importes de ejemplo."
            : data.fuente === "n8n_estimado"
              ? "Gastos registrados por la fábrica; incluyen estimaciones según uso y tarifas configuradas."
              : "Gastos registrados por la fábrica."}
        </p>
        <div className="team-table" role="table" aria-label="Gasto por usuario">
          <div className="team-row table-head" role="row">
            <span role="columnheader">Persona</span>
            <span role="columnheader">Gasto</span>
            <span role="columnheader">Acceso</span>
          </div>
          {data.users.map((u) => (
            <div className="team-row" role="row" key={u.id}>
              <div role="cell">
                <strong>{u.name}</strong>
                <small>{u.email}</small>
                <div className="spend-bar">
                  <motion.div
                    initial={false}
                    animate={{ scaleX: total ? u[period] / total : 0 }}
                    transition={{
                      duration: reduced ? 0 : 0.7,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <span key={period} className="spend-bar-ink" />
                  </motion.div>
                </div>
              </div>
              <span role="cell">
                <NumeroAnimado value={u[period]} money />
                {u.alert && <small>Alerta diaria</small>}
              </span>
              <span role="cell">
                {u.role === "admin" ? (
                  "Administrador"
                ) : (
                  <button
                    className="button secondary small"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        `admin/usuarios/${u.id}`,
                        { active: !u.active },
                        "PATCH",
                      )
                    }
                  >
                    {u.active ? "Desactivar" : "Reactivar"}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="stack identity-reviews">
        <h2>Revisión de identidad</h2>
        <p>
          Comprueba que conoces a la persona, que corresponde a la cuenta y que
          lee la frase completa. Si hay dudas, pide que la repita en persona. No
          apruebes por la frase solamente.
        </p>
        {data.identidades.length === 0 && (
          <p className="helper">No hay identidades pendientes.</p>
        )}
        {data.identidades.map((a) => (
          <form
            key={a.id}
            className="identity-review stack"
            onSubmit={async (event) => {
              event.preventDefault();
              const f = new FormData(event.currentTarget);
              await mutate(`identidades/${a.id}`, {
                aceptar: f.get("decision") === "aceptar",
                comprobado: f.get("comprobado") === "on",
              });
            }}
          >
            <h3>
              {a.name} · {data.users.find((u) => u.id === a.ownerId)?.email}
            </h3>
            <blockquote>{a.phrase}</blockquote>
            <p className="helper">
              {a.consentText} · {new Date(a.consentAt).toLocaleString("es-PE")}
            </p>
            <div className="button-row">
              {(JSON.parse(a.photoIds) as string[]).map((photo, i) => (
                <a
                  key={photo}
                  className="button secondary small"
                  href={`/api/revision-archivo/${a.id}/${photo}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir foto {i + 1}
                </a>
              ))}
              <a
                className="button secondary small"
                href={`/api/revision-archivo/${a.id}/${a.evidenceId}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir grabación
              </a>
            </div>
            <label>
              Decisión
              <select name="decision">
                <option value="rechazar">
                  Rechazar y pedir nueva evidencia
                </option>
                <option value="aceptar">
                  Identidad comprobada; iniciar entrenamiento
                </option>
              </select>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="comprobado" required />
              He revisado la grabación, la frase y la identidad de la persona.
            </label>
            <button className="button" disabled={busy}>
              Guardar revisión
            </button>
          </form>
        ))}
      </section>
      <section className="allow-section">
        <div>
          <h2>Personas invitadas</h2>
          <p>
            Solo estos correos pueden entrar con Google. Hasta diez cuentas.
          </p>
          <form className="invite-form" onSubmit={invite}>
            <label className="sr-only" htmlFor="email">
              Correo permitido
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="persona@equipo.com"
              required
              maxLength={254}
            />
            <button className="button" disabled={busy}>
              <Plus size={17} />
              Invitar
            </button>
          </form>
        </div>
        <ul className="allowed-list">
          {data.allowed.map((a) => (
            <li key={a.email}>
              <span>{a.email}</span>
              <button
                className="icon-button"
                aria-label={`Retirar ${a.email}`}
                disabled={
                  busy ||
                  data.users.some(
                    (u) => u.email === a.email && u.role === "admin",
                  )
                }
                onClick={() =>
                  void mutate(
                    `admin/permitidos/${encodeURIComponent(a.email)}`,
                    undefined,
                    "DELETE",
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
