"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
export function Grabador({
  disabled = false,
  onAudio,
  onError,
  onRecording,
}: {
  disabled?: boolean;
  onAudio: (file: File) => Promise<void>;
  onError: (error: string) => void;
  onRecording?: (value: boolean) => void;
}) {
  const mounted = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timeout.current) clearTimeout(timeout.current);
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  async function start() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        onError(
          "Tu navegador no permite grabar audio. Puedes adjuntar una grabación.",
        );
        return;
      }
      setBusy(true);
      const captured = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current) {
        captured.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = captured;
      const r = new MediaRecorder(captured);
      recorder.current = r;
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        if (timeout.current) clearTimeout(timeout.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        onRecording?.(false);
        // Firefox puede vaciar recorder.mimeType al detenerse; el Blob conserva su formato.
        const mime = (
          chunks.find((chunk) => chunk.type)?.type || r.mimeType
        ).split(";")[0];
        void onAudio(
          new File(
            chunks,
            "grabacion." +
              (mime.includes("mp4")
                ? "mp4"
                : mime.includes("ogg")
                  ? "ogg"
                  : "webm"),
            { type: mime },
          ),
        ).catch((e) =>
          onError(
            e instanceof Error ? e.message : "No pudimos guardar el audio.",
          ),
        );
      };
      r.start();
      setRecording(true);
      onRecording?.(true);
      timeout.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 60000);
    } catch (e) {
      stream.current?.getTracks().forEach((track) => track.stop());
      if (!mounted.current) return;
      const reason = e instanceof Error ? e.name : "";
      onError(
        reason === "NotAllowedError" || reason === "SecurityError"
          ? "Permite el micrófono en tu navegador o adjunta una grabación."
          : reason === "NotFoundError"
            ? "No encontramos un micrófono. Conecta uno o adjunta una grabación."
            : reason === "NotReadableError" || reason === "AbortError"
              ? "No pudimos abrir el micrófono. Cierra otras aplicaciones que lo usen y vuelve a intentar."
              : "No pudimos iniciar la grabación. Inténtalo de nuevo o adjunta un audio.",
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <span className="recorder-control" data-recording={recording}>
      <button
        type="button"
        className={`icon-button ${recording ? "recording" : ""}`}
        disabled={busy || (disabled && !recording)}
        aria-busy={busy}
        onClick={() => (recording ? recorder.current?.stop() : void start())}
        aria-label={recording ? "Detener grabación" : "Grabar audio"}
        title={
          recording ? "Detener grabación" : "Grabar audio (máximo 60 segundos)"
        }
      >
        {recording ? <Square size={18} /> : <Mic size={19} />}
      </button>
      {busy && (
        <span className="sr-only" role="status">
          Esperando permiso para usar el micrófono.
        </span>
      )}
      {recording && (
        <span
          className="recording-wave"
          role="status"
          aria-label="Grabando audio"
        >
          <span aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
export async function subir(file: File) {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("El archivo supera los 5 MB.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("No pudimos leer el archivo."));
    reader.readAsDataURL(file);
  });
  let response: Response;
  try {
    response = await fetch("/api/archivos", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        mime: file.type.split(";")[0] || "text/plain",
        data,
      }),
    });
  } catch (error) {
    const timeout =
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name);
    throw new Error(
      timeout
        ? "La carga tardó demasiado. Comprueba tu conexión antes de volver a seleccionar el archivo."
        : "No pudimos confirmar la carga. Comprueba tu conexión antes de volver a seleccionar el archivo.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "No pudimos confirmar la carga. Revisa si el archivo llegó antes de volver a intentarlo.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof result?.error === "string"
        ? result.error
        : "No pudimos subir el archivo. Revisa el formato y el tamaño e inténtalo de nuevo.",
    );
  if (
    !result ||
    typeof result.id !== "string" ||
    typeof result.name !== "string"
  )
    throw new Error(
      "No pudimos confirmar la carga. Revisa si el archivo llegó antes de volver a intentarlo.",
    );
  return result as { id: string; name: string };
}
