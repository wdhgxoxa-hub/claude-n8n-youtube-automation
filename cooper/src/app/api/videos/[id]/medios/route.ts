import { after } from "next/server";
import { currentUser } from "@/lib/sesion";
import { failure, rateLimit } from "@/lib/http";
import {
  leerVideoMedios,
  sincronizarVideoMedios,
} from "@/servicios/video-medios";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    rateLimit(`video-medios:${user.id}`, 300);
    const { id } = await context.params;
    const publicacion =
      new URL(request.url).searchParams.get("publicacion") ?? "";
    const medio = leerVideoMedios(user, id, publicacion);
    after(async () => {
      try {
        await sincronizarVideoMedios(user, id, publicacion);
      } catch {
        /* El recurso pudo borrarse/revocarse después de responder. */
      }
    });
    return Response.json(medio, {
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  } catch (error) {
    return failure(error);
  }
}
