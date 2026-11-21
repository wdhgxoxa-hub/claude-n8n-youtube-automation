/** Worker Cooper real con base exclusiva, red simulada y medios sintéticos. */
import assert from "node:assert/strict";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "../src/db";
import { attachments, piezasMarca, users } from "../src/db/schema";
import { loginGoogle } from "../src/lib/identidad";
import {
  agregarCuenta,
  conectarCuenta,
  decidirPieza,
  enviarRevision,
  guardarMarca,
  guardarPieza,
  obtenerPieza,
  procesarMarcas,
} from "../src/servicios/marcas/servicio";
import { RedSimulada } from "../src/servicios/marcas/redes";
import { POST } from "../src/app/api/marcas/operar/route";

globalThis.fetch = async () => {
  throw new Error("Ensayo Marcas: salida de red bloqueada");
};

type Comando = {
  id: number;
  tipo:
    | "iniciar"
    | "preparar"
    | "estado"
    | "http"
    | "interrumpir"
    | "vencer-reserva";
  secret?: string;
  ronda?: number;
  pieza?: string;
  body?: string;
  headers?: Record<string, string>;
};

function estado(id: string) {
  const p = db().select().from(piezasMarca).where(eq(piezasMarca.id, id)).get();
  assert.ok(p);
  return {
    id: p.id,
    estado: p.estado,
    revision: p.revision,
    aprobadaRevision: p.aprobadaRevision,
    remoto: p.remoto,
    metricas: p.metricas,
    aviso: p.aviso,
    medios: p.mediosIds.length,
    updatedAt: p.updatedAt,
    leaseAt: p.leaseAt,
  };
}

async function atender(c: Comando) {
  if (c.tipo === "iniciar") {
    assert.ok(c.secret && c.secret.length >= 32);
    assert.ok(
      process.env.COOPER_DATABASE_PATH?.includes("marcas-ensayo.sqlite"),
    );
    assert.equal(process.env.COOPER_MARCAS, "simulada");
    process.env.COOPER_MARCAS_WORKER_SECRET = c.secret;
    process.env.AUTH_SECRET = c.secret;
    const admin = loginGoogle("marcas-admin@example.test", "Walter ficticio");
    return {
      listo: true,
      usuarios: db().select().from(users).all().length,
      admin: admin.id,
    };
  }
  if (c.tipo === "estado") return estado(c.pieza!);
  if (c.tipo === "interrumpir") {
    const red = new RedSimulada();
    red.publicar = async () => {
      // Se alcanza tras la reserva durable real de procesarMarcas.
      process.kill(process.pid, "SIGKILL");
      return { estado: "revision", remoto: "", checkpoint: {} };
    };
    return procesarMarcas(red);
  }
  if (c.tipo === "vencer-reserva") {
    assert.equal(estado(c.pieza!).estado, "enviando");
    // Solo el reloj del fixture avanza para no esperar cinco minutos por ronda.
    db()
      .update(piezasMarca)
      .set({ leaseAt: Date.now() - 301000 })
      .where(eq(piezasMarca.id, c.pieza!))
      .run();
    return estado(c.pieza!);
  }
  if (c.tipo === "http") {
    const response = await POST(
      new Request("http://127.0.0.1/api/marcas/operar", {
        method: "POST",
        headers: c.headers,
        body: c.body,
      }),
    );
    return { status: response.status, body: await response.text() };
  }
  assert.equal(c.tipo, "preparar");
  const ronda = c.ronda!;
  const admin = loginGoogle("marcas-admin@example.test", "Walter ficticio");
  const red = (["instagram", "facebook", "tiktok"] as const)[(ronda - 1) % 3];
  const m = guardarMarca(admin, {
    nombre: `Marca ficticia ${ronda}`,
    rubro: "moda",
  });
  const cuenta = agregarCuenta(admin, m.id, {
    red,
    alias: `Cuenta ficticia ${ronda}`,
    remoto: String(900000 + ronda),
    pagina: "123456",
  });
  await conectarCuenta(admin, cuenta.id);
  const png = await sharp({
    create: {
      width: 320,
      height: 480,
      channels: 3,
      background: ronda % 2 ? "#354656" : "#736451",
    },
  })
    .png()
    .toBuffer();
  const foto = randomUUID();
  db()
    .insert(attachments)
    .values({
      id: foto,
      ownerId: admin.id,
      name: "Foto sintética.png",
      mime: "image/png",
      size: png.length,
      data: png.toString("base64"),
    })
    .run();
  const adjuntos = [foto];
  if (ronda % 3 !== 1) {
    const path = resolve(
      process.env.COOPER_MARCAS_EVIDENCIA!,
      `clip-${ronda}.mp4`,
    );
    execFileSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-f",
        "lavfi",
        "-i",
        "color=c=0x354656:s=320x480:r=25",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:sample_rate=48000",
        "-t",
        "1",
        "-c:v",
        "libx264",
        "-threads",
        "1",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-y",
        path,
      ],
      { stdio: "pipe", timeout: 30000 },
    );
    const clip = readFileSync(path),
      video = randomUUID();
    db()
      .insert(attachments)
      .values({
        id: video,
        ownerId: admin.id,
        name: "Clip sintético.mp4",
        mime: "video/mp4",
        size: clip.length,
        data: clip.toString("base64"),
      })
      .run();
    adjuntos.push(video);
  }
  const antes = Date.now() - 120000;
  const p = guardarPieza(
    admin,
    m.id,
    {
      cuentaId: cuenta.id,
      formato: "reel",
      plantilla: "libre",
      titulo: `Reel ficticio ${ronda}`,
      texto: "Colección de ensayo local.",
      adjuntos,
      programada: new Date(antes + 90000).toISOString(),
    },
    undefined,
    undefined,
    antes,
  );
  await enviarRevision(admin, p.id, 1);
  decidirPieza(admin, p.id, 1, true, antes);
  const revisada = obtenerPieza(admin, p.id).p;
  const medio = db()
    .select()
    .from(attachments)
    .where(eq(attachments.id, revisada.mediosIds[0]))
    .get()!;
  assert.equal(medio.mime, "video/mp4");
  const artifact = resolve(
    process.env.COOPER_MARCAS_EVIDENCIA!,
    `reel-${ronda}.mp4`,
  );
  writeFileSync(artifact, Buffer.from(medio.data, "base64"));
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,codec_name,width,height:format=duration,size",
        "-of",
        "json",
        artifact,
      ],
      { encoding: "utf8", timeout: 10000 },
    ),
  );
  assert.ok(
    probe.streams.some(
      (s: { codec_type: string; width: number; height: number }) =>
        s.codec_type === "video" && s.width === 720 && s.height === 1280,
    ),
  );
  assert.ok(
    probe.streams.some((s: { codec_type: string }) => s.codec_type === "audio"),
  );
  assert.ok(
    Number(probe.format.duration) >= 3 && Number(probe.format.duration) <= 60,
  );
  return {
    ...estado(p.id),
    red,
    adjuntos: adjuntos.length,
    artifact,
    probe,
    adaptacionReloj:
      "Creación y aprobación 120 segundos atrás; horario vencido al despertar real",
  };
}

async function main() {
  for await (const line of createInterface({ input: process.stdin })) {
    const c = JSON.parse(line) as Comando;
    try {
      process.stdout.write(
        JSON.stringify({ id: c.id, result: await atender(c) }) + "\n",
      );
    } catch (error) {
      process.stdout.write(
        JSON.stringify({
          id: c.id,
          error:
            error instanceof Error ? error.message : "Fallo de ensayo Marcas",
        }) + "\n",
      );
    }
  }
}
void main();
