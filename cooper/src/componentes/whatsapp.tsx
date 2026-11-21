"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, useEspacio, Notice } from "./espacio";
export function PreferenciasWhatsApp() {
  const { data, refresh } = useEspacio();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [requested, setRequested] = useState(false),
    [codeError, setCodeError] = useState(false),
    [simulatedCode, setSimulatedCode] = useState("");
  const codeInput = useRef<HTMLInputElement>(null);
  const preferenceTitle = useRef<HTMLLegendElement>(null);
  const focusPreferences = useRef(false);
  const wa = data.whatsapp;
  useEffect(() => {
    if (wa.verificado && !busy && focusPreferences.current) {
      focusPreferences.current = false;
      if (document.activeElement === document.body)
        preferenceTitle.current?.focus();
    }
  }, [wa.verificado, busy]);
  async function run(task: () => Promise<void>, verification = false) {
    setBusy(true);
    setError("");
    setMessage("");
    setCodeError(false);
    try {
      await task();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      if (
        verification &&
        (e as Error).message.startsWith("El código no es válido")
      ) {
        setCodeError(true);
        codeInput.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  }
  function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const codigo = new FormData(e.currentTarget).get("codigo");
    void run(async () => {
      await api("whatsapp/verificar", { codigo });
      focusPreferences.current = true;
      setRequested(false);
      setSimulatedCode("");
      setMessage("Número verificado. Elige los avisos que quieres recibir.");
    }, true);
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
      <Notice id="whatsapp-resultado" error={error} message={message} />
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
          aria-busy={busy}
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
        <form className="stack" onSubmit={verify} aria-busy={busy}>
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
              ref={codeInput}
              autoFocus
              aria-invalid={codeError || undefined}
              aria-describedby={
                codeError
                  ? "whatsapp-codigo-ayuda whatsapp-resultado"
                  : "whatsapp-codigo-ayuda"
              }
              onChange={() => setCodeError(false)}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
            />
          </label>
          <p className="helper" id="whatsapp-codigo-ayuda">
            Escribe los seis números del código. Si caducó, pide uno nuevo.
          </p>
          <button className="button" disabled={busy}>
            Verificar número
          </button>
        </form>
      )}
      {wa.verificado && (
        <form
          className="stack"
          onSubmit={save}
          aria-busy={busy}
          key={JSON.stringify(wa.preferencias)}
        >
          <fieldset className="stack">
            <legend ref={preferenceTitle} tabIndex={-1}>
              Quiero recibir
            </legend>
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
