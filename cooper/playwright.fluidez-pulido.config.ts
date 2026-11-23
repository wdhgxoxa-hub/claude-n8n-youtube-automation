import { defineConfig } from "@playwright/test";
import base from "./playwright.despliegue-final.config";

// Fluidez de Cooper (pulido-despliegue): reutiliza servidores, GPU y proyectos
// de despliegue-final y solo cambia el spec.
export default defineConfig({
  ...base,
  testMatch: "fluidez-pulido.spec.ts",
  outputDir: ".cache/fluidez-pulido/salida-playwright",
  reporter: [["list"]],
});
