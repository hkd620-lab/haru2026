// EPUB 본문·사진 규칙(2026-10-23) — 합본 조건 재확인, 그 형식 사진만 최대 5장, 내려받기 실패 사진 제외.
// 실행: npm run build && node --test test/epubContent.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const epub = require('../lib/epubContent.js');

const range = { startDate: '2026-10-01', endDate: '2026-10-31' };

test('사진: 요청 형식의 _images 우선, 없으면 _imageMeta, 중복 제거, 최대 5장, 다른 형식 사진은 섞지 않는다', () => {
  const urls = Array.from({ length: 7 }, (_, i) => `https://p/${i}.jpg`);
  const record = {
    diary_images: JSON.stringify([urls[0], urls[0], ...urls.slice(1)]),
    essay_images: JSON.stringify(['https://p/essay.jpg']),
  };
  assert.deepEqual(epub.getRecordPhotoUrls(record, 'diary'), urls.slice(0, 5));
  assert.deepEqual(epub.getRecordPhotoUrls({ diary_imageMeta: JSON.stringify([{ url: urls[6] }]) }, 'diary'), [urls[6]]);
  assert.deepEqual(epub.getRecordPhotoUrls(record, 'memo'), []);
});

test('합본 조건: 기간·비서 아님·SAYU 완료·특별한 날(specialDays 또는 옛 숫자 _rating)', () => {
  const base = { date: '2026-10-05', diary_sayu: 'SAYU 글' };
  assert.equal(epub.isEligibleMergeRecord(base, 'diary', range), true);
  assert.equal(epub.isEligibleMergeRecord({ ...base, diary_sayu: ' ' }, 'diary', range), false);
  assert.equal(epub.isEligibleMergeRecord({ ...base, date: '2026-11-01' }, 'diary', range), false);
  assert.equal(epub.isEligibleMergeRecord({ ...base, source: 'result_ai_chat' }, 'diary', range), false);
  assert.equal(epub.isEligibleMergeRecord(base, 'diary', { ...range, filter: 'special' }), false);
  assert.equal(epub.isEligibleMergeRecord({ ...base, specialDays: { diary: true } }, 'diary', { ...range, filter: 'special' }), true);
  assert.equal(epub.isEligibleMergeRecord({ ...base, diary_rating: 1 }, 'diary', { ...range, filter: 'special' }), true);
  assert.equal(epub.isEligibleMergeRecord({ ...base, work_rating: '★★★' }, 'work', { ...range, filter: 'special' }), false);
});

test('기록 ID 검증: 비거나 너무 많거나 경로 문자가 있으면 거절', () => {
  assert.equal(epub.validateRecordIds(undefined), null);
  assert.deepEqual(epub.validateRecordIds([]), []);
  assert.deepEqual(epub.validateRecordIds(['a/b']), []);
  assert.deepEqual(epub.validateRecordIds(Array.from({ length: 501 }, (_, i) => `r${i}`)), []);
  assert.deepEqual(epub.validateRecordIds(['a', 'b', 'a']), ['a', 'b']);
});

test('대상 형식: 선교·일반보고 포함, 보조장부·주식 제외', () => {
  assert.equal(epub.isMergeRecordFormat('선교보고'), true);
  assert.equal(epub.isMergeRecordFormat('HARU보조장부'), false);
  assert.equal(epub.isMergeRecordFormat('주식거래일지'), false);
});

test('합본 장: 요청 형식의 SAYU 글을 쓰고 HTML 을 이스케이프한다(같은 날 다른 형식 본문을 넣지 않음)', () => {
  const html = epub.mergeRecordToHtml({ diary_sayu: '일기 <b>본문</b>\n둘째 줄', essay_sayu: '에세이', essay_title: '에세이 제목' }, 'diary', []);
  assert.match(html, /일기 &lt;b&gt;본문&lt;\/b&gt;<br\/>둘째 줄/);
  assert.doesNotMatch(html, /에세이/);
});

test('사진 내려받기 확인: 실패한 사진만 빼고 개수를 세며, 파일당 상한을 넘는 사진도 센다', async () => {
  const chapters = [['https://ok/1', 'https://bad/2'], ['https://ok/3', 'https://ok/4']];
  const check = async (url) => !url.includes('bad');
  const result = await epub.filterReachablePhotos(chapters, check, { maxTotal: 3 });
  assert.deepEqual(result.urlsByChapter, [['https://ok/1'], ['https://ok/3']]);
  assert.equal(result.failed, 1);
  assert.equal(result.overLimit, 1);
  const thrown = await epub.filterReachablePhotos([['https://x/1']], async () => { throw new Error('net'); });
  assert.deepEqual(thrown.urlsByChapter, [[]]);
  assert.equal(thrown.failed, 1);
  assert.equal(thrown.overLimit, 0);
});
