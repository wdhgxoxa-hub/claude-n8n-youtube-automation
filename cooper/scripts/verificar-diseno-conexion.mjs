import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const exigirGlobales = process.argv.includes("--exigir-tokens-globales");
const anchos = [360, 390, 768, 1024, 1440, 1920];
const resumen = anchos.map((ancho) => {
  const auditoria = JSON.parse(
    readFileSync(
      resolve(`../evidencias-diseno/auditoria-${ancho}.json`),
      "utf8",
    ),
  );
  return {
    ancho,
    capturas: auditoria.evidencia.length,
    componente: auditoria.componenteConexionAprobado,
    tokens: auditoria.evidencia.reduce(
      (total, pantalla) => total + pantalla.tokensFueraDeDireccion.length,
      0,
    ),
    axeSerias: auditoria.evidencia.reduce(
      (total, pantalla) => total + pantalla.axeSerias.length,
      0,
    ),
    desbordamientos: auditoria.evidencia.filter((p) => p.desbordamiento).length,
    consola: auditoria.consola.length,
    errores: auditoria.errores.length,
  };
});
console.log(JSON.stringify({ exigirGlobales, resumen }, null, 2));
if (
  resumen.some(
    (r) =>
      !r.componente ||
      r.errores ||
      (exigirGlobales &&
        (r.tokens > 0 ||
          r.axeSerias > 0 ||
          r.desbordamientos > 0 ||
          r.consola > 0)),
  )
)
  process.exitCode = 1;
