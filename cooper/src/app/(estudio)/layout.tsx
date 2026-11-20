import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { currentUser } from '@/lib/sesion';
import { estado } from '@/servicios/datos';
import { Espacio } from '@/componentes/espacio';
import { signOut } from '@/auth';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}) {
 const user=await currentUser().catch(()=>redirect('/entrar'));
 async function logout(){'use server';(await cookies()).delete('cooper-test');await signOut({redirectTo:'/entrar'});}
 return <Espacio initial={estado(user)} logout={logout}>{children}</Espacio>;
}
