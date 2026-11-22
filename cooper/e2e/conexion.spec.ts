import { expect, test } from "@playwright/test";
import {
  entrarConexion,
  esperarConexion,
  pausarRelojConexion,
  simularConexion,
} from "./conexion-harness";

test.describe("Conexión discreta y recuperación SSE", () => {
  test("inicio sano y latidos sin novedades mantienen la interfaz silenciosa", async ({
    page,
  }) => {
    const estado = await entrarConexion(page);
    await page.clock.install();
    await simularConexion(page, estado);
    await page.goto("/");
    await esperarConexion(page);
    await pausarRelojConexion(page);
    await page.clock.runFor(60_000);
    await esperarConexion(page);
    expect(
      await page.evaluate(() => window.__conexionEnsayo.registros.length),
    ).toBe(1);
    await expect(
      page.getByText(/^(Reconectando|Conectando|En vivo)$/),
    ).toHaveCount(0);
  });

  test("un corte breve se recupera sin mostrar una alerta", async ({
    page,
  }) => {
    const estado = await entrarConexion(page);
    await page.clock.install();
    await simularConexion(page, estado);
    await page.goto("/");
    await esperarConexion(page);
    await pausarRelojConexion(page);
    await page.evaluate(() => window.__conexionEnsayo.cortar());
    await page.clock.runFor(999);
    await expect(page.getByTestId("estado-conexion")).toHaveCount(0);
    await page.evaluate(() => {
      window.__conexionEnsayo.modo = "sana";
    });
    await page.clock.runFor(4_100);
    await esperarConexion(page);
    expect(
      await page.evaluate(() => window.__conexionEnsayo.maximasActivas),
    ).toBe(1);
  });

  test("un corte real espera más de cinco segundos y usa backoff acotado", async ({
    page,
  }) => {
    const estado = await entrarConexion(page);
    await page.clock.install();
    await simularConexion(page, estado);
    await page.goto("/");
    await esperarConexion(page);
    await pausarRelojConexion(page);
    const inicio = await page.evaluate(() => {
      window.__conexionEnsayo.cortar();
      return Date.now();
    });
    await page.clock.runFor(5_000);
    await expect(page.getByTestId("estado-conexion")).toHaveCount(0);
    await page.clock.runFor(2);
    await expect(page.getByTestId("estado-conexion")).toHaveText(
      "Sin conexión, reintentando",
    );
    await expect(page.locator(".connection-notice")).toHaveAttribute(
      "role",
      "status",
    );
    await page.clock.runFor(85_998);
    const registro = await page.evaluate(() => ({
      tiempos: window.__conexionEnsayo.registros.slice(1).map((r) => r.abierta),
      maximas: window.__conexionEnsayo.maximasActivas,
    }));
    expect(registro.tiempos.map((t) => t - inicio)).toEqual([
      1_000, 3_000, 7_000, 15_000, 31_000, 61_000, 91_000,
    ]);
    expect(registro.maximas).toBe(1);
    await page.evaluate(() => {
      window.__conexionEnsayo.modo = "sana";
    });
    await page.clock.runFor(30_000);
    await esperarConexion(page);
    // Solo una sesión estable reinicia la espera: recibir estado y volver a
    // caer enseguida no debe producir una tormenta de reconexiones.
    await page.clock.runFor(15_000);
    const recuperada = await page.evaluate(() => {
      window.__conexionEnsayo.cortar();
      return Date.now();
    });
    await page.clock.runFor(1_000);
    expect(
      await page.evaluate(
        () => window.__conexionEnsayo.registros.at(-1)!.abierta,
      ),
    ).toBe(recuperada + 1_000);
  });

  test("las conexiones que caen tras cada estado conservan el backoff", async ({
    page,
  }) => {
    const estado = await entrarConexion(page);
    await page.clock.install();
    await simularConexion(page, estado);
    await page.goto("/");
    await esperarConexion(page);
    await pausarRelojConexion(page);
    for (const demora of [1_000, 2_000, 4_000]) {
      const inicio = await page.evaluate(() => {
        window.__conexionEnsayo.cortar();
        window.__conexionEnsayo.modo = "sana";
        return Date.now();
      });
      await page.clock.runFor(demora);
      await esperarConexion(page);
      expect(
        await page.evaluate(
          () => window.__conexionEnsayo.registros.at(-1)!.abierta,
        ),
      ).toBe(inicio + demora);
    }
    expect(
      await page.evaluate(() => window.__conexionEnsayo.maximasActivas),
    ).toBe(1);
  });

  test("una apertura lenta y volver a la pestaña no anulan el backoff", async ({
    page,
  }) => {
    const estado = await entrarConexion(page);
    await page.clock.install();
    await simularConexion(page, estado);
    await page.goto("/");
    await esperarConexion(page);
    await pausarRelojConexion(page);
    await page.evaluate(() => {
      window.__conexionEnsayo.cortar();
      window.__conexionEnsayo.modo = "colgada";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Volver a la pestaña conserva el reintento pendiente, sin una conexión extra.
    expect(
      await page.evaluate(() => window.__conexionEnsayo.registros.length),
    ).toBe(1);
    await page.clock.runFor(1_000);
    await page.clock.runFor(14_000);
    await page.evaluate((estado) => {
      window.__conexionEnsayo.emitir("open");
      window.__conexionEnsayo.emitir("estado", estado);
    }, estado);
    await esperarConexion(page);
    await page.clock.runFor(2_000);
    const corte = await page.evaluate(() => {
      window.__conexionEnsayo.cortar();
      return Date.now();
    });
    await page.clock.runFor(1_999);
    expect(
      await page.evaluate(() => window.__conexionEnsayo.registros.length),
    ).toBe(2);
    await page.clock.runFor(1);
    expect(
      await page.evaluate(
        () => window.__conexionEnsayo.registros.at(-1)!.abierta,
      ),
    ).toBe(corte + 2_000);
  });

  test("reconectar conserva el cursor del último progreso recibido", async ({
    page,
  }) => {
    const estado = await entrarConexion(page);
    await page.clock.install();
    await simularConexion(page, estado);
    await page.goto("/");
    await esperarConexion(page);
    await pausarRelojConexion(page);
    await page.evaluate(() => {
      window.__conexionEnsayo.emitir("progreso", {}, "evento-001");
      window.__conexionEnsayo.cortar();
      window.__conexionEnsayo.modo = "sana";
    });
    await page.clock.runFor(1_000);
    await esperarConexion(page);
    const url = await page.evaluate(
      () => window.__conexionEnsayo.registros.at(-1)!.url,
    );
    expect(
      new URL(url, "http://127.0.0.1").searchParams.get("ultimoEvento"),
    ).toBe("evento-001");
  });

  test("una apertura colgada no queda conectando para siempre", async ({
    page,
  }) => {
    const estado = await entrarConexion(page);
    await page.clock.install();
    await simularConexion(page, estado, "colgada");
    await page.goto("/");
    await expect
      .poll(() => page.evaluate(() => window.__conexionEnsayo.registros.length))
      .toBe(1);
    await pausarRelojConexion(page);
    await page.clock.runFor(5_000);
    await expect(page.getByTestId("estado-conexion")).toHaveCount(0);
    await page.clock.runFor(16_000);
    await expect(page.getByTestId("estado-conexion")).toHaveText(
      "Sin conexión, reintentando",
    );
    expect(
      await page.evaluate(() => window.__conexionEnsayo.registros.length),
    ).toBeGreaterThan(1);
    await page.evaluate(() => {
      window.__conexionEnsayo.modo = "sana";
    });
    await page.clock.runFor(30_000);
    await esperarConexion(page);
  });

  test("un fallo desde el primer intento también avisa y se recupera", async ({
    page,
  }) => {
    const estado = await entrarConexion(page);
    await page.clock.install();
    await simularConexion(page, estado, "fallo");
    await page.goto("/");
    await expect(page.locator(".workspace")).toHaveAttribute(
      "data-conexion",
      "interrumpida",
    );
    await pausarRelojConexion(page);
    await expect(page.getByTestId("estado-conexion")).toHaveCount(0);
    await page.clock.runFor(5_100);
    await expect(page.getByTestId("estado-conexion")).toHaveText(
      "Sin conexión, reintentando",
    );
    await page.evaluate(() => {
      window.__conexionEnsayo.modo = "sana";
    });
    await page.clock.runFor(8_000);
    await esperarConexion(page);
    expect(
      await page.evaluate(() => window.__conexionEnsayo.maximasActivas),
    ).toBe(1);
  });

  test("el watchdog recupera un stream abierto que deja de emitir", async ({
    page,
  }) => {
    const estado = await entrarConexion(page);
    await page.clock.install();
    await simularConexion(page, estado);
    await page.goto("/");
    await esperarConexion(page);
    await pausarRelojConexion(page);
    await page.evaluate(() => {
      window.__conexionEnsayo.modo = "colgada";
    });
    await page.clock.runFor(51_000);
    await expect(page.getByTestId("estado-conexion")).toHaveText(
      "Sin conexión, reintentando",
    );
    expect(
      await page.evaluate(() => window.__conexionEnsayo.registros.length),
    ).toBeGreaterThan(1);
    await page.evaluate(() => {
      window.__conexionEnsayo.modo = "sana";
    });
    await page.clock.runFor(30_000);
    await esperarConexion(page);
  });

  test("fallo del relé con latidos activos no finge una desconexión", async ({
    page,
  }) => {
    const estado = await entrarConexion(page);
    await page.clock.install();
    await simularConexion(page, estado);
    await page.goto("/");
    await esperarConexion(page);
    await pausarRelojConexion(page);
    await page.evaluate(() => window.__conexionEnsayo.emitir("fallo"));
    await page.clock.runFor(20_000);
    await esperarConexion(page);
    expect(
      await page.evaluate(() => window.__conexionEnsayo.registros.length),
    ).toBe(1);
  });

  test("corte de red real del navegador y regreso online recuperan el SSE", async ({
    page,
    context,
  }) => {
    await entrarConexion(page);
    await page.goto("/");
    await esperarConexion(page);
    await context.setOffline(true);
    await expect(page.getByTestId("estado-conexion")).toHaveCount(0);
    await expect(page.getByTestId("estado-conexion")).toHaveText(
      "Sin conexión, reintentando",
      { timeout: 8_000 },
    );
    await context.setOffline(false);
    await esperarConexion(page);
    await expect(page.locator(".workspace")).toHaveAttribute(
      "data-conexion",
      "activa",
    );
  });
});
