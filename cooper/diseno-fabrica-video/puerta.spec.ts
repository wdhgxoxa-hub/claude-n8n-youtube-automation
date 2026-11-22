import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import type { Estado } from "../src/servicios/datos";
import type { Resultados } from "../src/contratos/resultados";
import type { VideoMedios } from "../src/contratos/video-medios";
import { abrirCooper, cerrarCooper } from "../e2e/ayudas-diseno";

// Las trazas CDP se guardan explícitamente sin screenshots que alteren FPS.
test.use({ trace: "off", video: "off" });

const out = "../evidencias-diseno";
const widths = [360, 390, 768, 1024, 1440, 1920];
const mediaDir = "diseno-fabrica-video/medios";
const titles = [
  "Lo que pagas cuando llenas el tanque",
  "Diez soles: el recorrido del impuesto",
  "De la refinería al grifo",
  "Quién decide el precio del combustible",
];

async function preparar(page: Page) {
  mkdirSync(out, { recursive: true });
  expect(
    (
      await page.request.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT}/sesion`,
        {
          data: {
            email: "admin@example.test",
            secret: process.env.COOPER_E2E_SECRET,
          },
        },
      )
    ).ok(),
  ).toBe(true);
  const state: Estado = await (await page.request.get("/api/estado")).json();
  const sources = JSON.parse(
    readFileSync(`${mediaDir}/procedencia.json`, "utf8"),
  );
  const now = Date.now();
  state.channels.forEach((c, i) => {
    c.name = i ? "Economía de bolsillo" : "Margen Real";
  });
  state.videos = state.videos
    .filter((v) => v.id.startsWith("demo-"))
    .slice(0, 4);
  expect(state.videos).toHaveLength(4);
  state.videos.forEach((v, i) => {
    const n = i + 1;
    const asset = sources.derivados[i];
    v.title = titles[i];
    v.stage = [7, 3, 9, 11][i];
    v.productionState = "activa";
    v.updatedAt = now - (i * 7 + 2) * 60000;
    v.script = `# ${v.title}\n\nApertura · 0:00–0:08\nDe tus diez soles, una parte toma un camino que no se ve en el surtidor.\n\nDesarrollo · 0:08–0:48\nSeguimos el recorrido del combustible: su origen, el transporte y los impuestos que forman el precio. Una historia de economía cotidiana, contada desde la calle.\n\nCierre · 0:48–1:00\nLa próxima vez que llenes el tanque, mira el recibo. Cada cifra cuenta una parte de la historia.`;
    v.medios = {
      version: 1,
      videoId: v.id,
      estado: "listo",
      poster: {
        url: `/__diseno/fotograma-${n}.webp`,
        origen: "render",
        ancho: 720,
        alto: 1280,
      },
      preview: {
        url: `/__diseno/vista-previa-${n}.mp4`,
        mime: "video/mp4",
        duracion: 5,
        bytes: asset.preview.bytes,
      },
      tinte: "hsl(24 28% 48%)",
      ancho: 1080,
      alto: 1920,
      relacionAspecto: 9 / 16,
      origenDimensiones: "video",
      actualizadoEn: now,
    } satisfies VideoMedios;
    v.observabilidad.miniatura = v.medios.poster!.url;
    v.observabilidad.montaje = i === 1 ? "" : v.medios.preview!.url;
    v.observabilidad.escenas = [];
    if (i < 3) v.observabilidad.publicaciones = [];
    v.observabilidad.incidencias = [];
    if (i === 3)
      v.observabilidad.publicaciones = [
        {
          id: "publicacion-demostracion",
          red: "youtube",
          url: "",
          miniatura: v.medios.poster!.url,
          fecha: new Date(now - 86400000).toISOString(),
          historial: [
            {
              fecha: new Date(now).toISOString(),
              vistas: 18420,
              meGusta: 864,
              comentarios: 72,
              retencion: 68,
            },
          ],
        },
      ];
  });
  state.channels.forEach((c) => {
    c.lecciones = [
      {
        id: "leccion-ensayo",
        fecha: new Date(now - 86400000).toISOString(),
        resumen:
          "Una cifra concreta abre la historia mejor que una explicación larga.",
        causa: "La introducción tardaba en llegar al recibo.",
        correccion: "Mostrar los diez soles en el primer plano.",
        nivel: "hipotesis",
        ganchos: ["De tus diez soles…"],
        temas: ["Economía cotidiana"],
        origenes: [
          {
            videoId: state.videos[3].id,
            red: "youtube",
            ventana: "7d",
            fecha: new Date(now).toISOString(),
            metrica: "retencion",
            valor: 68,
            demoraHoras: 168,
          },
        ],
        aplicaciones: [
          {
            videoId: state.videos[0].id,
            cambio: "Abrir con el recibo en pantalla.",
          },
        ],
      },
    ];
  });
  await page.route("**/__diseno/*", (route) => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^(fotograma-[1-4]\.webp|vista-previa-[1-4]\.mp4)$/.test(name))
      throw new Error("Activo inesperado");
    return route.fulfill({
      contentType: name.endsWith("webp") ? "image/webp" : "video/mp4",
      body: readFileSync(`${mediaDir}/${name}`),
    });
  });
  await page.route("**/api/estado", (route) => route.fulfill({ json: state }));
  // Transporte de demostración controlable; la puerta común prueba SSE real.
  await page.addInitScript((initial) => {
    const w = window as typeof window & { designState: typeof initial };
    w.designState = initial;
    class Stream extends EventTarget {
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readyState = 1;
      timer: ReturnType<typeof setInterval>;
      constructor() {
        super();
        const emit = () =>
          this.dispatchEvent(
            new MessageEvent("estado", { data: JSON.stringify(w.designState) }),
          );
        setTimeout(() => {
          this.onopen?.();
          emit();
        }, 40);
        this.timer = setInterval(emit, 1000);
      }
      close() {
        clearInterval(this.timer);
        this.readyState = 2;
      }
    }
    Object.defineProperty(window, "EventSource", { value: Stream });
  }, state);
  const published = state.videos[3];
  const results: Resultados = {
    ambitos: [
      {
        id: published.channelId,
        tipo: "video",
        nombre: "Margen Real",
        ownerId: state.user.id,
        propietario: "Equipo de demostración",
      },
    ],
    publicaciones: [
      {
        id: "resultado-demo",
        tipo: "video",
        videoId: published.id,
        ambitoId: published.channelId,
        titulo: published.title,
        href: `/videos/${published.id}`,
        fecha: new Date(now - 86400000).toISOString(),
        redes: ["youtube"],
        simulada: true,
        identidad: "publicacion-demostracion",
        publicacion: published.observabilidad.publicaciones[0],
        medios: published.medios,
      },
    ],
    aprendizajes: [],
    incidencias: [],
  };
  await page.route("**/api/resultados", (route) =>
    route.fulfill({ json: results }),
  );
  await page.route("**/api/videos/*/medios*", (route) => {
    const id = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/")[3],
    );
    return route.fulfill({
      json: state.videos.find((v) => v.id === id)?.medios,
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) errors.push(m.text());
  });
  return { state, errors };
}

async function navegar(page: Page, url: string) {
  await page.goto("/videos");
  await expect(page.locator("[data-capsula]").first()).toContainText(titles[0]);
  if (url !== "/videos") {
    const link = page
      .locator(`a[href="${url}"]`)
      .filter({ visible: true })
      .first();
    await link.click();
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await expect(page.locator("body")).toContainText(
    /Margen Real|Economía de bolsillo/,
  );
  await page.evaluate(() => document.fonts.ready);
  // Los controles nativos de Chromium muestran un arco inicial incluso con preload=none.
  // Se espera su ciclo de entrada, sin descargar ni reproducir el montaje.
  if (await page.locator(".real-player video").count())
    await page.waitForTimeout(1800);
}

async function captura(page: Page, screen: string, width: number) {
  // La navegación con el riel conserva foco/hover; la captura documenta su reposo.
  // Se preserva el foco dentro de los formularios para revisar su estado real.
  await page.mouse.move(width - 16, 16);
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".glass-rail"))
      active.blur();
  });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(
    (await page.locator(".real-player video").count()) ? 3000 : 500,
  );
  const overflow = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - innerWidth),
  );
  const small = await page
    .locator("body")
    .evaluate((root) =>
      [...root.querySelectorAll<HTMLElement>("*")]
        .filter(
          (el) =>
            el.checkVisibility() &&
            [...el.childNodes].some(
              (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
            ) &&
            parseFloat(getComputedStyle(el).fontSize) < 12,
        )
        .map((el) => el.outerHTML.slice(0, 200)),
    );
  const violations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  await page.screenshot({ path: `${out}/${screen}-${width}-viewport.png` });
  // Chromium captura la página completa de una vez: no unimos scrolls ni repetimos capas fijas.
  await page.screenshot({
    path: `${out}/${screen}-${width}.png`,
    fullPage: true,
    style:
      ".mobile-dock, .mobile-more, .cooper-orb { visibility: hidden !important; }",
  });
  expect(overflow, `${screen}: desbordamiento`).toBe(0);
  expect(small, `${screen}: texto menor de 12 px`).toEqual([]);
  expect(violations, `${screen}: axe`).toEqual([]);
  return {
    screen,
    width,
    overflow,
    small,
    violations,
    media: await page.locator("video").evaluateAll((videos) =>
      videos.map((element) => {
        const v = element as HTMLVideoElement;
        return {
          src: v.getAttribute("src"),
          paused: v.paused,
          ready: v.readyState,
          network: v.networkState,
          error: v.error?.message ?? null,
          preload: v.preload,
        };
      }),
    ),
    fixedElements:
      "captura nativa única sin cosido; capas flotantes presentes en viewport y ocultas en página completa",
  };
}

for (const width of widths)
  test(`pantallas y estados a ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { state, errors } = await preparar(page);
    const evidence = [];
    await navegar(page, "/videos");
    await expect(
      page.getByRole("heading", { name: "Línea de producción", exact: true }),
    ).toBeVisible();
    evidence.push(await captura(page, "fabrica", width));
    await page
      .getByRole("button", { name: "Pedir video", exact: true })
      .click();
    evidence.push(await captura(page, "fabrica-pedir", width));
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    for (const [i, name] of [
      "video-montaje",
      "video-guion",
      "video-aprobacion",
      "video-publicado",
    ].entries()) {
      await navegar(page, `/videos/${state.videos[i].id}`);
      await expect(
        page.getByRole("heading", { name: titles[i], exact: true }),
      ).toBeVisible();
      evidence.push(await captura(page, name, width));
    }
    for (const tab of ["Métricas", "Lecciones"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      evidence.push(
        await captura(
          page,
          `video-${tab === "Métricas" ? "metricas" : "lecciones"}`,
          width,
        ),
      );
    }
    await navegar(page, `/videos/${state.videos[2].id}`);
    await page
      .getByRole("button", { name: "Pedir cambios", exact: true })
      .click();
    evidence.push(await captura(page, "video-corregir", width));
    await page
      .getByRole("button", { name: "Cerrar formulario", exact: true })
      .click();
    await page.getByRole("button", { name: "Programar", exact: true }).click();
    evidence.push(await captura(page, "video-programar", width));
    await page
      .getByRole("button", { name: "Cerrar formulario", exact: true })
      .click();
    await navegar(page, `/videos/${state.videos[0].id}`);
    const estadoOriginal = state.videos[0].productionState;
    try {
      for (const [productionState, screen, label] of [
        ["pausada", "video-pausado", "En pausa"],
        ["cancelada", "video-cancelado", "Cancelado"],
      ] as const) {
        await page.evaluate(
          ({ id, productionState }) => {
            (
              window as typeof window & { designState: Estado }
            ).designState.videos.find(
              (video) => video.id === id,
            )!.productionState = productionState;
          },
          { id: state.videos[0].id, productionState },
        );
        await expect(
          page.getByRole("region", {
            name: `Etapas del video. Etapa actual: ${label}`,
            exact: true,
          }),
        ).toBeVisible();
        if (productionState === "cancelada") {
          for (const action of ["Aprobar", "Pedir cambios", "Programar"])
            await expect(
              page.getByRole("button", { name: action, exact: true }),
            ).toBeDisabled();
        }
        evidence.push(await captura(page, screen, width));
      }
    } finally {
      await page.evaluate(
        ({ id, productionState }) => {
          (
            window as typeof window & { designState: Estado }
          ).designState.videos.find(
            (video) => video.id === id,
          )!.productionState = productionState;
        },
        { id: state.videos[0].id, productionState: estadoOriginal },
      );
    }
    // Este guion no tiene publicaciones ni lecciones vinculadas en el fixture.
    await navegar(page, `/videos/${state.videos[1].id}`);
    for (const [tab, screen, title] of [
      [
        "Métricas",
        "video-metricas-vacias",
        "La historia sigue con tu audiencia.",
      ],
      ["Lecciones", "video-lecciones-vacias", "Todavía estamos escuchando."],
    ]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(
        page
          .getByRole("tabpanel", { name: tab, exact: true })
          .getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      evidence.push(await captura(page, screen, width));
    }
    // El vacío se prueba sobre el mismo contrato, sin crear ni borrar recursos.
    state.videos = [];
    await page
      .getByRole("link", { name: "Fábrica", exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await page.evaluate(() => {
      (window as typeof window & { designState: Estado }).designState.videos =
        [];
    });
    await expect(
      page.getByRole("heading", { name: "Tu primera idea va aquí" }),
    ).toBeVisible();
    evidence.push(await captura(page, "fabrica-vacia", width));
    writeFileSync(
      `${out}/fabrica-video-${width}.json`,
      JSON.stringify(
        {
          evidence,
          errors,
          fixture:
            "Datos de demostración locales; fotogramas de render existente, sin producción ni publicación",
        },
        null,
        2,
      ),
    );
    expect(errors).toEqual([]);
  });

for (const width of [390, 1440])
  test(`recorrido y transición compartida a ${width}`, async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT}`,
      extraHTTPHeaders: {
        Referer: `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT}`,
      },
      viewport: { width, height: 900 },
      recordVideo: {
        dir: `${out}/interacciones`,
        size: { width, height: 900 },
      },
    });
    const page = await context.newPage();
    const { state, errors } = await preparar(page);
    await page.addInitScript(() => {
      const native = document.startViewTransition.bind(document);
      const records: { old: string[]; next: string[]; ready: boolean }[] = [];
      (window as typeof window & { transitions: typeof records }).transitions =
        records;
      const names = () =>
        [...document.querySelectorAll<HTMLElement>("[style]")]
          .filter((el) => el.checkVisibility())
          .map((el) => el.style.viewTransitionName)
          .filter((n) => n.startsWith("video-"));
      document.startViewTransition = (update) => {
        const record = { old: names(), next: [] as string[], ready: false };
        records.push(record);
        const transition = native(update);
        void transition.ready
          .then(() => {
            record.next = names();
            record.ready = true;
          })
          .catch(() => {});
        return transition;
      };
    });
    await page.goto("/videos");
    await expect(page.locator("[data-capsula]").first()).toContainText(
      titles[0],
    );
    const carril = page.getByRole("region", {
      name: "Estaciones de producción; desplázate para recorrerlas",
      exact: true,
    });
    if (width >= 768) {
      const ultima = carril.getByRole("button", { name: /^12 Publicado,/ });
      await ultima.focus();
      await page.keyboard.press("Enter");
      await expect(carril.locator('[data-estacion="11"]')).toBeInViewport();
      await carril.getByRole("button", { name: /^01 Radar,/ }).press("Enter");
      await expect(carril.locator('[data-estacion="0"]')).toBeInViewport();
    }
    if (width >= 768) {
      await carril.evaluate((element) => {
        element.scrollLeft = 0;
      });
      await carril.focus();
      await expect(carril).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => carril.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
    }
    const moving = page
      .locator(`[data-capsula="${state.videos[0].id}"]`)
      .filter({ visible: true });
    await expect(moving).toHaveCount(1);
    await moving.scrollIntoViewIfNeeded();
    const avanceEn = await page.evaluate((id) => {
      const video = (
        window as typeof window & { designState: Estado }
      ).designState.videos.find((v) => v.id === id)!;
      video.stage = 8;
      video.updatedAt = Date.now();
      return video.updatedAt;
    }, state.videos[0].id);
    await expect(moving).toHaveAttribute("data-etapa", "8");
    const ultimoSuceso = page
      .getByRole("list", { name: "Últimos movimientos", exact: true })
      .getByRole("listitem")
      .first();
    await expect(ultimoSuceso).toContainText(state.videos[0].title);
    await expect(ultimoSuceso).toContainText(
      "Actualizado · Control de calidad",
    );
    await expect(ultimoSuceso.locator("time")).toHaveAttribute(
      "datetime",
      new Date(avanceEn).toISOString(),
    );
    await expect(ultimoSuceso.locator("time")).toHaveText("Hace un momento");
    await page.waitForTimeout(900);
    const target = state.videos[2];
    const link = page
      .locator(`a[href="/videos/${target.id}"]`)
      .filter({ visible: true })
      .first();
    await link.scrollIntoViewIfNeeded();
    await link.hover();
    await page.waitForTimeout(1200);
    await link.click();
    await expect(
      page.getByRole("heading", { name: target.title, exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('[aria-label="Video terminado"]').first(),
    ).toBeVisible();
    await page.waitForTimeout(900);
    const player = page.locator(".real-player video").filter({ visible: true });
    await player.focus();
    await player.press("Space");
    await expect
      .poll(() =>
        player.evaluate((element) => (element as HTMLVideoElement).currentTime),
      )
      .toBeGreaterThan(0.1);
    await player.press("Space");
    await expect(player).toHaveJSProperty("paused", true);
    await page.getByRole("tab", { name: "Guion", exact: true }).focus();
    for (const [key, name] of [
      ["ArrowRight", "Métricas"],
      ["ArrowRight", "Lecciones"],
      ["Home", "Guion"],
      ["End", "Lecciones"],
      ["ArrowLeft", "Métricas"],
      ["ArrowLeft", "Guion"],
    ]) {
      await page.keyboard.press(key);
      const tab = page.getByRole("tab", { name, exact: true });
      await expect(tab).toBeFocused();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tab", { selected: true })).toHaveCount(1);
      await expect(
        page.getByRole("tabpanel", { name, exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(400);
    }
    for (const [action, field] of [
      ["Pedir cambios", "¿Qué cambiamos?"],
      ["Programar", "Fecha y hora local"],
    ]) {
      const opener = page.getByRole("button", { name: action, exact: true });
      await opener.press("Enter");
      await expect(page.getByLabel(field, { exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(opener).toBeFocused();
      await expect(opener).toHaveAttribute("aria-expanded", "false");
    }
    await abrirCooper(page);
    await page.waitForTimeout(700);
    await cerrarCooper(page);
    await page.waitForTimeout(700);
    // Los otros dos orígenes conservan el mismo nombre de medio y el mismo detalle.
    for (const [url, index] of [
      ["/", 1],
      ["/publicados", 3],
    ] as const) {
      const navigation = width < 768 ? ".mobile-dock" : ".glass-rail";
      await page.locator(`${navigation} a[href="${url}"]`).last().click();
      await expect(page).toHaveURL(
        new RegExp(`${url === "/" ? "/$" : url + "$"}`),
      );
      await page.waitForTimeout(700);
      if (url === "/publicados")
        await page
          .getByRole("button", { name: "Actualizar resultados", exact: true })
          .click();
      const source = state.videos[index];
      const shared = page
        .locator(`a[href="/videos/${source.id}"]`)
        .filter({ has: page.locator("[data-video-transition]") })
        .filter({ visible: true })
        .first();
      await expect(
        page.getByRole("heading", { name: source.title, exact: true }).first(),
      ).toBeVisible();
      await expect(shared).toBeVisible();
      await shared.click();
      await expect(
        page.getByRole("heading", { name: source.title, exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(900);
      const records = await page.evaluate(
        () =>
          (
            window as typeof window & {
              transitions: { old: string[]; next: string[]; ready: boolean }[];
            }
          ).transitions,
      );
      expect(records.at(-1)?.ready).toBe(true);
      expect(records.at(-1)?.old).toEqual(records.at(-1)?.next);
      expect(records.at(-1)?.old).toHaveLength(1);
    }
    expect(errors).toEqual([]);
    const video = page.video();
    await context.close();
    await video?.saveAs(`${out}/interacciones-fabrica-video-${width}.webm`);
  });

test("avance de cápsula, movimiento reducido y traza móvil", async ({
  page,
  context,
  browser,
}, testInfo) => {
  const browserSession = await browser.newBrowserCDPSession();
  const system = await browserSession.send("SystemInfo.getInfo");
  const renderer = {
    devices: system.gpu.devices,
    features: system.gpu.featureStatus,
    renderer: system.gpu.auxAttributes?.glRenderer,
    browser: browser.version(),
    launch: testInfo.project.use.launchOptions?.args,
  };
  await browserSession.detach();
  await page.setViewportSize({ width: 390, height: 900 });
  const { state, errors } = await preparar(page);
  await page.goto("/videos");
  const target = state.videos[0];
  const capsule = page
    .locator(`[data-capsula="${target.id}"]`)
    .filter({ visible: true });
  await expect(capsule).toHaveCount(1);
  await expect(capsule).toContainText(target.title);
  await capsule.scrollIntoViewIfNeeded();
  await capsule.evaluate((el) => el.setAttribute("data-preservado", "si"));
  await page.waitForTimeout(1000);
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const chunks: unknown[] = [];
  session.on("Tracing.dataCollected", (event) => chunks.push(...event.value));
  await session.send("Tracing.start", {
    categories: "devtools.timeline,blink.user_timing",
    transferMode: "ReportEvents",
  });
  const measured = await page.evaluate(async (id) => {
    const w = window as typeof window & { designState: Estado };
    const frameTimeline: { at: number; delta: number; transform: string }[] =
      [];
    const shifts: unknown[] = [];
    let previous = 0,
      active = true,
      cls = 0;
    const observer = new PerformanceObserver((entries) => {
      for (const e of entries.getEntries()) {
        const shift = e as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: {
            node?: Element;
            previousRect: DOMRectReadOnly;
            currentRect: DOMRectReadOnly;
          }[];
        };
        if (!shift.hadRecentInput) {
          cls += shift.value;
          shifts.push({
            value: shift.value,
            sources: shift.sources?.map((s) => ({
              node: s.node?.outerHTML.slice(0, 300),
              previous: s.previousRect.toJSON(),
              current: s.currentRect.toJSON(),
            })),
          });
        }
      }
    });
    observer.observe({ type: "layout-shift" });
    const tick = (time: number) => {
      if (!active) return;
      const transform = getComputedStyle(
        document.querySelector(`[data-capsula="${id}"]`)!,
      ).transform;
      if (previous)
        frameTimeline.push({ at: time, delta: time - previous, transform });
      previous = time;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    w.designState.videos.find((v) => v.id === id)!.stage = 8;
    await new Promise((resolve) => setTimeout(resolve, 3500));
    active = false;
    observer.disconnect();
    // La cadencia de un video en reposo no es la fluidez de Motion.
    // Incluimos desde el primer transform hasta el frame que termina el layout;
    // conservamos también toda la muestra, sin ocultar su tramo en reposo.
    const first = frameTimeline.findIndex(
      (frame) => frame.transform !== "none",
    );
    const finish = frameTimeline.findIndex(
      (frame, index) => index > first && frame.transform === "none",
    );
    const animation =
      first >= 0 && finish > first
        ? frameTimeline.slice(first, finish + 1)
        : [];
    const frames = animation.map((frame) => frame.delta);
    const sorted = [...frames].sort((a, b) => a - b);
    return {
      fps: frames.length
        ? 1000 / (frames.reduce((s, n) => s + n, 0) / frames.length)
        : 0,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      max: Math.max(...frames),
      animationDuration: animation.length
        ? animation.at(-1)!.at - animation[0].at + animation[0].delta
        : 0,
      animationFrames: frames.length,
      sampleFps:
        1000 /
        (frameTimeline.reduce((sum, frame) => sum + frame.delta, 0) /
          frameTimeline.length),
      frameTimeline,
      cls,
      shifts,
      transforms: [...new Set(frameTimeline.map((frame) => frame.transform))],
    };
  }, target.id);
  const completed = new Promise<void>((resolve) =>
    session.once("Tracing.tracingComplete", () => resolve()),
  );
  await session.send("Tracing.end");
  await completed;
  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  writeFileSync(
    `${out}/fabrica-movimiento-traza.json`,
    JSON.stringify({ traceEvents: chunks }),
  );
  writeFileSync(
    `${out}/fabrica-movimiento.json`,
    JSON.stringify(
      {
        ...measured,
        renderer,
        instrumentation: {
          cpu: 4,
          cdpTrace: true,
          playwrightTrace: false,
          video: false,
          screenshotDuringMeasurement: false,
          frameBudget:
            "primer transform de layout hasta el primer frame final sin transform; muestra completa conservada",
        },
      },
      null,
      2,
    ),
  );
  await expect(capsule).toHaveAttribute("data-etapa", "8");
  await expect(capsule).toHaveAttribute("data-preservado", "si");
  expect(measured.transforms.some((value) => value !== "none")).toBe(true);
  expect(measured.animationDuration).toBeGreaterThanOrEqual(500);
  expect(measured.animationFrames).toBeGreaterThan(20);
  expect(measured.fps).toBeGreaterThanOrEqual(57);
  expect(measured.p95).toBeLessThanOrEqual(25);
  expect(measured.cls).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate((id) => {
    (window as typeof window & { designState: Estado }).designState.videos.find(
      (v) => v.id === id,
    )!.stage = 7;
  }, target.id);
  await expect(capsule).toHaveAttribute("data-etapa", "7");
  await expect(capsule).toHaveCSS("transform", "none");
  expect(errors).toEqual([]);
});
