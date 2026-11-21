import { Marcas } from "@/componentes/marcas";
import { currentUser } from "@/lib/sesion";
import { estadoMarcas } from "@/servicios/marcas/servicio";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = { title: "Marcas" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pieza?: string; marca?: string; seccion?: string }>;
}) {
  const { pieza, marca, seccion } = await searchParams;
  const initial = estadoMarcas(await currentUser());
  if (
    pieza &&
    !initial.marcas.some((m) => m.piezas.some((p) => p.id === pieza))
  )
    notFound();
  if (marca && !initial.marcas.some((m) => m.id === marca)) notFound();
  const seccionInicial =
    seccion === "publicados" ||
    seccion === "aprendizaje" ||
    seccion === "estudio" ||
    seccion === "competencia" ||
    seccion === "tienda"
      ? seccion
      : "calendario";
  return (
    <Marcas
      key={`${pieza ?? ""}:${marca ?? ""}:${seccionInicial}`}
      initial={initial}
      piezaId={pieza}
      marcaId={marca}
      seccionInicial={seccionInicial}
    />
  );
}
