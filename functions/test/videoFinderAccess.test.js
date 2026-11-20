// '내 영상 찾기' 동의·프리미엄 AI 질문 시험. 실제 코드(src/videoFinderCore.ts)를 메모리 저장소·가짜 YouTube·가짜 모델로 실행한다.
// 실행: npm run test:video-finder (네트워크·Firebase·키·유료 모델 호출 없음)
const assert = require('node:assert/strict');
const test = require('node:test');
const core = require('../src/videoFinderCore.ts');

const {
  createVideoFinderAccessService, evaluateQuestionEntitlement, createGeminiVideoClient, createStandaloneGateway,
  hashSessionToken, sanitizeModelAnswer, parseIsoDurationSeconds, mapAnalysisInfo, toEpochMs, policyRequiredFor,
  QUESTION_DAILY_LIMIT, ANALYSIS_MONTHLY_SECONDS, QUESTION_LEASE_MS, RECAP_TTL_MS, VIDEO_FINDER_GEMINI_MODEL,
  VIDEO_FINDER_STANDALONE_ORIGINS, MAX_ANALYSIS_VIDEO_SECONDS, VideoFinderError,
} = core;

const NOW = Date.UTC(2026, 10, 20, 3, 0, 0); // 2026-11-20 12:00 KST
const END = Date.parse('2026-12-05T00:00:00.000Z');
const ACTIVE = { consents: { terms: true } };
const PREMIUM = { plan: 'premium', status: 'active', startDate: '2026-11-05T00:00:00.000Z', endDate: '2026-12-05T00:00:00.000Z' };
const VIDEO = 'abcdefghijk';
const VIDEO2 = 'bcdefghijkl';
const POLICY = { version: 1, acceptedAt: NOW - 1000 };

const clone = (x) => (x === null || x === undefined ? x : JSON.parse(JSON.stringify(x)));

function accessStore() {
  const users = new Map();
  const u = (uid) => {
    if (!users.has(uid)) users.set(uid, { account: ACTIVE, policy: POLICY, subscription: PREMIUM, usage: null, cache: new Map() });
    return users.get(uid);
  };
  const snapFor = (uid, keys) => {
    const s = u(uid);
    return clone({
      account: s.account,
      policy: s.policy,
      subscription: s.subscription,
      usage: s.usage,
      recap: keys.videoId ? s.cache.get(`recap_${keys.videoId}`) ?? null : null,
      answer: keys.requestId ? s.cache.get(`answer_${keys.requestId}`) ?? null : null,
    });
  };
  const store = {
    users, u, enabled: true, writes: 0,
    async getQuestionsEnabled() { return this.enabled; },
    async read(uid, keys) { return snapFor(uid, keys); },
    // 비동기 경계 뒤 읽기·판단·쓰기를 한 번에(트랜잭션 원자성). fn이 던지면 아무것도 쓰지 않는다.
    async transact(uid, keys, fn) {
      await null;
      const { writes, result } = fn(snapFor(uid, keys));
      const s = u(uid);
      if (writes.policy) { s.policy = clone(writes.policy); store.writes += 1; }
      if (writes.usage) { s.usage = { ...(s.usage || {}), ...clone(writes.usage) }; store.writes += 1; }
      if (writes.recap) { s.cache.set(`recap_${keys.videoId}`, clone(writes.recap)); store.writes += 1; }
      if (writes.answer) { s.cache.set(`answer_${keys.requestId}`, clone(writes.answer)); store.writes += 1; }
      return result;
    },
  };
  return store;
}

function fakeDeps({ info, answer, recapAnswer } = {}) {
  const calls = { youtubeFactory: 0, modelFactory: 0, info: [], analyze: [], recap: [], reserveYouTube: 0 };
  const yt = {
    async analysisInfo(id) {
      calls.info.push(id);
      return info === undefined ? { videoId: id, isPublic: true, durationSeconds: 600 } : (typeof info === 'function' ? info(id) : info);
    },
  };
  const model = {
    gate: null,
    async analyzeVideo(input) {
      calls.analyze.push(input);
      if (model.gate) await model.gate;
      if (typeof answer === 'function') return answer(input);
      return answer || { supported: true, answer: '토마토 지지대는 2분쯤에 설명해요.', timestamps: [120, 130],
        recap: { summary: '토마토 지지대 세우기', segments: [{ t: 0, text: '소개' }, { t: 120, text: '지지대 세우기' }] } };
    },
    async answerFromRecap(input) {
      calls.recap.push(input);
      if (model.gate) await model.gate;
      if (typeof recapAnswer === 'function') return recapAnswer(input);
      return recapAnswer || { supported: true, answer: '노트 기준으로 2분부터예요.', timestamps: [120] };
    },
  };
  return {
    calls, model,
    youtube: () => { calls.youtubeFactory += 1; return yt; },
    modelFactory: () => { calls.modelFactory += 1; return model; },
    reserveYouTube: async () => { calls.reserveYouTube += 1; },
  };
}

function service(store, deps, now = () => NOW) {
  return createVideoFinderAccessService({
    store, now, youtube: deps.youtube, model: deps.modelFactory, reserveYouTube: deps.reserveYouTube,
  });
}

const ask = (svc, uid, extra = {}) => svc.handle(uid, { action: 'ask', requestId: 'req_00000001', videoId: VIDEO, question: '지지대는 언제 세워요?', ...extra });
const code = (c) => (e) => e instanceof VideoFinderError && e.code === c;
const noExternal = (calls) => {
  assert.equal(calls.youtubeFactory, 0);
  assert.equal(calls.modelFactory, 0);
  assert.equal(calls.reserveYouTube, 0);
};

// ───── 구독 판정 ─────

test('프리미엄 판정: 활성·해지 후 만료 전만 통과, 무료·베이직·만료·잘못된 날짜는 거절', () => {
  assert.deepEqual(evaluateQuestionEntitlement(PREMIUM, NOW), { ok: true, monthKey: `p:${END}` });
  assert.equal(evaluateQuestionEntitlement({ ...PREMIUM, status: 'cancelled' }, NOW).ok, true);
  assert.equal(evaluateQuestionEntitlement(null, NOW).ok, false);
  assert.equal(evaluateQuestionEntitlement({ plan: 'free', status: 'active' }, NOW).ok, false);
  assert.equal(evaluateQuestionEntitlement({ ...PREMIUM, plan: 'basic' }, NOW).ok, false);
  assert.equal(evaluateQuestionEntitlement({ ...PREMIUM, plan: 'developer' }, NOW).ok, false);
  assert.equal(evaluateQuestionEntitlement({ ...PREMIUM, status: 'expired' }, NOW).ok, false);
  assert.equal(evaluateQuestionEntitlement({ ...PREMIUM, endDate: '2026-11-20T02:59:59.000Z' }, NOW).ok, false);
  assert.equal(evaluateQuestionEntitlement({ ...PREMIUM, endDate: 'not-a-date' }, NOW).ok, false);
  assert.equal(evaluateQuestionEntitlement({ ...PREMIUM, startDate: 'garbage' }, NOW).ok, false);
  // 해지했는데 만료일이 없으면 기간을 알 수 없어 거절한다.
  assert.equal(evaluateQuestionEntitlement({ plan: 'premium', status: 'cancelled' }, NOW).ok, false);
  // Firestore Timestamp·Date도 같은 기준으로 읽는다.
  assert.deepEqual(evaluateQuestionEntitlement({ plan: 'premium', status: 'active', endDate: { toMillis: () => END } }, NOW), { ok: true, monthKey: `p:${END}` });
  assert.deepEqual(evaluateQuestionEntitlement({ plan: 'premium', status: 'active', endDate: null, expiresAt: new Date(END) }, NOW), { ok: true, monthKey: `p:${END}` });
  assert.equal(evaluateQuestionEntitlement({ plan: 'premium', status: 'active', endDate: { toMillis: () => NaN } }, NOW).ok, false);
  assert.equal(toEpochMs(undefined), undefined);
  assert.equal(toEpochMs('x'), null);
});

test('기간 정보가 없거나 한 달보다 먼 지급은 한국 시간 달력 월로 제한한다', () => {
  assert.deepEqual(evaluateQuestionEntitlement({ plan: 'premium', status: 'active' }, NOW), { ok: true, monthKey: 'm:2026-11' });
  // 2026-11-30 15:30Z = 2026-12-01 00:30 KST
  assert.deepEqual(evaluateQuestionEntitlement({ plan: 'premium', status: 'active' }, Date.UTC(2026, 10, 30, 15, 30)), { ok: true, monthKey: 'm:2026-12' });
  assert.deepEqual(evaluateQuestionEntitlement({ plan: 'premium', status: 'active', endDate: '2027-11-01T00:00:00.000Z' }, NOW), { ok: true, monthKey: 'm:2026-11' });
});

// ───── 상태 조회: 읽기 전용, 외부 호출 없음 ─────

test('상태 조회와 동의는 외부 서비스를 부르지 않고, 상태 조회는 아무것도 쓰지 않는다', async () => {
  const store = accessStore();
  const deps = fakeDeps();
  const svc = service(store, deps);
  store.u('free').subscription = { plan: 'free', status: 'active' };
  store.u('basic').subscription = { ...PREMIUM, plan: 'basic' };
  store.u('expired').subscription = { ...PREMIUM, endDate: '2026-11-01T00:00:00.000Z' };
  store.u('new').policy = null;

  assert.deepEqual(await svc.handle('prem', { action: 'status' }),
    { policyAccepted: true, questionAccess: 'ready', remainingQuestions: 10, remainingAnalysisSeconds: 7200 });
  for (const uid of ['free', 'basic', 'expired']) {
    assert.equal((await svc.handle(uid, { action: 'status' })).questionAccess, 'premium-required');
  }
  assert.equal((await svc.handle('new', { action: 'status' })).policyAccepted, false);
  store.enabled = false;
  assert.deepEqual(await svc.handle('prem', { action: 'status' }),
    { policyAccepted: true, questionAccess: 'disabled', remainingQuestions: 0, remainingAnalysisSeconds: 0 });
  assert.equal(store.writes, 0);

  await assert.rejects(svc.handle('new', { action: 'acceptPolicy', version: 2 }), code('invalid-argument'));
  const accepted = await svc.handle('new', { action: 'acceptPolicy', version: 1 });
  assert.equal(accepted.policyAccepted, true);
  assert.equal(store.u('new').policy.version, 1);
  noExternal(deps.calls);
});

test('탈퇴 신청 계정은 동의를 저장하지 못한다', async () => {
  const store = accessStore();
  store.u('gone').policy = null;
  store.u('gone').account = { consents: { terms: true }, accountStatus: 'pending_deletion' };
  const svc = service(store, fakeDeps());
  await assert.rejects(svc.handle('gone', { action: 'acceptPolicy', version: 1 }), code('failed-precondition'));
  assert.equal(store.u('gone').policy, null);
});

// ───── 질문 권한: 금지된 경우 유료 호출 0회 ─────

test('무료·베이직·만료·스위치 꺼짐·동의 없음이면 YouTube·모델을 한 번도 부르지 않는다', async () => {
  const cases = [
    ['free', (s) => { s.subscription = { plan: 'free', status: 'active' }; }, 'permission-denied'],
    ['basic', (s) => { s.subscription = { ...PREMIUM, plan: 'basic' }; }, 'permission-denied'],
    ['expired', (s) => { s.subscription = { ...PREMIUM, endDate: '2026-11-19T00:00:00.000Z' }; }, 'permission-denied'],
    ['nopolicy', (s) => { s.policy = null; }, 'failed-precondition'],
  ];
  for (const [uid, setup, expected] of cases) {
    const store = accessStore();
    setup(store.u(uid));
    const deps = fakeDeps();
    await assert.rejects(ask(service(store, deps), uid), code(expected), uid);
    noExternal(deps.calls);
    assert.equal(store.writes, 0);
  }
  const store = accessStore();
  store.enabled = false;
  const deps = fakeDeps();
  await assert.rejects(ask(service(store, deps), 'prem'), code('failed-precondition'));
  noExternal(deps.calls);
});

// ───── 정상 흐름·요약 재사용 ─────

test('첫 질문은 영상을 1회 분석해 1회·길이만큼 차감하고, 같은 영상 후속 질문은 요약으로 답해 분석 시간을 쓰지 않는다', async () => {
  const store = accessStore();
  const deps = fakeDeps();
  const svc = service(store, deps);
  const first = await ask(svc, 'prem');
  assert.equal(first.answer, '토마토 지지대는 2분쯤에 설명해요.');
  assert.deepEqual(first.timestamps, [120, 130]);
  assert.deepEqual(first.status, { policyAccepted: true, questionAccess: 'ready', remainingQuestions: 9, remainingAnalysisSeconds: 6600 });
  assert.equal(deps.calls.info.length, 1);
  assert.equal(deps.calls.reserveYouTube, 1);
  assert.equal(deps.calls.analyze.length, 1);
  assert.equal(deps.calls.analyze[0].durationSeconds, 600);
  const recap = store.u('prem').cache.get(`recap_${VIDEO}`);
  assert.equal(recap.durationSeconds, 600);
  assert.equal(recap.expiresAt, NOW + RECAP_TTL_MS);
  assert.ok(RECAP_TTL_MS <= 24 * 60 * 60 * 1000);
  assert.equal(store.u('prem').usage.lease, null);

  const second = await ask(svc, 'prem', { requestId: 'req_00000002', question: '다시 알려줘', previous: [{ question: '지지대는 언제 세워요?', answer: first.answer }] });
  assert.deepEqual(second.timestamps, [120]);
  assert.equal(second.status.remainingQuestions, 8);
  assert.equal(second.status.remainingAnalysisSeconds, 6600);
  assert.equal(deps.calls.info.length, 1, '요약이 있으면 YouTube를 다시 부르지 않는다');
  assert.equal(deps.calls.analyze.length, 1);
  assert.equal(deps.calls.recap.length, 1);
  assert.equal(deps.calls.recap[0].previous.length, 1);

  // 다른 사용자는 이 요약을 쓰지 못한다(사용자별 비공개).
  await ask(svc, 'other', { requestId: 'req_00000003' });
  assert.equal(deps.calls.analyze.length, 2);
});

test('같은 requestId 재요청은 저장된 답을 돌려주고 다시 차감·호출하지 않는다', async () => {
  const store = accessStore();
  const deps = fakeDeps();
  const svc = service(store, deps);
  const a = await ask(svc, 'prem');
  const b = await ask(svc, 'prem');
  assert.equal(b.answer, a.answer);
  assert.deepEqual(b.timestamps, a.timestamps);
  assert.equal(b.status.remainingQuestions, 9);
  assert.equal(deps.calls.analyze.length, 1);
  assert.equal(deps.calls.info.length, 1);
  await assert.rejects(ask(svc, 'prem', { videoId: VIDEO2 }), code('invalid-argument'));
});

test('동시에 두 질문을 보내면 하나만 진행되고 나머지는 차감 없이 거절된다', async () => {
  const store = accessStore();
  const deps = fakeDeps();
  let open;
  deps.model.gate = new Promise((r) => { open = r; });
  const svc = service(store, deps);
  const p1 = ask(svc, 'prem', { requestId: 'req_parallel1' });
  // 첫 요청이 예약을 걸 때까지 기다린다.
  while (!store.u('prem').usage?.lease) await new Promise((r) => setImmediate(r));
  await assert.rejects(ask(svc, 'prem', { requestId: 'req_parallel2', videoId: VIDEO2 }), code('unavailable'));
  await assert.rejects(ask(svc, 'prem', { requestId: 'req_parallel1' }), code('unavailable'));
  const status = await svc.handle('prem', { action: 'status' });
  assert.equal(status.remainingQuestions, 9, '진행 중 예약도 남은 횟수에서 뺀다');
  open();
  const r1 = await p1;
  assert.equal(r1.status.remainingQuestions, 9);
  assert.equal(deps.calls.analyze.length, 1);
});

test('모델 실패·잘못된 응답이면 예약을 풀어 횟수·분석 시간을 차감하지 않고, 자동 재시도도 하지 않는다', async () => {
  for (const failure of [() => { throw new Error('boom'); }, () => ({ supported: true, answer: '' }), () => 'not-json-object']) {
    const store = accessStore();
    const deps = fakeDeps({ answer: failure });
    const svc = service(store, deps);
    await assert.rejects(ask(svc, 'prem'), code('unavailable'));
    assert.equal(deps.calls.analyze.length, 1, '재시도 없음');
    assert.equal(store.u('prem').usage.lease, null);
    const status = await svc.handle('prem', { action: 'status' });
    assert.equal(status.remainingQuestions, 10);
    assert.equal(status.remainingAnalysisSeconds, 7200);
    assert.equal(store.u('prem').cache.size, 0);
  }
});

test('예약 해제에 실패해도 예약 유효시간이 지나면 무효가 되어 다시 질문할 수 있다', async () => {
  const store = accessStore();
  store.u('prem').usage = { day: '2026-11-20', dayCount: 3, month: `p:${END}`, monthSeconds: 0,
    lease: { requestId: 'req_crashed1', videoId: VIDEO, seconds: 600, day: '2026-11-20', month: `p:${END}`, expiresAt: NOW - 1, epoch: 0 } };
  const svc = service(store, fakeDeps());
  const r = await ask(svc, 'prem');
  assert.equal(r.status.remainingQuestions, 6);
  assert.equal(r.status.remainingAnalysisSeconds, 6600);
  assert.ok(QUESTION_LEASE_MS > 120000);
});

test('예약 뒤 프리미엄이 끝나면 차감·저장하지 않고 거절한다', async () => {
  const store = accessStore();
  const deps = fakeDeps();
  let open;
  deps.model.gate = new Promise((r) => { open = r; });
  const svc = service(store, deps);
  const p = ask(svc, 'prem');
  while (!store.u('prem').usage?.lease) await new Promise((r) => setImmediate(r));
  store.u('prem').subscription = { ...PREMIUM, status: 'refunded' };
  open();
  await assert.rejects(p, code('permission-denied'));
  assert.equal(store.u('prem').usage.lease, null);
  assert.equal(store.u('prem').usage.dayCount || 0, 0);
  assert.equal(store.u('prem').cache.size, 0);
});

test('늦게 끝난 요청이 이미 다른 예약으로 바뀌었으면 차감·저장하지 않는다', async () => {
  const store = accessStore();
  const deps = fakeDeps();
  let open;
  deps.model.gate = new Promise((r) => { open = r; });
  const svc = service(store, deps);
  const p = ask(svc, 'prem');
  while (!store.u('prem').usage?.lease) await new Promise((r) => setImmediate(r));
  const other = { ...store.u('prem').usage.lease, requestId: 'req_takeover' };
  store.u('prem').usage.lease = other;
  open();
  await assert.rejects(p, code('unavailable'));
  assert.deepEqual(store.u('prem').usage.lease, other);
  assert.equal(store.u('prem').usage.dayCount || 0, 0);
  assert.equal(store.u('prem').cache.size, 0);
});

test('전체 삭제(dataEpoch 증가) 뒤 끝난 질문은 차감하지만 요약·답변을 다시 저장하지 않는다', async () => {
  const store = accessStore();
  const deps = fakeDeps();
  let open;
  deps.model.gate = new Promise((r) => { open = r; });
  const svc = service(store, deps);
  const p = ask(svc, 'prem');
  while (!store.u('prem').usage?.lease) await new Promise((r) => setImmediate(r));
  store.u('prem').usage.dataEpoch = 1; // Firestore deleteAll이 하는 일
  open();
  const r = await p;
  assert.equal(r.status.remainingQuestions, 9);
  assert.equal(store.u('prem').cache.size, 0);
});

// ───── 하루 10회(한국 시간)·구독 한 달 7,200초 ─────

test('하루 10회를 넘기면 외부 호출 없이 거절하고, 한국 시간 자정에 다시 열린다', async () => {
  const beforeMidnight = Date.UTC(2026, 10, 20, 14, 59, 59); // 2026-11-20 23:59:59 KST
  const afterMidnight = Date.UTC(2026, 10, 20, 15, 0, 0); // 2026-11-21 00:00:00 KST
  const store = accessStore();
  store.u('prem').usage = { day: '2026-11-20', dayCount: QUESTION_DAILY_LIMIT, month: `p:${END}`, monthSeconds: 0, lease: null };
  const deps = fakeDeps();
  await assert.rejects(ask(service(store, deps, () => beforeMidnight), 'prem'), code('resource-exhausted'));
  noExternal(deps.calls);
  assert.equal((await service(store, deps, () => beforeMidnight).handle('prem', { action: 'status' })).remainingQuestions, 0);
  const r = await ask(service(store, deps, () => afterMidnight), 'prem');
  assert.equal(r.status.remainingQuestions, 9);
  assert.equal(store.u('prem').usage.day, '2026-11-21');
});

test('정확히 10번째 질문까지 답하고 11번째는 거절한다', async () => {
  const store = accessStore();
  const deps = fakeDeps({ info: { videoId: VIDEO, isPublic: true, durationSeconds: 60 } });
  const svc = service(store, deps);
  for (let i = 0; i < QUESTION_DAILY_LIMIT; i += 1) {
    const r = await ask(svc, 'prem', { requestId: `req_count_${i}` });
    assert.equal(r.status.remainingQuestions, QUESTION_DAILY_LIMIT - 1 - i);
  }
  await assert.rejects(ask(svc, 'prem', { requestId: 'req_count_x' }), code('resource-exhausted'));
  assert.equal(ANALYSIS_MONTHLY_SECONDS, 7200);
});

test('남은 분석 시간이 영상 길이보다 적으면 새 영상은 거절하지만 이미 분석한 영상은 계속 답한다', async () => {
  const store = accessStore();
  const deps = fakeDeps();
  const svc = service(store, deps);
  await ask(svc, 'prem'); // 600초 사용, 요약 저장
  store.u('prem').usage.monthSeconds = 7000;
  await assert.rejects(ask(svc, 'prem', { requestId: 'req_newvideo', videoId: VIDEO2 }), code('resource-exhausted'));
  assert.equal(deps.calls.analyze.length, 1);
  const follow = await ask(svc, 'prem', { requestId: 'req_followup' });
  assert.equal(follow.status.remainingAnalysisSeconds, 200);
  assert.equal(deps.calls.recap.length, 1);
});

test('결제 갱신으로 구독 기간이 바뀌면 분석 시간이 새로 시작된다', async () => {
  const store = accessStore();
  store.u('prem').usage = { day: '2026-11-20', dayCount: 0, month: `p:${END}`, monthSeconds: ANALYSIS_MONTHLY_SECONDS, lease: null };
  const deps = fakeDeps();
  await assert.rejects(ask(service(store, deps), 'prem'), code('resource-exhausted'));
  noExternal(deps.calls); // 남은 분석 시간이 0이면 YouTube 확인도 하지 않는다
  // 2026-12-05 갱신: endDate가 한 달 뒤로 바뀐다.
  const renewedAt = Date.UTC(2026, 11, 5, 1, 0, 0);
  store.u('prem').subscription = { ...PREMIUM, endDate: '2027-01-05T00:00:00.000Z' };
  const r = await ask(service(store, deps, () => renewedAt), 'prem', { requestId: 'req_renewed1' });
  assert.equal(r.status.remainingAnalysisSeconds, 6600);
  assert.equal(store.u('prem').usage.month, `p:${Date.parse('2027-01-05T00:00:00.000Z')}`);
});

// ───── 영상 확인 ─────

test('비공개·길이 없음·너무 긴 영상은 모델을 부르지 않고 차감하지 않는다', async () => {
  const infos = [
    [null, 'failed-precondition'],
    [{ videoId: VIDEO, isPublic: false, durationSeconds: 600 }, 'failed-precondition'],
    [{ videoId: VIDEO, isPublic: true, durationSeconds: null }, 'failed-precondition'],
    [{ videoId: VIDEO, isPublic: true, durationSeconds: MAX_ANALYSIS_VIDEO_SECONDS + 1 }, 'invalid-argument'],
  ];
  for (const [info, expected] of infos) {
    const store = accessStore();
    const deps = fakeDeps({ info });
    await assert.rejects(ask(service(store, deps), 'prem'), code(expected));
    assert.equal(deps.calls.modelFactory, 0);
    assert.equal(store.writes, 0);
  }
  assert.equal(parseIsoDurationSeconds('PT1H2M3S'), 3723);
  assert.equal(parseIsoDurationSeconds('P0D'), null);
  assert.equal(parseIsoDurationSeconds('PT'), null);
  assert.deepEqual(mapAnalysisInfo({ id: VIDEO, status: { privacyStatus: 'unlisted', uploadStatus: 'processed' }, contentDetails: { duration: 'PT5M' } }),
    { videoId: VIDEO, isPublic: false, durationSeconds: 300 });
  assert.equal(mapAnalysisInfo({ id: VIDEO, status: { privacyStatus: 'public', uploadStatus: 'processed' }, contentDetails: { duration: 'PT5M' } }).isPublic, true);
});

test('입력 검사: 임의 주소·잘못된 영상 ID·긴 질문은 받지 않고 이전 대화는 3개까지만 쓴다', async () => {
  const store = accessStore();
  const deps = fakeDeps();
  const svc = service(store, deps);
  await assert.rejects(ask(svc, 'prem', { videoId: 'https://evil.example/v.mp4' }), code('invalid-argument'));
  await assert.rejects(ask(svc, 'prem', { requestId: 'x' }), code('invalid-argument'));
  await assert.rejects(ask(svc, 'prem', { question: '가'.repeat(501) }), code('invalid-argument'));
  await assert.rejects(ask(svc, 'prem', { question: ' ' }), code('invalid-argument'));
  noExternal(deps.calls);
  const previous = Array.from({ length: 6 }, (_, i) => ({ question: `질문${i}`, answer: `답${i}` }));
  await ask(svc, 'prem', { previous });
  assert.deepEqual(deps.calls.analyze[0].previous.map((p) => p.question), ['질문3', '질문4', '질문5']);
});

test('근거가 없다는 답은 그대로 보여주고 시각은 영상 길이 안의 값만 남긴다', async () => {
  const store = accessStore();
  const deps = fakeDeps({ answer: { supported: false, answer: '', timestamps: [-5, 30.7, 30, 99999, 'x'], recap: { summary: '', segments: [{ t: 9999, text: '범위 밖' }] } } });
  const r = await ask(service(store, deps), 'prem');
  assert.equal(r.answer, '이 영상에서 질문과 관련된 내용을 확인하지 못했어요.');
  assert.deepEqual(r.timestamps, [], '확인할 근거가 없으면 시간 링크를 제시하지 않는다');
  assert.equal(store.u('prem').cache.has(`recap_${VIDEO}`), false, '쓸 수 있는 요약이 없으면 저장하지 않는다');
  const clean = sanitizeModelAnswer({ supported: true, answer: 'a'.repeat(5000), timestamps: [1, 2, 3, 4, 5, 6, 7] }, 100, false);
  assert.equal(clean.answer.length, 1500);
  assert.deepEqual(clean.timestamps, [1, 2, 3, 4, 5]);
});

// ───── Gemini 전송 (가짜 fetch) ─────

test('말일에 갱신된 실제 구독의 분석 한도는 달력 월이 바뀌어도 같은 결제 주기를 유지한다', () => {
  const lastPaidAt = '2027-01-31T03:00:00.000Z';
  const endDate = '2027-03-03T03:00:00.000Z';
  const subscription = { plan: 'premium', status: 'active', startDate: '2026-11-30T03:00:00.000Z', lastPaidAt, endDate };
  const expected = { ok: true, monthKey: `p:${Date.parse(endDate)}` };
  assert.deepEqual(evaluateQuestionEntitlement(subscription, Date.parse('2027-01-31T07:00:00.000Z')), expected);
  assert.deepEqual(evaluateQuestionEntitlement(subscription, Date.parse('2027-02-01T03:00:00.000Z')), expected);
});

test('Gemini 전송: 공식 generateContent에 YouTube 주소를 fileData로, 키는 머리글로 보내고 재시도하지 않는다', async () => {
  const sent = [];
  const okBody = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ supported: true, answer: '답', timestamps: [3] }) }] } }] };
  const client = createGeminiVideoClient({
    apiKey: 'test-key',
    fetch: async (url, init) => { sent.push({ url, init }); return { ok: true, status: 200, json: async () => okBody }; },
  });
  const out = await client.analyzeVideo({ videoId: VIDEO, durationSeconds: 600, question: '질문', previous: [] });
  assert.deepEqual(out, { supported: true, answer: '답', timestamps: [3] });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, `https://generativelanguage.googleapis.com/v1beta/models/${VIDEO_FINDER_GEMINI_MODEL}:generateContent`);
  assert.equal(VIDEO_FINDER_GEMINI_MODEL, 'gemini-3.5-flash-lite');
  assert.ok(!sent[0].url.includes('test-key'));
  assert.equal(sent[0].init.headers['x-goog-api-key'], 'test-key');
  assert.equal(sent[0].init.method, 'POST');
  assert.equal(sent[0].init.redirect, 'error');
  const body = JSON.parse(sent[0].init.body);
  assert.deepEqual(body.contents[0].parts[0], { fileData: { fileUri: `https://www.youtube.com/watch?v=${VIDEO}` } });
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.ok(body.generationConfig.maxOutputTokens <= 2048);
  assert.ok(body.generationConfig.responseSchema.required.includes('recap'));

  await client.answerFromRecap({ recap: { videoId: VIDEO, summary: '요지', segments: [{ t: 5, text: '장면' }], durationSeconds: 600, createdAt: NOW, expiresAt: NOW + 1 }, question: '후속', previous: [] });
  const followBody = JSON.parse(sent[1].init.body);
  assert.ok(followBody.contents[0].parts.every((p) => !p.fileData), '후속 질문은 영상 없이 텍스트만 보낸다');
  assert.ok(followBody.contents[0].parts[0].text.includes('[5초] 장면'));

  let failures = 0;
  const failing = createGeminiVideoClient({ apiKey: 'k', fetch: async () => { failures += 1; return { ok: false, status: 500, json: async () => ({}) }; } });
  await assert.rejects(failing.analyzeVideo({ videoId: VIDEO, durationSeconds: 60, question: 'q', previous: [] }));
  assert.equal(failures, 1);
  const truncated = createGeminiVideoClient({ apiKey: 'k', fetch: async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"a' }] } }] }) }) });
  await assert.rejects(truncated.analyzeVideo({ videoId: VIDEO, durationSeconds: 60, question: 'q', previous: [] }));
  const noKey = createGeminiVideoClient({ apiKey: '', fetch: async () => { throw new Error('must not call'); } });
  await assert.rejects(noKey.analyzeVideo({ videoId: VIDEO, durationSeconds: 60, question: 'q', previous: [] }));
  assert.throws(() => core.buildGeminiVideoRequest({ videoId: 'https://x.example', durationSeconds: 1, question: 'q', previous: [] }));
});

// ───── 독립 주소 게이트웨이: 같은 구현, 동의 전 검색·보관함 차단 ─────

const ORIGIN = VIDEO_FINDER_STANDALONE_ORIGINS[0];
const TOKEN = 'A'.repeat(43);

function gatewayFor(accessSvc, calls) {
  const sessions = new Map([[hashSessionToken(TOKEN), { uid: 'prem', audience: ORIGIN, createdAt: NOW - 1000, expiresAt: NOW + 3600000 }]]);
  const store = {
    async getLimits() { return { enabled: true, standaloneSignIn: true, userDailySearches: 20, globalDailyUnits: 8000 }; },
    async getSession(h) { return sessions.get(h) || null; },
    async deleteSession(h) { sessions.delete(h); },
    async getAccount() { return { userData: ACTIVE, authUser: { disabled: false, emailVerified: true, providerIds: ['google.com'], tokensValidAfterMs: null } }; },
  };
  const svc = {
    async search() { calls.search += 1; return { videos: [] }; },
    async library(uid, p) { calls.library.push(p.action); return { ok: true }; },
  };
  return { gateway: createStandaloneGateway({ store, now: () => NOW, service: () => svc, access: () => accessSvc }), sessions };
}

test('독립 주소: 동의 전에는 세션·상태·동의·로그아웃·삭제만 되고 검색·보관함은 막힌다', async () => {
  const store = accessStore();
  store.u('prem').policy = null;
  const deps = fakeDeps();
  const calls = { search: 0, library: [] };
  const { gateway, sessions } = gatewayFor(service(store, deps), calls);
  const call = (op, payload) => gateway.handle({ op, session: TOKEN, payload }, ORIGIN);

  await call('session');
  assert.equal((await call('access', { action: 'status' })).policyAccepted, false);
  await assert.rejects(call('search', { filters: {} }), code('failed-precondition'));
  await assert.rejects(call('library', { action: 'list' }), code('failed-precondition'));
  await assert.rejects(call('access', { action: 'ask', requestId: 'req_gateway1', videoId: VIDEO, question: '질문이요' }), code('failed-precondition'));
  await call('library', { action: 'deleteAll', confirm: 'DELETE_MY_VIDEO_FINDER_DATA' });
  assert.equal(calls.search, 0);
  assert.deepEqual(calls.library, ['deleteAll']);
  noExternal(deps.calls);

  await call('access', { action: 'acceptPolicy', version: 1 });
  await call('search', { filters: {} });
  await call('library', { action: 'list' });
  assert.equal(calls.search, 1);
  const answer = await call('access', { action: 'ask', requestId: 'req_gateway1', videoId: VIDEO, question: '질문이요', uid: 'someoneElse' });
  assert.equal(answer.status.remainingQuestions, 9);
  assert.equal(store.users.has('someoneElse'), false, 'UID는 세션에서만 정한다');

  assert.deepEqual(await gateway.handle({ op: 'signOut', session: TOKEN }, ORIGIN), { signedOut: true });
  assert.equal(sessions.size, 0);
  assert.equal(policyRequiredFor('library', { action: 'remove' }), false);
  assert.equal(policyRequiredFor('library', { action: 'backup' }), true);
  assert.equal(policyRequiredFor('search', {}), true);
});
