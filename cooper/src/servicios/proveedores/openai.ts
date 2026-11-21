import { z } from "zod";
import { clave, solicitar, respuesta } from "./http";
import type { ArchivoMedio, ProveedorTranscripcion, Transporte } from "./tipos";
export class TranscripcionOpenAI implements ProveedorTranscripcion {
  readonly simulada = false;
  constructor(private transporte: Transporte = fetch) {}
  async transcribir(archivo: ArchivoMedio) {
    const form = new FormData();
    const extension = archivo.mime.split("/")[1];
    form.set(
      "file",
      new Blob([Buffer.from(archivo.data, "base64")], { type: archivo.mime }),
      `grabacion.${extension}`,
    );
    form.set("model", "gpt-transcribe");
    form.append("languages[]", "es");
    const response = await solicitar(
      this.transporte,
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${clave("OPENAI_API_KEY")}` },
        body: form,
      },
    );
    const result = await respuesta(
      response,
      z.object({ text: z.string().trim().min(1).max(6000) }),
    );
    return result.text;
  }
}
