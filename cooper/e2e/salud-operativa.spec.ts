import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import type { PanelSalud } from "../src/contratos/alertas-salud";

async function login(request: APIRequestContext, email = "admin@example.test") {
  const response = await request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
    { data: { email, secret: process.env.COOPER_E2E_SECRET } },
  );
  expect(response.status()).toBe(200);
}

const instante = "2026-11-21T18:00:00.000Z";
function muestra(degradada = false): PanelSalud {
  const run = {
    id: "ejecucion-ficticia",
    workflowId: "flujo-ficticio",
    workflow: "FX · Montaje de prueba",
    estado: degradada ? ("fallida" as const) : ("correcta" as const),
    inicio: "2026-11-21T17:50:00.000Z",
    fin: instante,
    causa: degradada
      ? "El montaje agotó el tiempo de espera. Revisa la incidencia antes de repetirlo."
      : null,
  };
  return {
    salud: {
      actualizado: instante,
      modo: "n8n",
      n8n: {
        estado: degradada ? "degradado" : "ok",
        actualizado: instante,
        detalle: "Muestra de prueba de las últimas 24 horas.",
        ejecuciones: [run],
        ejecucionesDisponibles: true,
        workflowsDisponibles: true,
        fallosRecientes: degradada ? [run] : [],
        workflows: [
          {
            id: "flujo-ficticio",
            nombre: "FX · Montaje de prueba",
            activo: true,
          },
          {
            id: "flujo-inactivo",
            nombre: "FX · Pausa editorial",
            activo: false,
          },
        ],
        workflowsActivos: 1,
        ejecucionesTruncadas: degradada,
        workflowsTruncados: degradada,
        ventanaDesde: "2026-11-20T18:00:00.000Z",
      },
      vps: {
        estado: degradada ? "degradado" : "ok",
        actualizado: instante,
        detalle: "Mediciones ficticias del servidor para verificar el panel.",
        antiguedadMinutos: 1,
        mantenimiento: false,
        disco: {
          totalBytes: 100 * 1024 ** 3,
          libreBytes: (degradada ? 5 : 70) * 1024 ** 3,
          librePorcentaje: degradada ? 5 : 70,
        },
        memoria: {
          totalBytes: 1024 ** 3,
          disponibleBytes: 0.4 * 1024 ** 3,
          usadaPorcentaje: 60,
        },
        certificados: [
          {
            servicio: "cooper",
            vence: "2026-12-21T18:00:00.000Z",
            diasRestantes: 30,
          },
          {
            servicio: "n8n",
            vence: "2026-12-21T18:00:00.000Z",
            diasRestantes: 30,
          },
        ],
        copias: [
          {
            tipo: "local",
            completada: "2026-11-21T17:00:00.000Z",
            antiguedadHoras: 1,
          },
          {
            tipo: "remota",
            completada: "2026-11-21T16:00:00.000Z",
            antiguedadHoras: 2,
          },
        ],
        servicios: { cooper: "ok", n8n: "ok", runner: "ok", caddy: "ok" },
      },
      fabrica: {
        estado: degradada ? "degradado" : "ok",
        actualizado: instante,
        detalle: "Producción ficticia con sus esperas identificadas.",
        videos: [
          {
            id: "video-observado",
            titulo: "El camino de una idea",
            etapa: 7,
            actualizado: "2026-11-21T15:00:00.000Z",
            sinAvanceMinutos: degradada ? 180 : 5,
            estado: degradada ? "colgado" : "en_curso",
          },
          {
            id: "video-aprobacion",
            titulo: "Una historia por aprobar",
            etapa: 3,
            actualizado: "2026-11-20T15:00:00.000Z",
            sinAvanceMinutos: 1620,
            estado: "aprobacion",
          },
        ],
        videosTruncados: degradada,
        enCurso: 1,
        colgados: degradada ? 1 : 0,
        aprobaciones: 1,
        programados: 0,
        pausados: 0,
        cancelados: 0,
        publicados: 2,
        gastoDiarioUsd: 12.5,
        gastoFuente: "n8n_estimado",
        gastoFecha: instante,
        gastoZona: "America/Lima",
      },
      alertas: degradada
        ? [
            {
              codigo: "n8n-fallo",
              fuente: "n8n",
              severidad: "aviso",
              titulo: "Un fallo de ejecución",
              detalle: "Revisa la causa del montaje antes de reintentarlo.",
            },
            {
              codigo: "vps-disco",
              fuente: "vps",
              severidad: "critica",
              titulo: "Disco con poco espacio",
              detalle: "Queda un 5 % de espacio libre.",
            },
            {
              codigo: "fabrica-colgado",
              fuente: "fabrica",
              severidad: "aviso",
              titulo: "Un video sin avance",
              detalle: "La pieza en montaje necesita revisión.",
            },
          ]
        : [],
    },
    configuracion: {
      revision: "fixture-salud",
      telegramActivo: false,
      recordatorioMinutos: 360,
      umbrales: {
        discoLibrePorcentaje: 10,
        memoriaUsadaPorcentaje: 90,
        certificadoDias: 14,
        copiaLocalHoras: 30,
        copiaRemotaHoras: 36,
        videoSinAvanceMinutos: 60,
        fallosN8n: 1,
        gastoDiarioUsd: 25,
        datosVpsMinutos: 15,
      },
    },
    telegram: {
      configurado: true,
      activo: false,
      ultimaEvaluacion: instante,
      ultimoEnvio: degradada ? instante : null,
      entrega: degradada ? "incierto" : "sin_envios",
      pendientes: degradada ? 3 : 0,
    },
  };
}

test("salud administrativa: guarda umbrales, exige revisión y conserva conflictos entre sesiones", async ({
  page,
}) => {
  await login(page.request);
  const inicial = await page.request.get("/api/admin/salud");
  expect(inicial.status()).toBe(200);
  const original = (await inicial.json()) as PanelSalud;
  expect(original.telegram.activo).toBe(false);
  expect(original.configuracion.telegramActivo).toBe(false);
  await page.goto("/admin");
  await page.getByRole("link", { name: "Abrir salud de la operación" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Salud de la operación" }),
  ).toBeVisible();
  const gasto = page.getByRole("spinbutton", {
    name: "Gasto diario de aviso (USD)",
    exact: true,
  });
  await expect(gasto).toHaveValue(
    String(original.configuracion.umbrales.gastoDiarioUsd),
  );
  await expect(
    page.getByRole("checkbox", { name: "Activar avisos por Telegram" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("region", { name: "Servidor VPS", exact: true }),
  ).toContainText("Sin datos");
  await gasto.fill("42.75");
  await page.getByRole("button", { name: "Revisar cambios" }).click();
  await expect(
    page.getByRole("button", { name: "Guardar configuración de alertas" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "He revisado los umbrales y la entrega de avisos.",
    })
    .check();
  await page
    .getByRole("button", { name: "Guardar configuración de alertas" })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Configuración de alertas guardada." }),
  ).toBeVisible();
  await page.reload();
  await expect(gasto).toHaveValue("42.75");
  await gasto.fill("55");
  const saved = (await (
    await page.request.get("/api/admin/salud")
  ).json()) as PanelSalud;
  expect(
    (
      await page.request.post("/api/admin/salud", {
        data: {
          ...saved.configuracion,
          umbrales: { ...saved.configuracion.umbrales, gastoDiarioUsd: 70 },
          confirmado: true,
        },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Revisar cambios" }).click();
  await page
    .getByRole("checkbox", {
      name: "He revisado los umbrales y la entrega de avisos.",
    })
    .check();
  const conflict = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/admin/salud") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Guardar configuración de alertas" })
    .click();
  expect((await conflict).status()).toBe(409);
  await expect(page.getByRole("alert")).toContainText("Los umbrales cambiaron");
  await expect(gasto).toHaveValue("55");
  await page
    .getByRole("button", { name: "Cargar configuración guardada" })
    .click();
  await expect(gasto).toHaveValue("70");
  // Se restablecen solo los valores que este ensayo modificó, con la revisión vigente.
  const actual = (await (
    await page.request.get("/api/admin/salud")
  ).json()) as PanelSalud;
  expect(
    (
      await page.request.post("/api/admin/salud", {
        data: {
          ...original.configuracion,
          revision: actual.configuracion.revision,
          confirmado: true,
        },
      })
    ).status(),
  ).toBe(200);
});

test("salud: un usuario normal no puede leer costes, umbrales ni el panel administrativo", async ({
  page,
  browser,
}) => {
  await login(page.request);
  expect(
    (
      await page.request.post("/api/admin/permitidos", {
        data: { email: "salud@example.test" },
      })
    ).status(),
  ).toBe(200);
  const other = await browser.newContext();
  const origin = new URL((await page.request.get("/api/admin/salud")).url())
    .origin;
  await login(other.request, "salud@example.test");
  const response = await other.request.get(`${origin}/api/admin/salud`);
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({
    error: "Esta sección es solo para el administrador.",
  });
  expect(
    (
      await other.request.post(`${origin}/api/admin/salud`, {
        headers: { origin },
        data: { confirmado: true },
      })
    ).status(),
  ).toBe(403);
  const foreign = await other.newPage();
  await foreign.goto(`${origin}/admin/salud`);
  await expect(
    foreign.getByRole("heading", { name: "Este espacio no está disponible." }),
  ).toBeVisible();
  await expect(
    foreign.getByRole("heading", { name: "Fábrica · Producción y costes" }),
  ).toHaveCount(0);
  const estado = await other.request.get(`${origin}/api/estado`);
  expect(estado.status()).toBe(200);
  const publicData = JSON.stringify(await estado.json());
  expect(publicData).not.toContain("gastoDiarioUsd");
  expect(publicData).not.toContain("telegramActivo");
  await other.close();
});

for (const degradada of [false, true]) {
  test(`salud ${degradada ? "degradada" : "operativa"}: fuentes, controles y accesibilidad en ambos temas y tamaños`, async ({
    page,
  }) => {
    await login(page.request);
    const snapshot = muestra(degradada);
    await page.route("**/api/admin/salud", (route) =>
      route.fulfill({ json: snapshot }),
    );
    await page.goto("/admin/salud");
    await expect(
      page.getByRole("region", { name: "Fábrica · Producción y costes" }),
    ).toContainText("12.50");
    await expect(
      page.getByRole("link", { name: "El camino de una idea" }),
    ).toHaveAttribute("href", "/videos/video-observado");
    await expect(
      page.getByRole("link", { name: "Resolver incidencias" }),
    ).toHaveAttribute("href", "/incidencias");
    await expect(
      page.getByRole("link", { name: "Revisar decisiones" }),
    ).toHaveAttribute("href", "/decisiones");
    await expect(
      page.getByRole("link", { name: "Ajustes de fábrica" }),
    ).toHaveAttribute("href", "/admin/fabrica");
    await page.locator("summary").filter({ hasText: "Ver workflows" }).click();
    await expect(
      page.getByText("FX · Pausa editorial", { exact: true }),
    ).toBeVisible();
    await page
      .locator("summary")
      .filter({ hasText: "Ver ejecuciones consultadas" })
      .click();
    await expect(
      page.getByText(/Ejecución ejecucion-ficticia · Inicio:/),
    ).toBeVisible();
    if (degradada) {
      await expect(
        page.getByText(
          "El montaje agotó el tiempo de espera. Revisa la incidencia antes de repetirlo.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByText("La última entrega no pudo confirmarse.", {
          exact: false,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Alertas actuales" }),
      ).toContainText("Disco con poco espacio");
    } else {
      await expect(
        page.getByRole("region", { name: "Alertas actuales" }),
      ).toContainText("No se detectaron alertas");
    }
    mkdirSync(".cache/salud-operativa-visual", { recursive: true });
    for (const theme of ["oscuro", "claro"]) {
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
        }, theme);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          window.scrollTo(0, 0);
        });
        await page.screenshot({
          path: `.cache/salud-operativa-visual/${degradada ? "degradada" : "operativa"}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    }
  });
}

test("salud: refresco periódico conserva los cambios y permite recuperar una consulta fallida", async ({
  page,
}) => {
  await login(page.request);
  await page.clock.install();
  let snapshot = muestra();
  let fallar = false;
  await page.route("**/api/admin/salud", (route) =>
    fallar
      ? route.fulfill({
          status: 503,
          json: { error: "La consulta de salud no está disponible." },
        })
      : route.fulfill({ json: snapshot }),
  );
  await page.goto("/admin/salud");
  const gasto = page.getByRole("spinbutton", {
    name: "Gasto diario de aviso (USD)",
    exact: true,
  });
  await expect(gasto).toHaveValue("25");
  await gasto.fill("39");
  snapshot = muestra(true);
  await page.clock.fastForward(60001);
  await expect(
    page.getByRole("region", { name: "Alertas actuales" }),
  ).toContainText("Disco con poco espacio");
  await expect(gasto).toHaveValue("39");
  snapshot.salud.n8n.ejecucionesDisponibles = false;
  snapshot.salud.n8n.ejecuciones = [];
  snapshot.salud.n8n.fallosRecientes = [];
  await page.getByRole("button", { name: "Actualizar salud" }).click();
  const n8n = page.getByRole("region", {
    name: "n8n · Ejecuciones y workflows",
  });
  await expect(n8n).toContainText("No es posible determinar si hubo fallos.");
  await expect(
    n8n
      .locator("dt")
      .filter({ hasText: "Fallos recientes" })
      .locator("..")
      .locator("dd"),
  ).toHaveText("Sin datos");
  await expect(
    n8n.locator("summary").filter({ hasText: "Ver workflows" }),
  ).toBeVisible();
  fallar = true;
  await page.getByRole("button", { name: "Actualizar salud" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "La consulta de salud no está disponible.",
  );
  await expect(gasto).toHaveValue("39");
  fallar = false;
  await page.getByRole("button", { name: "Actualizar salud" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(gasto).toHaveValue("39");
});
