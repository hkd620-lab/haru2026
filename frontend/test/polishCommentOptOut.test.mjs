import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
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
  const state = { requests: [], saves: [], errors: [], polished: '', stats: null, analysis: '', busy: false, showPolish: false, showFinish: false };
  const formData = reading
    ? { reading_book_title: '합성 책', reading_author: '합성 저자', reading_journal: '직접 쓴 생각', reading_ai_comment: '기존 한마디' }
    : { diary_simple: '직접 쓴 원문', diary_title: '사용자 제목', diary_ai_comment: '기존 한마디' };
  const env = () => ({
    format: reading ? '독서사유' : '일기', prefix, formData, user: { uid: 'synthetic-user' }, recordStyle: 'simple', isPolishing: false,
    setSayuMode() {}, setShowModeSelect() {}, setIsPolishing: value => { state.busy = value; },
    toast: { info() {}, warning() {}, success() {}, error: value => state.errors.push(value) }, console: { error: error => state.errors.push(String(error)) },
    getFunctions: (_app, region) => { assert.equal(region, 'asia-northeast3'); return {}; },
    httpsCallable: (_functions, name) => { assert.equal(name, 'polishContent'); return async payload => {
      state.requests.push(structuredClone(payload));
      return { data: { text: '합성 본문', stats: reading ? null : { content_richness: 4 }, aiComment: '' } };
    }; },
    setPolishedContent: value => { state.polished = value; }, setPolishStats: value => { state.stats = value; }, setShowPolishModal: value => { state.showPolish = value; },
    selectedExistingBookId: 'synthetic-book', knownReadingBooks: [], setBlockedBookMessage() {}, makeReadingBookId: () => 'synthetic-book',
    setIsReadingFinishing() {}, getFirestore: () => ({}), collection: () => ({}), query: () => ({}), where: () => ({}),
    getDocs: async () => ({ forEach() {} }), buildCurrentReadingEntry: () => '사용자가 직접 쓴 독서장', buildReadingSnapshot,
    setReadingEntriesSnapshot() {}, setReadingAnalysis: value => { state.analysis = value; }, setShowReadingFinishModal: value => { state.showFinish = value; },
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

test('독서 마무리는 false를 보내고 분석 본문을 기존 미리보기에 전달한다', async () => {
  const f = formatFixture(true); await f.call('handleReadingFinishClick')();
  assert.equal(f.state.requests.length, 1); assert.equal(f.state.requests[0].includeAiComment, false);
  assert.equal(f.state.requests[0].format, 'reading'); assert.match(f.state.requests[0].text, /사용자가 직접 쓴 독서장/);
  assert.equal(f.state.analysis, '합성 본문'); assert.equal(f.state.showFinish, true); assert.deepEqual(f.state.errors, []);
});

test('중간 독서장은 false를 보내고 본문·기존 한마디를 저장 payload에 유지한다', async () => {
  const f = formatFixture(true); await f.call('handleSaveChapterNote')();
  assert.equal(f.state.requests.length, 1); assert.equal(f.state.requests[0].includeAiComment, false);
  assert.equal(f.state.requests[0].format, 'reading'); assert.match(f.state.requests[0].text, /직접 쓴 생각/);
  assert.equal(f.state.saves.length, 1); const saved = f.state.saves[0];
  assert.equal(saved.reading_sayu, '합성 본문'); assert.equal(saved.reading_ai_comment, '기존 한마디');
  assert.equal(saved.entryType, 'readingNote'); assert.deepEqual(f.state.errors, []);
});

for (const aiComment of ['새 한마디', '', undefined, 123]) {
  test(`SayuModal 대조군: 옵션 누락·한마디 ${JSON.stringify(aiComment)}의 기존 저장 계약 유지`, async () => {
    const state = { requests: [], saved: { memo_ai_comment: '기존 한마디', memo_stats: { preserved: true } }, localComment: '기존 한마디', errors: [] };
    const env = {
      currentUser: { uid: 'synthetic-user' }, formatKey: 'memo', format: '메모', recordDate: '2026-10-22', firestoreId: 'synthetic-record',
      editedOriginalData: { memo_simple: '합성 원문' }, setIsRefining() {}, showLoading() {}, hideLoading() {}, functions: {}, db: {},
      httpsCallable: (_functions, name) => { assert.equal(name, 'polishContent'); return async request => { state.requests.push(request); return { data: { text: '새 본문', aiComment } }; }; },
      doc: (_db, ...segments) => { assert.deepEqual(segments, ['users', 'synthetic-user', 'records', 'synthetic-record']); return {}; },
      updateDoc: async (_ref, payload) => Object.assign(state.saved, payload), setEditedContent() {}, setViewMode() {},
      setLocalAiComment: value => { state.localComment = value; }, toast: { error: value => state.errors.push(value), success() {} }, console: { error: error => state.errors.push(String(error)) },
    };
    await handler('SayuModal', 'handleRepolish', env)();
    assert.equal(state.requests.length, 1); assert.equal(Object.hasOwn(state.requests[0], 'includeAiComment'), false);
    assert.equal(state.saved.memo_sayu, '새 본문');
    const expected = typeof aiComment === 'string' && aiComment ? aiComment : '기존 한마디';
    assert.equal(state.saved.memo_ai_comment, expected); assert.equal(state.localComment, expected);
    assert.deepEqual(state.saved.memo_stats, { preserved: true }); assert.deepEqual(state.errors, []);
  });
}
