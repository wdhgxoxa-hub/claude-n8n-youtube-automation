import { z } from "zod";
import { ErrorHttp } from "@/lib/permisos";

export type MensajeWhatsApp = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
} & (
  | {
      type: "template";
      template: {
        name: string;
        language: { code: "es" };
        components: unknown[];
      };
    }
  | {
      type: "text";
      context: { message_id: string };
      text: { body: string; preview_url: false };
    }
  | {
      type: "interactive";
      interactive: {
        type: "button";
        body: { text: string };
        action: {
          buttons: { type: "reply"; reply: { id: string; title: string } }[];
        };
      };
    }
);
export interface ProveedorMensajeria {
  readonly simulada: boolean;
  enviar(
    mensaje: MensajeWhatsApp,
    id: string,
    revalidar?: () => void,
  ): Promise<{ id: string }>;
}
export function mensajeriaPausada() {
  return process.env.COOPER_MENSAJERIA_PAUSA === "1";
}
function comprobarPausa() {
  if (mensajeriaPausada()) throw new ErrorMensajeria("temporal", "pausa");
}
export class ErrorMensajeria extends Error {
  constructor(
    public clase: "temporal" | "permanente" | "incierto",
    public codigo: string,
    public esperaMs = 0,
  ) {
    super("No se pudo confirmar el envío de WhatsApp.");
  }
}
const respuesta = z.object({
  messages: z.array(z.object({ id: z.string().min(1).max(512) })).min(1),
});
const fallo = z.object({
  error: z.object({
    code: z.number().int(),
    is_transient: z.boolean().optional(),
  }),
});
const plantillas = z.object({
  data: z.array(
    z.object({ name: z.string(), language: z.string(), status: z.string() }),
  ),
});
// Códigos de rechazo expresamente reintentables; un timeout del POST no entra aquí.
const temporales = new Set([
  2, 4, 80007, 130429, 131000, 131016, 131056, 131057, 133004,
]);
function errorRespuesta(response: Response, data: unknown, lectura = false) {
  const parsed = fallo.safeParse(data);
  const temporal =
    response.status === 429 ||
    (lectura && response.status >= 500) ||
    (parsed.success &&
      (temporales.has(parsed.data.error.code) ||
        parsed.data.error.is_transient === true));
  const retry = response.headers.get("retry-after");
  const delay =
    retry && /^\d+$/.test(retry)
      ? Number(retry) * 1000
      : retry
        ? Date.parse(retry) - Date.now()
        : 0;
  return new ErrorMensajeria(
    temporal ? "temporal" : response.status >= 500 ? "incierto" : "permanente",
    parsed.success ? String(parsed.data.error.code) : `http_${response.status}`,
    Number.isFinite(delay) ? Math.max(0, Math.min(delay, 86400000)) : 0,
  );
}
export class WhatsAppCloudAPI implements ProveedorMensajeria {
  readonly simulada = false;
  constructor(private transporte: typeof fetch = fetch) {}
  async enviar(mensaje: MensajeWhatsApp, _id?: string, revalidar?: () => void) {
    comprobarPausa();
    const token = process.env.WHATSAPP_TOKEN;
    const phone = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phone || !/^\d+$/.test(phone))
      throw new ErrorMensajeria("permanente", "configuracion");
    if (mensaje.type === "template") {
      const waba = process.env.WHATSAPP_WABA_ID;
      if (!waba || !/^\d+$/.test(waba))
        throw new ErrorMensajeria("permanente", "configuracion_plantillas");
      const url = new URL(
        `https://graph.facebook.com/v27.0/${waba}/message_templates`,
      );
      url.searchParams.set("name", mensaje.template.name);
      url.searchParams.set("language", mensaje.template.language.code);
      url.searchParams.set("fields", "name,language,status");
      let approval: Response;
      try {
        approval = await this.transporte(url.toString(), {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
          redirect: "error",
          cache: "no-store",
        });
      } catch {
        // La consulta no envía mensajes; repetirla no puede duplicar el POST.
        throw new ErrorMensajeria("temporal", "consulta_plantilla");
      }
      const data: unknown = await approval.json().catch(() => null);
      if (!approval.ok) throw errorRespuesta(approval, data, true);
      const parsed = plantillas.safeParse(data);
      if (!parsed.success)
        throw new ErrorMensajeria("temporal", "respuesta_plantilla");
      const exactas = parsed.data.data.filter(
        (p) =>
          p.name === mensaje.template.name &&
          p.language === mensaje.template.language.code,
      );
      if (exactas.length !== 1 || exactas[0].status !== "APPROVED")
        throw new ErrorMensajeria("permanente", "plantilla_no_aprobada");
    }
    comprobarPausa();
    // Revalidar tras la consulta asíncrona evita enviar con consentimiento o revisión ya revocados.
    revalidar?.();
    let response: Response;
    try {
      response = await this.transporte(
        `https://graph.facebook.com/v27.0/${phone}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mensaje),
          signal: AbortSignal.timeout(10000),
          redirect: "error",
          cache: "no-store",
        },
      );
    } catch {
      // Meta no documenta una clave de idempotencia para /messages. No reenviar un POST ambiguo.
      throw new ErrorMensajeria("incierto", "red");
    }
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) throw errorRespuesta(response, data);
    const parsed = respuesta.safeParse(data);
    if (!parsed.success) throw new ErrorMensajeria("incierto", "respuesta");
    return { id: parsed.data.messages[0].id };
  }
}
export class WhatsAppSimulada implements ProveedorMensajeria {
  readonly simulada = true;
  // No guarda cuerpo, teléfono, código ni enlaces en logs.
  async enviar(_mensaje: MensajeWhatsApp, id: string, revalidar?: () => void) {
    comprobarPausa();
    revalidar?.();
    return { id: `simulada.${id}` };
  }
}
export function proveedorMensajeria(): ProveedorMensajeria {
  const mode =
    process.env.COOPER_DEMO === "1"
      ? "simulada"
      : (process.env.COOPER_MENSAJERIA ?? "simulada");
  if (mode === "simulada") return new WhatsAppSimulada();
  if (mode === "whatsapp") return new WhatsAppCloudAPI();
  throw new ErrorHttp(503, "Configuración de avisos inválida.");
}
