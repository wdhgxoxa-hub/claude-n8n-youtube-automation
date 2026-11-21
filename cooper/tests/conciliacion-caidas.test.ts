import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
const evidencia: object[] = [];
function ejecutar(database: string, modo: string, tipo: string, fase: string) {
  return new Promise<{
    resultado?: Record<string, unknown>;
    signal: string | null;
  }>((done, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        "tests/fixtures/conciliacion-proceso.ts",
        modo,
        tipo,
        fase,
      ],
      {
        env: {
          PATH: process.env.PATH,
          COOPER_DATABASE_PATH: database,
          NODE_ENV: "test",
        },
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      },
    );
    let result: Record<string, unknown> | undefined,
      error = "",
      reached = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Tiempo excedido: ${tipo}/${fase}/${modo}. ${error}`));
    }, 20000);
    child.stderr!.on("data", (d) => {
      error += String(d);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on(
      "message",
      (message: {
        punto?: boolean;
        resultado?: Record<string, unknown>;
        fallo?: boolean;
      }) => {
        if (message.punto && modo === "iniciar") {
          reached = true;
          child.kill("SIGKILL");
        }
        if (message.resultado) result = message.resultado;
        if (message.fallo) error += "El escenario falló antes de concluir.";
      },
    );
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (
        (modo === "iniciar" && reached && signal === "SIGKILL") ||
        (modo === "recuperar" && code === 0 && result)
      )
        done({ resultado: result, signal });
      else
        reject(
          new Error(
            `${tipo}/${fase}/${modo}: rc=${code}, señal=${signal}. ${error}`,
          ),
        );
    });
  });
}
for (const tipo of ["chat", "whatsapp", "marca", "ingesta"])
  for (const fase of ["antes", "despues"])
    it(`SIGKILL ${tipo} ${fase} de aceptación, reinicio sin duplicados`, async () => {
      const database = resolve(
        mkdtempSync(".cache/conciliacion-caida-"),
        "cooper.sqlite",
      );
      const killed = await ejecutar(database, "iniciar", tipo, fase);
      expect(killed.signal).toBe("SIGKILL");
      const recovery = await ejecutar(database, "recuperar", tipo, fase);
      const attempts = readFileSync(`${database}.intentos`, "utf8")
        .trim()
        .split("\n").length;
      const accepted = existsSync(`${database}.aceptada`)
        ? readFileSync(`${database}.aceptada`, "utf8").trim().split("\n").length
        : 0;
      expect(attempts).toBe(1);
      expect(accepted).toBe(fase === "despues" ? 1 : 0);
      expect(recovery.resultado?.estado).toBe(
        fase === "despues"
          ? {
              chat: "confirmada",
              whatsapp: "aceptado",
              marca: "publicada",
              ingesta: "completa",
            }[tipo]
          : {
              chat: "ejecutando",
              whatsapp: "incierto",
              marca: "revision",
              ingesta: "cancelada",
            }[tipo],
      );
      if (tipo === "ingesta")
        expect(recovery.resultado?.adjuntos).toBe(fase === "despues" ? 1 : 0);
      if (tipo === "chat")
        expect(recovery.resultado?.reserva).toBe("n8n-ficticia");
      // Segundo reinicio verifica que el cierre durable tampoco abre el envío.
      await ejecutar(database, "recuperar", tipo, fase);
      expect(
        readFileSync(`${database}.intentos`, "utf8").trim().split("\n"),
      ).toHaveLength(1);
      evidencia.push({
        tipo,
        fase,
        senal: killed.signal,
        intentos: attempts,
        aceptaciones: accepted,
        duplicados: 0,
        ...recovery.resultado,
      });
      writeFileSync(
        ".cache/conciliacion-caidas.json",
        JSON.stringify(evidencia, null, 2),
      );
    }, 45000);
