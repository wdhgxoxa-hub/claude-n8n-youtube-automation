"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { api, useEspacio, Heading, Empty, Notice } from "./espacio";
import {
  camposBiblia,
  campos,
  catalogo,
  type Operacion,
  type Ajustes,
  type Control,
} from "@/contratos/operacion";
const pantallas = [
  ["biblia", "Biblia", "/canales"],
  ["radar", "Radar", "/radar"],
  ["rutina", "Rutina y metas", "/rutina"],
  ["redes", "Especialistas y redes", "/redes"],
  ["referencias", "Referencias", "/referencias"],
  ["cuentas", "Adoptar cuenta", "/cuentas"],
  ["programados", "Programados", "/programados"],
  ["decisiones", "Decisiones", "/decisiones"],
  ["incidencias", "Incidencias", "/incidencias"],
  ["avisos", "Avisos", "/avisos"],
] as const;
export type VistaOperacion = (typeof pantallas)[number][0] | "ajustes";
function fecha(value: string) {
  return value
    ? new Date(value).toLocaleString("es-PE", {
        timeZone: "America/Lima",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Sin fecha registrada";
}
function datos(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return new FormData(e.currentTarget);
}
function enlace(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
  } catch {
    return "";
  }
}
export function PantallaOperacion({
  vista,
  canalId,
}: {
  vista: VistaOperacion;
  canalId?: string;
}) {
  const { data, refresh } = useEspacio();
  const [op, setOp] = useState<Operacion | null>(null),
    [ajustes, setAjustes] = useState<Ajustes | null>(null),
    [error, setError] = useState(""),
    [mensaje, setMensaje] = useState(""),
    [cargando, setCargando] = useState(true),
    [ocupado, setOcupado] = useState(false),
    [seleccion, setSeleccion] = useState(canalId || ""),
    [pendiente, setPendiente] = useState<Control | null>(null);
  const bloqueo = useRef(false),
    confirmacion = useRef<HTMLDivElement>(null);
  const cargar = useCallback(async () => {
    try {
      if (vista === "ajustes") {
        const resultado = await api<Ajustes>("admin/fabrica", undefined, "GET");
        setAjustes(resultado);
      } else {
        const resultado = await api<Operacion>("operacion", undefined, "GET");
        setOp(resultado);
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [vista]);
  useEffect(() => {
    let activo = true;
    const consulta =
      vista === "ajustes"
        ? api<Ajustes>("admin/fabrica", undefined, "GET").then((v) => {
            if (activo) setAjustes(v);
          })
        : api<Operacion>("operacion", undefined, "GET").then((v) => {
            if (activo) setOp(v);
          });
    void consulta
      .catch((e) => {
        if (activo) setError((e as Error).message);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [vista]);
  useEffect(() => {
    if (pendiente) confirmacion.current?.focus();
  }, [pendiente]);
  const canal =
    op?.canales.find((c) => c.id === (seleccion || canalId)) || op?.canales[0];
  function preparar(control: Control) {
    if (!ocupado) {
      setPendiente(control);
      setMensaje("");
    }
  }
  async function confirmar() {
    if (!pendiente || bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    try {
      const r = await api<{ mensaje: string }>("operacion", pendiente);
      setPendiente(null);
      setMensaje(r.mensaje);
      await cargar();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  const titulo =
    vista === "ajustes"
      ? "Ajustes de la fábrica"
      : pantallas.find((p) => p[0] === vista)![1];
  const necesitaCanal = [
    "biblia",
    "radar",
    "rutina",
    "redes",
    "referencias",
    "cuentas",
  ].includes(vista);
  const base = { canalId: canal?.id || "", confirmado: true as const };
  function meta(e: FormEvent<HTMLFormElement>) {
    const f = datos(e);
    preparar({
      ...base,
      accion: "metas",
      videos_semana: Number(f.get("cantidad")),
      formato: f.get("formato") === "largo" ? "largo" : "short",
      auto: f.get("auto") === "on",
      retencion_min: Number(f.get("retencion")) / 100,
      ...(data.user.role === "admin" && f.get("presupuesto") !== ""
        ? { gasto_semana_usd: Number(f.get("presupuesto")) }
        : {}),
    });
  }
  return (
    <div className="page operation-page">
      <Heading
        title={titulo}
        description={
          vista === "ajustes"
            ? "Control administrativo. Los cambios se aplican a los siguientes pasos de producción."
            : "Lo que la fábrica sabe, decide y necesita de ti."
        }
      />
      <nav aria-label="Operación de la fábrica" className="operation-nav">
        {pantallas.map(([v, n, url]) => (
          <Link
            key={v}
            href={v === "biblia" && canal ? `/canales/${canal.id}` : url}
            aria-current={vista === v ? "page" : undefined}
          >
            {n}
          </Link>
        ))}
        {data.user.role === "admin" && (
          <Link
            href="/admin/fabrica"
            aria-current={vista === "ajustes" ? "page" : undefined}
          >
            Ajustes
          </Link>
        )}
      </nav>
      <div className="operation-toolbar">
        <p className="muted">
          {op?.modo === "simulada"
            ? "Fábrica simulada. Los ejemplos no consultan cuentas externas."
            : op
              ? `Actualizado ${fecha(op.actualizado)} · Hora de Lima`
              : ""}
        </p>
        <button
          className="button secondary"
          disabled={cargando || ocupado}
          onClick={() => void cargar()}
        >
          Actualizar
        </button>
      </div>
      <Notice error={error} message={mensaje} />
      {pendiente && (
        <div
          className="operation-confirm"
          role="region"
          aria-label="Confirmar cambios"
          tabIndex={-1}
          ref={confirmacion}
        >
          <h2>Revisa antes de confirmar</h2>
          <p>
            {pendiente.accion === "ajustes"
              ? "Estos ajustes pueden habilitar servicios con costo. Se registrará quién los cambió."
              : pendiente.accion === "reintentar"
                ? "Se revisará la última versión o el estado de publicación. Las aprobaciones siguen siendo necesarias."
                : "La fábrica recibirá esta solicitud para el recurso seleccionado."}
          </p>
          {canal && "canalId" in pendiente && (
            <p>
              Canal: <strong>{canal.nombre}</strong>
            </p>
          )}
          {pendiente.accion === "referencia" && (
            <p>
              Referencia: <strong>{pendiente.id}</strong>
            </p>
          )}
          <dl>
            {Object.entries(pendiente)
              .filter(
                ([k]) =>
                  ![
                    "confirmado",
                    "revision",
                    "canalId",
                    "id",
                    "videoId",
                  ].includes(k),
              )
              .map(([k, v]) => (
                <div key={k}>
                  <dt>
                    {(
                      {
                        accion: "Acción",
                        campo: "Campo",
                        valor: "Nuevo valor",
                        perfil: "Perfil de publicación",
                        redes: "Plataformas",
                        zona: "Zona horaria",
                        videos_semana: "Videos por semana",
                        formato: "Formato",
                        auto: "Producción automática",
                        retencion_min: "Retención mínima (0 a 1)",
                        gasto_semana_usd: "Presupuesto semanal (USD)",
                        cuenta: "Cuenta",
                        red: "Red",
                        ideaId: "Idea seleccionada",
                        decision: "Decisión",
                        cambios: "Cambios solicitados",
                        valores: "Ajustes",
                        tipo: "Tipo",
                        descripcion: "Descripción",
                        urls: "Referencias",
                      } as Record<string, string>
                    )[k] || k}
                  </dt>
                  <dd>
                    {typeof v === "object"
                      ? Object.entries(v).map(([key, val]) => (
                          <p key={key}>
                            {(catalogo as Record<string, { etiqueta: string }>)[
                              key
                            ]?.etiqueta || key}
                            : {String(val)}
                          </p>
                        ))
                      : k === "campo"
                        ? camposBiblia[v as keyof typeof camposBiblia]
                        : k === "accion"
                          ? (
                              {
                                biblia: "Actualizar biblia",
                                referencia: "Guardar referencia",
                                referencias: "Solicitar referencias",
                                radar: "Solicitar radar",
                                conectar: "Preparar conexión",
                                renovar: "Renovar decisión",
                                redes: "Configurar redes",
                                metas: "Guardar metas",
                                adoptar: "Estudiar cuenta",
                                idea: "Pedir video con esta idea",
                                decidir: "Responder decisión",
                                reintentar: "Revisar y reintentar",
                                ajustes: "Guardar ajustes administrativos",
                              } as Record<string, string>
                            )[String(v)]
                          : typeof v === "boolean"
                            ? v
                              ? "Sí"
                              : "No"
                            : String(v)}
                  </dd>
                </div>
              ))}
          </dl>
          <div className="button-row">
            <button
              className="button"
              disabled={ocupado}
              onClick={() => void confirmar()}
            >
              Confirmar solicitud
            </button>
            <button
              className="button secondary"
              disabled={ocupado}
              onClick={() => setPendiente(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {cargando && !op && !ajustes ? (
        <p role="status">Consultando la fábrica…</p>
      ) : null}
      {necesitaCanal && op && (
        <label className="operation-channel">
          Canal
          <select
            value={canal?.id || ""}
            onChange={(e) => {
              setSeleccion(e.target.value);
              setPendiente(null);
            }}
          >
            {op.canales.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {necesitaCanal && op && !canal ? (
        <Empty
          title="Crea tu primer canal"
          description="Tu biblia, ideas y metas aparecerán aquí."
        >
          <Link className="button" href="/canales">
            Crear canal
          </Link>
        </Empty>
      ) : null}
      {canal && vista === "biblia" && (
        <section key={canal.id} className="operation-sheet">
          <h2>{canal.nombre}</h2>
          <p className="muted">
            Estado: {canal.estado}. La biblia orienta los próximos videos.
          </p>
          <div className="operation-fields">
            {Object.entries(camposBiblia).map(([campo, label]) => (
              <form
                className="stack"
                key={campo}
                onSubmit={(e) => {
                  const f = datos(e);
                  preparar({
                    ...base,
                    accion: "biblia",
                    campo: campo as keyof typeof camposBiblia,
                    valor: String(f.get("valor")),
                  });
                }}
              >
                <label htmlFor={campo}>
                  {label}
                  <textarea
                    id={campo}
                    aria-label={label}
                    name="valor"
                    defaultValue={canal.biblia[campo] || ""}
                    maxLength={6000}
                    placeholder={
                      campos[campo as keyof typeof campos].tipo === "numero"
                        ? "Segundos, entre 0 y 120"
                        : undefined
                    }
                    rows={3}
                  />
                </label>
                <button
                  className="button secondary"
                  disabled={ocupado || !!pendiente}
                >
                  Revisar {label.toLowerCase()}
                </button>
              </form>
            ))}
          </div>
          <Link href="/redes" className="text-link">
            Configurar plataformas y publicación
          </Link>
        </section>
      )}
      {canal && vista === "radar" && (
        <section>
          <h2>Ideas para {canal.nombre}</h2>
          <button
            className="button secondary"
            disabled={ocupado || !!pendiente}
            onClick={() => preparar({ ...base, accion: "radar" })}
          >
            Solicitar nuevo radar
          </button>
          <p>
            {canal.radar.resumen ||
              "Aún no hay una lectura del radar para este canal."}
          </p>
          <p className="muted">{fecha(canal.radar.fecha)}</p>
          <div className="operation-list">
            {canal.radar.ideas.map((i) => (
              <article key={i.id}>
                <div>
                  <small>
                    {i.red} · {i.formato}
                  </small>
                  <h3>{i.titulo}</h3>
                  <p>{i.gancho}</p>
                  <p>{i.motivo}</p>
                  <p className="muted">
                    Fuente: {i.fuente}{" "}
                    {enlace(i.url) && (
                      <a href={enlace(i.url)} target="_blank" rel="noreferrer">
                        Ver fuente
                      </a>
                    )}
                  </p>
                </div>
                <button
                  className="button"
                  disabled={ocupado || !!pendiente}
                  onClick={() =>
                    preparar({ ...base, accion: "idea", ideaId: i.id })
                  }
                >
                  Usar idea y pedir video
                </button>
              </article>
            ))}
          </div>
          {canal.radar.sonidos.length > 0 && (
            <>
              <h2>Sonidos sugeridos</h2>
              <p className="muted">
                Los sonidos de tendencia se añaden manualmente en la red;
                comprueba los derechos.
              </p>
              {canal.radar.sonidos.map((s, i) => (
                <p key={i}>
                  <strong>{s.nombre}</strong> — {s.uso}{" "}
                  {enlace(s.url) && (
                    <a href={enlace(s.url)} target="_blank" rel="noreferrer">
                      Escuchar referencia
                    </a>
                  )}
                </p>
              ))}
            </>
          )}
        </section>
      )}
      {canal && vista === "rutina" && (
        <div className="operation-columns">
          <section>
            <h2>Decisiones del día</h2>
            {canal.rutina.length ? (
              canal.rutina.map((r, i) => (
                <article className="operation-entry" key={i}>
                  <small>{fecha(r.fecha)}</small>
                  <h3>{r.decision}</h3>
                  <p>{r.motivo}</p>
                  <p className="muted">
                    Frenos: {r.frenos.join(", ") || "Ninguno aplicado"}
                  </p>
                  {r.videoId && (
                    <Link href={`/videos/${r.videoId}`}>Ver video</Link>
                  )}
                </article>
              ))
            ) : (
              <p>
                Aún no se registró una rutina. Los registros aparecerán cuando
                se ejecute la planificación diaria.
              </p>
            )}
          </section>
          <section className="operation-sheet">
            <h2>Metas semanales</h2>
            <form
              className="stack"
              key={canal.id + JSON.stringify(canal.metas)}
              onSubmit={meta}
            >
              <label>
                Videos por semana
                <input
                  name="cantidad"
                  type="number"
                  min={0}
                  max={21}
                  required
                  defaultValue={canal.metas.videos_semana}
                />
              </label>
              <label>
                Formato
                <select name="formato" defaultValue={canal.metas.formato}>
                  <option value="short">Corto vertical</option>
                  <option value="largo">Largo</option>
                </select>
              </label>
              <label>
                Retención mínima (%)
                <input
                  name="retencion"
                  type="number"
                  min={0}
                  max={100}
                  required
                  defaultValue={Math.round(canal.metas.retencion_min * 100)}
                />
              </label>
              <label className="checkbox">
                <input
                  name="auto"
                  type="checkbox"
                  defaultChecked={canal.metas.auto}
                />
                Producir automáticamente hacia la meta
              </label>
              {data.user.role === "admin" && (
                <label>
                  Nuevo presupuesto semanal (USD)
                  <input
                    name="presupuesto"
                    type="number"
                    min={0}
                    max={200}
                    step="0.01"
                    placeholder="Conservar el actual"
                  />
                </label>
              )}
              <p className="muted">
                Cada guion y video mantiene su aprobación.
              </p>
              <button className="button" disabled={ocupado || !!pendiente}>
                Revisar metas
              </button>
            </form>
          </section>
        </div>
      )}
      {canal && vista === "redes" && (
        <div className="operation-columns">
          <section>
            <h2>Recomendaciones por video</h2>
            {canal.especialistas.length ? (
              canal.especialistas.map((s, i) => (
                <article className="operation-entry" key={i}>
                  <small>{s.red}</small>
                  <h3>{s.titulo}</h3>
                  <dl>
                    <div>
                      <dt>Horario recomendado</dt>
                      <dd>
                        {s.hora || "Sin recomendación"} · {canal.zona}
                      </dd>
                    </div>
                    <div>
                      <dt>Formato</dt>
                      <dd>{s.formato || "Según el video"}</dd>
                    </div>
                    <div>
                      <dt>Sonido</dt>
                      <dd>{s.sonido || "Sin sonido sugerido"}</dd>
                    </div>
                  </dl>
                  <p>{s.recomendacion}</p>
                  <Link href={`/videos/${s.videoId}`}>Revisar video</Link>
                </article>
              ))
            ) : (
              <p>
                Los especialistas preparan sus recomendaciones con el storyboard
                de cada video.
              </p>
            )}
          </section>
          <section className="operation-sheet">
            <h2>Publicación por red</h2>
            <div className="operation-entry">
              <h3>Conexión directa de YouTube</h3>
              <p>
                {canal.conexion.estado}
                {canal.conexion.nombre ? " · " + canal.conexion.nombre : ""}
              </p>
              <button
                className="button secondary"
                disabled={ocupado || !!pendiente}
                onClick={() => preparar({ ...base, accion: "conectar" })}
              >
                Preparar conexión de YouTube
              </button>
              {canal.conexion.url && (
                <a
                  className="text-link"
                  href={canal.conexion.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Continuar en Google
                </a>
              )}
              <p className="muted">
                Preparar el enlace no conecta la cuenta. Su propietario debe
                conceder los permisos en Google. Los perfiles de publicación en
                varias redes se gestionan por separado.
              </p>
            </div>
            <form
              className="stack"
              key={canal.id + canal.perfil}
              onSubmit={(e) => {
                const f = datos(e);
                preparar({
                  ...base,
                  accion: "redes",
                  perfil: String(f.get("perfil")),
                  redes: f.getAll("red") as (
                    "youtube" | "tiktok" | "instagram" | "facebook"
                  )[],
                  zona: String(f.get("zona")),
                });
              }}
            >
              <label>
                Perfil de publicación
                <input
                  name="perfil"
                  required
                  pattern="[A-Za-z0-9_.-]{2,60}"
                  defaultValue={canal.perfil}
                />
              </label>
              <p className="muted">
                Usa el nombre del perfil conectado por el administrador.
              </p>
              <fieldset>
                <legend>Plataformas</legend>
                {["youtube", "tiktok", "instagram", "facebook"].map((r) => (
                  <label className="checkbox" key={r}>
                    <input
                      type="checkbox"
                      name="red"
                      value={r}
                      defaultChecked={canal.redes.includes(r as "youtube")}
                    />
                    {r}
                  </label>
                ))}
              </fieldset>
              <label>
                Zona horaria
                <input name="zona" required defaultValue={canal.zona} />
              </label>
              <button className="button" disabled={ocupado || !!pendiente}>
                Revisar redes
              </button>
            </form>
          </section>
        </div>
      )}
      {canal && vista === "referencias" && (
        <section>
          <h2>Personajes y escenarios</h2>
          <p>Las referencias mantienen la identidad visual del canal.</p>
          {canal.referencias.length ? (
            canal.referencias.map((r) => (
              <article className="operation-entry" key={r.tipo + r.id}>
                <small>{r.tipo}</small>
                <h3>{r.nombre}</h3>
                <p>{r.descripcion}</p>
                {r.urls.length ? (
                  r.urls.map((u, i) => (
                    <a
                      className="text-link"
                      key={u}
                      href={enlace(u)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver referencia {i + 1}
                    </a>
                  ))
                ) : (
                  <p className="muted">Pendiente de generar.</p>
                )}
              </article>
            ))
          ) : (
            <p>
              Añade personajes o escenarios a la biblia para generar sus
              referencias.
            </p>
          )}
          <details className="operation-entry">
            <summary>Añadir o actualizar una referencia</summary>
            <form
              className="stack"
              onSubmit={(e) => {
                const f = datos(e);
                preparar({
                  ...base,
                  accion: "referencia",
                  tipo:
                    f.get("tipo") === "escenarios"
                      ? "escenarios"
                      : "personajes",
                  id: String(f.get("id")),
                  descripcion: String(f.get("descripcion")),
                  urls: String(f.get("urls"))
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean),
                });
              }}
            >
              <label>
                Tipo de referencia
                <select name="tipo">
                  <option value="personajes">Personaje</option>
                  <option value="escenarios">Escenario</option>
                </select>
              </label>
              <label>
                Nombre corto
                <input
                  name="id"
                  required
                  pattern="[a-z0-9_-]{1,60}"
                  placeholder="presentadora"
                />
              </label>
              <p className="muted">
                Usa el mismo nombre para actualizar una referencia existente.
              </p>
              <label>
                Descripción fija
                <textarea name="descripcion" required maxLength={4000} />
              </label>
              <label>
                Enlaces de referencia — uno por línea
                <textarea name="urls" placeholder="https://…" />
              </label>
              <button
                className="button secondary"
                disabled={ocupado || !!pendiente}
              >
                Revisar referencia
              </button>
            </form>
          </details>
          <button
            className="button"
            disabled={ocupado || !!pendiente}
            onClick={() => preparar({ ...base, accion: "referencias" })}
          >
            Solicitar referencias pendientes
          </button>
        </section>
      )}
      {canal && vista === "cuentas" && (
        <div className="operation-columns">
          <section>
            <h2>Identidad actual</h2>
            <p>
              {canal.cuenta.handle ||
                "Este canal todavía no tiene una cuenta adoptada."}
            </p>
            <p>{canal.cuenta.red}</p>
            <p>
              {canal.cuenta.diagnostico ||
                "El diagnóstico aparecerá después del análisis y la aprobación de la propuesta."}
            </p>
            <Link href="/decisiones">Revisar propuestas pendientes</Link>
          </section>
          <form
            className="stack operation-sheet"
            onSubmit={(e) => {
              const f = datos(e);
              preparar({
                ...base,
                accion: "adoptar",
                cuenta: String(f.get("cuenta")),
                red: f.get("red") as "youtube" | "tiktok" | "instagram",
              });
            }}
          >
            <h2>Estudiar una cuenta</h2>
            <label>
              Red
              <select name="red">
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
              </select>
            </label>
            <label>
              Usuario de la cuenta
              <input
                name="cuenta"
                placeholder="@tu_cuenta"
                pattern="@?[\w.\-]{2,60}"
                required
              />
            </label>
            <p className="muted">
              Se estudiará su identidad y se preparará una propuesta para este
              canal. La conexión para publicar se configura en Redes.
            </p>
            <button className="button" disabled={ocupado || !!pendiente}>
              Revisar adopción
            </button>
          </form>
        </div>
      )}
      {op && vista === "programados" && (
        <section>
          <h2>Calendario de publicaciones</h2>
          {op.publicaciones.length ? (
            op.publicaciones.map((p) => (
              <article className="operation-entry" key={p.id}>
                <small>
                  {p.red} · {p.estado}
                </small>
                <h3>{p.titulo}</h3>
                <p>{fecha(p.fecha)}</p>
                <p>{p.detalle}</p>
                <div className="button-row">
                  <Link href={`/videos/${p.videoId}`}>
                    Ver video y programación
                  </Link>
                  {enlace(p.url) && (
                    <a href={enlace(p.url)} target="_blank" rel="noreferrer">
                      Ver publicación
                    </a>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p>
              Las publicaciones aparecerán al programar o enviar un video
              después de su aprobación final.
            </p>
          )}
        </section>
      )}
      {op && vista === "decisiones" && (
        <section>
          <h2>Esperan tu decisión</h2>
          {op.decisiones.length ? (
            op.decisiones.map((d) => (
              <article className="operation-entry" key={d.id}>
                <small>
                  {d.etapa} · {fecha(d.fecha)}
                </small>
                <h3>{d.resumen || "Revisión pendiente"}</h3>
                <details>
                  <summary>Leer detalle completo</summary>
                  <p className="operation-detail">{d.detalle}</p>
                </details>
                {d.videoId && (
                  <Link
                    className="button secondary"
                    href={`/videos/${d.videoId}`}
                  >
                    Ver video
                  </Link>
                )}
                <form
                  className="stack"
                  onSubmit={(e) => {
                    const f = datos(e);
                    preparar({
                      accion: "decidir",
                      id: d.id,
                      confirmado: true,
                      decision: f.get("decision") as
                        "aprobar" | "cambios" | "detener",
                      cambios: String(f.get("cambios") || ""),
                    });
                  }}
                >
                  <label>
                    Decisión
                    <select name="decision">
                      {d.opciones.map((o) => (
                        <option key={o} value={o}>
                          {(
                            {
                              aprobar: "Aprobar",
                              cambios: "Pedir cambios",
                              detener: "Detener",
                            } as Record<string, string>
                          )[o] || o}
                        </option>
                      ))}
                    </select>
                  </label>
                  {d.opciones.includes("cambios") && (
                    <label>
                      Cambios solicitados
                      <textarea name="cambios" maxLength={4000} />
                    </label>
                  )}
                  <button className="button" disabled={ocupado || !!pendiente}>
                    Revisar decisión
                  </button>
                </form>
                {d.renovable && (
                  <button
                    className="button secondary"
                    disabled={ocupado || !!pendiente}
                    onClick={() =>
                      preparar({
                        accion: "renovar",
                        id: d.id,
                        confirmado: true,
                      })
                    }
                  >
                    Renovar o reenviar decisión
                  </button>
                )}
              </article>
            ))
          ) : (
            <p>No hay decisiones pendientes.</p>
          )}
        </section>
      )}
      {op && vista === "incidencias" && (
        <section>
          <h2>Recuperar la producción</h2>
          {op.fallos.length ? (
            op.fallos.map((f) => (
              <article className="operation-entry" key={f.id}>
                <small>{fecha(f.fecha)}</small>
                <h3>{f.titulo}</h3>
                <p>{f.motivo}</p>
                <p>{f.sugerencia}</p>
                <div className="button-row">
                  {f.videoId ? (
                    <Link href={`/videos/${f.videoId}`}>
                      Revisar última versión
                    </Link>
                  ) : (
                    <Link
                      href={
                        data.user.role === "admin"
                          ? "/admin/fabrica"
                          : "/decisiones"
                      }
                    >
                      Revisar{" "}
                      {data.user.role === "admin" ? "ajustes" : "decisiones"}
                    </Link>
                  )}
                  {f.reintento !== "ninguno" && (
                    <button
                      className="button secondary"
                      disabled={ocupado || !!pendiente}
                      onClick={() =>
                        preparar({
                          accion: "reintentar",
                          videoId: f.videoId,
                          confirmado: true,
                        })
                      }
                    >
                      {f.reintento === "consultar"
                        ? "Consultar publicación"
                        : "Reintentar con revisión"}
                    </button>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p>
              No hay fallos pendientes registrados. Las correcciones anteriores
              siguen en Aprendizaje.
            </p>
          )}
          <Link href="/aprendizaje">Ver aprendizaje</Link>
        </section>
      )}
      {op && vista === "avisos" && (
        <section>
          <h2>Historial de avisos</h2>
          <p className="muted">
            Enviado confirma aceptación por el servicio. Entregado y leído solo
            aparecen cuando el servicio los confirma.
          </p>
          {op.avisos.length ? (
            op.avisos.map((a) => (
              <article className="operation-entry" key={a.id}>
                <small>
                  {a.medio} · {a.estado} · {fecha(a.fecha)}
                </small>
                <h3>{a.tipo}</h3>
                <p>{a.resumen}</p>
                {a.videoId && (
                  <Link href={`/videos/${a.videoId}`}>Abrir video</Link>
                )}
              </article>
            ))
          ) : (
            <p>
              Aún no hay avisos registrados. Los avisos anteriores al registro
              no se reconstruyen.
            </p>
          )}
          <Link href="/perfil">Configurar mis avisos de WhatsApp</Link>
        </section>
      )}
      {vista === "ajustes" && ajustes && (
        <section>
          <h2>Controles de producción</h2>
          <form
            key={ajustes.revision}
            className="stack"
            onSubmit={(e) => {
              const f = datos(e);
              const valores: Record<string, string | number | boolean> = {};
              for (const [k, c] of Object.entries(catalogo)) {
                const v =
                  c.tipo === "boolean"
                    ? f.get(k) === "on"
                    : c.tipo === "number"
                      ? Number(f.get(k))
                      : String(f.get(k));
                if (v !== ajustes.valores[k]) valores[k] = v;
              }
              if (!Object.keys(valores).length) {
                setMensaje("No hay cambios que guardar.");
                return;
              }
              preparar({
                accion: "ajustes",
                revision: ajustes.revision,
                valores,
                confirmado: true,
              });
            }}
          >
            <div className="operation-fields">
              {Object.entries(catalogo).map(([k, c]) => (
                <label
                  key={k}
                  className={c.tipo === "boolean" ? "checkbox" : ""}
                >
                  {c.tipo === "boolean" ? (
                    <>
                      <input
                        type="checkbox"
                        name={k}
                        defaultChecked={ajustes.valores[k] === true}
                      />
                      {c.etiqueta}
                    </>
                  ) : (
                    <>
                      {c.etiqueta}
                      <input
                        name={k}
                        type={c.tipo === "number" ? "number" : "text"}
                        required
                        defaultValue={String(ajustes.valores[k] ?? "")}
                        min={"min" in c ? c.min : undefined}
                        max={"max" in c ? c.max : undefined}
                        step={"entero" in c && c.entero ? "1" : "any"}
                      />
                    </>
                  )}
                </label>
              ))}
            </div>
            <button className="button" disabled={ocupado || !!pendiente}>
              Revisar ajustes
            </button>
          </form>
          <h2>Registro de cambios</h2>
          {ajustes.historial.length ? (
            ajustes.historial.map((h, i) => (
              <article key={i} className="operation-entry">
                <p>
                  {fecha(h.fecha)} · {h.actor}
                </p>
                <p>
                  {h.cambios
                    .map(
                      (k) =>
                        (catalogo as Record<string, { etiqueta: string }>)[k]
                          ?.etiqueta || k,
                    )
                    .join(", ")}
                </p>
              </article>
            ))
          ) : (
            <p>Aún no se registraron cambios desde Cooper.</p>
          )}
        </section>
      )}
    </div>
  );
}
