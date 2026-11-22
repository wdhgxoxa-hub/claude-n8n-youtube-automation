import { abrirCooper, cerrarCooper, abrirMasDestinos } from "./ayudas-diseno";
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Estado } from "../src/servicios/datos";
import type { Operacion } from "../src/contratos/operacion";
import type { EstadoMarcas } from "../src/servicios/marcas/servicio";
import type { Resultados } from "../src/contratos/resultados";
import { competenciaVacia } from "../src/contratos/competencia.mjs";

// API oficial: https://playwright.dev/docs/accessibility-testing
// Axe comprueba solo contenido visible: cada menú, formulario y estado se abre
// antes del escaneo. No se excluyen nodos ni se deshabilitan reglas.
const raiz = ".cache/accesibilidad";
const temas = ["oscuro"] as const;
const anchos = [360, 1440] as const;
type Tema = (typeof temas)[number];
type Muestra = {
  nombre: string;
  ruta: string;
  tema: Tema;
  ancho: number;
  captura: string;
  informe: string;
  violaciones: number;
  serias: number;
  revisionManual: number;
  desbordamiento: number;
};

test.use({ timezoneId: "America/Lima", reducedMotion: "reduce" });

async function preparar(page: Page, tema: Tema, ancho: number) {
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
  const inicial: Estado = await (await page.request.get("/api/estado")).json();
  expect(inicial.demo).toBe(true);
  expect(
    (
      await page.request.patch("/api/perfil", {
        data: {
          name: inicial.user.name,
          image: inicial.user.image,
          whatsapp: inicial.user.whatsapp,
          home: "chat",
          theme: tema,
        },
      })
    ).ok(),
  ).toBe(true);
  await page.setViewportSize({ width: ancho, height: 900 });
  return (await (await page.request.get("/api/estado")).json()) as Estado;
}

async function abrir(page: Page, ruta: string, tema: Tema) {
  await page.goto(ruta);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(
    page.getByText("Consultando la fábrica…", { exact: true }),
  ).toHaveCount(0);
  // Entrada, 404 y revisión de WhatsApp no ofrecen un selector de tema público.
  // Se ensayan el juego único de tokens oscuros, sin afirmar que existe ese selector.
  if ((await page.locator(".workspace").count()) === 0) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, tema);
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", tema);
  await page.evaluate(() => document.fonts.ready);
}

function auditor(
  page: Page,
  info: TestInfo,
  tema: Tema,
  ancho: number,
  grupo: string,
) {
  const carpeta = `${raiz}/${grupo}-${tema}-${ancho}`;
  mkdirSync(carpeta, { recursive: true });
  const muestras: Muestra[] = [];
  return async (nombre: string) => {
    const resultado = await new AxeBuilder({ page }).analyze();
    const idsAriaIncompletos = resultado.incomplete.filter(
      ({ id }) => id === "duplicate-id-aria",
    );
    const diagnosticoIdsDuplicados = idsAriaIncompletos.length
      ? await page.evaluate(() => {
          const grupos = new Map<string, Element[]>();
          for (const nodo of document.querySelectorAll("[id]")) {
            const grupo = grupos.get(nodo.id) ?? [];
            grupo.push(nodo);
            grupos.set(nodo.id, grupo);
          }
          // Solo estructura: no incluye texto, valores de campos ni HTML.
          return [...grupos]
            .filter(([, nodos]) => nodos.length > 1)
            .map(([id, nodos]) => ({
              id,
              cantidad: nodos.length,
              elementos: nodos.map((nodo) => ({
                etiqueta: nodo.tagName.toLowerCase(),
                rol: nodo.getAttribute("role"),
                visible: nodo.getClientRects().length > 0,
              })),
            }));
        })
      : [];
    const desbordamiento = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - innerWidth),
    );
    const captura = `${carpeta}/${nombre}.png`;
    const informe = `${carpeta}/${nombre}.json`;
    const muestra: Muestra = {
      nombre,
      ruta: new URL(page.url()).pathname + new URL(page.url()).search,
      tema,
      ancho,
      captura,
      informe,
      violaciones: resultado.violations.length,
      serias: resultado.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ).length,
      revisionManual: resultado.incomplete.length,
      desbordamiento,
    };
    writeFileSync(
      informe,
      JSON.stringify(
        { ...muestra, diagnosticoIdsDuplicados, axe: resultado },
        null,
        2,
      ) + "\n",
    );
    await page.screenshot({ path: captura, fullPage: true });
    muestras.push(muestra);
    const indice = `${carpeta}/indice.json`;
    writeFileSync(
      indice,
      JSON.stringify(
        {
          proyecto: info.project.name,
          navegador: "Chromium",
          movimiento: "reduce",
          reglas: "Todas las reglas predeterminadas de axe; sin exclusiones",
          origen:
            "Simuladores y fixtures locales; sin OAuth ni servicios externos",
          muestras,
        },
        null,
        2,
      ) + "\n",
    );
    // Soft conserva evidencia de todas las vistas aunque una detecte un defecto.
    expect
      .soft(desbordamiento, `${nombre}: desbordamiento a ${ancho}px`)
      .toBe(0);
    expect
      .soft(
        resultado.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          elementos: nodes.map((node) => node.target),
        })),
        `${nombre}: ${tema}, ${ancho}px; detalle en ${informe}`,
      )
      .toEqual([]);
    // Axe clasifica IDs ambiguos como incomplete: también bloquean la puerta.
    // El contraste indeterminado se conserva íntegro para revisión manual.
    expect
      .soft(
        idsAriaIncompletos.map(({ id, impact, nodes }) => ({
          id,
          impact,
          elementos: nodes.map((node) => node.target),
        })),
        `${nombre}: referencias ARIA ambiguas; diagnóstico en ${informe}`,
      )
      .toEqual([]);
  };
}

async function estadoFijo(page: Page, estado: Estado) {
  await page.route("**/api/estado", (route) => route.fulfill({ json: estado }));
  await page.route("**/api/eventos", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `event: estado\ndata: ${JSON.stringify(estado)}\n\n`,
    }),
  );
}

function marcaDeEnsayo(ownerId: string): EstadoMarcas["marcas"][number] {
  const fecha = Date.UTC(2026, 10, 21, 15);
  const guia = {
    colores: ["#142c3b", "#f0eee7"],
    tipografia: "serif" as const,
    logoId: "",
    tono: "Claro y cercano, con ejemplos de la vida diaria.",
    versionBiblia: "RVR1960",
  };
  return {
    id: "marca-accesibilidad",
    ownerId,
    nombre: "Marca accesible de ensayo",
    rubro: "general",
    zona: "America/Lima",
    guia,
    competencia: competenciaVacia("Marca accesible de ensayo"),
    createdAt: fecha,
    cuentas: [
      {
        id: "cuenta-accesibilidad",
        marcaId: "marca-accesibilidad",
        red: "instagram",
        alias: "@marca_ensayo",
        remoto: "cuenta-ficticia",
        pagina: "",
        tipo: "Business",
        estado: "conectada",
        simulada: true,
        verificada: fecha,
      },
    ],
    estudio: {
      muestra: 1,
      visuales: 0,
      estilo: "Textos breves con ejemplos cotidianos.",
      frecuencia: 2,
      pilares: ["Historias del equipo"],
      horas: [10, 18],
      evidencia: "Historial ficticio para comprobar la lectura de resultados.",
      actualizado: fecha,
      historial: [
        {
          id: "historia-ensayo",
          texto: "Una idea que se convirtió en historia.",
          fecha: "2026-11-20",
          tipo: "imagen",
          imagen: "",
          metricas: {
            vistas: 120,
            interacciones: 12,
            alcance: 100,
            capturadas: fecha,
          },
        },
      ],
    },
    piezas: (["pendiente", "publicada"] as const).map((estado, index) => ({
      id: `pieza-accesibilidad-${index}`,
      marcaId: "marca-accesibilidad",
      cuentaId: "cuenta-accesibilidad",
      datos: {
        cuentaId: "cuenta-accesibilidad",
        formato: "imagen",
        plantilla: "libre",
        titulo:
          index === 0
            ? "La historia que vamos a contar"
            : "Una historia publicada",
        texto:
          "Creamos una historia breve, la revisamos y compartimos lo aprendido.",
        detalle: "",
        diapositivas: [],
        adjuntos: [],
        citas: [],
        origen: "web",
        videoId: "",
      },
      guia,
      revision: 1,
      revisionDoctrinal: null,
      estado,
      aprobadaPor: index === 1 ? ownerId : "",
      aprobadaRevision: index,
      programada: fecha,
      leaseAt: 0,
      remoto: "",
      mediosIds: [],
      checkpoint: {},
      metricas:
        index === 1
          ? { vistas: 120, interacciones: 12, alcance: 100, capturadas: fecha }
          : null,
      aviso: "",
      createdAt: fecha,
      updatedAt: fecha,
    })),
  };
}

for (const tema of temas) {
  for (const ancho of anchos) {
    test(`axe: todas las rutas, ${tema}, ${ancho}px`, async ({
      page,
    }, info) => {
      test.setTimeout(300000);
      const estado = await preparar(page, tema, ancho);
      const revisar = auditor(page, info, tema, ancho, "rutas");
      const canal = estado.channels[0];
      expect(canal).toBeDefined();
      const rutas: [string, string][] = [
        ["inicio", "/"],
        ["marcas", "/marcas"],
        ["canales", "/canales"],
        ["biblia-canal", `/canales/${canal.id}`],
        ["videos", "/videos"],
        ["publicados", "/publicados"],
        ["aprendizaje", "/aprendizaje"],
        ["avatares", "/avatares"],
        ["perfil", "/perfil"],
        ["admin", "/admin"],
        ["admin-fabrica", "/admin/fabrica"],
        ...[
          "radar",
          "rutina",
          "redes",
          "referencias",
          "cuentas",
          "programados",
          "decisiones",
          "incidencias",
          "avisos",
        ].map((ruta): [string, string] => [ruta, `/${ruta}`]),
        ["entrada", "/entrar"],
        ["entrada-denegada", "/entrar?error=AccessDenied"],
        ["pagina-inexistente", "/inexistente"],
        ["video-inexistente", "/videos/no-disponible"],
        ["whatsapp-enlace-no-disponible", "/revisar/whatsapp/enlace-invalido"],
      ];
      // Cada estado de producción demo tiene contenido y acciones diferentes.
      for (const etapa of [7, 3, 9, 11]) {
        const video = estado.videos.find((v) => v.stage === etapa);
        expect(video, `Existe video demo en etapa ${etapa}`).toBeDefined();
        rutas.push([`video-etapa-${etapa}`, `/videos/${video!.id}`]);
      }
      for (const [nombre, ruta] of rutas) {
        await abrir(page, ruta, tema);
        await revisar(nombre);
      }
      // La revisión sin sesión retorna a la entrada y conserva el destino.
      await page.context().clearCookies();
      const token =
        "00000000-0000-4000-8000-000000000000.1795176000000." + "a".repeat(43);
      await abrir(page, `/revisar/whatsapp/${token}`, tema);
      await expect(page).toHaveURL(/\/entrar\?revision=/);
      await revisar("whatsapp-entrada-sin-sesion");
    });

    test(`axe: formularios, menús y confirmaciones, ${tema}, ${ancho}px`, async ({
      page,
    }, info) => {
      test.setTimeout(300000);
      const estado = await preparar(page, tema, ancho);
      const revisar = auditor(page, info, tema, ancho, "interacciones");
      await abrir(page, "/", tema);
      await abrirMasDestinos(page);
      await revisar("mas-destinos-abierto");
      await page.keyboard.press("Escape");
      await expect(
        page
          .getByRole("button", { name: "Más destinos", exact: true })
          .filter({ visible: true }),
      ).toBeFocused();
      await revisar("inicio-con-fabrica-visible");
      const cooper = await abrirCooper(page);
      await revisar("cooper-contextual-abierto");
      if (ancho === 360) {
        await cooper
          .getByRole("button", { name: "Ampliar Cooper", exact: true })
          .click();
        await revisar("cooper-hoja-completa");
        await cooper
          .getByRole("button", { name: "Reducir Cooper", exact: true })
          .click();
      }
      await cerrarCooper(page);

      await abrir(page, "/videos", tema);
      await page
        .getByRole("button", { name: "Pedir video", exact: true })
        .click();
      await revisar("pedir-video");
      await page
        .getByRole("button", { name: "Enviar a la fábrica", exact: true })
        .click();
      expect(
        await page
          .locator(".inline-form")
          .evaluate((el) => (el as HTMLFormElement).checkValidity()),
      ).toBe(false);
      await revisar("video-validacion-obligatorios");
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();

      await abrir(page, "/avatares", tema);
      await page
        .getByRole("button", { name: "Crear avatar", exact: true })
        .click();
      await expect(page.locator(".identity-form blockquote")).toContainText(
        "Mi frase es:",
      );
      await revisar("avatar-formulario-identidad");
      await page.getByRole("button", { name: "Voces", exact: true }).click();
      await revisar("catalogo-voces");
      await page
        .getByRole("button", { name: "Crear voz", exact: true })
        .click();
      await expect(page.locator(".identity-form blockquote")).toContainText(
        "Mi frase es:",
      );
      await revisar("voz-formulario-identidad");

      await abrir(page, "/referencias", tema);
      await page
        .getByText("Añadir o actualizar una referencia", { exact: true })
        .click();
      await revisar("referencia-formulario-abierto");
      await page
        .getByRole("button", { name: "Solicitar referencias pendientes" })
        .click();
      await expect(
        page.getByRole("region", { name: "Confirmar cambios" }),
      ).toBeVisible();
      await revisar("referencias-confirmacion");
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();

      await abrir(page, "/admin/fabrica", tema);
      await page
        .getByText("Editar controles de producción", { exact: true })
        .click();
      const voz = page.getByLabel("Voz", { exact: true });
      await voz.setChecked(!(await voz.isChecked()));
      await page.getByRole("button", { name: "Revisar ajustes" }).click();
      await expect(
        page.getByRole("region", { name: "Confirmar cambios" }),
      ).toBeVisible();
      await revisar("ajustes-confirmacion");
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();

      await abrir(page, "/perfil", tema);
      await page.getByRole("textbox", { name: /^WhatsApp/ }).fill("123");
      await page.getByRole("button", { name: "Guardar perfil" }).click();
      expect(
        await page
          .locator(".profile-form")
          .evaluate((el) => (el as HTMLFormElement).checkValidity()),
      ).toBe(false);
      await revisar("perfil-validacion-numero");

      await abrir(page, "/marcas", tema);
      await page
        .getByRole("button", {
          name: /^(Añadir marca o cuenta|Crear mi primera marca)$/,
        })
        .click();
      await revisar("marca-identidad");
      await page
        .getByRole("textbox", { name: "Nombre de la marca" })
        .fill("Marca accesible de ensayo");
      await page
        .getByRole("button", { name: "Continuar", exact: true })
        .click();
      await revisar("marca-guia-visual");
      await page
        .getByRole("button", { name: "Continuar", exact: true })
        .click();
      await revisar("marca-revision");
      // El guardado y su refresh usan respuestas tipadas del navegador. No se
      // guarda una marca en la base común ni se conecta una cuenta externa.
      const marcas: EstadoMarcas = await (
        await page.request.get("/api/marcas")
      ).json();
      const marca = marcaDeEnsayo(estado.user.id);
      await page.route("**/api/marcas", (route) =>
        route.fulfill({
          json:
            route.request().method() === "GET"
              ? { ...marcas, marcas: [marca] }
              : marca,
        }),
      );
      await page
        .getByRole("button", { name: "Guardar marca", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: marca.nombre, exact: true }),
      ).toBeVisible();
      await revisar("marca-calendario-poblado");
      await page.getByText("Crear una publicación", { exact: true }).click();
      await revisar("marca-editor-publicacion");
      await page.getByRole("button", { name: "Cerrar", exact: true }).click();
      const secciones = page.getByRole("navigation", {
        name: "Secciones de la marca",
      });
      await secciones
        .getByRole("button", { name: "Estudio", exact: true })
        .click();
      await page
        .getByText("Ver evidencia del historial", { exact: true })
        .click();
      await revisar("marca-estudio-historial");
      await secciones
        .getByRole("button", { name: "Publicados", exact: true })
        .click();
      await revisar("marca-publicados");
      await secciones
        .getByRole("button", { name: "Aprendizaje", exact: true })
        .click();
      await revisar("marca-aprendizaje");
    });

    test(`axe: vacíos, carga, errores y recuperación, ${tema}, ${ancho}px`, async ({
      page,
    }, info) => {
      test.setTimeout(300000);
      const estado = await preparar(page, tema, ancho);
      const revisar = auditor(page, info, tema, ancho, "estados");
      const operacion: Operacion = await (
        await page.request.get("/api/operacion")
      ).json();

      // Se mantiene el indicador real de carga mientras la respuesta está pendiente.
      let liberar!: () => void;
      const espera = new Promise<void>((resolve) => {
        liberar = resolve;
      });
      await page.route("**/api/operacion", async (route) => {
        await espera;
        await route.fulfill({ json: operacion });
      });
      await page.goto("/radar");
      await page
        .getByRole("button", { name: "Actualizar", exact: true })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "Consultando la fábrica…" }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", tema);
      try {
        await revisar("operacion-cargando");
      } finally {
        liberar();
      }
      await expect(
        page.getByText("Consultando la fábrica…", { exact: true }),
      ).toHaveCount(0);
      await page.unroute("**/api/operacion");

      await page.route("**/api/operacion", (route) =>
        route.fulfill({
          status: 503,
          json: {
            error:
              "No pudimos consultar la fábrica. Pulsa Actualizar para volver a intentarlo.",
          },
        }),
      );
      await abrir(page, "/avisos", tema);
      await page
        .getByRole("button", { name: "Actualizar", exact: true })
        .click();
      await expect(page.locator('.notice[role="alert"]')).toContainText(
        "Pulsa Actualizar",
      );
      await revisar("operacion-error-recuperable");
      await page.unroute("**/api/operacion");
      await page
        .getByRole("button", { name: "Actualizar", exact: true })
        .click();
      await expect(page.locator('.notice[role="alert"]')).toHaveCount(0);
      await revisar("operacion-recuperada");

      await abrir(page, "/perfil", tema);
      await page.route("**/api/perfil", (route) =>
        route.fulfill({
          status: 503,
          json: {
            error:
              "No pudimos guardar tu perfil. Conservamos los campos; vuelve a intentarlo.",
          },
        }),
      );
      await page.getByRole("button", { name: "Guardar perfil" }).click();
      await expect(page.locator('.notice[role="alert"]')).toContainText(
        "Conservamos los campos",
      );
      await revisar("perfil-error-de-guardado");
      await page.unroute("**/api/perfil");
      await page.getByRole("button", { name: "Guardar perfil" }).click();
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "Tu perfil está actualizado." }),
      ).toBeVisible();
      await revisar("perfil-confirmacion-guardado");

      // Las respuestas vacías son contratos reales sin registros. No se borra la
      // base demo, ni se modifica el estado de otras suites.
      const vacio: Estado = {
        ...estado,
        channels: [],
        videos: [],
        messages: [],
        assets: [],
      };
      await estadoFijo(page, vacio);
      const operacionVacia: Operacion = {
        ...operacion,
        canales: [],
        decisiones: [],
        publicaciones: [],
        avisos: [],
        fallos: [],
      };
      await page.route("**/api/operacion", (route) =>
        route.fulfill({ json: operacionVacia }),
      );
      const resultadosVacios: Resultados = {
        ambitos: [],
        publicaciones: [],
        aprendizajes: [],
        incidencias: [],
      };
      await page.route("**/api/resultados", (route) =>
        route.fulfill({ json: resultadosVacios }),
      );
      for (const [nombre, ruta] of [
        ["inicio-vacio", "/"],
        ["canales-vacios", "/canales"],
        ["videos-vacios", "/videos"],
        ["publicados-vacios", "/publicados"],
        ["aprendizaje-vacio", "/aprendizaje"],
        ...[
          "radar",
          "rutina",
          "redes",
          "referencias",
          "cuentas",
          "programados",
          "decisiones",
          "incidencias",
          "avisos",
        ].map((ruta) => [`${ruta}-vacio`, `/${ruta}`]),
      ]) {
        await abrir(page, ruta, tema);
        if (ruta === "/publicados" || ruta === "/aprendizaje") {
          // Resultados conserva su proyección SSR; el control público vuelve
          // a leer el contrato conjunto interceptado sin alterar la base.
          const [respuesta] = await Promise.all([
            page.waitForResponse(
              (r) => new URL(r.url()).pathname === "/api/resultados",
            ),
            page.getByRole("button", { name: "Actualizar resultados" }).click(),
          ]);
          expect(respuesta.ok()).toBe(true);
          await expect(
            page.getByRole("button", { name: "Actualizar resultados" }),
          ).toBeEnabled();
        } else if (!["/", "/canales", "/videos"].includes(ruta)) {
          const [respuesta] = await Promise.all([
            page.waitForResponse(
              (r) => new URL(r.url()).pathname === "/api/operacion",
            ),
            page
              .getByRole("button", { name: "Actualizar", exact: true })
              .click(),
          ]);
          expect(respuesta.ok()).toBe(true);
          await expect(
            page.getByRole("button", { name: "Actualizar", exact: true }),
          ).toBeEnabled();
        }
        // Esperar al estado vacío recibido, en lugar del HTML SSR poblado.
        if (ruta === "/")
          await expect(
            page.getByRole("heading", { name: "Una idea. Todo por crear." }),
          ).toBeVisible();
        else if (["/canales", "/videos"].includes(ruta))
          await expect(page.locator(".empty").first()).toBeVisible();
        else if (ruta === "/publicados")
          await expect(page.locator(".vacio").first()).toBeVisible();
        else if (ruta === "/aprendizaje")
          await expect(
            page.getByRole("heading", {
              name: "El próximo puede empezar mejor.",
            }),
          ).toBeVisible();
        await revisar(nombre);
        if (ruta === "/" && ancho === 360) {
          await abrirCooper(page);
          await revisar("cooper-sin-conversacion");
          await cerrarCooper(page);
        }
      }

      // Un 503 normal muestra un aviso recuperable. Para alcanzar error.tsx se
      // induce, exclusivamente en el navegador, un contrato SSE inválido. Se
      // conserva por separado el error previsto; no se toleran otros errores.
      const erroresInducidos: { tipo: string; mensaje: string }[] = [];
      page.on("pageerror", (error) =>
        erroresInducidos.push({
          tipo: "pageerror",
          mensaje: error.message,
        }),
      );
      page.on("console", (message) => {
        if (message.type() === "error")
          erroresInducidos.push({
            tipo: "console",
            mensaje: message.text(),
          });
      });
      await page.unroute("**/api/eventos");
      await page.route("**/api/eventos", (route) =>
        route.fulfill({
          contentType: "text/event-stream",
          body: `event: estado\ndata: ${JSON.stringify({ ...vacio, channels: null })}\n\n`,
        }),
      );
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "No pudimos cargar tu espacio." }),
      ).toBeVisible();
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, tema);
      await revisar("error-global-inducido-contrato-sse-invalido");
      writeFileSync(
        `${raiz}/estados-${tema}-${ancho}/error-global-previsto.json`,
        JSON.stringify(
          {
            causa:
              "Fixture SSE local con channels:null; no es una respuesta válida del servidor",
            erroresInducidos,
          },
          null,
          2,
        ) + "\n",
      );
      expect(erroresInducidos.length).toBeGreaterThan(0);
      for (const error of erroresInducidos)
        expect(error.mensaje).toMatch(/Cannot read properties of null/);
    });
  }
}
