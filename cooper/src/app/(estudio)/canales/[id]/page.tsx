import { PantallaOperacion } from "@/componentes/operacion";
import { currentUser } from "@/lib/sesion";
import { requireOwner } from "@/lib/permisos";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { eq } from "drizzle-orm";
export const metadata = { title: "Biblia del canal" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  requireOwner(
    await currentUser(),
    db().select().from(channels).where(eq(channels.id, id)).get(),
  );
  return <PantallaOperacion vista="biblia" canalId={id} />;
}
