import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import type { Estado } from "../src/servicios/datos";
import type { VideoMedios } from "../src/contratos/video-medios";
import { abrirCooper, cerrarCooper, abrirMasDestinos } from "./ayudas-diseno";

const directory = resolve("../evidencias-diseno");
const widths = [360, 390, 768, 1024, 1440, 1920];
type Scenario = "demostracion" | "vacio" | "sin-terminados" | "sin-medios";
type Asset = {
  id: string;
  title: string;
  duration: number;
  poster: string;
  preview: string;
  width: number;
  height: number;
  tint: string;
};

// Los recursos pertenecen al proyecto y conservan su procedencia en el manifest.
// Ausencia = fallo, nunca sustitución por SVG, imagen sintética o descarga remota.
function mediaAssets(): Asset[] {
  const manifest = JSON.parse(
    readFileSync(resolve(directory, "medios-inicio/manifest.json"), "utf8"),
  ) as { assets: Asset[] };
  expect(manifest.assets.length).toBeGreaterThanOrEqual(5);
  for (const asset of manifest.assets) {
    expect(asset.poster).toMatch(/^[a-z0-9_-]+\.(webp|jpg|png)$/i);
    expect(asset.preview).toMatch(/^[a-z0-9_-]+\.mp4$/i);
    expect(
      readFileSync(resolve(directory, "medios-inicio", asset.poster))
        .byteLength,
    ).toBeGreaterThan(1000);
    expect(
      readFileSync(resolve(directory, "medios-inicio", asset.preview))
        .byteLength,
    ).toBeGreaterThan(1000);
  }
  const order = ["03-caja", "05-grifo", "01-cuenta", "02-galon", "04-gastos"];
  return order.map((id) => manifest.assets.find((asset) => asset.id === id)!);
}

async function prepare(page: Page, scenario: Scenario = "demostracion") {
  const response = await page.request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_FIXTURE_PORT ?? "33173"}/sesion`,
    {
      data: {
        email: "admin@example.test",
        secret: process.env.COOPER_E2E_SECRET,
      },
    },
  );
  expect(response.ok()).toBe(true);
  const state: Estado = await (await page.request.get("/api/estado")).json();
  const source = state.videos.find((video) => video.stage === 11)!;
  expect(
    source,
    "La semilla existente aporta un publicado con ID real",
  ).toBeDefined();
  const assets = mediaAssets();
  const now = Date.now() - 60_000;
  const medium = (id: string, index: number): VideoMedios => {
    const asset = assets[index % assets.length];
    return {
      version: 1,
      videoId: id,
      estado: scenario === "sin-medios" ? "sin_medio" : "listo",
      poster:
        scenario === "sin-medios"
          ? null
          : {
              url: `/__inicio-medios/${asset.poster}`,
              origen: "render",
              ancho: asset.width,
              alto: asset.height,
            },
      preview:
        scenario === "sin-medios"
          ? null
          : {
              url: `/__inicio-medios/${asset.preview}`,
              mime: "video/mp4",
              duracion: asset.duration,
              bytes: readFileSync(
                resolve(directory, "medios-inicio", asset.preview),
              ).byteLength,
            },
      tinte: asset.tint,
      ancho: asset.width,
      alto: asset.height,
      relacionAspecto: asset.width / asset.height,
      origenDimensiones: "video",
      actualizadoEn: now,
    };
  };
  state.channels = state.channels.map((channel) => ({
    ...channel,
    name:
      channel.id === source.channelId ? "Margen Real" : "Economía de la calle",
  }));
  const titles = assets.map((asset) => asset.title);
  const finished = titles.map((title, index) => {
    const id = index === 0 ? source.id : `inicio-ensayo-${index}`;
    const media = medium(id, index);
    return {
      ...structuredClone(source),
      id,
      title,
      stage: 11,
      createdAt: now - index * 86400000,
      updatedAt: now - index * 86400000,
      medios: media,
      observabilidad: {
        ...source.observabilidad,
        montaje: media.preview?.url ?? "",
        miniatura: media.poster?.url ?? "",
        publicaciones: source.observabilidad.publicaciones.map(
          (publication, network) => ({
            ...publication,
            id: `${id}-${network}`,
            fecha: new Date(
              now - (index === 0 ? 0 : 15 + index) * 86400000,
            ).toISOString(),
            miniatura: media.poster?.url ?? "",
            historial: Array.from({ length: 15 }, (_, step) => ({
              fecha: new Date(now - (14 - step) * 86400000).toISOString(),
              vistas: (step + 1) * (2840 - index * 240) + network * 320,
              meGusta: (step + 1) * (122 - index * 12),
              comentarios: (step + 1) * (16 - index),
              retencion: 0.72 - index * 0.04,
              seguidoresGanados: (step + 1) * (38 - index * 4),
            })).filter(
              (sample) =>
                Date.parse(sample.fecha) >=
                now - (index === 0 ? 0 : 15 + index) * 86400000,
            ),
          }),
        ),
      },
    };
  });
  const inProgress = state.videos
    .filter((video) => video.stage < 11)
    .map((video, index) => {
      const media = medium(video.id, index + 1);
      return {
        ...video,
        title: assets[(index + 1) % assets.length].title,
        updatedAt: now - 30 * 86400000,
        medios: media,
        observabilidad: {
          ...video.observabilidad,
          montaje: video.stage >= 9 ? (media.preview?.url ?? "") : "",
          miniatura: media.poster?.url ?? "",
        },
      };
    });
  state.videos =
    scenario === "vacio"
      ? []
      : scenario === "sin-terminados"
        ? inProgress
            .filter((video) => video.stage < 9)
            .map((video) => ({
              ...video,
              observabilidad: { ...video.observabilidad, montaje: "" },
            }))
        : [...finished, ...inProgress];
  if (scenario === "vacio") state.channels = [];
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      errors.push(`${message.type()}: ${message.text()}`);
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["localhost", "127.0.0.1"].includes(url.hostname))
      return route.continue();
    external.push(url.origin);
    return route.abort("blockedbyclient");
  });
  await page.route("**/__inicio-medios/*", (route) => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    expect(
      assets.some((asset) => asset.poster === name || asset.preview === name),
    ).toBe(true);
    return route.fulfill({
      body: readFileSync(resolve(directory, "medios-inicio", name)),
      contentType: name.endsWith(".mp4")
        ? "video/mp4"
        : name.endsWith(".webp")
          ? "image/webp"
          : name.endsWith(".png")
            ? "image/png"
            : "image/jpeg",
    });
  });
  await page.route("**/api/estado", (route) => route.fulfill({ json: state }));
  await page.route("**/api/eventos", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `event: estado\ndata: ${JSON.stringify(state)}\n\n`,
    }),
  );
  await page.route("**/api/videos/*/medios", (route) => {
    const id = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/")[3],
    );
    const video = state.videos.find((item) => item.id === id);
    return video ? route.fulfill({ json: video.medios }) : route.continue();
  });
  await page.route("**/api/videos/*/tinte", (route) => {
    const id = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/")[3],
    );
    return route.fulfill({
      json: {
        color:
          state.videos.find((video) => video.id === id)?.medios.tinte ??
          assets[0].tint,
      },
    });
  });
  return { state, source, finished, errors, external };
}

async function ready(page: Page, scenario: Scenario = "demostracion") {
  await expect(page.locator("main .inicio-estudio")).toHaveCount(1);
  await expect(page.locator("main .inicio-estudio")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Hoy en el estudio/, level: 1 }),
  ).toBeVisible();
  if (scenario === "demostracion" || scenario === "sin-medios") {
    await expect(page.locator("main .inicio-hero")).toContainText(
      "La caja al final del día",
    );
    await expect(page.locator("main .inicio-selector")).toHaveCount(5);
  }
  if (scenario === "vacio")
    await expect(page.locator("main .inicio-selector")).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((img) => img.complete)
        .map((img) => img.decode().catch(() => {})),
    );
    window.scrollTo(0, 0);
  });
}

async function audit(page: Page) {
  const geometry = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const colors = [
      "--lienzo",
      "--sup-1",
      "--sup-2",
      "--sup-3",
      "--linea",
      "--linea-fuerte",
      "--texto",
      "--texto-2",
      "--texto-3",
      "--tally",
      "--tally-suave",
      "--sobre-tally",
      "--sube",
      "--baja",
      "--aviso",
      "--info",
      "--transparente",
      "--velo",
      "--vidrio-fondo",
    ];
    const probe = document.createElement("span");
    document.body.append(probe);
    const resolveColor = (value: string) => {
      probe.style.color = value;
      return getComputedStyle(probe).color;
    };
    const palette = new Set(
      colors.map((token) => resolveColor(root.getPropertyValue(token))),
    );
    const radii = new Set([
      "0px",
      ...[
        "--radio-control",
        "--radio-tarjeta",
        "--radio-panel",
        "--radio-pildora",
      ].map((token) => root.getPropertyValue(token).trim()),
    ]);
    const deviations: { element: string; property: string; value: string }[] =
      [];
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
      if (
        element === probe ||
        !(element instanceof HTMLElement) ||
        !element.checkVisibility()
      )
        continue;
      const style = getComputedStyle(element);
      const label = `${element.tagName.toLowerCase()}.${Array.from(element.classList).join(".")}`;
      const add = (property: string, value: string) =>
        deviations.push({ element: label, property, value });
      if (
        Array.from(element.childNodes).some(
          (node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        ) &&
        parseFloat(style.fontSize) < 12
      )
        add("font-size", style.fontSize);
      for (const property of [
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomLeftRadius",
        "borderBottomRightRadius",
      ] as const) {
        if (!radii.has(style[property])) add(property, style[property]);
      }
      const localColors = new Set([
        resolveColor(style.getPropertyValue("--tinte")),
        resolveColor(style.getPropertyValue("--tinte-marca")),
      ]);
      for (const property of ["color", "backgroundColor"] as const) {
        if (!palette.has(style[property]) && !localColors.has(style[property]))
          add(property, style[property]);
      }
    }
    probe.remove();
    return {
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      figuresOverflow: Array.from(
        document.querySelectorAll<HTMLElement>(
          "main .inicio-metricas .cifra-valor",
        ),
      )
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => ({
          text: element.textContent,
          width: element.clientWidth,
          content: element.scrollWidth,
        })),
      deviations: Array.from(
        new Map(
          deviations.map((item) => [JSON.stringify(item), item]),
        ).values(),
      ),
    };
  });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return {
    ...geometry,
    serious: axe.violations.filter(
      (item) => item.impact === "serious" || item.impact === "critical",
    ),
  };
}

async function capture(
  page: Page,
  name: string,
  width: number,
  errors: string[],
) {
  await page.evaluate(async () => {
    for (
      let y = 0;
      y < document.documentElement.scrollHeight;
      y += innerHeight * 0.7
    ) {
      window.scrollTo(0, y);
      await new Promise<void>((accept) =>
        requestAnimationFrame(() => requestAnimationFrame(() => accept())),
      );
    }
    window.scrollTo(0, 0);
  });
  await expect
    .poll(() =>
      page.locator("main .inicio-estudio img").evaluateAll(
        (images) =>
          images.filter((element) => {
            const image = element as HTMLImageElement,
              box = image.getBoundingClientRect();
            return (
              box.width > 0 &&
              box.left < innerWidth &&
              box.right > 0 &&
              !image.complete
            );
          }).length,
      ),
    )
    .toBe(0);
  const inspected = await audit(page);
  await page.screenshot({ path: `${directory}/${name}-${width}-viewport.png` });
  // Un solo fullPage nativo. Congela cada capa fija en su posición del primer
  // viewport, sin ocultarla y sin pegar capturas que dupliquen barra/orbe/riel.
  const fixed = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("body *")).flatMap(
      (element, index) => {
        if (
          !(element instanceof HTMLElement) ||
          !element.checkVisibility() ||
          getComputedStyle(element).position !== "fixed"
        )
          return [];
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          if (getComputedStyle(parent).position === "fixed") return [];
        }
        const box = element.getBoundingClientRect();
        element.setAttribute("data-captura-fija", String(index));
        return [
          {
            index,
            className: element.className,
            top: box.top + scrollY,
            left: box.left,
            width: box.width,
            height: box.height,
          },
        ];
      },
    ),
  );
  try {
    await page.screenshot({
      path: `${directory}/${name}-${width}.png`,
      fullPage: true,
      style: fixed
        .map(
          (box) =>
            `[data-captura-fija="${box.index}"]{position:absolute!important;inset:auto!important;top:${box.top}px!important;left:${box.left}px!important;width:${box.width}px!important;height:${box.height}px!important;}`,
        )
        .join("\n"),
    });
  } finally {
    await page
      .locator("[data-captura-fija]")
      .evaluateAll((elements) =>
        elements.forEach((element) =>
          element.removeAttribute("data-captura-fija"),
        ),
      );
  }
  writeFileSync(
    `${directory}/${name}-${width}.json`,
    JSON.stringify(
      {
        name,
        width,
        ...inspected,
        errors,
        fullPageMethod:
          "captura nativa única; capas fijas ancladas al primer viewport",
        fixed,
      },
      null,
      2,
    ) + "\n",
  );
  expect.soft(inspected.overflow, `${name} ${width}: desbordamiento`).toBe(0);
  expect
    .soft(inspected.figuresOverflow, `${name} ${width}: cifras sin solaparse`)
    .toEqual([]);
  expect
    .soft(inspected.deviations, `${name} ${width}: tokens y mínimo 12px`)
    .toEqual([]);
  expect.soft(inspected.serious, `${name} ${width}: axe`).toEqual([]);
  expect.soft(errors, `${name} ${width}: consola`).toEqual([]);
}

test.beforeEach(() => mkdirSync(directory, { recursive: true }));

for (const width of widths) {
  test(`Inicio: cuatro estados, composición y armazón a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const scenario of [
      "demostracion",
      "vacio",
      "sin-terminados",
      "sin-medios",
    ] as const) {
      await page.unrouteAll({ behavior: "wait" });
      const fixture = await prepare(page, scenario);
      await page.goto("/");
      await ready(page, scenario);
      if (scenario === "demostracion") {
        for (const heading of ["Te toca a ti", "En producción", "Cómo vamos"])
          await expect(
            page.getByRole("heading", { name: new RegExp(`^${heading}`) }),
          ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "La fábrica", exact: true }),
        ).toHaveCount(0);
        await expect(page.locator("main .inicio-hero .cifra")).toHaveCount(3);
        await expect(
          page.locator("main .inicio-metricas .cifra-heroe"),
        ).toHaveCount(4);
        await expect(page.locator("main .inicio-hero img")).toBeVisible();
        expect(
          await page
            .locator("main .inicio-hero img")
            .evaluate((img) => (img as HTMLImageElement).naturalWidth),
        ).toBeGreaterThan(100);
        await expect(page.locator("main .inicio-hero .medio")).toHaveAttribute(
          "data-preview",
          "off",
        );
        await expect(
          page.locator("main .inicio-hero .inicio-medio"),
        ).toHaveAttribute(
          "data-video-transition",
          `video-${fixture.source.id}`,
        );
        await expect(
          page.getByRole("textbox", { name: "Mensaje para Cooper" }),
        ).toHaveCount(0);
        await expect(page.locator(".pildora-conexion")).toHaveCount(0);
        if (width === 768) {
          // El orbe no debe interceptar las flechas del carrusel en tableta.
          await page
            .getByRole("button", { name: "Video siguiente", exact: true })
            .click();
          await expect(
            page.locator("main .inicio-selector").nth(1),
          ).toHaveAttribute("aria-pressed", "true");
          await page
            .getByRole("button", { name: "Video anterior", exact: true })
            .click();
        }
        const first = page.locator("main .inicio-selector").first();
        await first.focus();
        await page.keyboard.press("ArrowRight");
        await expect(
          page.locator("main .inicio-selector").nth(1),
        ).toBeFocused();
        await expect(
          page.locator("main .inicio-selector").nth(1),
        ).toHaveAttribute("aria-pressed", "true");
        await page.keyboard.press("End");
        await expect(
          page.locator("main .inicio-selector").last(),
        ).toBeFocused();
        await page.keyboard.press("Home");
        await expect(first).toBeFocused();
        await expect(first).toHaveAttribute("aria-pressed", "true");
      }
      await capture(
        page,
        `inicio${scenario === "demostracion" ? "" : `-${scenario}`}`,
        width,
        fixture.errors,
      );
      expect(fixture.external).toEqual([]);
    }
  });
}

type Sample = {
  intervals: number[];
  frameTimeline: { at: number; delta: number }[];
  startedAt: number;
  previous: number;
  active: boolean;
  longTasks: number[];
  cls: number;
  observer: PerformanceObserver;
};
type TransitionObservation = {
  names: string[];
  startedAt: number;
  readyAt: number | null;
  finishedAt: number | null;
  error: string | null;
};

async function startSample(page: Page) {
  await page.evaluate(() => {
    const sample: Sample = {
      intervals: [],
      frameTimeline: [],
      startedAt: performance.now(),
      previous: 0,
      active: true,
      longTasks: [],
      cls: 0,
      observer: new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          if (entry.entryType === "longtask")
            sample.longTasks.push(entry.duration);
          else {
            const shift = entry as PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
            };
            if (!shift.hadRecentInput) sample.cls += shift.value;
          }
        }
      }),
    };
    sample.observer.observe({ entryTypes: ["longtask", "layout-shift"] });
    (window as Window & { inicioSample?: Sample }).inicioSample = sample;
    const frame = (time: number) => {
      if (!sample.active) return;
      if (sample.previous) {
        sample.intervals.push(time - sample.previous);
        sample.frameTimeline.push({ at: time, delta: time - sample.previous });
      }
      sample.previous = time;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

async function stopSample(page: Page, phase: string) {
  return page.evaluate((name) => {
    const sample = (window as Window & { inicioSample?: Sample }).inicioSample!;
    sample.active = false;
    sample.observer.disconnect();
    const sorted = [...sample.intervals].sort((a, b) => a - b);
    const transitions = (
      (window as Window & { inicioTransitions?: TransitionObservation[] })
        .inicioTransitions ?? []
    ).filter((transition) => transition.startedAt >= sample.startedAt);
    const animations = transitions.map((transition) => {
      // La API detiene el render durante las capturas. Se conserva esa latencia;
      // el presupuesto de la animación mide ready → finished, como diseno-base.
      const frames = sample.frameTimeline
        .filter(
          ({ at, delta }) =>
            transition.readyAt !== null &&
            transition.finishedAt !== null &&
            at - delta >= transition.readyAt &&
            at <= transition.finishedAt,
        )
        .map(({ delta }) => delta);
      const ordered = [...frames].sort((a, b) => a - b);
      return {
        frames: frames.length,
        fps: frames.length
          ? 1000 / (frames.reduce((a, b) => a + b, 0) / frames.length)
          : 0,
        p95: ordered[Math.floor(ordered.length * 0.95)] ?? Infinity,
        latencyUntilReady:
          transition.readyAt === null
            ? null
            : transition.readyAt - transition.startedAt,
        transition,
      };
    });
    return {
      phase: name,
      frames: sorted.length,
      fps: 1000 / (sample.intervals.reduce((a, b) => a + b, 0) / sorted.length),
      p95: sorted[Math.floor(sorted.length * 0.95)],
      maxFrame: sorted.at(-1),
      longTasks: sample.longTasks,
      cls: sample.cls,
      animations,
      frameTimeline: sample.frameTimeline,
    };
  }, phase);
}

for (const width of [390, 1440]) {
  for (const recording of [false, true]) {
    test.describe(`${recording ? "Vídeo" : "Traza"} Inicio ${width}`, () => {
      test("vista previa, carrusel, cifras, detalle, Cooper y navegación", async ({
        browser,
      }, testInfo) => {
        const baseURL = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT ?? "3109"}`;
        const context = await browser.newContext({
          baseURL,
          extraHTTPHeaders: { Referer: baseURL },
          viewport: { width, height: 900 },
          isMobile: width < 768,
          hasTouch: width < 768,
          timezoneId: "America/Lima",
          recordVideo: recording
            ? {
                dir: `${directory}/inicio-videos`,
                size: { width, height: 900 },
              }
            : undefined,
        });
        context.setDefaultTimeout(15000);
        const page = await context.newPage();
        const fixture = await prepare(page);
        await page.emulateMedia({ reducedMotion: "no-preference" });
        const browserCdp = await browser.newBrowserCDPSession();
        const systemInfo = await browserCdp.send("SystemInfo.getInfo");
        const renderer = {
          devices: systemInfo.gpu.devices,
          features: systemInfo.gpu.featureStatus,
          renderer: systemInfo.gpu.auxAttributes?.glRenderer,
          vendor: systemInfo.gpu.auxAttributes?.glVendor,
          browserVersion: browser.version(),
          driver: systemInfo.gpu.auxAttributes?.displayType,
          hardwareAccelerated:
            systemInfo.gpu.featureStatus?.gpu_compositing === "enabled" &&
            systemInfo.gpu.devices.some(
              (device) =>
                (device.vendorId > 0 && device.vendorId !== 65535) ||
                /Intel|NVIDIA|AMD|Radeon/i.test(
                  `${device.vendorString} ${device.deviceString}`,
                ),
            ) &&
            !/SwiftShader|llvmpipe|lavapipe|software/i.test(
              String(systemInfo.gpu.auxAttributes?.glRenderer ?? ""),
            ),
          launchOptions: testInfo.project.use.launchOptions?.args,
        };
        await browserCdp.detach();
        const cdp = await context.newCDPSession(page);
        const samples: Awaited<ReturnType<typeof stopSample>>[] = [];
        const phase = async (name: string, action: () => Promise<void>) => {
          if (!recording) await startSample(page);
          await action();
          await page.waitForTimeout(900);
          if (!recording) samples.push(await stopSample(page, name));
        };
        await page.goto("/");
        await ready(page);
        await cdp.send("Emulation.setCPUThrottlingRate", {
          rate: width < 768 && !recording ? 4 : 1,
        });
        if (!recording)
          await cdp.send("Tracing.start", {
            categories:
              "devtools.timeline,loading,blink.user_timing,disabled-by-default-devtools.timeline.frame,cc,viz,gpu",
            transferMode: "ReturnAsStream",
          });
        const hero = page.locator("main .inicio-hero .medio").first();
        await phase("vista-previa", async () => {
          await hero.scrollIntoViewIfNeeded();
          if (width >= 768) await hero.hover();
          await expect(hero).toHaveAttribute("data-preview", "on");
          await expect
            .poll(() =>
              hero
                .locator("video")
                .evaluate((video) => (video as HTMLVideoElement).currentTime),
            )
            .toBeGreaterThan(0.1);
          await expect(hero.locator("video")).toHaveJSProperty("muted", true);
        });
        await phase("seleccion-carrusel", async () => {
          await page
            .getByRole("button", { name: "Video siguiente", exact: true })
            .click();
          await expect(
            page.locator("main .inicio-selector").nth(1),
          ).toHaveAttribute("aria-pressed", "true");
          await expect(page.locator("main .inicio-hero")).toContainText(
            fixture.finished[1].title,
          );
        });
        const track = page.locator("main .inicio-carrusel-pista");
        const carouselWindow = page.locator("main .inicio-carrusel-ventana");
        await carouselWindow.scrollIntoViewIfNeeded();
        const box = (await carouselWindow.boundingBox())!;
        const before = await track.evaluate(
          (element) => getComputedStyle(element).transform,
        );
        await phase("arrastre-inercia", async () => {
          await page.mouse.move(
            box.x + box.width * 0.8,
            box.y + box.height * 0.5,
          );
          await page.mouse.down();
          await page.mouse.move(
            box.x + box.width * 0.2,
            box.y + box.height * 0.5,
            { steps: 10 },
          );
          await page.mouse.up();
        });
        const after = await track.evaluate(
          (element) => getComputedStyle(element).transform,
        );
        if (
          await track.evaluate(
            (element) =>
              element.scrollWidth > element.parentElement!.clientWidth,
          )
        )
          expect(after).not.toBe(before);
        await phase("cifras-y-minigraficas", async () => {
          await page.locator("main .inicio-metricas").scrollIntoViewIfNeeded();
          await expect(
            page.locator("main .inicio-metricas .cifra-heroe"),
          ).toHaveCount(4);
          await expect(
            page.locator("main .inicio-metricas .cifra-grafica"),
          ).toHaveCount(4);
        });
        const counter = page
          .locator("main .inicio-metricas .cifra-heroe")
          .first();
        const beforeCounter = await counter.boundingBox();
        const numericValue = fixture.finished.reduce((total, video, index) => {
          const history = video.observabilidad.publicaciones.find(
            (publication) => publication.red === "youtube",
          )!.historial;
          return (
            total +
            (history.at(-1)!.vistas ?? 0) -
            (index === 0 ? 0 : (history[7].vistas ?? 0))
          );
        }, 0);
        expect(numericValue).toBeGreaterThan(0);
        const compact = (value: number) =>
          new Intl.NumberFormat("es-PE", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(value);
        await expect(counter.locator(".cifra-valor .sr-only")).toHaveText(
          compact(numericValue),
        );
        const liveHistory =
          fixture.finished[0].observabilidad.publicaciones.find(
            (publication) => publication.red === "youtube",
          )!.historial;
        const measurement = liveHistory.at(-1)!;
        // Una muestra posterior a la carga SSR debe entrar por el evento en vivo.
        liveHistory.push({
          ...measurement,
          en: new Date().toISOString(),
          vistas: (measurement.vistas ?? 0) + 1440,
        });
        await phase("cifras-actualizadas-por-evento", async () => {
          await page.evaluate(() => {
            window.dispatchEvent(new Event("offline"));
            window.dispatchEvent(new Event("online"));
          });
          await expect(counter.locator(".cifra-valor .sr-only")).toHaveText(
            compact(numericValue + 1440),
          );
        });
        expect((await counter.boundingBox())?.width).toBe(beforeCounter?.width);
        await phase("cooper-abrir", async () => {
          await abrirCooper(page);
        });
        await phase("cooper-cerrar", async () => {
          await cerrarCooper(page);
        });
        if (width < 768) {
          await phase("barra-movil", async () => {
            await abrirMasDestinos(page);
            await page.keyboard.press("Escape");
          });
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page
          .getByRole("button", { name: "Video anterior", exact: true })
          .click();
        const transitions: string[][] = [];
        await page.exposeFunction(
          "registrarTransicionInicio",
          (names: string[]) => transitions.push(names),
        );
        await page.evaluate(() => {
          const original = document.startViewTransition?.bind(document);
          if (!original) return;
          const observations: TransitionObservation[] = [];
          (
            window as Window & { inicioTransitions?: TransitionObservation[] }
          ).inicioTransitions = observations;
          document.startViewTransition = (
            ...args: Parameters<typeof original>
          ) => {
            const names = Array.from(
              document.querySelectorAll("main [data-video-transition]"),
            )
              .map((element) => getComputedStyle(element).viewTransitionName)
              .filter((name) => name !== "none");
            const observation: TransitionObservation = {
              names,
              startedAt: performance.now(),
              readyAt: null,
              finishedAt: null,
              error: null,
            };
            observations.push(observation);
            void (
              window as Window & {
                registrarTransicionInicio?: (names: string[]) => Promise<void>;
              }
            ).registrarTransicionInicio?.(names);
            const transition = original(...args);
            void transition.ready.then(
              () => {
                observation.readyAt = performance.now();
              },
              (error: unknown) => {
                observation.error = String(error);
              },
            );
            void transition.finished.then(
              () => {
                observation.finishedAt = performance.now();
              },
              (error: unknown) => {
                observation.error = String(error);
              },
            );
            return transition;
          };
        });
        await phase("elemento-compartido-detalle", async () => {
          const heroLink = page.locator("main .inicio-hero-enlace");
          await expect(heroLink).toHaveAccessibleName(
            /La caja al final del día.*Ver video/,
          );
          await heroLink.click();
          await expect(page).toHaveURL(
            new RegExp(`/videos/${fixture.source.id}$`),
          );
          await page.waitForFunction(() => {
            const transition = (
              window as Window & {
                inicioTransitions?: TransitionObservation[];
              }
            ).inicioTransitions?.at(-1);
            return Boolean(
              transition &&
              (transition.finishedAt !== null || transition.error !== null),
            );
          });
        });
        expect(
          transitions.some((names) =>
            names.includes(`video-${fixture.source.id}`),
          ),
        ).toBe(true);
        if (!recording) {
          const complete = new Promise<string>((accept, reject) =>
            cdp.once("Tracing.tracingComplete", ({ stream }) =>
              stream
                ? accept(stream)
                : reject(new Error("Chromium no entregó una traza")),
            ),
          );
          await cdp.send("Tracing.end");
          const stream = await complete;
          const path = `${directory}/inicio-traza-${width}.json`;
          writeFileSync(path, "");
          while (true) {
            const chunk = await cdp.send("IO.read", { handle: stream });
            appendFileSync(
              path,
              chunk.base64Encoded
                ? Buffer.from(chunk.data, "base64")
                : chunk.data,
            );
            if (chunk.eof) break;
          }
          await cdp.send("IO.close", { handle: stream });
          writeFileSync(
            `${directory}/inicio-movimiento-${width}.json`,
            JSON.stringify(
              {
                width,
                cpu: width < 768 ? 4 : 1,
                renderer,
                samples,
                transitions,
                errors: fixture.errors,
                instrumentation: {
                  video: false,
                  screenshots: false,
                  cdpTrace: true,
                  viewTransitionFrameBudget: "ready → finished",
                  totalInteractionAndPreparationRetained: true,
                },
                scope: `Interacciones tras aplicar fixture de demostración; Lighthouse mide la carga SSR por separado. Chromium local ${renderer.hardwareAccelerated ? "con aceleración gráfica física verificada" : "con composición por software"}; CPU×${width < 768 ? 4 : 1}. No acredita un teléfono físico.`,
              },
              null,
              2,
            ) + "\n",
          );
          for (const sample of samples) {
            for (const animation of sample.animations) {
              expect
                .soft(
                  animation.transition.error,
                  `${sample.phase}: transición válida`,
                )
                .toBeNull();
              expect
                .soft(
                  animation.transition.readyAt,
                  `${sample.phase}: inicio de animación`,
                )
                .not.toBeNull();
              expect
                .soft(
                  animation.transition.finishedAt,
                  `${sample.phase}: fin de animación`,
                )
                .not.toBeNull();
            }
            for (const frames of sample.animations.length
              ? sample.animations
              : [sample]) {
              expect
                .soft(frames.fps, `${sample.phase}: FPS`)
                .toBeGreaterThanOrEqual(57);
              expect
                .soft(frames.p95, `${sample.phase}: p95`)
                .toBeLessThanOrEqual(25);
            }
            expect.soft(sample.cls, `${sample.phase}: CLS`).toBe(0);
            expect
              .soft(
                sample.longTasks.filter((duration) => duration >= 100),
                `${sample.phase}: bloqueo >=100ms`,
              )
              .toEqual([]);
          }
        }
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        expect(fixture.errors).toEqual([]);
        expect(fixture.external).toEqual([]);
        if (recording) {
          const video = page.video();
          await page.close();
          await video?.saveAs(
            `${directory}/inicio-interacciones-${width}.webm`,
          );
        }
        await context.close();
      });
    });
  }
}

// Control opcional de laboratorio. No forma parte de la puerta ni cambia la app;
// permite distinguir el coste de la composición del coste de reproducir el MP4.
if (process.env.COOPER_DIAGNOSTICO_INICIO === "1") {
  test("Diagnóstico local de composición Inicio", async ({ browser }) => {
    const baseURL = `http://127.0.0.1:${process.env.COOPER_E2E_DEMO_PORT}`;
    const context = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { Referer: baseURL },
      viewport: { width: 390, height: 900 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await prepare(page);
    await page.goto("/");
    await ready(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const hero = page.locator("main .inicio-hero .medio");
    await expect(hero).toHaveAttribute("data-preview", "on");
    const samples = [];
    for (const scenario of [
      "original",
      "sin-video",
      "sin-halo",
      "sin-vidrio",
      "video-composicion",
      "medio-composicion",
    ]) {
      await page
        .locator("#diagnostico-inicio")
        .evaluateAll((elements) => elements.forEach((e) => e.remove()));
      const css =
        scenario === "sin-halo"
          ? ".halo-medio::before{display:none!important}"
          : scenario === "sin-vidrio"
            ? "*{backdrop-filter:none!important}"
            : scenario === "video-composicion"
              ? ".medio-preview{transform:translateZ(0)}"
              : scenario === "medio-composicion"
                ? ".inicio-medio{transform:translateZ(0);isolation:isolate}"
                : "";
      const style = await page.addStyleTag({
        content: css || "/* sin modificación */",
      });
      await style.evaluate((e) =>
        (e as HTMLElement).setAttribute("id", "diagnostico-inicio"),
      );
      await hero.locator("video").evaluate(async (e, scenario) => {
        const v = e as HTMLVideoElement;
        if (scenario === "sin-video") v.pause();
        else await v.play();
      }, scenario);
      await page.waitForTimeout(400);
      await startSample(page);
      await page.waitForTimeout(1200);
      samples.push(await stopSample(page, scenario));
    }
    await page.setContent(
      '<!doctype html><html><body style="background:#000;margin:16px"><video style="width:358px;height:201px" src="/__inicio-medios/03-caja.mp4" muted autoplay loop playsinline></video></body></html>',
    );
    const bareVideo = page.locator("video");
    await bareVideo.evaluate(async (e) => {
      const v = e as HTMLVideoElement;
      v.muted = true;
      await v.play();
    });
    await page.waitForTimeout(400);
    await startSample(page);
    await page.waitForTimeout(1200);
    samples.push(await stopSample(page, "html-minimo-video"));
    await bareVideo.evaluate((e) => (e as HTMLVideoElement).pause());
    await startSample(page);
    await page.waitForTimeout(1200);
    samples.push(await stopSample(page, "html-minimo-sin-video"));
    writeFileSync(
      `${directory}/inicio-diagnostico-composicion.json`,
      JSON.stringify(samples, null, 2),
    );
    await context.close();
  });
}
