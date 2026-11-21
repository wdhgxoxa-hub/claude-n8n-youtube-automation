/** Transportes de medios locales para la copia aislada; no alteran flujos originales. */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { adaptarTransportes } from "./ensayo-total-transportes.mjs";

const LIMITE = 24 * 1024 * 1024;
const OPERACIONES = new Map([
  ["FabSonido0000001:Voz (Gemini TTS)", "voz"],
  ["FabProduccion001:Generar imagen", "imagen"],
  ["FabProduccion001:Buscar en Pexels", "archivo"],
  ["FabProduccion001:Subir a Drive", "guardar"],
  ["FabSonido0000001:Subir voz a Drive", "guardar"],
  ["FabProduccion001:Renderizar", "render"],
  ["FabProduccion001:Consultar render", "consultar"],
]);

/** Solo reintenta el rechazo inequívoco previo al registro; jamás una mutación incierta. */
export async function postWebhookRegistrado(url, data, options = {}) {
  const enviar = options.fetch || fetch;
  const esperar =
    options.esperar ||
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const ahora = options.ahora || Date.now;
  const fin = ahora() + 30000;
  const body = JSON.stringify(data);
  while (true) {
    const response = await enviar(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(Math.max(1, fin - ahora())),
    });
    const text = await response.text();
    const noRegistrado =
      response.status === 404 &&
      /requested webhook[\s\S]*is not registered/i.test(text);
    if (!noRegistrado || ahora() >= fin)
      return { status: response.status, text };
    await esperar(Math.min(250, fin - ahora()));
    if (ahora() >= fin) return { status: response.status, text };
  }
}

export function adaptarMediosLocales(workflow) {
  const resultado = adaptarTransportes(workflow);
  const copia = resultado.workflow;
  for (const node of [...copia.nodes]) {
    const original = workflow.nodes.find((n) => n.id === node.id);
    const op = OPERACIONES.get(`${workflow.id}:${node.name}`);
    const registro = resultado.sustituciones.find((s) => s.nodo_id === node.id);
    if (registro && ["uploadpost", "youtube"].includes(registro.proveedor)) {
      node.parameters = {
        jsCode:
          "throw new Error('El render local prohíbe publicar o iniciar OAuth');",
      };
      registro.proveedor = "bloqueado-render-local";
      continue;
    }
    if (!op) continue;
    let entrada = "$json";
    if (op === "consultar") entrada = "$('Renderizar').first().json";
    let jsonBody = `={{ {op:${JSON.stringify(op)},entrada:${entrada}} }}`;
    if (op === "guardar") {
      const campo = original.parameters.inputDataFieldName;
      const nombre = `Medio local · ${node.name}`;
      const preparador = {
        id: `local-binario-${node.id}`,
        name: nombre,
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [node.position[0] - 80, node.position[1] + 80],
        parameters: {
          mode: "runOnceForAllItems",
          jsCode: `const out=[];for(let i=0;i<$input.all().length;i++){const item=$input.all()[i];const campo=${JSON.stringify(campo)};const bytes=await this.helpers.getBinaryDataBuffer(i,campo);if(bytes.length>${LIMITE})throw new Error('Medio local demasiado grande');out.push({json:{op:'guardar',entrada:item.json,binary:{data:bytes.toString('base64'),mimeType:item.binary[campo].mimeType,fileName:item.binary[campo].fileName}},pairedItem:{item:i}});}return out;`,
        },
      };
      for (const branches of Object.values(copia.connections))
        for (const outputs of Object.values(branches))
          for (const destinations of outputs)
            for (const destination of destinations)
              if (destination.node === node.name) destination.node = nombre;
      copia.nodes.push(preparador);
      copia.connections[nombre] = {
        main: [[{ node: node.name, type: "main", index: 0 }]],
      };
      jsonBody = "={{ $json }}";
    }
    node.type = "n8n-nodes-base.httpRequest";
    node.typeVersion = 4.2;
    node.parameters = {
      method: "POST",
      url: "http://127.0.0.1:8890/media",
      sendBody: true,
      specifyBody: "json",
      jsonBody,
      options: { timeout: 600000 },
    };
    delete node.credentials;
    delete node.onError;
    delete node.continueOnFail;
    if (registro) {
      registro.proveedor = `local:${op}`;
      registro.soportado = true;
    }
  }
  return resultado;
}

/** Puente cerrado por stdin/stdout. No abre red del host ni acepta URLs de destino. */
export function relayMediosLocales(container, atender) {
  const code = `const http=require('node:http'),readline=require('node:readline');const pendientes=new Map();let secuencia=0;const limite=${LIMITE};readline.createInterface({input:process.stdin}).on('line',line=>{let r;try{r=JSON.parse(line);}catch{return;}const p=pendientes.get(r.id);if(!p)return;pendientes.delete(r.id);clearTimeout(p.timer);p.res.writeHead(r.status,{'Content-Type':'application/json'});p.res.end(JSON.stringify(r.body));});http.createServer(async(req,res)=>{if(req.method!=='POST'||req.url!=='/media'){res.writeHead(404);res.end();return;}const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>limite){res.writeHead(413);res.end();return;}chunks.push(c);}let body;try{body=JSON.parse(Buffer.concat(chunks));}catch{res.writeHead(400);res.end();return;}const id=++secuencia;const timer=setTimeout(()=>{pendientes.delete(id);res.writeHead(504);res.end();},590000);pendientes.set(id,{res,timer});process.stdout.write(JSON.stringify({id,body})+'\\n');}).listen(8890,'127.0.0.1',()=>process.stdout.write('{"ready":true}\\n'));`;
  const child = spawn("podman", ["exec", "-i", container, "node", "-e", code], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const state = { child, solicitudes: 0, errores: 0 };
  let listo = false;
  state.ready = new Promise((resolveReady, reject) => {
    const timer = setTimeout(
      () => reject(Error("Relay local no inició")),
      15000,
    );
    child.once("error", reject);
    child.once("exit", () => {
      clearTimeout(timer);
      if (!listo) reject(Error("Relay local terminó antes de iniciar"));
    });
    createInterface({ input: child.stdout }).on("line", async (line) => {
      let request;
      try {
        if (Buffer.byteLength(line) > LIMITE) throw Error("Solicitud excedida");
        request = JSON.parse(line);
        if (request.ready) {
          listo = true;
          clearTimeout(timer);
          resolveReady();
          return;
        }
        if (!Number.isInteger(request.id)) throw Error("Solicitud inválida");
        if (!new Set(OPERACIONES.values()).has(request.body?.op))
          throw Error("Operación local no permitida");
        state.solicitudes++;
        const body = await atender(request.body);
        const response = JSON.stringify({ id: request.id, status: 200, body });
        if (Buffer.byteLength(response) > LIMITE)
          throw Error("Respuesta excedida");
        if (!child.stdin.destroyed) child.stdin.write(response + "\n");
      } catch {
        state.errores++;
        if (request?.id && !child.stdin.destroyed)
          child.stdin.write(
            JSON.stringify({
              id: request.id,
              status: 500,
              body: { error: "Falló el procesamiento local de medios" },
            }) + "\n",
          );
      }
    });
  });
  // Evita acumular la salida del proceso; nunca la publica ni conserva cuerpos.
  child.stderr.on("data", () => {});
  return state;
}
