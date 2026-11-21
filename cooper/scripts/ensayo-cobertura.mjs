import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
export async function cobertura(c) {
  const {
    request,
    adminCookie,
    otherCookie,
    rows,
    api,
    ids,
    tables,
    insert,
    until,
    n8n,
    pass,
  } = c;
  const op = await request(adminCookie, "operacion");
  assert.equal(op.modo, "n8n");
  assert(op.canales.length >= 2);
  assert(
    (await request(otherCookie, "operacion")).canales.every(
      (c) => !["ciencia", "historia"].includes(c.id),
    ),
  );
  const ajustes = await request(adminCookie, "admin/fabrica");
  await request(otherCookie, "admin/fabrica", "GET", undefined, 403);
  await request(adminCookie, "operacion", "POST", {
    accion: "ajustes",
    revision: ajustes.revision,
    valores: { presupuestoShortUsd: 3.1 },
    confirmado: true,
  });
  await until(
    async () =>
      (await request(adminCookie, "admin/fabrica")).valores
        .presupuestoShortUsd === 3.1,
    "ajuste persistido",
  );
  await request(
    adminCookie,
    "operacion",
    "POST",
    {
      accion: "ajustes",
      revision: ajustes.revision,
      valores: { presupuestoShortUsd: 4 },
      confirmado: true,
    },
    409,
  );
  pass(
    "cobertura: consulta por dueño, ajustes efectivos y revisión obsoleta en n8n",
  );
  for (const control of [
    { accion: "biblia", campo: "voz.tono", valor: "Sereno y claro" },
    {
      accion: "metas",
      videos_semana: 4,
      formato: "short",
      auto: false,
      retencion_min: 0.6,
    },
    {
      accion: "redes",
      perfil: "perfil_ensayo",
      redes: ["youtube", "instagram"],
      zona: "America/Lima",
    },
  ]) {
    await request(otherCookie, "operacion", "POST", {
      ...control,
      canalId: "cocina",
      confirmado: true,
    });
    await until(async () => {
      const cc = (await request(otherCookie, "operacion")).canales.find(
        (x) => x.id === "cocina",
      );
      return control.accion === "biblia"
        ? cc.biblia["voz.tono"] === "Sereno y claro"
        : control.accion === "metas"
          ? cc.metas.videos_semana === 4
          : cc.perfil === "perfil_ensayo";
    }, "control " + control.accion);
  }
  pass("cobertura: biblia, metas y plataformas aplicadas por el Orquestador");
  // Reutiliza el formulario y su registro del generador. Solo elimina las llamadas finales a producción.
  const source = JSON.parse(
    readFileSync("../workflows/v2/FabAprobacion001.json", "utf8"),
  );
  const nodos = source.nodes.filter((n) =>
    [
      "Aprobación · preparar",
      "Aprobación · registrar",
      "Aprobación · esperar",
      "Aprobación · decisión",
      "Aprobación · cerrar",
    ].includes(n.name),
  );
  const preparar = nodos.find((n) => n.name === "Aprobación · preparar");
  preparar.parameters.jsCode =
    "return [{json:{aprobacion_id:'ap-cobertura-real',canal_id:'cocina',video_id:'',etapa:'canal',estado:'pendiente',resumen:'Propuesta de ensayo',pedido:'{}',url:$execution.resumeFormUrl}}];";
  for (const n of nodos) {
    if (n.parameters.dataTableId)
      n.parameters.dataTableId.value = tables.aprobaciones;
  }
  const wait = nodos.find((n) => n.name === "Aprobación · esperar");
  wait.parameters.formTitle = "Ensayo de decisión";
  wait.parameters.formDescription = "Datos ficticios";
  const trigger = {
    id: "trigger-cobertura",
    name: "Inicio de ensayo",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 0],
    webhookId: "cobertura-ensayo",
    parameters: {
      httpMethod: "POST",
      path: "ensayo-cobertura-decision",
      responseMode: "onReceived",
      options: {},
    },
  };
  const names = [trigger.name, ...nodos.map((n) => n.name)];
  const connections = {};
  for (let i = 0; i < names.length - 1; i++)
    connections[names[i]] = {
      main: [[{ node: names[i + 1], type: "main", index: 0 }]],
    };
  const nuevo = await api.request("POST", "/workflows", {
    name: "Ensayo · decisión de cobertura",
    nodes: [trigger, ...nodos],
    connections,
    settings: {
      executionOrder: "v1",
      saveDataSuccessExecution: "none",
      saveDataErrorExecution: "none",
    },
  });
  await api.request("POST", `/workflows/${nuevo.id}/publish`, {});
  await until(async () => {
    const res = await fetch(n8n.url + "/webhook/ensayo-cobertura-decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (res.status === 404) return false;
    assert.equal(
      res.status,
      200,
      "Webhook de ensayo: " + (await res.text()).slice(0, 250),
    );
    return true;
  }, "webhook publicado");
  const fila = await until(
    async () =>
      (await rows("aprobaciones")).find(
        (x) => x.aprobacion_id === "ap-cobertura-real",
      ),
    "espera creada",
  );
  const aj = await api.request("GET", `/workflows/${ids.FabAjustes000001}`);
  aj.nodes.find((n) => n.name === "Ajustes").parameters.jsCode = aj.nodes
    .find((n) => n.name === "Ajustes")
    .parameters.jsCode.replace(
      /baseUrl:\s*'[^']*'/,
      "baseUrl: '" + new URL(fila.url).origin + "'",
    );
  await api.request("PUT", `/workflows/${ids.FabAjustes000001}`, {
    name: aj.name,
    nodes: aj.nodes,
    connections: aj.connections,
    settings: aj.settings,
  });
  await api.request("POST", `/workflows/${ids.FabAjustes000001}/publish`, {});
  await request(otherCookie, "operacion", "POST", {
    accion: "decidir",
    id: "ap-cobertura-real",
    decision: "cambios",
    cambios: "Más claridad",
    confirmado: true,
  });
  const final = await until(
    async () =>
      (await rows("aprobaciones")).find(
        (x) =>
          x.aprobacion_id === "ap-cobertura-real" && x.estado === "cambios",
      ),
    "decisión consumida",
  );
  assert.equal(final.cambios, "Más claridad");
  await request(
    otherCookie,
    "operacion",
    "POST",
    {
      accion: "decidir",
      id: "ap-cobertura-real",
      decision: "aprobar",
      cambios: "",
      confirmado: true,
    },
    409,
  );
  await insert("eventos", [
    {
      canal_id: "cocina",
      video_id: "",
      tipo: "rutina_cooper",
      evento: "ensayo-rutina",
      detalle: JSON.stringify({
        decision: "No producir",
        motivo: "Hay un video en curso.",
        frenos: ["Producción en curso"],
      }),
    },
  ]);
  assert(
    (await request(otherCookie, "operacion")).canales
      .find((x) => x.id === "cocina")
      .rutina.some((x) => x.motivo === "Hay un video en curso."),
  );
  pass(
    "cobertura: formulario nativo reanudado una sola vez y rutina consultable",
  );
}
