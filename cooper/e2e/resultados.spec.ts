import { test, expect, type Page } from "@playwright/test";
import type { Estado } from "../src/servicios/datos";
import {
  agruparPublicaciones,
  type Resultados,
} from "../src/contratos/resultados";
import type { Leccion } from "../src/contratos/observabilidad";
import { readFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";

async function actualizarResultados(page: Page) {
  // El HTML inicial viene del servidor; la proyección interceptada solo entra
  // mediante la misma actualización GET que ofrece la pantalla al usuario.
  const [respuesta] = await Promise.all([
    page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/resultados" &&
        r.request().method() === "GET",
    ),
    page.getByRole("button", { name: "Actualizar resultados" }).click(),
  ]);
  expect(respuesta.ok()).toBe(true);
  await expect(
    page.getByRole("button", { name: "Actualizar resultados" }),
  ).toBeEnabled();
}

test.beforeEach(async ({ page }) => {
  expect(
    (
      await page.request.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT ?? "33173"}/sesion`,
        {
          data: {
            email: "admin@example.test",
            secret: process.env.COOPER_E2E_SECRET,
          },
        },
      )
    ).status(),
  ).toBe(200);
});
test("Aprendizaje activa y pausa la medición con persistencia y permiso administrativo", async ({
  page,
}) => {
  const anterior = await (await page.request.get("/api/admin/fabrica")).json();
  const activo = anterior.valores.allowAnalytics === true;
  await page.goto("/aprendizaje");
  const control = page.getByRole("switch", {
    name: "Medición y aprendizaje automático",
  });
  await expect(control).toBeEnabled();
  await expect(control).toBeChecked({ checked: activo });
  try {
    await control.click();
    await expect(control).toBeEnabled();
    await expect(control).toBeChecked({ checked: !activo });
    await page.reload();
    await expect(control).toBeEnabled();
    await expect(control).toBeChecked({ checked: !activo });
    const guardado = await (
      await page.request.get("/api/admin/fabrica")
    ).json();
    expect(guardado.valores.allowAnalytics).toBe(!activo);
    expect(guardado.historial[0].cambios).toContain("allowAnalytics");
    await page.route("**/api/operacion", (r) =>
      r.fulfill({
        status: 409,
        json: {
          error:
            "Los ajustes cambiaron. Actualiza y revísalos antes de confirmar.",
        },
      }),
    );
    await control.click();
    await expect(
      page
        .getByRole("region", { name: "Control del aprendizaje" })
        .getByRole("alert"),
    ).toContainText("Los ajustes cambiaron");
    await expect(control).toBeChecked({ checked: !activo });
    await page.unroute("**/api/operacion");
  } finally {
    const actual = await (await page.request.get("/api/admin/fabrica")).json();
    expect(
      (
        await page.request.post("/api/operacion", {
          data: {
            accion: "ajustes",
            revision: actual.revision,
            valores: { allowAnalytics: activo },
            confirmado: true,
          },
        })
      ).ok(),
    ).toBe(true);
  }
  const estado: Estado = await (await page.request.get("/api/estado")).json();
  estado.user.role = "usuario";
  await page.route("**/api/estado", (r) => r.fulfill({ json: estado }));
  await page.route("**/api/eventos", (r) =>
    r.fulfill({
      contentType: "text/event-stream",
      body: "event: estado\ndata: " + JSON.stringify(estado) + "\n\n",
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Lo que aprendimos", exact: true }),
  ).toBeVisible();
  await expect(control).toHaveCount(0);
});

test("Publicados presenta intervalos YouTube en segundos sin recortar repeticiones", async ({
  page,
}) => {
  const resultados: Resultados = await (
    await page.request.get("/api/resultados")
  ).json();
  const publicada = resultados.publicaciones.find((p) => p.tipo === "video")!;
  expect(publicada).toBeDefined();
  resultados.publicaciones = [
    {
      ...publicada,
      tipo: "video",
      redes: ["youtube"],
      fecha: "2026-11-01T00:00:00Z",
      publicacion: {
        id: "curva-yt",
        red: "youtube",
        url: "https://www.youtube.com/watch?v=abcdefghijk",
        fecha: "2026-11-01T00:00:00Z",
        miniatura: "",
        historial: [
          {
            fecha: "2026-11-02T00:00:00Z",
            ventana: "24h",
            vistas: 100,
            meGusta: 2,
            comentarios: 0,
            seguidoresGanados: 3,
            retencion: 0.5,
            curvaFuente: "youtube_intervalos",
            curvaRetencion: [
              { segundo: 1.2, porcentaje: 1.25 },
              { segundo: 60, porcentaje: 0.4 },
              { segundo: 120, porcentaje: 0 },
            ],
          },
        ],
      },
    },
  ];
  await page.route("**/api/resultados", (r) => r.fulfill({ json: resultados }));
  await page.goto("/publicados");
  await actualizarResultados(page);
  await page
    .getByRole("button", { name: `Ver cifras de ${publicada.titulo}` })
    .click();
  await expect(page.locator(".resultado-origen:visible")).toHaveCount(1);
  await page.getByText("Retención por intervalo", { exact: true }).click();
  const tabla = page.getByRole("table", { name: "Curva de retención" });
  await expect(tabla).toContainText("125 %");
  await expect(tabla.getByRole("row").filter({ hasText: "60" })).toContainText(
    "40 %",
  );
  await expect(
    page.getByText("Intervalos de YouTube ubicados en segundos", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: `Ver video o pieza: ${publicada.titulo}` }),
  ).toHaveAttribute("href", publicada.href);
});
test("La pared ordena por vistas, cuenta cada publicación una vez y pliega los filtros", async ({
  page,
}) => {
  const resultados: Resultados = await (
    await page.request.get("/api/resultados")
  ).json();
  const base = resultados.publicaciones.find((p) => p.tipo === "video")!;
  if (base.tipo !== "video") throw new Error("Falta publicación de ejemplo");
  const crear = (id: string, titulo: string, dia: string, vistas: number) => ({
    ...base,
    id,
    identidad: id,
    titulo,
    fecha: `2026-11-${dia}T12:00:00Z`,
    publicacion: {
      ...base.publicacion,
      id,
      fecha: `2026-11-${dia}T12:00:00Z`,
      historial: [
        {
          fecha: `2026-11-${dia}T18:00:00Z`,
          vistas,
          meGusta: 19214,
          comentarios: 0,
          retencion: null,
        },
      ],
    },
  });
  const record = crear("pared-record", "La historia que más llegó", "01", 400);
  resultados.publicaciones = [
    crear("pared-reciente", "La historia más reciente", "20", 120),
    record,
    { ...record, id: "pared-otra-lectura" },
  ];
  await page.route("**/api/resultados", (r) => r.fulfill({ json: resultados }));
  await page.goto("/publicados");
  await actualizarResultados(page);
  await expect(
    page.getByRole("button", { name: "Filtros", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.locator(".publication").first()).toContainText(
    "La historia que más llegó",
  );
  const cifras = page.getByRole("region", { name: "Cifras del periodo" });
  await expect(
    cifras
      .locator("figure")
      .filter({ hasText: "Vistas" })
      .locator(".cifra-valor .sr-only"),
  ).toHaveText("520");
  await expect(
    cifras
      .locator("figure")
      .filter({ hasText: "Publicaciones" })
      .locator(".cifra-valor .sr-only"),
  ).toHaveText("2");
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        cifras.locator("figure").evaluateAll((figuras) =>
          figuras.every((figura) => {
            const valor = figura.querySelector<HTMLElement>(".cifra-valor")!;
            return valor.scrollWidth <= figura.clientWidth;
          }),
        ),
      )
      .toBe(true);
  }
  await page
    .getByRole("button", { name: "Mejor rendimiento", exact: true })
    .click();
  await expect(page.locator(".publication").first()).toContainText(
    "La historia más reciente",
  );
  await page
    .getByRole("button", { name: "Todo el periodo", exact: true })
    .click();
  const periodo = page.getByRole("dialog", { name: "Elegir periodo" });
  await expect(periodo).toBeVisible();
  await periodo.getByLabel("Desde (Lima)").fill("2026-11-10");
  await periodo
    .getByRole("button", { name: "Ver resultados", exact: true })
    .click();
  await expect(periodo).not.toBeVisible();
  await expect(page.locator(".publication")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Ver cifras de La historia más reciente" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "La historia más reciente" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", {
      name: "Ver cifras de La historia más reciente",
    }),
  ).toBeFocused();
});
test("Publicados y Aprendizaje: filtros, gráfico, tabla y estados de corrección", async ({
  page,
}, info) => {
  // El administrador ve también los ejemplos de cuentas creadas por otras E2E.
  // Contrastar contra la API comprueba la lista completa sin depender del orden de las suites.
  const resultados: Resultados = await (
    await page.request.get("/api/resultados")
  ).json();
  const publicaciones = resultados.publicaciones.filter(
    (p) => p.tipo === "video",
  );
  const incidencias = resultados.incidencias.map((r) => r.incidencia);
  const pendientes = incidencias.filter((i) => i.estado === "pendiente");
  const corregidos = incidencias.filter((i) => i.estado === "corregido");
  expect(pendientes.length).toBeGreaterThan(0);
  expect(corregidos.length).toBeGreaterThan(0);
  await page.goto("/publicados");
  await expect(
    page.getByRole("heading", { name: "La pared", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByRole("group", { name: "Tipo de publicación" })
    .getByRole("button", { name: "Videos", exact: true })
    .click();
  // Una tarjeta puede agrupar varias fuentes; comprobar cada registro evita
  // perder métricas al agrupar y no incluye publicaciones de Marcas ajenas.
  await expect(page.locator(".publication:visible")).toHaveCount(
    agruparPublicaciones(publicaciones, resultados.ambitos).length,
  );
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    `${publicaciones.length} mediciones disponibles`,
  );
  await page.getByRole("button", { name: "instagram", exact: true }).click();
  const instagram = publicaciones.filter((p) => p.redes.includes("instagram"));
  await expect(page.locator(".publication:visible")).toHaveCount(
    agruparPublicaciones(instagram, resultados.ambitos).length,
  );
  const sinRetencion = instagram.find((p) =>
    p.publicacion.historial.every((m) => m.retencion === null),
  )!;
  expect(sinRetencion).toBeDefined();
  await page
    .locator(".publication:visible")
    .filter({ has: page.locator(`a[href="${sinRetencion.href}"]`) })
    .getByRole("button", { name: `Ver cifras de ${sinRetencion.titulo}` })
    .first()
    .click();
  const publicacion = page
    .locator(".resultado-origen:visible")
    .filter({ has: page.locator(`a[href="${sinRetencion.href}"]`) })
    .first();
  await publicacion.getByLabel("Métrica del gráfico").selectOption("retencion");
  await expect(
    publicacion.getByText("Todavía no hay mediciones de esta métrica."),
  ).toBeVisible();
  await publicacion.getByText("Ver datos de evolución").click();
  const tabla = publicacion.getByRole("table", {
    name: "Mediciones de la publicación",
  });
  await expect(tabla).toBeVisible();
  expect(
    sinRetencion.publicacion.historial.some((m) => (m.vistas ?? 0) >= 1000),
  ).toBe(true);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const region = publicacion.getByRole("region", {
      name: "Mediciones de la publicación",
    });
    await region.scrollIntoViewIfNeeded();
    // El DOM conserva los dígitos aunque CSS los parta: medir los fragmentos
    // de texto detecta el fallo visual que no descubre toContainText("2860").
    const partidas = await tabla.locator("th, td").evaluateAll((celdas) =>
      celdas.flatMap((celda) => {
        const rango = document.createRange();
        rango.selectNodeContents(celda);
        const lineas = rango.getClientRects().length;
        return lineas > 1 ? [{ texto: celda.textContent, lineas }] : [];
      }),
    );
    expect(partidas).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width === 390) {
      expect(
        await region.evaluate((el) => el.scrollWidth > el.clientWidth),
      ).toBe(true);
      await region.focus();
      await region.press("ArrowRight");
      await expect
        .poll(() => region.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(0);
      await region.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      const borde = await region.boundingBox();
      const ultima = await tabla
        .getByRole("columnheader", { name: "Retención" })
        .boundingBox();
      expect(borde).not.toBeNull();
      expect(ultima).not.toBeNull();
      expect(ultima!.x).toBeGreaterThanOrEqual(borde!.x);
      expect(ultima!.x + ultima!.width).toBeLessThanOrEqual(
        borde!.x + borde!.width + 1,
      );
      await region.evaluate((el) => {
        el.scrollLeft = 0;
      });
    }
    await info.attach(`tabla-evolucion-${width}`, {
      body: await region.screenshot(),
      contentType: "image/png",
    });
  }
  await page.goto("/aprendizaje");
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByRole("group", { name: "Tipo de publicación" })
    .getByRole("button", { name: "Videos", exact: true })
    .click();
  await page.getByRole("button", { name: "Pendientes", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Fallos y correcciones de videos" })
      .getByText("Pendiente", { exact: true }),
  ).toHaveCount(pendientes.length);
  await expect(
    page
      .getByRole("region", { name: "Fallos y correcciones de videos" })
      .getByText("Corregido", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Corregidos", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Fallos y correcciones de videos" })
      .getByText("Corregido", { exact: true }),
  ).toHaveCount(corregidos.length);
  await expect(
    page
      .getByRole("region", { name: "Fallos y correcciones de videos" })
      .getByText("Pendiente", { exact: true }),
  ).toHaveCount(0);
  for (const cambio of new Set(corregidos.map((i) => i.cambio)))
    await expect(
      page
        .getByRole("region", { name: "Fallos y correcciones de videos" })
        .getByText(cambio, { exact: true })
        .first(),
    ).toBeVisible();
});
test("el montaje real se reproduce y sustituye la maqueta; galería y embeds usan URLs exactas", async ({
  page,
}) => {
  mkdirSync(".cache/capturas-pulido", { recursive: true });
  const result = spawnSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x191d20:s=320x180:d=2",
    "-c:v",
    "libvpx",
    "-an",
    ".cache/capturas-pulido/video-ensayo.webm",
  ]);
  expect(result.status).toBe(0);
  expect(
    spawnSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      ".cache/capturas-pulido/voz-ensayo.wav",
    ]).status,
  ).toBe(0);
  const state = await (await page.request.get("/api/estado")).json();
  const video = state.videos[0];
  video.observabilidad = {
    montaje: "https://media.example.test/ensayo.webm",
    miniatura: "https://media.example.test/ensayo.png",
    escenas: [
      {
        id: "p1",
        orden: 0,
        imagen: "https://media.example.test/ensayo.png",
        clip: "https://media.example.test/ensayo.webm",
        voz: "https://media.example.test/ensayo.wav",
      },
    ],
    publicaciones: [
      {
        id: "p1",
        red: "youtube",
        url: "https://www.youtube.com/watch?v=abcdefghijk",
        fecha: null,
        miniatura: "",
        historial: [],
      },
      {
        id: "p2",
        red: "tiktok",
        url: "https://www.tiktok.com/@ensayo/video/123456789",
        fecha: null,
        miniatura: "",
        historial: [],
      },
    ],
    incidencias: [],
  };
  let solicitudesVideo = 0;
  await page.route("https://media.example.test/**", (r) => {
    const url = r.request().url();
    if (url.endsWith(".webm")) solicitudesVideo++;
    return r.fulfill(
      url.endsWith(".png")
        ? {
            contentType: "image/png",
            body: Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=",
              "base64",
            ),
          }
        : {
            contentType: url.endsWith(".wav") ? "audio/wav" : "video/webm",
            body: readFileSync(
              url.endsWith(".wav")
                ? ".cache/capturas-pulido/voz-ensayo.wav"
                : ".cache/capturas-pulido/video-ensayo.webm",
            ),
          },
    );
  });
  await page.route(/https:\/\/www\.(youtube|tiktok)\.com\/.*/, (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<p>Reproductor externo de ensayo</p>",
    }),
  );
  await page.route("**/api/estado", (r) => r.fulfill({ json: state }));
  await page.route("**/api/eventos", (r) =>
    r.fulfill({
      contentType: "text/event-stream",
      body: `event: estado\ndata: ${JSON.stringify(state)}\n\n`,
    }),
  );
  await page.goto(`/videos/${video.id}`);
  // La sincronización del contexto vuelve a consultar estado al abrir el SSE.
  await expect(
    page.getByRole("region", { name: "Video terminado", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Vista previa simulada" }),
  ).toHaveCount(0);
  const player = page.locator(".real-player video");
  await expect(player).toHaveAttribute("preload", "none");
  await expect(player).toHaveAttribute(
    "poster",
    "https://media.example.test/ensayo.png",
  );
  expect(solicitudesVideo).toBe(0);
  await player.evaluate(async (el) => {
    const v = el as HTMLVideoElement;
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() => player.evaluate((el) => (el as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.1);
  expect(solicitudesVideo).toBeGreaterThan(0);
  await expect(page.getByLabel("Clip de la escena 1")).toHaveAttribute(
    "poster",
    "https://media.example.test/ensayo.png",
  );
  await expect(
    page.getByRole("region", { name: "Piezas por escena" }),
  ).toBeVisible();
  await expect(page.locator("iframe").first()).toHaveAttribute(
    "src",
    "https://www.youtube.com/embed/abcdefghijk",
  );
  await expect(page.locator("iframe").nth(1)).toHaveAttribute(
    "src",
    "https://www.tiktok.com/player/v1/123456789?autoplay=0",
  );
  await expect(page.getByAltText("Imagen de la escena 1")).toBeVisible();
  const gallery = page.getByRole("region", { name: "Piezas por escena" });
  const bounds = await gallery.boundingBox();
  const picture = await page
    .getByAltText("Imagen de la escena 1")
    .boundingBox();
  expect(bounds).not.toBeNull();
  expect(picture).not.toBeNull();
  expect(picture!.y).toBeGreaterThan(bounds!.y);
  expect(picture!.y + picture!.height).toBeLessThanOrEqual(
    bounds!.y + bounds!.height,
  );
  const voz = page.getByLabel("Voz de la escena 1");
  await voz.evaluate(async (el) => {
    const a = el as HTMLAudioElement;
    a.muted = true;
    await a.play();
  });
  await expect
    .poll(() => voz.evaluate((el) => (el as HTMLAudioElement).currentTime))
    .toBeGreaterThan(0.1);
  await page.screenshot({
    path: ".cache/capturas-pulido/medios-reales-ensayo.png",
    fullPage: true,
  });
});

test("Aprendizaje conserva origen, hipótesis y aplicación sin afirmar una mejora", async ({
  page,
}) => {
  const state: Estado = await (await page.request.get("/api/estado")).json();
  const video = state.videos[0];
  const channel = state.channels.find((c) => c.id === video.channelId)!;
  const leccion: Leccion = {
    id: "leccion-evidencia",
    fecha: "2026-11-21T00:00:00Z",
    resumen: "Abrir con la cifra peruana",
    ganchos: [],
    temas: [],
    nivel: "hipotesis",
    causa: "La explicación aparece después del primer plano.",
    correccion: "Mover la cifra a la apertura.",
    origenes: [
      {
        videoId: video.id,
        red: "youtube",
        ventana: "72h",
        fecha: "2026-11-21T00:00:00Z",
        metrica: "retencion",
        valor: 0.4,
        segundo: 3,
        demoraHoras: 2,
      },
    ],
    aplicaciones: [
      { videoId: video.id, cambio: "La cifra abre el primer plano." },
    ],
  };
  const resultados: Resultados = await (
    await page.request.get("/api/resultados")
  ).json();
  const ambito = resultados.ambitos.find(
    (a) => a.id === `video:${channel.id}`,
  )!;
  expect(ambito).toBeDefined();
  resultados.aprendizajes = [
    {
      id: `${ambito.id}:id:${leccion.id}`,
      tipo: "video",
      ambitoId: ambito.id,
      titulo: leccion.resumen,
      href: `/canales/${channel.id}`,
      fecha: leccion.fecha,
      redes: ["youtube"],
      simulada: true,
      leccion,
    },
  ];
  resultados.incidencias = [];
  await page.route("**/api/resultados", (r) => r.fulfill({ json: resultados }));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/aprendizaje");
    await actualizarResultados(page);
    const lesson = page
      .locator(".lesson:visible")
      .filter({ hasText: "Abrir con la cifra peruana" });
    await expect(
      lesson.getByText("Posible causa:", { exact: false }),
    ).toBeVisible();
    await expect(
      lesson.getByText("Cambio aplicado", { exact: false }),
    ).toBeVisible();
    await lesson
      .getByText("Ver las mediciones y el contexto", { exact: true })
      .click();
    await expect(lesson.getByLabel("Evidencia de la lección")).toContainText(
      "Retención: 40 % en el segundo 3 (captura 2 h después del hito)",
    );
    await expect(
      lesson.getByText(
        "Aplicada en guiones; el efecto aún necesita nuevas métricas.",
      ),
    ).toBeVisible();
    await expect(
      lesson
        .getByLabel("Evidencia de la lección")
        .getByRole("link", { name: video.title, exact: true }),
    ).toHaveAttribute("href", "/videos/" + video.id);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: ".cache/capturas-aprendizaje/evidencia-" + width + ".png",
      fullPage: true,
    });
  }
});
