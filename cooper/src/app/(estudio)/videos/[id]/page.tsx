import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { currentUser } from "@/lib/sesion";
import { requireOwner } from "@/lib/permisos";
import { DetalleVideo } from "@/componentes/gestion";
export const metadata = { title: "Detalle del video" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  const { id } = await params;
  try {
    requireOwner(
      user,
      db().select().from(videos).where(eq(videos.id, id)).get(),
    );
  } catch {
    notFound();
  }
  return <DetalleVideo id={id} />;
}
