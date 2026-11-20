import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  proveedorAvatar,
  proveedorVoz,
  proveedorCatalogoVoz,
  proveedorTranscripcion,
} from "@/servicios/proveedores";
import { administracionActual } from "@/servicios/datos";
import { FabricaN8n } from "@/servicios/fabrica";
import { proveedorChat } from "@/servicios/chat";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function owner() {
  const id = randomUUID();
  return db()
    .insert(users)
    .values({ id, email: `${id}@example.test`, name: "Ensayo", role: "admin" })
    .returning()
    .get();
}
it("I01 demo mantiene medios, chat y gastos simulados aunque el entorno seleccione proveedores reales", async () => {
  const user = owner();
  vi.stubEnv("COOPER_DEMO", "1");
  vi.stubEnv("COOPER_FABRICA", "n8n");
  vi.stubEnv("COOPER_AVATAR", "heygen");
  vi.stubEnv("COOPER_VOZ_CLONADA", "elevenlabs");
  vi.stubEnv("COOPER_VOZ_CATALOGO", "gemini");
  vi.stubEnv("COOPER_TRANSCRIPCION", "gemini");
  const costs = vi
    .spyOn(FabricaN8n.prototype, "gastos")
    .mockResolvedValue({ gastos: [], estimados: true });
  const chat = vi
    .spyOn(FabricaN8n.prototype, "consultar")
    .mockResolvedValue("Remoto");
  expect(
    [
      proveedorAvatar(),
      proveedorVoz(),
      proveedorCatalogoVoz(),
      proveedorTranscripcion(),
    ].every((p) => p.simulada),
  ).toBe(true);
  expect((await administracionActual(user)).fuente).toBe("simulada");
  await proveedorChat.responder(user, { texto: "reporte", adjuntos: [] });
  expect(costs).not.toHaveBeenCalled();
  expect(chat).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
