// 읽기 전용 소스 추출·합성 진단. Firebase/AI SDK 및 운영 데이터에 접속하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require(path.join(process.env.HARU_AUDIT_DEPS || '/Users/heogyeongdae/Developer/HARU2026/functions/node_modules', 'typescript'));
const root = path.resolve(__dirname, '../../..');
const files = {};
function source(rel) {
  if (!files[rel]) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    files[rel] = { text, ast: ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS) };
  }
  return files[rel];
}
const index = 'functions/src/index.ts';
function find(rel, predicate) {
  let found;
  function walk(node) { if (!found && predicate(node)) found = node; if (!found) ts.forEachChild(node, walk); }
  walk(source(rel).ast);
  assert.ok(found, `AST node missing: ${rel}`);
  return found;
}
function func(rel, name) { return find(rel, n => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(source(rel).ast).replace(/^export /, ''); }
function variable(rel, name) { return find(rel, n => ts.isVariableDeclaration(n) && n.name.getText() === name).initializer; }
function init(rel, name) { return variable(rel, name).getText(source(rel).ast); }
function handler(name) { const expr = variable(index, name); assert.equal(expr.expression.getText(), 'onCall'); return expr.arguments.at(-1).getText(source(index).ast); }
function evaluate(code, context) {
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return vm.runInNewContext(js, context, { timeout: 5000 });
}
const json = value => JSON.parse(JSON.stringify(value));
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const loggerRel = 'functions/src/aiUsageLogger.ts';
const shared = 'functions/src/sharedHelpers.ts';
const rate = 'functions/src/utils/rateLimit.ts';
const serverCode = [
  func(loggerRel, 'resolveActualPlan'), func(loggerRel, 'logAiUsage'), func(shared, 'getAiUsageErrorCode'), func(rate, 'enforceRateLimit'),
  `const STATS_PROMPTS = ${init(index, 'STATS_PROMPTS')};`, func(index, 'analyzeStats'), func(index, 'buildAiCommentPrompt'), func(index, 'isValidTitle'),
  `({ polish: ${handler('polishContent')}, title: ${handler('extractTitle')}, backfill: ${handler('generateTitlesForAll')} })`,
].join('\n');
function environment(options = {}) {
  const state = { models: [], logs: [], subscriptionReads: 0, logWriteAttempts: 0, quotaReservations: 0, rollbacks: 0, consoleKinds: [], rateState: undefined };
  const firestore = () => ({
    doc: target => ({
      get: async () => { assert.ok(target.endsWith('/subscription/info')); state.subscriptionReads++; return { data: () => ({ plan: 'premium', status: 'active' }) }; },
    }),
    collection: name => {
      assert.equal(name, 'aiUsageLogs');
      return { add: async entry => { state.logWriteAttempts++; if (options.logFailure) throw new Error('synthetic-write-failure'); state.logs.push(json(entry)); } };
    },
    runTransaction: async callback => callback({
      get: async () => ({ data: () => state.rateState }),
      set: (_ref, value) => { state.rateState = value; },
    }),
  });
  firestore.FieldValue = { serverTimestamp: () => 'synthetic-time' };
  const mockConsole = Object.fromEntries(['log', 'warn', 'error'].map(kind => [kind, () => state.consoleKinds.push(kind)]));
  const context = {
    admin: { firestore }, HttpsError, console: mockConsole, logger: mockConsole, AI_USAGE_PLAN: 'beta',
    DEVELOPER_UIDS: new Set(options.dev ? ['synthetic-user'] : []),
    isInternalDeveloperUid: () => true,
    formatPrefixesOf: names => names.map(name => ({ '일기': 'diary', '에세이': 'essay', '여행기록': 'travel', '텃밭일지': 'garden', '애완동물관찰일지': 'pet', '육아일기': 'child', '선교보고': 'mission', '일반보고': 'report', '업무일지': 'work', '메모': 'memo' })[name]),
    buildFormatPrefixMap: () => ({ '메모': 'memo' }),
    getAiRoute: () => ({ model: 'gemini-3.1-flash-lite' }),
    reserveMonthlyAiQuota: async () => { if (options.quotaDenied) throw new HttpsError('resource-exhausted', 'synthetic-quota'); state.quotaReservations++; return { plan: 'premium' }; },
    rollbackMonthlyAiQuotaReservation: async reservation => { if (reservation) state.rollbacks++; },
    logPaidServiceUsage: async () => {},
    callAi: async request => {
      state.models.push({ purpose: request.purpose, maxOutputTokens: request.generationConfig?.maxOutputTokens ?? null });
      if (options.providerFailure === request.purpose) throw new Error('synthetic-provider-failure');
      const text = request.purpose === 'recordStats'
        ? options.statsText ?? '{"content_richness":4}'
        : request.purpose === 'sayuPolishComment' ? '모의 한마디'.repeat(options.long ? 50 : 1)
        : request.purpose === 'sayuPolish' ? '모의 본문'
        : '모의 제목'.repeat(options.long ? 50 : 1);
      return { inputTokens: 11, outputTokens: options.long ? 900 : 7, text: () => { if (options.textFailure === request.purpose) throw new Error('synthetic-text-failure'); return text; } };
    },
  };
  const handlers = evaluate(serverCode, context);
  return { state, handlers, context };
}
const request = data => ({ auth: { uid: 'synthetic-user' }, data });
function compact(state) {
  return { modelCalls: state.models.length, purposes: state.models.map(m => m.purpose), logRows: state.logs.length, successes: state.logs.filter(l => l.success).length, failures: state.logs.filter(l => !l.success).length, logOnlySubscriptionReads: state.subscriptionReads, quotaReservations: state.quotaReservations, rollbacks: state.rollbacks, logWriteAttempts: state.logWriteAttempts, allRequestIdsNull: state.logs.every(l => l.requestId === null), explicitMaxOutputTokens: state.models.map(m => m.maxOutputTokens) };
}
const scenarios = [];
async function polishCase(name, options, data, expected) {
  const { state, handlers } = environment(options);
  let response; let error;
  try { response = await handlers.polish(request(data ?? { text: '합성 기록', format: 'diary' })); } catch (e) { error = e.code; }
  const result = { name, ...compact(state), error: error ?? null, hasStats: response?.stats != null, commentLength: response?.aiComment.length ?? null };
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(result[key], value, `${name}.${key}`);
  assert.ok(state.logs.every(l => !('stage' in l) && !('purpose' in l) && !('latencyMs' in l)));
  scenarios.push(result);
}
async function main() {
  await polishCase('normal-supported', {}, undefined, { modelCalls: 3, logRows: 3, successes: 3, logOnlySubscriptionReads: 3, quotaReservations: 1, allRequestIdsNull: true });
  await polishCase('normal-reading', {}, { text: '합성 기록', format: 'reading' }, { modelCalls: 2, logRows: 2, logOnlySubscriptionReads: 2, hasStats: false });
  await polishCase('developer', { dev: true }, undefined, { modelCalls: 3, logRows: 3, logOnlySubscriptionReads: 0 });
  await polishCase('body-provider-failure', { providerFailure: 'sayuPolish' }, undefined, { modelCalls: 1, logRows: 1, successes: 0, failures: 1, rollbacks: 1, error: 'internal' });
  await polishCase('body-text-failure', { textFailure: 'sayuPolish' }, undefined, { modelCalls: 1, logRows: 2, successes: 1, failures: 1, rollbacks: 1 });
  await polishCase('stats-provider-failure', { providerFailure: 'recordStats' }, undefined, { modelCalls: 3, logRows: 3, successes: 2, failures: 1, hasStats: false, rollbacks: 0 });
  await polishCase('stats-invalid-json', { statsText: '{broken JSON}' }, undefined, { modelCalls: 3, logRows: 4, successes: 3, failures: 1, hasStats: false });
  await polishCase('stats-no-json', { statsText: '합성 응답 JSON 없음' }, undefined, { modelCalls: 3, logRows: 3, successes: 3, failures: 0, hasStats: false });
  await polishCase('stats-text-failure', { textFailure: 'recordStats' }, undefined, { modelCalls: 3, logRows: 4, successes: 3, failures: 1 });
  await polishCase('comment-provider-failure', { providerFailure: 'sayuPolishComment' }, undefined, { modelCalls: 3, logRows: 2, successes: 2, failures: 0, commentLength: 0, rollbacks: 0 });
  await polishCase('comment-text-failure', { textFailure: 'sayuPolishComment' }, undefined, { modelCalls: 3, logRows: 3, successes: 3, failures: 0, commentLength: 0 });
  await polishCase('invalid-empty-input', {}, { text: '', format: 'diary' }, { modelCalls: 0, logRows: 1, failures: 1, quotaReservations: 0, error: 'invalid-argument' });
  await polishCase('quota-denied', { quotaDenied: true }, undefined, { modelCalls: 0, logRows: 1, failures: 1, quotaReservations: 0, error: 'resource-exhausted' });
  await polishCase('logging-write-failure', { logFailure: true }, undefined, { modelCalls: 3, logRows: 0, logWriteAttempts: 3, error: null, hasStats: true });
  await polishCase('post-generation-slice', { long: true }, undefined, { modelCalls: 3, commentLength: 50, explicitMaxOutputTokens: [null, null, null] });
  {
    const { state, handlers } = environment();
    await Promise.all([handlers.polish(request({ text: '동일 합성 기록', format: 'diary' })), handlers.polish(request({ text: '동일 합성 기록', format: 'diary' }))]);
    assert.equal(state.models.length, 6); assert.equal(state.quotaReservations, 2);
    scenarios.push({ name: 'identical-concurrent-polish', ...compact(state), note: '두 논리 요청 모두 처리됨. 실제 사용자 중복 비율을 뜻하지 않음' });
  }
  {
    const { state, context } = environment();
    const enforce = evaluate(`${func(rate, 'enforceRateLimit')}\nenforceRateLimit`, context);
    for (let i = 0; i < 10; i++) await enforce('synthetic-user', 'polishContent', 10, 60);
    await assert.rejects(enforce('synthetic-user', 'polishContent', 10, 60), e => e.code === 'resource-exhausted');
    assert.equal(state.rateState.minuteCount, 10);
    scenarios.push({ name: 'actual-rate-limit', accepted: 10, denied: 1, note: '빈도 제한이며 동일 본문 중복 제거가 아님' });
  }
  for (const data of [{ text: '합성 기록', format: 'memo' }, { text: '합성 기록'.repeat(400), format: 'memo' }]) {
    const { state, handlers } = environment({ long: true }); const response = await handlers.title(request(data));
    assert.equal(response.title.length, 20); assert.equal(state.models.length, 1); assert.equal(state.logs.length, 0);
    scenarios.push({ name: data.text.length < 100 ? 'extract-title-short' : 'extract-title-long', ...compact(state), returnedTitleLength: response.title.length });
  }
  {
    const { state, handlers, context } = environment();
    const writes = [];
    context.db = { collection: () => ({ doc: () => ({ collection: () => ({ limit: () => ({ get: async () => ({ docs: [{ data: () => ({ formats: ['메모'], memo_simple: '합성 기록' }), ref: { update: async v => writes.push(v) } }] }) }) }) }) }) };
    const result = await handlers.backfill(request({}));
    assert.equal(result.count, 1); assert.equal(writes.length, 1); assert.equal(state.models.length, 1); assert.equal(state.logs.length, 0);
    scenarios.push({ name: 'backfill-logging-only-check', ...compact(state), count: result.count, writes: writes.length, note: '기존 완료 건의 동작 변경 없이 로그 부재만 확인' });
  }
  const gateway = 'functions/src/ai/aiGateway.ts';
  const usage = evaluate(`const finiteOrNull = ${init(gateway, 'finiteOrNull')};\n${func(gateway, 'getGeminiUsage')}\ngetGeminiUsage`, {});
  const usageCases = [
    [{}, { inputTokens: null, outputTokens: null }],
    [{ response: { usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 } } }, { inputTokens: 0, outputTokens: 0 }],
    [{ response: { usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7 } } }, { inputTokens: 11, outputTokens: 7 }],
    [{ response: { usageMetadata: { promptTokenCount: null, candidatesTokenCount: '' } } }, { inputTokens: 0, outputTokens: 0 }],
    [{ response: { usageMetadata: { promptTokenCount: 'invalid', candidatesTokenCount: undefined } } }, { inputTokens: null, outputTokens: null }],
  ].map(([input, expected]) => { const actual = json(usage(input)); assert.deepEqual(actual, expected); return { input, actual }; });
  const quotaRel = 'functions/src/utils/monthlyAiQuota.ts';
  const quotaPlan = evaluate(`${func(quotaRel, 'normalizeMonthlyAiPlan')}\n${func(quotaRel, 'resolveMonthlyAiPlanFromSubscriptionData')}\nresolveMonthlyAiPlanFromSubscriptionData`, { resolveInternalPlan: () => null });
  const { context: planContext } = environment();
  const logPlan = evaluate(`${func(loggerRel, 'resolveActualPlan')}\nresolveActualPlan`, {
    ...planContext,
    admin: { firestore: () => ({ doc: () => ({ get: async () => ({ data: () => ({ plan: 'premium', status: 'inactive' }) }) }) }) },
  });
  const loggedPlan = await logPlan({ uid: 'synthetic-user', plan: 'beta', isDev: false });
  const quotaResolvedPlan = quotaPlan('synthetic-user', { plan: 'premium', status: 'inactive' }, Date.now());
  assert.equal(loggedPlan, 'premium'); assert.equal(quotaResolvedPlan, 'free');
  const planSemanticCheck = { syntheticSubscription: { plan: 'premium', status: 'inactive' }, loggedPlan, quotaResolvedPlan, note: '중복 조회 개선 시 quota.plan을 그대로 재사용하면 현재 로그 의미가 바뀔 수 있음' };
  const calls = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText() === 'callAi') {
      const requestNode = node.arguments[0];
      const purpose = requestNode.properties?.find(p => p.name?.getText() === 'purpose')?.initializer?.text;
      if (['sayuPolish', 'sayuPolishComment', 'recordStats', 'recordTitle', 'recordTitleBackfill'].includes(purpose)) {
        assert.equal(requestNode.properties.some(p => p.name?.getText() === 'generationConfig'), false);
        calls.push({ purpose, line: source(index).ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, explicitGenerationConfig: false });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source(index).ast); assert.equal(calls.length, 5);
  const guardedFunctions = [];
  for (const [rel, name, guard] of [
    ['frontend/src/app/components/FormatModal.tsx', 'handlePolishWithMode', 'isPolishing'],
    ['frontend/src/app/components/SayuModal.tsx', 'handleRepolish', 'isRefining'],
    ['frontend/src/app/pages/SettingsPage.tsx', 'handleGenerateTitles', 'isGeneratingTitles'],
  ]) {
    const body = init(rel, name);
    const hasExplicitBusyGuard = new RegExp(`if\\s*\\(\\s*${guard}\\s*\\)`).test(body);
    assert.equal(hasExplicitBusyGuard, name === 'handlePolishWithMode');
    guardedFunctions.push({ rel, name, hasExplicitBusyGuard, note: 'JSX disabled 상태는 별도 존재하며 실제 UI 경쟁 조건을 재현한 시험은 아님' });
  }
  const out = { sourceCommit: '8a2bbfd8cb24fd9d381ed75d9e3e5ce31d68fce9', method: 'AST source extraction with fake AI and in-memory Firestore; no application SDK imports or network', sources: Object.fromEntries(Object.entries(files).map(([rel, { text }]) => [rel, crypto.createHash('sha256').update(text).digest('hex')])), scenarios, usageCases, planSemanticCheck, targetCalls: calls, guardedFunctions };
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ passed: true, serverScenarios: scenarios.length, usageCases: usageCases.length, planSemanticCheck, targetCallAssertions: calls.length, clientGuardChecks: guardedFunctions.length, scenarios: scenarios.map(({name, modelCalls, logRows, failures, logOnlySubscriptionReads}) => ({name, modelCalls, logRows, failures, logOnlySubscriptionReads})) }, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
