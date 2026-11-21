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
  enviar(mensaje: MensajeWhatsApp, id: string): Promise<{ id: string }>;
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
export class WhatsAppCloudAPI implements ProveedorMensajeria {
  readonly simulada = false;
  constructor(private transporte: typeof fetch = fetch) {}
  async enviar(mensaje: MensajeWhatsApp) {
    const token = process.env.WHATSAPP_TOKEN;
    const phone = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phone || !/^\d+$/.test(phone))
      throw new ErrorMensajeria("permanente", "configuracion");
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
    if (!response.ok) {
      const parsed = fallo.safeParse(data);
      const temporal =
        response.status === 429 ||
        (parsed.success && parsed.data.error.is_transient === true);
      const retry = response.headers.get("retry-after");
      const delay =
        retry && /^\d+$/.test(retry)
          ? Number(retry) * 1000
          : retry
            ? Date.parse(retry) - Date.now()
            : 0;
      throw new ErrorMensajeria(
        temporal
          ? "temporal"
          : response.status >= 500
            ? "incierto"
            : "permanente",
        parsed.success
          ? String(parsed.data.error.code)
          : `http_${response.status}`,
        Number.isFinite(delay) ? Math.max(0, Math.min(delay, 86400000)) : 0,
      );
    }
    const parsed = respuesta.safeParse(data);
    if (!parsed.success) throw new ErrorMensajeria("incierto", "respuesta");
    return { id: parsed.data.messages[0].id };
  }
}
export class WhatsAppSimulada implements ProveedorMensajeria {
  readonly simulada = true;
  // No guarda cuerpo, teléfono, código ni enlaces en logs.
  async enviar(_mensaje: MensajeWhatsApp, id: string) {
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
