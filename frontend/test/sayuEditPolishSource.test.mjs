import test from 'node:test';
import assert from 'node:assert/strict';
import { getSayuEditPolishOriginal, supportsSayuOriginalPolishPreview } from '../src/app/records/sayuEditPolishSource.ts';

const reading = {
  reading_book_title: '합성 책',
  reading_author: '합성 저자',
  reading_book_text: '책에서 직접 입력한 발췌',
  reading_journal: '사용자가 적은 생각',
  reading_ai_context: '{"answer":"내부 AI 메모"}',
  reading_note_createdAt: '2026-11-14T02:00:00Z',
  reading_completedAt: '2026-11-14T03:00:00Z',
  reading_reflection_answers: '["정리할 때 참고한 답변"]',
  reading_entries_snapshot: 'x'.repeat(4300),
  reading_ocr_photo_count: '3',
};

test('중간 독서사유는 책 정보와 사용자 입력만 재다듬기에 사용한다', () => {
  assert.equal(getSayuEditPolishOriginal('reading', reading, false),
    '합성 책\n\n합성 저자\n\n책에서 직접 입력한 발췌\n\n사용자가 적은 생각');
});

test('완료 독서사유와 본문 없는 독서사유는 저장 본문을 사용하도록 원문을 비운다', () => {
  assert.equal(getSayuEditPolishOriginal('reading', reading, true), '');
  assert.equal(getSayuEditPolishOriginal('reading', { reading_book_title: '책', reading_ai_context: 'null' }, false), '');
});

test('원본 탭의 즉시 미리보기는 일반 기록에만 적용되고 구조화 기록의 조작은 그대로 유지한다', () => {
  for (const key of ['diary', 'essay', 'travel', 'reading', 'memo', 'report']) {
    assert.equal(supportsSayuOriginalPolishPreview(key), true, key);
  }
  for (const key of ['ledger', 'household', 'stock', 'voiding', 'growthTimeline', 'child_measure', 'haruraw', undefined]) {
    assert.equal(supportsSayuOriginalPolishPreview(key), false, key);
  }
});
