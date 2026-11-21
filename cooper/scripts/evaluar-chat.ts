import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

async function main() {
  const args = process.argv.slice(2);
  const real = args.includes("--real");
  if (
    args.some((a) => !["--real", "--autorizar-plan"].includes(a)) ||
    real !== args.includes("--autorizar-plan")
  ) {
    console.error("Uso: npm run evaluar:chat [-- --real --autorizar-plan]");
    process.exitCode = 1;
    return;
  }
  // Solo entorno imprescindible del proceso local; no dotenv, claves API ni configuración de producción.
  const permitidas = new Set(["PATH", "HOME", "LANG", "TMPDIR"]);
  for (const key of Object.keys(process.env))
    if (!permitidas.has(key)) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: "production" });
  mkdirSync(".cache/total-m09", { recursive: true });
  const directorio = mkdtempSync(resolve(".cache/total-m09/evaluacion-"));
  process.env.COOPER_DATABASE_PATH = resolve(directorio, "ficticia.sqlite");
  process.env.COOPER_FABRICA = "simulada";
  process.env.COOPER_CHAT_API_RESPALDO = "0";
  process.env.COOPER_CHAT = "simulada";
  globalThis.fetch = async () => {
    throw new Error("HTTP bloqueado en evaluación M09");
  };
  const { evaluar, casosMemoria, estadisticas, limites } =
    await import("./evaluacion-chat");
  const { default: conversaciones } =
    await import("../tests/fixtures/chat-30.json");
  const casos = [...conversaciones, ...casosMemoria];
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const informe = {
    version: 1,
    revision,
    fecha: new Date().toISOString(),
    proveedor: "claude-cli",
    modo: real ? "real" : "preparacion",
    estado: "NOT_RUN",
    llamadas: 0,
    limites,
    nota: "Rúbrica automática orientativa, revisar respuestas por caso. Una sola muestra; no es aceptación semántica ni latencia de red/SSE. El tiempo del proveedor incluye arranque y autenticación del CLI. Sin herramientas ejecutadas ni respaldo API.",
    resultados: casos.map((g) => ({
      id: g.id,
      tipo: g.tipo,
      texto: g.texto,
      estado: "NOT_RUN",
      error: "SIN_EJECUCION_REAL",
    })) as unknown[],
  };
  const guardar = (extra = {}) =>
    writeFileSync(
      resolve(directorio, "resultado.json"),
      JSON.stringify({ ...informe, ...extra }, null, 2) + "\n",
    );
  guardar();
  console.log(`Evidencia: ${directorio}/resultado.json`);
  if (!real) {
    console.log(
      "NOT_RUN: preparación sin invocar proveedor. Primero ejecutar las pruebas deterministas.",
    );
    return;
  }
  const { ChatClaudeCli } = await import("../src/servicios/chat/locales");
  const proveedor = new ChatClaudeCli();
  if (!(await proveedor.disponible(AbortSignal.timeout(5000)))) {
    informe.estado = "ENV_BLOCKED";
    informe.resultados = casos.map((g) => ({
      id: g.id,
      tipo: g.tipo,
      texto: g.texto,
      estado: "NOT_RUN",
      error: "SESION_PLAN_NO_DISPONIBLE",
    }));
    guardar();
    console.log(
      "ENV_BLOCKED: sesión de plan no disponible; sin login ni respaldo.",
    );
    process.exitCode = 3;
    return;
  }
  const { resultados, llamadas } = await evaluar(proveedor, {
    alTerminar: (r) => {
      informe.resultados[r.id - 1] = r;
      informe.estado = "EN_CURSO";
      informe.llamadas += r.mediciones.length;
      guardar();
      console.log(
        `Caso ${r.id}: ${r.estado}; ${r.mediciones.map((m) => `${m.fase} ${Math.round(m.proveedorMs)} ms`).join(", ")}`,
      );
    },
  });
  informe.llamadas = llamadas;
  informe.estado = resultados.every((r) => r.estado === "PASS")
    ? "PASS_RUBRICA"
    : "CON_HALLAZGOS";
  guardar({ estadisticas: estadisticas(resultados) });
  console.log(
    `${informe.estado}: ${llamadas} llamadas. Revisar resultado.json; los fallos reales no se convierten en PASS.`,
  );
  process.exitCode = informe.estado === "PASS_RUBRICA" ? 0 : 2;
}
main().catch(() => {
  console.error(
    "Evaluación interrumpida; consultar el informe parcial, sin repetir automáticamente.",
  );
  process.exitCode = 1;
});
