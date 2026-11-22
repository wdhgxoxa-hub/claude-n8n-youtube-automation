"use client";
import { PanelCompetencia } from "./competencia";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plus,
  Palette,
  CalendarDays,
  BookOpen,
  ArrowUpRight,
  X,
} from "lucide-react";
import { api, Heading, Notice, useEspacio } from "./espacio";
import type { EstadoMarcas } from "@/servicios/marcas/servicio";
import type { Marca, PiezaMarca } from "@/db/schema";
import { formatos, redes, rubros } from "@/servicios/marcas/opciones";
import {
  plantillasIglesia,
  proximaFechaIglesia,
  revisionDoctrinalIglesia,
} from "@/servicios/marcas/iglesia";
import { IglesiaEditorial } from "./marcas-iglesia";

import { crearPlantillaTienda } from "@/servicios/marcas/tienda-contenido";
import { PanelMarcaTienda } from "./marca-tienda";
import { Boton, Chip, HojaVidrio, Vacio } from "./primitivas";
import "./marcas-diseno.css";
type MarcaVista = EstadoMarcas["marcas"][number];
const fechaDispositivo = (fecha: number) =>
  new Date(fecha - new Date(fecha).getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const nombreRubro = {
  "iglesia-reformada": "Iglesia reformada",
  moda: "Moda y tienda",
  general: "Otro rubro",
};
const etiquetas = {
  domingo: "Encuentro del domingo",
  grupos: "Grupos en casa",
  evento: "Próximo encuentro",
  coleccion: "Nueva colección",
  libre: "Una nueva historia",
};
export function Marcas({
  initial,
  piezaId,
  marcaId,
  seccionInicial = "calendario",
}: {
  initial: EstadoMarcas;
  piezaId?: string;
  marcaId?: string;
  seccionInicial?:
    | "calendario"
    | "estudio"
    | "competencia"
    | "publicados"
    | "aprendizaje"
    | "tienda";
}) {
  const editorId = useId();
  const { data: espacio } = useEspacio(),
    admin = espacio.user.role === "admin";
  const [data, setData] = useState(initial),
    [seleccion, setSeleccion] = useState(
      initial.marcas.find((m) => m.piezas.some((p) => p.id === piezaId))?.id ??
        initial.marcas.find((m) => m.id === marcaId)?.id ??
        initial.marcas[0]?.id ??
        "",
    ),
    [editor, setEditor] = useState(false),
    [editarGuia, setEditarGuia] = useState(false),
    [seccion, setSeccion] = useState<string>(seccionInicial),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [editar, setEditar] = useState<PiezaMarca>();
  const [conexionAbierta, setConexionAbierta] = useState(false);
  const [citasAbiertas, setCitasAbiertas] = useState(false);
  const [business, setBusiness] = useState<Record<string, boolean>>({});
  const editorOrigin = useRef<HTMLElement | null>(null);
  const newBrandButton = useRef<HTMLButtonElement>(null);
  const restoreEditorFocus = useRef(false);
  useEffect(() => {
    if (!editor && !busy && restoreEditorFocus.current) {
      restoreEditorFocus.current = false;
      if (document.activeElement === document.body)
        (editorOrigin.current?.isConnected
          ? editorOrigin.current
          : newBrandButton.current
        )?.focus();
    }
  }, [editor, busy]);
  function abrirEditor(editar = false) {
    editorOrigin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setEditarGuia(editar);
    setEditor(true);
  }
  function cerrarEditor() {
    restoreEditorFocus.current = true;
    setEditor(false);
  }
  const marca = data.marcas.find((m) => m.id === seleccion);
  const { definirMarca } = useEspacio();
  useEffect(() => {
    definirMarca(marca ? { id: marca.id, nombre: marca.nombre } : null);
    return () => definirMarca(null);
  }, [marca, definirMarca]);
  const seccionActiva =
    seccion === "tienda" && !marca?.guia.tienda ? "calendario" : seccion;
  const guiaVisible = marca && (
    <>
      <p>{marca.guia.tono}</p>
      <small>
        {data.propietarios.find((u) => u.id === marca.ownerId)?.name ??
          "Dueño de la marca"}{" "}
        · {marca.zona} ·{" "}
        {marca.guia.tipografia === "serif"
          ? "Tipografía con remates"
          : "Tipografía sin remates"}
      </small>
    </>
  );
  function cambiarSeccion(valor: string, marcaSeleccionada = marca?.id) {
    setSeccion(valor);
    const url = new URL(window.location.href);
    url.searchParams.set("seccion", valor);
    if (marcaSeleccionada) url.searchParams.set("marca", marcaSeleccionada);
    url.searchParams.delete("pieza");
    window.history.replaceState(null, "", url.pathname + url.search);
  }
  async function refresh() {
    setData(await api<EstadoMarcas>("marcas", undefined, "GET"));
  }
  async function ejecutar(task: () => Promise<unknown>, mensaje = "Guardado.") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      await refresh();
      setMessage(mensaje);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const archivoMarcas = (
    <section className="marcas-archivo" aria-label="Tus marcas">
      {marcaId && <h2 className="marca-archivo-titulo">Tus marcas</h2>}
      {data.marcas.map((m) => {
        const proxima = [...m.piezas]
          .filter((p) =>
            ["programada", "pendiente", "borrador"].includes(p.estado),
          )
          .sort((a, b) => a.programada - b.programada)[0];
        const redesMarca = [
          ...new Set(
            m.cuentas.filter((c) => c.estado !== "revocada").map((c) => c.red),
          ),
        ];
        return (
          <button
            key={m.id}
            className={`marca-selector ${m.id === seleccion ? "selected" : ""}`}
            style={{ "--tinte-marca": m.guia.colores[0] } as CSSProperties}
            aria-pressed={m.id === seleccion}
            onClick={() => {
              setSeleccion(m.id);
              setEditar(undefined);
              setConexionAbierta(false);
              cambiarSeccion(
                seccion === "tienda" && !m.guia.tienda ? "calendario" : seccion,
                m.id,
              );
            }}
          >
            <span className="marca-tarjeta-cabecera">
              <AvatarMarca marca={m} />
              <span className="marca-rubro">{nombreRubro[m.rubro]}</span>
              <ArrowUpRight size={20} aria-hidden="true" />
            </span>
            <strong className="marca-tarjeta-nombre">{m.nombre}</strong>
            <span className="marca-redes" aria-label="Redes de la marca">
              {redesMarca.length ? (
                redesMarca.map((red) => <span key={red}>{red}</span>)
              ) : (
                <span>Tu voz, por compartir</span>
              )}
            </span>
            <span className="marca-proxima">
              <span>Próxima publicación</span>
              <strong>
                {proxima?.datos.titulo ?? "Un espacio para tu próxima historia"}
              </strong>
              <small>
                {proxima
                  ? `${new Intl.DateTimeFormat("es-PE", { timeZone: m.zona, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(proxima.programada)} · ${proxima.estado === "programada" ? "Programada" : "Por revisar"}`
                  : "Todavía sin fecha"}
              </small>
            </span>
          </button>
        );
      })}
    </section>
  );
  return (
    <div className="page marcas-page">
      <Heading
        title="Marcas"
        description="Una identidad para cada voz. Un lugar para cuidar lo que compartes."
        action={
          !editor && data.marcas.length > 0 ? (
            <button
              ref={newBrandButton}
              className="button primary"
              disabled={busy}
              aria-expanded={editor}
              aria-controls={editor ? editorId : undefined}
              onClick={() => abrirEditor()}
            >
              <Plus size={18} />
              Añadir marca o cuenta
            </button>
          ) : undefined
        }
      />
      {!editor && !conexionAbierta && (
        <Notice error={error} message={message} />
      )}
      {editor && (
        <HojaMarca
          titulo={editarGuia ? "Editar guía" : "Añadir marca"}
          cerrar={cerrarEditor}
          busy={busy}
        >
          <Notice error={error} message={message} />
          <EditorMarca
            id={editorId}
            marca={editarGuia ? marca : undefined}
            data={data}
            busy={busy}
            guardar={(v) =>
              ejecutar(async () => {
                const m = await api<Marca>(
                  editarGuia && marca ? `marcas/${marca.id}` : "marcas",
                  v,
                );
                setSeleccion(m.id);
                setConexionAbierta(false);
                cambiarSeccion(m.guia.tienda ? "tienda" : "calendario", m.id);
                cerrarEditor();
              }, "Guía de marca guardada.")
            }
          />
          {admin && !editarGuia && (
            <div className="actions">
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void ejecutar(async () => {
                    const m = await api<Marca>("marcas/iglesia", {});
                    setSeleccion(m.id);
                    setEditar(undefined);
                    setSeccion("calendario");
                    cerrarEditor();
                    const url = new URL(window.location.href);
                    url.searchParams.set("marca", m.id);
                    url.searchParams.set("seccion", "calendario");
                    url.searchParams.delete("pieza");
                    window.history.replaceState(
                      null,
                      "",
                      url.pathname + url.search,
                    );
                  }, "Iglesia preparada. Revisa la identidad provisional y los pendientes pastorales.")
                }
              >
                Preparar Iglesia (por confirmar)
              </button>
            </div>
          )}
        </HojaMarca>
      )}
      <>
        {!data.marcas.length ? (
          <Vacio
            className="marca-vacia"
            titulo="Cada marca, su propia voz."
            descripcion="Dale un lugar a tu iglesia, tu tienda o esa próxima idea. Cooper cuida su identidad contigo."
            accion={
              <button
                ref={newBrandButton}
                className="button primary"
                disabled={busy}
                onClick={() => abrirEditor()}
              >
                <Plus size={18} /> Crear mi primera marca
              </button>
            }
          >
            <span className="marca-vacia-sello" aria-hidden="true">
              <Palette size={32} />
            </span>
          </Vacio>
        ) : (
          <div className="marcas-layout">
            {!marcaId && archivoMarcas}
            {marca && (
              <div
                className="marca-mesa"
                style={
                  { "--tinte-marca": marca.guia.colores[0] } as CSSProperties
                }
              >
                <section
                  className="marca-identidad"
                  aria-labelledby="marca-nombre"
                >
                  <div>
                    <p className="marca-ceja">El universo de tu marca</p>
                    <h2 id="marca-nombre">{marca.nombre}</h2>
                    {marcaId ? (
                      <details className="marca-guia-resumen" key={marca.id}>
                        <summary>Guía de la marca</summary>
                        <div>{guiaVisible}</div>
                      </details>
                    ) : (
                      guiaVisible
                    )}
                  </div>
                  <div className="marca-herramientas">
                    <Boton
                      variante="secundario"
                      onClick={() => setConexionAbierta(true)}
                    >
                      Cuentas y conexión
                    </Boton>
                    <Boton
                      variante="fantasma"
                      onClick={() => abrirEditor(true)}
                    >
                      Editar guía
                    </Boton>
                  </div>
                </section>
                {conexionAbierta && (
                  <HojaMarca
                    titulo="Cuentas y conexión"
                    cerrar={() => setConexionAbierta(false)}
                    busy={busy}
                  >
                    <Notice error={error} message={message} />
                    <div className="marca-conexion">
                      <ol>
                        <li>
                          Elige la red y solicita la conexión de tu cuenta.
                        </li>
                        <li>
                          Walter asigna la página e Instagram profesional a
                          Cooper Estudio, o conecta YouTube/TikTok en el perfil
                          de publicación existente.
                        </li>
                        <li>
                          Walter verifica el acceso. Después puedes estudiar la
                          cuenta y preparar contenido.
                        </li>
                      </ol>
                      {marca.cuentas.map((c) => (
                        <div className="marca-cuenta" key={c.id}>
                          <div>
                            <strong>{c.alias}</strong>
                            <p>
                              {c.red} · {c.estado}
                              {c.simulada ? " · Simulada" : ""}
                            </p>
                          </div>
                          {admin &&
                            c.red === "instagram" &&
                            c.estado !== "conectada" && (
                              <label className="choice">
                                <input
                                  type="checkbox"
                                  checked={business[c.id] ?? false}
                                  onChange={(e) =>
                                    setBusiness({
                                      ...business,
                                      [c.id]: e.target.checked,
                                    })
                                  }
                                />
                                Confirmé en Meta que es Business (habilita
                                historias).
                              </label>
                            )}
                          {admin && c.estado !== "conectada" && (
                            <button
                              className="button"
                              disabled={busy}
                              onClick={() =>
                                void ejecutar(
                                  () =>
                                    api(`marcas/cuenta/${c.id}`, {
                                      accion: "conectar",
                                      businessConfirmada:
                                        business[c.id] ?? false,
                                    }),
                                  "Conexión verificada.",
                                )
                              }
                            >
                              Verificar conexión
                            </button>
                          )}
                          {c.estado !== "revocada" && (
                            <button
                              className="button"
                              disabled={busy}
                              onClick={() =>
                                void ejecutar(
                                  () =>
                                    api(`marcas/cuenta/${c.id}`, {
                                      accion: "revocar",
                                    }),
                                  "Cuenta desconectada.",
                                )
                              }
                            >
                              Desconectar
                            </button>
                          )}
                        </div>
                      ))}
                      <form
                        className="marca-form-grid"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void ejecutar(
                            () =>
                              api(`marcas/${marca.id}/cuentas`, {
                                red: f.get("red"),
                                alias: f.get("alias"),
                                remoto: f.get("remoto"),
                                pagina: f.get("pagina") || undefined,
                              }),
                            "Cuenta registrada. Walter debe verificarla.",
                          );
                        }}
                      >
                        <label>
                          Red
                          <select name="red">
                            {redes.map((r) => (
                              <option key={r}>{r}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Nombre de la cuenta
                          <input
                            name="alias"
                            required
                            maxLength={100}
                            placeholder="@mi_cuenta"
                          />
                        </label>
                        <label>
                          Identificador de cuenta o perfil
                          <input
                            name="remoto"
                            required
                            maxLength={100}
                            placeholder="Lo proporciona Walter"
                          />
                        </label>
                        <label>
                          Página vinculada (para Instagram)
                          <input
                            name="pagina"
                            inputMode="numeric"
                            pattern="[0-9]+"
                          />
                        </label>
                        <button className="button" disabled={busy}>
                          Añadir cuenta
                        </button>
                      </form>
                    </div>
                  </HojaMarca>
                )}
                <nav className="marca-tabs" aria-label="Secciones de la marca">
                  {[
                    ...(marca.guia.tienda ? [["tienda", "Tienda"]] : []),
                    ["calendario", "Calendario"],
                    ["estudio", "Estudio"],
                    ["competencia", "Competencia"],
                    ["publicados", "Publicados"],
                    ["aprendizaje", "Aprendizaje"],
                  ].map(([v, label]) => (
                    <Chip
                      activo={seccionActiva === v}
                      aria-current={seccionActiva === v ? "page" : undefined}
                      key={v}
                      onClick={() => cambiarSeccion(v)}
                    >
                      {label}
                    </Chip>
                  ))}
                </nav>
                {seccionActiva === "tienda" && marca.guia.tienda && (
                  <PanelMarcaTienda zona={marca.zona} />
                )}
                {seccion === "competencia" && (
                  <div>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        void ejecutar(
                          () => api(`marcas/${marca.id}/competencia`, {}),
                          "Investigación actualizada.",
                        )
                      }
                    >
                      Investigar competencia
                    </button>
                    <PanelCompetencia
                      nombre={marca.nombre}
                      competencia={marca.competencia}
                    />
                  </div>
                )}
                {seccion === "estudio" && (
                  <section className="marca-estudio">
                    <BookOpen size={26} />
                    <h3>Estudiar antes de publicar</h3>
                    <p>
                      Reúne textos, imágenes disponibles, horarios y rendimiento
                      de tus publicaciones anteriores.
                    </p>
                    <button
                      className="button"
                      disabled={
                        busy ||
                        !marca.cuentas.some((c) => c.estado === "conectada")
                      }
                      onClick={() =>
                        void ejecutar(
                          () => api(`marcas/${marca.id}/estudio`, {}),
                          "Estudio actualizado.",
                        )
                      }
                    >
                      Estudiar la cuenta
                    </button>
                    {marca.estudio && (
                      <>
                        <p>{marca.estudio.estilo}</p>
                        <p>
                          <strong>
                            {marca.estudio.frecuencia} publicaciones por semana
                          </strong>{" "}
                          ·{" "}
                          {marca.estudio.horas.map((h) => `${h}:00`).join(", ")}{" "}
                          ({marca.zona})
                        </p>
                        <p>{marca.estudio.evidencia}</p>
                        <ul>
                          {marca.estudio.pilares.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                        <small>
                          Muestra: {marca.estudio.muestra} publicaciones.{" "}
                          {marca.estudio.visuales} referencias visuales
                          disponibles.
                        </small>
                        <details>
                          <summary>Ver evidencia del historial</summary>
                          {marca.estudio.historial.map((h) => (
                            <article key={h.id}>
                              <p>{h.texto}</p>
                              <small>
                                {h.fecha} · Alcance:{" "}
                                {h.metricas.alcance ?? "Sin datos"}
                              </small>
                              {h.imagen && (
                                <a
                                  href={h.imagen}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Revisar imagen original
                                </a>
                              )}
                            </article>
                          ))}
                        </details>
                      </>
                    )}
                  </section>
                )}
                {seccionActiva === "calendario" && (
                  <>
                    <div className="marca-calendario-titulo">
                      <CalendarDays size={24} />
                      <h3>Próximas publicaciones</h3>
                    </div>
                    <p>
                      El horario sugerido usa {marca.zona}. Walter aprueba cada
                      revisión.
                    </p>
                    <EditorPieza
                      key={`${marca.id}-${editar?.id ?? "nueva"}-${editar?.revision ?? 0}-${marca.piezas.length}`}
                      marca={marca}
                      archivos={data.archivos}
                      montajes={data.montajes}
                      actualizarMontajes={() =>
                        ejecutar(
                          () => api("marcas/montajes", {}),
                          "Montajes actualizados. Selecciona la revisión que vas a usar.",
                        )
                      }
                      citas={data.citas}
                      pieza={editar}
                      errorOperacion={error}
                      cerrar={() => setEditar(undefined)}
                      busy={busy}
                      guardar={(v) =>
                        ejecutar(async () => {
                          if (editar)
                            await api(`marcas/pieza/${editar.id}`, {
                              accion: "editar",
                              revision: editar.revision,
                              datos: v,
                            });
                          else await api(`marcas/${marca.id}/piezas`, v);
                          setEditar(undefined);
                        }, "Borrador guardado. Prepara la vista previa para enviar a Walter.")
                      }
                      proponer={async (tema) => {
                        const r = await api<{
                          texto: string;
                          simulada: boolean;
                        }>(`marcas/${marca.id}/texto`, { tema });
                        setMessage(
                          r.simulada
                            ? "Propuesta simulada: revisa y adapta el texto."
                            : "Propuesta del especialista: revisa el texto antes de guardar.",
                        );
                        return r.texto;
                      }}
                      upload={async (f) => {
                        const encoded = await new Promise<string>(
                          (resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () =>
                              resolve(String(reader.result).split(",")[1]);
                            reader.onerror = reject;
                            reader.readAsDataURL(f);
                          },
                        );
                        const r = await api<{ id: string }>("archivos", {
                          name: f.name,
                          mime: f.type,
                          data: encoded,
                        });
                        await refresh();
                        return r.id;
                      }}
                    />
                    {marca.piezas
                      .filter((p) => p.estado !== "publicada")
                      .map((p) => (
                        <Pieza
                          key={p.id}
                          p={p}
                          marca={marca}
                          admin={admin}
                          busy={busy}
                          errorOperacion={error}
                          editar={() => setEditar(p)}
                          accion={(accion, doctrina) =>
                            ejecutar(
                              () =>
                                api(`marcas/pieza/${p.id}`, {
                                  accion,
                                  revision: p.revision,
                                  doctrina,
                                }),
                              accion === "enviar"
                                ? "Pieza lista para la revisión de Walter."
                                : "Decisión guardada.",
                            )
                          }
                        />
                      ))}
                    {!marca.piezas.some((p) => p.estado !== "publicada") && (
                      <div className="marca-calendario-vacio">
                        <p>La próxima historia aún está por escribir.</p>
                        <span>
                          Prepara una publicación; aquí la verás crecer hasta
                          estar lista.
                        </span>
                      </div>
                    )}
                    {marca.rubro === "iglesia-reformada" && (
                      <IglesiaEditorial />
                    )}
                  </>
                )}
                {seccion === "publicados" && (
                  <section className="marca-resultados">
                    <h3>Publicados</h3>
                    <Link className="text-link" href="/publicados">
                      Ver videos publicados
                    </Link>
                    <p>
                      Las métricas ausentes se muestran como «Sin datos».{" "}
                      {data.simulada
                        ? "Los valores de este modo son ficticios."
                        : "Se actualizan con la automatización de la marca."}
                    </p>
                    {marca.piezas
                      .filter((p) => p.estado === "publicada")
                      .map((p) => (
                        <Pieza
                          key={p.id}
                          p={p}
                          marca={marca}
                          admin={admin}
                          busy={busy}
                          errorOperacion={error}
                          editar={() => {}}
                          accion={async () => {}}
                        />
                      ))}
                    {!marca.piezas.some((p) => p.estado === "publicada") && (
                      <p className="muted">
                        Todavía no hay publicaciones confirmadas.
                      </p>
                    )}
                  </section>
                )}
                {seccion === "aprendizaje" && (
                  <section className="marca-resultados">
                    <h3>Aprendizaje de la marca</h3>
                    <Link className="text-link" href="/aprendizaje">
                      Ver aprendizaje de videos
                    </Link>
                    <p>
                      Conserva los resultados y las interrupciones para ajustar
                      el próximo calendario.
                    </p>
                    {marca.piezas
                      .filter((p) => p.aviso || p.metricas)
                      .map((p) => (
                        <article
                          className="marca-aprendizaje"
                          key={p.id}
                          id={`aprendizaje-${p.id}`}
                        >
                          <h4>{p.datos.titulo}</h4>
                          <p>
                            {p.aviso ||
                              `Resultado observado: ${p.metricas?.interacciones ?? "Sin datos"} interacciones. Compara con el mismo formato antes de cambiar la frecuencia.`}
                          </p>
                        </article>
                      ))}
                    <p>
                      {marca.estudio?.evidencia ??
                        "Estudia la cuenta y reúne resultados para proponer cambios con evidencia."}
                    </p>
                  </section>
                )}
                {admin && marca.rubro === "iglesia-reformada" && (
                  <div className="marca-citas">
                    <Boton
                      variante="secundario"
                      onClick={() => setCitasAbiertas(true)}
                    >
                      Citas bíblicas revisadas
                    </Boton>
                    {citasAbiertas && (
                      <HojaMarca
                        titulo="Citas bíblicas revisadas"
                        busy={busy}
                        cerrar={() => setCitasAbiertas(false)}
                      >
                        <Notice error={error} message={message} />
                        <p>
                          Compara con la edición elegida. El sistema exige
                          coincidencia exacta; no obtiene versículos de memoria.
                        </p>
                        <form
                          className="stack"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void ejecutar(
                              () =>
                                api("marcas/citas", {
                                  referencia: f.get("referencia"),
                                  version: f.get("version"),
                                  texto: f.get("texto"),
                                  fuente: f.get("fuente"),
                                  cotejada: f.has("cotejada"),
                                }),
                              "Cita guardada en el corpus cotejado.",
                            );
                          }}
                        >
                          <label>
                            Referencia exacta
                            <input
                              name="referencia"
                              placeholder="Libro capítulo:versículo"
                              required
                            />
                          </label>
                          <label>
                            Versión
                            <input
                              name="version"
                              defaultValue={marca.guia.versionBiblia}
                              required
                            />
                          </label>
                          <label>
                            Texto cotejado
                            <textarea name="texto" required maxLength={2000} />
                          </label>
                          <label>
                            Fuente de la edición
                            <input
                              name="fuente"
                              type="url"
                              placeholder="https://…"
                              required
                            />
                          </label>
                          <label className="choice">
                            <input type="checkbox" name="cotejada" required />
                            Cotejé la cita y su versión con la fuente indicada.
                          </label>
                          <button className="button" disabled={busy}>
                            Guardar cita cotejada
                          </button>
                        </form>
                      </HojaMarca>
                    )}
                  </div>
                )}
              </div>
            )}
            {marcaId && archivoMarcas}
          </div>
        )}
      </>
    </div>
  );
}
function EditorMarca({
  id,
  marca,
  data,
  busy,
  guardar,
}: {
  id: string;
  marca?: Marca;
  data: EstadoMarcas;
  busy: boolean;
  guardar: (v: unknown) => Promise<void>;
}) {
  const [paso, setPaso] = useState(0);
  const [usarTienda, setUsarTienda] = useState(false);
  const [identidad, setIdentidad] = useState(() => ({
    nombre: marca?.nombre ?? "",
    rubro: marca?.rubro ?? rubros[0],
    colores: marca?.guia.colores ?? ["#142c3b", "#f0eee7"],
    tipografia: marca?.guia.tipografia ?? "serif",
    tono: marca?.guia.tono ?? "Cercano, cuidadoso y claro",
  }));
  const tienda =
    marca?.guia.tienda ??
    (usarTienda ? crearPlantillaTienda().guia.tienda : undefined);
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formulario.current
      ?.querySelector<HTMLElement>("fieldset:not([hidden]) legend")
      ?.focus();
  }, [paso]);
  function next(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (paso < 2) {
      setPaso(paso + 1);
      return;
    }
    void guardar({
      nombre: f.get("nombre"),
      rubro: identidad.rubro,
      ownerId: f.get("ownerId"),
      zona: f.get("zona"),
      guia: {
        ...marca?.guia,
        ...(tienda ? { tienda } : {}),
        colores: [
          f.get("color1"),
          f.get("color2"),
          ...identidad.colores.slice(2),
        ],
        tipografia: f.get("tipografia"),
        logoId: f.get("logoId"),
        tono: f.get("tono"),
        versionBiblia:
          f.get("versionBiblia") ?? marca?.guia.versionBiblia ?? "RVR1960",
      },
    });
  }
  return (
    <section className="marca-editor" id={id} aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`} className="sr-only">
        {marca ? "Editar guía" : "Añadir marca"}
      </h3>
      <ol className="marca-pasos">
        {["Identidad y dueño", "Guía visual", "Especialista y revisión"].map(
          (v, i) => (
            <li key={v} aria-current={paso === i ? "step" : undefined}>
              {i + 1}. {v}
            </li>
          ),
        )}
      </ol>
      <form className="stack" onSubmit={next} ref={formulario} aria-busy={busy}>
        <fieldset hidden={paso !== 0}>
          <legend tabIndex={-1}>Identidad y dueño</legend>
          {!marca && (
            <>
              <label>
                Punto de partida
                <select
                  value={usarTienda ? "tienda" : "blanco"}
                  onChange={(e) => {
                    const usar = e.target.value === "tienda";
                    const plantilla = usar ? crearPlantillaTienda() : undefined;
                    setUsarTienda(usar);
                    setIdentidad({
                      nombre: plantilla?.nombre ?? "",
                      rubro: plantilla?.rubro ?? rubros[0],
                      colores: plantilla?.guia.colores ?? [
                        "#142c3b",
                        "#f0eee7",
                      ],
                      tipografia: plantilla?.guia.tipografia ?? "serif",
                      tono:
                        plantilla?.guia.tono ?? "Cercano, cuidadoso y claro",
                    });
                  }}
                >
                  <option value="blanco">Guía en blanco</option>
                  <option value="tienda">
                    Tienda de ropa de Walter (ejemplo)
                  </option>
                </select>
              </label>
              {usarTienda && (
                <p className="marcas-demo">
                  Plantilla de ejemplo · Pendiente de definición con Walter.
                  Incluye moda y ecommerce, cinco pilares, calendario de ejemplo
                  y métricas de conversión. Puedes adaptar el nombre y la guía.
                </p>
              )}
            </>
          )}
          <label>
            Nombre de la marca
            <input
              name="nombre"
              value={identidad.nombre}
              onChange={(e) =>
                setIdentidad({ ...identidad, nombre: e.target.value })
              }
              required={paso === 0}
              minLength={2}
              maxLength={100}
            />
          </label>
          <label>
            Dueño
            <select name="ownerId" defaultValue={marca?.ownerId}>
              {data.propietarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rubro
            <select
              name="rubro"
              value={identidad.rubro}
              disabled={!!tienda}
              onChange={(e) =>
                setIdentidad({
                  ...identidad,
                  rubro: e.target.value as Marca["rubro"],
                })
              }
            >
              {rubros.map((r) => (
                <option key={r} value={r}>
                  {nombreRubro[r]}
                </option>
              ))}
            </select>
          </label>
          <p>
            Privada del dueño. Walter tiene acceso a todas las marcas y aprueba
            las publicaciones.
          </p>
        </fieldset>
        <fieldset hidden={paso !== 1}>
          <legend tabIndex={-1}>Guía visual</legend>
          <div className="marca-form-grid">
            <label>
              Color de fondo
              <input
                name="color1"
                type="color"
                value={identidad.colores[0]}
                onChange={(e) =>
                  setIdentidad({
                    ...identidad,
                    colores: [e.target.value, ...identidad.colores.slice(1)],
                  })
                }
              />
            </label>
            <label>
              Color de texto
              <input
                name="color2"
                type="color"
                value={identidad.colores[1]}
                onChange={(e) =>
                  setIdentidad({
                    ...identidad,
                    colores: [
                      identidad.colores[0],
                      e.target.value,
                      ...identidad.colores.slice(2),
                    ],
                  })
                }
              />
            </label>
          </div>
          <label>
            Tipografía
            <select
              name="tipografia"
              value={identidad.tipografia}
              onChange={(e) =>
                setIdentidad({
                  ...identidad,
                  tipografia: e.target.value as "serif" | "sans",
                })
              }
            >
              <option value="serif">Con remates</option>
              <option value="sans">Sin remates</option>
            </select>
          </label>
          <label>
            Logo de la marca
            <select name="logoId" defaultValue={marca?.guia.logoId ?? ""}>
              <option value="">Sin logo por ahora</option>
              {data.archivos
                .filter((a) => a.mime.startsWith("image/"))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Tono
            <textarea
              name="tono"
              value={identidad.tono}
              onChange={(e) =>
                setIdentidad({ ...identidad, tono: e.target.value })
              }
              required={paso === 1}
              minLength={3}
              maxLength={500}
            />
          </label>
        </fieldset>
        <fieldset hidden={paso !== 2}>
          <legend tabIndex={-1}>Especialista y revisión</legend>
          <p>
            {tienda
              ? "El especialista de moda y ecommerce prepara lanzamientos, lookbooks, reels de producto, ofertas y UGC. Toda propuesta requiere validar productos, permisos y condiciones comerciales."
              : "El especialista sigue el rubro y la guía. Los avisos usan plantillas propias; las ilustraciones pueden servir como fondo. Texto, horarios y citas permanecen editables."}
          </p>
          {identidad.rubro === "iglesia-reformada" && (
            <label>
              Versión bíblica (si corresponde)
              <input
                name="versionBiblia"
                defaultValue={marca?.guia.versionBiblia ?? "RVR1960"}
                required={paso === 2 && identidad.rubro === "iglesia-reformada"}
                maxLength={30}
              />
            </label>
          )}
          <label>
            Zona horaria
            <input
              name="zona"
              defaultValue={marca?.zona ?? "America/Lima"}
              required={paso === 2}
            />
          </label>
          <p>
            {tienda
              ? "La plantilla no crea cuentas ni publicaciones. El catálogo web queda desconectado y la conversión real, sin datos. Walter definirá la tienda y revisará cada pieza antes de programarla."
              : "Después de guardar, añade las cuentas. Walter verifica la conexión y revisa cada pieza antes de programarla."}
          </p>
        </fieldset>
        <div className="actions">
          {paso > 0 && (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setPaso(paso - 1)}
            >
              Anterior
            </button>
          )}
          <button className="button primary" disabled={busy}>
            {paso < 2 ? "Continuar" : "Guardar marca"}
          </button>
        </div>
      </form>
    </section>
  );
}
function EditorPieza({
  marca,
  archivos,
  montajes,
  actualizarMontajes,
  citas,
  pieza,
  errorOperacion,
  cerrar,
  busy,
  guardar,
  proponer,
  upload,
}: {
  marca: MarcaVista;
  archivos: EstadoMarcas["archivos"];
  montajes: EstadoMarcas["montajes"];
  actualizarMontajes: () => Promise<void>;
  citas: EstadoMarcas["citas"];
  pieza?: PiezaMarca;
  errorOperacion: string;
  cerrar: () => void;
  busy: boolean;
  guardar: (v: unknown) => Promise<void>;
  proponer: (v: string) => Promise<string>;
  upload: (f: File) => Promise<string>;
}) {
  const [abierto, setAbierto] = useState(Boolean(pieza));
  const tituloEditor = pieza ? "Editar borrador" : "Crear una publicación";
  const [texto, setTexto] = useState(pieza?.datos.texto ?? ""),
    [titulo, setTitulo] = useState(pieza?.datos.titulo ?? ""),
    [formato, setFormato] = useState(pieza?.datos.formato ?? "imagen"),
    [plantilla, setPlantilla] = useState(pieza?.datos.plantilla ?? "domingo"),
    [detalle, setDetalle] = useState(pieza?.datos.detalle ?? ""),
    [diapositivas, setDiapositivas] = useState(
      pieza?.datos.diapositivas.join("\n") ?? "",
    ),
    [ejemplo, setEjemplo] = useState(pieza?.datos.ejemplo ?? false),
    [datosConfirmados, setDatosConfirmados] = useState(false),
    [fecha, setFecha] = useState(
      pieza ? fechaDispositivo(pieza.programada) : "",
    ),
    [citaElegida, setCitaElegida] = useState(
      pieza?.datos.citas[0]
        ? `${pieza.datos.citas[0].referencia}|${pieza.datos.citas[0].version}`
        : "",
    ),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [videoId, setVideoId] = useState(pieza?.datos.videoId ?? ""),
    [revisionMontaje, setRevisionMontaje] = useState(
      pieza?.datos.montaje?.revision ?? "",
    ),
    [ids, setIds] = useState<string[]>(pieza?.datos.adjuntos ?? []);
  async function sugerir() {
    setWorking(true);
    setError("");
    try {
      setTexto(await proponer(titulo));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="marca-compositor">
      <Boton onClick={() => setAbierto(true)}>
        <Plus size={18} />
        {tituloEditor}
      </Boton>
      {abierto && (
        <HojaMarca
          titulo={tituloEditor}
          busy={busy || working}
          cerrar={() => {
            setAbierto(false);
            cerrar();
          }}
        >
          <p>
            Usa tus adjuntos o selecciona un montaje aprobado de la fábrica.
            Walter revisa la publicación antes de programarla.
          </p>
          <Notice error={error || errorOperacion} />
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                cita = citas.find(
                  (c) => `${c.referencia}|${c.version}` === f.get("cita"),
                );
              void guardar({
                cuentaId: f.get("cuentaId"),
                plantilla: f.get("plantilla"),
                formato: videoId ? "reel" : f.get("formato"),
                titulo,
                texto,
                detalle: f.get("detalle"),
                diapositivas: String(f.get("diapositivas") ?? "")
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
                adjuntos: ids,
                citas: cita
                  ? [
                      {
                        referencia: cita.referencia,
                        version: cita.version,
                        texto: cita.texto,
                      },
                    ]
                  : [],
                programada: f.get("fecha")
                  ? new Date(String(f.get("fecha"))).toISOString()
                  : undefined,
                origen: videoId ? "fabrica" : "web",
                videoId,
                montaje: videoId ? { revision: revisionMontaje } : undefined,
                ejemplo: ejemplo && !datosConfirmados,
              });
            }}
          >
            {marca.rubro === "iglesia-reformada" && (
              <fieldset>
                <legend>Plantillas de la iglesia</legend>
                <p>
                  Son ejemplos editables. Elegir una plantilla reemplaza el
                  contenido de este formulario.
                </p>
                <div className="actions">
                  {plantillasIglesia.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="button"
                      disabled={busy || working}
                      onClick={() => {
                        setTitulo(p.datos.titulo);
                        setTexto(p.datos.texto);
                        setDetalle(p.datos.detalle);
                        setDiapositivas(p.datos.diapositivas.join("\n"));
                        setFormato(p.datos.formato);
                        setPlantilla(p.datos.plantilla);
                        setEjemplo(true);
                        setDatosConfirmados(false);
                        setCitaElegida("");
                        setVideoId("");
                        setRevisionMontaje("");
                        setIds([]);
                        setFecha(
                          fechaDispositivo(
                            Date.parse(proximaFechaIglesia(p.id)),
                          ),
                        );
                      }}
                    >
                      Usar plantilla de {p.nombre.toLocaleLowerCase("es")}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="marca-form-grid">
              <label>
                Cuenta
                <select name="cuentaId" required defaultValue={pieza?.cuentaId}>
                  {marca.cuentas.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.alias} · {c.red}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Formato
                <select
                  name="formato"
                  value={formato}
                  onChange={(e) => setFormato(e.target.value as typeof formato)}
                  disabled={!!videoId}
                >
                  {formatos.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label>
                Plantilla
                <select
                  name="plantilla"
                  value={plantilla}
                  onChange={(e) => {
                    setPlantilla(e.target.value as typeof plantilla);
                    setTitulo(
                      etiquetas[e.target.value as keyof typeof etiquetas],
                    );
                  }}
                >
                  {Object.entries(etiquetas).map(([v, label]) => (
                    <option value={v} key={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Horario (hora de tu dispositivo)
                <input
                  name="fecha"
                  type="datetime-local"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
                <small>Vacío: sugerencia en {marca.zona}.</small>
              </label>
            </div>
            <label>
              Título de la pieza
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={100}
                minLength={2}
                required
              />
            </label>
            <label>
              Horario, lugar u otro detalle de la pieza
              <input
                name="detalle"
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                maxLength={180}
              />
            </label>
            <label>
              Diapositivas (una por línea, para carrusel)
              <textarea
                name="diapositivas"
                value={diapositivas}
                onChange={(e) => setDiapositivas(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="button"
              disabled={working || busy || titulo.length < 3}
              onClick={() => void sugerir()}
            >
              Proponer texto con el especialista
            </button>
            <label>
              Texto de la publicación
              <textarea
                required
                value={texto}
                maxLength={1800}
                onChange={(e) => setTexto(e.target.value)}
              />
            </label>
            {marca.rubro === "iglesia-reformada" && (
              <label>
                Cita bíblica cotejada
                <select
                  name="cita"
                  value={citaElegida}
                  onChange={(e) => {
                    setCitaElegida(e.target.value);
                    const c = citas.find(
                      (c) => `${c.referencia}|${c.version}` === e.target.value,
                    );
                    if (c)
                      setTexto(
                        (t) =>
                          `${t}\n\n${c.texto}\n${c.referencia} (${c.version})`,
                      );
                  }}
                >
                  <option value="">Sin cita bíblica</option>
                  {citas
                    .filter((c) => c.version === marca.guia.versionBiblia)
                    .map((c) => (
                      <option
                        key={`${c.referencia}|${c.version}`}
                        value={`${c.referencia}|${c.version}`}
                      >
                        {c.referencia} · {c.version}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {ejemplo && (
              <div>
                <p role="status">
                  Datos de ejemplo · No se puede aprobar hasta sustituirlos y
                  revisarlos.
                </p>
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={datosConfirmados}
                    onChange={(e) => setDatosConfirmados(e.target.checked)}
                  />
                  Confirmo que sustituí los datos de ejemplo por información
                  verificada
                </label>
              </div>
            )}
            <label>
              Montaje aprobado de fábrica
              <select
                value={videoId ? `${videoId}:${revisionMontaje}` : ""}
                onChange={(e) => {
                  const v = montajes.find(
                    (v) => `${v.id}:${v.revision}` === e.target.value,
                  );
                  setVideoId(v?.id ?? "");
                  setRevisionMontaje(v?.revision ?? "");
                  if (v) setIds([]);
                }}
              >
                <option value="">Usar adjuntos y plantilla</option>
                {videoId &&
                  !montajes.some(
                    (v) => v.id === videoId && v.revision === revisionMontaje,
                  ) && (
                    <option value={`${videoId}:${revisionMontaje}`} disabled>
                      Revisión anterior no disponible: vuelve a seleccionar
                    </option>
                  )}
                {montajes
                  .filter((v) => v.ownerId === marca.ownerId)
                  .map((v) => (
                    <option
                      key={`${v.id}:${v.revision}`}
                      value={`${v.id}:${v.revision}`}
                    >
                      {v.titulo} · {v.revision.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>
            <p>
              MP4 de hasta 50 MiB, conservado sin cambios como reel. El título y
              el texto acompañan la publicación; no se añaden al video. Si el
              enlace caducó, actualiza la lista. Si no se recupera, Walter debe
              revisar el original.
            </p>
            <button
              type="button"
              className="button"
              disabled={busy || working}
              onClick={() => void actualizarMontajes()}
            >
              Actualizar montajes desde fábrica
            </button>
            {videoId && (
              <p>
                <Link href={`/videos/${encodeURIComponent(videoId)}`}>
                  Revisar video de origen
                </Link>{" "}
                · Revisión {revisionMontaje.slice(0, 8)}
              </p>
            )}
            <label>
              Fotos, fondos o videos del dueño
              <select
                multiple
                disabled={!!videoId}
                value={ids}
                onChange={(e) =>
                  setIds(Array.from(e.target.selectedOptions, (o) => o.value))
                }
              >
                {archivos
                  .filter(
                    (a) =>
                      a.ownerId === marca.ownerId &&
                      /^(image|video)\//.test(a.mime),
                  )
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Subir foto o video (hasta 5 MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                disabled={working || busy || !!videoId}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setWorking(true);
                  setError("");
                  try {
                    if (f.size > 5 * 1024 * 1024)
                      throw new Error("El archivo supera 5 MB.");
                    setIds([...ids, await upload(f)]);
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setWorking(false);
                  }
                }}
              />
            </label>
            <p>
              <Link href="/">Abrir chat</Link> ·{" "}
              <Link href="/videos">Ver videos de fábrica</Link>
            </p>
            <button
              className="button primary"
              disabled={busy || working || !marca.cuentas.length}
            >
              {pieza ? "Guardar nueva revisión" : "Guardar borrador"}
            </button>
          </form>
        </HojaMarca>
      )}
    </div>
  );
}
function Pieza({
  p,
  marca,
  admin,
  busy,
  errorOperacion,
  editar,
  accion,
}: {
  p: PiezaMarca;
  marca: MarcaVista;
  admin: boolean;
  busy: boolean;
  errorOperacion: string;
  editar: () => void;
  accion: (
    v: string,
    doctrina?: {
      revisorPastoral: string;
      observaciones: string;
      comprobaciones: string[];
    },
  ) => Promise<void>;
}) {
  const [revisionAbierta, setRevisionAbierta] = useState<number | null>(null);
  const [doctrinaAbierta, setDoctrinaAbierta] = useState(false);
  const previaAbierta = revisionAbierta === p.revision;
  const requiereDoctrina =
    marca.rubro === "iglesia-reformada" || p.datos.requiereRevisionDoctrinal;
  const doctrina = p.revisionDoctrinal;
  return (
    <article className="marca-pieza" id={`pieza-${p.id}`}>
      <div>
        <time dateTime={new Date(p.programada).toISOString()}>
          {new Intl.DateTimeFormat("es-PE", {
            timeZone: marca.zona,
            dateStyle: "medium",
            timeStyle: "short",
          }).format(p.programada)}
        </time>
        <h4>{p.datos.titulo}</h4>
        <p>
          {p.datos.formato} · {p.estado} · Revisión {p.revision}
        </p>
        {p.datos.montaje && (
          <p>
            Montaje de fábrica sin cambios ·{" "}
            <Link href={`/videos/${encodeURIComponent(p.datos.videoId)}`}>
              Ver origen
            </Link>{" "}
            · Revisión {p.datos.montaje.revision.slice(0, 8)}
          </p>
        )}
        <p className="marca-caption">{p.datos.texto}</p>
        {p.datos.ejemplo && (
          <p className="marcas-demo">
            Datos de ejemplo · Pendiente de sustituir. No aprobable.
          </p>
        )}
        {requiereDoctrina && (
          <p>
            {doctrina?.revision === p.revision
              ? `Revisión doctrinal registrada · ${doctrina.revisorPastoral} · Revisión ${doctrina.revision}`
              : "Revisión doctrinal pendiente. Debe completarse antes de aprobar."}
          </p>
        )}
        {doctrina && (
          <details className="marca-previa">
            <summary>Ver revisión doctrinal registrada</summary>
            <p className="marca-caption">{doctrina.observaciones}</p>
            <p>
              Registrada el{" "}
              {new Intl.DateTimeFormat("es-PE", {
                timeZone: marca.zona,
                dateStyle: "medium",
                timeStyle: "short",
              }).format(doctrina.fecha)}
              . Una edición exige otra revisión doctrinal.
            </p>
          </details>
        )}
        {requiereDoctrina && p.estado === "pendiente" && admin && (
          <div className="marca-revisar">
            <Boton
              variante="secundario"
              onClick={() => setDoctrinaAbierta(true)}
            >
              {doctrina?.revision === p.revision
                ? "Consultar revisión doctrinal"
                : "Revisar doctrina"}
            </Boton>
            {doctrinaAbierta && (
              <HojaMarca
                titulo="Revisión doctrinal"
                busy={busy}
                cerrar={() => setDoctrinaAbierta(false)}
              >
                <Notice
                  error={errorOperacion}
                  message={
                    doctrina?.revision === p.revision
                      ? "Revisión doctrinal registrada. Ya puedes aprobar esta pieza."
                      : undefined
                  }
                />
                <form
                  className="stack marca-revision-doctrinal"
                  key={p.revision}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void accion("revisar-doctrina", {
                      revisorPastoral: String(f.get("revisorPastoral")),
                      observaciones: String(f.get("observaciones")),
                      comprobaciones: f.getAll("comprobaciones").map(String),
                    });
                  }}
                >
                  <fieldset>
                    <legend>Revisión doctrinal</legend>
                    <p>
                      Walter registra la revisión acordada con el responsable
                      pastoral. Comprueba la vista previa completa de esta
                      revisión antes de marcar los controles.
                    </p>
                    <label>
                      Responsable pastoral
                      <input
                        name="revisorPastoral"
                        required
                        minLength={3}
                        maxLength={120}
                        defaultValue={doctrina?.revisorPastoral ?? ""}
                      />
                    </label>
                    <label>
                      Observaciones y fuentes de la revisión
                      <textarea
                        name="observaciones"
                        required
                        minLength={20}
                        maxLength={2000}
                        defaultValue={doctrina?.observaciones ?? ""}
                      />
                    </label>
                    {revisionDoctrinalIglesia.map((c) => (
                      <label key={c.id} className="choice">
                        <input
                          type="checkbox"
                          name="comprobaciones"
                          value={c.id}
                          required
                        />
                        <span>
                          <strong>{c.etiqueta}</strong>
                          <small>{c.detalle}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <button className="button" disabled={busy || p.datos.ejemplo}>
                    Registrar revisión doctrinal
                  </button>
                </form>
              </HojaMarca>
            )}
          </div>
        )}
        {p.aviso && <p role="status">{p.aviso}</p>}
        {p.metricas && (
          <p>
            Vistas: {p.metricas.vistas ?? "Sin datos"} · Alcance:{" "}
            {p.metricas.alcance ?? "Sin datos"} · Interacciones:{" "}
            {p.metricas.interacciones ?? "Sin datos"}
          </p>
        )}
        <div className="actions">
          {["borrador", "pendiente", "programada"].includes(p.estado) && (
            <button className="button" disabled={busy} onClick={editar}>
              Editar pieza
            </button>
          )}
          {p.estado === "borrador" && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void accion("enviar")}
            >
              Preparar vista previa y enviar a Walter
            </button>
          )}
          {p.estado === "pendiente" && admin && (
            <>
              <button
                className="button primary"
                disabled={
                  busy ||
                  p.datos.ejemplo ||
                  (requiereDoctrina && doctrina?.revision !== p.revision)
                }
                onClick={() => void accion("aprobar")}
              >
                Aprobar y programar
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => void accion("cambios")}
              >
                Pedir cambios
              </button>
            </>
          )}
        </div>
      </div>
      {p.mediosIds.length > 0 && (
        <details
          className="marca-previa"
          open={previaAbierta}
          onToggle={(e) =>
            setRevisionAbierta(e.currentTarget.open ? p.revision : null)
          }
        >
          <summary>Vista previa de la pieza</summary>
          {previaAbierta && (
            <div className="marca-galeria">
              {p.mediosIds.map((id, i) =>
                p.datos.formato === "reel" ? (
                  <video
                    key={id}
                    src={`/api/marcas/medio/${p.id}?i=${i}`}
                    controls
                    playsInline
                    preload="none"
                    width={720}
                    height={1280}
                    aria-label={p.datos.titulo}
                  />
                ) : (
                  <Image
                    key={id}
                    src={`/api/marcas/medio/${p.id}?i=${i}`}
                    alt={`${p.datos.titulo}, pieza ${i + 1}`}
                    loading="eager"
                    width={1080}
                    height={p.datos.formato === "historia" ? 1920 : 1350}
                    unoptimized
                  />
                ),
              )}
            </div>
          )}
        </details>
      )}
    </article>
  );
}

function AvatarMarca({ marca }: { marca: Marca }) {
  return (
    <span className="marca-avatar" aria-hidden="true">
      {marca.guia.logoId ? (
        <Image
          src={`/api/archivos/${encodeURIComponent(marca.guia.logoId)}`}
          alt=""
          width={64}
          height={64}
          unoptimized
        />
      ) : (
        marca.nombre
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((palabra) => palabra[0])
          .join("")
          .toLocaleUpperCase("es")
      )}
    </span>
  );
}

/** El dialog aporta foco, fondo inerte y Escape; HojaVidrio aporta la superficie común. */
function HojaMarca({
  titulo,
  cerrar,
  busy,
  children,
}: {
  titulo: string;
  cerrar: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const nodo = dialogo.current;
    const origen =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    nodo?.showModal();
    nodo
      ?.querySelector<HTMLElement>("fieldset:not([hidden]) legend[tabindex]")
      ?.focus();
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      nodo?.close();
      document.body.style.overflow = scroll;
      if (origen?.isConnected) origen.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogo}
      className="marca-dialogo"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) cerrar();
      }}
    >
      <HojaVidrio className="marca-hoja">
        <header className="marca-hoja-cabecera">
          <h2 id={id}>{titulo}</h2>
          <Boton
            variante="fantasma"
            aria-label="Cerrar"
            disabled={busy}
            onClick={cerrar}
          >
            <X size={20} />
          </Boton>
        </header>
        {children}
      </HojaVidrio>
    </dialog>
  );
}
