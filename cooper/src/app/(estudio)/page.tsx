import { Inicio } from "@/componentes/inicio";
export const metadata = { title: "Inicio" };
export default function Page() {
  // eslint-disable-next-line react-hooks/purity -- RSC autenticado y dinámico: fija un único instante serializado para SSR e hidratación.
  return <Inicio ahora={Date.now()} />;
}
