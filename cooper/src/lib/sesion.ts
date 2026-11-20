import { cookies, headers } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { users, allowedEmails } from '@/db/schema';
import { ErrorHttp } from './permisos';
export function testEnabled(host: string) {
  return process.env.COOPER_TEST_MODE === '1' && (process.env.COOPER_TEST_SECRET?.length ?? 0) >= 32 && /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);
}
export function signTestSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, expires: Date.now() + 3600000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', process.env.COOPER_TEST_SECRET!).update(payload).digest('base64url')}`;
}
function readTestSession(value: string): string | undefined {
  try {
    const [payload, signature] = value.split('.');
    const expected = createHmac('sha256', process.env.COOPER_TEST_SECRET!).update(payload).digest('base64url');
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { email: string; expires: number };
    if (data.expires > Date.now()) return data.email;
  } catch { return; }
}
export async function currentUser() {
  let email: string | null | undefined;
  const host = (await headers()).get('host') ?? '';
  if (testEnabled(host)) email = readTestSession((await cookies()).get('cooper-test')?.value ?? '');
  email ??= (await auth())?.user?.email;
  if (!email) throw new ErrorHttp(401, 'Entra con tu cuenta para continuar.');
  const user = db().select().from(users).where(eq(users.email, email.toLowerCase())).get();
  if (!user?.active) throw new ErrorHttp(401, 'Tu sesión ya no está disponible.');
  const allowed = db().select().from(allowedEmails).where(eq(allowedEmails.email, user.email)).get();
  if (!allowed && user.email !== process.env.COOPER_ADMIN_EMAIL?.toLowerCase()) throw new ErrorHttp(403, 'Tu correo no está en la lista permitida.');
  return user;
}
