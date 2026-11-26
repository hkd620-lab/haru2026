import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { getFormatDisplayName } from '../src/app/records/recordFormatDescriptions.ts';
import { buildReadingSnapshot, parseReadingAiReference, readingAiReferenceText } from '../src/app/services/readingAiCore.ts';

// Execute actual handlers using fake callables and memory writes, without app/Firebase imports.
function handler(file, name, env) {
  const source = readFileSync(new URL(`../src/app/components/${file}.tsx`, import.meta.url), 'utf8');
  const found = source.match(new RegExp(`^  const ${name} = [\\s\\S]*?^  };`, 'm'));
  assert.ok(found, name);
  const { code } = transformSync(found[0], { loader: 'ts' });
  return new Function(...Object.keys(env), `${code}\nreturn ${name};`)(...Object.values(env));
}
function formatFixture(reading = false) {
  const prefix = reading ? 'reading' : 'diary';
  const readingReflectionBookId = { current: '' };
  const readingAnalysisId = { current: '' };
  const state = { requests: [], saves: [], errors: [], polished: '', stats: null, analysis: '', busy: false, showPolish: false, showFinish: false };
  const formData = reading
    ? { reading_book_title: '합성 책', reading_author: '합성 저자', reading_journal: '직접 쓴 생각', reading_ai_comment: '기존 한마디' }
    : { diary_simple: '직접 쓴 원문', diary_title: '사용자 제목', diary_ai_comment: '기존 한마디' };
  const env = () => ({
    repolishRequestRef: { current: null },
    format: reading ? '독서사유' : '일기', prefix, formData, user: { uid: 'synthetic-user' }, recordStyle: 'simple', isPolishing: false, isSaving: false,
    photoEditorSessionRef: { current: 1 }, polishRequestRef: { current: null }, polishPreviewSourceRef: { current: undefined },
    setSayuMode() {}, setPolishStrength: value => { state.strength = value; }, setIsPolishing: value => { state.busy = value; },
    toast: { info() {}, warning() {}, success() {}, error: value => state.errors.push(value) }, console: { error: error => state.errors.push(String(error)) },
    getFormatDisplayName,
    getFunctions: (_app, region) => { assert.equal(region, 'asia-northeast3'); return {}; },
    httpsCallable: (_functions, name) => { assert.equal(name, 'polishContent'); return async payload => {
      state.requests.push(structuredClone(payload));
      if (state.nextFailure) {
        const error = state.nextFailure;
        state.nextFailure = undefined;
        throw error;
      }
      if (state.pendingResponse) {
        state.pendingResponse = false;
        return { data: { status: 'processing' } };
      }
      return { data: { text: '합성 본문', stats: reading ? null : { content_richness: 4 }, aiComment: '' } };
    }; },
    setPolishedContent: value => { state.polished = value; }, setPolishStats: value => { state.stats = value; }, setShowPolishModal: value => { state.showPolish = value; },
    selectedExistingBookId: 'synthetic-book', knownReadingBooks: [], setBlockedBookMessage() {}, makeReadingBookId: () => 'synthetic-book',
    setIsReadingFinishing() {}, getFirestore: () => ({}), collection: () => ({}), query: () => ({}), where: () => ({}),
    getDocs: async () => ({ forEach() {} }), buildCurrentReadingEntry: () => '사용자가 직접 쓴 독서장', buildReadingSnapshot,
    readingSaveNotice: { current: undefined }, readingAnalysisRequest: { current: 0 }, readingAnalysisId, readingReflectionBookId,
    getReadingAnalysisRequestId: async (_uid, _text, id) => id,
    setReadingAnalysisInProgress: value => { state.analysisInProgress = value; }, readingAnalysisStatus: 'idle', setReadingAnalysisLimitReached() {},
    readingEntriesSnapshot: state.snapshot, setReadingAnalysisStatus: value => { state.analysisStatus = value; },
    setShowReadingQuestions() {}, setReadingReflectionAnswers: value => { state.answers = value; }, setReadingEntriesSnapshot: value => { state.snapshot = value; }, setReadingAnalysis: value => { state.analysis = value; }, setShowReadingFinishModal: value => { state.showFinish = value; },
    readingAiReferenceText, parseReadingAiReference, imagesKey: `${prefix}_images`, imageMetaKey: `${prefix}_image_meta`, uploadedImages: [], getUploadedImageMetaForSave: () => '[]',
    editingReadingEntryId: '', editingReadingEntryDate: '', buildReadingMeta: () => ({ entryType: 'readingNote' }),
    setIsSaving() {}, onSave: async payload => { state.saves.push(structuredClone(payload)); return 'synthetic-record'; }, closeAfterCommit() {},
    isCleaningSessionUploadsRef: { current: false }, getGrowthSaveFields: () => ({}), sayuKey: `${prefix}_sayu`, polishedContent: state.polished, polishStats: state.stats,
    sayuMode: 'PREMIUM', isStockFormat: false, navigate() {},
  });
  return { state, formData, call: name => handler('FormatModal', name, env()) };
}

test('일반 다듬기는 false를 보내며 본문·stats 미리보기와 기존 한마디/제목의 저장을 보존한다', async () => {
  const f = formatFixture(); await f.call('handlePolishWithMode')('PREMIUM');
  assert.equal(f.state.requests.length, 1); assert.equal(f.state.requests[0].includeAiComment, false);
  assert.equal(f.state.requests[0].format, 'diary'); assert.equal(f.state.requests[0].mode, 'PREMIUM');
  assert.match(f.state.requests[0].text, /직접 쓴 원문/);
  assert.equal(f.state.polished, '합성 본문'); assert.deepEqual(f.state.stats, { content_richness: 4 });
  assert.equal(f.state.showPolish, true); assert.equal(f.state.busy, false);
  await f.call('handleSaveSayu')();
  assert.equal(f.state.saves.length, 1); const saved = f.state.saves[0];
  assert.equal(saved.diary_sayu, '합성 본문'); assert.equal(saved.diary_ai_comment, '기존 한마디'); assert.equal(saved.diary_title, '사용자 제목');
  assert.deepEqual(saved.diary_stats, { content_richness: 4 }); assert.deepEqual(f.state.errors, []);
});

test('일반 독서 다듬기도 false를 보내고 기존 AI 한마디는 지우지 않는다', async () => {
  const f = formatFixture(true); f.formData.reading_simple = '합성 독서 기록';
  await f.call('handlePolishWithMode')('BASIC');
  assert.equal(f.state.requests[0].includeAiComment, false); assert.equal(f.state.requests[0].format, 'reading');
  assert.equal(f.formData.reading_ai_comment, '기존 한마디'); assert.deepEqual(f.state.errors, []);
});

for (const strength of ['WEAK', 'STRONG']) {
  test(`기록 다듬기 ${strength}: 선택을 서버·미리보기에 전달하고 모델 모드와 저장 내용을 유지한다`, async () => {
    const f = formatFixture();
    await f.call('handlePolishWithMode')('BASIC', strength);
    assert.equal(f.state.requests.length, 1);
    const request = f.state.requests[0];
    assert.equal(request.strength, strength); assert.equal(request.mode, 'BASIC');
    assert.equal(request.includeAiComment, false);
    assert.match(request.text, /\[원문 시작\]\n직접 쓴 원문\n\[원문 끝\]/);
    assert.doesNotMatch(request.text, /어색한 표현만 수정/);
    assert.match(request.text, /원문에 없는 사실, 감정, 배경, 원인, 결과를 절대 추가하지/);
    assert.doesNotMatch(request.text, /상황·분위기·감정을 문맥에 맞게 추정/);
    if (strength === 'STRONG') {
      assert.match(request.text, /원문에 있는 내용만 완결된 문장으로 풀고/);
      assert.match(request.text, /원문의 사실·수치·부정·미정 표현이 그대로인지 확인/);
    } else {
      assert.match(request.text, /선택한 다듬기 정도에 맞춰 문장과 흐름/);
    }
    assert.equal(f.state.strength, strength); assert.equal(f.state.showPolish, true);
    await f.call('handleSaveSayu')();
    assert.equal(f.state.saves[0].diary_sayu, '합성 본문');
    assert.deepEqual(f.state.errors, []);
  });

  test(`사용량 안내창: ${strength} 선택을 확정한 뒤 한 번만 다듬고 사용량·사진 가드를 유지한다`, () => {
    for (const blocked of ['none', 'busy', 'saving', 'loading', 'unknown', 'quota', 'upload', 'uploadFailed']) {
      const calls = [];
      const env = {
        isPolishing: blocked === 'busy', isSaving: blocked === 'saving', isLoadingMonthlyAiQuota: blocked === 'loading',
        monthlyAiQuotaStatus: blocked === 'unknown' ? null : { remaining: blocked === 'quota' ? 0 : 1 },
        isUploadingRef: { current: blocked === 'upload' }, initialPhotoUploadFailedRef: { current: blocked === 'uploadFailed' },
        pendingPolishMode: 'BASIC',
        setShowMonthlyAiQuotaModal: value => calls.push(['modal', value]),
        handlePolishWithMode: (...args) => calls.push(args), toast: { warning() {} },
      };
      handler('FormatModal', 'handleConfirmMonthlyAiPolish', env)(strength);
      assert.deepEqual(calls, blocked === 'none' ? [['modal', false], ['BASIC', strength]] : [], blocked);
    }
  });
}

test('새 다듬기 안내는 사용량 조회를 유지한다', () => {
  const state = {};
  handler('FormatModal', 'openMonthlyAiGuide', {
    setPendingPolishMode: value => { state.mode = value; },
    setMonthlyAiQuotaStatus: value => { state.quota = value; },
    setShowMonthlyAiQuotaModal: value => { state.open = value; },
    fetchMonthlyAiQuotaStatus: () => { state.fetched = true; },
  })();
  assert.deepEqual(state, { mode: 'BASIC', quota: null, open: true, fetched: true });
});

test('선택한 독서 마무리 분석은 false를 보내고 분석 본문을 기존 미리보기에 전달한다', async () => {
  const f = formatFixture(true);
  await f.call('handleReadingFinishClick')();
  await f.call('requestReadingAnalysis')();
  assert.equal(f.state.analysisStatus, 'ready');
  assert.equal(f.state.requests.length, 1); assert.equal(f.state.requests[0].includeAiComment, false);
  assert.equal(f.state.requests[0].format, 'reading'); assert.match(f.state.requests[0].text, /사용자가 직접 쓴 독서장/);
  assert.equal(f.state.analysis, '합성 본문'); assert.equal(f.state.showFinish, true); assert.deepEqual(f.state.errors, []);
});

test('저자 없는 중간 기록과 기본 완독은 AI 호출 없이 진행한다', async () => {
  const f = formatFixture(true);
  f.formData.reading_author = '';
  await f.call('handleSaveChapterNote')();
  assert.equal(f.state.saves.length, 1);
  assert.equal(f.state.saves[0].reading_sayu, '직접 쓴 생각');
  assert.equal(f.state.saves[0].reading_ai_comment, '기존 한마디');
  await f.call('handleReadingFinishClick')();
  assert.equal(f.state.showFinish, true);
  assert.deepEqual(f.state.requests, []);
  assert.deepEqual(f.state.errors, []);
});

test('저장된 메모와 일기 다듬기는 미리보기만 제공하고 배뇨는 현재 전용 경로를 사용한다', async () => {
  for (const formatKey of ['memo', 'voiding', 'diary']) {
    const requests = [];
    const preview = { current: null };
    await handler('SayuModal', 'handleRepolish', {
      isSaving: false, isSavingOriginal: false, currentUser: { uid: 'synthetic-user' }, formatKey, format: '', recordDate: undefined, firestoreId: 'synthetic-record',
      repolishRequestRef: { current: null }, setIsRefining() {}, functions: {}, polishPreviewRef: preview,
      httpsCallable: () => async request => { requests.push(request); return { data: { text: '다듬은 글', aiComment: '새 한마디' } }; },
      updateDoc: assert.fail, setLocalAiComment: assert.fail, editedContent: '저장된 본문',
      setEditedContent() {}, setViewMode() {}, setIsEditing() {}, toast: { error: assert.fail, success() {} }, console,
    })('합성 원문', 'STRONG');
    if (formatKey === 'voiding') {
      assert.equal(requests.length, 0);
      assert.equal(preview.current, null);
      continue;
    }
    assert.deepEqual(requests.map(request => [request.mode, request.strength, request.includeAiComment]), [['PREMIUM', 'STRONG', false]]);
    if (formatKey === 'diary') assert.match(requests[0].text, /원문에 없는 관찰·감정·행동·분위기·해석은 추측이나 가능성으로도 덧붙이지 마세요/);
    assert.match(requests[0].text, /\[원문 시작\]\n합성 원문\n\[원문 끝\]/);
    assert.deepEqual(preview.current, { text: '다듬은 글', source: '합성 원문' });
  }
});

test('원본 탭에서 약과 강은 각각 한 번 실행되어 저장 없이 SAYU 편집창에 결과를 표시한다', async () => {
  const requests = [];
  const preview = { content: '', mode: 'original', editing: false, ref: { current: null } };
  const repolish = handler('SayuModal', 'handleRepolish', {
    isSaving: false, isSavingOriginal: false, currentUser: { uid: 'synthetic-user' }, formatKey: 'diary', format: '일기',
    recordDate: '2026-11-02', firestoreId: 'synthetic-record', polishStrength: 'WEAK',
    functions: {}, repolishRequestRef: { current: null }, setIsRefining() {},
    httpsCallable: (_functions, name) => async request => {
      assert.equal(name, 'polishContent');
      requests.push(request);
      return { data: { text: `${request.strength} 미리보기` } };
    },
    setEditedContent: value => { preview.content = value; },
    setViewMode: value => { preview.mode = value; },
    setIsEditing: value => { preview.editing = value; },
    polishPreviewRef: preview.ref, editedContent: '저장된 본문',
    updateDoc: assert.fail, toast: { error: assert.fail, success() {} }, console,
  });

  for (const strength of ['WEAK', 'STRONG']) {
    await repolish('현재 원본 탭의 본문', strength);
    assert.equal(preview.content, `${strength} 미리보기`);
    assert.deepEqual(preview.ref.current, { text: preview.content, source: '현재 원본 탭의 본문' });
    assert.equal(preview.mode, 'ai');
    assert.equal(preview.editing, true);
  }
  assert.deepEqual(requests.map(request => request.strength), ['WEAK', 'STRONG']);
  for (const request of requests) {
    assert.equal(request.includeAiComment, false);
    assert.match(request.text, /\[원문 시작\]\n현재 원본 탭의 본문\n\[원문 끝\]/);
  }
});

test('같은 책의 완독 창을 다시 열면 분석과 사용자 답변을 유지한다', async () => {
  const f = formatFixture(true);
  await f.call('handleReadingFinishClick')();
  await f.call('requestReadingAnalysis')();
  f.state.answers = { question: '내 답변' };
  await f.call('handleReadingFinishClick')();
  assert.deepEqual(f.state.answers, { question: '내 답변' });
  assert.equal(f.state.analysis, '합성 본문');
  assert.equal(f.state.requests.length, 1);
});

test('완독 원본 저장은 편집 가능한 본문 필드만 Firestore에 보낸다', async () => {
  const writes = [];
  await handler('SayuModal', 'handleSaveOriginal', {
    repolishRequestRef: { current: null }, currentUser: { uid: 'synthetic-user' },
    firestoreId: 'synthetic-record', recordDate: '2026-11-26', isFinalReading: true, isHouseholdSayu: false,
    editedOriginalData: { reading_journal: '고친 글', reading_status: 'completed', reading_entries_snapshot: '누적 기록',
      reading_reflection_answers: '{}', reading_ai_context: 'null', reading_book_title: '책 제목' },
    setIsSavingOriginal() {}, db: {}, doc: () => ({}), updateDoc: async (_ref, data) => writes.push(data),
    isEditableFinalReadingField: key => key === 'reading_journal',
    toast: { success() {}, error: assert.fail }, console,
  })();
  assert.deepEqual(writes, [{ reading_journal: '고친 글' }]);
});

test('시간 초과와 진행 중 응답의 재시도는 동일한 분석 ID를 보내고 내용이 바뀌면 새 ID를 쓴다', async () => {
  const f = formatFixture(true);
  await f.call('handleReadingFinishClick')();
  f.state.nextFailure = { code: 'functions/deadline-exceeded' };
  await f.call('requestReadingAnalysis')();
  assert.equal(f.state.analysisStatus, 'error');
  f.state.pendingResponse = true;
  await f.call('requestReadingAnalysis')();
  assert.equal(f.state.analysisInProgress, true);
  await f.call('requestReadingAnalysis')();
  assert.equal(f.state.analysisStatus, 'ready');
  const ids = f.state.requests.map(request => request.readingAnalysisId);
  assert.ok(ids[0]);
  assert.deepEqual(ids, [ids[0], ids[0], ids[0]]);
  f.state.snapshot = '기존 흐름과 달라진 상태';
  await f.call('handleReadingFinishClick')();
  await f.call('requestReadingAnalysis')();
  assert.notEqual(f.state.requests.at(-1).readingAnalysisId, ids[0]);
});
