import { expect, it, vi } from "vitest";
import { descargar } from "@/servicios/proveedores/http";
import { observarImagenes } from "@/servicios/marcas/visual";
import type { Historica } from "@/servicios/marcas/tipos";

it.each([
  "http://files.heygen.ai/a.mp4",
  "https://127.0.0.1/a.mp4",
  "https://[::1]/a.mp4",
  "https://169.254.169.254/latest/meta-data/",
  "https://files.heygen.ai.evil.test/a.mp4",
  "https://files.heygen.ai@evil.test/a.mp4",
  "https://files.heygen.ai:8443/a.mp4",
  "file:///etc/passwd",
])("no hace una petición de vista previa al destino %s", async (url) => {
  const transport = vi.fn<typeof fetch>();
  await expect(descargar(url, transport)).rejects.toMatchObject({
    status: 502,
  });
  expect(transport).not.toHaveBeenCalled();
});
it("deshabilita redirecciones del CDN autorizado", async () => {
  const transport = vi.fn<typeof fetch>(async (_url, init) => {
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    return new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/" },
    });
  });
  await expect(
    descargar("https://files.heygen.ai/a.mp4", transport),
  ).rejects.toMatchObject({ status: 502 });
  expect(transport).toHaveBeenCalledTimes(1);
});
it("rechaza destinos internos y sufijos falsos en imágenes de Marcas", async () => {
  const transport = vi.fn<typeof fetch>();
  const urls = [
    "https://localhost/a.jpg",
    "https://169.254.169.254/a.jpg",
    "https://fbcdn.net.evil.test/a.jpg",
    "https://cdninstagram.com@evil.test/a.jpg",
    "https://cdninstagram.com:8443/a.jpg",
  ];
  const rows: Historica[] = urls.map((imagen) => ({
    id: "prueba",
    texto: "",
    fecha: "",
    tipo: "IMAGE",
    imagen,
    metricas: {
      vistas: null,
      alcance: null,
      interacciones: null,
      capturadas: 0,
    },
  }));
  await observarImagenes(rows, transport);
  expect(transport).not.toHaveBeenCalled();
});
