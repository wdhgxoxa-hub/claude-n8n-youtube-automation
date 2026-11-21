import { test, expect } from "@playwright/test";

test("respuesta completa mantiene la boca y la espera se puede cancelar", async ({
  page,
}) => {
  const session = await page.request.post(
    `http://127.0.0.1:${process.env.COOPER_E2E_FIXTURE_PORT}/sesion`,
    {
      data: {
        email: "admin@example.test",
        secret: process.env.COOPER_E2E_SECRET,
      },
    },
  );
  expect(session.ok()).toBe(true);
  await page.goto("/");
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'data: {"tipo":"texto","texto":"Tu estudio está listo. Puedes consultar el avance de tus videos y revisar las aprobaciones pendientes."}\n\ndata: {"tipo":"fin"}\n\n',
    });
  });
  await page.getByLabel("Mensaje para Cooper").fill("Consulta de estado");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.getByLabel("Mensaje para Cooper")).toBeEnabled();
  await expect(
    page.locator(".chat-heading").getByRole("img", { name: "Cooper hablando", exact: true }),
  ).toHaveAttribute("data-cooper-state", "hablando");
  await expect(
    page.locator(".chat-heading").getByRole("img", { name: "Cooper reposo", exact: true }),
  ).toHaveAttribute("data-cooper-state", "reposo", { timeout: 8000 });
  await page.unroute("**/api/chat");
  // Fetch que espera a la cancelación, sin enviar una petición al servidor.
  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = (input, init) =>
      input === "/api/chat"
        ? new Promise((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Cancelado", "AbortError")),
              { once: true },
            );
          })
        : original(input, init);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Mensaje para Cooper").fill("Otra consulta de estado");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(
    page.getByRole("button", { name: "Cancelar espera" }),
  ).toBeVisible();
  await expect(
    page.getByText("Sigo preparando tu respuesta. Puedes cancelar la espera."),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Cancelar espera" }).click();
  await expect(
    page.getByText(
      "Cancelaste la espera. Revisa las tarjetas pendientes antes de repetir el pedido.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
