import assert from 'node:assert/strict';
import test from 'node:test';
import { CATEGORY_FORMATS } from '../src/app/types/haruTypes.ts';
import { applyDraftSaveTarget, buildDraftEditorData, readHomeWritingDraft, DRAFT_PICKER_FORMATS, WORK_ENTRY_FORMATS, WRITABLE_FORMATS } from '../src/app/records/writeBeforeFormat.ts';
import { RECORD_FORMAT_DESCRIPTIONS } from '../src/app/records/recordFormatDescriptions.ts';

test('홈에서 넘긴 글은 같은 계정의 실제 글 형식에만 이어지고 원문을 유지한다', () => {
  const content = '첫 줄\n  둘째 줄과 여백  ';
  for (const format of DRAFT_PICKER_FORMATS) {
    const state = { homeWritingDraft: { ownerUid: 'owner', content, format } };
    assert.deepEqual(readHomeWritingDraft(state, 'owner'), state.homeWritingDraft);
    assert.equal(readHomeWritingDraft(state, 'different-user'), null);
    assert.equal(readHomeWritingDraft(state, undefined), null);
    assert.ok(RECORD_FORMAT_DESCRIPTIONS[format]?.description, `${format} 작성 전후에 보여줄 설명`);
  }
  for (const draft of [null, {}, { ownerUid: 'owner', content: '  ', format: '일기' }, { ownerUid: 'owner', content, format: 'HARU가계부' }, { ownerUid: 'owner', content, format: '편지' }, { ownerUid: 'owner', content: 3, format: '일기' }]) {
    assert.equal(readHomeWritingDraft({ homeWritingDraft: draft }, 'owner'), null);
  }
});

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

test('일반 사용자의 기록 선택에 선교·일반보고가 나오고 주식거래일지는 비서로 옮겨 나오지 않는다', () => {
  for (const list of [DRAFT_PICKER_FORMATS, WORK_ENTRY_FORMATS]) {
    for (const format of ['선교보고', '일반보고']) assert.ok(list.includes(format), format);
    assert.ok(!list.includes('주식거래일지'), '주식은 홈 비서(HARU주식관리)에서 시작한다');
    assert.equal(new Set(list).size, list.length);
  }
  assert.ok(!DRAFT_PICKER_FORMATS.includes('HARU가계부'));
  assert.ok(!DRAFT_PICKER_FORMATS.includes('HARU보조장부'));
  assert.ok(!CATEGORY_FORMATS['업무'].includes('주식거래일지'), 'SAYU 업무 묶음에 주식이 중복되지 않는다');
  assert.ok(CATEGORY_FORMATS['HARU주식관리'].includes('HARU주식관리'), '기존 저장 식별자를 유지한다');
});

test('선택 목록에서 빠진 주식거래일지도 이미 전달된 초안은 같은 계정에게 계속 이어진다', () => {
  const content = '삼성전자 10주 매수\n이유와 복기';
  const state = { homeWritingDraft: { ownerUid: 'owner', content, format: '주식거래일지' } };
  assert.deepEqual(readHomeWritingDraft(state, 'owner'), state.homeWritingDraft);
  assert.equal(readHomeWritingDraft(state, 'different-user'), null);
  assert.equal(readHomeWritingDraft(state, undefined), null);
  assert.equal(readHomeWritingDraft({ homeWritingDraft: { ownerUid: 'owner', content, format: 'HARU주식관리' } }, 'owner'), null);
});

test('주식거래일지 초안은 거래소감으로만 이어지고 제목은 종목명 입력에 맡긴다', () => {
  const draft = buildDraftEditorData('주식거래일지', '첫 줄\n오늘 거래 복기', '2026-10-23', 'stock-1');
  assert.equal(draft.stock_reflection, '첫 줄\n오늘 거래 복기');
  assert.equal(draft.stock_simple, undefined, '입력칸 없는 숨은 복사본을 만들지 않는다');
  assert.equal(draft.stock_title, undefined);
  assert.equal(draft.stock_sayu, undefined);
  assert.equal(draft._recordId, 'stock-1');
  assert.equal(draft._recordDate, '2026-10-23');
});

test('새 독서 회차는 초안 ID로 재시도하고 기존 회차 수정은 원래 ID·날짜를 유지한다', () => {
  const existing = { reading_accumulation_mode: 'edit', _recordId: 'old-entry', _recordDate: '2026-10-01', reading_journal: '수정한 소감' };
  assert.deepEqual(applyDraftSaveTarget(existing, 'draft-id', '2026-10-23'), existing);
  const appended = applyDraftSaveTarget({ ...existing, reading_accumulation_mode: 'append', _recordId: 'new-entry' }, 'draft-id', '2026-10-23');
  assert.equal(appended._recordId, 'draft-id');
  assert.equal(appended._recordDate, '2026-10-23');
});
