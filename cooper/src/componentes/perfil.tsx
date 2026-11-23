"use client";
import Image from "next/image";
import { useId, useState, type FormEvent } from "react";
import { Camera, Check, Pause, Play } from "lucide-react";
import { api, useEspacio, Heading, Notice } from "./espacio";
import { subir } from "./grabador";
import { usePausaMovimiento } from "./movimiento";
import { PreferenciasWhatsApp } from "./whatsapp";
import { Apariencia } from "./apariencia";
import "./resto-diseno.css";
export function Perfil() {
  const id = useId();
  const [pausado, pausar] = usePausaMovimiento();
  const { data, refresh } = useEspacio();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [image, setImage] = useState(data.user.image),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("perfil", { ...values, image }, "PATCH");
      await refresh();
      setMessage("Tu perfil está actualizado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page resto-page perfil-diseno">
      <Heading
        title="A tu manera"
        description="Tu espacio también debe sentirse tuyo."
      />
      <div className="profile-layout">
        <aside className="profile-portrait">
          <span className="resto-eyebrow">Tu espacio personal</span>
          {image ? (
            <Image
              unoptimized
              src={image}
              alt="Tu foto de perfil"
              width={112}
              height={112}
            />
          ) : (
            <div className="portrait-initial">{data.user.name.slice(0, 1)}</div>
          )}
          <h2>{data.user.name}</h2>
          <p>{data.user.email}</p>
          <label className="button secondary upload-button">
            <Camera size={16} />
            Cambiar foto
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-describedby={`${id}-foto-ayuda`}
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError("");
                setMessage("");
                setBusy(true);
                try {
                  setImage("/api/archivos/" + (await subir(file)).id);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          <small id={`${id}-foto-ayuda`}>PNG, JPG o WebP. Hasta 5 MB.</small>
        </aside>
        <div className="profile-settings">
          <form className="profile-form stack" onSubmit={save} aria-busy={busy}>
            <Notice error={error} message={message} />
            <h2>Lo esencial</h2>
            <label>
              Tu nombre
              <input
                name="name"
                autoComplete="name"
                defaultValue={data.user.name}
                required
                maxLength={120}
              />
            </label>
            <label>
              <span id={`${id}-whatsapp-etiqueta`}>WhatsApp</span>
              <input
                type="tel"
                name="whatsapp"
                autoComplete="tel"
                aria-labelledby={`${id}-whatsapp-etiqueta`}
                aria-describedby={`${id}-whatsapp-ayuda`}
                defaultValue={data.user.whatsapp}
                placeholder="+51987654321"
                pattern="\+[1-9][0-9]{7,14}"
              />
              <span className="helper" id={`${id}-whatsapp-ayuda`}>
                Incluye el código del país. Guarda el perfil y verifica tu
                número abajo.
              </span>
            </label>
            <div className="form-divider" />
            <h2>Tu espacio</h2>
            <Apariencia />
            <input type="hidden" name="home" value="fabrica" />
            <div className="perfil-movimiento">
              <div>
                <h3>El ritmo lo eliges tú</h3>
                <p className="helper">
                  También respetamos la preferencia de movimiento de tu
                  dispositivo.
                </p>
              </div>
              <button
                type="button"
                className="button secondary"
                aria-pressed={pausado}
                onClick={() => pausar(!pausado)}
              >
                {pausado ? <Play size={16} /> : <Pause size={16} />}
                {pausado ? "Activar movimiento" : "Pausar movimiento"}
              </button>
            </div>
            <button className="button" disabled={busy}>
              <Check size={16} />
              Guardar perfil
            </button>
          </form>
          <PreferenciasWhatsApp />
        </div>
      </div>
    </div>
  );
}
