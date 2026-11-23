import { test, expect, type Page } from "@playwright/test";

async function entrar(page: Page) {
  expect(
    (
      await page.request.post(
        `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT ?? "33172"}/sesion`,
        {
          data: {
            email: "admin@example.test",
            secret: process.env.COOPER_E2E_SECRET,
          },
        },
      )
    ).ok(),
  ).toBe(true);
}

/** Animaciones de la View Transition en curso, por pseudo-elemento. */
const relevo = (page: Page) =>
  page.evaluate(() =>
    document.getAnimations().flatMap((animacion) => {
      const efecto = animacion.effect as KeyframeEffect | null;
      const pseudo = efecto?.pseudoElement ?? "";
      if (!pseudo.startsWith("::view-transition")) return [];
      const tiempo = efecto!.getComputedTiming();
      return [
        {
          pseudo,
          retraso: Number(tiempo.delay),
          fin: Number(tiempo.endTime),
        },
      ];
    }),
  );

test("cambiar de sección es un relevo: la pantalla que sale se va antes de que la nueva se lea, y Cooper no parpadea", async ({
  page,
}) => {
  await entrar(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-conexion",
    "activa",
  );
  await page.getByRole("button", { name: "Abrir Cooper", exact: true }).click();
  const hoja = page.getByRole("dialog", { name: "Cooper, tu compañero" });
  await expect(hoja).not.toHaveAttribute("data-projecting", "true");

  // Se retiene la respuesta de la ruta para leer la transición mientras corre.
  const capturado = page.waitForFunction(() =>
    document
      .getAnimations()
      .some((a) =>
        (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith(
          "::view-transition-old(root)",
        ),
      ),
  );
  await page.locator('.glass-rail a[href="/videos"]').click();
  await capturado;
  const animaciones = await relevo(page);
  const sale = animaciones.find(
    (a) => a.pseudo === "::view-transition-old(root)",
  );
  const entra = animaciones.find(
    (a) => a.pseudo === "::view-transition-new(root)",
  );
  expect(sale, "la página anterior tiene su salida").toBeTruthy();
  expect(entra, "la página nueva tiene su entrada").toBeTruthy();
  // Salida breve (≤120 ms) y entrada que empieza cuando la otra va por la mitad:
  // nunca hay dos páginas legibles a la vez ni un cuadro en blanco.
  expect(sale!.fin).toBeLessThanOrEqual(120);
  expect(entra!.retraso).toBeGreaterThanOrEqual(sale!.fin / 2);
  expect(entra!.retraso).toBeLessThan(sale!.fin);
  // Cooper y el riel no participan: sin animación propia en el relevo.
  expect(
    animaciones.filter((a) =>
      /\((cooper-hoja|cooper-orbe|riel)\)/.test(a.pseudo),
    ),
  ).toEqual([]);

  await expect(page).toHaveURL(/\/videos$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Línea de producción" }),
  ).toBeVisible();
  await expect(hoja).toBeVisible();
  await expect(hoja.locator(".cooper-cabecera small")).toHaveText(
    "Línea de producción",
  );
});

test("al elegir destino el riel se recoge y no tapa la pantalla; vuelve al salir y entrar, y con teclado", async ({
  page,
}) => {
  await entrar(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const riel = page.locator(".glass-rail");
  const ancho = () => riel.evaluate((e) => e.getBoundingClientRect().width);
  const recogido = await ancho();
  const destino = riel.locator('a[href="/publicados"]');
  await destino.hover();
  await expect.poll(ancho).toBeGreaterThan(recogido * 2);
  await destino.click();
  await expect(page).toHaveURL(/\/publicados$/);
  await expect.poll(ancho).toBe(recogido);
  // El cursor sigue encima: moverlo dentro no lo despliega.
  await page.mouse.move(40, 300);
  await page.mouse.move(44, 320);
  await expect.poll(ancho).toBe(recogido);
  // Sale y vuelve: se despliega como siempre.
  await page.mouse.move(700, 400);
  await riel.locator('a[href="/"]').first().hover();
  await expect.poll(ancho).toBeGreaterThan(recogido * 2);
  // Teclado: el foco visible dentro del riel lo despliega.
  await page.mouse.move(700, 400);
  await expect.poll(ancho).toBe(recogido);
  await page.locator(".skip-link, a[href='#contenido']").first().focus();
  await page.keyboard.press("Tab");
  await expect(riel.locator(":focus-visible")).toHaveCount(1);
  await expect.poll(ancho).toBeGreaterThan(recogido * 2);
});

test("Cooper abre con su contenido y el compañero en la cabecera; la página le hace sitio", async ({
  page,
}) => {
  await entrar(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-conexion",
    "activa",
  );
  const orbe = page.getByRole("button", { name: "Abrir Cooper", exact: true });
  await expect(orbe.locator(".cooper-presencia")).toBeVisible();
  const inicio = Date.now();
  await orbe.click();
  const hoja = page.getByRole("dialog", { name: "Cooper, tu compañero" });
  // El contenido entra mientras la hoja termina de asentarse, no después.
  await expect(hoja).not.toHaveAttribute("data-projecting", "true");
  expect(Date.now() - inicio).toBeLessThan(700);
  const cara = hoja.locator(".cooper-cabecera-cara .cooper-presencia");
  await expect(cara).toBeVisible();
  await expect(cara.locator("img")).toHaveJSProperty("complete", true);
  await expect(hoja.locator(".cooper-cabecera strong")).toHaveText("Cooper");
  await expect(
    hoja.getByRole("textbox", { name: "Mensaje para Cooper", exact: true }),
  ).toBeVisible();
  // La página cede el ancho de una vez y reaparece con un fundido de opacidad
  // (animar el ancho recalculaba la pantalla en cada cuadro).
  const estudio = page.locator(".studio-shell");
  await expect(estudio).toHaveAttribute("data-cooper-movido", "true");
  const contenido = page.locator("main#contenido");
  expect(
    await contenido.evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("ceder-sitio");
  expect(
    await estudio.evaluate((e) => getComputedStyle(e).transitionProperty),
  ).not.toContain("padding");
  await expect
    .poll(() =>
      estudio.evaluate((e) => parseFloat(getComputedStyle(e).paddingRight)),
    )
    .toBeGreaterThan(300);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  // Al cerrar, el compañero vuelve a su orbe.
  await page.keyboard.press("Escape");
  await expect(hoja).toHaveCount(0);
  await expect(orbe.locator(".cooper-presencia")).toBeVisible();
  expect(
    await contenido.evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("recobrar-sitio");
});

test("con movimiento reducido no hay relevo animado ni aterrizaje, y todo sigue en su sitio", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await entrar(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir Cooper", exact: true }).click();
  const hoja = page.getByRole("dialog", { name: "Cooper, tu compañero" });
  const cara = hoja.locator(".cooper-cabecera-cara");
  await expect(cara).toBeVisible();
  expect(await cara.evaluate((e) => getComputedStyle(e).animationName)).toBe(
    "none",
  );
  expect(
    await page
      .locator("main#contenido")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  await page.locator('.glass-rail a[href="/videos"]').click();
  await expect(page).toHaveURL(/\/videos$/);
  expect(await relevo(page)).toEqual([]);
  await expect(hoja).toBeVisible();
});
