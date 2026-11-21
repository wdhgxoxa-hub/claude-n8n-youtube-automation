import { PantallaOperacion } from "@/componentes/operacion";
export const metadata = { title: "Adoptar cuenta" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ canal?: string }>;
}) {
  const { canal } = await searchParams;
  return <PantallaOperacion vista="cuentas" canalId={canal} />;
}
