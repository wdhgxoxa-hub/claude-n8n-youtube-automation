import { z } from "zod";
import { clave, descargar, respuesta, solicitar } from "./http";
import type {
  ArchivoMedio,
  ProveedorAvatar,
  ProveedorVoz,
  TrabajoMedio,
  Transporte,
} from "./tipos";
const identificador = z.string().min(1).max(200);
const look = z.object({
  id: identificador,
  name: z.string().default("Presentador"),
  status: z.enum(["processing", "completed", "failed"]),
  preview_video_url: z.string().nullish(),
});
const base64 = (f: ArchivoMedio) => ({
  type: "base64",
  media_type: f.mime,
  data: f.data,
});
class HeyGen {
  readonly nombre = "heygen";
  readonly simulada = false;
  constructor(protected transporte: Transporte = fetch) {}
  protected request(
    path: string,
    data?: unknown,
    key?: string,
    method = data ? "POST" : "GET",
  ) {
    return solicitar(this.transporte, `https://api.heygen.com/v3/${path}`, {
      method,
      headers: {
        "X-Api-Key": clave("HEYGEN_API_KEY"),
        "Content-Type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}
function trabajo(data: z.infer<typeof look>): TrabajoMedio {
  return {
    id: data.id,
    estado:
      data.status === "completed"
        ? "listo"
        : data.status === "failed"
          ? "error"
          : "entrenando",
    previewUrl: data.preview_video_url ?? undefined,
  };
}
export class AvatarHeyGen extends HeyGen implements ProveedorAvatar {
  async crear(input: {
    nombre: string;
    foto: ArchivoMedio;
    operacionId: string;
  }) {
    const r = await respuesta(
      await this.request(
        "avatars",
        { type: "photo", name: input.nombre, file: base64(input.foto) },
        input.operacionId,
      ),
      z.object({ data: z.object({ avatar_item: look }) }),
    );
    return trabajo(r.data.avatar_item);
  }
  async consultar(id: string) {
    const r = await respuesta(
      await this.request(`avatars/looks/${encodeURIComponent(id)}`),
      z.object({ data: look }),
    );
    return trabajo(r.data);
  }
  async catalogo() {
    const items: { id: string; nombre: string; previewUrl: string }[] = [];
    let token = "";
    for (let page = 0; page < 4; page++) {
      const r = await respuesta(
        await this.request(
          `avatars/looks?ownership=public&limit=50${token ? `&token=${encodeURIComponent(token)}` : ""}`,
        ),
        z.object({
          data: z.array(look),
          has_more: z.boolean(),
          next_token: z.string().nullish(),
        }),
      );
      for (const item of r.data)
        if (item.status === "completed" && item.preview_video_url)
          items.push({
            id: item.id,
            nombre: item.name,
            previewUrl: item.preview_video_url,
          });
      if (!r.has_more || !r.next_token) break;
      token = r.next_token;
    }
    return items;
  }
  async eliminar(id: string) {
    await this.request(
      `avatars/looks/${encodeURIComponent(id)}`,
      undefined,
      undefined,
      "DELETE",
    );
  }
}
export class VozHeyGen extends HeyGen implements ProveedorVoz {
  async clonar(input: {
    nombre: string;
    audio: ArchivoMedio;
    operacionId: string;
  }): Promise<TrabajoMedio> {
    const r = await respuesta(
      await this.request(
        "models/audio/voices",
        {
          mode: "instant",
          name: input.nombre,
          audio: [base64(input.audio)],
          language: "es",
          similarity: "max",
        },
        input.operacionId,
      ),
      z.object({ data: z.object({ voice_id: identificador }) }),
    );
    return { id: r.data.voice_id, estado: "entrenando" };
  }
  async consultar(id: string): Promise<TrabajoMedio> {
    const r = await respuesta(
      await this.request(`models/audio/voices/${encodeURIComponent(id)}`),
      z.object({
        data: z.object({
          voice_id: identificador,
          status: z.enum(["PENDING", "ACTIVE", "FAILED"]),
          preview_audio_url: z.string().nullish(),
        }),
      }),
    );
    return {
      id: r.data.voice_id,
      estado:
        r.data.status === "ACTIVE"
          ? "listo"
          : r.data.status === "FAILED"
            ? "error"
            : "entrenando",
      previewUrl: r.data.preview_audio_url ?? undefined,
    };
  }
  async sintetizar(id: string, texto: string) {
    const r = await respuesta(
      await this.request("models/audio/tts", {
        voice_id: id,
        text: texto,
        language: "es",
      }),
      z.object({ data: z.object({ audio_url: z.url() }) }),
    );
    return descargar(r.data.audio_url, this.transporte);
  }
  async eliminar(id: string) {
    await this.request(
      `models/audio/voices/${encodeURIComponent(id)}`,
      undefined,
      undefined,
      "DELETE",
    );
  }
}
