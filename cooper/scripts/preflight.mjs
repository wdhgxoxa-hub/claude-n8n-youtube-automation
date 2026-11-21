import {
  comprobarHerramientas,
  comprobarInstalacion,
} from "./entorno-pruebas.mjs";
console.log(JSON.stringify(comprobarHerramientas()));
comprobarInstalacion();
console.log(
  "Preflight: PASS. Sentinel íntegro, Python y ambos Chromium disponibles.",
);
