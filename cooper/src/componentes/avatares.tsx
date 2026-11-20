"use client";
import { useState, type FormEvent } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Plus,
  Play,
  Pause,
  LockKeyhole,
  UsersRound,
  Check,
  Trash2,
  AudioLines,
} from "lucide-react";
import { CATALOGO, FRASE_IDENTIDAD } from "@/servicios/medios";
import { CooperCara } from "@/marca/CooperCara";
import { api, useEspacio, Heading, Notice } from "./espacio";
import { subir, Grabador } from "./grabador";
function Retrato({ variant, moving }: { variant: string; moving: boolean }) {
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
export function Avatares() {
  const { data, refresh } = useEspacio();
  const [tab, setTab] = useState<"avatar" | "voz">("avatar"),
    [preview, setPreview] = useState(""),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [photo, setPhoto] = useState(""),
    [evidence, setEvidence] = useState("");
  async function upload(file: File, kind: "photo" | "evidence") {
    setBusy(true);
    setError("");
    try {
      const saved = await subir(file);
      if (kind === "photo") setPhoto(saved.id);
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
      await api("activos", {
        kind: tab,
        name: f.get("name"),
        photoId: photo || undefined,
        evidenceId: evidence,
        placement: f.get("placement"),
        consentimiento: f.get("consentimiento") === "on",
      });
      await refresh();
      setCreating(false);
      setPhoto("");
      setEvidence("");
      setMessage(
        "Tu creación es privada. La verificación y la generación son simuladas en este modo.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <Heading
        title="Dale una cara. Dale una voz."
        description="Personajes que cuentan tus historias contigo."
        action={
          <button
            className="button"
            onClick={() => {
              setCreating(!creating);
              setPhoto("");
              setEvidence("");
            }}
          >
            <Plus size={17} />
            Crear {tab === "avatar" ? "avatar" : "voz"}
          </button>
        }
      />
      <div className="filters library-tabs">
        <button
          aria-pressed={tab === "avatar"}
          onClick={() => {
            setTab("avatar");
            setCreating(false);
            setPreview("");
          }}
        >
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
          Voces
        </button>
      </div>
      <Notice error={error} message={message} />
      <p className="simulation-note">
        Biblioteca de demostración. Las vistas previas son ilustraciones y tonos
        de muestra; la generación y la verificación real se conectarán más
        adelante.
      </p>
      {creating && (
        <section className="identity-form">
          <div>
            <h2>Tu identidad, bajo tu control.</h2>
            <p>
              Solo puedes crear una versión de ti. Queda privada hasta que
              decidas compartirla.
            </p>
            <blockquote>{FRASE_IDENTIDAD}</blockquote>
            <p className="helper">
              Lee esta frase en una grabación de voz o un video corto.
            </p>
          </div>
          <form className="stack" onSubmit={create}>
            <label>
              Nombre
              <input
                name="name"
                required
                maxLength={120}
                placeholder={tab === "avatar" ? "Mi presentador" : "Mi voz"}
              />
            </label>
            {tab === "avatar" && (
              <label>
                Una foto tuya
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  onChange={(e) => {
                    if (e.target.files?.[0])
                      void upload(e.target.files[0], "photo");
                  }}
                />
                {photo && <span className="helper">Foto recibida</span>}
              </label>
            )}
            <label>
              Grabación de identidad
              <input
                type="file"
                accept="audio/webm,audio/mp4,audio/ogg,audio/wav,video/webm,video/mp4"
                onChange={(e) => {
                  if (e.target.files?.[0])
                    void upload(e.target.files[0], "evidence");
                }}
              />
            </label>
            <div className="record-identity">
              <Grabador
                onAudio={(file) => upload(file, "evidence")}
                onError={setError}
              />
              <span>
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
              Soy la persona de la foto y la grabación. Autorizo el uso de mi
              identidad.
            </label>
            <button
              className="button"
              disabled={busy || !evidence || (tab === "avatar" && !photo)}
            >
              <Check size={16} />
              Verificar y crear en modo simulado
            </button>
          </form>
        </section>
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
          visible: { transition: { staggerChildren: 0.06 } },
        }}
      >
        {CATALOGO.filter((a) => a.kind === tab).map((a) => (
          <motion.article
            className="asset-card"
            key={a.id}
            variants={{
              inicio: { y: 8 },
              visible: { y: 0, transition: { duration: 0.25 } },
            }}
          >
            <div className={`asset-portrait ${a.style}`}>
              {a.kind === "voz" ? (
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
                  src="/api/muestra-voz"
                  onEnded={() => setPreview("")}
                />
              )}
              <small>
                {a.kind === "voz"
                  ? "Muestra de audio simulada"
                  : a.style === "realista"
                    ? "Maqueta de avatar realista"
                    : "Avatar ilustrado"}
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
                  <small>Verificación simulada</small>
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
                      <button
                        className="button secondary small"
                        disabled={busy}
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
