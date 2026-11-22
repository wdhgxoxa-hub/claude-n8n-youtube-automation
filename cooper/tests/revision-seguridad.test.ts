import { beforeAll, afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { allowedEmails, attachments, assets, type User } from "@/db/schema";
import { crearReto } from "@/servicios/biblioteca";
import { loginGoogle } from "@/lib/identidad";
import { ErrorHttp } from "@/lib/permisos";
import { FabricaSimulada } from "@/servicios/fabrica";
let active: User;
let revoked = false;
vi.mock("@/lib/sesion", () => ({
  currentUser: async () => {
    if (revoked) throw new ErrorHttp(401, "Sesión revocada");
    return active;
  },
}));
import { GET, POST, PATCH } from "@/app/api/[...ruta]/route";
import { GET as stream } from "@/app/api/eventos/route";
let ana: User, luis: User, evidence: string, foreign: string;
async function route(
  method: "GET" | "POST" | "PATCH",
  path: string,
  data?: unknown,
) {
  return { GET, POST, PATCH }[method](
    new Request(`http://localhost/api/${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
    { params: Promise.resolve({ ruta: path.split("/") }) },
  );
}
beforeAll(() => {
  for (const email of ["ana@example.test", "luis@example.test"])
    db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  ana = loginGoogle("ana@example.test", "Ana");
  luis = loginGoogle("luis@example.test", "Luis");
  active = ana;
  evidence = randomUUID();
  foreign = randomUUID();
  db()
    .insert(attachments)
    .values([
      {
        id: evidence,
        ownerId: ana.id,
        name: "voz.wav",
        mime: "audio/wav",
        size: 4,
        data: "YWJjZA==",
      },
      {
        id: foreign,
        ownerId: luis.id,
        name: "evidencia.wav",
        mime: "audio/wav",
        size: 4,
        data: "YWJjZA==",
      },
    ])
    .run();
});
afterEach(() => {
  active = ana;
  revoked = false;
  vi.restoreAllMocks();
});
it("R01 rechaza publicar un adjunto ajeno como foto de una voz", async () => {
  const created = await route("POST", "activos", {
    kind: "voz",
    name: "Voz",
    evidenceId: evidence,
    photoIds: [foreign],
    challengeId: crearReto(ana, "voz").id,
    placement: "partes",
    consentimiento: true,
  });
  expect(created.status).toBe(400);
});
it("R01 protege también referencias compartidas corruptas anteriores a la corrección", async () => {
  db()
    .insert(assets)
    .values({
      id: randomUUID(),
      ownerId: ana.id,
      kind: "voz",
      name: "Voz heredada",
      evidenceId: evidence,
      photoId: foreign,
      shared: true,
      verified: true,
      createdAt: Date.now(),
    })
    .run();
  expect((await route("GET", `archivos/${foreign}`)).status).toBe(404);
});
it.each([
  "image/png",
  "image/jpeg",
  "image/webp",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "video/mp4",
  "application/pdf",
])("R03 rechaza HTML etiquetado como %s", async (mime) => {
  expect(
    (
      await route("POST", "archivos", {
        name: "falso",
        mime,
        data: Buffer.from("<html><script>alert(1)</script></html>").toString(
          "base64",
        ),
      })
    ).status,
  ).toBe(415);
});
it("R03 rechaza base64 no canónico", async () => {
  expect(
    (
      await route("POST", "archivos", {
        name: "texto",
        mime: "text/plain",
        data: "YWJjZB==",
      })
    ).status,
  ).toBe(400);
});
it("R03 conserva tamaño máximo y descargas sin interpretación", async () => {
  expect(
    (
      await route("POST", "archivos", {
        name: "texto",
        mime: "text/plain",
        data: Buffer.alloc(5 * 1024 * 1024 + 1, 65).toString("base64"),
      })
    ).status,
  ).toBe(413);
  const uploaded = await route("POST", "archivos", {
    name: "notas.txt",
    mime: "text/plain",
    data: Buffer.from("Notas de ensayo").toString("base64"),
  });
  expect(uploaded.status).toBe(200);
  const download = await route("GET", `archivos/${(await uploaded.json()).id}`);
  expect(download.headers.get("content-security-policy")).toContain("sandbox");
});
it("R04 vuelve a comprobar la sesión tras esperar a la fábrica", async () => {
  vi.spyOn(FabricaSimulada.prototype, "sincronizar").mockImplementation(
    async () => {
      revoked = true;
    },
  );
  const controller = new AbortController();
  const response = await stream(
    new Request("http://localhost/api/eventos", { signal: controller.signal }),
  );
  const reader = response.body!.getReader();
  try {
    let text = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += new TextDecoder().decode(chunk.value);
    }
    expect(text).toContain("event: latido");
    expect(text).not.toMatch(/event: (estado|progreso)/);
  } finally {
    controller.abort();
    await reader.cancel();
  }
});
it("R04 limita conexiones SSE simultáneas y libera cupos al cancelar", async () => {
  const responses: Response[] = [];
  try {
    for (let i = 0; i < 5; i++)
      responses.push(await stream(new Request("http://localhost/api/eventos")));
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 429]);
  } finally {
    for (const response of responses) await response.body?.cancel();
  }
  const next = await stream(new Request("http://localhost/api/eventos"));
  expect(next.status).toBe(200);
  await next.body?.cancel();
});
it("R11 limita lecturas repetidas y permite recuperarse tras la ventana", async () => {
  // La sesión de ensayo debe corresponder a una cuenta persistida, como en producción.
  const email = `${randomUUID()}@example.test`;
  db().insert(allowedEmails).values({ email, createdAt: Date.now() }).run();
  active = loginGoogle(email, "Lecturas repetidas");
  for (let i = 0; i < 300; i++)
    expect((await route("GET", "estado")).status).toBe(200);
  const limited = await route("GET", "estado");
  expect(limited.status).toBe(429);
  expect(limited.headers.get("Retry-After")).toBe("60");
  const future = Date.now() + 61000;
  vi.spyOn(Date, "now").mockReturnValue(future);
  expect((await route("GET", "estado")).status).toBe(200);
});
it("rechaza todas las familias API sin sesión", async () => {
  revoked = true;
  for (const [method, path] of [
    ["GET", "estado"],
    ["GET", "admin"],
    ["GET", `archivos/${foreign}`],
    ["GET", "muestra-voz"],
    ["POST", "chat"],
    ["POST", "orden"],
    ["POST", "archivos"],
    ["POST", "activos"],
    ["POST", "transcribir"],
    ["PATCH", "perfil"],
    ["PATCH", `activos/${foreign}`],
    ["POST", "admin/permitidos"],
    ["PATCH", `admin/usuarios/${luis.id}`],
  ] as const)
    expect(
      (await route(method, path, method === "GET" ? undefined : {})).status,
      path,
    ).toBe(401);
  expect(
    (await stream(new Request("http://localhost/api/eventos"))).status,
  ).toBe(401);
});
it("protege perfil, evidencia y administración frente a referencias ajenas", async () => {
  const profile = await route("PATCH", "perfil", {
    name: "Ana",
    image: `/api/archivos/${foreign}`,
    theme: "oscuro",
    home: "chat",
    whatsapp: "",
  });
  expect(profile.status).toBe(404);
  expect(
    (
      await route("POST", "activos", {
        kind: "voz",
        name: "Voz",
        evidenceId: foreign,
        challengeId: crearReto(ana, "voz").id,
        placement: "partes",
        consentimiento: true,
      })
    ).status,
  ).toBe(404);
  expect(
    (await route("POST", "chat", { texto: "Revisa esto", adjuntos: [foreign] }))
      .status,
  ).toBe(404);
  expect(
    (await route("POST", "admin/permitidos", { email: "extra@example.test" }))
      .status,
  ).toBe(403);
  expect(
    (await route("PATCH", `admin/usuarios/${luis.id}`, { active: false }))
      .status,
  ).toBe(403);
});
