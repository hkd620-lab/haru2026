// FormatModal의 실제 이어작성·회차 저장 handler를 원문에서 꺼내 메모리 상태로 실행해 시작일과 작성 내용 보존을 확인한다.
// 실행: node --import tsx --test test/readingContinue.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { transform } from 'esbuild';
import { parseReadingAiReference, readingAiReferenceText, resetReadingBookDraft } from '../src/app/services/readingAiCore.ts';
import { mergeReadingBookDates, resolveReadingBookStartDate } from '../src/app/services/readingBookDates.ts';

const source = readFileSync(new URL('../src/app/components/FormatModal.tsx', import.meta.url), 'utf8');
function slice(startMark, endMark) {
  const start = source.indexOf(startMark);
  const end = source.indexOf(endMark, start);
  assert.ok(start >= 0 && end > start, `${startMark} 원문을 찾지 못했습니다.`);
  return source.slice(start, end);
}
const handlers = [
  slice('  const buildReadingMeta = (', '  // 📚 "새 책 시작"'),
  `${slice('  const handleSaveChapterNote = async', '\n  };\n')}\n  };\n`,
].join('\n');
const { code } = await transform(
  `${handlers}\nObject.assign(globalThis, { onSelectExistingBook, handleContinueReadingCard, continueReadingBook, handleSaveChapterNote });`,
  { loader: 'ts' },
);

const book = (id, overrides = {}) => ({
  readingBookId: id, bookTitle: `책 ${id}`, author: '저자', hasFinalReflection: false,
  startedAt: '', firstDate: '', lastDate: '', ...overrides,
});

function fixture({ books, selected = '', formData = {}, initialJournal = '', busy = false }) {
  const state = { step: 'select', notices: [], saved: null, selected, locked: false };
  const context = {
    format: '독서사유', prefix: 'reading', imagesKey: 'reading_images', imageMetaKey: 'reading_imageMeta',
    knownReadingBooks: books, selectedExistingBookId: selected, formData,
    uploadedImages: [], editingReadingEntryId: '', editingReadingEntryDate: '',
    isReadingChatBusy: busy, isExtractingBookText: false, isSaving: false, isPolishing: false, isReadingFinishing: false,
    initialReadingJournalRef: { current: initialJournal }, ocrPhotoSelectionVersionRef: { current: 0 },
    resetReadingBookDraft, resolveReadingBookStartDate, parseReadingAiReference, readingAiReferenceText,
    makeReadingBookId: () => 'made-id',
    buildReadingMetaCombined: ({ bookTitle, startedAt }) => ({ readingId: 'made-id', bookTitle, ...(startedAt ? { reading_started_at: startedAt } : {}) }),
    toast: Object.fromEntries(['info', 'success', 'error', 'warning'].map((level) => [level, (message) => state.notices.push(message)])),
    setFormData: (value) => { context.formData = typeof value === 'function' ? value(context.formData) : value; },
    setRecordStep: (value) => { state.step = value; },
    // React처럼 다음 렌더 전까지 handler가 보는 selectedExistingBookId는 바뀌지 않는다.
    setSelectedExistingBookId: (value) => { state.selected = value; },
    setEditingReadingEntryId() {}, setEditingReadingEntryDate() {}, setSelectedBookOcrFiles() {}, setReadingOcrUsedCount() {},
    setIsReadingBookLocked: (value) => { state.locked = value; },
    setBlockedBookMessage: (value) => { state.blocked = value; },
    setIsPolishing() {}, setIsSaving() {}, closeAfterCommit() {}, getUploadedImageMetaForSave: () => '[]',
    getFunctions: () => ({}),
    httpsCallable: () => async () => ({ data: { text: '다듬은 글' } }),
    onSave: async (data) => { state.saved = JSON.parse(JSON.stringify(data)); },
    console: { error() {} },
  };
  vm.runInNewContext(code, context);
  return { context, state };
}

test('작성중인 책이 한 권이면 이어작성 카드가 바로 그 책의 입력 화면을 연다', () => {
  const { context, state } = fixture({
    books: [book('done', { hasFinalReflection: true, lastDate: '2026-10-30' }), book('active', { startedAt: '2026-09-01', lastDate: '2026-10-20' })],
  });
  context.handleContinueReadingCard();
  assert.equal(state.step, 'input');
  assert.equal(state.selected, 'active');
  assert.equal(state.locked, true);
  assert.equal(context.formData.reading_book_title, '책 active');
});

test('완료 책만 있거나 여러 권이면 선택 화면에 머문다', () => {
  const none = fixture({ books: [book('done', { hasFinalReflection: true })] });
  none.context.handleContinueReadingCard();
  assert.equal(none.state.step, 'select');
  assert.equal(none.state.selected, '');
  assert.match(none.state.notices[0], /작성중인 책이 없어요/);

  const many = fixture({ books: [book('a'), book('b')] });
  many.context.handleContinueReadingCard();
  assert.equal(many.state.step, 'select');
  assert.equal(many.state.selected, '');
});

test('처리 중이거나 완료된 책은 입력 화면으로 넘어가지 않는다', () => {
  const busy = fixture({ books: [book('a')], busy: true });
  busy.context.handleContinueReadingCard();
  assert.equal(busy.state.step, 'select');
  assert.equal(busy.state.selected, '');

  const done = fixture({ books: [book('done', { hasFinalReflection: true })] });
  done.context.continueReadingBook('done');
  assert.equal(done.state.step, 'select');
  assert.match(done.state.blocked, /이미 마무리한 책/);
});

test('원래 시작일이 있으면 마지막 기록일로 덮지 않는다', () => {
  const { context } = fixture({ books: [book('a', { startedAt: '2026-09-01', firstDate: '2026-09-03', lastDate: '2026-10-20' })] });
  context.handleContinueReadingCard();
  assert.equal(context.formData.reading_started_at, '2026-09-01');
});

test('시작일 기록이 없으면 가장 오래된 기록일을 쓴다', () => {
  const { context } = fixture({ books: [book('a', { firstDate: '2026-09-03', lastDate: '2026-10-20' })] });
  context.continueReadingBook('a');
  assert.equal(context.formData.reading_started_at, '2026-09-03');
});

test('이미 고른 책은 현재 회차와 AI 참고자료, 입력된 시작일을 지우지 않는다', () => {
  const formData = { reading_book_title: '책 a', reading_author: '저자', reading_started_at: '2026-08-15', reading_journal: '쓰던 독서장', reading_book_text: '본문', reading_ai_context: '{"version":1}' };
  const { context, state } = fixture({ books: [book('a', { startedAt: '2026-09-01', lastDate: '2026-10-20' })], selected: 'a', formData });
  context.handleContinueReadingCard();
  assert.equal(state.step, 'input');
  assert.equal(context.formData.reading_journal, '쓰던 독서장');
  assert.equal(context.formData.reading_book_text, '본문');
  assert.equal(context.formData.reading_ai_context, '{"version":1}');
  assert.equal(context.formData.reading_started_at, '2026-08-15');
});

test('공통 작성창에서 넘어온 초안은 첫 책 선택에서 독서장으로 유지한다', () => {
  const { context } = fixture({ books: [book('a', { startedAt: '2026-09-01' })], initialJournal: '공통 작성창 글' });
  context.handleContinueReadingCard();
  assert.equal(context.formData.reading_journal, '공통 작성창 글');
});

test('이어작성으로 저장한 회차는 원래 시작일·책 ID·AI 참고자료를 함께 저장한다', async () => {
  const reference = JSON.stringify({ version: 1, bookId: 'a', questions: ['왜 떠났을까'], selectedAnswers: [], aiMemo: 'AI 메모' });
  const formData = { reading_book_title: '책 a', reading_author: '저자', reading_started_at: '', reading_journal: '오늘의 독서장', reading_ai_context: reference };
  const { context, state } = fixture({ books: [book('a', { startedAt: '2026-09-01', lastDate: '2026-10-20' })], selected: 'a', formData });
  context.handleContinueReadingCard();
  await context.handleSaveChapterNote();
  assert.equal(state.saved.reading_started_at, '2026-09-01');
  assert.equal(state.saved.readingId, 'a');
  assert.equal(state.saved.readingBookId, 'a');
  assert.equal(state.saved.reading_journal, '오늘의 독서장');
  assert.deepEqual(JSON.parse(state.saved.reading_ai_context).questions, ['왜 떠났을까']);
  assert.match(state.saved._recordId, /^reading_note_a_/);
});

test('책 날짜는 기록 순서와 무관하게 가장 이른 시작일·기록일과 마지막 기록일을 고른다', () => {
  const records = [
    { startedAt: '2026-10-20', date: '2026-10-20' },
    { startedAt: '2026-09-01', date: '2026-09-02' },
    { startedAt: '', date: '2026-10-25' },
  ];
  const forward = records.reduce(mergeReadingBookDates, { startedAt: '', firstDate: '', lastDate: '' });
  const backward = [...records].reverse().reduce(mergeReadingBookDates, { startedAt: '', firstDate: '', lastDate: '' });
  assert.deepEqual(forward, { startedAt: '2026-09-01', firstDate: '2026-09-02', lastDate: '2026-10-25' });
  assert.deepEqual(backward, forward);
  assert.equal(resolveReadingBookStartDate(forward), '2026-09-01');
  assert.equal(resolveReadingBookStartDate({ startedAt: '', firstDate: '', lastDate: '' }), '');
});

test('이어작성 카드는 기존 버튼 패턴을 쓰고 책 목록과 같은 진입점을 공유한다', () => {
  assert.match(source, /<button\s+type="button"\s+onClick=\{handleContinueReadingCard\}/);
  assert.match(source, /onClick=\{\(\) => continueReadingBook\(b\.readingBookId\)\}/);
  assert.match(source, /\.\.\.mergeReadingBookDates\(\{ startedAt: '', firstDate: '', lastDate: '' \}, recordDates\)/);
});
