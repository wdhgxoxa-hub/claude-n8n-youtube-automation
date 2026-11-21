/** Ensayo del motor n8n real con transportes, aprobador y reloj de métricas de prueba. */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  startN8n,
  podman,
  until,
  stopChild,
  assertNoEnvFiles,
} from "./ensayo-infra.mjs";
import { adaptarTransportes } from "./ensayo-total-transportes.mjs";
import { trazarPasos } from "./ensayo-total-traza.mjs";

assertNoEnvFiles();
const CONTAINER = "cooper-total-n8n-e2e";
const rounds = Number(process.env.COOPER_TOTAL_RONDAS || 3);
assert.ok(Number.isInteger(rounds) && rounds >= 1 && rounds <= 10);
const dir = resolve(
  ".cache/total-n8n-e2e",
  new Date().toISOString().replaceAll(":", "-"),
);
mkdirSync(dir, { recursive: true });
const evidence = {
  version: 1,
  inicio: new Date().toISOString(),
  fuente:
    "workflows/v2 y snapshot ficticio versionado; sin credenciales ni base de producción",
  rondas: [],
  sustituciones: [],
  pruebas: [],
};
let instance, receiver;
const save = () =>
  writeFileSync(`${dir}/resultado.json`, JSON.stringify(evidence, null, 2));
let closed;
async function cleanup() {
  if (closed) return;
  closed = true;
  await stopChild(receiver);
  if (instance) {
    podman("stop", CONTAINER);
    evidence.contenedorFinal = podman(
      "inspect",
      "--format",
      "{{.State.Status}}",
      CONTAINER,
    );
  }
  evidence.fin = new Date().toISOString();
  save();
}
for (const sig of ["SIGINT", "SIGTERM"])
  process.once(sig, () => {
    void cleanup().finally(() => process.exit(130));
  });
try {
  instance = await startN8n(0, {
    container: CONTAINER,
    network: "cooper-total-n8n-e2e-red",
    root: ".cache/cooper-total-n8n-e2e",
  });
  const { api, url } = instance;
  evidence.instancia = {
    url,
    imagen: "ghcr.io/n8n-io/n8n:2.47.4",
    contenedor: CONTAINER,
    volumen: instance.run + "/n8n",
    redInterna: true,
  };
  console.log("Instancia aislada lista: " + url);
  // Receptor ficticio que comprueba la firma real del subflujo de progreso. Nunca imprime el secreto.
  const receiverCode = `const http=require('node:http'),crypto=require('node:crypto');http.createServer(async(req,res)=>{let b='';for await(const c of req)b+=c;const t=req.headers['x-cooper-timestamp'];const sig=crypto.createHmac('sha256',process.env.COOPER_WEBHOOK_SECRET).update(t+'.'+b).digest('hex');const ok='sha256='+sig===req.headers['x-cooper-signature'] && Math.abs(Date.now()-Number(t))<300000;res.writeHead(ok?200:401,{'content-type':'application/json'});res.end(JSON.stringify({ok}));}).listen(8889,'127.0.0.1',()=>console.log('ready'));`;
  receiver = spawn(
    "podman",
    ["exec", "-i", CONTAINER, "node", "-e", receiverCode],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  await new Promise((yes, no) => {
    createInterface({ input: receiver.stdout }).on("line", (l) => {
      if (l === "ready") yes();
    });
    receiver.once("exit", () => no(Error("Receptor terminado")));
  });
  const base = JSON.parse(
    readFileSync("../contratos/cooper-tablas-ensayo.json", "utf8"),
  );
  const migration = JSON.parse(
    readFileSync("../contratos/cooper-migracion-tablas.json", "utf8"),
  ).tablas;
  const tables = {};
  for (const [name, schema] of Object.entries(base))
    tables[name.slice(4)] = (
      await api.request("POST", "/data-tables", {
        name,
        columns: Object.entries({ ...schema, ...migration[name] }).map(
          ([name, type]) => ({ name, type }),
        ),
      })
    ).id;
  const rows = (name) => api.rows(tables[name]);
  const insert = (name, data) =>
    api.request("POST", `/data-tables/${tables[name]}/rows`, {
      data,
      returnType: "all",
    });
  // Snapshot de prueba copiado a cada base; ninguna columna de OAuth contiene datos.
  const snapshotPath =
    process.env.COOPER_TOTAL_COPIA || "../tests/fixtures/n8n-total-datos.json";
  assert.ok(
    snapshotPath.endsWith(".json"),
    "La copia debe ser el JSON saneado del exportador",
  );
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  for (const [name, data] of Object.entries(snapshot.tablas))
    if (data.length) await insert(name, data);
  evidence.copia = {
    archivo: snapshotPath,
    origen: snapshot.origen,
    sha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
    filas: Object.values(snapshot.tablas).reduce((n, r) => n + r.length, 0),
    credenciales: 0,
  };
  evidence.fuente = snapshot.origen;
  const copiaAntes = Object.fromEntries(
    await Promise.all(
      Object.keys(snapshot.tablas).map(async (name) => [
        name,
        await rows(name),
      ]),
    ),
  );
  const workflows = readdirSync("../workflows/v2")
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync("../workflows/v2/" + f, "utf8")));
  const oldTables = JSON.parse(
    execFileSync(
      "python3",
      [
        "-c",
        "import ast,json; t=ast.parse(open('../tools/generar_flujos_v2.py').read()); print(json.dumps(next(ast.literal_eval(n.value) for n in t.body if isinstance(n,ast.Assign) and any(isinstance(x,ast.Name) and x.id=='T' for x in n.targets))))",
      ],
      { encoding: "utf8" },
    ),
  );
  const replacements = Object.fromEntries(
    Object.entries(oldTables).map(([k, v]) => [v, tables[k]]),
  );
  const ids = {};
  for (const w of workflows) {
    ids[w.id] = (
      await api.request("POST", "/workflows", {
        name: w.name,
        nodes: [],
        connections: {},
        settings: { executionOrder: "v1" },
      })
    ).id;
    replacements[w.id] = ids[w.id];
  }
  const body = (w) => ({
    name: w.name,
    nodes: w.nodes,
    connections: w.connections,
    settings: w.settings,
  });
  const modified = [];
  for (const source of [...workflows].sort(
    (a, b) =>
      Number(b.id === "FabErrores000001") - Number(a.id === "FabErrores000001"),
  )) {
    const adapted = adaptarTransportes(source);
    evidence.sustituciones.push(...adapted.sustituciones);
    let encoded = JSON.stringify(adapted.workflow);
    for (const [a, b] of Object.entries(replacements))
      encoded = encoded.replaceAll(a, b);
    const w = JSON.parse(encoded);
    for (const n of w.nodes) {
      delete n.credentials;
      if (
        /\.(scheduleTrigger|formTrigger|chatTrigger|telegramTrigger)$/.test(
          n.type,
        ) ||
        n.type.endsWith(".webhook")
      )
        n.disabled = true;
      if (n.type.endsWith(".wait") && n.parameters.resume !== "form") {
        n.parameters = {
          resume: "timeInterval",
          amount: 0.01,
          unit: "seconds",
        };
      }
      if (source.id === "FabAjustes000001" && n.name === "Ajustes") {
        n.parameters.jsCode = n.parameters.jsCode
          .replace(/(allow\w+:\s*)(?:true|false)/g, "$1false")
          .replace(
            /(allow(?:Claude|Imagenes|Archivo|Voz|Drive|Montaje|Redes|Analytics|Radar|Vidiq):\s*)false/g,
            "$1true",
          )
          .replace(/https:\/\/[^'\s]+/g, "http://127.0.0.1:9/solo-ensayo")
          .replace(/maxVideosDiaPorCanal:\s*3/, "maxVideosDiaPorCanal: 20");
      }
      if (source.id === "FabRetornoClaud1" && n.type.endsWith(".webhook")) {
        n.disabled = false;
        n.parameters.authentication = "none";
      }
    }
    if (source.id === "FabAprendizaje01") {
      w.nodes.push({
        id: "inicio-ensayo",
        name: "Inicio de ensayo",
        type: "n8n-nodes-base.executeWorkflowTrigger",
        typeVersion: 1.1,
        position: [0, 0],
        parameters: { inputSource: "passthrough" },
      });
      w.connections["Inicio de ensayo"] = structuredClone(
        w.connections["Cada día"],
      );
    }
    try {
      await api.request("PUT", `/workflows/${ids[source.id]}`, body(w));
    } catch (error) {
      throw Error(source.name + ": " + error.message + " " + error.detail);
    }
    modified.push(w);
    if (source.id === "FabErrores000001")
      await api.request("POST", `/workflows/${ids[source.id]}/publish`, {});
  }
  const published = new Set(),
    visiting = new Set();
  async function publish(id) {
    if (published.has(id)) return;
    if (visiting.has(id)) throw Error("Ciclo: " + id);
    visiting.add(id);
    const w = modified.find((x) => x.id === id);
    for (const n of w.nodes) {
      const dep = n.parameters.workflowId?.value;
      if (modified.some((x) => x.id === dep)) await publish(dep);
    }
    if (w.settings.errorWorkflow && w.settings.errorWorkflow !== id)
      await publish(w.settings.errorWorkflow);
    await api.request("POST", `/workflows/${id}/publish`, {});
    published.add(id);
    visiting.delete(id);
  }
  for (const id of [
    "FabOrquestador01",
    "FabRadar00000001",
    "FabAprendizaje01",
    "FabRetornoClaud1",
    "FabConfirmar0001",
  ])
    await publish(ids[id]);
  async function wrapper(name, id) {
    const w = {
      name: "ENSAYO TOTAL " + name,
      nodes: [
        {
          id: "web",
          name: "Entrada",
          type: "n8n-nodes-base.webhook",
          typeVersion: 2,
          position: [0, 0],
          parameters: {
            httpMethod: "POST",
            path: "total-e2e-" + name,
            responseMode: "lastNode",
            options: {},
          },
        },
        {
          id: "datos",
          name: "Datos",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [200, 0],
          parameters: { jsCode: "return [{json:$json.body}];" },
        },
        {
          id: "call",
          name: "Flujo real",
          type: "n8n-nodes-base.executeWorkflow",
          typeVersion: 1.3,
          position: [400, 0],
          parameters: {
            workflowId: { __rl: true, value: id, mode: "id" },
            workflowInputs: { mappingMode: "passThrough", value: {} },
            options: { waitForSubWorkflow: false },
          },
        },
      ],
      connections: {
        Entrada: { main: [[{ node: "Datos", type: "main", index: 0 }]] },
        Datos: { main: [[{ node: "Flujo real", type: "main", index: 0 }]] },
      },
      settings: { executionOrder: "v1" },
    };
    const saved = await api.request("POST", "/workflows", w);
    await api.request("POST", `/workflows/${saved.id}/publish`, {});
  }
  await wrapper("orquestador", ids.FabOrquestador01);
  await wrapper("radar", ids.FabRadar00000001);
  await wrapper("metricas", ids.FabAprendizaje01);
  await wrapper("confirmar", ids.FabConfirmar0001);
  const call = async (name, data) => {
    const response = await fetch(`${url}/webhook/total-e2e-${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 200, await response.text());
  };
  const errors = async () => {
    const es = await api.all("/executions");
    const failures = [];
    for (const e of es.filter((e) => e.status === "error")) {
      const d = await api.request(
        "GET",
        `/executions/${e.id}?includeData=true`,
      );
      failures.push({
        id: e.id,
        workflowId: e.workflowId,
        lastNode: d.data?.resultData?.lastNodeExecuted,
        error: d.data?.resultData?.error?.message,
      });
    }
    return failures;
  };
  const wait = async (fn, label) =>
    until(
      async () => {
        const result = await fn();
        if (result) return result;
        const es = await errors();
        if (es.length) throw Error(label + ": " + JSON.stringify(es));
        return false;
      },
      label,
      90000,
    );
  const job = (mode, channel, video) =>
    wait(
      async () =>
        (await rows("trabajos")).find(
          (t) =>
            t.modo === mode &&
            t.canal_id === channel &&
            (!video || t.video_id === video) &&
            t.estado === "enviado",
        ),
      `trabajo ${mode}`,
    );
  async function payloadTrabajo(jobId) {
    return until(
      async () => {
        const ejecuciones = await api.all("/executions");
        for (const e of ejecuciones.filter(
          (e) => e.workflowId === ids.FabLlamarClaude1,
        )) {
          const d = await api.request(
            "GET",
            `/executions/${e.id}?includeData=true`,
          );
          const r =
            d.data?.resultData?.runData?.["Preparar trabajo"]?.[0]?.data
              ?.main?.[0]?.[0]?.json;
          if (r?.job_id === jobId) return r.payload;
        }
        return false;
      },
      "pedido persistido del trabajo de ensayo",
      30000,
    );
  }
  const callback = async (t, result) => {
    const response = await fetch(`${url}/webhook/video-factory/resultado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: t.job_id,
        modo: t.modo,
        estado: "ok",
        resultado: result,
      }),
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 200);
  };
  async function approval(channel, video, stage) {
    const a = await wait(
      async () =>
        (await rows("aprobaciones")).find(
          (a) =>
            a.canal_id === channel &&
            (!video || a.video_id === video) &&
            a.etapa === stage &&
            a.estado === "pendiente",
        ),
      `aprobación ${stage}`,
    );
    if (a.url) {
      const u = new URL(a.url);
      const executionId = u.pathname.match(
        /^\/form-waiting\/(\d+)(?:\/|$)/,
      )?.[1];
      assert.ok(
        executionId,
        "El formulario debe pertenecer a una ejecución local",
      );
      // La fila de aprobación precede al Wait. Enviar antes de que n8n registre
      // la espera puede dejar el POST abierto aunque la fila ya sea visible.
      await wait(async () => {
        const execution = await api.request(
          "GET",
          `/executions/${executionId}`,
        );
        return execution.status === "waiting";
      }, `formulario ${stage} listo para recibir la decisión`);
      const data = new FormData();
      data.set("field-0", "Aprobar");
      data.set("field-1", "");
      const envio = {
        ejecucion: executionId,
        etapa: stage,
        estadoPrevio: "waiting",
        inicio: new Date().toISOString(),
      };
      (evidence.formularios ||= []).push(envio);
      save();
      const response = await fetch(url + u.pathname + u.search, {
        method: "POST",
        body: data,
        signal: AbortSignal.timeout(30000),
      });
      envio.fin = new Date().toISOString();
      envio.http = response.status;
      assert.equal(response.status, 200);
    } else {
      const p = JSON.parse(a.pedido);
      await call("orquestador", {
        ...p,
        evento: "aprobado",
        aprobacion_id: a.aprobacion_id,
        dueno_email: "total@example.test",
      });
    }
    return {
      aprobacion_id: a.aprobacion_id,
      etapa: stage,
      contexto: JSON.parse(a.pedido).contexto,
    };
  }
  const biblia = {
    voz: { descripcion: "Narrador claro", gemini_voice: "Charon" },
    estilo_visual: {
      descripcion: "Ilustración didáctica",
      paleta_hex: ["#112233"],
    },
    personajes: [],
    escenarios: [],
    montaje: { subtitulos: true },
  };
  for (let round = 1; round <= rounds; round++) {
    const canal_id = `total-r${round}`,
      video_id = `total-v${round}`;
    const roundEvidence = { ronda: round, canal_id, video_id, pasos: [] };
    evidence.rondas.push(roundEvidence);
    async function step(name, input, fn) {
      const start = Date.now();
      const out = await fn();
      roundEvidence.pasos.push({
        paso: name,
        inicio: new Date(start).toISOString(),
        duracionMs: Date.now() - start,
        entrada: input,
        salida: out,
      });
      save();
      console.log(`R${round} ${name}: ${Date.now() - start}ms`);
      return out;
    }
    const proposal = {
      canal: {
        nombre_propuesto: `Ciencia de prueba ${round}`,
        nicho: "Ciencia cotidiana",
        publico: "Curiosos",
        promesa: "Explicaciones con dibujos",
        formatos: ["short"],
      },
      evidencia: [],
      primeros_temas: ["Cielo al atardecer"],
    };
    await step("nicho e idea", { criterios: "Ciencia cotidiana" }, async () => {
      await call("orquestador", {
        evento: "nuevo_canal",
        cooper: true,
        canal_id,
        criterios: "Ciencia cotidiana",
        dueno_email: "total@example.test",
      });
      const t = await job("investigar_nichos", canal_id);
      await callback(t, proposal);
      return { job_id: t.job_id, propuesta: proposal };
    });
    await step("aprobar canal y crear biblia", proposal, async () => {
      const a = await approval(canal_id, null, "canal");
      const t = await job("crear_biblia", canal_id);
      await callback(t, biblia);
      await wait(
        async () =>
          (await rows("canales")).find(
            (c) => c.canal_id === canal_id && c.estado === "activo",
          ),
        "canal activo",
      );
      return { aprobacion: a, job_id: t.job_id, biblia };
    });
    const channel = (await rows("canales")).find(
      (c) => c.canal_id === canal_id,
    );
    await api.update(tables.canales, channel, {
      uploadpost_perfil: "perfil-total-ficticio",
      redes: "youtube",
      plataformas: "youtube",
    });
    await step("radar", { canal_id, nicho: channel.nicho }, async () => {
      await call("radar", { canal_id, accion: "correr" });
      const c = await wait(
        async () =>
          (await rows("canales")).find(
            (c) => c.canal_id === canal_id && c.tendencias,
          ),
        "radar guardado",
      );
      return JSON.parse(c.tendencias);
    });
    const guion = {
      titulo: "Cielo al atardecer: la luz cambia",
      tema_elegido: "Cielo al atardecer",
      ganchos: ["¿Por qué cambia el color del cielo cuando cae la tarde?"],
      gancho_elegido: 0,
      guion:
        "La luz cruza el aire y sus colores se dispersan. Al atardecer recorre un camino mayor y vemos colores cálidos.",
      rubrica: {
        gancho: 9,
        promesa: 9,
        claridad: 9,
        emocion: 9,
        exactitud: 9,
        originalidad: 9,
      },
    };
    await step(
      "guion",
      { canal_id, video_id, tema: "Cielo al atardecer" },
      async () => {
        await call("orquestador", {
          evento: "nuevo_video",
          canal_id,
          video_id,
          formato: "short",
          tema: "Cielo al atardecer",
        });
        const t = await job("guion", canal_id, video_id);
        const pedido = await payloadTrabajo(t.job_id);
        assert.ok(pedido.datos.tendencias?.ideas.length);
        assert.equal(pedido.datos.nicho, "Ciencia cotidiana");
        await callback(t, guion);
        return { job_id: t.job_id, pedido, guion };
      },
    );
    const storyboard = {
      planos: [1, 2, 3].map((i) => ({
        id: `p0${i}`,
        tipo: i === 3 ? "imagen" : "archivo",
        busqueda: "atardecer cielo",
        texto_narrado:
          i === 1
            ? "La luz del sol cruza el aire y sus colores se dispersan en distintas direcciones mientras observamos el cielo desde nuestra ventana."
            : "Al atardecer la luz recorre un camino mucho mayor por el aire y por eso vemos colores cálidos cerca del horizonte.",
        prompt_imagen: "Diagrama propio de luz al atardecer",
        encuadre: "general",
        movimiento: "zoom lento",
        personajes: [],
        escenario: "cielo",
        transicion: "corte",
        texto_pantalla: "",
      })),
      musica: {},
      efectos: [],
      cortes: [],
      miniatura: {},
      publicacion: {
        youtube: {
          titulos: [guion.titulo],
          descripcion: "Ensayo con datos ficticios",
        },
      },
    };
    await step("aprobar guion y storyboard", guion, async () => {
      const a = await approval(canal_id, video_id, "guion");
      const t = await job("storyboard", canal_id, video_id);
      await callback(t, storyboard);
      return { aprobacion: a, job_id: t.job_id, storyboard };
    });
    await step("imágenes voz render y calidad", storyboard, async () => {
      await approval(canal_id, video_id, "storyboard");
      const a = await wait(
        async () =>
          (await rows("aprobaciones")).find(
            (a) =>
              a.video_id === video_id &&
              a.etapa === "final" &&
              a.estado === "pendiente",
          ),
        "render y aprobación final",
      );
      const video = (await rows("videos")).find((v) => v.video_id === video_id);
      assert.ok(video.render_url);
      const escenas = JSON.parse(video.cooper_escenas);
      assert.equal(escenas.length, 3);
      assert.ok(escenas.every((p) => p.voz && (p.imagen || p.clip)));
      return {
        video,
        planos: (await rows("planos")).filter((p) => p.video_id === video_id),
        aprobacion: JSON.parse(a.pedido),
      };
    });
    await step(
      "aprobación final y publicación simulada",
      { video_id },
      async () => {
        await approval(canal_id, video_id, "final");
        await wait(
          async () =>
            (await rows("publicaciones")).find((p) => p.video_id === video_id),
          "envío registrado",
        );
        await call("confirmar", { video_id });
        const pubs = await wait(async () => {
          const p = (await rows("publicaciones")).filter(
            (p) => p.video_id === video_id,
          );
          return p.length && p.every((p) => p.estado === "publicado")
            ? p
            : false;
        }, "publicación simulada");
        return { publicaciones: pubs };
      },
    );
    await step(
      "métricas y aprendizaje",
      { video_id, desplazamientoReloj: "publicado hace 2 días" },
      async () => {
        for (const p of (await rows("publicaciones")).filter(
          (p) => p.video_id === video_id,
        ))
          await api.update(tables.publicaciones, p, {
            publicado_en: new Date(
              Date.now() - 2 * 86400000 - 60000,
            ).toISOString(),
          });
        await call("metricas", {});
        const t = await job("aprender", canal_id);
        const pedido = await payloadTrabajo(t.job_id);
        assert.ok(
          pedido.datos.redes.some(
            (p) =>
              p.video_id === video_id &&
              p.shotlist.length === 3 &&
              p.guion.texto,
          ),
        );
        const leccion = {
          lecciones: [
            {
              leccion: "Mostrar el cambio de color desde el primer plano",
              evidencia: "Retención ficticia de ensayo",
              confianza: "baja",
            },
          ],
          resumen: "Ensayo: adelantar la explicación visual.",
        };
        await callback(t, leccion);
        await wait(
          async () =>
            (await rows("trabajos")).find(
              (x) => x.job_id === t.job_id && x.estado === "listo",
            ),
          "aprendizaje listo",
        );
        return {
          job_id: t.job_id,
          pedido,
          leccion,
          publicaciones: (await rows("publicaciones")).filter(
            (p) => p.video_id === video_id,
          ),
        };
      },
    );
    await step(
      "siguiente guion recibe aprendizaje",
      { canal_id, video_id: `${video_id}-siguiente` },
      async () => {
        await call("orquestador", {
          evento: "nuevo_video",
          canal_id,
          video_id: `${video_id}-siguiente`,
          formato: "short",
          tema: "Luz en una nube",
        });
        const t = await job("guion", canal_id, `${video_id}-siguiente`);
        const pedido = await payloadTrabajo(t.job_id);
        assert.ok(
          pedido?.datos.aprendizaje?.length,
          "El aprendizaje debe viajar al siguiente guion",
        );
        assert.ok(
          pedido.datos.tendencias?.ideas?.length,
          "El radar debe viajar al siguiente guion",
        );
        await callback(t, {
          ...guion,
          titulo: "Luz en una nube",
          guion:
            "Mostrar el cambio de color desde el primer plano. " + guion.guion,
        });
        await wait(
          async () =>
            (await rows("aprobaciones")).find(
              (a) =>
                a.video_id === `${video_id}-siguiente` && a.etapa === "guion",
            ),
          "siguiente guion pendiente humano",
        );
        return { pedido, estadoFinal: "aprobacion_guion intencional" };
      },
    );
    roundEvidence.resultado = "PASS";
    save();
  }
  evidence.errores = await errors();
  assert.deepEqual(evidence.errores, []);
  for (const [name, anteriores] of Object.entries(copiaAntes)) {
    const actuales = await rows(name);
    for (const fila of anteriores)
      assert.deepEqual(
        actuales.find((x) => x.id === fila.id),
        fila,
        `Histórico alterado: ${name}/${fila.id}`,
      );
  }
  evidence.pruebas.push(
    "Copia histórica intacta después de todas las corridas",
  );
  const execs = await until(
    async () => {
      const lista = await api.all("/executions");
      return lista.some((e) => ["waiting", "running", "new"].includes(e.status))
        ? false
        : lista;
    },
    "ejecuciones terminadas sin esperas colgadas",
    30000,
  );
  const [trabajos, videos, aprobaciones] = await Promise.all(
    ["trabajos", "videos", "aprobaciones"].map(rows),
  );
  const propios = (filas) =>
    filas.filter((f) => /^total-r\d+$/.test(f.canal_id));
  evidence.estadosFinales = {
    trabajos: propios(trabajos).map(
      ({ job_id, canal_id, video_id, modo, estado }) => ({
        job_id,
        canal_id,
        video_id,
        modo,
        estado,
      }),
    ),
    videos: propios(videos).map(({ video_id, canal_id, etapa, estado }) => ({
      video_id,
      canal_id,
      etapa,
      estado,
    })),
    aprobaciones: propios(aprobaciones).map(
      ({ aprobacion_id, video_id, canal_id, etapa, estado }) => ({
        aprobacion_id,
        video_id,
        canal_id,
        etapa,
        estado,
      }),
    ),
  };
  assert.equal(
    propios(trabajos).filter((t) => t.estado !== "listo").length,
    0,
    "Todos los encargos del ensayo deben terminar",
  );
  const pendientes = propios(aprobaciones).filter(
    (a) => a.estado === "pendiente",
  );
  assert.equal(
    pendientes.length,
    rounds,
    "Solo debe quedar la aprobación humana del siguiente guion por corrida",
  );
  assert.ok(
    pendientes.every(
      (a) => a.etapa === "guion" && a.video_id.endsWith("-siguiente"),
    ),
  );
  for (const v of propios(videos)) {
    if (v.video_id.endsWith("-siguiente"))
      assert.equal(v.etapa, "aprobacion_guion");
    else
      assert.equal(
        v.estado,
        "publicado",
        "El video publicado no debe conservar un estado en curso",
      );
  }
  const traza = await trazarPasos(api, execs);
  writeFileSync(`${dir}/pasos-motor.json`, JSON.stringify(traza, null, 2));
  evidence.traza = { archivo: "pasos-motor.json", pasos: traza.length };
  evidence.ejecuciones = execs.map((e) => ({
    id: e.id,
    workflowId: e.workflowId,
    status: e.status,
    startedAt: e.startedAt,
    stoppedAt: e.stoppedAt,
  }));
  assert.equal(
    execs.filter((e) => ["waiting", "running", "new"].includes(e.status))
      .length,
    0,
    "No deben quedar ejecuciones colgadas",
  );
  evidence.resultado = "PASS";
} catch (error) {
  evidence.resultado = "FAIL";
  evidence.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await cleanup();
  console.log("Evidencia: " + dir);
}
