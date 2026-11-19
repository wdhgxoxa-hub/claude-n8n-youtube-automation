const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { mkdtempSync, readFileSync, readdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createRequire } = require('node:module');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const installation = process.env.FACTORY_N8N_DIR;
assert.ok(installation, 'Set FACTORY_N8N_DIR to the n8n 2.47.4 package directory.');
const packageFile = join(installation, 'package.json');
assert.equal(JSON.parse(readFileSync(packageFile, 'utf8')).version, '2.47.4');

Object.assign(process.env, {
  N8N_USER_FOLDER: mkdtempSync(join(tmpdir(), 'video-factory-smoke-')),
  N8N_DIAGNOSTICS_ENABLED: 'false',
  N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
  N8N_PERSONALIZATION_ENABLED: 'false',
  N8N_COMMUNITY_PACKAGES_ENABLED: 'false',
  N8N_CUSTOM_EXTENSIONS: '',
  N8N_TEMPLATES_ENABLED: 'false',
  N8N_LOG_LEVEL: 'error',
  N8N_EXPRESSION_ENGINE: 'quickjs',
});
const n8n = createRequire(packageFile);
const { Container } = n8n('@n8n/di');
const { Expression, Workflow } = n8n('n8n-workflow');
const { WorkflowExecute } = n8n('n8n-core');
const { NodeTypes } = n8n('./dist/node-types');
const { LoadNodesAndCredentials } = n8n('./dist/load-nodes-and-credentials');

const workflowDir = join(__dirname, '..', 'workflows');
const configs = readdirSync(workflowDir).filter(name => name.endsWith('.json')).sort()
  .map(name => JSON.parse(readFileSync(join(workflowDir, name), 'utf8')));
const allowedChat = '100000123';
const videoId = 'v_native_test';
const mediaUrl = 'https://files.heygen.ai/video/test.mp4?fixture=1';
const sheet = new Map();
const state = {};
const asItem = json => ({ json });

async function run(number, json, { form, upload = false } = {}) {
  const config = structuredClone(configs[number - 1]);
  const nodeTypes = Container.get(NodeTypes);
  const log = { responses: [], messages: [], calls: [] };
  for (const node of config.nodes) {
    const { description } = nodeTypes.getByNameAndVersion(node.type, node.typeVersion);
    if (description.credentials?.length) {
      node.credentials = Object.fromEntries(description.credentials.map(({ name }) => [name, { id: 'synthetic', name: 'synthetic' }]));
    }
    if (node.name === 'Factory Settings') {
      for (const field of node.parameters.assignments.assignments) {
        if (field.name === 'telegramChatId') field.value = allowedChat;
        if (field.name === 'spreadsheetId') field.value = 'synthetic_document_id_1234';
        if (field.name === 'allowYoutubeUpload') field.value = upload;
      }
    }
  }

  const workflow = new Workflow({ ...config, nodeTypes, id: 'fixture' + number, active: false });
  const start = workflow.getNode(config.nodes[0].name);
  const input = asItem(json);
  if (number === 4) {
    input.binary = { data: { data: Buffer.from(JSON.stringify(json.body)).toString('base64'), mimeType: 'application/json' } };
  }
  const extra = {
    currentNodeExecutionIndex: 0,
    executionId: '987',
    timezone: 'America/Lima',
    formWaitingBaseUrl: 'https://n8n.example.test/form-waiting',
    webhookWaitingBaseUrl: 'https://n8n.example.test/webhook-waiting',
    webhookBaseUrl: 'https://n8n.example.test/webhook',
    webhookTestBaseUrl: 'https://n8n.example.test/webhook-test',
    resumeToken: 'test-token',
    credentialsHelper: {
      isCredentialUsableByNode: (type, nodeType) => type === 'crypto' && nodeType === 'n8n-nodes-base.crypto',
      async getDecrypted(_data, _credential, type) {
        assert.equal(type, 'crypto');
        return { hmacSecret: 'native-fixture' };
      },
    },
    hooks: {
      async runHook(name, args) {
        if (name === 'sendResponse') log.responses.push(args[0]);
      },
    },
    async evalNodeMockHandler(context) {
      const node = context.getNode();
      const input = context.getInputData();
      const item = input[0];
      log.calls.push(node.name);
      const parameter = name => context.getNodeParameter(name, 0);

      if (node.type.endsWith('.code')) {
        const proxy = context.getWorkflowDataProxy(0);
        const evaluate = new AsyncFunction('$input', '$', '$getWorkflowStaticData', parameter('jsCode'));
        const result = await evaluate.call(context, { first: () => item, all: () => input }, proxy.$, () => state);
        return [result];
      }
      if (node.type.endsWith('.telegram')) {
        log.messages.push({ chatId: parameter('chatId'), text: parameter('text') });
        return [[asItem({ ok: true, message_id: log.messages.length })]];
      }
      if (node.type.endsWith('.wait')) {
        assert.match(parameter('formDescription'), /Última línea/);
        return [[asItem(form ?? {})]];
      }
      if (node.type.endsWith('.googleSheets')) {
        assert.equal(parameter('documentId').value, 'synthetic_document_id_1234');
        assert.equal(parameter('sheetName').value, 'Videos');
        if (parameter('operation') === 'read') {
          const lookup = parameter('filtersUI').values[0].lookupValue;
          const value = sheet.get(lookup);
          return [value ? [asItem(value)] : []];
        }
        const mapped = parameter('columns.value');
        if (parameter('operation') === 'update') {
          assert.ok(sheet.has(mapped.video_id));
          sheet.set(mapped.video_id, { ...sheet.get(mapped.video_id), ...mapped });
        } else {
          assert.equal(sheet.has(mapped.video_id), false);
          sheet.set(mapped.video_id, mapped);
        }
        return [[asItem(mapped)]];
      }
      if (node.type.endsWith('.httpRequest')) {
        const url = parameter('url');
        if (node.name === 'Get Video Agent Session') {
          assert.equal(url, 'https://api.heygen.com/v3/video-agents/session_test');
          return [[asItem({ data: { video_id: videoId } })]];
        }
        if (node.name === 'Get HeyGen Video') {
          assert.equal(url, 'https://api.heygen.com/v3/videos/' + videoId);
          return [[asItem({ data: { id: videoId, status: 'completed', video_url: mediaUrl } })]];
        }
        if (node.name === 'Download Video File') {
          assert.equal(upload, true);
          assert.equal(url, mediaUrl);
          const mp4Header = Buffer.from('00000018667479706d70343200000000', 'hex');
          return [[{ json: {}, binary: { data: { data: mp4Header.toString('base64'), mimeType: 'application/octet-stream' } } }]];
        }
        throw new Error('The test must never reach a Claude request');
      }
      if (node.type.endsWith('.youTube')) {
        assert.equal(upload, true);
        assert.equal(parameter('options.privacyStatus'), 'private');
        assert.equal(item.binary.data.mimeType, 'video/mp4');
        return [[asItem({ uploadId: 'a0B1c2D3eF4' })]];
      }
      const localTypes = ['n8n-nodes-base.if', 'n8n-nodes-base.set', 'n8n-nodes-base.crypto', 'n8n-nodes-base.respondToWebhook'];
      assert.ok(localTypes.includes(node.type), 'Test lacks a fake handler for ' + node.type);
      return undefined;
    },
  };

  const execution = new WorkflowExecute(extra, 'manual');
  const result = await execution.run({ workflow, startNode: start, pinData: { [start.name]: [input] } });
  if (result.status !== 'success') {
    console.log('N8N_EXECUTION_FAILURE', JSON.stringify(result.data.resultData.error, null, 2));
    throw new Error('Status ' + result.status + ' in flow ' + number);
  }
  return log;
}

const render = (body, verified = true) => ({
  body, headers: { signature: verified ? createHmac('sha256', 'native-fixture').update(JSON.stringify(body)).digest('hex') : '0'.repeat(64) },
});

(async () => {
  await Container.get(LoadNodesAndCredentials).init();
  await Expression.initExpressionEngine({ engine: 'quickjs', poolSize: 1, maxCodeCacheSize: 32, bridgeTimeout: 500, bridgeMemoryLimit: 64, idleTimeout: 1000 });
  Expression.setExpressionEngine('quickjs');
  const chat = text => ({ message: { chat: { id: Number(allowedChat), type: 'private' }, from: { id: Number(allowedChat) }, text } });
  assert.equal((await run(1, chat('topic'))).messages.length, 1);
  assert.match((await run(1, chat('Tema [angle: ejemplo]'))).messages[0].text, /Modo de prueba/);
  console.log('01 Telegram: native graph and simulation route passed.');

  const metadata = { title: 'Prueba', description: 'Datos sintéticos', video_id: videoId };
  const review = { body: { ...metadata, script: 'Una línea.\nÚltima línea', revision: 0 } };
  for (const form of [{ Decision: 'Approve' }, { Decision: 'Request changes', Feedback: 'Cambio' }, { Decision: 'Abort' }]) {
    const log = await run(2, review, { form });
    assert.equal(log.responses[0].statusCode, 200);
    assert.match(log.messages[0].text, /form-waiting/);
    assert.equal(log.messages.length, 2);
  }
  console.log('02 Review: native graph, form parameters and three decisions passed.');

  assert.equal((await run(3, { body: metadata })).responses[0].statusCode, 201);
  assert.equal((await run(3, { body: metadata })).responses[0].statusCode, 200);
  assert.equal(sheet.get(videoId).status, 'generating');
  console.log('03 Sheets: native graph, write confirmation and re-delivery passed.');

  const sessionEvent = { event_type: 'video_agent.success', event_data: { session_id: 'session_test' } };
  assert.equal((await run(4, render(sessionEvent, false))).responses[0].statusCode, 401);
  assert.equal((await run(4, render(sessionEvent))).responses[0].statusCode, 200);
  assert.equal(sheet.get(videoId).status, 'ready');
  const uploaded = await run(4, render(sessionEvent), { upload: true });
  assert.equal(uploaded.responses[0].statusCode, 200);
  assert.equal(sheet.get(videoId).status, 'uploaded');
  assert.equal(sheet.get(videoId).youtube_url, 'https://youtu.be/a0B1c2D3eF4');
  assert.ok(!(await run(4, render(sessionEvent), { upload: true })).calls.includes('Upload Privately To YouTube'));
  console.log('04 HeyGen/YouTube: native graph, signature, session lookup, private upload simulation and re-delivery passed.');
})().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
