import type { User } from '@/db/schema';
export class ErrorHttp extends Error { constructor(public status: number, message: string) { super(message); } }
export function requireAdmin(user: User) { if (user.role !== 'admin') throw new ErrorHttp(403, 'Esta sección es solo para el administrador.'); }
export function requireOwner(user: User, resource: { ownerId: string } | undefined) {
  if (!resource || (resource.ownerId !== user.id && user.role !== 'admin')) throw new ErrorHttp(404, 'No encontramos ese recurso.');
  return resource;
}
export function requireOwn(user: User, resource: { ownerId: string } | undefined) {
  if (!resource || resource.ownerId !== user.id) throw new ErrorHttp(404, 'No encontramos ese recurso.');
  return resource;
}
