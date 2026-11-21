/** Medios del ensayo: archivos propios, Piper y FFmpeg; nunca descarga una URL. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { cleanEnv } from "./ensayo-infra.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const run = (cmd, args, options = {}) =>
  execFileSync(cmd, args, {
    env: cleanEnv(),
    maxBuffer: 32 * 1024 * 1024,
    timeout: 240000,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
const probe = (file) =>
  JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      file,
    ]),
  );
const ffmpeg = (args, cwd) =>
  run(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", ...args],
    { cwd },
  );
const stamp = (seconds, ass = false) => {
  const n = Math.round(seconds * (ass ? 100 : 1000));
  const unit = ass ? 100 : 1000;
  return `${ass ? Math.floor(n / unit / 3600) : String(Math.floor(n / unit / 3600)).padStart(2, "0")}:${String(Math.floor(n / unit / 60) % 60).padStart(2, "0")}:${String(Math.floor(n / unit) % 60).padStart(2, "0")}${ass ? "." : ","}${String(n % unit).padStart(ass ? 2 : 3, "0")}`;
};
export function subtitulosDeComposicion(source) {
  let offset = 0;
  const cues = [];
  for (const scene of source.elements) {
    assert.equal(
      scene.type,
      "composition",
      "Solo escenas del montaje local, sin música externa",
    );
    assert.ok(
      Number.isFinite(scene.duration) &&
        scene.duration > 0 &&
        scene.duration <= 60,
    );
    for (const text of scene.elements.filter((e) => e.type === "text")) {
      assert.equal(typeof text.text, "string");
      assert.ok(
        Number.isFinite(text.time) &&
          text.time >= 0 &&
          Number.isFinite(text.duration) &&
          text.duration > 0,
      );
      assert.ok(
        text.time + text.duration <= scene.duration + 0.05,
        "Subtítulo fuera de su escena",
      );
      cues.push({
        start: offset + text.time,
        end: offset + text.time + text.duration,
        text: text.text,
      });
    }
    offset += scene.duration;
  }
  assert.ok(cues.length && offset <= 90);
  for (let i = 1; i < cues.length; i++)
    assert.ok(cues[i].start >= cues[i - 1].end - 0.011, "Subtítulos solapados");
  return { cues, duration: offset };
}
function illustration(scene) {
  const warm = scene === 2;
  const colors = warm
    ? ["#f9c879", "#dc875b", "#bc644f"]
    : ["#f0eee7", "#a6d7ed", "#8badcb"];
  const rays = colors
    .map(
      (c, i) =>
        `<path d="M235 ${860 + i * 46} Q510 ${warm ? 810 + i * 65 : 820 + i * 55} 815 ${960 + i * 26}" fill="none" stroke="${c}" stroke-width="${8 - i}"/>`,
    )
    .join("");
  const scatter = Array.from(
    { length: 7 },
    (_, i) =>
      `<path d="M${460 + i * 44} ${885 + i * 14} l${i % 2 ? 30 : -30} ${i % 2 ? -90 : 90}" stroke="#a6d7ed" stroke-opacity="${warm ? 0.22 : 0.7}" stroke-width="4"/>`,
  ).join("");
  const drawing =
    scene === 3
      ? `<path d="M120 970 H960" stroke="#d9a074" stroke-width="12"/><path d="M120 948 H510 Q590 925 650 790 M510 948 Q575 980 640 1140" fill="none" stroke="#a6d7ed" stroke-width="7"/>${[0, 1, 2, 3, 4].map((i) => `<circle cx="${425 + i * 78}" cy="${i % 2 ? 1030 : 875}" r="10" fill="#a6d7ed" fill-opacity=".55"/>`).join("")}<path d="M940 950 L965 970 L940 990 M625 800 L650 788 L650 815 M620 1125 L642 1142 L641 1113" fill="none" stroke="#cbbb9f" stroke-width="5"/>`
      : `<circle cx="220" cy="910" r="86" fill="url(#sun)"/>${rays}${scatter}<circle cx="860" cy="1060" r="168" fill="#a6d7ed" fill-opacity=".05" stroke="#a6d7ed" stroke-opacity=".35" stroke-width="28"/><circle cx="860" cy="1060" r="143" fill="#293e48"/><path d="M745 985 Q800 945 840 1030 T970 1115" fill="none" stroke="#688e94" stroke-width="35"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><defs><radialGradient id="bg"><stop stop-color="${warm ? "#352a26" : "#223039"}"/><stop offset="1" stop-color="#101214"/></radialGradient><radialGradient id="sun"><stop stop-color="#f0eee7"/><stop offset="1" stop-color="#d2a478"/></radialGradient></defs><rect width="1080" height="1920" fill="url(#bg)"/><path d="M80 700 H1000 M80 1240 H1000" stroke="#cbbb9f" stroke-opacity=".12"/>${drawing}</svg>`;
}
export function crearMediosLocales(directory) {
  const dir = resolve(directory, "medios");
  mkdirSync(dir, { recursive: true });
  const registry = new Map(),
    renders = new Map();
  const events = [],
    outputs = [];
  let next = 0,
    fileScene = 0;
  const writeJSON = (name, value) =>
    writeFileSync(join(dir, name), JSON.stringify(value, null, 2));
  function register(bytes, extension, extra = {}) {
    const id = "local-" + hash(bytes).slice(0, 24);
    const path = join(dir, id + "." + extension);
    writeFileSync(path, bytes);
    const value = {
      id,
      path,
      extension,
      sha256: hash(bytes),
      bytes: bytes.length,
      ...extra,
    };
    registry.set(id, value);
    return value;
  }
  function local(url) {
    const u = new URL(url);
    assert.ok(u.protocol === "https:" && !u.username && !u.password && !u.port);
    let id;
    if (
      u.hostname === "drive.google.com" &&
      u.pathname === "/uc" &&
      u.searchParams.get("export") === "download"
    )
      id = u.searchParams.get("id");
    else if (u.hostname === "render-local.invalid")
      id = u.pathname.slice(1).replace(/\.[a-z0-9]+$/, "");
    else
      throw Error("Se rechaza un medio externo: solo IDs locales registrados");
    const file = registry.get(id);
    assert.ok(file, "Medio local inexistente");
    return file;
  }
  function image(scene) {
    const svg = illustration(scene);
    const png = run("magick", ["svg:-", "png:-"], {
      input: svg,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const file = register(png, "png", {
      scene,
      origen: "Gráfico vectorial original generado localmente",
    });
    writeFileSync(file.path.replace(".png", ".svg"), svg);
    return file;
  }
  function renderVersion(source, horizontal = false) {
    const w = horizontal ? 1920 : source.width,
      h = horizontal ? 1080 : source.height;
    const version = horizontal ? "horizontal" : "vertical";
    const target = join(dir, version);
    mkdirSync(target, { recursive: true });
    const { cues, duration } = subtitulosDeComposicion(source);
    const srt = cues
      .map(
        (c, i) =>
          `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`,
      )
      .join("\n");
    writeFileSync(join(target, "subtitulos.srt"), srt);
    const escape = (s) =>
      s
        .replaceAll("\\", "")
        .replaceAll("{", "")
        .replaceAll("}", "")
        .replaceAll("\n", " ");
    let ass =
      `[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Sub,DejaVu Sans,${horizontal ? 54 : 72},&H00F0EEF0,&H00FFFFFF,&H00141210,&H80000000,-1,0,0,0,100,100,0,0,1,4,1,5,75,75,20,1\nStyle: Titulo,DejaVu Sans,${horizontal ? 48 : 54},&H00E7EEF0,&H00FFFFFF,&H00141210,&H80000000,-1,0,0,0,100,100,0,0,1,1,0,8,80,80,80,1\nStyle: Etiqueta,DejaVu Sans,${horizontal ? 24 : 29},&H009FBB CB,&H00FFFFFF,&H00141210,&H80000000,0,0,0,0,100,100,3,0,1,0,0,8,80,80,40,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`.replace(
        "&H009FBB CB",
        "&H009FBBCB",
      );
    ass +=
      cues
        .map(
          (c) =>
            `Dialogue: 1,${stamp(c.start, true)},${stamp(c.end, true)},Sub,,0,0,0,,{\\pos(${w / 2},${Math.round(h * (horizontal ? 0.86 : 0.72))})}${escape(c.text)}`,
        )
        .join("\n") + "\n";
    let offset = 0;
    const titles = [
      "La luz cambia de camino",
      "Un viaje más largo",
      "El color del atardecer",
    ];
    for (const [i, scene] of source.elements.entries()) {
      const visual = scene.elements.find((e) =>
        ["image", "video"].includes(e.type),
      );
      const audio = scene.elements.find((e) => e.type === "audio");
      assert.ok(
        visual && audio,
        "Cada escena necesita imagen y narración reales",
      );
      assert.ok(
        scene.elements.every((e) =>
          ["image", "video", "audio", "text"].includes(e.type),
        ),
      );
      assert.ok(
        !scene.transition,
        "Transiciones no soportadas por este ensayo",
      );
      assert.equal(
        scene.elements.filter((e) => ["image", "video"].includes(e.type))
          .length,
        1,
        "Solo un visual por escena",
      );
      assert.equal(
        scene.elements.filter((e) => e.type === "audio").length,
        1,
        "Solo narración, sin capas de audio adicionales",
      );
      assert.ok(
        audio.time === undefined || audio.time === 0,
        "Desplazamiento de voz no soportado",
      );
      const v = local(visual.source),
        a = local(audio.source);
      assert.equal(v.extension, visual.type === "image" ? "png" : "mp4");
      assert.equal(a.extension, "wav");
      const input =
        v.extension === "png"
          ? ["-loop", "1", "-framerate", "30"]
          : ["-stream_loop", "-1"];
      const frames = Math.round(scene.duration * 30);
      const seconds = frames / 30;
      ffmpeg([
        ...input,
        "-i",
        v.path,
        "-i",
        a.path,
        "-filter_complex_threads",
        "2",
        "-filter_complex",
        `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,format=yuv420p[v];[1:a]apad,atrim=duration=${seconds},aresample=48000[a]`,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-frames:v",
        String(frames),
        "-t",
        String(seconds),
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "16",
        "-threads",
        "4",
        "-c:a",
        "pcm_s16le",
        join(target, `escena-${i}.mkv`),
      ]);
      ass += `Dialogue: 0,${stamp(offset, true)},${stamp(offset + scene.duration, true)},Titulo,,0,0,0,,{\\pos(${w / 2},${horizontal ? 85 : 350})}${titles[i] || "La luz del cielo"}\n`;
      offset += scene.duration;
    }
    ass += `Dialogue: 0,0:00:00.00,${stamp(duration, true)},Etiqueta,,0,0,0,,{\\pos(${w / 2},${horizontal ? 42 : 275})}COOPER  /  CIENCIA COTIDIANA\n`;
    writeFileSync(join(target, "subtitulos.ass"), ass);
    writeFileSync(
      join(target, "escenas.txt"),
      source.elements.map((_, i) => `file 'escena-${i}.mkv'`).join("\n"),
    );
    ffmpeg(
      [
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        "escenas.txt",
        "-i",
        "subtitulos.srt",
        "-map",
        "0:v",
        "-map",
        "0:a",
        "-map",
        "1:s",
        "-vf",
        "ass=subtitulos.ass",
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=7",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-threads",
        "4",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-c:s",
        "mov_text",
        "-metadata:s:a:0",
        "language=spa",
        "-metadata:s:s:0",
        "language=spa",
        "-disposition:s:0",
        "0",
        "-movflags",
        "+faststart",
        "cooper-cielo.mp4",
      ],
      target,
    );
    const path = join(target, "cooper-cielo.mp4");
    const metadata = probe(path);
    writeFileSync(
      join(target, "ffprobe.json"),
      JSON.stringify(metadata, null, 2),
    );
    const vs = metadata.streams.find((s) => s.codec_type === "video");
    const as = metadata.streams.find((s) => s.codec_type === "audio");
    const ss = metadata.streams.find((s) => s.codec_type === "subtitle");
    assert.equal(vs.width, w);
    assert.equal(vs.height, h);
    assert.equal(vs.codec_name, "h264");
    assert.equal(vs.pix_fmt, "yuv420p");
    assert.equal(vs.avg_frame_rate, "30/1");
    assert.equal(as.codec_name, "aac");
    assert.equal(as.sample_rate, "48000");
    assert.equal(as.channels, 2);
    assert.equal(ss.codec_name, "mov_text");
    assert.ok(
      Math.abs(Number(metadata.format.duration) - duration) < 0.15,
      "Duración distinta al montaje",
    );
    assert.ok(
      Math.abs(Number(vs.duration) - Number(as.duration)) < 0.15,
      "Audio y video desincronizados",
    );
    const decode = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-v",
        "warning",
        "-xerror",
        "-i",
        path,
        "-map",
        "0:v",
        "-map",
        "0:a",
        "-f",
        "null",
        "-",
      ],
      { env: cleanEnv(), encoding: "utf8", timeout: 120000 },
    );
    assert.equal(decode.status, 0);
    assert.equal(decode.stderr.trim(), "", "Advertencias al decodificar");
    const measure = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-nostdin",
        "-i",
        path,
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json",
        "-vf",
        "blackdetect=d=0.1:pix_th=0.10",
        "-f",
        "null",
        "-",
      ],
      { env: cleanEnv(), encoding: "utf8", timeout: 120000 },
    );
    assert.equal(measure.status, 0);
    const loudness = JSON.parse(
      measure.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0] || "{}",
    );
    assert.ok(
      Number(loudness.input_i) >= -18 && Number(loudness.input_i) <= -14,
      "Voz fuera del objetivo de sonoridad",
    );
    assert.ok(
      Number(loudness.input_tp) <= -1,
      "Pico de audio sin margen suficiente",
    );
    assert.ok(
      !/black_start:/.test(measure.stderr),
      "Se detectaron cuadros negros",
    );
    writeFileSync(
      join(target, "audio-y-negros.json"),
      JSON.stringify(
        {
          sonoridad: loudness,
          cuadros_negros: 0,
          decodificacion_errores: 0,
          decodificacion_advertencias: 0,
        },
        null,
        2,
      ),
    );
    const samples = [];
    let time = 0;
    for (let i = 0; i < source.elements.length; i++) {
      const d = source.elements[i].duration;
      for (const fraction of [0.25, 0.7]) {
        const t = time + d * fraction;
        const name = `fotograma-${i + 1}-${fraction === 0.25 ? "a" : "b"}.png`;
        ffmpeg([
          "-ss",
          String(t),
          "-i",
          path,
          "-frames:v",
          "1",
          "-update",
          "1",
          join(target, name),
        ]);
        samples.push({ archivo: name, segundo: Number(t.toFixed(3)) });
      }
      time += d;
    }
    ffmpeg([
      "-i",
      path,
      "-map",
      "0:s:0",
      "-c:s",
      "srt",
      join(target, "subtitulos-extraidos.srt"),
    ]);
    const extracted = readFileSync(
      join(target, "subtitulos-extraidos.srt"),
      "utf8",
    );
    for (const cue of cues) assert.ok(extracted.includes(cue.text));
    const file = register(readFileSync(path), "mp4");
    const result = {
      formato: version,
      archivo: path,
      sha256: file.sha256,
      bytes: file.bytes,
      ancho: w,
      alto: h,
      duracion_s: Number(metadata.format.duration),
      duracion_composicion_s: duration,
      fps: 30,
      sonoridad_lufs: Number(loudness.input_i),
      pico_dbtp: Number(loudness.input_tp),
      subtitulos: cues.length,
      capturas: samples,
      comprobaciones: [
        "H264 yuv420p",
        "AAC estéreo 48 kHz",
        "30 fps",
        "duración y sincronía <150ms",
        "subtítulos visibles y pista mov_text cotejada",
        "decodificación completa",
      ],
    };
    outputs.push(result);
    writeFileSync(
      join(target, "verificacion.json"),
      JSON.stringify(result, null, 2),
    );
    return {
      id: file.id,
      status: "succeeded",
      url: `https://render-local.invalid/${file.id}.mp4`,
      duration: result.duracion_s,
      width: w,
      height: h,
    };
  }
  async function atender({ op, entrada = {}, binary, ...context }) {
    events.push({ op, inicio: new Date().toISOString() });
    writeJSON("operaciones.json", events);
    if (op === "voz") {
      const text = String(entrada.texto || "")
        .replace(/<[^>]+>/g, " ")
        .trim();
      assert.ok(text && text.length <= 2000);
      const name = "voz-" + ++next;
      const textPath = join(dir, name + ".txt"),
        wav = join(dir, name + ".wav");
      writeFileSync(textPath, text);
      const voice = JSON.parse(
        run("python3", [
          resolve("../tools/cooper/voz_local.py"),
          "--texto-archivo",
          textPath,
          "--salida",
          wav,
          "--escala-duracion",
          "1.25",
        ]),
      );
      writeJSON(name + ".json", voice);
      const pcm = ffmpeg([
        "-i",
        wav,
        "-ar",
        "24000",
        "-ac",
        "1",
        "-f",
        "s16le",
        "-",
      ]);
      return {
        steps: [
          {
            type: "model_output",
            content: [
              {
                type: "audio",
                mime_type: "audio/l16;rate=24000",
                data: pcm.toString("base64"),
              },
            ],
          },
        ],
      };
    }
    if (op === "imagen") {
      const scene = Number(String(entrada.plano?.id || "p03").slice(-1));
      assert.ok([1, 2, 3].includes(scene));
      const file = image(scene);
      return {
        output: [
          {
            type: "image_generation_call",
            status: "completed",
            result: readFileSync(file.path).toString("base64"),
          },
        ],
      };
    }
    if (op === "archivo") {
      const scene = Number(String(entrada.plano?.id || "").slice(-1));
      assert.ok([1, 2].includes(scene), "Clip fuera del storyboard local");
      assert.ok(++fileScene <= 2, "Más clips que los previstos");
      const poster = image(scene),
        videoPath = join(dir, `clip-${scene}.mp4`);
      ffmpeg([
        "-loop",
        "1",
        "-i",
        poster.path,
        "-vf",
        "zoompan=z='1+0.00015*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30,format=yuv420p",
        "-t",
        "12",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-threads",
        "4",
        videoPath,
      ]);
      const file = register(readFileSync(videoPath), "mp4", { scene });
      return {
        videos: [
          {
            id: scene,
            width: 1080,
            height: 1920,
            duration: 12,
            url: `https://render-local.invalid/${file.id}.mp4`,
            image: `https://render-local.invalid/${poster.id}.png`,
            user: { name: "Cooper · gráfico original local (sin stock)" },
            video_files: [
              {
                id: scene,
                file_type: "video/mp4",
                quality: "hd",
                width: 1080,
                height: 1920,
                link: `https://render-local.invalid/${file.id}.mp4`,
              },
            ],
          },
        ],
      };
    }
    if (op === "guardar") {
      const b = binary;
      assert.ok(b && typeof b.data === "string", "Falta binario real del nodo");
      const extension = {
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "image/png": "png",
        "application/json": "json",
      }[b.mimeType];
      assert.ok(extension, "Tipo de archivo no permitido");
      const file = register(Buffer.from(b.data, "base64"), extension);
      if (extension !== "json") probe(file.path);
      return { id: file.id, name: b.fileName || file.id, mimeType: b.mimeType };
    }
    if (op === "render") {
      assert.equal(entrada.source?.width, 1080);
      assert.equal(entrada.source.height, 1920);
      assert.equal(entrada.source.frame_rate, 30);
      writeJSON("composicion-n8n.json", entrada);
      const result = renderVersion(entrada.source);
      renders.set(result.id, result);
      renderVersion(entrada.source, true);
      return result;
    }
    if (op === "consultar") {
      const result = renders.get(entrada.id);
      assert.ok(result, "Consulta de render desconocido");
      return result;
    }
    if (op === "comprobar") {
      const file = local(entrada.url || context.url);
      return {
        statusCode: 200,
        headers: {
          "content-type": file.extension === "png" ? "image/png" : "video/mp4",
        },
      };
    }
    throw Error("Operación local no soportada: " + op);
  }
  return {
    atender: async (request) => {
      try {
        return await atender(request);
      } catch (error) {
        writeJSON("fallo-medios.json", {
          op: request.op,
          error: error.message,
        });
        throw error;
      }
    },
    resumen: () => ({
      coste_api_usd: 0,
      proveedor_voz: "Piper local es_ES-davefx-medium",
      archivos: outputs,
      operaciones: events,
      recursos: [...registry.values()].map(({ path, ...item }) => ({
        ...item,
        archivo: path,
      })),
    }),
  };
}
