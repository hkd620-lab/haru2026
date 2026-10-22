import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDraftFormatData, WRITABLE_FORMATS } from '../src/app/records/writeBeforeFormat.ts';

test('글을 쓴 뒤 고른 형식의 기존 저장 필드에 원문을 전달한다', () => {
  const source = '첫 줄\n둘째 줄';
  assert.deepEqual(buildDraftFormatData('일기', source), {
    diary_simple: source,
    diary_title: '첫 줄',
    diary_sayu: source,
    diary_style: 'simple',
    diary_mode: 'ORIGINAL',
    diary_images: '[]',
    diary_imageMeta: '[]',
  });
  assert.deepEqual(buildDraftFormatData('육아일기', source), {
    child_simple: source,
    child_title: '첫 줄',
    child_sayu: source,
    child_style: 'simple',
    child_mode: 'ORIGINAL',
    child_images: '[]',
    child_imageMeta: '[]',
  });
  assert.equal(buildDraftFormatData('독서사유', source).reading_sayu, source);
});

test('장부는 글 저장 형식에 나오지 않고 기존 일기가 첫 선택지다', () => {
  assert.equal(WRITABLE_FORMATS[0], '일기');
  assert.ok(WRITABLE_FORMATS.includes('메모'));
  assert.ok(!WRITABLE_FORMATS.includes('HARU가계부'));
  assert.ok(!WRITABLE_FORMATS.includes('HARU보조장부'));
  assert.ok(!WRITABLE_FORMATS.includes('주식거래일지'));
  assert.equal(new Set(WRITABLE_FORMATS).size, WRITABLE_FORMATS.length);
});

test('저장 후보의 모든 글은 해당 형식 원문과 SAYU 원본을 함께 남긴다', () => {
  for (const format of WRITABLE_FORMATS) {
    const fields = buildDraftFormatData(format, '내 기록');
    const sayuKey = Object.keys(fields).find((key) => key.endsWith('_sayu'));
    assert.ok(sayuKey, `${format}: SAYU 원본 필드`);
    assert.equal(fields[sayuKey], '내 기록');
    assert.equal(fields[sayuKey.replace('_sayu', '_simple')], '내 기록');
  }
});
