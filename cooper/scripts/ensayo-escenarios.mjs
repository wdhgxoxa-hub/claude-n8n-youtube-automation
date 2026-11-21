import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { ADMIN, OTHER } from "./ensayo-infra.mjs";

export async function scenarios(ctx) {
  const {
    api,
    ids,
    tables,
    rows,
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
  } = ctx;
  const bridge = async (
    body,
    status = 200,
    token = n8n.env.COOPER_N8N_TOKEN,
  ) => {
    const r = await fetch(`${n8n.url}/webhook/cooper/v1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    assert.equal(r.status, status, `FX ${body.evento}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  };
  const envelope = (evento, datos = {}, email = OTHER) => ({
    version: "cooper-v1",
    id_evento: randomUUID(),
    evento,
    dueno_email: email,
    admin: email === ADMIN,
    datos,
  });
  await bridge(envelope("estado"), 401, "incorrecto");
  await bridge(envelope("gastos"), 403);
  await bridge(envelope("aprobar_guion", { id: "guion-admin" }), 404);
  await bridge({ ...envelope("estado"), admin: true }, 403);
  await request(otherCookie, "videos/guion-admin/aprobar", "POST", {}, 404);
  await request(
    otherCookie,
    "orden",
    "POST",
    { evento: "nuevo_video", recursoId: "ciencia", texto: "Intento ajeno" },
    404,
  );
  await request(otherCookie, "admin", "GET", undefined, 403);
  const costs = await request(adminCookie, "admin");
  assert(JSON.stringify(costs).includes("1.25"));
  assert(JSON.stringify(costs).includes("0.5"));
  pass(
    "token inválido, rol falsificado, recursos ajenos y gasto exclusivo del administrador",
  );

  const createdChannel = await request(otherCookie, "orden", "POST", {
    evento: "nuevo_canal",
    texto: "Huertos en balcones",
    nombre: "Huerto urbano",
  });
  await until(
    async () =>
      (await rows("canales")).find(
        (c) => c.canal_id === createdChannel.id && c.dueno_email === OTHER,
      ),
    "reserva del canal",
  );
  const adminVideo = await request(adminCookie, "orden", "POST", {
    evento: "nuevo_video",
    recursoId: "ciencia",
    texto: "Por qué flota el hielo",
    parametros: { formato: "short" },
  });
  const otherVideo = await request(otherCookie, "orden", "POST", {
    evento: "nuevo_video",
    recursoId: "cocina",
    texto: "Por qué crece la masa",
    parametros: { formato: "short" },
  });
  for (const [result, email] of [
    [adminVideo, ADMIN],
    [otherVideo, OTHER],
  ]) {
    await until(
      async () =>
        (await rows("videos")).find(
          (v) => v.video_id === result.id && v.dueno_email === email,
        ),
      "video persistido",
    );
    await until(
      () =>
        local.prepare("SELECT stage FROM videos WHERE id=?").get(result.id)
          ?.stage === 1,
      "callback real de creación",
    );
    const jobs = await until(async () => {
      const found = (await rows("trabajos")).filter(
        (j) => j.video_id === result.id,
      );
      return found.length ? found : false;
    }, "trabajo de guion persistido");
    assert(
      jobs.every((job) => job.dueno_email === email),
      "El trabajo debe conservar el dueño del video",
    );
  }
  pass(
    "creación de canal y videos con dos cuentas, persistencia y callback HMAC emitido por n8n",
  );

  // Entrada exclusivamente de prueba para alimentar subflujos reales con fixtures.
  const trigger = {
    id: randomUUID(),
    name: "Fixture",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 0],
    webhookId: randomUUID(),
    parameters: {
      httpMethod: "POST",
      path: "cooper-ensayo/fixture",
      responseMode: "onReceived",
      options: {},
    },
  };
  const auth = {
    id: randomUUID(),
    name: "Validar fixture",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [220, 0],
    parameters: {
      jsCode: `if($json.headers.authorization !== 'Bearer '+$env.COOPER_N8N_TOKEN) throw new Error('Fixture no autorizado'); const b=$json.body; const flows=${JSON.stringify({ progreso: ids.FabCooperProgr01, presentacion: ids.FabPresentacion1, costo: ids.FabCooperCosto01 })}; if(!flows[b.tipo]) throw new Error('Tipo no permitido'); return [{json:{workflow:flows[b.tipo],datos:b.datos}}];`,
    },
  };
  const call = {
    id: randomUUID(),
    name: "Subflujo real",
    type: "n8n-nodes-base.executeWorkflow",
    typeVersion: 1.2,
    position: [440, 0],
    parameters: {
      workflowId: { __rl: true, mode: "id", value: "={{ $json.workflow }}" },
      workflowInputs: { mappingMode: "defineBelow", value: {} },
      options: { waitForSubWorkflow: false },
    },
  };
  const data = {
    id: randomUUID(),
    name: "Datos",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [330, 0],
    parameters: { jsCode: "return [{json:$json.datos}];" },
  };
  call.parameters.workflowId.value =
    "={{ $('Validar fixture').first().json.workflow }}";
  const fixture = await api.request("POST", "/workflows", {
    name: "Ensayo · entrada local de fixtures",
    nodes: [trigger, auth, data, call],
    connections: {
      Fixture: { main: [[{ node: auth.name, type: "main", index: 0 }]] },
      [auth.name]: { main: [[{ node: data.name, type: "main", index: 0 }]] },
      [data.name]: { main: [[{ node: call.name, type: "main", index: 0 }]] },
    },
    settings: {
      executionOrder: "v1",
      saveDataSuccessExecution: "none",
      saveDataErrorExecution: "none",
    },
  });
  await api.request("POST", `/workflows/${fixture.id}/publish`, {});
  const run = async (tipo, datos) => {
    const r = await until(async () => {
      const response = await fetch(`${n8n.url}/webhook/cooper-ensayo/fixture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${n8n.env.COOPER_N8N_TOKEN}`,
        },
        body: JSON.stringify({ tipo, datos }),
      });
      return response.status === 404 ? false : response;
    }, "registro del webhook local de fixtures");
    assert.equal(r.status, 200);
  };
  const signed = async (payload, status = 200, invalid = false) => {
    const body = JSON.stringify(payload),
      timestamp = String(Date.now());
    const signature = createHmac(
      "sha256",
      invalid ? "incorrecto" : n8n.env.COOPER_WEBHOOK_SECRET,
    )
      .update(timestamp + "." + body)
      .digest("hex");
    const r = await fetch(`${appURL}/api/n8n/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cooper-timestamp": timestamp,
        "x-cooper-signature": `sha256=${signature}`,
      },
      body,
    });
    assert.equal(r.status, status, `Callback ${payload.tipo}`);
    return r.json();
  };
  const progress = {
    version: "cooper-v1",
    tipo: "progreso",
    id_evento: `ensayo:${randomUUID()}`,
    video: {
      id: otherVideo.id,
      dueno_email: OTHER,
      canal_id: "cocina",
      titulo: "Por qué crece la masa",
      stage: 2,
      script: "La levadura transforma los azúcares.",
      actualizado_en: Date.now() + 100,
    },
  };
  await signed(progress, 401, true);
  assert.equal(
    local.prepare("SELECT stage FROM videos WHERE id=?").get(otherVideo.id)
      .stage,
    1,
  );
  await signed(progress);
  const events = local.prepare("SELECT count(*) AS n FROM events").get().n;
  await signed(progress);
  assert.equal(
    local.prepare("SELECT count(*) AS n FROM events").get().n,
    events,
  );
  await signed({ ...progress, video: { ...progress.video, stage: 3 } }, 409);
  await signed(
    {
      ...progress,
      id_evento: `ensayo:${randomUUID()}`,
      video: { ...progress.video, dueno_email: ADMIN },
    },
    404,
  );
  pass(
    "firma inválida sin efecto, callback duplicado idempotente, contenido cambiado y dueño ajeno rechazados",
  );

  const recovering = (await rows("videos")).find(
    (v) => v.video_id === otherVideo.id,
  );
  recovering.etapa = "aprobacion_guion";
  recovering.guion_cooper = "Guion recuperado de ensayo";
  recovering.cooper_actualizado_en = Date.now() + 200;
  recovering.cooper_evento_id = `recuperacion:${randomUUID()}`;
  await api.update(tables.videos, recovering, {
    etapa: recovering.etapa,
    guion_cooper: recovering.guion_cooper,
    cooper_actualizado_en: recovering.cooper_actualizado_en,
    cooper_evento_id: recovering.cooper_evento_id,
  });
  relay.failProgress = 2;
  await run("progreso", recovering);
  await until(
    () =>
      local.prepare("SELECT stage FROM videos WHERE id=?").get(otherVideo.id)
        ?.stage === 3,
    "recuperación de callback",
    30000,
  );
  assert.equal(relay.failures, 2);
  assert.equal(
    local
      .prepare("SELECT count(*) AS n FROM bridge_receipts WHERE id=?")
      .get(recovering.cooper_evento_id).n,
    1,
  );
  const countAfter = local.prepare("SELECT count(*) AS n FROM events").get().n;
  await run("progreso", recovering);
  await until(
    () =>
      relay.deliveries.filter(
        (d) => d.payload.id_evento === recovering.cooper_evento_id,
      ).length >= 4,
    "reenvío del mismo callback",
  );
  assert.equal(
    local.prepare("SELECT count(*) AS n FROM events").get().n,
    countAfter,
  );
  pass(
    "callback con dos fallos de transporte recuperado por los reintentos reales de n8n sin duplicar eventos",
  );

  await request(otherCookie, "videos/guion-ana/aprobar", "POST", {});
  await request(adminCookie, "videos/guion-admin/aprobar", "POST", {});
  await until(
    async () =>
      (await rows("aprobaciones"))
        .filter((a) =>
          ["ap-guion-ana", "ap-guion-admin"].includes(a.aprobacion_id),
        )
        .every((a) => a.estado === "decidida"),
    "ambas aprobaciones de guion",
  );
  await until(
    () =>
      local.prepare("SELECT stage FROM videos WHERE id='guion-ana'").get()
        ?.stage === 4,
    "guion avanza a storyboard",
  );
  await request(adminCookie, "videos/final-admin/aprobar", "POST", {});
  await until(
    async () =>
      (await rows("aprobaciones")).find(
        (a) => a.aprobacion_id === "ap-final-admin",
      )?.estado === "decidida",
    "aprobación final",
  );
  await until(
    () =>
      local.prepare("SELECT stage FROM videos WHERE id='final-admin'").get()
        ?.stage === 10,
    "final programado",
  );
  pass(
    "aprobaciones de guion y final cierran decisiones y avanzan por el Orquestador real",
  );
  const date = new Date(Date.now() + 86400000).toISOString();
  await request(otherCookie, "orden", "POST", {
    evento: "programar",
    recursoId: otherVideo.id,
    texto: date,
  });
  await until(
    async () =>
      (await rows("videos")).find((v) => v.video_id === otherVideo.id)
        ?.publicar_en === date,
    "programación persistida",
  );
  await request(otherCookie, "videos/borrar-ana", "DELETE");
  await until(
    async () =>
      (await rows("videos")).find((v) => v.video_id === "borrar-ana")
        ?.eliminado === true,
    "eliminación remota",
  );
  assert(!local.prepare("SELECT id FROM videos WHERE id='borrar-ana'").get());
  await request(adminCookie, "videos/montaje-admin", "DELETE", undefined, 409);
  pass(
    "programación, eliminación en reposo y rechazo de borrado durante producción",
  );
  await request(otherCookie, `canales/${createdChannel.id}`, "DELETE");
  await until(
    async () =>
      (await rows("canales")).find((c) => c.canal_id === createdChannel.id)
        ?.eliminado === true,
    "eliminación del canal en reposo",
  );
  const cost = {
    video_id: otherVideo.id,
    concepto: "Paso ficticio reproducible",
    servicio: "Ensayo",
    usd: 0.125,
    paso_id: `paso:${randomUUID()}`,
    dueno_email: ADMIN,
  };
  await run("costo", cost);
  await until(
    async () => (await rows("costos")).find((c) => c.paso_id === cost.paso_id),
    "costo atribuido",
  );
  await run("costo", cost);
  await until(
    async () =>
      !(await api.all("/executions")).some((e) =>
        ["new", "running"].includes(e.status),
      ),
    "costo repetido finalizado",
  );
  const attributed = (await rows("costos")).filter(
    (c) => c.paso_id === cost.paso_id,
  );
  assert.equal(attributed.length, 1);
  assert.equal(attributed[0].dueno_email, OTHER);
  pass(
    "eliminación de canal y costo idempotente atribuido por tablas, ignorando un dueño enviado falso",
  );

  const demoAvatar = state.catalogo.find((a) => a.kind === "avatar").id;
  await request(
    otherCookie,
    "orden",
    "POST",
    {
      evento: "nuevo_video",
      recursoId: "cocina",
      texto: "Ensayo con demostración",
      avatarId: demoAvatar,
    },
    422,
  );
  const user = local.prepare("SELECT id FROM users WHERE email=?").get(OTHER);
  const asset = randomUUID();
  local
    .prepare(
      "INSERT INTO assets (id,owner_id,kind,name,verified,evidence_id,provider,provider_id,simulated,consent_at,created_at) VALUES (?,?, 'avatar','Presentador ficticio',1,'ensayo','heygen','look-ficticio-sin-servicio',0,?,?)",
    )
    .run(asset, user.id, Date.now(), Date.now());
  const selected = await request(otherCookie, "orden", "POST", {
    evento: "nuevo_video",
    recursoId: "cocina",
    texto: "Ensayo con presentador apagado",
    avatarId: asset,
    avatarPlacement: "completo",
  });
  await until(
    async () => (await rows("videos")).some((v) => v.video_id === selected.id),
    "presentación persistida",
  );
  await run("presentacion", { video_id: selected.id, control: "medios" });
  await until(
    () =>
      local
        .prepare("SELECT production_state FROM videos WHERE id=?")
        .get(selected.id)?.production_state === "pausada",
    "pausa por interruptor apagado",
  );
  const paused = local
    .prepare("SELECT * FROM videos WHERE id=?")
    .get(selected.id);
  assert.equal(paused.avatar_id, asset);
  assert.match(paused.production_notice, /desactivada/);
  assert.equal(
    (await rows("videos")).find((v) => v.video_id === selected.id).estado,
    "detenido",
  );
  assert.equal(
    (await rows("costos")).filter((c) => c.video_id === selected.id).length,
    0,
  );
  pass(
    "422 recuperable de recurso simulado y presentación real ficticia pausada con interruptores apagados, sin gasto",
  );

  // Caída después del despacho real: el receptor falla al confirmar, no al reservar.
  const pendingDate = new Date(Date.now() + 172800000).toISOString();
  relay.failConfirm = true;
  await request(
    otherCookie,
    "orden",
    "POST",
    { evento: "programar", recursoId: otherVideo.id, texto: pendingDate },
    409,
  );
  relay.failConfirm = false;
  const uncertain = local
    .prepare(
      "SELECT * FROM bridge_commands WHERE json_extract(request,'$.datos.texto')=?",
    )
    .get(pendingDate);
  assert.equal(uncertain.confirmed, 0);
  assert(uncertain.execution);
  const pending = JSON.parse(uncertain.request);
  assert.equal(
    (await rows("videos")).find((v) => v.video_id === otherVideo.id)
      .publicar_en,
    pendingDate,
  );
  const confirms = relay.deliveries.filter(
    (d) =>
      d.payload.id_evento === pending.id_evento &&
      d.payload.fase === "confirmar",
  );
  assert(confirms.length >= 1);
  await bridge(pending, 409);
  const beforeEvent = (await rows("videos")).find(
    (v) => v.video_id === otherVideo.id,
  ).cooper_evento_id;
  assert.equal((await signed(confirms[0].payload)).estado, "confirmada");
  await bridge(pending);
  assert.equal(
    (await rows("videos")).find((v) => v.video_id === otherVideo.id)
      .cooper_evento_id,
    beforeEvent,
  );
  pass(
    "confirmación caída tras despacho real: reserva bloqueada, recuperación firmada y reentrega sin repetir",
  );

  const controller = new AbortController();
  const sse = await fetch(`${appURL}/api/eventos`, {
    headers: { Cookie: otherCookie },
    signal: controller.signal,
  });
  const reader = sse.body.getReader();
  let chunks = "";
  while (!chunks.includes("event: estado")) {
    const item = await reader.read();
    if (item.done) break;
    chunks += Buffer.from(item.value).toString();
  }
  controller.abort();
  assert(
    !/guion-admin|final-admin|costo_usd|presupuesto_usd|routineUrl|look-ficticio/.test(
      chunks,
    ),
  );
  assert.match(chunks, /event: progreso/);
  pass(
    "SSE del dueño sin videos ajenos, costos, IDs remotos ni enlaces internos",
  );
  const original = local
    .prepare(
      "SELECT request FROM bridge_commands WHERE json_extract(request,'$.datos.id')=? AND confirmed=1",
    )
    .get(adminVideo.id);
  await bridge(JSON.parse(original.request));
  assert.equal(
    (await rows("videos")).filter((v) => v.video_id === adminVideo.id).length,
    1,
  );
  for (const [event, id] of [
    ["aprobar_guion", "guion-admin"],
    ["eliminar", "borrar-ana"],
  ]) {
    const previous = local
      .prepare(
        "SELECT request FROM bridge_commands WHERE json_extract(request,'$.evento')=? AND json_extract(request,'$.datos.id')=? AND confirmed=1",
      )
      .get(event, id);
    await bridge(JSON.parse(previous.request));
  }
  pass(
    "reentrega confirmada de creación, aprobación y eliminación sin repetir sus efectos",
  );
  process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".cache/browsers");
  const { chromium } = await import("@playwright/test");
  if (!existsSync(chromium.executablePath()))
    execFileSync(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "install", "chromium"],
      { stdio: "inherit" },
    );
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const [name, ...parts] = otherCookie.split("=");
    await page
      .context()
      .addCookies([{ name, value: parts.join("="), url: appURL }]);
    await page.goto(`${appURL}/videos/${selected.id}`);
    await page.getByText("En pausa", { exact: true }).first().waitFor();
    assert(!(await page.getByText("Administración", { exact: true }).count()));
    await page.screenshot({
      path: `${dir}/presentacion-pausada-390.png`,
      fullPage: true,
    });
    await page.goto(`${appURL}/videos`);
    assert(
      !(await page
        .getByText("Por qué el cielo cambia de color al atardecer", {
          exact: true,
        })
        .count()),
    );
    await page.screenshot({
      path: `${dir}/videos-ana-390.png`,
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
  await until(
    async () =>
      !(await api.all("/executions")).some((e) =>
        ["new", "running"].includes(e.status),
      ),
    "ejecuciones concluidas",
  );
  const executions = await api.all("/executions");
  const audit = [];
  for (const execution of executions) {
    const summary = {
      id: execution.id,
      workflowId: execution.workflowId,
      status: execution.status,
    };
    if (execution.status === "error") {
      if (execution.id === uncertain.execution)
        summary.motivoEsperado = "confirmación interrumpida";
      else {
        const detail = await api.request(
          "GET",
          `/executions/${execution.id}?includeData=true`,
        );
        assert.equal(
          detail.data?.resultData?.lastNodeExecuted,
          "Detener presentación",
          `Fallo inesperado en ejecución ${execution.id}`,
        );
        summary.motivoEsperado = "interruptor apagado";
      }
    } else assert.equal(execution.status, "success");
    audit.push(summary);
  }
  writeFileSync(`${dir}/ejecuciones.json`, JSON.stringify(audit, null, 2));
  writeFileSync(
    `${dir}/escenarios.json`,
    JSON.stringify(
      {
        callbacks: relay.deliveries.length,
        fallosInducidos: relay.failures,
        tablas: Object.keys(tables).length,
        sinMediosPagos: true,
      },
      null,
      2,
    ),
  );
  pass(
    "navegador móvil con sesión local, aislamiento y presentación pausada visible",
  );
}
