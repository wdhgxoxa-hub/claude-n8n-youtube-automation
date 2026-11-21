// Aceptación del runtime real de la imagen, con cuentas y medios sintéticos.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function probarRuntimeMarcas({ compose, request, cookie, env, run, Database, until }) {
  const dbPath = resolve(env.DATA_ROOT, "cooper/cooper.sqlite");
  await compose("exec", "-T", "cooper", "node", "-e", "const fs=require('node:fs');if(process.env.COOPER_MARCAS!=='simulada'||!fs.existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')||!fs.existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'))process.exit(1)");
  await compose("exec", "-T", "cooper", "ffmpeg", "-version");
  await compose("exec", "-T", "cooper", "ffprobe", "-version");
  const post = async (path, body) => {
    const response = await request("cooper.test", `/api/marcas${path}`, {
      method: "POST", body, headers: { Cookie: cookie, Origin: env.COOPER_ORIGIN },
    });
    assert.equal(response.status, 200, `Marcas ${path}`);
    return JSON.parse(response.text);
  };
  const marca = await post("", { nombre: "Marca sintética de ensayo", rubro: "moda" });
  const cuenta = await post(`/${marca.id}/cuentas`, { red: "instagram", alias: "Cuenta ficticia", remoto: "123", pagina: "456" });
  await post(`/cuenta/${cuenta.id}`, { accion: "conectar" });
  const datos = { cuentaId: cuenta.id, plantilla: "coleccion", titulo: "Colección de ensayo", texto: "Pieza sintética sin publicación", detalle: "Fotografía y sonido de prueba", programada: new Date(Date.now() + 3600000).toISOString() };
  const imagen = await post(`/${marca.id}/piezas`, { ...datos, formato: "imagen" });
  await post(`/pieza/${imagen.id}`, { accion: "enviar", revision: 1 });
  const media = (id) => {
    const db = new Database(dbPath, { readonly: true });
    try {
      const pieza = db.prepare("SELECT estado,medios_ids FROM piezas_marca WHERE id=?").get(id);
      assert.equal(pieza.estado, "pendiente");
      const ids = JSON.parse(pieza.medios_ids);
      assert.equal(ids.length, 1);
      return db.prepare("SELECT id,mime,data FROM attachments WHERE id=?").get(ids[0]);
    } finally { db.close(); }
  };
  const jpeg = media(imagen.id);
  assert.equal(jpeg.mime, "image/jpeg");
  assert.equal(Buffer.from(jpeg.data, "base64").subarray(0, 3).toString("hex"), "ffd8ff");
  await writeFile(resolve(run, "marcas-imagen.jpg"), Buffer.from(jpeg.data, "base64"));
  // Un clip con tono audible, generado por el FFmpeg del mismo contenedor de producción.
  await compose("exec", "-T", "cooper", "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-f", "lavfi", "-i", "color=c=blue:s=160x90:r=25", "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000", "-t", "1", "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", "/data/marcas-clip-sintetico.mp4");
  const clip = await readFile(resolve(env.DATA_ROOT, "cooper/marcas-clip-sintetico.mp4"));
  const clipId = randomUUID();
  const db = new Database(dbPath);
  try {
    const owner = db.prepare("SELECT owner_id FROM marcas WHERE id=?").get(marca.id).owner_id;
    db.prepare("INSERT INTO attachments(id,owner_id,name,mime,size,data) VALUES(?,?,?,?,?,?)").run(clipId, owner, "Clip sintético", "video/mp4", clip.length, clip.toString("base64"));
  } finally { db.close(); }
  const reel = await post(`/${marca.id}/piezas`, { ...datos, formato: "reel", adjuntos: [jpeg.id, clipId] });
  await post(`/pieza/${reel.id}`, { accion: "enviar", revision: 1 });
  const mp4 = media(reel.id);
  assert.equal(mp4.mime, "video/mp4");
  const video = Buffer.from(mp4.data, "base64");
  assert.equal(video.subarray(4, 8).toString(), "ftyp");
  await writeFile(resolve(env.DATA_ROOT, "cooper/marcas-reel-sintetico.mp4"), video);
  await writeFile(resolve(run, "marcas-reel.mp4"), video);
  const probe = JSON.parse(await compose("exec", "-T", "cooper", "ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,sample_rate,channels", "-of", "json", "/data/marcas-reel-sintetico.mp4"));
  const visual = probe.streams.find((s) => s.codec_type === "video");
  const audio = probe.streams.find((s) => s.codec_type === "audio");
  assert.equal(visual.width, 720); assert.equal(visual.height, 1280);
  assert.equal(audio.sample_rate, "48000"); assert.equal(audio.channels, 2);
  assert.ok(Number(probe.format.duration) >= 3.8 && Number(probe.format.duration) < 5.5, "Duración de foto y clip conservada");
  // El tono debe sobrevivir a la mezcla; un stream de puro silencio no basta.
  await compose("exec", "-T", "cooper", "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-i", "/data/marcas-reel-sintetico.mp4", "-vn", "-f", "s16le", "-ac", "1", "-ar", "8000", "-y", "/data/marcas-audio.pcm");
  const pcm = await readFile(resolve(env.DATA_ROOT, "cooper/marcas-audio.pcm"));
  let peak = 0;
  for (let i = 0; i + 1 < pcm.length; i += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i)));
  assert.ok(peak > 1000, "El audio del clip se conserva");
  const worker = async (valid, timestamp = String(Date.now())) => {
    const body = JSON.stringify({ accion: "metricas" });
    const signature = valid ? createHmac("sha256", env.COOPER_MARCAS_WORKER_SECRET).update(`${timestamp}.${body}`).digest("hex") : "0".repeat(64);
    return request("cooper.test", "/api/marcas/operar", { method: "POST", body, headers: { "x-cooper-time": timestamp, "x-cooper-signature": signature } });
  };
  assert.equal((await worker(false)).status, 401);
  assert.equal((await worker(true, String(Date.now() - 400000))).status, 401);
  assert.equal((await worker(true)).status, 200);
  await compose("restart", "cooper");
  await until(async () => (await request("cooper.test", "/api/salud")).status === 200, "reinicio del trabajador de Marcas");
  assert.equal((await worker(true)).status, 200);
  assert.equal(media(reel.id).id, mp4.id, "El reinicio conserva la revisión y sus medios");
  await writeFile(resolve(run, "marcas-runtime.json"), JSON.stringify({ runtime: "PASS", jpeg: "PASS", reel: "PASS", audio: "PASS", duracion: Number(probe.format.duration), hmac: "PASS", reinicio: "PASS", publicadas: 0 }, null, 2));
  console.log("PASS Marcas: JPEG y reel sintéticos con audio, HMAC válido/inválido y reinicio sin publicación");
}
