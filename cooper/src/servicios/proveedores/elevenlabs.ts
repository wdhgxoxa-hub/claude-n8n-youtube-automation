import { z } from "zod";
import { clave, respuesta, solicitar } from "./http";
import type {
  ArchivoMedio,
  ProveedorVoz,
  TrabajoMedio,
  Transporte,
} from "./tipos";
export class VozElevenLabs implements ProveedorVoz {
  readonly nombre = "elevenlabs";
  readonly simulada = false;
  constructor(private transporte: Transporte = fetch) {}
  private request(path: string, init: RequestInit = {}) {
    return solicitar(this.transporte, `https://api.elevenlabs.io/v1/${path}`, {
      ...init,
      headers: { "xi-api-key": clave("ELEVENLABS_API_KEY"), ...init.headers },
    });
  }
  async clonar(input: {
    nombre: string;
    audio: ArchivoMedio;
  }): Promise<TrabajoMedio> {
    const form = new FormData();
    form.append("name", input.nombre);
    form.append(
      "files",
      new Blob([Buffer.from(input.audio.data, "base64")], {
        type: input.audio.mime,
      }),
      "grabacion.webm",
    );
    const r = await respuesta(
      await this.request("voices/add", { method: "POST", body: form }),
      z.object({
        voice_id: z.string().min(1),
        requires_verification: z.boolean(),
      }),
    );
    return {
      id: r.voice_id,
      estado: r.requires_verification ? "verificacion_proveedor" : "listo",
    };
  }
  async consultar(id: string): Promise<TrabajoMedio> {
    // No eludir la verificación adicional: solo una confirmación expresa permite usarla.
    const r = await respuesta(
      await this.request(`voices/${encodeURIComponent(id)}`),
      z.object({
        voice_id: z.string(),
        voice_verification: z
          .object({
            requires_verification: z.boolean(),
            is_verified: z.boolean(),
          })
          .nullish(),
      }),
    );
    return {
      id: r.voice_id,
      estado:
        r.voice_verification?.is_verified ||
        r.voice_verification?.requires_verification === false
          ? "listo"
          : "verificacion_proveedor",
    };
  }
  async sintetizar(id: string, texto: string) {
    const r = await this.request(
      `text-to-speech/${encodeURIComponent(id)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: texto,
          model_id: "eleven_multilingual_v2",
        }),
      },
    );
    return {
      mime: "audio/mpeg",
      data: Buffer.from(await r.arrayBuffer()).toString("base64"),
    };
  }
  async eliminar(id: string) {
    await this.request(`voices/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
}
