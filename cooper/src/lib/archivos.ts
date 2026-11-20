import { ErrorHttp } from "./permisos";
// Comprueba formato de transporte y firma del contenedor. No sustituye un antivirus.
export function validarArchivo(mime: string, encoded: string) {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded)
    throw new ErrorHttp(400, "El archivo no tiene una codificación válida.");
  const starts = (hex: string) =>
    bytes.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"));
  const at = (start: number, value: string) =>
    bytes.subarray(start, start + value.length).toString("ascii") === value;
  let valid = false;
  switch (mime) {
    case "image/png":
      valid =
        starts("89504e470d0a1a0a") && at(12, "IHDR") && bytes.length >= 33;
      break;
    case "image/jpeg":
      valid =
        starts("ffd8ff") &&
        bytes.length >= 4 &&
        bytes.subarray(-2).equals(Buffer.from([255, 217]));
      break;
    case "image/webp":
      valid = at(0, "RIFF") && at(8, "WEBP") && bytes.length >= 20;
      break;
    case "application/pdf":
      valid = at(0, "%PDF-");
      break;
    case "audio/wav":
      valid = at(0, "RIFF") && at(8, "WAVE") && bytes.length >= 44;
      break;
    case "audio/ogg":
      valid = at(0, "OggS") && bytes.length >= 27;
      break;
    case "audio/webm":
    case "video/webm":
      valid =
        starts("1a45dfa3") &&
        bytes.subarray(0, 128).includes(Buffer.from("webm"));
      break;
    case "audio/mp4":
    case "video/mp4":
      valid = at(4, "ftyp") && bytes.length >= 24;
      break;
    case "text/plain": {
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        valid = !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text);
      } catch {
        valid = false;
      }
    }
  }
  if (!valid)
    throw new ErrorHttp(
      415,
      "El contenido no coincide con el tipo de archivo permitido.",
    );
}
