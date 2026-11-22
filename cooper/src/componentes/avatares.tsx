"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { m as motion } from "framer-motion";
import {
  Plus,
  Play,
  Pause,
  LockKeyhole,
  UsersRound,
  Check,
  Trash2,
  AudioLines,
  X,
} from "lucide-react";
import { CONSENTIMIENTO, ESTADOS_MEDIO } from "@/servicios/medios";
import { CooperCara } from "@/marca/CooperCara";
import { api, useEspacio, Heading, Notice } from "./espacio";
import { subir, Grabador } from "./grabador";
import { Indicador, useMovimientoReducido } from "./movimiento";
import { HojaVidrio } from "./primitivas";
import "./resto-diseno.css";
function Retrato({ variant, moving }: { variant: string; moving: boolean }) {
  const reduced = useMovimientoReducido();
  moving = moving && !reduced;
  const female = variant === "alma" || variant === "luz";
  return (
    <motion.svg
      viewBox="0 0 200 190"
      aria-label={`Ilustración de ${variant}`}
      role="img"
      animate={moving ? { rotate: [0, 1.5, -1, 0] } : { rotate: 0 }}
      transition={{ duration: 3, repeat: moving ? Infinity : 0 }}
    >
      <path
        d="M28 190q0-61 72-61t72 61"
        fill={variant === "luz" ? "#74838b" : "#45525c"}
      />
      <path d="M66 75q-12-46 34-46t34 46v66H66Z" fill="#292322" />
      <path d="M89 118h22v25q-11 12-22 0Z" fill="#ad8063" />
      <ellipse
        cx="100"
        cy="85"
        rx="31"
        ry="41"
        fill={variant === "mateo" ? "#a87958" : "#c89979"}
      />
      <path
        d={
          female
            ? "M64 79q-3-55 39-47 34-3 35 50-34-13-38-33-3 25-36 30Z"
            : "M67 67q-7-43 39-36 33 3 30 41l-15-21q-34 14-54 16Z"
        }
        fill="#292322"
      />
      <path
        d="M79 83h11m20 0h11M95 99h8M90 112q10 6 20 0"
        fill="none"
        stroke="#4a342c"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="85" cy="86" r="2" fill="#292322" />
      <circle cx="115" cy="86" r="2" fill="#292322" />
      {variant === "luz" && (
        <g stroke="#c2d8df" fill="none" strokeWidth="2">
          <circle cx="84" cy="87" r="10" />
          <circle cx="116" cy="87" r="10" />
          <path d="M94 87h12" />
        </g>
      )}
    </motion.svg>
  );
}
export function Avatares({ fotoId = "" }: { fotoId?: string }) {
  const formId = useId();
  const reduced = useMovimientoReducido();
  const { data, refresh } = useEspacio();
  const [tab, setTab] = useState<"avatar" | "voz">("avatar"),
    [preview, setPreview] = useState(""),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [photos, setPhotos] = useState<string[]>(fotoId ? [fotoId] : []),
    [challenge, setChallenge] = useState<{ id: string; phrase: string } | null>(
      null,
    ),
    [evidence, setEvidence] = useState("");
  const createButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const uploadOrigin = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!busy && uploadOrigin.current) {
      const origin = uploadOrigin.current;
      uploadOrigin.current = null;
      if (document.activeElement === document.body && origin.isConnected)
        origin.focus();
    }
    if (!creating && !busy && restoreFocus.current) {
      restoreFocus.current = false;
      if (document.activeElement === document.body)
        createButton.current?.focus();
    }
  }, [creating, busy]);
  async function upload(
    file: File,
    kind: "photo" | "evidence",
    origin?: HTMLElement,
  ) {
    uploadOrigin.current =
      origin ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setBusy(true);
    setError("");
    try {
      const saved = await subir(file);
      if (kind === "photo")
        setPhotos((items) => [...items, saved.id].slice(0, 3));
      else setEvidence(saved.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const result = await api<{ simulada: boolean }>("activos", {
        kind: tab,
        name: f.get("name"),
        photoIds: photos,
        challengeId: challenge?.id,
        evidenceId: evidence,
        placement: f.get("placement"),
        consentimiento: f.get("consentimiento") === "on",
      });
      await refresh();
      restoreFocus.current = true;
      setCreating(false);
      setPhotos([]);
      setEvidence("");
      setMessage(
        result.simulada
          ? "Tu creación es privada. La verificación y la generación son simuladas en este modo."
          : "Solicitud guardada. Walter revisará tu identidad antes del entrenamiento. Tu creación es privada.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page resto-page avatares-diseno">
      <Heading
        title="Avatares y voces"
        description="Personajes que cuentan tus historias contigo."
        action={
          <button
            ref={createButton}
            className="button"
            disabled={busy}
            aria-expanded={creating}
            aria-controls={creating ? formId : undefined}
            onClick={async () => {
              setError("");
              setPhotos(tab === "avatar" && fotoId ? [fotoId] : []);
              setEvidence("");
              setChallenge(null);
              if (creating) {
                setCreating(false);
                return;
              }
              setBusy(true);
              try {
                setChallenge(await api("identidad", { kind: tab }));
                setCreating(true);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus size={17} />
            Crear {tab === "avatar" ? "avatar" : "voz"}
          </button>
        }
      />
      <div
        className="filters library-tabs"
        role="group"
        aria-label="Tipo de biblioteca"
      >
        <button
          aria-pressed={tab === "avatar"}
          onClick={() => {
            setTab("avatar");
            setCreating(false);
            setPreview("");
          }}
        >
          {tab === "avatar" && <Indicador id="biblioteca" />}
          Avatares
        </button>
        <button
          aria-pressed={tab === "voz"}
          onClick={() => {
            setTab("voz");
            setCreating(false);
            setPreview("");
          }}
        >
          {tab === "voz" && <Indicador id="biblioteca" />}
          Voces
        </button>
      </div>
      <Notice error={error} message={message} />
      {fotoId && (
        <p className="helper">
          Tu foto del chat está preparada. Pulsa Crear avatar y completa la
          verificación y el consentimiento.
        </p>
      )}
      <p className="simulation-note">
        {(
          tab === "avatar"
            ? data.medios.avatarSimulado
            : data.medios.vozSimulada
        )
          ? "Modo simulado: usa material ficticio. Las vistas previas locales son ilustraciones y tonos de muestra."
          : "Tus fotos y grabaciones son privadas. La revisión de identidad precede al entrenamiento."}
      </p>
      {tab === "avatar" && !data.medios.avatarSimulado && (
        <button
          className="button secondary small"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api("catalogo", {});
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Cargar presentadores del estudio
        </button>
      )}
      {creating && (
        <HojaVidrio
          className="identity-form"
          id={formId}
          aria-labelledby={`${formId}-titulo`}
        >
          <div>
            <div className="resto-hoja-cabecera">
              <span className="resto-eyebrow">Tu propia presencia</span>
              <button
                className="icon-button"
                aria-label="Cerrar creación"
                onClick={() => {
                  restoreFocus.current = true;
                  setCreating(false);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <h2 id={`${formId}-titulo`}>Tu identidad, bajo tu control.</h2>
            <p>
              Solo puedes crear una versión de ti. Queda privada hasta que
              decidas compartirla.
            </p>
            <blockquote>{challenge?.phrase}</blockquote>
            <p className="helper">
              Lee esta frase en una grabación de voz o un video corto. Caduca en
              15 minutos. Walter comprobará la frase y tu identidad; si no puede
              reconocerte, te pedirá repetirla en persona.
            </p>
          </div>
          <form className="stack" onSubmit={create} aria-busy={busy}>
            <label>
              Nombre
              <input
                name="name"
                autoFocus
                required
                maxLength={120}
                placeholder={tab === "avatar" ? "Mi presentador" : "Mi voz"}
              />
            </label>
            {tab === "avatar" && (
              <label className="file-picker">
                Fotos tuyas (hasta tres)
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required={photos.length === 0}
                  multiple
                  disabled={busy}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    setPhotos(tab === "avatar" && fotoId ? [fotoId] : []);
                    if (files.length > 3) {
                      setError("Selecciona hasta tres fotos.");
                      return;
                    }
                    uploadOrigin.current = e.currentTarget;
                    setBusy(true);
                    try {
                      const ids = [];
                      for (const file of files)
                        ids.push((await subir(file)).id);
                      setPhotos(ids);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <span
                  className="file-choice button secondary small"
                  aria-hidden="true"
                >
                  Seleccionar fotos
                </span>
                {photos.length > 0 && (
                  <span className="helper">
                    {photos.length} fotos recibidas. La primera se usará como
                    avatar; las demás ayudan a revisar tu identidad.
                  </span>
                )}
              </label>
            )}
            <label className="file-picker">
              Grabación de identidad
              <input
                className="sr-only"
                type="file"
                disabled={busy}
                accept={
                  tab === "voz"
                    ? "audio/webm,audio/mp4,audio/ogg,audio/wav"
                    : "audio/webm,audio/mp4,audio/ogg,audio/wav,video/webm,video/mp4"
                }
                onChange={(e) => {
                  if (e.target.files?.[0])
                    void upload(e.target.files[0], "evidence", e.currentTarget);
                }}
              />
              <span
                className="file-choice button secondary small"
                aria-hidden="true"
              >
                Seleccionar grabación
              </span>
            </label>
            <div className="record-identity">
              <Grabador
                disabled={busy}
                onAudio={(file) => upload(file, "evidence")}
                onError={setError}
              />
              <span role="status">
                {evidence ? "Grabación recibida" : "O graba la frase ahora"}
              </span>
            </div>
            <label>
              Presencia en el video
              <select name="placement">
                <option value="partes">Solo en algunas partes</option>
                <option value="completo">Durante todo el video</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input name="consentimiento" type="checkbox" required />
              {CONSENTIMIENTO}
            </label>
            <button
              className="button"
              disabled={
                busy ||
                !challenge ||
                !evidence ||
                (tab === "avatar" && photos.length === 0)
              }
            >
              <Check size={16} />
              {(
                tab === "avatar"
                  ? data.medios.avatarSimulado
                  : data.medios.vozSimulada
              )
                ? "Crear en modo simulado"
                : "Enviar a revisión de identidad"}
            </button>
          </form>
        </HojaVidrio>
      )}
      <div className="library-section-title">
        <h2>Del estudio</h2>
        <span>Disponible para todo el equipo</span>
      </div>
      <motion.div
        key={tab}
        className="asset-grid"
        initial="inicio"
        animate="visible"
        variants={{
          inicio: {},
          visible: { transition: { staggerChildren: reduced ? 0 : 0.04 } },
        }}
      >
        {data.catalogo
          .filter((a) => a.kind === tab)
          .map((a) => (
            <motion.article
              className="asset-card"
              key={a.id}
              variants={{
                inicio: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 12 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: reduced ? 0.12 : 0.42 },
                },
              }}
            >
              <div className={`asset-portrait ${a.style}`}>
                {a.kind === "avatar" && !a.simulada ? (
                  preview === a.id ? (
                    <video
                      controls
                      autoPlay
                      muted
                      playsInline
                      src={`/api/muestra/${encodeURIComponent(a.id)}`}
                      aria-label={`Vista previa de ${a.name}`}
                      onError={() =>
                        setError(
                          "No se pudo cargar la vista previa. Inténtalo de nuevo.",
                        )
                      }
                    />
                  ) : (
                    <div className="avatar-presentacion">
                      <span aria-hidden="true">{a.name.slice(0, 1)}</span>
                      <small>Conoce a {a.name}</small>
                    </div>
                  )
                ) : a.kind === "voz" ? (
                  <div
                    className={`waveform ${preview === a.id ? "playing" : ""}`}
                  >
                    {Array.from({ length: 26 }, (_, i) => (
                      <span
                        key={i}
                        style={{
                          height: `${20 + (Math.sin(i * 1.8) + 1) * 26}%`,
                          animationDelay: `${i * 0.04}s`,
                        }}
                      />
                    ))}
                  </div>
                ) : a.id === "cooper" ? (
                  <CooperCara
                    size={172}
                    estado={preview === a.id ? "hablando" : "reposo"}
                  />
                ) : (
                  <Retrato variant={a.id} moving={preview === a.id} />
                )}
                <button
                  className="asset-play"
                  aria-label={`${preview === a.id ? "Pausar" : "Vista previa de"} ${a.name}`}
                  onClick={() => setPreview(preview === a.id ? "" : a.id)}
                >
                  {preview === a.id ? <Pause size={18} /> : <Play size={18} />}
                </button>
              </div>
              <div className="asset-info">
                <h3>{a.name}</h3>
                <p>{a.description}</p>
                {preview === a.id && a.kind === "voz" && (
                  <audio
                    controls
                    autoPlay
                    src={`/api/muestra/${encodeURIComponent(a.id)}`}
                    aria-label={`Muestra de voz de ${a.name}`}
                    onError={() =>
                      setError(
                        "No se pudo reproducir la muestra. Inténtalo de nuevo.",
                      )
                    }
                    onEnded={() => setPreview("")}
                  />
                )}
                <small>
                  {a.simulada
                    ? a.kind === "voz"
                      ? "Muestra de audio simulada"
                      : a.style === "realista"
                        ? "Maqueta de avatar realista"
                        : "Ilustración animada local"
                    : a.kind === "voz"
                      ? "Voz de catálogo"
                      : "Presentador realista"}
                </small>
              </div>
            </motion.article>
          ))}
      </motion.div>
      <div className="library-section-title">
        <h2>Tu biblioteca y el equipo</h2>
        <span>
          <LockKeyhole size={14} />
          Privado por defecto
        </span>
      </div>
      {data.assets.filter((a) => a.kind === tab).length ? (
        <div className="asset-grid">
          {data.assets
            .filter((a) => a.kind === tab)
            .map((a) => (
              <article key={a.id} className="asset-card">
                <div className="asset-portrait own-asset">
                  {a.photoId ? (
                    <Image
                      unoptimized
                      fill
                      src={`/api/archivos/${a.photoId}`}
                      alt={a.name}
                      sizes="240px"
                    />
                  ) : (
                    <AudioLines size={70} />
                  )}
                </div>
                <div className="asset-info">
                  <h3>{a.name}</h3>
                  <p>
                    {a.placement === "completo"
                      ? "En todo el video"
                      : "En algunas partes"}
                  </p>
                  <p role="status">{ESTADOS_MEDIO[a.status]}</p>
                  {["iniciando", "entrenando"].includes(a.status) && (
                    <progress aria-label={`Entrenamiento de ${a.name}`} />
                  )}
                  <small>
                    {a.simulated
                      ? "Verificación simulada"
                      : a.verified
                        ? "Identidad revisada por Walter"
                        : "Identidad pendiente"}
                  </small>
                  {a.consentAt > 0 && (
                    <small>
                      Consentimiento (Lima):{" "}
                      {new Date(a.consentAt).toLocaleDateString("es-PE", {
                        timeZone: "America/Lima",
                      })}
                    </small>
                  )}
                  {a.consentRevokedAt > 0 && (
                    <p role="status">
                      Consentimiento revocado. Los videos en cola se cancelan.
                    </p>
                  )}
                  {a.syncError && (
                    <p className="helper">
                      No se pudo actualizar el estado. Se volverá a consultar
                      automáticamente si el entrenamiento sigue en curso.
                    </p>
                  )}
                  {!a.consentRevokedAt &&
                    a.status === "listo" &&
                    a.kind === "voz" && (
                      <audio
                        controls
                        preload="none"
                        src={`/api/muestra/${a.id}`}
                        aria-label={`Muestra de voz de ${a.name}`}
                        onError={() =>
                          setError("No se pudo reproducir la voz.")
                        }
                      />
                    )}
                  {!a.consentRevokedAt &&
                    a.status === "listo" &&
                    a.kind === "avatar" &&
                    a.hasPreview && (
                      <video
                        controls
                        preload="none"
                        playsInline
                        src={`/api/muestra/${a.id}`}
                        aria-label={`Vista previa de ${a.name}`}
                        onError={() =>
                          setError("No se pudo reproducir el avatar.")
                        }
                      />
                    )}

                  <div className="privacy-label">
                    {a.shared ? (
                      <UsersRound size={14} />
                    ) : (
                      <LockKeyhole size={14} />
                    )}{" "}
                    {a.shared ? "Compartido con el equipo" : "Solo tú"}
                  </div>
                  {a.ownerId === data.user.id && (
                    <div className="asset-actions">
                      {a.consentAt > 0 && !a.consentRevokedAt && (
                        <button
                          className="button secondary small"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setError("");
                            try {
                              await api(`activos/${a.id}/revocar`, {});
                              await refresh();
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Revocar consentimiento
                        </button>
                      )}

                      {a.retryable &&
                        ["error", "iniciando"].includes(a.status) && (
                          <button
                            className="button secondary small"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              setError("");
                              try {
                                await api(`activos/${a.id}/reintentar`, {});
                                await refresh();
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            Recuperar envío
                          </button>
                        )}

                      <button
                        className="button secondary small"
                        disabled={busy || a.status !== "listo" || !a.verified}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await api(
                              `activos/${a.id}`,
                              { shared: !a.shared },
                              "PATCH",
                            );
                            await refresh();
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {a.shared ? "Hacer privado" : "Compartir"}
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Borrar ${a.name}`}
                        onClick={async () => {
                          if (!window.confirm("¿Borrar esta creación?")) return;
                          try {
                            await api(`activos/${a.id}`, undefined, "DELETE");
                            await refresh();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
        </div>
      ) : (
        <div className="library-empty">
          <LockKeyhole size={24} />
          <p>
            Aquí vivirán tus {tab === "avatar" ? "avatares" : "voces"}.<br />
            <span>Crea uno con tu identidad, a tu ritmo.</span>
          </p>
        </div>
      )}
    </div>
  );
}
