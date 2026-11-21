import { Marcas } from "@/componentes/marcas";
import { currentUser } from "@/lib/sesion";
import { estadoMarcas } from "@/servicios/marcas/servicio";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pieza?: string; seccion?: string }>;
}) {
  const { pieza, seccion } = await searchParams;
  const seccionInicial =
    seccion === "publicados" || seccion === "aprendizaje"
      ? seccion
      : "calendario";
  return (
    <Marcas
      key={`${pieza ?? ""}:${seccionInicial}`}
      initial={estadoMarcas(await currentUser())}
      piezaId={pieza}
      seccionInicial={seccionInicial}
    />
  );
}
