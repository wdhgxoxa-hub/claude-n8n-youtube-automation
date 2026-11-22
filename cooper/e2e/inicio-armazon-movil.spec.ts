import { expect, test } from "@playwright/test";

test("Inicio móvil conserva las etiquetas y libera el final con área segura", async ({
  page,
}, testInfo) => {
  const sesion = await page.request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
    {
      data: {
        email: "admin@example.test",
        secret: process.env.COOPER_E2E_SECRET,
      },
    },
  );
  expect(sesion.ok()).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const cdp = await page.context().newCDPSession(page);
  const medidas = [];

  for (const ancho of [360, 390]) {
    await page.setViewportSize({ width: ancho, height: 640 });
    for (const areaSegura of [0, 34]) {
      // API oficial CDP: emula env(safe-area-inset-bottom), no modifica el CSS.
      await cdp.send("Emulation.setSafeAreaInsetsOverride", {
        insets: { top: 0, right: 0, bottom: areaSegura, left: 0 },
      });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const barra = page.getByRole("navigation", {
        name: "Principal móvil",
        exact: true,
      });
      await expect(barra.getByRole("link")).toHaveText([
        "Inicio",
        "Fábrica",
        "Publicados",
        "Aprendizaje",
        "Marcas",
      ]);
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );

      const medida = await page.evaluate(() => {
        const orbe = document.querySelector(".cooper-orb")!;
        const contenido = document.querySelector(".route-choreography")!;
        const barra = document.querySelector(".mobile-dock")!;
        const rectBarra = barra.getBoundingClientRect();
        const etiquetas = Array.from(barra.querySelectorAll("a")).map(
          (enlace) => {
            const etiqueta = enlace.querySelector("span:not(.nav-indicator)")!;
            const rango = document.createRange();
            rango.selectNodeContents(etiqueta);
            const texto = rango.getBoundingClientRect();
            const objetivo = enlace.getBoundingClientRect();
            return {
              texto: etiqueta.textContent,
              lineas: rango.getClientRects().length,
              tamano: Number.parseFloat(getComputedStyle(etiqueta).fontSize),
              ancho: objetivo.width,
              alto: objetivo.height,
              aireIzquierdo: texto.left - objetivo.left,
              aireDerecho: objetivo.right - texto.right,
              dentroDeBarra:
                objetivo.left >= rectBarra.left &&
                objetivo.right <= rectBarra.right,
            };
          },
        );
        return {
          etiquetas,
          espacioFinal:
            orbe.getBoundingClientRect().top -
            contenido.getBoundingClientRect().bottom,
          desbordamiento:
            document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      medidas.push({ ancho, areaSegura, ...medida });
      expect(medida.desbordamiento).toBe(0);
      expect(medida.espacioFinal).toBeGreaterThanOrEqual(23.5);
      for (const etiqueta of medida.etiquetas) {
        expect(etiqueta.lineas, etiqueta.texto ?? "").toBe(1);
        expect(etiqueta.tamano).toBeGreaterThanOrEqual(12);
        expect(etiqueta.ancho).toBeGreaterThanOrEqual(48);
        expect(etiqueta.alto).toBeGreaterThanOrEqual(48);
        expect(etiqueta.aireIzquierdo).toBeGreaterThanOrEqual(3.5);
        expect(etiqueta.aireDerecho).toBeGreaterThanOrEqual(3.5);
        expect(etiqueta.dentroDeBarra).toBe(true);
      }
      // Comprueba que el orbe sigue siendo un control real sobre la barra.
      await page
        .getByRole("button", { name: "Abrir Cooper", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Cooper, tu compañero", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Cerrar Cooper", exact: true })
        .click();
    }
  }
  await cdp.detach();
  await testInfo.attach("armazon-movil-medidas", {
    body: JSON.stringify(medidas, null, 2),
    contentType: "application/json",
  });
});
