import assert from "node:assert/strict";
import {
  readFileSync,
  readdirSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import {
  planMigration,
  applyMigration,
  reverseMigration,
} from "../../tools/migrar_dueno.mjs";
import {
  ADMIN,
  OTHER,
  CONTAINER,
  secret,
  podman,
  freePort,
  until,
  startN8n,
  callbackRelay,
  startProcess,
  stopChild,
  cleanEnv,
  assertNoEnvFiles,
} from "./ensayo-infra.mjs";

assertNoEnvFiles();
mkdirSync(".cache", { recursive: true });
const dir = resolve(mkdtempSync(".cache/e2e-ensayo-"));
const appPort = await freePort(),
  fixturePort = await freePort();
const appURL = `http://127.0.0.1:${appPort}`;
const results = [];
function pass(name) {
  results.push(name);
  console.log(`PASS ${name}`);
}
let n8n, relay, fixture, app, local;
let exitCode = 0;
let cleanupPromise;
const cleanup = () =>
  (cleanupPromise ??= (async () => {
    local?.close();
    await stopChild(relay?.child);
    await stopChild(app);
    await stopChild(fixture);
    if (n8n) podman("stop", CONTAINER);
  })());
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(130));
  });
try {
  const envBase = { ...cleanEnv(), NEXT_TELEMETRY_DISABLED: "1" };
  execFileSync("python3", ["../tools/generar_flujos_v2.py"], {
    env: { ...envBase, PYTHONDONTWRITEBYTECODE: "1" },
    stdio: "pipe",
  });
  execFileSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
    env: envBase,
    stdio: "inherit",
  });
  n8n = await startN8n(appPort);
  console.log(
    `Ensayo: ${CONTAINER}, n8n 2.47.4, ${n8n.url}; volumen ${n8n.run}/n8n`,
  );
  const { api } = n8n;
  pass("instancia aislada y propietario ficticio por REST");
  const schemas = JSON.parse(
    readFileSync("../contratos/cooper-tablas-ensayo.json", "utf8"),
  );
  const tables = {};
  for (const [name, schema] of Object.entries(schemas)) {
    tables[name.slice(4)] = (
      await api.request("POST", "/data-tables", {
        name,
        columns: Object.entries(schema).map(([name, type]) => ({ name, type })),
      })
    ).id;
  }
  const insert = (name, data) =>
    api.request("POST", `/data-tables/${tables[name]}/rows`, {
      data,
      returnType: "all",
    });
  const rows = (name) => api.rows(tables[name]);
  const channel = (id, name) => ({
    canal_id: id,
    nombre: name,
    nicho: {
      ciencia: "Ciencia cotidiana",
      rutas: "Geografía y viajes",
      cocina: "Cocina cotidiana",
    }[id],
    estado: "activo",
    biblia_ruta: `trabajo:biblia-${id}`,
    formato_defecto: "short",
    presupuesto_short_usd: 2.5,
    presupuesto_largo_usd: 5,
  });
  await insert("canales", [
    channel("ciencia", "Ciencia en casa"),
    channel("rutas", "Rutas del Perú"),
  ]);
  await insert(
    "trabajos",
    ["ciencia", "rutas"].map((id) => ({
      job_id: `biblia-${id}`,
      canal_id: id,
      video_id: "",
      modo: "crear_biblia",
      estado: "listo",
      resultado: JSON.stringify({
        resultado: { tono: "Claro", nicho: "Ciencia" },
      }),
    })),
  );
  const video = (id, canal, etapa) => ({
    video_id: id,
    canal_id: canal,
    tema: {
      "guion-admin": "Por qué el cielo cambia de color al atardecer",
      "final-admin": "La ruta del agua en los Andes",
      "montaje-admin": "Cómo conserva el calor una taza",
      "publicado-admin": "Tres paisajes del valle del Colca",
      "guion-ana": "Por qué sube la masa del pan",
      "borrar-ana": "Una salsa de tomate de temporada",
    }[id],
    formato: "short",
    etapa,
    estado: "en_proceso",
    version: 1,
    presupuesto_usd: 2.5,
    costo_usd: 0,
  });
  await insert("videos", [
    video("guion-admin", "ciencia", "aprobacion_guion"),
    video("final-admin", "rutas", "aprobacion_final"),
    video("montaje-admin", "ciencia", "montaje"),
    video("publicado-admin", "rutas", "publicado"),
  ]);
  // Más de una página para probar que la migración no omite históricos.
  await insert(
    "costos",
    Array.from({ length: 103 }, (_, i) => ({
      video_id: "guion-admin",
      concepto: `Paso ficticio ${i}`,
      servicio: "Ensayo",
      usd: i === 0 ? 1.25 : 0,
    })),
  );
  const before = await Promise.all(
    Object.values(tables).map((id) => api.rows(id)),
  );
  const dry = execFileSync(
    process.execPath,
    [
      "../tools/migrar_dueno.mjs",
      "--url",
      n8n.url,
      "--admin",
      ADMIN,
      "--asignar-todo-al-admin",
      "--simular",
    ],
    { env: { ...envBase, N8N_API_KEY: n8n.key }, encoding: "utf8" },
  );
  writeFileSync(`${dir}/migracion-simular.json`, dry);
  assert.deepEqual(
    await Promise.all(Object.values(tables).map((id) => api.rows(id))),
    before,
  );
  const plan = await planMigration(api, ADMIN, { assignAll: true });
  assert.equal(plan.updates.length, 111);
  execFileSync(
    process.execPath,
    [
      "../tools/migrar_dueno.mjs",
      "--url",
      n8n.url,
      "--admin",
      ADMIN,
      "--asignar-todo-al-admin",
      "--aplicar",
      "--respaldo",
      `${dir}/migracion-reversa.json`,
    ],
    { env: { ...envBase, N8N_API_KEY: n8n.key }, stdio: "pipe" },
  );
  assert.equal((await planMigration(api, ADMIN)).updates.length, 0);
  assert.equal((await planMigration(api, ADMIN)).columns.length, 0);
  assert.equal(await reverseMigration(api, plan, true), 111);
  await reverseMigration(api, plan, false);
  assert.equal(await reverseMigration(api, plan, false), 0);
  await applyMigration(
    api,
    await planMigration(api, ADMIN),
    `${dir}/migracion-definitiva.json`,
  );
  pass(
    "migración: simulación sin escritura, 111 filas, paginación, idempotencia y reversa",
  );
  await insert("canales", [
    {
      ...channel("cocina", "Cocina de Ana"),
      dueno_email: OTHER,
      eliminado: false,
    },
  ]);
  await insert("trabajos", [
    {
      job_id: "biblia-cocina",
      canal_id: "cocina",
      modo: "crear_biblia",
      estado: "listo",
      resultado: '{"resultado":{"tono":"Cercano"}}',
      dueno_email: OTHER,
    },
  ]);
  await insert(
    "videos",
    ["guion-ana", "borrar-ana"].map((id) => ({
      ...video(id, "cocina", "aprobacion_guion"),
      dueno_email: OTHER,
      eliminado: false,
      guion_cooper: "La masa crece por la levadura.",
      cooper_actualizado_en: Date.now(),
      cooper_evento_id: `fixture:${id}`,
    })),
  );
  await insert("costos", [
    {
      video_id: "guion-ana",
      concepto: "Ensayo Ana",
      servicio: "Ensayo",
      usd: 0.5,
      dueno_email: OTHER,
      paso_id: "fixture:ana",
      estimado: true,
    },
  ]);
  for (const [id, canal, etapa] of [
    ["guion-admin", "ciencia", "guion"],
    ["final-admin", "rutas", "final"],
    ["guion-ana", "cocina", "guion"],
  ])
    await insert("aprobaciones", [
      {
        aprobacion_id: `ap-${id}`,
        video_id: id,
        canal_id: canal,
        etapa,
        estado: "pendiente",
        url: "",
        pedido: JSON.stringify({
          contexto: {
            guion: "Guion ficticio verificado",
            titulo: "Ensayo",
            descripcion: "Datos ficticios",
            archivo_url: "",
          },
        }),
      },
    ]);
  assert.equal((await planMigration(api, ADMIN)).updates.length, 0);
  pass("dos canales del administrador, uno de Ana y videos en varias etapas");

  const workflows = readdirSync("../workflows/v2")
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(`../workflows/v2/${name}`, "utf8")));
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
    Object.entries(oldTables).map(([name, id]) => [id, tables[name]]),
  );
  const ids = {};
  const bodyFor = (wf) => ({
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings,
  });
  // REST asigna IDs: dos pasadas conservan todas las referencias del grafo.
  for (const wf of workflows) {
    const draft = await api.request("POST", "/workflows", {
      name: wf.name,
      nodes: [],
      connections: {},
      settings: { executionOrder: "v1" },
    });
    ids[wf.id] = draft.id;
    replacements[wf.id] = draft.id;
  }
  for (const source of [...workflows].sort(
    (a, b) =>
      Number(b.id === "FabErrores000001") - Number(a.id === "FabErrores000001"),
  )) {
    let encoded = JSON.stringify(source);
    for (const [oldId, newId] of Object.entries(replacements))
      encoded = encoded.replaceAll(oldId, newId);
    const wf = JSON.parse(encoded);
    for (const node of wf.nodes) {
      // Comunicaciones del operador y disparadores de producción no forman parte de este ensayo.
      if (
        node.type.includes("telegram") ||
        node.type.endsWith(".scheduleTrigger") ||
        node.type.endsWith(".formTrigger") ||
        node.type.endsWith(".chatTrigger") ||
        (node.type.endsWith(".webhook") && source.id !== "FabCooperAPI0001")
      )
        node.disabled = true;
      delete node.credentials;
      if (source.id === "FabAjustes000001" && node.name === "Ajustes") {
        node.parameters.jsCode = node.parameters.jsCode
          .replace(/(allow\w+:\s*)true/g, "$1false")
          .replace(/https:\/\/[^'\s]+/g, "http://127.0.0.1:9/ensayo-bloqueado");
      }
    }
    try {
      await api.request("PUT", `/workflows/${ids[source.id]}`, bodyFor(wf));
    } catch (error) {
      console.error(`Importación ${source.name}: ${error.detail}`);
      throw error;
    }
    if (source.id === "FabErrores000001") {
      await api.request("POST", `/workflows/${ids[source.id]}/publish`, {});
      await until(
        async () =>
          (await api.request("GET", `/workflows/${ids[source.id]}`))
            .activeVersionId,
        "publicación del gestor de errores",
      );
    }
    writeFileSync(`${dir}/${source.id}.json`, JSON.stringify(wf));
  }
  const published = new Set(["FabErrores000001"]),
    visiting = new Set();
  const publish = async (source) => {
    if (published.has(source.id)) return;
    if (visiting.has(source.id))
      throw new Error(`Ciclo estático de publicación: ${source.name}`);
    visiting.add(source.id);
    for (const node of source.nodes) {
      const ref = node.parameters.workflowId?.value;
      const dependency = workflows.find((wf) => wf.id === ref);
      if (dependency) await publish(dependency);
    }
    try {
      await api.request("POST", `/workflows/${ids[source.id]}/publish`, {});
    } catch (error) {
      console.error(`Publicación ${source.name}`);
      throw error;
    }
    await until(
      async () =>
        (await api.request("GET", `/workflows/${ids[source.id]}`))
          .activeVersionId,
      `publicación ${source.name}`,
    );
    visiting.delete(source.id);
    published.add(source.id);
  };
  for (const source of workflows.filter(
    (wf) =>
      wf.id !== "FabAgenteTelegr1" &&
      wf.nodes.some((n) => n.type.endsWith(".executeWorkflowTrigger")),
  ))
    await publish(source);
  await api.request("POST", `/workflows/${ids.FabCooperAPI0001}/publish`, {});
  writeFileSync(`${dir}/mapa.json`, JSON.stringify({ tables, ids }, null, 2));
  pass(
    `${workflows.length} workflows importados por REST; FX y subflujos publicados, proveedores apagados`,
  );

  const env = {
    ...envBase,
    AUTH_SECRET: secret(),
    AUTH_TRUST_HOST: "true",
    AUTH_URL: appURL,
    COOPER_ADMIN_EMAIL: ADMIN,
    COOPER_DATABASE_PATH: `${dir}/cooper.sqlite`,
    COOPER_DEMO: "0",
    COOPER_FABRICA: "n8n",
    COOPER_N8N_URL: `${n8n.url}/webhook/cooper/v1`,
    COOPER_N8N_TOKEN: n8n.env.COOPER_N8N_TOKEN,
    COOPER_WEBHOOK_SECRET: n8n.env.COOPER_WEBHOOK_SECRET,
    COOPER_AVATAR: "simulada",
    COOPER_VOZ_CLONADA: "simulada",
    COOPER_VOZ_CATALOGO: "simulada",
    COOPER_TRANSCRIPCION: "simulada",
    COOPER_E2E_SECRET: secret(),
    COOPER_E2E_FIXTURE_PORT: String(fixturePort),
    COOPER_ENSAYO: "1",
  };
  fixture = startProcess(
    ["--import", "tsx", "scripts/e2e-fixtures.ts"],
    env,
    `${dir}/sesiones.log`,
    true,
  );
  await new Promise((yes, no) => {
    fixture.once("message", yes);
    fixture.once("exit", () => no(new Error("Falló el emisor de sesiones")));
  });
  const appEnv = { ...env };
  delete appEnv.COOPER_E2E_SECRET;
  delete appEnv.COOPER_ENSAYO;
  app = startProcess(
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(appPort),
    ],
    appEnv,
    `${dir}/cooper.log`,
  );
  await until(async () => {
    try {
      return (await fetch(`${appURL}/entrar`)).ok;
    } catch {
      return false;
    }
  }, "Cooper listo");
  relay = callbackRelay(appURL);
  await relay.ready;
  local = new Database(`${dir}/cooper.sqlite`);
  const login = async (email) => {
    const r = await fetch(`http://127.0.0.1:${fixturePort}/sesion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, secret: env.COOPER_E2E_SECRET }),
    });
    assert.equal(r.status, 200);
    return r.headers.get("set-cookie").split(";")[0];
  };
  const adminCookie = await login(ADMIN);
  const request = async (cookie, path, method = "GET", data, status = 200) => {
    const response = await fetch(`${appURL}/api/${path}`, {
      method,
      headers: {
        Cookie: cookie,
        Origin: appURL,
        "Content-Type": "application/json",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const text = await response.text();
    assert.equal(
      response.status,
      status,
      `${method} ${path}: ${text.slice(0, 250)}`,
    );
    return text ? JSON.parse(text) : null;
  };
  await request(adminCookie, "admin/permitidos", "POST", { email: OTHER });
  const otherCookie = await login(OTHER);
  await request(adminCookie, "chat", "POST", { texto: "estado" });
  await request(otherCookie, "chat", "POST", { texto: "estado" });
  const state = await request(otherCookie, "estado");
  assert.equal(state.channels.length, 1);
  assert.equal(state.videos.length, 2);
  assert(!JSON.stringify(state).includes("guion-admin"));
  pass(
    "sesiones Auth.js de dos cuentas y consulta aislada desde Cooper hacia n8n",
  );
  // Los escenarios adicionales se mantienen juntos para comprobar el mismo grafo publicado.
  const context = {
    api,
    ids,
    tables,
    rows,
    insert,
    request,
    adminCookie,
    otherCookie,
    local,
    n8n,
    relay,
    appURL,
    dir,
    pass,
    until,
    state,
  };
  const { scenarios } = await import("./ensayo-escenarios.mjs");
  await scenarios(context);
  const { cobertura } = await import("./ensayo-cobertura.mjs");
  await cobertura(context);
} catch (error) {
  exitCode = 1;
  if (error.detail) console.error(`Validación REST de ensayo: ${error.detail}`);
  console.error(`FAIL ${error.stack}`);
  if (n8n) {
    const failures = (await n8n.api.all("/executions")).filter(
      (e) => e.status === "error",
    );
    for (const failure of failures.slice(0, 6)) {
      const detail = await n8n.api.request(
        "GET",
        `/executions/${failure.id}?includeData=true`,
      );
      console.error(
        JSON.stringify({
          ejecucion: failure.id,
          workflow: detail.workflowData?.name,
          nodo: detail.data?.resultData?.lastNodeExecuted,
          error: detail.data?.resultData?.error?.message,
        }),
      );
    }
  }
} finally {
  await cleanup();
  writeFileSync(
    `${dir}/resultado.json`,
    JSON.stringify(
      {
        exitCode,
        results,
        stopped: n8n
          ? podman("inspect", "--format", "{{.State.Status}}", CONTAINER)
          : null,
      },
      null,
      2,
    ),
  );
  console.log(
    `Evidencia: ${dir}; resultado ${exitCode}. Instancia conservada y detenida.`,
  );
}
process.exitCode = exitCode;
