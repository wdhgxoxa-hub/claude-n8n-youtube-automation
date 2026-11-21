import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users, allowedEmails } from "@/db/schema";
import { ErrorHttp } from "./permisos";
import { prepararDemo } from "@/servicios/demo";
export function loginGoogle(email: string, name: string, image = "") {
  email = email.trim().toLowerCase();
  const adminEmail = process.env.COOPER_ADMIN_EMAIL?.trim().toLowerCase();
  const database = db();
  const result = database.transaction(
    (tx) => {
      const existing = tx
        .select()
        .from(users)
        .where(eq(users.email, email))
        .get();
      const allowed = tx
        .select()
        .from(allowedEmails)
        .where(eq(allowedEmails.email, email))
        .get();
      if (email !== adminEmail && !allowed)
        throw new ErrorHttp(403, "Tu correo no está en la lista del equipo.");
      if (existing) {
        if (!existing.active)
          throw new ErrorHttp(403, "Esta cuenta está desactivada.");
        return existing;
      }
      if (tx.select().from(users).all().length >= 10)
        throw new ErrorHttp(409, "El equipo admite hasta diez cuentas.");
      if (
        email === adminEmail &&
        tx.select().from(users).where(eq(users.role, "admin")).get()
      )
        throw new ErrorHttp(409, "El equipo ya tiene un administrador.");
      const user = {
        id: randomUUID(),
        email,
        name: name || email.split("@")[0],
        image,
        role: email === adminEmail ? ("admin" as const) : ("usuario" as const),
      };
      tx.insert(users).values(user).run();
      if (email === adminEmail)
        tx.insert(allowedEmails)
          .values({ email, createdAt: Date.now() })
          .onConflictDoNothing()
          .run();
      return tx.select().from(users).where(eq(users.id, user.id)).get()!;
    },
    { behavior: "immediate" },
  );
  prepararDemo(result);
  return result;
}
