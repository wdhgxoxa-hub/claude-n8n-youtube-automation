import { expect, it, vi } from "vitest";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, channels, videos } from "@/db/schema";
import { sinObservabilidad } from "@/contratos/observabilidad";
import { extraerTinte, tinteVideo } from "@/servicios/tinte-video";
import { descargarImagenVisual } from "@/servicios/marcas/visual";

function preparar(miniatura = "https://cdninstagram.com/prueba.png") {
  const id = randomUUID();
  const user = db()
    .insert(users)
    .values({ id, email: `${id}@example.test`, name: "Ensayo de tinte" })
    .returning()
    .get();
  db()
    .insert(channels)
    .values({ id, ownerId: id, name: "Ensayo", niche: "Ensayo", createdAt: 1 })
    .run();
  db()
    .insert(videos)
    .values({
      id,
      ownerId: id,
      channelId: id,
      title: "Miniatura ficticia",
      script: "",
      updatedAt: 1,
      createdAt: 1,
      observability: JSON.stringify({ ...sinObservabilidad, miniatura }),
    })
    .run();
  return { user, id };
}

const imagen = (r: number, g: number, b: number) =>
  sharp({
    create: { width: 16, height: 16, channels: 3, background: { r, g, b } },
  })
    .png()
    .toBuffer();
const transporteImagen = (buffer: Buffer) =>
  vi.fn<typeof fetch>(async (_url, init) => {
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    return new Response(new Uint8Array(buffer), {
      headers: { "content-type": "image/png" },
    });
  });

it.each([
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [0, 0, 0],
  [255, 255, 255],
])(
  "extrae HSL de búfer ficticio y limita saturación/luminosidad %s %s %s",
  async (r, g, b) => {
    const color = await extraerTinte(await imagen(r, g, b));
    const [, h, s, l] = color.match(/^hsl\((\d+) (\d+)% (\d+)%\)$/)!;
    expect(Number(h)).toBeGreaterThanOrEqual(0);
    expect(Number(h)).toBeLessThan(360);
    expect(Number(s)).toBeLessThanOrEqual(60);
    expect(Number(l)).toBeGreaterThanOrEqual(45);
    expect(Number(l)).toBeLessThanOrEqual(60);
  },
);

it("guarda solo color y vencimiento, reutiliza caché privado y permite admin", async () => {
  const { user, id } = preparar();
  const directorio = await mkdtemp(join(tmpdir(), "cooper-tinte-"));
  const transporte = transporteImagen(await imagen(255, 0, 0));
  const color = await tinteVideo(user, id, { directorio, transporte });
  expect(color).toMatch(/^hsl/);
  expect(await tinteVideo(user, id, { directorio, transporte })).toBe(color);
  expect(
    await tinteVideo(
      { ...user, id: "administrador-ficticio", role: "admin" },
      id,
      { directorio, transporte },
    ),
  ).toBe(color);
  expect(transporte).toHaveBeenCalledTimes(1);
  const [archivo] = await readdir(directorio);
  expect(archivo).toMatch(/^[a-f0-9]{64}\.json$/);
  const guardado = await readFile(join(directorio, archivo), "utf8");
  expect(Object.keys(JSON.parse(guardado)).sort()).toEqual(["color", "hasta"]);
  expect(guardado).not.toContain(id);
  expect(guardado).not.toContain("https:");
  expect((await stat(join(directorio, archivo))).mode & 0o777).toBe(0o600);
  expect((await stat(directorio)).mode & 0o777).toBe(0o700);
});

it("autoriza antes de caché o descarga y aísla dueño aunque la URL coincida", async () => {
  const primero = preparar(),
    segundo = preparar();
  const directorio = await mkdtemp(join(tmpdir(), "cooper-tinte-"));
  const transporte = transporteImagen(await imagen(0, 0, 255));
  await expect(
    tinteVideo(segundo.user, primero.id, { directorio, transporte }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    tinteVideo(primero.user, "inexistente", { directorio, transporte }),
  ).rejects.toMatchObject({ status: 404 });
  expect(transporte).not.toHaveBeenCalled();
  await tinteVideo(primero.user, primero.id, { directorio, transporte });
  await tinteVideo(segundo.user, segundo.id, { directorio, transporte });
  expect(await readdir(directorio)).toHaveLength(2);
});

it("cambia la clave al actualizar la miniatura y no descarga en simulación", async () => {
  const { user, id } = preparar();
  expect(await tinteVideo(user, id)).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  const directorio = await mkdtemp(join(tmpdir(), "cooper-tinte-"));
  const transporte = transporteImagen(await imagen(0, 255, 0));
  await tinteVideo(user, id, { directorio, transporte });
  db()
    .update(videos)
    .set({ remoteUpdatedAt: 2 })
    .where(eq(videos.id, id))
    .run();
  await tinteVideo(user, id, { directorio, transporte });
  expect(transporte).toHaveBeenCalledTimes(2);
});

it.each([
  "https://localhost/a.png",
  "https://127.0.0.1/a.png",
  "https://169.254.169.254/a.png",
  "https://fbcdn.net.evil.test/a.png",
  "https://cdninstagram.com@evil.test/a.png",
  "https://cdninstagram.com:8443/a.png",
  "http://cdninstagram.com/a.png",
])("no descarga origen ajeno %s", async (url) => {
  const transporte = vi.fn<typeof fetch>();
  expect(await descargarImagenVisual(url, transporte, true)).toBeNull();
  expect(transporte).not.toHaveBeenCalled();
});

it("rechaza redirección, SVG y cuerpo mayor que 5MB", async () => {
  for (const response of [
    new Response(null, {
      status: 302,
      headers: { location: "http://localhost" },
    }),
    new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }),
    new Response(new Uint8Array(5 * 1024 * 1024 + 1), {
      headers: { "content-type": "image/png" },
    }),
  ]) {
    const transporte = vi.fn<typeof fetch>(async () => response);
    expect(
      await descargarImagenVisual(
        "https://cdninstagram.com/ficticia.png",
        transporte,
      ),
    ).toBeNull();
  }
});
