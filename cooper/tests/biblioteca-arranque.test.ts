import { afterEach, expect, it, vi } from "vitest";
import { register } from "@/instrumentation";
import { iniciarBiblioteca } from "@/servicios/biblioteca-trabajador";
import { iniciarMensajeria } from "@/servicios/mensajeria/trabajador";
vi.mock("@/servicios/biblioteca-trabajador", () => ({
  iniciarBiblioteca: vi.fn(),
}));
vi.mock("@/servicios/mensajeria/trabajador", () => ({
  iniciarMensajeria: vi.fn(),
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("arranca la biblioteca en Node aunque WhatsApp esté pausado", async () => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("NEXT_PHASE", "phase-production-server");
  vi.stubEnv("COOPER_MENSAJERIA_PAUSA", "1");
  await register();
  expect(iniciarBiblioteca).toHaveBeenCalledOnce();
  expect(iniciarMensajeria).not.toHaveBeenCalled();
});
it("la pausa explícita de biblioteca conserva el trabajador de avisos", async () => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("COOPER_BIBLIOTECA_PAUSA", "1");
  await register();
  expect(iniciarBiblioteca).not.toHaveBeenCalled();
  expect(iniciarMensajeria).toHaveBeenCalledOnce();
});
it.each(["edge", "build"])(
  "no inicia trabajadores durante %s",
  async (mode) => {
    vi.stubEnv("NEXT_RUNTIME", mode === "edge" ? "edge" : "nodejs");
    vi.stubEnv(
      "NEXT_PHASE",
      mode === "build" ? "phase-production-build" : "phase-production-server",
    );
    await register();
    expect(iniciarBiblioteca).not.toHaveBeenCalled();
    expect(iniciarMensajeria).not.toHaveBeenCalled();
  },
);
