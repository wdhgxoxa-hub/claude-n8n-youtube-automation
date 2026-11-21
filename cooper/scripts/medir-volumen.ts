import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";

async function main() {
  // No dotenv, ni base indicada por el entorno. Siempre un directorio nuevo.
  mkdirSync(".cache", { recursive: true });
  process.env.COOPER_DATABASE_PATH = resolve(
    mkdtempSync(".cache/volumen-"),
    "cooper.sqlite",
  );
  process.env.AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.AUTH_URL = "http://localhost:3000";
  process.env.COOPER_DEMO = "0";
  for (const name of [
    "FABRICA",
    "CHAT",
    "MARCAS",
    "MENSAJERIA",
    "AVATAR",
    "VOZ_CLONADA",
    "VOZ_CATALOGO",
    "TRANSCRIPCION",
  ])
    process.env[`COOPER_${name}`] = "simulada";
  globalThis.fetch = async () => {
    throw new Error("Red bloqueada en benchmark H19");
  };
  const { fixtureVolumen, AHORA_VOLUMEN } = await import("./fixture-volumen");
  const { estado } = await import("../src/servicios/datos");
  const { leerResultados } = await import("../src/servicios/resultados");
  const { cicloMensajeria } =
    await import("../src/servicios/mensajeria/trabajador");
  const { db } = await import("../src/db");
  const { whatsappOutbox } = await import("../src/db/schema");
  const equipo = fixtureVolumen(),
    admin = equipo[0],
    user = equipo[1];
  const hash = (v: unknown) =>
    createHash("sha256").update(JSON.stringify(v)).digest("hex");
  const huellas: Record<string, string> = {};
  const mediciones: Record<string, unknown> = {};
  // Presupuestos de laboratorio fijados antes de medir; no son SLA de producción.
  const limites = {
    lecturaMs: 1000,
    lecturaHeapMiB: 128,
    cicloMs: 250,
    cicloHeapMiB: 32,
  };
  let cumple = true;
  async function medir(
    nombre: string,
    accion: () => unknown | Promise<unknown>,
    ciclo = false,
  ) {
    await accion(); // calentamiento fuera de la muestra
    const muestras = [];
    for (let i = 0; i < 7; i++) {
      globalThis.gc?.();
      const antes = process.memoryUsage(),
        inicio = performance.now();
      const resultado = await accion();
      const ms = performance.now() - inicio,
        despues = process.memoryUsage();
      muestras.push({
        ms,
        heapDeltaMiB: (despues.heapUsed - antes.heapUsed) / 2 ** 20,
        rssAntesMiB: antes.rss / 2 ** 20,
        rssDespuesMiB: despues.rss / 2 ** 20,
      });
      if (!ciclo) {
        const actual = hash(resultado);
        if (huellas[nombre])
          assert.equal(actual, huellas[nombre], "Lectura inestable");
        huellas[nombre] = actual;
      }
    }
    const tiempos = muestras.map((m) => m.ms).sort((a, b) => a - b);
    const maxHeapMiB = Math.max(...muestras.map((m) => m.heapDeltaMiB));
    const dentro =
      tiempos[6] <= (ciclo ? limites.cicloMs : limites.lecturaMs) &&
      maxHeapMiB <= (ciclo ? limites.cicloHeapMiB : limites.lecturaHeapMiB);
    cumple &&= dentro;
    mediciones[nombre] = {
      muestras,
      medianaMs: tiempos[3],
      maxMs: tiempos[6],
      maxHeapMiB,
      cumple: dentro,
    };
  }
  const propio = estado(user);
  assert.equal(propio.videos.length, 1000);
  assert.equal(propio.messages.length, 100);
  assert(propio.videos.every((v) => v.ownerId === user.id));
  assert(
    propio.videos.every((v, i, a) => !i || a[i - 1].createdAt >= v.createdAt),
  );
  assert(
    propio.messages.every((v, i, a) => !i || a[i - 1].createdAt <= v.createdAt),
  );
  const resultados = leerResultados(user);
  assert.equal(resultados.publicaciones.length, 1000);
  assert(resultados.ambitos.every((a) => a.ownerId === user.id));
  assert(
    resultados.publicaciones.every(
      (p) =>
        p.tipo === "video" &&
        p.publicacion.historial[0].fecha <= p.publicacion.historial[1].fecha,
    ),
  );
  assert.equal(estado(admin).videos.length, 10000);
  assert.equal(leerResultados(admin).publicaciones.length, 10000);
  const avisosAntes = hash(db().select().from(whatsappOutbox).all());
  await medir("datos_usuario", () => estado(user));
  await medir("datos_admin", () => estado(admin));
  await medir("resultados_usuario", () => leerResultados(user));
  await medir("resultados_admin", () => leerResultados(admin));
  await medir("ciclo_estable", () => cicloMensajeria(AHORA_VOLUMEN), true);
  assert.equal(
    hash(db().select().from(whatsappOutbox).all()),
    avisosAntes,
    "El ciclo alteró avisos durables",
  );
  const salida = process.argv[2] ?? ".cache/volumen.json";
  writeFileSync(
    salida,
    JSON.stringify(
      {
        fecha: new Date().toISOString(),
        revision: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        node: process.version,
        fixture: {
          videos: 10000,
          mensajes: 10000,
          duenos: 10,
          canales: 100,
          avisos: db().select().from(whatsappOutbox).all().length,
        },
        memoria:
          "Delta heap y RSS al volver de cada llamada, GC previo; no pico por operación. maxRSS es del proceso completo con fixture/importaciones.",
        maxRssProcesoMiB: process.resourceUsage().maxRSS / 1024,
        limites,
        cumple,
        huellas,
        mediciones,
        verificaciones: [
          "aislamiento",
          "orden",
          "historial completo",
          "idempotencia durable",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`H19: ${salida}; presupuestos ${cumple ? "PASS" : "FAIL"}`);
  if (process.argv.includes("--exigir") && !cumple) process.exitCode = 1;
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
