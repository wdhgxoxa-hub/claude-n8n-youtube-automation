/** Fallos y recuperación sobre la misma copia LOCAL del ensayo total. */
import assert from "node:assert/strict";
import { podman, until } from "./ensayo-infra.mjs";

const bodyWorkflow = ({ name, nodes, connections, settings }) => ({
  name,
  nodes,
  connections,
  settings,
});
const biblia = {
  voz: { descripcion: "Narrador del ensayo", gemini_voice: "Charon" },
  estilo_visual: { descripcion: "Esquemas propios", paleta_hex: ["#112233"] },
  personajes: [],
  escenarios: [],
  montaje: { subtitulos: true },
};

export async function runResiliencia(ctx) {
  const {
    api,
    url,
    ids,
    rows,
    insert,
    call,
    wrapper,
    publish,
    rounds,
    evidence,
    save,
    expectedErrors,
    container,
    restartReceiver,
    callback,
    job,
  } = ctx;
  assert.ok(expectedErrors instanceof Set);
  assert.ok(Number.isInteger(rounds) && rounds >= 3);
  assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.match(container, /^cooper-total-n8n-(?:e2e|ramas)$/);
  const labels = JSON.parse(
    podman("inspect", "--format", "{{json .Config.Labels}}", container),
  );
  assert.equal(labels["cooper.ensayo"], "true");
  const casos = (evidence.resiliencia ||= []);
  const registrar = (caso) => {
    casos.push({ ...caso, resultado: "PASS" });
    save();
    console.log(`Resiliencia R${caso.ronda} ${caso.caso}: PASS`);
  };
  const detalle = (id) =>
    api.request("GET", `/executions/${id}?includeData=true`);
  const reposo = () =>
    until(
      async () => {
        const es = await api.all("/executions");
        return !es.some((e) => ["running", "new"].includes(e.status));
      },
      "motor en reposo antes de caída deliberada",
      90000,
    );
  const terminar = (id) =>
    until(
      async () => {
        const e = await detalle(id);
        return e.status === "success" && e;
      },
      `ejecución ${id} terminada`,
      90000,
    );
  async function encontrarEjecucion(workflowId, videoId, status) {
    return until(
      async () => {
        const es = await api.all("/executions");
        for (const e of es.filter(
          (e) =>
            e.workflowId === workflowId && [status, "error"].includes(e.status),
        )) {
          const d = await detalle(e.id);
          const entrada =
            d.data?.resultData?.runData?.Inicio?.[0]?.data?.main?.[0]?.[0]
              ?.json;
          if (entrada?.video_id !== videoId) continue;
          assert.equal(
            d.status,
            status,
            `${videoId}: ${d.data.resultData.lastNodeExecuted}: ${d.data.resultData.error?.message}`,
          );
          return d;
        }
        return false;
      },
      `${workflowId}/${videoId} en ${status}`,
      90000,
    );
  }
  async function sembrarVideo(canal_id, video_id) {
    await insert("canales", [
      {
        canal_id,
        nombre: "Canal ficticio de resiliencia",
        nicho: "Prueba local",
        estado: "activo",
        eliminado: false,
        formato_defecto: "short",
        dueno_email: "resiliencia@example.test",
      },
    ]);
    await insert("videos", [
      {
        canal_id,
        video_id,
        tema: "Ensayo de fallo controlado",
        formato: "short",
        etapa: "produccion",
        estado: "en_proceso",
        eliminado: false,
        presupuesto_usd: 10,
      },
    ]);
  }
  async function caerYVolver(ronda, punto) {
    await reposo();
    const inicio = new Date().toISOString();
    // La autorización de esta misión solo alcanza esta copia con etiqueta y red interna.
    const red = JSON.parse(
      podman(
        "inspect",
        "--format",
        "{{json .NetworkSettings.Networks}}",
        container,
      ),
    );
    for (const nombre of Object.keys(red))
      assert.equal(
        JSON.parse(podman("network", "inspect", nombre))[0].internal,
        true,
      );
    podman("kill", "--signal", "KILL", container);
    assert.equal(
      podman("inspect", "--format", "{{.State.Running}}", container),
      "false",
    );
    assert.equal(
      podman("inspect", "--format", "{{.State.ExitCode}}", container),
      "137",
    );
    podman("start", container);
    await until(
      async () => {
        try {
          return (await fetch(`${url}/healthz/readiness`)).ok;
        } catch {
          return false;
        }
      },
      "n8n recuperado tras SIGKILL",
      60000,
    );
    await restartReceiver();
    const evento = {
      ronda,
      punto,
      señal: "SIGKILL",
      exitCode: 137,
      inicio,
      fin: new Date().toISOString(),
    };
    (evidence.caidas ||= []).push(evento);
    save();
    return evento;
  }
  await publish(ids.FabSonido0000001);
  await publish(ids.FabAprobacion001);
  await publish(ids.FabProduccion001);
  await wrapper("resiliencia-sonido", ids.FabSonido0000001);
  await wrapper("resiliencia-aprobacion", ids.FabAprobacion001);
  await wrapper("resiliencia-produccion", ids.FabProduccion001);

  for (let ronda = 1; ronda <= rounds; ronda++) {
    const canal_id = `ramas-error-sonido-r${ronda}`,
      video_id = `${canal_id}-v`;
    await sembrarVideo(canal_id, video_id);
    await call("resiliencia-sonido", {
      canal_id,
      video_id,
      presentacion: { version: 999 },
      planos: [],
    });
    const ejecucion = await encontrarEjecucion(
      ids.FabSonido0000001,
      video_id,
      "error",
    );
    assert.equal(ejecucion.data.resultData.lastNodeExecuted, "Textos de voz");
    assert.match(
      ejecucion.data.resultData.error.message,
      /Presentación inválida/,
    );
    expectedErrors.add(String(ejecucion.id));
    const incidencia = await until(
      async () =>
        (await rows("eventos")).find(
          (e) =>
            e.video_id === video_id &&
            e.tipo === "incidencia_cooper" &&
            e.evento === `${ejecucion.id}:error`,
        ),
      "Vigilante registra incidencia pública",
      30000,
    );
    const video = await until(
      async () =>
        (await rows("videos")).find(
          (v) => v.video_id === video_id && v.estado === "con_fallas",
        ),
      "Vigilante conserva estado terminal",
      30000,
    );
    assert.ok(video.error);
    assert.equal(
      (await rows("publicaciones")).filter((p) => p.video_id === video_id)
        .length,
      0,
    );
    registrar({
      caso: "contrato de voz inválido y Vigilante",
      ronda,
      canal_id,
      video_id,
      ejecucion: ejecucion.id,
      nodo: "Textos de voz",
      estado: video.estado,
      incidencia: incidencia.evento,
    });

    const antes = await rows("trabajos");
    const respuestas = [];
    for (const data of [
      { job_id: "invalido", modo: "guion", estado: "ok", resultado: {} },
      {
        job_id: `guion-inexistente-r${ronda}`,
        modo: "guion",
        estado: "ok",
        resultado: {},
      },
    ]) {
      const response = await fetch(`${url}/webhook/video-factory/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(30000),
      });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).status, "rechazado");
      respuestas.push({ job_id: data.job_id, http: response.status });
    }
    assert.deepEqual(await rows("trabajos"), antes);
    registrar({
      caso: "callback inválido y desconocido rechazados",
      ronda,
      respuestas,
    });
  }

  // Solo se cambia la respuesta de un proveedor ficticio, nunca conexiones o lógica de fábrica.
  const original = bodyWorkflow(
    await api.request("GET", `/workflows/${ids.FabProduccion001}`),
  );
  const fallo = structuredClone(original);
  const consulta = fallo.nodes.find((n) => n.name === "Consultar render");
  assert.equal(consulta.type, "n8n-nodes-base.code");
  consulta.parameters = {
    mode: "runOnceForAllItems",
    jsCode:
      "return $input.all().map(() => ({json:{id:'render-fallido-ensayo',status:'failed',error_message:'Fallo ficticio de montaje'}}));",
  };
  await api.request("PUT", `/workflows/${ids.FabProduccion001}`, fallo);
  await api.request("POST", `/workflows/${ids.FabProduccion001}/publish`, {});
  try {
    for (let ronda = 1; ronda <= rounds; ronda++) {
      const canal_id = `ramas-error-render-r${ronda}`,
        video_id = `${canal_id}-v`;
      await sembrarVideo(canal_id, video_id);
      const storyboard = {
        planos: [1, 2, 3].map((i) => ({
          id: `p0${i}`,
          tipo: "archivo",
          busqueda: "cielo de ensayo",
          busqueda_archivo: "cielo de ensayo",
          texto_narrado:
            "Esta narración ficticia comprueba la rama de montaje y conserva una duración suficiente para recorrer las piezas del ensayo local.",
          prompt_imagen: "Esquema propio del cielo",
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
        publicacion: {},
      };
      await call("resiliencia-produccion", {
        canal_id,
        video_id,
        formato: "short",
        presupuesto_usd: 10,
        biblia,
        guion: { titulo: "Fallo de render", guion: "Guion ficticio" },
        storyboard,
      });
      const ejecucion = await encontrarEjecucion(
        ids.FabProduccion001,
        video_id,
        "success",
      );
      const runs = ejecucion.data.resultData.runData;
      assert.ok(runs["Render · fallo durable"]);
      assert.equal(runs["Consultar render"].length, 1);
      assert.equal(runs["Encargo de calidad"], undefined);
      const video = (await rows("videos")).find((v) => v.video_id === video_id);
      assert.equal(video.estado, "con_fallas");
      assert.equal(video.etapa, "montaje");
      assert.ok(video.error);
      assert.equal(
        (await rows("aprobaciones")).filter((a) => a.video_id === video_id)
          .length,
        0,
      );
      assert.equal(
        (await rows("publicaciones")).filter((p) => p.video_id === video_id)
          .length,
        0,
      );
      registrar({
        caso: "render fallido conserva fallo durable",
        ronda,
        canal_id,
        video_id,
        ejecucion: ejecucion.id,
        estado: video.estado,
        etapa: video.etapa,
        consultas: 1,
        aprobaciones: 0,
        publicaciones: 0,
      });
    }
  } finally {
    await api.request("PUT", `/workflows/${ids.FabProduccion001}`, original);
    await api.request("POST", `/workflows/${ids.FabProduccion001}/publish`, {});
  }

  for (let ronda = 1; ronda <= rounds; ronda++) {
    const canal_id = `ramas-recuperacion-r${ronda}`;
    const propuesta = {
      canal: {
        nombre_propuesto: "Canal recuperado",
        nicho: "Ciencia local",
        publico: "Equipo de ensayo",
        promesa: "Explicaciones con esquemas",
        formatos: ["short"],
      },
      evidencia: [],
      primeros_temas: ["Cielo de ensayo"],
    };
    await call("resiliencia-aprobacion", {
      canal_id,
      etapa: "canal",
      contexto: propuesta,
      mensaje: "Aprobación ficticia para comprobar recuperación tras caída",
    });
    const aprobacion = await until(
      async () =>
        (await rows("aprobaciones")).find(
          (a) => a.canal_id === canal_id && a.estado === "pendiente",
        ),
      "aprobación de recuperación persistida",
      30000,
    );
    const form = new URL(aprobacion.url);
    const executionId = form.pathname.match(
      /^\/form-waiting\/(\d+)(?:\/|$)/,
    )?.[1];
    assert.ok(executionId);
    await until(
      async () => (await detalle(executionId)).status === "waiting",
      "Wait durable preparado",
      30000,
    );
    const antes = await detalle(executionId);
    const caida = await caerYVolver(ronda, "aprobación en Wait");
    const despues = await detalle(executionId);
    assert.equal(despues.status, "waiting");
    assert.equal(despues.startedAt, antes.startedAt);
    assert.equal(despues.workflowId, antes.workflowId);
    assert.deepEqual(
      (await rows("aprobaciones")).find((a) => a.id === aprobacion.id),
      aprobacion,
    );
    const enviarFormulario = () => {
      const body = new FormData();
      body.set("field-0", "Aprobar");
      body.set("field-1", "");
      return fetch(url + form.pathname + form.search, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(30000),
      });
    };
    assert.equal((await enviarFormulario()).status, 200);
    await terminar(executionId);
    const trabajo = await job("crear_biblia", canal_id);
    const decision = (await rows("aprobaciones")).find(
      (a) => a.id === aprobacion.id,
    );
    assert.equal(decision.estado, "aprobado");
    const repetida = await enviarFormulario();
    assert.ok([200, 404, 409].includes(repetida.status));
    await reposo();
    assert.equal(
      (await rows("trabajos")).filter(
        (t) => t.canal_id === canal_id && t.modo === "crear_biblia",
      ).length,
      1,
    );
    assert.deepEqual(
      (await rows("aprobaciones")).find((a) => a.id === aprobacion.id),
      decision,
    );
    registrar({
      caso: "Wait reanuda misma ejecución tras SIGKILL",
      ronda,
      canal_id,
      ejecucion: executionId,
      aprobacion_id: aprobacion.aprobacion_id,
      caida,
      estado: "success",
      formularioRepetidoHTTP: repetida.status,
      trabajosCreados: 1,
    });

    const caidaTrabajo = await caerYVolver(
      ronda,
      "trabajo externo enviado antes del callback",
    );
    assert.deepEqual(
      (await rows("trabajos")).find((t) => t.id === trabajo.id),
      trabajo,
    );
    await callback(trabajo, biblia);
    const canal = await until(
      async () =>
        (await rows("canales")).find(
          (c) => c.canal_id === canal_id && c.estado === "activo",
        ),
      "callback posterior a caída activa el canal",
      30000,
    );
    assert.equal(canal.biblia_ruta, `trabajo:${trabajo.job_id}`);
    const trabajos = (await rows("trabajos")).filter(
      (t) => t.canal_id === canal_id && t.modo === "crear_biblia",
    );
    assert.equal(trabajos.length, 1);
    assert.equal(trabajos[0].estado, "listo");
    const repetirCallback = await fetch(
      `${url}/webhook/video-factory/resultado`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: trabajo.job_id,
          modo: trabajo.modo,
          estado: "ok",
          resultado: biblia,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    assert.equal(repetirCallback.status, 409);
    await reposo();
    assert.deepEqual(
      (await rows("trabajos")).filter(
        (t) => t.canal_id === canal_id && t.modo === "crear_biblia",
      ),
      trabajos,
    );
    registrar({
      caso: "callback pendiente sobrevive SIGKILL sin duplicar",
      ronda,
      canal_id,
      job_id: trabajo.job_id,
      caida: caidaTrabajo,
      estado: "listo",
      callbackRepetidoHTTP: 409,
    });
  }
  await reposo();
  assert.equal(
    (await api.all("/executions")).filter((e) =>
      ["running", "new", "waiting"].includes(e.status),
    ).length,
    0,
  );
  return casos;
}
