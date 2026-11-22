// Nombre visible de cada red: una sola fuente para filtros, paredes y lecciones.
const nombres: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  x: "X",
};

export function nombreRed(red: string) {
  const clave = red.trim().toLowerCase();
  if (!clave) return "";
  return (
    nombres[clave] ??
    // «YouTube Shorts», «Instagram Reels»: se corrige cada palabra conocida.
    clave
      .split(/\s+/)
      .map(
        (palabra) =>
          nombres[palabra] ?? palabra[0].toUpperCase() + palabra.slice(1),
      )
      .join(" ")
  );
}
