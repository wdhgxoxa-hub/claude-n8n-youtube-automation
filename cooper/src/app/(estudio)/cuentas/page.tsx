import { PantallaOperacion } from "@/componentes/operacion";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ canal?: string }>;
}) {
  const { canal } = await searchParams;
  return <PantallaOperacion vista="cuentas" canalId={canal} />;
}
