import { importarMediosWhatsApp } from "./adjuntos-whatsapp";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ErrorHttp } from "@/lib/permisos";
import { actualizarMetricas, procesarMarcas } from "./servicio";
export async function recibirTrabajo(request: Request, now = Date.now()) {
  const secret = process.env.COOPER_MARCAS_WORKER_SECRET;
  if (!secret || secret.length < 32)
    throw new ErrorHttp(503, "Trabajador no configurado.");
  const timestamp = request.headers.get("x-cooper-time") ?? "",
    signature = request.headers.get("x-cooper-signature") ?? "";
  if (
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp)) > 300000 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    throw new ErrorHttp(401, "Firma inválida.");
  const reader = request.body?.getReader();
  if (!reader) throw new ErrorHttp(400, "Falta contenido.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 2048) {
      await reader.cancel();
      throw new ErrorHttp(413, "Solicitud demasiado grande.");
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  if (
    !timingSafeEqual(
      createHmac("sha256", secret).update(`${timestamp}.${body}`).digest(),
      Buffer.from(signature, "hex"),
    )
  )
    throw new ErrorHttp(401, "Firma inválida.");
  const data = z
    .object({ accion: z.enum(["publicar", "metricas"]) })
    .strict()
    .parse(JSON.parse(body));
  if (data.accion === "publicar") await importarMediosWhatsApp();
  return data.accion === "publicar"
    ? procesarMarcas(undefined, now)
    : actualizarMetricas(undefined, now);
}
