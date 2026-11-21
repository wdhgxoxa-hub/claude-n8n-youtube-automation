// Ensayo del receptor exportado en n8n real; sin salida a Internet ni proveedores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { startN8n, podman, CONTAINER, secret, until, assertNoEnvFiles } from '../cooper/scripts/ensayo-infra.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const leer = id => JSON.parse(readFileSync(`${root}workflows/v2/${id}.json`, 'utf8'));
const codigo = (w, nombre) => w.nodes.find(n => n.name === nombre).parameters.jsCode;
function ejecutar(js, json = {}, nodos = {}) {
  const $ = nombre => ({first: () => ({json:nodos[nombre]})});
  return new Function('$', '$json', '$execution', js)($, json, {id:'ensayo-ficticio'})[0].json;
}

test('M01: routine ficticia, retorno autenticado y ruta real del Orquestador en n8n aislado', {timeout:180000}, async t => {
  assertNoEnvFiles();
  const n8n = await startN8n(0, {credencialFicticia:true});
  try {
    const {api} = n8n;
    const clave = secret();
    const credencial = await api.request('POST', '/credentials', {
      name:'Clave Fábrica ficticia M01', type:'httpHeaderAuth', data:{name:'x-ensayo-retorno', value:clave},
    });
    const tabla = async (name, columns) => (await api.request('POST', '/data-tables', {
      name, columns:columns.map(name => ({name, type:'string'})),
    })).id;
    const trabajos = await tabla('fab_trabajos', ['job_id','modo','estado','resultado','video_id','canal_id','dueno_email']);
    const eventos = await tabla('ensayo_eventos', ['job_id','evento','modo','video_id','canal_id','dueno_email','ruta']);
    const insertar = data => api.request('POST', `/data-tables/${trabajos}/rows`, {data:[data], returnType:'all'});
    const filas = () => api.rows(trabajos);
    const eventosDe = async job => (await api.rows(eventos)).filter(e => e.job_id === job);
    const actualizado = async job => (await filas()).find(t => t.job_id === job);
    const recibido = async job => {
      try {
        await until(async () => (await eventosDe(job)).length === 1, 'evento del Orquestador', 10000);
      } catch (error) {
        // Solo errores de la sonda ficticia, nunca cuerpos/cabeceras del webhook.
        for (const e of (await api.all('/executions')).filter(e => e.workflowId === sonda.id && e.status === 'error')) {
          const d = await api.request('GET',`/executions/${e.id}?includeData=true`);
          console.error('Sonda ficticia:',d.data?.resultData?.error?.message);
        }
        throw error;
      }
    };
    const bodyFor = w => ({name:w.name,nodes:w.nodes,connections:w.connections,settings:w.settings});
    const guardar = async w => api.request('POST','/workflows',bodyFor(w));
    const publicar = async id => {
      await api.request('POST',`/workflows/${id}/publish`,{});
      await until(async () => {
        const w = await api.request('GET',`/workflows/${id}`);
        return w.active && w.activeVersionId === w.versionId;
      }, 'publicación local');
    };
    const link = node => ({node,type:'main',index:0});
    const nodo = (name, type, parameters, typeVersion = 2) => ({name,type:'n8n-nodes-base.'+type,parameters,typeVersion,id:randomUUID(),position:[0,0]});
    const orq = leer('FabOrquestador01');
    // Se ejecutan Inicio y Ruta originales. La continuación es un sumidero de eventos,
    // para observar el despacho sin abrir aprobaciones, Telegram ni producción.
    const sonda = await guardar({
      name:'M01 · Orquestador sin efectos', settings:{executionOrder:'v1'},
      nodes:[...orq.nodes.filter(n => ['Inicio','Ruta'].includes(n.name)),
        nodo('Evento observado','code',{jsCode:`const e=$('Inicio').first().json; return [{json:{job_id:e.job_id,evento:e.evento,modo:e.modo,video_id:e.video_id,canal_id:e.canal_id,dueno_email:e.dueno_email,ruta:$json.clave}}];`}),
        nodo('Guardar evento','dataTable',{resource:'row',operation:'insert',dataTableId:{__rl:true,mode:'id',value:eventos},columns:{mappingMode:'autoMapInputData',value:{},schema:[],matchingColumns:[]},options:{}},1.1)],
      connections:{Inicio:{main:[[link('Ruta')]]},Ruta:{main:[[link('Evento observado')]]},'Evento observado':{main:[[link('Guardar evento')]]}},
    });
    await publicar(sonda.id);
    const receptor = leer('FabRetornoClaud1');
    delete receptor.settings.errorWorkflow;
    for (const n of receptor.nodes) {
      if (n.parameters.dataTableId) n.parameters.dataTableId.value = trabajos;
      if (n.name === 'Resultado de Claude') n.credentials = {httpHeaderAuth:{id:credencial.id,name:credencial.name}};
      if (n.name === 'Avisar al orquestador') {
        n.parameters.workflowId.value = `={{ '${sonda.id}' }}`;
      }
    }
    const importado = await guardar(receptor);
    await publicar(importado.id);
    const llamar = async (body, autenticacion = clave, ruta = '/webhook/video-factory/resultado') => {
      const r = await fetch(n8n.url+ruta, {method:'POST',headers:{'Content-Type':'application/json', ...(autenticacion ? {'x-ensayo-retorno':autenticacion} : {})},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
      const texto = await r.text();
      let respuesta;
      try { respuesta = JSON.parse(texto); } catch { respuesta = {status:'rechazo_http'}; }
      return {codigo:r.status, body:respuesta};
    };
    await until(async () => (await llamar({})).codigo === 409, 'webhook registrado');
    const aj = ejecutar(codigo(leer('FabAjustes000001'),'Ajustes'));
    let contador = 0;
    const preparar = async (estado = 'enviado') => {
      // La routine ficticia recibe el sobre real. No se llama a Anthropic.
      const pedido = ejecutar(codigo(leer('FabLlamarClaude1'),'Preparar trabajo'), {}, {Inicio:{modo:'guion',video_id:'video-ficticio',canal_id:'canal-ficticio',datos:{tema:'Ensayo'}},'Leer ajustes':aj});
      pedido.payload.job_id = `guion-ensayo-c${++contador}`;
      assert.equal(pedido.payload.retorno_url, 'https://flujos.cooperestudio.com/webhook/video-factory/resultado');
      assert.equal(pedido.payload.retorno_version, 1);
      await insertar({...pedido.fila,job_id:pedido.payload.job_id,estado,dueno_email:'dueno@example.test'});
      return {job_id:pedido.payload.job_id,modo:pedido.payload.modo,estado:'ok',resultado:{guion:'Solo ficción',titulo:'Prueba'},avisos:[]};
    };
    let principal;
    await t.test('sin clave o con clave incorrecta: 403 y ninguna escritura', async () => {
      principal = await preparar();
      for (const cred of ['', 'incorrecta']) assert.equal((await llamar(principal,cred)).codigo,403);
      assert.equal((await actualizado(principal.job_id)).estado,'enviado');
      assert.equal((await eventosDe(principal.job_id)).length,0);
    });
    await t.test('routine ficticia → webhook → trabajo → ruta del Orquestador con dueño persistido', async () => {
      assert.deepEqual(await llamar({...principal,dueno_email:'intruso@example.test',video_id:'ajeno'}),{codigo:200,body:{status:'recibido'}});
      await recibido(principal.job_id);
      const e = (await eventosDe(principal.job_id))[0];
      assert.equal(e.dueno_email,'dueno@example.test');
      assert.equal(e.video_id,'video-ficticio');
      assert.equal(e.canal_id,'canal-ficticio');
      assert.equal(e.ruta,'claude_ok:guion');
      assert.equal((await actualizado(principal.job_id)).estado,'listo');
    });
    await t.test('duplicado idéntico, incluso reordenado: 200 sin segundo despacho; alterado: 409', async () => {
      assert.equal((await llamar(principal)).codigo,200);
      assert.equal((await llamar({...principal,resultado:{titulo:'Prueba',guion:'Solo ficción'}})).codigo,200);
      assert.equal((await llamar({...principal,resultado:{guion:'Distinto'}})).codigo,409);
      assert.equal((await eventosDe(principal.job_id)).length,1);
    });
    await t.test('modo discordante, trabajo inexistente o bloqueado: 409', async () => {
      const b = await preparar('bloqueado');
      for (const cuerpo of [b,{...principal,modo:'storyboard'},{...principal,job_id:'guion-no-existe'}])
        assert.equal((await llamar(cuerpo)).codigo,409);
      const distinto = await preparar();
      await api.update(trabajos,await actualizado(distinto.job_id),{modo:'storyboard'});
      assert.equal((await llamar(distinto)).codigo,409);
      assert.equal((await eventosDe(distinto.job_id)).length,0);
    });
    await t.test('ocho retornos simultáneos reservan y despachan una sola vez', async () => {
      const b = await preparar();
      const respuestas = await Promise.all(Array.from({length:8},() => llamar(b)));
      assert.ok(respuestas.every(r => [200,202].includes(r.codigo)));
      await recibido(b.job_id);
      assert.equal((await llamar(b)).codigo,200);
      assert.equal((await eventosDe(b.job_id)).length,1);
    });
    await t.test('error de la routine se guarda y enruta como claude_error una sola vez', async () => {
      const b = {...await preparar(),estado:'error',resultado:null,avisos:['Fallo ficticio']};
      assert.equal((await llamar(b)).codigo,200);
      await recibido(b.job_id);
      assert.equal((await actualizado(b.job_id)).estado,'error');
      assert.equal((await eventosDe(b.job_id))[0].evento,'claude_error');
      assert.equal((await llamar(b)).codigo,200);
    });
    await t.test('callback tardío después de timeout de envío conserva el trabajo original', async () => {
      const b = await preparar('envio_incierto');
      assert.equal((await llamar(b)).codigo,200);
      await recibido(b.job_id);
      assert.equal((await actualizado(b.job_id)).estado,'listo');
    });
    await t.test('caída después de reservar: persiste la incertidumbre tras reiniciar n8n y no redespacha', async () => {
      const b = await preparar();
      // Inyección en el punto de caída: copia exacta del resultado que persistió
      // el receptor, con su huella; se detiene antes de Avisar al orquestador.
      const conCaida = structuredClone(receptor);
      conCaida.connections['¿Reserva propia?'].main[0] = [link('Responder revisión')];
      await api.request('PUT',`/workflows/${importado.id}`,bodyFor(conCaida));
      await publicar(importado.id);
      assert.equal((await llamar(b)).codigo,202);
      assert.equal((await actualizado(b.job_id)).estado,'retorno_en_curso');
      assert.equal((await eventosDe(b.job_id)).length,0);
      await api.request('PUT',`/workflows/${importado.id}`,bodyFor(receptor));
      await publicar(importado.id);
      podman('restart',CONTAINER);
      await until(async () => {try{return (await fetch(n8n.url+'/healthz/readiness')).ok;}catch{return false;}},'reinicio aislado',60000);
      assert.deepEqual(await llamar(b),{codigo:202,body:{status:'revision_requerida'}});
      assert.equal((await eventosDe(b.job_id)).length,0);
    });
    await t.test('caída del despacho: 202, conserva resultado y evita confirmación falsa', async () => {
      const b = await preparar();
      const caido = structuredClone(receptor);
      caido.nodes.find(n => n.name === 'Avisar al orquestador').parameters.workflowId.value = "={{ ['no','existe','m01'].join('-') }}";
      await api.request('PUT',`/workflows/${importado.id}`,bodyFor(caido));
      await publicar(importado.id);
      assert.equal((await llamar(b)).codigo,202);
      assert.equal((await actualizado(b.job_id)).estado,'retorno_en_curso');
      assert.equal((await eventosDe(b.job_id)).length,0);
      await api.request('PUT',`/workflows/${importado.id}`,bodyFor(receptor));
      await publicar(importado.id);
      assert.equal((await llamar(b)).codigo,202);
      assert.equal((await eventosDe(b.job_id)).length,0);
    });
    await t.test('el Orquestador puede terminar sin ítems sin perder la confirmación', async () => {
      const vacio = await guardar({name:'M01 · Tramo vacío',settings:{executionOrder:'v1'},
        nodes:[...orq.nodes.filter(n => n.name === 'Inicio'),nodo('Terminar','code',{jsCode:'return [];'})],
        connections:{Inicio:{main:[[link('Terminar')]]}},
      });
      await publicar(vacio.id);
      const sinSalida = structuredClone(receptor);
      sinSalida.nodes.find(n => n.name === 'Avisar al orquestador').parameters.workflowId.value = `={{ '${vacio.id}' }}`;
      await api.request('PUT',`/workflows/${importado.id}`,bodyFor(sinSalida));
      await publicar(importado.id);
      const b = await preparar();
      assert.equal((await llamar(b)).codigo,200);
      assert.equal((await actualizado(b.job_id)).estado,'listo');
      await api.request('PUT',`/workflows/${importado.id}`,bodyFor(receptor));
      await publicar(importado.id);
    });
    await t.test('URL antigua no se usa ni se sigue como respaldo', async () => {
      const viejo = {...aj,baseUrl:'https://antiguo.ngrok-free.dev',retornoUrl:'https://antiguo.ngrok-free.dev/webhook/video-factory/resultado'};
      assert.throws(() => ejecutar(codigo(leer('FabLlamarClaude1'),'Preparar trabajo'),{},{Inicio:{modo:'guion'},'Leer ajustes':viejo}));
      assert.equal((await llamar(principal,clave,'/webhook/retorno-antiguo')).codigo,404);
    });
    await t.test('reversa local restaura versión anterior y conserva trabajos sin reentregarlos', async () => {
      const antes = (await filas()).map(x => [x.job_id,x.estado,x.resultado]);
      const {execFileSync} = await import('node:child_process');
      const anterior = JSON.parse(execFileSync('git',['show','de397f3:workflows/v2/FabRetornoClaud1.json'],{cwd:root,encoding:'utf8'}));
      delete anterior.settings.errorWorkflow;
      for (const n of anterior.nodes) {
        if(n.parameters.dataTableId) n.parameters.dataTableId.value = trabajos;
        if(n.name === 'Resultado de Claude') n.credentials = {httpHeaderAuth:{id:credencial.id,name:credencial.name}};
        if(n.name === 'Avisar al orquestador') n.parameters.workflowId.value = `={{ '${sonda.id}' }}`;
      }
      await api.request('PUT',`/workflows/${importado.id}`,bodyFor(anterior));
      await publicar(importado.id);
      assert.deepEqual((await filas()).map(x => [x.job_id,x.estado,x.resultado]),antes);
      await api.request('POST',`/workflows/${importado.id}/unpublish`,{});
      assert.equal((await api.request('GET',`/workflows/${importado.id}`)).active,false);
    });
  } finally {
    podman('stop',CONTAINER);
  }
});
