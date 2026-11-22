import { EntradaMovimiento } from "@/componentes/entrada-movimiento";
import Link from "next/link";
import { redirect } from "next/navigation";
import { destinoRevision } from "@/lib/revision-whatsapp";
import { currentUser } from "@/lib/sesion";
import { resolverEnlace } from "@/servicios/mensajeria/enlaces";
export const metadata = { title: "Revisión desde WhatsApp" };
export default async function RevisionWhatsApp({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await currentUser().catch(() =>
    redirect(
      destinoRevision(token) === "/"
        ? "/entrar"
        : `/entrar?revision=${encodeURIComponent(token)}`,
    ),
  );
  let target: string;
  try {
    target = resolverEnlace(user, token);
  } catch {
    return (
      <main className="page stack estado-espacio">
        <EntradaMovimiento motivo="revision" />
        <h1>Este enlace ya no está disponible</h1>
        <p>
          Puede haber caducado o la revisión cambió. Entra con la cuenta que
          recibió el aviso y abre el video desde tu espacio.
        </p>
        <Link className="button" href="/videos">
          Ver mis videos
        </Link>
      </main>
    );
  }
  redirect(target);
}
