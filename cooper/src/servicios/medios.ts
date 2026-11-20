import { ErrorHttp } from "@/lib/permisos";
export const FRASE_IDENTIDAD =
  "Soy la persona de esta grabación y autorizo usar mi imagen y mi voz en Cooper.";
export const CATALOGO = [
  {
    id: "alma",
    kind: "avatar",
    name: "Alma",
    description: "Presentadora natural",
    style: "realista",
  },
  {
    id: "mateo",
    kind: "avatar",
    name: "Mateo",
    description: "Narrador cercano",
    style: "realista",
  },
  {
    id: "luz",
    kind: "avatar",
    name: "Luz",
    description: "Ilustración editorial",
    style: "ilustrado",
  },
  {
    id: "cooper",
    kind: "avatar",
    name: "Cooper",
    description: "Tu compañero, en cámara",
    style: "ilustrado",
  },
  {
    id: "clara",
    kind: "voz",
    name: "Clara",
    description: "Español latino · cálida",
    style: "voz",
  },
  {
    id: "tomas",
    kind: "voz",
    name: "Tomás",
    description: "Español latino · serena",
    style: "voz",
  },
] as const;
export interface ProveedorAvatar {
  verificar(input: {
    mime: string;
    consentimiento: boolean;
  }): Promise<{ verified: boolean; simulada: boolean }>;
}
export interface ProveedorVoz extends ProveedorAvatar {
  muestra(): Uint8Array;
}
export class AvatarSimulado implements ProveedorAvatar {
  async verificar(input: { mime: string; consentimiento: boolean }) {
    if (!input.consentimiento || !/^(audio|video)\//.test(input.mime))
      throw new ErrorHttp(
        400,
        "Graba la frase de consentimiento para verificar tu identidad.",
      );
    return { verified: true, simulada: true };
  }
}
export class VozSimulada extends AvatarSimulado implements ProveedorVoz {
  muestra() {
    // Onda de demostración local; nunca se presenta como clonación real.
    const rate = 16000,
      count = rate * 2;
    const buffer = Buffer.alloc(44 + count * 2);
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
}
