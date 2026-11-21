import { currentUser } from "@/lib/sesion";
import { failure, rateLimit } from "@/lib/http";
import { leerMedio } from "@/servicios/marcas/servicio";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params,
      url = new URL(request.url);
    const user = url.searchParams.has("s") ? undefined : await currentUser();
    // Las peticiones sin sesión comparten una clave fija: rotar IDs no debe
    // saltarse el límite ni hacer crecer el mapa con claves elegidas por terceros.
    if (user) rateLimit(`medio:${user.id}`, 120);
    else rateLimit("medio:publico", 300);
    const a = leerMedio(id, url, user);
    return new Response(Buffer.from(a.data, "base64"), {
      headers: {
        "Content-Type": a.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
