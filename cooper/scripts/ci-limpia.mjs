import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { raiz } from "./entorno-pruebas.mjs";
import {
  cacheSentinel,
  copiarCacheVerificada,
  prepararSentinel,
} from "./sentinel-cache.mjs";

// Único argumento permitido: motor local. Nunca pasar entornos ni montajes arbitrarios.
const motor = process.argv[2] ?? "podman";
if (!["podman", "docker"].includes(motor) || process.argv.length > 3)
  throw new Error("Uso: node scripts/ci-limpia.mjs [podman|docker]");
const repo = resolve(raiz, "..");
function run(cmd, args, opciones = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repo,
    encoding: "utf8",
    ...opciones,
  });
  if (result.error || result.status !== 0)
    throw new Error(`Falló ${cmd}; rc ${result.status ?? "sin proceso"}.`);
  return result.stdout?.trim() ?? "";
}
const sha = run("git", ["rev-parse", "HEAD"]);
const nombres = run("git", ["ls-tree", "-r", "--name-only", sha]).split("\n");
if (
  nombres.some(
    (name) =>
      name
        .split("/")
        .some(
          (part) => /^\.env(?:\.|$)/.test(part) && part !== ".env.example",
        ) ||
      /^(credentials|credenciales)\//.test(name) ||
      name.startsWith("cooper/vendor/sentinel/src/") ||
      /(?:^|\/)\.cache\/sentinel\//.test(name),
  )
)
  throw new Error(
    "El árbol contiene nombres de archivos privados; se rechazó sin leerlos.",
  );
mkdirSync(resolve(repo, ".cache"), { recursive: true });
const dir = mkdtempSync(resolve(repo, ".cache/ci-limpia-"));
const checkout = resolve(dir, "checkout");
mkdirSync(checkout);
const archive = resolve(dir, "fuentes.tar");
run("git", ["archive", "--format=tar", `--output=${archive}`, sha]);
run("tar", ["-xf", archive, "-C", checkout]);
prepararSentinel();
const sentinel = copiarCacheVerificada(
  cacheSentinel,
  resolve(checkout, "cooper/.cache/sentinel"),
  resolve(checkout, "cooper/ci/sentinel-origen.json"),
);
writeFileSync(
  resolve(checkout, "ci-origen.json"),
  JSON.stringify(
    {
      commit: sha,
      archivo_sha256: createHash("sha256")
        .update(readFileSync(archive))
        .digest("hex"),
      limpio: true,
      sentinel_revision: sentinel,
      sentinel_fuentes:
        "caché privada verificada, fuera del archivo y de la imagen",
    },
    null,
    2,
  ) + "\n",
);
console.log(`Ensayo limpio de ${sha}: ${dir}`);
const image = `localhost/cooper-ci:${sha.slice(0, 12)}`;
run(
  motor,
  [
    "build",
    "--tag",
    image,
    "--file",
    resolve(checkout, "cooper/ci/Containerfile"),
    resolve(checkout, "cooper/ci"),
  ],
  { stdio: "inherit" },
);
// No se montan HOME, sockets, .env ni el worktree. Sin puertos publicados.
run(
  motor,
  [
    "run",
    "--rm",
    "--shm-size=1g",
    "--cap-drop=ALL",
    // Firefox crea su sandbox de usuario y chroot dentro del contenedor.
    // Sin estas capacidades falla al escribir uid_map antes de abrir la página.
    "--cap-add=SETUID",
    "--cap-add=SETGID",
    "--cap-add=SETFCAP",
    "--cap-add=SYS_CHROOT",
    "--security-opt=no-new-privileges",
    "--volume",
    `${checkout}:/ensayo:rw`,
    image,
  ],
  { stdio: "inherit" },
);
console.log(`Evidencia: ${checkout}/cooper/.cache/puerta/resultado.json`);
