import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  copiarCacheVerificada,
  prepararCache,
  verificarCache,
} from "../scripts/sentinel-cache.mjs";

describe("caché privada de Sentinel", () => {
  let root: string,
    repo: string,
    cache: string,
    manifest: string,
    revision: string;
  const archivo = "src/sentinel/contrato.py";
  const contenido =
    "# Fuente ficticia para probar extracción; no es Sentinel.\n";
  function git(args: string[]) {
    const result = spawnSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      env: {
        NODE_ENV: "test",
        PATH: process.env.PATH,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
    });
    expect(result.status).toBe(0);
    return result.stdout.trim();
  }
  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), "cooper-cache-ficticia-"));
    repo = resolve(root, "repo");
    cache = resolve(root, "cache");
    manifest = resolve(root, "origen.json");
    mkdirSync(resolve(repo, "src/sentinel"), { recursive: true });
    writeFileSync(resolve(repo, archivo), contenido);
    git(["init", "--quiet", "--initial-branch=prueba"]);
    git(["add", archivo]);
    git([
      "-c",
      "user.name=Ensayo",
      "-c",
      "user.email=ensayo@example.test",
      "-c",
      "commit.gpgSign=false",
      "commit",
      "--quiet",
      "-m",
      "Fuente ficticia",
    ]);
    revision = git(["rev-parse", "HEAD"]);
    writeFileSync(
      manifest,
      JSON.stringify({
        revision,
        archivos: {
          [archivo]: createHash("sha256").update(contenido).digest("hex"),
        },
      }),
    );
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("extrae el objeto fijado aunque el working tree y HEAD cambien", () => {
    writeFileSync(resolve(repo, archivo), "# Working tree alterado\n");
    git(["add", archivo]);
    git([
      "-c",
      "user.name=Ensayo",
      "-c",
      "user.email=ensayo@example.test",
      "-c",
      "commit.gpgSign=false",
      "commit",
      "--quiet",
      "-m",
      "Cambio posterior",
    ]);
    expect(git(["rev-parse", "HEAD"])).not.toBe(revision);
    expect(prepararCache(repo, cache, manifest)).toBe(revision);
    expect(readFileSync(resolve(cache, archivo), "utf8")).toBe(contenido);
    expect(readdirSync(cache)).toEqual(["src"]);
  });
  it("reutiliza solo una caché íntegra sin requerir el repositorio privado", () => {
    prepararCache(repo, cache, manifest);
    expect(prepararCache("/no-existe", cache, manifest)).toBe(revision);
    writeFileSync(resolve(cache, archivo), "# alterado");
    expect(() => prepararCache(repo, cache, manifest)).toThrow(
      "Sentinel modificado",
    );
  });
  it("rechaza faltantes, bytecode y enlaces sin aceptar un manifiesto dentro de la caché", () => {
    prepararCache(repo, cache, manifest);
    writeFileSync(resolve(cache, "origen.json"), "{}");
    expect(() => verificarCache(cache, manifest)).toThrow("inesperado");
    rmSync(resolve(cache, "origen.json"));
    mkdirSync(resolve(cache, "src/sentinel/__pycache__"));
    expect(() => verificarCache(cache, manifest)).toThrow("inesperado");
    rmSync(resolve(cache, "src/sentinel/__pycache__"), { recursive: true });
    rmSync(resolve(cache, archivo));
    expect(() => verificarCache(cache, manifest)).toThrow("Faltan archivos");
    symlinkSync(resolve(repo, archivo), resolve(cache, archivo));
    expect(() => verificarCache(cache, manifest)).toThrow("enlaces simbólicos");
  });
  it("rechaza una caché que sea un enlace incluso si el destino no existe", () => {
    symlinkSync(resolve(root, "ausente"), cache);
    expect(() => prepararCache(repo, cache, manifest)).toThrow(
      "enlaces simbólicos",
    );
  });
  it("falla sin red ni caché parcial cuando no existe la revisión o no coincide el hash", () => {
    expect(() => prepararCache("/no-existe", cache, manifest)).toThrow(
      "no se intentó acceso remoto",
    );
    const datos = JSON.parse(readFileSync(manifest, "utf8"));
    datos.archivos[archivo] = "0".repeat(64);
    writeFileSync(manifest, JSON.stringify(datos));
    expect(() => prepararCache(repo, cache, manifest)).toThrow(
      "Objeto Git de Sentinel modificado",
    );
    expect(existsSync(cache)).toBe(false);
    expect(readdirSync(root).filter((n) => n.startsWith(".sentinel-"))).toEqual(
      [],
    );
  });
  it("rechaza rutas ajenas al módulo antes de extraer objetos", () => {
    writeFileSync(
      manifest,
      JSON.stringify({
        revision,
        archivos: { "../../intruso.py": "0".repeat(64) },
      }),
    );
    expect(() => prepararCache(repo, cache, manifest)).toThrow(
      "Ruta o huella inválida",
    );
    expect(existsSync(cache)).toBe(false);
  });
  it("copia al ensayo limpio solo archivos verificados contra su manifiesto público", () => {
    prepararCache(repo, cache, manifest);
    const destino = resolve(root, "checkout/cooper/.cache/sentinel");
    expect(copiarCacheVerificada(cache, destino, manifest)).toBe(revision);
    expect(verificarCache(destino, manifest)).toBe(revision);
    writeFileSync(resolve(cache, archivo), "# alterado");
    expect(() =>
      copiarCacheVerificada(cache, resolve(root, "otra"), manifest),
    ).toThrow("Sentinel modificado");
    expect(existsSync(resolve(root, "otra"))).toBe(false);
  });
});
