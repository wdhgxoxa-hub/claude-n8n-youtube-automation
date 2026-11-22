// Solo el ensayo aislado importa este archivo; no existe endpoint de siembra.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const [database, ownerId] = process.argv.slice(2);
if (
  !database ||
  !resolve(database).startsWith(`${resolve(".cache")}/e2e-`) ||
  !database.endsWith("/cooper.sqlite") ||
  !ownerId
)
  throw new Error("La demostración solo admite la base E2E propia.");
process.env.COOPER_DATABASE_PATH = resolve(database);
process.env.COOPER_DEMO = "0";
process.env.COOPER_FABRICA = "simulada";
const [{ db }, schema, { eq }, { sincronizarVideoMedios, leerVideoMedios }] =
  await Promise.all([
    import("../src/db/index.ts"),
    import("../src/db/schema.ts"),
    import("drizzle-orm"),
    import("../src/servicios/video-medios.ts"),
  ]);
const { channels, users, videos } = schema;
const user = db().select().from(users).where(eq(users.id, ownerId)).get();
if (!user || user.email !== "admin@example.test")
  throw new Error("La cuenta no pertenece al emisor local.");

const mediaDir = resolve("../evidencias-diseno/medios");
const original = resolve(mediaDir, "original.mp4");
const digest = createHash("sha256")
  .update(readFileSync(original))
  .digest("hex");
if (
  digest !== "727421fdd1fbc2c705c6457a58496e90a84349b0ae7e27ee0cd20482b084f0a3"
)
  throw new Error(
    "El render de origen no coincide con la evidencia existente.",
  );
mkdirSync(mediaDir, { recursive: true });
const titles = [
  "¿Cuánto de tus diez soles se queda el grifo?",
  "Antes de llenar el tanque, mira esta cuenta",
  "Un galón también cuenta una historia",
  "La caja al cierre: ventas no son ganancia",
  "El dinero que entra y el que queda",
  "Tres gastos que cambian el margen",
  "El margen empieza después de pagar las cuentas",
  "Una jornada detrás del mostrador",
  "Cada sol tiene un destino",
  "Dos grifos, una misma pregunta",
  "Lo que pagamos cuando cargamos gasolina",
  "El precio cambia; la cuenta tiene que cerrar",
];
const ids = titles.map(
  (_, i) => `diseno-video-${String(i + 1).padStart(2, "0")}`,
);
const redes = [
  "youtube",
  "youtube",
  "instagram",
  "instagram",
  "tiktok",
  "tiktok",
  "youtube",
  "instagram",
  "tiktok",
  "youtube",
  "instagram",
  "tiktok",
];
const retention = [
  0.31, 0.54, 0.28, 0.47, 0.36, 0.58, 0.62, 0.41, 0.53, 0.49, 0.57, 0.43,
];
const views = [
  12600, 48200, 8300, 28500, 18400, 65100, 124800, 21700, 92400, 35200, 57300,
  13900,
];
const channelId = "diseno-canal";
const lessonData = [
  {
    resumen: "La historia empieza antes que el título",
    causa:
      "La introducción demoraba seis segundos en mostrar qué estaba en juego.",
    correccion:
      "Abrimos con la escena principal y dejamos el título para después.",
    cambio: "La primera imagen ya plantea la pregunta del relato.",
  },
  {
    resumen: "Una idea por escena deja espacio para mirar",
    causa:
      "La voz y los subtítulos presentaban dos ideas distintas al mismo tiempo.",
    correccion:
      "Dividimos el pasaje en dos escenas y acortamos los subtítulos.",
    cambio: "Cada escena acompaña una sola frase y una sola imagen.",
  },
  {
    resumen: "El cierre necesita un pequeño silencio",
    causa:
      "La última frase terminaba después del corte y la invitación pasaba inadvertida.",
    correccion: "Reservamos tres segundos de imagen para cerrar la historia.",
    cambio: "La invitación aparece con tiempo para leer y responder.",
  },
];
const lecciones = lessonData.map((l, i) => ({
  id: `diseno-leccion-${i + 1}`,
  fecha: new Date(Date.UTC(2026, 10, 9 + i * 2, 17)).toISOString(),
  resumen: l.resumen,
  causa: l.causa,
  correccion: l.correccion,
  nivel: "hipotesis",
  ganchos: [],
  temas: [],
  origenes: [
    {
      videoId: ids[i * 2],
      red: redes[i * 2],
      ventana: "24h",
      fecha: new Date(Date.UTC(2026, 10, 9 + i * 2, 16)).toISOString(),
      metrica: "retencion",
      valor: retention[i * 2],
      demoraHoras: 0,
    },
  ],
  aplicaciones: [{ videoId: ids[i * 2 + 1], cambio: l.cambio }],
}));
db()
  .insert(channels)
  .values({
    id: channelId,
    ownerId,
    name: "Margen real",
    niche: "Economía cotidiana y pequeños negocios en Perú",
    learning: JSON.stringify(lecciones),
    createdAt: Date.UTC(2026, 9, 1),
  })
  .onConflictDoUpdate({
    target: channels.id,
    set: { learning: JSON.stringify(lecciones) },
  })
  .run();

const manifest = [];
for (const [i, id] of ids.entries()) {
  const horizontal = [1, 3, 6, 9].includes(i);
  const output = resolve(mediaDir, `${id}.mp4`);
  const at = [0.7, 2, 4, 39.5, 40, 41, 42, 44, 45, 47.5, 48, 48.5][i];
  if (!existsSync(output))
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-y",
      "-ss",
      String(at),
      "-i",
      original,
      "-t",
      "1",
      "-map",
      "0:v:0",
      "-an",
      "-sn",
      "-dn",
      "-map_metadata",
      "-1",
      "-map_chapters",
      "-1",
      "-vf",
      horizontal
        ? "crop=1080:608:0:656,scale=640:360,setsar=1,fps=12"
        : "scale=360:640,setsar=1,fps=12",
      "-c:v",
      "libx264",
      "-threads",
      "1",
      "-preset",
      "veryfast",
      "-crf",
      "25",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      output,
    ]);
  const local = readFileSync(output);
  const fecha = new Date(Date.UTC(2026, 10, 8 + i, 16)).toISOString();
  const montaje = `https://cdn.creatomate.com/renders/${id}.mp4`;
  const publicacion = {
    id: `publicacion-${id}`,
    red: redes[i],
    url: "",
    fecha,
    miniatura: "",
    montaje,
    ancho: horizontal ? 640 : 360,
    alto: horizontal ? 360 : 640,
    historial: [
      {
        fecha: new Date(Date.parse(fecha) + 86400000).toISOString(),
        vistas: views[i],
        meGusta: Math.round(views[i] * 0.073),
        comentarios: 78 + i * 23,
        retencion: retention[i],
        seguidoresGanados: 40 + i * 16,
        ventana: "24h",
        demoraHoras: 0,
      },
    ],
  };
  db()
    .insert(videos)
    .values({
      id,
      ownerId,
      channelId,
      title: titles[i],
      script: "Ensayo visual con un extracto del render local existente.",
      stage: 11,
      productionState: "pausada",
      createdAt: Date.parse(fecha),
      updatedAt: Date.parse(fecha),
      observability: JSON.stringify({
        montaje,
        miniatura: "",
        escenas: [],
        publicaciones: [publicacion],
        incidencias: [],
      }),
    })
    .onConflictDoNothing()
    .run();
  // El mismo adaptador transforma los bytes locales y sirve sus endpoints con permisos reales.
  // Para YouTube/TikTok una portada derivada se usa como miniatura de publicación
  // sin consultar el proveedor: el transporte se limita a este render del ensayo.
  const transport = async (input: RequestInfo | URL) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url !== montaje) throw new Error("El ensayo no admite red externa.");
    return new Response(new Uint8Array(local), {
      headers: { "content-type": "video/mp4" },
    });
  };
  await sincronizarVideoMedios(user, id, "", transport);
  // La copia de publicación conserva dimensiones y preview exactos. El servicio
  // espera portada oficial en YouTube/TikTok: se utiliza el mismo fotograma del
  // render a través de un transporte local; no se inventa una miniatura vectorial.
  const main = leerVideoMedios(user, id);
  await sincronizarVideoMedios(user, id, publicacion.id, transport);
  const publication = leerVideoMedios(user, id, publicacion.id);
  if (!main.poster || !main.preview || !publication.preview)
    throw new Error(`No se derivó el medio de ${id}.`);
  // Cuando la red exige una miniatura oficial, la muestra autenticada copia el
  // fotograma ya procesado del mismo render, explicitado en el manifiesto.
  const { videoMedios } = schema;
  const source = db()
    .select()
    .from(videoMedios)
    .where(
      eq(
        videoMedios.clave,
        createHash("sha256")
          .update(JSON.stringify([id, ""]))
          .digest("hex"),
      ),
    )
    .get()!;
  db()
    .update(videoMedios)
    .set({
      estado: "listo",
      posterData: source.posterData,
      posterMime: source.posterMime,
      posterOrigen: "render",
      posterAncho: source.posterAncho,
      posterAlto: source.posterAlto,
      tinte: source.tinte,
    })
    .where(
      eq(
        videoMedios.clave,
        createHash("sha256")
          .update(JSON.stringify([id, publicacion.id]))
          .digest("hex"),
      ),
    )
    .run();
  manifest.push({
    id,
    titulo: titles[i],
    segundo: at,
    formato: horizontal ? "16:9 (recorte central)" : "9:16",
    bytes: local.length,
    sha256: createHash("sha256").update(local).digest("hex"),
    tinte: main.tinte,
  });
}
writeFileSync(
  resolve(mediaDir, "procedencia.json"),
  JSON.stringify(
    {
      origen:
        "Render existente del proyecto, diseno-medios/.cache/diseno-medios-real/original.mp4",
      sha256Original: digest,
      naturaleza:
        "Datos editoriales y métricas ficticios de ensayo. Fotografías y movimiento derivados del mismo render real; los formatos horizontales son recortes explícitos. No acredita publicaciones ni causalidad reales.",
      redExterna: false,
      lecciones: lecciones.length,
      medios: manifest,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Fixture aislado: ${ids.length} publicaciones y ${lecciones.length} lecciones con medios locales.`,
);
