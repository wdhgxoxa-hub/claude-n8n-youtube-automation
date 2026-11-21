"use client";
import { useState, type FormEvent } from "react";
import { api, useEspacio, Notice } from "./espacio";
export function PreferenciasWhatsApp() {
  const { data, refresh } = useEspacio();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [requested, setRequested] = useState(false),
    [simulatedCode, setSimulatedCode] = useState("");
  const wa = data.whatsapp;
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const codigo = new FormData(e.currentTarget).get("codigo");
    void run(async () => {
      await api("whatsapp/verificar", { codigo });
      setRequested(false);
      setSimulatedCode("");
      setMessage("Número verificado. Elige los avisos que quieres recibir.");
    });
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    void run(async () => {
      await api("whatsapp/preferencias", {
        guion: values.has("guion"),
        final: values.has("final"),
        publicado: values.has("publicado"),
        ...(data.user.role === "admin"
          ? { gasto: values.has("gasto"), marca: values.has("marca") }
          : {}),
      });
      setMessage("Tus avisos están actualizados.");
    });
  }
  return (
    <section
      className="stack whatsapp-preferences"
      aria-labelledby="whatsapp-title"
    >
      <div>
        <h2 id="whatsapp-title">Tus avisos por WhatsApp</h2>
        <p className="helper">
          Recibe las revisiones de tus videos y abre Cooper para verlas. Puedes
          desactivar cada aviso aquí o escribir «baja» en WhatsApp.
        </p>
      </div>
      <Notice error={error} message={message} />
      {wa.simulada && (
        <p className="helper">
          Modo simulado: no se envían mensajes a WhatsApp. La verificación sirve
          solo para esta demostración.
        </p>
      )}
      <p>
        {wa.verificado
          ? `Número verificado: ${data.user.whatsapp}`
          : data.user.whatsapp
            ? `Número pendiente de verificar: ${data.user.whatsapp}`
            : "Guarda tu número en el perfil para comenzar."}
      </p>
      {!wa.verificado && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const result = await api<{ codigoSimulado?: string }>(
                "whatsapp/codigo",
                { consentimiento: true },
              );
              setSimulatedCode(result.codigoSimulado ?? "");
              setRequested(true);
              setMessage("Código solicitado. Caduca en diez minutos.");
            });
          }}
        >
          <label className="choice">
            <input
              type="checkbox"
              required
              disabled={busy || !data.user.whatsapp}
            />
            Acepto recibir un código de verificación de Cooper en este número.
          </label>
          <button
            className="button secondary"
            disabled={busy || !data.user.whatsapp}
          >
            {requested ? "Pedir otro código" : "Enviar código"}
          </button>
        </form>
      )}
      {requested && !wa.verificado && (
        <form className="stack" onSubmit={verify}>
          {simulatedCode && (
            <p role="status">
              Código de demostración:{" "}
              <strong data-testid="whatsapp-codigo-simulado">
                {simulatedCode}
              </strong>
            </p>
          )}
          <label>
            Código de verificación
            <input
              name="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
            />
          </label>
          <button className="button" disabled={busy}>
            Verificar número
          </button>
        </form>
      )}
      {wa.verificado && (
        <form
          className="stack"
          onSubmit={save}
          key={JSON.stringify(wa.preferencias)}
        >
          <fieldset className="stack">
            <legend>Quiero recibir</legend>
            {(
              [
                ["guion", "Guion listo para aprobar"],
                ["final", "Video listo para la aprobación final"],
                ["publicado", "Video publicado"],
                ...(data.user.role === "admin"
                  ? [
                      ["gasto", "Alerta de gasto diario"],
                      ["marca", "Piezas de marcas para aprobar"],
                    ]
                  : []),
              ] as [keyof typeof wa.preferencias, string][]
            ).map(([name, label]) => (
              <label className="choice" key={name}>
                <input
                  type="checkbox"
                  name={name}
                  defaultChecked={wa.preferencias[name]}
                  disabled={busy}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <button className="button secondary" disabled={busy}>
            Guardar avisos
          </button>
        </form>
      )}
    </section>
  );
}
