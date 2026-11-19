const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const directory = join(__dirname, '..', 'workflows');
const workflows = readdirSync(directory)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')));

const getNode = (number, name) => {
  const found = workflows[number - 1].nodes.find((node) => node.name === name);
  assert.ok(found, 'Missing workflow node: ' + name);
  return found;
};

const asItem = (json) => ({ json });
const plain = (value) => JSON.parse(JSON.stringify(value));

async function runCode(number, name, input, { state = {}, previous = {}, helpers } = {}) {
  const items = Array.isArray(input) ? input.map(asItem) : [asItem(input)];
  const context = {
    Buffer,
    helpers,
    $input: { first: () => items[0], all: () => items },
    $getWorkflowStaticData: () => state,
    $: (nodeName) => ({
      first: () => {
        assert.ok(nodeName in previous, 'Missing previous node: ' + nodeName);
        return asItem(previous[nodeName]);
      },
    }),
  };
  const code = getNode(number, name).parameters.jsCode;
  const result = await vm.runInNewContext('(async function () {\n' + code + '\n}).call(this)', context);
  return plain(result).map((item) => item.json);
}

const executeCode = async (...args) => (await runCode(...args))[0];
const allowedChat = '100012345';
const configuredSheet = 'synthetic_spreadsheet_id_0001';
const syntheticRoutine = 'https://api.anthropic.com/v1/claude_code/routines/trig_synthetic/fire';
const videoId = 'v_factory_test';
const mediaUrl = 'https://files.heygen.ai/video/test.mp4?test=1';
const draft = { video_id: videoId, title: 'Título de prueba', description: 'Descripción de prueba' };
const telegram = (text, updateId, config = {}) => ({
  message: { text, chat: { id: Number(allowedChat), type: 'private' }, from: { id: Number(allowedChat) } },
  update_id: updateId,
  telegramChatId: allowedChat,
  claudeRoutineUrl: syntheticRoutine,
  allowClaude: false,
  ...config,
});

test('all four downloads import as drafts with a connected graph and no foreign credentials', () => {
  assert.equal(workflows.length, 4);
  for (const workflow of workflows) {
    assert.equal(workflow.active, false);
    assert.equal(workflow.settings.availableInMCP, false);
    assert.equal(workflow.settings.timezone, 'America/Lima');
    assert.deepEqual(workflow.pinData, {});
    assert.equal(workflow.id, undefined);
    assert.equal(workflow.staticData, undefined);
    const nodesByName = new Map(workflow.nodes.map((node) => [node.name, node]));
    assert.equal(nodesByName.size, workflow.nodes.length);
    assert.equal(new Set(workflow.nodes.map((node) => node.id)).size, workflow.nodes.length);
    for (const node of workflow.nodes) {
      assert.equal(node.credentials, undefined);
      if (node.type.endsWith('.code')) {
        assert.doesNotThrow(() => new vm.Script('(async function () {\n' + node.parameters.jsCode + '\n})'));
      }
    }
    const visited = new Set();
    function visit(name) {
      if (visited.has(name)) return;
      assert.ok(nodesByName.has(name), 'Missing graph node: ' + name);
      visited.add(name);
      for (const link of (workflow.connections[name]?.main ?? []).flat()) visit(link.node);
    }
    visit(workflow.nodes[0].name);
    assert.equal(visited.size, workflow.nodes.length);
  }
});

test('setup defaults block Claude and YouTube, and webhook authentication is explicit', () => {
  for (const [number, flag] of [[1, 'allowClaude'], [2, 'allowClaude'], [4, 'allowYoutubeUpload']]) {
    const setting = getNode(number, 'Factory Settings').parameters.assignments.assignments.find((entry) => entry.name === flag);
    assert.equal(setting.value, false);
    assert.equal(setting.type, 'boolean');
  }
  for (const [number, name] of [[2, 'Script Webhook'], [3, 'Log Row Webhook']]) {
    assert.equal(getNode(number, name).parameters.authentication, 'headerAuth');
  }
  assert.equal(getNode(2, 'Wait For My Decision').parameters.incomingAuthentication, 'basicAuth');
  assert.equal(getNode(4, 'HeyGen Webhook').parameters.options.rawBody, true);
  assert.equal(getNode(4, 'Calculate HeyGen Signature').parameters.action, 'hmac');
  const youtube = getNode(4, 'Upload Privately To YouTube').parameters;
  assert.equal(youtube.options.privacyStatus, 'private');
  assert.equal(youtube.options.notifySubscribers, false);
});

test('Telegram accepts the configured private chat and sender alone', () => {
  const expression = getNode(1, 'Is It Me?').parameters.conditions.conditions[0].leftValue.slice(4, -3);
  const accepts = (item) => vm.runInNewContext(expression, { $json: item });
  const msg = telegram('topic', 1);
  assert.equal(accepts(msg), true);
  assert.equal(accepts(telegram('topic', 1, { telegramChatId: '__YOUR_TELEGRAM_CHAT_ID__' })), false);
  assert.equal(accepts({ ...msg, message: { ...msg.message, from: { id: 123 } } }), false);
  assert.equal(accepts({ ...msg, message: { ...msg.message, chat: { ...msg.message.chat, type: 'group' } } }), false);
});

test('Telegram preserves the idea, angle and CTA and skips paid research by default', async () => {
  const state = {};
  const first = await executeCode(1, 'Conversation Router', telegram('topic', 1), { state });
  assert.equal(first.callClaude, false);
  const sent = await executeCode(1, 'Conversation Router', telegram('Tema [angle: Ángulo] [cta: CTA]', 2), { state });
  assert.deepEqual(sent.payload, { mode: 'topic', topic: 'Tema', angle: 'Ángulo', cta: 'CTA', vidiq: 'skip' });
  assert.equal(sent.callClaude, false);
  assert.equal(state.pending, null);
  assert.deepEqual(await runCode(1, 'Conversation Router', telegram('Tema', 2), { state }), []);
});

test('Telegram respects explicit vidIQ flags, direct scripts, and cancellation', async () => {
  const state = { pending: 'topic' };
  const flags = await executeCode(1, 'Conversation Router', telegram('Tema (use vidiq)', 1, { allowClaude: true }), { state });
  assert.equal(flags.payload.vidiq, 'use');
  assert.equal(flags.callClaude, true);
  await executeCode(1, 'Conversation Router', telegram('script', 2), { state });
  const pasted = await executeCode(1, 'Conversation Router', telegram('Guion exacto.\nSegunda línea.', 3), { state });
  assert.deepEqual(pasted.payload, { mode: 'script', script: 'Guion exacto.\nSegunda línea.' });
  await executeCode(1, 'Conversation Router', telegram('topic', 4), { state });
  await executeCode(1, 'Conversation Router', telegram('cancelar', 5), { state });
  assert.equal(state.pending, null);
  const unsolicited = await executeCode(1, 'Conversation Router', telegram('Texto sin solicitud', 6), { state });
  assert.equal(unsolicited.payload, undefined);
});

test('review keeps the complete script in the form and escapes its markup', async () => {
  const script = 'Una línea de guion.\n'.repeat(260) + '<ejemplo> & última línea';
  const review = await executeCode(2, 'Prepare Review', {
    telegramChatId: allowedChat,
    body: { ...draft, script, revision: 1, topic: 'Tema' },
  });
  assert.equal(review.httpStatus, 200);
  assert.equal(review.job.script, script);
  assert.ok(review.formHtml.includes('&lt;ejemplo&gt; &amp; última línea'));
  assert.ok(review.formHtml.length > 4096);
  assert.doesNotMatch(getNode(2, 'Telegram Notify').parameters.text, /job\.script/);
  const form = getNode(2, 'Wait For My Decision').parameters;
  assert.equal(form.resumeAmount, 24);
  assert.match(form.formDescription, /formHtml/);
});

test('review blocks invalid metadata and byte limits before notification', async () => {
  const invalid = await executeCode(2, 'Prepare Review', {
    telegramChatId: allowedChat,
    body: { ...draft, script: 'Texto', description: '🌿'.repeat(1251) },
  });
  assert.equal(invalid.httpStatus, 400);
  const missingConfig = await executeCode(2, 'Prepare Review', { body: { ...draft, script: 'Texto' } });
  assert.equal(missingConfig.httpStatus, 503);
});

test('approve and revise use distinct payloads and preserve the unmodified script', async () => {
  const job = { ...draft, script: 'Línea uno.\nLínea dos.', revision: 1, topic: 'Idea' };
  const previous = {
    'Prepare Review': { job, chatId: allowedChat },
    'Factory Settings': { allowClaude: false, claudeRoutineUrl: syntheticRoutine },
  };
  const approved = await executeCode(2, 'Prepare Decision', { Decision: 'Approve' }, { previous });
  assert.equal(approved.callClaude, false);
  assert.equal(approved.payload.mode, 'approved');
  assert.equal(approved.payload.script, job.script);

  const revised = await executeCode(2, 'Prepare Decision', { Decision: 'Request changes', Feedback: ' Ajusta la entrada. ' }, { previous });
  assert.equal(revised.payload.mode, 'revise');
  assert.equal(revised.payload.revision, 2);
  assert.equal(revised.payload.notes, 'Ajusta la entrada.');
  assert.equal(revised.payload.topic, job.topic);

  const cancelled = await executeCode(2, 'Prepare Decision', { Decision: 'Abort' }, { previous });
  const empty = await executeCode(2, 'Prepare Decision', { Decision: 'Request changes' }, { previous });
  const expired = await executeCode(2, 'Prepare Decision', {}, { previous });
  for (const result of [cancelled, empty, expired]) {
    assert.equal(result.callClaude, false);
    assert.equal(result.payload, undefined);
  }
});

test('registration validates required metadata and writes raw sheet cells', async () => {
  const valid = await executeCode(3, 'Validate Video Row', {
    body: { ...draft, title: '=Guion literal', status: 'uploaded' },
    spreadsheetId: configuredSheet,
  });
  assert.equal(valid.status, 'generating');
  assert.equal(valid.title, '=Guion literal');
  assert.ok(Number.isFinite(Date.parse(valid.created_at)));
  const invalid = await executeCode(3, 'Validate Video Row', { body: { ...draft, video_id: '' } });
  assert.equal(invalid.httpStatus, 400);
  assert.equal(getNode(3, 'Append Video Row').parameters.options.cellFormat, 'RAW');
});

test('registration retries preserve the existing row and detect ambiguous ids', async () => {
  const previous = { 'Validate Video Row': draft };
  const fresh = await executeCode(3, 'Check Existing Row', [{}], { previous });
  const existing = await executeCode(3, 'Check Existing Row', [{ ...draft, status: 'uploaded' }], { previous });
  const duplicates = await executeCode(3, 'Check Existing Row', [draft, draft], { previous });
  assert.equal(fresh.shouldAppend, true);
  assert.equal(existing.shouldAppend, undefined);
  assert.equal(existing.receipt, 'already_registered');
  assert.equal(duplicates.httpStatus, 409);
  assert.equal((await executeCode(3, 'Confirm Stored Row', draft, { previous })).httpStatus, 201);
  assert.equal((await executeCode(3, 'Confirm Stored Row', {}, { previous })).httpStatus, 503);
});

const successEvent = { event_type: 'video_agent.success', event_data: { video_id: videoId, video_url: mediaUrl } };
function signedEvent(body) {
  const bytes = JSON.stringify(body, null, 2);
  const signature = createHmac('sha256', 'fixture-only-key').update(bytes).digest('hex');
  return { body, headers: { signature }, expectedSignature: signature };
}

test('HeyGen accepts the correct signature and rejects mismatches before accessing services', async () => {
  const event = signedEvent(successEvent);
  const accepted = await executeCode(4, 'Parse Signed Callback', event);
  assert.equal(accepted.video_id, videoId);
  assert.equal(accepted.video_url, mediaUrl);
  const rejected = await executeCode(4, 'Parse Signed Callback', { ...event, headers: {} });
  assert.equal(rejected.httpStatus, 401);
  const wrongKey = await executeCode(4, 'Parse Signed Callback', { ...event, expectedSignature: '0'.repeat(64) });
  assert.equal(wrongKey.httpStatus, 401);
  const ignored = await executeCode(4, 'Parse Signed Callback', signedEvent({ event_type: 'batch.finished' }));
  assert.equal(ignored.receipt, 'event_ignored');
});

test('HeyGen supports the legacy URL field and the Video Agent session response', async () => {
  const legacy = signedEvent({ ...successEvent, event_data: { video_id: videoId, url: mediaUrl } });
  assert.equal((await executeCode(4, 'Parse Signed Callback', legacy)).video_url, mediaUrl);
  const bySession = signedEvent({ ...successEvent, event_data: { session_id: 'test_session' } });
  const unresolved = await executeCode(4, 'Parse Signed Callback', bySession);
  assert.equal(unresolved.sessionId, 'test_session');
  const resolved = await executeCode(4, 'Read Session Video ID', { data: { video_id: videoId } }, {
    previous: { 'Factory Settings': unresolved },
  });
  assert.equal(resolved.video_id, videoId);
  const fetched = await executeCode(4, 'Read Render URL', { data: { id: videoId, status: 'completed', video_url: mediaUrl } }, {
    previous: { 'Resolve Render URL?': resolved },
  });
  assert.equal(fetched.video_url, mediaUrl);
});

test('download is restricted to the configured HeyGen media hosts, with redirects disabled', async () => {
  const event = { event: 'video_agent.success', video_id: videoId, spreadsheetId: configuredSheet };
  const verified = await executeCode(4, 'Validate Render', { ...event, video_url: mediaUrl });
  assert.equal(verified.video_url, mediaUrl);
  const invalid = await executeCode(4, 'Validate Render', { ...event, video_url: 'https://example.invalid/test.mp4' });
  assert.equal(invalid.httpStatus, 422);
  assert.equal(getNode(4, 'Download Video File').parameters.options.redirect.redirect.followRedirects, false);
});

const transition = (items, options = {}) => executeCode(4, 'Choose Video Transition', items, {
  previous: { 'Validate Render': { event: 'video_agent.success', video_id: videoId, video_url: mediaUrl, ...options } },
});

test('callback before registration can be retried, duplicated rows are blocked', async () => {
  assert.equal((await transition([{}])).httpStatus, 503);
  assert.equal((await transition([draft, draft])).httpStatus, 409);
});

test('default callback records ready and provider failure, then ignores repeated deliveries', async () => {
  const generating = { ...draft, status: 'generating' };
  const ready = await transition([generating]);
  assert.equal(ready.status, 'ready');
  assert.equal((await transition([ready])).receipt, 'already_handled');
  const failed = await transition([generating], { event: 'video_agent.fail' });
  assert.equal(failed.status, 'failed');
  assert.equal((await transition([failed])).receipt, 'already_handled');
});

test('private upload requires an explicit gate and a stored reservation', async () => {
  const ready = { ...draft, status: 'ready' };
  const claimed = await transition([ready], { allowYoutubeUpload: true });
  assert.equal(claimed.status, 'uploading');
  assert.equal((await transition([claimed], { allowYoutubeUpload: true })).receipt, 'already_handled');
  assert.equal((await transition([{ ...ready, title: '' }], { allowYoutubeUpload: true })).httpStatus, 422);
  const context = { previous: { 'Choose Video Transition': claimed } };
  assert.equal((await executeCode(4, 'Confirm Video Status', ready, context)).httpStatus, 503);
  assert.equal((await executeCode(4, 'Confirm Video Status', claimed, context)).httpStatus, 200);
  await assert.rejects(executeCode(4, 'Verify YouTube Receipt', {}, context), /No valid YouTube video ID/);
  const receipt = await executeCode(4, 'Verify YouTube Receipt', { uploadId: 'a0B1c2D3ef4' }, context);
  assert.deepEqual(receipt, { video_id: videoId, status: 'uploaded', youtube_url: 'https://youtu.be/a0B1c2D3ef4' });
});
