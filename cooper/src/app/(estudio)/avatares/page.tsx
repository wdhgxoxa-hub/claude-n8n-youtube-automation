import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { currentUser } from "@/lib/sesion";
import { Avatares } from "@/componentes/avatares";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ foto?: string | string[] }>;
}) {
  const user = await currentUser();
  const { foto } = await searchParams;
  if (foto && (typeof foto !== "string" || foto.length > 100)) notFound();
  if (foto) {
    const file = db()
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, foto), eq(attachments.ownerId, user.id)))
      .get();
    if (!file?.mime.startsWith("image/")) notFound();
  }
  return <Avatares key={foto ?? "catalogo"} fotoId={foto} />;
}
