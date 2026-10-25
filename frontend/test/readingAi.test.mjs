import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExternalReadingPrompt, importExternalReadingAnswer, mergeInAppReadingReference, appendReadingAiTurn, resetReadingBookDraft, boundedReadingConversation, selectedReadingAnswers, applyReadingAiReference, parseReadingAiReference, readingAiReferenceText, buildPreviousReadingSummary, buildReadingSnapshot, readingAiErrorMessage } from '../src/app/services/readingAiCore.ts';
import { makeReadingBookId, buildReadingMetaCombined } from '../src/app/types/haruTypes.ts';
import { saveReadingDraft, readReadingDraft, clearReadingDraft, readingDraftKey, readingChatKey } from '../src/app/services/readingDraft.ts';

const messages = [
  { id: 'q1', role: 'user', content: '자유는 무슨 뜻이야?' },
  { id: 'a1', role: 'assistant', content: 'AI가 설명한 자유.' },
  { id: 'q2', role: 'user', content: '책임과는 어떤 관계야?' },
  { id: 'a2', role: 'assistant', content: 'AI가 설명한 책임.' },
];
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};

test('external questions work without a passage and only include the current book context', () => {
  const context = { bookTitle: '역사책', author: '저자', currentBookText: '', readingJournal: '내 생각', previousReadingSummary: '이전 회차' };
  const prompt = buildExternalReadingPrompt(context, '중국에도 노예제도가 있었나?');
  assert.match(prompt, /중국에도 노예제도가 있었나/);
  assert.match(prompt, /내 생각/);
  assert.ok(!prompt.includes('[현재 본문]'));
  assert.throws(() => buildExternalReadingPrompt(context, ' '), /질문/);
  assert.match(buildExternalReadingPrompt({ ...context, currentBookText: '본문' }, '질문'), /\[현재 본문\]\n본문/);
});
test('external answers retain attribution and existing references without entering the user journal', () => {
  const prior = applyReadingAiReference('내 생각', 'book-a', selectedReadingAnswers(messages, ['a1']), '기존 AI 메모').reference;
  const imported = importExternalReadingAnswer(JSON.stringify(prior), 'book-a', '역사 질문', '외부 답변', 'ChatGPT');
  assert.equal(imported.selectedAnswers.length, 2);
  assert.equal(imported.selectedAnswers[0].answer, messages[1].content);
  assert.match(imported.aiMemo, /기존 AI 메모/);
  assert.match(imported.aiMemo, /외부 AI 답변 · ChatGPT/);
  const applied = applyReadingAiReference('내 생각', 'book-a', imported.selectedAnswers, imported.aiMemo);
  assert.match(applied.journal, /역사 질문/);
  assert.ok(!applied.journal.includes('외부 답변'));
  assert.deepEqual(parseReadingAiReference(JSON.stringify(applied.reference), 'book-a'), imported);
  const answerOnly = importExternalReadingAnswer(undefined, 'book-b', '', '다른 답변', 'Gemini');
  assert.deepEqual(answerOnly.questions, []);
  assert.equal(importExternalReadingAnswer(prior, 'book-b', '', '답변', 'Claude').selectedAnswers.length, 1);
});
test('external import rejects empty, excessive, duplicate and full references without losing existing content', () => {
  assert.throws(() => importExternalReadingAnswer(undefined, 'b', '', ' ', 'ChatGPT'), /붙여넣/);
  assert.throws(() => importExternalReadingAnswer(undefined, 'b', '', 'x'.repeat(3001), 'ChatGPT'), /3,000/);
  assert.throws(() => importExternalReadingAnswer(undefined, 'b', '', '답변', 'invalid'), /출처/);
  const first = importExternalReadingAnswer(undefined, 'b', '질문', '답변', 'Claude');
  assert.throws(() => importExternalReadingAnswer(first, 'b', '질문', '답변', 'Claude'), /이미/);
  const second = importExternalReadingAnswer(first, 'b', '', '다음 답변', 'Gemini');
  const third = importExternalReadingAnswer(second, 'b', '', '세 번째 답변', 'ChatGPT');
  assert.throws(() => importExternalReadingAnswer(third, 'b', '', '추가', 'ChatGPT'), /3개/);
  assert.throws(() => importExternalReadingAnswer({ ...first, aiMemo: 'x'.repeat(3990) }, 'b', '', '새 답변', 'ChatGPT'), /4,000/);
  assert.equal(first.selectedAnswers.length, 1);
});
test('applying internal AI notes after an external import preserves external answers and attribution', () => {
  const external = importExternalReadingAnswer(undefined, 'b', '외부 질문', '외부 원문', 'Claude');
  const internal = selectedReadingAnswers(messages, ['a1']);
  const merged = mergeInAppReadingReference(external, 'b', internal, '내부 참고 메모');
  const applied = applyReadingAiReference('내 생각', 'b', merged.selected, merged.aiMemo);
  assert.deepEqual(applied.reference.selectedAnswers, [...external.selectedAnswers, ...internal]);
  assert.match(applied.reference.aiMemo, /외부 AI 답변 · Claude/);
  assert.match(applied.reference.aiMemo, /외부 원문/);
  assert.match(applied.reference.aiMemo, /내부 참고 메모/);
  assert.ok(!applied.journal.includes('외부 원문'));
  const repeated = mergeInAppReadingReference(applied.reference, 'b', internal, '새 내부 메모');
  assert.deepEqual(repeated.selected, merged.selected);
  assert.ok(!repeated.aiMemo.includes('내부 참고 메모'));
  assert.match(repeated.aiMemo, /외부 원문/);
  const reverseOrder = importExternalReadingAnswer(applied.reference, 'b', '추가 질문', '추가 답변', 'Gemini');
  assert.equal(reverseOrder.selectedAnswers.length, 3);
  assert.equal(mergeInAppReadingReference(external, 'other-book', internal, '메모').selected.length, 1);
});
test('combined internal/external limits reject changes without mutating saved references', () => {
  const external = importExternalReadingAnswer(undefined, 'b', '질문', '외부 원문', 'ChatGPT');
  const original = JSON.stringify(external);
  const three = [...selectedReadingAnswers(messages, ['a1', 'a2']), { question: '셋', answer: '셋 답변' }];
  assert.throws(() => mergeInAppReadingReference(external, 'b', three, '메모'), /3개/);
  assert.throws(() => mergeInAppReadingReference(external, 'b', three.slice(0, 1), 'm'.repeat(4000)), /4,000/);
  assert.equal(JSON.stringify(external), original);
});

test('only chosen answers and their actual user questions become reference material', () => {
  const selected = selectedReadingAnswers(messages, ['a2']);
  assert.deepEqual(selected, [{ question: messages[2].content, answer: messages[3].content }]);
  const applied = applyReadingAiReference('나는 내 선택을 돌아봤다.', 'book-a', selected, 'AI 참고 요약');
  assert.ok(applied.journal.includes(messages[2].content));
  assert.ok(!applied.journal.includes(messages[3].content));
  assert.ok(!applied.journal.includes('AI 참고 요약'));
  assert.equal(applied.reference.version, 1);
  assert.equal(applied.reference.selectedAnswers[0].answer, messages[3].content);
  assert.match(readingAiReferenceText(JSON.stringify(applied.reference), 'book-a'), /사용자의 생각이 아님/);
});
test('old records without the field remain readable and cross-book reference is rejected', () => {
  assert.equal(parseReadingAiReference(undefined), null);
  assert.equal(readingAiReferenceText('broken'), '');
  const applied = applyReadingAiReference('', 'book-a', selectedReadingAnswers(messages, ['a1']), '참고');
  assert.equal(parseReadingAiReference(JSON.stringify(applied.reference), 'book-b'), null);
});
test('switching books drops old completion flags, OCR and AI fields while preserving unrelated formats', () => {
  const reset = resetReadingBookDraft({ diary_simple: '다른 형식 원문', reading_book_text: '이전 책', reading_ai_context: '이전 대화', reading_status: 'completed', readingStatus: 'completed', readingId: 'old', reading_final_sayu: '마무리', entryType: 'finalReflection', bookTitle: 'old', reading_ocr_photo_count: '20' }, '새 책', '저자', '2026-10-06');
  assert.equal(reset.diary_simple, '다른 형식 원문'); assert.equal(reset.reading_book_title, '새 책');
  for (const key of ['reading_status', 'readingStatus', 'readingId', 'entryType', 'reading_final_sayu', 'reading_ocr_photo_count']) assert.equal(reset[key], undefined);
  assert.equal(reset.reading_book_text, ''); assert.equal(reset.reading_ai_context, '');
});

test('첫 책 선택은 공통 작성창 초안을 보존하고 이후 책 전환은 소감을 비운다', () => {
  const source = '공통 작성창에서 쓴 독서 소감';
  for (const title of ['', '기존 책']) {
    const first = resetReadingBookDraft({ reading_journal: source, reading_ai_context: '이전 대화' }, title, '저자', '2026-10-23', source);
    assert.equal(first.reading_journal, source);
    assert.equal(first.reading_ai_context, '');
    const next = resetReadingBookDraft(first, '다른 책', '', '2026-10-23');
    assert.equal(next.reading_journal, '');
  }
});
test('reapplying a selection does not duplicate user questions', () => {
  const selected = selectedReadingAnswers(messages, ['a1']);
  const first = applyReadingAiReference('내 생각', 'book-a', selected, '메모');
  const second = applyReadingAiReference(first.journal, 'book-a', selected, '메모');
  assert.equal(first.journal, second.journal);
});
test('long conversation stays bounded and preserves the latest follow-up pair', () => {
  const long = Array.from({ length: 200 }, (_, index) => ({ id: String(index), role: index % 2 ? 'assistant' : 'user', content: `${index}:` + 'a'.repeat(3900) }));
  const bounded = boundedReadingConversation(long);
  assert.ok(bounded.length <= 12);
  assert.ok(bounded.reduce((sum, message) => sum + message.content.length, 0) <= 12000);
  assert.equal(bounded[0].role, 'user');
  assert.ok(bounded.at(-1).content.startsWith('199:'));
});
test('long local sessions drop invisible selections so new answers remain selectable', () => {
  const transcript = Array.from({ length: 60 }, (_, index) => ({ id: String(index), role: index % 2 ? 'assistant' : 'user', content: String(index) }));
  const next = appendReadingAiTurn(transcript, ['1', '3'], '追加質問', '新しい答え', 'new');
  assert.equal(next.messages.length, 60); assert.deepEqual(next.selectedIds, ['3']); assert.equal(next.selectionLost, true);
  assert.equal(next.messages.at(-1).id, 'new-a');
});
test('prior notes favor recent user journals and final snapshot includes new sessions', () => {
  const notes = Array.from({ length: 12 }, (_, index) => ({ date: String(index), readingJournal: `自分${index}:` + 'j'.repeat(800), readingBookText: 't'.repeat(12000) }));
  const summary = buildPreviousReadingSummary(notes);
  assert.ok(summary.length <= 3000); assert.ok(summary.includes('自分11:')); assert.ok(!summary.includes('自分0:'));
  const snapshot = buildReadingSnapshot([{ date: '2026-01-01', text: 'old'.repeat(5000) }, { date: '2026-10-06', text: 'latest USER QUESTION' }]);
  assert.ok(snapshot.length <= 4300); assert.ok(snapshot.includes('latest USER QUESTION'));
});
test('stable book IDs and original canonical/legacy meta remain compatible', () => {
  assert.equal(makeReadingBookId(' 합성 책 ', '저자'), makeReadingBookId('합성 책', '저자'));
  const note = buildReadingMetaCombined({ bookTitle: '합성 책', author: '저자', entryType: 'chapter_note' });
  const final = buildReadingMetaCombined({ bookTitle: '합성 책', author: '저자', entryType: 'final_reflection' });
  assert.equal(note.readingId, final.readingId); assert.equal(note.readingBookId, note.readingId);
  assert.equal(note.entryType, 'readingNote'); assert.equal(final.entryType, 'finalReflection'); assert.equal(final.readingStatus, 'completed');
});
test('close/refresh recovery retains text without photos, and account/book chats stay isolated', () => {
  const s = storage();
  const draft = { version: 1, uid: 'user-a', updatedAt: Date.now(), selectedBookId: 'book-a', entryId: '', entryDate: '', formData: { reading_book_title: '책 A', reading_book_text: '본문', reading_journal: '생각', reading_images: 'base64', other: 'irrelevant' } };
  assert.equal(saveReadingDraft(s, draft), true);
  const restored = readReadingDraft(s, 'user-a');
  assert.equal(restored.formData.reading_journal, '생각'); assert.equal(restored.formData.reading_images, undefined);
  assert.equal(readReadingDraft(s, 'user-b'), null);
  assert.notEqual(readingChatKey('user-a', 'book-a', ''), readingChatKey('user-a', 'book-b', ''));
  s.setItem(readingChatKey('user-a', 'book-a', ''), 'conversation');
  clearReadingDraft(s, 'user-a', 'book-a', '');
  assert.equal(s.getItem(readingDraftKey('user-a')), null); assert.equal(s.getItem(readingChatKey('user-a', 'book-a', '')), null);
});
test('expired drafts are purged and unavailable storage reports failure', () => {
  const s = storage();
  saveReadingDraft(s, { version: 1, uid: 'u', updatedAt: Date.now() - 8 * 86400000, formData: { reading_journal: 'old' }, selectedBookId: '', entryId: '', entryDate: '' });
  assert.equal(readReadingDraft(s, 'u'), null);
  assert.equal(saveReadingDraft({ setItem: () => { throw new Error('quota'); } }, { formData: {} }), false);
});
test('monthly quota, login and network errors are understandable and retain drafts', () => {
  assert.match(readingAiErrorMessage({ details: { reason: 'MONTHLY_AI_QUOTA_EXCEEDED' } }), /이번 달/);
  assert.match(readingAiErrorMessage({ code: 'functions/unavailable' }), /네트워크/);
  assert.match(readingAiErrorMessage({ code: 'functions/unauthenticated' }), /로그인/);
});
