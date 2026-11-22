import { currentUser } from "@/lib/sesion";
import { failure, rateLimit } from "@/lib/http";
import { ErrorHttp } from "@/lib/permisos";
import { servirVideoMedio } from "@/servicios/video-medios";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; tipo: string }> },
) {
  try {
    const user = await currentUser();
    rateLimit(`video-medios:${user.id}`, 300);
    const { id, tipo } = await context.params;
    if (tipo !== "poster" && tipo !== "preview")
      throw new ErrorHttp(404, "No encontramos ese medio.");
    const publicacion =
      new URL(request.url).searchParams.get("publicacion") ?? "";
    return servirVideoMedio(user, id, publicacion, tipo, request);
  } catch (error) {
    return failure(error);
  }
}
