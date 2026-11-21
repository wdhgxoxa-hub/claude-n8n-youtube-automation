import { describe, expect, it } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  comprobarArchivosEntorno,
  comprobarSentinel,
  comprobarGremlins,
  entornoLimpio,
} from "../scripts/entorno-pruebas.mjs";
import { avisos, comprobarResultados } from "../scripts/puerta.mjs";

describe("puerta reproducible", () => {
  it("exige el bundle íntegro de gremlins antes de poder ejecutar caos", () => {
    expect(() => comprobarGremlins()).not.toThrow();
    const root = mkdtempSync(resolve(tmpdir(), "cooper-gremlins-"));
    try {
      expect(() => comprobarGremlins(root)).toThrow("Falta gremlins.js");
      mkdirSync(resolve(root, "dist"));
      writeFileSync(resolve(root, "dist/gremlins.min.js"), "// alterado");
      expect(() => comprobarGremlins(root)).toThrow("no coincide");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("solo transmite variables de herramientas, sin credenciales ni opciones inyectadas", () => {
    const env = entornoLimpio({
      PATH: "/bin",
      AUTH_SECRET: "ficticio",
      NODE_OPTIONS: "--require intruso",
      COOPER_FABRICA: "n8n",
      SENTINEL_CODIGO: "/ajeno",
      npm_config_registry: "https://privado.test",
    });
    expect(env.PATH).toBe("/bin");
    for (const key of [
      "AUTH_SECRET",
      "NODE_OPTIONS",
      "COOPER_FABRICA",
      "SENTINEL_CODIGO",
      "npm_config_registry",
    ])
      expect(env).not.toHaveProperty(key);
  });
  it("rechaza nombres .env sin abrirlos, incluso cuando el nombre es un directorio", () => {
    const root = mkdtempSync(resolve(tmpdir(), "cooper-preflight-"));
    try {
      const app = resolve(root, "cooper");
      mkdirSync(app);
      writeFileSync(resolve(app, ".env.example"), "SOLO_NOMBRES=");
      expect(() => comprobarArchivosEntorno(app)).not.toThrow();
      mkdirSync(resolve(root, ".env.local"));
      expect(() => comprobarArchivosEntorno(app)).toThrow("no se leyeron");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("conserva las huellas de Sentinel y detecta una modificación del guardián", () => {
    expect(comprobarSentinel()).toBe(
      "6764bbdcab91719947e93ba1cc476cbefafb58e8",
    );
    const root = mkdtempSync(resolve(tmpdir(), "cooper-sentinel-"));
    try {
      cpSync(resolve("vendor/sentinel"), root, { recursive: true });
      writeFileSync(
        resolve(root, "src/sentinel/guardian/proteger.js"),
        "// alterado",
      );
      expect(() => comprobarSentinel(root)).toThrow("Sentinel modificado");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("no permite que rc 0 oculte advertencias de npm, Python o plataforma", () => {
    expect(
      avisos(
        "npm warn deprecated dependencia\nDeprecationWarning: obsoleto\nBEWARE: unsupported OS\nWarning: aviso",
      ),
    ).toHaveLength(4);
    expect(avisos("0 errores y 0 advertencias\n0 vulnerabilities")).toEqual([]);
  });
  it("exige pruebas efectivas sin fallos, omisiones ni reintentos en las tres suites", () => {
    const unit = {
      success: true,
      numPassedTests: 284,
      numFailedTests: 0,
      numPendingTests: 0,
    };
    const e2e = {
      stats: { expected: 43, unexpected: 0, skipped: 0, flaky: 0 },
      errors: [],
    };
    const flows = "# pass 147\n# fail 0\n# skipped 0\n# todo 0\n# cancelled 0";
    expect(comprobarResultados(unit, e2e, flows)).toEqual({
      unitarias: 284,
      e2e: 43,
      flujos: 147,
    });
    expect(() =>
      comprobarResultados({ ...unit, numPendingTests: 1 }, e2e, flows),
    ).toThrow("omisiones");
    expect(() =>
      comprobarResultados(
        unit,
        { ...e2e, stats: { ...e2e.stats, flaky: 1 } },
        flows,
      ),
    ).toThrow("reintentos");
    expect(() =>
      comprobarResultados(
        unit,
        { ...e2e, stats: { ...e2e.stats, skipped: 1 } },
        flows,
      ),
    ).toThrow("omisiones");
    expect(() =>
      comprobarResultados(
        unit,
        e2e,
        flows.replace("# skipped 0", "# skipped 1"),
      ),
    ).toThrow("omisiones");
    expect(() =>
      comprobarResultados(unit, { ...e2e, stats: { expected: 0 } }, flows),
    ).toThrow("sin pruebas");
  });
});
