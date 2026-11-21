import { ErrorHttp } from "@/lib/permisos";
import type {
  ProveedorAvatar,
  ProveedorVoz,
  ProveedorTranscripcion,
  TrabajoMedio,
} from "./tipos";
export class AvatarSimulado implements ProveedorAvatar {
  readonly nombre = "simulada";
  readonly simulada = true;
  async verificar(input: { mime: string; consentimiento: boolean }) {
    if (!input.consentimiento || !/^(audio|video)\//.test(input.mime))
      throw new ErrorHttp(400, "Graba la frase y acepta el consentimiento.");
    return { verified: true, simulada: true };
  }
  async crear(input: { operacionId: string }): Promise<TrabajoMedio> {
    return { id: input.operacionId, estado: "entrenando" };
  }
  async consultar(id: string): Promise<TrabajoMedio> {
    return { id, estado: "listo" };
  }
  async catalogo() {
    return [];
  }
  async eliminar() {}
}
export class VozSimulada extends AvatarSimulado implements ProveedorVoz {
  async clonar(input: { operacionId: string }) {
    return this.crear(input);
  }
  muestra() {
    const rate = 16000,
      count = rate * 2,
      buffer = Buffer.alloc(44 + count * 2);
    buffer.write("RIFF");
    buffer.writeUInt32LE(buffer.length - 8, 4);
    buffer.write("WAVEfmt ", 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(rate, 24);
    buffer.writeUInt32LE(rate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(count * 2, 40);
    for (let i = 0; i < count; i++)
      buffer.writeInt16LE(
        Math.round(
          Math.sin((i / rate) * 2 * Math.PI * 220) *
            1800 *
            Math.sin((Math.PI * i) / count) ** 2,
        ),
        44 + i * 2,
      );
    return buffer;
  }
  async sintetizar() {
    return { mime: "audio/wav", data: this.muestra().toString("base64") };
  }
}
export class TranscripcionSimulada implements ProveedorTranscripcion {
  readonly simulada = true;
  async transcribir() {
    return "Quiero un nuevo video: Una idea que merece ser contada";
  }
}
