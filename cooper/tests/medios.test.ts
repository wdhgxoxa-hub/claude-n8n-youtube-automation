import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { AvatarHeyGen, VozHeyGen } from "@/servicios/proveedores/heygen";
import { VozGemini, TranscripcionGemini } from "@/servicios/proveedores/gemini";
import { VozElevenLabs } from "@/servicios/proveedores/elevenlabs";
import { VozSimulada } from "@/servicios/proveedores/simulados";
import {
  proveedorAvatar,
  proveedorVoz,
  proveedorTranscripcion,
} from "@/servicios/proveedores";
import { descargar } from "@/servicios/proveedores/http";
import {
  actualizarCatalogo,
  catalogo,
  crearReto,
  crearMedio,
  sincronizarMedios,
  medioDisponible,
  revisarIdentidad,
  reintentarMedio,
} from "@/servicios/biblioteca";
import { db } from "@/db";
import {
  assets,
  attachments,
  allowedEmails,
  identityChallenges,
  type User,
} from "@/db/schema";
import { loginGoogle } from "@/lib/identidad";
import { estado } from "@/servicios/datos";
import { FabricaN8n, FabricaSimulada } from "@/servicios/fabrica";
let active: User;
vi.mock("@/lib/sesion", () => ({ currentUser: async () => active }));
import { GET, POST, PATCH, DELETE } from "@/app/api/[...ruta]/route";
const audio = { mime: "audio/webm", data: "YWJjZA==" },
  foto = { ...audio, mime: "image/png" };
const ok = (body: unknown, status = 200) => Response.json(body, { status });
const look = (status = "processing") => ({
  id: "look_prueba",
  name: "Presentador",
  status,
});
const transport = (...bodies: unknown[]) =>
  vi.fn<typeof fetch>().mockImplementation(async () => ok(bodies.shift()));
let ana: User, luis: User, admin: User;
beforeAll(() => {
  admin = loginGoogle("admin@example.test", "Walter");
  for (const email of ["ana@example.test", "luis@example.test"])
    db()
      .insert(allowedEmails)
      .values({ email, createdAt: Date.now() })
      .onConflictDoNothing()
      .run();
  ana = loginGoogle("ana@example.test", "Ana");
  luis = loginGoogle("luis@example.test", "Luis");
});
beforeEach(() => {
  active = ana;
  for (const name of [
    "COOPER_AVATAR",
    "COOPER_VOZ_CLONADA",
    "COOPER_VOZ_CATALOGO",
    "COOPER_TRANSCRIPCION",
  ])
    vi.stubEnv(name, "simulada");
  for (const name of ["HEYGEN_API_KEY", "GEMINI_API_KEY", "ELEVENLABS_API_KEY"])
    vi.stubEnv(name, "credencial-ficticia");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function route(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  data?: unknown,
) {
  return { GET, POST, PATCH, DELETE }[method](
    new Request(`http://localhost/api/${path}`, {
      method,
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
    { params: Promise.resolve({ ruta: path.split("/") }) },
  );
}
function archivo(mime: string, ownerId = ana.id) {
  const id = randomUUID();
  db()
    .insert(attachments)
    .values({ id, ownerId, name: "material", mime, data: audio.data, size: 4 })
    .run();
  return id;
}
function alta(kind: "avatar" | "voz" = "avatar") {
  return {
    kind,
    name: "Mi identidad",
    evidenceId: archivo("audio/webm"),
    photoIds: kind === "avatar" ? [archivo("image/png")] : [],
    challengeId: crearReto(ana, kind).id,
    placement: "partes" as const,
    consentimiento: true,
  };
}
describe("Transportes oficiales sin red", () => {
  it("crea un avatar de foto con idempotencia y consulta estados", async () => {
    const t = transport(
      { data: { avatar_item: look() } },
      {
        data: {
          ...look("completed"),
          preview_video_url: "https://files.heygen.ai/a.mp4",
        },
      },
      { data: look("failed") },
    );
    const p = new AvatarHeyGen(t);
    expect(
      await p.crear({ nombre: "Ana", foto, operacionId: "operacion" }),
    ).toMatchObject({ id: "look_prueba", estado: "entrenando" });
    const [url, init] = t.mock.calls[0];
    expect(url).toBe("https://api.heygen.com/v3/avatars");
    expect(JSON.parse(init!.body as string)).toEqual({
      type: "photo",
      name: "Ana",
      file: { type: "base64", media_type: foto.mime, data: foto.data },
    });
    expect(new Headers(init!.headers).get("Idempotency-Key")).toBe("operacion");
    expect((await p.consultar("look_prueba")).estado).toBe("listo");
    expect((await p.consultar("look_prueba")).estado).toBe("error");
  });
  it("clona una voz con HeyGen y nunca la usa antes de ACTIVE", async () => {
    const t = transport(
      { data: { voice_id: "voz_prueba" } },
      { data: { voice_id: "voz_prueba", status: "PENDING" } },
      { data: { voice_id: "voz_prueba", status: "ACTIVE" } },
    );
    const p = new VozHeyGen(t);
    await p.clonar({ nombre: "Ana", audio, operacionId: "voz-operacion" });
    expect(JSON.parse(t.mock.calls[0][1]!.body as string)).toMatchObject({
      mode: "instant",
      audio: [{ type: "base64", media_type: "audio/webm" }],
      similarity: "max",
    });
    expect((await p.consultar("voz_prueba")).estado).toBe("entrenando");
    expect((await p.consultar("voz_prueba")).estado).toBe("listo");
  });
  it("solo carga catálogo público, recorre páginas y exige vista previa", async () => {
    const t = transport(
      {
        data: [
          {
            ...look("completed"),
            preview_video_url: "https://files.heygen.ai/a.mp4",
          },
          look("failed"),
        ],
        has_more: true,
        next_token: "pagina 2",
      },
      { data: [], has_more: false },
    );
    expect(await new AvatarHeyGen(t).catalogo()).toHaveLength(1);
    expect(String(t.mock.calls[0][0])).toContain("ownership=public");
    expect(String(t.mock.calls[1][0])).toContain("token=pagina%202");
  });
  it("sintetiza Gemini con el modelo de Ajustes y decodifica la respuesta REST", async () => {
    const wav = new VozSimulada().muestra().toString("base64");
    const t = transport({
      status: "completed",
      steps: [
        { type: "model_output", content: [{ type: "audio", data: wav }] },
      ],
    });
    expect(await new VozGemini(t).sintetizar("Charon", "Hola")).toEqual({
      mime: "audio/wav",
      data: wav,
    });
    expect(JSON.parse(t.mock.calls[0][1]!.body as string)).toMatchObject({
      model: "gemini-3.8-flash-tts",
      store: false,
      generation_config: { speech_config: [{ voice: "Charon" }] },
    });
    await expect(
      new VozGemini(t).sintetizar("inventada", "Hola"),
    ).rejects.toThrow("Voz no encontrada");
    expect(t).toHaveBeenCalledTimes(1);
  });
  it("transcribe el contenido real, adapta M4A y no inventa una frase al fallar", async () => {
    const t = transport(
      {
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [{ type: "text", text: "Mi mensaje distinto." }],
          },
        ],
      },
      { status: "completed", steps: [] },
    );
    const p = new TranscripcionGemini(t);
    expect(await p.transcribir({ ...audio, mime: "audio/mp4" })).toBe(
      "Mi mensaje distinto.",
    );
    expect(
      JSON.parse(t.mock.calls[0][1]!.body as string).input[1],
    ).toMatchObject({ data: audio.data, mime_type: "audio/m4a" });
    await expect(p.transcribir(audio)).rejects.toThrow("No se entiende");
  });
  it("respeta la verificación adicional de ElevenLabs y el multipart", async () => {
    const t = transport(
      { voice_id: "voice_test", requires_verification: true },
      {
        voice_id: "voice_test",
        voice_verification: { requires_verification: true, is_verified: false },
      },
      {
        voice_id: "voice_test",
        voice_verification: { requires_verification: true, is_verified: true },
      },
    );
    const p = new VozElevenLabs(t);
    expect((await p.clonar({ nombre: "Ana", audio })).estado).toBe(
      "verificacion_proveedor",
    );
    expect(t.mock.calls[0][0]).toBe("https://api.elevenlabs.io/v1/voices/add");
    const form = t.mock.calls[0][1]!.body as FormData;
    expect(form.get("name")).toBe("Ana");
    expect(form.get("files")).toBeInstanceOf(Blob);
    expect((await p.consultar("voice_test")).estado).toBe(
      "verificacion_proveedor",
    );
    expect((await p.consultar("voice_test")).estado).toBe("listo");
  });
  it.each([401, 429, 500])(
    "redacta errores HTTP %i sin reintentos de pago",
    async (status) => {
      const t = vi
        .fn<typeof fetch>()
        .mockResolvedValue(ok({ error: "datos-privados-no-mostrar" }, status));
      await expect(
        new AvatarHeyGen(t).crear({ nombre: "Ana", foto, operacionId: "op" }),
      ).rejects.toMatchObject({ status: status === 429 ? 429 : 502 });
      expect(t).toHaveBeenCalledTimes(1);
    },
  );
  it("rechaza respuestas incompatibles, timeouts y configuración desconocida", async () => {
    const t = transport({
      data: { avatar_item: { id: "x", status: "unknown" } },
    });
    await expect(
      new AvatarHeyGen(t).crear({ nombre: "Ana", foto, operacionId: "op" }),
    ).rejects.toThrow("inválida");
    expect(t.mock.calls[0][1]!.signal).toBeInstanceOf(AbortSignal);
    await expect(
      new AvatarHeyGen(
        vi.fn().mockRejectedValue(new Error("token no divulgar")),
      ).consultar("x"),
    ).rejects.toThrow("No pudimos conectar");
    vi.stubEnv("COOPER_AVATAR", "inventado");
    expect(() => proveedorAvatar()).toThrow();
    vi.stubEnv("COOPER_TRANSCRIPCION", "inventado");
    expect(() => proveedorTranscripcion()).toThrow();
    vi.stubEnv("HEYGEN_API_KEY", "");
    await expect(new VozHeyGen(t).consultar("x")).rejects.toThrow(
      "no está configurado",
    );
    expect(proveedorVoz("elevenlabs")).toBeInstanceOf(VozElevenLabs);
  });
  it("bloquea SSRF y redirecciones en vistas previas", async () => {
    const t = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("audio", { headers: { "content-type": "audio/wav" } }),
      );
    for (const url of [
      "http://127.0.0.1/x",
      "https://evil.test/x",
      "https://files.heygen.ai.evil.test/a",
      "https://usuario@files.heygen.ai/a",
    ])
      await expect(descargar(url, t)).rejects.toThrow();
    expect(t).not.toHaveBeenCalled();
    await descargar("https://files.heygen.ai/a.wav", t);
    expect(t.mock.calls[0][1]!.redirect).toBe("error");
  });
});
describe("Identidad, privacidad y contrato de fábrica", () => {
  it("la frase es aleatoria, expira y pertenece a una cuenta y tipo", async () => {
    const input = alta();
    const reto = crearReto(ana, "avatar"),
      otro = crearReto(luis, "avatar");
    expect(reto.phrase).not.toBe(otro.phrase);
    await expect(
      crearMedio(ana, { ...input, challengeId: otro.id }),
    ).rejects.toThrow();
    db()
      .update(identityChallenges)
      .set({ expiresAt: Date.now() - 1 })
      .where(eq(identityChallenges.id, reto.id))
      .run();
    await expect(
      crearMedio(ana, { ...input, challengeId: reto.id }),
    ).rejects.toThrow("caducó");
    await expect(
      crearMedio(ana, { ...input, consentimiento: false }),
    ).rejects.toThrow();
    await expect(
      crearMedio(ana, { ...input, evidenceId: archivo("audio/webm", luis.id) }),
    ).rejects.toThrow();
  });
  it("guarda consentimiento fechado, consume el reto una vez y protege hasta terminar", async () => {
    const input = alta();
    const result = await crearMedio(ana, input);
    const a = db().select().from(assets).where(eq(assets.id, result.id)).get()!;
    expect(a.consentAt).toBeGreaterThan(0);
    expect(a.consentVersion).toBe("2026-11-20");
    expect(a.consentText).toContain("Walter");
    expect(a.shared).toBe(false);
    await expect(crearMedio(ana, input)).rejects.toThrow("utilizada");
    expect(() => medioDisponible(ana, a.id, "avatar")).toThrow();
    expect(
      (await route("PATCH", `activos/${a.id}`, { shared: true })).status,
    ).toBe(409);
    db().update(assets).set({ polledAt: 0 }).where(eq(assets.id, a.id)).run();
    await sincronizarMedios(ana);
    expect(medioDisponible(ana, a.id, "avatar").recurso_id).toBe(a.id);
    expect(JSON.stringify(estado(luis))).not.toContain(a.id);
  });
  it("requiere revisión humana real; guarda el ID remoto y oculta evidencia al equipo", async () => {
    vi.stubEnv("COOPER_AVATAR", "heygen");
    const input = alta();
    const result = await crearMedio(ana, input);
    expect(fetch).not.toHaveBeenCalled();
    expect(
      db().select().from(assets).where(eq(assets.id, result.id)).get()?.status,
    ).toBe("revision");
    await expect(revisarIdentidad(luis, result.id, true)).rejects.toThrow();
    active = admin;
    expect((await route("GET", `archivos/${input.evidenceId}`)).status).toBe(
      404,
    );
    expect(
      (await route("GET", `revision-archivo/${result.id}/${input.evidenceId}`))
        .status,
    ).toBe(200);
    expect(
      (
        await route(
          "GET",
          `revision-archivo/${result.id}/${archivo("audio/webm", luis.id)}`,
        )
      ).status,
    ).toBe(404);
    const t = transport(
      { data: { avatar_item: look() } },
      { data: look("completed") },
    );
    vi.stubGlobal("fetch", t);
    await revisarIdentidad(admin, result.id, true);
    const a = db().select().from(assets).where(eq(assets.id, result.id)).get()!;
    expect(a.reviewedBy).toBe(admin.id);
    expect(a.providerId).toBe("look_prueba");
    expect(a.verified).toBe(true);
    expect(
      (await route("GET", `revision-archivo/${a.id}/${input.evidenceId}`))
        .status,
    ).toBe(404);
    db().update(assets).set({ polledAt: 0 }).where(eq(assets.id, a.id)).run();
    await sincronizarMedios(ana);
    active = ana;
    await route("PATCH", `activos/${a.id}`, { shared: true });
    active = luis;
    expect((await route("GET", `archivos/${input.evidenceId}`)).status).toBe(
      404,
    );
    expect((await route("GET", `archivos/${input.photoIds[0]}`)).status).toBe(
      200,
    );
    expect(JSON.stringify(estado(luis).assets)).not.toMatch(
      /providerId|previewUrl|challengeId|evidenceId/,
    );
    active = ana;
    await route("PATCH", `activos/${a.id}`, { shared: false });
    active = luis;
    expect((await route("GET", `archivos/${input.photoIds[0]}`)).status).toBe(
      404,
    );
  });
  it("rechazar no entrena y la decisión no puede repetirse", async () => {
    vi.stubEnv("COOPER_AVATAR", "heygen");
    const { id } = await crearMedio(ana, alta());
    await revisarIdentidad(admin, id, false);
    expect(fetch).not.toHaveBeenCalled();
    await expect(revisarIdentidad(admin, id, true)).rejects.toThrow();
    expect(() => medioDisponible(ana, id, "avatar")).toThrow();
  });
  it("un envío fallido se recupera con la misma clave, sin sustituir proveedores", async () => {
    vi.stubEnv("COOPER_AVATAR", "heygen");
    const { id } = await crearMedio(ana, alta());
    const fail = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("desconectado"));
    vi.stubGlobal("fetch", fail);
    await expect(revisarIdentidad(admin, id, true)).rejects.toThrow();
    const t = transport({ data: { avatar_item: look() } });
    vi.stubGlobal("fetch", t);
    await reintentarMedio(ana, id);
    expect(
      new Headers(fail.mock.calls[0][1]!.headers).get("Idempotency-Key"),
    ).toBe(id);
    expect(
      new Headers(t.mock.calls[0][1]!.headers).get("Idempotency-Key"),
    ).toBe(id);
  });
  it("propaga la selección autorizada y conserva los campos anteriores del contrato", async () => {
    const canal = await new FabricaSimulada().ejecutar(ana, {
      evento: "nuevo_canal",
      texto: "Ciencia",
    });
    vi.stubEnv("COOPER_VOZ_CATALOGO", "gemini");
    vi.stubEnv("COOPER_N8N_URL", "https://puente.example.test");
    vi.stubEnv("COOPER_N8N_TOKEN", "token-ficticio");
    const t = transport({ aceptado: true });
    vi.stubGlobal("fetch", t);
    await new FabricaN8n().ejecutar(ana, {
      evento: "nuevo_video",
      texto: "Prueba",
      recursoId: canal.id,
      avatarId: "cooper",
      voiceId: "voz-charon",
      avatarPlacement: "completo",
    });
    expect(JSON.parse(t.mock.calls[0][1]!.body as string)).toMatchObject({
      dueno_email: ana.email,
      datos: {
        avatarId: "cooper",
        voiceId: "voz-charon",
        avatarPlacement: "completo",
        presentacion: {
          version: 1,
          presencia: "completo",
          voz: { proveedor: "gemini", id: "Charon", tipo: "catalogo" },
        },
      },
    });
    await expect(
      new FabricaN8n().ejecutar(luis, {
        evento: "nuevo_video",
        texto: "Ajeno",
        recursoId: canal.id,
      }),
    ).rejects.toThrow();
    expect(t).toHaveBeenCalledTimes(1);
  });
  it("transcribir usa bytes privados del dueño y etiqueta el resultado real", async () => {
    const id = archivo("audio/webm");
    vi.stubEnv("COOPER_TRANSCRIPCION", "gemini");
    const t = transport({
      status: "completed",
      steps: [
        {
          type: "model_output",
          content: [{ type: "text", text: "Lo que dije de verdad" }],
        },
      ],
    });
    vi.stubGlobal("fetch", t);
    active = luis;
    expect((await route("POST", "transcribir", { id })).status).toBe(404);
    expect(t).not.toHaveBeenCalled();
    active = ana;
    expect(await (await route("POST", "transcribir", { id })).json()).toEqual({
      texto: "Lo que dije de verdad",
      simulada: false,
    });
  });
  it("la muestra de una voz compartida deja de ser accesible al revocar", async () => {
    const { id } = await crearMedio(ana, alta("voz"));
    db().update(assets).set({ polledAt: 0 }).where(eq(assets.id, id)).run();
    await sincronizarMedios(ana);
    expect((await route("GET", `muestra/${id}`)).status).toBe(200);
    await route("PATCH", `activos/${id}`, { shared: true });
    active = luis;
    expect((await route("GET", `muestra/${id}`)).status).toBe(200);
    expect((await route("DELETE", `activos/${id}`)).status).toBe(404);
    active = ana;
    await route("PATCH", `activos/${id}`, { shared: false });
    active = luis;
    expect((await route("GET", `muestra/${id}`)).status).toBe(404);
  });
  it("persiste el catálogo real sin importar recursos privados del workspace", async () => {
    vi.stubEnv("COOPER_AVATAR", "heygen");
    const t = transport({
      data: [
        {
          ...look("completed"),
          preview_video_url: "https://files.heygen.ai/public.mp4",
        },
      ],
      has_more: false,
    });
    vi.stubGlobal("fetch", t);
    await actualizarCatalogo();
    expect(catalogo().some((a) => a.id.startsWith("presentador-"))).toBe(true);
    expect(catalogo().some((a) => a.id === "cooper")).toBe(true);
    expect(String(t.mock.calls[0][0])).toContain("ownership=public");
  });
});
