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
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Tu navegador no permite grabar audio. Puedes adjuntar una grabación.",
        );
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
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        if (timeout.current) clearTimeout(timeout.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        onRecording?.(false);
        const mime = r.mimeType.split(";")[0];
        void onAudio(
          new File(
            chunks,
            "grabacion." + (mime.includes("mp4") ? "mp4" : "webm"),
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
      onError(
        e instanceof Error ? e.message : "Permite el micrófono para grabar.",
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
        onClick={() => (recording ? recorder.current?.stop() : void start())}
        aria-label={recording ? "Detener grabación" : "Grabar audio"}
        title={
          recording ? "Detener grabación" : "Grabar audio (máximo 60 segundos)"
        }
      >
        {recording ? <Square size={18} /> : <Mic size={19} />}
      </button>
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
  const response = await fetch("/api/archivos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      mime: file.type.split(";")[0] || "text/plain",
      data,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result as { id: string; name: string };
}
