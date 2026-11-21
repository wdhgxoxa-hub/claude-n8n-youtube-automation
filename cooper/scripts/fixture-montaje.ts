// Importado solo por el emisor E2E aislado; nunca por la aplicación.
import { execFileSync } from "node:child_process";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { channels, videos, montajesFabrica, type User } from "../src/db/schema";
import { sinObservabilidad } from "../src/contratos/observabilidad";
import {
  listarMontajes,
  prepararMontaje,
} from "../src/servicios/marcas/montajes";
import { piezaSchema } from "../src/servicios/marcas/tipos";
export async function fixtureMontaje(user: User, accion: "crear" | "cambiar") {
  const videoId = `montaje-e2e-${user.id}`,
    channelId = `canal-montaje-${user.id}`;
  if (accion === "cambiar") {
    db()
      .update(videos)
      .set({ script: "Guion corregido después de la revisión" })
      .where(eq(videos.id, videoId))
      .run();
    return;
  }
  db()
    .insert(channels)
    .values({
      id: channelId,
      ownerId: user.id,
      name: "Montajes E2E",
      niche: "Ensayo ficticio",
      createdAt: Date.now(),
    })
    .onConflictDoNothing()
    .run();
  db()
    .insert(videos)
    .values({
      id: videoId,
      channelId,
      ownerId: user.id,
      title: "Montaje sintético aprobado",
      script: "Un segundo azul con tono",
      stage: 10,
      scheduledAt: "2035-01-01T12:00:00Z",
      observability: JSON.stringify({
        ...sinObservabilidad,
        montaje: `https://cdn.creatomate.com/renders/${videoId}.mp4?firma=solo-ficticia`,
      }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .onConflictDoNothing()
    .run();
  const mp4 = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=160x240:r=10",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440",
    "-t",
    "1",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    "-c:a",
    "aac",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "frag_keyframe+empty_moov",
    "-f",
    "mp4",
    "pipe:1",
  ]);
  const revision = listarMontajes(user).find((v) => v.id === videoId)!.revision;
  const datos = piezaSchema.parse({
    cuentaId: "solo-fixture",
    formato: "reel",
    plantilla: "libre",
    titulo: "Montaje sintético",
    texto: "Ensayo",
    videoId,
    montaje: { revision },
  });
  // El transporte falso prepara la copia por el mismo validador; no hay red externa.
  const copy = await prepararMontaje(
    user.id,
    datos,
    async () =>
      new Response(new Uint8Array(mp4), {
        headers: { "content-type": "video/mp4" },
      }),
  );
  db().insert(montajesFabrica).values(copy).onConflictDoNothing().run();
}
