import { redirect } from "next/navigation";
import { currentUser } from "@/lib/sesion";
import { estado } from "@/servicios/datos";
import { Espacio } from "@/componentes/espacio";
import { signOut } from "@/auth";
// Estilos del esqueleto de las secciones (componentes/carga-estudio.tsx): se
// cargan con el armazón para que la hoja esté en uso en todas las rutas, también
// en Inicio, que no tiene esqueleto propio. Si solo la importara el esqueleto,
// Inicio la precargaría para los enlaces sin usarla (aviso de consola).
import "@/componentes/resto-diseno.css";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser().catch(() => redirect("/entrar"));
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/entrar" });
  }
  return (
    <Espacio initial={estado(user)} logout={logout}>
      {children}
    </Espacio>
  );
}
