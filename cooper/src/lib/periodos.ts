/** Día operativo de Lima (UTC−05, sin horario de verano). */
export function periodosLima(now = Date.now()) {
  const offset = 5 * 3600000;
  const local = new Date(now - offset);
  const day =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) +
    offset;
  return {
    day,
    week: day - ((local.getUTCDay() + 6) % 7) * 86400000,
    month: Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + offset,
    date: local.toISOString().slice(0, 10),
  };
}
