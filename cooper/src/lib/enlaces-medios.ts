// Selección de reproductores oficiales sin cargar validadores en el cliente.
export function enlaceIncrustado(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const host = u.hostname.replace(/^www\./, "");
    if (["youtube.com", "youtu.be"].includes(host)) {
      const id =
        host === "youtu.be"
          ? u.pathname.slice(1)
          : u.searchParams.get("v") ||
            u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1];
      return id && /^[\w-]{11}$/.test(id)
        ? `https://www.youtube.com/embed/${id}`
        : null;
    }
    const id =
      host === "tiktok.com" &&
      u.pathname.match(/^\/@[^/]+\/video\/(\d+)$/)?.[1];
    return id ? `https://www.tiktok.com/player/v1/${id}?autoplay=0` : null;
  } catch {
    return null;
  }
}
