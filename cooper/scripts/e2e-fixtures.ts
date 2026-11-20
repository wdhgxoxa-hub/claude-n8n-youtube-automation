// Solo el ejecutor local inicia este proceso. No se importa desde src ni se publica en Next.
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { encode } from "next-auth/jwt";
import { loginGoogle } from "../src/lib/identidad";
import { db } from "../src/db";
import { ErrorHttp } from "../src/lib/permisos";
const secret = process.env.COOPER_E2E_SECRET;
if (
  !secret ||
  secret.length < 32 ||
  !process.env.COOPER_DATABASE_PATH?.includes(".cache/e2e-")
)
  throw new Error("El emisor requiere un entorno E2E aislado.");
db();
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST" || req.url !== "/sesion")
      throw new ErrorHttp(404, "No encontrado");
    let data = "";
    for await (const chunk of req) {
      data += chunk;
      if (data.length > 4096) throw new ErrorHttp(413, "Contenido excesivo");
    }
    const input = JSON.parse(data);
    const supplied = Buffer.from(
      typeof input.secret === "string" ? input.secret : "",
    );
    const expected = Buffer.from(secret);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      throw new ErrorHttp(403, "Credencial inválida");
    if (
      typeof input.email !== "string" ||
      !input.email.endsWith("@example.test")
    )
      throw new ErrorHttp(403, "Solo cuentas ficticias");
    const user = loginGoogle(input.email, input.email.split("@")[0]);
    const salt = "authjs.session-token";
    const token = await encode({
      secret: process.env.AUTH_SECRET!,
      salt,
      token: { sub: user.id, email: user.email, name: user.name },
      maxAge: 3600,
    });
    res.setHeader(
      "Set-Cookie",
      `${salt}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`,
    );
    res.setHeader("Content-Type", "application/json");
    res.end('{"ok":true}');
  } catch (error) {
    res.statusCode = error instanceof ErrorHttp ? error.status : 400;
    res.end('{"error":"No se pudo crear la sesión de ensayo"}');
  }
});
server.listen(33172, "127.0.0.1", () => process.send?.("ready"));
