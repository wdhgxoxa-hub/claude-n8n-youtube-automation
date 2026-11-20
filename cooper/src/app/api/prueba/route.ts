import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { testEnabled, signTestSession } from "@/lib/sesion";
import { loginGoogle } from "@/lib/identidad";
import { body, failure, json } from "@/lib/http";
import { ErrorHttp } from "@/lib/permisos";
export async function POST(request: Request) {
  try {
    if (!testEnabled(request.headers.get("host") ?? ""))
      throw new ErrorHttp(404, "No encontrado.");
    const { secret, email } = z
      .object({ secret: z.string(), email: z.email() })
      .parse(await body(request));
    const expected = process.env.COOPER_TEST_SECRET!;
    if (
      secret.length !== expected.length ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
    )
      throw new ErrorHttp(403, "Credencial inválida.");
    const user = loginGoogle(email, email.split("@")[0]);
    (await cookies()).set("cooper-test", signTestSession(user.email), {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
      maxAge: 3600,
    });
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
