import { beforeAll, expect, it, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  allowedEmails,
  channels,
  videos,
  assets,
  montajesFabrica,
  piezasMarca,
  type User,
} from "@/db/schema";
import { loginGoogle } from "@/lib/identidad";
import { sinObservabilidad } from "@/contratos/observabilidad";
import {
  guardarMarca,
  agregarCuenta,
  conectarCuenta,
  guardarPieza,
  enviarRevision,
  obtenerPieza,
  leerMedio,
  decidirPieza,
  urlsMedios,
  estadoMarcas,
  procesarMarcas,
} from "@/servicios/marcas/servicio";
import { listarMontajes, MAX_MONTAJE_BYTES } from "@/servicios/marcas/montajes";
import { revocarConsentimiento } from "@/servicios/presentacion";
import { RedSimulada } from "@/servicios/marcas/redes";
import { proponerTexto } from "@/servicios/marcas/especialistas";
import { GET as archivoGET } from "@/app/api/[...ruta]/route";
import { GET as medioGET } from "@/app/api/marcas/medio/[id]/route";
vi.mock("@/lib/sesion", () => ({ currentUser: async () => owner }));
let admin: User, owner: User, mp4: Buffer;
beforeAll(() => {
  admin = loginGoogle("admin@example.test", "Walter");
  db()
    .insert(allowedEmails)
    .values(
      ["montajes@example.test", "otro-montaje@example.test"].map((email) => ({
        email,
        createdAt: Date.now(),
      })),
    )
    .run();
  owner = loginGoogle("montajes@example.test", "Montajes");
  mp4 = execFileSync("ffmpeg", [
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
});
async function escenario() {
  const m = guardarMarca(owner, {
    nombre: "Montajes propios",
    rubro: "general",
  });
  const c = agregarCuenta(owner, m.id, {
    red: "youtube",
    alias: "Ensayo",
    remoto: randomUUID(),
  });
  await conectarCuenta(admin, c.id);
  const channelId = randomUUID(),
    videoId = randomUUID();
  db()
    .insert(channels)
    .values({
      id: channelId,
      ownerId: owner.id,
      name: "Canal",
      niche: "Ensayo",
      createdAt: Date.now(),
    })
    .run();
  db()
    .insert(videos)
    .values({
      id: videoId,
      channelId,
      ownerId: owner.id,
      title: "Montaje aprobado",
      script: "Guion aprobado",
      stage: 10,
      observability: JSON.stringify({
        ...sinObservabilidad,
        montaje: `https://cdn.creatomate.com/renders/${videoId}.mp4?firma=ficticia`,
      }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .run();
  return { m, c, videoId };
}
it("reutiliza un MP4 aprobado sin adjuntarlo ni regenerarlo", async () => {
  const { m, c, videoId } = await escenario();
  // La referencia pública nunca contiene el enlace privado de descarga.
  const source = listarMontajes(owner).find((v) => v.id === videoId)!;
  expect(JSON.stringify(source)).not.toContain("firma=ficticia");
  const p = guardarPieza(owner, m.id, {
    cuentaId: c.id,
    formato: "reel",
    plantilla: "libre",
    titulo: "Montaje aprobado",
    texto: "Una publicación",
    videoId,
    montaje: { revision: source.revision },
  });
  const transport = vi.fn(
    async () =>
      new Response(new Uint8Array(mp4), {
        headers: { "content-type": "video/mp4" },
      }),
  );
  vi.stubGlobal("fetch", transport);
  await enviarRevision(owner, p.id, 1);
  expect(obtenerPieza(owner, p.id).p.estado).toBe("pendiente");
  expect(
    Buffer.from(
      leerMedio(p.id, new URL("http://localhost"), owner).data,
      "base64",
    ),
  ).toEqual(mp4);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0]).toEqual([
    expect.stringContaining("cdn.creatomate.com"),
    expect.objectContaining({ redirect: "error", cache: "no-store" }),
  ]);
  db()
    .update(videos)
    .set({ script: "Otra revisión" })
    .where(eq(videos.id, videoId))
    .run();
  expect(() => leerMedio(p.id, new URL("http://localhost"), owner)).toThrow(
    /revisión/,
  );
});
async function borrador() {
  const s = await escenario();
  const revision = listarMontajes(owner).find(
    (v) => v.id === s.videoId,
  )!.revision;
  const datos = {
    cuentaId: s.c.id,
    formato: "reel",
    plantilla: "libre",
    titulo: "Montaje aprobado",
    texto: "Una publicación",
    videoId: s.videoId,
    montaje: { revision },
  };
  const p = guardarPieza(owner, s.m.id, datos);
  return { ...s, p, datos };
}
function descarga() {
  const transport = vi.fn(
    async () =>
      new Response(new Uint8Array(mp4), {
        headers: { "content-type": "video/mp4" },
      }),
  );
  vi.stubGlobal("fetch", transport);
  return transport;
}
it("aísla la referencia por dueño incluso al crear como administrador y exige aprobación final", async () => {
  const { m, p, videoId, datos } = await borrador();
  expect(listarMontajes(admin).some((v) => v.id === videoId)).toBe(true);
  const otra = guardarMarca(admin, { nombre: "Otro dueño", rubro: "general" });
  const c = agregarCuenta(admin, otra.id, {
    red: "youtube",
    alias: "Otro",
    remoto: randomUUID(),
  });
  expect(() =>
    guardarPieza(admin, otra.id, { ...datos, cuentaId: c.id }),
  ).toThrow(/ajeno/);
  const otro = loginGoogle("otro-montaje@example.test", "Otro");
  expect(listarMontajes(otro).some((v) => v.id === videoId)).toBe(false);
  expect(() => guardarPieza(otro, m.id, datos)).toThrow();
  db().update(videos).set({ stage: 9 }).where(eq(videos.id, videoId)).run();
  expect(listarMontajes(owner).some((v) => v.id === videoId)).toBe(false);
  await expect(enviarRevision(owner, p.id, 1)).rejects.toThrow(
    /aprobación final/,
  );
  expect(fetch).not.toHaveBeenCalled();
});
it.each([401, 403, 404, 410])(
  "conserva borrador sin copia ante enlace caducado HTTP %i y permite recuperar",
  async (status) => {
    const { p, videoId, m, datos } = await borrador();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status })),
    );
    await expect(enviarRevision(owner, p.id, 1)).rejects.toThrow(/caducó/);
    expect(obtenerPieza(owner, p.id).p.estado).toBe("borrador");
    expect(
      db()
        .select()
        .from(montajesFabrica)
        .where(eq(montajesFabrica.videoId, videoId))
        .all(),
    ).toHaveLength(0);
    db()
      .update(videos)
      .set({
        observability: JSON.stringify({
          ...sinObservabilidad,
          montaje: `https://cdn.creatomate.com/renders/${videoId}.mp4?firma=renovada`,
        }),
      })
      .where(eq(videos.id, videoId))
      .run();
    descarga();
    await expect(enviarRevision(owner, p.id, 1)).rejects.toThrow(/revisión/);
    const source = listarMontajes(owner).find((v) => v.id === videoId)!;
    guardarPieza(
      owner,
      m.id,
      { ...datos, montaje: { revision: source.revision } },
      p.id,
      1,
    );
    await enviarRevision(owner, p.id, 2);
    expect(obtenerPieza(owner, p.id).p.estado).toBe("pendiente");
  },
);
it("reutiliza la copia exacta tras caducar el CDN sin incorporarla a adjuntos o al modelo", async () => {
  const { p, m, datos } = await borrador();
  const transport = descarga();
  await enviarRevision(owner, p.id, 1);
  const copy = db()
    .select()
    .from(montajesFabrica)
    .where(eq(montajesFabrica.videoId, datos.videoId))
    .get()!;
  expect(copy.sha256).toBe(createHash("sha256").update(mp4).digest("hex"));
  expect(estadoMarcas(owner).archivos.some((a) => a.id === copy.id)).toBe(
    false,
  );
  expect(JSON.stringify(estadoMarcas(owner))).not.toContain("firma=ficticia");
  expect(
    (
      await archivoGET(
        new Request(`http://localhost/api/archivos/${copy.id}`),
        { params: Promise.resolve({ ruta: ["archivos", copy.id] }) },
      )
    ).status,
  ).toBe(404);
  const http = await medioGET(
    new Request(`http://localhost/api/marcas/medio/${p.id}`),
    { params: Promise.resolve({ id: p.id }) },
  );
  expect(http.status).toBe(200);
  expect(http.headers.get("cache-control")).toBe("private, no-store");
  expect(Buffer.from(await http.arrayBuffer())).toEqual(mp4);
  const otra = guardarPieza(owner, m.id, {
    ...datos,
    titulo: "Otra publicación",
  });
  transport.mockImplementation(async () => new Response(null, { status: 410 }));
  await enviarRevision(owner, otra.id, 1);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(obtenerPieza(owner, otra.id).p.mediosIds).toEqual([copy.id]);
  expect(() =>
    guardarPieza(owner, m.id, {
      ...datos,
      montaje: undefined,
      videoId: "",
      adjuntos: [copy.id],
    }),
  ).toThrow(/ajeno/);
  let context = "";
  await proponerTexto({ ...m, estudio: null }, "Montaje aprobado", {
    async *generar(input) {
      context = JSON.stringify(input);
      yield { tipo: "texto", texto: "Una publicación" };
    },
  });
  expect(context).not.toContain("cdn.creatomate.com");
  expect(context).not.toContain(copy.data);
});
it("admite montajes mayores que el límite de adjuntos sin recodificar", async () => {
  const { p } = await borrador();
  const free = Buffer.alloc(5 * 1024 * 1024 + 8);
  free.writeUInt32BE(free.length);
  free.write("free", 4, "ascii");
  const large = Buffer.concat([mp4, free]);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(new Uint8Array(large), {
          headers: {
            "content-type": "video/mp4",
            "content-length": String(large.length),
          },
        }),
    ),
  );
  await enviarRevision(owner, p.id, 1);
  expect(
    Buffer.from(
      leerMedio(p.id, new URL("http://localhost"), owner).data,
      "base64",
    ).equals(large),
  ).toBe(true);
});
it("revocar consentimiento de un video ya publicado corta lectura, aprobación y envío", async () => {
  const { m, datos, videoId, p } = await borrador();
  const id = randomUUID();
  db()
    .insert(assets)
    .values({
      id,
      ownerId: owner.id,
      name: "Voz consentida",
      evidenceId: "evidencia-ficticia",
      kind: "voz",
      status: "listo",
      verified: true,
      consentAt: Date.now(),
      createdAt: Date.now(),
    })
    .run();
  db()
    .update(videos)
    .set({ voiceId: id, stage: 11 })
    .where(eq(videos.id, videoId))
    .run();
  const revision = listarMontajes(owner).find(
    (v) => v.id === videoId,
  )!.revision;
  const d = { ...datos, montaje: { revision } };
  guardarPieza(owner, m.id, d, p.id, 1);
  descarga();
  await enviarRevision(owner, p.id, 2);
  const pendiente = guardarPieza(owner, m.id, d);
  await enviarRevision(owner, pendiente.id, 1);
  decidirPieza(admin, p.id, 2, true);
  const red = new RedSimulada(),
    enviar = vi.spyOn(red, "publicar");
  revocarConsentimiento(owner, id);
  expect(() => leerMedio(p.id, new URL("http://localhost"), owner)).toThrow(
    /biblioteca/,
  );
  expect(() => decidirPieza(admin, pendiente.id, 1, true)).toThrow();
  await procesarMarcas(red, p.programada + 1);
  expect(enviar.mock.calls.some(([, piece]) => piece.id === p.id)).toBe(false);
  expect(obtenerPieza(owner, p.id).p.estado).toBe("revision");
  expect(listarMontajes(owner).some((v) => v.id === videoId)).toBe(false);
});
it("revalida fuente y pieza tras una descarga concurrente sin dejar copias huérfanas", async () => {
  for (const cambio of ["video", "pieza"] as const) {
    const { p, videoId, m, datos } = await borrador();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        if (cambio === "video")
          db()
            .update(videos)
            .set({ script: "Guion corregido" })
            .where(eq(videos.id, videoId))
            .run();
        else
          guardarPieza(
            owner,
            m.id,
            { ...datos, texto: "Nueva leyenda" },
            p.id,
            1,
          );
        return new Response(new Uint8Array(mp4), {
          headers: { "content-type": "video/mp4" },
        });
      }),
    );
    await expect(enviarRevision(owner, p.id, 1)).rejects.toThrow(
      /revisión|cambió/,
    );
    expect(obtenerPieza(owner, p.id).p.estado).toBe("borrador");
    expect(
      db()
        .select()
        .from(montajesFabrica)
        .where(eq(montajesFabrica.videoId, videoId))
        .all(),
    ).toHaveLength(0);
  }
});
it("protege la copia por sesión o firma vigente y revisión de origen", async () => {
  const { p, videoId } = await borrador();
  descarga();
  await enviarRevision(owner, p.id, 1);
  decidirPieza(admin, p.id, 1, true);
  vi.stubEnv("AUTH_URL", "https://cooper.example.test");
  const approved = obtenerPieza(owner, p.id).p,
    url = new URL(urlsMedios(approved)[0]);
  expect(() => leerMedio(p.id, url)).toThrow(); // Todavía programada.
  db()
    .update(piezasMarca)
    .set({ estado: "enviando" })
    .where(eq(piezasMarca.id, p.id))
    .run();
  expect(leerMedio(p.id, url).mime).toBe("video/mp4");
  expect(() =>
    leerMedio(p.id, url, undefined, Date.now() + 86400001),
  ).toThrow();
  db()
    .update(videos)
    .set({ script: "Revisión posterior" })
    .where(eq(videos.id, videoId))
    .run();
  expect(() => leerMedio(p.id, url)).toThrow(/revisión/);
  vi.unstubAllEnvs();
});
it.each([
  "http://cdn.creatomate.com/renders/a.mp4",
  "https://127.0.0.1/renders/a.mp4",
  "https://cdn.creatomate.com.evil.test/renders/a.mp4",
  "https://cdn.creatomate.com:444/renders/a.mp4",
  "https://cdn.creatomate.com/otro/a.mp4",
])("rechaza origen no habilitado sin tráfico: %s", async (url) => {
  const { videoId, p, m, datos } = await borrador();
  db()
    .update(videos)
    .set({
      observability: JSON.stringify({ ...sinObservabilidad, montaje: url }),
    })
    .where(eq(videos.id, videoId))
    .run();
  const source = listarMontajes(owner).find((v) => v.id === videoId);
  if (!source) await expect(enviarRevision(owner, p.id, 1)).rejects.toThrow();
  else {
    guardarPieza(
      owner,
      m.id,
      { ...datos, montaje: { revision: source.revision } },
      p.id,
      1,
    );
    await expect(enviarRevision(owner, p.id, 2)).rejects.toThrow(/origen/);
  }
  expect(fetch).not.toHaveBeenCalled();
});
it.each(["mime", "firma", "longitud", "flujo", "parcial", "redireccion"])(
  "rechaza respuesta de montaje inválida: %s",
  async (caso) => {
    const { p, videoId } = await borrador();
    let cancelada = false;
    const response =
      caso === "flujo"
        ? new Response(
            new ReadableStream({
              pull(c) {
                c.enqueue(new Uint8Array(1024 * 1024));
              },
              cancel() {
                cancelada = true;
              },
            }),
            { headers: { "content-type": "video/mp4" } },
          )
        : new Response(
            new Uint8Array(
              caso === "firma" ? Buffer.from("un archivo que no es MP4") : mp4,
            ),
            {
              status:
                caso === "parcial" ? 206 : caso === "redireccion" ? 302 : 200,
              headers: {
                "content-type": caso === "mime" ? "text/html" : "video/mp4",
                ...(caso === "longitud"
                  ? { "content-length": String(MAX_MONTAJE_BYTES + 1) }
                  : {}),
              },
            },
          );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    await expect(enviarRevision(owner, p.id, 1)).rejects.toThrow();
    if (caso === "flujo") expect(cancelada).toBe(true);
    expect(obtenerPieza(owner, p.id).p.estado).toBe("borrador");
    expect(
      db()
        .select()
        .from(montajesFabrica)
        .where(eq(montajesFabrica.videoId, videoId))
        .all(),
    ).toHaveLength(0);
  },
);
