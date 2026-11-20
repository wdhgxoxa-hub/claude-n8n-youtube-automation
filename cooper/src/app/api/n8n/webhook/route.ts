import { failure, json } from "@/lib/http";
import { procesarWebhook } from "@/servicios/puente";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    return json(await procesarWebhook(request));
  } catch (error) {
    return failure(error);
  }
}
