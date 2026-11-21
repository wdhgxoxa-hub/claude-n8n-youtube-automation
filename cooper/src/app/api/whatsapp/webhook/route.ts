import { failure, json } from "@/lib/http";
import {
  recibirWhatsApp,
  verificarSuscripcion,
} from "@/servicios/mensajeria/webhook";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    return new Response(verificarSuscripcion(new URL(request.url)), {
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    return json(await recibirWhatsApp(request));
  } catch (error) {
    return failure(error);
  }
}
