// Solo admite el token opaco de una revisión. Nunca una URL de redirección arbitraria.
export const patronTokenRevision =
  /^([a-f0-9-]{36})\.(\d{13})\.([A-Za-z0-9_-]{43})$/;
export function destinoRevision(token: unknown) {
  return typeof token === "string" && patronTokenRevision.test(token)
    ? `/revisar/whatsapp/${token}`
    : "/";
}
