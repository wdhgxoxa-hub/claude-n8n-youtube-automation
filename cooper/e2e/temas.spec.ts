import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

const TEMAS = [
  { valor: "feria", nombre: "Feria", esquema: "oscuro" },
  { valor: "sala", nombre: "Sala", esquema: "oscuro" },
  { valor: "dia", nombre: "Día", esquema: "claro" },
] as const;
const RUTAS = [
  "/",
  "/videos",
  "/publicados",
  "/aprendizaje",
  "/marcas",
  "/perfil",
];

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
const quieta = (page: Page) =>
  page.waitForFunction(
    () => !("cambioTema" in document.documentElement.dataset),
  );
const radio = (page: Page, nombre: string) =>
  page.getByRole("radio", { name: new RegExp(`^${nombre}`) });

// Contraste real de cada texto visible contra su fondo compuesto. Complementa a
// axe, que deja sin decidir los textos sobre degradados (el ambiente de «Feria»).
function textosSinContraste() {
  const luz = (r: number, g: number, b: number) => {
    const f = (c: number) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const lienzo = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true })!;
  const rgba = (color: string) => {
    lienzo.clearRect(0, 0, 1, 1);
    lienzo.fillStyle = color;
    lienzo.fillRect(0, 0, 1, 1);
    const d = lienzo.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const sobre = (a: number[], b: number[]) => [
    a[0] * a[3] + b[0] * (1 - a[3]),
    a[1] * a[3] + b[1] * (1 - a[3]),
    a[2] * a[3] + b[2] * (1 - a[3]),
    1,
  ];
  const fallos: string[] = [];
  const vistos = new Set<Element>();
  const recorrido = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
  );
  for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
    const e = nodo.parentElement;
    if (!e || !nodo.textContent?.trim() || vistos.has(e)) continue;
    vistos.add(e);
    const caja = e.getBoundingClientRect();
    const estilo = getComputedStyle(e);
    if (caja.width < 2 || caja.height < 2 || estilo.visibility === "hidden")
      continue;
    // Los medios se revisan aparte: su fondo es una imagen o un póster.
    if (
      e.closest(
        ".sr-only,[hidden],[aria-hidden=true],.medio,.cartel,[data-cine],:disabled,[aria-disabled=true]",
      )
    )
      continue;
    const capas: number[][] = [];
    let opacidad = 1;
    for (let x: Element | null = e; x; x = x.parentElement) {
      const s = getComputedStyle(x);
      opacidad *= Number(s.opacity);
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) capas.push(c);
      if (c[3] === 1) break;
    }
    if (opacidad === 0) continue;
    let fondo = rgba(getComputedStyle(document.body).backgroundColor);
    for (const c of capas.reverse()) fondo = sobre(c, fondo);
    const tinta = rgba(estilo.color);
    const texto = sobre(
      [tinta[0], tinta[1], tinta[2], tinta[3] * opacidad],
      fondo,
    );
    const [a, b] = [
      luz(texto[0], texto[1], texto[2]),
      luz(fondo[0], fondo[1], fondo[2]),
    ];
    const razon = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const px = parseFloat(estilo.fontSize);
    const minimo =
      px >= 24 || (px >= 18.66 && Number(estilo.fontWeight) >= 700) ? 3 : 4.5;
    if (razon < minimo)
      fallos.push(
        `${razon.toFixed(2)} < ${minimo}: «${nodo.textContent.trim().slice(0, 40)}»`,
      );
  }
  return fallos;
}

test.afterEach(async ({ page }) => {
  // El tema es del usuario de ensayo: se devuelve al inicial para el resto.
  const estado = await (await page.request.get("/api/estado")).json();
  await page.request.patch("/api/perfil", {
    data: {
      name: estado.user.name,
      image: estado.user.image,
      theme: "feria",
      home: estado.user.home,
      whatsapp: estado.user.whatsapp,
    },
  });
});

test("apariencia: se elige al tocar, se guarda sola y sobrevive a recargar", async ({
  page,
}) => {
  await entrar(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/perfil");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-tema", "feria");
  await expect(radio(page, "Feria")).toBeChecked();
  for (const tema of [TEMAS[1], TEMAS[2]]) {
    await radio(page, tema.nombre).check({ force: true });
    await expect(page.locator(".apariencia-estado")).toHaveText(
      `Listo: ahora usas «${tema.nombre}».`,
    );
    await quieta(page);
    await expect(html).toHaveAttribute("data-tema", tema.valor);
    await expect(html).toHaveAttribute("data-theme", tema.esquema);
  }
  // Recarga: el servidor ya pinta el tema, sin pasar por el inicial.
  const respuesta = await page.reload();
  expect(await respuesta!.text()).toContain('data-tema="dia"');
  await expect(html).toHaveAttribute("data-tema", "dia");
  await expect(radio(page, "Día")).toBeChecked();
  // Teclado: las flechas recorren las opciones como en cualquier grupo de radios.
  await radio(page, "Día").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(html).toHaveAttribute("data-tema", "sala");
  await expect(page.locator(".apariencia-estado")).toHaveText(
    "Listo: ahora usas «Sala».",
  );
  // Guardar el resto del perfil no pisa el tema elegido.
  await quieta(page);
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(page.getByText("Tu perfil está actualizado.")).toBeVisible();
  await page.reload();
  await expect(html).toHaveAttribute("data-tema", "sala");
});

test("apariencia: si no se puede guardar, vuelve el tema anterior y lo dice", async ({
  page,
}) => {
  await entrar(page);
  await page.goto("/perfil");
  await page.route("**/api/perfil", (ruta) =>
    ruta.request().method() === "PATCH" ? ruta.abort() : ruta.continue(),
  );
  await radio(page, "Día").check({ force: true });
  await expect(page.locator(".apariencia-estado")).toContainText(
    "No pudimos guardar el cambio",
  );
  await quieta(page);
  await expect(page.locator("html")).toHaveAttribute("data-tema", "feria");
  await expect(radio(page, "Feria")).toBeChecked();
  await page.unroute("**/api/perfil");
});

// Revisión visual (22-11-2026): a 768 px la columna del perfil es estrecha y
// las tres tarjetas medían ~85 px; la muestra y el lema tocaban el borde.
test("apariencia: cada tarjeta de tema contiene su muestra y su texto en toda anchura", async ({
  page,
}) => {
  await entrar(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fuera = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".apariencia-opcion")].flatMap(
        (tarjeta) => {
          const caja = tarjeta.getBoundingClientRect();
          const borde = parseFloat(getComputedStyle(tarjeta).borderLeftWidth);
          return [
            ...tarjeta.querySelectorAll<HTMLElement>(
              ".apariencia-muestra, .apariencia-nombre, .apariencia-lema, svg",
            ),
          ]
            .filter((pieza) => {
              const r = pieza.getBoundingClientRect();
              return (
                r.left < caja.left + borde - 0.5 ||
                r.right > caja.right - borde + 0.5 ||
                pieza.scrollWidth > pieza.clientWidth + 1
              );
            })
            .map(
              (pieza) =>
                `${tarjeta.querySelector("input")!.value}: ${pieza.getAttribute("class")}`,
            );
        },
      ),
    );
  for (const ancho of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto("/perfil");
    await page.evaluate(() => document.fonts.ready);
    expect(await fuera(), `${ancho}`).toEqual([]);
    if (ancho >= 1024) {
      await page.getByRole("button", { name: "Abrir Cooper" }).click();
      await expect(
        page.getByRole("button", { name: "Cerrar Cooper" }),
      ).toBeVisible();
      await page.waitForTimeout(300);
      expect(await fuera(), `${ancho} con Cooper`).toEqual([]);
    }
  }
});

// Sentinel (caos en /perfil, 22-11-2026): un cambio nuevo salta la transición del
// anterior y su promesa `ready` quedaba rechazada sin atender («Transition was
// skipped»). Tocar los temas seguidos no debe dejar errores en la página.
test("apariencia: cambiar de tema seguido no deja errores sin atender", async ({
  page,
}) => {
  await entrar(page);
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(m.text());
  });
  await page.goto("/perfil");
  await expect(page.locator("html")).toHaveAttribute("data-tema", "feria");
  // Con flechas, cada paso cambia el tema mientras el fundido anterior sigue en
  // curso. (Un toque de ratón durante esos 240 ms lo recibe la capa del fundido.)
  await radio(page, "Feria").focus();
  for (const tecla of ["ArrowRight", "ArrowRight", "ArrowLeft", "ArrowRight"])
    await page.keyboard.press(tecla);
  await expect(page.locator(".apariencia-estado")).toHaveText(
    "Listo: ahora usas «Día».",
  );
  await quieta(page);
  await expect(page.locator("html")).toHaveAttribute("data-tema", "dia");
  await expect(radio(page, "Día")).toBeChecked();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "dia");
  expect(errores).toEqual([]);
});

for (const tema of TEMAS)
  test(`tema «${tema.nombre}»: sin desbordes, sin avisos y con contraste AA en móvil y escritorio`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await entrar(page);
    const avisos: string[] = [];
    page.on("console", (m) => {
      if (["error", "warning"].includes(m.type())) avisos.push(m.text());
    });
    page.on("pageerror", (e) => avisos.push(e.message));
    const estado = await (await page.request.get("/api/estado")).json();
    expect(
      (
        await page.request.patch("/api/perfil", {
          data: {
            name: estado.user.name,
            image: estado.user.image,
            theme: tema.valor,
            home: estado.user.home,
            whatsapp: estado.user.whatsapp,
          },
        })
      ).ok(),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const ancho of [390, 1440]) {
      await page.setViewportSize({ width: ancho, height: 900 });
      for (const ruta of RUTAS) {
        const etiqueta = `${tema.valor} ${ancho} ${ruta}`;
        await page.goto(ruta);
        await expect(page.locator("html")).toHaveAttribute(
          "data-tema",
          tema.valor,
        );
        await expect(page.locator(".workspace")).toHaveAttribute(
          "data-conexion",
          "activa",
        );
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          `desborde ${etiqueta}`,
        ).toBe(false);
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`),
          `axe ${etiqueta}`,
        ).toEqual([]);
        expect(
          await page.evaluate(textosSinContraste),
          `contraste ${etiqueta}`,
        ).toEqual([]);
      }
    }
    expect(avisos, `consola ${tema.valor}`).toEqual([]);
  });
