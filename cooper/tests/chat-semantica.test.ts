import { expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { db } from "@/db";
import { chatActions } from "@/db/schema";
import { ErrorHttp } from "@/lib/permisos";
import type {
  EntradaModelo,
  MensajeModelo,
  ProveedorChat,
} from "@/servicios/chat/tipos";
import {
  Observador,
  brevedad,
  criteriosMemoria,
  errorSeguro,
  evaluar,
  seleccion,
  casosMemoria,
  estadisticas,
} from "../scripts/evaluacion-chat";
import guiones from "./fixtures/chat-30.json";
const entrada: EntradaModelo = { sistema: "", herramientas: [], mensajes: [] };
const modelo = (f: (e: EntradaModelo) => MensajeModelo): ProveedorChat => ({
  async *generar(e) {
    yield { tipo: "fin", mensaje: f(e) };
  },
});

it("rechaza selección, argumentos semánticos evidentes y ejecuciones inventadas", () => {
  expect(
    seleccion(guiones[0], {
      role: "assistant",
      texto: "He creado el canal.",
      llamadas: [{ id: "1", nombre: "eliminar", argumentos: {} }],
    }),
  ).toEqual({ seleccion: false, noAfirmaEjecucion: false });
  expect(
    seleccion(guiones[24], { role: "assistant", texto: "", llamadas: [] })
      .respuestaPresente,
  ).toBe(false);
  expect(brevedad("").brevedad).toBe("NA");
  expect(brevedad("Una. Dos. Tres.").brevedad).toBe("FAIL");
  expect(brevedad("Revisa tu tarjeta antes de confirmar.").brevedad).toBe(
    "PASS",
  );
  expect(brevedad("palabra ".repeat(41)).brevedad).toBe("FAIL");
});
it("detecta corrección ausente, recuerdo inventado y ambigüedad resuelta sin preguntar", () => {
  expect(criteriosMemoria(32, "Faros de papel, un minuto").corregida).toBe(
    false,
  );
  expect(criteriosMemoria(34, "No recuerdo").recuerdaTitulo).toBe(false);
  expect(criteriosMemoria(36, "Vamos con Faros de papel").aclara).toBe(false);
  expect(
    criteriosMemoria(37, "Faros de papel de 90 segundos").noRecuperaOlvidado,
  ).toBe(false);
});
it("mide respuesta y síntesis separadas y respeta cuota antes de invocar", async () => {
  const invocaciones = vi.fn(() => ({
    role: "assistant" as const,
    texto: "Respuesta.",
  }));
  const observador = new Observador(modelo(invocaciones), 2);
  for await (const e of observador.generar(entrada, AbortSignal.timeout(1000)))
    expect(e.tipo).toBe("fin");
  observador.fase = "sintesis";
  for await (const e of observador.generar(entrada, AbortSignal.timeout(1000)))
    expect(e.tipo).toBe("fin");
  await expect(async () => {
    for await (const e of observador.generar(
      entrada,
      AbortSignal.timeout(1000),
    ))
      void e;
  }).rejects.toThrow();
  expect(invocaciones).toHaveBeenCalledTimes(2);
  expect(observador.mediciones.map((m) => m.fase)).toEqual([
    "respuesta",
    "sintesis",
  ]);
  expect(observador.detenido).toBe("CUOTA_LOCAL");
});
it("no registra errores privados y corta después de tres fallos sin reintentar", async () => {
  const f = vi.fn(() => {
    throw new Error("mensaje remoto que no debe guardarse");
  });
  const observador = new Observador(modelo(f));
  for (let i = 0; i < 4; i++)
    await expect(async () => {
      for await (const e of observador.generar(
        entrada,
        AbortSignal.timeout(1000),
      ))
        void e;
    }).rejects.toThrow();
  expect(f).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(observador.mediciones)).not.toContain("mensaje remoto");
  expect(errorSeguro(new ErrorHttp(504, "detalle privado"))).toBe("HTTP_504");
});
it("propaga la cancelación y conserva el error medido", async () => {
  vi.useFakeTimers();
  try {
    const proveedor: ProveedorChat = {
      async *generar(_e, signal) {
        await new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        );
        yield { tipo: "fin", mensaje: { role: "assistant", texto: "" } };
      },
    };
    const observador = new Observador(proveedor);
    // AbortSignal.timeout usa reloj nativo; la señal de cancelación se controla de forma determinista.
    const control = new AbortController();
    const espera = (async () => {
      for await (const e of observador.generar(entrada, control.signal)) void e;
    })();
    const rechazo = expect(espera).rejects.toThrow();
    control.abort(new DOMException("cancelado", "AbortError"));
    await rechazo;
    expect(observador.mediciones[0]).toMatchObject({
      estado: "ERROR",
      error: "TIEMPO_AGOTADO",
    });
  } finally {
    vi.useRealTimers();
  }
});
it("reutiliza los 30 casos y registra NOT_RUN explícito al agotar cuota", async () => {
  const previo = db().select().from(chatActions).all();
  const salida = await evaluar(
    modelo(() => ({
      role: "assistant",
      texto: "He creado todo.",
      llamadas: [
        { id: "x", nombre: "eliminar", argumentos: { tipo: "video" } },
      ],
    })),
    { maximo: 1 },
  );
  expect(salida.resultados).toHaveLength(37);
  expect(salida.resultados.slice(0, 30).map((r) => r.texto)).toEqual(
    guiones.map((g) => g.texto),
  );
  expect(salida.resultados[0].estado).toBe("FAIL");
  expect(salida.resultados.slice(1).every((r) => r.estado === "NOT_RUN")).toBe(
    true,
  );
  expect(db().select().from(chatActions).all()).toEqual(previo);
});
it("recorre memoria, retorno y olvido con proveedor ficticio sin confundirlo con evaluación real", async () => {
  const proveedor = modelo((e) => {
    if (!e.herramientas.length) {
      const { anterior, usuario } = JSON.parse(e.mensajes[0].texto);
      const r = structuredClone(anterior);
      if (usuario === casosMemoria[1].texto)
        r.preferencias = ["Videos de noventa segundos"];
      if (usuario === casosMemoria[2].texto) r.pendientes = [];
      return { role: "assistant", texto: JSON.stringify(r) };
    }
    const texto = e.mensajes.at(-1)!.texto;
    if (texto === casosMemoria[3].texto)
      return {
        role: "assistant",
        texto: "Faros de papel, con videos de noventa segundos.",
      };
    if (texto === casosMemoria[5].texto)
      return {
        role: "assistant",
        texto: "¿Retomamos Faros de papel o Ríos de cobre?",
      };
    if (texto === casosMemoria[6].texto)
      return {
        role: "assistant",
        texto: "No tengo ese recuerdo; dime el título y la duración.",
      };
    return { role: "assistant", texto: "Sin ejecutar acciones." };
  });
  const salida = await evaluar(proveedor);
  expect(
    salida.resultados.slice(30).map((r) => [r.id, r.estado, r.controles]),
  ).toEqual(casosMemoria.map((g) => [g.id, "PASS", expect.any(Object)]));
  expect(
    salida.resultados.every(
      (r) => r.controles.sinMutaciones && r.controles.contextoAislado,
    ),
  ).toBe(true);
  expect(salida.llamadas).toBe(37);
  const stats = estadisticas(salida.resultados);
  expect(stats.sintesis.n).toBe(4);
  expect(stats.respuesta.n).toBe(33);
  mkdirSync(".cache/total-m09", { recursive: true });
  writeFileSync(
    ".cache/total-m09/arnes-determinista.json",
    JSON.stringify(
      {
        proveedor: "ficticio",
        nota: "Prueba del arnés; no mide acierto de un modelo real",
        ...salida,
        estadisticas: stats,
      },
      null,
      2,
    ),
  );
});
it("un JSON de síntesis inválido queda FAIL y conserva apuntes", async () => {
  const salida = await evaluar(
    modelo(() => ({ role: "assistant", texto: "no es JSON" })),
  );
  expect(salida.resultados[30].estado).toBe("FAIL");
  expect(salida.resultados[30].controles.sintesisAceptada).toBe(false);
  expect(JSON.stringify(salida.resultados[30].memoria)).toContain(
    "Faros de papel",
  );
});

it("distingue una preferencia antigua citada como historia de una preferencia aún vigente", () => {
  const corregida =
    "Faros de papel. Prefiere videos de noventa segundos (corrige la preferencia anterior de un minuto).";
  expect(criteriosMemoria(32, corregida).anteriorRetirada).toBe(true);
  expect(
    criteriosMemoria(
      32,
      "Faros de papel. Prefiere un minuto. Prefiere noventa segundos.",
    ).anteriorRetirada,
  ).toBe(false);
  expect(
    criteriosMemoria(
      34,
      "No recuerdo Faros de papel; no eran noventa segundos.",
    ).recuerdaTitulo,
  ).toBe(false);
  expect(
    criteriosMemoria(
      34,
      "No recuerdo Faros de papel; no eran noventa segundos.",
    ).recuerdaCorreccion,
  ).toBe(false);
});
it("una síntesis vacía válida no se confunde con un fallo de transporte", async () => {
  const salida = await evaluar(
    modelo(() => ({
      role: "assistant",
      texto: JSON.stringify({
        pendientes: [],
        videos: [],
        decisiones: [],
        preferencias: [],
      }),
    })),
  );
  expect(salida.resultados[30].estado).toBe("FAIL");
  expect(salida.resultados[30].controles.sintesisAceptada).toBe(true);
  expect(salida.resultados[30].controles.idea).toBe(false);
  expect(salida.resultados[30].mediciones[0].estado).toBe("OK");
});
