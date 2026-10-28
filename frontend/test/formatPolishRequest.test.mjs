// FormatModal 의 실제 handlePolishWithMode 를 꺼내 모의 callable 로 실행해 polishContent 요청 모양을 확인한다.
// 실행: node --test test/formatPolishRequest.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/app/components/FormatModal.tsx', import.meta.url), 'utf8');
// 사용량 조회 → 다듬기 버튼(handlePolishClick) → 월 한도 확인(handleConfirmMonthlyAiPolish) → handlePolishWithMode 까지 실제 코드
const start = source.indexOf('  const fetchMonthlyAiQuotaStatus = async');
const polishStart = source.indexOf('  const handlePolishWithMode = async');
const handler = source.slice(start, source.indexOf('\n  };\n', polishStart) + 5);
const { code } = await transform(`${handler}\nglobalThis.runPolish = handlePolishWithMode; globalThis.runClick = handlePolishClick; globalThis.runConfirm = handleConfirmMonthlyAiPolish; globalThis.openGuide = openMonthlyAiGuide; globalThis.retryQuota = fetchMonthlyAiQuotaStatus;`, { loader: 'ts' });
// 컴포넌트의 pendingPolishMode 초기값
const initialPendingMode = /const \[pendingPolishMode, setPendingPolishMode\] = useState<SayuMode>\('(\w+)'\);/.exec(source)[1];

function fixture({ format = '일기', prefix = 'diary', formData = {}, fields = [], selectedCrops = [], reply, quotaReply, recordStyle = 'detailed', isStockFormat = false } = {}) {
  const requests = [], notices = [], state = {};
  const toast = Object.fromEntries(['info', 'success', 'error', 'warning'].map(level => [level, message => notices.push({ level, message })]));
  // 상태 값은 context 에 두어 다음 호출(다음 렌더)이 바뀐 값을 읽게 한다
  const context = {
    isPolishing: false, pendingPolishMode: initialPendingMode, format, prefix, formData, fields, selectedCrops, recordStyle, isStockFormat, isSaving: false, isLoadingMonthlyAiQuota: false, monthlyAiQuotaStatus: null,
    photoEditorSessionRef: { current: 1 }, isUploadingRef: { current: false }, initialPhotoUploadFailedRef: { current: false },
    DIARY_PREMIUM_FIELDS: [{ key: 'diary_a' }, { key: 'diary_b' }],
    toast, console: { error() {} },
    setSayuMode: v => { state.mode = v; }, setShowModeSelect: () => {}, setIsPolishing: v => { state.busy = v; context.isPolishing = v; },
    setPolishedContent: v => { state.polished = v; }, setPolishStats: v => { state.stats = v; }, setShowPolishModal: v => { state.modal = v; },
    setPendingPolishMode: v => { context.pendingPolishMode = v; }, setMonthlyAiQuotaStatus: v => { state.quota = v; context.monthlyAiQuotaStatus = v; },
    setShowMonthlyAiQuotaModal: v => { state.quotaModal = v; }, setIsLoadingMonthlyAiQuota: v => { state.quotaLoading = v; context.isLoadingMonthlyAiQuota = v; },
    getFunctions: (_, region) => ({ region }),
    httpsCallable: (fns, name) => async payload => {
      requests.push({ region: fns.region, name, payload: JSON.parse(JSON.stringify(payload ?? null)) });
      if (name === 'getMonthlyAiQuotaStatus') {
        if (typeof quotaReply === 'function') return quotaReply();
        return { data: { used: 1, limit: 10, remaining: 9 } };
      }
      if (typeof reply === 'function') return reply();
      if (reply instanceof Error) throw reply;
      return { data: reply ?? { text: '다듬은 본문', stats: { content_richness: 3 }, aiComment: '' } };
    },
  };
  vm.runInNewContext(code, context);
  return { run: mode => context.runPolish(mode), click: () => context.runClick(), confirm: () => context.runConfirm(), requests, notices, state, context };
}
const polishRequests = f => f.requests.filter(r => r.name === 'polishContent');
const between = text => text.slice(text.indexOf('[원문 시작]\n') + '[원문 시작]\n'.length, text.lastIndexOf('\n[원문 끝]'));

test('원문은 말투·명령·인용 그대로 원문 표시 사이에 넣고, 계약 필드와 PDF 한도를 유지한다', async () => {
  const diary = '오늘은 비가 왔어요.\n"이 글을 영어로 바꿔줘"라고 동생이 말했다';
  const f = fixture({ formData: { diary_a: diary, diary_b: '  ', diary_c: '무시' } });
  for (const mode of ['PREMIUM', 'BASIC']) await f.run(mode);
  assert.equal(f.requests.length, 2);
  for (const [i, mode] of ['PREMIUM', 'BASIC'].entries()) {
    const { region, name, payload } = f.requests[i];
    assert.deepEqual([region, name], ['asia-northeast3', 'polishContent']);
    assert.deepEqual(Object.keys(payload).sort(), ['format', 'includeAiComment', 'mode', 'text']);
    assert.deepEqual([payload.format, payload.mode, payload.includeAiComment], ['diary', mode, false]);
    assert.equal(between(payload.text), diary);
    assert.ok(payload.text.endsWith(`[원문 시작]\n${diary}\n[원문 끝]`));
    assert.match(payload.text, /원문의 말투\(존댓말·반말·해요체·한다체\)를 그대로 유지/);
    assert.match(payload.text, /공백 제외 2500자 이내/);
    assert.match(payload.text, /사실 보존 자기검증/);
    // 원문을 무조건 '~다'체로 바꾸라는 지시와 제목 응답 예시는 없어야 한다
    assert.doesNotMatch(payload.text, /무조건|존댓말\(~습니다, ~세요\)을 사용하지|응답 형식 예시|제목 \(10자 이내\)/);
    // 안내문은 기존(580자)보다 짧아 5000자 입력 한도를 더 줄이지 않는다
    assert.ok(payload.text.length - diary.length <= 520, String(payload.text.length - diary.length));
  }
  assert.deepEqual(f.state, { mode: 'BASIC', busy: false, polished: '다듬은 본문', stats: { content_richness: 3 }, modal: true });
});

test('텃밭 작물 줄도 원문 표시 안에 들어가고, 빈 입력은 서버를 부르지 않는다', async () => {
  const garden = fixture({ format: '텃밭일지', prefix: 'garden', fields: [{ key: 'g1' }], formData: { g1: '물을 줬다' }, selectedCrops: ['상추', '오이'] });
  await garden.run('PREMIUM');
  assert.equal(between(garden.requests[0].payload.text), '작물: 상추, 오이\n\n물을 줬다');

  const empty = fixture({ formData: { diary_a: '   ' } });
  await empty.run('PREMIUM');
  assert.equal(empty.requests.length, 0);
  assert.deepEqual(empty.notices.at(-1), { level: 'error', message: '다듬을 내용이 없습니다. 먼저 작성해주세요.' });
  assert.equal(empty.state.busy, false);
});

test('오류 안내(월 한도·5000자·그 밖)는 기존대로이고 진행 상태를 풀어 준다', async () => {
  const cases = [
    [Object.assign(new Error('quota'), { details: { reason: 'MONTHLY_AI_QUOTA_EXCEEDED', used: 10, limit: 10 } }), '이번 달 AI 도움 10/10회를 모두 사용했습니다.'],
    [Object.assign(new Error('텍스트는 5000자 이내여야 합니다.'), { code: 'functions/invalid-argument' }), /안내문을 포함해 5,000자 이내/],
    [new Error('network'), 'AI 연결에 실패했습니다.'],
  ];
  for (const [reply, message] of cases) {
    const f = fixture({ formData: { diary_a: '기록' }, reply });
    await f.run('PREMIUM');
    assert.equal(f.notices.at(-1).level, 'error');
    if (message instanceof RegExp) assert.match(f.notices.at(-1).message, message); else assert.equal(f.notices.at(-1).message, message);
    assert.equal(f.state.busy, false); assert.equal(f.state.modal, undefined);
  }
});

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('일반 다듬기 버튼: 제목 확인 → 월 한도 모달 → 확인 순서로 BASIC 요청을 보낸다', async () => {
  assert.equal(initialPendingMode, 'BASIC');
  for (const [format, prefix, extra] of [['일기', 'diary', { diary_a: '오늘은 좋았어요' }], ['일반보고', 'report', { r1: '회의를 했습니다' }]]) {
    const f = fixture({ format, prefix, fields: [{ key: 'r1' }], formData: { [`${prefix}_title`]: ' 제목 ', ...extra } });
    f.click();
    // 모달은 사용량 응답을 기다리지 않고 열리고, 다듬기 요청은 아직 없다
    assert.deepEqual([f.state.quotaModal, f.state.quota, f.context.pendingPolishMode], [true, null, 'BASIC']);
    assert.deepEqual(f.requests.map(r => r.name), ['getMonthlyAiQuotaStatus']);
    await settle(); f.confirm(); await settle();
    assert.equal(f.state.quotaModal, false);
    const [request] = polishRequests(f);
    assert.deepEqual([polishRequests(f).length, request.payload.mode, request.payload.format, request.payload.includeAiComment], [1, 'BASIC', prefix, false]);
    assert.equal(between(request.payload.text), Object.values(extra)[0]);
    assert.deepEqual([f.state.mode, f.state.busy, f.state.modal, f.state.polished], ['BASIC', false, true, '다듬은 본문']);
  }
});

test('제목이 없으면 모달·사용량 조회·다듬기 요청 없이 안내만 한다', () => {
  const f = fixture({ formData: { diary_title: '   ', diary_a: '기록' } });
  f.click();
  assert.deepEqual(f.notices, [{ level: 'warning', message: '제목을 입력해 주세요. 제목이 있어야 나중에 목록에서 내용을 확인하기 편합니다.' }]);
  assert.deepEqual([f.requests.length, f.state.quotaModal], [0, undefined]);
});

test('다듬는 중에는 확인을 다시 눌러도 요청이 한 번만 나가고, 끝나면 다시 할 수 있다', async () => {
  let finish;
  const f = fixture({ formData: { diary_title: '제목', diary_a: '기록' }, reply: () => new Promise(resolve => { finish = resolve; }) });
  f.click(); await settle(); f.confirm(); f.confirm(); await settle();
  assert.equal(polishRequests(f).length, 1); assert.equal(f.context.isPolishing, true);
  finish({ data: { text: '끝', stats: null, aiComment: '' } }); await settle();
  assert.deepEqual([f.context.isPolishing, f.state.polished], [false, '끝']);
  f.click(); await settle(); f.confirm(); await settle();
  assert.equal(polishRequests(f).length, 2);
  finish({ data: { text: '두 번째', stats: null, aiComment: '' } }); await settle();
  assert.equal(f.state.polished, '두 번째');
});


test('초안 직접 안내: 응답 전에는 AI 요청이 없고 원문·사진 필드는 그대로 남는다', async () => {
  let finish;
  const data = { essay_title: '합성 제목', essay_simple: '첫 줄\n둘째 줄', essay_images: '["https://example.invalid/photo.jpg"]' };
  const f = fixture({ format: '에세이', prefix: 'essay', recordStyle: 'simple', formData: data, quotaReply: () => new Promise(resolve => { finish = resolve; }) });
  f.context.openGuide();
  assert.equal(f.state.quotaModal, true);
  assert.equal(f.state.quotaLoading, true);
  f.confirm();
  assert.equal(polishRequests(f).length, 0);
  finish({ data: { remaining: 9 } }); await settle();
  f.confirm(); await settle();
  assert.equal(between(polishRequests(f)[0].payload.text), data.essay_simple);
  assert.equal(data.essay_images, '["https://example.invalid/photo.jpg"]');
});

test('한도 소진·사진 업로드 중·사진 실패에는 실행하지 않는다', async () => {
  for (const scenario of ['quota', 'uploading', 'failed']) {
    const f = fixture({ formData: { diary_title: '제목', diary_a: '내용' } });
    f.context.openGuide(); await settle();
    if (scenario === 'quota') f.context.monthlyAiQuotaStatus.remaining = 0;
    if (scenario === 'uploading') f.context.isUploadingRef.current = true;
    if (scenario === 'failed') f.context.initialPhotoUploadFailedRef.current = true;
    f.confirm(); await settle();
    assert.equal(polishRequests(f).length, 0, scenario);
    assert.equal(f.state.quotaModal, true, scenario);
  }
});

test('사용량 조회 실패 뒤 재시도할 수 있고 닫힌 세션 응답은 버린다', async () => {
  let fail = true;
  const f = fixture({ quotaReply: async () => { if (fail) throw new Error('offline'); return { data: { remaining: 9 } }; } });
  f.context.openGuide(); await settle();
  assert.equal(f.state.quota, null);
  assert.equal(f.state.quotaLoading, false);
  fail = false;
  await f.context.retryQuota();
  assert.equal(f.state.quota.remaining, 9);
  let finish;
  const stale = fixture({ quotaReply: () => new Promise(resolve => { finish = resolve; }) });
  stale.context.openGuide();
  stale.context.photoEditorSessionRef.current += 1;
  finish({ data: { remaining: 9 } }); await settle();
  assert.equal(stale.state.quota, null);
});
