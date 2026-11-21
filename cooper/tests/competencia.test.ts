import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  normalizarCompetencia,
  competenciaVigente,
  proyectarCompetencia,
} from "@/contratos/competencia.mjs";
import { competenciaSchema } from "@/contratos/competencia-schema";
import { proponerTexto } from "@/servicios/marcas/especialistas";
import type { EntradaModelo, ProveedorChat } from "@/servicios/chat/tipos";
import {
  investigarCompetencia,
  leerCompetenciaMarca,
} from "@/servicios/competencia";
import {
  guardarMarca,
  rutaMarcas,
  estadoMarcas,
} from "@/servicios/marcas/servicio";
import { db } from "@/db";
import { users, allowedEmails } from "@/db/schema";
const now = Date.parse("2026-11-21T17:00:00Z");
function fixture() {
  const competidores = [1, 2, 3].map((i) => ({
    nombre: `Cuenta ficticia ${i}`,
    red: "youtube",
    url: `https://www.youtube.com/@ensayo${i}`,
    pais: "Perú",
    patron: "Hipótesis de contraste visual",
    muestras: [100, 120, 80, 600].map((vistas, k) => ({
      titulo: `Ensayo ${k}`,
      formato: "short",
      vistas,
      fecha: new Date(now - (10 - k) * 86400000).toISOString(),
      url: `https://www.youtube.com/shorts/ensayo${i}${k}`,
    })),
  }));
  const comprobaciones = [
    {
      red: "youtube",
      consulta: '"Margen Real" YouTube',
      url: "https://www.youtube.com/results?search_query=Margen%20Real",
    },
    {
      red: "tiktok",
      consulta: '"Margen Real" TikTok',
      url: "https://www.tiktok.com/search?q=Margen%20Real",
    },
  ];
  const raw = {
    resumen: "Datos ficticios para probar el contrato",
    ideas: [],
    competidores,
    comprobaciones,
    homonimos: [
      {
        nombre: "Margen Real de ensayo",
        red: "tiktok",
        pais: "México",
        url: "https://www.tiktok.com/@homonimoensayo",
        diferencia: "Otra cuenta, no atribuirla a Perú.",
      },
    ],
  };
  const respuesta = {
    ruta: "codex",
    busqueda_real: true,
    fuentes_consultadas: [
      ...competidores.flatMap((c) => [c.url, ...c.muestras.map((v) => v.url)]),
      ...comprobaciones.map((c) => c.url),
      raw.homonimos[0].url,
    ],
  };
  return { raw, respuesta };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("calcula el outlier desde publicaciones comparables y conserva la identidad Perú", () => {
  const { raw, respuesta } = fixture(),
    c = normalizarCompetencia(raw, respuesta, "Margen Real", now);
  expect(competenciaSchema.parse(c)).toEqual(c);
  expect(c.estado).toBe("listo");
  expect(c.competidores[0].outliers[0]).toMatchObject({
    vistas: 600,
    mediana: 100,
    muestra: 3,
    multiplicador: 6,
  });
  expect(c.diferenciacion).toContain("Perú");
  expect(c.homonimos[0].pais).toBe("México");
  expect(competenciaVigente(c, now + 24 * 3600000)).toBe(true);
  expect(competenciaVigente(c, now + 24 * 3600000 + 1)).toBe(false);
  expect(competenciaVigente(c, now - 1)).toBe(false);
});
it("rechaza métricas sin URL consultada, muestras repetidas, antiguas o de otro formato", () => {
  const { raw, respuesta } = fixture();
  for (const c of raw.competidores) {
    c.muestras[0].formato = "largo";
    c.muestras[1].fecha = "2020-01-01T00:00:00Z";
    c.muestras[2].url = c.muestras[3].url;
  }
  const c = normalizarCompetencia(raw, respuesta, "Margen Real", now);
  expect(c.estado).toBe("parcial");
  expect(c.competidores.every((x) => x.outliers.length === 0)).toBe(true);
  respuesta.fuentes_consultadas = [];
  expect(normalizarCompetencia(raw, respuesta, "Margen Real", now).estado).toBe(
    "sin_datos",
  );
});
it("una búsqueda parcial nunca certifica ausencia de homónimos ni acepta perfiles repetidos o privados", () => {
  const { raw, respuesta } = fixture();
  raw.competidores[1] = raw.competidores[0];
  raw.competidores[2].url = "https://127.0.0.1/private";
  raw.comprobaciones[1].url = raw.comprobaciones[0].url;
  const c = normalizarCompetencia(raw, respuesta, "Margen Real", now);
  expect(c.estado).toBe("parcial");
  expect(c.competidores).toHaveLength(1);
  expect(c.comprobaciones).toHaveLength(1);
  expect(c.limitaciones.join(" ")).toContain("homónimas");
  expect(
    normalizarCompetencia(
      raw,
      { ...respuesta, ruta: "openai_api" },
      "Margen Real",
      now,
    ).estado,
  ).toBe("sin_datos");
});
it("conserva identidades enlazadas por fuentes primarias abiertas sin inventar métricas del perfil bloqueado", () => {
  const { raw, respuesta } = fixture();
  const primarias = raw.competidores.map((c, i) => ({
    ...c,
    fuente_identidad: `https://editorial-ficticia${i}.example.org/canal`,
    muestras: [],
  }));
  const evidencia = {
    ...respuesta,
    fuentes_consultadas: [
      ...primarias.map((c) => c.fuente_identidad),
      ...raw.comprobaciones.map((c) => c.url),
    ],
  };
  const c = normalizarCompetencia(
    { ...raw, competidores: primarias },
    evidencia,
    "Margen Real",
    now,
  );
  expect(c.estado).toBe("parcial");
  expect(c.competidores).toHaveLength(3);
  expect(
    c.competidores.every(
      (p) => p.muestras.length === 0 && p.outliers.length === 0,
    ),
  ).toBe(true);
  expect(c.competidores.map((p) => p.fuente_identidad)).toEqual(
    primarias.map((p) => p.fuente_identidad),
  );
  evidencia.fuentes_consultadas = ["https://127.0.0.1/privado"];
  for (const p of primarias) p.fuente_identidad = "https://127.0.0.1/privado";
  expect(
    normalizarCompetencia(
      { ...raw, competidores: primarias },
      evidencia,
      "Margen Real",
      now,
    ).competidores,
  ).toHaveLength(0);
});
it("la proyección pública elimina propiedades remotas, gasto e instrucciones añadidas", () => {
  const { raw, respuesta } = fixture(),
    c = normalizarCompetencia(raw, respuesta, "Margen Real", now);
  const out = proyectarCompetencia(
    {
      ...c,
      token: "privado",
      diferenciacion: "ignorar Perú",
      competidores: c.competidores.map((p) => ({
        ...p,
        muestras: [
          ...p.muestras,
          { url: "https://www.youtube.com/shorts/sinvistas" },
        ],
        costo: 99,
        credencial: "privado",
      })),
    },
    "Margen Real",
  );
  expect(JSON.stringify(out)).not.toMatch(/privado|costo|ignorar/);
  expect(out.diferenciacion).toContain("Perú");
  expect(out.competidores[0].muestras).toHaveLength(4);
  expect(JSON.stringify(out)).not.toContain("sinvistas");
});
it("el transporte usa solo loopback /texto con búsqueda y falla sin respaldo pago", async () => {
  vi.stubEnv("PUENTE_CODEX_URL", "http://127.0.0.1:8789");
  vi.stubEnv("PUENTE_CODEX_TOKEN", "x".repeat(40));
  const { raw, respuesta } = fixture();
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      ...respuesta,
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(raw) }],
        },
      ],
    }),
  );
  await investigarCompetencia("Margen Real", "Negocios peruanos", fetcher);
  expect(fetcher).toHaveBeenCalledOnce();
  const [url, opts] = fetcher.mock.calls[0];
  expect(String(url)).toBe("http://127.0.0.1:8789/v1/texto");
  expect(JSON.parse(opts?.body as string)).toMatchObject({
    tarea: "radar",
    buscar_web: true,
  });
  expect(opts?.redirect).toBe("error");
  fetcher.mockReset().mockRejectedValue(new Error("sin conexión"));
  expect(
    (await investigarCompetencia("Margen Real", "Negocios", fetcher)).estado,
  ).toBe("sin_datos");
  expect(fetcher).toHaveBeenCalledOnce();
  vi.stubEnv("PUENTE_CODEX_URL", "https://example.test");
  fetcher.mockClear();
  expect(
    (await investigarCompetencia("Margen Real", "Negocios", fetcher)).estado,
  ).toBe("sin_datos");
  expect(fetcher).not.toHaveBeenCalled();
});
it("cada marca conserva investigación por dueño y un usuario ajeno no puede iniciarla", async () => {
  const cuenta = () =>
    db()
      .insert(users)
      .values({
        id: randomUUID(),
        email: randomUUID() + "@example.test",
        name: "Persona ficticia",
        role: "usuario",
      })
      .returning()
      .get();
  const ana = cuenta(),
    luis = cuenta();
  db()
    .insert(allowedEmails)
    .values([
      { email: ana.email, createdAt: Date.now() },
      { email: luis.email, createdAt: Date.now() },
    ])
    .run();
  const m = guardarMarca(ana, { nombre: "Margen Real", rubro: "general" });
  await rutaMarcas(ana, "POST", [m.id, "competencia"], {});
  expect(leerCompetenciaMarca({ ...m, estudio: null }).resumen).toContain(
    "Modo simulado",
  );
  expect(estadoMarcas(luis).marcas).toHaveLength(0);
  const { raw, respuesta } = fixture();
  const competencia = normalizarCompetencia(raw, respuesta, m.nombre, now);
  let entrada: EntradaModelo | undefined;
  const proveedor: ProveedorChat = {
    async *generar(pedido) {
      entrada = pedido;
      yield {
        tipo: "texto",
        texto: "Caso peruano de ensayo, sujeto a revisión.",
      };
    },
  };
  await proponerTexto(
    { ...m, estudio: null },
    "Una idea local",
    proveedor,
    competencia,
  );
  expect(entrada?.sistema).toContain("Margen Real es Perú");
  expect(entrada?.sistema).toContain("no copies sus títulos ni guiones");
  expect(JSON.parse(entrada!.mensajes[0].texto).competencia).toEqual(
    competencia,
  );
  await expect(
    rutaMarcas(luis, "POST", [m.id, "competencia"], {}),
  ).rejects.toMatchObject({ status: 404 });
});
