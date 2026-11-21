import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import * as archivos from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  allowedEmails,
  channels,
  expenses,
  users,
  videos,
  type User,
} from "@/db/schema";
import {
  umbralesSaludPredeterminados as umbrales,
  umbralesSaludSchema,
} from "@/contratos/salud-operativa";
import type { Operacion } from "@/contratos/operacion";
import { leerSaludOperativa } from "@/servicios/salud-operativa";
import { FabricaN8n } from "@/servicios/fabrica";
import * as operacion from "@/servicios/operacion";

const ahora = Date.parse("2026-11-21T17:00:00Z");
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  open: vi.fn(),
}));
const fecha = (diferencia = 0) => new Date(ahora + diferencia).toISOString();
let admin: User;
function cuenta(role: "admin" | "usuario" = "admin") {
  const id = randomUUID();
  db()
    .insert(allowedEmails)
    .values({ email: `${id}@example.test`, createdAt: ahora })
    .run();
  return db()
    .insert(users)
    .values({ id, email: `${id}@example.test`, name: "Prueba de salud", role })
    .returning()
    .get();
}
function op(): Operacion {
  return {
    modo: "n8n",
    actualizado: fecha(),
    canales: [],
    decisiones: [],
    publicaciones: [],
    avisos: [],
    fallos: [],
  };
}
function remoto() {
  vi.stubEnv("COOPER_FABRICA", "n8n");
  vi.stubEnv("COOPER_N8N_API_URL", "https://n8n.example.test/api/v1");
  vi.stubEnv("COOPER_N8N_API_KEY", "clave-ficticia-observabilidad");
  vi.spyOn(FabricaN8n.prototype, "request").mockImplementation(
    async (_user, evento) => {
      if (evento === "estado") return { canales: [], videos: [] };
      if (evento === "gastos") return { gastos: [], estimados: false };
      throw new Error("Evento inesperado");
    },
  );
}
function snapshot() {
  return {
    schemaVersion: 1,
    collectedAt: fecha(),
    maintenance: false,
    disk: { totalBytes: 1000, freeBytes: 500 },
    memory: { totalBytes: 1000, availableBytes: 500 },
    certificates: {
      cooper: { state: "ok", expiresAt: fecha(90 * 86400000) },
      n8n: { state: "ok", expiresAt: fecha(90 * 86400000) },
    },
    backups: {
      copy: { state: "ok", completedAt: fecha(-3600000), ageHours: 1 },
      replica: { state: "ok", completedAt: fecha(-3600000), ageHours: 1 },
    },
    services: { cooper: "ok", n8n: "ok", runner: "ok", caddy: "ok" },
  };
}
function archivo(value: unknown, bytesDeclarados?: number) {
  vi.stubEnv("COOPER_OBSERVABILIDAD_VPS_PATH", "/prueba/estado.json");
  const texto = typeof value === "string" ? value : JSON.stringify(value);
  const close = vi.fn(async () => {});
  const read = vi.fn(async (buffer: Buffer) => ({
    bytesRead: buffer.write(texto),
    buffer,
  }));
  vi.mocked(archivos.open).mockResolvedValue({
    stat: async () => ({
      isFile: () => true,
      size: bytesDeclarados ?? Buffer.byteLength(texto),
    }),
    read,
    close,
  } as unknown as Awaited<ReturnType<typeof archivos.open>>);
  return { close, read };
}
function transporte() {
  const fn = vi.fn(async (url: URL | RequestInfo) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/executions") || path.endsWith("/workflows"))
      return Response.json({ data: [], nextCursor: null });
    throw new Error("Consulta inesperada");
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
beforeEach(() => {
  vi.mocked(archivos.open).mockReset();
  vi.spyOn(Date, "now").mockReturnValue(ahora);
  vi.stubEnv("COOPER_DEMO", "0");
  vi.stubEnv("COOPER_N8N_API_URL", "");
  vi.stubEnv("COOPER_N8N_API_KEY", "");
  vi.stubEnv("COOPER_OBSERVABILIDAD_VPS_PATH", "");
  vi.spyOn(operacion, "leerOperacion").mockResolvedValue(op());
  admin = cuenta();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("permisos y aislamiento de fuentes", () => {
  it("deniega usuarios normales, falsos administradores y suspendidos antes de consultar", async () => {
    const usuario = cuenta("usuario");
    const fetch = transporte();
    const abrir = vi.mocked(archivos.open);
    await expect(leerSaludOperativa(usuario, umbrales)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      leerSaludOperativa({ ...usuario, role: "admin" }, umbrales),
    ).rejects.toMatchObject({ status: 403 });
    db()
      .update(users)
      .set({ active: false })
      .where(eq(users.id, admin.id))
      .run();
    await expect(leerSaludOperativa(admin, umbrales)).rejects.toMatchObject({
      status: 403,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(abrir).not.toHaveBeenCalled();
  });
  it("el demo ignora configuración real de n8n y del VPS", async () => {
    remoto();
    archivo(snapshot());
    vi.stubEnv("COOPER_DEMO", "1");
    const fetch = transporte();
    const salud = await leerSaludOperativa(admin, umbrales);
    expect(salud.modo).toBe("simulada");
    expect(salud.n8n.estado).toBe("simulada");
    expect(salud.vps.estado).toBe("simulada");
    expect(fetch).not.toHaveBeenCalled();
    expect(archivos.open).not.toHaveBeenCalled();
    expect(salud.alertas).toEqual([]);
  });
  it("revalida permiso al terminar una consulta en vuelo", async () => {
    vi.mocked(operacion.leerOperacion).mockImplementation(async () => {
      db()
        .update(users)
        .set({ role: "usuario" })
        .where(eq(users.id, admin.id))
        .run();
      return op();
    });
    await expect(leerSaludOperativa(admin, umbrales)).rejects.toMatchObject({
      status: 403,
    });
  });
  it("valida todos los umbrales y rechaza campos extra o infinitos", () => {
    expect(umbralesSaludSchema.safeParse(umbrales).success).toBe(true);
    for (const extra of [
      { gastoDiarioUsd: Infinity },
      { fallosN8n: 0 },
      { videoSinAvanceMinutos: 1 },
      { servidor: "https://ajeno.test" },
    ])
      expect(
        umbralesSaludSchema.safeParse({ ...umbrales, ...extra }).success,
      ).toBe(false);
  });
});

describe("lectura de n8n", () => {
  it.each([
    "http://externo.test/api/v1",
    "https://usuario:clave@example.test/api/v1",
    "https://example.test/api/v1?token=ficticio",
    "https://example.test/api/v1#fragmento",
    "file:///api/v1",
    "https://example.test/webhook",
  ])("rechaza configuración insegura %s sin consultar", async (url) => {
    remoto();
    vi.stubEnv("COOPER_N8N_API_URL", url);
    const fetch = transporte();
    expect((await leerSaludOperativa(admin, umbrales)).n8n.estado).toBe(
      "sin_configurar",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("admite loopback explícito, GET sin redirecciones, no caché y timeout", async () => {
    remoto();
    vi.stubEnv("COOPER_N8N_API_URL", "http://127.0.0.1:5678/api/v1");
    const fetch = transporte();
    await leerSaludOperativa(admin, umbrales);
    for (const llamada of fetch.mock.calls) {
      const init = (llamada as unknown as [URL, RequestInit])[1];
      expect(init).toMatchObject({
        method: "GET",
        cache: "no-store",
        redirect: "error",
        headers: { "X-N8N-API-KEY": "clave-ficticia-observabilidad" },
      });
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });
  it("pagina de forma acotada, informa el recorte y no confunde activeVersionId con active obsoleto", async () => {
    remoto();
    const fetch = vi.fn(async (url: URL) => {
      if (url.pathname.endsWith("workflows"))
        return Response.json({
          data: [
            {
              id: "w1",
              name: "Flujo principal",
              active: true,
              activeVersionId: null,
            },
            {
              id: "w2",
              name: "Flujo activo",
              active: false,
              activeVersionId: "v1",
            },
          ],
          nextCursor: null,
        });
      const n = Number(url.searchParams.get("cursor") || 0);
      return Response.json({
        data: [
          {
            id: String(n + 1),
            workflowId: "w2",
            status: "success",
            startedAt: fecha(),
            stoppedAt: fecha(),
          },
        ],
        nextCursor: String(n + 1),
      });
    });
    vi.stubGlobal("fetch", fetch);
    const salud = await leerSaludOperativa(admin, umbrales);
    expect(salud.n8n.ejecuciones).toHaveLength(4);
    expect(salud.n8n.ejecucionesTruncadas).toBe(true);
    expect(salud.n8n.workflowsActivos).toBe(1);
    expect(salud.n8n.workflowsTruncados).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it("clasifica errores sin filtrar mensajes, payloads, claves ni URLs", async () => {
    remoto();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        if (url.pathname.endsWith("workflows"))
          return Response.json({
            data: [
              {
                id: "wf",
                name: "Montaje",
                active: true,
                nodes: [{ credentials: "secreto-no-publico" }],
              },
            ],
            nextCursor: null,
          });
        if (url.pathname.endsWith("executions"))
          return Response.json({
            data: [
              {
                id: "123",
                workflowId: "wf",
                status: "error",
                startedAt: fecha(-1000),
                stoppedAt: fecha(),
              },
              {
                id: "124",
                workflowId: "wf",
                status: "error",
                startedAt: fecha(-3 * 86400000),
                stoppedAt: fecha(-3 * 86400000),
              },
            ],
            nextCursor: null,
          });
        expect(url.searchParams.get("redactExecutionData")).toBe("true");
        return Response.json({
          data: {
            resultData: {
              error: {
                message:
                  "timeout https://privado.example.test/token=secreto-no-publico",
                stack: "secreto-no-publico",
              },
              runData: "secreto-no-publico",
            },
          },
        });
      }),
    );
    const salud = await leerSaludOperativa(admin, umbrales);
    expect(salud.n8n.fallosRecientes).toHaveLength(1);
    expect(salud.n8n.fallosRecientes[0].causa).toBe(
      "Un servicio tardó más de lo permitido en responder.",
    );
    expect(salud.alertas.some((a) => a.codigo === "n8n_fallos")).toBe(true);
    expect(JSON.stringify(salud)).not.toMatch(
      /secreto-no-publico|privado\.example|clave-ficticia|runData|credentials/,
    );
  });
  it("un fallo de lectura conserva la otra fuente y no inventa cero workflows", async () => {
    remoto();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) =>
        url.pathname.endsWith("workflows")
          ? Response.json({ message: "privado" }, { status: 403 })
          : Response.json({ data: [], nextCursor: null }),
      ),
    );
    const salud = await leerSaludOperativa(admin, umbrales);
    expect(salud.n8n.estado).toBe("degradado");
    expect(salud.n8n.workflowsActivos).toBeNull();
    expect(salud.n8n.ejecucionesDisponibles).toBe(true);
    expect(salud.n8n.workflowsDisponibles).toBe(false);
    expect(salud.alertas.some((a) => a.codigo === "n8n_fuente")).toBe(true);
    expect(salud.n8n.detalle).toContain("permiso");
    expect(JSON.stringify(salud)).not.toContain("privado");
  });
  it("rechaza respuesta sobre el límite, cursores repetidos y documentos inválidos", async () => {
    remoto();
    for (const tipo of ["grande", "cursor", "invalido"]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          tipo === "grande"
            ? new Response("{}", {
                headers: {
                  "content-type": "application/json",
                  "content-length": "3000000",
                },
              })
            : tipo === "cursor"
              ? Response.json({ data: [], nextCursor: "repetido" })
              : Response.json({ error: "privado" }),
        ),
      );
      expect((await leerSaludOperativa(admin, umbrales)).n8n.estado).toBe(
        "error",
      );
    }
  });
});

describe("VPS saneado y caducidad", () => {
  it("mantenimiento fresco sustituye falsas averías por un aviso de mantenimiento", async () => {
    archivo({
      ...snapshot(),
      maintenance: true,
      disk: null,
      memory: null,
      services: {
        cooper: "unknown",
        n8n: "unknown",
        runner: "unknown",
        caddy: "unknown",
      },
    });
    const salud = await leerSaludOperativa(admin, umbrales);
    expect(salud.vps.detalle).toContain("mantenimiento");
    expect(
      salud.alertas.filter((a) => a.fuente === "vps").map((a) => a.codigo),
    ).toEqual(["vps_mantenimiento"]);
    expect(salud.vps.estado).toBe("degradado");
  });
  it("vigila también runner y Caddy", async () => {
    const valor = snapshot();
    valor.services.runner = "down";
    valor.services.caddy = "unknown";
    archivo(valor);
    const salud = await leerSaludOperativa(admin, umbrales);
    expect(salud.vps.servicios.runner).toBe("down");
    expect(salud.alertas.map((a) => a.codigo)).toEqual(
      expect.arrayContaining(["vps_servicio_runner", "vps_servicio_caddy"]),
    );
  });
  it("deriva umbrales desde métricas y fechas, ignorando estados declarados", async () => {
    const valor = snapshot();
    valor.disk.freeBytes = 100;
    valor.memory.availableBytes = 100;
    valor.certificates.cooper.expiresAt = fecha(-1);
    valor.backups.replica.completedAt = fecha(-37 * 3600000);
    const { close } = archivo({ ...valor, secret: "no-publicar" });
    const salud = await leerSaludOperativa(admin, umbrales);
    expect(salud.vps.disco?.librePorcentaje).toBe(10);
    expect(salud.vps.memoria?.usadaPorcentaje).toBe(90);
    expect(salud.alertas.map((a) => a.codigo)).toEqual(
      expect.arrayContaining([
        "vps_disco",
        "vps_memoria",
        "vps_certificado_cooper",
        "vps_copia_remota",
      ]),
    );
    expect(
      salud.alertas.find((a) => a.codigo === "vps_certificado_cooper")
        ?.severidad,
    ).toBe("critica");
    expect(JSON.stringify(salud)).not.toContain("no-publicar");
    expect(close).toHaveBeenCalledOnce();
  });
  it("datos viejos no se interpretan como una avería nueva del disco", async () => {
    const valor = snapshot();
    valor.collectedAt = fecha(-16 * 60000);
    valor.disk.freeBytes = 0;
    archivo(valor);
    const salud = await leerSaludOperativa(admin, umbrales);
    expect(salud.vps.estado).toBe("degradado");
    expect(salud.alertas.map((a) => a.codigo)).toContain("vps_desactualizado");
    expect(salud.alertas.map((a) => a.codigo)).not.toContain("vps_disco");
  });
  it("admite métricas desconocidas del recolector sin inventar ceros", async () => {
    archivo({
      ...snapshot(),
      disk: { totalBytes: null, freeBytes: null },
      memory: null,
    });
    const salud = await leerSaludOperativa(admin, umbrales);
    expect(salud.vps.disco).toBeNull();
    expect(salud.vps.memoria).toBeNull();
    expect(salud.alertas.map((a) => a.codigo)).toContain("vps_metricas");
  });
  it("rechaza archivo demasiado grande, futuro, JSON inválido y métricas imposibles", async () => {
    for (const [valor, size] of [
      [snapshot(), 65537],
      [{ ...snapshot(), collectedAt: fecha(120000) }, undefined],
      ["{invalido", undefined],
      [{ ...snapshot(), disk: { totalBytes: 10, freeBytes: 11 } }, undefined],
    ] as const) {
      archivo(valor, size);
      const salud = await leerSaludOperativa(admin, umbrales);
      expect(salud.vps.estado).toBe("error");
      expect(salud.vps.disco).toBeNull();
    }
  });
});

describe("actividad y costes de fábrica", () => {
  it("separa colgados de aprobaciones, programación, pausas y cancelaciones", async () => {
    const canal = randomUUID();
    db()
      .insert(channels)
      .values({
        id: canal,
        ownerId: admin.id,
        name: "Prueba",
        niche: "Prueba",
        createdAt: ahora,
      })
      .run();
    const casos = [
      [0, "activa", "colgado"],
      [3, "activa", "aprobacion"],
      [9, "activa", "aprobacion"],
      [10, "activa", "programado"],
      [2, "pausada", "pausado"],
      [2, "cancelada", "cancelado"],
      [11, "activa", "publicado"],
    ] as const;
    const ids = casos.map(([stage, productionState]) => {
      const id = randomUUID();
      db()
        .insert(videos)
        .values({
          id,
          ownerId: admin.id,
          channelId: canal,
          title: "Prueba",
          script: "",
          stage,
          productionState,
          createdAt: ahora - 7200000,
          updatedAt: ahora - 7200000,
        })
        .run();
      return id;
    });
    const salud = await leerSaludOperativa(admin, umbrales);
    casos.forEach((c, i) =>
      expect(salud.fabrica.videos.find((v) => v.id === ids[i])?.estado).toBe(
        c[2],
      ),
    );
    expect(salud.fabrica.gastoFuente).toBe("simulada");
    expect(salud.alertas.some((a) => a.codigo === "fabrica_sin_avance")).toBe(
      false,
    );
  });
  it("no sustituye gasto remoto desconocido por gastos de SQLite", async () => {
    remoto();
    transporte();
    db()
      .insert(expenses)
      .values({
        id: randomUUID(),
        ownerId: admin.id,
        amount: 999,
        concept: "Simulado",
        createdAt: ahora,
      })
      .run();
    vi.mocked(FabricaN8n.prototype.request).mockImplementation(
      async (_user, evento) => {
        if (evento === "estado") return { canales: [], videos: [] };
        throw new Error("Dato privado");
      },
    );
    const salud = await leerSaludOperativa(admin, umbrales);
    expect(salud.fabrica.gastoDiarioUsd).toBeNull();
    expect(salud.fabrica.gastoFuente).toBe("desconocida");
    expect(
      salud.alertas.some((a) => a.codigo === "fabrica_gasto_desconocido"),
    ).toBe(true);
  });
  it("suma gasto de todos los dueños remotos aunque no estén en la base local", async () => {
    remoto();
    transporte();
    vi.mocked(FabricaN8n.prototype.request).mockImplementation(
      async (_user, evento) =>
        evento === "estado"
          ? { canales: [], videos: [] }
          : {
              gastos: [
                {
                  dueno_email: "historico@example.test",
                  dia: 31,
                  semana: 31,
                  mes: 31,
                },
              ],
              estimados: true,
            },
    );
    const salud = await leerSaludOperativa(admin, umbrales);
    expect(salud.fabrica.gastoDiarioUsd).toBe(31);
    expect(salud.fabrica.gastoFuente).toBe("n8n_estimado");
    expect(
      salud.alertas.find((a) => a.codigo === "fabrica_gasto")?.detalle,
    ).toContain("estimados");
  });
  it("fábrica caída conserva gasto independiente pero muestra contadores desconocidos", async () => {
    remoto();
    transporte();
    vi.mocked(FabricaN8n.prototype.request).mockImplementation(
      async (_user, evento) => {
        if (evento === "estado") throw new Error("privado");
        return { gastos: [], estimados: false };
      },
    );
    const salud = await leerSaludOperativa(admin, umbrales);
    expect(salud.fabrica.enCurso).toBeNull();
    expect(salud.fabrica.colgados).toBeNull();
    expect(salud.fabrica.gastoDiarioUsd).toBe(0);
    expect(salud.fabrica.estado).toBe("error");
  });
});
