import { failure, json } from "@/lib/http";
import { recibirTrabajo } from "@/servicios/marcas/worker";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    return json(await recibirTrabajo(request));
  } catch (error) {
    return failure(error);
  }
}
