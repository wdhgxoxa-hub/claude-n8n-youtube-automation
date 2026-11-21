import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { prepararSentinel } from "./sentinel-cache.mjs";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  comprobarHerramientas,
  entornoLimpio,
  raiz,
} from "./entorno-pruebas.mjs";

export function avisos(texto) {
  return texto
    .split("\n")
    .filter((line) =>
      /\b(?:npm warn|warning:|\w*Warning:|WARN\b)|⚠|BEWARE:/.test(line),
    );
}
export function comprobarResultados(unitarias, e2e, flujos) {
  // Node 24 puede elegir spec incluso con stdout por pipe; ambos reporteros
  // oficiales conservan el mismo resumen, con prefijo ℹ o # respectivamente.
  flujos = flujos.replace(/^ℹ /gm, "# ");
  if (
    !unitarias.success ||
    unitarias.numFailedTests ||
    unitarias.numPendingTests ||
    unitarias.numTodoTests ||
    !unitarias.numPassedTests
  )
    throw new Error("Unitarias con fallos, omisiones o sin pruebas.");
  if (
    !e2e.stats?.expected ||
    e2e.stats.unexpected ||
    e2e.stats.skipped ||
    e2e.stats.flaky ||
    e2e.errors?.length
  )
    throw new Error("E2E con fallos, omisiones, reintentos o sin pruebas.");
  if (
    !/^# pass [1-9]\d*$/m.test(flujos) ||
    !/^# fail 0$/m.test(flujos) ||
    !/^# skipped 0$/m.test(flujos) ||
    !/^# todo 0$/m.test(flujos) ||
    !/^# cancelled 0$/m.test(flujos)
  )
    throw new Error("Flujos con fallos, omisiones o sin pruebas.");
  return {
    unitarias: unitarias.numPassedTests,
    e2e: e2e.stats.expected,
    flujos: Number(flujos.match(/^# pass (\d+)$/m)[1]),
  };
}

async function main() {
  prepararSentinel();
  const salida = resolve(raiz, ".cache/puerta");
  mkdirSync(salida, { recursive: true });
  const env = { ...entornoLimpio(), COOPER_CI_REPORTES: "1" };
  const informe = {
    inicio: new Date().toISOString(),
    herramientas: {},
    pasos: [],
    resultado: "FAIL",
  };
  const procedencia = resolve(raiz, "../ci-origen.json");
  if (existsSync(procedencia))
    informe.origen = JSON.parse(readFileSync(procedencia, "utf8"));
  const guardar = () =>
    writeFileSync(
      resolve(salida, "resultado.json"),
      JSON.stringify(informe, null, 2) + "\n",
    );
  async function paso(nombre, cmd, args, cwd = raiz) {
    const start = Date.now();
    let log = "";
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    const parar = () => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* ya terminado */
      }
    };
    process.once("SIGTERM", parar);
    process.once("SIGINT", parar);
    const timer = setTimeout(parar, 30 * 60 * 1000);
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (data) => {
        log += data;
        process.stdout.write(data);
      });
    const code = await new Promise((done) => {
      child.once("error", () => done(1));
      child.once("close", (code) => done(code ?? 1));
    });
    clearTimeout(timer);
    process.removeListener("SIGTERM", parar);
    process.removeListener("SIGINT", parar);
    log = log.replace(/\x1b\[[0-9;]*m/g, "");
    writeFileSync(resolve(salida, `${nombre}.log`), log);
    const warnings = avisos(log).length;
    informe.pasos.push({
      nombre,
      comando: [cmd, ...args].join(" "),
      rc: code,
      advertencias: warnings,
      duracion_ms: Date.now() - start,
      sha256: createHash("sha256").update(log).digest("hex"),
    });
    guardar();
    if (code !== 0 || warnings)
      throw new Error(
        `${nombre}: rc ${code}, ${warnings} advertencias. Consulte .cache/puerta/${nombre}.log.`,
      );
  }
  try {
    informe.herramientas = comprobarHerramientas();
    await paso("ci", "npm", ["ci"]);
    await paso("preparacion", process.execPath, [
      "scripts/preparar-pruebas.mjs",
    ]);
    await paso("lint", "npm", ["run", "lint"]);
    await paso("typecheck", "npm", ["run", "typecheck"]);
    await paso("unitarias", "npm", ["test"]);
    await paso("e2e", "npm", ["run", "test:e2e"]);
    await paso("build", "npm", ["run", "build"]);
    await paso(
      "flujos",
      process.execPath,
      ["--test", "tests/flujos_v2.test.cjs"],
      resolve(raiz, ".."),
    );
    informe.pruebas = comprobarResultados(
      JSON.parse(readFileSync(resolve(salida, "vitest.json"), "utf8")),
      JSON.parse(readFileSync(resolve(salida, "playwright.json"), "utf8")),
      readFileSync(resolve(salida, "flujos.log"), "utf8"),
    );
    informe.resultado = "PASS";
  } catch (error) {
    informe.error = error.message;
    throw error;
  } finally {
    informe.fin = new Date().toISOString();
    guardar();
  }
  console.log(
    `Puerta completa: PASS; ${JSON.stringify(informe.pruebas)}; cero advertencias y omisiones.`,
  );
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
