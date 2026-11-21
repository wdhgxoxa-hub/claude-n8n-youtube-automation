// Solo el ejecutor local inicia este proceso. No se importa desde src ni se publica en Next.
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { encode } from "next-auth/jwt";
import { loginGoogle } from "../src/lib/identidad";
import { db } from "../src/db";
import { assets, attachments, users, chatActions } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { crearReto } from "../src/servicios/biblioteca";
import { VozSimulada } from "../src/servicios/proveedores/simulados";
async function prepararRevisionDemo() {
  if (
    process.env.COOPER_DEMO !== "1" ||
    db()
      .select()
      .from(assets)
      .where(eq(assets.id, "demo-identidad-pendiente"))
      .get()
  )
    return;
  const owner =
    db()
      .insert(users)
      .values({
        id: "demo-identidad",
        email: "identidad@example.test",
        name: "Identidad ficticia",
      })
      .onConflictDoNothing()
      .returning()
      .get() ??
    db().select().from(users).where(eq(users.id, "demo-identidad")).get()!;
  const file = await new VozSimulada().sintetizar();
  const evidenceId = "demo-grabacion";
  db()
    .insert(attachments)
    .values({
      id: evidenceId,
      ownerId: owner.id,
      name: "Muestra ficticia.wav",
      mime: file.mime,
      data: file.data,
      size: Buffer.from(file.data, "base64").length,
    })
    .onConflictDoNothing()
    .run();
  const challenge = crearReto(owner, "voz");
  db()
    .insert(assets)
    .values({
      id: "demo-identidad-pendiente",
      ownerId: owner.id,
      kind: "voz",
      name: "Voz de ensayo · identidad ficticia",
      evidenceId,
      challengeId: challenge.id,
      status: "revision",
      provider: "simulada",
      simulated: true,
      consentAt: Date.now(),
      consentText: "Material ficticio para comprobar la revisión de identidad.",
      consentVersion: "ensayo",
      createdAt: Date.now(),
    })
    .run();
}

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
    if (req.method === "GET" && req.url === "/destino") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ destino: "cooper-e2e-aislado" }));
      return;
    }
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
      (!input.email.endsWith("@example.test") &&
        !(
          process.env.COOPER_ENSAYO === "1" &&
          input.email === process.env.COOPER_ADMIN_EMAIL
        ))
    )
      throw new ErrorHttp(403, "Solo cuentas ficticias");
    const user = loginGoogle(input.email, input.email.split("@")[0]);
    if (input.escenario === "conciliacion" && user.role === "admin") {
      db()
        .insert(chatActions)
        .values({
          id: "e2e-conciliacion",
          ownerId: user.id,
          tool: "nuevo_canal",
          arguments: "{}",
          fingerprint: "ensayo",
          channelId: "",
          title: "Operación ficticia interrumpida",
          detail: "",
          status: "revisar",
          createdAt: Date.now() - 600000,
          expiresAt: Date.now() + 600000,
        })
        .onConflictDoNothing()
        .run();
    }
    await prepararRevisionDemo();
    const secure = process.env.AUTH_URL?.startsWith("https://") === true;
    const salt = `${secure ? "__Secure-" : ""}authjs.session-token`;
    const token = await encode({
      secret: process.env.AUTH_SECRET!,
      salt,
      token: { sub: user.id, email: user.email, name: user.name },
      maxAge: 3600,
    });
    res.setHeader(
      "Set-Cookie",
      `${salt}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${secure ? "; Secure" : ""}`,
    );
    res.setHeader("Content-Type", "application/json");
    res.end('{"ok":true}');
  } catch (error) {
    res.statusCode = error instanceof ErrorHttp ? error.status : 400;
    res.end('{"error":"No se pudo crear la sesión de ensayo"}');
  }
});
server.listen(
  Number(process.env.COOPER_E2E_FIXTURE_PORT ?? 33172),
  "127.0.0.1",
  () => process.send?.("ready"),
);
