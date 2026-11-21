"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Recuerdo } from "@/servicios/chat/memoria-tipos";
import { api, Notice } from "./espacio";

function Recuerdos({ recuerdos }: { recuerdos: Recuerdo[] }) {
  return recuerdos.length ? (
    recuerdos.map((r) => (
      <article className="memory-scope" key={r.canalId}>
        <h3>{r.nombre}</h3>
        {(
          [
            ["Pendientes", r.resumen.pendientes],
            [
              "Videos en ideas",
              r.resumen.videos.map((v) => `${v.titulo} — ${v.detalle}`),
            ],
            ["Decisiones", r.resumen.decisiones],
            ["Preferencias", r.resumen.preferencias],
          ] as const
        )
          .filter(([, items]) => items.length)
          .map(([titulo, items]) => (
            <div key={titulo}>
              <h4>{titulo}</h4>
              <ul>
                {items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
      </article>
    ))
  ) : (
    <p className="helper">Todavía no hay recuerdos guardados.</p>
  );
}

export function MemoriaChat({
  recuerdos,
  busy,
  refresh,
  retomar,
}: {
  recuerdos: Recuerdo[];
  busy: boolean;
  refresh: () => Promise<void>;
  retomar: (canalId: string, texto: string) => void;
}) {
  const id = useId();
  const [abierta, setAbierta] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const borrarButton = useRef<HTMLButtonElement>(null);
  const conservarButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (borrando) return;
    if (confirmar) conservarButton.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      borrarButton.current?.focus();
    }
  }, [confirmar, borrando]);
  const ultimo = recuerdos.find(
    (r) => r.resumen.pendientes.length || r.resumen.videos.length,
  );
  const pendiente =
    ultimo?.resumen.pendientes.at(-1) ?? ultimo?.resumen.videos.at(-1)?.titulo;
  async function borrar() {
    setBorrando(true);
    setError("");
    try {
      await api("memoria", undefined, "DELETE");
      await refresh();
      setConfirmar(false);
      setAviso(
        "Se borró lo recordado. Cooper comenzará a recordar desde tu próximo mensaje.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBorrando(false);
    }
  }
  return (
    <section className="memory-card" aria-label="Memoria de Cooper">
      <div className="memory-heading">
        {!ultimo && <h2 className="sr-only">Recuerdos de Cooper</h2>}
        {ultimo && pendiente && (
          <div className="memory-last">
            <h2>Donde lo dejamos</h2>
            <p>
              <span className="muted">{ultimo.nombre}: </span>
              {pendiente}
            </p>
          </div>
        )}
        <div className="button-row">
          {ultimo && pendiente && (
            <button
              className="button secondary small"
              disabled={busy || borrando}
              onClick={() =>
                retomar(
                  ultimo.canalId,
                  `Retomemos esta idea: ${ultimo.resumen.videos.at(-1)?.titulo ?? pendiente}`,
                )
              }
            >
              Retomar
            </button>
          )}
          <button
            className="button secondary small"
            aria-expanded={abierta}
            aria-controls={id}
            onClick={() => {
              setAbierta(!abierta);
              if (abierta) {
                restoreFocus.current = false;
                setConfirmar(false);
              }
            }}
          >
            {abierta ? "Ocultar recuerdos" : "Ver lo recordado"}
          </button>
        </div>
      </div>
      <div id={id} hidden={!abierta} className="memory-details">
        <p className="helper">
          Solo tú y el administrador pueden ver estos recuerdos. Se actualizan
          al conversar.
        </p>
        <Recuerdos recuerdos={recuerdos} />
        <p className="helper" id={`${id}-borrado`}>
          Al borrarlos, Cooper dejará de usar también tus mensajes anteriores
          como contexto. El historial visible, los canales y los videos se
          conservan.
        </p>
        {confirmar ? (
          <div
            className="button-row"
            role="group"
            aria-label="Confirmación de borrado"
            aria-describedby={`${id}-borrado`}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !borrando) {
                event.preventDefault();
                setConfirmar(false);
              }
            }}
          >
            <button
              className="button danger small"
              disabled={busy || borrando}
              onClick={() => void borrar()}
            >
              Confirmar borrado de recuerdos
            </button>
            <button
              ref={conservarButton}
              className="button secondary small"
              disabled={borrando}
              onClick={() => setConfirmar(false)}
            >
              Conservar recuerdos
            </button>
          </div>
        ) : (
          <button
            ref={borrarButton}
            className="button secondary small"
            disabled={busy || borrando}
            onClick={() => {
              restoreFocus.current = true;
              setConfirmar(true);
              setAviso("");
            }}
          >
            Borrar lo recordado
          </button>
        )}
      </div>
      <Notice error={error} />
      <p className="sr-only" role="status">
        {borrando ? "Borrando recuerdos…" : ""}
      </p>
      {aviso && (
        <p className="helper" role="status">
          {aviso}
        </p>
      )}
    </section>
  );
}

export function MemoriaAdmin({
  personas,
}: {
  personas: { id: string; name: string; email: string }[];
}) {
  const [persona, setPersona] = useState("");
  const [recuerdos, setRecuerdos] = useState<Recuerdo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="stack memory-admin" aria-label="Recuerdos del equipo">
      <h2>Recuerdos del equipo</h2>
      <p className="helper">
        Consulta privada del administrador. Cada persona gestiona el borrado de
        sus recuerdos desde Inicio.
      </p>
      <label>
        Persona para consultar recuerdos
        <select
          value={persona}
          disabled={busy}
          onChange={(e) => {
            setPersona(e.target.value);
            setRecuerdos(null);
            setError("");
          }}
        >
          <option value="">Elige una persona</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.email})
            </option>
          ))}
        </select>
      </label>
      <div>
        <button
          className="button secondary"
          disabled={!persona}
          aria-disabled={busy || undefined}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError("");
            setRecuerdos(null);
            try {
              setRecuerdos(
                await api<Recuerdo[]>(
                  `admin/memoria/${encodeURIComponent(persona)}`,
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
          Ver recuerdos de la persona
        </button>
      </div>
      <Notice error={error} />
      <p className="sr-only" role="status">
        {busy
          ? "Consultando recuerdos…"
          : recuerdos
            ? recuerdos.length
              ? "Recuerdos cargados. Revisa el resultado a continuación."
              : "Esta persona todavía no tiene recuerdos guardados."
            : ""}
      </p>
      {recuerdos && <Recuerdos recuerdos={recuerdos} />}
    </section>
  );
}
