import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDraftFormatData, WRITABLE_FORMATS } from '../src/app/records/writeBeforeFormat.ts';

test('글을 쓴 뒤 고른 형식의 기존 저장 필드에 원문을 전달한다', () => {
  const source = '첫 줄\n둘째 줄';
  assert.deepEqual(buildDraftFormatData('일기', source), {
    diary_simple: source,
    diary_title: '첫 줄',
  });
  assert.deepEqual(buildDraftFormatData('육아일기', source), {
    child_simple: source,
    child_title: '첫 줄',
  });
  assert.deepEqual(buildDraftFormatData('독서사유', source), { reading_journal: source });
  assert.deepEqual(buildDraftFormatData('주식거래일지', source), { stock_memo: source });
});

test('장부는 글 저장 형식에 나오지 않고 기존 일기가 첫 선택지다', () => {
  assert.equal(WRITABLE_FORMATS[0], '일기');
  assert.ok(WRITABLE_FORMATS.includes('메모'));
  assert.ok(!WRITABLE_FORMATS.includes('HARU가계부'));
  assert.ok(!WRITABLE_FORMATS.includes('HARU보조장부'));
  assert.ok(!WRITABLE_FORMATS.includes('주식거래일지'));
  assert.equal(new Set(WRITABLE_FORMATS).size, WRITABLE_FORMATS.length);
});
