"use client";
import { useEffect, useState, type CSSProperties } from "react";

/** El cliente solo comunica el id; el servidor decide qué miniatura puede leer. */
export function useTinteVideo(videoId?: string): CSSProperties | undefined {
  const [tinte, setTinte] = useState<{ id: string; color: string }>();
  useEffect(() => {
    if (!videoId) return;
    const controller = new AbortController();
    void fetch(`/api/videos/${encodeURIComponent(videoId)}/tinte`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) =>
        response.ok ? (response.json() as Promise<{ color?: unknown }>) : null,
      )
      .then((data) => {
        if (
          typeof data?.color === "string" &&
          /^hsl\(\d{1,3} \d{1,2}% \d{1,2}%\)$/.test(data.color)
        )
          setTinte({ id: videoId, color: data.color });
      })
      .catch(() => {
        /* El contenido sigue visible sin halo. */
      });
    return () => controller.abort();
  }, [videoId]);
  return tinte && tinte.id === videoId
    ? ({ "--tinte": tinte.color } as CSSProperties)
    : undefined;
}
