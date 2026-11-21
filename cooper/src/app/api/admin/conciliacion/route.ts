import { currentUser } from "@/lib/sesion";
import { body, failure, json, rateLimit } from "@/lib/http";
import { ErrorHttp } from "@/lib/permisos";
import {
  conciliarOperacion,
  consultarCaso,
  listarConciliacion,
  tipoConciliacion,
} from "@/servicios/conciliacion";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    rateLimit(`read:${user.id}`, 300);
    const params = new URL(request.url).searchParams;
    if (params.has("tipo") || params.has("id")) {
      const id = params.get("id");
      if (!id || id.length > 512)
        throw new ErrorHttp(400, "Falta el identificador de operación.");
      return json(
        consultarCaso(user, tipoConciliacion.parse(params.get("tipo")), id),
      );
    }
    return json(listarConciliacion(user));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    rateLimit(user.id);
    // Exigir origen también en esta rama anterior al endurecimiento de total-seguridad.
    if (
      request.headers.get("origin") !==
      new URL(process.env.AUTH_URL ?? request.url).origin
    )
      throw new ErrorHttp(403, "Origen no permitido.");
    return json(await conciliarOperacion(user, await body(request)));
  } catch (e) {
    return failure(e);
  }
}
