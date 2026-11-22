import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Resultados } from "../src/contratos/resultados";
import {
  crearMediosDeEnsayo,
  poster,
  preparar,
  salida,
} from "./videos-medios-ayudas";

test.use({ viewport: { width: 1440, height: 900 }, video: "on" });
test.beforeAll(crearMediosDeEnsayo);

test("póster real, espera de hover, vista previa silenciosa y pausa sin descargar el original", async ({
  page,
}) => {
  const contexto = await preparar(page);
  await page.goto("/videos");
  const medio = page
    .locator(`[data-video-medio="${contexto.video.id}"]`)
    .first();
  const imagen = medio.locator("img");
  await expect(imagen).toHaveJSProperty(
    "src",
    new URL(poster, page.url()).href,
  );
  await expect(imagen).toHaveAttribute("loading", "lazy");
  await expect(imagen).toHaveAttribute("width", "720");
  await expect(imagen).toHaveAttribute("height", "1280");
  await expect(imagen).toHaveCSS("object-fit", "contain");
  await expect(medio.locator("svg")).toHaveCount(0);
  await expect(medio).toHaveCSS("--tinte", "#997755");
  expect(contexto.peticiones()).toEqual({ vistasPrevias: 0, completos: 0 });
  await medio.scrollIntoViewIfNeeded();
  const caja = await medio.boundingBox();
  await medio.evaluate((el) => {
    el.addEventListener(
      "pointerenter",
      () => el.setAttribute("data-inicio-hover", String(performance.now())),
      { once: true },
    );
    el.querySelector("video")!.addEventListener(
      "playing",
      () =>
        el.setAttribute(
          "data-espera-hover",
          String(
            performance.now() - Number(el.getAttribute("data-inicio-hover")),
          ),
        ),
      { once: true },
    );
  });
  await medio.hover();
  const player = medio.locator("video");
  const orbe = page.locator(".cooper-orb .cooper-presencia video");
  await expect
    .poll(() => orbe.evaluate((el) => (el as HTMLVideoElement).paused))
    .toBe(true);
  await expect
    .poll(() => player.evaluate((el) => (el as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.1);
  expect(
    Number(await medio.getAttribute("data-espera-hover")),
  ).toBeGreaterThanOrEqual(175);
  expect(await player.evaluate((el) => (el as HTMLVideoElement).muted)).toBe(
    true,
  );
  await expect(player).toHaveAttribute("playsinline", "");
  await expect(player).toHaveCSS("transition-duration", "0.24s");
  await expect(medio).toHaveAttribute("data-reproduciendo", "true");
  await page.screenshot({
    path: `${salida}/medios-hover-1440.png`,
    fullPage: true,
  });
  await page.mouse.move(0, 0);
  await expect
    .poll(() => player.evaluate((el) => (el as HTMLVideoElement).paused))
    .toBe(true);
  await expect(medio).toHaveAttribute("data-reproduciendo", "false");
  await expect
    .poll(() => orbe.evaluate((el) => (el as HTMLVideoElement).paused))
    .toBe(false);
  await expect.poll(() => medio.boundingBox()).toEqual(caja);
  await medio.hover();
  await expect(medio).toHaveAttribute("data-reproduciendo", "true");
  await page.getByRole("link", { name: "Mi perfil", exact: true }).click();
  await page
    .getByRole("button", { name: "Pausar movimiento", exact: true })
    .click();
  await page.goto("/videos");
  await medio.hover();
  await expect(medio).toHaveAttribute("data-quieto", "true");
  await expect
    .poll(() => player.evaluate((el) => (el as HTMLVideoElement).paused))
    .toBe(true);
  await page.getByRole("link", { name: "Mi perfil", exact: true }).click();
  await page
    .getByRole("button", { name: "Activar movimiento", exact: true })
    .click();
  await page.goto("/videos");
  await medio.hover();
  await expect(medio).toHaveAttribute("data-quieto", "false");
  await expect(medio).toHaveAttribute("data-reproduciendo", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await medio.hover();
  await expect(medio).toHaveAttribute("data-quieto", "true");
  await expect
    .poll(() => player.evaluate((el) => (el as HTMLVideoElement).paused))
    .toBe(true);
  // El modo reducido muestra la cara estática; ninguna reproducción oculta.
  await expect(orbe).toHaveCount(0);
  expect(contexto.peticiones().completos).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(contexto.errores).toEqual([]);
  const grabacion = page.video();
  await page.close();
  await grabacion?.saveAs(`${salida}/medios-hover-pausa-1440.webm`);
});

test("Publicados usa el medio de su publicación y conserva fallback tipográfico", async ({
  page,
}) => {
  const datos = await preparar(page);
  const resultados: Resultados = await (
    await page.request.get("/api/resultados")
  ).json();
  const publicacion = resultados.publicaciones.find((p) => p.tipo === "video")!;
  expect(publicacion?.tipo).toBe("video");
  if (publicacion.tipo !== "video")
    throw new Error("Falta publicación ficticia");
  publicacion.videoId = datos.video.id;
  publicacion.href = `/videos/${datos.video.id}`;
  publicacion.medios = {
    ...datos.medio,
    poster: { ...datos.medio.poster!, origen: "youtube" },
    preview: null,
  };
  await page.route(
    `**/api/videos/${datos.video.id}/medios?publicacion=*`,
    (route) => route.fulfill({ json: publicacion.medios }),
  );
  resultados.publicaciones = [publicacion];
  await page.route("**/api/resultados", (route) =>
    route.fulfill({ json: resultados }),
  );
  await page.goto("/publicados");
  const actualizado = page.waitForResponse("**/api/resultados");
  await page
    .getByRole("button", { name: "Actualizar resultados", exact: true })
    .click();
  await (await actualizado).finished();
  await expect(page.locator(".publication-thumb")).toHaveCount(1);
  const medio = page.locator(
    `.publication-thumb [data-video-medio="${datos.video.id}"][data-publicacion="${publicacion.publicacion.id}"]`,
  );
  await expect(medio).toHaveAttribute(
    "data-publicacion",
    publicacion.publicacion.id,
  );
  await expect(medio).toHaveAttribute("data-origen", "youtube");
  await expect(medio.locator("img")).toHaveJSProperty(
    "src",
    new URL(poster, page.url()).href,
  );
  await page.screenshot({
    path: `${salida}/medios-publicados-1440.png`,
    fullPage: true,
  });
  publicacion.medios = {
    ...publicacion.medios,
    estado: "sin_medio",
    poster: null,
    preview: null,
    actualizadoEn: Date.now() + 1,
  };
  await page
    .getByRole("button", { name: "Actualizar resultados", exact: true })
    .click();
  await expect(medio.locator("[data-poster=tipografico]")).toHaveText(
    publicacion.titulo,
  );
  await expect(medio.locator("svg")).toHaveCount(0);
  await page.evaluate(() => {
    const original = document.startViewTransition.bind(document);
    const registro = { nombre: "", lista: false };
    (
      window as Window & { transicionTitulo?: typeof registro }
    ).transicionTitulo = registro;
    document.startViewTransition = (...args: Parameters<typeof original>) => {
      registro.nombre =
        document.querySelector<HTMLElement>(
          ".publication-thumb [data-video-transition]",
        )?.style.viewTransitionName ?? "";
      const transicion = original(...args);
      void transicion.ready
        .then(() => {
          registro.lista = true;
        })
        .catch(() => {});
      return transicion;
    };
  });
  await page.locator(".publication a.publication-thumb").click();
  await expect(page).toHaveURL(new RegExp(`/videos/${datos.video.id}$`));
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              transicionTitulo?: { nombre: string; lista: boolean };
            }
          ).transicionTitulo,
      ),
    )
    .toEqual({
      nombre: `video-${datos.video.id}`,
      lista: true,
    });
  expect(datos.errores).toEqual([]);
  const grabacion = page.video();
  await page.close();
  await grabacion?.saveAs(`${salida}/medios-publicados-1440.webm`);
});

test("un derivado lento termina visible después de más de ocho consultas", async ({
  page,
}) => {
  await page.clock.install();
  const datos = await preparar(page);
  let consultas = 0;
  await page.route(`**/api/videos/${datos.video.id}/medios`, (route) => {
    consultas++;
    return route.fulfill({
      json: consultas < 10 ? datos.video.medios : datos.medio,
    });
  });
  await page.goto("/videos");
  const medio = page.locator(`[data-video-medio="${datos.video.id}"]`).first();
  await expect(medio).toHaveAttribute("data-estado", "pendiente");
  await expect.poll(() => consultas).toBe(1);
  for (let consulta = 2; consulta <= 10; consulta++) {
    const respuesta = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === `/api/videos/${datos.video.id}/medios`,
    );
    await page.clock.fastForward(15_000);
    await (await respuesta).finished();
    await page.clock.runFor(1);
    await expect.poll(() => consultas).toBe(consulta);
  }
  await expect(medio.locator("img")).toHaveJSProperty(
    "src",
    new URL(poster, page.url()).href,
  );
  expect(datos.errores).toEqual([]);
});
