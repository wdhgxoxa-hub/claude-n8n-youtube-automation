/** n8n real → receptor firmado y worker Cooper real → red simulada, sin Internet. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stopChild } from "./ensayo-infra.mjs";

export async function ejecutarMarcas(ctx) {
  const { api, ids, wrapper, call, rounds, evidence, save, dir, instance } =
    ctx;
  const container = ctx.container || "cooper-total-n8n-e2e";
  const folder = resolve(dir, "marcas");
  mkdirSync(folder, { recursive: true });
  let worker,
    relay,
    deliveries = 0;
  const resultados = [];
  async function iniciar() {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/ensayo-ramas-marcas-worker.ts"],
      {
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "test",
          COOPER_DATABASE_PATH: resolve(folder, "marcas-ensayo.sqlite"),
          COOPER_MARCAS_EVIDENCIA: folder,
          COOPER_ADMIN_EMAIL: "marcas-admin@example.test",
          COOPER_MARCAS: "simulada",
          COOPER_CHAT: "simulada",
          COOPER_FABRICA: "simulada",
          COOPER_MENSAJERIA: "simulada",
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const pending = new Map();
    let serial = 0,
      stderr = "";
    child.stderr.on("data", (d) => {
      stderr = (stderr + String(d)).slice(-2000);
    });
    child.once("exit", () => {
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(Error("Worker de Marcas terminó: " + stderr));
      }
      pending.clear();
    });
    createInterface({ input: child.stdout }).on("line", (line) => {
      const data = JSON.parse(line),
        p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      clearTimeout(p.timer);
      if (data.error) p.reject(Error(data.error));
      else p.resolve(data.result);
    });
    const request = (data) =>
      new Promise((resolveRequest, reject) => {
        const id = ++serial;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(Error("Worker Marcas agotó plazo"));
        }, 180000);
        pending.set(id, { resolve: resolveRequest, reject, timer });
        child.stdin.write(JSON.stringify({ id, ...data }) + "\n");
      });
    worker = { child, request };
    await request({
      tipo: "iniciar",
      secret: instance.env.COOPER_WEBHOOK_SECRET,
    });
  }
  try {
    await iniciar();
    // Solo este endpoint existe. El canal stdin/stdout no abre acceso a Internet ni al host.
    const relayCode = `const http=require('node:http'),readline=require('node:readline');const pending=new Map();let id=0;readline.createInterface({input:process.stdin}).on('line',line=>{const a=JSON.parse(line),r=pending.get(a.id);if(r){pending.delete(a.id);r.writeHead(a.status,{'Content-Type':'application/json'});r.end(a.body);}});http.createServer(async(req,res)=>{if(req.method!=='POST'||req.url!=='/api/marcas/operar'){res.writeHead(404);res.end();return;}let body='';for await(const c of req){body+=c;if(body.length>2048){res.writeHead(413);res.end();return;}}const n=++id;pending.set(n,res);process.stdout.write(JSON.stringify({id:n,body,headers:req.headers})+'\\n');}).listen(8890,'127.0.0.1',()=>process.stdout.write('{"ready":true}\\n'));`;
    relay = spawn(
      "podman",
      ["exec", "-i", container, "node", "-e", relayCode],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    await new Promise((yes, no) => {
      relay.once("exit", () => no(Error("Relay Marcas terminó")));
      createInterface({ input: relay.stdout }).on("line", async (line) => {
        const input = JSON.parse(line);
        if (input.ready) {
          yes();
          return;
        }
        try {
          const response = await worker.request({
            tipo: "http",
            body: input.body,
            headers: input.headers,
          });
          deliveries++;
          relay.stdin.write(
            JSON.stringify({ id: input.id, ...response }) + "\n",
          );
        } catch {
          relay.stdin.write(
            JSON.stringify({
              id: input.id,
              status: 500,
              body: '{"error":"Worker local no disponible"}',
            }) + "\n",
          );
        }
      });
    });
    for (const [sourceId, name] of [
      ["CooperMarcasPub1", "marcas-publicar"],
      ["CooperMarcasMet1", "marcas-metricas"],
    ]) {
      const w = await api.request("GET", `/workflows/${ids[sourceId]}`);
      const signer = w.nodes.find((n) => n.name === "Firmar trabajo de marcas");
      assert.ok(signer);
      signer.parameters.jsCode = signer.parameters.jsCode
        .replace(
          "if ($env.COOPER_MARCAS_HABILITAR !== '1') return [];",
          "// Activación exclusiva de la copia de ensayo.",
        )
        .replace(
          "$env.COOPER_MARCAS_WORKER_SECRET",
          "$env.COOPER_WEBHOOK_SECRET",
        )
        .replace(
          "String($env.COOPER_MARCAS_URL || '').replace(/\\/$/, '')",
          "'http://127.0.0.1:8890'",
        )
        .replace(
          "if (!/^https:\\/\\/[a-z0-9.-]+(?::\\d+)?$/i.test(origin))",
          "if (origin !== 'http://127.0.0.1:8890')",
        );
      assert.ok(
        signer.parameters.jsCode.includes(
          "const origin = 'http://127.0.0.1:8890'",
        ),
      );
      assert.ok(
        signer.parameters.jsCode.includes(
          "if (origin !== 'http://127.0.0.1:8890')",
        ),
      );
      await api.request("PUT", `/workflows/${ids[sourceId]}`, {
        name: w.name,
        nodes: w.nodes,
        connections: w.connections,
        settings: w.settings,
      });
      await api.request("POST", `/workflows/${ids[sourceId]}/publish`, {});
      await wrapper(name, ids[sourceId]);
    }
    evidence.marcas = {
      fuente:
        "Worker y receptor POST de Cooper reales, SQLite exclusiva, FFmpeg/FFprobe reales, RedSimulada",
      adaptaciones: [
        "Origen HTTPS sustituido solo en copia n8n por loopback 8890 con relay cerrado stdin/stdout",
        "Interruptor habilitado solo en copia; secreto efímero de la instancia en memoria, sin valores en evidencia",
        "Reloj de creación/aprobación de fixtures 120 segundos atrás para que el horario venza sin espera",
      ],
      rondas: resultados,
    };
    for (let round = 1; round <= rounds; round++) {
      const started = Date.now();
      const prepared = await worker.request({ tipo: "preparar", ronda: round });
      assert.equal(prepared.estado, "programada");
      // Caída real del proceso entre aprobación y envío: SQLite debe conservar todo.
      worker.child.kill("SIGKILL");
      await new Promise((r) => worker.child.once("exit", r));
      await iniciar();
      const recovered = await worker.request({
        tipo: "estado",
        pieza: prepared.id,
      });
      assert.equal(recovered.estado, "programada");
      assert.equal(recovered.aprobadaRevision, 1);
      const beforePublish = deliveries;
      await call("marcas-publicar", {});
      await ctx.wait(
        async () => deliveries > beforePublish,
        "worker Marcas recibe publicación",
      );
      const published = await worker.request({
        tipo: "estado",
        pieza: prepared.id,
      });
      assert.equal(published.estado, "publicada");
      assert.match(published.remoto, /^simulada-/);
      const beforeMetrics = deliveries;
      await call("marcas-metricas", {});
      await ctx.wait(
        async () => deliveries > beforeMetrics,
        "worker Marcas recibe métricas",
      );
      const measured = await worker.request({
        tipo: "estado",
        pieza: prepared.id,
      });
      assert.equal(measured.metricas.vistas, 240);
      const beforeReplay = deliveries;
      await call("marcas-publicar", {});
      await ctx.wait(
        async () => deliveries > beforeReplay,
        "worker Marcas recibe repetición",
      );
      assert.deepEqual(
        await worker.request({ tipo: "estado", pieza: prepared.id }),
        measured,
      );
      const invalid = await worker.request({
        tipo: "http",
        body: '{"accion":"publicar"}',
        headers: {
          "content-type": "application/json",
          "x-cooper-time": String(Date.now()),
          "x-cooper-signature": "0".repeat(64),
        },
      });
      assert.equal(invalid.status, 401);
      const interrupted = await worker.request({
        tipo: "preparar",
        ronda: round + 100,
      });
      const died = new Promise((r) => worker.child.once("exit", r));
      const interruptedRequest = worker
        .request({ tipo: "interrumpir" })
        .catch(() => null);
      await died;
      await interruptedRequest;
      await iniciar();
      const uncertain = await worker.request({
        tipo: "estado",
        pieza: interrupted.id,
      });
      assert.equal(uncertain.estado, "enviando");
      await worker.request({ tipo: "vencer-reserva", pieza: interrupted.id });
      const beforeRecovery = deliveries;
      await call("marcas-publicar", {});
      await ctx.wait(
        async () => deliveries > beforeRecovery,
        "Marcas concilia envío interrumpido",
      );
      const reconciliation = await worker.request({
        tipo: "estado",
        pieza: interrupted.id,
      });
      assert.equal(reconciliation.estado, "revision");
      assert.equal(reconciliation.remoto, "");
      assert.match(reconciliation.aviso, /interrumpió/);
      const beforeRepeatedRecovery = deliveries;
      await call("marcas-publicar", {});
      await ctx.wait(
        async () => deliveries > beforeRepeatedRecovery,
        "Marcas conserva conciliación sin reenviar",
      );
      assert.deepEqual(
        await worker.request({ tipo: "estado", pieza: interrupted.id }),
        reconciliation,
      );
      resultados.push({
        ronda: round,
        duracion_ms: Date.now() - started,
        entrada: prepared,
        trasCaida: recovered,
        salida: measured,
        publicacionRepetidaSinCambios: true,
        firmaInvalida: invalid.status,
        envioInterrumpido: {
          antes: uncertain,
          despues: reconciliation,
          repeticionSinReenvio: true,
          adaptacionReloj:
            "Reserva envejecida 301 segundos en la copia tras SIGKILL real dentro del transporte simulado",
        },
      });
      save();
    }
    evidence.marcas.entregasFirmadas = deliveries;
    writeFileSync(
      resolve(folder, "resultado.json"),
      JSON.stringify(evidence.marcas, null, 2),
    );
    save();
  } finally {
    await stopChild(relay);
    await stopChild(worker?.child);
  }
}
