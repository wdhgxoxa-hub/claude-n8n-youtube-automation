import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { simularRetencion } from "../src/servicios/retencion";

try {
  const { values } = parseArgs({
    options: {
      base: { type: "string" },
      politica: { type: "string" },
      salida: { type: "string" },
      simular: { type: "boolean" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values.simular || !values.base || !values.politica || !values.salida)
    throw new Error("Argumentos incompletos");
  const informe = simularRetencion(
    values.base,
    JSON.parse(readFileSync(values.politica, "utf8")),
  );
  // No sobrescribe una base, un informe anterior ni un enlace existente. Solo artefacto privado nuevo.
  writeFileSync(values.salida, JSON.stringify(informe, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    "Simulación guardada. Ningún dato eliminado; ejecución real pendiente de B08.",
  );
} catch {
  // No serializar errores de SQL/Zod/JSON: podrían incluir valores privados de la base o política.
  console.error(
    "No se generó el informe. Revisa base compatible, política válida y salida nueva. Uso: npm run datos:inventario -- --simular --base copia.sqlite --politica politica.json --salida informe.json",
  );
  process.exitCode = 1;
}
