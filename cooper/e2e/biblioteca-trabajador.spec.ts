import { test, expect, type APIRequestContext } from "@playwright/test";
import { VozSimulada } from "../src/servicios/proveedores/simulados";

test("la biblioteca termina con la ventana cerrada, sin SSE ni consultas que impulsen el trabajo", async ({
  browser,
  playwright,
  baseURL,
}) => {
  const context = await browser.newContext({ baseURL });
  const login = async (request: APIRequestContext, email: string) => {
    expect(
      (
        await request.post(
          `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
          {
            data: { email, secret: process.env.COOPER_E2E_SECRET },
          },
        )
      ).status(),
    ).toBe(200);
  };
  const post = async (path: string, data: unknown) => {
    const response = await context.request.post(path, { data });
    expect(response.status()).toBe(200);
    return response.json();
  };
  try {
    await login(context.request, "admin@example.test");
    await post("/api/admin/permitidos", {
      email: "biblioteca-m07@example.test",
    });
    await login(context.request, "biblioteca-m07@example.test");
    const window = await context.newPage();
    await window.goto("/avatares");
    await window.close();
    const challenge = await post("/api/identidad", { kind: "voz" });
    const evidence = await post("/api/archivos", {
      name: "Voz ficticia.wav",
      mime: "audio/wav",
      data: new VozSimulada().muestra().toString("base64"),
    });
    const asset = await post("/api/activos", {
      kind: "voz",
      name: "Voz sin navegador",
      challengeId: challenge.id,
      evidenceId: evidence.id,
      photoIds: [],
      placement: "partes",
      consentimiento: true,
    });
    const initial = await (await context.request.get("/api/estado")).json();
    expect(
      initial.assets.find((a: { id: string }) => a.id === asset.id).status,
    ).toBe("entrenando");
    const storageState = await context.storageState();
    await context.close();
    // Ninguna página permanece abierta. Esta API solo lee estado, no sondea proveedores.
    const reader = await playwright.request.newContext({
      baseURL,
      storageState,
    });
    try {
      await expect
        .poll(
          async () => {
            const state = await (await reader.get("/api/estado")).json();
            return state.assets.find((a: { id: string }) => a.id === asset.id)
              ?.status;
          },
          { timeout: 20000, intervals: [1000] },
        )
        .toBe("listo");
    } finally {
      await reader.dispose();
    }
  } finally {
    await context.close();
  }
});
