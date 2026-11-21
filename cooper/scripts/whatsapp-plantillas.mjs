import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// Solo genera archivos locales: no lee credenciales ni contacta Meta.
const [originArg, destination] = process.argv.slice(2);
if (!originArg || !destination) throw new Error("Uso: node scripts/whatsapp-plantillas.mjs https://dominio-de-cooper carpeta-de-salida");
const origin = new URL(originArg);
if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) throw new Error("Se requiere un origen HTTPS sin ruta ni credenciales.");
mkdirSync(destination, { recursive: true });
for (const file of readdirSync("whatsapp/plantillas")) {
  const template = JSON.parse(readFileSync(resolve("whatsapp/plantillas", file), "utf8").replaceAll("https://cooper.example.org", origin.origin));
  writeFileSync(resolve(destination, file), JSON.stringify(template, null, 2) + "\n", { flag: "wx" });
}
console.log("Plantillas generadas para revisión manual de Meta.");
