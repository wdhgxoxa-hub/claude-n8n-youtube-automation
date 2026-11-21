import { currentUser } from "@/lib/sesion";
import { requireAdmin } from "@/lib/permisos";
import { body, failure, json, rateLimit } from "@/lib/http";
import {
  guardarConfiguracionSalud,
  leerPanelSalud,
} from "@/servicios/alertas-salud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await currentUser();
    requireAdmin(user);
    rateLimit(`salud:${user.id}`, 30);
    return json(await leerPanelSalud(user));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    requireAdmin(user);
    rateLimit(user.id);
    return json({
      configuracion: guardarConfiguracionSalud(user, await body(request)),
    });
  } catch (error) {
    return failure(error);
  }
}
