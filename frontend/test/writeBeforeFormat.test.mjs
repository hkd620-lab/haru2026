import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDraftEditorData, WRITABLE_FORMATS } from '../src/app/records/writeBeforeFormat.ts';

test('형식 선택 뒤 기존 편집창의 간편·프리미엄 입력칸에 초안이 이어진다', () => {
  const source = '첫 줄\n둘째 줄';
  const diary = buildDraftEditorData('일기', source, '2026-10-23', 'record-1');
  assert.equal(diary.diary_simple, source);
  assert.equal(diary.diary_여백, source);
  assert.equal(diary.diary_title, '첫 줄');
  assert.equal(diary._recordDate, '2026-10-23');
  assert.equal(diary._recordId, 'record-1');
  assert.equal(diary.diary_sayu, undefined, '최종 저장 전에 SAYU 기록을 만들지 않는다');

  const child = buildDraftEditorData('육아일기', source, '2026-10-23', 'record-2');
  assert.equal(child.child_simple, source);
  assert.equal(child.child_space, source);
  assert.equal(buildDraftEditorData('독서사유', source, '2026-10-23', 'record-3').reading_journal, source);
});

test('글 형식마다 초안 원문이 간편과 프리미엄 방식 모두에 남는다', () => {
  for (const format of WRITABLE_FORMATS) {
    const fields = buildDraftEditorData(format, '내 기록', '2026-10-23', 'record-1');
    assert.ok(Object.entries(fields).some(([key, value]) => key.endsWith('_simple') && value === '내 기록'), format);
    assert.ok(Object.entries(fields).some(([key, value]) => !key.endsWith('_simple') && value === '내 기록'), format);
  }
});

test('장부는 글 저장 형식에 나오지 않고 기존 일기가 첫 선택지다', () => {
  assert.equal(WRITABLE_FORMATS[0], '일기');
  assert.ok(WRITABLE_FORMATS.includes('메모'));
  assert.ok(WRITABLE_FORMATS.includes('선교보고'));
  assert.ok(WRITABLE_FORMATS.includes('일반보고'));
  assert.ok(!WRITABLE_FORMATS.includes('HARU가계부'));
  assert.ok(!WRITABLE_FORMATS.includes('HARU보조장부'));
  assert.ok(!WRITABLE_FORMATS.includes('주식거래일지'));
  assert.equal(new Set(WRITABLE_FORMATS).size, WRITABLE_FORMATS.length);
});

test('선교·일반보고 초안은 간편 본문과 프리미엄 여백에 전달된다', () => {
  const source = '보고 제목\n오늘 진행한 활동과 다음 계획';
  for (const [format, prefix] of [['선교보고', 'mission'], ['일반보고', 'report']]) {
    const draft = buildDraftEditorData(format, source, '2026-10-23', 'report-1');
    assert.equal(draft[`${prefix}_simple`], source);
    assert.equal(draft[`${prefix}_space`], source);
    assert.equal(draft[`${prefix}_title`], '보고 제목');
    assert.equal(draft[`${prefix}_sayu`], undefined);
  }
});
