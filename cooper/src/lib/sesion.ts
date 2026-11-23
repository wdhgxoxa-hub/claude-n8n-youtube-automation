import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, allowedEmails } from "@/db/schema";
import { ErrorHttp } from "./permisos";
import { temaValido, TEMA_INICIAL, type Tema } from "./temas";
export async function currentUser() {
  const email = (await auth())?.user?.email;
  if (!email) throw new ErrorHttp(401, "Entra con tu cuenta para continuar.");
  const user = db()
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();
  if (!user?.active)
    throw new ErrorHttp(401, "Tu sesión ya no está disponible.");
  const allowed = db()
    .select()
    .from(allowedEmails)
    .where(eq(allowedEmails.email, user.email))
    .get();
  if (!allowed && user.email !== process.env.COOPER_ADMIN_EMAIL?.toLowerCase())
    throw new ErrorHttp(403, "Tu correo no está en la lista permitida.");
  return user;
}

/** Tema de quien tiene sesión; sin sesión (entrada, enlaces públicos), el inicial. */
export async function temaDeLaSesion(): Promise<Tema> {
  try {
    return temaValido((await currentUser()).theme);
  } catch {
    return TEMA_INICIAL;
  }
}
