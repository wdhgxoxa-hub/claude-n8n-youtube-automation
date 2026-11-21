import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const cooper = resolve(import.meta.dirname, "..");
export const cacheSentinel = resolve(cooper, ".cache/sentinel");
export const manifiestoSentinel = resolve(cooper, "ci/sentinel-origen.json");
const repositorioHabitual = resolve(
  homedir(),
  "Proyectos/Sistema-Sentinel/codigo",
);

function leerManifiesto(ruta) {
  const origen = JSON.parse(readFileSync(ruta, "utf8"));
  if (
    !/^[a-f0-9]{40}$/.test(origen.revision) ||
    !Object.keys(origen.archivos ?? {}).length
  )
    throw new Error("Manifiesto de Sentinel inválido.");
  for (const [archivo, hash] of Object.entries(origen.archivos))
    if (
      !/^src\/sentinel\/(?:[a-z_]+\/)*[a-z_]+\.(?:py|js)$/.test(archivo) ||
      !/^[a-f0-9]{64}$/.test(hash)
    )
      throw new Error("Ruta o huella inválida en el manifiesto de Sentinel.");
  return origen;
}

function huella(datos) {
  return createHash("sha256").update(datos).digest("hex");
}

// También se usa con fuentes ficticias en las pruebas. Los ejecutores siempre
// llaman comprobarSentinel(), con caché y manifiesto públicos de ruta fija.
export function verificarCache(directorio, manifiesto) {
  const origen = leerManifiesto(manifiesto);
  if (!lstatSync(directorio, { throwIfNoEntry: false }))
    throw new Error(
      "Falta la caché privada de Sentinel. Ejecute npm run preparar:sentinel con un checkout autorizado.",
    );
  const esperados = new Set(Object.keys(origen.archivos));
  function recorrer(ruta, relativo = "") {
    const stat = lstatSync(ruta);
    if (stat.isSymbolicLink())
      throw new Error("La caché de Sentinel no admite enlaces simbólicos.");
    if (stat.isDirectory()) {
      if (
        relativo &&
        ![...esperados].some((nombre) => nombre.startsWith(`${relativo}/`))
      )
        throw new Error("Directorio inesperado en la caché de Sentinel.");
      for (const nombre of readdirSync(ruta))
        recorrer(
          resolve(ruta, nombre),
          relativo ? `${relativo}/${nombre}` : nombre,
        );
    } else {
      if (!stat.isFile() || !esperados.has(relativo))
        throw new Error("Archivo inesperado en la caché de Sentinel.");
      if (huella(readFileSync(ruta)) !== origen.archivos[relativo])
        throw new Error(`Sentinel modificado: ${relativo}`);
      esperados.delete(relativo);
    }
  }
  recorrer(directorio);
  if (esperados.size)
    throw new Error("Faltan archivos en la caché de Sentinel.");
  return origen.revision;
}

export function comprobarSentinel() {
  return verificarCache(cacheSentinel, manifiestoSentinel);
}

function guardarAtomico(directorio, manifiesto, contenido) {
  if (lstatSync(directorio, { throwIfNoEntry: false }))
    throw new Error(
      "Ya existe la caché de Sentinel; no se sustituye sin verificarla.",
    );
  mkdirSync(dirname(directorio), { recursive: true });
  const temporal = mkdtempSync(resolve(dirname(directorio), ".sentinel-"));
  try {
    for (const [archivo, datos] of contenido) {
      const destino = resolve(temporal, archivo);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, datos, { mode: 0o600, flag: "wx" });
    }
    verificarCache(temporal, manifiesto);
    renameSync(temporal, directorio);
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
}

// Nunca lee fuentes del working tree ni ejecuta checkout, filtros, hooks o red.
// No transmite opciones Git, credenciales ni configuración del entorno invocante.
export function prepararCache(repositorio, directorio, manifiesto) {
  if (lstatSync(directorio, { throwIfNoEntry: false }))
    return verificarCache(directorio, manifiesto);
  const origen = leerManifiesto(manifiesto);
  function git(args) {
    const resultado = spawnSync(
      "git",
      [
        "--no-pager",
        "-C",
        repositorio,
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.hooksPath=/dev/null",
        ...args,
      ],
      {
        env: {
          PATH: process.env.PATH,
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_NO_REPLACE_OBJECTS: "1",
          GIT_TERMINAL_PROMPT: "0",
        },
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    if (resultado.error || resultado.status !== 0)
      throw new Error(
        "No se pudo extraer la revisión fijada de Sentinel. Proporcione un checkout local autorizado a preparar:sentinel; no se intentó acceso remoto.",
      );
    return resultado.stdout;
  }
  if (
    git(["rev-parse", "--verify", `${origen.revision}^{commit}`])
      .toString()
      .trim() !== origen.revision
  )
    throw new Error("La revisión de Sentinel no coincide con el manifiesto.");
  const contenido = Object.entries(origen.archivos).map(([archivo, hash]) => {
    const datos = git([
      "show",
      "--no-ext-diff",
      "--no-textconv",
      `${origen.revision}:${archivo}`,
    ]);
    if (huella(datos) !== hash)
      throw new Error(`Objeto Git de Sentinel modificado: ${archivo}`);
    return [archivo, datos];
  });
  guardarAtomico(directorio, manifiesto, contenido);
  return verificarCache(directorio, manifiesto);
}

export function prepararSentinel(repositorio = repositorioHabitual) {
  return prepararCache(repositorio, cacheSentinel, manifiestoSentinel);
}

// El manifiesto del commit archivado manda también dentro del ensayo limpio.
export function copiarCacheVerificada(origen, destino, manifiesto) {
  verificarCache(origen, manifiesto);
  const contenido = Object.keys(leerManifiesto(manifiesto).archivos).map(
    (archivo) => [archivo, readFileSync(resolve(origen, archivo))],
  );
  guardarAtomico(destino, manifiesto, contenido);
  return verificarCache(destino, manifiesto);
}
